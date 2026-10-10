'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Tile, SkeletonText, ActionableNotification } from '@carbon/react';
import type { UseQueryResult } from '@tanstack/react-query';
import type { EventType } from '@prisma/client';
import type { RecentActivityEntry } from '@/services/activity';
import type { ActivityResponse } from '@/hooks/useRecentActivity';
import { ExhibitTag } from '@/components/shared/ExhibitTag';
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

// Exported so the full /activity page renders timestamps IDENTICALLY (09-04 T-04).
export function formatTime(iso: string): string {
  // Render BOTH date and time (e.g. "Oct 8, 2026, 2:14:07 PM") — never a
  // time-only stamp, so two events on different days are distinguishable across a
  // day boundary / multi-day recess (UX-Mockup §Activity Feed Row Format).
  // T-04: include seconds so every row in this panel uses ONE timestamp format
  // that is precise to the second (the ticket's "one consistent format including
  // seconds"). This is the single shared formatter for every row.
  return new Date(iso).toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

// T-04: a 60-second window for collapsing consecutive same-exhibit STATUS_CHANGE
// events into one summary row (ticket's "60-second activity-grouping window").
const GROUP_WINDOW_MS = 60_000;

// A rendered unit in the activity feed: either a single original entry, or a
// MERGED run of 2+ consecutive same-exhibit STATUS_CHANGE events that all fell
// within GROUP_WINDOW_MS of the run's first (oldest-in-run) entry. A merged unit
// carries every original entry so the UI can show a collapsed summary + an
// expandable list of the individual summaries.
export type GroupedActivityEntry =
  | { kind: 'single'; entry: RecentActivityEntry }
  | { kind: 'merged'; key: string; members: RecentActivityEntry[] };

// The displayed timestamp / day-anchor for a grouped unit — the newest member's
// recordedAt (members are newest-first, so index 0 is newest).
export function groupedRecordedAt(g: GroupedActivityEntry): string {
  return g.kind === 'single' ? g.entry.recordedAt : g.members[0].recordedAt;
}

/**
 * Collapse RUNS of 2+ consecutive entries that share the SAME exhibitId, are ALL
 * STATUS_CHANGE events, and whose recordedAt timestamps are ALL within 60s of the
 * run's first (oldest, i.e. last-in-array-order since the input is newest-first)
 * member into a single merged unit. Every other entry is emitted as a `single`.
 *
 * Input MUST be newest-first (the service's `orderBy: { recordedAt: 'desc' }`).
 * Exported so the full /activity page reuses the exact same grouping (09-04 T-04),
 * never a re-implementation.
 */
export function groupConsecutiveSameExhibit(
  entries: RecentActivityEntry[],
): GroupedActivityEntry[] {
  const out: GroupedActivityEntry[] = [];
  let i = 0;
  while (i < entries.length) {
    const start = entries[i];
    // A run can only start on a STATUS_CHANGE. Greedily extend while the next
    // entry is the same exhibit, also STATUS_CHANGE, and within 60s of the run's
    // OLDEST member so far (the window is measured against the first entry in the
    // run; newest-first order means the oldest is the last one appended).
    let j = i + 1;
    if (start.eventType === 'STATUS_CHANGE') {
      while (
        j < entries.length &&
        entries[j].eventType === 'STATUS_CHANGE' &&
        entries[j].exhibitId === start.exhibitId &&
        Math.abs(
          new Date(entries[i].recordedAt).getTime() -
            new Date(entries[j].recordedAt).getTime(),
        ) <= GROUP_WINDOW_MS &&
        // Every member within 60s of the run's first member (entries[i] is the
        // newest/first member of this run).
        new Date(entries[i].recordedAt).getTime() -
          new Date(entries[j].recordedAt).getTime() <=
          GROUP_WINDOW_MS
      ) {
        j += 1;
      }
    }
    const runLength = j - i;
    if (runLength >= 2) {
      const members = entries.slice(i, j);
      out.push({ kind: 'merged', key: `merged-${members[0].eventId}`, members });
    } else {
      out.push({ kind: 'single', entry: start });
    }
    i = j;
  }
  return out;
}

// Client-side filter pills (UX Screen-00 + Y0-patterns): narrow the ALREADY-
// loaded feed by eventType — NO new query. `all` passes everything through
// (null = no narrowing). A pill maps to the EventType(s) that back it.
type FilterKey = 'all' | 'status' | 'custody' | 'objections' | 'rulings';

const FILTER_PILLS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'status', label: 'Status' },
  { key: 'custody', label: 'Custody' },
  { key: 'objections', label: 'Objections' },
  { key: 'rulings', label: 'Rulings' },
];

const FILTER_TO_EVENT_TYPES: Record<FilterKey, EventType[] | null> = {
  all: null,
  status: ['STATUS_CHANGE'],
  custody: ['CUSTODY_TRANSFER'],
  objections: ['OBJECTION_RAISED'],
  rulings: ['RULING_RECORDED'],
};

// Date-group header label: "TODAY · OCT 8, 2026" / "YESTERDAY · OCT 7, 2026" /
// a plain uppercase date for older days (UX Screen-00). Computed from each row's
// recordedAt vs now; the feed is already sorted newest-first, so we only need to
// detect when the calendar day changes walking the list.
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// Exported so the full /activity page renders date-group headers IDENTICALLY.
export function dateGroupLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const dateText = d
    .toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
    .toUpperCase();

  if (dayKey(d) === dayKey(now)) return `TODAY · ${dateText}`;
  if (dayKey(d) === dayKey(yesterday)) return `YESTERDAY · ${dateText}`;
  return dateText;
}

// T-04: the heading's day word MUST agree with the date-group header's day word.
// Both are now derived from the SAME dayKey/yesterday comparison as
// dateGroupLabel above — this just returns the bare day WORD (lowercased for the
// heading copy "(N today)" vs the uppercased "TODAY · …" the date-group header
// uses). Fed the newest entry's recordedAt (the window is a single calendar day
// by construction, so any entry represents the window's day), so the heading can
// never say "today" while the date-group header says a specific past date.
function windowDayWord(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (dayKey(d) === dayKey(now)) return 'today';
  if (dayKey(d) === dayKey(yesterday)) return 'yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
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

  // Client-side filter pills — narrow the already-loaded `entries` by eventType
  // via a derived useMemo (CONTEXT's discretion note: client-side, NO new
  // query). `All` is active by default.
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const filteredEntries = useMemo(() => {
    const types = FILTER_TO_EVENT_TYPES[activeFilter];
    return types === null ? entries : entries.filter((e) => types.includes(e.eventType));
  }, [entries, activeFilter]);

  // T-04: collapse 60s same-exhibit STATUS_CHANGE runs into one unit BEFORE the
  // 10-row cap (a merged row counts as ONE of the 10) and BEFORE the date-group
  // walk (a merged unit's single anchor timestamp participates in day detection
  // normally). Then cap at the latest 10 units.
  const groupedEntries = useMemo(
    () => groupConsecutiveSameExhibit(filteredEntries),
    [filteredEntries],
  );
  const visibleEntries = useMemo(() => groupedEntries.slice(0, 10), [groupedEntries]);

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
        <span className={styles.count}>
          ({entries.length}{' '}
          {windowDayWord(entries[0]?.recordedAt ?? new Date().toISOString())})
        </span>
      </h2>

      {/* Filter pills — client-side narrowing of the already-loaded feed, All
          active by default. Rendered even while loading/empty so the control is
          stable; the server is never re-queried on a pill click. */}
      <div
        className={styles.filterPills}
        data-testid="activity-filter-pills"
        role="group"
        aria-label="Filter activity by type"
      >
        {FILTER_PILLS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            data-testid={`activity-filter-pill-${key}`}
            aria-pressed={activeFilter === key}
            className={`${styles.pill} ${activeFilter === key ? styles.pillActive : ''}`}
            onClick={() => setActiveFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

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

      {!isLoading && !isError && entries.length > 0 && filteredEntries.length === 0 && (
        <p className={styles.empty}>No matching activity for this filter.</p>
      )}

      {!isLoading && !isError && filteredEntries.length > 0 && visibleEntries.length > 0 && (
        <ul data-testid="recent-activity-list" className={styles.list}>
          {visibleEntries.map((g, i) => {
            // Insert a date-group header whenever the calendar day changes
            // walking the already-sorted (newest-first) grouped list — no
            // re-sort, the order is already correct. A merged unit's anchor
            // timestamp (its newest member) participates in day detection.
            const anchor = groupedRecordedAt(g);
            const prev = i === 0 ? null : groupedRecordedAt(visibleEntries[i - 1]);
            const showHeader =
              prev === null || dayKey(new Date(prev)) !== dayKey(new Date(anchor));
            const rowKey = g.kind === 'single' ? g.entry.eventId : g.key;
            const isHighlighted =
              g.kind === 'single'
                ? highlighted.has(g.entry.eventId)
                : g.members.some((m) => highlighted.has(m.eventId));
            return (
              <li key={rowKey} className={styles.rowWrapper}>
                {showHeader && (
                  <div
                    data-testid="activity-date-group-header"
                    className={styles.dateGroupHeader}
                  >
                    {dateGroupLabel(anchor)}
                  </div>
                )}
                <div className={`${styles.row} ${isHighlighted ? styles.highlighted : ''}`}>
                  {g.kind === 'single' ? (
                    <Link
                      href={`/exhibit/${g.entry.exhibitId}?event=${g.entry.eventId}`}
                      data-testid="recent-activity-row"
                      className={styles.link}
                    >
                      <span className={styles.bullet} aria-hidden="true">
                        ●
                      </span>
                      {/* Render the exhibit label via the shared ExhibitTag chip
                          (08-03) — the one remaining plain-text exhibit label on
                          the Command Center, now standardized. Two spans kept
                          (summary + time) since layout depends on the structure. */}
                      <span className={styles.summary}>
                        <ExhibitTag label={g.entry.exhibitLabel} /> {g.entry.summary}
                      </span>
                      <span className={styles.time}>{formatTime(g.entry.recordedAt)}</span>
                    </Link>
                  ) : (
                    // T-04 merged run: ONE collapsed summary row, expandable (native
                    // <details>) to the individual original summaries. Displayed
                    // timestamp = the newest member's recordedAt.
                    <details
                      className={styles.mergedDetails}
                      data-testid="recent-activity-merged-row"
                    >
                      <summary className={`${styles.link} ${styles.mergedSummary}`}>
                        <span className={styles.bullet} aria-hidden="true">
                          ●
                        </span>
                        <span className={styles.summary}>
                          <ExhibitTag label={g.members[0].exhibitLabel} />{' '}
                          {g.members.length} status updates
                        </span>
                        <span className={styles.time}>
                          {formatTime(g.members[0].recordedAt)}
                        </span>
                      </summary>
                      <ul className={styles.mergedList}>
                        {g.members.map((m) => (
                          <li key={m.eventId} className={styles.mergedItem}>
                            <Link
                              href={`/exhibit/${m.exhibitId}?event=${m.eventId}`}
                              data-testid="recent-activity-merged-member"
                              className={styles.link}
                            >
                              <span className={styles.summary}>{m.summary}</span>
                              <span className={styles.time}>{formatTime(m.recordedAt)}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* T-04: a stable "View all" affordance into the full /activity history,
          rendered whenever the feed has any rows (not only when the 10-cap is
          hit), so the link is always a discoverable, stable affordance. */}
      {!isLoading && !isError && entries.length > 0 && (
        <Link href="/activity" data-testid="activity-view-all" className={styles.viewAll}>
          View all →
        </Link>
      )}
    </Tile>
  );
}
