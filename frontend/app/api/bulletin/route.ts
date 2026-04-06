import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: 'Supabase environment variables are not configured.' },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { searchParams } = req.nextUrl;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '6', 10), 50);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);

  const { data, error, count } = await supabase
    .from('bulletin_items')
    .select('*', { count: 'exact' })
    .in('status', ['active', 'published'])
    .order('first_seen_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const items = (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    summary: row.summary,
    av_company: row.av_company,
    incident_type: row.incident_type,
    location_text: row.location_text,
    tags: row.tags ?? [],
    occurred_at: row.occurred_at,
    first_seen_at: row.first_seen_at,
    last_updated_at: row.last_updated_at,
    signal_count: row.signal_count ?? 1,
    source_url: row.source_url,
    source_platform: row.source_platform,
    source_subreddit: row.source_subreddit,
    image_url: row.image_url,
    heat_score: row.heat_score ?? 0,
    is_hot: row.is_hot ?? false,
    total_upvotes: row.total_upvotes ?? 0,
    total_comments: row.total_comments ?? 0,
    user_report_count: (row.user_report_ids ?? []).length,
  }));

  const total = count ?? 0;
  const has_more = offset + limit < total;

  return NextResponse.json(
    { items, total, has_more, offset, limit },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } }
  );
}
