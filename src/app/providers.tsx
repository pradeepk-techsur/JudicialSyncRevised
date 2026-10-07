'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Live-sync polling screens set their own refetchInterval per-query
            // (Y0-patterns.md "Polling-Based Live Sync Indicator", 3-5s); this
            // default only governs staleness between explicit refetches.
            staleTime: 2_000,
          },
        },
      }),
  );
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
