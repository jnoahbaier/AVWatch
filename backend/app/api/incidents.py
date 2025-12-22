"""
Incident reporting and querying endpoints.
"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db

router = APIRouter()


# ============================================================================
# Schemas
# ============================================================================


class IncidentType:
    """Incident type constants."""

    COLLISION = "collision"
    NEAR_MISS = "near_miss"
    SUDDEN_BEHAVIOR = "sudden_behavior"
    BLOCKAGE = "blockage"
    OTHER = "other"


class AVCompany:
    """AV company constants."""

    WAYMO = "waymo"
    CRUISE = "cruise"
    ZOOX = "zoox"
    TESLA = "tesla"
    OTHER = "other"
    UNKNOWN = "unknown"


class ReporterType:
    """Reporter type constants."""

    PEDESTRIAN = "pedestrian"
    CYCLIST = "cyclist"
    DRIVER = "driver"
    RIDER = "rider"
    OTHER = "other"


class LocationInput(BaseModel):
    """Location input for incident reports."""

    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    address: Optional[str] = None


class IncidentCreate(BaseModel):
    """Schema for creating a new incident report."""

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
                "description": "Waymo vehicle stopped abruptly in crosswalk while I was crossing",
                "location": {
                    "latitude": 37.7749,
                    "longitude": -122.4194,
                    "address": "Market St & 5th St, San Francisco, CA",
                },
                "occurred_at": "2024-12-20T14:30:00Z",
                "reporter_type": "pedestrian",
            }
        }


class IncidentResponse(BaseModel):
    """Schema for incident response."""

    id: UUID
    incident_type: str
    av_company: str
    description: Optional[str]
    latitude: float
    longitude: float
    address: Optional[str]
    city: str
    occurred_at: datetime
    reported_at: datetime
    reporter_type: Optional[str]
    status: str
    source: str
    media_urls: List[str]


class IncidentListResponse(BaseModel):
    """Schema for paginated incident list."""

    items: List[IncidentResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


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
    # TODO: Implement database insertion
    return {
        "message": "Incident reported successfully",
        "id": "placeholder-uuid",
        "status": "unverified",
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
    # Bounding box for map queries
    min_lat: Optional[float] = Query(None, ge=-90, le=90),
    max_lat: Optional[float] = Query(None, ge=-90, le=90),
    min_lng: Optional[float] = Query(None, ge=-180, le=180),
    max_lng: Optional[float] = Query(None, ge=-180, le=180),
    db: AsyncSession = Depends(get_db),
):
    """
    List incidents with filtering and pagination.

    Supports filtering by:
    - incident_type
    - av_company
    - city
    - date range (start_date, end_date)
    - geographic bounding box (min_lat, max_lat, min_lng, max_lng)
    """
    # TODO: Implement database query with PostGIS
    return {
        "items": [],
        "total": 0,
        "page": page,
        "page_size": page_size,
        "total_pages": 0,
    }


@router.get("/geojson")
async def get_incidents_geojson(
    incident_type: Optional[str] = None,
    av_company: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Get incidents as GeoJSON FeatureCollection for map display.
    """
    # TODO: Implement GeoJSON generation
    return {
        "type": "FeatureCollection",
        "features": [],
    }


@router.get("/{incident_id}", response_model=dict)
async def get_incident(
    incident_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get a single incident by ID."""
    # TODO: Implement database lookup
    raise HTTPException(status_code=404, detail="Incident not found")

