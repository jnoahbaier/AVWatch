'use client';

import dynamic from 'next/dynamic';

const NewsGrid = dynamic(
  () => import('@/components/news/NewsGrid').then((m) => m.NewsGrid),
  { ssr: false }
);

export default function NewsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="mb-10">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider mb-4">
            Latest Coverage
          </span>
          <h1 className="text-3xl font-bold text-[#2C3E50] mb-2">
            AV News
          </h1>
          <p className="text-slate-500">
            Recent autonomous vehicle coverage from trusted sources. Updated every hour.
          </p>
        </div>
        <NewsGrid limit={100} />
      </div>
    </div>
  );
}
