'use client';

import { useState } from 'react';
import { Button } from '@carbon/react';
import type { ObjectionCurrentState, Role } from '@prisma/client';
import type { DiscrepancyFlagSummary } from '@/lib/types';
import { useRoleStore } from '@/stores/roleStore';
import { useAcknowledgeDiscrepancy, JuryPackageError } from '@/hooks/useAcknowledgeDiscrepancy';
import { useDiscrepancyCount, resolveFlagId } from '@/hooks/useDiscrepancyCount';
import { AcknowledgeInline } from '@/components/jury/AcknowledgeInline';
import { RecordRulingForm } from '@/components/actions/RecordRulingForm';
import { ActionButtonRow } from '@/components/shared/ActionButtonRow';
import styles from './DiscrepancyBanner.module.scss';

const ACK_ROLES: Role[] = ['DEPUTY', 'CLERK', 'JUDGE', 'ADMIN'];

// The one blocking condition that earns the Screenshot-2 alert-banner treatment:
// an exhibit admitted while an objection is still unresolved (P-7's legacy
// HIGH-tier scenario). Every OTHER rule code keeps the plain flag-row + F14
// acknowledge/audit treatment byte-for-byte.
const ALERT_RULE = 'UNRESOLVED_OBJECTION_JURY_ELIGIBLE';

// The Exhibit Detail discrepancy banner (CONTEXT: acknowledge lives here as a
// header banner with inline expansion). Lists each flag's plain-language label;
// for OPEN flags, roles permitted to act see an inline Acknowledge reusing the
// shared AcknowledgeInline. On success the acknowledge mutation invalidates the
// exhibit-history query so the banner restyles to muted "Ack'd" from live server
// state — ACKNOWLEDGED flags are shown muted, never hidden. View-only roles see
// the flags but no acknowledge control (server 403 is the backstop).
//
// Phase 8 (F10/F24): for exactly ONE rule code (UNRESOLVED_OBJECTION_JURY_ELIGIBLE
// while OPEN) the banner escalates to an alert-banner treatment (red outline /
// light-red background per Screenshot 2) with a "Record ruling" + "Acknowledge"
// action pair. "Record ruling" expands 08-09's shared RecordRulingForm inline,
// targeting the SPECIFIC objectionId resolved from history.objections (F24
// §Process — never a bare exhibitId). The ruling form is JUDGE-only, ABSENT (not
// disabled) for every other role via the form's own RULING_ROLES gate backed by
// recordRuling's Phase-1 server gate. Submitting a ruling resolves the thread;
// on the next poll tick the flag clears and the alert banner disappears. The F14
// acknowledge flow (disclosure, audit record, inline expansion) is unchanged —
// this adds a new visual treatment + a new inline action for one rule code, it
// does not alter the acknowledge contract for any flag.
export function DiscrepancyBanner({
  exhibitId,
  flags,
  objections = [],
}: {
  exhibitId: string;
  flags: DiscrepancyFlagSummary[];
  // Phase 8 (F10/F24): the UNRESOLVED ObjectionCurrentState rows for this exhibit
  // (from history.objections), so the alert-banner's "Record ruling" button can
  // target the SPECIFIC objectionId (F24 §Process — never a bare exhibitId with
  // ambiguous thread selection). Optional/defaulted so callers that don't yet
  // pass it (and the existing F14 e2e mock, which omits it) stay compatible.
  objections?: ObjectionCurrentState[];
}) {
  const role = useRoleStore((s) => s.role);
  const users = useRoleStore((s) => s.users);
  const canAcknowledge = ACK_ROLES.includes(role);
  const acknowledge = useAcknowledgeDiscrepancy();
  const { flags: caseFlags } = useDiscrepancyCount();

  const [openRule, setOpenRule] = useState<string | null>(null);
  const [rulingOpenRule, setRulingOpenRule] = useState<string | null>(null);
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

  // The single UNRESOLVED thread this flag concerns. Per the threat model
  // (T-08-21, accept), this phase's one qualifying fixture (P-7) has exactly one
  // unresolved objection; per-thread disambiguation for a hypothetical exhibit
  // with multiple concurrent unresolved threads AND this flag is out of scope.
  const alertObjection = objections[0];

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

          // F14 acknowledge control + inline expansion, shared by BOTH the plain
          // flag-row treatment and the alert-banner treatment below. T-05: a real
          // Carbon `Button` (tertiary/outline) — the secondary action next to the
          // primary Record-ruling button inside the ActionButtonRow, and a subdued
          // outline so it doesn't compete with Confirm/Cancel inside the
          // AcknowledgeInline expansion that follows it.
          const acknowledgeTrigger = isOpen && canAcknowledge && (
            <Button
              kind="tertiary"
              size="sm"
              type="button"
              data-testid="exhibit-acknowledge-trigger"
              onClick={() => setOpenRule(openRule === flag.ruleCode ? null : flag.ruleCode)}
            >
              Acknowledge
            </Button>
          );
          const ackRecord = !isOpen && fullRecord?.acknowledgedAt && (
            <p className={styles.ackRecord} data-testid="discrepancy-ack-record">
              Acknowledged by {ackUser?.name ?? 'Unknown'} ({ackUser?.role ?? '—'}) ·{' '}
              {new Date(fullRecord.acknowledgedAt).toLocaleString()}:{' '}
              {fullRecord.justification ?? ''}
            </p>
          );
          const ackInline = openRule === flag.ruleCode && (
            <AcknowledgeInline
              pending={acknowledge.isPending}
              error={error}
              onConfirm={(justification) => handleConfirm(flag.ruleCode, justification)}
              onCancel={() => {
                setOpenRule(null);
                setError(null);
              }}
            />
          );

          // Phase 8: the alert-banner treatment for the one blocking condition.
          if (flag.ruleCode === ALERT_RULE && isOpen) {
            return (
              <li
                key={flag.ruleCode}
                data-testid="exhibit-discrepancy-flag"
                data-rule-code={flag.ruleCode}
              >
                <div
                  className={styles.alertBanner}
                  data-testid="exhibit-alert-banner"
                  data-discrepancy-status={flag.status}
                >
                  <p className={styles.alertTitle}>Admitted while an objection is unresolved</p>
                  <p className={styles.alertDetail}>
                    This exhibit was admitted despite an unresolved objection on record. Record a
                    ruling to resolve it.
                  </p>
                  <ActionButtonRow
                    primary={
                      alertObjection ? (
                        // T-05: a real Carbon primary Button — the SAME
                        // kind="primary" size="sm" convention as the app's other
                        // Record-ruling buttons (AttentionFeedPanel, the
                        // soon-removed ObjectionCard trigger), so it is visually
                        // identical to every other primary action button. A tiny
                        // underlined text link for a judicial-ruling action is an
                        // accidental-click risk; a real button is not.
                        <Button
                          kind="primary"
                          size="sm"
                          type="button"
                          data-testid="exhibit-record-ruling-trigger"
                          onClick={() =>
                            setRulingOpenRule(
                              rulingOpenRule === flag.ruleCode ? null : flag.ruleCode,
                            )
                          }
                        >
                          Record ruling
                        </Button>
                      ) : undefined
                    }
                    secondary={acknowledgeTrigger || undefined}
                  />
                  {rulingOpenRule === flag.ruleCode && alertObjection && (
                    <RecordRulingForm
                      objectionId={alertObjection.objectionId}
                      // Re-render follows the next poll tick (react-query
                      // invalidation in useRecordRuling); closing the inline form
                      // is all this parent owns.
                      onDone={() => setRulingOpenRule(null)}
                    />
                  )}
                  {ackInline}
                </div>
              </li>
            );
          }

          // EVERY OTHER rule code: the existing F14 plain flag-row treatment,
          // byte-for-byte unchanged.
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
                {acknowledgeTrigger}
              </div>
              {ackRecord}
              {ackInline}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
