# Autonomous Vehicle Data Sources

This document describes all official data sources integrated into AVWatch2 for tracking autonomous vehicle incidents.

## Overview

AVWatch2 aggregates incident data from multiple trusted government sources to provide comprehensive coverage of autonomous vehicle safety incidents in the United States.

## Tier 1: Official Government Sources (Highest Trust)

### 1. NHTSA Standing General Order (SGO)
**Trust Level:** Official Federal Government
**Update Frequency:** Monthly (or more frequent)

The National Highway Traffic Safety Administration's Standing General Order mandates crash reporting for vehicles equipped with ADS (Automated Driving Systems) or Level 2 ADAS (Advanced Driver Assistance Systems).

**Data Available:**
- ADS Incident Reports: Full autonomous driving system crashes
- ADAS Incident Reports: Level 2 driver assist system incidents
- Includes: company, vehicle info, location (state/city), date, injury/fatality data, narrative

**API/Data Access:**
- ADS CSV: `https://static.nhtsa.gov/odi/ffdd/sgo-2021-01/SGO-2021-01_Incident_Reports_ADS.csv`
- ADAS CSV: `https://static.nhtsa.gov/odi/ffdd/sgo-2021-01/SGO-2021-01_Incident_Reports_ADAS.csv`
- Other CSV: `https://static.nhtsa.gov/odi/ffdd/sgo-2021-01/SGO-2021-01_Incident_Reports_OTHER.csv`

**Documentation:** https://www.nhtsa.gov/laws-regulations/standing-general-order-crash-reporting

---

### 2. NHTSA Complaints API
**Trust Level:** Official Federal Government
**Update Frequency:** Daily

Consumer complaints about vehicle safety issues reported to NHTSA.

**Data Available:**
- Consumer-reported safety issues
- Crash and injury information
- Vehicle details (make, model, year)
- Narrative descriptions

**API Endpoint:**
```
GET https://api.nhtsa.gov/complaints/complaintsByVehicle?make={make}&model={model}&modelYear={year}
```

**Documentation:** https://www.nhtsa.gov/nhtsa-datasets-and-apis#complaints

---

### 3. NHTSA Recalls API
**Trust Level:** Official Federal Government
**Update Frequency:** Daily

Vehicle recall information, including AV/ADAS-related safety recalls.

**API Endpoint:**
```
GET https://api.nhtsa.gov/recalls/recallsByVehicle?make={make}&model={model}&modelYear={year}
```

**Documentation:** https://www.nhtsa.gov/nhtsa-datasets-and-apis#recalls

---

### 4. NHTSA FARS (Fatality Analysis Reporting System)
**Trust Level:** Official Federal Government
**Update Frequency:** Annual (with monthly updates)

Census of all fatal motor vehicle crashes in the United States.

**API Endpoint:**
```
GET https://crashviewer.nhtsa.dot.gov/CrashAPI/crashes/GetCaseList?states={state}&fromYear={year}&toYear={year}&format=json
```

**Documentation:** https://crashviewer.nhtsa.dot.gov/CrashAPI

---

### 5. California DMV AV Collision Reports
**Trust Level:** Official State Government
**Update Frequency:** Within 10 days of incident

California requires AV testing companies to report all collisions within 10 days using form OL 316.

**Data Available:**
- All AV testing collisions in California
- Company, date, vehicle info
- Individual PDF reports with detailed narratives

**Source URL:** https://www.dmv.ca.gov/portal/vehicle-industry-services/autonomous-vehicles/autonomous-vehicle-collision-reports/

**Current Count:** 902+ reports (as of December 2025)

**Companies Reporting:**
- Waymo (most reports)
- Zoox
- Cruise
- Tesla
- Nuro
- Pony.ai
- Aurora
- Apple
- Mercedes-Benz
- WeRide
- AutoX
- Others

---

### 6. California CPUC Quarterly Reports
**Trust Level:** Official State Government
**Update Frequency:** Quarterly

California Public Utilities Commission requires quarterly reporting from AV passenger service operators.

**Data Available:**
- Trip data (miles traveled, occupancy)
- Incident reports (collisions, complaints, citations)
- Stoppage events
- Mileage statistics

**Source URL:** https://www.cpuc.ca.gov/regulatory-services/licensing/transportation-licensing-and-analysis-branch/autonomous-vehicle-programs/quarterly-reporting

**Reporting Companies:**
- Waymo (Deployment)
- Zoox (Pilot)
- Aurora (Pilot)
- AutoX (Pilot)
- WeRide (Pilot)

---

## Tier 2: Academic/Research Sources

### UC Berkeley TIMS AV Safety Dashboard
**Trust Level:** Academic Research
**Source:** Transportation Injury Mapping System

Aggregates CA DMV data with visualizations and analysis.

**URL:** https://tims.berkeley.edu/tools/avsafety.php
**Dashboard:** https://experience.arcgis.com/experience/1b9086155cda48d697bf40ec67962196

---

## Data Integration

### Sync Schedule
| Source | Frequency | Typical Data Volume |
|--------|-----------|---------------------|
| NHTSA SGO | Daily | ~1,500 records total |
| NHTSA Complaints | Daily | Varies by search criteria |
| NHTSA Recalls | Daily | ~50-100 AV-related |
| CA DMV | Daily | ~900+ collision reports |
| CPUC | Weekly | Quarterly report files |

### API Endpoints

**List Available Sources:**
```
GET /api/data-sync/sources
```

**Trigger Full Sync:**
```
POST /api/data-sync/sync
{
  "sources": null,  // null = all sources
  "since_days": 30  // optional: last N days
}
```

**Sync Single Source:**
```
POST /api/data-sync/sync/{source_name}
```
Valid source names: `nhtsa_sgo`, `nhtsa_complaints`, `nhtsa_recalls`, `ca_dmv`, `cpuc`

**Check Sync Status:**
```
GET /api/data-sync/status
```

**Preview Source Data:**
```
GET /api/data-sync/preview/{source_name}?limit=10
```

---

## Data Schema

All sources are normalized to a common incident schema:

```typescript
interface Incident {
  id: string;
  incident_type: 'collision' | 'near_miss' | 'sudden_behavior' | 'blockage' | 'other';
  occurred_at: datetime;
  source: string;  // e.g., 'nhtsa_sgo', 'ca_dmv', 'cpuc'
  external_id: string;  // Original ID from source
  
  // Location
  latitude?: number;
  longitude?: number;
  address?: string;
  city?: string;
  state?: string;
  
  // Details
  av_company?: string;  // Normalized: 'waymo', 'cruise', 'zoox', etc.
  description?: string;
  injuries: number;
  fatalities: number;
  
  // Verification
  confidence_score: number;  // 0-1, official sources = 1.0
  status: 'verified' | 'unverified';
  
  // Metadata
  raw_data: object;  // Original data from source
  reported_at?: datetime;
  created_at: datetime;
  updated_at: datetime;
}
```

---

## Adding New Data Sources

To add a new data source:

1. Create a new file in `backend/app/services/data_sources/`
2. Extend `DataSourceBase` class
3. Implement `fetch_data()` and `parse_records()` methods
4. Add to `__init__.py` exports
5. Register in `DataSyncService.sources` list

Example:
```python
from .base import DataSourceBase, DataSourceConfig, DataSourceType, TrustLevel

class NewDataSource(DataSourceBase):
    def __init__(self):
        config = DataSourceConfig(
            name="New Source Name",
            source_type=DataSourceType.NHTSA_SGO,  # or create new type
            trust_level=TrustLevel.OFFICIAL,
            base_url="https://example.com",
            description="Description of the source",
        )
        super().__init__(config)
    
    async def fetch_data(self, since=None):
        # Fetch raw data from source
        pass
    
    def parse_records(self, raw_data):
        # Convert to IncidentRecord objects
        pass
```

---

## Future Data Sources to Consider

1. **Arizona DOT** - AV testing program data
2. **Texas DMV** - AV operational data
3. **Nevada DMV** - AV license holder reports
4. **NTSB** - National Transportation Safety Board investigations
5. **Insurance claim databases** - Industry data
6. **News aggregation** - For emerging incidents

---

## References

- NHTSA: https://www.nhtsa.gov/
- CA DMV: https://www.dmv.ca.gov/portal/vehicle-industry-services/autonomous-vehicles/
- CPUC: https://www.cpuc.ca.gov/regulatory-services/licensing/transportation-licensing-and-analysis-branch/autonomous-vehicle-programs/
- SAE Levels: https://www.sae.org/standards/content/j3016_202104

