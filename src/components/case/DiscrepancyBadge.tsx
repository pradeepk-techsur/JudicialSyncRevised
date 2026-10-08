import { Tag } from '@carbon/react';
import type { DiscrepancyFlagSummary } from '@/lib/types';
import { ruleLabel } from '@/lib/discrepancyLabels';
import styles from './DiscrepancyBadge.module.scss';

// Presentational discrepancy badge for the Case Workspace ⚑ column (F6/F9,
// US-9.2 "visible without drill-in"). It renders ONLY what the server-provided
// row carries — no data fetching, no client-side discrepancy derivation.
//
// It consumes the single shared sources from 03-01: DiscrepancyFlagSummary (the
// type) and ruleLabel (the plain-language copy). It does NOT define or re-export
// either — the wording can never drift between this, the Jury screen, and the
// Exhibit Detail banner.
//
// Phase 6 swaps only the rendering layer: the hand-rolled amber <span> becomes a
// Carbon `Tag` whose color surface is overridden to Carbon's warning tokens via
// a scoped CSS Module (Carbon ships no literal "amber" Tag type). Every data
// attribute, aria-label string, conditional branch, and the OPEN/ACKNOWLEDGED
// visual distinction (US-6.3) is preserved byte-for-byte — these are asserted
// directly by e2e/case-workspace-discrepancies.spec.ts.
//
// The plain-language rule label is ALWAYS visible as text — never icon-only — so
// the discrepancy is legible at a glance without hovering or drilling in:
//   - OPEN       → full-strength warning-amber Tag.
//   - ACKNOWLEDGED → the same label in muted/desaturated amber with a small
//                  "Ack'd" marker — never hidden.
//   - Multiple   → collapses to "⚠ N issues" (amber if ANY is OPEN, muted if all
//                  ACKNOWLEDGED), with every label exposed via title + aria-label
//                  and an inline list for sighted users.

function labelsSentence(flags: DiscrepancyFlagSummary[]): string {
  return flags
    .map((f) => `${f.label}${f.status === 'ACKNOWLEDGED' ? " (Ack'd)" : ''}`)
    .join(', ');
}

export function DiscrepancyBadge({ flags }: { flags: DiscrepancyFlagSummary[] }) {
  // No flags → empty cell (nothing to surface).
  if (flags.length === 0) {
    return null;
  }

  const hasOpen = flags.some((f) => f.status === 'OPEN');

  // Single flag → inline badge with the plain-language label always visible.
  if (flags.length === 1) {
    const flag = flags[0];
    const isOpen = flag.status === 'OPEN';
    const text = isOpen ? flag.label : `${flag.label} (Ack'd)`;
    return (
      <Tag
        type="gray"
        size="sm"
        className={isOpen ? styles.open : styles.acknowledged}
        data-testid="discrepancy-badge"
        data-discrepancy-status={isOpen ? 'OPEN' : 'ACKNOWLEDGED'}
        data-rule-code={flag.ruleCode}
        aria-label={`Discrepancy: ${text}`}
      >
        <span className={styles.warnGlyph} aria-hidden="true">
          ⚠
        </span>
        {text}
      </Tag>
    );
  }

  // Multiple flags → collapse to "⚠ N issues", amber if any is OPEN else muted.
  // Every label is exposed via title/aria-label (and an inline detail list) so no
  // discrepancy is hidden from either sighted or assistive-tech users.
  const sentence = labelsSentence(flags);

  // `title` is a reserved Carbon Tag prop (its dismiss-button aria-label, only
  // applied when `filter` is set) and is swallowed before reaching the rendered
  // element — so the hover tooltip must live on a plain wrapping <span> instead
  // of being passed to the Tag.
  return (
    <span title={sentence} className={styles.multiWrapper}>
      <Tag
        type="gray"
        size="sm"
        className={`${hasOpen ? styles.open : styles.acknowledged} ${styles.multi}`}
        data-testid="discrepancy-badge"
        data-discrepancy-status={hasOpen ? 'OPEN' : 'ACKNOWLEDGED'}
        data-discrepancy-count={flags.length}
        aria-label={`${flags.length} discrepancies: ${sentence}`}
      >
        <span>
          <span aria-hidden="true">⚠</span> {flags.length} issues
        </span>
        <span className={styles.detailSentence}>{sentence}</span>
      </Tag>
    </span>
  );
}
