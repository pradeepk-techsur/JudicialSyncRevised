'use client';

import { useRouter } from 'next/navigation';
import { StatusBadge } from '@/components/StatusBadge';
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
            {/* discrepancyFlags is always [] until Phase 3's DiscrepancyFlag
                table exists — this column is structurally present (per
                US-9.2's "visible without drill-in" requirement once Phase 3
                populates it) but intentionally renders nothing now; faking a
                visual treatment for a feature that cannot fire yet would be
                worse than an empty cell. */}
            <TableCell aria-label="No discrepancy flags" />
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
