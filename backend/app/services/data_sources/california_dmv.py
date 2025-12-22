"""
California DMV Autonomous Vehicle Collision Reports Data Source.

Fetches and parses AV collision reports from the California DMV.
Source: https://www.dmv.ca.gov/portal/vehicle-industry-services/autonomous-vehicles/autonomous-vehicle-collision-reports/

Note: The CA DMV provides collision reports as individual PDF files.
This module scrapes the report listings and extracts metadata.
For full parsing of PDF content, additional PDF processing would be needed.
"""

import re
from datetime import datetime
from typing import Any, Optional
import httpx
from bs4 import BeautifulSoup

from .base import (
    DataSourceBase,
    DataSourceConfig,
    DataSourceType,
    TrustLevel,
    IncidentRecord,
)


class CaliforniaDMVDataSource(DataSourceBase):
    """
    California DMV AV Collision Reports data source.

    The CA DMV requires manufacturers testing AVs to report any collision
    within 10 days. Reports are published as PDFs on the DMV website.

    This source extracts metadata from the report listings:
    - Company name
    - Date of collision
    - Report URL
    """

    BASE_URL = "https://www.dmv.ca.gov"
    REPORTS_URL = "/portal/vehicle-industry-services/autonomous-vehicles/autonomous-vehicle-collision-reports/"

    def __init__(self):
        config = DataSourceConfig(
            name="California DMV AV Reports",
            source_type=DataSourceType.CA_DMV,
            trust_level=TrustLevel.OFFICIAL,
            base_url=self.BASE_URL,
            description="AV collision reports from California DMV (OL 316 forms)",
            sync_frequency_hours=24,
        )
        super().__init__(config)

    async def fetch_data(
        self, since: Optional[datetime] = None
    ) -> list[dict[str, Any]]:
        """
        Fetch collision report listings from CA DMV website.

        Scrapes the DMV page to extract report metadata from the PDF listings.
        """
        reports = []

        async with httpx.AsyncClient(timeout=self.config.timeout_seconds) as client:
            try:
                self.logger.info("Fetching CA DMV collision reports page...")
                response = await client.get(f"{self.BASE_URL}{self.REPORTS_URL}")
                response.raise_for_status()

                # Parse the HTML
                soup = BeautifulSoup(response.text, "html.parser")
                reports = self._extract_reports_from_html(soup)

            except httpx.HTTPError as e:
                self.logger.error(f"Failed to fetch CA DMV page: {e}")

        # Filter by date if specified
        if since:
            reports = [r for r in reports if r.get("date") and r["date"] >= since]

        self.logger.info(f"Found {len(reports)} collision reports from CA DMV")
        return reports

    def _extract_reports_from_html(self, soup: BeautifulSoup) -> list[dict[str, Any]]:
        """Extract report metadata from HTML content."""
        reports = []

        # Find all PDF links - they're typically in accordion sections by year
        # Structure: Link text like "Waymo December 4, 2025 (PDF)"

        for link in soup.find_all("a", href=True):
            href = link.get("href", "")
            text = link.get_text(strip=True)

            # Check if it's a PDF link
            if ".pdf" not in href.lower() and "pdf" not in text.lower():
                continue

            # Skip non-collision report PDFs
            if "ol-316" in href.lower() or "form" in href.lower():
                continue

            # Parse the report info from the link text
            report = self._parse_report_link(text, href)
            if report:
                reports.append(report)

        return reports

    def _parse_report_link(self, text: str, href: str) -> Optional[dict[str, Any]]:
        """
        Parse report metadata from link text.

        Expected formats:
        - "Waymo December 4, 2025 (PDF)"
        - "Zoox November 25, 2025 (PDF)"
        - "Mercedes-Benz February 7, 2025 (PDF)"
        - "Waymo November 24, 2025 (2) (PDF)"  # Multiple reports same day
        """
        # Clean up the text
        text = text.strip()
        text = re.sub(r"\s*\(PDF\)\s*$", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*\(\d+\)\s*$", "", text)  # Remove (2), (3) etc
        text = text.strip()

        if not text:
            return None

        # Try to parse company and date
        # Pattern: Company Name Month Day, Year
        # Some variations: Company Month Day Year (no comma)

        # Known company patterns
        company_patterns = [
            r"^(Waymo)",
            r"^(Zoox)",
            r"^(Cruise)",
            r"^(Tesla)",
            r"^(Nuro)",
            r"^(Aurora)",
            r"^(Pony\.?ai)",
            r"^(AutoX)",
            r"^(WeRide\s*(?:Corp)?)",
            r"^(Apple)",
            r"^(Mercedes[- ]?Benz)",
            r"^(Mercedes)",
            r"^(Ghost\s*Autonomy(?:\s*Inc)?)",
            r"^(Beep\s*Inc)",
            r"^(Motional)",
            r"^(May\s*Mobility)",
            r"^(Woven(?:\s*(?:by\s*Toyota|Planet))?)",
            r"^(Argo\s*AI)",
            r"^(Tensor)",
            r"^(Ohmio)",
            r"^(GM\s*Cruise)",
            r"^(Google)",
            r"^(Delphi)",
            r"^(Lyft)",
            r"^(Apollo\s*(?:Autonomous\s*Driving)?)",
        ]

        company = None
        date_part = text

        for pattern in company_patterns:
            match = re.match(pattern, text, re.IGNORECASE)
            if match:
                company = match.group(1)
                date_part = text[match.end() :].strip()
                break

        if not company:
            # Try splitting on first capital letter after start
            parts = re.split(r"(?=[A-Z][a-z]+\s+\d)", text, maxsplit=1)
            if len(parts) == 2:
                company = parts[0].strip()
                date_part = parts[1].strip()

        if not company:
            return None

        # Parse the date
        date = self._parse_date(date_part)
        if not date:
            # Try the full text
            date = self._parse_date(text)

        if not date:
            return None

        # Build full URL
        if not href.startswith("http"):
            href = f"{self.BASE_URL}{href}"

        return {
            "company": company.strip(),
            "date": date,
            "url": href,
            "original_text": text,
        }

    def _parse_date(self, text: str) -> Optional[datetime]:
        """Parse date from text."""
        # Month December 4, 2025 format
        match = re.search(r"(\w+)\s+(\d{1,2}),?\s+(\d{4})", text)
        if match:
            month_str, day, year = match.groups()
            try:
                return datetime.strptime(f"{month_str} {day} {year}", "%B %d %Y")
            except ValueError:
                pass

        # Just Month Year format
        match = re.search(r"(\w+)\s+(\d{4})", text)
        if match:
            month_str, year = match.groups()
            try:
                return datetime.strptime(f"{month_str} 1 {year}", "%B %d %Y")
            except ValueError:
                pass

        return None

    def parse_records(self, raw_data: list[dict[str, Any]]) -> list[IncidentRecord]:
        """Parse scraped report data into IncidentRecords."""
        records = []

        for report in raw_data:
            try:
                record = self._parse_report(report)
                if record:
                    records.append(record)
            except Exception as e:
                self.logger.warning(f"Failed to parse report: {e}")

        return records

    def _parse_report(self, report: dict[str, Any]) -> Optional[IncidentRecord]:
        """Parse a single report into an IncidentRecord."""
        company = report.get("company")
        date = report.get("date")
        url = report.get("url")

        if not all([company, date, url]):
            return None

        # Generate external ID from company and date
        date_str = date.strftime("%Y%m%d")
        external_id = f"ca_dmv_{company.lower().replace(' ', '_')}_{date_str}"

        # Normalize company name
        normalized_company = self.normalize_company_name(company)

        # Build description
        description = (
            f"CA DMV OL 316 collision report for {company}. "
            f"Full report available at: {url}"
        )

        return IncidentRecord(
            incident_type="collision",  # All OL 316 forms are collision reports
            occurred_at=date,
            source="ca_dmv",
            external_id=external_id,
            state="CA",
            av_company=normalized_company,
            description=description,
            confidence_score=1.0,
            status="verified",
            raw_data=report,
        )


class CaliforniaDMVDisengagementSource(DataSourceBase):
    """
    California DMV Disengagement Reports data source.

    Fetches annual disengagement reports from CA DMV.
    Source: https://www.dmv.ca.gov/portal/vehicle-industry-services/autonomous-vehicles/disengagement-reports/

    Note: These are annual summary reports, not individual incidents.
    """

    BASE_URL = "https://www.dmv.ca.gov"
    REPORTS_URL = (
        "/portal/vehicle-industry-services/autonomous-vehicles/disengagement-reports/"
    )

    def __init__(self):
        config = DataSourceConfig(
            name="California DMV Disengagement Reports",
            source_type=DataSourceType.CA_DMV,
            trust_level=TrustLevel.OFFICIAL,
            base_url=self.BASE_URL,
            description="Annual AV disengagement reports from California DMV",
            sync_frequency_hours=168,  # Weekly - annual reports
        )
        super().__init__(config)

    async def fetch_data(
        self, since: Optional[datetime] = None
    ) -> list[dict[str, Any]]:
        """Fetch disengagement report listings."""
        reports = []

        async with httpx.AsyncClient(timeout=self.config.timeout_seconds) as client:
            try:
                response = await client.get(f"{self.BASE_URL}{self.REPORTS_URL}")
                response.raise_for_status()

                soup = BeautifulSoup(response.text, "html.parser")
                # Extract PDF links for disengagement reports
                for link in soup.find_all("a", href=True):
                    href = link.get("href", "")
                    text = link.get_text(strip=True)

                    if ".pdf" in href.lower() or ".xlsx" in href.lower():
                        reports.append(
                            {
                                "text": text,
                                "url": href
                                if href.startswith("http")
                                else f"{self.BASE_URL}{href}",
                                "type": "disengagement",
                            }
                        )

            except httpx.HTTPError as e:
                self.logger.error(f"Failed to fetch disengagement reports: {e}")

        return reports

    def parse_records(self, raw_data: list[dict[str, Any]]) -> list[IncidentRecord]:
        """
        Note: Disengagement reports are summary data, not individual incidents.
        This returns empty as disengagements aren't incidents per se.
        The data can still be used for mileage and testing statistics.
        """
        return []
