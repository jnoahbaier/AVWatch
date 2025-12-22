# AV Watch MVP Development Plan

## 🎯 MVP Vision

**AV Watch** is a community-driven platform for autonomous vehicle accountability. The MVP will launch in **one Bay Area city** (likely San Francisco given existing AV operations and regulatory infrastructure).

### First Year Goals (from project spec)
- [ ] Launch MVP in one Bay Area city with AV operations
- [ ] Generate at least 1,000 validated user reports
- [ ] Integrate incident feed from at least one public NHTSA/CPUC/DMV data set
- [ ] Develop and publish research paper draft
- [ ] Present findings to at least one city transportation authority or AV operator

---

## 🏗️ Technical Architecture

### High-Level System Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────┐ │
│   │   Mobile Web    │    │   Desktop Web   │    │   Admin Dashboard       │ │
│   │   (PWA/React)   │    │   (React/Next)  │    │   (Internal Tools)      │ │
│   └────────┬────────┘    └────────┬────────┘    └────────────┬────────────┘ │
└────────────┼──────────────────────┼──────────────────────────┼──────────────┘
             │                      │                          │
             ▼                      ▼                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API GATEWAY                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                    REST API (FastAPI/Python)                        │   │
│   │   • /api/incidents      - Report & query incidents                  │   │
│   │   • /api/data           - Aggregated data & visualizations          │   │
│   │   • /api/auth           - User authentication                       │   │
│   │   • /api/admin          - Moderation & verification tools           │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
             │                      │                          │
             ▼                      ▼                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA LAYER                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────┐ │
│   │   PostgreSQL    │    │   Redis Cache   │    │   S3/Cloud Storage      │ │
│   │   (Primary DB)  │    │   (Sessions)    │    │   (Media uploads)       │ │
│   └─────────────────┘    └─────────────────┘    └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DATA INGESTION PIPELINE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────┐ │
│   │   NHTSA API     │    │   CPUC Reports  │    │   CA DMV Data           │ │
│   │   (Crash data)  │    │   (Quarterly)   │    │   (Permits/Testing)     │ │
│   └─────────────────┘    └─────────────────┘    └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend** | Next.js 14 + React 18 | SSR for SEO, PWA support, rapid development |
| **Styling** | Tailwind CSS + shadcn/ui | Modern, accessible component library |
| **Maps** | Mapbox GL JS or Leaflet | Interactive incident heatmaps |
| **Backend** | FastAPI (Python) | Async support, auto-docs, Python data ecosystem |
| **Database** | PostgreSQL + PostGIS | Geospatial queries, robust JSONB support |
| **Cache** | Redis | Session management, rate limiting |
| **Storage** | AWS S3 / Cloudflare R2 | Media uploads (photos/videos) |
| **Auth** | NextAuth.js or Clerk | Social login, magic links for accessibility |
| **Hosting** | Vercel (frontend) + Railway/Render (backend) | Cost-effective, auto-scaling |
| **Data Pipeline** | Apache Airflow or Prefect | Scheduled ingestion of public datasets |

---

## 📋 Feature Prioritization (MoSCoW)

### Must Have (MVP Core)
1. **Incident Reporting Form**
   - Geolocation (auto-detect + manual pin)
   - Incident type selector (collision, near-miss, sudden behavior, blockage, other)
   - Timestamp (auto + manual override)
   - Optional photo/video upload
   - AV company selector (Waymo, Cruise, Zoox, Tesla, Other)
   - Brief description field

2. **Public Incident Map**
   - Interactive map centered on Bay Area
   - Incident markers with clustering
   - Basic filters (date range, incident type, company)
   - Click-to-view incident details

3. **Data Aggregation Dashboard**
   - City-level overview statistics
   - Time-series charts (incidents over time)
   - Incident type breakdown
   - Company comparison view

4. **Public Data Integration**
   - NHTSA SGO crash data ingestion
   - Data normalization pipeline
   - Source attribution on incidents

### Should Have (Post-MVP v1.1)
- User accounts with submission history
- Report verification status (unverified, corroborated, verified)
- Email notifications for report updates
- Data export (CSV, JSON) for researchers
- Embeddable widgets for news organizations

### Could Have (v1.2+)
- Mobile native app (React Native)
- AI-assisted incident categorization
- CPUC quarterly report integration
- Crowdsourced photo verification
- API access for third-party developers

### Won't Have (Out of Scope)
- Real-time AV tracking
- Direct communication with AV operators
- Legal advice or claim filing
- Incident prediction algorithms

---

## 📅 Development Timeline (16 Weeks)

### Phase 1: Foundation (Weeks 1-4)
**Focus: Architecture, Core Backend, Database**

| Week | Tasks | Owner |
|------|-------|-------|
| 1 | Set up monorepo, CI/CD, dev environment | Noah |
| 1 | Finalize data model, ERD design | Noah |
| 1 | User research sessions (5-8 participants) | Evan |
| 2 | PostgreSQL + PostGIS setup | Noah |
| 2 | FastAPI boilerplate + core endpoints | Noah |
| 2 | Design system & component library | Monica |
| 3 | Incident CRUD API complete | Noah |
| 3 | S3 media upload pipeline | Noah |
| 3 | Wireframes for report flow + dashboard | Monica |
| 4 | Geolocation service integration | Noah |
| 4 | Initial frontend scaffolding (Next.js) | Monica |
| 4 | Literature review for research paper | Joshua |

**Phase 1 Deliverables:**
- [ ] Functioning API with incident endpoints
- [ ] Database with PostGIS spatial queries
- [ ] Media upload working
- [ ] Wireframes approved by team
- [ ] Dev environment documentation

### Phase 2: Core Features (Weeks 5-8)
**Focus: Frontend Development, Data Pipeline**

| Week | Tasks | Owner |
|------|-------|-------|
| 5 | Incident report form (frontend) | Monica |
| 5 | NHTSA data scraper/importer | Noah |
| 5 | Usability testing plan | Evan |
| 6 | Interactive map component | Monica |
| 6 | Data normalization pipeline | Noah |
| 6 | Policy framework analysis | Joshua |
| 7 | Dashboard statistics API | Noah |
| 7 | Dashboard UI implementation | Monica |
| 7 | Usability testing round 1 | Evan |
| 8 | Filtering & search functionality | Monica/Noah |
| 8 | Confidence interval labeling system | Noah |
| 8 | Design iterations based on feedback | Monica |

**Phase 2 Deliverables:**
- [ ] Fully functional report submission flow
- [ ] Interactive incident map with filters
- [ ] NHTSA data integrated
- [ ] Basic dashboard with charts
- [ ] Usability findings documented

### Phase 3: Polish & Testing (Weeks 9-12)
**Focus: Refinement, Security, Performance**

| Week | Tasks | Owner |
|------|-------|-------|
| 9 | Responsive design QA | Monica |
| 9 | Rate limiting, input validation | Noah |
| 9 | Accessibility audit (WCAG 2.1) | Monica/Evan |
| 10 | Performance optimization | Noah |
| 10 | Error handling & edge cases | Noah |
| 10 | Community outreach planning | Evan |
| 11 | Security audit & penetration testing | Noah |
| 11 | Beta testing with 10-20 users | Team |
| 11 | Documentation & onboarding guide | Evan |
| 12 | Bug fixes from beta feedback | Noah/Monica |
| 12 | Analytics integration (Plausible/Posthog) | Noah |
| 12 | Research paper draft sections | Joshua |

**Phase 3 Deliverables:**
- [ ] Production-ready security
- [ ] Performance benchmarks met (<3s load)
- [ ] Beta feedback incorporated
- [ ] Analytics dashboard
- [ ] Draft research sections

### Phase 4: Launch & Outreach (Weeks 13-16)
**Focus: Deployment, Community Building, Iteration**

| Week | Tasks | Owner |
|------|-------|-------|
| 13 | Production deployment | Noah |
| 13 | Launch marketing materials | Evan |
| 13 | Press outreach (local news) | Team |
| 14 | Community partner onboarding (WalkSF, SF Bike Coalition) | Evan |
| 14 | Monitor & respond to issues | Noah |
| 14 | Collect initial user feedback | Evan |
| 15 | Iterate based on real usage | Team |
| 15 | City official presentation prep | Team |
| 15 | Data export for researchers | Noah |
| 16 | Post-launch retrospective | Team |
| 16 | Roadmap planning for v1.1 | Team |
| 16 | Research paper finalization | Joshua |

**Phase 4 Deliverables:**
- [ ] Live production site
- [ ] 100+ initial reports (soft launch goal)
- [ ] Partnership with 1+ community org
- [ ] City presentation scheduled
- [ ] v1.1 roadmap defined

---

## 🗃️ Data Model (Core Entities)

### Incident Report

```sql
CREATE TABLE incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Core Fields
    incident_type VARCHAR(50) NOT NULL,  -- collision, near_miss, sudden_behavior, blockage, other
    av_company VARCHAR(50),               -- waymo, cruise, zoox, tesla, unknown
    description TEXT,
    
    -- Location (PostGIS)
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    address TEXT,
    city VARCHAR(100) DEFAULT 'San Francisco',
    
    -- Time
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
    reported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Reporter (optional for anonymity)
    reporter_id UUID REFERENCES users(id),
    reporter_type VARCHAR(50),  -- pedestrian, cyclist, driver, rider, other
    
    -- Verification
    status VARCHAR(20) DEFAULT 'unverified',  -- unverified, corroborated, verified, rejected
    confidence_score DECIMAL(3,2),
    
    -- Media
    media_urls JSONB DEFAULT '[]',
    
    -- Metadata
    source VARCHAR(50) DEFAULT 'user_report',  -- user_report, nhtsa, cpuc, dmv
    external_id VARCHAR(100),  -- for deduplication with public data
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Geospatial index for map queries
CREATE INDEX idx_incidents_location ON incidents USING GIST(location);

-- Efficient filtering
CREATE INDEX idx_incidents_occurred_at ON incidents(occurred_at);
CREATE INDEX idx_incidents_type ON incidents(incident_type);
CREATE INDEX idx_incidents_company ON incidents(av_company);
```

### User (Optional Registration)

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE,
    display_name VARCHAR(100),
    avatar_url TEXT,
    
    -- Reputation
    reports_count INT DEFAULT 0,
    verified_reports_count INT DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Data Sources

```sql
CREATE TABLE data_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,  -- NHTSA SGO, CPUC Quarterly, etc.
    url TEXT,
    last_synced_at TIMESTAMP WITH TIME ZONE,
    sync_frequency VARCHAR(20),  -- daily, weekly, monthly, quarterly
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 🔌 Public Data Sources

### 1. NHTSA Standing General Order (SGO) Data
- **URL**: https://www.nhtsa.gov/laws-regulations/standing-general-order-crash-reporting
- **Format**: CSV/JSON downloads
- **Frequency**: Monthly updates
- **Contains**: Crashes involving ADAS/ADS systems, fatalities, injuries
- **Integration**: Scheduled daily check for updates, parse and normalize

### 2. California DMV Autonomous Vehicle Reports
- **URL**: https://www.dmv.ca.gov/portal/vehicle-industry-services/autonomous-vehicles/
- **Format**: PDF reports, some structured data
- **Contains**: Collision reports, disengagement reports
- **Integration**: Annual/quarterly PDF parsing + manual review

### 3. CPUC Quarterly Reports
- **URL**: https://www.cpuc.ca.gov/regulatory-services/licensing/transportation-licensing-and-analysis-branch/autonomous-vehicle-programs/quarterly-reporting
- **Format**: Varies by company
- **Contains**: Trip data, citations, accessibility metrics
- **Integration**: Quarterly manual + automated extraction

### Data Normalization Schema

```python
# Unified incident format from any source
class NormalizedIncident:
    source: str                    # "nhtsa", "cpuc", "dmv", "user_report"
    source_id: str                 # Original ID from source
    incident_type: IncidentType    # Mapped to our categories
    severity: str                  # minor, moderate, severe, fatal
    av_company: str
    location: Point                # Lat/Lng
    occurred_at: datetime
    description: str
    fatalities: int
    injuries: int
    raw_data: dict                 # Original source data for audit
```

---

## 📊 Key Metrics & Analytics

### Product Metrics (Track from Day 1)
| Metric | Target (Year 1) | Measurement |
|--------|----------------|-------------|
| Total Reports | 1,000+ | Database count |
| Verified Reports | 30%+ of total | Status = verified/corroborated |
| Unique Reporters | 500+ | Distinct reporter sessions |
| Map Views | 10,000+ | Page analytics |
| Data Exports | 50+ | Download tracking |
| Media Attachments | 40%+ of reports | Reports with media |

### Technical Metrics
| Metric | Target | Tool |
|--------|--------|------|
| Page Load Time | <3s | Lighthouse |
| API Response Time | <200ms p95 | APM |
| Uptime | 99.5%+ | Monitoring |
| Error Rate | <1% | Sentry |

---

## 🚀 Getting Started Commands

```bash
# Clone and setup
git clone <repo-url>
cd avwatch

# Backend setup
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your values
alembic upgrade head  # Run migrations
uvicorn app.main:app --reload

# Frontend setup (new terminal)
cd frontend
npm install
cp .env.example .env.local
npm run dev

# Database (Docker)
docker-compose up -d postgres redis

# Run data pipeline
python -m app.pipelines.nhtsa_sync
```

---

## 📁 Suggested Project Structure

```
avwatch/
├── frontend/                    # Next.js application
│   ├── app/                     # App router pages
│   │   ├── page.tsx            # Homepage with map
│   │   ├── report/             # Incident reporting flow
│   │   ├── dashboard/          # Data visualization
│   │   └── api/                # Next.js API routes (if needed)
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── map/                # Map components
│   │   ├── forms/              # Report form components
│   │   └── charts/             # Dashboard visualizations
│   ├── lib/                    # Utilities, API client
│   └── public/                 # Static assets
│
├── backend/                     # FastAPI application
│   ├── app/
│   │   ├── main.py             # FastAPI app entry
│   │   ├── api/
│   │   │   ├── incidents.py    # Incident endpoints
│   │   │   ├── data.py         # Aggregation endpoints
│   │   │   └── auth.py         # Authentication
│   │   ├── models/             # SQLAlchemy models
│   │   ├── schemas/            # Pydantic schemas
│   │   ├── services/           # Business logic
│   │   ├── pipelines/          # Data ingestion
│   │   │   ├── nhtsa.py
│   │   │   ├── cpuc.py
│   │   │   └── dmv.py
│   │   └── core/               # Config, security, db
│   ├── alembic/                # Database migrations
│   ├── tests/
│   └── requirements.txt
│
├── data/                        # Raw data storage (gitignored)
│   ├── nhtsa/
│   ├── cpuc/
│   └── dmv/
│
├── docs/                        # Documentation
│   ├── MVP_PLAN.md             # This document
│   ├── API.md
│   └── research/               # Paper drafts
│
├── docker-compose.yml
├── .github/
│   └── workflows/              # CI/CD
└── README.md
```

---

## ⚠️ Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Low user adoption | Medium | High | Partner with WalkSF, SF Bike Coalition early; gamification |
| Spam/fake reports | Medium | Medium | Rate limiting, captcha, verification workflow |
| Legal pushback from AV companies | Low | High | Focus on public data + user experiences, not accusations |
| Data quality issues | Medium | Medium | Confidence intervals, corroboration from multiple sources |
| Scope creep | High | Medium | Strict MoSCoW adherence, weekly prioritization |
| Technical complexity | Low | Medium | Use proven tech, avoid over-engineering |

---

## 🤝 Stakeholder Engagement Plan

### Community Partners (Pre-Launch)
- **WalkSF** - Pedestrian advocacy
- **SF Bike Coalition** - Cyclist safety
- **Senior & Disability Action** - Accessibility concerns
- **Local neighborhood associations** - Hyperlocal feedback

### Government Contacts
- SFMTA (San Francisco Municipal Transportation Agency)
- CPUC Transportation Division
- SF Board of Supervisors (Transportation Committee)

### Academic Collaborators
- UC Berkeley Transportation Research
- Stanford HAI (Human-Centered AI)
- CMU Robotics Institute (Philip Koopman - cited in project)

---

## 📝 Next Steps (This Week)

1. **Set up repository and CI/CD** - Create GitHub repo with branch protection
2. **Initialize Next.js + FastAPI projects** - Basic scaffolding
3. **Design database schema** - Finalize ERD, create initial migrations
4. **Research NHTSA API access** - Understand data format and update frequency
5. **Schedule stakeholder interviews** - 3-5 community members, 1-2 city officials

---

*Last Updated: December 2024*
*Team: Noah Baier, Monica Paz Parra, Evan Haas, Joshua Mussman*
*Advisor: Dr. Morgan Ames, UC Berkeley School of Information*

