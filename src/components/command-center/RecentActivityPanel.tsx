'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { UseQueryResult } from '@tanstack/react-query';
import type { RecentActivityEntry } from '@/services/activity';

// F8 Command Center — Recent Activity panel. The full-width TOP panel (UX
// Screen-00: newest-first, scrollable, NO cap / NO pagination — "scroll, don't
// truncate"). STRICTLY read-only: the only interactive elements are per-row
// link-throughs to the Phase 4 exhibit deep-link, plus a READ-retry on error
// (a refetch of a read, never a write — criterion 3).
//
// It renders the 05-01 `summary` string VERBATIM (React auto-escapes; threat
// T-05-05) — the wording is the shared summarizer's Exhibit-Detail-parity text,
// so the Command Center can never drift from the timeline.
//
// The page owns the single useRecentActivity instance (it also feeds the
// freshness indicator) and passes it in as `query` — this panel does not call
// the hook itself, so the screen never runs a duplicate activity query.

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function RecentActivityPanel({
  query,
}: {
  query: UseQueryResult<RecentActivityEntry[]>;
}) {
  const { data, isLoading, isError, refetch } = query;
  const entries = data ?? [];

  // New-row fade-in (CONTEXT locked default, Command-Center-only this phase):
  // track the eventIds seen on the previous render; any eventId not in that set
  // gets a transient highlight that fades out ~400ms later (matching Phase 4's
  // Timeline deep-link highlight duration for consistency). react-query updates
  // in place and we key rows by eventId, so React reconciles without a full
  // re-sort/flash — NO toast, NO "new data" banner (Y0-patterns).
  const seenRef = useRef<Set<string>>(new Set());
  // Per-id removal timers. Each highlighted row owns its OWN 400ms timer so a
  // later batch's effect run can never cancel an earlier batch's pending removal
  // (the previous single-timer-per-run design let back-to-back new events within
  // one 400ms window strand a row highlighted indefinitely).
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isLoading) return;
    const prevSeen = seenRef.current;
    const currentIds = entries.map((e) => e.eventId);
    // First successful render: seed the "seen" set WITHOUT highlighting (the
    // initial feed is not "new activity", it is the baseline).
    if (prevSeen.size === 0 && currentIds.length > 0) {
      seenRef.current = new Set(currentIds);
      return;
    }
    const fresh = currentIds.filter((id) => !prevSeen.has(id));
    seenRef.current = new Set(currentIds);
    if (fresh.length === 0) return;
    setHighlighted((prev) => {
      const next = new Set(prev);
      for (const id of fresh) next.add(id);
      return next;
    });
    const timers = timersRef.current;
    for (const id of fresh) {
      // Re-arm defensively if this id were somehow fresh again.
      const existing = timers.get(id);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        timers.delete(id);
        setHighlighted((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 400);
      timers.set(id, timer);
    }
    // No per-run cleanup: each id's timer is independent and self-clears. The
    // only teardown is on unmount (below), so an earlier batch's removal is
    // never cancelled by a later batch.
    // Depend on the concatenated id list so the effect runs whenever the set of
    // rows changes (new event arrives at the top), not on every object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries.map((e) => e.eventId).join(','), isLoading]);

  // Clear any pending removal timers on unmount.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  return (
    <section
      data-testid="recent-activity-panel"
      className="rounded-lg border bg-white p-4"
      aria-label="Recent activity"
    >
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">
        Recent Activity{' '}
        <span className="font-normal text-gray-500">({entries.length} today)</span>
      </h2>

      {isLoading && (
        <ul className="space-y-2" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="h-5 w-full animate-pulse rounded bg-gray-100" />
          ))}
        </ul>
      )}

      {isError && (
        <div className="text-sm text-red-600" role="alert">
          Unable to load trial activity — please retry.{' '}
          <button
            type="button"
            onClick={() => refetch()}
            className="font-medium underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !isError && entries.length === 0 && (
        <p className="text-sm text-gray-500">No activity recorded yet today.</p>
      )}

      {!isLoading && !isError && entries.length > 0 && (
        <ul
          data-testid="recent-activity-list"
          className="max-h-96 divide-y divide-gray-100 overflow-y-auto"
        >
          {entries.map((e) => (
            <li
              key={e.eventId}
              className={`transition-colors duration-500 ${
                highlighted.has(e.eventId) ? 'bg-amber-50' : 'bg-transparent'
              }`}
            >
              <Link
                href={`/exhibit/${e.exhibitId}?event=${e.eventId}`}
                data-testid="recent-activity-row"
                className="flex items-baseline gap-2 px-1 py-2 text-sm hover:bg-gray-50"
              >
                <span className="text-gray-400" aria-hidden="true">
                  ●
                </span>
                <span className="flex-1 text-gray-800">{e.summary}</span>
                <span className="shrink-0 text-xs text-gray-400">
                  {formatTime(e.recordedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
