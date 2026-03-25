'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Initialises PostHog once and fires a pageview on every client-side navigation.
 * Wrapped in a Suspense boundary in providers.tsx (required for useSearchParams).
 *
 * Set NEXT_PUBLIC_POSTHOG_KEY in Railway env vars to activate.
 * Without it this component is a no-op — no errors, no tracking.
 */
export function PostHogProvider() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key || typeof window === 'undefined') return;

    // Lazy-load posthog-js so it never blocks the initial render
    import('posthog-js').then(({ default: posthog }) => {
      if (!posthog.__loaded) {
        posthog.init(key, {
          api_host: 'https://us.i.posthog.com',
          // Capture UTM params automatically on every pageview
          capture_pageview: false,   // we fire manually below so we can include path
          capture_pageleave: true,
          autocapture: false,        // keep it lightweight — we fire explicit events
          persistence: 'localStorage',
          person_profiles: 'identified_only',
        });
      }

      // Expose on window so analytics.ts can call it without importing posthog-js again
      (window as Window & { posthog?: typeof posthog }).posthog = posthog;

      // Manual pageview — includes full URL so UTM params are attributed correctly
      posthog.capture('$pageview', {
        $current_url: window.location.href,
      });
    }).catch(() => {
      // PostHog load failure is non-fatal
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  return null;
}
