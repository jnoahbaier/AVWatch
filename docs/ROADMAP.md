# AV Watch — Product Roadmap

> Work through this incrementally. Check off items as they're completed. Sessions can pick up wherever the last one left off.

---

## Architecture Constraints (Read Before Building Anything)

- **Single scrollable page** — AVWatch is one page at `/`. Navigation scrolls to sections. No separate routes.
- The live site at avwatch.org is the reference: Hero → Report Form → About → Recent Incidents → News → Footer.
- **No map page, no dashboard page** — these are legacy routes (`/map`, `/dashboard`, `/bulletin`, `/news`, `/report`) that should not be developed further. The report form lives embedded in the homepage.
- If a map is added in the future, it will be a scroll section on the homepage, not a separate route.

---

## Phase 1 — Verify Core Infrastructure (Do First)

These confirm what's actually working before building on top of it.

- [x] **Reddit integration** — Verified working in production. Pulls from 6 subreddits (`waymo`, `SelfDrivingCars`, `robotaxi`, `sanfrancisco`, `bayarea`, `teslamotors`), 25 posts each. OAuth + RSS fallback. Gemini AI filters for relevance. Deduplicates by `external_id`. Refreshes hourly. Scope confirmed: covers vandalism, collisions, sudden behavior (e.g. "Tiktoker vandalizes Waymo mirrors", "Waymo leaves scene of freeway car flip").
- [x] **Report corroboration logic** — Fully implemented. 2-pass system runs every 30 min: Pass A boosts existing Reddit bulletin items when 2+ distinct-IP reports match; Pass B creates new community bulletin items from 3+ distinct-IP reports within 500m + 2hr window. IP deduplication prevents gaming.
- [x] **File uploads** — Live. Frontend uploads directly to Supabase Storage CDN (bypasses Railway). `uploadIncidentMedia()` validates type (JPG/PNG/WebP/GIF/HEIC/MP4/MOV/WebM) and size (photos ≤10 MB, videos ≤50 MB). URLs saved to `incident.media_urls` at submission time. Bucket: `incident-media` (public, 50 MB hard limit, anon upload + public read policies). Report form shows live upload progress.
- [x] **Stress test** — Verified in production. 20 concurrent users × 5 rounds: 0% error rate across all read endpoints. Rate limiting fires correctly at submission 6+ (429). All 5 validation edge cases (bad type, missing field, oversized description, out-of-range lat/lng, malformed JSON) return 422. p50 latency 317–541ms, p95 1.3–3.5s under load. DB connection pool tuned (pool_size=10, max_overflow=20). Test script: `backend/tests/stress_test.py`.
- [x] **Security hardening**
  - [x] Input sanitization / SQL injection prevention — Pydantic validation + SQLAlchemy ORM parameterized queries. No raw SQL.
  - [x] XSS protection on all user-submitted text fields — React escapes all user content by default; no `dangerouslySetInnerHTML` anywhere.
  - [x] IP-based rate limiting on report submission endpoint — 5 submissions / 10 min per IP. Blocked IPs rejected at submission time. Uses `X-Forwarded-For` behind Railway proxy. Tested + deployed to production.
  - [x] Auth hardening — Supabase RLS policies live on `bulletin_items` and `news_items`. Anon key is read-only; writes require service role.
  - [x] Review exposed API keys/secrets — Audit complete. All .env files properly gitignored. No hardcoded secrets in source. CI/CD uses GitHub Secrets. Backend secrets (GEMINI, DB, Reddit) server-only. Two client-exposed items: Supabase anon key (by design, now RLS-protected) and Mapbox token (public `pk.` token — needs domain-locking in Mapbox dashboard to prevent billing abuse).
  - [x] No hacker should be able to get into our database of reports — RLS enabled on `incidents` table. Anon: SELECT (non-rejected) + INSERT (user_report source only). UPDATE/DELETE blocked for all non-service_role callers. Contact fields (name/email) excluded from all public queries. `bulletin_items` and `news_items` already RLS-protected.

---

## Pre-Launch — Ad Campaign Readiness

- [x] **Analytics (PostHog)** — Lazy-loaded PostHog JS, key injected server-side via `AnalyticsScript` server component (uses `headers()` to force dynamic rendering so key is always live, never build-time baked). Tracks: `$pageview` on every visit + client-side navigation, `report_form_started` (first interaction), `report_media_attached` (file selected), `report_submitted` (with `incident_type`, `av_company`, `has_media`, `reporter_type` properties). UTM params (`utm_source`, `utm_medium`, `utm_campaign`) captured automatically by PostHog on every pageview. Env var: `POSTHOG_KEY` set in Vercel. Confirmed: POST 200 to `us.i.posthog.com/e/` in production.
- [x] **Open Graph / Twitter card meta tags** — Full OG block live: `siteName`, `url`, `locale`, `type`. Twitter card: `summary_large_image`. `metadataBase` set to `https://www.avwatch.org`. Robots: `index: true`, `follow: true`, `max-image-preview: large`. Custom 1200×630 OG image generated at edge runtime (`app/opengraph-image.tsx`): dark navy background, "AVWatch" headline, UC Berkeley badge, "Submit a report at avwatch.org" CTA. Verified sharp link previews on Reddit/Slack/iMessage.
- [x] **UTM tracking for ad campaigns** — Use `?utm_source=reddit&utm_medium=paid&utm_campaign=sf_launch` on all ad links pointing to avwatch.org. PostHog attributes pageviews and form submissions to the campaign automatically.

---

## Phase 2 — Strategic Reframe (High Urgency)

Shift AVWatch from "accountability watchdog" to "community platform" that helps make the technology safer and better for everyone. The user research shows people skew pro-AV. The platform should feel welcoming to enthusiasts, not just critics.

- [x] **Add new incident categories** to the report form:
  - Vehicle vandalism
  - (Keep existing: collision, near-miss, traffic violation, etc.)

---

## Phase 3 — Form UX Improvements (High Urgency)

- [x] **Add "I certify this is accurate" checkbox** — Must be checked before submit. Simple moral nudge, deters false reports.
- [x] **Update media upload Call To Action** — Change to "Choose photo / video" (instead of choose file) to reflect that both are accepted.
- [x] **Add optional contact fields** — Name + email, clearly marked optional. Enables follow-up and corroboration between reporters.
  - ✅ UI + DB migration complete. `contact_name` and `contact_email` columns added to `incidents` table. Visible to admins in report detail modal.

---

## Phase 4 — Post-Submit Flow (High Urgency)

Currently missing entirely. This is the highest-leverage moment to convert a one-time reporter into a return user.

- [x] **Build confirmation / thank-you screen** — Must include:
  - Thank you message
  - Brief explanation of what happens next (review process, how reports are used, shoudl have nice flowchart graph with arrows, easy to understand process)
  - Call To Action to view nearby recent reports
- [x] **Show nearby recent reports after submission** — "View Recent Incidents" CTA scrolls to `#reports` section on the homepage after submission.

---

## Phase 5 — Admin Dashboard

A private, internal-only view for the 4 team members to review, validate, and manage submitted reports.

- [x] **Auth** — Google SSO login. Allowlist of exactly 4 emails (team only). No one else can access: jnoah_baier@berkeley.edu, mppaz@berkeley.edu, joshua.mussman@berkeley.edu, evanhaas@berkeley.edu
- [x] **Reports queue** — Table/list of all submitted reports, sortable/filterable by: date, incident type, location, status (pending / validated / discarded).
- [x] **Per-report actions:**
  - Validate (marks report as credible, makes it eligible for map display / featured section)
  - Discard (removes from public view, with optional internal note). Ability to block ip addresses or flag addresses that are 'shitposting' or might be 'trolls'
  - Flag for corroboration (links two reports of the same incident, optionally intro-ing reporters if both opted in for contact)
- [x] **Settings page** — Manage allowlisted admin emails, toggle feature flags, view basic platform stats (total reports, reports this week, top incident types).
- [x] **Route protection** — Admin routes must be completely inaccessible to non-admins at both the UI and API/RLS level.

---

## Phase 6 — Trust & Credibility System (Medium Priority)

- [x] **Credibility threshold algorithm** — Already implemented. Automated: Pass A boosts Reddit items when 2+ distinct-IP reports corroborate (5+ = `is_hot`); Pass B creates community items from 3+ distinct-IP reports within 500m + 2hr (5+ = `is_hot`). Manual: admins can Validate / Discard / Corroborate any report. Status model: unverified → verified / rejected / corroborated.
- [ ] **Research FixItMarine's validation approach** — Understand their threshold-based or manual review model before finalizing ours.
- [x] **Hotspot heatmap** — Descoped. AV incidents (especially from Reddit/social) lack precise enough geocoding to make a heatmap trustworthy. Recent Incidents billboard serves this need instead.

---

## Phase 7 — Explore / Future (Lower Priority, Needs Discussion)

These need more scoping before implementation.

- [ ] **Corroboration feature** — Opt-in contact intro for reporters of the same incident (same time window + location). Especially valuable for users considering legal action. Design the opt-in carefully for privacy.
- [ ] **Badge / reputation system** — Bronze → Silver → Gold → Platinum → Diamond via Google login. Rewards consistent, validated contributions. No monetary incentives.
- [ ] **Waymo / AV company partnership angle** — Draft a one-pager for the advisor meeting. Getting companies to want our human-error report database is the legitimacy unlock. Frame around improving safety, not liability.
- [ ] **Study MyShake app** as a community-reporting precedent — how they handle trust and shitposting at scale.
- [ ] **Separate post-submit flows per reporter persona** — Passenger vs. bystander vs. cyclist vs. driver may have different motivations and follow-up needs. Build a quick persona matrix before designing this.

---

## Open Questions (Resolve Before Implementing Dependent Features)

| Question | Owner | Blocking |
|---|---|---|
| Does the backend support video uploads? | Evan / Joshua | Phase 3 media upload copy, Phase 1 file upload test |
| Where are uploaded files stored? (Supabase storage vs. S3) | Noah | Phase 6 privacy/legal design for corroboration |
| Should post-submit flows differ by reporter persona? | Full team | Phase 7 persona flows |
| ~~What are the 4 admin emails for the dashboard allowlist?~~ | ✅ Resolved: jnoah_baier, mppaz, joshua.mussman, evanhaas @berkeley.edu | Phase 5 admin auth |

---

*Last updated: 2026-03-24 — Pre-launch section added; Security hardening ✅; PostHog analytics ✅; OG meta tags ✅*
