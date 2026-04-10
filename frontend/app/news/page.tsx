'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
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
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-[#5B9DFF] transition mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
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
