"""
Bulletin board API endpoints.

Serves curated AV incidents for the Recent Reports page.
All data here was collected and processed entirely in the background pipeline —
the frontend just reads finished, clean results.
"""

import logging
from typing import Optional
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.bulletin_item import BulletinItem
from app.models.incident import Incident

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Response schemas ──────────────────────────────────────────────────────

class BulletinItemResponse(BaseModel):
    id: str
    title: str
    summary: str
    av_company: Optional[str]
    incident_type: Optional[str]
    location_text: Optional[str]
    tags: list[str]
    occurred_at: Optional[str]
    first_seen_at: str
    last_updated_at: str
    signal_count: int
    source_url: Optional[str]
    source_platform: Optional[str]
    source_subreddit: Optional[str]
    image_url: Optional[str]
    heat_score: float
    is_hot: bool
    total_upvotes: int
    total_comments: int
    user_report_count: int  # number of user-submitted reports backing this item

    model_config = {"from_attributes": True}


class BulletinListResponse(BaseModel):
    items: list[BulletinItemResponse]
    total: int
    has_more: bool


# ── Endpoints ─────────────────────────────────────────────────────────────

@router.get("/", response_model=BulletinListResponse)
async def list_bulletin_items(
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    hot_only: bool = Query(default=False),
    av_company: Optional[str] = Query(default=None),
    incident_type: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """
    Return paginated bulletin board items, newest first.
    Hot items are sorted before regular items within the same page.
    """
    stmt = (
        select(BulletinItem)
        .where(BulletinItem.status == "active")
    )

    if hot_only:
        stmt = stmt.where(BulletinItem.is_hot == True)  # noqa: E712
    if av_company:
        stmt = stmt.where(BulletinItem.av_company == av_company.lower())
    if incident_type:
        stmt = stmt.where(BulletinItem.incident_type == incident_type.lower())

    # Hot items first, then by recency
    stmt = stmt.order_by(
        desc(BulletinItem.is_hot),
        desc(BulletinItem.first_seen_at),
    )

    # Count total (for pagination UI)
    count_stmt = select(BulletinItem.id).where(BulletinItem.status == "active")
    if hot_only:
        count_stmt = count_stmt.where(BulletinItem.is_hot == True)  # noqa: E712
    if av_company:
        count_stmt = count_stmt.where(BulletinItem.av_company == av_company.lower())
    if incident_type:
        count_stmt = count_stmt.where(BulletinItem.incident_type == incident_type.lower())

    total_result = await db.execute(count_stmt)
    total = len(total_result.fetchall())

    # Fetch page
    stmt = stmt.offset(offset).limit(limit)
    result = await db.execute(stmt)
    items = result.scalars().all()

    return BulletinListResponse(
        items=[_serialize(item) for item in items],
        total=total,
        has_more=(offset + limit) < total,
    )


@router.get("/{item_id}", response_model=BulletinItemResponse)
async def get_bulletin_item(
    item_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Return a single bulletin item by ID."""
    result = await db.execute(
        select(BulletinItem).where(BulletinItem.id == item_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Bulletin item not found")
    return _serialize(item)


@router.get("/{item_id}/narrative")
async def get_bulletin_narrative(
    item_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Generate a Gemini AI narrative for a community bulletin item.
    Collects descriptions from the backing user reports and synthesizes them.
    """
    result = await db.execute(select(BulletinItem).where(BulletinItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Bulletin item not found")

    if item.source_platform != "community" or not item.user_report_ids:
        return {"narrative": item.summary}

    # Fetch descriptions from the backing user reports
    incident_ids = [UUID(rid) for rid in item.user_report_ids if rid]
    inc_result = await db.execute(
        select(Incident.description).where(Incident.id.in_(incident_ids))
    )
    descriptions = [row[0] for row in inc_result.fetchall() if row[0]]

    if not descriptions:
        return {"narrative": item.summary}

    narrative = await _gemini_narrative(item, descriptions)
    return {"narrative": narrative}


async def _gemini_narrative(item: BulletinItem, descriptions: list[str]) -> str:
    """Call Gemini to synthesize a narrative from community report descriptions."""
    if not settings.GEMINI_API_KEY:
        return item.summary

    company = item.av_company or "an autonomous vehicle"
    incident_type = (item.incident_type or "incident").replace("_", " ")
    location = item.location_text or "an unknown location"
    count = len(descriptions)
    report_lines = "\n".join(f"- {d}" for d in descriptions[:10])

    prompt = (
        f"You are an analyst for AVWatch, a platform that tracks real-world autonomous vehicle incidents.\n"
        f"{count} community members independently reported a {company} {incident_type} near {location}.\n\n"
        f"Their descriptions:\n{report_lines}\n\n"
        f"Write a neutral, factual 2–3 sentence summary of what likely happened based on these reports. "
        f"Be concise and objective. Do not speculate beyond what is reported. "
        f"IMPORTANT: Remove any personal details (names, contact info, license plates, or identifying information) — "
        f"describe only the vehicle behavior and general circumstances. "
        f"Output only the summary text with no titles or headers."
    )

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
                params={"key": settings.GEMINI_API_KEY},
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"temperature": 0.2, "maxOutputTokens": 512},
                },
                headers={"Content-Type": "application/json"},
            )
            resp.raise_for_status()
            data = resp.json()
            text = (
                data.get("candidates", [{}])[0]
                .get("content", {})
                .get("parts", [{}])[0]
                .get("text", "")
            ).strip()
            return text or item.summary
    except Exception as exc:
        logger.warning(f"Gemini narrative failed for {item.id}: {exc}")
        return item.summary


@router.post("/trigger-scan")
async def trigger_scan():
    """
    Manually trigger one pipeline cycle (for testing/admin use).
    In production this runs automatically every hour via the scheduler.
    """
    from app.services.bulletin.pipeline import BulletinPipeline
    pipeline = BulletinPipeline()
    stats = await pipeline.run()
    return {"status": "ok", "stats": stats}


@router.post("/trigger-user-clustering")
async def trigger_user_clustering():
    """
    Manually trigger the user report clustering pass (for testing/admin use).
    In production this runs automatically every 30 minutes via the scheduler.
    """
    from app.services.bulletin.user_report_clustering import run_user_report_clustering
    stats = await run_user_report_clustering()
    return {"status": "ok", "stats": stats}


# ── Helpers ───────────────────────────────────────────────────────────────

def _serialize(item: BulletinItem) -> BulletinItemResponse:
    return BulletinItemResponse(
        id=str(item.id),
        title=item.title,
        summary=item.summary,
        av_company=item.av_company,
        incident_type=item.incident_type,
        location_text=item.location_text,
        tags=item.tags or [],
        occurred_at=item.occurred_at.isoformat() if item.occurred_at else None,
        first_seen_at=item.first_seen_at.isoformat(),
        last_updated_at=item.last_updated_at.isoformat(),
        signal_count=item.signal_count,
        source_url=item.source_url,
        source_platform=item.source_platform,
        source_subreddit=item.source_subreddit,
        image_url=item.image_url,
        heat_score=item.heat_score,
        is_hot=item.is_hot,
        total_upvotes=item.total_upvotes,
        total_comments=item.total_comments,
        user_report_count=len(item.user_report_ids or []),
    )
