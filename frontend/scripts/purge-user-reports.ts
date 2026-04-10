/**
 * Deletes all rows in `incidents` with source = user_report (test submissions before launch).
 * Requires SUPABASE_SERVICE_ROLE_KEY — anon cannot DELETE per RLS.
 *
 * Run from frontend/: npx tsx scripts/purge-user-reports.ts
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function main() {
  const { count, error: countErr } = await supabase
    .from('incidents')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'user_report');

  if (countErr) {
    console.error('Count failed:', countErr.message);
    process.exit(1);
  }

  const n = count ?? 0;
  console.log(`Found ${n} user_report incident(s). bulletin_items (Reddit/news) are untouched.`);

  if (n === 0) {
    console.log('Nothing to delete.');
    return;
  }

  const { error: delErr } = await supabase.from('incidents').delete().eq('source', 'user_report');

  if (delErr) {
    console.error('Delete failed:', delErr.message);
    process.exit(1);
  }

  console.log(`Deleted ${n} row(s). Done.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
