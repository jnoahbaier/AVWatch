'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { Controller, type FieldErrors, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  MapPin,
  CheckCircle,
  ChevronDown,
  CarFront,
  Loader2,
  Upload,
  Camera,
  X,
  Users,
  EyeOff,
  LockOpen,
  Search,
  Map,
  TriangleAlert,
  TrafficCone,
  SprayCan,
  Accessibility,
  CircleHelp,
  Calendar,
  ArrowDown,
  Filter,
  ExternalLink,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import {
  INCIDENT_TYPE_LABELS,
  INCIDENT_TYPE_HELP_TEXT,
  INCIDENT_TYPE_ORDER,
  REPORT_COMPANY_OPTIONS,
} from '@/lib/utils';

import { BulletinCard, type BulletinItem } from '@/components/bulletin/BulletinCard';
import { NewsHeadlines } from '@/components/news/NewsHeadlines';
import { track, Events } from '@/lib/analytics';

const LocationMapPicker = dynamic(
  () => import('@/components/LocationMapPicker').then((m) => m.LocationMapPicker),
  { ssr: false }
);

// Use FastAPI backend directly (same as /bulletin page) to support all filters including source_platform.
// Falls back to the Next.js Supabase proxy if the env var is not set.
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const BULLETIN_API = BACKEND_URL ? `${BACKEND_URL}/api/bulletin` : '/api/bulletin';
const REPORTS_PAGE = 6;

interface ReportFilters {
  location: string;
  dateFrom: string;
  dateTo: string;
  avCompany: string;
  incidentType: string;
  sourcePlatform: string;
}

const DEFAULT_REPORT_FILTERS: ReportFilters = {
  location: '',
  dateFrom: '',
  dateTo: '',
  avCompany: '',
  incidentType: '',
  sourcePlatform: 'community',
};

const FILTER_COMPANIES = [
  { value: '', label: 'All companies' },
  { value: 'waymo', label: 'Waymo' },
  { value: 'zoox', label: 'Zoox' },
  { value: 'tesla', label: 'Tesla' },
  { value: 'other', label: 'Other' },
  { value: 'unknown', label: 'Unsure' },
];

const FILTER_INCIDENT_TYPES = [
  { value: '', label: 'All incident types' },
  { value: 'sudden_behavior', label: 'Reckless Driving' },
  { value: 'blockage', label: 'Blocking Traffic' },
  { value: 'collision', label: 'Collision' },
  { value: 'vandalism', label: 'Vandalism' },
  { value: 'accessibility', label: 'Accessibility Issue' },
  { value: 'other', label: 'Other' },
];

function buildReportParams(offset: number, filters: ReportFilters): string {
  const p = new URLSearchParams({ limit: String(REPORTS_PAGE), offset: String(offset) });
  if (filters.location) p.set('location', filters.location);
  if (filters.dateFrom) p.set('date_from', filters.dateFrom);
  if (filters.dateTo) p.set('date_to', filters.dateTo);
  if (filters.avCompany) p.set('av_company', filters.avCompany);
  if (filters.incidentType) p.set('incident_type', filters.incidentType);
  if (filters.sourcePlatform) p.set('source_platform', filters.sourcePlatform);
  return p.toString();
}

function countReportFilters(f: ReportFilters): number {
  let n = 0;
  if (f.location) n++;
  if (f.dateFrom || f.dateTo) n++;
  if (f.avCompany) n++;
  if (f.incidentType) n++;
  return n;
}

const INCIDENT_ICONS = {
  sudden_behavior: CarFront,
  blockage: TrafficCone,
  collision: TriangleAlert,
  accessibility: Accessibility,
  vandalism: SprayCan,
  other: CircleHelp,
};

const OPTIONAL_LABEL_CLASS = 'font-normal normal-case text-slate-400';
const REPORTER_CONTEXT_OPTIONS = [
  { value: 'directly_involved', label: 'I was directly involved' },
  { value: 'bystander', label: 'I was a bystander' },
] as const;
const emptyToUndefined = (value: unknown) =>
  value === '' || value === null ? undefined : value;

const reportSchema = z.object({
  incident_type: z.enum([
    'collision',
    'accessibility',
    'sudden_behavior',
    'blockage',
    'vandalism',
    'other',
  ]),
  av_company: z.preprocess(
    emptyToUndefined,
    z.enum(['waymo', 'zoox', 'tesla', 'other', 'unknown']).optional()
  ),
  other_av_company: z.string().max(120).optional(),
  description: z.string().max(2000).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().optional(),
  city: z.string().optional(),
  occurred_at: z.string(),
  reporter_context: z.preprocess(
    emptyToUndefined,
    z.enum(['directly_involved', 'bystander']).optional()
  ),
  contact_name: z.string().optional(),
  contact_email: z.string().email().optional().or(z.literal('')),
}).superRefine((data, ctx) => {
  if (data.incident_type === 'other' && !data.description?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['description'],
      message: 'Please tell us what happened.',
    });
  }
  if (!data.reporter_context) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['reporter_context'],
      message: 'Please select an option.',
    });
  }
  if (data.av_company === 'other' && !data.other_av_company?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['other_av_company'],
      message: 'Please tell us which company.',
    });
  }
});

type ReportFormData = z.infer<typeof reportSchema>;

function getLocalDateTimeValue(date = new Date()) {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

const PIPELINE_STEPS = [
  { title: 'Report received', desc: 'Stored securely in our database.' },
  { title: 'Reviewed by our team', desc: 'Checked for accuracy and completeness.' },
  { title: 'Corroborated', desc: 'Linked with nearby reports to build credibility.' },
  { title: 'Shared with regulators', desc: 'Validated reports forwarded to relevant agencies.' },
];

// ── BulletinRow: news-style compact row for the homepage reports list ──────

const BULLETIN_COMPANY_COLORS: Record<string, string> = {
  waymo:    'bg-blue-50 text-blue-700 border border-blue-200',
  zoox:     'bg-purple-50 text-purple-700 border border-purple-200',
  cruise:   'bg-orange-50 text-orange-700 border border-orange-200',
  tesla:    'bg-red-50 text-red-700 border border-red-200',
  unknown:  'bg-slate-50 text-slate-600 border border-slate-200',
};

const BULLETIN_COMPANY_FALLBACK_BG: Record<string, string> = {
  waymo:    'bg-blue-100 text-blue-600',
  zoox:     'bg-purple-100 text-purple-600',
  cruise:   'bg-orange-100 text-orange-600',
  tesla:    'bg-red-100 text-red-600',
};

function bulletinTimeAgo(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function BulletinRow({ item }: { item: BulletinItem }) {
  const isCommunity = item.source_platform === 'community';
  const company = item.av_company?.toLowerCase() ?? '';
  const badgeClass = BULLETIN_COMPANY_COLORS[company] ?? BULLETIN_COMPANY_COLORS.unknown;
  const fallbackBg = BULLETIN_COMPANY_FALLBACK_BG[company] ?? 'bg-slate-100 text-slate-500';
  const initial = company ? company[0].toUpperCase() : '?';
  const age = bulletinTimeAgo(item.first_seen_at);

  const inner = (
    <div className="group -mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition hover:bg-slate-50 sm:gap-4 sm:py-4">
      {/* Thumbnail */}
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg sm:h-14 sm:w-14 ${item.image_url ? 'bg-slate-100' : fallbackBg}`}>
        {item.image_url ? (
          <img
            src={item.image_url}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            onError={(e) => {
              const el = e.currentTarget as HTMLImageElement;
              el.style.display = 'none';
              el.parentElement!.classList.add(...fallbackBg.split(' '));
              el.parentElement!.innerHTML = `<span class="text-lg font-bold">${initial}</span>`;
            }}
          />
        ) : (
          <span className="text-lg font-bold">{initial}</span>
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="mb-1 flex items-center gap-2 flex-wrap">
          {item.av_company && (
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}>
              {item.av_company.charAt(0).toUpperCase() + item.av_company.slice(1)}
            </span>
          )}
          {isCommunity && (
            <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              Community
            </span>
          )}
          {age && <span className="text-xs text-slate-500">{age}</span>}
        </div>
        <p className="line-clamp-2 text-sm font-semibold text-[#2C3E50] group-hover:text-[#5B9DFF] transition leading-snug">
          {item.title}
        </p>
        {item.location_text && (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 truncate">
            <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
            {item.location_text}
          </p>
        )}
      </div>

      {/* Arrow */}
      <ExternalLink className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-[#5B9DFF]" aria-hidden="true" />
    </div>
  );

  if (item.source_url) {
    return (
      <a href={item.source_url} target="_blank" rel="noopener noreferrer" aria-label={`${item.title} (opens in new tab)`}>
        {inner}
        <span className="sr-only">(opens in new tab)</span>
      </a>
    );
  }

  return <div>{inner}</div>;
}

function BulletinRowSkeleton() {
  return (
    <div className="flex items-center gap-3 py-3 sm:gap-4 sm:py-4 animate-pulse motion-reduce:animate-none">
      <div className="h-12 w-12 shrink-0 rounded-lg bg-slate-200 sm:h-14 sm:w-14" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-20 rounded bg-slate-200" />
        <div className="h-4 w-full rounded bg-slate-200" />
        <div className="h-4 w-3/4 rounded bg-slate-200" />
      </div>
    </div>
  );
}

export default function Home() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [locationStatus, setLocationStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isCertified, setIsCertified] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const carRef = useRef<HTMLDivElement>(null);
  const formStartedRef = useRef(false);
  const incidentSectionRef = useRef<HTMLDivElement>(null);
  const locationSectionRef = useRef<HTMLDivElement>(null);
  const reporterSectionRef = useRef<HTMLDivElement>(null);
  const optionalDetailsRef = useRef<HTMLDetailsElement>(null);
  const certRef = useRef<HTMLLabelElement>(null);
  const dateTimeInputRef = useRef<HTMLInputElement | null>(null);
  const [carInView, setCarInView] = useState(false);
  const [locationMethod, setLocationMethod] = useState<'gps' | 'address' | 'map'>('gps');

  // Recent reports inline state
  const [reportItems, setReportItems] = useState<BulletinItem[]>([]);
  const [reportTotal, setReportTotal] = useState(0);
  const [reportOffset, setReportOffset] = useState(0);
  const [reportHasMore, setReportHasMore] = useState(false);
  const [reportInitialLoading, setReportInitialLoading] = useState(true);
  const [reportLoadingMore, setReportLoadingMore] = useState(false);
  const [mobileShowAll, setMobileShowAll] = useState(false);
  const [reportFilters, setReportFilters] = useState<ReportFilters>(DEFAULT_REPORT_FILTERS);
  const [reportLocationInput, setReportLocationInput] = useState('');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const reportFetchId = useRef(0);
  const [pipelinePhase, setPipelinePhase] = useState(0);
  const [addressQuery, setAddressQuery] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Array<{
    place_name: string;
    center: [number, number];
    context: { id: string; text: string }[];
  }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = carRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setCarInView(true); },
      { threshold: 0.05 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Eagerly preload the LocationMapPicker + mapbox-gl bundles in the background
  // so "Pin on Map" opens instantly instead of waiting for a cold download.
  useEffect(() => {
    const preload = () => {
      import('@/components/LocationMapPicker').catch(() => {});
      import('mapbox-gl').catch(() => {});
    };
    if ('requestIdleCallback' in window) {
      const id = (window as Window & { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(preload);
      return () => (window as Window & { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(id);
    } else {
      const t = setTimeout(preload, 2000);
      return () => clearTimeout(t);
    }
  }, []);

  // Debounce location filter
  useEffect(() => {
    const timer = setTimeout(() => {
      setReportFilters((prev) => ({ ...prev, location: reportLocationInput }));
    }, 400);
    return () => clearTimeout(timer);
  }, [reportLocationInput]);

  // Pipeline step animation: 0–3 active, 4 = all done pause
  // useEffect(() => {
  //   const delay = pipelinePhase === 4 ? 1200 : 1800;
  //   const t = setTimeout(() => setPipelinePhase((p) => (p + 1) % 5), delay);
  //   return () => clearTimeout(t);
  // }, [pipelinePhase]);

  // Fetch reports (re-runs when filters change)
  useEffect(() => {
    const fetchId = ++reportFetchId.current;
    setReportInitialLoading(true);
    setReportItems([]);
    setReportOffset(0);
    setMobileShowAll(false);
    async function fetchReports() {
      try {
        const res = await fetch(`${BULLETIN_API}?${buildReportParams(0, reportFilters)}`);
        const data = await res.json();
        if (reportFetchId.current !== fetchId) return;
        setReportItems(data.items ?? []);
        setReportTotal(data.total ?? 0);
        setReportHasMore(data.has_more ?? false);
      } catch {
        // silent — section just stays empty
      } finally {
        if (reportFetchId.current === fetchId) setReportInitialLoading(false);
      }
    }
    fetchReports();
  }, [reportFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadMoreReports() {
    setReportLoadingMore(true);
    const nextOffset = reportOffset + REPORTS_PAGE;
    try {
      const res = await fetch(`${BULLETIN_API}?${buildReportParams(nextOffset, reportFilters)}`);
      const data = await res.json();
      setReportItems((prev) => [...prev, ...(data.items ?? [])]);
      setReportOffset(nextOffset);
      setReportHasMore(data.has_more ?? false);
    } catch {
      // silent
    } finally {
      setReportLoadingMore(false);
    }
  }

  const {
    control,
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ReportFormData>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      occurred_at: getLocalDateTimeValue(),
    },
  });

  const watchedType = watch('incident_type');
  const watchedReporterContext = watch('reporter_context');
  const watchedCompany = watch('av_company');
  const watchedDescription = watch('description');
  const watchedLat = watch('latitude');
  const watchedLng = watch('longitude');
  const watchedAddress = watch('address');

  const hasLocation =
    typeof watchedLat === 'number' &&
    !isNaN(watchedLat) &&
    typeof watchedLng === 'number' &&
    !isNaN(watchedLng);

  const toggleChoice = (
    field: 'incident_type' | 'av_company',
    currentValue: string | undefined,
    nextValue: string,
    clearField?: 'other_av_company'
  ) => {
    handleFormInteraction();
    const shouldClear = currentValue === nextValue;

    setValue(field as never, (shouldClear ? undefined : nextValue) as never, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });

    if (clearField && (shouldClear || nextValue !== 'other')) {
      setValue(clearField as never, '' as never, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
    }
  };

  const getLocation = () => {
    setLocationStatus('loading');
    if (!navigator.geolocation) {
      setLocationStatus('error');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setValue('latitude', position.coords.latitude);
        setValue('longitude', position.coords.longitude);
        try {
          const res = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${position.coords.longitude},${position.coords.latitude}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`
          );
          const data = await res.json();
          if (data.features?.[0]) {
            setValue('address', data.features[0].place_name);
            const context = data.features[0].context || [];
            const cityCtx = context.find((c: { id: string }) =>
              c.id.startsWith('place.')
            );
            if (cityCtx) setValue('city', cityCtx.text);
          }
        } catch {
          // geocoding failure is non-fatal
        }
        setLocationStatus('success');
      },
      () => setLocationStatus('error')
    );
  };

  const fetchSuggestions = (query: string) => {
    if (suggestTimeoutRef.current) clearTimeout(suggestTimeoutRef.current);
    if (!query.trim()) { setSuggestions([]); setShowSuggestions(false); return; }
    suggestTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}&autocomplete=true&limit=5&country=us`
        );
        const data = await res.json();
        setSuggestions(data.features ?? []);
        setShowSuggestions(true);
      } catch { /* silent */ }
    }, 250);
  };

  const applySuggestion = (s: { place_name: string; center: [number, number]; context: { id: string; text: string }[] }) => {
    const [lng, lat] = s.center;
    setValue('latitude', lat);
    setValue('longitude', lng);
    setValue('address', s.place_name);
    const cityCtx = s.context?.find((c) => c.id.startsWith('place.'));
    if (cityCtx) setValue('city', cityCtx.text);
    setAddressQuery(s.place_name);
    setLocationStatus('success');
    setSuggestions([]);
    setShowSuggestions(false);
    setGeocodeError(null);
  };

  const geocodeAddress = async () => {
    if (!addressQuery.trim()) return;
    setIsGeocoding(true);
    setGeocodeError(null);
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(addressQuery)}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}&limit=1`
      );
      const data = await res.json();
      if (data.features?.[0]) {
        const [lng, lat] = data.features[0].center;
        setValue('latitude', lat);
        setValue('longitude', lng);
        setValue('address', data.features[0].place_name);
        const context = data.features[0].context || [];
        const cityCtx = context.find((c: { id: string }) => c.id.startsWith('place.'));
        if (cityCtx) setValue('city', cityCtx.text);
        setLocationStatus('success');
      } else {
        setGeocodeError('Address not found. Try a more specific location.');
      }
    } catch {
      setGeocodeError('Could not look up address. Please try again.');
    } finally {
      setIsGeocoding(false);
    }
  };

  /** Fire report_form_started once per session on first field interaction */
  const handleFormInteraction = () => {
    if (!formStartedRef.current) {
      formStartedRef.current = true;
      track(Events.FORM_STARTED);
    }
  };

  const onSubmit = async (data: ReportFormData) => {
    if (!hasLocation) {
      setSubmitError('Please provide a location using one of the options above.');
      return;
    }
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const { createIncident, uploadIncidentMedia } = await import('@/lib/supabase');

      // Upload media first (if any) — goes directly to Supabase Storage CDN
      let mediaUrls: string[] = [];
      if (selectedFiles.length > 0) {
        setUploadProgress(
          `Uploading ${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''}…`
        );
        mediaUrls = await uploadIncidentMedia(selectedFiles);
        setUploadProgress(null);
      }

      const descriptionParts = [
        data.av_company === 'other' && data.other_av_company?.trim()
          ? `AV company: ${data.other_av_company.trim()}`
          : null,
        data.description?.trim() ? data.description.trim() : null,
      ].filter(Boolean);

      const description = descriptionParts.length > 0
        ? descriptionParts.join('\n\n')
        : undefined;

      await createIncident({
        incident_type: data.incident_type,
        av_company: data.av_company,
        description,
        latitude: data.latitude,
        longitude: data.longitude,
        address: data.address,
        city: data.city,
        occurred_at: new Date(data.occurred_at).toISOString(),
        reporter_type: data.reporter_context ?? undefined,
        contact_name: data.contact_name || undefined,
        contact_email: data.contact_email || undefined,
        media_urls: mediaUrls,
      });

      track(Events.REPORT_SUBMITTED, {
        incident_type: data.incident_type,
        av_company: data.av_company,
        has_media: mediaUrls.length > 0,
        has_description: !!description,
        reporter_type: data.reporter_context ?? null,
      });

      setIsSuccess(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : 'Failed to submit. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  };

  const onInvalidSubmit = (invalidErrors: FieldErrors<ReportFormData>) => {
    if (invalidErrors.description?.message && watchedType === 'other') {
      setSubmitError(invalidErrors.description.message);
      incidentSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (invalidErrors.reporter_context?.message) {
      setSubmitError(
        invalidErrors.reporter_context?.message ??
          'Please tell us whether you were directly involved or a bystander.'
      );
      reporterSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (invalidErrors.other_av_company?.message) {
      setSubmitError(invalidErrors.other_av_company.message);
      reporterSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setSubmitError('Please complete the highlighted required fields before submitting.');

    if (!watchedType) {
      incidentSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (!hasLocation) {
      locationSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (!watchedReporterContext) {
      reporterSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (watchedType === 'other' && !watchedDescription?.trim()) {
      incidentSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (watchedCompany === 'other') {
      reporterSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleReset = () => {
    setIsSuccess(false);
    setLocationStatus('idle');
    setSelectedFiles([]);
    setSubmitError(null);
    setIsCertified(false);
    reset({
      av_company: undefined,
      reporter_context: undefined,
      other_av_company: '',
      description: '',
      occurred_at: getLocalDateTimeValue(),
    });
  };

  return (
    <div className="min-h-screen">

      {/* ─────────────────────── HERO / REPORT ─────────────────────── */}
      <section
        id="report"
        className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-indigo-50"
      >
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/80 via-white to-indigo-50/60" />

        {/* Graph-paper grid — fades out toward center/bottom */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(99,155,255,0.07) 1px, transparent 1px),
              linear-gradient(90deg, rgba(99,155,255,0.07) 1px, transparent 1px)
            `,
            backgroundSize: '44px 44px',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 20% 30%, black 30%, transparent 80%)',
            maskImage: 'radial-gradient(ellipse 80% 70% at 20% 30%, black 30%, transparent 80%)',
          }}
        />

        {/* Soft blue blob — top left */}
        <div className="absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full bg-blue-200/25 blur-3xl pointer-events-none" />
        {/* Soft indigo blob — bottom right */}
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-indigo-200/20 blur-3xl pointer-events-none" />
        {/* Accent glow — top right */}
        <div className="absolute top-20 right-1/3 w-64 h-64 rounded-full bg-blue-300/10 blur-2xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_460px] gap-6 lg:gap-16 items-start">

            {/* ── LEFT: copy + imagery ── */}
            <div className="pt-4 flex flex-col min-h-[calc(100svh-7rem)] sm:min-h-0 lg:min-h-0">
                <h1 className="text-5xl lg:text-6xl font-bold text-[#2C3E50] leading-[1.1] mb-5">
                  Witnessed an<br />
                  <span className="text-[#5B9DFF]">autonomous vehicle incident?</span>
                </h1>

                <p className="text-xl text-slate-600 mb-3 leading-relaxed">
                  Report it here to make autonomous driving safer for everyone.
                </p>

              {/* Mobile CTA — only on small screens where form is below the fold */}
              <div className="sm:hidden flex-1 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => document.getElementById('report-form')?.scrollIntoView({ behavior: 'smooth' })}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#5B9DFF] hover:bg-[#3A72D9] text-white font-semibold text-base shadow-md transition-colors"
                >
                  Report an Incident Now
                  <ArrowDown className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              {/* Trust indicators — desktop only */}
              <div className="hidden lg:flex flex-wrap gap-3 mt-2">
                {[
                  { icon: EyeOff, label: 'Anonymous' },
                  { icon: LockOpen, label: 'No account needed' },
                  { icon: Users, label: 'Community-driven' },
                ].map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    className="flex items-center gap-2 px-3 py-2 rounded-full bg-white border border-slate-200 shadow-sm text-sm text-slate-700 font-medium"
                  >
                    <span className="flex items-center justify-center w-6 h-6 rounded-full" style={{ backgroundColor: '#E6F0FA' }}>
                      <Icon className="w-3.5 h-3.5 text-[#5B9DFF]" aria-hidden="true" />
                    </span>
                    {label}
                  </div>
                ))}
              </div>

              {/* AV car imagery — drives in from left on scroll (desktop only) */}
              <div
                ref={carRef}
                className={`hidden lg:block relative mt-20 lg:mt-24 lg:-mr-32 lg:-translate-y-16 xl:-translate-y-20 transition-all duration-[1100ms] ease-out ${
                  carInView
                    ? 'translate-x-0 opacity-100'
                    : 'lg:-translate-x-full opacity-0'
                }`}
              >
                <img
                  src="/zoox-transparent.jpg"
                  alt="Zoox autonomous vehicle"
                  className="w-full max-w-[560px] mx-auto lg:mx-0 object-contain drop-shadow-2xl"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              </div>
            </div>

            {/* ── RIGHT: Report Form ── */}
            <div id="report-form" className="md:sticky md:top-24 scroll-mt-20">
              {isSuccess ? (
                /* Success state */
                <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
                  {/* Header */}
                  <div className="bg-[#5B9DFF] px-8 py-8 text-center">
                    <div className="mx-auto w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mb-4">
                      <CheckCircle className="w-8 h-8 text-white" aria-hidden="true" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-1">
                      Thank You!
                    </h2>
                    <p className="text-white/90 text-sm">
                      Your report has been submitted successfully.
                    </p>
                  </div>

                  <div className="px-8 py-6">
                    <p className="text-slate-600 text-sm text-center mb-6">
                      Here&apos;s what happens next with your report:
                    </p>

                    {/* Flowchart */}
                    <div className="space-y-1">
                      {/* Step 1 — completed */}
                      <div className="flex gap-4 items-start">
                        <div className="flex flex-col items-center">
                          <div className="w-9 h-9 rounded-full bg-[#5B9DFF] text-white flex items-center justify-center text-sm font-bold shrink-0">
                            1
                          </div>
                          <div className="w-0.5 h-6 bg-[#5B9DFF]/40 mt-1" />
                        </div>
                        <div className="pb-4 pt-1">
                          <p className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                            Report received
                            <span className="text-xs font-medium text-[#5B9DFF] bg-blue-50 px-2 py-0.5 rounded-full">Done</span>
                          </p>
                          <p className="text-slate-500 text-xs mt-0.5">Your report is stored in our database.</p>
                        </div>
                      </div>

                      {/* Step 2 — up next */}
                      <div className="flex gap-4 items-start">
                        <div className="flex flex-col items-center">
                          <div className="w-9 h-9 rounded-full border-2 border-[#5B9DFF] text-[#5B9DFF] flex items-center justify-center text-sm font-bold shrink-0" style={{ backgroundColor: '#E6F0FA' }}>
                            2
                          </div>
                          <div className="w-0.5 h-6 bg-slate-200 mt-1" />
                        </div>
                        <div className="pb-4 pt-1">
                          <p className="font-semibold text-slate-700 text-sm">Reviewed by our team</p>
                          <p className="text-slate-500 text-xs mt-0.5">Our team checks the report for accuracy and completeness.</p>
                        </div>
                      </div>

                      {/* Step 3 */}
                      <div className="flex gap-4 items-start">
                        <div className="flex flex-col items-center">
                          <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-sm font-bold shrink-0">
                            3
                          </div>
                          <div className="w-0.5 h-6 bg-slate-200 mt-1" />
                        </div>
                        <div className="pb-4 pt-1">
                          <p className="font-semibold text-slate-500 text-sm">Corroborated with similar reports</p>
                          <p className="text-slate-500 text-xs mt-0.5">Reports near the same location &amp; time are linked together to build credibility.</p>
                        </div>
                      </div>

                      {/* Step 4 */}
                      <div className="flex gap-4 items-start">
                        <div className="flex flex-col items-center">
                          <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-sm font-bold shrink-0">
                            4
                          </div>
                        </div>
                        <div className="pt-1">
                          <p className="font-semibold text-slate-500 text-sm">Shared with regulators</p>
                          <p className="text-slate-500 text-xs mt-0.5">Validated reports are forwarded to relevant agencies.</p>
                        </div>
                      </div>
                    </div>

                    {/* CTAs */}
                    <div className="mt-6 space-y-2">
                      <a
                        href="#reports"
                        onClick={handleReset}
                        className="block w-full px-5 py-3 bg-[#5B9DFF] hover:bg-[#3A72D9] text-white rounded-xl font-semibold text-sm text-center transition shadow-sm"
                      >
                        View Recent Incidents
                      </a>
                      <button
                        onClick={handleReset}
                        className="block w-full px-5 py-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-semibold text-sm text-center transition"
                      >
                        Submit Another Report
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Form */
                <form
                  onSubmit={handleSubmit(onSubmit, onInvalidSubmit)}
                >
                  <div className="bg-white rounded-2xl shadow-xl border border-slate-100 divide-y divide-slate-100">

                    {/* Header */}
                    <div className="px-6 pt-6 pb-4">
                      <h2 className="text-lg font-bold text-[#2C3E50]">
                        Report an Incident
                      </h2>
                      <p className="sr-only">Fields marked with an asterisk (*) are required.</p>
                    </div>

                    {/* Section 1: What happened */}
                    <div ref={incidentSectionRef} className="p-6">
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">
                        What happened? <span className="text-red-500">*</span>
                      </p>
                      <input type="hidden" {...register('incident_type')} />
                      <div className="grid grid-cols-2 gap-2">
                        {INCIDENT_TYPE_ORDER.map((value) => {
                          const label = INCIDENT_TYPE_LABELS[value];
                          return (
                            <button
                              key={value}
                              type="button"
                              aria-pressed={watchedType === value}
                              onClick={() =>
                                toggleChoice(
                                  'incident_type',
                                  watchedType,
                                  value as Exclude<ReportFormData['incident_type'], undefined>
                                )
                              }
                              className={`flex items-center gap-2 p-2.5 sm:p-3.5 rounded-xl border-2 cursor-pointer transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5B9DFF] ${
                                watchedType === value
                                  ? 'border-[#5B9DFF] bg-blue-50'
                                  : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/50'
                              }`}
                            >
                              <span
                                className="flex h-9 w-9 shrink-0 items-center justify-center self-center rounded-lg"
                                style={{ backgroundColor: '#E6F0FA' }}
                                aria-hidden="true"
                              >
                                {(() => {
                                  const Icon = INCIDENT_ICONS[value as keyof typeof INCIDENT_ICONS];
                                  return (
                                    <Icon
                                      className={`h-5.5 w-5.5 text-[#5B9DFF]${value === 'vandalism' ? ' -scale-x-100' : ''}`}
                                    />
                                  );
                                })()}
                              </span>
                              <span
                                className={`font-medium text-xs sm:text-sm text-left leading-tight ${
                                  watchedType === value
                                    ? 'text-blue-700'
                                    : 'text-slate-700'
                                }`}
                              >
                                {label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      {watchedType && ['sudden_behavior', 'accessibility'].includes(watchedType) && (
                        <p className="mt-3 text-sm leading-relaxed text-slate-600">
                          {INCIDENT_TYPE_HELP_TEXT[watchedType]}
                        </p>
                      )}
                      {watchedType && (
                        <div className="mt-3">
                          <textarea
                            {...register('description', { onChange: handleFormInteraction })}
                            rows={3}
                            aria-label="Description"
                            aria-describedby={errors.description ? 'desc-error' : undefined}
                            placeholder={
                              watchedType === 'other'
                                ? 'Tell us what happened'
                                : 'Add any details about what happened'
                            }
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-[#2C3E50] placeholder-slate-400 focus:border-transparent focus:ring-2 focus:ring-[#5B9DFF] resize-none"
                          />
                          {errors.description && (
                            <p id="desc-error" className="mt-2 text-xs text-red-500">
                              {errors.description.message}
                            </p>
                          )}
                        </div>
                      )}

                    </div>

                    {/* Section 2: Location & time */}
                    <div ref={locationSectionRef} className="p-6">
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">
                        Where &amp; when? <span className="text-red-500">*</span>
                      </p>

                      {/* Location method tabs */}
                      <div className="flex rounded-xl border border-slate-200 overflow-hidden mb-3 text-xs font-medium">
                        {([
                          { id: 'gps', icon: MapPin, label: 'My Location' },
                          { id: 'address', icon: Search, label: 'Street Address' },
                          { id: 'map', icon: Map, label: 'Pin on Map' },
                        ] as const).map(({ id, icon: Icon, label }) => (
                          <button
                            key={id}
                            type="button"
                            aria-pressed={locationMethod === id}
                            aria-label={label}
                            onClick={() => setLocationMethod(id)}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5B9DFF] focus-visible:ring-inset ${
                              locationMethod === id
                                ? 'bg-blue-50 text-blue-700 border-b-2 border-[#5B9DFF]'
                                : 'text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                            <span className="hidden sm:inline" aria-hidden="true">{label}</span>
                          </button>
                        ))}
                      </div>

                      {/* GPS */}
                      {locationMethod === 'gps' && (
                        <div className="space-y-2">
                          <button
                            type="button"
                            onClick={getLocation}
                            disabled={locationStatus === 'loading'}
                            className={`w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl border-2 font-medium transition text-sm ${
                              locationStatus === 'success'
                                ? 'border-[#5B9DFF] bg-blue-50 text-blue-700'
                                : 'border-dashed border-slate-300 text-slate-500 hover:border-blue-400 hover:text-[#5B9DFF] hover:bg-blue-50/50'
                            }`}
                          >
                            {locationStatus === 'loading' ? (
                              <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                            ) : locationStatus === 'success' ? (
                              <CheckCircle className="w-4 h-4" aria-hidden="true" />
                            ) : (
                              <MapPin className="w-4 h-4" aria-hidden="true" />
                            )}
                            {locationStatus === 'success'
                              ? 'Location captured'
                              : locationStatus === 'loading'
                              ? 'Getting location…'
                              : 'Use my current location'}
                          </button>
                          {locationStatus === 'error' && (
                            <p className="text-xs text-red-500">
                              Could not get location. Please enable location services or use another method.
                            </p>
                          )}
                        </div>
                      )}

                      {/* Street address search */}
                      {locationMethod === 'address' && (
                        <div className="space-y-2">
                          <div className="relative">
                            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus-within:ring-2 focus-within:ring-[#5B9DFF] focus-within:border-transparent">
                              <Search className="w-4 h-4 text-slate-400 flex-shrink-0" aria-hidden="true" />
                              <input
                                type="text"
                                aria-label="Street address"
                                autoComplete="street-address"
                                value={addressQuery}
                                onChange={(e) => {
                                  setAddressQuery(e.target.value);
                                  fetchSuggestions(e.target.value);
                                  if (locationStatus === 'success') setLocationStatus('idle');
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    if (suggestions.length > 0) applySuggestion(suggestions[0]);
                                    else geocodeAddress();
                                  }
                                  if (e.key === 'Escape') setShowSuggestions(false);
                                }}
                                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                                placeholder="e.g. Market St & 5th, SF"
                                className="flex-1 bg-transparent text-[#2C3E50] placeholder-slate-400 text-sm outline-none"
                              />
                              {isGeocoding && <Loader2 className="w-4 h-4 text-slate-400 animate-spin flex-shrink-0" aria-hidden="true" />}
                              {locationStatus === 'success' && !isGeocoding && (
                                <CheckCircle className="w-4 h-4 text-[#5B9DFF] flex-shrink-0" aria-hidden="true" />
                              )}
                            </div>

                            {/* Suggestions dropdown */}
                            {showSuggestions && suggestions.length > 0 && (
                              <ul className="absolute z-50 w-full mt-1 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
                                {suggestions.map((s, i) => (
                                  <li key={i}>
                                    <button
                                      type="button"
                                      onMouseDown={() => applySuggestion(s)}
                                      className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-blue-50 transition text-sm border-b border-slate-100 last:border-0"
                                    >
                                      <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                                      <span className="text-slate-700 leading-snug">{s.place_name}</span>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>

                          {geocodeError && (
                            <p className="text-xs text-red-500">{geocodeError}</p>
                          )}
                          {locationStatus === 'success' && watchedAddress && locationMethod === 'address' && (
                            <p className="text-xs text-[#5B9DFF] flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" aria-hidden="true" /> Location set
                            </p>
                          )}
                        </div>
                      )}

                      {/* Map pinpoint — always mounted so the map stays initialised;
                          hidden via CSS when another method is active so Mapbox
                          keeps its dimensions and doesn't need to reload. */}
                      <div className={locationMethod === 'map' ? '' : 'hidden'}>
                        <LocationMapPicker
                          onLocationSelect={(lat, lng, address, city) => {
                            setValue('latitude', lat);
                            setValue('longitude', lng);
                            setValue('address', address);
                            setValue('city', city);
                            setLocationStatus('success');
                          }}
                          selectedLat={watchedLat}
                          selectedLng={watchedLng}
                        />
                      </div>

                      {/* Confirmed address pill */}
                      {watchedAddress && locationStatus === 'success' && locationMethod !== 'address' && (
                        <p className="mt-2 flex items-center gap-1.5 truncate text-xs text-slate-500">
                          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span className="truncate">{watchedAddress}</span>
                        </p>
                      )}

                      <input type="hidden" {...register('latitude', { valueAsNumber: true })} />
                      <input type="hidden" {...register('longitude', { valueAsNumber: true })} />
                      <input type="hidden" {...register('city')} />

                      <div className="mt-3 flex items-center rounded-lg border border-slate-200 bg-slate-50 focus-within:ring-2 focus-within:ring-[#5B9DFF] focus-within:border-transparent">
                        <input
                          id="occurred-at-input"
                          type="datetime-local"
                          aria-label="Date and time of incident"
                          {...register('occurred_at')}
                          ref={(el) => {
                            register('occurred_at').ref(el);
                            dateTimeInputRef.current = el;
                          }}
                          className="flex-1 min-w-0 px-3 py-2.5 bg-transparent text-[#2C3E50] text-sm outline-none"
                        />
                        <button
                          type="button"
                          aria-label="Open date picker"
                          onClick={() => { try { dateTimeInputRef.current?.showPicker(); } catch {} }}
                          className="shrink-0 pr-3 flex items-center text-slate-400 hover:text-[#5B9DFF] transition-colors cursor-pointer"
                        >
                          <Calendar className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    
                    {/* Section 3: Reporter context */}
                    <div ref={reporterSectionRef} className="px-6 pt-6 pb-8">
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">
                        Which best describes you? <span className="text-red-500">*</span>
                      </p>
                      <Controller
                        name="reporter_context"
                        control={control}
                        render={({ field }) => (
                          <div
                            className="flex gap-2"
                            role="group"
                            aria-label="Which best describes you?"
                            aria-describedby={errors.reporter_context ? 'reporter-error' : undefined}
                          >
                            {REPORTER_CONTEXT_OPTIONS.map(({ value, label }) => (
                              <button
                                key={value}
                                type="button"
                                aria-pressed={field.value === value}
                                onClick={() => {
                                  handleFormInteraction();
                                  field.onChange(field.value === value ? undefined : value);
                                }}
                                className={`inline-flex items-center px-4 py-2 rounded-full border-2 text-sm font-medium transition select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5B9DFF] ${
                                  field.value === value
                                    ? 'border-[#5B9DFF] bg-blue-50 text-blue-700'
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300'
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        )}
                      />
                      {errors.reporter_context && (
                        <p id="reporter-error" className="mt-2 text-xs text-red-500">
                          {errors.reporter_context.message}
                        </p>
                      )}

                      <div className="mt-6 -mx-6 border-t border-slate-100 px-6 pt-6">
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-600">
                          Which company? <span className={OPTIONAL_LABEL_CLASS}>(optional)</span>
                        </p>
                        <input type="hidden" {...register('av_company')} />
                        <div className="flex gap-2 flex-wrap" role="group" aria-label="Which company?">
                          {REPORT_COMPANY_OPTIONS.map(({ value, label }) => (
                            <button
                              key={value}
                              type="button"
                              aria-pressed={watchedCompany === value}
                              onClick={() =>
                                toggleChoice(
                                  'av_company',
                                  watchedCompany,
                                  value as Exclude<ReportFormData['av_company'], undefined>,
                                  'other_av_company'
                                )
                              }
                              className={`inline-flex items-center px-4 py-2 rounded-full border-2 text-sm font-medium transition select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5B9DFF] ${
                                watchedCompany === value
                                  ? 'border-[#5B9DFF] bg-blue-50 text-blue-700'
                                  : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        {watchedCompany === 'other' && (
                          <div className="mt-3">
                            <input
                              type="text"
                              {...register('other_av_company', { onChange: handleFormInteraction })}
                              aria-label="Which company?"
                              aria-describedby={errors.other_av_company ? 'company-other-error' : undefined}
                              placeholder="Tell us which company"
                              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#2C3E50] placeholder-slate-400 focus:ring-2 focus:ring-[#5B9DFF] focus:border-transparent"
                            />
                            {errors.other_av_company && (
                              <p id="company-other-error" className="mt-2 text-xs text-red-500">
                                {errors.other_av_company.message}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Section 4: Upload content */}
                    <div className="p-6">
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">
                        Upload content <span className={OPTIONAL_LABEL_CLASS}>(optional)</span>
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          aria-label="Take photo"
                          onClick={() => cameraInputRef.current?.click()}
                          className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition cursor-pointer"
                        >
                          <Camera className="w-5 h-5 text-slate-400" aria-hidden="true" />
                          <span className="text-xs text-slate-500">Take photo</span>
                        </button>
                        <button
                          type="button"
                          aria-label="Choose photo or video"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition cursor-pointer"
                        >
                          <Upload className="w-5 h-5 text-slate-400" aria-hidden="true" />
                          <span className="text-xs text-slate-500">Choose photo / video</span>
                        </button>
                      </div>
                      <input
                        ref={cameraInputRef}
                        type="file"
                        accept="image/*,video/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => {
                          const newFiles = Array.from(e.target.files || []);
                          if (newFiles.length > 0) track(Events.MEDIA_ATTACHED, { count: newFiles.length, source: 'camera' });
                          setSelectedFiles((prev) =>
                            [...prev, ...newFiles].slice(0, 3)
                          );
                        }}
                      />
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*,video/*"
                        className="hidden"
                        onChange={(e) => {
                          const newFiles = Array.from(e.target.files || []);
                          if (newFiles.length > 0) track(Events.MEDIA_ATTACHED, { count: newFiles.length, source: 'file_picker' });
                          setSelectedFiles((prev) =>
                            [...prev, ...newFiles].slice(0, 3)
                          );
                        }}
                      />
                      {selectedFiles.length > 0 && (
                        <ul className="mt-3 space-y-1">
                          {selectedFiles.map((file, i) => (
                            <li
                              key={i}
                              className="flex items-center justify-between text-sm bg-slate-50 rounded-lg px-3 py-2 border border-slate-200"
                            >
                              <span className="truncate text-slate-700">
                                {file.name}
                              </span>
                              <button
                                type="button"
                                aria-label={`Remove ${file.name}`}
                                onClick={() =>
                                  setSelectedFiles((prev) =>
                                    prev.filter((_, j) => j !== i)
                                  )
                                }
                                className="ml-2 text-slate-400 hover:text-red-500 flex-shrink-0"
                              >
                                <X className="w-4 h-4" aria-hidden="true" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Section 5: Optional details */}
                    <div className="p-6">
                      <details ref={optionalDetailsRef} className="group rounded-xl border border-slate-200 bg-slate-50/60">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                              Additional details <span className={OPTIONAL_LABEL_CLASS}>(optional)</span>
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              {/* Add your contact info if you&apos;d like us to follow up and verify the report. */}
                              Add your contact info if we can follow up to verify your report.
                            </p>
                          </div>
                          <span className="text-slate-400 transition-transform duration-150 group-open:rotate-180 group-open:text-[#5B9DFF]" aria-hidden="true">
                            <ChevronDown className="h-4 w-4" />
                          </span>
                        </summary>
                        <div className="border-t border-slate-200 p-4 space-y-5">
                          <div>
                            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-600">
                              Contact <span className={OPTIONAL_LABEL_CLASS}>(optional)</span>
                            </p>
                            <div className="space-y-2">
                              <input
                                type="text"
                                {...register('contact_name')}
                                placeholder="Name"
                                autoComplete="name"
                                aria-label="Your name"
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#2C3E50] placeholder-slate-400 focus:ring-2 focus:ring-[#5B9DFF] focus:border-transparent"
                              />
                              <input
                                type="email"
                                {...register('contact_email')}
                                placeholder="Email address"
                                autoComplete="email"
                                aria-label="Email address"
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#2C3E50] placeholder-slate-400 focus:ring-2 focus:ring-[#5B9DFF] focus:border-transparent"
                              />
                            </div>
                          </div>
                        </div>
                      </details>
                    </div>

                    {/* Error */}
                    {submitError && (
                      <div role="alert" className="px-6 py-3 bg-red-50 border-t border-red-200">
                        <p className="text-sm text-red-600 text-center">
                          {submitError}
                        </p>
                      </div>
                    )}

                    {/* Submit */}
                    <div className="p-6">
                      {/* Certification checkbox */}
                      <label ref={certRef} className="flex items-start gap-3 mb-4 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={isCertified}
                          onChange={(e) => setIsCertified(e.target.checked)}
                          className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#5B9DFF] focus:ring-[#5B9DFF] flex-shrink-0"
                        />
                        <span className="text-sm text-slate-600 group-hover:text-slate-800 transition">
                          I certify that this report is accurate to the best of my knowledge.<span className="text-red-500 ml-0.5">*</span>
                        </span>
                      </label>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        onClick={(e) => {
                          if (!watchedType) {
                            e.preventDefault();
                            incidentSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          } else if (!hasLocation) {
                            e.preventDefault();
                            locationSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          } else if (!watchedReporterContext) {
                            e.preventDefault();
                            reporterSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          } else if (!isCertified) {
                            e.preventDefault();
                            certRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }
                        }}
                        className={`w-full py-4 rounded-xl font-semibold text-base transition flex items-center justify-center gap-2 ${
                          isSubmitting || !watchedType || !hasLocation || !watchedReporterContext || !isCertified
                            ? 'bg-slate-200 cursor-not-allowed text-slate-500'
                            : 'bg-[#5B9DFF] hover:bg-[#3A72D9] text-white shadow-md shadow-[#5B9DFF]/20'
                        }`}
                      >
                        {isSubmitting && (
                          <Loader2 className="w-5 h-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                        )}
                        {isSubmitting ? (uploadProgress ?? 'Submitting…') : 'Submit Report'}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>


      {/* ─────────────────────── RECENT REPORTS ─────────────────────── */}
      <section id="reports" className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold text-[#2C3E50] mb-2">
                Recent Reports
              </h2>
              <p className="text-slate-500">
                {reportFilters.sourcePlatform === 'community'
                  ? 'Incidents submitted directly by AV Watch users.'
                  : 'Incidents aggregated from Reddit communities.'}
              </p>
            </div>

            {/* Source toggle */}
            <div className="flex shrink-0 items-center gap-1 p-1 rounded-xl bg-slate-200/70 self-start sm:self-auto">
              <button
                onClick={() => setReportFilters((p) => ({ ...p, sourcePlatform: 'community' }))}
                aria-pressed={reportFilters.sourcePlatform === 'community'}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  reportFilters.sourcePlatform === 'community'
                    ? 'bg-white text-[#2C3E50] shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                AV Watch
              </button>
              <button
                onClick={() => setReportFilters((p) => ({ ...p, sourcePlatform: 'reddit' }))}
                aria-pressed={reportFilters.sourcePlatform === 'reddit'}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  reportFilters.sourcePlatform === 'reddit'
                    ? 'bg-white text-[#2C3E50] shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                Reddit
              </button>
            </div>
          </div>

          {/* ── Filters ── */}
          {(() => {
            const activeCount = countReportFilters(reportFilters);
            const clearFilters = () => { setReportFilters(DEFAULT_REPORT_FILTERS); setReportLocationInput(''); };

            const lbl = 'block text-xs font-medium text-slate-600 mb-1';
            const ctrl = (active: boolean) =>
              `rounded-xl border bg-white text-base sm:text-sm text-[#2C3E50] focus:outline-none focus:ring-2 focus:ring-[#5B9DFF] focus:border-transparent focus-within:ring-2 focus-within:ring-[#5B9DFF] focus-within:border-transparent transition-colors ${
                active ? 'border-[#5B9DFF]/50 bg-blue-50 text-[#5B9DFF]' : 'border-slate-200'
              }`;

            // Desktop: labeled fields in a flex row
            const desktopFilters = (
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[180px]">
                  <label htmlFor="df-location" className={lbl}>Location</label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    <input
                      id="df-location"
                      type="text"
                      placeholder="City or neighborhood…"
                      value={reportLocationInput}
                      onChange={(e) => setReportLocationInput(e.target.value)}
                      className={`w-full ${ctrl(!!reportFilters.location)} pl-8 pr-3 py-2 h-[38px] placeholder:text-slate-400`}
                    />
                  </div>
                </div>
                <div className="shrink-0">
                  <label htmlFor="df-company" className={lbl}>Company</label>
                  <div className={`relative flex items-center w-[168px] h-[38px] ${ctrl(!!reportFilters.avCompany)}`}>
                    <select
                      id="df-company"
                      value={reportFilters.avCompany}
                      onChange={(e) => setReportFilters((p) => ({ ...p, avCompany: e.target.value }))}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    >
                      {FILTER_COMPANIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                    <span className="flex-1 px-3 text-sm truncate pointer-events-none">
                      {FILTER_COMPANIES.find(c => c.value === reportFilters.avCompany)?.label ?? 'All companies'}
                    </span>
                    <ChevronDown className="shrink-0 mr-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" aria-hidden="true" />
                  </div>
                </div>
                <div className="shrink-0">
                  <label htmlFor="df-incident-type" className={lbl}>Incident type</label>
                  <div className={`relative flex items-center w-[204px] h-[38px] ${ctrl(!!reportFilters.incidentType)}`}>
                    <select
                      id="df-incident-type"
                      value={reportFilters.incidentType}
                      onChange={(e) => setReportFilters((p) => ({ ...p, incidentType: e.target.value }))}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    >
                      {FILTER_INCIDENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <span className="flex-1 px-3 text-sm truncate pointer-events-none">
                      {FILTER_INCIDENT_TYPES.find(t => t.value === reportFilters.incidentType)?.label ?? 'All incident types'}
                    </span>
                    <ChevronDown className="shrink-0 mr-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" aria-hidden="true" />
                  </div>
                </div>
                <div>
                  <label className={lbl}>Date range</label>
                  <div className="flex items-center gap-1.5">
                    <div className={`relative flex items-center w-[144px] h-[38px] ${ctrl(!!reportFilters.dateFrom)}`}>
                      <input
                        type="date"
                        aria-label="From date"
                        value={reportFilters.dateFrom}
                        onChange={(e) => setReportFilters((p) => ({ ...p, dateFrom: e.target.value }))}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <span className="flex-1 px-3 text-sm truncate pointer-events-none text-slate-400">
                        {reportFilters.dateFrom || 'From'}
                      </span>
                      <Calendar className="shrink-0 mr-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" aria-hidden="true" />
                    </div>
                    <span className="text-slate-400 text-sm shrink-0">to</span>
                    <div className={`relative flex items-center w-[144px] h-[38px] ${ctrl(!!reportFilters.dateTo)}`}>
                      <input
                        type="date"
                        aria-label="To date"
                        value={reportFilters.dateTo}
                        onChange={(e) => setReportFilters((p) => ({ ...p, dateTo: e.target.value }))}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <span className="flex-1 px-3 text-sm truncate pointer-events-none text-slate-400">
                        {reportFilters.dateTo || 'To'}
                      </span>
                      <Calendar className="shrink-0 mr-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" aria-hidden="true" />
                    </div>
                  </div>
                </div>
                <button
                  onClick={clearFilters}
                  aria-hidden={activeCount === 0}
                  className={`flex items-center gap-1.5 h-10 rounded-xl border border-red-100 bg-red-50 px-3 text-sm font-medium text-red-400 hover:bg-red-100 hover:text-red-600 hover:border-red-200 transition self-end ${activeCount === 0 ? 'invisible pointer-events-none' : ''}`}
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  Clear
                </button>
              </div>
            );

            // Mobile: 2-column grid with labels
            const mobileFilters = (
              <div className="flex flex-col gap-3 w-full min-w-0">
                <div>
                  <label htmlFor="mf-location" className={lbl}>Location</label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    <input
                      id="mf-location"
                      type="text"
                      placeholder="City or neighborhood…"
                      value={reportLocationInput}
                      onChange={(e) => setReportLocationInput(e.target.value)}
                      className={`w-full ${ctrl(!!reportFilters.location)} pl-8 pr-3 py-2.5 placeholder:text-slate-400`}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="mf-company" className={lbl}>Company</label>
                  <select
                    id="mf-company"
                    value={reportFilters.avCompany}
                    onChange={(e) => setReportFilters((p) => ({ ...p, avCompany: e.target.value }))}
                    className={`w-full ${ctrl(!!reportFilters.avCompany)} px-3 py-2.5 cursor-pointer`}
                  >
                    {FILTER_COMPANIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="mf-incident-type" className={lbl}>Incident type</label>
                  <select
                    id="mf-incident-type"
                    value={reportFilters.incidentType}
                    onChange={(e) => setReportFilters((p) => ({ ...p, incidentType: e.target.value }))}
                    className={`w-full ${ctrl(!!reportFilters.incidentType)} px-3 py-2.5 cursor-pointer`}
                  >
                    {FILTER_INCIDENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Date range</label>
                  <div className="flex flex-col gap-1.5">
                    <div className={`relative flex w-full items-center ${ctrl(!!reportFilters.dateFrom)}`}>
                      <input
                        type="date"
                        aria-label="From date"
                        value={reportFilters.dateFrom}
                        onChange={(e) => setReportFilters((p) => ({ ...p, dateFrom: e.target.value }))}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <span className="flex-1 px-3 py-2.5 text-sm truncate pointer-events-none text-slate-400">
                        {reportFilters.dateFrom || 'From date'}
                      </span>
                      <Calendar className="shrink-0 mr-3 h-4 w-4 text-slate-400 pointer-events-none" aria-hidden="true" />
                    </div>
                    <span className="text-center text-sm text-slate-400">to</span>
                    <div className={`relative flex w-full items-center ${ctrl(!!reportFilters.dateTo)}`}>
                      <input
                        type="date"
                        aria-label="To date"
                        value={reportFilters.dateTo}
                        onChange={(e) => setReportFilters((p) => ({ ...p, dateTo: e.target.value }))}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <span className="flex-1 px-3 py-2.5 text-sm truncate pointer-events-none text-slate-400">
                        {reportFilters.dateTo || 'To date'}
                      </span>
                      <Calendar className="shrink-0 mr-3 h-4 w-4 text-slate-400 pointer-events-none" aria-hidden="true" />
                    </div>
                  </div>
                </div>
                {activeCount > 0 && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center justify-center gap-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-500 hover:text-[#5B9DFF] hover:border-[#5B9DFF]/40 transition"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                    Clear all filters
                  </button>
                )}
              </div>
            );

            return (
              <div className="mb-8">
                {/* Mobile: single card with toggle header */}
                <div className={`sm:hidden rounded-2xl border bg-white shadow-sm overflow-hidden transition-colors duration-200 ${activeCount > 0 && !showMobileFilters ? 'border-[#5B9DFF]/50' : 'border-slate-200'}`}>
                  <button
                    onClick={() => setShowMobileFilters((v) => !v)}
                    aria-expanded={showMobileFilters}
                    aria-controls="homepage-mobile-filters"
                    className={`w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-[#2C3E50] transition-colors ${showMobileFilters ? 'bg-slate-50' : 'hover:bg-slate-50'}`}
                  >
                    <Filter className="h-4 w-4 text-[#5B9DFF] shrink-0" aria-hidden="true" />
                    <span className="flex-1 text-left">Filter reports</span>
                    {activeCount > 0 && (
                      <span className="flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-[#5B9DFF] text-white text-[10px] font-bold">
                        {activeCount}
                      </span>
                    )}
                    <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${showMobileFilters ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </button>
                  {showMobileFilters && (
                    <div id="homepage-mobile-filters" className="px-4 pb-5 border-t border-slate-100 overflow-hidden">
                      <div className="pt-4 w-full min-w-0">
                        {mobileFilters}
                      </div>
                    </div>
                  )}
                </div>
                {/* Desktop */}
                <div className="hidden sm:block rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100 bg-slate-50">
                    <Filter className="h-4 w-4 text-[#5B9DFF] shrink-0" aria-hidden="true" />
                    <span className="flex-1 text-sm font-medium text-[#2C3E50]">Filter reports</span>
                    {activeCount > 0 && (
                      <span className="flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-[#5B9DFF] text-white text-[10px] font-bold">
                        {activeCount}
                      </span>
                    )}
                  </div>
                  <div className="px-5 py-4">
                    {desktopFilters}
                  </div>
                </div>
                {!reportInitialLoading && activeCount > 0 && reportItems.length > 0 && (
                  <p className="mt-2 text-xs text-slate-500">
                    {`${reportTotal} ${reportTotal === 1 ? 'report' : 'reports'} found`}
                  </p>
                )}
              </div>
            );
          })()}


          {reportInitialLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-2xl bg-white border border-slate-200 overflow-hidden animate-pulse motion-reduce:animate-none">
                  <div className="h-44 bg-slate-200" />
                  <div className="p-5 space-y-3">
                    <div className="h-3 w-24 rounded bg-slate-200" />
                    <div className="h-4 w-full rounded bg-slate-200" />
                    <div className="h-4 w-3/4 rounded bg-slate-200" />
                  </div>
                </div>
              ))}
            </div>
          ) : reportItems.length === 0 ? (
            <p className="text-slate-600 text-sm">
              {countReportFilters(reportFilters) > 0
                ? 'No reports match these filters.'
                : reportFilters.sourcePlatform === 'community'
                ? 'No community reports yet — be the first to submit one above!'
                : 'No Reddit reports yet. Check back soon.'}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {reportItems.map((item, index) => (
                  <div key={item.id} className={!mobileShowAll && index >= 3 ? 'hidden sm:block' : ''}>
                    <BulletinCard item={item} />
                  </div>
                ))}
              </div>

              <div className="mt-10 flex justify-center gap-3">
                {/* Mobile: single button — reveal hidden cards first, then load more */}
                <div className="sm:hidden">
                  {!mobileShowAll ? (
                    <button
                      onClick={() => setMobileShowAll(true)}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:border-blue-300 hover:text-[#5B9DFF] transition"
                    >
                      Show more
                    </button>
                  ) : reportHasMore ? (
                    <button
                      onClick={loadMoreReports}
                      disabled={reportLoadingMore}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:border-blue-300 hover:text-[#5B9DFF] transition disabled:opacity-50"
                    >
                      {reportLoadingMore ? 'Loading…' : 'Load more incidents'}
                    </button>
                  ) : (
                    <button
                      onClick={() => { setMobileShowAll(false); setReportItems(prev => prev.slice(0, REPORTS_PAGE)); setReportOffset(0); setReportHasMore(true); }}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:border-blue-300 hover:text-[#5B9DFF] transition"
                    >
                      Show less
                    </button>
                  )}
                </div>

                {/* Desktop: load more + show less */}
                {reportHasMore && (
                  <button
                    onClick={loadMoreReports}
                    disabled={reportLoadingMore}
                    className="hidden sm:inline-flex items-center gap-2 px-6 py-3 rounded-full border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:border-blue-300 hover:text-[#5B9DFF] transition disabled:opacity-50"
                  >
                    {reportLoadingMore ? 'Loading…' : 'Load more incidents'}
                  </button>
                )}
                {reportItems.length > REPORTS_PAGE && (
                  <button
                    onClick={() => { setReportItems(prev => prev.slice(0, REPORTS_PAGE)); setReportOffset(0); setReportHasMore(true); setMobileShowAll(false); }}
                    className="hidden sm:inline-flex items-center gap-2 px-6 py-3 rounded-full border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:border-blue-300 hover:text-[#5B9DFF] transition"
                  >
                    Show less
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </section>


      {/* ─────────────────────── AFFILIATION STRIP ─────────────────────── */}
      <div className="bg-white border-t border-b border-slate-100 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            An independent research project from the
          </span>
          <div className="hidden sm:block h-4 w-px bg-slate-200" />
          <a
            href="https://www.ischool.berkeley.edu/projects/2026/av-watch-transparency-platform-autonomous-vehicle-accountability"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="UC Berkeley School of Information (opens in new tab)"
          >
            <img
              src="/berkeley-ischool-logo.svg"
              alt=""
              className="h-12 object-contain opacity-80 hover:opacity-100 transition"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </a>
        </div>
      </div>

      {false && (
      <section className="py-16 lg:py-24 bg-gradient-to-b from-blue-50/40 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl lg:text-3xl font-bold text-[#2C3E50]">
              What happens to your report?
            </h2>
            <p className="mt-2 text-slate-500 text-sm">
              Every submission goes through our verification pipeline.
            </p>
          </div>

          {/* Desktop: horizontal steps */}
          <div className="hidden md:flex items-start">
            {PIPELINE_STEPS.map((step, i) => {
              const state = pipelinePhase === 4 ? 'done' : i < pipelinePhase ? 'done' : i === pipelinePhase ? 'active' : 'pending';
              const lineActive = pipelinePhase === 4 ? true : pipelinePhase > i;
              return (
                <div key={i} className="contents">
                  <div className="flex flex-col items-center text-center flex-1 min-w-0 px-2">
                    {/* Circle */}
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-500 mb-3 ${
                      state === 'done'
                        ? 'bg-emerald-500 shadow-md shadow-emerald-200 scale-100'
                        : state === 'active'
                        ? 'bg-[#5B9DFF] shadow-lg shadow-[#5B9DFF]/30 scale-110'
                        : 'bg-white border-2 border-slate-200'
                    }`}>
                      {state === 'done' ? (
                        <CheckCircle className="w-5 h-5 text-white" />
                      ) : (
                        <span className={`text-sm font-bold transition-colors duration-300 ${state === 'active' ? 'text-white' : 'text-slate-400'}`}>
                          {i + 1}
                        </span>
                      )}
                    </div>
                    <p className={`text-sm font-semibold leading-snug transition-colors duration-300 ${
                      state === 'pending' ? 'text-slate-400' : 'text-[#2C3E50]'
                    }`}>
                      {step.title}
                    </p>
                    <p className={`mt-1 text-xs leading-relaxed transition-colors duration-300 ${
                      state === 'pending' ? 'text-slate-300' : 'text-slate-500'
                    }`}>
                      {step.desc}
                    </p>
                  </div>
                  {i < 3 && (
                    <div className="relative h-0.5 flex-1 self-start mt-[22px] shrink-0 mx-1">
                      <div className="absolute inset-0 bg-slate-200 rounded-full" />
                      <div className={`absolute inset-y-0 left-0 rounded-full bg-[#5B9DFF] transition-all duration-700 ${lineActive ? 'right-0' : 'right-full'}`} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Mobile: vertical steps */}
          <div className="md:hidden space-y-1">
            {PIPELINE_STEPS.map((step, i) => {
              const state = pipelinePhase === 4 ? 'done' : i < pipelinePhase ? 'done' : i === pipelinePhase ? 'active' : 'pending';
              const lineActive = pipelinePhase === 4 ? true : pipelinePhase > i;
              return (
                <div key={i} className="flex gap-4 items-start">
                  <div className="flex flex-col items-center shrink-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${
                      state === 'done'
                        ? 'bg-emerald-500 shadow-md shadow-emerald-200'
                        : state === 'active'
                        ? 'bg-[#5B9DFF] shadow-lg shadow-[#5B9DFF]/30 scale-110'
                        : 'bg-white border-2 border-slate-200'
                    }`}>
                      {state === 'done' ? (
                        <CheckCircle className="w-5 h-5 text-white" />
                      ) : (
                        <span className={`text-sm font-bold ${state === 'active' ? 'text-white' : 'text-slate-400'}`}>
                          {i + 1}
                        </span>
                      )}
                    </div>
                    {i < 3 && (
                      <div className="relative w-0.5 h-8 mt-1">
                        <div className="absolute inset-0 bg-slate-200 rounded-full" />
                        <div className={`absolute inset-x-0 top-0 rounded-full bg-[#5B9DFF] transition-all duration-700 ${lineActive ? 'bottom-0' : 'bottom-full'}`} />
                      </div>
                    )}
                  </div>
                  <div className="pb-4 pt-1.5">
                    <p className={`text-sm font-semibold transition-colors duration-300 ${state === 'pending' ? 'text-slate-400' : 'text-[#2C3E50]'}`}>
                      {step.title}
                    </p>
                    <p className={`text-xs mt-0.5 transition-colors duration-300 ${state === 'pending' ? 'text-slate-300' : 'text-slate-500'}`}>
                      {step.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      )}

      {/* ─────────────────────── WHY IT MATTERS ─────────────────────── */}
      <section
        className="relative py-16 lg:py-28 border-t border-b border-slate-200 overflow-hidden"
        style={{
          backgroundImage: 'url(/waymo_bg.webp)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Mobile: near-opaque white overlay so text is always readable */}
        <div className="absolute inset-0 bg-white/90 pointer-events-none lg:hidden" />
        {/* Desktop: left-side gradient — image bleeds in on the right */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/80 to-white/0 pointer-events-none hidden lg:block" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Text occupies left half only */}
          <div className="max-w-xl">
            <h2 className="text-4xl lg:text-5xl font-bold text-[#2C3E50] leading-tight mb-8">
              Autonomous driving<br />
              <span className="text-[#5B9DFF]">is expanding fast.</span>
            </h2>

            <div className="space-y-5 text-slate-700 text-lg leading-relaxed">
              <p>
                Yet there is no simple, quick way for people to report what they witness on the road.{' '}
                <span className="font-semibold text-[#2C3E50]">AV Watch changes that.</span>
              </p>
              <p>
                {/* Every report is structured, geolocated, and routed to the California DMV&apos;s Autonomous Vehicles Program — the agency that issues permits and has the authority to suspend them. */}
                {/* Substantiated crowdsourced reports add up. They ensure stakeholders understand public trust of autonomous vehicles. */}
                AV Watch is the world’s first platform dedicated to autonomous vehicle incident reporting from anyone, anywhere. By bringing together the voices of our communities, we empower them to better understand what really happens on our roads. 
              </p>
              <p className="hidden lg:block">
                AV Watch is built by a team of independent researchers at the UC Berkeley School of Information.
              </p>
            </div>
          </div>
        </div>
      </section>


      {/* ─────────────────────── NEWS HEADLINES ─────────────────────── */}
      {/* <section id="news" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-[#2C3E50] mb-2">
              In the News
            </h2>
            <p className="text-slate-500">
              The latest coverage on autonomous vehicle incidents and policy.
            </p>
          </div>
          <NewsHeadlines />
        </div>
      </section> */}

      {/* ─────────────────────── ABOUT SECTION ─────────────────────── */}
      <section
        id="about"
        className="py-20 relative overflow-hidden bg-[linear-gradient(135deg,#3A72D9_0%,#5B9DFF_52%,#3F7FE8_100%)]"
      >
        {/* White grid pattern on blue */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)
            `,
            backgroundSize: '44px 44px',
            WebkitMaskImage: 'radial-gradient(ellipse 90% 80% at 70% 50%, black 30%, transparent 80%)',
            maskImage: 'radial-gradient(ellipse 90% 80% at 70% 50%, black 30%, transparent 80%)',
          }}
        />
        {/* Soft glow */}
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-[#8FC0FF]/28 blur-3xl pointer-events-none" />
        <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-[#2F6FE0]/22 blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

            {/* Left: Mission */}
            <div>
              <h2 className="text-3xl font-bold text-white mb-5">
                About AV Watch
              </h2>
              <p className="text-white/90 text-lg leading-relaxed">
                AV Watch is an independent, community-driven platform for
                reporting and tracking autonomous vehicle incidents. We believe
                transparency supports the safe and responsible deployment of
                self-driving technology.
              </p>
              <p className="text-white/90 text-lg leading-relaxed mt-4">
                <a
                  href="https://www.ischool.berkeley.edu/projects/2026/av-watch-transparency-platform-autonomous-vehicle-accountability"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 text-white hover:text-blue-200 transition font-medium"
                >
                  Learn more about the project and team →
                  <span className="sr-only">(opens in new tab)</span>
                </a>
              </p>
              <div className="mt-8">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
                  Get in touch
                </h3>
                <p className="mt-2 text-white/90 text-base leading-relaxed">
                  For feedback and inquiries, contact
                  the team at{' '}
                  <a
                    href="mailto:avwatch@ischool.berkeley.edu"
                    className="font-medium text-white underline underline-offset-2 hover:text-blue-200 transition"
                  >
                    avwatch@ischool.berkeley.edu
                  </a>
                  .
                </p>
              </div>
            </div>

            {/* Right: Berkeley logo only */}
            <div className="flex items-center justify-center lg:justify-end">
              <a
                href="https://www.ischool.berkeley.edu/projects/2026/av-watch-transparency-platform-autonomous-vehicle-accountability"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="UC Berkeley School of Information (opens in new tab)"
              >
                <img
                  src="/berkeley-ischool-logo.svg"
                  alt=""
                  className="h-28 object-contain brightness-0 invert opacity-90 hover:opacity-100 transition"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              </a>
            </div>

          </div>
        </div>
      </section>

    </div>
  );
}
