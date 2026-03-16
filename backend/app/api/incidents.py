"""
Incident reporting and querying endpoints.
"""

import hashlib
from datetime import datetime
from typing import List, Optional, Literal
from uuid import UUID

import re

from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, File
from geoalchemy2 import WKTElement
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.incident import Incident

router = APIRouter()

_POINT_RE = re.compile(r"POINT\(([^\s]+)\s+([^\s]+)\)")


def _parse_wkt(wkt: str) -> tuple[float, float]:
    """Parse 'POINT(lng lat)' → (lat, lng)."""
    m = _POINT_RE.match(wkt or "")
    if not m:
        return 0.0, 0.0
    return float(m.group(2)), float(m.group(1))


# ============================================================================
# Schemas
# ============================================================================


class LocationInput(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    address: Optional[str] = None


class IncidentCreate(BaseModel):
    incident_type: Literal[
        "collision", "near_miss", "sudden_behavior", "blockage", "other"
    ] = Field(..., description="Type of incident")
    av_company: Literal["waymo", "cruise", "zoox", "tesla", "other", "unknown"] = Field(
        default="unknown", description="AV company involved"
    )
    description: Optional[str] = Field(None, max_length=2000)
    location: LocationInput
    occurred_at: datetime
    reporter_type: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "incident_type": "near_miss",
                "av_company": "waymo",
                "description": "Waymo vehicle stopped abruptly in crosswalk",
                "location": {
                    "latitude": 37.7749,
                    "longitude": -122.4194,
                    "address": "Market St & 5th St, San Francisco, CA",
                },
                "occurred_at": "2024-12-20T14:30:00Z",
                "reporter_type": "pedestrian",
            }
        }


# ============================================================================
# Endpoints
# ============================================================================


@router.post("/", response_model=dict, status_code=201)
async def create_incident(
    incident: IncidentCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    # Submit a new incident report.
    # TODO: Implement rate limiting to prevent abuse and fraudulent reports.
    #   Consider using FastAPI-Limiter or a reverse proxy like Nginx for this.
    #
    # - **incident_type**: collision, near_miss, sudden_behavior, blockage, other
    # - **av_company**: waymo, cruise, zoox, tesla, other, unknown
    # - **location**: GPS coordinates and optional address
    # - **occurred_at**: When the incident happened
    """
    # Hash the client IP — never store raw IP
    client_ip = request.client.host if request.client else "unknown"
    ip_hash = hashlib.sha256(client_ip.encode()).hexdigest()

    point = WKTElement(
        f"POINT({incident.location.longitude} {incident.location.latitude})",
        srid=4326,
    )
    incident_obj = Incident(
        incident_type=incident.incident_type,
        av_company=incident.av_company,
        description=incident.description,
        location=point,
        address=incident.location.address,
        occurred_at=incident.occurred_at,
        reporter_type=incident.reporter_type,
        source="user_report",
        reporter_ip_hash=ip_hash,
    )
    db.add(incident_obj)
    await db.flush()
    return {
        "message": "Incident reported successfully",
        "id": str(incident_obj.id),
        "status": incident_obj.status,
    }


@router.post("/{incident_id}/media", status_code=201)
async def upload_media(
    incident_id: UUID,
    files: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Upload photos or videos for an incident report."""
    # TODO: Implement S3 upload
    return {
        "message": f"Uploaded {len(files)} file(s)",
        "incident_id": str(incident_id),
    }


@router.get("/", response_model=dict)
async def list_incidents(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    incident_type: Optional[str] = None,
    av_company: Optional[str] = None,
    city: Optional[str] = None,
    source: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    min_lat: Optional[float] = Query(None, ge=-90, le=90),
    max_lat: Optional[float] = Query(None, ge=-90, le=90),
    min_lng: Optional[float] = Query(None, ge=-180, le=180),
    max_lng: Optional[float] = Query(None, ge=-180, le=180),
    db: AsyncSession = Depends(get_db),
):
    """List incidents with filtering and pagination."""
    wkt_col = func.ST_AsText(Incident.location).label("wkt")

    filters = []
    if incident_type:
        filters.append(Incident.incident_type == incident_type)
    if av_company:
        filters.append(Incident.av_company == av_company)
    if city:
        filters.append(Incident.city == city)
    if source:
        filters.append(Incident.source == source)
    if start_date:
        filters.append(Incident.occurred_at >= start_date)
    if end_date:
        filters.append(Incident.occurred_at <= end_date)

    count_stmt = select(func.count(Incident.id))
    for f in filters:
        count_stmt = count_stmt.where(f)
    total = (await db.execute(count_stmt)).scalar_one()

    stmt = select(Incident, wkt_col)
    for f in filters:
        stmt = stmt.where(f)
    stmt = (
        stmt.order_by(Incident.occurred_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
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


@router.get("/geojson")
async def get_incidents_geojson(
    incident_type: Optional[str] = None,
    av_company: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db),
):
    """Get incidents as GeoJSON FeatureCollection for map display."""
    stmt = select(Incident)
    if incident_type:
        stmt = stmt.where(Incident.incident_type == incident_type)
    if av_company:
        stmt = stmt.where(Incident.av_company == av_company)
    if start_date:
        stmt = stmt.where(Incident.occurred_at >= start_date)
    if end_date:
        stmt = stmt.where(Incident.occurred_at <= end_date)

    wkt_col = func.ST_AsText(Incident.location).label("wkt")
    stmt = select(Incident, wkt_col)
    if incident_type:
        stmt = stmt.where(Incident.incident_type == incident_type)
    if av_company:
        stmt = stmt.where(Incident.av_company == av_company)
    if start_date:
        stmt = stmt.where(Incident.occurred_at >= start_date)
    if end_date:
        stmt = stmt.where(Incident.occurred_at <= end_date)

    rows = (await db.execute(stmt)).all()

    features = [
        {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [_parse_wkt(wkt)[1], _parse_wkt(wkt)[0]],
            },
            "properties": {
                "id": str(inc.id),
                "incident_type": inc.incident_type,
                "av_company": inc.av_company or "unknown",
                "address": inc.address,
                "occurred_at": inc.occurred_at.isoformat(),
                "status": inc.status,
            },
        }
        for inc, wkt in rows
    ]

    return {"type": "FeatureCollection", "features": features}


@router.get("/{incident_id}", response_model=dict)
async def get_incident(
    incident_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get a single incident by ID."""
    wkt_col = func.ST_AsText(Incident.location).label("wkt")
    result = (
        await db.execute(select(Incident, wkt_col).where(Incident.id == incident_id))
    ).first()
    if not result:
        raise HTTPException(status_code=404, detail="Incident not found")
    row, wkt = result
    lat, lng = _parse_wkt(wkt)
    return {
        "id": str(row.id),
        "incident_type": row.incident_type,
        "av_company": row.av_company or "unknown",
        "description": row.description,
        "latitude": lat,
        "longitude": lng,
        "address": row.address,
        "city": row.city,
        "occurred_at": row.occurred_at.isoformat(),
        "reported_at": row.reported_at.isoformat(),
        "reporter_type": row.reporter_type,
        "status": row.status,
        "source": row.source,
        "media_urls": row.media_urls or [],
    }
