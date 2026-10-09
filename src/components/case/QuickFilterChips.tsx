'use client';

import { useRoleStore } from '@/stores/roleStore';
import type { ExhibitListRow } from '@/lib/types';
import styles from './QuickFilterChips.module.scss';

// Quick-filter chips (Screenshot 5): client-side narrowing over the ALREADY-
// loaded ExhibitListRow[] — same "no new query" spirit as the Command Center
// Recent Activity filter pills. The chips never change what is fetched, only
// which of the already-returned rows render (the parent page.tsx applies the
// actual .filter()). Counts are computed live off the full, unfiltered list so
// they stay stable as the active chip changes.

export type QuickFilter = 'all' | 'needs-attention' | 'my-custody' | 'awaiting-ruling';

// A row "needs attention" when any flag pill would render — identical predicate
// to ExhibitTable's tint/pill logic, kept in sync by shape.
function rowNeedsAttention(r: ExhibitListRow): boolean {
  return r.discrepancyFlags.length > 0 || r.hasUnresolvedObjection || r.isSealed;
}

const CHIP_ORDER: Array<{ key: QuickFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'needs-attention', label: 'Needs attention' },
  { key: 'my-custody', label: 'In my custody' },
  { key: 'awaiting-ruling', label: 'Awaiting ruling' },
];

export function QuickFilterChips({
  rows,
  active,
  onChange,
}: {
  rows: ExhibitListRow[];
  active: QuickFilter;
  onChange: (f: QuickFilter) => void;
}) {
  const activeUserId = useRoleStore((s) => s.activeUserId);
  const users = useRoleStore((s) => s.users);
  // "In my custody" matches by current custodian NAME against the active user's
  // name — a reasonable client-side approximation GIVEN this demo's
  // one-user-per-role model (no currentCustodianUserId is exposed on
  // ExhibitListRow today, and adding a backend field for this chip alone is out
  // of scope per 08-CONTEXT). Acceptable per Claude's Discretion.
  const activeUserName = users.find((u) => u.id === activeUserId)?.name;

  const counts: Record<QuickFilter, number> = {
    all: rows.length,
    'needs-attention': rows.filter(rowNeedsAttention).length,
    'my-custody': activeUserName
      ? rows.filter((r) => r.currentCustodianName === activeUserName).length
      : 0,
    'awaiting-ruling': rows.filter((r) => r.hasUnresolvedObjection).length,
  };

  return (
    <div className={styles.chipRow} role="group" aria-label="Quick filters">
      {CHIP_ORDER.map(({ key, label }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            type="button"
            className={isActive ? `${styles.chip} ${styles.chipActive}` : styles.chip}
            data-testid={`quick-filter-${key}`}
            aria-pressed={isActive}
            onClick={() => onChange(key)}
          >
            {label} <span className={styles.count}>{counts[key]}</span>
          </button>
        );
      })}
    </div>
  );
}

// Applies a QuickFilter to a row list — exported so page.tsx uses the identical
// predicate the chips count with (the chip count and the narrowed table can
// never disagree).
export function applyQuickFilter(
  rows: ExhibitListRow[],
  filter: QuickFilter,
  activeUserName: string | undefined,
): ExhibitListRow[] {
  switch (filter) {
    case 'all':
      return rows;
    case 'needs-attention':
      return rows.filter(rowNeedsAttention);
    case 'my-custody':
      return activeUserName
        ? rows.filter((r) => r.currentCustodianName === activeUserName)
        : [];
    case 'awaiting-ruling':
      return rows.filter((r) => r.hasUnresolvedObjection);
  }
}
