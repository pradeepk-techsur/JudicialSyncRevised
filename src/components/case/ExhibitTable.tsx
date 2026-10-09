'use client';

import { useRouter } from 'next/navigation';
import { StatusBadge } from '@/components/StatusBadge';
import { ExhibitTag } from '@/components/shared/ExhibitTag';
import { SeverityPill, type SeverityTone } from '@/components/shared/SeverityPill';
import {
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
} from '@carbon/react';
import type { ExhibitListRow } from '@/lib/types';
import styles from './ExhibitTable.module.scss';

// Readable Flag Pill derivation (Y0-patterns.md §Readable Flag Pill). The Flags
// column surfaces the exhibit's FULL signal set — NOT just discrepancyFlags —
// because two of the conditions (an unresolved objection on a still-OFFERED/
// OBJECTED exhibit, and a sealed/ex-parte exhibit) fire no DiscrepancyFlag of
// their own (08-07's two additive fields, hasUnresolvedObjection / isSealed,
// carry them). Multiple simultaneous conditions render as multiple stacked
// pills, never collapsed into "N issues".
function flagPillsFor(
  row: ExhibitListRow,
): Array<{ tone: SeverityTone; label: string }> {
  const pills: Array<{ tone: SeverityTone; label: string }> = [];
  if (row.isSealed) pills.push({ tone: 'critical', label: 'Ex parte · restricted' });
  for (const flag of row.discrepancyFlags) {
    if (flag.ruleCode === 'ADMITTED_NO_CUSTODIAN') {
      pills.push({ tone: 'medium', label: 'No custodian' });
    } else if (flag.ruleCode === 'UNRESOLVED_OBJECTION_JURY_ELIGIBLE') {
      pills.push({ tone: 'high', label: 'Open objection' });
    }
  }
  // "Ruling pending" — hasUnresolvedObjection on an exhibit NOT already covered
  // by the UNRESOLVED_OBJECTION_JURY_ELIGIBLE pill above (that rule only fires
  // once ADMITTED; a still-OFFERED/OBJECTED exhibit's unresolved objection has
  // NO DiscrepancyFlag of its own, per 08-07's additive field).
  const alreadyCoveredByOpenObjectionPill = row.discrepancyFlags.some(
    (f) => f.ruleCode === 'UNRESOLVED_OBJECTION_JURY_ELIGIBLE',
  );
  if (row.hasUnresolvedObjection && !alreadyCoveredByOpenObjectionPill) {
    pills.push({ tone: 'pending', label: 'Ruling pending' });
  }
  return pills;
}

// A row "needs attention" when any flag pill would render (Screenshot 5: tinted
// rows). Identical predicate to flagPillsFor's non-empty condition, kept in sync
// here so the tint and the pills can never disagree.
function needsAttention(row: ExhibitListRow): boolean {
  return (
    row.discrepancyFlags.length > 0 || row.hasUnresolvedObjection || row.isSealed
  );
}

// Jury Package eligibility → plain-language colored text (NOT a pill),
// server-computed (row.juryPackageEligibility) and rendered verbatim — never
// re-derived client-side (F09 §Process step 3 precedence lives server-side).
const JURY_PACKAGE_TEXT: Record<
  ExhibitListRow['juryPackageEligibility'],
  { text: string; className: string }
> = {
  INCLUDED: { text: 'Included', className: 'juryIncluded' },
  NOT_ELIGIBLE: { text: 'Not eligible', className: 'juryNotEligible' },
  BLOCKED: { text: 'Blocked', className: 'juryBlocked' },
};

export function ExhibitTable({ rows }: { rows: ExhibitListRow[] }) {
  const router = useRouter();

  if (rows.length === 0) {
    return <p className={styles.empty}>No exhibits match these filters.</p>;
  }

  return (
    <Table>
      {/* Carbon naming note: `TableHead` is the <thead> wrapper (NOT shadcn's
          per-column <th>), and `TableHeader` is the per-column <th>. This is the
          one place Carbon's and shadcn's naming conventions invert — verified
          against @carbon/react's exports at execution time. */}
      <TableHead>
        <TableRow>
          <TableHeader>Label</TableHeader>
          <TableHeader>Description</TableHeader>
          <TableHeader>Party</TableHeader>
          <TableHeader>Status</TableHeader>
          <TableHeader>Custodian</TableHeader>
          <TableHeader>Flags</TableHeader>
          <TableHeader>Jury Package</TableHeader>
          {/* Trailing chevron affordance column (confirms row-clickability per
              Screenshot 5 item 6 — already functional since 07-04; VISUAL
              addition only). Header has no visible label. */}
          <TableHeader aria-hidden="true" />
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => {
          const navigate = () => router.push(`/exhibit/${row.exhibitId}`);
          const pills = flagPillsFor(row);
          const jury = JURY_PACKAGE_TEXT[row.juryPackageEligibility];
          return (
            <TableRow
              key={row.exhibitId}
              onClick={navigate}
              // Keyboard parity (Y0-patterns.md "Fully Clickable List Row";
              // threat T-07-08): Carbon's TableRow spreads these straight onto
              // the native <tr>, so tabIndex makes the whole row focusable and
              // Enter/Space activates it identically to a click. role="button"
              // is deliberately NOT set — a <tr> must keep its native row role
              // for valid table ARIA semantics; tabIndex + onKeyDown is the
              // accessible mechanism here. (F15's already-shipped fix — untouched.)
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  // preventDefault stops Space from scrolling the page.
                  e.preventDefault();
                  navigate();
                }
              }}
              className={
                needsAttention(row) ? `${styles.row} ${styles.tintedRow}` : styles.row
              }
              data-testid="exhibit-row"
              data-exhibit-label={row.exhibitLabel}
              data-needs-attention={needsAttention(row) ? 'true' : 'false'}
            >
              {/* Fully Clickable List Row (Y0-patterns.md): the ENTIRE row is
                  the hit area — clicks on any cell (including whitespace) bubble
                  to the <tr>'s onClick. Any future INLINE action control added
                  to a cell (e.g. an inline acknowledge/edit button) MUST call
                  e.stopPropagation() in its own onClick so operating it never
                  triggers row navigation. None exist today. */}
              <TableCell>
                <ExhibitTag label={row.exhibitLabel} />
              </TableCell>
              <TableCell className={styles.descriptionCell}>{row.description}</TableCell>
              <TableCell>{row.offeringParty}</TableCell>
              <TableCell>
                <StatusBadge status={row.currentStatus} />
              </TableCell>
              {/* Unassigned custodian → red "Unassigned" text, never a blank
                  cell (Screenshot 5). */}
              <TableCell>
                {row.currentCustodianName ?? (
                  <span className={styles.unassigned}>Unassigned</span>
                )}
              </TableCell>
              {/* Flags column: readable SeverityPill stack (Y0-patterns.md
                  §Readable Flag Pill). Multiple conditions render as multiple
                  pills; a clean exhibit renders an empty cell. */}
              <TableCell>
                {pills.length > 0 && (
                  <span className={styles.flagStack}>
                    {pills.map(({ tone, label }) => (
                      <SeverityPill
                        key={label}
                        tone={tone}
                        label={label}
                        ariaLabel={`Flag: ${label}`}
                      />
                    ))}
                  </span>
                )}
              </TableCell>
              {/* Jury Package column: plain-language colored text, server-computed. */}
              <TableCell>
                <span
                  className={styles[jury.className]}
                  data-testid="jury-package-eligibility"
                  data-eligibility={row.juryPackageEligibility}
                >
                  {jury.text}
                </span>
              </TableCell>
              {/* Trailing chevron affordance (VISUAL only; decorative). */}
              <TableCell className={styles.chevronCell}>
                <span className={styles.chevron} aria-hidden="true">
                  ›
                </span>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
