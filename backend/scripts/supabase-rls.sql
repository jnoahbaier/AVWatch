-- ============================================================================
-- Supabase Row Level Security (RLS) Policies for AVWatch
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
