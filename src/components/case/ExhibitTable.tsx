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

export function ExhibitTable({ rows }: { rows: ExhibitListRow[] }) {
  const router = useRouter();

  if (rows.length === 0) {
    return <p className="text-sm text-gray-500">No exhibits match these filters.</p>;
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
        {rows.map((row) => (
          <TableRow
            key={row.exhibitId}
            onClick={() => router.push(`/exhibit/${row.exhibitId}`)}
            className="cursor-pointer"
            data-testid="exhibit-row"
            data-exhibit-label={row.exhibitLabel}
          >
            <TableCell>{row.exhibitLabel}</TableCell>
            <TableCell className="max-w-xs truncate">{row.description}</TableCell>
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
        ))}
      </TableBody>
    </Table>
  );
}
