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
