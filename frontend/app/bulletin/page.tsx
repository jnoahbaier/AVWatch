'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { RefreshCw, AlertCircle, ChevronDown, Filter, X, Search } from 'lucide-react';
import { BulletinCard, type BulletinItem } from '@/components/bulletin/BulletinCard';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
const PAGE_SIZE = 24;

interface Filters {
  location: string;
  dateFrom: string;
  dateTo: string;
  sourcePlatform: string;
  communityBacked: boolean;
  avCompany: string;
  incidentType: string;
}

const DEFAULT_FILTERS: Filters = {
  location: '',
  dateFrom: '',
  dateTo: '',
  sourcePlatform: 'community',
  communityBacked: false,
  avCompany: '',
  incidentType: '',
};

const COMPANIES = [
  { value: '', label: 'All companies' },
  { value: 'waymo', label: 'Waymo' },
  { value: 'cruise', label: 'Cruise' },
  { value: 'zoox', label: 'Zoox' },
  { value: 'tesla', label: 'Tesla' },
  { value: 'nuro', label: 'Nuro' },
  { value: 'aurora', label: 'Aurora' },
  { value: 'motional', label: 'Motional' },
];

const INCIDENT_TYPES = [
  { value: '', label: 'All types' },
  { value: 'collision', label: 'Collision' },
  { value: 'near_miss', label: 'Near Miss' },
  { value: 'sudden_behavior', label: 'Reckless Driving' },
  { value: 'blockage', label: 'Blockage' },
  { value: 'vandalism', label: 'Vandalism' },
  { value: 'accessibility', label: 'Accessibility Issue' },
  { value: 'other', label: 'Other' },
];

const SOURCES = [
  { value: '', label: 'All sources' },
  { value: 'community', label: 'Community' },
  { value: 'reddit', label: 'Reddit' },
];

interface BulletinResponse {
  items: BulletinItem[];
  total: number;
  has_more: boolean;
}

function buildParams(offset: number, filters: Filters): URLSearchParams {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
  if (filters.location) params.set('location', filters.location);
  if (filters.dateFrom) params.set('date_from', filters.dateFrom);
  if (filters.dateTo) params.set('date_to', filters.dateTo);
  if (filters.sourcePlatform) params.set('source_platform', filters.sourcePlatform);
  if (filters.communityBacked) params.set('community_backed', 'true');
  if (filters.avCompany) params.set('av_company', filters.avCompany);
  if (filters.incidentType) params.set('incident_type', filters.incidentType);
  params.set('sort_by', 'occurred_at');
  return params;
}

async function fetchBulletin(offset: number, filters: Filters): Promise<BulletinResponse> {
  const params = buildParams(offset, filters);
  const res = await fetch(`${BACKEND_URL}/api/bulletin?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  return res.json();
}

function countActiveFilters(f: Filters): number {
  let n = 0;
  if (f.location) n++;
  if (f.dateFrom || f.dateTo) n++;
  if (f.sourcePlatform) n++;
  if (f.communityBacked) n++;
  if (f.avCompany) n++;
  if (f.incidentType) n++;
  return n;
}

const selectClass =
  'h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 cursor-pointer min-w-0';
const inputClass =
  'h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 placeholder:text-slate-400 min-w-0';

function FilterControls({
  filters,
  locationInput,
  onLocationInput,
  onChange,
  onClear,
}: {
  filters: Filters;
  locationInput: string;
  onLocationInput: (v: string) => void;
  onChange: (key: keyof Filters, value: string | boolean) => void;
  onClear: () => void;
}) {
  const activeCount = countActiveFilters(filters);

  return (
    <div className="flex flex-col gap-3">
      {/* Row 1: location + date range */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
          <input
            type="text"
            aria-label="Search by location"
            placeholder="Search by location…"
            value={locationInput}
            onChange={(e) => onLocationInput(e.target.value)}
            className={`${inputClass} pl-7 w-full`}
          />
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <input
            type="date"
            aria-label="From date"
            value={filters.dateFrom}
            onChange={(e) => onChange('dateFrom', e.target.value)}
            className={`${inputClass} w-36`}
          />
          <span className="text-slate-400 text-xs shrink-0" aria-hidden="true">–</span>
          <input
            type="date"
            aria-label="To date"
            value={filters.dateTo}
            onChange={(e) => onChange('dateTo', e.target.value)}
            className={`${inputClass} w-36`}
          />
        </div>
      </div>

      {/* Row 2: dropdowns + verified toggle + clear */}
      <div className="flex flex-wrap gap-2 items-center">
        <select
          aria-label="Filter by company"
          value={filters.avCompany}
          onChange={(e) => onChange('avCompany', e.target.value)}
          className={selectClass}
        >
          {COMPANIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>

        <select
          aria-label="Filter by incident type"
          value={filters.incidentType}
          onChange={(e) => onChange('incidentType', e.target.value)}
          className={selectClass}
        >
          {INCIDENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        <select
          aria-label="Filter by source"
          value={filters.sourcePlatform}
          onChange={(e) => onChange('sourcePlatform', e.target.value)}
          className={selectClass}
        >
          {SOURCES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        <label className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white cursor-pointer text-xs text-slate-700 hover:bg-slate-50 select-none shrink-0">
          <input
            type="checkbox"
            checked={filters.communityBacked}
            onChange={(e) => onChange('communityBacked', e.target.checked)}
            className="h-3.5 w-3.5 accent-blue-500 shrink-0"
          />
          Community-verified only
        </label>

        {activeCount > 0 && (
          <button
            onClick={onClear}
            className="flex items-center gap-1 h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition shrink-0"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}

function FilterBar({
  filters,
  locationInput,
  onLocationInput,
  onChange,
  onClear,
}: {
  filters: Filters;
  locationInput: string;
  onLocationInput: (v: string) => void;
  onChange: (key: keyof Filters, value: string | boolean) => void;
  onClear: () => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeCount = countActiveFilters(filters);

  return (
    <div className="mb-8">
      {/* Mobile toggle button */}
      <div className="flex items-center gap-2 sm:hidden">
        <button
          onClick={() => setMobileOpen((v) => !v)}
          aria-expanded={mobileOpen}
          aria-controls="bulletin-mobile-filters"
          className="flex items-center gap-2 h-9 px-4 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 transition shadow-sm focus:outline-none focus:ring-2 focus:ring-[#5B9DFF]"
        >
          <Filter className="h-4 w-4" aria-hidden="true" />
          Filters
          {activeCount > 0 && (
            <span className="flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-blue-500 text-white text-[10px] font-bold leading-none">
              {activeCount}
            </span>
          )}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${mobileOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        {activeCount > 0 && (
          <button onClick={onClear} className="text-xs text-slate-500 hover:text-slate-700 transition focus:outline-none focus:ring-2 focus:ring-[#5B9DFF] focus:rounded">
            Clear all
          </button>
        )}
      </div>

      {/* Mobile panel */}
      {mobileOpen && (
        <div id="bulletin-mobile-filters" className="sm:hidden mt-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <FilterControls
            filters={filters}
            locationInput={locationInput}
            onLocationInput={onLocationInput}
            onChange={onChange}
            onClear={onClear}
          />
        </div>
      )}

      {/* Desktop: always visible */}
      <div className="hidden sm:block rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <FilterControls
          filters={filters}
          locationInput={locationInput}
          onLocationInput={onLocationInput}
          onChange={onChange}
          onClear={onClear}
        />
      </div>
    </div>
  );
}

export default function BulletinPage() {
  const [items, setItems] = useState<BulletinItem[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [locationInput, setLocationInput] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchId = useRef(0);

  // Debounce location text into filters
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => ({ ...prev, location: locationInput }));
    }, 400);
    return () => clearTimeout(timer);
  }, [locationInput]);

  const load = useCallback(async (currentFilters: Filters) => {
    const id = ++fetchId.current;
    setIsLoading(true);
    setItems([]);
    setError(null);
    try {
      const data = await fetchBulletin(0, currentFilters);
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
      const data = await fetchBulletin(offset, filters);
      setItems((prev) => [...prev, ...data.items]);
      setTotal(data.total);
      setHasMore(data.has_more);
      setOffset((prev) => prev + PAGE_SIZE);
    } catch {
      // silent
    } finally {
      setIsLoadingMore(false);
    }
  }, [offset, isLoadingMore, filters]);

  useEffect(() => {
    load(filters);
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleFilterChange(key: keyof Filters, value: string | boolean) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function handleClearFilters() {
    setLocationInput('');
    setFilters(DEFAULT_FILTERS);
  }

  const activeCount = countActiveFilters(filters);

  return (
    <div className="min-h-screen bg-slate-50 pt-20 pb-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Page header */}
        <div className="py-10 pb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#2C3E50] tracking-tight">
              Recent Reports
            </h1>
            <p className="mt-2 text-slate-500 text-sm max-w-xl">
              {filters.sourcePlatform === 'community'
                ? 'Incidents submitted directly by AV Watch users.'
                : 'Incidents aggregated from Reddit communities. Updated hourly.'}
            </p>
          </div>

          {/* Source toggle */}
          <div className="flex shrink-0 items-center gap-1 p-1 rounded-xl bg-slate-200/70 self-start sm:self-auto">
            <button
              onClick={() => setFilters((p) => ({ ...p, sourcePlatform: 'community' }))}
              aria-pressed={filters.sourcePlatform === 'community'}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                filters.sourcePlatform === 'community'
                  ? 'bg-white text-[#2C3E50] shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              AV Watch
            </button>
            <button
              onClick={() => setFilters((p) => ({ ...p, sourcePlatform: 'reddit' }))}
              aria-pressed={filters.sourcePlatform === 'reddit'}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                filters.sourcePlatform === 'reddit'
                  ? 'bg-white text-[#2C3E50] shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Reddit
            </button>
          </div>
        </div>

        {/* Filters */}
        <FilterBar
          filters={filters}
          locationInput={locationInput}
          onLocationInput={setLocationInput}
          onChange={handleFilterChange}
          onClear={handleClearFilters}
        />

        {/* Result count when filtered */}
        {!isLoading && !error && activeCount > 0 && (
          <p className="mb-4 text-xs text-slate-500">
            {total === 0
              ? 'No reports match these filters'
              : `${total} ${total === 1 ? 'report' : 'reports'} found`}
          </p>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-72 rounded-2xl border border-slate-200 bg-white animate-pulse motion-reduce:animate-none" />
            ))}
          </div>
        )}

        {/* Error */}
        {!isLoading && error && (
          <div role="alert" className="flex flex-col items-center justify-center py-24 text-center">
            <AlertCircle className="h-10 w-10 text-slate-300 mb-3" aria-hidden="true" />
            <p className="text-slate-500 font-medium">Could not load reports</p>
            <p className="text-slate-400 text-sm mt-1">{error}</p>
            <button
              onClick={() => load(filters)}
              className="mt-4 rounded-lg bg-[#5B9DFF] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !error && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <span className="text-5xl mb-4" aria-hidden="true">🔍</span>
            <p className="text-slate-500 font-medium">
              {activeCount > 0 ? 'No reports match these filters' : 'No reports yet'}
            </p>
            <p className="text-slate-400 text-sm mt-1 max-w-sm">
              {activeCount > 0
                ? 'Try adjusting or clearing your filters.'
                : 'The pipeline runs every hour. Check back soon.'}
            </p>
            {activeCount > 0 && (
              <button
                onClick={handleClearFilters}
                className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
              >
                Clear filters
              </button>
            )}
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
                    <RefreshCw className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  )}
                  {isLoadingMore ? 'Loading…' : `Load more (${total - items.length} remaining)`}
                </button>
              </div>
            )}

            {!hasMore && total > PAGE_SIZE && (
              <p className="mt-10 text-center text-xs text-slate-500">
                All {total} incidents loaded
              </p>
            )}
          </>
        )}

      </div>
    </div>
  );
}
