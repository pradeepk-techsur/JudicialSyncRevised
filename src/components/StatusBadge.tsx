import { Tag } from '@carbon/react';
import {
  Edit,
  ArrowRight,
  WarningAlt,
  CheckmarkFilled,
  CloseFilled,
  Undo,
} from '@carbon/icons-react';
import type { CarbonIconType } from '@carbon/icons-react';
import type { ExhibitStatus } from '@prisma/client';
import styles from './StatusBadge.module.scss';

// The single shared status representation (US-1.2 structural guarantee): status
// is rendered by exactly ONE component imported identically by Case Workspace,
// Exhibit Detail, and Jury Package, so it can never visually differ across
// screens. Phase 6 swaps only the rendering layer from a hand-rolled Tailwind
// <span> to a Carbon `Tag` (Y0-patterns.md: StatusBadge "implemented as a Carbon
// `Tag` using Carbon's status-color tokens as of Phase 6"). Every behavioral
// contract — the 6 statuses + null branch, the colored dot, and the exact
// `aria-label="Current status: {Label}"` string tested by exhibit-detail.spec.ts
// — is preserved byte-for-byte.

type TagType = 'gray' | 'blue' | 'teal' | 'green' | 'red' | 'cool-gray';

// Carbon icon component type — the icons-react components are forwardRef SVG
// components that accept `size`, `className`, and an `aria-hidden` passthrough.
type StatusIcon = CarbonIconType;

// T-03 (external UI/UX review): STATUS_CONFIG is the SINGLE EXPORTED source of
// truth for a status's label, Carbon Tag type (color), dot class, and icon. It
// is imported directly by StatusDistributionBar (and any future legend) so no
// second hand-authored color/label map can ever drift from this one. Each status
// also carries an `icon` so status is never communicated by color alone
// (accessibility: color + icon + visible label text, three redundant signals).
export const STATUS_CONFIG: Record<
  ExhibitStatus,
  { label: string; tagType: TagType; dotClassName: string; icon: StatusIcon }
> = {
  MARKED: { label: 'Marked', tagType: 'gray', dotClassName: styles.statusDotGray, icon: Edit },
  OFFERED: { label: 'Offered', tagType: 'blue', dotClassName: styles.statusDotBlue, icon: ArrowRight },
  OBJECTED: { label: 'Objected', tagType: 'teal', dotClassName: styles.statusDotAmber, icon: WarningAlt },
  ADMITTED: { label: 'Admitted', tagType: 'green', dotClassName: styles.statusDotGreen, icon: CheckmarkFilled },
  EXCLUDED: { label: 'Excluded', tagType: 'red', dotClassName: styles.statusDotRed, icon: CloseFilled },
  WITHDRAWN: { label: 'Withdrawn', tagType: 'cool-gray', dotClassName: styles.statusDotSlate, icon: Undo },
};

export function StatusBadge({ status }: { status: ExhibitStatus | null }) {
  if (status === null) {
    // A genuinely "no status" state is not a status color — keep the muted
    // plain-text treatment (not a Tag), matching the current design intent and
    // the aria-label contract.
    return (
      <span className={styles.nullBadge} aria-label="Current status: not yet entered">
        <span className={`${styles.dot} ${styles.statusDotMuted}`} aria-hidden="true" />
        Not yet entered
      </span>
    );
  }

  const { label, tagType, dotClassName, icon: Icon } = STATUS_CONFIG[status];
  return (
    <Tag type={tagType} size="sm" aria-label={`Current status: ${label}`}>
      <Icon size={14} aria-hidden="true" className={styles.statusIcon} />
      <span className={`${styles.dot} ${dotClassName}`} aria-hidden="true" />
      {label}
    </Tag>
  );
}
