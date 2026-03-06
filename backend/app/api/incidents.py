"""
Incident reporting and querying endpoints.
"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.incident import Incident

router = APIRouter()


# ============================================================================
# Schemas
# ============================================================================


class LocationInput(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    address: Optional[str] = None


class IncidentCreate(BaseModel):
    incident_type: str = Field(..., description="Type of incident")
    av_company: str = Field(default="unknown", description="AV company involved")
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
    db: AsyncSession = Depends(get_db),
):
    """
    Submit a new incident report.

    - **incident_type**: collision, near_miss, sudden_behavior, blockage, other
    - **av_company**: waymo, cruise, zoox, tesla, other, unknown
    - **location**: GPS coordinates and optional address
    - **occurred_at**: When the incident happened
    """
    incident_obj = Incident(
        incident_type=incident.incident_type,
        av_company=incident.av_company,
        description=incident.description,
        latitude=incident.location.latitude,
        longitude=incident.location.longitude,
        address=incident.location.address,
        occurred_at=incident.occurred_at,
        reporter_type=incident.reporter_type,
        source="user_report",
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
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    min_lat: Optional[float] = Query(None, ge=-90, le=90),
    max_lat: Optional[float] = Query(None, ge=-90, le=90),
    min_lng: Optional[float] = Query(None, ge=-180, le=180),
    max_lng: Optional[float] = Query(None, ge=-180, le=180),
    db: AsyncSession = Depends(get_db),
):
    """List incidents with filtering and pagination."""
    stmt = select(Incident)
    if incident_type:
        stmt = stmt.where(Incident.incident_type == incident_type)
    if av_company:
        stmt = stmt.where(Incident.av_company == av_company)
    if city:
        stmt = stmt.where(Incident.city == city)
    if start_date:
        stmt = stmt.where(Incident.occurred_at >= start_date)
    if end_date:
        stmt = stmt.where(Incident.occurred_at <= end_date)
    if min_lat is not None:
        stmt = stmt.where(Incident.latitude >= min_lat)
    if max_lat is not None:
        stmt = stmt.where(Incident.latitude <= max_lat)
    if min_lng is not None:
        stmt = stmt.where(Incident.longitude >= min_lng)
    if max_lng is not None:
        stmt = stmt.where(Incident.longitude <= max_lng)

    total = (
        await db.execute(select(func.count()).select_from(stmt.subquery()))
    ).scalar_one()

    stmt = (
        stmt.order_by(Incident.occurred_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = (await db.execute(stmt)).scalars().all()

    items = [
        {
            "id": str(inc.id),
            "incident_type": inc.incident_type,
            "av_company": inc.av_company or "unknown",
            "description": inc.description,
            "latitude": inc.latitude,
            "longitude": inc.longitude,
            "address": inc.address,
            "city": inc.city,
            "occurred_at": inc.occurred_at.isoformat(),
            "reported_at": inc.reported_at.isoformat(),
            "reporter_type": inc.reporter_type,
            "status": inc.status,
            "source": inc.source,
            "media_urls": inc.media_urls or [],
        }
        for inc in rows
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

    rows = (await db.execute(stmt)).scalars().all()

    features = [
        {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [inc.longitude, inc.latitude],
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
        for inc in rows
    ]

    return {"type": "FeatureCollection", "features": features}


@router.get("/{incident_id}", response_model=dict)
async def get_incident(
    incident_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get a single incident by ID."""
    row = (
        await db.execute(select(Incident).where(Incident.id == incident_id))
    ).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Incident not found")
    return {
        "id": str(row.id),
        "incident_type": row.incident_type,
        "av_company": row.av_company or "unknown",
        "description": row.description,
        "latitude": row.latitude,
        "longitude": row.longitude,
        "address": row.address,
        "city": row.city,
        "occurred_at": row.occurred_at.isoformat(),
        "reported_at": row.reported_at.isoformat(),
        "reporter_type": row.reporter_type,
        "status": row.status,
        "source": row.source,
        "media_urls": row.media_urls or [],
    }
