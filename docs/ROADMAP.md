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

- [ ] **Reddit integration** — Confirm recent AV reports are being pulled correctly. Verify scope covers not just AV wrongdoing but also: vandalism of AVs, human driver errors near AVs, crashes of all kinds. Check how often it refreshes and whether deduplication works.
- [ ] **Report corroboration logic** — Verify that when 3+ users file reports of a similar incident (seems to be same location/time window), the incident surfaces in the "Recent Reports" section. Trace the full logic end-to-end.
- [ ] **File uploads** — Confirm the backend accepts both photos AND video. Clarify where files are stored (Supabase storage? S3?). Document this for the team.
- [ ] **Stress test** — Simulate high concurrent report submissions. Test edge cases: duplicate submissions, large file uploads, malformed inputs, missing required fields.
- [ ] **Security hardening**
  - [ ] Input sanitization / SQL injection prevention
  - [ ] XSS protection on all user-submitted text fields
  - [x] IP-based rate limiting on report submission endpoint — 5 submissions / 10 min per IP. Blocked IPs are also rejected at submission time.
  - [x] Auth hardening — Supabase RLS policies written for `bulletin_items` and `news_items` (`backend/scripts/supabase-rls.sql`). Run in Supabase SQL Editor to activate.
  - [ ] Review any exposed API keys or secrets in client-side code
  - [ ] No hacker should be able to get into our database of reports 

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

- [ ] **Define credibility threshold algorithm** — Proposed starting model: 3+ corroborating reports + media attached = "high credibility" → eligible for featured/billboard display. Refine with team.
- [ ] **Research FixItMarine's validation approach** — Understand their threshold-based or manual review model before finalizing ours.
- [ ] **Surface AV-abuse hotspots on map** — Heatmap layer for vandalism/obstruction incidents. Specific SF streets known for high vandalism could be a compelling feature.

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

*Last updated: 2026-03-24*
