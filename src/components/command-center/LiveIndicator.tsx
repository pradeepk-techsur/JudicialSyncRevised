'use client';

import { Button } from '@carbon/react';
import { useFreshness } from '@/hooks/useFreshness';
import styles from './LiveIndicator.module.scss';

// F8 Command Center — T-15 LiveIndicator (external UI/UX review).
//
// Replaces FreshnessIndicator's tiny "🕐 updated 44s ago" text. The problem it
// fixes: a small green dot with an elapsed-seconds count signals *nothing* when
// updates actually STOP — the one failure mode a judge relying on "ambient,
// zero-configuration" live awareness most needs flagged. So this indicator is
// explicitly LABELED and flips state on a hard threshold:
//   fresh (<60s since last success, no error) → green dot + "Live"
//   stale (>=60s OR the query is erroring)     → amber dot + "Connection lost"
//                                                 + a working Refresh button
//
// It is driven PURELY by TanStack Query state (dataUpdatedAt / isError) via
// useFreshness — there is no bespoke timer duplicating react-query's own
// freshness tracking. `onRefetch` is the query's own `refetch` (a read-only
// re-poll), so Refresh never introduces a new write path (threat T-09-19).
export function LiveIndicator({
  dataUpdatedAt,
  isFetching,
  isError,
  onRefetch,
}: {
  dataUpdatedAt: number;
  isFetching: boolean;
  isError: boolean;
  onRefetch: () => void;
}) {
  const { isStale } = useFreshness(dataUpdatedAt, isFetching, isError);

  if (isStale || isError) {
    return (
      <span className={styles.indicator} data-testid="live-indicator" data-state="stale">
        <span className={`${styles.dot} ${styles.staleDot}`} aria-hidden="true" />
        <span className={styles.staleLabel} aria-live="polite">
          Connection lost
        </span>
        <Button
          kind="ghost"
          size="sm"
          className={styles.refreshButton}
          data-testid="live-indicator-refresh"
          onClick={() => onRefetch()}
        >
          Refresh
        </Button>
      </span>
    );
  }

  return (
    <span className={styles.indicator} data-testid="live-indicator" data-state="live">
      <span className={`${styles.dot} ${styles.liveDot}`} aria-hidden="true" />
      <span className={styles.liveLabel} aria-live="polite">
        Live
      </span>
    </span>
  );
}
