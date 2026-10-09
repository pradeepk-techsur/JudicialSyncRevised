'use client';

import { useState } from 'react';
import { Button, Dropdown } from '@carbon/react';
import type { Role } from '@prisma/client';
import { useRoleStore, type ActiveCaseUser } from '@/stores/roleStore';
import { useTransferCustody } from '@/hooks/useTransferCustody';
import { JuryPackageError } from '@/hooks/juryPackageError';
import { ActionButtonRow } from '@/components/shared/ActionButtonRow';
import styles from './TransferCustodyForm.module.scss';

// Only DEPUTY/CLERK/ADMIN may transfer/assign custody — the control is ABSENT
// (not disabled) for every other role (Y0-patterns §Role-Gated Control
// Visibility / F20). This client gate is a usability affordance only; the
// authoritative check is recordCustodyTransfer's server-side role gate (new in
// 08-02), which still 403s a tampered client that force-renders this form
// (threat T-08-14).
const CUSTODY_ROLES: Role[] = ['DEPUTY', 'CLERK', 'ADMIN'];

export function TransferCustodyForm({
  exhibitId,
  currentCustodianUserId,
  onDone,
}: {
  exhibitId: string;
  currentCustodianUserId: string | null;
  onDone?: () => void;
}) {
  const role = useRoleStore((s) => s.role);
  const users = useRoleStore((s) => s.users);
  const mutation = useTransferCustody();
  const [toUserId, setToUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Absent, not disabled — F20/Role-Gated Control Visibility.
  if (!CUSTODY_ROLES.includes(role)) return null;

  // Exclude the current custodian from the picker — F03's NO_OP_TRANSFER rule;
  // the UI never even offers a no-op selection (F24 §Process step 4). The roster
  // is the case's active users, already hydrated client-side — no new fetch.
  const candidates = users.filter((u) => u.id !== currentCustodianUserId);

  // Selection alone NEVER submits — the write fires only on an explicit,
  // distinct Confirm click (Y0-patterns §Attention Feed Inline Action).
  const handleConfirm = async () => {
    if (!toUserId) return;
    setError(null);
    try {
      await mutation.mutateAsync({
        exhibitId,
        fromCustodianUserId: currentCustodianUserId,
        toCustodianUserId: toUserId,
      });
      onDone?.();
    } catch (err) {
      // Surface the SPECIFIC server rejection (e.g. 409 CUSTODY_CHAIN_BROKEN,
      // 403 ROLE_NOT_PERMITTED) inline within the still-open form.
      setError(
        err instanceof JuryPackageError
          ? err.message
          : 'Failed to transfer custody — please retry.',
      );
    }
  };

  // Purely cosmetic label toggle — BOTH paths call the identical mutation /
  // endpoint (locked single-endpoint decision); only fromCustodianUserId differs
  // (null vs the current value), which recordCustodyTransfer branches on.
  const label = currentCustodianUserId ? 'Transfer custody to' : 'Assign custodian';

  return (
    <div className={styles.container} data-testid="transfer-custody-form">
      <Dropdown<ActiveCaseUser>
        id={`custodian-picker-${exhibitId}`}
        titleText={label}
        label="Select a user"
        items={candidates}
        itemToString={(u) => (u ? `${u.name} (${u.role})` : '')}
        onChange={({ selectedItem }) => setToUserId(selectedItem?.id ?? null)}
      />
      <ActionButtonRow
        primary={
          <Button
            kind="primary"
            size="sm"
            type="button"
            data-testid="transfer-custody-confirm"
            disabled={!toUserId || mutation.isPending}
            onClick={handleConfirm}
          >
            {mutation.isPending ? 'Transferring…' : 'Confirm'}
          </Button>
        }
        secondary={
          <Button
            kind="ghost"
            size="sm"
            type="button"
            onClick={() => onDone?.()}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
        }
      />
      {error && (
        <p className={styles.error} role="alert" data-testid="transfer-custody-error">
          {error}
        </p>
      )}
    </div>
  );
}
