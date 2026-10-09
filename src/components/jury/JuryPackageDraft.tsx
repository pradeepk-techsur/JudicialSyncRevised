'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button, InlineNotification } from '@carbon/react';
import type { Role } from '@prisma/client';
import { useRoleStore } from '@/stores/roleStore';
import {
  JuryPackageError,
  type BlockingExhibit,
  type JuryPackageDto,
  type JuryPackageExhibitView,
} from '@/hooks/useJuryPackage';
import { useUnresolvedObjections } from '@/hooks/useUnresolvedObjections';
import { resolveFlagId, type CaseDiscrepancyFlag } from '@/hooks/useDiscrepancyCount';
import { AcknowledgeInline } from '@/components/jury/AcknowledgeInline';
import { ExhibitTag } from '@/components/shared/ExhibitTag';
import { SeverityPill } from '@/components/shared/SeverityPill';
import { Card } from '@/components/shared/Card';
import { ActionButtonRow } from '@/components/shared/ActionButtonRow';
import { TwoColorProgressBar } from '@/components/shared/TwoColorProgressBar';
import { RecordRulingForm } from '@/components/actions/RecordRulingForm';
import { TransferCustodyForm } from '@/components/actions/TransferCustodyForm';
import styles from './JuryPackageDraft.module.scss';

// Roles permitted to ACT (finalize/acknowledge) on the jury package. View-only
// roles (JUDGE for finalize is excluded — only DEPUTY/CLERK/ADMIN finalize; but
// JUDGE may acknowledge). We split the two gates accordingly.
const FINALIZE_ROLES: Role[] = ['DEPUTY', 'CLERK', 'ADMIN'];
const ACK_ROLES: Role[] = ['DEPUTY', 'CLERK', 'JUDGE', 'ADMIN'];

const OBJECTION_RULE = 'UNRESOLVED_OBJECTION_JURY_ELIGIBLE';
const CUSTODY_RULE = 'ADMITTED_NO_CUSTODIAN';

function relativeTime(fromMs: number): string {
  const secs = Math.max(0, Math.round((Date.now() - fromMs) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  return `${mins}m ago`;
}

// The "updated Xs ago" freshness label ticks every second. It is isolated in its
// OWN component so its 1s re-render never re-renders the cards (which would
// detach the inline acknowledge/remediation controls mid-interaction — a real
// usability bug in addition to a test-flakiness one).
function FreshnessIndicator({ dataUpdatedAt }: { dataUpdatedAt: number }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className={styles.freshness} data-testid="jury-freshness">
      updated {relativeTime(dataUpdatedAt)}
    </span>
  );
}

// A tiny inline-expand trigger that mirrors the "Acknowledge" trigger/expand
// pattern used elsewhere in this file: a trigger button that, when clicked, swaps
// itself for the shared RecordRulingForm. On the form's onDone, it collapses — we
// wait for the next poll tick to confirm the new state (no optimistic update; the
// form already invalidates ['jury-package'] so this screen refetches naturally).
function InlineRulingTrigger({ objectionId }: { objectionId: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!expanded) {
    return (
      <Button
        kind="primary"
        size="sm"
        type="button"
        data-testid="jury-record-ruling-trigger"
        onClick={() => setExpanded(true)}
      >
        Record ruling
      </Button>
    );
  }
  return <RecordRulingForm objectionId={objectionId} onDone={() => setExpanded(false)} />;
}

// Same pattern as InlineRulingTrigger, for the MEDIUM (no custodian) remediation.
// First-time assignment → currentCustodianUserId is null.
function InlineCustodyTrigger({ exhibitId }: { exhibitId: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!expanded) {
    return (
      <Button
        kind="primary"
        size="sm"
        type="button"
        data-testid="jury-assign-custodian-trigger"
        onClick={() => setExpanded(true)}
      >
        Assign custodian
      </Button>
    );
  }
  return (
    <TransferCustodyForm
      exhibitId={exhibitId}
      currentCustodianUserId={null}
      onDone={() => setExpanded(false)}
    />
  );
}

export function JuryPackageDraft({
  juryPackage,
  exhibits,
  caseFlags,
  dataUpdatedAt,
  onFinalize,
  onExclude,
  onAcknowledge,
  onRequestFinalization,
  requestFinalizationPending,
  finalizePending,
  finalizeError,
  acknowledgePending,
}: {
  juryPackage: JuryPackageDto;
  exhibits: JuryPackageExhibitView[];
  caseFlags: CaseDiscrepancyFlag[];
  dataUpdatedAt: number;
  onFinalize: (id: string) => void;
  onExclude: (exhibitId: string) => void;
  onAcknowledge: (flagId: string, justification: string) => Promise<void> | void;
  onRequestFinalization?: (id: string) => void;
  requestFinalizationPending?: boolean;
  finalizePending?: boolean;
  finalizeError?: unknown;
  acknowledgePending?: boolean;
}) {
  const role = useRoleStore((s) => s.role);
  const users = useRoleStore((s) => s.users);
  const canFinalize = FINALIZE_ROLES.includes(role);
  const canAcknowledge = ACK_ROLES.includes(role);

  // Case-wide unresolved objections — the ALREADY-LIVE query (its own hook, 4s
  // polling) that maps an objection-blocker row back to its concrete objectionId,
  // so RecordRulingForm never receives an ambiguous target. No NEW network query
  // is added for this: useUnresolvedObjections already runs on the other live
  // screens and shares the react-query cache.
  const { data: unresolvedObjections } = useUnresolvedObjections();
  const objectionIdByExhibit = useMemo(() => {
    const map = new Map<string, string>();
    (unresolvedObjections ?? []).forEach((o) => {
      // First unresolved objection per exhibit wins — the row's single blocker.
      if (!map.has(o.exhibitId)) map.set(o.exhibitId, o.objectionId);
    });
    return map;
  }, [unresolvedObjections]);

  // Which (exhibitId, ruleCode) acknowledge expander is open, if any.
  const [ackTarget, setAckTarget] = useState<{ exhibitId: string; ruleCode: string } | null>(null);
  const [ackError, setAckError] = useState<string | null>(null);

  // LIVE gate — read ONLY from the per-row flags' OPEN status (never
  // discrepancyStatus, which collapses OPEN+ACKNOWLEDGED). A row BLOCKS iff it has
  // ≥1 OPEN flag; finalize is disabled iff ANY included row is blocking.
  const blocking = useMemo(
    () => exhibits.filter((r) => !r.isSealed && r.flags.some((f) => f.status === 'OPEN')),
    [exhibits],
  );
  const hasOpen = blocking.length > 0;

  // F13: a sealed/ex-parte row renders as a CRITICAL blocker and must prevent
  // finalization until it is removed (same hard-block posture as an open
  // discrepancy). A sealed row is never CLEAN/FLAGGED, so the hasOpen gate above
  // does not cover it — add an explicit hasCritical condition.
  const criticalRows = useMemo(() => exhibits.filter((r) => r.isSealed), [exhibits]);
  const hasCritical = criticalRows.length > 0;
  const disableFinalize = hasOpen || hasCritical || finalizePending;

  // Clean = non-sealed rows with zero OPEN flags.
  const cleanRows = useMemo(
    () => exhibits.filter((r) => !r.isSealed && r.flags.every((f) => f.status !== 'OPEN')),
    [exhibits],
  );
  const cleanCount = cleanRows.length;
  const blockerCount = blocking.length + criticalRows.length;

  // Stale-client 409 blocking list from the finalize mutation error.
  const staleBlockers: BlockingExhibit[] | null =
    finalizeError instanceof JuryPackageError &&
    finalizeError.code === 'JURY_PACKAGE_DISCREPANCIES_OPEN'
      ? finalizeError.details?.blockingExhibits ?? []
      : null;

  // Resolve the finalization requester's display name from the hydrated roster.
  const requesterName = juryPackage.finalizationRequestedBy
    ? users.find((u) => u.id === juryPackage.finalizationRequestedBy)?.name ??
      juryPackage.finalizationRequestedBy
    : null;

  const handleAckConfirm = async (
    exhibitId: string,
    ruleCode: string,
    justification: string,
  ) => {
    setAckError(null);
    const flagId = resolveFlagId(caseFlags, exhibitId, ruleCode);
    if (!flagId) {
      setAckError('This discrepancy is no longer available to acknowledge — refreshing.');
      return;
    }
    try {
      await onAcknowledge(flagId, justification);
      setAckTarget(null);
    } catch (err) {
      setAckError(
        err instanceof JuryPackageError ? err.message : 'Failed to acknowledge — please retry.',
      );
    }
  };

  return (
    <div data-testid="jury-package-draft">
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Jury Package — Draft</h1>
          <p className={styles.summary} data-testid="jury-summary">
            {blockerCount > 0
              ? `Not ready to finalize: ${blockerCount} blocker${blockerCount === 1 ? '' : 's'}`
              : 'All exhibits clean — ready to finalize'}
          </p>
        </div>
        <FreshnessIndicator dataUpdatedAt={dataUpdatedAt} />
      </div>

      <TwoColorProgressBar clean={cleanCount} total={exhibits.length} />

      {staleBlockers && (
        <div className={styles.staleBanner}>
          <InlineNotification
            kind="error"
            lowContrast
            role="alert"
            hideCloseButton
            data-testid="jury-stale-banner"
            title="Cannot finalize — discrepancies reopened."
            subtitle={`The following exhibit(s) have unresolved discrepancies and must be resolved or acknowledged first: ${staleBlockers
              .map((b) => b.exhibitLabel)
              .join(', ')}.`}
          />
        </div>
      )}

      <section className={styles.section} data-testid="jury-blockers-section">
        <h2 className={styles.sectionHeading}>Blockers ({blockerCount})</h2>
        {[...criticalRows, ...blocking].map((row) => {
          const isCritical = row.isSealed;
          const rowOpenFlags = row.flags.filter((f) => f.status === 'OPEN');
          const isObjectionBlocker = rowOpenFlags.some((f) => f.ruleCode === OBJECTION_RULE);
          const isCustodyBlocker = rowOpenFlags.some((f) => f.ruleCode === CUSTODY_RULE);
          const objectionId = objectionIdByExhibit.get(row.exhibitId);

          const title = isCritical
            ? 'Ex parte material in jury package'
            : isObjectionBlocker
              ? 'Unresolved objection'
              : 'No custodian on record';
          const pillTone = isCritical ? 'critical' : isObjectionBlocker ? 'high' : 'medium';
          const pillLabel = isCritical
            ? 'Critical · ex parte material'
            : isObjectionBlocker
              ? 'Unresolved objection'
              : 'No custodian on record';
          const detail = isCritical
            ? 'Sealed/ex parte material must be removed before this package can be finalized.'
            : rowOpenFlags[0]?.label ?? title;

          return (
            <Card
              key={row.exhibitId}
              critical={isCritical}
              className={styles.blockerCard}
              data-testid="jury-blocker-card"
              data-exhibit-label={row.exhibitLabel}
              data-blocking="true"
            >
              <div className={styles.blockerHead}>
                <ExhibitTag label={row.exhibitLabel} />
                <SeverityPill
                  tone={pillTone}
                  label={pillLabel}
                  ariaLabel={`Condition: ${pillLabel}`}
                />
              </div>
              <p className={styles.blockerTitle}>{title}</p>
              <p className={styles.blockerDetail}>{detail}</p>

              {/* CRITICAL (sealed/ex-parte) row — KEEP the existing Remove +
                  View-exhibit pair, unchanged behaviorally (role-gated to
                  FINALIZE_ROLES, JUDGE sees the blocker with no action). */}
              {isCritical ? (
                <ActionButtonRow
                  primary={
                    canFinalize ? (
                      <Button
                        kind="danger"
                        size="sm"
                        type="button"
                        data-testid="jury-remove-from-package"
                        onClick={() => onExclude(row.exhibitId)}
                      >
                        Remove from package
                      </Button>
                    ) : null
                  }
                  secondary={
                    <Link
                      href={`/exhibit/${row.exhibitId}`}
                      className={styles.fixLink}
                      data-testid="jury-fix-link"
                    >
                      View exhibit
                    </Link>
                  }
                />
              ) : (
                <ActionButtonRow
                  primary={
                    isObjectionBlocker && objectionId ? (
                      <InlineRulingTrigger objectionId={objectionId} />
                    ) : isCustodyBlocker ? (
                      <InlineCustodyTrigger exhibitId={row.exhibitId} />
                    ) : (
                      // Fallback: no condition-specific remediation available →
                      // offer the universal "Fix on the exhibit page" link.
                      <Link
                        href={`/exhibit/${row.exhibitId}`}
                        className={styles.fixLink}
                        data-testid="jury-fix-link"
                      >
                        Fix →
                      </Link>
                    )
                  }
                  secondary={
                    canAcknowledge && rowOpenFlags.length > 0 ? (
                      <button
                        type="button"
                        data-testid="jury-acknowledge-trigger"
                        className={styles.ackTrigger}
                        onClick={() =>
                          setAckTarget({
                            exhibitId: row.exhibitId,
                            ruleCode: rowOpenFlags[0].ruleCode,
                          })
                        }
                      >
                        Acknowledge
                      </button>
                    ) : null
                  }
                />
              )}

              {ackTarget?.exhibitId === row.exhibitId && (
                <AcknowledgeInline
                  pending={acknowledgePending}
                  error={ackError}
                  onConfirm={(justification) =>
                    handleAckConfirm(ackTarget.exhibitId, ackTarget.ruleCode, justification)
                  }
                  onCancel={() => {
                    setAckTarget(null);
                    setAckError(null);
                  }}
                />
              )}

              {/* F14: for each ACKNOWLEDGED flag on this row, render the full
                  record (actor, role, timestamp, justification) inline, always
                  visible — resolved from the already-held caseFlags + roster. */}
              {row.flags
                .filter((f) => f.status !== 'OPEN')
                .map((f) => {
                  const fullRecord = caseFlags.find(
                    (cf) => cf.exhibitId === row.exhibitId && cf.ruleCode === f.ruleCode,
                  );
                  if (!fullRecord?.acknowledgedAt) return null;
                  const ackUser = fullRecord.acknowledgedBy
                    ? users.find((u) => u.id === fullRecord.acknowledgedBy)
                    : undefined;
                  return (
                    <p
                      key={f.ruleCode}
                      className={styles.ackRecord}
                      data-testid="discrepancy-ack-record"
                    >
                      Acknowledged by {ackUser?.name ?? 'Unknown'} ({ackUser?.role ?? '—'}) ·{' '}
                      {new Date(fullRecord.acknowledgedAt).toLocaleString()}:{' '}
                      {fullRecord.justification ?? ''}
                    </p>
                  );
                })}
            </Card>
          );
        })}
      </section>

      <section className={styles.section} data-testid="jury-clean-section">
        <h2 className={styles.sectionHeading}>Clean ({cleanCount})</h2>
        {cleanRows.map((row) => (
          <div
            key={row.exhibitId}
            className={styles.cleanRow}
            data-testid="jury-clean-row"
            data-exhibit-label={row.exhibitLabel}
          >
            <ExhibitTag label={row.exhibitLabel} />
            {/* Custodian name is intentionally NOT shown here: the jury-row data
                contract (JuryPackageExhibitView) carries no custodian, and the
                clean rows have no ADMITTED_NO_CUSTODIAN flag to borrow it from —
                resolving it would require a new query the plan explicitly
                forbids. The ✓ Admitted confirmation is the reliable signal. */}
            <span className={styles.cleanStatus}>✓ Admitted</span>
          </div>
        ))}
      </section>

      <div className={styles.finalizeBlock}>
        {canFinalize ? (
          <>
            {juryPackage.finalizationRequestedAt && (
              <InlineNotification
                kind="info"
                lowContrast
                hideCloseButton
                data-testid="jury-finalization-requested-banner"
                title={`Finalization requested by ${requesterName ?? 'Unknown'} at ${new Date(
                  juryPackage.finalizationRequestedAt,
                ).toLocaleString()}`}
              />
            )}
            <Button
              kind="primary"
              type="button"
              data-testid="jury-finalize"
              disabled={disableFinalize}
              onClick={() => onFinalize(juryPackage.id)}
            >
              {finalizePending ? (
                <span className={styles.finalizingLabel}>
                  <span className={styles.spinner} aria-hidden="true" />
                  Finalizing…
                </span>
              ) : (
                'Finalize jury package'
              )}
            </Button>
            {hasCritical && (
              <p className={styles.finalizeCaption} data-testid="jury-critical-caption">
                {criticalRows.length} sealed/ex parte exhibit present — blocked.
              </p>
            )}
            {hasOpen && (
              <p className={styles.finalizeCaption} data-testid="jury-finalize-caption">
                Resolve or acknowledge all open discrepancies to finalize.
              </p>
            )}
          </>
        ) : (
          <>
            <p className={styles.finalizeRestricted} data-testid="jury-finalize-restricted">
              Only a deputy, clerk or administrator can finalize; you are signed in as {role}.
            </p>
            <Button
              kind="secondary"
              type="button"
              data-testid="jury-request-finalization"
              onClick={() => onRequestFinalization?.(juryPackage.id)}
              disabled={requestFinalizationPending}
            >
              {requestFinalizationPending ? 'Requesting…' : 'Request finalization from Clerk'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
