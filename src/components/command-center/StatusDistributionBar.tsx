'use client';

import type { ExhibitStatus } from '@prisma/client';
import styles from './StatusDistributionBar.module.scss';

// F8 Command Center — the per-status count legend (UX Screen-00 §"Where the
// N exhibits stand"). Phase 8 gap closure (08-16, 08-UAT.md test 2) removed
// the loud multi-colored segmented bar this component used to render above
// the legend — the user found a wide proportional strip visually noisy. The
// legend's small per-row `.legendDot` is kept: it's a single small
// status-colored dot per row (the same understated visual-cue pattern
// StatusBadge already uses elsewhere in this app without complaint), not the
// wide segmented strip that was removed. Purely presentational — it derives
// nothing beyond the counts passed in.

// Ordered to match StatusBadge's config order and the Screenshot-1 legend
// (Admitted/Marked/Offered/Objected/Excluded/Withdrawn is the screenshot order,
// but we keep the ledger/lifecycle order here for the legend).
const STATUS_ORDER: ExhibitStatus[] = [
  'MARKED',
  'OFFERED',
  'OBJECTED',
  'ADMITTED',
  'EXCLUDED',
  'WITHDRAWN',
];

// Label + the legend-dot class whose color token mirrors StatusBadge's dot
// color for the same status (see StatusDistributionBar.module.scss for the
// 1:1 token mapping comment).
const STATUS_META: Record<ExhibitStatus, { label: string; segClass: string }> = {
  MARKED: { label: 'Marked', segClass: styles.segMarked },
  OFFERED: { label: 'Offered', segClass: styles.segOffered },
  OBJECTED: { label: 'Objected', segClass: styles.segObjected },
  ADMITTED: { label: 'Admitted', segClass: styles.segAdmitted },
  EXCLUDED: { label: 'Excluded', segClass: styles.segExcluded },
  WITHDRAWN: { label: 'Withdrawn', segClass: styles.segWithdrawn },
};

export function StatusDistributionBar({
  statusCounts,
}: {
  statusCounts: Record<ExhibitStatus, number>;
}) {
  return (
    <ul className={styles.legend} data-testid="status-distribution-legend">
      {STATUS_ORDER.map((status) => {
        const count = statusCounts[status] ?? 0;
        const { label } = STATUS_META[status];
        return (
          <li key={status} className={styles.legendItem}>
            <span
              className={`${styles.legendDot} ${STATUS_META[status].segClass}`}
              aria-hidden="true"
            />
            <span className={styles.legendLabel}>{label}</span>
            <span className={styles.legendCount}>{count}</span>
          </li>
        );
      })}
    </ul>
  );
}
