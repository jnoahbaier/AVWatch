import { NextRequest, NextResponse } from 'next/server';
import Parser from 'rss-parser';
import type { NewsItem } from '@avwatch/shared';

const parser = new Parser({
  timeout: 10000,
  headers: { 'User-Agent': 'AVWatch/1.0 (https://avwatch.app)' },
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

function isAVRelevant(text: string): boolean {
  const lower = text.toLowerCase();
  return AV_KEYWORDS.some((kw) => lower.includes(kw));
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

function extractImageUrl(entry: Record<string, unknown>): string | null {
  // media:thumbnail — rss-parser returns { $: { url } } or { url }
  const thumb = entry.mediaThumbnail as Record<string, unknown> | undefined;
  if (thumb) {
    const attrs = (thumb.$ as Record<string, string> | undefined) ?? thumb;
    if (typeof attrs?.url === 'string' && attrs.url) return attrs.url;
  }

  // media:content — same shape
  const media = entry.mediaContent as Record<string, unknown> | undefined;
  if (media) {
    const attrs = (media.$ as Record<string, string> | undefined) ?? media;
    if (typeof attrs?.url === 'string' && attrs.url) return attrs.url;
  }

  // enclosure (podcasts / direct media links)
  const enc = entry.enclosure as Record<string, string> | undefined;
  if (enc?.url && enc.type?.startsWith('image')) return enc.url;

  // content:encoded — pull first <img src="..."> out of the HTML
  const html = (entry.contentEncoded ?? entry.content) as string | undefined;
  if (html) {
    const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (match?.[1]) return match[1];
  }

  return null;
}

// Simple in-memory cache: { items, fetchedAt }
let cache: { items: NewsItem[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

async function fetchFeed(name: string, url: string): Promise<NewsItem[]> {
  try {
    const feed = await parser.parseURL(url);
    const items: NewsItem[] = [];
    for (const entry of feed.items ?? []) {
      const title = entry.title ?? '';
      const summary = entry.contentSnippet ?? entry.summary ?? entry.content ?? '';
      const combined = `${title} ${summary}`;
      if (!isAVRelevant(combined)) continue;

      const imageUrl = extractImageUrl(entry);

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
    // Individual feed failures are non-fatal
    return [];
  }
}

const OG_IMAGE_RE = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i;

async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 6000);
    const res = await fetch(url, {
      signal: ac.signal,
      headers: { 'User-Agent': 'AVWatch/1.0 (https://avwatch.app)' },
    });
    clearTimeout(timer);
    // Read just enough HTML to find the og:image in <head>
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

export async function GET(req: NextRequest) {
  const limit = Math.min(
    parseInt(req.nextUrl.searchParams.get('limit') ?? '24', 10),
    100
  );

  // Serve from cache if fresh
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json(cache.items.slice(0, limit), {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
    });
  }

  // Fetch all feeds in parallel
  const results = await Promise.allSettled(
    FEEDS.map((f) => fetchFeed(f.name, f.url))
  );

  const allItems: NewsItem[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') allItems.push(...r.value);
  }

  // For articles still missing an image, fetch og:image from the article page
  const noImg = allItems.filter((i) => !i.image_url && i.url);
  if (noImg.length > 0) {
    const ogImages = await Promise.allSettled(noImg.map((i) => fetchOgImage(i.url)));
    for (let j = 0; j < noImg.length; j++) {
      const result = ogImages[j];
      if (result.status === 'fulfilled' && result.value) {
        noImg[j].image_url = result.value;
      }
    }
  }

  // Sort newest first; undated items go to the end
  const dated = allItems.filter((i) => i.published_at);
  const undated = allItems.filter((i) => !i.published_at);
  dated.sort((a, b) => new Date(b.published_at!).getTime() - new Date(a.published_at!).getTime());
  const sorted = [...dated, ...undated];

  cache = { items: sorted, fetchedAt: Date.now() };

  return NextResponse.json(sorted.slice(0, limit), {
    headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
  });
}
