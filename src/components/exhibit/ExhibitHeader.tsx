import { Tile } from '@carbon/react';
import { StatusBadge } from '@/components/StatusBadge';
import { DiscrepancyBanner } from '@/components/exhibit/DiscrepancyBanner';
import type { ExhibitHistoryResponse } from '@/services/history';
import styles from './ExhibitHeader.module.scss';

// Phase 6: the former Tailwind `rounded border p-4` block becomes a Carbon
// `Tile`, with the heading + status/custodian/party/witness meta row restyled
// via Carbon spacing/typography tokens (ExhibitHeader.module.scss) instead of
// `flex flex-wrap items-center gap-4 text-sm`. The composition is unchanged:
// the Wave 2 Carbon `StatusBadge` is consumed as-is (its exact aria-label
// contract is tested by exhibit-detail.spec.ts), and the per-flag discrepancy
// banner is rendered below exactly as before.
export function ExhibitHeader({ data }: { data: ExhibitHistoryResponse }) {
  const { exhibit, currentStatus, currentCustodianName } = data;
  return (
    <Tile className={styles.tile}>
      <h1 className={styles.heading}>
        {exhibit.exhibitLabel} — {exhibit.description}
      </h1>
      <div className={styles.metaRow}>
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
    </Tile>
  );
}
