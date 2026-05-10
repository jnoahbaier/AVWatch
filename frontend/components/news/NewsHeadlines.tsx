'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, ArrowRight } from 'lucide-react';
import type { NewsItem } from '@avwatch/shared';

const SOURCE_COLORS: Record<string, string> = {
  'The Robot Report': 'bg-blue-50 text-blue-700 border border-blue-200',
  'IEEE Spectrum': 'bg-purple-50 text-purple-700 border border-purple-200',
  'Electrek (Waymo)': 'bg-cyan-50 text-cyan-700 border border-cyan-200',
  'TechCrunch (Transportation)': 'bg-orange-50 text-orange-700 border border-orange-200',
  'The Verge (Self-Driving)': 'bg-red-50 text-red-700 border border-red-200',
  'Ars Technica (Cars)': 'bg-amber-50 text-amber-700 border border-amber-200',
};

const DEFAULT_SOURCE_COLOR = 'bg-slate-50 text-slate-600 border border-slate-200';

// Maps source name to a single letter initial for fallback thumbnail
const SOURCE_INITIALS: Record<string, string> = {
  'The Robot Report': 'R',
  'IEEE Spectrum': 'I',
  'Electrek (Waymo)': 'E',
  'TechCrunch (Transportation)': 'T',
  'The Verge (Self-Driving)': 'V',
  'Ars Technica (Cars)': 'A',
};

// Matching bg colors for the fallback thumbnail
const SOURCE_FALLBACK_BG: Record<string, string> = {
  'The Robot Report': 'bg-blue-100 text-[#5B9DFF]',
  'IEEE Spectrum': 'bg-purple-100 text-purple-600',
  'Electrek (Waymo)': 'bg-cyan-100 text-cyan-600',
  'TechCrunch (Transportation)': 'bg-orange-100 text-orange-600',
  'The Verge (Self-Driving)': 'bg-red-100 text-red-600',
  'Ars Technica (Cars)': 'bg-amber-100 text-amber-600',
};

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-3 sm:gap-4 sm:py-4 animate-pulse">
      <div className="h-12 w-12 shrink-0 rounded-lg bg-slate-200 sm:h-14 sm:w-14" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-20 rounded bg-slate-200" />
        <div className="h-4 w-full rounded bg-slate-200" />
        <div className="h-4 w-3/4 rounded bg-slate-200" />
      </div>
    </div>
  );
}

function NewsHeadlineRow({ item }: { item: NewsItem }) {
  const [imgFailed, setImgFailed] = useState(false);
  const sourceColor = SOURCE_COLORS[item.source_name] ?? DEFAULT_SOURCE_COLOR;
  const fallbackBg = SOURCE_FALLBACK_BG[item.source_name] ?? 'bg-slate-100 text-slate-500';
  const initial = SOURCE_INITIALS[item.source_name] ?? (item.source_name[0] ?? '?');
  const age = timeAgo(item.published_at);

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group -mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition hover:bg-slate-50 sm:gap-4 sm:py-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5B9DFF]"
    >
      {/* Thumbnail */}
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg sm:h-14 sm:w-14 ${!item.image_url || imgFailed ? fallbackBg : 'bg-slate-100'}`}>
        {item.image_url && !imgFailed ? (
          <img
            src={item.image_url}
            alt={item.title}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <span className="text-lg font-bold">{initial}</span>
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="mb-1 flex items-center gap-2">
          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${sourceColor}`}>
            {item.source_name}
          </span>
          {age && <span className="text-xs text-slate-400">{age}</span>}
        </div>
        <p className="line-clamp-2 text-sm font-semibold text-[#2C3E50] group-hover:text-[#5B9DFF] transition leading-snug">
          {item.title}
        </p>
      </div>

      {/* Arrow */}
      <ExternalLink className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-[#5B9DFF]" />
    </a>
  );
}

export function NewsHeadlines() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  async function load() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/news?limit=3');
      if (!res.ok) throw new Error('Failed');
      const data: NewsItem[] = await res.json();
      setItems(data.slice(0, 3));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // Refresh every hour
    const interval = setInterval(load, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      {loading ? (
        <div className="divide-y divide-slate-100">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : error ? (
        <div className="py-8 text-center text-sm text-slate-500">
          Could not load news.{' '}
          <button onClick={load} className="text-[#5B9DFF] underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5B9DFF] rounded">
            Retry
          </button>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {items.map((item, i) => (
            <div key={i}>
              <NewsHeadlineRow item={item} />
            </div>
          ))}
        </div>
      )}

      {/* See more news */}
      {!loading && !error && (
        <div className="mt-4 text-right">
          <a
            href="/news"
            className="inline-flex items-center gap-1 text-sm font-medium text-[#5B9DFF] hover:text-blue-700 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5B9DFF] rounded"
          >
            See more news
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      )}
    </div>
  );
}
