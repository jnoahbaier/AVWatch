'use client';

import { useState } from 'react';
import { ExternalLink, MapPin, Users, X } from 'lucide-react';

export interface BulletinItem {
  id: string;
  title: string;
  summary: string;
  av_company: string | null;
  incident_type: string | null;
  location_text: string | null;
  tags: string[];
  occurred_at: string | null;
  first_seen_at: string;
  last_updated_at: string;
  signal_count: number;
  source_url: string | null;
  source_platform: string | null;
  source_subreddit: string | null;
  image_url: string | null;
  heat_score: number;
  is_hot: boolean;
  total_upvotes: number;
  total_comments: number;
  user_report_count: number;
}

const COMPANY_COLORS: Record<string, string> = {
  waymo:    'bg-blue-50 text-blue-700 border border-blue-200',
  zoox:     'bg-purple-50 text-purple-700 border border-purple-200',
  cruise:   'bg-orange-50 text-orange-700 border border-orange-200',
  tesla:    'bg-red-50 text-red-700 border border-red-200',
  nuro:     'bg-teal-50 text-teal-700 border border-teal-200',
  aurora:   'bg-indigo-50 text-indigo-700 border border-indigo-200',
  motional: 'bg-cyan-50 text-cyan-700 border border-cyan-200',
  unknown:  'bg-slate-50 text-slate-600 border border-slate-200',
};

const INCIDENT_TYPE_LABELS: Record<string, string> = {
  collision:        'Collision',
  near_miss:        'Near Miss',
  sudden_behavior:  'Sudden Behavior',
  blockage:         'Blockage',
  other:            'Other',
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

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function CommunityModal({
  item,
  onClose,
}: {
  item: BulletinItem;
  onClose: () => void;
}) {
  // Summary is pre-generated at clustering time and stored in the DB —
  // no API call needed, just use item.summary directly.
  const narrative = item.summary;

  const companyColor =
    COMPANY_COLORS[item.av_company?.toLowerCase() ?? ''] ?? COMPANY_COLORS.unknown;
  const incidentLabel = item.incident_type
    ? INCIDENT_TYPE_LABELS[item.incident_type] ?? capitalize(item.incident_type)
    : null;
  const age = timeAgo(item.first_seen_at);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: photo if available, otherwise gradient banner */}
        {item.image_url ? (
          <div className="relative h-52 w-full overflow-hidden bg-slate-100">
            <img
              src={item.image_url}
              alt={item.title}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <h2 className="absolute bottom-4 left-6 right-12 text-base font-bold text-white leading-snug drop-shadow">
              {item.title}
            </h2>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-green-50 to-emerald-100 px-6 pt-8 pb-6 text-center">
            <h2 className="text-base font-bold text-emerald-800 leading-snug">
              {item.title}
            </h2>
          </div>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-full bg-white/70 hover:bg-white text-slate-500 hover:text-slate-800 transition"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Badges + age */}
          <div className="flex items-center gap-2 flex-wrap">
            {item.av_company && (
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${companyColor}`}>
                {capitalize(item.av_company)}
              </span>
            )}
            {incidentLabel && (
              <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-600">
                {incidentLabel}
              </span>
            )}
            <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              Community
            </span>
            {age && <span className="text-xs text-slate-400 ml-auto">{age}</span>}
          </div>

          {/* AI narrative */}
          <div className="text-sm text-slate-700 leading-relaxed min-h-[60px]">
            {narrative}
          </div>

          {/* Footer stats */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500">
            {item.location_text && (
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" />
                <span>{item.location_text}</span>
              </div>
            )}
            <div className="flex items-center gap-1 text-emerald-600 font-semibold ml-auto">
              <Users className="h-3.5 w-3.5" />
              {item.user_report_count} community {item.user_report_count === 1 ? 'report' : 'reports'}
            </div>
          </div>

          <p className="text-[10px] text-slate-400 text-center">
            Individual reports are anonymized. No personal details are shared.
          </p>
        </div>
      </div>
    </div>
  );
}

export function BulletinCard({ item }: { item: BulletinItem }) {
  const [modalOpen, setModalOpen] = useState(false);

  const companyColor =
    COMPANY_COLORS[item.av_company?.toLowerCase() ?? ''] ?? COMPANY_COLORS.unknown;
  const age = timeAgo(item.first_seen_at);
  const incidentLabel = item.incident_type
    ? INCIDENT_TYPE_LABELS[item.incident_type] ?? capitalize(item.incident_type)
    : null;

  const isCommunity = item.source_platform === 'community';
  const hasUserReports = item.user_report_count > 0;
  const displaySummary = item.summary
    .replace(/Individual reports are anonymized\.\s*/gi, '')
    .replace(/No personal details are shared\.?\s*/gi, '')
    .trim();

  const cardContent = (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md hover:border-blue-200 cursor-pointer h-full">

      {/* Image or fallback banner */}
      {item.image_url ? (
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
      ) : (
        <div className={`relative h-44 w-full shrink-0 flex flex-col items-center justify-center px-6 ${
          isCommunity
            ? 'bg-gradient-to-br from-green-50 to-emerald-100'
            : 'bg-gradient-to-br from-slate-100 to-slate-200'
        }`}>
          <p className={`text-sm font-semibold text-center line-clamp-3 ${isCommunity ? 'text-emerald-700' : 'text-slate-600'}`}>
            {displaySummary}
          </p>
        </div>
      )}

      <div className="flex flex-1 flex-col p-5">

        {/* Company badge + incident type + community tag + age */}
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {item.av_company && (
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${companyColor}`}>
                {capitalize(item.av_company)}
              </span>
            )}
            {incidentLabel && (
              <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-600">
                {incidentLabel}
              </span>
            )}
            {isCommunity && (
              <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                Community
              </span>
            )}
          </div>
          {age && (
            <span className="text-xs text-slate-400 shrink-0">{age}</span>
          )}
        </div>

        {/* Title */}
        <h3 className="line-clamp-1 text-sm font-semibold leading-snug text-[#2C3E50] group-hover:text-[#5B9DFF] transition mb-2">
          {item.title}
        </h3>

        {/* Summary */}
        <p className="line-clamp-2 text-xs text-slate-500 flex-1 leading-relaxed">
          {displaySummary}
        </p>

        {/* Location */}
        {item.location_text && (
          <div className="mt-2 flex items-center gap-1 text-xs text-slate-400">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{item.location_text}</span>
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
          {/* Community cards: only show the community report count */}
          {isCommunity ? (
            <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
              <Users className="h-3 w-3" />
              {item.user_report_count} community {item.user_report_count === 1 ? 'report' : 'reports'}
            </div>
          ) : (
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <Users className="h-3.5 w-3.5" />
              <span>
                {item.signal_count} {item.signal_count === 1 ? 'report' : 'reports'}
              </span>
              {item.total_upvotes > 0 && (
                <span className="ml-2">· ↑ {item.total_upvotes}</span>
              )}
            </div>
          )}

          {/* Source attribution (Reddit cards only) */}
          {!isCommunity && item.source_subreddit ? (
            <div className="flex items-center gap-2">
              {hasUserReports && (
                <span className="text-xs text-emerald-600 font-medium">
                  · 👥 {item.user_report_count}
                </span>
              )}
              <div className="flex items-center gap-1 text-xs font-semibold text-[#5B9DFF]">
                {`r/${item.source_subreddit}`}
                <ExternalLink className="h-3 w-3" />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  if (item.source_url) {
    return (
      <a
        href={item.source_url}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        {cardContent}
      </a>
    );
  }

  if (isCommunity) {
    return (
      <>
        <div className="block" onClick={() => setModalOpen(true)}>
          {cardContent}
        </div>
        {modalOpen && (
          <CommunityModal item={item} onClose={() => setModalOpen(false)} />
        )}
      </>
    );
  }

  return cardContent;
}
