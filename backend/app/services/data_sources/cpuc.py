"""
California Public Utilities Commission (CPUC) Data Source.

Fetches AV deployment and pilot program quarterly reports.
Source: https://www.cpuc.ca.gov/regulatory-services/licensing/transportation-licensing-and-analysis-branch/autonomous-vehicle-programs/quarterly-reporting

The CPUC requires AV passenger service operators to submit quarterly reports including:
- Trip data
- Mileage data
- Incident data
- Stoppage events

Reports are available as Excel/CSV files.
"""

import re
from datetime import datetime
from typing import Any, Optional
import httpx
from bs4 import BeautifulSoup
import zipfile
import io

from .base import (
    DataSourceBase,
    DataSourceConfig,
    DataSourceType,
    TrustLevel,
    IncidentRecord,
)


class CPUCDataSource(DataSourceBase):
    """
    California CPUC AV Program quarterly reports data source.

    Fetches incident and operational data from CPUC quarterly reports.
    Data includes collisions, complaints, citations, and stoppage events.
    """

    BASE_URL = "https://www.cpuc.ca.gov"
    REPORTS_URL = "/regulatory-services/licensing/transportation-licensing-and-analysis-branch/autonomous-vehicle-programs/quarterly-reporting"

    def __init__(self):
        config = DataSourceConfig(
            name="California CPUC Quarterly Reports",
            source_type=DataSourceType.CPUC,
            trust_level=TrustLevel.OFFICIAL,
            base_url=self.BASE_URL,
            description="AV deployment program quarterly reports from CPUC",
            sync_frequency_hours=168,  # Weekly - quarterly reports
        )
        super().__init__(config)
        self._report_urls: list[dict[str, Any]] = []

    async def fetch_data(
        self, since: Optional[datetime] = None
    ) -> list[dict[str, Any]]:
        """
        Fetch CPUC quarterly report listings and metadata.

        Returns information about available reports including download URLs.
        Actual parsing of report contents would require downloading and
        processing the Excel/ZIP files.
        """
        reports = []

        async with httpx.AsyncClient(timeout=self.config.timeout_seconds) as client:
            try:
                self.logger.info("Fetching CPUC quarterly reports page...")
                response = await client.get(f"{self.BASE_URL}{self.REPORTS_URL}")
                response.raise_for_status()

                soup = BeautifulSoup(response.text, "html.parser")
                reports = self._extract_report_info(soup)
                self._report_urls = reports

            except httpx.HTTPError as e:
                self.logger.error(f"Failed to fetch CPUC page: {e}")

        # Filter by date if specified
        if since:
            reports = [
                r for r in reports if r.get("period_end") and r["period_end"] >= since
            ]

        self.logger.info(f"Found {len(reports)} CPUC quarterly reports")
        return reports

    def _extract_report_info(self, soup: BeautifulSoup) -> list[dict[str, Any]]:
        """Extract report information from the CPUC page."""
        reports = []

        # Find all download links
        for link in soup.find_all("a", href=True):
            href = link.get("href", "")
            text = link.get_text(strip=True)

            # Check if it's a report download link
            if not any(ext in href.lower() for ext in [".zip", ".xlsx", ".csv"]):
                continue

            # Skip template files
            if "template" in href.lower() or "dictionary" in href.lower():
                continue

            # Parse the report metadata
            report = self._parse_report_link(text, href)
            if report:
                reports.append(report)

        return reports

    def _parse_report_link(self, text: str, href: str) -> Optional[dict[str, Any]]:
        """
        Parse report metadata from link.

        Links typically look like:
        - "Waymo" or company name
        - "Download all reports"
        - Contains period info in URL like "2025q1", "sep-nov-2024", etc.
        """
        # Build full URL
        if not href.startswith("http"):
            href = f"{self.BASE_URL}{href}"

        # Try to extract company from text
        company = None
        known_companies = [
            "Waymo",
            "Cruise",
            "Zoox",
            "Aurora",
            "AutoX",
            "WeRide",
            "Tensor",
            "Motional",
            "Ghost",
            "Pony",
            "Argo",
        ]

        for c in known_companies:
            if c.lower() in text.lower():
                company = c
                break

        # Try to extract period from URL or text
        period_start = None
        period_end = None

        # Pattern: 2025q1, 2024q3, etc.
        match = re.search(r"(\d{4})q(\d)", href.lower())
        if match:
            year = int(match.group(1))
            quarter = int(match.group(2))
            period_start = datetime(year, (quarter - 1) * 3 + 1, 1)
            period_end = datetime(
                year,
                quarter * 3,
                28 if quarter * 3 == 2 else 30 if quarter * 3 in [4, 6, 9, 11] else 31,
            )

        # Pattern: sep-nov-2024, jun-aug-2024
        match = re.search(r"([a-z]{3})[-_]([a-z]{3})[-_](\d{4})", href.lower())
        if match:
            months = {
                "jan": 1,
                "feb": 2,
                "mar": 3,
                "apr": 4,
                "may": 5,
                "jun": 6,
                "jul": 7,
                "aug": 8,
                "sep": 9,
                "oct": 10,
                "nov": 11,
                "dec": 12,
            }
            start_month = months.get(match.group(1), 1)
            end_month = months.get(match.group(2), 12)
            year = int(match.group(3))
            period_start = datetime(year, start_month, 1)
            period_end = datetime(
                year,
                end_month,
                28 if end_month == 2 else 30 if end_month in [4, 6, 9, 11] else 31,
            )

        # Pattern: dec-2024, november-2024
        match = re.search(r"([a-z]+)[-_](\d{4})", href.lower())
        if match and not period_start:
            months = {
                "january": 1,
                "february": 2,
                "march": 3,
                "april": 4,
                "may": 5,
                "june": 6,
                "july": 7,
                "august": 8,
                "september": 9,
                "october": 10,
                "november": 11,
                "december": 12,
                "jan": 1,
                "feb": 2,
                "mar": 3,
                "apr": 4,
                "jun": 6,
                "jul": 7,
                "aug": 8,
                "sep": 9,
                "oct": 10,
                "nov": 11,
                "dec": 12,
            }
            month = months.get(match.group(1), None)
            if month:
                year = int(match.group(2))
                period_start = datetime(year, month, 1)
                period_end = datetime(
                    year,
                    month,
                    28 if month == 2 else 30 if month in [4, 6, 9, 11] else 31,
                )

        return {
            "company": company,
            "url": href,
            "text": text,
            "period_start": period_start,
            "period_end": period_end,
            "report_type": "deployment" if "deployment" in href.lower() else "pilot",
        }

    async def fetch_report_incidents(
        self, report_url: str, client: Optional[httpx.AsyncClient] = None
    ) -> list[dict[str, Any]]:
        """
        Download and parse a specific CPUC report for incidents.

        CPUC reports contain incident data in specific sheets/files:
        - Incidents-Locations
        - Incidents-Complaints
        """
        incidents = []

        should_close_client = client is None
        if client is None:
            client = httpx.AsyncClient(timeout=60)

        try:
            response = await client.get(report_url)
            response.raise_for_status()

            # If it's a ZIP file, extract and parse
            if ".zip" in report_url.lower():
                incidents = self._parse_zip_report(response.content)
            elif ".xlsx" in report_url.lower():
                # Would need openpyxl or pandas to parse Excel
                self.logger.info(f"Excel parsing not implemented for {report_url}")

        except Exception as e:
            self.logger.error(f"Failed to fetch/parse report: {e}")
        finally:
            if should_close_client:
                await client.aclose()

        return incidents

    def _parse_zip_report(self, zip_content: bytes) -> list[dict[str, Any]]:
        """Parse a ZIP file containing CPUC report CSVs."""
        incidents = []

        try:
            with zipfile.ZipFile(io.BytesIO(zip_content)) as zf:
                for filename in zf.namelist():
                    # Look for incident-related files
                    if any(
                        term in filename.lower()
                        for term in ["incident", "collision", "complaint"]
                    ):
                        if filename.endswith(".csv"):
                            with zf.open(filename) as f:
                                # Parse CSV
                                import csv

                                reader = csv.DictReader(
                                    io.TextIOWrapper(f, encoding="utf-8")
                                )
                                for row in reader:
                                    row["_source_file"] = filename
                                    incidents.append(row)
        except Exception as e:
            self.logger.error(f"Failed to parse ZIP: {e}")

        return incidents

    def parse_records(self, raw_data: list[dict[str, Any]]) -> list[IncidentRecord]:
        """
        Parse CPUC report metadata into IncidentRecords.

        Note: This parses the report listings, not the actual incident data.
        For actual incidents, use fetch_report_incidents() on specific reports.
        """
        # For now, we return empty as we're just tracking report availability
        # Full parsing would require downloading each report
        return []

    def get_available_reports(self) -> list[dict[str, Any]]:
        """Get list of available report URLs."""
        return self._report_urls


class CPUCIncidentParser:
    """
    Parser for CPUC incident data from downloaded reports.

    CPUC incident reports typically contain:
    - Collision reports
    - Complaint incidents
    - Citation incidents
    - Stoppage events
    """

    @staticmethod
    def parse_incident_csv(csv_data: list[dict[str, Any]]) -> list[IncidentRecord]:
        """
        Parse CPUC incident CSV data into IncidentRecords.

        CSV columns vary but typically include:
        - Date/Time
        - Location (lat/lon or address)
        - Category (collision, complaint, citation, stoppage)
        - Description/Notes
        """
        records = []

        for row in csv_data:
            try:
                # Try to extract date
                date_fields = ["Date", "Incident Date", "Report Date", "date"]
                date_str = None
                for field in date_fields:
                    if row.get(field):
                        date_str = row[field]
                        break

                if not date_str:
                    continue

                # Parse date
                occurred_at = None
                for fmt in ["%Y-%m-%d", "%m/%d/%Y", "%Y/%m/%d", "%d-%m-%Y"]:
                    try:
                        occurred_at = datetime.strptime(date_str.strip(), fmt)
                        break
                    except ValueError:
                        continue

                if not occurred_at:
                    continue

                # Determine category
                category = row.get("Category", row.get("Type", "")).lower()
                if "collision" in category or "crash" in category:
                    incident_type = "collision"
                elif "complaint" in category:
                    incident_type = "other"
                elif "stop" in category or "block" in category:
                    incident_type = "blockage"
                else:
                    incident_type = "other"

                # Extract location
                lat = row.get("Latitude", row.get("lat"))
                lon = row.get("Longitude", row.get("lon"))

                record = IncidentRecord(
                    incident_type=incident_type,
                    occurred_at=occurred_at,
                    source="cpuc",
                    external_id=f"cpuc_{occurred_at.strftime('%Y%m%d')}_{hash(str(row))}",
                    latitude=float(lat) if lat else None,
                    longitude=float(lon) if lon else None,
                    city=row.get("City", ""),
                    state="CA",
                    description=row.get("Notes", row.get("Description", "")),
                    confidence_score=1.0,
                    status="verified",
                    raw_data=row,
                )
                records.append(record)

            except Exception:
                continue

        return records


