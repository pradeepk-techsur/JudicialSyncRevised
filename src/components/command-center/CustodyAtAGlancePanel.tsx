'use client';

import { useState } from 'react';
import { Tile, SkeletonText, ActionableNotification } from '@carbon/react';
import type { Role } from '@prisma/client';
import { useRoleStore } from '@/stores/roleStore';
import { useCustodyByCustodian } from '@/hooks/useCustodyByCustodian';
import { ExhibitTag } from '@/components/shared/ExhibitTag';
import { TransferCustodyForm } from '@/components/actions/TransferCustodyForm';
import styles from './CustodyAtAGlancePanel.module.scss';

// F8 Command Center — "Custody at a Glance" panel (UX Screen-00 §Process step 3).
// Groups every role-visible exhibit by its current custodian of record, with a
// DISTINCT red "No custodian" row at the bottom (a custody gap is a first-class,
// meaningful state — never folded into a group). Each exhibit carries an inline
// Transfer/Assign entry point that expands 08-09's shared TransferCustodyForm —
// this screen's first-ever write affordance. The trigger is ABSENT (not
// disabled) for any role outside DEPUTY/CLERK/ADMIN (Y0-patterns §Role-Gated
// Control Visibility); the server gate (08-02) remains authoritative regardless.
//
// data-testid / aria-label contract per Screen-00's "New data-testid/aria-label
// contract needed" section.

// Only these roles see the inline transfer/assign trigger (absent-not-disabled).
// Mirrors TransferCustodyForm's own CUSTODY_ROLES — the form re-checks the same
// gate internally, so a tampered client still renders nothing useful, and the
// server 403s regardless.
const CUSTODY_ROLES: Role[] = ['DEPUTY', 'CLERK', 'ADMIN'];

export function CustodyAtAGlancePanel() {
  const role = useRoleStore((s) => s.role);
  const { data, isLoading, isError, refetch } = useCustodyByCustodian();
  const [openExhibitId, setOpenExhibitId] = useState<string | null>(null);
  const canTransfer = CUSTODY_ROLES.includes(role);

  const toggle = (exhibitId: string) =>
    setOpenExhibitId((prev) => (prev === exhibitId ? null : exhibitId));

  return (
    <Tile data-testid="custody-at-a-glance" aria-label="Custody at a glance">
      <h2 className={styles.heading}>Custody at a Glance</h2>

      {isLoading && (
        <div aria-hidden="true">
          <SkeletonText paragraph lineCount={3} width="100%" />
        </div>
      )}

      {isError && (
        <ActionableNotification
          kind="error"
          lowContrast
          inline
          hideCloseButton
          role="alert"
          title="Unable to load custody — please retry"
          actionButtonLabel="Reload"
          onActionButtonClick={() => refetch()}
        />
      )}

      {!isLoading &&
        !isError &&
        data?.groups.map((group) => (
          <div
            key={group.custodianUserId}
            data-testid="custody-group"
            aria-label={`Custody group: ${group.custodianName}, ${group.exhibits.length} exhibits`}
            className={styles.group}
          >
            <span className={styles.custodianName}>{group.custodianName}:</span>
            {group.exhibits.map((e) => (
              <span key={e.exhibitId} className={styles.exhibitEntry}>
                <ExhibitTag label={e.exhibitLabel} />
                {canTransfer && (
                  <button
                    type="button"
                    data-testid="custody-glance-transfer-action"
                    className={styles.transferTrigger}
                    onClick={() => toggle(e.exhibitId)}
                  >
                    Transfer
                  </button>
                )}
                {openExhibitId === e.exhibitId && (
                  <TransferCustodyForm
                    exhibitId={e.exhibitId}
                    currentCustodianUserId={group.custodianUserId}
                    onDone={() => setOpenExhibitId(null)}
                  />
                )}
              </span>
            ))}
          </div>
        ))}

      {/* NOTE: `data-testid="custody-group-pending"` from Screen-00's contract is
          DELIBERATELY NOT rendered — pendingTransfersIn is always [] this phase
          (F19 propose/confirm/cancel is Phase-7.1 scope, skipped), so there is
          nothing to group. A future Phase-7.1 implementer re-adds the pending
          grouping HERE, reading group.pendingTransfersIn. */}

      {!isLoading && !isError && data && data.noCustodian.length > 0 && (
        <div
          data-testid="custody-group-no-custodian"
          aria-label={`${data.noCustodian.length} exhibits with no custodian of record`}
          className={styles.noCustodianGroup}
        >
          <span className={styles.noCustodianLabel}>⚠ No custodian:</span>
          {data.noCustodian.map((e) => (
            <span key={e.exhibitId} className={styles.exhibitEntry}>
              <ExhibitTag label={e.exhibitLabel} />
              {canTransfer && (
                <button
                  type="button"
                  data-testid="custody-glance-transfer-action"
                  className={styles.transferTrigger}
                  onClick={() => toggle(e.exhibitId)}
                >
                  Assign
                </button>
              )}
              {openExhibitId === e.exhibitId && (
                <TransferCustodyForm
                  exhibitId={e.exhibitId}
                  currentCustodianUserId={null}
                  onDone={() => setOpenExhibitId(null)}
                />
              )}
            </span>
          ))}
        </div>
      )}

      {!isLoading &&
        !isError &&
        data &&
        data.groups.length === 0 &&
        data.noCustodian.length === 0 && (
          <p className={styles.empty}>No exhibits to show yet.</p>
        )}
    </Tile>
  );
}
