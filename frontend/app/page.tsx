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
  ShieldCheck,
  GraduationCap,
  UserX,
  Search,
  Map,
  TriangleAlert,
  TrafficCone,
  SprayCan,
  Accessibility,
  CircleHelp,
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

const BULLETIN_API = '/api/bulletin';
const REPORTS_PAGE = 6;

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
  { value: 'directly_involved', label: 'Directly involved' },
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
  const [carInView, setCarInView] = useState(false);
  const [locationMethod, setLocationMethod] = useState<'gps' | 'address' | 'map'>('gps');

  // Recent reports inline state
  const [reportItems, setReportItems] = useState<BulletinItem[]>([]);
  const [reportOffset, setReportOffset] = useState(0);
  const [reportHasMore, setReportHasMore] = useState(false);
  const [reportInitialLoading, setReportInitialLoading] = useState(true);
  const [reportLoadingMore, setReportLoadingMore] = useState(false);
  const [mobileShowAll, setMobileShowAll] = useState(false);
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

  // Fetch initial 6 reports
  useEffect(() => {
    async function fetchReports() {
      try {
        const res = await fetch(`${BULLETIN_API}?limit=${REPORTS_PAGE}&offset=0`);
        const data = await res.json();
        setReportItems(data.items ?? []);
        setReportHasMore(data.has_more ?? false);
      } catch {
        // silent — section just stays empty
      } finally {
        setReportInitialLoading(false);
      }
    }
    fetchReports();
  }, []);

  async function loadMoreReports() {
    setReportLoadingMore(true);
    const nextOffset = reportOffset + REPORTS_PAGE;
    try {
      const res = await fetch(`${BULLETIN_API}?limit=${REPORTS_PAGE}&offset=${nextOffset}`);
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
            <div className="pt-4 flex flex-col">
                <h1 className="text-5xl lg:text-6xl font-bold text-[#2C3E50] leading-[1.1] mb-5">
                  Witnessed an<br />
                  <span className="text-[#5B9DFF]">autonomous vehicle incident?</span>
                </h1>

                <p className="text-xl text-slate-600 mb-3 leading-relaxed">
                  Report it here to make autonomous driving safer for everyone.
                </p>

              {/* Trust indicators — desktop only */}
              <div className="flex flex-wrap gap-3 mt-2">
                {[
                  { icon: UserX, label: 'Fully anonymous' },
                  { icon: ShieldCheck, label: 'No account needed' },
                ].map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm text-sm text-slate-700 font-medium"
                  >
                    <Icon className="w-3.5 h-3.5 text-[#5B9DFF]" />
                    {label}
                  </div>
                ))}
              </div>

              {/* AV car imagery — drives in from left on scroll (desktop only) */}
              <div
                ref={carRef}
                className={`hidden md:block relative mt-20 lg:mt-24 lg:-mr-32 lg:-translate-y-16 xl:-translate-y-20 transition-all duration-[1100ms] ease-out ${
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
            <div id="report-form" className="lg:sticky lg:top-24">
              {isSuccess ? (
                /* Success state */
                <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
                  {/* Header */}
                  <div className="bg-[#2C3E50] px-8 py-8 text-center">
                    <div className="mx-auto w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mb-4">
                      <CheckCircle className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-1">
                      Thank You!
                    </h2>
                    <p className="text-blue-100 text-sm">
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
                          <div className="w-9 h-9 rounded-full bg-[#2C3E50] text-white flex items-center justify-center text-sm font-bold shrink-0">
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
                          <div className="w-9 h-9 rounded-full bg-blue-50 border-2 border-[#5B9DFF] text-[#5B9DFF] flex items-center justify-center text-sm font-bold shrink-0">
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
                          <p className="font-semibold text-slate-400 text-sm">Corroborated with similar reports</p>
                          <p className="text-slate-400 text-xs mt-0.5">Reports near the same location &amp; time are linked together to build credibility.</p>
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
                          <p className="font-semibold text-slate-400 text-sm">Shared with regulators</p>
                          <p className="text-slate-400 text-xs mt-0.5">Validated reports are forwarded to relevant agencies.</p>
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
                              onClick={() =>
                                toggleChoice(
                                  'incident_type',
                                  watchedType,
                                  value as Exclude<ReportFormData['incident_type'], undefined>
                                )
                              }
                              className={`flex items-center gap-2 p-2.5 sm:p-3.5 rounded-xl border-2 cursor-pointer transition ${
                                watchedType === value
                                  ? 'border-[#5B9DFF] bg-blue-50'
                                  : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/50'
                              }`}
                            >
                              <span
                                className={`flex h-9 w-9 shrink-0 items-center justify-center self-center rounded-lg border ${
                                  watchedType === value
                                    ? 'border-[#5B9DFF]/25 bg-[#5B9DFF]/10'
                                    : 'border-[#5B9DFF]/20 bg-[#5B9DFF]/8'
                                }`}
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
                            placeholder={
                              watchedType === 'other'
                                ? 'Tell us what happened'
                                : 'Add any details about what happened'
                            }
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-[#2C3E50] placeholder-slate-400 focus:border-transparent focus:ring-2 focus:ring-[#5B9DFF] resize-none"
                          />
                          {errors.description && (
                            <p className="mt-2 text-xs text-red-500">
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
                            onClick={() => setLocationMethod(id)}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 transition ${
                              locationMethod === id
                                ? 'bg-blue-50 text-blue-700 border-b-2 border-[#5B9DFF]'
                                : 'text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{label}</span>
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
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : locationStatus === 'success' ? (
                              <CheckCircle className="w-4 h-4" />
                            ) : (
                              <MapPin className="w-4 h-4" />
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
                              <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
                              <input
                                type="text"
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
                                placeholder="e.g. Market St & 5th, San Francisco"
                                className="flex-1 bg-transparent text-[#2C3E50] placeholder-slate-400 text-sm outline-none"
                              />
                              {isGeocoding && <Loader2 className="w-4 h-4 text-slate-400 animate-spin flex-shrink-0" />}
                              {locationStatus === 'success' && !isGeocoding && (
                                <CheckCircle className="w-4 h-4 text-[#5B9DFF] flex-shrink-0" />
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
                                      <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
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
                              <CheckCircle className="w-3 h-3" /> Location set
                            </p>
                          )}
                        </div>
                      )}

                      {/* Map pinpoint */}
                      {locationMethod === 'map' && (
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
                      )}

                      {/* Confirmed address pill */}
                      {watchedAddress && locationStatus === 'success' && locationMethod !== 'address' && (
                        <p className="mt-2 flex items-center gap-1.5 truncate text-xs text-slate-500">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{watchedAddress}</span>
                        </p>
                      )}

                      <input type="hidden" {...register('latitude', { valueAsNumber: true })} />
                      <input type="hidden" {...register('longitude', { valueAsNumber: true })} />
                      <input type="hidden" {...register('city')} />

                      <div className="mt-3">
                        <input
                          type="datetime-local"
                          {...register('occurred_at')}
                          className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-[#2C3E50] text-sm focus:ring-2 focus:ring-[#5B9DFF] focus:border-transparent"
                        />
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
                          <div className="flex gap-2">
                            {REPORTER_CONTEXT_OPTIONS.map(({ value, label }) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => {
                                  handleFormInteraction();
                                  field.onChange(field.value === value ? undefined : value);
                                }}
                                className={`inline-flex items-center px-4 py-2 rounded-full border-2 text-sm font-medium transition select-none ${
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
                        <p className="mt-2 text-xs text-red-500">
                          {errors.reporter_context.message}
                        </p>
                      )}

                      <div className="mt-6 -mx-6 border-t border-slate-100 px-6 pt-6">
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                          Which company? <span className={OPTIONAL_LABEL_CLASS}>(optional)</span>
                        </p>
                        <input type="hidden" {...register('av_company')} />
                        <div className="flex gap-2 flex-wrap">
                          {REPORT_COMPANY_OPTIONS.map(({ value, label }) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() =>
                                toggleChoice(
                                  'av_company',
                                  watchedCompany,
                                  value as Exclude<ReportFormData['av_company'], undefined>,
                                  'other_av_company'
                                )
                              }
                              className={`inline-flex items-center px-4 py-2 rounded-full border-2 text-sm font-medium transition select-none ${
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
                              placeholder="Tell us which company"
                              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#2C3E50] placeholder-slate-400 focus:ring-2 focus:ring-[#5B9DFF] focus:border-transparent"
                            />
                            {errors.other_av_company && (
                              <p className="mt-2 text-xs text-red-500">
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
                          onClick={() => cameraInputRef.current?.click()}
                          className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition cursor-pointer"
                        >
                          <Camera className="w-5 h-5 text-slate-400" />
                          <span className="text-xs text-slate-500">Take photo</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition cursor-pointer"
                        >
                          <Upload className="w-5 h-5 text-slate-400" />
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
                                onClick={() =>
                                  setSelectedFiles((prev) =>
                                    prev.filter((_, j) => j !== i)
                                  )
                                }
                                className="ml-2 text-slate-400 hover:text-red-500 flex-shrink-0"
                              >
                                <X className="w-4 h-4" />
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
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                              Additional details <span className={OPTIONAL_LABEL_CLASS}>(optional)</span>
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              Add your contact info if you&apos;d like us to follow up and verify the report.
                            </p>
                          </div>
                          <span className="text-slate-400 transition-transform duration-150 group-open:rotate-180 group-open:text-[#5B9DFF]">
                            <ChevronDown className="h-4 w-4" />
                          </span>
                        </summary>
                        <div className="border-t border-slate-200 p-4 space-y-5">
                          <div>
                            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                              Contact <span className={OPTIONAL_LABEL_CLASS}>(optional)</span>
                            </p>
                            <div className="space-y-2">
                              <input
                                type="text"
                                {...register('contact_name')}
                                placeholder="Name"
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#2C3E50] placeholder-slate-400 focus:ring-2 focus:ring-[#5B9DFF] focus:border-transparent"
                              />
                              <input
                                type="email"
                                {...register('contact_email')}
                                placeholder="Email address"
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#2C3E50] placeholder-slate-400 focus:ring-2 focus:ring-[#5B9DFF] focus:border-transparent"
                              />
                            </div>
                          </div>
                        </div>
                      </details>
                    </div>

                    {/* Error */}
                    {submitError && (
                      <div className="px-6 py-3 bg-red-50 border-t border-red-200">
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
                            ? 'bg-slate-100 cursor-not-allowed text-slate-400'
                            : 'bg-[#5B9DFF] hover:bg-[#3A72D9] text-white shadow-md shadow-[#5B9DFF]/20'
                        }`}
                      >
                        {isSubmitting && (
                          <Loader2 className="w-5 h-5 animate-spin" />
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

      {/* ─────────────────────── AFFILIATION STRIP ─────────────────────── */}
      <div className="bg-white border-t border-b border-slate-100 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            An independent research project from the
          </span>
          <div className="hidden sm:block h-4 w-px bg-slate-200" />
          <a
            href="https://www.ischool.berkeley.edu/projects/2026/av-watch-transparency-platform-autonomous-vehicle-accountability"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              src="/berkeley-ischool-logo.svg"
              alt="UC Berkeley School of Information"
              className="h-12 object-contain opacity-80 hover:opacity-100 transition"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </a>
        </div>
      </div>

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
                Yet there is no simple, fast way for people to report what they witness on the road.{' '}
                <span className="font-semibold text-[#2C3E50]">AV Watch changes that.</span>
              </p>
              <p>
                {/* Every report is structured, geolocated, and routed to the California DMV&apos;s Autonomous Vehicles Program — the agency that issues permits and has the authority to suspend them. */}
                Substantiated crowdsourced reports add up. They ensure stakeholders understand public trust of autonomous vehicles.
              </p>
              <p className="hidden lg:block">
                AV Watch is built by a team of independent researchers at UC Berkeley&apos;s School of Information.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────── RECENT REPORTS ─────────────────────── */}
      <section id="reports" className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <h2 className="text-3xl font-bold text-[#2C3E50] mb-2">
              Recent Reports
            </h2>
            <p className="text-slate-500">
              {/* Autonomous Vehicle incidents from real community reports. */}
              Incidents reported by the community.
            </p>
          </div>

          {reportInitialLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-2xl bg-white border border-slate-200 overflow-hidden animate-pulse">
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
            <p className="text-slate-400 text-sm">No reports yet.</p>
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

      {/* ─────────────────────── NEWS HEADLINES ─────────────────────── */}
      <section id="news" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold text-[#2C3E50] mb-2">
                In the News
              </h2>
              <p className="text-slate-500">
                The latest coverage on autonomous vehicle incidents and policy.
              </p>
            </div>
            <Link href="/news" className="shrink-0 text-sm font-medium text-[#5B9DFF] hover:text-[#3A72D9] transition">
              See all news →
            </Link>
          </div>
          <NewsHeadlines />
        </div>
      </section>

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
              <p className="text-blue-100 text-lg leading-relaxed">
                AV Watch is an independent, community-driven platform for
                reporting and tracking autonomous vehicle incidents. We believe
                transparency supports the safe and responsible deployment of
                self-driving technology.
              </p>
              <p className="text-blue-100 text-lg leading-relaxed mt-4">
                <a
                  href="https://www.ischool.berkeley.edu/projects/2026/av-watch-transparency-platform-autonomous-vehicle-accountability"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 text-white hover:text-blue-200 transition font-medium"
                >
                  Learn more about the project and team →
                </a>
              </p>
              <div className="mt-8">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-blue-100">
                  Get in touch
                </h3>
                <p className="mt-2 text-blue-100 text-base leading-relaxed">
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
              >
                <img
                  src="/berkeley-ischool-logo.svg"
                  alt="UC Berkeley School of Information"
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
