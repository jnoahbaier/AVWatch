import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  // Check for Berkeley incidents
  const { data: berkeley, error: e1 } = await supabase
    .from('incidents')
    .select('id, city, source, status, latitude, longitude, description, created_at')
    .ilike('city', '%berkeley%');

  console.log('Berkeley incidents:', berkeley?.length || 0);
  if (berkeley && berkeley.length > 0) {
    berkeley.forEach(i => console.log(JSON.stringify(i, null, 2)));
  }

  // Check for user_report source
  const { data: userReports, error: e2 } = await supabase
    .from('incidents')
    .select('id, city, source, status, latitude, longitude, created_at')
    .eq('source', 'user_report');

  console.log('\nUser reports:', userReports?.length || 0);
  if (userReports && userReports.length > 0) {
    userReports.forEach(i => console.log(JSON.stringify(i, null, 2)));
  }

  // Check all unique sources and statuses
  const { data: all } = await supabase
    .from('incidents')
    .select('source, status')
    .limit(2000);

  const uniqueSources = [...new Set(all?.map(s => s.source))];
  const uniqueStatuses = [...new Set(all?.map(s => s.status))];
  console.log('\nAll sources in DB:', uniqueSources);
  console.log('All statuses in DB:', uniqueStatuses);

  // Check total count
  const { count } = await supabase
    .from('incidents')
    .select('id', { count: 'exact' });

  console.log('\nTotal incidents:', count);
}

check();
