'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Tile, SkeletonText, ActionableNotification } from '@carbon/react';
import type { UseQueryResult } from '@tanstack/react-query';
import type { ActivityResponse } from '@/hooks/useRecentActivity';
import styles from './RecentActivityPanel.module.scss';

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
  // Render BOTH date and time (e.g. "Oct 8, 2026, 2:14 PM") — never a time-only
  // stamp, so two events on different days are distinguishable across a day
  // boundary / multi-day recess (UX-Mockup §Activity Feed Row Format).
  return new Date(iso).toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function RecentActivityPanel({
  query,
}: {
  query: UseQueryResult<ActivityResponse>;
}) {
  const { data, isLoading, isError, refetch } = query;
  // 08-10: the activity query now returns `{ recentActivity, statusCounts }` —
  // the feed reads the recentActivity array.
  const entries = data?.recentActivity ?? [];

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
    <Tile
      data-testid="recent-activity-panel"
      aria-label="Recent activity"
    >
      <h2 className={styles.heading}>
        Recent Activity{' '}
        <span className={styles.count}>({entries.length} today)</span>
      </h2>

      {isLoading && (
        <div aria-hidden="true">
          <SkeletonText paragraph lineCount={4} width="100%" />
        </div>
      )}

      {isError && (
        <ActionableNotification
          kind="error"
          lowContrast
          inline
          hideCloseButton
          role="alert"
          title="Unable to load trial activity — please retry"
          actionButtonLabel="Reload"
          onActionButtonClick={() => refetch()}
        />
      )}

      {!isLoading && !isError && entries.length === 0 && (
        <p className={styles.empty}>No activity recorded yet today.</p>
      )}

      {!isLoading && !isError && entries.length > 0 && (
        <ul data-testid="recent-activity-list" className={styles.list}>
          {entries.map((e) => (
            <li
              key={e.eventId}
              className={`${styles.row} ${highlighted.has(e.eventId) ? styles.highlighted : ''}`}
            >
              <Link
                href={`/exhibit/${e.exhibitId}?event=${e.eventId}`}
                data-testid="recent-activity-row"
                className={styles.link}
              >
                <span className={styles.bullet} aria-hidden="true">
                  ●
                </span>
                {/* Prefix each row with its exhibit label so even a raw
                    STATUS_CHANGE row is attributed to an exhibit (UX-Mockup:
                    "Exhibit 3 — MARKED → OFFERED, …"). Two separate spans kept
                    (summary + time) since layout/styling depend on the structure;
                    the label is prepended into the summary span only. */}
                <span className={styles.summary}>
                  {e.exhibitLabel} — {e.summary}
                </span>
                <span className={styles.time}>{formatTime(e.recordedAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Tile>
  );
}
