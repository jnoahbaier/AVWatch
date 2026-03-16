"""
User Report Clustering Service.

Runs every 30 minutes. Two passes:
  Pass A — Match clusters of user reports against existing Reddit bulletin items.
  Pass B — Turn large-enough clusters of user reports into brand new bulletin items.

Privacy: exact coordinates are never written to bulletin_items. Only a
neighborhood-level location string is derived and stored.
"""

import logging
import math
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

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

# Incident types too vague to cluster meaningfully
SKIP_TYPES = {"other"}
# Companies too vague to cluster meaningfully
SKIP_COMPANIES = {"unknown", None}


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
        skip_types = list(SKIP_TYPES)
        skip_companies = [c for c in SKIP_COMPANIES if c is not None]
        stmt = select(Incident).where(
            and_(
                Incident.source == "user_report",
                Incident.matched_bulletin_item_id.is_(None),
                Incident.occurred_at >= cutoff,
                Incident.incident_type.not_in(skip_types),
                Incident.av_company.isnot(None),
                Incident.av_company.not_in(skip_companies),
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
        For each cluster of ≥MIN_REPORTS_TO_BOOST distinct-IP reports, look for
        an existing Reddit-sourced bulletin item covering the same event and boost it.
        Returns (number of items boosted, set of incident IDs consumed).
        """
        clusters = self._build_clusters(reports_with_coords, MIN_REPORTS_TO_BOOST)
        boosted_count = 0
        consumed_ids: set[UUID] = set()

        for cluster_key, cluster_reports in clusters.items():
            company, incident_type, _ = cluster_key
            # Find a matching Reddit bulletin item
            bulletin_item = await self._find_reddit_bulletin_item(
                db, company, incident_type, cluster_reports
            )
            if bulletin_item is None:
                continue

            # Append user report IDs that aren't already tracked
            existing = set(bulletin_item.user_report_ids or [])
            new_ids = [str(r.id) for r, _ in cluster_reports if str(r.id) not in existing]
            if not new_ids:
                continue

            bulletin_item.user_report_ids = list(existing) + new_ids
            bulletin_item.signal_count = (bulletin_item.signal_count or 0) + len(new_ids)

            # Mark hot if 5+ distinct user reports now corroborate this item
            if len(bulletin_item.user_report_ids) >= 5:
                bulletin_item.is_hot = True

            # Mark incidents as corroborated
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

    # ── Pass B: create new bulletin items from large clusters ─────────────────

    async def _pass_b(
        self,
        db: AsyncSession,
        reports_with_coords: list[tuple[Incident, tuple[float, float]]],
    ) -> int:
        """
        For each cluster of ≥MIN_CLUSTER_SIZE distinct-IP reports that didn't match
        a Reddit item, create a new community-sourced bulletin item.
        """
        clusters = self._build_clusters(reports_with_coords, MIN_CLUSTER_SIZE)
        created_count = 0

        for cluster_key, cluster_reports in clusters.items():
            company, incident_type, _ = cluster_key
            coords_list = [c for _, c in cluster_reports]
            clat, clon = _centroid(coords_list)

            # Use city from first report as fallback
            city = cluster_reports[0][0].city or "Unknown City"
            location_text = _neighborhood_label(clat, clon, city)

            # Representative time = earliest occurred_at in cluster
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
            await db.flush()  # get the ID

            # Mark incidents as corroborated
            for r, _ in cluster_reports:
                r.status = "corroborated"
                r.matched_bulletin_item_id = bulletin_item.id

            created_count += 1
            logger.info(
                f"Pass B: created community bulletin item {bulletin_item.id} "
                f"({count} reports, {company} {incident_type}, {location_text})"
            )

        return created_count

    # ── Shared clustering helper ──────────────────────────────────────────────

    def _build_clusters(
        self,
        reports_with_coords: list[tuple[Incident, tuple[float, float]]],
        min_size: int,
    ) -> dict[tuple, list[tuple[Incident, tuple[float, float]]]]:
        """
        Group reports into clusters where each cluster shares:
          - same av_company + incident_type
          - occurred_at within TIME_WINDOW_HOURS of each other
          - location within LOCATION_RADIUS_METERS of each other
          - all distinct reporter_ip_hash values (anti-gaming)

        Returns only clusters that meet min_size after IP deduplication.
        """
        # First group by company + type
        by_type: dict[tuple, list] = defaultdict(list)
        for r, coords in reports_with_coords:
            key = (r.av_company, r.incident_type)
            by_type[key].append((r, coords))

        valid_clusters: dict[tuple, list] = {}

        for (company, incident_type), group in by_type.items():
            # Sort by occurred_at for sliding-window clustering
            group.sort(key=lambda x: x[0].occurred_at)

            # Greedy clustering: assign each report to first compatible cluster
            clusters: list[list[tuple[Incident, tuple[float, float]]]] = []

            for r, coords in group:
                placed = False
                for cluster in clusters:
                    # Check time window against cluster centroid time
                    cluster_times = [c[0].occurred_at for c in cluster]
                    if abs((r.occurred_at - cluster_times[0]).total_seconds()) > TIME_WINDOW_HOURS * 3600:
                        continue
                    # Check location against cluster centroid
                    clat, clon = _centroid([c[1] for c in cluster])
                    if _haversine_m(coords[0], coords[1], clat, clon) <= LOCATION_RADIUS_METERS:
                        cluster.append((r, coords))
                        placed = True
                        break
                if not placed:
                    clusters.append([(r, coords)])

            # For each cluster, deduplicate by IP hash, then check min_size
            for i, cluster in enumerate(clusters):
                seen_ips: set[str] = set()
                deduped: list[tuple[Incident, tuple[float, float]]] = []
                for r, coords in cluster:
                    ip = r.reporter_ip_hash or f"__no_ip_{r.id}"
                    if ip not in seen_ips:
                        seen_ips.add(ip)
                        deduped.append((r, coords))

                if len(deduped) >= min_size:
                    cluster_key = (company, incident_type, i)
                    valid_clusters[cluster_key] = deduped

        return valid_clusters


# ── Entry point called by scheduler ──────────────────────────────────────────

async def run_user_report_clustering() -> dict:
    """Standalone coroutine wired into APScheduler."""
    async with async_session_maker() as db:
        service = UserReportClusteringService()
        return await service.run(db)
