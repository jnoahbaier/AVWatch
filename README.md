# AV Watch

**A Community Platform for Autonomous Vehicle Accountability**

AV Watch makes it easy for pedestrians, cyclists, drivers, and riders to report autonomous vehicle incidents — and aggregates related reports from Reddit and the broader web into a single, lightweight feed. Built by the UC Berkeley School of Information.

Live at [avwatch.org](https://www.avwatch.org)

---

## What It Does

AVWatch is a single-page site with three core functions:

1. **Report** — A simple embedded form lets anyone submit an AV incident in under a minute. Geolocation auto-fills your location. Optional photo/video upload. No account required.

2. **Recent Incidents** — A bulletin board showing the most credible recent incidents, sourced from two places:
   - **Reddit** — Hourly scraper pulls from 6 subreddits (`waymo`, `SelfDrivingCars`, `robotaxi`, `sanfrancisco`, `bayarea`, `teslamotors`). Gemini AI filters for real on-road incidents and extracts structured data (company, type, location, summary).
   - **Community** — When 3+ reports from distinct IP addresses describe the same event (within 500m and 2 hours), a community bulletin card is automatically created. Gemini synthesizes the reports into a neutral summary.

3. **News** — A lightweight feed of recent AV-related news headlines.

---

## Anti-Spam & Trust

- IP hashing at submission time (SHA-256, never raw IP stored)
- Rate limiting: max 5 submissions per IP per 10 minutes
- Community cards require 3+ **distinct** IP addresses describing the same event
- Gemini semantic similarity check confirms reports describe the same incident before a card is created
- Admin dashboard for the team to validate, discard, or flag reports

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, Tailwind CSS |
| Backend | FastAPI (Python), PostgreSQL + PostGIS |
| AI | Gemini 2.5 Flash (incident classification + narrative generation) |
| Storage | Supabase (DB + media uploads) |
| Hosting | Vercel (frontend) + Railway (backend) |
| Analytics | PostHog |

---

## Project Structure

```
avwatch/
├── frontend/      # Next.js 14 app (single-page, avwatch.org)
├── backend/       # FastAPI Python API (Railway)
├── docs/          # Documentation
└── mobile/        # React Native app (future)
```

---

## Local Development

```bash
# Frontend
cd frontend
npm install
cp .env.example .env.local   # fill in Supabase + backend URL
npm run dev                  # http://localhost:3000

# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env         # fill in DB + Gemini + Reddit keys
uvicorn app.main:app --reload
```

---

## Team

- **Noah Baier** — Backend & Infrastructure
- **Monica Paz Parra** — UX & Frontend
- **Evan Haas** — Product & User Research
- **Joshua Mussman** — Research Lead

**Advisor:** Dr. Morgan Ames, UC Berkeley School of Information

---

*Built at UC Berkeley School of Information*
