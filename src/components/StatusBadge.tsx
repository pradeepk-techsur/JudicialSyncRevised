import { Tag } from '@carbon/react';
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

const STATUS_CONFIG: Record<
  ExhibitStatus,
  { label: string; tagType: TagType; dotClassName: string }
> = {
  MARKED: { label: 'Marked', tagType: 'gray', dotClassName: styles.statusDotGray },
  OFFERED: { label: 'Offered', tagType: 'blue', dotClassName: styles.statusDotBlue },
  OBJECTED: { label: 'Objected', tagType: 'teal', dotClassName: styles.statusDotAmber },
  ADMITTED: { label: 'Admitted', tagType: 'green', dotClassName: styles.statusDotGreen },
  EXCLUDED: { label: 'Excluded', tagType: 'red', dotClassName: styles.statusDotRed },
  WITHDRAWN: { label: 'Withdrawn', tagType: 'cool-gray', dotClassName: styles.statusDotSlate },
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

  const { label, tagType, dotClassName } = STATUS_CONFIG[status];
  return (
    <Tag type={tagType} size="sm" aria-label={`Current status: ${label}`}>
      <span className={`${styles.dot} ${dotClassName}`} aria-hidden="true" />
      {label}
    </Tag>
  );
}
