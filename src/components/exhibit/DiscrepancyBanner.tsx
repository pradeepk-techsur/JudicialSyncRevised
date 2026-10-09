'use client';

import { useState } from 'react';
import type { Role } from '@prisma/client';
import type { DiscrepancyFlagSummary } from '@/lib/types';
import { useRoleStore } from '@/stores/roleStore';
import { useAcknowledgeDiscrepancy, JuryPackageError } from '@/hooks/useAcknowledgeDiscrepancy';
import { useDiscrepancyCount, resolveFlagId } from '@/hooks/useDiscrepancyCount';
import { AcknowledgeInline } from '@/components/jury/AcknowledgeInline';
import styles from './DiscrepancyBanner.module.scss';

const ACK_ROLES: Role[] = ['DEPUTY', 'CLERK', 'JUDGE', 'ADMIN'];

// The Exhibit Detail discrepancy banner (CONTEXT: acknowledge lives here as a
// header banner with inline expansion). Lists each flag's plain-language label;
// for OPEN flags, roles permitted to act see an inline Acknowledge reusing the
// shared AcknowledgeInline. On success the acknowledge mutation invalidates the
// exhibit-history query so the banner restyles to muted "Ack'd" from live server
// state — ACKNOWLEDGED flags are shown muted, never hidden. View-only roles see
// the flags but no acknowledge control (server 403 is the backstop).
export function DiscrepancyBanner({
  exhibitId,
  flags,
}: {
  exhibitId: string;
  flags: DiscrepancyFlagSummary[];
}) {
  const role = useRoleStore((s) => s.role);
  const users = useRoleStore((s) => s.users);
  const canAcknowledge = ACK_ROLES.includes(role);
  const acknowledge = useAcknowledgeDiscrepancy();
  const { flags: caseFlags } = useDiscrepancyCount();

  const [openRule, setOpenRule] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (flags.length === 0) return null;

  const handleConfirm = async (ruleCode: string, justification: string) => {
    setError(null);
    const flagId = resolveFlagId(caseFlags, exhibitId, ruleCode);
    if (!flagId) {
      setError('This discrepancy is no longer available to acknowledge — refreshing.');
      return;
    }
    try {
      await acknowledge.mutateAsync({ flagId, justification });
      setOpenRule(null);
    } catch (err) {
      setError(
        err instanceof JuryPackageError ? err.message : 'Failed to acknowledge — please retry.',
      );
    }
  };

  return (
    <div className={styles.banner} data-testid="exhibit-discrepancy-banner">
      <p className={styles.title}>Discrepancies</p>
      <ul className={styles.list}>
        {flags.map((flag) => {
          const isOpen = flag.status === 'OPEN';
          // F14: for an ACKNOWLEDGED flag, resolve the FULL record (actor,
          // timestamp, justification) from the already-loaded case-wide flags
          // (no new fetch) and the roster, so the record renders inline, always
          // visible, never behind a secondary click.
          const fullRecord = caseFlags.find(
            (f) => f.exhibitId === exhibitId && f.ruleCode === flag.ruleCode,
          );
          const ackUser = fullRecord?.acknowledgedBy
            ? users.find((u) => u.id === fullRecord.acknowledgedBy)
            : undefined;
          return (
            <li key={flag.ruleCode} data-testid="exhibit-discrepancy-flag" data-rule-code={flag.ruleCode}>
              <div className={styles.flagRow}>
                <span
                  className={isOpen ? styles.flagOpen : styles.flagAcked}
                  data-discrepancy-status={flag.status}
                >
                  <span aria-hidden="true">⚠</span> {flag.label}
                  {!isOpen && " (Ack'd)"}
                </span>
                {isOpen && canAcknowledge && (
                  <button
                    type="button"
                    data-testid="exhibit-acknowledge-trigger"
                    className={styles.trigger}
                    onClick={() => setOpenRule(openRule === flag.ruleCode ? null : flag.ruleCode)}
                  >
                    Acknowledge
                  </button>
                )}
              </div>
              {!isOpen && fullRecord?.acknowledgedAt && (
                <p className={styles.ackRecord} data-testid="discrepancy-ack-record">
                  Acknowledged by {ackUser?.name ?? 'Unknown'} ({ackUser?.role ?? '—'}) ·{' '}
                  {new Date(fullRecord.acknowledgedAt).toLocaleString()}:{' '}
                  {fullRecord.justification ?? ''}
                </p>
              )}
              {openRule === flag.ruleCode && (
                <AcknowledgeInline
                  pending={acknowledge.isPending}
                  error={error}
                  onConfirm={(justification) => handleConfirm(flag.ruleCode, justification)}
                  onCancel={() => {
                    setOpenRule(null);
                    setError(null);
                  }}
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
