'use client';

import { useFreshness } from '@/hooks/useFreshness';

// F8 Command Center — freshness indicator (UX: tertiary, top-right, small type).
// Pure formatter over useFreshness: it is driven by the screen's freshness anchor
// (useRecentActivity's dataUpdatedAt/isFetching) and formats "🕐 updated Xs ago".
// Before the first successful fetch it reads "🕐 updating…". An optional faint
// pulsing dot indicates an in-flight poll (CONTEXT optional) — small and muted,
// never loud.
export function FreshnessIndicator({
  dataUpdatedAt,
  isFetching,
}: {
  dataUpdatedAt: number;
  isFetching: boolean;
}) {
  const { secondsAgo } = useFreshness(dataUpdatedAt, isFetching);

  return (
    <span
      data-testid="freshness-indicator"
      className="inline-flex items-center gap-1.5 text-xs text-gray-400"
      aria-live="polite"
    >
      <span aria-hidden="true">🕐</span>
      {secondsAgo === null ? (
        <span>updating…</span>
      ) : (
        <span>updated {secondsAgo}s ago</span>
      )}
      {isFetching && secondsAgo !== null && (
        <span
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-gray-300"
          aria-hidden="true"
        />
      )}
    </span>
  );
}
