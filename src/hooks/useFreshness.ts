'use client';

import { useEffect, useState } from 'react';

export interface Freshness {
  // Whole seconds since the last SUCCESSFUL fetch, or null before the first
  // success. Resets to ~0 each time dataUpdatedAt advances (a new success);
  // keeps counting up if a later poll fails (dataUpdatedAt does not move).
  secondsAgo: number | null;
  isFetching: boolean;
}

// Feed it a query's `dataUpdatedAt` (0 until the first success) and `isFetching`.
// Ticks once per second so the indicator counts live without re-rendering the
// panel's data. Intended to be driven by whichever query the screen treats as
// its freshness anchor (Command Center uses useRecentActivity's).
export function useFreshness(dataUpdatedAt: number, isFetching: boolean): Freshness {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  const secondsAgo =
    dataUpdatedAt > 0 ? Math.max(0, Math.floor((now - dataUpdatedAt) / 1_000)) : null;

  return { secondsAgo, isFetching };
}
