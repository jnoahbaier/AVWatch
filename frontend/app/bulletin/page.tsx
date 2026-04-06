'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { RefreshCw, AlertCircle, ChevronDown } from 'lucide-react';
import { BulletinCard, type BulletinItem } from '@/components/bulletin/BulletinCard';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
const PAGE_SIZE = 24;

interface BulletinResponse {
  items: BulletinItem[];
  total: number;
  has_more: boolean;
}

async function fetchBulletin(offset: number): Promise<BulletinResponse> {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
  const res = await fetch(`${BACKEND_URL}/api/bulletin?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  return res.json();
}

export default function BulletinPage() {
  const [items, setItems] = useState<BulletinItem[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchId = useRef(0);

  const load = useCallback(async () => {
    const id = ++fetchId.current;
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchBulletin(0);
      if (fetchId.current !== id) return;
      setItems(data.items);
      setTotal(data.total);
      setHasMore(data.has_more);
      setOffset(PAGE_SIZE);
    } catch (e) {
      if (fetchId.current !== id) return;
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      if (fetchId.current === id) setIsLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const data = await fetchBulletin(offset);
      setItems((prev) => [...prev, ...data.items]);
      setTotal(data.total);
      setHasMore(data.has_more);
      setOffset((prev) => prev + PAGE_SIZE);
    } catch {
      // silent
    } finally {
      setIsLoadingMore(false);
    }
  }, [offset, isLoadingMore]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="min-h-screen bg-slate-50 pt-20 pb-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Page header */}
        <div className="py-10">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            Recent Reports
          </h1>
          <p className="mt-2 text-slate-500 text-sm max-w-xl">
            Autonomous vehicle incidents from real community reports.
            Updated every hour.
          </p>
        </div>

        {/* Loading skeleton */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-72 rounded-2xl border border-slate-200 bg-white animate-pulse" />
            ))}
          </div>
        )}

        {/* Error */}
        {!isLoading && error && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <AlertCircle className="h-10 w-10 text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">Could not load reports</p>
            <p className="text-slate-400 text-sm mt-1">{error}</p>
            <button
              onClick={load}
              className="mt-4 rounded-lg bg-[#5B9DFF] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !error && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <span className="text-5xl mb-4">🔍</span>
            <p className="text-slate-500 font-medium">No reports yet</p>
            <p className="text-slate-400 text-sm mt-1 max-w-sm">
              The pipeline runs every hour. Check back soon.
            </p>
          </div>
        )}

        {/* Cards */}
        {!isLoading && !error && items.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((item) => (
                <BulletinCard key={item.id} item={item} />
              ))}
            </div>

            {hasMore && (
              <div className="mt-12 flex justify-center">
                <button
                  onClick={loadMore}
                  disabled={isLoadingMore}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition disabled:opacity-50 shadow-sm"
                >
                  {isLoadingMore ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  {isLoadingMore ? 'Loading…' : `Load more (${total - items.length} remaining)`}
                </button>
              </div>
            )}

            {!hasMore && total > PAGE_SIZE && (
              <p className="mt-10 text-center text-xs text-slate-400">
                All {total} incidents loaded
              </p>
            )}
          </>
        )}

      </div>
    </main>
  );
}
