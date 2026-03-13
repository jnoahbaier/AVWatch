# AV Watch Mobile App Plan

A phased plan to ship AV Watch as a native-feeling mobile app with a **clean, minimal design** inspired by the reference (onboarding → dashboard KPIs → analytics with bottom nav, light palette, clear charts).

---

## 1. Design direction (aligned with reference)

- **Aesthetic:** Minimal, lots of whitespace, clear hierarchy. White/light gray backgrounds; one primary accent (blue for UI, keep green for AV Watch brand where it matters).
- **Typography:** Clean sans-serif, clear size/weight hierarchy (title → subtitle → body → caption).
- **Components:** Pill-shaped primary CTAs; card-based KPI blocks with small icons; line/bar charts with subtle fill; simple outline icons; consistent bottom tab bar.
- **Trends:** Green for positive change, red for negative; small “+X% ↑ Last 30 days” style labels.
- **Flow:** Onboarding (one welcome screen) → Main app (tabs: Home, Map, Report, Analytics, Profile).

---

## 2. Recommended tech approach

| Option | Pros | Cons |
|--------|------|------|
| **Expo (React Native)** ✅ Recommended | Native iOS/Android, one codebase, great DX, OTA updates, reuse existing API/Supabase logic | New repo/folder, learn React Native primitives |
| **PWA (existing Next.js)** | Reuse current frontend, fast to ship, “Add to Home Screen” | Less native feel, no app store, limited push/background |
| **Capacitor + Next.js** | Reuse Next.js app in native shell | Heavier, still web views, less “native” than RN |

**Recommendation:** Build the **mobile app in Expo (React Native)** in a new `mobile/` (or `apps/mobile/`) directory. Keep the existing Next.js site for desktop. Share:

- **Backend:** Existing FastAPI + Supabase (no change).
- **Types & API contracts:** Shared `Incident`, filters, stats (copy or use a shared package later).
- **Design tokens:** Colors, spacing, typography in a small shared config or duplicated in mobile.

Optional **Phase 0:** Add a mobile-optimized layout and “Add to Home Screen” to the current Next.js app as a quick PWA win while the native app is in development.

---

## 3. App structure and screens

### 3.1 Onboarding (first launch only)

- **Screen:** Single welcome screen.
- **Content:**
  - Headline: e.g. “Track AV Incidents in Your City”
  - Subtitle: One line on reporting incidents, exploring the map, and holding AV companies accountable.
  - Hero: Illustration or photo (person with phone / map pin / AV) — similar role to reference image.
  - Primary CTA: **“Get Started”** (pill, primary color) → goes to main app and sets “onboarding seen”.
  - Secondary: “Already have an account? **Sign in**” (link).
- **Design:** Light background (white or very light gray), plenty of padding, single column.

### 3.2 Main app (tab navigator)

Bottom tabs (5 items, like reference):

1. **Home** (Dashboard)
2. **Map** (Explore)
3. **Report** (center FAB or “+” tab)
4. **Analytics**
5. **Profile**

---

### 3.3 Tab 1: Home (Dashboard)

- **Header:** “AV Watch” (or logo) left; optional notification/settings icon right.
- **KPI cards (2x2 or scrollable row):**
  - Total Incidents — value + “+X% ↑ Last 30 days” (green) or “−X% ↓” (red).
  - This Month — count + trend.
  - By Company — e.g. “Top: Waymo, Cruise…” or link to Analytics.
  - Verified vs Community — small breakdown (e.g. “60% official sources”).
- **Card:** “Unlock more insights” / “About data sources” (link to in-app doc or Analytics).
- **Chart:** “Incident trend” — line chart, last 6–12 months (reuse concept from current dashboard).
- **Optional:** “Recent incidents” list (3–5 items, tap → detail or map).
- **Design:** Cards on light gray/white; icons per metric; trend in green/red.

### 3.4 Tab 2: Map (Explore)

- Full-screen map (Mapbox via `react-native-mapbox-gl` or Expo map solution).
- Center on Bay Area (or user location with permission).
- Clusters for incidents; tap cluster → expand or list; tap incident → bottom sheet or small popup (type, company, date, “View details”).
- **Filters:** FAB or header icon → modal/sheet: incident type, company, date range (same as current web).
- **Design:** Minimal map UI; filter sheet matches app (white, list rows, checkmarks).

### 3.5 Tab 3: Report

- **Entry:** “Report incident” FAB or “+” tab → opens Report flow (modal stack or full-screen flow).
- **Flow (simplified from web):**
  1. **Type:** Collision / Near miss / Sudden behavior / Blockage / Other (large tap targets).
  2. **Company:** Waymo / Cruise / Zoox / Tesla / Other / Unknown (chips or list).
  3. **When:** Date + time picker.
  4. **Where:** Auto “Use current location” (primary) or manual address (optional).
  5. **Details:** Optional description (multiline), optional photo(s).
  6. **Review & submit** → success state → “Back to map” or “See on map”.
- **Design:** One question per screen or grouped in a scrollable form; primary CTA at bottom; same pill buttons and spacing as reference.

### 3.6 Tab 4: Analytics

- **Header:** “Analytics” left; optional share/export icon right.
- **Summary block:** “Total incidents” with period dropdown (This year / Last 30 days / etc.).
- **Charts (stacked vertically, scroll):**
  - **By incident type** — horizontal bar chart (e.g. Collision 40%, Near miss 35%, …).
  - **By company** — horizontal bar or small bar chart (Waymo, Cruise, …).
  - **Incident trend over time** — line chart (monthly), same as Home but with range selector.
- **Design:** Same as reference — white cards, blue bars/lines, clear labels; period selector at top.

### 3.7 Tab 5: Profile

- **Signed out:** “Sign in” CTA; optional “Create account”; short “About AV Watch” text.
- **Signed in:** Avatar/email; “My reports”; “Notifications” (if you add push); “Data sources & privacy”; “About”; “Sign out”.
- **Design:** Simple list rows, no heavy cards; matches rest of app.

---

## 4. Design system (mobile)

- **Colors:** Primary blue (e.g. `#2563eb`); success green (`#16a34a`); error/negative red (`#dc2626`); neutrals white, gray-50–900.
- **Spacing:** 4/8/16/24/32 px scale; screen padding 16–24.
- **Typography:** One sans-serif family (e.g. Inter or system); H1 24–28, H2 20, body 16, caption 12–14.
- **Components:** Rounded buttons (e.g. 12px radius); cards 12–16px radius, subtle shadow or border; bottom tab bar 48–56pt height, outline icons + label.
- **Charts:** Reuse Recharts concepts; on React Native use `react-native-chart-kit` or `victory-native` for line/bar; keep palette (blue fill, green/red for trends).

---

## 5. Backend and data (no change)

- **API:** All mobile screens use existing FastAPI endpoints:
  - Incidents CRUD, list with filters, stats, company breakdown, etc.
- **Auth:** Supabase Auth (email/password or OTP); store session in secure storage on device.
- **Maps:** Same Mapbox token (separate key for mobile if required by Mapbox terms).
- **Env:** `API_BASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `MAPBOX_TOKEN` in app config (Expo env or config plugin).

---

## 6. Phased implementation

### Phase 1 — Foundation (2–3 weeks)

- Initialize Expo app in `mobile/` (or monorepo `apps/mobile`).
- Set up navigation: one-off onboarding stack + main tab navigator (placeholder screens).
- Implement onboarding screen (copy + layout only); “Get Started” marks onboarding done and opens tabs.
- Apply design tokens (colors, spacing, typography) and a minimal component set (Button, Card, KPI block).

### Phase 2 — Home & Analytics (2–3 weeks)

- Home: fetch stats from existing API; KPI cards with trend; one line chart (incident trend).
- Analytics: same API for breakdowns; period selector; bar + line charts (by type, by company, over time).
- Pull-to-refresh; loading and error states.

### Phase 3 — Map (2–3 weeks)

- Map tab: Mapbox (or Expo map) with markers/clusters; load incidents from API with bounds/filters.
- Incident callout/sheet; filter modal (type, company, date).
- Location permission and “use my location” for map center.

### Phase 4 — Report flow (2–3 weeks)

- Multi-step report flow; form state; “Use current location” (Expo Location); optional photo (Expo Image Picker).
- Submit to existing report endpoint; success screen; link back to Map or Home.

### Phase 5 — Auth & profile (1–2 weeks)

- Supabase Auth: sign in / sign up (email + password or magic link).
- Profile tab: sign-in prompt vs “My reports” + settings; sign out.
- Optional: “My reports” list from API (filter by current user).

### Phase 6 — Polish & release (1–2 weeks)

- Error handling and offline messaging (e.g. “No connection”).
- App icon, splash screen, store listing text.
- TestFlight (iOS) and internal testing (Android); then App Store / Play Store.

---

## 7. File structure (Expo app, suggested)

```
mobile/
├── app/                    # Expo Router (or React Navigation screens)
│   ├── (onboarding)/
│   │   └── index.tsx
│   ├── (tabs)/
│   │   ├── index.tsx       # Home
│   │   ├── map.tsx
│   │   ├── report.tsx
│   │   ├── analytics.tsx
│   │   └── profile.tsx
│   ├── _layout.tsx
│   └── ...
├── components/
│   ├── ui/                 # Button, Card, KPIBlock, Chart wrappers
│   ├── charts/
│   └── forms/
├── lib/
│   ├── api.ts              # Fetch to FastAPI + Supabase
│   ├── auth.ts
│   └── constants.ts       # INCIDENT_TYPE_LABELS, etc. (shared or copied)
├── hooks/
├── theme/
│   ├── colors.ts
│   └── typography.ts
├── app.json
└── package.json
```

---

## 8. Success criteria

- [ ] Onboarding shown once; then main tabs.
- [ ] Home shows live KPI cards and incident trend chart from API.
- [ ] Map shows incidents with filters and detail.
- [ ] Report flow submits to backend and shows success.
- [ ] Analytics shows by-type and by-company and time trend.
- [ ] Profile supports sign in/out and “My reports” if logged in.
- [ ] Visual style matches reference: clean, minimal, light theme, clear charts and KPIs.

---

## 9. Optional later enhancements

- **Push notifications:** New incidents in your area or when your report is verified (Supabase + Expo Notifications).
- **Offline:** Cache recent incidents and queue report draft when offline (e.g. Supabase offline or local SQLite).
- **Deep links:** `avwatch://incident/:id` to open incident detail from notification or share.
- **PWA fallback:** Keep Next.js mobile layout and “Add to Home Screen” for users who don’t install the native app.

---

*This plan keeps your existing backend and data model; the mobile app is a new client that reuses the same APIs and design language as the reference you provided.*
