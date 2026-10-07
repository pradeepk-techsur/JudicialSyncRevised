import type { DiscrepancyFlagSummary } from '@/lib/types';
import { ruleLabel } from '@/lib/discrepancyLabels';

// Presentational discrepancy badge for the Case Workspace ⚑ column (F6/F9,
// US-9.2 "visible without drill-in"). It renders ONLY what the server-provided
// row carries — no data fetching, no client-side discrepancy derivation.
//
// It consumes the single shared sources from 03-01: DiscrepancyFlagSummary (the
// type) and ruleLabel (the plain-language copy). It does NOT define or re-export
// either — the wording can never drift between this, the Jury screen, and the
// Exhibit Detail banner.
//
// The plain-language rule label is ALWAYS visible as text — never icon-only — so
// the discrepancy is legible at a glance without hovering or drilling in:
//   - OPEN       → amber badge (text-amber-800 bg-amber-50 border-amber-200),
//                  matching ExhibitHeader's amber block.
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
    const className = isOpen
      ? 'inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-800'
      : 'inline-flex items-center gap-1 rounded border border-amber-100 bg-amber-50/50 px-1.5 py-0.5 text-xs text-amber-600/70';
    const text = isOpen ? flag.label : `${flag.label} (Ack'd)`;
    return (
      <span
        data-testid="discrepancy-badge"
        data-discrepancy-status={isOpen ? 'OPEN' : 'ACKNOWLEDGED'}
        data-rule-code={flag.ruleCode}
        className={className}
        aria-label={`Discrepancy: ${text}`}
      >
        <span aria-hidden="true">⚠</span>
        {text}
      </span>
    );
  }

  // Multiple flags → collapse to "⚠ N issues", amber if any is OPEN else muted.
  // Every label is exposed via title/aria-label (and an inline detail list) so no
  // discrepancy is hidden from either sighted or assistive-tech users.
  const sentence = labelsSentence(flags);
  const summaryClassName = hasOpen
    ? 'inline-flex flex-col gap-0.5 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-800'
    : 'inline-flex flex-col gap-0.5 rounded border border-amber-100 bg-amber-50/50 px-1.5 py-0.5 text-xs text-amber-600/70';

  return (
    <span
      data-testid="discrepancy-badge"
      data-discrepancy-status={hasOpen ? 'OPEN' : 'ACKNOWLEDGED'}
      data-discrepancy-count={flags.length}
      className={summaryClassName}
      title={sentence}
      aria-label={`${flags.length} discrepancies: ${sentence}`}
    >
      <span>
        <span aria-hidden="true">⚠</span> {flags.length} issues
      </span>
      <span className="sr-only md:not-sr-only md:text-[10px] md:font-normal md:leading-tight">
        {sentence}
      </span>
    </span>
  );
}
