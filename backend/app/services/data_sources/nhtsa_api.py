"""
NHTSA API Data Sources.

Fetches data from NHTSA's public APIs:
- Complaints API: Consumer complaints about vehicle safety issues
- Recalls API: Vehicle recall information
- FARS API: Fatality Analysis Reporting System data

API Documentation: https://www.nhtsa.gov/nhtsa-datasets-and-apis
"""

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


# AV company makes to search for in NHTSA
AV_MAKES = [
    "Tesla",
    "Waymo",
    "Cruise",
    "Zoox",
    "Nuro",
    "Aurora",
    "Argo",
    "Pony",
    "AutoX",
    "Motional",
    "Apple",
    "Mercedes-Benz",
    "Mercedes",
]

# Model years to search (recent years with active AV programs)
AV_MODEL_YEARS = range(2018, 2026)


class NHTSAComplaintsAPI(DataSourceBase):
    """
    NHTSA Complaints API data source.

    Fetches consumer complaints related to AV systems.
    API: https://api.nhtsa.gov/complaints/complaintsByVehicle
    """

    BASE_URL = "https://api.nhtsa.gov"
    COMPLAINTS_ENDPOINT = "/complaints/complaintsByVehicle"

    def __init__(
        self, makes: Optional[list[str]] = None, years: Optional[range] = None
    ):
        """
        Initialize NHTSA Complaints API.

        Args:
            makes: List of vehicle makes to search (default: AV_MAKES)
            years: Range of model years to search (default: AV_MODEL_YEARS)
        """
        config = DataSourceConfig(
            name="NHTSA Complaints API",
            source_type=DataSourceType.NHTSA_COMPLAINTS,
            trust_level=TrustLevel.OFFICIAL,
            base_url=self.BASE_URL,
            description="Consumer complaints about vehicle safety from NHTSA",
            sync_frequency_hours=24,
            rate_limit_requests_per_minute=30,  # Be nice to the API
        )
        super().__init__(config)
        self.makes = makes or AV_MAKES
        self.years = years or AV_MODEL_YEARS

    async def fetch_data(
        self, since: Optional[datetime] = None
    ) -> list[dict[str, Any]]:
        """
        Fetch complaints for AV-related vehicles.

        Note: NHTSA API doesn't support date filtering, so we fetch all
        and filter locally if needed.
        """
        all_complaints = []

        async with httpx.AsyncClient(
            base_url=self.BASE_URL, timeout=self.config.timeout_seconds
        ) as client:
            for make in self.makes:
                for year in self.years:
                    try:
                        complaints = await self._fetch_complaints(client, make, year)
                        all_complaints.extend(complaints)
                    except Exception as e:
                        self.logger.warning(
                            f"Failed to fetch complaints for {year} {make}: {e}"
                        )

        # Filter for AV/ADAS related complaints
        av_complaints = self._filter_av_related(all_complaints)

        # Filter by date if specified
        if since:
            av_complaints = [
                c
                for c in av_complaints
                if self._parse_complaint_date(c)
                and self._parse_complaint_date(c) >= since
            ]

        self.logger.info(f"Found {len(av_complaints)} AV-related complaints")
        return av_complaints

    async def _fetch_complaints(
        self, client: httpx.AsyncClient, make: str, year: int
    ) -> list[dict[str, Any]]:
        """Fetch complaints for a specific make/year."""
        params = {
            "make": make,
            "modelYear": year,
        }

        response = await client.get(self.COMPLAINTS_ENDPOINT, params=params)
        response.raise_for_status()

        data = response.json()
        return data.get("results", [])

    def _filter_av_related(
        self, complaints: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """Filter complaints to only include AV/ADAS related issues."""
        av_keywords = [
            "autopilot",
            "autosteer",
            "auto pilot",
            "auto steer",
            "full self driving",
            "fsd",
            "self-driving",
            "self driving",
            "autonomous",
            "automated",
            "driver assist",
            "adas",
            "cruise control",
            "lane keeping",
            "lane departure",
            "collision avoidance",
            "automatic emergency",
            "aeb",
            "phantom braking",
            "phantom brake",
            "tesla vision",
            "waymo",
            "cruise",
            "zoox",
        ]

        filtered = []
        for complaint in complaints:
            summary = complaint.get("summary", "").lower()
            components = complaint.get("components", "").lower()

            if any(
                keyword in summary or keyword in components for keyword in av_keywords
            ):
                filtered.append(complaint)

        return filtered

    def _parse_complaint_date(self, complaint: dict[str, Any]) -> Optional[datetime]:
        """Parse complaint date."""
        date_str = complaint.get("dateOfIncident") or complaint.get(
            "dateComplaintFiled"
        )
        if not date_str:
            return None

        try:
            return datetime.strptime(date_str, "%Y%m%d")
        except ValueError:
            pass

        try:
            return datetime.strptime(date_str, "%Y-%m-%d")
        except ValueError:
            pass

        return None

    def parse_records(self, raw_data: list[dict[str, Any]]) -> list[IncidentRecord]:
        """Parse complaints into IncidentRecords."""
        records = []

        for complaint in raw_data:
            try:
                record = self._parse_complaint(complaint)
                if record:
                    records.append(record)
            except Exception as e:
                self.logger.warning(f"Failed to parse complaint: {e}")

        return records

    def _parse_complaint(self, complaint: dict[str, Any]) -> Optional[IncidentRecord]:
        """Parse a single complaint into an IncidentRecord."""
        odi_number = complaint.get("odiNumber")
        if not odi_number:
            return None

        occurred_at = self._parse_complaint_date(complaint)
        if not occurred_at:
            return None

        # Determine incident type from crash/injury info
        crash = complaint.get("crash", "N")
        injuries = int(complaint.get("numberOfInjuries", 0) or 0)

        if crash == "Y" or injuries > 0:
            incident_type = "collision"
        else:
            incident_type = "near_miss"  # Most complaints are near-miss reports

        company = self.normalize_company_name(complaint.get("manufacturer", ""))

        return IncidentRecord(
            incident_type=incident_type,
            occurred_at=occurred_at,
            source="nhtsa_complaints",
            external_id=f"nhtsa_complaint_{odi_number}",
            state=complaint.get("state", ""),
            av_company=company,
            description=complaint.get("summary", ""),
            injuries=injuries,
            fatalities=int(complaint.get("numberOfDeaths", 0) or 0),
            confidence_score=0.9,  # Consumer reports, slightly less verified
            status="verified",
            raw_data=complaint,
            reported_at=self._parse_complaint_date(complaint),
        )


class NHTSARecallsAPI(DataSourceBase):
    """
    NHTSA Recalls API data source.

    Fetches vehicle recall information for AV-related issues.
    API: https://api.nhtsa.gov/recalls/recallsByVehicle
    """

    BASE_URL = "https://api.nhtsa.gov"
    RECALLS_ENDPOINT = "/recalls/recallsByVehicle"

    def __init__(
        self, makes: Optional[list[str]] = None, years: Optional[range] = None
    ):
        config = DataSourceConfig(
            name="NHTSA Recalls API",
            source_type=DataSourceType.NHTSA_RECALLS,
            trust_level=TrustLevel.OFFICIAL,
            base_url=self.BASE_URL,
            description="Vehicle recalls from NHTSA",
            sync_frequency_hours=24,
            rate_limit_requests_per_minute=30,
        )
        super().__init__(config)
        self.makes = makes or AV_MAKES
        self.years = years or AV_MODEL_YEARS

    async def fetch_data(
        self, since: Optional[datetime] = None
    ) -> list[dict[str, Any]]:
        """Fetch recalls for AV-related vehicles."""
        all_recalls = []

        async with httpx.AsyncClient(
            base_url=self.BASE_URL, timeout=self.config.timeout_seconds
        ) as client:
            for make in self.makes:
                for year in self.years:
                    try:
                        recalls = await self._fetch_recalls(client, make, year)
                        all_recalls.extend(recalls)
                    except Exception as e:
                        self.logger.warning(
                            f"Failed to fetch recalls for {year} {make}: {e}"
                        )

        # Filter for AV/ADAS related recalls
        av_recalls = self._filter_av_related(all_recalls)

        self.logger.info(f"Found {len(av_recalls)} AV-related recalls")
        return av_recalls

    async def _fetch_recalls(
        self, client: httpx.AsyncClient, make: str, year: int
    ) -> list[dict[str, Any]]:
        """Fetch recalls for a specific make/year."""
        params = {
            "make": make,
            "modelYear": year,
        }

        response = await client.get(self.RECALLS_ENDPOINT, params=params)
        response.raise_for_status()

        data = response.json()
        return data.get("results", [])

    def _filter_av_related(self, recalls: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Filter recalls to only include AV/ADAS related issues."""
        av_keywords = [
            "autopilot",
            "autosteer",
            "self-driving",
            "autonomous",
            "driver assist",
            "adas",
            "cruise control",
            "lane keeping",
            "collision avoidance",
            "automatic emergency braking",
            "forward collision",
            "camera",
            "sensor",
            "radar",
            "lidar",
        ]

        filtered = []
        for recall in recalls:
            summary = recall.get("Summary", "").lower()
            component = recall.get("Component", "").lower()

            if any(
                keyword in summary or keyword in component for keyword in av_keywords
            ):
                filtered.append(recall)

        return filtered

    def parse_records(self, raw_data: list[dict[str, Any]]) -> list[IncidentRecord]:
        """Parse recalls into IncidentRecords."""
        records = []

        for recall in raw_data:
            try:
                record = self._parse_recall(recall)
                if record:
                    records.append(record)
            except Exception as e:
                self.logger.warning(f"Failed to parse recall: {e}")

        return records

    def _parse_recall(self, recall: dict[str, Any]) -> Optional[IncidentRecord]:
        """Parse a single recall into an IncidentRecord."""
        campaign_number = recall.get("NHTSACampaignNumber")
        if not campaign_number:
            return None

        # Parse report received date
        report_date = recall.get("ReportReceivedDate", "")
        occurred_at = None
        if report_date:
            try:
                occurred_at = datetime.strptime(report_date, "%Y%m%d")
            except ValueError:
                pass

        if not occurred_at:
            return None

        company = self.normalize_company_name(recall.get("Manufacturer", ""))

        return IncidentRecord(
            incident_type="other",  # Recalls are not incidents per se
            occurred_at=occurred_at,
            source="nhtsa_recalls",
            external_id=f"nhtsa_recall_{campaign_number}",
            av_company=company,
            description=recall.get("Summary", ""),
            confidence_score=1.0,
            status="verified",
            raw_data=recall,
        )


class NHTSAFarsAPI(DataSourceBase):
    """
    NHTSA Fatality Analysis Reporting System (FARS) API.

    Fetches fatal crash data. Note: FARS data is focused on all fatal crashes,
    not specifically AV-related, so filtering is needed.

    API: https://crashviewer.nhtsa.dot.gov/CrashAPI
    """

    BASE_URL = "https://crashviewer.nhtsa.dot.gov/CrashAPI"

    def __init__(
        self, states: Optional[list[int]] = None, years: Optional[range] = None
    ):
        """
        Initialize FARS API.

        Args:
            states: List of state codes (1=AL, 6=CA, etc.)
            years: Range of years to fetch (2010+)
        """
        config = DataSourceConfig(
            name="NHTSA FARS API",
            source_type=DataSourceType.NHTSA_FARS,
            trust_level=TrustLevel.OFFICIAL,
            base_url=self.BASE_URL,
            description="Fatal crash data from NHTSA FARS",
            sync_frequency_hours=168,  # Weekly - FARS updates less frequently
            rate_limit_requests_per_minute=10,
        )
        super().__init__(config)
        # Default to CA (6) and AZ (4) - major AV testing states
        self.states = states or [6, 4, 48]  # CA, AZ, TX
        self.years = years or range(2020, 2025)

    async def fetch_data(
        self, since: Optional[datetime] = None
    ) -> list[dict[str, Any]]:
        """
        Fetch fatal crash data from FARS.

        Note: This fetches all fatal crashes, not just AV-related.
        Further filtering is needed.
        """
        all_crashes = []

        async with httpx.AsyncClient(timeout=60) as client:
            for state in self.states:
                for year in self.years:
                    try:
                        crashes = await self._fetch_crashes(client, state, year)
                        all_crashes.extend(crashes)
                    except Exception as e:
                        self.logger.warning(
                            f"Failed to fetch FARS for state {state}, year {year}: {e}"
                        )

        self.logger.info(f"Fetched {len(all_crashes)} fatal crashes from FARS")
        return all_crashes

    async def _fetch_crashes(
        self, client: httpx.AsyncClient, state: int, year: int
    ) -> list[dict[str, Any]]:
        """Fetch crashes for a specific state and year."""
        url = f"{self.BASE_URL}/crashes/GetCaseList"
        params = {
            "states": state,
            "fromYear": year,
            "toYear": year,
            "format": "json",
        }

        response = await client.get(url, params=params)
        response.raise_for_status()

        data = response.json()
        return data.get("Results", [[]])[0] if data.get("Results") else []

    def parse_records(self, raw_data: list[dict[str, Any]]) -> list[IncidentRecord]:
        """Parse FARS crashes into IncidentRecords."""
        records = []

        for crash in raw_data:
            try:
                record = self._parse_crash(crash)
                if record:
                    records.append(record)
            except Exception as e:
                self.logger.warning(f"Failed to parse FARS crash: {e}")

        return records

    def _parse_crash(self, crash: dict[str, Any]) -> Optional[IncidentRecord]:
        """Parse a single FARS crash into an IncidentRecord."""
        case_number = crash.get("ST_CASE")
        if not case_number:
            return None

        # Parse crash date
        year = crash.get("YEAR")
        month = crash.get("MONTH", 1)
        day = crash.get("DAY", 1)

        if not year:
            return None

        try:
            occurred_at = datetime(int(year), int(month), int(day))
        except ValueError:
            return None

        # FARS doesn't specifically track AV status, so we'll include
        # all fatal crashes in states with AV operations for analysis
        state_name = self._state_code_to_name(crash.get("STATE"))

        return IncidentRecord(
            incident_type="collision",
            occurred_at=occurred_at,
            source="nhtsa_fars",
            external_id=f"fars_{year}_{case_number}",
            state=state_name,
            city=crash.get("CITY", ""),
            fatalities=int(crash.get("FATALS", 0) or 0),
            injuries=int(crash.get("PERSONS", 0) or 0)
            - int(crash.get("FATALS", 0) or 0),
            confidence_score=1.0,
            status="verified",
            raw_data=crash,
        )

    def _state_code_to_name(self, code: Optional[int]) -> str:
        """Convert FARS state code to state abbreviation."""
        state_codes = {
            1: "AL",
            2: "AK",
            4: "AZ",
            5: "AR",
            6: "CA",
            8: "CO",
            9: "CT",
            10: "DE",
            11: "DC",
            12: "FL",
            13: "GA",
            15: "HI",
            16: "ID",
            17: "IL",
            18: "IN",
            19: "IA",
            20: "KS",
            21: "KY",
            22: "LA",
            23: "ME",
            24: "MD",
            25: "MA",
            26: "MI",
            27: "MN",
            28: "MS",
            29: "MO",
            30: "MT",
            31: "NE",
            32: "NV",
            33: "NH",
            34: "NJ",
            35: "NM",
            36: "NY",
            37: "NC",
            38: "ND",
            39: "OH",
            40: "OK",
            41: "OR",
            42: "PA",
            44: "RI",
            45: "SC",
            46: "SD",
            47: "TN",
            48: "TX",
            49: "UT",
            50: "VT",
            51: "VA",
            53: "WA",
            54: "WV",
            55: "WI",
            56: "WY",
        }
        return state_codes.get(code, "")
