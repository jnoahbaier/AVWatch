'use client';

import { ExternalLink } from 'lucide-react';
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

export function NewsCard({ item }: { item: NewsItem }) {
  const sourceColor = SOURCE_COLORS[item.source_name] ?? DEFAULT_SOURCE_COLOR;
  const age = timeAgo(item.published_at);

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md hover:border-blue-200"
    >
      {/* Thumbnail */}
      {item.image_url && (
        <div className="relative h-44 w-full shrink-0 overflow-hidden bg-slate-100">
          <img
            src={item.image_url}
            alt={item.title}
            className="h-full w-full object-cover transition group-hover:scale-105"
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).parentElement!.style.display = 'none';
            }}
          />
        </div>
      )}

      <div className="flex flex-1 flex-col p-5">
        {/* Source + age */}
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${sourceColor}`}>
            {item.source_name}
          </span>
          {age && (
            <span className="text-xs text-slate-400">{age}</span>
          )}
        </div>

        {/* Headline */}
        <h3 className="line-clamp-3 flex-1 text-sm font-semibold leading-snug text-slate-900 group-hover:text-[#5B9DFF] transition">
          {item.title}
        </h3>

        {/* Summary — only if no image */}
        {item.summary && !item.image_url && (
          <p className="mt-2 line-clamp-2 text-xs text-slate-500">
            {item.summary}
          </p>
        )}

        {/* Read more */}
        <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-[#5B9DFF]">
          Read more
          <ExternalLink className="h-3 w-3" />
        </div>
      </div>
    </a>
  );
}
