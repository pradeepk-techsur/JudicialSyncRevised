import { StatusBadge } from '@/components/StatusBadge';
import type { ExhibitHistoryResponse } from '@/services/history';

export function ExhibitHeader({ data }: { data: ExhibitHistoryResponse }) {
  const { exhibit, currentStatus, currentCustodianName } = data;
  return (
    <div className="mb-6 rounded border p-4">
      <h1 className="mb-2 text-xl font-semibold">
        {exhibit.exhibitLabel} — {exhibit.description}
      </h1>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <StatusBadge status={currentStatus} />
        <span>Custodian: {currentCustodianName ?? 'None on record'}</span>
        <span>Party: {exhibit.offeringParty}</span>
        <span>Witness: {exhibit.associatedWitness ?? '—'}</span>
      </div>
      {/* Discrepancy banner structurally reserved for Phase 3 — data.discrepancyFlags
          is always [] in this phase, so nothing renders here yet. Rendering an
          empty <div/> (rather than omitting the block entirely) keeps this the
          one place Phase 3 inserts its banner, without this phase inventing a
          placeholder visual for a feature that cannot fire yet. */}
      {data.discrepancyFlags.length > 0 && (
        <div className="mt-3 rounded bg-amber-50 p-2 text-sm text-amber-800">
          {/* unreachable in Phase 2 — discrepancyFlags is always [] */}
        </div>
      )}
    </div>
  );
}
