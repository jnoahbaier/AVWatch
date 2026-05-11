"""
Individual Report Card Generator.

Creates a BulletinItem immediately when a user submits a single report.
Calls Gemini to generate a paraphrased title, short card summary, and longer
modal narrative. Filters profanity and strips PII.

Runs as a FastAPI BackgroundTask — opens its own DB session.
"""

import base64
import json
import logging
from datetime import timedelta
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

_COMPANY_DISPLAY = {
    "waymo": "Waymo",
    "cruise": "Cruise",
    "zoox": "Zoox",
    "tesla": "Tesla",
    "other": "an AV",
    "unknown": "an autonomous vehicle",
}

_TYPE_DISPLAY = {
    "collision": "collision",
    "near_miss": "near-miss",
    "sudden_behavior": "reckless driving",
    "blockage": "blockage",
    "vandalism": "vandalism",
    "accessibility": "accessibility issue",
    "other": "incident",
}


def _fallback_title(company: str, incident_type: str) -> str:
    co = _COMPANY_DISPLAY.get(company, company.title())
    tp = _TYPE_DISPLAY.get(incident_type, incident_type.replace("_", " "))
    return f"{co} {tp} reported by community member"


def _fallback_summary(company: str, incident_type: str, address: Optional[str]) -> str:
    co = _COMPANY_DISPLAY.get(company, company.title())
    tp = _TYPE_DISPLAY.get(incident_type, incident_type.replace("_", " "))
    loc = f" near {address}" if address else ""
    return f"A community member reported a {co} {tp}{loc}."


async def _call_gemini(prompt: str, max_tokens: int = 600) -> Optional[str]:
    if not settings.GEMINI_API_KEY:
        return None
    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            resp = await client.post(
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
                params={"key": settings.GEMINI_API_KEY},
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "temperature": 0.2,
                        "maxOutputTokens": max_tokens,
                    },
                },
                headers={"Content-Type": "application/json"},
            )
            resp.raise_for_status()
            data = resp.json()
            parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
            # gemini-2.5-flash is a thinking model: parts[0] may be the "thought"
            # block and parts[1] the actual response. Skip thought parts.
            for part in parts:
                if not part.get("thought", False):
                    text = part.get("text", "").strip()
                    if text:
                        return text
            return None
    except Exception as exc:
        logger.warning(f"Gemini call failed in individual_report_card: {exc}")
        return None


def _parse_gemini_json(raw: str) -> Optional[dict]:
    """Strip markdown fences and parse JSON from Gemini response."""
    if not raw:
        return None
    if raw.startswith("```"):
        raw = "\n".join(
            line for line in raw.split("\n") if not line.startswith("```")
        ).strip()
    brace = raw.find("{")
    if brace >= 0:
        raw = raw[brace:]
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


async def _check_is_shitpost(incident: Incident) -> tuple[bool, str]:
    """
    Ask Gemini to decide whether a submitted report is a shitpost, spam, or
    obviously fabricated.  Returns (is_shitpost, reason).

    Criteria passed to Gemini:
      - Physically impossible / absurd scenario (e.g. 35 clowns, magic, animals)
      - Clearly a test submission ("test", "asdf", etc.)
      - Excessive profanity or sexually explicit content
      - Obviously satirical / joke
      - Personally targeted harassment
      - Wildly implausible date (e.g. year 0002 or far future)

    If images are attached they are fetched and sent to Gemini's vision model
    so obviously fake/meme images also get caught.

    On any API error we default to False (give benefit of the doubt).
    """
    if not settings.GEMINI_API_KEY:
        return False, "no gemini key — skipping check"

    description = (incident.description or "").strip()
    incident_type = incident.incident_type or "other"
    company = incident.av_company or "unknown"

    text_part = {
        "text": (
            "You are a content moderator for AV Watch, a public-interest platform that tracks "
            "real autonomous vehicle incidents in San Francisco.\n"
            "A user just submitted the following report. Decide if it is a genuine AV incident "
            "report or a shitpost / spam / clearly fabricated submission.\n\n"
            f"Incident type: {incident_type}\n"
            f"AV Company: {company}\n"
            f"Occurred at: {incident.occurred_at}\n"
            f"Description: \"{description or '(none provided)'}\"\n\n"
            "Flag as a shitpost (is_shitpost: true) if the report:\n"
            "  • Describes physically impossible or absurd events "
            "(e.g. clowns emerging from the car, animals driving, supernatural events, "
            "impossible numbers of people)\n"
            "  • Is clearly a test submission (e.g. 'test', 'testing!!!', 'asdf', 'hello')\n"
            "  • Contains excessive profanity, slurs, or sexually explicit content\n"
            "  • Is obviously satirical, a joke, or targeted harassment of a named individual\n"
            "  • Has a wildly implausible date (year before 2020 or more than 1 year in the future)\n"
            "  • Any attached image is a meme, cartoon, unrelated stock photo, or explicit content\n\n"
            "A report CAN be unusual, minor, or poorly written and still be genuine — only flag "
            "clear shitposts. When in doubt, do NOT flag it.\n\n"
            "Respond with ONLY valid JSON, no markdown:\n"
            "{\"is_shitpost\": true/false, \"reason\": \"one short sentence\"}"
        )
    }

    # Build parts list — prepend any images so Gemini sees them before the prompt
    parts: list[dict] = []
    for url in (incident.media_urls or [])[:3]:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                img_resp = await client.get(url)
                img_resp.raise_for_status()
            mime = img_resp.headers.get("content-type", "image/jpeg").split(";")[0]
            encoded = base64.b64encode(img_resp.content).decode()
            parts.append({"inlineData": {"mimeType": mime, "data": encoded}})
        except Exception as exc:
            logger.warning(f"Shitpost check: could not fetch image {url}: {exc}")

    parts.append(text_part)

    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            resp = await client.post(
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
                params={"key": settings.GEMINI_API_KEY},
                json={
                    "contents": [{"parts": parts}],
                    "generationConfig": {"temperature": 0.1, "maxOutputTokens": 150},
                },
                headers={"Content-Type": "application/json"},
            )
            resp.raise_for_status()
            data = resp.json()
            candidates = data.get("candidates", [{}])
            response_parts = candidates[0].get("content", {}).get("parts", [])
            for p in response_parts:
                if not p.get("thought", False):
                    raw = p.get("text", "").strip()
                    if raw:
                        parsed = _parse_gemini_json(raw)
                        if parsed is not None:
                            is_sp = bool(parsed.get("is_shitpost", False))
                            reason = parsed.get("reason", "")
                            return is_sp, reason
            return False, "could not parse gemini response"
    except Exception as exc:
        logger.warning(
            f"Shitpost check API call failed: {exc} — defaulting to not-shitpost"
        )
        return False, f"api error: {exc}"


DEDUP_WINDOW_HOURS = 4  # how far back to look for a matching card


async def _find_matching_card(
    incident: Incident, db: AsyncSession
) -> Optional[BulletinItem]:
    """
    Return an existing community bulletin card that likely describes the same event:
    same AV company, occurred_at within DEDUP_WINDOW_HOURS, and same city.
    Returns the most recent match, or None.
    """
    if not incident.occurred_at or incident.av_company in (None, "unknown"):
        return None

    window = timedelta(hours=DEDUP_WINDOW_HOURS)
    stmt = (
        select(BulletinItem)
        .where(
            and_(
                BulletinItem.source_platform == "community",
                BulletinItem.status == "active",
                BulletinItem.av_company == incident.av_company,
                BulletinItem.occurred_at >= incident.occurred_at - window,
                BulletinItem.occurred_at <= incident.occurred_at + window,
            )
        )
        .order_by(BulletinItem.first_seen_at.desc())
    )
    result = await db.execute(stmt)
    candidates = list(result.scalars().all())

    # Narrow by city if we have one
    city = (incident.city or "").lower().strip()
    if city and candidates:
        candidates = [
            c for c in candidates if c.location_text and city in c.location_text.lower()
        ]

    return candidates[0] if candidates else None


async def _refine_summary(card: BulletinItem, new_description: str) -> Optional[str]:
    """
    Re-run Gemini to produce a refined narrative incorporating the new report.
    Only called when a second (or later) report is merged into an existing card.
    """
    existing = card.summary or ""
    if not new_description.strip() or not settings.GEMINI_API_KEY:
        return None

    prompt = (
        "You are an analyst for AV Watch, a public-interest platform tracking autonomous vehicle incidents.\n"
        "An additional community report has been submitted for an already-documented incident.\n\n"
        f"Existing summary: {existing}\n\n"
        f'New report: "{new_description}"\n\n'
        "Write a refined 3–5 sentence neutral summary incorporating both accounts. "
        "Paraphrase — do NOT quote reporters verbatim. Remove all personal details, "
        "profanity, and slurs. Output ONLY the summary text, no titles or JSON."
    )
    raw = await _call_gemini(prompt, max_tokens=512)
    return raw.strip() if raw else None


async def _merge_into_existing_card(
    card: BulletinItem,
    incident: Incident,
    db: AsyncSession,
) -> None:
    """
    Merge a new report into an existing community card: bump the count,
    add the report ID, and optionally refine the Gemini summary.
    """
    existing_ids = list(card.user_report_ids or [])
    if str(incident.id) in existing_ids:
        return  # already linked, nothing to do

    card.user_report_ids = existing_ids + [str(incident.id)]
    card.signal_count = (card.signal_count or 1) + 1
    if card.signal_count >= 5:
        card.is_hot = True

    # Refine the summary if the new report adds a description
    if incident.description:
        refined = await _refine_summary(card, incident.description)
        if refined:
            card.summary = refined

    incident.matched_bulletin_item_id = card.id
    incident.status = "corroborated"
    await db.flush()
    logger.info(
        f"Merged report {incident.id} into existing card {card.id} "
        f"(now {card.signal_count} reports)"
    )


async def generate_card_for_report(
    incident_id: str, max_tokens: int = 1024, skip_shitpost_check: bool = False
) -> None:
    """
    Background task: create a single BulletinItem for one user-submitted report.
    Calls Gemini to generate a paraphrased, profanity-filtered narrative.
    Opens its own DB session so it runs safely after the request commits.

    Set skip_shitpost_check=True when called for an already admin-validated report
    to bypass the automatic quality gate.
    """
    async with async_session_maker() as db:
        try:
            result = await db.execute(
                select(Incident).where(Incident.id == UUID(incident_id))
            )
            incident = result.scalar_one_or_none()
            if not incident:
                logger.warning(
                    f"generate_card_for_report: incident {incident_id} not found"
                )
                return

            # ── Shitpost / quality gate ──────────────────────────────────────
            if not skip_shitpost_check:
                is_shitpost, sp_reason = await _check_is_shitpost(incident)
                if is_shitpost:
                    incident.status = "rejected"
                    await db.commit()
                    logger.info(
                        f"Report {incident_id} rejected as shitpost: {sp_reason}"
                    )
                    return

            company = incident.av_company or "unknown"
            incident_type = incident.incident_type or "other"
            address = incident.address or ""
            description = (incident.description or "").strip()
            reporter_type = incident.reporter_type or "community member"

            # Use first media upload as the card cover photo
            image_url: Optional[str] = None
            if incident.media_urls and len(incident.media_urls) > 0:
                image_url = incident.media_urls[0]

            # Build Gemini prompt
            desc_section = (
                f'Reporter description: "{description}"'
                if description
                else "(No description provided — use the incident type and company to write a generic summary.)"
            )

            prompt = (
                "You are an analyst for AV Watch, a public-interest platform that tracks real-world autonomous vehicle incidents.\n"
                "A community member just submitted the following AV incident report:\n\n"
                f"  AV Company: {_COMPANY_DISPLAY.get(company, company)}\n"
                f"  Incident type: {_TYPE_DISPLAY.get(incident_type, incident_type)}\n"
                f"  Location: {address or 'not specified'}\n"
                f"  Reporter role: {reporter_type}\n"
                f"  {desc_section}\n\n"
                "Your task — produce three pieces of text:\n"
                "  1. TITLE: A short punchy headline (max 10 words, no quotation marks).\n"
                "     Example: 'Waymo vehicle blocks intersection for several minutes'\n"
                "  2. SHORT_SUMMARY: 1–2 sentences for the card preview. Plain English.\n"
                "  3. NARRATIVE: 3–5 sentences with more detail, suitable for a modal.\n\n"
                "Critical rules:\n"
                "  - Paraphrase — do NOT copy the reporter's words verbatim.\n"
                "  - Remove ALL personal details: names, phone numbers, emails, license plates.\n"
                "  - Replace or omit ANY profanity, slurs, or offensive language with neutral factual language.\n"
                "  - Be neutral and factual. Do not speculate beyond what is reported.\n"
                "  - If no description was given, write a factual generic summary based on type/company.\n"
                "  - Output ONLY valid JSON, exactly:\n"
                '    {"title": "...", "short_summary": "...", "narrative": "..."}'
            )

            # ── Deduplication: merge into an existing card if one matches ──────
            existing_card = await _find_matching_card(incident, db)
            if existing_card:
                await _merge_into_existing_card(existing_card, incident, db)
                await db.commit()
                return

            # ── No existing card — generate a new one via Gemini ─────────────
            raw = await _call_gemini(prompt, max_tokens=1024)
            parsed = _parse_gemini_json(raw) if raw else None

            title = _fallback_title(company, incident_type)
            short_summary = _fallback_summary(company, incident_type, address)
            narrative = short_summary

            if parsed:
                title = parsed.get("title") or title
                short_summary = parsed.get("short_summary") or short_summary
                narrative = parsed.get("narrative") or short_summary
            else:
                logger.warning(
                    f"Gemini returned unparseable response for report {incident_id}, using fallback"
                )

            # summary stores the full narrative (shown in modal).
            # The card visually truncates it to 2 lines.
            bulletin_item = BulletinItem(
                title=title,
                summary=narrative,
                av_company=company,
                incident_type=incident_type,
                location_text=address or None,
                tags=[company, incident_type.replace("_", " "), "community", "avwatch"],
                occurred_at=incident.occurred_at,
                source_platform="community",
                image_url=image_url,
                signal_count=1,
                user_report_ids=[str(incident.id)],
                is_hot=False,
                heat_score=0.0,
                status="active",
            )
            db.add(bulletin_item)
            await db.flush()

            incident.matched_bulletin_item_id = bulletin_item.id
            incident.status = "corroborated"

            await db.commit()
            logger.info(
                f"Created individual bulletin card {bulletin_item.id} for report {incident_id}"
            )

        except Exception as exc:
            logger.error(
                f"generate_card_for_report failed for {incident_id}: {exc}",
                exc_info=True,
            )
            await db.rollback()
