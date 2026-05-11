"""
Admin-only endpoints for reviewing and managing incident reports.

All routes require the X-Admin-Key header matching settings.ADMIN_API_KEY.
These endpoints are never exposed to regular users — they are only called
from the Next.js admin panel via server-side API proxy routes.
"""

from datetime import datetime
import re
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Header, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.admin_allowlist import AdminAllowlist
from app.models.blocked_ip import BlockedIP
from app.models.bulletin_item import BulletinItem
from app.models.incident import Incident

router = APIRouter()

_POINT_RE = re.compile(r"POINT\(([^\s]+)\s+([^\s]+)\)")


def _parse_wkt(wkt: str) -> tuple[float, float]:
    m = _POINT_RE.match(wkt or "")
    if not m:
        return 0.0, 0.0
    return float(m.group(2)), float(m.group(1))


# ============================================================================
# Auth dependency
# ============================================================================


async def require_admin(x_admin_key: str = Header(..., alias="X-Admin-Key")):
    """Validates the shared admin API key sent from the Next.js server."""
    if not settings.ADMIN_API_KEY:
        raise HTTPException(status_code=503, detail="Admin API not configured")
    if x_admin_key != settings.ADMIN_API_KEY:
        raise HTTPException(status_code=403, detail="Invalid admin key")


# ============================================================================
# Schemas
# ============================================================================


class StatusUpdate(BaseModel):
    status: str  # "verified", "rejected", "unverified"
    admin_note: Optional[str] = None
    block_ip: bool = False  # if True and status=rejected, also block the reporter IP
    blocked_by: Optional[str] = None  # admin email, required if block_ip=True


class CorroborateRequest(BaseModel):
    target_incident_id: UUID  # The other incident to link to


class BlockIPRequest(BaseModel):
    ip_hash: str
    reason: str
    blocked_by: str  # admin email


class NoteUpdate(BaseModel):
    admin_note: str


class AllowlistAddRequest(BaseModel):
    email: str


# ============================================================================
# Incidents queue
# ============================================================================


@router.get("/incidents", dependencies=[Depends(require_admin)])
async def admin_list_incidents(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    status: Optional[str] = None,
    incident_type: Optional[str] = None,
    av_company: Optional[str] = None,
    sort_by: str = Query(
        "reported_at", regex="^(reported_at|occurred_at|incident_type|status)$"
    ),
    sort_dir: str = Query("desc", regex="^(asc|desc)$"),
    db: AsyncSession = Depends(get_db),
):
    """Return all incidents for the admin review queue."""
    wkt_col = func.ST_AsText(Incident.location).label("wkt")

    filters = []
    if status:
        filters.append(Incident.status == status)
    if incident_type:
        filters.append(Incident.incident_type == incident_type)
    if av_company:
        filters.append(Incident.av_company == av_company)

    # Count
    count_stmt = select(func.count(Incident.id))
    for f in filters:
        count_stmt = count_stmt.where(f)
    total = (await db.execute(count_stmt)).scalar_one()

    # Fetch
    sort_col = getattr(Incident, sort_by, Incident.reported_at)
    stmt = select(Incident, wkt_col)
    for f in filters:
        stmt = stmt.where(f)
    if sort_dir == "desc":
        stmt = stmt.order_by(sort_col.desc())
    else:
        stmt = stmt.order_by(sort_col.asc())
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)

    rows = (await db.execute(stmt)).all()

    items = [
        {
            "id": str(inc.id),
            "incident_type": inc.incident_type,
            "av_company": inc.av_company or "unknown",
            "description": inc.description,
            "latitude": _parse_wkt(wkt)[0],
            "longitude": _parse_wkt(wkt)[1],
            "address": inc.address,
            "city": inc.city,
            "occurred_at": inc.occurred_at.isoformat(),
            "reported_at": inc.reported_at.isoformat(),
            "reporter_type": inc.reporter_type,
            "status": inc.status,
            "source": inc.source,
            "media_urls": inc.media_urls or [],
            "reporter_ip_hash": inc.reporter_ip_hash,
            "contact_name": inc.contact_name,
            "contact_email": inc.contact_email,
            "admin_note": inc.admin_note,
            "corroborated_with_id": str(inc.corroborated_with_id)
            if inc.corroborated_with_id
            else None,
        }
        for inc, wkt in rows
    ]

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if total > 0 else 0,
    }


@router.patch("/incidents/{incident_id}/status", dependencies=[Depends(require_admin)])
async def admin_update_status(
    incident_id: UUID,
    body: StatusUpdate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Validate, discard, or reset an incident report.

    status values:
      - "verified"   → validates the report; creates a bulletin card if one doesn't exist,
                       or restores a previously archived card
      - "rejected"   → discards the report; archives its linked bulletin card
      - "unverified" → resets to default pending state (card untouched)
    """
    allowed = {"verified", "rejected", "unverified", "corroborated"}
    if body.status not in allowed:
        raise HTTPException(status_code=400, detail=f"status must be one of {allowed}")

    result = await db.execute(select(Incident).where(Incident.id == incident_id))
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    incident.status = body.status
    if body.admin_note is not None:
        incident.admin_note = body.admin_note

    # ── Couple bulletin card to incident status ────────────────────────────
    if body.status == "rejected":
        # Archive the linked bulletin card so it disappears from the public site
        if incident.matched_bulletin_item_id:
            card_result = await db.execute(
                select(BulletinItem).where(
                    BulletinItem.id == incident.matched_bulletin_item_id
                )
            )
            card = card_result.scalar_one_or_none()
            if card:
                card.status = "archived"

    elif body.status == "verified":
        if incident.matched_bulletin_item_id is None:
            # No card yet (e.g. shitpost check rejected it) — generate one now,
            # bypassing the quality gate since an admin explicitly validated this report
            from app.services.bulletin.individual_report_card import (
                generate_card_for_report,
            )

            background_tasks.add_task(
                generate_card_for_report, str(incident.id), skip_shitpost_check=True
            )
        else:
            # Card exists but may have been archived — restore it
            card_result = await db.execute(
                select(BulletinItem).where(
                    BulletinItem.id == incident.matched_bulletin_item_id
                )
            )
            card = card_result.scalar_one_or_none()
            if card and card.status == "archived":
                card.status = "active"

    # Optionally block the reporter's IP when discarding
    if body.block_ip and body.status == "rejected" and incident.reporter_ip_hash:
        if not body.blocked_by:
            raise HTTPException(
                status_code=400, detail="blocked_by is required when block_ip=True"
            )
        existing = await db.execute(
            select(BlockedIP).where(BlockedIP.ip_hash == incident.reporter_ip_hash)
        )
        if not existing.scalar_one_or_none():
            db.add(
                BlockedIP(
                    ip_hash=incident.reporter_ip_hash,
                    reason=body.admin_note or "Blocked via report discard",
                    blocked_by=body.blocked_by,
                )
            )

    await db.flush()
    return {
        "id": str(incident.id),
        "status": incident.status,
        "admin_note": incident.admin_note,
    }


@router.post(
    "/incidents/{incident_id}/corroborate", dependencies=[Depends(require_admin)]
)
async def admin_corroborate(
    incident_id: UUID,
    body: CorroborateRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Link two reports together as corroborating the same incident.
    Sets corroborated_with_id on both reports and updates status to 'corroborated'.
    """
    if incident_id == body.target_incident_id:
        raise HTTPException(
            status_code=400, detail="Cannot corroborate an incident with itself"
        )

    res_a = await db.execute(select(Incident).where(Incident.id == incident_id))
    res_b = await db.execute(
        select(Incident).where(Incident.id == body.target_incident_id)
    )
    inc_a = res_a.scalar_one_or_none()
    inc_b = res_b.scalar_one_or_none()

    if not inc_a:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")
    if not inc_b:
        raise HTTPException(
            status_code=404, detail=f"Incident {body.target_incident_id} not found"
        )

    inc_a.corroborated_with_id = body.target_incident_id  # type: ignore[assignment]
    inc_a.status = "corroborated"
    inc_b.corroborated_with_id = incident_id  # type: ignore[assignment]
    inc_b.status = "corroborated"

    await db.flush()
    return {
        "incident_a": str(incident_id),
        "incident_b": str(body.target_incident_id),
        "status": "corroborated",
    }


@router.patch("/incidents/{incident_id}/note", dependencies=[Depends(require_admin)])
async def admin_update_note(
    incident_id: UUID,
    body: NoteUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update only the admin note on an incident without changing its status."""
    result = await db.execute(select(Incident).where(Incident.id == incident_id))
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    incident.admin_note = body.admin_note
    await db.flush()
    return {"id": str(incident.id), "admin_note": incident.admin_note}


# ============================================================================
# Blocked IPs
# ============================================================================


@router.get("/blocked-ips", dependencies=[Depends(require_admin)])
async def admin_list_blocked_ips(db: AsyncSession = Depends(get_db)):
    """List all blocked IP hashes."""
    result = await db.execute(select(BlockedIP).order_by(BlockedIP.blocked_at.desc()))
    ips = result.scalars().all()
    return [
        {
            "id": str(ip.id),
            "ip_hash": ip.ip_hash,
            "reason": ip.reason,
            "blocked_by": ip.blocked_by,
            "blocked_at": ip.blocked_at.isoformat(),
        }
        for ip in ips
    ]


@router.post("/blocked-ips", dependencies=[Depends(require_admin)])
async def admin_block_ip(body: BlockIPRequest, db: AsyncSession = Depends(get_db)):
    """Block an IP hash directly."""
    existing = await db.execute(
        select(BlockedIP).where(BlockedIP.ip_hash == body.ip_hash)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="IP hash already blocked")
    db.add(
        BlockedIP(ip_hash=body.ip_hash, reason=body.reason, blocked_by=body.blocked_by)
    )
    await db.flush()
    return {"message": "IP blocked", "ip_hash": body.ip_hash}


@router.delete("/blocked-ips/{blocked_ip_id}", dependencies=[Depends(require_admin)])
async def admin_unblock_ip(blocked_ip_id: UUID, db: AsyncSession = Depends(get_db)):
    """Remove an IP block."""
    result = await db.execute(select(BlockedIP).where(BlockedIP.id == blocked_ip_id))
    ip = result.scalar_one_or_none()
    if not ip:
        raise HTTPException(status_code=404, detail="Blocked IP record not found")
    await db.delete(ip)
    await db.flush()
    return {"message": "IP unblocked"}


# ============================================================================
# Admin allowlist
# ============================================================================


@router.get("/allowlist/check")
async def admin_allowlist_check(email: str, db: AsyncSession = Depends(get_db)):
    """
    Public endpoint — checks if an email is on the admin allowlist.
    Used by NextAuth during the signIn callback.
    """
    result = await db.execute(
        select(AdminAllowlist).where(AdminAllowlist.email == email)
    )
    allowed = result.scalar_one_or_none() is not None
    return {"email": email, "allowed": allowed}


@router.get("/allowlist", dependencies=[Depends(require_admin)])
async def admin_list_allowlist(db: AsyncSession = Depends(get_db)):
    """List all emails on the admin allowlist."""
    result = await db.execute(
        select(AdminAllowlist).order_by(AdminAllowlist.added_at.asc())
    )
    entries = result.scalars().all()
    return [{"email": e.email, "added_at": e.added_at.isoformat()} for e in entries]


@router.post("/allowlist", dependencies=[Depends(require_admin)])
async def admin_add_allowlist(
    body: AllowlistAddRequest, db: AsyncSession = Depends(get_db)
):
    """Add an email to the admin allowlist."""
    existing = await db.execute(
        select(AdminAllowlist).where(AdminAllowlist.email == body.email)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already on allowlist")
    db.add(AdminAllowlist(email=body.email))
    await db.flush()
    return {"message": "Email added", "email": body.email}


@router.delete("/allowlist/{email:path}", dependencies=[Depends(require_admin)])
async def admin_remove_allowlist(email: str, db: AsyncSession = Depends(get_db)):
    """Remove an email from the admin allowlist."""
    result = await db.execute(
        select(AdminAllowlist).where(AdminAllowlist.email == email)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Email not found on allowlist")
    await db.delete(entry)
    await db.flush()
    return {"message": "Email removed", "email": email}


# ============================================================================
# Bulletin cards
# ============================================================================


@router.get("/bulletin", dependencies=[Depends(require_admin)])
async def admin_list_bulletin(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    source_platform: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """List all bulletin cards for admin review."""
    filters = []
    if source_platform:
        filters.append(BulletinItem.source_platform == source_platform.lower())

    count_stmt = select(func.count(BulletinItem.id))
    for f in filters:
        count_stmt = count_stmt.where(f)
    total = (await db.execute(count_stmt)).scalar_one()

    stmt = select(BulletinItem)
    for f in filters:
        stmt = stmt.where(f)
    stmt = (
        stmt.order_by(BulletinItem.first_seen_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = (await db.execute(stmt)).scalars().all()

    items = [
        {
            "id": str(item.id),
            "title": item.title,
            "summary": item.summary,
            "av_company": item.av_company,
            "incident_type": item.incident_type,
            "location_text": item.location_text,
            "source_platform": item.source_platform,
            "status": item.status,
            "signal_count": item.signal_count,
            "user_report_ids": item.user_report_ids or [],
            "occurred_at": item.occurred_at.isoformat() if item.occurred_at else None,
            "first_seen_at": item.first_seen_at.isoformat(),
            "image_url": item.image_url,
        }
        for item in rows
    ]

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if total > 0 else 0,
    }


@router.delete("/bulletin/{card_id}", dependencies=[Depends(require_admin)])
async def admin_delete_bulletin(card_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    Delete a bulletin card and reset any linked incidents so they can
    generate a fresh card if needed.
    """
    result = await db.execute(select(BulletinItem).where(BulletinItem.id == card_id))
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=404, detail="Bulletin card not found")

    # Reset all incidents that were linked to this card
    report_ids = card.user_report_ids or []
    for rid in report_ids:
        try:
            inc_result = await db.execute(
                select(Incident).where(Incident.id == UUID(rid))
            )
            inc = inc_result.scalar_one_or_none()
            if inc:
                inc.matched_bulletin_item_id = None
                inc.status = "verified"  # back to verified so backfill can re-process
        except Exception:
            pass  # malformed UUID — skip

    await db.delete(card)
    await db.flush()
    return {"message": "Bulletin card deleted", "id": str(card_id)}


# ============================================================================
# Stats
# ============================================================================


@router.get("/stats", dependencies=[Depends(require_admin)])
async def admin_stats(db: AsyncSession = Depends(get_db)):
    """Summary statistics for the admin dashboard."""
    total = (await db.execute(select(func.count(Incident.id)))).scalar_one()
    pending = (
        await db.execute(
            select(func.count(Incident.id)).where(Incident.status == "unverified")
        )
    ).scalar_one()
    verified = (
        await db.execute(
            select(func.count(Incident.id)).where(Incident.status == "verified")
        )
    ).scalar_one()
    rejected = (
        await db.execute(
            select(func.count(Incident.id)).where(Incident.status == "rejected")
        )
    ).scalar_one()
    corroborated = (
        await db.execute(
            select(func.count(Incident.id)).where(Incident.status == "corroborated")
        )
    ).scalar_one()
    blocked_ips = (await db.execute(select(func.count(BlockedIP.id)))).scalar_one()

    # Reports this week
    from datetime import timedelta

    week_ago = datetime.utcnow() - timedelta(days=7)
    this_week = (
        await db.execute(
            select(func.count(Incident.id)).where(Incident.reported_at >= week_ago)
        )
    ).scalar_one()

    return {
        "total": total,
        "pending": pending,
        "verified": verified,
        "rejected": rejected,
        "corroborated": corroborated,
        "this_week": this_week,
        "blocked_ips": blocked_ips,
    }
