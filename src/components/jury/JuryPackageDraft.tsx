'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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
// in addition to a test-flakiness one).
function FreshnessIndicator({ dataUpdatedAt }: { dataUpdatedAt: number }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="text-xs text-gray-400" data-testid="jury-freshness">
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
  onAcknowledge: (flagId: string, justification: string) => Promise<void> | void;
  finalizePending?: boolean;
  finalizeError?: unknown;
  acknowledgePending?: boolean;
}) {
  const role = useRoleStore((s) => s.role);
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
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Jury Package — Draft</h1>
          <p className="mt-1 text-sm text-gray-600" data-testid="jury-summary">
            {summary}
          </p>
        </div>
        <FreshnessIndicator dataUpdatedAt={dataUpdatedAt} />
      </div>

      {staleBlockers && (
        <div
          className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800"
          role="alert"
          data-testid="jury-stale-banner"
        >
          <p className="font-medium">Cannot finalize — discrepancies reopened.</p>
          <p className="mt-1">
            The following exhibit(s) have unresolved discrepancies and must be resolved or
            acknowledged first:{' '}
            <span className="font-medium">
              {staleBlockers.map((b) => b.exhibitLabel).join(', ')}
            </span>
            .
          </p>
        </div>
      )}

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
            <th className="px-2 py-2">Label</th>
            <th className="px-2 py-2">Status</th>
            <th className="px-2 py-2">Discrepancy</th>
            {canAcknowledge && <th className="px-2 py-2">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {exhibits.map((row) => {
            const rowOpenFlags = row.flags.filter((f) => f.status === 'OPEN');
            const isBlocking = rowOpenFlags.length > 0;
            return (
              <tr
                key={row.exhibitId}
                data-testid="jury-exhibit-row"
                data-exhibit-label={row.exhibitLabel}
                data-blocking={isBlocking ? 'true' : 'false'}
                className="border-b align-top"
              >
                <td className="px-2 py-2 font-medium">{row.exhibitLabel}</td>
                <td className="px-2 py-2">
                  <StatusBadge status={row.currentStatus} />
                </td>
                <td className="px-2 py-2">
                  {row.flags.length > 0 ? (
                    <DiscrepancyBadge flags={row.flags} />
                  ) : (
                    <span className="text-xs text-gray-400">Clean</span>
                  )}
                </td>
                {canAcknowledge && (
                  <td className="px-2 py-2">
                    {rowOpenFlags.length > 0 && (
                      <div className="flex flex-col gap-1">
                        <div className="flex gap-2">
                          <Link
                            href={`/exhibit/${row.exhibitId}`}
                            className="text-xs text-blue-600 hover:underline"
                            data-testid="jury-fix-link"
                          >
                            Fix →
                          </Link>
                          {rowOpenFlags.map((f) => (
                            <button
                              key={f.ruleCode}
                              type="button"
                              data-testid="jury-acknowledge-trigger"
                              className="text-xs text-amber-700 hover:underline"
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
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-6">
        {canFinalize ? (
          <>
            <button
              type="button"
              data-testid="jury-finalize"
              className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
              disabled={hasOpen || finalizePending}
              onClick={() => onFinalize(juryPackage.id)}
            >
              {finalizePending ? (
                <span className="inline-flex items-center gap-2">
                  <span
                    className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent"
                    aria-hidden="true"
                  />
                  Finalizing…
                </span>
              ) : (
                'Finalize jury package'
              )}
            </button>
            {hasOpen && (
              <p className="mt-2 text-xs text-gray-500" data-testid="jury-finalize-caption">
                Resolve or acknowledge all open discrepancies to finalize.
              </p>
            )}
          </>
        ) : (
          <p className="text-sm italic text-gray-500" data-testid="jury-finalize-restricted">
            Only a deputy, clerk, or administrator may finalize the jury package.
          </p>
        )}
      </div>
    </div>
  );
}
