'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { SkeletonText, ActionableNotification } from '@carbon/react';
import { apiFetch } from '@/lib/apiClient';
import { useRoleStore } from '@/stores/roleStore';
import { ExhibitTag } from '@/components/shared/ExhibitTag';
import type { ActivityResponse } from '@/hooks/useRecentActivity';
import {
  formatTime,
  dayKey,
  dateGroupLabel,
  groupConsecutiveSameExhibit,
  groupedRecordedAt,
} from '@/components/command-center/RecentActivityPanel';
import styles from './page.module.scss';

// 09-04 (T-04) — the "View all" destination from the Command Center's Recent
// Activity panel: the COMPLETE activity history, NOT windowed to the latest
// trial day.
//
// It reuses the EXISTING GET /api/cases/:id/activity endpoint (no new backend
// route): called with a fixed `since=1970-01-01T00:00:00.000Z` — a hardcoded
// constant (never user-supplied, so no injection surface, T-09-05) that
// getRecentActivity's existing ISO-datetime validation already accepts — so the
// window start is the epoch and every event ever recorded for the case is
// returned, still ordered newest-first per the service's `orderBy: recordedAt
// desc`. No 10-row cap here (this page is "the rest of it"); the SAME 60-second
// same-exhibit grouping + the SAME formatTime / dateGroupLabel / ExhibitTag
// presentation as the panel are reused (imported, never re-implemented), so the
// two surfaces can never drift.
//
// This is a historical browse view, not a live-sync surface: NO polling interval
// (unlike the panel's useRecentActivity 4s poll).

// The epoch — the earliest valid non-future `since`. Hardcoded, never user input.
const SINCE_EPOCH = '1970-01-01T00:00:00.000Z';

function useFullActivity() {
  const caseId = useRoleStore((s) => s.caseId);
  const role = useRoleStore((s) => s.role);
  return useQuery<ActivityResponse>({
    queryKey: ['activity-full', caseId, role],
    queryFn: async () => {
      if (!caseId) {
        return { recentActivity: [], statusCounts: {} as ActivityResponse['statusCounts'] };
      }
      const res = await apiFetch(
        `/api/cases/${caseId}/activity?since=${encodeURIComponent(SINCE_EPOCH)}`,
      );
      if (!res.ok) throw new Error(`Failed to load activity: ${res.status}`);
      return res.json();
    },
    enabled: Boolean(caseId),
    // Historical browse — no live-sync poll.
    retry: false,
  });
}

export default function ActivityPage() {
  const { data, isLoading, isError, refetch } = useFullActivity();
  const entries = data?.recentActivity ?? [];
  // SAME grouping as the Command Center panel (imported, not re-implemented), but
  // with NO 10-row cap — this is the full history.
  const grouped = groupConsecutiveSameExhibit(entries);

  return (
    <div data-testid="activity-page">
      <Link href="/command-center" className={styles.backLink}>
        ‹ Command Center
      </Link>

      <h1 className={styles.title}>Activity History</h1>
      <p className={styles.subtitle}>The complete record of trial activity for this case.</p>

      {isLoading && (
        <div aria-hidden="true">
          <SkeletonText paragraph lineCount={6} width="100%" />
        </div>
      )}

      {isError && (
        <ActionableNotification
          kind="error"
          lowContrast
          inline
          hideCloseButton
          role="alert"
          title="Unable to load activity — please retry"
          actionButtonLabel="Reload"
          onActionButtonClick={() => refetch()}
        />
      )}

      {!isLoading && !isError && entries.length === 0 && (
        <p className={styles.empty}>No activity recorded yet.</p>
      )}

      {!isLoading && !isError && grouped.length > 0 && (
        <ul data-testid="activity-full-list" className={styles.list}>
          {grouped.map((g, i) => {
            // Date-group header whenever the calendar day changes walking the
            // already-sorted (newest-first) grouped list — a merged unit's anchor
            // (its newest member) participates in day detection, same as the panel.
            const anchor = groupedRecordedAt(g);
            const prev = i === 0 ? null : groupedRecordedAt(grouped[i - 1]);
            const showHeader =
              prev === null || dayKey(new Date(prev)) !== dayKey(new Date(anchor));
            const rowKey = g.kind === 'single' ? g.entry.eventId : g.key;
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
                <div className={styles.row}>
                  {g.kind === 'single' ? (
                    <Link
                      href={`/exhibit/${g.entry.exhibitId}?event=${g.entry.eventId}`}
                      data-testid="activity-full-row"
                      className={styles.link}
                    >
                      <span className={styles.bullet} aria-hidden="true">
                        ●
                      </span>
                      <span className={styles.summary}>
                        <ExhibitTag label={g.entry.exhibitLabel} /> {g.entry.summary}
                      </span>
                      <span className={styles.time}>{formatTime(g.entry.recordedAt)}</span>
                    </Link>
                  ) : (
                    // Merged run — ONE collapsed summary, expandable to the
                    // individual original summaries (mirrors the panel's shape).
                    <details className={styles.mergedDetails} data-testid="activity-full-merged-row">
                      <summary className={`${styles.link} ${styles.mergedSummary}`}>
                        <span className={styles.bullet} aria-hidden="true">
                          ●
                        </span>
                        <span className={styles.summary}>
                          <ExhibitTag label={g.members[0].exhibitLabel} /> {g.members.length}{' '}
                          status updates
                        </span>
                        <span className={styles.time}>{formatTime(g.members[0].recordedAt)}</span>
                      </summary>
                      <ul className={styles.mergedList}>
                        {g.members.map((m) => (
                          <li key={m.eventId} className={styles.mergedItem}>
                            <Link
                              href={`/exhibit/${m.exhibitId}?event=${m.eventId}`}
                              data-testid="activity-full-merged-member"
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
    </div>
  );
}
