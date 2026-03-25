/**
 * Server component that injects the PostHog key into the page at REQUEST time.
 *
 * Calling headers() opts this component into dynamic rendering so it runs on
 * every request — not at build time — meaning it always reflects the live
 * POSTHOG_KEY env var set in Railway, regardless of when the build ran.
 *
 * The rest of the page (static content, bulletin items, etc.) is unaffected.
 */
import { headers } from 'next/headers';

export async function AnalyticsScript() {
  // headers() call makes this component dynamic (per-request).
  // We don't actually use the headers — just need the side-effect.
  headers();

  const key = process.env.POSTHOG_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY ?? '';
  if (!key) return null;

  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `window.__PH_KEY=${JSON.stringify(key)}`,
      }}
    />
  );
}
