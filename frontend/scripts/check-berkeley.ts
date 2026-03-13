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
  // Check Berkeley incident with occurred_at
  const { data: berkeley, error: e1 } = await supabase
    .from('incidents')
    .select('id, city, source, status, latitude, longitude, occurred_at, created_at')
    .ilike('city', '%berkeley%');

  console.log('Berkeley incidents:', berkeley?.length || 0);
  if (berkeley && berkeley.length > 0) {
    berkeley.forEach(i => console.log(JSON.stringify(i, null, 2)));
  }

  // Check if Berkeley incident would be in the top 500 by occurred_at
  const { data: top500, error: e2 } = await supabase
    .from('incidents')
    .select('id, city, occurred_at')
    .neq('status', 'rejected')
    .order('occurred_at', { ascending: false })
    .limit(500);

  const berkeleyInTop500 = top500?.find(i => i.city === 'Berkeley');
  console.log('\nBerkeley in top 500 by occurred_at?', berkeleyInTop500 ? 'YES' : 'NO');

  if (!berkeleyInTop500 && top500 && top500.length > 0) {
    console.log('\nOldest incident in top 500:', JSON.stringify(top500[top500.length - 1], null, 2));
    console.log('\nNewest incident in top 500:', JSON.stringify(top500[0], null, 2));

    // Check Berkeley incident's occurred_at
    if (berkeley && berkeley.length > 0) {
      console.log('\nBerkeley occurred_at:', berkeley[0].occurred_at);
    }
  }

  // Check all incidents near Berkeley coordinates (North Berkeley area around 37.89, -122.27)
  const { data: nearBerkeley, error: e3 } = await supabase
    .from('incidents')
    .select('id, city, source, latitude, longitude, occurred_at, created_at')
    .gte('latitude', 37.88)
    .lte('latitude', 37.90)
    .gte('longitude', -122.30)
    .lte('longitude', -122.26);

  console.log('\nIncidents near North Berkeley coordinates:', nearBerkeley?.length || 0);
  if (nearBerkeley && nearBerkeley.length > 0) {
    nearBerkeley.forEach(i => console.log(JSON.stringify(i, null, 2)));
  }
}

check();
