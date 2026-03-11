"""
Data Synchronization Service.

Orchestrates data fetching from all sources and stores incidents in the database.
"""

import asyncio
from datetime import datetime
from typing import Any, Optional
import logging

from geoalchemy2 import WKTElement
from sqlalchemy import select

from .base import DataSourceBase, IncidentRecord, SyncResult
from .nhtsa_sgo import NHTSASGODataSource
from .nhtsa_api import NHTSAComplaintsAPI, NHTSARecallsAPI
from .california_dmv import CaliforniaDMVDataSource
from .cpuc import CPUCDataSource
from app.models.incident import Incident

# Fallback coordinates for known cities and states when lat/lng are absent
_CITY_COORDS: dict[str, tuple[float, float]] = {
    "san francisco": (37.7749, -122.4194),
    "los angeles": (34.0522, -118.2437),
    "san jose": (37.3382, -121.8863),
    "fremont": (37.5485, -121.9886),
    "mountain view": (37.3861, -122.0839),
    "palo alto": (37.4419, -122.1430),
    "phoenix": (33.4484, -112.0740),
    "tempe": (33.4255, -111.9400),
    "chandler": (33.3062, -111.8413),
    "scottsdale": (33.4942, -111.9261),
    "las vegas": (36.1699, -115.1398),
    "miami": (25.7617, -80.1918),
    "austin": (30.2672, -97.7431),
    "seattle": (47.6062, -122.3321),
    "new york": (40.7128, -74.0060),
    "chicago": (41.8781, -87.6298),
    "pittsburgh": (40.4406, -79.9959),
    "detroit": (42.3314, -83.0458),
}

_STATE_COORDS: dict[str, tuple[float, float]] = {
    "CA": (37.7749, -122.4194),
    "AZ": (33.4484, -112.0740),
    "TX": (30.2672, -97.7431),
    "NV": (36.1699, -115.1398),
    "FL": (25.7617, -80.1918),
    "WA": (47.6062, -122.3321),
    "NY": (40.7128, -74.0060),
    "IL": (41.8781, -87.6298),
    "PA": (40.4406, -79.9959),
    "MI": (42.3314, -83.0458),
}


def _resolve_coords(record: IncidentRecord) -> tuple[float, float] | None:
    """Return (lat, lng) for a record, falling back to city/state lookup."""
    if record.latitude is not None and record.longitude is not None:
        return (record.latitude, record.longitude)
    if record.city:
        key = record.city.lower().strip()
        if key in _CITY_COORDS:
            return _CITY_COORDS[key]
    if record.state:
        if record.state in _STATE_COORDS:
            return _STATE_COORDS[record.state]
    return None

logger = logging.getLogger(__name__)


class DataSyncService:
    """
    Service to synchronize incident data from all configured sources.

    This service:
    1. Coordinates fetching from multiple data sources
    2. Deduplicates incidents by external_id
    3. Stores/updates incidents in the database
    4. Tracks sync status and history
    """

    def __init__(self, db_session=None):
        """
        Initialize the sync service.

        Args:
            db_session: Database session for storing data
        """
        self.db_session = db_session
        self.logger = logging.getLogger(__name__)

        # Initialize all data sources
        self.sources: list[DataSourceBase] = [
            NHTSASGODataSource(include_adas=True),
            NHTSAComplaintsAPI(),
            NHTSARecallsAPI(),
            CaliforniaDMVDataSource(),
            CPUCDataSource(),
        ]

    async def sync_all(
        self, since: Optional[datetime] = None, sources: Optional[list[str]] = None
    ) -> dict[str, SyncResult]:
        """
        Sync data from all configured sources.

        Args:
            since: Only fetch data newer than this timestamp
            sources: List of source names to sync (None = all)

        Returns:
            Dictionary of source name to SyncResult
        """
        results = {}

        # Filter sources if specified
        sources_to_sync = self.sources
        if sources:
            sources_to_sync = [s for s in self.sources if s.name in sources]

        self.logger.info(f"Starting sync for {len(sources_to_sync)} sources...")

        for source in sources_to_sync:
            try:
                self.logger.info(f"Syncing {source.name}...")
                result = await self._sync_source(source, since)
                results[source.name] = result

            except Exception as e:
                self.logger.error(f"Sync failed for {source.name}: {e}")
                results[source.name] = SyncResult(
                    source_name=source.name,
                    started_at=datetime.utcnow(),
                    completed_at=datetime.utcnow(),
                    status="failed",
                    error_message=str(e),
                )

        return results

    async def _sync_source(
        self, source: DataSourceBase, since: Optional[datetime] = None
    ) -> SyncResult:
        """Sync a single data source."""
        result = SyncResult(source_name=source.name, started_at=datetime.utcnow())

        try:
            # Fetch raw data
            raw_data = await source.fetch_data(since)
            result.records_processed = len(raw_data)

            # Parse into standardized records
            records = source.parse_records(raw_data)

            # Store in database
            if self.db_session and records:
                created, updated, skipped = await self._store_records(records)
                result.records_created = created
                result.records_updated = updated
                result.records_skipped = skipped

            result.status = "completed"
            result.completed_at = datetime.utcnow()
            result.metadata = {
                "parsed_records": len(records),
                "source_type": source.source_type.value,
                "trust_level": source.trust_level.value,
            }

        except Exception as e:
            result.status = "failed"
            result.error_message = str(e)
            result.completed_at = datetime.utcnow()
            self.logger.error(f"Sync error for {source.name}: {e}")

        return result

    async def _store_records(
        self, records: list[IncidentRecord]
    ) -> tuple[int, int, int]:
        """
        Store incident records in the database.

        Returns:
            Tuple of (created, updated, skipped) counts
        """
        created = 0
        updated = 0
        skipped = 0

        for record in records:
            try:
                # Check if record exists by external_id
                existing = await self._find_existing_incident(record.external_id)

                if existing:
                    # Update if data is newer or more complete
                    if await self._should_update(existing, record):
                        await self._update_incident(existing, record)
                        updated += 1
                    else:
                        skipped += 1
                else:
                    # Create new incident
                    await self._create_incident(record)
                    created += 1

            except Exception as e:
                self.logger.warning(f"Failed to store record {record.external_id}: {e}")
                skipped += 1

        return created, updated, skipped

    async def _find_existing_incident(self, external_id: str) -> Optional[Any]:
        """Find an existing incident by external ID."""
        if not self.db_session:
            return None
        result = await self.db_session.execute(
            select(Incident).where(Incident.external_id == external_id)
        )
        return result.scalar_one_or_none()

    async def _should_update(self, existing: Any, new: IncidentRecord) -> bool:
        """Determine if existing record should be updated."""
        # Update if new record has higher confidence or more data
        if new.confidence_score > getattr(existing, "confidence_score", 0):
            return True
        if new.description and not getattr(existing, "description", None):
            return True
        return False

    async def _create_incident(self, record: IncidentRecord) -> None:
        """Create a new incident in the database."""
        if not self.db_session:
            return

        coords = _resolve_coords(record)
        if coords is None:
            self.logger.debug(f"Skipping record {record.external_id}: no coordinates available")
            return

        lat, lng = coords
        point = WKTElement(f"POINT({lng} {lat})", srid=4326)
        incident = Incident(
            incident_type=record.incident_type,
            occurred_at=record.occurred_at,
            source=record.source,
            external_id=record.external_id,
            location=point,
            address=record.address,
            city=record.city or "Unknown",
            av_company=record.av_company,
            description=record.description,
            confidence_score=record.confidence_score,
            status=record.status,
        )
        self.db_session.add(incident)

    async def _update_incident(self, existing: Any, record: IncidentRecord) -> None:
        """Update an existing incident with new data."""
        if not self.db_session:
            return

        if record.description and not existing.description:
            existing.description = record.description
        if record.confidence_score > (existing.confidence_score or 0):
            existing.confidence_score = record.confidence_score
        if record.av_company and not existing.av_company:
            existing.av_company = record.av_company

    async def sync_nhtsa_sgo(self, since: Optional[datetime] = None) -> SyncResult:
        """Convenience method to sync only NHTSA SGO data."""
        source = NHTSASGODataSource()
        return await self._sync_source(source, since)

    async def sync_nhtsa_complaints(
        self, since: Optional[datetime] = None
    ) -> SyncResult:
        """Convenience method to sync only NHTSA complaints."""
        source = NHTSAComplaintsAPI()
        return await self._sync_source(source, since)

    async def sync_california_dmv(self, since: Optional[datetime] = None) -> SyncResult:
        """Convenience method to sync only CA DMV data."""
        source = CaliforniaDMVDataSource()
        return await self._sync_source(source, since)

    async def sync_cpuc(self, since: Optional[datetime] = None) -> SyncResult:
        """Convenience method to sync only CPUC data."""
        source = CPUCDataSource()
        return await self._sync_source(source, since)

    def get_source_info(self) -> list[dict[str, Any]]:
        """Get information about all configured sources."""
        return [
            {
                "name": source.name,
                "type": source.source_type.value,
                "trust_level": source.trust_level.value,
                "base_url": source.config.base_url,
                "description": source.config.description,
                "sync_frequency_hours": source.config.sync_frequency_hours,
            }
            for source in self.sources
        ]


# CLI commands for manual sync
async def run_full_sync():
    """Run a full sync of all data sources."""
    service = DataSyncService()
    results = await service.sync_all()

    print("\n=== Sync Results ===")
    for source_name, result in results.items():
        print(f"\n{source_name}:")
        print(f"  Status: {result.status}")
        print(f"  Records Processed: {result.records_processed}")
        print(f"  Created: {result.records_created}")
        print(f"  Updated: {result.records_updated}")
        if result.error_message:
            print(f"  Error: {result.error_message}")


async def run_nhtsa_sync():
    """Run sync for NHTSA sources only."""
    service = DataSyncService()

    # Sync NHTSA SGO (primary AV incident data)
    sgo_result = await service.sync_nhtsa_sgo()
    print(f"NHTSA SGO: {sgo_result.records_processed} records")

    # Sync NHTSA Complaints
    complaints_result = await service.sync_nhtsa_complaints()
    print(f"NHTSA Complaints: {complaints_result.records_processed} records")


if __name__ == "__main__":
    asyncio.run(run_full_sync())
