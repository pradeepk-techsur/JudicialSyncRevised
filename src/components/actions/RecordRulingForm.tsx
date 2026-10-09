'use client';

import { useState } from 'react';
import { Button, RadioButton, RadioButtonGroup } from '@carbon/react';
import type { Role } from '@prisma/client';
import { useRoleStore } from '@/stores/roleStore';
import { useRecordRuling } from '@/hooks/useRecordRuling';
import { JuryPackageError } from '@/hooks/juryPackageError';
import { ActionButtonRow } from '@/components/shared/ActionButtonRow';
import styles from './RecordRulingForm.module.scss';

// Only a JUDGE may record a ruling — the control is ABSENT (not disabled) for
// every other role (Y0-patterns §Role-Gated Control Visibility / F20). This
// client gate is a usability affordance only; the authoritative check is
// recordRuling's server-side JUDGE gate (Phase 1), which still 403s a tampered
// client that force-renders this form (threat T-08-14).
const RULING_ROLES: Role[] = ['JUDGE'];

type Disposition = 'SUSTAINED' | 'OVERRULED' | 'RESERVED';

export function RecordRulingForm({
  objectionId,
  onDone,
}: {
  objectionId: string;
  onDone?: () => void;
}) {
  const role = useRoleStore((s) => s.role);
  const mutation = useRecordRuling();
  const [disposition, setDisposition] = useState<Disposition | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Absent, not disabled — F20/Role-Gated Control Visibility.
  if (!RULING_ROLES.includes(role)) return null;

  // Selection alone NEVER submits — the write fires only on an explicit,
  // distinct Confirm click (Y0-patterns §Attention Feed Inline Action).
  const handleConfirm = async () => {
    if (!disposition) return;
    setError(null);
    try {
      await mutation.mutateAsync({ objectionId, disposition });
      onDone?.();
    } catch (err) {
      // Surface the SPECIFIC server rejection (e.g. 409 OBJECTION_ALREADY_RESOLVED,
      // 403 ROLE_NOT_PERMITTED) inline within the still-open form — never a silent
      // failure or generic toast.
      setError(
        err instanceof JuryPackageError ? err.message : 'Failed to record ruling — please retry.',
      );
    }
  };

  return (
    <div className={styles.container} data-testid="record-ruling-form">
      <RadioButtonGroup
        legendText="Disposition"
        name={`ruling-${objectionId}`}
        valueSelected={disposition ?? undefined}
        onChange={(value) => setDisposition(value as Disposition)}
      >
        <RadioButton labelText="Sustained" value="SUSTAINED" id={`sustained-${objectionId}`} />
        <RadioButton labelText="Overruled" value="OVERRULED" id={`overruled-${objectionId}`} />
        <RadioButton labelText="Reserved" value="RESERVED" id={`reserved-${objectionId}`} />
      </RadioButtonGroup>
      <ActionButtonRow
        primary={
          <Button
            kind="primary"
            size="sm"
            type="button"
            data-testid="record-ruling-confirm"
            disabled={!disposition || mutation.isPending}
            onClick={handleConfirm}
          >
            {mutation.isPending ? 'Recording…' : 'Confirm ruling'}
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
        <p className={styles.error} role="alert" data-testid="record-ruling-error">
          {error}
        </p>
      )}
    </div>
  );
}
