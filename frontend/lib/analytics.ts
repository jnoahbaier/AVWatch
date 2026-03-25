/**
 * PostHog analytics helpers
 *
 * Usage:
 *   import { track } from '@/lib/analytics';
 *   track('report_submitted', { incident_type: 'collision', av_company: 'waymo' });
 *
 * UTM params (utm_source, utm_campaign, utm_medium, utm_content) are captured
 * automatically by PostHog on every pageview — no extra work needed.
 */

declare global {
  interface Window {
    // posthog is injected by PostHogProvider
    posthog?: {
      capture: (event: string, properties?: Record<string, unknown>) => void;
    };
  }
}

/** Fire a named analytics event with optional properties. No-ops if PostHog isn't loaded. */
export function track(event: string, properties?: Record<string, unknown>) {
  try {
    window.posthog?.capture(event, properties);
  } catch {
    // Never let analytics errors surface to users
  }
}

/**
 * Standard event names used across the app.
 * Keep these consistent — PostHog dashboards are keyed to exact strings.
 */
export const Events = {
  /** User interacted with the report form for the first time */
  FORM_STARTED: 'report_form_started',
  /** User attached at least one photo/video */
  MEDIA_ATTACHED: 'report_media_attached',
  /** User successfully submitted a report */
  REPORT_SUBMITTED: 'report_submitted',
  /** User clicked "View Recent Incidents" after submitting */
  VIEW_INCIDENTS_CLICKED: 'view_incidents_clicked',
} as const;
