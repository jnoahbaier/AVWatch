'use client';

import { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  MapPin,
  Calendar,
  CheckCircle,
  Loader2,
  Upload,
  Camera,
  X,
  ShieldCheck,
  GraduationCap,
  UserX,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import {
  INCIDENT_TYPE_LABELS,
  REPORT_COMPANY_OPTIONS,
  REPORTER_TYPE_LABELS,
} from '@/lib/utils';

const NewsGrid = dynamic(
  () => import('@/components/news/NewsGrid').then((m) => m.NewsGrid),
  { ssr: false }
);

const INCIDENT_ICONS: Record<string, string> = {
  collision: '💥',
  near_miss: '⚠️',
  sudden_behavior: '⚡',
  blockage: '🚧',
  other: '📋',
};

const reportSchema = z.object({
  incident_type: z.enum([
    'collision',
    'near_miss',
    'sudden_behavior',
    'blockage',
    'other',
  ]),
  av_company: z
    .enum(['waymo', 'zoox', 'tesla', 'other', 'unknown'])
    .default('other'),
  description: z.string().max(2000).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().optional(),
  city: z.string().optional(),
  occurred_at: z.string(),
  reporter_type: z
    .enum(['pedestrian', 'cyclist', 'driver', 'rider', 'other'])
    .optional(),
});

type ReportFormData = z.infer<typeof reportSchema>;

export default function Home() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [locationStatus, setLocationStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const carRef = useRef<HTMLDivElement>(null);
  const [carInView, setCarInView] = useState(false);

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

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ReportFormData>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      av_company: 'other',
      occurred_at: new Date().toISOString().slice(0, 16),
    },
  });

  const watchedType = watch('incident_type');
  const watchedCompany = watch('av_company');
  const watchedLat = watch('latitude');
  const watchedLng = watch('longitude');
  const watchedAddress = watch('address');

  const hasLocation =
    typeof watchedLat === 'number' &&
    !isNaN(watchedLat) &&
    typeof watchedLng === 'number' &&
    !isNaN(watchedLng);

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

  const onSubmit = async (data: ReportFormData) => {
    if (!hasLocation) {
      setSubmitError('Please capture your location before submitting.');
      return;
    }
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const { createIncident } = await import('@/lib/supabase');
      await createIncident({
        incident_type: data.incident_type,
        av_company: data.av_company,
        description: data.description,
        latitude: data.latitude,
        longitude: data.longitude,
        address: data.address,
        city: data.city,
        occurred_at: new Date(data.occurred_at).toISOString(),
        reporter_type: data.reporter_type,
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
    }
  };

  const handleReset = () => {
    setIsSuccess(false);
    setLocationStatus('idle');
    setSelectedFiles([]);
    setSubmitError(null);
    reset({
      av_company: 'other',
      occurred_at: new Date().toISOString().slice(0, 16),
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
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_460px] gap-16 items-start">

            {/* ── LEFT: copy + imagery ── */}
            <div className="pt-4 flex flex-col">
              <h1 className="text-5xl lg:text-6xl font-bold text-slate-900 leading-[1.1] mb-5">
                Witnessed an<br />
                <span className="text-blue-600">AV Incident?</span>
              </h1>

              <p className="text-xl text-slate-600 mb-8 max-w-lg leading-relaxed">
                Report it in under 60 seconds. Help make autonomous vehicles
                safer for everyone.
              </p>

              {/* Trust indicators */}
              <div className="flex flex-wrap gap-3 mb-10">
                {[
                  { icon: UserX, label: 'Fully anonymous' },
                  { icon: GraduationCap, label: 'Independent research' },
                  { icon: ShieldCheck, label: 'No account needed' },
                ].map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm text-sm text-slate-700 font-medium"
                  >
                    <Icon className="w-3.5 h-3.5 text-blue-500" />
                    {label}
                  </div>
                ))}
              </div>

              {/* AV car imagery — drives in from left on scroll */}
              <div
                ref={carRef}
                className={`relative mt-16 lg:-mr-32 transition-all duration-[1100ms] ease-out ${
                  carInView
                    ? 'translate-x-0 opacity-100'
                    : '-translate-x-full opacity-0'
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
            <div className="lg:sticky lg:top-24">
              {isSuccess ? (
                /* Success state */
                <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-10 text-center">
                  <div className="mx-auto w-16 h-16 bg-blue-50 border border-blue-200 rounded-full flex items-center justify-center mb-5">
                    <CheckCircle className="w-8 h-8 text-blue-500" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">
                    Report Submitted
                  </h2>
                  <p className="text-slate-500 mb-8">
                    Thank you for contributing to AV accountability. Your report
                    has been added to our database.
                  </p>
                  <button
                    onClick={handleReset}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition shadow-sm"
                  >
                    Submit Another Report
                  </button>
                </div>
              ) : (
                /* Form */
                <form
                  onSubmit={handleSubmit(onSubmit, (errs) => {
                    if (errs.latitude || errs.longitude) {
                      setSubmitError('Please capture your location.');
                    } else if (errs.incident_type) {
                      setSubmitError('Please select what happened.');
                    } else {
                      setSubmitError('Please fill in all required fields.');
                    }
                  })}
                >
                  <div className="bg-white rounded-2xl shadow-xl border border-slate-100 divide-y divide-slate-100">

                    {/* Header */}
                    <div className="px-6 pt-6 pb-4">
                      <h2 className="text-lg font-bold text-slate-900">
                        Report an Incident
                      </h2>
                      <p className="text-sm text-slate-500 mt-0.5">
                        Takes about 60 seconds · no account required
                      </p>
                    </div>

                    {/* Section 1: What happened */}
                    <div className="p-6">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                        What happened? <span className="text-red-500">*</span>
                      </p>
                      <div className="grid grid-cols-1 gap-2">
                        {Object.entries(INCIDENT_TYPE_LABELS).map(
                          ([value, label]) => (
                            <label
                              key={value}
                              className={`flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition ${
                                watchedType === value
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/50'
                              }`}
                            >
                              <input
                                type="radio"
                                value={value}
                                {...register('incident_type')}
                                className="sr-only"
                              />
                              <span className="text-lg w-7 text-center select-none">
                                {INCIDENT_ICONS[value]}
                              </span>
                              <span
                                className={`font-medium text-sm ${
                                  watchedType === value
                                    ? 'text-blue-700'
                                    : 'text-slate-700'
                                }`}
                              >
                                {label}
                              </span>
                              {watchedType === value && (
                                <CheckCircle className="w-4 h-4 text-blue-500 ml-auto" />
                              )}
                            </label>
                          )
                        )}
                      </div>
                      {errors.incident_type && (
                        <p className="mt-2 text-sm text-red-500">Required</p>
                      )}
                    </div>

                    {/* Section 2: Company */}
                    <div className="p-6">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                        Which company?
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {REPORT_COMPANY_OPTIONS.map(({ value, label }) => (
                          <label key={value} className="cursor-pointer">
                            <input
                              type="radio"
                              value={value}
                              {...register('av_company')}
                              className="sr-only peer"
                            />
                            <span
                              className={`inline-flex items-center px-4 py-2 rounded-full border-2 text-sm font-medium transition select-none ${
                                watchedCompany === value
                                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                                  : 'border-slate-200 text-slate-600 hover:border-blue-300'
                              }`}
                            >
                              {label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Section 3: Location & time */}
                    <div className="p-6">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                        Where &amp; when? <span className="text-red-500">*</span>
                      </p>
                      <button
                        type="button"
                        onClick={getLocation}
                        disabled={locationStatus === 'loading'}
                        className={`w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl border-2 font-medium transition mb-3 text-sm ${
                          locationStatus === 'success'
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-dashed border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50'
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
                      {watchedAddress && (
                        <p className="text-xs text-slate-500 mb-3 truncate">
                          📍 {watchedAddress}
                        </p>
                      )}
                      {locationStatus === 'error' && (
                        <p className="text-xs text-red-500 mb-3">
                          Could not get location. Please enable location services.
                        </p>
                      )}
                      <input
                        type="hidden"
                        {...register('latitude', { valueAsNumber: true })}
                      />
                      <input
                        type="hidden"
                        {...register('longitude', { valueAsNumber: true })}
                      />
                      <input type="hidden" {...register('city')} />
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <input
                          type="datetime-local"
                          {...register('occurred_at')}
                          className="flex-1 px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    {/* Section 4: Your role */}
                    <div className="p-6">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                        I was a…
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(REPORTER_TYPE_LABELS).map(
                          ([value, label]) => (
                            <label key={value} className="cursor-pointer">
                              <input
                                type="radio"
                                value={value}
                                {...register('reporter_type')}
                                className="sr-only peer"
                              />
                              <span className="inline-flex items-center px-4 py-2 rounded-full border-2 text-sm font-medium transition select-none border-slate-200 text-slate-600 hover:border-blue-300 peer-checked:border-blue-500 peer-checked:bg-blue-50 peer-checked:text-blue-700">
                                {label}
                              </span>
                            </label>
                          )
                        )}
                      </div>
                    </div>

                    {/* Section 5: Details */}
                    <div className="p-6">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                        Details (optional)
                      </p>
                      <textarea
                        {...register('description')}
                        rows={3}
                        placeholder="Describe what happened…"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm mb-3"
                      />
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
                          <span className="text-xs text-slate-500">Choose file</span>
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
                      <button
                        type="submit"
                        disabled={isSubmitting || !watchedType || !hasLocation}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 disabled:cursor-not-allowed text-white disabled:text-slate-400 rounded-xl font-semibold text-base transition flex items-center justify-center gap-2 shadow-md shadow-blue-500/20"
                      >
                        {isSubmitting && (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        )}
                        {isSubmitting ? 'Submitting…' : 'Submit Report'}
                      </button>
                      <p className="mt-3 text-center text-xs text-slate-400">
                        Anonymous by default · your location is never stored
                      </p>
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
            An independent research project by the
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
        className="relative py-28 border-t border-b border-slate-200 overflow-hidden"
        style={{
          backgroundImage: 'url(/waymo_large_blur.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Left-side white fade so text stays readable */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/80 to-white/0 pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Text occupies left half only */}
          <div className="max-w-xl">
            <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 leading-tight mb-8">
              Autonomous Vehicles<br />
              <span className="text-blue-600">are expanding fast.</span>
            </h2>

            <div className="space-y-5 text-slate-700 text-lg leading-relaxed">
              <p>
                Yet there is no simple, reliable way for people to report
                what they witness on the road.
              </p>
              <p>
                AV Watch changes that.
              </p>
              <p>
                Every report is structured, geolocated, and routed to the
                California DMV's Autonomous Vehicles Program, the agency that
                issues permits and has the authority to suspend them.
              </p>
              <p>
                AV Watch is built by a team of independent researchers at UC
                Berkeley's School of Information.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────── NEWS SECTION ─────────────────────── */}
      <section id="news" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider mb-4">
              Latest Coverage
            </span>
            <h2 className="text-3xl font-bold text-slate-900 mb-2">
              AV News
            </h2>
            <p className="text-slate-500">
              Stay informed on autonomous vehicle developments and safety.
            </p>
          </div>
          <NewsGrid limit={12} />
        </div>
      </section>

      {/* ─────────────────────── ABOUT SECTION ─────────────────────── */}
      <section id="about" className="py-20 bg-blue-600 relative overflow-hidden">
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
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-blue-400/30 blur-3xl pointer-events-none" />
        <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-blue-500/20 blur-3xl pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

            {/* Left: Mission */}
            <div>
              <span className="inline-flex items-center px-3 py-1.5 rounded-full border border-blue-400/40 bg-blue-500/30 text-blue-100 text-xs font-semibold uppercase tracking-wider mb-6">
                Our Mission
              </span>
              <h2 className="text-3xl font-bold text-white mb-5">
                About AV Watch
              </h2>
              <p className="text-blue-100 text-lg leading-relaxed">
                AV Watch is an independent, community-driven platform for
                reporting and tracking autonomous vehicle incidents. We believe
                transparency and public accountability are essential to the safe
                deployment of self-driving technology.
              </p>
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

      {/* ─────────────────────── FOOTER ─────────────────────── */}
      <footer className="bg-white border-t border-slate-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
              <span className="text-white font-bold text-xs">AV</span>
            </div>
            <span className="font-semibold text-slate-900 text-sm">AV Watch</span>
          </div>
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} AV Watch · Built for AV accountability
          </p>
        </div>
      </footer>
    </div>
  );
}
