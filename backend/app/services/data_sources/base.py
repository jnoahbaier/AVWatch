"""
Base class for data sources.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class DataSourceType(str, Enum):
    """Types of data sources."""

    NHTSA_SGO = "nhtsa_sgo"
    NHTSA_COMPLAINTS = "nhtsa_complaints"
    NHTSA_RECALLS = "nhtsa_recalls"
    NHTSA_FARS = "nhtsa_fars"
    CA_DMV = "ca_dmv"
    CPUC = "cpuc"
    USER_REPORT = "user_report"


class TrustLevel(str, Enum):
    """Trust level for data sources."""

    OFFICIAL = "official"  # Government sources (NHTSA, DMV, CPUC)
    VERIFIED = "verified"  # Verified third-party
    COMMUNITY = "community"  # User reports


@dataclass
class DataSourceConfig:
    """Configuration for a data source."""

    name: str
    source_type: DataSourceType
    trust_level: TrustLevel
    base_url: str
    description: str = ""
    enabled: bool = True
    sync_frequency_hours: int = 24
    rate_limit_requests_per_minute: int = 60
    retry_attempts: int = 3
    timeout_seconds: int = 30


@dataclass
class IncidentRecord:
    """Standardized incident record from any data source."""

    # Required fields
    incident_type: str  # collision, near_miss, sudden_behavior, blockage, other
    occurred_at: datetime
    source: str
    external_id: str

    # Location
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None

    # Details
    av_company: Optional[str] = None
    description: Optional[str] = None
    injuries: int = 0
    fatalities: int = 0

    # Verification
    confidence_score: float = 1.0
    status: str = "verified"  # Official sources are pre-verified

    # Raw data for reference
    raw_data: dict = field(default_factory=dict)

    # Timestamps
    reported_at: Optional[datetime] = None


@dataclass
class SyncResult:
    """Result of a data sync operation."""

    source_name: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    status: str = "in_progress"
    records_processed: int = 0
    records_created: int = 0
    records_updated: int = 0
    records_skipped: int = 0
    error_message: Optional[str] = None
    metadata: dict = field(default_factory=dict)


class DataSourceBase(ABC):
    """Base class for all data sources."""

    def __init__(self, config: DataSourceConfig):
        self.config = config
        self.logger = logging.getLogger(f"{__name__}.{config.name}")

    @property
    def name(self) -> str:
        return self.config.name

    @property
    def source_type(self) -> DataSourceType:
        return self.config.source_type

    @property
    def trust_level(self) -> TrustLevel:
        return self.config.trust_level

    @abstractmethod
    async def fetch_data(
        self, since: Optional[datetime] = None
    ) -> list[dict[str, Any]]:
        """
        Fetch raw data from the source.

        Args:
            since: Only fetch data newer than this timestamp (if supported)

        Returns:
            List of raw data records
        """
        pass

    @abstractmethod
    def parse_records(self, raw_data: list[dict[str, Any]]) -> list[IncidentRecord]:
        """
        Parse raw data into standardized IncidentRecords.

        Args:
            raw_data: List of raw data dictionaries

        Returns:
            List of IncidentRecord objects
        """
        pass

    async def sync(self, since: Optional[datetime] = None) -> SyncResult:
        """
        Sync data from this source.

        Args:
            since: Only sync data newer than this timestamp

        Returns:
            SyncResult with statistics
        """
        result = SyncResult(source_name=self.name, started_at=datetime.utcnow())

        try:
            self.logger.info(f"Starting sync for {self.name}")

            # Fetch raw data
            raw_data = await self.fetch_data(since)
            result.records_processed = len(raw_data)

            # Parse into standardized records
            records = self.parse_records(raw_data)

            result.status = "completed"
            result.completed_at = datetime.utcnow()
            result.metadata["parsed_records"] = len(records)

            self.logger.info(
                f"Sync completed for {self.name}: "
                f"{result.records_processed} processed, "
                f"{len(records)} parsed"
            )

        except Exception as e:
            result.status = "failed"
            result.error_message = str(e)
            result.completed_at = datetime.utcnow()
            self.logger.error(f"Sync failed for {self.name}: {e}")

        return result

    def normalize_company_name(self, company: Optional[str]) -> Optional[str]:
        """Normalize AV company names to standard format."""
        if not company:
            return None

        company_lower = company.lower().strip()

        # Mapping of variations to standard names
        mappings = {
            "waymo": ["waymo", "waymo llc", "google", "google waymo"],
            "cruise": [
                "cruise",
                "cruise llc",
                "gm cruise",
                "cruise automation",
                "general motors cruise",
            ],
            "zoox": ["zoox", "zoox inc", "zoox, inc"],
            "tesla": ["tesla", "tesla inc", "tesla motors", "tesla, inc"],
            "nuro": ["nuro", "nuro inc"],
            "aurora": ["aurora", "aurora innovation", "aurora driver"],
            "argo": ["argo", "argo ai", "argo ai llc"],
            "pony.ai": ["pony.ai", "pony", "pony ai", "ponyai"],
            "autox": ["autox", "autox inc", "autox technologies"],
            "motional": ["motional", "motional autonomous driving"],
            "apple": ["apple", "apple inc"],
            "mercedes": ["mercedes", "mercedes-benz", "mercedes benz", "daimler"],
            "weride": ["weride", "weride corp", "weride corporation"],
        }

        for standard_name, variations in mappings.items():
            if company_lower in variations:
                return standard_name

        return company.strip()

    def normalize_incident_type(self, incident_type: Optional[str]) -> str:
        """Normalize incident types to standard format."""
        if not incident_type:
            return "other"

        type_lower = incident_type.lower().strip()

        # Collision types
        if any(
            term in type_lower
            for term in ["collision", "crash", "accident", "impact", "struck"]
        ):
            return "collision"

        # Near miss types
        if any(
            term in type_lower
            for term in ["near miss", "near-miss", "close call", "avoided"]
        ):
            return "near_miss"

        # Sudden behavior types
        if any(
            term in type_lower
            for term in ["sudden", "abrupt", "unexpected", "erratic", "swerve"]
        ):
            return "sudden_behavior"

        # Blockage types
        if any(
            term in type_lower
            for term in ["block", "obstruction", "stopped", "stuck", "immobile"]
        ):
            return "blockage"

        return "other"
