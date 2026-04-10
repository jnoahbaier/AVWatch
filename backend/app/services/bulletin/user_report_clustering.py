"""
User Report Clustering Service.

Runs every 30 minutes. Two passes:
  Pass A — Match clusters of user reports against existing Reddit bulletin items.
  Pass B — Turn large-enough clusters of user reports into brand new bulletin items.

Pass B uses location + time proximity and Gemini semantic similarity to cluster reports,
rather than requiring an exact match on company/incident_type. This handles cases where
reporters describe the same event differently (e.g. "reckless driving" vs "collision",
or "Waymo" vs "unknown").

Privacy: exact coordinates are never written to bulletin_items. Only a
neighborhood-level location string is derived and stored.
"""

import json
import logging
import math
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

import httpx
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import async_session_maker
from app.models.bulletin_item import BulletinItem
from app.models.incident import Incident

logger = logging.getLogger(__name__)

# ── Tuneable constants ────────────────────────────────────────────────────────
MIN_CLUSTER_SIZE = 3          # distinct IPs needed to create a new bulletin item
MIN_REPORTS_TO_BOOST = 2      # distinct IPs needed to boost an existing Reddit item
TIME_WINDOW_HOURS = 2         # reports within this window = same incident
LOOK_BACK_HOURS = 48          # how far back to scan for unmatched reports
LOCATION_RADIUS_METERS = 500  # reports within this radius = same location

# Companies too vague to cluster meaningfully for Pass A (Reddit boosting)
SKIP_COMPANIES_PASS_A = {"unknown", None}
# Incident types too vague to match against Reddit items
SKIP_TYPES_PASS_A = {"other"}


# ── Geo helpers ───────────────────────────────────────────────────────────────

def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return approximate distance in metres between two lat/lon points."""
    R = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _centroid(coords: list[tuple[float, float]]) -> tuple[float, float]:
    """Return the mean lat/lon of a list of (lat, lon) tuples."""
    lats = [c[0] for c in coords]
    lons = [c[1] for c in coords]
    return sum(lats) / len(lats), sum(lons) / len(lons)


def _neighborhood_label(lat: float, lon: float, city: str) -> str:
    """
    Return a coarse neighborhood label.
    For now we use the city name + a compass quadrant derived from rough SF boundaries.
    A production version would call a reverse-geocoding API here.
    """
    # Very rough SF quadrant split
    if city.lower() in ("san francisco", "sf"):
        ns = "North" if lat > 37.775 else "South"
        ew = "East" if lon > -122.42 else "West"
        return f"{ns}{ew} {city}"
    return city


def _parse_location(location) -> Optional[tuple[float, float]]:
    """
    Parse a PostGIS location value into (lat, lon).
    Handles both WKBElement (binary hex) and WKT strings.
    """
    import struct
    try:
        # GeoAlchemy2 WKBElement — decode hex WKB
        hex_str = str(location)
        raw = bytes.fromhex(hex_str)
        # WKB point: 1 byte order + 4 byte type + 8 byte lon + 8 byte lat
        byte_order = raw[0]  # 1 = little-endian
        if byte_order == 1:
            lon, lat = struct.unpack_from('<dd', raw, 5)
        else:
            lon, lat = struct.unpack_from('>dd', raw, 5)
        return float(lat), float(lon)
    except Exception:
        pass
    # Fallback: WKT string "POINT(lon lat)"
    import re
    m = re.match(r"POINT\(([^\s]+)\s+([^\s]+)\)", str(location) or "")
    if m:
        return float(m.group(2)), float(m.group(1))
    return None


# ── Title / summary helpers ───────────────────────────────────────────────────

_COMPANY_LABELS = {
    "waymo": "Waymo",
    "cruise": "Cruise",
    "zoox": "Zoox",
    "tesla": "Tesla",
}

_TYPE_LABELS = {
    "collision": "collision",
    "near_miss": "near-miss",
    "sudden_behavior": "sudden behavior",
    "blockage": "blockage",
}


def _make_title(company: str, incident_type: str) -> str:
    co = _COMPANY_LABELS.get(company, company.title())
    tp = _TYPE_LABELS.get(incident_type, incident_type.replace("_", " "))
    return f"{co} {tp} reported by community"


def _make_summary(count: int, company: str, incident_type: str) -> str:
    co = _COMPANY_LABELS.get(company, company.title())
    tp = _TYPE_LABELS.get(incident_type, incident_type.replace("_", " "))
    return (
        f"{count} community members independently reported a {co} {tp}. "
        "No personal details are shared."
    )


def _majority_value(values: list[Optional[str]], fallback: str) -> str:
    """
    Return the most common non-null, non-vague value from the list.
    Falls back to the most common value overall, then to fallback.
    """
    vague = {"unknown", "other", None}
    specific = [v for v in values if v not in vague]
    if specific:
        return Counter(specific).most_common(1)[0][0]
    all_vals = [v for v in values if v]
    if all_vals:
        return Counter(all_vals).most_common(1)[0][0]
    return fallback


# ── Core clustering logic ─────────────────────────────────────────────────────

class UserReportClusteringService:
    """Clusters user-submitted incident reports and promotes them to the bulletin board."""

    async def run(self, db: AsyncSession) -> dict:
        """Run both clustering passes. Returns a stats dict."""
        logger.info("UserReportClusteringService: starting run")

        unmatched = await self._fetch_unmatched_reports(db)
        logger.info(f"Found {len(unmatched)} unmatched user reports")

        if not unmatched:
            return {"pass_a_boosted": 0, "pass_b_created": 0}

        # Extract lat/lon from PostGIS location
        reports_with_coords = []
        for r in unmatched:
            coords = _parse_location(r.location) if r.location else None
            if coords:
                reports_with_coords.append((r, coords))

        pass_a_boosted, boosted_ids = await self._pass_a(db, reports_with_coords)
        remaining = [(r, c) for r, c in reports_with_coords if r.id not in boosted_ids]
        pass_b_created = await self._pass_b(db, remaining)

        await db.commit()
        logger.info(
            f"UserReportClusteringService done: "
            f"pass_a_boosted={pass_a_boosted} pass_b_created={pass_b_created}"
        )
        return {"pass_a_boosted": pass_a_boosted, "pass_b_created": pass_b_created}

    async def _fetch_unmatched_reports(self, db: AsyncSession) -> list[Incident]:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=LOOK_BACK_HOURS)
        stmt = select(Incident).where(
            and_(
                Incident.source == "user_report",
                Incident.matched_bulletin_item_id.is_(None),
                Incident.occurred_at >= cutoff,
            )
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    # ── Pass A: match clusters against existing Reddit bulletin items ─────────

    async def _pass_a(
        self,
        db: AsyncSession,
        reports_with_coords: list[tuple[Incident, tuple[float, float]]],
    ) -> tuple[int, set[UUID]]:
        """
        For each cluster of ≥MIN_REPORTS_TO_BOOST distinct-IP reports with a known
        company/type, look for an existing Reddit-sourced bulletin item and boost it.
        Returns (number of items boosted, set of incident IDs consumed).
        """
        # Pass A still groups by company+type since Reddit items have known company/type.
        # Exclude vague company/type from this pass only.
        eligible = [
            (r, c) for r, c in reports_with_coords
            if r.av_company not in SKIP_COMPANIES_PASS_A
            and r.incident_type not in SKIP_TYPES_PASS_A
        ]
        clusters = self._build_typed_clusters(eligible, MIN_REPORTS_TO_BOOST)
        boosted_count = 0
        consumed_ids: set[UUID] = set()

        for cluster_key, cluster_reports in clusters.items():
            company, incident_type, _ = cluster_key
            bulletin_item = await self._find_reddit_bulletin_item(
                db, company, incident_type, cluster_reports
            )
            if bulletin_item is None:
                continue

            existing = set(bulletin_item.user_report_ids or [])
            new_ids = [str(r.id) for r, _ in cluster_reports if str(r.id) not in existing]
            if not new_ids:
                continue

            bulletin_item.user_report_ids = list(existing) + new_ids
            bulletin_item.signal_count = (bulletin_item.signal_count or 0) + len(new_ids)

            if len(bulletin_item.user_report_ids) >= 5:
                bulletin_item.is_hot = True

            for r, _ in cluster_reports:
                r.status = "corroborated"
                r.matched_bulletin_item_id = bulletin_item.id
                consumed_ids.add(r.id)

            boosted_count += 1
            logger.info(
                f"Pass A: boosted bulletin item {bulletin_item.id} "
                f"with {len(new_ids)} user reports"
            )

        return boosted_count, consumed_ids

    async def _find_reddit_bulletin_item(
        self,
        db: AsyncSession,
        company: str,
        incident_type: str,
        cluster_reports: list[tuple[Incident, tuple[float, float]]],
    ) -> Optional[BulletinItem]:
        """Find an active Reddit bulletin item matching company+type within time window."""
        times = [r.occurred_at for r, _ in cluster_reports]
        earliest = min(times) - timedelta(hours=TIME_WINDOW_HOURS)
        latest = max(times) + timedelta(hours=TIME_WINDOW_HOURS)

        stmt = select(BulletinItem).where(
            and_(
                BulletinItem.av_company == company,
                BulletinItem.incident_type == incident_type,
                BulletinItem.status == "active",
                BulletinItem.source_platform == "reddit",
                BulletinItem.occurred_at >= earliest,
                BulletinItem.occurred_at <= latest,
            )
        ).limit(1)
        result = await db.execute(stmt)
        return result.scalars().first()

    # ── Pass B: create new bulletin items from large spatial clusters ──────────

    async def _pass_b(
        self,
        db: AsyncSession,
        reports_with_coords: list[tuple[Incident, tuple[float, float]]],
    ) -> int:
        """
        For each cluster of ≥MIN_CLUSTER_SIZE distinct-IP reports that didn't match
        a Reddit item, create a new community-sourced bulletin item.

        Clustering is based on location + time only — company and incident_type are
        NOT required to match. A Gemini semantic similarity check on the descriptions
        confirms the reports are talking about the same event.
        """
        clusters = self._build_spatial_clusters(reports_with_coords, MIN_CLUSTER_SIZE)
        created_count = 0

        for cluster_reports in clusters:
            # Semantic similarity check: do these descriptions describe the same event?
            descriptions = [r.description for r, _ in cluster_reports if r.description]
            is_same_incident = await self._check_semantic_similarity(descriptions)
            if not is_same_incident:
                logger.info(
                    f"Pass B: cluster of {len(cluster_reports)} reports failed semantic "
                    "similarity check — skipping (likely unrelated events at same location)"
                )
                continue

            # Derive company and incident_type by majority vote
            company = _majority_value(
                [r.av_company for r, _ in cluster_reports], fallback="unknown"
            )
            incident_type = _majority_value(
                [r.incident_type for r, _ in cluster_reports], fallback="other"
            )

            coords_list = [c for _, c in cluster_reports]
            clat, clon = _centroid(coords_list)
            city = cluster_reports[0][0].city or "Unknown City"
            location_text = _neighborhood_label(clat, clon, city)
            occurred_at = min(r.occurred_at for r, _ in cluster_reports)
            count = len(cluster_reports)

            bulletin_item = BulletinItem(
                title=_make_title(company, incident_type),
                summary=_make_summary(count, company, incident_type),
                av_company=company,
                incident_type=incident_type,
                location_text=location_text,
                tags=[company, incident_type.replace("_", " "), "community"],
                occurred_at=occurred_at,
                source_platform="community",
                signal_count=count,
                user_report_ids=[str(r.id) for r, _ in cluster_reports],
                is_hot=(count >= 5),
                heat_score=0.0,
                status="active",
            )
            db.add(bulletin_item)
            await db.flush()

            for r, _ in cluster_reports:
                r.status = "corroborated"
                r.matched_bulletin_item_id = bulletin_item.id

            created_count += 1
            logger.info(
                f"Pass B: created community bulletin item {bulletin_item.id} "
                f"({count} reports, {company} {incident_type}, {location_text})"
            )

        return created_count

    # ── Clustering helpers ────────────────────────────────────────────────────

    def _build_typed_clusters(
        self,
        reports_with_coords: list[tuple[Incident, tuple[float, float]]],
        min_size: int,
    ) -> dict[tuple, list[tuple[Incident, tuple[float, float]]]]:
        """
        Pass A clustering: groups by company + incident_type first, then clusters
        spatially and temporally within each group.
        Returns only clusters meeting min_size after IP deduplication.
        """
        by_type: dict[tuple, list] = defaultdict(list)
        for r, coords in reports_with_coords:
            key = (r.av_company, r.incident_type)
            by_type[key].append((r, coords))

        valid_clusters: dict[tuple, list] = {}

        for (company, incident_type), group in by_type.items():
            group.sort(key=lambda x: x[0].occurred_at)
            clusters: list[list] = []

            for r, coords in group:
                placed = False
                for cluster in clusters:
                    cluster_times = [c[0].occurred_at for c in cluster]
                    if abs((r.occurred_at - cluster_times[0]).total_seconds()) > TIME_WINDOW_HOURS * 3600:
                        continue
                    clat, clon = _centroid([c[1] for c in cluster])
                    if _haversine_m(coords[0], coords[1], clat, clon) <= LOCATION_RADIUS_METERS:
                        cluster.append((r, coords))
                        placed = True
                        break
                if not placed:
                    clusters.append([(r, coords)])

            for i, cluster in enumerate(clusters):
                seen_ips: set[str] = set()
                deduped: list = []
                for r, coords in cluster:
                    ip = r.reporter_ip_hash or "__no_ip"
                    if ip not in seen_ips:
                        seen_ips.add(ip)
                        deduped.append((r, coords))
                if len(deduped) >= min_size:
                    valid_clusters[(company, incident_type, i)] = deduped

        return valid_clusters

    def _build_spatial_clusters(
        self,
        reports_with_coords: list[tuple[Incident, tuple[float, float]]],
        min_size: int,
    ) -> list[list[tuple[Incident, tuple[float, float]]]]:
        """
        Pass B clustering: groups reports purely by location + time proximity,
        ignoring company and incident_type. Semantic similarity is checked separately.
        Returns only clusters meeting min_size after IP deduplication.
        """
        sorted_reports = sorted(reports_with_coords, key=lambda x: x[0].occurred_at)
        clusters: list[list] = []

        for r, coords in sorted_reports:
            placed = False
            for cluster in clusters:
                cluster_times = [c[0].occurred_at for c in cluster]
                if abs((r.occurred_at - cluster_times[0]).total_seconds()) > TIME_WINDOW_HOURS * 3600:
                    continue
                clat, clon = _centroid([c[1] for c in cluster])
                if _haversine_m(coords[0], coords[1], clat, clon) <= LOCATION_RADIUS_METERS:
                    cluster.append((r, coords))
                    placed = True
                    break
            if not placed:
                clusters.append([(r, coords)])

        valid: list[list] = []
        for cluster in clusters:
            seen_ips: set[str] = set()
            deduped: list = []
            for r, coords in cluster:
                ip = r.reporter_ip_hash or "__no_ip"
                if ip not in seen_ips:
                    seen_ips.add(ip)
                    deduped.append((r, coords))
            if len(deduped) >= min_size:
                valid.append(deduped)

        return valid

    async def _check_semantic_similarity(self, descriptions: list[str]) -> bool:
        """
        Ask Gemini whether a list of descriptions appear to describe the same incident.
        Returns True if they do, or if the check cannot be performed (gives benefit of the doubt).
        """
        if len(descriptions) < 2:
            # 0 or 1 descriptions — can't compare, trust location proximity alone
            return True

        if not settings.GEMINI_API_KEY:
            return True

        desc_lines = "\n".join(f"- {d}" for d in descriptions[:8])
        prompt = (
            "You are an analyst for AVWatch, a platform that tracks autonomous vehicle incidents.\n"
            "The following descriptions were independently submitted by different people "
            "within 500 meters and 2 hours of each other.\n\n"
            f"Descriptions:\n{desc_lines}\n\n"
            "Do these descriptions appear to be referring to the same real-world incident, "
            "even if details like the exact company name or incident type differ slightly?\n"
            'Respond with ONLY valid JSON: {"same_incident": true or false, "reason": "one sentence"}'
        )

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    "https://generativelanguage.googleapis.com/v1beta/models/"
                    "gemini-2.5-flash:generateContent",
                    params={"key": settings.GEMINI_API_KEY},
                    json={
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {"temperature": 0.1, "maxOutputTokens": 256},
                    },
                    headers={"Content-Type": "application/json"},
                )
                resp.raise_for_status()
                data = resp.json()
                raw = (
                    data.get("candidates", [{}])[0]
                    .get("content", {})
                    .get("parts", [{}])[0]
                    .get("text", "")
                ).strip()

                # Strip markdown fences if present
                if raw.startswith("```"):
                    raw = "\n".join(
                        line for line in raw.split("\n") if not line.startswith("```")
                    ).strip()
                brace = raw.find("{")
                if brace > 0:
                    raw = raw[brace:]

                parsed = json.loads(raw)
                result = bool(parsed.get("same_incident", True))
                logger.info(
                    f"Semantic similarity: {result} — {parsed.get('reason', '')}"
                )
                return result

        except Exception as exc:
            logger.warning(f"Semantic similarity check failed: {exc} — defaulting to True")
            return True


# ── Entry point called by scheduler ──────────────────────────────────────────

async def run_user_report_clustering() -> dict:
    """Standalone coroutine wired into APScheduler."""
    async with async_session_maker() as db:
        service = UserReportClusteringService()
        return await service.run(db)
