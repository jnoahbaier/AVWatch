-- ============================================================================
-- Supabase Row Level Security (RLS) Policies for AV Watch
-- ============================================================================
-- Run this script in the Supabase SQL Editor (supabase.com → project → SQL editor).
-- It is safe to re-run — all statements use IF NOT EXISTS or OR REPLACE.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- bulletin_items
-- Publicly readable (active/published only). No anon writes.
-- ----------------------------------------------------------------------------

ALTER TABLE bulletin_items ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read active/published items (what the frontend shows)
DROP POLICY IF EXISTS "bulletin_items_anon_select" ON bulletin_items;
CREATE POLICY "bulletin_items_anon_select"
  ON bulletin_items
  FOR SELECT
  TO anon, authenticated
  USING (status IN ('active', 'published'));

-- Only service role can insert/update/delete (done by the backend pipeline)
-- No INSERT/UPDATE/DELETE policy for anon or authenticated = those are blocked by default.


-- ----------------------------------------------------------------------------
-- news_items
-- Publicly readable. Only service role can write (backend upserts via pipeline).
-- ----------------------------------------------------------------------------

ALTER TABLE news_items ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read news items
DROP POLICY IF EXISTS "news_items_anon_select" ON news_items;
CREATE POLICY "news_items_anon_select"
  ON news_items
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- No INSERT/UPDATE/DELETE policy for anon = blocked by default.
-- The news/route.ts server-side route uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS.
-- Fallback to anon key will now be read-only (safe — stale cache will just be returned).


-- ----------------------------------------------------------------------------
-- incidents
-- Publicly readable (non-rejected only). Anon can INSERT user reports.
-- contact_name, contact_email, reporter_ip_hash are PII — the app already
-- excludes them from SELECT queries, but consider a security-definer view
-- to enforce column-level restriction at the DB layer in the future.
-- ----------------------------------------------------------------------------

ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

-- Anyone can read non-rejected incidents (public data)
DROP POLICY IF EXISTS "incidents_anon_select" ON incidents;
CREATE POLICY "incidents_anon_select"
  ON incidents
  FOR SELECT
  TO anon, authenticated
  USING (status <> 'rejected');

-- Anyone can submit a user report (anonymous submissions are the core feature)
-- Enforce that anon-submitted rows always have source='user_report' and status='unverified'
DROP POLICY IF EXISTS "incidents_anon_insert" ON incidents;
CREATE POLICY "incidents_anon_insert"
  ON incidents
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    source = 'user_report'
    AND status = 'unverified'
  );

-- No UPDATE or DELETE for anon. Service role (backend) handles those.


-- NOTE: incident_stats, daily_incident_counts, company_stats are materialized views.
-- RLS cannot be enabled on materialized views in PostgreSQL.
-- Access is controlled at the application layer (service role key required for refresh).


-- ----------------------------------------------------------------------------
-- data_sources
-- Publicly readable. Only service role can write (backend sync pipeline).
-- ----------------------------------------------------------------------------

ALTER TABLE data_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "data_sources_anon_select" ON data_sources;
CREATE POLICY "data_sources_anon_select"
  ON data_sources
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- No INSERT/UPDATE/DELETE for anon. Backend uses service role key for updates.


-- ----------------------------------------------------------------------------
-- sync_log
-- Internal bookkeeping — no public access needed.
-- ----------------------------------------------------------------------------

ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;

-- No SELECT/INSERT/UPDATE/DELETE policy for anon or authenticated.
-- Only the service role (backend pipeline) reads and writes this table.


-- ----------------------------------------------------------------------------
-- social_signals
-- Internal pipeline data — no public access needed.
-- ----------------------------------------------------------------------------

ALTER TABLE social_signals ENABLE ROW LEVEL SECURITY;

-- No policies for anon or authenticated. Service role only.


-- ----------------------------------------------------------------------------
-- users
-- Internal auth/admin table — no public access needed.
-- ----------------------------------------------------------------------------

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- No policies for anon or authenticated. Service role only.


-- ----------------------------------------------------------------------------
-- blocked_ips
-- Internal admin table — no public access needed.
-- ----------------------------------------------------------------------------

ALTER TABLE blocked_ips ENABLE ROW LEVEL SECURITY;

-- No policies for anon or authenticated. Service role only.


-- ----------------------------------------------------------------------------
-- admin_allowlist
-- Internal admin table — no public access needed.
-- ----------------------------------------------------------------------------

ALTER TABLE admin_allowlist ENABLE ROW LEVEL SECURITY;

-- No policies for anon or authenticated. Service role only.


-- ----------------------------------------------------------------------------
-- Catch-all sweep: enable RLS on every base table in `public` that doesn't
-- already have it. This is why the advisor email kept coming back — the
-- explicit list above misses any table not written by hand, including tables
-- added by future migrations. A table with RLS enabled but no policy is
-- default-deny (locked down), which is the safe state for anything internal.
-- Extension-owned tables (e.g. PostGIS's spatial_ref_sys) are skipped here
-- because we don't own them; they're handled separately below.
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'              -- ordinary tables only (not views/matviews)
      AND c.relrowsecurity = false     -- RLS not yet enabled
      AND NOT EXISTS (                 -- skip tables owned by an extension
        SELECT 1 FROM pg_depend d
        WHERE d.objid = c.oid AND d.deptype = 'e'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t.relname);
    RAISE NOTICE 'Enabled RLS on public.%', t.relname;
  END LOOP;
END $$;


-- ----------------------------------------------------------------------------
-- spatial_ref_sys (PostGIS)
-- This table lives in `public` and is owned by the PostGIS extension, so
-- ALTER TABLE ... ENABLE ROW LEVEL SECURITY fails with "must be owner".
-- It is THE table the advisor keeps flagging once PostGIS is enabled.
-- It contains only static reference data (coordinate system definitions),
-- so it is not actually sensitive — but to silence the advisor and remove
-- API exposure, revoke access from the anon/authenticated API roles.
-- If your role lacks privileges to run these, dismiss the lint for this
-- table in the Supabase dashboard (Advisors → the finding → "Ignore").
-- ----------------------------------------------------------------------------

REVOKE ALL ON TABLE public.spatial_ref_sys FROM anon, authenticated;
