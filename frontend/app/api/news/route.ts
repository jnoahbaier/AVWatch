import { NextRequest, NextResponse } from 'next/server';
import Parser from 'rss-parser';
import { createClient } from '@supabase/supabase-js';
import type { NewsItem } from '@avwatch/shared';

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

// ---------------------------------------------------------------------------
// RSS parser
// ---------------------------------------------------------------------------
const parser = new Parser({
  timeout: 10000,
  headers: { 'User-Agent': 'AVWatch/1.0 (https://avwatch.org)' },
  customFields: {
    item: [
      ['media:thumbnail', 'mediaThumbnail'],
      ['media:content', 'mediaContent'],
      ['content:encoded', 'contentEncoded'],
    ],
  },
});

const FEEDS = [
  { name: 'The Robot Report', url: 'https://www.therobotreport.com/news/autonomous-vehicles/feed/' },
  { name: 'IEEE Spectrum', url: 'https://spectrum.ieee.org/feeds/topic/transportation.rss' },
  { name: 'Electrek (Waymo)', url: 'https://electrek.co/tag/waymo/feed/' },
  { name: 'TechCrunch (Transportation)', url: 'https://techcrunch.com/category/transportation/feed/' },
  { name: 'Ars Technica (Cars)', url: 'https://feeds.arstechnica.com/arstechnica/cars' },
  { name: 'The Verge (Self-Driving)', url: 'https://www.theverge.com/rss/index.xml' },
];

const AV_KEYWORDS = [
  'waymo', 'cruise', 'robotaxi', 'autonomous vehicle', 'self-driving',
  'adas', 'tesla autopilot', 'tesla fsd', 'zoox', 'nuro', 'aurora',
  'motional', 'pony.ai', 'driverless', 'autonomous driving', 'lidar',
  'robo-taxi', 'av safety', 'automated driving',
];

// How old the DB cache can be before we re-fetch from RSS (1 hour)
const CACHE_TTL_MS = 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function isAVRelevant(text: string): boolean {
  const lower = text.toLowerCase();
  return AV_KEYWORDS.some((kw) => lower.includes(kw));
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function extractImageUrl(entry: Record<string, unknown>): string | null {
  const thumb = entry.mediaThumbnail as Record<string, unknown> | undefined;
  if (thumb) {
    const attrs = (thumb.$ as Record<string, string> | undefined) ?? thumb;
    if (typeof attrs?.url === 'string' && attrs.url) return attrs.url;
  }
  const media = entry.mediaContent as Record<string, unknown> | undefined;
  if (media) {
    const attrs = (media.$ as Record<string, string> | undefined) ?? media;
    if (typeof attrs?.url === 'string' && attrs.url) return attrs.url;
  }
  const enc = entry.enclosure as Record<string, string> | undefined;
  if (enc?.url && enc.type?.startsWith('image')) return enc.url;
  const html = (entry.contentEncoded ?? entry.content) as string | undefined;
  if (html) {
    const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (match?.[1]) return match[1];
  }
  return null;
}

const OG_IMAGE_RE =
  /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i;

async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 6000);
    const res = await fetch(url, {
      signal: ac.signal,
      headers: { 'User-Agent': 'AVWatch/1.0 (https://avwatch.org)' },
    });
    clearTimeout(timer);
    const reader = res.body?.getReader();
    if (!reader) return null;
    let html = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      html += new TextDecoder().decode(value);
      if (html.includes('</head>') || html.length > 30_000) {
        reader.cancel();
        break;
      }
    }
    const m = OG_IMAGE_RE.exec(html);
    return m ? (m[1] ?? m[2] ?? null) : null;
  } catch {
    return null;
  }
}

async function fetchFeed(name: string, url: string): Promise<NewsItem[]> {
  try {
    const feed = await parser.parseURL(url);
    const items: NewsItem[] = [];
    for (const entry of feed.items ?? []) {
      const title = entry.title ?? '';
      const summary = entry.contentSnippet ?? entry.summary ?? entry.content ?? '';
      if (!isAVRelevant(`${title} ${summary}`)) continue;
      const imageUrl = extractImageUrl(entry as unknown as Record<string, unknown>);
      items.push({
        title: stripHtml(title),
        url: entry.link ?? '',
        source_name: name,
        published_at: entry.isoDate ?? entry.pubDate ?? null,
        summary: summary ? stripHtml(summary).slice(0, 200) : null,
        image_url: typeof imageUrl === 'string' ? imageUrl : null,
      });
    }
    return items;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Supabase cache helpers
// ---------------------------------------------------------------------------
async function getCachedNews(limit: number): Promise<NewsItem[] | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  // Check when we last refreshed
  const { data: latest } = await supabase
    .from('news_items')
    .select('fetched_at')
    .order('fetched_at', { ascending: false })
    .limit(1)
    .single();

  if (!latest) return null;

  const age = Date.now() - new Date(latest.fetched_at).getTime();
  if (age > CACHE_TTL_MS) return null; // stale

  const { data, error } = await supabase
    .from('news_items')
    .select('title, url, source_name, published_at, summary, image_url')
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error || !data) return null;
  return data as NewsItem[];
}

async function saveNewsToSupabase(items: NewsItem[]): Promise<void> {
  if (items.length === 0) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const now = new Date().toISOString();
  const rows = items.map((i) => ({
    title: i.title,
    url: i.url,
    source_name: i.source_name,
    published_at: i.published_at ?? null,
    summary: i.summary ?? null,
    image_url: i.image_url ?? null,
    fetched_at: now,
  }));

  // Upsert by URL — update everything except created_at
  await supabase.from('news_items').upsert(rows, { onConflict: 'url' });
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const limit = Math.min(
    parseInt(req.nextUrl.searchParams.get('limit') ?? '24', 10),
    100
  );

  // 1. Try Supabase cache first
  const cached = await getCachedNews(limit);
  if (cached) {
    return NextResponse.json(cached, {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
    });
  }

  // 2. Cache is stale or empty — fetch fresh from RSS
  const results = await Promise.allSettled(FEEDS.map((f) => fetchFeed(f.name, f.url)));
  const allItems: NewsItem[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') allItems.push(...r.value);
  }

  // Fill missing images via og:image scraping
  const noImg = allItems.filter((i) => !i.image_url && i.url);
  if (noImg.length > 0) {
    const ogImages = await Promise.allSettled(noImg.map((i) => fetchOgImage(i.url)));
    for (let j = 0; j < noImg.length; j++) {
      const result = ogImages[j];
      if (result.status === 'fulfilled' && result.value) noImg[j].image_url = result.value;
    }
  }

  // Sort newest first
  const dated = allItems.filter((i) => i.published_at);
  const undated = allItems.filter((i) => !i.published_at);
  dated.sort((a, b) => new Date(b.published_at!).getTime() - new Date(a.published_at!).getTime());
  const sorted = [...dated, ...undated];

  // 3. Persist to Supabase (non-blocking — don't await so we don't slow down the response)
  saveNewsToSupabase(sorted).catch(() => {});

  return NextResponse.json(sorted.slice(0, limit), {
    headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
  });
}
