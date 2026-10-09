'use client';

import type { ExhibitStatus } from '@prisma/client';
import styles from './StatusDistributionBar.module.scss';

// F8 Command Center — the single horizontal status-distribution bar + legend
// (UX Screen-00 §"Where the N exhibits stand"). One proportional segmented bar:
// each segment's width ∝ that status's count, color-keyed to the EXACT same
// per-status convention StatusBadge uses (the dot-color token mapping lives in
// StatusBadge.module.scss; this bar's segment classes reuse the identical
// @carbon/colors tokens, status-for-status — NO invented color mapping). A
// legend row beneath shows every status with its label + count. NO navigation
// on click; a native `title` tooltip surfaces the exact count + status on
// hover/tap. Purely presentational — it derives nothing beyond the counts
// passed in.

// Ordered to match StatusBadge's config order and the Screenshot-1 legend
// (Admitted/Marked/Offered/Objected/Excluded/Withdrawn is the screenshot order,
// but we keep the ledger/lifecycle order here for the bar and legend alike).
const STATUS_ORDER: ExhibitStatus[] = [
  'MARKED',
  'OFFERED',
  'OBJECTED',
  'ADMITTED',
  'EXCLUDED',
  'WITHDRAWN',
];

// Label + the segment class whose color token mirrors StatusBadge's dot color
// for the same status (see StatusDistributionBar.module.scss for the 1:1 token
// mapping comment).
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
  const total = STATUS_ORDER.reduce((sum, s) => sum + (statusCounts[s] ?? 0), 0);

  return (
    <div data-testid="status-distribution-bar">
      <div
        className={styles.bar}
        role="img"
        aria-label={`Exhibit status distribution across ${total} exhibits`}
      >
        {total === 0 ? (
          <div className={styles.emptyBar} aria-hidden="true" />
        ) : (
          STATUS_ORDER.map((status) => {
            const count = statusCounts[status] ?? 0;
            if (count === 0) return null;
            const pct = (count / total) * 100;
            const { label } = STATUS_META[status];
            return (
              <div
                key={status}
                className={`${styles.segment} ${STATUS_META[status].segClass}`}
                style={{ width: `${pct}%` }}
                title={`${label}: ${count}`}
                data-testid={`status-segment-${status}`}
              />
            );
          })
        )}
      </div>

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
    </div>
  );
}
