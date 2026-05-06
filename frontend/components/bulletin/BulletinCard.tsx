'use client';

import { useState, useEffect, useRef } from 'react';
import { ExternalLink, MapPin, Users, X } from 'lucide-react';
import { INCIDENT_TYPE_COLORS } from '@/lib/utils';

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
  sudden_behavior:  'Reckless Driving',
  blockage:         'Blockage',
  vandalism:        'Vandalism',
  accessibility:    'Accessibility Issue',
  other:            'Other',
};

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// Tags contain incident types with underscores replaced by spaces (e.g. "sudden behavior").
// This map lets us recover the canonical key and show a badge for each matched type.
const TAG_TO_INCIDENT_TYPE: Record<string, string> = {
  collision:         'collision',
  'near miss':       'near_miss',
  'sudden behavior': 'sudden_behavior',
  blockage:          'blockage',
  vandalism:         'vandalism',
  accessibility:     'accessibility',
  other:             'other',
};

function incidentTypesFromTags(tags: string[], primaryType: string | null): string[] {
  const found = tags
    .map((t) => TAG_TO_INCIDENT_TYPE[t.toLowerCase()])
    .filter(Boolean) as string[];
  // Always include the primary incident_type even if not in tags
  if (primaryType && !found.includes(primaryType)) found.unshift(primaryType);
  // Deduplicate while preserving order
  return [...new Set(found)];
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
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute('disabled'));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Summary is pre-generated at clustering time and stored in the DB —
  // no API call needed, just use item.summary directly.
  const narrative = item.summary;

  const companyColor =
    COMPANY_COLORS[item.av_company?.toLowerCase() ?? ''] ?? COMPANY_COLORS.unknown;
  const incidentTypes = incidentTypesFromTags(item.tags ?? [], item.incident_type);
  const formattedDate = formatDate(item.occurred_at ?? item.first_seen_at);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="community-modal-title"
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
            <h2 id="community-modal-title" className="absolute bottom-4 left-6 right-12 text-base font-bold text-white leading-snug drop-shadow">
              {item.title}
            </h2>
          </div>
        ) : (
          <div className="bg-[#1e3a5f] px-6 pt-8 pb-6 text-center">
            <h2 id="community-modal-title" className="text-base font-bold text-[#93C5FD] leading-snug">
              {item.title}
            </h2>
          </div>
        )}

        {/* Close button */}
        <button
          ref={closeButtonRef}
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-full bg-white/70 hover:bg-white text-slate-500 hover:text-slate-800 transition focus:outline-none focus:ring-2 focus:ring-[#5B9DFF]"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Badges + date */}
          <div className="flex items-center gap-2 flex-wrap">
            {item.av_company && (
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${companyColor}`}>
                {capitalize(item.av_company)}
              </span>
            )}
            {incidentTypes.map((type) => (
              <span
                key={type}
                className="inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium"
                style={{
                  backgroundColor: (INCIDENT_TYPE_COLORS[type] ?? '#64748b') + '18',
                  borderColor: (INCIDENT_TYPE_COLORS[type] ?? '#64748b') + '40',
                  color: INCIDENT_TYPE_COLORS[type] ?? '#64748b',
                }}
              >
                {INCIDENT_TYPE_LABELS[type] ?? capitalize(type)}
              </span>
            ))}
            {formattedDate && <span className="text-xs text-slate-500 ml-auto">{formattedDate}</span>}
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
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
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
  const formattedDate = formatDate(item.occurred_at ?? item.first_seen_at);
  const incidentTypes = incidentTypesFromTags(item.tags ?? [], item.incident_type);

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
        <div className="relative h-44 w-full shrink-0 flex flex-col items-center justify-center px-6 bg-[#1e3a5f]">
          <p className="text-sm font-semibold text-center line-clamp-3 text-[#93C5FD]">
            {displaySummary}
          </p>
        </div>
      )}

      <div className="flex flex-1 flex-col p-5">

        {/* Company badge + incident type(s) + date */}
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {item.av_company && (
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${companyColor}`}>
                {capitalize(item.av_company)}
              </span>
            )}
            {incidentTypes.map((type) => (
              <span
                key={type}
                className="inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium"
                style={{
                  backgroundColor: (INCIDENT_TYPE_COLORS[type] ?? '#64748b') + '18',
                  borderColor: (INCIDENT_TYPE_COLORS[type] ?? '#64748b') + '40',
                  color: INCIDENT_TYPE_COLORS[type] ?? '#64748b',
                }}
              >
                {INCIDENT_TYPE_LABELS[type] ?? capitalize(type)}
              </span>
            ))}
          </div>
          {formattedDate && (
            <span className="text-xs text-slate-500 shrink-0">{formattedDate}</span>
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
          <div className="mt-2 flex items-center gap-1 text-xs text-slate-500">
            <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{item.location_text}</span>
          </div>
        )}

        {/* Footer — Reddit cards only */}
        {!isCommunity && (
          <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {item.signal_count} {item.signal_count === 1 ? 'report' : 'reports'}
              </span>
              {item.total_upvotes > 0 && (
                <span className="ml-2">· ↑ {item.total_upvotes}</span>
              )}
            </div>
            {item.source_subreddit && (
              <div className="flex items-center gap-2">
                {hasUserReports && (
                  <span className="text-xs text-emerald-600 font-medium">
                    · 👥 {item.user_report_count}
                  </span>
                )}
                <div className="flex items-center gap-1 text-xs font-semibold text-[#5B9DFF]">
                  {`r/${item.source_subreddit}`}
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (item.source_url) {
    return (
      <a
        href={item.source_url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${item.title} (opens in new tab)`}
        className="block"
      >
        {cardContent}
        <span className="sr-only">(opens in new tab)</span>
      </a>
    );
  }

  if (isCommunity) {
    return (
      <>
        <button
          type="button"
          className="block w-full text-left p-0 bg-transparent border-0 focus:outline-none focus:ring-2 focus:ring-[#5B9DFF] focus:rounded-2xl"
          onClick={() => setModalOpen(true)}
          aria-haspopup="dialog"
        >
          {cardContent}
        </button>
        {modalOpen && (
          <CommunityModal item={item} onClose={() => setModalOpen(false)} />
        )}
      </>
    );
  }

  return cardContent;
}
