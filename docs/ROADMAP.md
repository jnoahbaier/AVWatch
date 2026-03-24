# AV Watch — Product Roadmap

> Work through this incrementally. Check off items as they're completed. Sessions can pick up wherever the last one left off.

---

## Phase 1 — Verify Core Infrastructure (Do First)

These confirm what's actually working before building on top of it.

- [ ] **Reddit integration** — Confirm recent AV reports are being pulled correctly. Verify scope covers not just AV wrongdoing but also: vandalism of AVs, human driver errors near AVs, positive AV behavior, crashes of all kinds. Check how often it refreshes and whether deduplication works.
- [ ] **Report corroboration logic** — Verify that when 3+ users file reports of a similar incident (same location/time window), the incident surfaces in the "Recent Reports" section. Trace the full logic end-to-end.
- [ ] **File uploads** — Confirm the backend accepts both photos AND video. Clarify where files are stored (Supabase storage? S3?). Document this for the team.
- [ ] **Stress test** — Simulate high concurrent report submissions. Test edge cases: duplicate submissions, large file uploads, malformed inputs, missing required fields.
- [ ] **Security hardening**
  - [ ] Input sanitization / SQL injection prevention
  - [ ] XSS protection on all user-submitted text fields
  - [ ] IP-based rate limiting on report submission endpoint (flag/block IPs with abnormally high submission volume)
  - [ ] Auth hardening — review Supabase Row Level Security (RLS) policies
  - [ ] Review any exposed API keys or secrets in client-side code

---

## Phase 2 — Strategic Reframe (High Urgency)

Shift AVWatch from "accountability watchdog" to "community stewardship platform." The user research shows people skew pro-AV. The platform should feel welcoming to enthusiasts, not just critics.

- [ ] **Add new incident categories** to the report form:
  - Noteworthy positive AV behavior
  - Vehicle vandalism / obstruction of AV
  - Human driver error near AV
  - (Keep existing: collision, near-miss, traffic violation, etc.)
- [ ] **Rewrite homepage copy** — Replace "hold companies accountable" framing with "help make the technology better." Neutral/positive tone throughout. Full copy pass on `avwatch.org`.
- [ ] **Rewrite report form header copy** — Reflect expanded scope. Make reporting a Waymo vandalism feel just as natural as reporting a collision.
- [ ] **Restrict location input to California only** — Map picker and/or address autocomplete should only accept CA locations.

---

## Phase 3 — Form UX Improvements (High Urgency)

- [ ] **Rename role field** — Change "I was a…" label to "My role"
- [ ] **Reorder form fields** — New suggested flow:
  1. Incident type
  2. Location
  3. My role
  4. Description
  5. Media upload
  6. Contact info (optional)
- [ ] **Add "I certify this is accurate" checkbox** — Must be checked before submit. Simple moral nudge, deters false reports.
- [ ] **Update media upload CTA** — Change to "Choose photo / video" to reflect that both are accepted.
- [ ] **Add optional contact fields** — Phone + email, clearly marked optional. Enables follow-up and corroboration between reporters.

---

## Phase 4 — Post-Submit Flow (High Urgency)

Currently missing entirely. This is the highest-leverage moment to convert a one-time reporter into a return user.

- [ ] **Build confirmation / thank-you screen** — Must include:
  - Thank you message
  - Brief explanation of what happens next (review process, how reports are used)
  - CTA to view nearby recent reports on the map
- [ ] **Show nearby recent reports after submission** — Surface both AVWatch reports and Reddit posts near the submitted location.

---

## Phase 5 — Admin Dashboard

A private, internal-only view for the 4 team members to review, validate, and manage submitted reports.

- [ ] **Auth** — Google SSO login. Allowlist of exactly 4 emails (team only). No one else can access.
- [ ] **Reports queue** — Table/list of all submitted reports, sortable/filterable by: date, incident type, location, status (pending / validated / discarded).
- [ ] **Per-report actions:**
  - Validate (marks report as credible, makes it eligible for map display / featured section)
  - Discard (removes from public view, with optional internal note)
  - Flag for corroboration (links two reports of the same incident, optionally intro-ing reporters if both opted in for contact)
- [ ] **Settings page** — Manage allowlisted admin emails, toggle feature flags, view basic platform stats (total reports, reports this week, top incident types).
- [ ] **Route protection** — Admin routes must be completely inaccessible to non-admins at both the UI and API/RLS level.

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
| What are the 4 admin emails for the dashboard allowlist? | Full team | Phase 5 admin auth |

---

*Last updated: 2026-03-23*
