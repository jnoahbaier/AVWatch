# AV Watch — Product Roadmap

> Tracks what's been built, what's in progress, and what's next. Check off items as completed.

---

## Architecture Constraints

- **Single scrollable page** — AVWatch is one page at `/`. Navigation scrolls to sections. No separate routes.
- The live site at avwatch.org is the reference: Hero → Report Form → About → Recent Incidents → News → Footer.
- **No map page, no dashboard page** — the report form and bulletin board live embedded on the homepage.
- No NHTSA / CA DMV / CPUC data pipelines — these were descoped. The platform focuses on community reports and Reddit aggregation.

---

## Launched (v1.0)

### Core Infrastructure
- [x] **Report submission** — Embedded form on homepage. Geolocation auto-fill, AV company + incident type selector, optional photo/video upload (Supabase Storage CDN), optional contact fields. No account required.
- [x] **Reddit aggregation** — Hourly pipeline scrapes 6 subreddits (`waymo`, `SelfDrivingCars`, `robotaxi`, `sanfrancisco`, `bayarea`, `teslamotors`). Gemini 2.5 Flash filters for real on-road incidents and extracts company, type, location, and summary. Deduplicates by `external_id`.
- [x] **Community corroboration** — 2-pass clustering service runs every 30 min:
  - Pass A: 2+ distinct-IP user reports matching a Reddit card boost its signal count
  - Pass B: 3+ distinct-IP reports within 500m + 2hr window → new community bulletin card. Gemini semantic similarity check confirms reports describe the same event. Company/type derived by majority vote across the cluster.
- [x] **Gemini narrative** — Community cards are clickable and open a modal with a Gemini-generated neutral summary of the underlying reports. Personal details are stripped.
- [x] **News section** — Lightweight AV news feed on the homepage.
- [x] **IP anti-spam** — SHA-256 IP hashing at submission. Rate limit: 5 reports/10 min per IP. Null-IP reports share one bucket (can't bypass the 3-IP threshold by submitting without a captured IP).

### Admin Dashboard (avwatch.org/admin/dashboard)
- [x] Google SSO login, restricted to 4 berkeley.edu team emails
- [x] Reports queue — filterable by status, type, date
- [x] Per-report actions: Validate, Discard (+ optional IP block), Link (corroborate)
- [x] Color-coded IP chips — same IP = same color, duplicate count badge (×N) makes spam instantly visible
- [x] Settings page — manage admin allowlist, view platform stats

### Security & Performance
- [x] Pydantic input validation + SQLAlchemy ORM (no raw SQL)
- [x] Supabase RLS — anon key is read-only, writes require service role
- [x] PostHog analytics + UTM tracking for ad campaigns
- [x] Open Graph / Twitter card meta tags + custom OG image
- [x] Stress tested: 20 concurrent users × 5 rounds, 0% error rate

---

## Near-Term (v1.1)

- [ ] **IP hashing for all existing reports** — Most legacy reports have `reporter_ip_hash = NULL` because they predate the field. Run a backfill or surface a note in admin for null-IP reports.
- [ ] **Corroboration opt-in** — Let reporters opt in to be introduced to others who reported the same incident (same time + location window). Useful for people considering follow-up action.
- [ ] **Badge / reputation system** — Bronze → Silver → Gold via report history. Rewards consistent, validated contributions.

---

## Future (Needs Discussion)

- [ ] **Mobile native app** — React Native shell exists in `/mobile`. Needs scoping.
- [ ] **Waymo / AV company partnership** — One-pager for advisor meeting. Getting companies to use the human-error report database is a legitimacy unlock.
- [ ] **Study MyShake app** — Community-reporting precedent for handling trust at scale.
- [ ] **Persona-specific post-submit flows** — Passenger vs. bystander vs. cyclist may have different follow-up needs.
- [ ] **Map section on homepage** — If added, it will be a scroll section on the homepage, not a separate route.

---

## Descoped (Won't Build)

- NHTSA / CA DMV / CPUC data ingestion pipelines
- Standalone incident map page (`/map`)
- Data dashboard page (`/dashboard`)
- Redis cache layer
- User accounts / login for public reporters
- Real-time AV tracking
- Legal advice or claim filing

---

*Last updated: April 2026 — v1.0 launched*
