# AV Watch — Data Sources

AVWatch aggregates incident data from two sources: community user reports and Reddit.

---

## 1. Community Reports (Primary)

Users submit reports directly via the form at [avwatch.org](https://www.avwatch.org). No account required.

**Fields collected:**
- Incident type (collision, near miss, sudden behavior, blockage, vandalism, other)
- AV company (Waymo, Zoox, Cruise, Tesla, Unknown)
- Location (GPS coordinates + reverse-geocoded address)
- Date and time
- Description (free text)
- Optional: photo or video
- Optional: reporter name and email (admin-only, never public)

**Anti-spam:** IP hashing, rate limiting (5/10 min), and a 3-distinct-IP threshold before community reports surface publicly.

---

## 2. Reddit (Automated Aggregation)

An hourly background pipeline scrapes 6 subreddits for AV incident reports:

- `r/waymo`
- `r/SelfDrivingCars`
- `r/robotaxi`
- `r/sanfrancisco`
- `r/bayarea`
- `r/teslamotors`

Each post is passed through **Gemini 2.5 Flash**, which:
1. Determines whether the post describes a real, specific on-road AV incident
2. If yes, extracts: company, incident type, location, a short title, and a one-sentence summary

Posts that don't describe a real incident (news announcements, opinions, general experiences) are filtered out. Duplicates are tracked by `external_id`.

---

## What Was Cut

The original plan included ingestion pipelines for:
- NHTSA Standing General Order crash reports
- CA DMV autonomous vehicle collision/disengagement reports
- CPUC quarterly reports

These were descoped. Government data updates infrequently, requires complex parsing, and is not the most useful information for the community members AVWatch serves. Community reports and Reddit aggregation cover the same ground in near real-time.

---

*Last updated: April 2026*
