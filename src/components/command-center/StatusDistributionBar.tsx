'use client';

import type { ExhibitStatus } from '@prisma/client';
import { STATUS_CONFIG } from '@/components/StatusBadge';
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
//
// T-03 (external UI/UX review): this component no longer carries its own
// hand-authored status→label/color map. The label and icon for each status are
// read DIRECTLY from StatusBadge's exported STATUS_CONFIG (the single TS source
// of truth), and the dot's color comes from the shared
// `src/styles/_statusColors.scss` SCSS partial that BOTH this module and
// StatusBadge.module.scss `@use` — so the legend and the status pills can never
// diverge for the same status.

// Ledger/lifecycle order for the legend rows.
const STATUS_ORDER: ExhibitStatus[] = [
  'MARKED',
  'OFFERED',
  'OBJECTED',
  'ADMITTED',
  'EXCLUDED',
  'WITHDRAWN',
];

// The only thing that must stay local to THIS CSS Module is the legend-dot's
// own class (CSS Modules hash class names per file, so a dot class defined in
// StatusBadge.module.scss is unreachable here) — but each class pulls its COLOR
// from the shared SCSS partial, so this is a style-application map, not a second
// color source of truth.
const SEG_CLASS: Record<ExhibitStatus, string> = {
  MARKED: styles.segMarked,
  OFFERED: styles.segOffered,
  OBJECTED: styles.segObjected,
  ADMITTED: styles.segAdmitted,
  EXCLUDED: styles.segExcluded,
  WITHDRAWN: styles.segWithdrawn,
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
        // Label + icon come from the ONE shared TS source of truth.
        const { label, icon: Icon } = STATUS_CONFIG[status];
        return (
          <li key={status} className={styles.legendItem}>
            <Icon size={14} aria-hidden="true" className={styles.legendIcon} />
            <span
              className={`${styles.legendDot} ${SEG_CLASS[status]}`}
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
