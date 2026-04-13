# AV Watch — What We Built

> This document describes the actual shipped product. It supersedes the original pre-build MVP plan.

---

## What AVWatch Is

AVWatch is a **single-page community platform** at [avwatch.org](https://www.avwatch.org) that makes it as easy as possible to report an autonomous vehicle incident, aggregates related reports from Reddit, and surfaces a lightweight AV news feed. It is built by the UC Berkeley School of Information team.

The platform is intentionally lightweight. There is no map, no dashboard, no user accounts for the public, and no government data pipelines. The focus is:

1. **Submit a report in under a minute**
2. **See what other people are reporting**
3. **Read recent AV news**

---

## The Three Sections

### 1. Report Form (embedded on homepage)
- Auto-detects location via browser geolocation
- Selectors for AV company (Waymo, Zoox, Cruise, Tesla, Unknown) and incident type (Collision, Near Miss, Sudden Behavior, Blockage, Vandalism, Other)
- Free-text description
- Optional photo / video upload (stored on Supabase Storage CDN)
- Optional name + email for follow-up
- "I certify this is accurate" checkbox
- Post-submit confirmation screen with flowchart explaining what happens next

### 2. Recent Incidents (bulletin board)
Two types of cards appear here:

**Reddit-sourced cards** (blue border / external link)
- Hourly scraper pulls from `r/waymo`, `r/SelfDrivingCars`, `r/robotaxi`, `r/sanfrancisco`, `r/bayarea`, `r/teslamotors`
- Each post goes through Gemini 2.5 Flash: is this a real on-road incident? If yes, extract company, type, location, title, summary.
- Card links out to the original Reddit post
- Community user reports can "boost" a Reddit card if they corroborate it

**Community-sourced cards** (green banner / clickable modal)
- Created when 3+ reports from **distinct IP addresses** describe the same event (within 500m + 2 hours of each other)
- Gemini checks semantic similarity of descriptions before creating the card — prevents unrelated events near each other from merging
- Company and incident type derived by majority vote across the cluster
- Clicking the card opens a modal with a Gemini-generated neutral narrative synthesized from the reports
- Personal details are stripped from the narrative

### 3. News Feed
Lightweight feed of recent AV-related headlines on the homepage.

---

## Anti-Spam Architecture

| Layer | Mechanism |
|-------|-----------|
| Submission rate limit | 5 reports per IP per 10 minutes |
| IP hashing | SHA-256 at submission time — raw IP never stored |
| Admin IP blocking | Admins can block an IP hash from future submissions |
| Community card threshold | Requires 3 **distinct** IP hashes (null IPs share one bucket) |
| Semantic similarity | Gemini confirms cluster reports describe the same incident |

---

## Tech Stack (What's Actually Running)

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, Tailwind CSS |
| Backend | FastAPI (Python) on Railway |
| Database | PostgreSQL + PostGIS on Supabase |
| AI | Gemini 2.5 Flash — incident classification, semantic similarity, narrative generation |
| Media storage | Supabase Storage (public CDN bucket) |
| Frontend hosting | Vercel |
| Analytics | PostHog (pageviews, form events, UTM attribution) |

---

## What Was Cut

The original plan included features that were researched, scoped, and then descoped:

| Feature | Reason Cut |
|---------|-----------|
| Interactive incident map | AV incidents lack precise enough geocoding to be trustworthy on a map |
| Data dashboard (charts, heatmaps) | Not the most valuable use of the page for reporters |
| NHTSA / CA DMV / CPUC data pipelines | Not useful to public users; complex to maintain |
| Redis cache | Not needed at current scale |
| Public user accounts / login | Friction barrier; anonymous reporting gets more submissions |
| Embeddable widgets | Out of scope for v1 |

---

## Team

- **Noah Baier** — Backend & Infrastructure
- **Monica Paz Parra** — UX & Frontend
- **Evan Haas** — Product & User Research
- **Joshua Mussman** — Research Lead

**Advisor:** Dr. Morgan Ames, UC Berkeley School of Information

---

*Last updated: April 2026*
