import { StatusBadge } from '@/components/StatusBadge';
import { DiscrepancyBanner } from '@/components/exhibit/DiscrepancyBanner';
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
      {/* Phase 3: now that 03-03 populates history.discrepancyFlags, this is the
          Exhibit Detail discrepancy banner — per-flag plain-language labels plus a
          role-gated inline Acknowledge (reusing AcknowledgeInline). It renders
          nothing when there are no active flags. */}
      <DiscrepancyBanner exhibitId={exhibit.id} flags={data.discrepancyFlags} />
    </div>
  );
}
