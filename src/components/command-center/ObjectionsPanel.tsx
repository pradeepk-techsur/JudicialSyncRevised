'use client';

import Link from 'next/link';
import { Tile, SkeletonText, ActionableNotification } from '@carbon/react';
import { useUnresolvedObjections } from '@/hooks/useUnresolvedObjections';
import styles from './ObjectionsPanel.module.scss';

// F8 Command Center — Unresolved Objections panel (lower-row LEFT). Presentational
// over its OWN useUnresolvedObjections hook (one hook per panel — three independent
// queries, so this panel's loading/error/empty never blanks the others). STRICTLY
// read-only: the only interactive elements are per-row link-throughs to Exhibit
// Detail plus a READ-retry on error (criterion 3).
//
// Sealed-safe via the route change in Task 1A: the /objections route now passes the
// parsed role into getUnresolvedObjections, so threads on sealed exhibits are
// absent (and uncounted) for a role without sealed visibility (threat T-05-08).

// The hook types rows as ObjectionCurrentState (raisedAt: Date), but the value
// arrives over the wire as an ISO string — accept either and normalize.
function formatTime(value: string | Date): string {
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function ObjectionsPanel() {
  const { data, isLoading, isError, refetch } = useUnresolvedObjections();
  const objections = data ?? [];

  return (
    <Tile
      data-testid="objections-panel"
      aria-label="Unresolved objections"
    >
      <h2 className={styles.heading}>
        Unresolved Objections{' '}
        <span className={styles.count}>({objections.length})</span>
      </h2>

      {isLoading && (
        <div aria-hidden="true">
          <SkeletonText paragraph lineCount={3} width="100%" />
        </div>
      )}

      {isError && (
        <ActionableNotification
          kind="error"
          lowContrast
          inline
          hideCloseButton
          role="alert"
          title="Unable to load objections — please retry"
          actionButtonLabel="Reload"
          onActionButtonClick={() => refetch()}
        />
      )}

      {!isLoading && !isError && objections.length === 0 && (
        <p className={styles.empty}>
          <span className={styles.check} aria-hidden="true">
            ✓
          </span>{' '}
          No unresolved objections — all clear
        </p>
      )}

      {!isLoading && !isError && objections.length > 0 && (
        <ul className={styles.list}>
          {objections.map((o) => (
            <li key={o.objectionId} className={styles.row}>
              <Link
                href={`/exhibit/${o.exhibitId}`}
                data-testid="objection-row"
                className={styles.link}
              >
                <span className={styles.party}>
                  {o.objectingParty} — {o.grounds}
                </span>
                <span className={styles.time}>{formatTime(o.raisedAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Tile>
  );
}
