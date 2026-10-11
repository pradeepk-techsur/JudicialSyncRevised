'use client';

import { useState } from 'react';
import { Tile, Button } from '@carbon/react';
import type { Role } from '@prisma/client';
import { ExhibitTag } from '@/components/shared/ExhibitTag';
import { StatusBadge } from '@/components/StatusBadge';
import { DiscrepancyBanner } from '@/components/exhibit/DiscrepancyBanner';
import { TransferCustodyForm } from '@/components/actions/TransferCustodyForm';
import { useRoleStore } from '@/stores/roleStore';
import { useAssistantStore } from '@/stores/assistantStore';
import type { ExhibitHistoryResponse } from '@/services/history';
import styles from './ExhibitHeader.module.scss';

// Phase 8 (F10/F24) — the Exhibit Detail header redesigned per Screenshot 2's top
// half: the shared `ExhibitTag` chip + title + `StatusBadge` pill inline on one
// row; a subtitle line naming party/witness/custodian; and two right-aligned
// header actions — "Transfer custody" (role-gated, delegating entirely to 08-09's
// shared `TransferCustodyForm`) and "Ask Pivota about {label}" (a new entry point
// into the already-built F7 assistant panel). The per-flag discrepancy banner
// (now with alert-banner treatment + Record-ruling wiring, see DiscrepancyBanner)
// renders beneath, unchanged in its composition point.
//
// "Transfer custody" is ABSENT (not disabled) outside DEPUTY/CLERK/ADMIN — the
// gate is enforced by the shared `TransferCustodyForm`'s own `CUSTODY_ROLES`
// check (08-09) backed by `recordCustodyTransfer`'s server-side gate (08-02),
// never re-implemented here. The local `canTransfer` only decides whether the
// trigger button renders at all; the form is the authority.
//
// Assistant pre-scoping (Phase 9 / T-11 + T-08): the "Ask Pivota about {label}"
// button now opens the panel SCOPED to this exhibit via
// `assistantStore.openPanelForExhibit(exhibit.id)` (added in 09-11). This both
// satisfies T-08's "Ask Pivota about P-7 opens assistant pre-selected" acceptance
// criterion and powers T-11's context-aware example prompts — the empty-state
// chips bias toward the scoped exhibit. The scope is per-opening (cleared on
// close / new conversation) and never changes what the assistant can SEE; it only
// pre-fills prompt text the user could type manually (T-09-17).

const CUSTODY_ROLES: Role[] = ['DEPUTY', 'CLERK', 'ADMIN'];

export function ExhibitHeader({ data }: { data: ExhibitHistoryResponse }) {
  const { exhibit, currentStatus, currentCustodianName, custodyCard } = data;
  const role = useRoleStore((s) => s.role);
  const openPanelForExhibit = useAssistantStore((s) => s.openPanelForExhibit);
  const [transferOpen, setTransferOpen] = useState(false);
  const canTransfer = CUSTODY_ROLES.includes(role);

  return (
    <Tile className={styles.tile}>
      <div className={styles.titleRow}>
        <ExhibitTag label={exhibit.exhibitLabel} />
        <h1 className={styles.heading}>{exhibit.description}</h1>
        <StatusBadge status={currentStatus} />
      </div>
      <p className={styles.subtitle}>
        Party: {exhibit.offeringParty} · Witness {exhibit.associatedWitness ?? '—'} · Custodian{' '}
        {currentCustodianName ?? 'None on record'}
      </p>
      <div className={styles.actions}>
        {canTransfer && (
          <Button
            kind="tertiary"
            size="sm"
            onClick={() => setTransferOpen((v) => !v)}
            data-testid="header-transfer-custody"
          >
            Transfer custody
          </Button>
        )}
        <Button
          kind="tertiary"
          size="sm"
          onClick={() => openPanelForExhibit(exhibit.id)}
          data-testid="header-ask-pivota"
        >
          Ask Pivota about {exhibit.exhibitLabel}
        </Button>
      </div>
      {transferOpen && (
        <TransferCustodyForm
          exhibitId={exhibit.id}
          currentCustodianUserId={custodyCard?.current?.currentCustodianUserId ?? null}
          onDone={() => setTransferOpen(false)}
        />
      )}
      {/* Phase 8: the discrepancy banner now also carries the alert-banner
          treatment + inline Record-ruling action for the one blocking condition
          (UNRESOLVED_OBJECTION_JURY_ELIGIBLE); every other flag's F14
          acknowledge/audit behavior is unchanged. It renders nothing when there
          are no active flags. */}
      <DiscrepancyBanner
        exhibitId={exhibit.id}
        flags={data.discrepancyFlags}
        objections={data.objections ?? []}
      />
    </Tile>
  );
}
