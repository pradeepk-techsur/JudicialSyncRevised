'use client';

import { useRouter } from 'next/navigation';
import { StatusBadge } from '@/components/StatusBadge';
import { DiscrepancyBadge } from '@/components/case/DiscrepancyBadge';
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
          <TableHeader>Witness</TableHeader>
          <TableHeader>Status</TableHeader>
          <TableHeader>Custodian</TableHeader>
          <TableHeader aria-label="Discrepancy">⚑</TableHeader>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => {
          const navigate = () => router.push(`/exhibit/${row.exhibitId}`);
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
              // accessible mechanism here.
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  // preventDefault stops Space from scrolling the page.
                  e.preventDefault();
                  navigate();
                }
              }}
              className={styles.row}
              data-testid="exhibit-row"
              data-exhibit-label={row.exhibitLabel}
            >
              {/* Fully Clickable List Row (Y0-patterns.md): the ENTIRE row is
                  the hit area — clicks on any cell (including whitespace) bubble
                  to the <tr>'s onClick. Any future INLINE action control added
                  to a cell (e.g. an inline acknowledge/edit button) MUST call
                  e.stopPropagation() in its own onClick so operating it never
                  triggers row navigation. None exist today. */}
              <TableCell>{row.exhibitLabel}</TableCell>
              <TableCell className={styles.descriptionCell}>{row.description}</TableCell>
              <TableCell>{row.offeringParty}</TableCell>
              <TableCell>{row.associatedWitness ?? '—'}</TableCell>
              <TableCell>
                <StatusBadge status={row.currentStatus} />
              </TableCell>
              <TableCell>{row.currentCustodianName ?? '—'}</TableCell>
              {/* Discrepancy column (F6/F9, US-9.2 "visible without drill-in"):
                  Phase 3 populates row.discrepancyFlags from the live engine, so
                  the badge surfaces amber OPEN / muted ACKNOWLEDGED rule labels
                  here. Acknowledge is NOT inline on the browse screen — clicking
                  the row still drills into Exhibit Detail (per CONTEXT). */}
              <TableCell>
                <DiscrepancyBadge flags={row.discrepancyFlags} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
