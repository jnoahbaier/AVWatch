"""
Data Sync API endpoints.

Provides endpoints for triggering data synchronization from external sources
and monitoring sync status.
"""

from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from pydantic import BaseModel

from app.services.data_sources import DataSyncService

router = APIRouter(prefix="/data-sync", tags=["data-sync"])


class SyncRequest(BaseModel):
    """Request model for sync operations."""

    sources: Optional[list[str]] = None  # None = all sources
    since_days: Optional[int] = None  # Sync data from last N days


class SyncStatus(BaseModel):
    """Response model for sync status."""

    source_name: str
    status: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    records_processed: int = 0
    records_created: int = 0
    records_updated: int = 0
    records_skipped: int = 0
    error_message: Optional[str] = None


class SourceInfo(BaseModel):
    """Information about a data source."""

    name: str
    type: str
    trust_level: str
    base_url: str
    description: str
    sync_frequency_hours: int


# Store for tracking sync status (in production, use Redis or DB)
_sync_status: dict[str, SyncStatus] = {}


@router.get("/sources", response_model=list[SourceInfo])
async def list_data_sources():
    """
    List all available data sources.

    Returns information about each configured data source including:
    - Name and type
    - Trust level (official, verified, community)
    - Source URL
    - Recommended sync frequency
    """
    service = DataSyncService()
    return [SourceInfo(**info) for info in service.get_source_info()]


@router.post("/sync")
async def trigger_sync(request: SyncRequest, background_tasks: BackgroundTasks):
    """
    Trigger a data sync operation.

    This runs the sync in the background and returns immediately.
    Use the /status endpoint to check progress.

    Args:
        request.sources: List of source names to sync (default: all)
        request.since_days: Only sync data from the last N days
    """
    # Calculate since date
    since = None
    if request.since_days:
        since = datetime.utcnow() - timedelta(days=request.since_days)

    # Run sync in background
    background_tasks.add_task(_run_sync, sources=request.sources, since=since)

    return {
        "message": "Sync started",
        "sources": request.sources or "all",
        "since": since.isoformat() if since else None,
    }


async def _run_sync(sources: Optional[list[str]], since: Optional[datetime]):
    """Background task to run sync."""
    service = DataSyncService()
    results = await service.sync_all(since=since, sources=sources)

    # Store results
    for source_name, result in results.items():
        _sync_status[source_name] = SyncStatus(
            source_name=result.source_name,
            status=result.status,
            started_at=result.started_at,
            completed_at=result.completed_at,
            records_processed=result.records_processed,
            records_created=result.records_created,
            records_updated=result.records_updated,
            records_skipped=result.records_skipped,
            error_message=result.error_message,
        )


@router.get("/status", response_model=dict[str, SyncStatus])
async def get_sync_status():
    """
    Get the status of the most recent sync operations.

    Returns status for each data source including:
    - Current status (completed, failed, in_progress)
    - Records processed/created/updated
    - Any error messages
    """
    return _sync_status


@router.post("/sync/{source_name}")
async def sync_single_source(
    source_name: str,
    background_tasks: BackgroundTasks,
    since_days: Optional[int] = Query(None, description="Sync data from last N days"),
):
    """
    Trigger sync for a single data source.

    Available sources:
    - nhtsa_sgo: NHTSA Standing General Order (ADS/ADAS crashes)
    - nhtsa_complaints: NHTSA consumer complaints
    - nhtsa_recalls: NHTSA vehicle recalls
    - ca_dmv: California DMV collision reports
    - cpuc: California CPUC quarterly reports
    """
    valid_sources = ["nhtsa_sgo", "nhtsa_complaints", "nhtsa_recalls", "ca_dmv", "cpuc"]

    # Map friendly names to full source names
    source_mapping = {
        "nhtsa_sgo": "NHTSA Standing General Order",
        "nhtsa_complaints": "NHTSA Complaints API",
        "nhtsa_recalls": "NHTSA Recalls API",
        "ca_dmv": "California DMV AV Reports",
        "cpuc": "California CPUC Quarterly Reports",
    }

    if source_name not in source_mapping:
        raise HTTPException(
            status_code=400, detail=f"Invalid source. Valid sources: {valid_sources}"
        )

    full_name = source_mapping[source_name]
    since = None
    if since_days:
        since = datetime.utcnow() - timedelta(days=since_days)

    background_tasks.add_task(_run_sync, sources=[full_name], since=since)

    return {
        "message": f"Sync started for {source_name}",
        "source": full_name,
        "since": since.isoformat() if since else None,
    }


@router.get("/preview/{source_name}")
async def preview_source_data(
    source_name: str,
    limit: int = Query(10, le=100, description="Number of records to preview"),
):
    """
    Preview data from a source without storing it.

    Useful for testing and debugging data source configurations.
    """
    service = DataSyncService()

    # Find the source
    source = None
    for s in service.sources:
        if source_name.lower() in s.name.lower():
            source = s
            break

    if not source:
        raise HTTPException(status_code=404, detail="Source not found")

    try:
        # Fetch raw data
        raw_data = await source.fetch_data()

        # Parse into records
        records = source.parse_records(raw_data[:limit])

        return {
            "source": source.name,
            "total_raw_records": len(raw_data),
            "preview_count": len(records),
            "records": [
                {
                    "incident_type": r.incident_type,
                    "occurred_at": r.occurred_at.isoformat() if r.occurred_at else None,
                    "av_company": r.av_company,
                    "city": r.city,
                    "state": r.state,
                    "description": r.description[:200] if r.description else None,
                    "injuries": r.injuries,
                    "fatalities": r.fatalities,
                    "source": r.source,
                    "external_id": r.external_id,
                }
                for r in records
            ],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
