'use client';

import { useRouter } from 'next/navigation';
import { StatusBadge } from '@/components/StatusBadge';
import { DiscrepancyBadge } from '@/components/case/DiscrepancyBadge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ExhibitListRow } from '@/lib/types';

export function ExhibitTable({ rows }: { rows: ExhibitListRow[] }) {
  const router = useRouter();

  if (rows.length === 0) {
    return <p className="text-sm text-gray-500">No exhibits match these filters.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Label</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Party</TableHead>
          <TableHead>Witness</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Custodian</TableHead>
          <TableHead aria-label="Discrepancy">⚑</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow
            key={row.exhibitId}
            onClick={() => router.push(`/exhibit/${row.exhibitId}`)}
            className="cursor-pointer hover:bg-gray-50"
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
