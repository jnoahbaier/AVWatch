"""
Bulletin board API endpoints.

Serves curated AV incidents for the Recent Reports page.
All data here was collected and processed entirely in the background pipeline —
the frontend just reads finished, clean results.
"""

import logging
from datetime import date, datetime, time as dtime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.bulletin_item import BulletinItem

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
    location: Optional[str] = Query(default=None),
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
    source_platform: Optional[str] = Query(default=None),
    community_backed: bool = Query(default=False),
    sort_by: Optional[str] = Query(default=None),
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
    if location:
        stmt = stmt.where(BulletinItem.location_text.ilike(f"%{location}%"))
    if date_from:
        try:
            stmt = stmt.where(BulletinItem.first_seen_at >= datetime.combine(date.fromisoformat(date_from), dtime.min))
        except ValueError:
            pass
    if date_to:
        try:
            stmt = stmt.where(BulletinItem.first_seen_at <= datetime.combine(date.fromisoformat(date_to), dtime.max))
        except ValueError:
            pass
    if source_platform:
        stmt = stmt.where(BulletinItem.source_platform == source_platform.lower())
    if community_backed:
        stmt = stmt.where(func.jsonb_array_length(BulletinItem.user_report_ids) > 0)

    # Sort by incident date descending (nulls fall back to first_seen_at), unless hot_only override
    stmt = stmt.order_by(
        desc(BulletinItem.occurred_at).nullslast(),
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
    if location:
        count_stmt = count_stmt.where(BulletinItem.location_text.ilike(f"%{location}%"))
    if date_from:
        try:
            count_stmt = count_stmt.where(BulletinItem.first_seen_at >= datetime.combine(date.fromisoformat(date_from), dtime.min))
        except ValueError:
            pass
    if date_to:
        try:
            count_stmt = count_stmt.where(BulletinItem.first_seen_at <= datetime.combine(date.fromisoformat(date_to), dtime.max))
        except ValueError:
            pass
    if source_platform:
        count_stmt = count_stmt.where(BulletinItem.source_platform == source_platform.lower())
    if community_backed:
        count_stmt = count_stmt.where(func.jsonb_array_length(BulletinItem.user_report_ids) > 0)

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
    Return the pre-generated AI narrative for a community bulletin item.
    Narratives are now generated at clustering time and stored in the DB,
    so this endpoint is a simple lookup with no AI latency.
    """
    result = await db.execute(select(BulletinItem).where(BulletinItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Bulletin item not found")
    return {"narrative": item.summary}


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
