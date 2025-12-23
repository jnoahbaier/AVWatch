# Environment Variables Setup Guide

## Quick Reference

Your Supabase project details:
- **Project ID**: `tmhoogcagflhizyghakp`
- **URL**: `https://tmhoogcagflhizyghakp.supabase.co`
- **Dashboard**: [Open Dashboard](https://supabase.com/dashboard/project/tmhoogcagflhizyghakp/settings/api)

---

## 1. Frontend Environment (`.env.local`)

**Location**: `frontend/.env.local`

```bash
# Supabase (already configured!)
NEXT_PUBLIC_SUPABASE_URL=https://tmhoogcagflhizyghakp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Mapbox (YOU NEED TO ADD THIS)
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_mapbox_token_here
```

### ✅ Already Set
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Safe for browser, enables read/write with RLS

### ⚠️ You Need to Add
- `NEXT_PUBLIC_MAPBOX_TOKEN` - For the interactive map

---

## 2. Getting Your Mapbox Token

1. Go to [mapbox.com](https://www.mapbox.com/) and sign up (free tier available)
2. Navigate to [Account → Access tokens](https://account.mapbox.com/access-tokens/)
3. Copy the **Default public token** (starts with `pk.`)
4. Paste it in `frontend/.env.local`:

```bash
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1IjoieW91cnVzZXJuYW1lIiwiYSI6ImNs...
```

---

## 3. GitHub Actions Secrets (for CI/CD)

Go to: **GitHub Repo → Settings → Secrets and variables → Actions → New repository secret**

| Secret Name | Value | Where to Get |
|-------------|-------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://tmhoogcagflhizyghakp.supabase.co` | Already known |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGci...` | [Supabase Dashboard](https://supabase.com/dashboard/project/tmhoogcagflhizyghakp/settings/api) |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | `pk.eyJ1...` | [Mapbox Account](https://account.mapbox.com/access-tokens/) |
| `SUPABASE_URL` | `https://tmhoogcagflhizyghakp.supabase.co` | Same as above |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGci...` (different!) | [Supabase Dashboard](https://supabase.com/dashboard/project/tmhoogcagflhizyghakp/settings/api) → "service_role" key |
| `SUPABASE_ACCESS_TOKEN` | `sbp_...` | [Supabase Account Tokens](https://supabase.com/dashboard/account/tokens) |
| `SUPABASE_PROJECT_REF` | `tmhoogcagflhizyghakp` | Already known |

### For Vercel Deployment (optional)
| Secret Name | Value | Where to Get |
|-------------|-------|--------------|
| `VERCEL_TOKEN` | `...` | [Vercel Tokens](https://vercel.com/account/tokens) |
| `VERCEL_ORG_ID` | `...` | Vercel project settings |
| `VERCEL_PROJECT_ID` | `...` | Vercel project settings |

---

## 4. Key Security Guide

### ✅ Safe for Frontend (Browser)
- `NEXT_PUBLIC_SUPABASE_URL` 
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (protected by Row Level Security)
- `NEXT_PUBLIC_MAPBOX_TOKEN` (public token)

### 🔒 Backend Only (NEVER expose)
- `SUPABASE_SERVICE_ROLE_KEY` - Bypasses RLS, full database access
- `SUPABASE_ACCESS_TOKEN` - Supabase Management API access

---

## 5. Testing Your Setup

After adding your Mapbox token:

```bash
cd frontend
npm install
npm run dev
```

Then visit:
- http://localhost:3000 → Homepage
- http://localhost:3000/map → Should show Mapbox map
- http://localhost:3000/dashboard → Should show charts with data

---

## Troubleshooting

### "Map not loading"
- Check that `NEXT_PUBLIC_MAPBOX_TOKEN` is set correctly
- Make sure it starts with `pk.` (public token)
- Restart the dev server after changing `.env.local`

### "No data showing"
- The Supabase keys are already configured correctly
- Data is pre-seeded (13 incidents)
- Check browser console for errors

### "RLS policy errors"
- This means the anon key is working correctly
- RLS is protecting your data as expected



