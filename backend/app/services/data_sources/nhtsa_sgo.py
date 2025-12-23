"""
NHTSA Standing General Order (SGO) Data Source.

Fetches ADS and ADAS incident reports from NHTSA's publicly available CSV files.

Data Sources:
- ADS Incident Reports: https://static.nhtsa.gov/odi/ffdd/sgo-2021-01/SGO-2021-01_Incident_Reports_ADS.csv
- ADAS Incident Reports: https://static.nhtsa.gov/odi/ffdd/sgo-2021-01/SGO-2021-01_Incident_Reports_ADAS.csv
- Other Incident Reports: https://static.nhtsa.gov/odi/ffdd/sgo-2021-01/SGO-2021-01_Incident_Reports_OTHER.csv

Documentation: https://www.nhtsa.gov/laws-regulations/standing-general-order-crash-reporting
"""

import csv
import io
from datetime import datetime
from typing import Any, Optional
import httpx

from .base import (
    DataSourceBase,
    DataSourceConfig,
    DataSourceType,
    TrustLevel,
    IncidentRecord,
)


class NHTSASGODataSource(DataSourceBase):
    """
    NHTSA Standing General Order data source.

    Fetches ADS (Automated Driving System) and ADAS (Advanced Driver Assistance System)
    incident reports mandated by federal law.
    """

    # NHTSA SGO CSV endpoints
    ADS_CSV_URL = "https://static.nhtsa.gov/odi/ffdd/sgo-2021-01/SGO-2021-01_Incident_Reports_ADS.csv"
    ADAS_CSV_URL = "https://static.nhtsa.gov/odi/ffdd/sgo-2021-01/SGO-2021-01_Incident_Reports_ADAS.csv"
    OTHER_CSV_URL = "https://static.nhtsa.gov/odi/ffdd/sgo-2021-01/SGO-2021-01_Incident_Reports_OTHER.csv"

    def __init__(self, include_adas: bool = True, include_other: bool = False):
        """
        Initialize NHTSA SGO data source.

        Args:
            include_adas: Whether to include ADAS (Level 2) incidents
            include_other: Whether to include other/unknown type incidents
        """
        config = DataSourceConfig(
            name="NHTSA Standing General Order",
            source_type=DataSourceType.NHTSA_SGO,
            trust_level=TrustLevel.OFFICIAL,
            base_url="https://static.nhtsa.gov/odi/ffdd/sgo-2021-01/",
            description="Federal ADS/ADAS crash reporting mandated by NHTSA",
            sync_frequency_hours=24,
        )
        super().__init__(config)
        self.include_adas = include_adas
        self.include_other = include_other

    async def fetch_data(
        self, since: Optional[datetime] = None
    ) -> list[dict[str, Any]]:
        """
        Fetch ADS and ADAS incident data from NHTSA CSV files.

        Args:
            since: Filter incidents occurring after this date

        Returns:
            List of raw incident dictionaries
        """
        all_records = []

        async with httpx.AsyncClient(timeout=self.config.timeout_seconds) as client:
            # Always fetch ADS data
            ads_records = await self._fetch_csv(client, self.ADS_CSV_URL, "ADS")
            all_records.extend(ads_records)

            # Optionally fetch ADAS data
            if self.include_adas:
                adas_records = await self._fetch_csv(client, self.ADAS_CSV_URL, "ADAS")
                all_records.extend(adas_records)

            # Optionally fetch other data
            if self.include_other:
                other_records = await self._fetch_csv(
                    client, self.OTHER_CSV_URL, "OTHER"
                )
                all_records.extend(other_records)

        # Filter by date if specified
        if since:
            filtered = []
            for record in all_records:
                incident_date = self._parse_date(record.get("Incident Month/Year", ""))
                if incident_date and incident_date >= since:
                    filtered.append(record)
            all_records = filtered

        self.logger.info(f"Fetched {len(all_records)} total records from NHTSA SGO")
        return all_records

    async def _fetch_csv(
        self, client: httpx.AsyncClient, url: str, dataset_type: str
    ) -> list[dict[str, Any]]:
        """Fetch and parse a single CSV file."""
        try:
            self.logger.info(f"Fetching {dataset_type} data from {url}")
            response = await client.get(url)
            response.raise_for_status()

            # Parse CSV content
            content = response.text
            reader = csv.DictReader(io.StringIO(content))

            records = []
            for row in reader:
                row["_dataset_type"] = dataset_type
                records.append(row)

            self.logger.info(f"Parsed {len(records)} {dataset_type} records")
            return records

        except httpx.HTTPError as e:
            self.logger.error(f"Failed to fetch {dataset_type} data: {e}")
            return []

    def parse_records(self, raw_data: list[dict[str, Any]]) -> list[IncidentRecord]:
        """
        Parse raw CSV data into standardized IncidentRecords.

        NHTSA SGO CSV columns (third amendment format):
        - Report ID
        - Report Version
        - Report Submission Date
        - Same Incident ID
        - Same Vehicle ID
        - Reporting Entity
        - Make
        - Model
        - Model Year
        - VIN (partial)
        - Incident Month/Year
        - State
        - City
        - Type of Automation System Engaged
        - Narrative
        - And more...
        """
        records = []
        seen_incident_ids = set()

        for row in raw_data:
            try:
                # Skip duplicate incidents (same incident can have multiple reports)
                incident_id = row.get("Same Incident ID", row.get("Report ID", ""))
                if incident_id in seen_incident_ids:
                    continue
                seen_incident_ids.add(incident_id)

                # Parse the incident
                record = self._parse_single_record(row)
                if record:
                    records.append(record)

            except Exception as e:
                self.logger.warning(f"Failed to parse record: {e}")
                continue

        self.logger.info(f"Parsed {len(records)} unique incident records")
        return records

    def _parse_single_record(self, row: dict[str, Any]) -> Optional[IncidentRecord]:
        """Parse a single row into an IncidentRecord."""
        # Extract key fields
        report_id = row.get("Report ID", "")
        incident_id = row.get("Same Incident ID", report_id)

        if not incident_id:
            return None

        # Parse date
        occurred_at = self._parse_date(row.get("Incident Month/Year", ""))
        if not occurred_at:
            # Use report submission date as fallback
            occurred_at = self._parse_submission_date(
                row.get("Report Submission Date", "")
            )

        if not occurred_at:
            self.logger.warning(f"Could not parse date for incident {incident_id}")
            return None

        # Determine incident type from collision info
        incident_type = self._determine_incident_type(row)

        # Extract company from reporting entity or make
        company = self._extract_company(row)

        # Build narrative/description
        description = row.get("Narrative", "")
        if not description:
            description = self._build_description(row)

        # Extract injury info
        injuries, fatalities = self._extract_injury_info(row)

        # Create record
        record = IncidentRecord(
            incident_type=incident_type,
            occurred_at=occurred_at,
            source="nhtsa_sgo",
            external_id=f"nhtsa_sgo_{incident_id}",
            state=row.get("State", ""),
            city=row.get("City", ""),
            av_company=company,
            description=description,
            injuries=injuries,
            fatalities=fatalities,
            confidence_score=1.0,
            status="verified",
            raw_data=row,
            reported_at=self._parse_submission_date(
                row.get("Report Submission Date", "")
            ),
        )

        return record

    def _parse_date(self, date_str: str) -> Optional[datetime]:
        """Parse NHTSA date format (Month/Year like 'November 2024')."""
        if not date_str or date_str.upper() in ["REDACTED", "UNKNOWN", ""]:
            return None

        try:
            # Try "Month Year" format
            return datetime.strptime(date_str.strip(), "%B %Y")
        except ValueError:
            pass

        try:
            # Try "MM/YYYY" format
            return datetime.strptime(date_str.strip(), "%m/%Y")
        except ValueError:
            pass

        try:
            # Try "YYYY-MM" format
            return datetime.strptime(date_str.strip(), "%Y-%m")
        except ValueError:
            pass

        return None

    def _parse_submission_date(self, date_str: str) -> Optional[datetime]:
        """Parse report submission date."""
        if not date_str:
            return None

        try:
            return datetime.strptime(date_str.strip(), "%Y-%m-%d")
        except ValueError:
            pass

        try:
            return datetime.strptime(date_str.strip(), "%m/%d/%Y")
        except ValueError:
            pass

        return None

    def _determine_incident_type(self, row: dict[str, Any]) -> str:
        """Determine incident type from row data."""
        # Check for collision indicators
        collision_fields = [
            "Object Struck",
            "Collision With",
            "First Harmful Event",
            "Most Harmful Event",
        ]

        for field in collision_fields:
            value = row.get(field, "").lower()
            if value and value not in ["none", "n/a", "redacted", ""]:
                return "collision"

        # Check narrative for clues
        narrative = row.get("Narrative", "").lower()
        if any(
            word in narrative
            for word in ["struck", "hit", "collision", "crash", "impact"]
        ):
            return "collision"

        if any(word in narrative for word in ["near miss", "avoided", "close call"]):
            return "near_miss"

        if any(word in narrative for word in ["stopped", "blocking", "stuck"]):
            return "blockage"

        # Default to collision for SGO data (which primarily reports crashes)
        return "collision"

    def _extract_company(self, row: dict[str, Any]) -> Optional[str]:
        """Extract AV company from row data."""
        # Try reporting entity first
        entity = row.get("Reporting Entity", "")
        if entity:
            return self.normalize_company_name(entity)

        # Fall back to make
        make = row.get("Make", "")
        return self.normalize_company_name(make)

    def _build_description(self, row: dict[str, Any]) -> str:
        """Build description from available fields."""
        parts = []

        automation_type = row.get("Type of Automation System Engaged", "")
        if automation_type:
            parts.append(f"Automation: {automation_type}")

        make = row.get("Make", "")
        model = row.get("Model", "")
        year = row.get("Model Year", "")
        if make or model:
            vehicle_info = " ".join(filter(None, [year, make, model]))
            parts.append(f"Vehicle: {vehicle_info}")

        return ". ".join(parts) if parts else ""

    def _extract_injury_info(self, row: dict[str, Any]) -> tuple[int, int]:
        """Extract injury and fatality counts."""
        injuries = 0
        fatalities = 0

        # Check for injury-related fields
        injury_fields = [
            "Persons Injured",
            "Number of Injured",
            "Injuries",
        ]

        for field in injury_fields:
            value = row.get(field, "")
            if value and value.isdigit():
                injuries = max(injuries, int(value))
                break

        # Check for fatality fields
        fatality_fields = [
            "Fatalities",
            "Persons Killed",
            "Deaths",
        ]

        for field in fatality_fields:
            value = row.get(field, "")
            if value and value.isdigit():
                fatalities = max(fatalities, int(value))
                break

        # Check severity field
        severity = row.get(
            "Injury Severity", row.get("Highest Injury Severity", "")
        ).lower()
        if "fatal" in severity:
            fatalities = max(fatalities, 1)
        elif "injur" in severity and injuries == 0:
            injuries = 1

        return injuries, fatalities


