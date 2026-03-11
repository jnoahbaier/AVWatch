'use client';

import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  MapPin,
  Calendar,
  CheckCircle,
  Loader2,
  Upload,
  X,
} from 'lucide-react';
import {
  INCIDENT_TYPE_LABELS,
  REPORT_COMPANY_OPTIONS,
  REPORTER_TYPE_LABELS,
} from '@/lib/utils';

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

const INCIDENT_ICONS: Record<string, string> = {
  collision: '💥',
  near_miss: '⚠️',
  sudden_behavior: '⚡',
  blockage: '🚧',
  other: '📋',
};

export default function ReportPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [locationStatus, setLocationStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
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

  if (isSuccess) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="mx-auto w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-12 h-12 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
            Report Submitted
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mb-8">
            Thank you for contributing to AV accountability. Your report has
            been added to our database.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => {
                setIsSuccess(false);
                setLocationStatus('idle');
                setSelectedFiles([]);
              }}
              className="px-6 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-400 transition"
            >
              Submit Another
            </button>
            <a
              href="/map"
              className="px-6 py-3 border border-slate-300 dark:border-slate-600 rounded-lg font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              View on Map →
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-10">
      <div className="max-w-xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Report an AV Incident
          </h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            Takes about 60 seconds. No account required.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit, (errs) => {
          if (errs.latitude || errs.longitude) {
            setSubmitError('Please capture your location.');
          } else if (errs.incident_type) {
            setSubmitError('Please select what happened.');
          } else {
            setSubmitError('Please fill in all required fields.');
          }
        })}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">

            {/* ── Section 1: What happened ── */}
            <div className="p-6">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
                What happened? <span className="text-red-400">*</span>
              </p>
              <div className="grid grid-cols-1 gap-2">
                {Object.entries(INCIDENT_TYPE_LABELS).map(([value, label]) => (
                  <label
                    key={value}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition ${
                      watchedType === value
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
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
                      className={`font-medium ${
                        watchedType === value
                          ? 'text-green-700 dark:text-green-400'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {label}
                    </span>
                    {watchedType === value && (
                      <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />
                    )}
                  </label>
                ))}
              </div>
              {errors.incident_type && (
                <p className="mt-2 text-sm text-red-500">Required</p>
              )}
            </div>

            {/* ── Section 2: Company ── */}
            <div className="p-6">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
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
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                          : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      {label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* ── Section 3: Location & time ── */}
            <div className="p-6">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
                Where &amp; when? <span className="text-red-400">*</span>
              </p>

              <button
                type="button"
                onClick={getLocation}
                disabled={locationStatus === 'loading'}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl border-2 font-medium transition mb-3 ${
                  locationStatus === 'success'
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                    : 'border-dashed border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-green-400 hover:text-green-600'
                }`}
              >
                {locationStatus === 'loading' ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : locationStatus === 'success' ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <MapPin className="w-5 h-5" />
                )}
                {locationStatus === 'success'
                  ? 'Location captured'
                  : locationStatus === 'loading'
                  ? 'Getting location…'
                  : 'Use my current location'}
              </button>

              {watchedAddress && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-3 truncate">
                  📍 {watchedAddress}
                </p>
              )}
              {locationStatus === 'error' && (
                <p className="text-sm text-red-500 mb-3">
                  Could not get location. Please enable location services.
                </p>
              )}

              <input type="hidden" {...register('latitude', { valueAsNumber: true })} />
              <input type="hidden" {...register('longitude', { valueAsNumber: true })} />
              <input type="hidden" {...register('city')} />

              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <input
                  type="datetime-local"
                  {...register('occurred_at')}
                  className="flex-1 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* ── Section 4: Your role ── */}
            <div className="p-6">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
                I was a…
              </p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(REPORTER_TYPE_LABELS).map(([value, label]) => (
                  <label key={value} className="cursor-pointer">
                    <input
                      type="radio"
                      value={value}
                      {...register('reporter_type')}
                      className="sr-only peer"
                    />
                    <span className="inline-flex items-center px-4 py-2 rounded-full border-2 text-sm font-medium transition select-none border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-slate-300 peer-checked:border-green-500 peer-checked:bg-green-50 dark:peer-checked:bg-green-900/20 peer-checked:text-green-700 dark:peer-checked:text-green-400">
                      {label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* ── Section 5: Description & photos ── */}
            <div className="p-6">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
                Details (optional)
              </p>

              <textarea
                {...register('description')}
                rows={4}
                placeholder="Describe what happened — the more detail the better…"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none text-sm mb-4"
              />

              <div
                className="border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-xl p-5 text-center cursor-pointer hover:border-green-400 transition"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-6 h-6 mx-auto text-slate-300 mb-1.5" />
                <p className="text-sm text-slate-400">
                  Add photos or video <span className="text-slate-300">(optional)</span>
                </p>
                <p className="text-xs text-slate-300 mt-0.5">PNG, JPG, MP4 · max 3 files</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => {
                    setSelectedFiles(Array.from(e.target.files || []).slice(0, 3));
                  }}
                />
              </div>

              {selectedFiles.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {selectedFiles.map((file, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between text-sm bg-slate-50 dark:bg-slate-700/50 rounded-lg px-3 py-2"
                    >
                      <span className="truncate text-slate-700 dark:text-slate-300">
                        {file.name}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedFiles((prev) => prev.filter((_, j) => j !== i))
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

            {/* ── Error & Submit ── */}
            {submitError && (
              <div className="px-6 py-3 bg-red-50 dark:bg-red-900/20 border-t border-red-100 dark:border-red-800">
                <p className="text-sm text-red-600 dark:text-red-400 text-center">
                  {submitError}
                </p>
              </div>
            )}

            <div className="p-6">
              <button
                type="submit"
                disabled={isSubmitting || !watchedType || !hasLocation}
                className="w-full py-4 bg-green-500 hover:bg-green-400 disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white disabled:text-slate-400 dark:disabled:text-slate-500 rounded-xl font-semibold text-base transition flex items-center justify-center gap-2"
              >
                {isSubmitting && <Loader2 className="w-5 h-5 animate-spin" />}
                {isSubmitting ? 'Submitting…' : 'Submit Report'}
              </button>
              <p className="mt-3 text-center text-xs text-slate-400">
                Anonymous by default · no account required · your location is never tracked
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
