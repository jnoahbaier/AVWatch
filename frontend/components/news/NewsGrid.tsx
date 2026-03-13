'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertCircle, RefreshCw } from 'lucide-react';
import type { NewsItem } from '@avwatch/shared';
import { NewsCard } from './NewsCard';

async function fetchNews(limit = 24): Promise<NewsItem[]> {
  const res = await fetch(`/api/news?limit=${limit}`);
  if (!res.ok) throw new Error(`Failed to load news: ${res.status}`);
  return res.json();
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
      <div className="mb-3 flex justify-between">
        <div className="h-5 w-28 rounded-full bg-slate-100" />
        <div className="h-4 w-12 rounded bg-slate-100" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-full rounded bg-slate-100" />
        <div className="h-4 w-5/6 rounded bg-slate-100" />
        <div className="h-4 w-4/6 rounded bg-slate-50" />
      </div>
      <div className="mt-4 h-3 w-20 rounded bg-slate-50" />
    </div>
  );
}

export function NewsGrid({ limit = 24 }: { limit?: number }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['news', limit],
    queryFn: () => fetchNews(limit),
    staleTime: 15 * 60 * 1000, // 15 min client-side freshness
    retry: 2,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <p className="text-sm text-red-400">
          Could not load news right now. Check back soon.
        </p>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 transition"
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
      </div>
    );
  }

  const items = data ?? [];

  if (items.length === 0) {
    return (
      <p className="text-center text-sm text-slate-500 dark:text-slate-400">
        No AV news found right now. Pull-to-refresh or check back later.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <NewsCard key={item.url} item={item} />
      ))}
    </div>
  );
}
