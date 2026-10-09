'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Button,
  InlineNotification,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import type { Role } from '@prisma/client';
import { StatusBadge } from '@/components/StatusBadge';
import { DiscrepancyBadge } from '@/components/case/DiscrepancyBadge';
import { AcknowledgeInline } from '@/components/jury/AcknowledgeInline';
import { useRoleStore } from '@/stores/roleStore';
import {
  JuryPackageError,
  type BlockingExhibit,
  type JuryPackageDto,
  type JuryPackageExhibitView,
} from '@/hooks/useJuryPackage';
import { resolveFlagId, type CaseDiscrepancyFlag } from '@/hooks/useDiscrepancyCount';
import styles from './JuryPackageDraft.module.scss';

// Roles permitted to ACT (finalize/acknowledge) on the jury package. View-only
// roles (JUDGE for finalize is excluded — only DEPUTY/CLERK/ADMIN finalize; but
// JUDGE may acknowledge). We split the two gates accordingly.
const FINALIZE_ROLES: Role[] = ['DEPUTY', 'CLERK', 'ADMIN'];
const ACK_ROLES: Role[] = ['DEPUTY', 'CLERK', 'JUDGE', 'ADMIN'];

function relativeTime(fromMs: number): string {
  const secs = Math.max(0, Math.round((Date.now() - fromMs) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  return `${mins}m ago`;
}

// The "updated Xs ago" freshness label ticks every second. It is isolated in its
// OWN component so its 1s re-render never re-renders the table rows (which would
// detach the inline acknowledge controls mid-interaction — a real usability bug
// in addition to a test-flakiness one). Phase 6 restyles its text with Carbon
// tokens but keeps this isolation property exactly as today.
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

export function JuryPackageDraft({
  juryPackage,
  exhibits,
  caseFlags,
  dataUpdatedAt,
  onFinalize,
  onExclude,
  onAcknowledge,
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
  finalizePending?: boolean;
  finalizeError?: unknown;
  acknowledgePending?: boolean;
}) {
  const role = useRoleStore((s) => s.role);
  const users = useRoleStore((s) => s.users);
  const canFinalize = FINALIZE_ROLES.includes(role);
  const canAcknowledge = ACK_ROLES.includes(role);

  // Which (exhibitId, ruleCode) acknowledge expander is open, if any.
  const [ackTarget, setAckTarget] = useState<{ exhibitId: string; ruleCode: string } | null>(null);
  const [ackError, setAckError] = useState<string | null>(null);

  // LIVE gate — read ONLY from the per-row flags' OPEN status (never
  // discrepancyStatus, which collapses OPEN+ACKNOWLEDGED). A row BLOCKS iff it has
  // ≥1 OPEN flag; finalize is disabled iff ANY included row is blocking.
  const blocking = useMemo(
    () => exhibits.filter((r) => r.flags.some((f) => f.status === 'OPEN')),
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

  // "N of M exhibits have open discrepancies".
  const summary = `${blocking.length} of ${exhibits.length} exhibits have open discrepancies`;

  // Stale-client 409 blocking list from the finalize mutation error.
  const staleBlockers: BlockingExhibit[] | null =
    finalizeError instanceof JuryPackageError &&
    finalizeError.code === 'JURY_PACKAGE_DISCREPANCIES_OPEN'
      ? finalizeError.details?.blockingExhibits ?? []
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
            {summary}
          </p>
        </div>
        <FreshnessIndicator dataUpdatedAt={dataUpdatedAt} />
      </div>

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

      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>Label</TableHeader>
            <TableHeader>Status</TableHeader>
            <TableHeader>Discrepancy</TableHeader>
            {canAcknowledge && <TableHeader>Actions</TableHeader>}
          </TableRow>
        </TableHead>
        <TableBody>
          {exhibits.map((row) => {
            const rowOpenFlags = row.flags.filter((f) => f.status === 'OPEN');
            // F13: a sealed/ex-parte row is a CRITICAL blocker — it hard-blocks
            // finalize exactly like an open discrepancy, so mark it data-blocking.
            const isBlocking = rowOpenFlags.length > 0 || row.isSealed;
            return (
              <TableRow
                key={row.exhibitId}
                data-testid="jury-exhibit-row"
                data-exhibit-label={row.exhibitLabel}
                data-blocking={isBlocking ? 'true' : 'false'}
              >
                <TableCell className={styles.label}>{row.exhibitLabel}</TableCell>
                <TableCell>
                  <StatusBadge status={row.currentStatus} />
                </TableCell>
                <TableCell>
                  {row.isSealed ? (
                    // F13: sealed/ex-parte rows NEVER render Clean/Flagged — they
                    // render a distinct, higher-severity CRITICAL treatment with
                    // the UX-Mockup's exact copy and no Fix/Acknowledge affordance.
                    <div
                      className={styles.criticalCell}
                      data-testid="jury-critical-row"
                      data-exhibit-label={row.exhibitLabel}
                    >
                      <span className={styles.criticalBadge}>
                        ⛔ CRITICAL · ex parte material — must be removed
                      </span>
                    </div>
                  ) : (
                    <>
                      {row.flags.length > 0 ? (
                        <DiscrepancyBadge flags={row.flags} />
                      ) : (
                        <span className={styles.clean}>Clean</span>
                      )}
                      {/* F14: for each ACKNOWLEDGED flag on this row, render the full
                          record (actor, role, timestamp, justification) inline, always
                          visible — resolved from the already-held caseFlags + roster
                          (no new fetch), same pattern as resolveFlagId. */}
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
                              Acknowledged by {ackUser?.name ?? 'Unknown'} ({ackUser?.role ?? '—'})
                              · {new Date(fullRecord.acknowledgedAt).toLocaleString()}:{' '}
                              {fullRecord.justification ?? ''}
                            </p>
                          );
                        })}
                    </>
                  )}
                </TableCell>
                {canAcknowledge && (
                  <TableCell>
                    {/* F13: CRITICAL row → role-gated Remove-from-Package action
                        (DEPUTY/CLERK/ADMIN, the SAME set as finalize — NOT the
                        acknowledge set, so a JUDGE sees the blocker with no
                        action control). */}
                    {row.isSealed ? (
                      canFinalize && (
                        <button
                          type="button"
                          data-testid="jury-remove-from-package"
                          className={styles.removeTrigger}
                          onClick={() => onExclude(row.exhibitId)}
                        >
                          Remove from Package
                        </button>
                      )
                    ) : (
                      rowOpenFlags.length > 0 && (
                        <div className={styles.actionCell}>
                          <div className={styles.actionRow}>
                            <Link
                              href={`/exhibit/${row.exhibitId}`}
                              className={styles.fixLink}
                              data-testid="jury-fix-link"
                            >
                              Fix →
                            </Link>
                            {rowOpenFlags.map((f) => (
                              <button
                                key={f.ruleCode}
                                type="button"
                                data-testid="jury-acknowledge-trigger"
                                className={styles.ackTrigger}
                                onClick={() =>
                                  setAckTarget({ exhibitId: row.exhibitId, ruleCode: f.ruleCode })
                                }
                              >
                                Acknowledge
                              </button>
                            ))}
                          </div>
                          {ackTarget?.exhibitId === row.exhibitId && (
                            <AcknowledgeInline
                              pending={acknowledgePending}
                              error={ackError}
                              onConfirm={(justification) =>
                                handleAckConfirm(
                                  ackTarget.exhibitId,
                                  ackTarget.ruleCode,
                                  justification,
                                )
                              }
                              onCancel={() => {
                                setAckTarget(null);
                                setAckError(null);
                              }}
                            />
                          )}
                        </div>
                      )
                    )}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <div className={styles.finalizeBlock}>
        {canFinalize ? (
          <>
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
          <p className={styles.finalizeRestricted} data-testid="jury-finalize-restricted">
            Only a deputy, clerk, or administrator may finalize the jury package.
          </p>
        )}
      </div>
    </div>
  );
}
