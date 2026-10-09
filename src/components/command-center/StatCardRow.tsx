'use client';

import { Card } from '@/components/shared/Card';
import styles from './StatCardRow.module.scss';

// F8 Command Center — the 4-stat-card row (UX Screen-00 §Stat Card Row). Each
// card is a bold number + plain-language label built on the shared `Card`
// chrome (08-03). NONE of the cards is clickable in this version (F08: "no card
// is clickable in this version" — zero drill-in interaction). The one card that
// gets the critical/red-outline treatment is "Jury package blockers", and ONLY
// when its count is > 0 (Screenshot 1: that is the single red-outlined card).
//
// Every value is sourced in page.tsx EXACTLY per F08's stat-card sourcing table
// and passed down — this component derives nothing, so the counts can never
// drift from their authoritative hooks.

export interface StatCardRowProps {
  /** Count of case-wide UNRESOLVED objections. */
  openObjections: number;
  /** Count of OPEN ADMITTED_NO_CUSTODIAN discrepancies. */
  custodyGaps: number;
  /** Jury-package blockers (FLAGGED rows + any sealed/CRITICAL row). */
  juryBlockers: number;
  /** Exhibits currently ADMITTED. */
  admittedCount: number;
  /** Total exhibits that have reached any status (the statusCounts sum). */
  totalVisible: number;
  /** Exhibits currently EXCLUDED (sub-caption). */
  excludedCount: number;
  /** Exhibits currently WITHDRAWN (sub-caption). */
  withdrawnCount: number;
}

export function StatCardRow({
  openObjections,
  custodyGaps,
  juryBlockers,
  admittedCount,
  totalVisible,
  excludedCount,
  withdrawnCount,
}: StatCardRowProps) {
  return (
    <div className={styles.row} data-testid="stat-card-row">
      <Card>
        <p className={styles.value}>{openObjections}</p>
        <p className={styles.label}>Open objections</p>
      </Card>
      <Card>
        <p className={styles.value}>{custodyGaps}</p>
        <p className={styles.label}>Custody gaps</p>
      </Card>
      <Card critical={juryBlockers > 0} data-testid="stat-card-jury-blockers">
        <p className={styles.value}>{juryBlockers}</p>
        <p className={styles.label}>Jury package blockers</p>
      </Card>
      <Card>
        <p className={styles.value}>
          {admittedCount} of {totalVisible}
        </p>
        <p className={styles.label}>Admitted</p>
        {(excludedCount > 0 || withdrawnCount > 0) && (
          <p className={styles.subCaption}>
            {excludedCount > 0 ? `${excludedCount} excluded` : ''}
            {excludedCount > 0 && withdrawnCount > 0 ? ' · ' : ''}
            {withdrawnCount > 0 ? `${withdrawnCount} withdrawn` : ''}
          </p>
        )}
      </Card>
    </div>
  );
}
