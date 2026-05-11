"""
One-time backfill: generate bulletin cards for all verified (admin-validated)
reports that don't already have a card.

Usage (from the backend/ directory):
    python -m scripts.backfill_verified_cards

Requires the same environment variables as the main app (DATABASE_URL, GEMINI_API_KEY).
"""

import asyncio
import logging
import sys
import os

# Allow running as a module from the backend/ directory
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select, and_

from app.core.database import async_session_maker
from app.models.incident import Incident
from app.services.bulletin.individual_report_card import generate_card_for_report

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)

# Pause between Gemini calls to stay within rate limits
DELAY_BETWEEN_REPORTS = 2.0  # seconds


async def main() -> None:
    logger.info("Fetching verified reports with no bulletin card…")

    async with async_session_maker() as db:
        stmt = select(Incident).where(
            and_(
                Incident.status == "verified",
                Incident.source == "user_report",
                Incident.matched_bulletin_item_id.is_(None),
            )
        ).order_by(Incident.reported_at.asc())

        result = await db.execute(stmt)
        incidents = list(result.scalars().all())

    if not incidents:
        logger.info("No eligible reports found — nothing to do.")
        return

    logger.info(f"Found {len(incidents)} verified report(s) to process.")

    success = 0
    failed = 0

    for i, inc in enumerate(incidents, start=1):
        logger.info(
            f"[{i}/{len(incidents)}] Processing report {inc.id} "
            f"({inc.av_company}, {inc.incident_type}, {inc.address or 'no address'})"
        )
        try:
            await generate_card_for_report(str(inc.id), skip_shitpost_check=True)
            success += 1
            logger.info(f"  ✓ Card created for {inc.id}")
        except Exception as exc:
            failed += 1
            logger.error(f"  ✗ Failed for {inc.id}: {exc}")

        if i < len(incidents):
            await asyncio.sleep(DELAY_BETWEEN_REPORTS)

    logger.info(
        f"\nDone. {success} card(s) created, {failed} failed."
    )


if __name__ == "__main__":
    asyncio.run(main())
