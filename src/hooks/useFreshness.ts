'use client';

import { useEffect, useState } from 'react';

export interface Freshness {
  // Whole seconds since the last SUCCESSFUL fetch, or null before the first
  // success. Resets to ~0 each time dataUpdatedAt advances (a new success);
  // keeps counting up if a later poll fails (dataUpdatedAt does not move).
  secondsAgo: number | null;
  isFetching: boolean;
  // Derived "the live stream has gone stale" signal: true once the latest
  // successful fetch is >= STALE_THRESHOLD_SECONDS old. Null-safe — before the
  // first success (secondsAgo === null) it is false, since there is nothing yet
  // to be stale. T-15 (LiveIndicator) uses this to flip from a green "Live"
  // badge to an amber "Connection lost" + Refresh affordance.
  isStale: boolean;
}

// The freshness window after which the live indicator is considered stale.
// Exactly 60 seconds per the T-15 acceptance criterion ("after 60 seconds
// without a successful update, the indicator turns amber and reads Connection
// lost"). Exported so the derivation and its unit test share one constant.
export const STALE_THRESHOLD_SECONDS = 60;

// Pure derivation of `isStale` from the current secondsAgo and the error state.
// Extracted so the 60s boundary is unit-testable without rendering the hook
// (the project's vitest harness is node-environment, no jsdom). A query in its
// error state is treated as stale regardless of how old the last success is —
// an active failure is itself the "connection lost" signal the indicator exists
// to surface.
export function computeIsStale(secondsAgo: number | null, isError = false): boolean {
  if (isError) return true;
  return secondsAgo !== null && secondsAgo >= STALE_THRESHOLD_SECONDS;
}

// Feed it a query's `dataUpdatedAt` (0 until the first success), `isFetching`,
// and optionally `isError`. Ticks once per second so the indicator counts live
// without re-rendering the panel's data. Intended to be driven by whichever
// query the screen treats as its freshness anchor (Command Center uses
// useRecentActivity's). `isError` is an additive, optional third parameter — the
// existing two-argument callers are unaffected (it defaults to false), so the
// `{ secondsAgo }` behavior they rely on is unchanged.
export function useFreshness(
  dataUpdatedAt: number,
  isFetching: boolean,
  isError = false,
): Freshness {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  const secondsAgo =
    dataUpdatedAt > 0 ? Math.max(0, Math.floor((now - dataUpdatedAt) / 1_000)) : null;

  return { secondsAgo, isFetching, isStale: computeIsStale(secondsAgo, isError) };
}
