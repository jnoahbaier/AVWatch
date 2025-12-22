'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  MapPin,
  Calendar,
  Car,
  AlertTriangle,
  Upload,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import {
  INCIDENT_TYPE_LABELS,
  AV_COMPANY_LABELS,
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
    .enum(['waymo', 'cruise', 'zoox', 'tesla', 'other', 'unknown'])
    .default('unknown'),
  description: z.string().max(2000).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().optional(),
  occurred_at: z.string(),
  reporter_type: z
    .enum(['pedestrian', 'cyclist', 'driver', 'rider', 'other'])
    .optional(),
});

type ReportFormData = z.infer<typeof reportSchema>;

export default function ReportPage() {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [canSubmit, setCanSubmit] = useState(false);
  const [locationStatus, setLocationStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ReportFormData>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      av_company: 'unknown',
      occurred_at: new Date().toISOString().slice(0, 16),
    },
  });

  const [submitError, setSubmitError] = useState<string | null>(null);

  const watchedType = watch('incident_type');
  const watchedLat = watch('latitude');
  const watchedLng = watch('longitude');

  const hasLocation = typeof watchedLat === 'number' && !isNaN(watchedLat) && 
                      typeof watchedLng === 'number' && !isNaN(watchedLng);

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

        // Reverse geocode for address
        try {
          const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${position.coords.longitude},${position.coords.latitude}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`
          );
          const data = await response.json();
          if (data.features?.[0]) {
            setValue('address', data.features[0].place_name);
          }
        } catch (e) {
          console.error('Geocoding failed:', e);
        }

        setLocationStatus('success');
      },
      () => {
        setLocationStatus('error');
      }
    );
  };

  const onSubmit = async (data: ReportFormData) => {
    // Prevent submission unless explicitly allowed (user clicked Submit on step 3)
    if (!canSubmit) {
      console.log('Blocked early submission - submission not explicitly triggered');
      return;
    }
    
    setCanSubmit(false); // Reset flag
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
        occurred_at: new Date(data.occurred_at).toISOString(),
        reporter_type: data.reporter_type,
      });
      setIsSuccess(true);
    } catch (error) {
      console.error('Submission failed:', error);
      setSubmitError(error instanceof Error ? error.message : 'Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNextStep = () => {
    if (step === 2 && !hasLocation) {
      setSubmitError('Please capture your location before continuing.');
      return;
    }
    setSubmitError(null);
    setStep(step + 1);
  };

  if (isSuccess) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
            Report Submitted
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mb-8">
            Thank you for contributing to AV safety. Your report will be
            reviewed and added to our database.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => {
                setIsSuccess(false);
                setStep(1);
              }}
              className="px-6 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-400 transition"
            >
              Submit Another Report
            </button>
            <a
              href="/map"
              className="px-6 py-3 border border-slate-300 dark:border-slate-600 rounded-lg font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              View Map
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-12">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Report an AV Incident
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Your report helps build a comprehensive picture of AV safety in our
            community.
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition ${
                  step >= s
                    ? 'bg-green-500 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                }`}
              >
                {s}
              </div>
              {s < 3 && (
                <div
                  className={`w-12 h-1 mx-2 rounded ${
                    step > s
                      ? 'bg-green-500'
                      : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <form 
          onSubmit={handleSubmit(onSubmit, (errors) => {
            console.error('Form validation errors:', errors);
            if (errors.latitude || errors.longitude) {
              setSubmitError('Location is required. Please go back to Step 2 and capture your location.');
            } else if (errors.incident_type) {
              setSubmitError('Please select an incident type.');
            } else if (errors.occurred_at) {
              setSubmitError('Please specify when the incident occurred.');
            } else {
              setSubmitError('Please fill in all required fields.');
            }
          })}
          onKeyDown={(e) => {
            // Prevent Enter key from submitting form unless on step 3
            if (e.key === 'Enter' && step !== 3) {
              e.preventDefault();
            }
          }}
        >
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* Step 1: Incident Type */}
            {step === 1 && (
              <div className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <AlertTriangle className="w-6 h-6 text-orange-500" />
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                    What happened?
                  </h2>
                </div>

                <div className="space-y-3">
                  {Object.entries(INCIDENT_TYPE_LABELS).map(([value, label]) => (
                    <label
                      key={value}
                      className={`flex items-center p-4 rounded-lg border-2 cursor-pointer transition ${
                        watchedType === value
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        value={value}
                        {...register('incident_type')}
                        className="sr-only"
                      />
                      <span
                        className={`w-5 h-5 rounded-full border-2 mr-4 flex items-center justify-center ${
                          watchedType === value
                            ? 'border-green-500'
                            : 'border-slate-300'
                        }`}
                      >
                        {watchedType === value && (
                          <span className="w-3 h-3 rounded-full bg-green-500" />
                        )}
                      </span>
                      <span className="font-medium text-slate-900 dark:text-white">
                        {label}
                      </span>
                    </label>
                  ))}
                </div>

                {errors.incident_type && (
                  <p className="mt-2 text-sm text-red-500">
                    Please select an incident type
                  </p>
                )}

                <div className="mt-6">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    AV Company (if known)
                  </label>
                  <select
                    {...register('av_company')}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    {Object.entries(AV_COMPANY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Step 2: Location & Time */}
            {step === 2 && (
              <div className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <MapPin className="w-6 h-6 text-blue-500" />
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                    Where and when?
                  </h2>
                </div>

                {/* Location */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Location
                  </label>
                  <button
                    type="button"
                    onClick={getLocation}
                    disabled={locationStatus === 'loading'}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-400 hover:border-green-500 hover:text-green-600 transition"
                  >
                    {locationStatus === 'loading' ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : locationStatus === 'success' ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <MapPin className="w-5 h-5" />
                    )}
                    {locationStatus === 'success'
                      ? 'Location captured'
                      : locationStatus === 'loading'
                      ? 'Getting location...'
                      : 'Use my current location'}
                  </button>

                  {watchedLat && watchedLng && (
                    <p className="mt-2 text-sm text-slate-500">
                      {watchedLat.toFixed(6)}, {watchedLng.toFixed(6)}
                    </p>
                  )}

                  {locationStatus === 'error' && (
                    <p className="mt-2 text-sm text-red-500">
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
                </div>

                {/* Date/Time */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    <Calendar className="w-4 h-4 inline mr-2" />
                    When did this happen?
                  </label>
                  <input
                    type="datetime-local"
                    {...register('occurred_at')}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                {/* Reporter Type */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    I am a...
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(REPORTER_TYPE_LABELS).map(
                      ([value, label]) => (
                        <label
                          key={value}
                          className="cursor-pointer"
                        >
                          <input
                            type="radio"
                            value={value}
                            {...register('reporter_type')}
                            className="sr-only peer"
                          />
                          <span className="px-4 py-2 rounded-full border border-slate-300 dark:border-slate-600 text-sm font-medium text-slate-600 dark:text-slate-400 peer-checked:border-green-500 peer-checked:bg-green-50 dark:peer-checked:bg-green-900/20 peer-checked:text-green-700 dark:peer-checked:text-green-400 transition">
                            {label}
                          </span>
                        </label>
                      )
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Details */}
            {step === 3 && (
              <div className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <Car className="w-6 h-6 text-purple-500" />
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                    Tell us more
                  </h2>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Describe what happened (optional)
                  </label>
                  <textarea
                    {...register('description')}
                    rows={5}
                    placeholder="Provide any additional details about the incident..."
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                  />
                  <p className="mt-1 text-sm text-slate-500">
                    Max 2000 characters
                  </p>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    <Upload className="w-4 h-4 inline mr-2" />
                    Photos or videos (optional)
                  </label>
                  <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-8 text-center">
                    <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                    <p className="text-sm text-slate-500">
                      Drag and drop files here, or click to select
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      PNG, JPG, MP4 up to 10MB
                    </p>
                    <input
                      type="file"
                      multiple
                      accept="image/*,video/*"
                      className="hidden"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {submitError && (
              <div className="px-6 py-3 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800">
                <p className="text-sm text-red-600 dark:text-red-400 text-center">
                  {submitError}
                </p>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex justify-between">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={() => setStep(step - 1)}
                  className="px-6 py-2 text-slate-600 dark:text-slate-400 font-medium hover:text-slate-900 dark:hover:text-white transition"
                >
                  Back
                </button>
              ) : (
                <div />
              )}

              {step < 3 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  disabled={(step === 1 && !watchedType) || (step === 2 && !hasLocation)}
                  className="px-6 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  onClick={() => setCanSubmit(true)}
                  className="px-6 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-400 disabled:opacity-50 flex items-center gap-2 transition"
                >
                  {isSubmitting && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  Submit Report
                </button>
              )}
            </div>
          </div>
        </form>

        {/* Privacy Note */}
        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Your report will be reviewed before being published. Personal
          information is never shared.
        </p>
      </div>
    </div>
  );
}

