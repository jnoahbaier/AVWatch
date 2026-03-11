"""
Data aggregation and analytics endpoints.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.incident import Incident

router = APIRouter()


async def _build_stats(db: AsyncSession, city: Optional[str] = None,
                       start_date: Optional[datetime] = None,
                       end_date: Optional[datetime] = None) -> dict:
    """Shared aggregation helper used by multiple endpoints."""
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    week_start = now - timedelta(days=now.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)

    base_filters = [Incident.status != "rejected"]
    if city:
        base_filters.append(Incident.city == city)
    if start_date:
        base_filters.append(Incident.occurred_at >= start_date)
    if end_date:
        base_filters.append(Incident.occurred_at <= end_date)

    # Total + verified
    total_result = await db.execute(
        select(
            func.count(Incident.id).label("total"),
            func.count(case((Incident.status == "verified", 1))).label("verified"),
            func.count(case((Incident.occurred_at >= month_start, 1))).label("this_month"),
            func.count(case((Incident.occurred_at >= week_start, 1))).label("this_week"),
        ).where(*base_filters)
    )
    totals = total_result.one()

    # By type
    type_rows = (await db.execute(
        select(Incident.incident_type, func.count(Incident.id).label("cnt"))
        .where(*base_filters)
        .group_by(Incident.incident_type)
    )).all()
    by_type = {r.incident_type: r.cnt for r in type_rows}

    # By company
    company_rows = (await db.execute(
        select(Incident.av_company, func.count(Incident.id).label("cnt"))
        .where(*base_filters)
        .group_by(Incident.av_company)
    )).all()
    by_company = {(r.av_company or "unknown"): r.cnt for r in company_rows}

    # By source
    source_rows = (await db.execute(
        select(Incident.source, func.count(Incident.id).label("cnt"))
        .where(*base_filters)
        .group_by(Incident.source)
    )).all()
    by_source = {r.source: r.cnt for r in source_rows}

    return {
        "total": totals.total,
        "verified": totals.verified,
        "thisMonth": totals.this_month,
        "thisWeek": totals.this_week,
        "byType": by_type,
        "byCompany": by_company,
        "bySource": by_source,
        "trend": 0,
    }


@router.get("/stats")
async def get_stats(
    city: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db),
):
    """Aggregated stats — used by mobile Home screen."""
    return await _build_stats(db, city, start_date, end_date)


@router.get("/trend")
async def get_trend(
    months: int = Query(12, ge=1, le=60),
    db: AsyncSession = Depends(get_db),
):
    """Monthly incident counts for trend chart — used by mobile Home/Analytics."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=31 * months)
    # Use text-based date_trunc to avoid any driver type issues
    month_expr = func.date_trunc("month", Incident.occurred_at)
    rows = (await db.execute(
        select(
            month_expr.label("month"),
            func.count(Incident.id).label("count"),
        )
        .where(
            Incident.status != "rejected",
            Incident.occurred_at >= cutoff,
        )
        .group_by(month_expr)
        .order_by(month_expr)
    )).all()
    result = []
    for row in rows:
        try:
            month_str = row.month.strftime("%b %Y")
        except Exception:
            month_str = str(row.month)[:7]
        result.append({"month": month_str, "count": row.count})
    return result


@router.get("/stats/overview")
async def get_overview_stats(
    city: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db),
):
    """Get overview statistics for the dashboard."""
    data = await _build_stats(db, city, start_date, end_date)
    return {
        "total_incidents": data["total"],
        "by_type": data["byType"],
        "by_company": data["byCompany"],
        "by_source": data["bySource"],
        "period": {"start": start_date, "end": end_date},
    }


@router.get("/stats/timeseries")
async def get_timeseries_stats(
    granularity: str = Query("day", regex="^(day|week|month)$"),
    city: Optional[str] = None,
    av_company: Optional[str] = None,
    incident_type: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db),
):
    """Get time series data for trend charts."""
    trunc_fn = func.date_trunc(granularity, Incident.occurred_at)
    filters = [Incident.status != "rejected"]
    if city:
        filters.append(Incident.city == city)
    if av_company:
        filters.append(Incident.av_company == av_company)
    if incident_type:
        filters.append(Incident.incident_type == incident_type)
    if start_date:
        filters.append(Incident.occurred_at >= start_date)
    if end_date:
        filters.append(Incident.occurred_at <= end_date)

    rows = (await db.execute(
        select(trunc_fn.label("period"), func.count(Incident.id).label("count"))
        .where(*filters)
        .group_by(trunc_fn)
        .order_by(trunc_fn)
    )).all()
    return {
        "granularity": granularity,
        "data": [{"date": row.period.isoformat(), "count": row.count} for row in rows],
    }


@router.get("/stats/heatmap")
async def get_heatmap_data(
    city: Optional[str] = None,
    av_company: Optional[str] = None,
    incident_type: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Get heatmap data for geographic visualization.

    Returns weighted points for heatmap rendering.
    """
    # TODO: Implement heatmap data generation
    return {
        "points": [],  # [{lat, lng, weight}, ...]
    }


@router.get("/stats/companies")
async def get_company_comparison(
    city: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db),
):
    """Get comparative statistics across AV companies."""
    filters = [Incident.status != "rejected"]
    if city:
        filters.append(Incident.city == city)
    if start_date:
        filters.append(Incident.occurred_at >= start_date)
    if end_date:
        filters.append(Incident.occurred_at <= end_date)

    rows = (await db.execute(
        select(
            Incident.av_company,
            func.count(Incident.id).label("total"),
            func.count(case((Incident.incident_type == "collision", 1))).label("collisions"),
            func.count(case((Incident.incident_type == "near_miss", 1))).label("near_misses"),
            func.count(case((Incident.incident_type == "sudden_behavior", 1))).label("sudden_behaviors"),
            func.count(case((Incident.incident_type == "blockage", 1))).label("blockages"),
        )
        .where(*filters)
        .group_by(Incident.av_company)
        .order_by(func.count(Incident.id).desc())
    )).all()
    return {
        "companies": [
            {
                "company": r.av_company or "unknown",
                "total": r.total,
                "collisions": r.collisions,
                "near_misses": r.near_misses,
                "sudden_behaviors": r.sudden_behaviors,
                "blockages": r.blockages,
            }
            for r in rows
        ]
    }


@router.get("/export/csv")
async def export_csv(
    city: Optional[str] = None,
    av_company: Optional[str] = None,
    incident_type: Optional[str] = None,
    source: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db),
):
    """Export filtered incident data as CSV for researchers and policymakers."""
    import csv
    import io
    from fastapi.responses import StreamingResponse
    from geoalchemy2 import functions as geo_func

    filters = [Incident.status != "rejected"]
    if city:
        filters.append(Incident.city == city)
    if av_company:
        filters.append(Incident.av_company == av_company)
    if incident_type:
        filters.append(Incident.incident_type == incident_type)
    if source:
        filters.append(Incident.source == source)
    if start_date:
        filters.append(Incident.occurred_at >= start_date)
    if end_date:
        filters.append(Incident.occurred_at <= end_date)

    from sqlalchemy import func as sqlfunc
    wkt_col = sqlfunc.ST_AsText(Incident.location).label("wkt")
    rows = (await db.execute(
        select(Incident, wkt_col).where(*filters).order_by(Incident.occurred_at.desc()).limit(10000)
    )).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "incident_type", "av_company", "city", "latitude", "longitude",
                     "address", "occurred_at", "reported_at", "reporter_type",
                     "status", "source", "description"])

    import re
    _pt_re = re.compile(r"POINT\(([^\s]+)\s+([^\s]+)\)")
    for inc, wkt in rows:
        m = _pt_re.match(wkt or "")
        lat, lng = (float(m.group(2)), float(m.group(1))) if m else ("", "")
        writer.writerow([
            str(inc.id), inc.incident_type, inc.av_company or "unknown",
            inc.city, lat, lng, inc.address or "",
            inc.occurred_at.isoformat(), inc.reported_at.isoformat(),
            inc.reporter_type or "", inc.status, inc.source,
            (inc.description or "").replace("\n", " "),
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=av_incidents.csv"},
    )


@router.get("/sources")
async def get_data_sources(db: AsyncSession = Depends(get_db)):
    """
    Get information about integrated data sources.
    """
    return {
        "sources": [
            {
                "name": "NHTSA Standing General Order",
                "description": "Federal crash reporting for ADAS/ADS vehicles",
                "url": "https://www.nhtsa.gov/laws-regulations/standing-general-order-crash-reporting",
                "frequency": "Monthly",
                "last_updated": None,
            },
            {
                "name": "California DMV AV Reports",
                "description": "Collision and disengagement reports for CA",
                "url": "https://www.dmv.ca.gov/portal/vehicle-industry-services/autonomous-vehicles/",
                "frequency": "Quarterly",
                "last_updated": None,
            },
            {
                "name": "CPUC Quarterly Reports",
                "description": "Operational data from permitted AV operators",
                "url": "https://www.cpuc.ca.gov/regulatory-services/licensing/transportation-licensing-and-analysis-branch/autonomous-vehicle-programs/quarterly-reporting",
                "frequency": "Quarterly",
                "last_updated": None,
            },
        ]
    }
