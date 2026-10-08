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
            // Phase 5 (Y3-integrations.md §7.3): on a multi-tab demo, returning
            // to a backgrounded tab must catch up without a manual refresh.
            // Per-query refetchInterval (4s) handles the foreground; this handles
            // focus return. refetchIntervalInBackground is deliberately left at
            // its react-query default (false) so polling PAUSES while the tab is
            // hidden and resumes/catches-up on focus — no custom visibility code.
            refetchOnWindowFocus: true,
          },
        },
      }),
  );
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
