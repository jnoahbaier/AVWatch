'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, Suspense } from 'react';
import { PostHogProvider } from '@/components/PostHogProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {/* PostHog analytics — no-op when NEXT_PUBLIC_POSTHOG_KEY is unset */}
      <Suspense fallback={null}>
        <PostHogProvider />
      </Suspense>
      {children}
    </QueryClientProvider>
  );
}

