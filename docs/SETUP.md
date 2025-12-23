# AV Watch Setup Guide

## Prerequisites

- Node.js 20+
- Mapbox account (for maps) - [Get token](https://account.mapbox.com/)
- GitHub account (for CI/CD)

## Supabase Project

Your Supabase project has been created:

- **Project ID**: `tmhoogcagflhizyghakp`
- **URL**: `https://tmhoogcagflhizyghakp.supabase.co`
- **Region**: `us-west-1`

### Getting Your Keys

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/tmhoogcagflhizyghakp/settings/api)
2. Copy the following keys:
   - **URL**: `https://tmhoogcagflhizyghakp.supabase.co`
   - **Anon (public) key**: Found under "Project API keys"
   - **Service role key**: Found under "Project API keys" (keep secret!)

## Environment Variables

### Frontend (`frontend/.env.local`)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://tmhoogcagflhizyghakp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Mapbox
NEXT_PUBLIC_MAPBOX_TOKEN=your-mapbox-token-here
```

### GitHub Actions Secrets

Add these secrets to your GitHub repository (Settings > Secrets and variables > Actions):

| Secret Name | Description |
|-------------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox access token |
| `SUPABASE_URL` | Supabase project URL (for Edge Functions) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (keep secret!) |
| `SUPABASE_ACCESS_TOKEN` | [Supabase personal access token](https://supabase.com/dashboard/account/tokens) |
| `SUPABASE_PROJECT_REF` | `tmhoogcagflhizyghakp` |
| `VERCEL_TOKEN` | Vercel deployment token |
| `VERCEL_ORG_ID` | Vercel organization ID |
| `VERCEL_PROJECT_ID` | Vercel project ID |

## Database Schema

The following tables have been created:

### `incidents`
Main table for storing AV incident reports.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `incident_type` | VARCHAR | collision, near_miss, sudden_behavior, blockage, other |
| `av_company` | VARCHAR | waymo, cruise, zoox, tesla, other, unknown |
| `description` | TEXT | Incident description |
| `location` | GEOGRAPHY | PostGIS point (lat/lng) |
| `latitude` | DOUBLE | Generated from location |
| `longitude` | DOUBLE | Generated from location |
| `occurred_at` | TIMESTAMPTZ | When incident happened |
| `source` | VARCHAR | user_report, nhtsa, cpuc, dmv |
| `status` | VARCHAR | unverified, corroborated, verified, rejected |
| `fatalities` | INTEGER | Number of fatalities |
| `injuries` | INTEGER | Number of injuries |

### `data_sources`
Tracks external data sources and sync status.

### `sync_log`
Logs each data ingestion run.

### Views

- `incident_stats` - Materialized view with aggregated statistics
- `company_stats` - Statistics grouped by company
- `daily_incident_counts` - Daily aggregates for time series

## Edge Functions

### `ingest-nhtsa`
- **URL**: `https://tmhoogcagflhizyghakp.supabase.co/functions/v1/ingest-nhtsa`
- **Schedule**: Daily at 6 AM UTC (via pg_cron)
- **Purpose**: Fetches and ingests NHTSA SGO crash data

## Running Locally

```bash
# Frontend
cd frontend
npm install
npm run dev
# Visit http://localhost:3000

# Trigger NHTSA sync manually
curl -X POST https://tmhoogcagflhizyghakp.supabase.co/functions/v1/ingest-nhtsa
```

## Deployment

### Frontend (Vercel)

1. Connect your GitHub repo to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to `main`

### Edge Functions

Edge Functions are deployed automatically via GitHub Actions on push to `main`.

To deploy manually:
```bash
npx supabase functions deploy ingest-nhtsa --project-ref tmhoogcagflhizyghakp
```

## Data Sync Schedule

| Source | Frequency | Method |
|--------|-----------|--------|
| NHTSA SGO | Daily 6 AM UTC | pg_cron + Edge Function |
| Stats Refresh | Hourly | pg_cron |
| CA DMV | Quarterly | Manual |
| CPUC | Quarterly | Manual |

## Troubleshooting

### Check sync logs
```sql
SELECT * FROM sync_log ORDER BY started_at DESC LIMIT 10;
```

### Refresh stats manually
```sql
SELECT refresh_incident_stats();
```

### Check cron jobs
```sql
SELECT * FROM cron.job;
```



