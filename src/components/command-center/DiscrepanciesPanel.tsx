'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useDiscrepancies } from '@/hooks/useDiscrepancies';
import { useExhibitList } from '@/hooks/useExhibitList';
import { apiFetch } from '@/lib/apiClient';
import { useRoleStore } from '@/stores/roleStore';
import { ruleLabel } from '@/lib/discrepancyLabels';

// F8 Command Center — Discrepancies panel (lower-row RIGHT), the HIGHEST-risk
// signal (UX: warning-amber, count badge "visible from across the room").
// Presentational over its OWN useDiscrepancies hook. STRICTLY read-only: per-row
// link-throughs plus a READ-retry on error only (criterion 3).
//
// Sealed filtering (criterion: sealed absent from ALL three panels, threat
// T-05-07/T-05-08): Phase 3's /discrepancies returns ALL case flags regardless of
// viewer (it backs the viewer-independent jury sidebar count). To keep a sealed
// exhibit's discrepancies out of THIS panel for a role that cannot see it, we
// COMPOSE two already-role-scoped service reads — intersect the flags with the
// role-visible exhibit set from useExhibitList (which is sealed-filtered
// server-side) and keep only flags whose exhibitId is visible. This is composition
// of two sealed-correct server reads, NOT screen-local status derivation: the
// panel derives no discrepancy state, it only drops rows for exhibits the role
// cannot see. The count badge counts only the filtered flags, so a sealed
// discrepancy is never shown AND never counted.

export function DiscrepanciesPanel() {
  const caseId = useRoleStore((s) => s.caseId);
  const role = useRoleStore((s) => s.role);

  const discrepancies = useDiscrepancies();
  // The role-visible exhibit set (sealed-filtered at the server). Default
  // (unfiltered) list — same hook/cache the Case Workspace uses.
  const exhibitList = useExhibitList({});

  // Discrepancy-row routing (CONTEXT): a row routes to the Jury Package Workspace
  // IF a draft exists, else Exhibit Detail. Read the jury-package state once
  // (role-governed by Phase 3, read-only, returns { juryPackage: null } when
  // none). On ANY error/unavailability we DEFAULT to Exhibit Detail — the panel
  // never blocks on this. Role in the key so a switch re-reads.
  const juryPackage = useQuery<boolean>({
    queryKey: ['jury-package-exists', caseId, role],
    queryFn: async () => {
      if (!caseId) return false;
      const res = await apiFetch(`/api/cases/${caseId}/jury-package`);
      if (!res.ok) return false;
      const body = await res.json();
      return Boolean(body?.juryPackage);
    },
    enabled: Boolean(caseId),
  });
  const draftExists = juryPackage.data === true;

  const visibleIds = new Set((exhibitList.data ?? []).map((r) => r.exhibitId));
  // Intersect: drop flags whose exhibit the current role cannot see.
  const flags = (discrepancies.data ?? []).filter((f) => visibleIds.has(f.exhibitId));
  const count = flags.length;

  const isLoading = discrepancies.isLoading || exhibitList.isLoading;
  // BOTH reads back this panel: discrepancies supply the flags, the exhibit list
  // supplies the role-visible set we intersect against to drop sealed rows. If
  // EITHER fails we must surface the error — an exhibit-list failure leaves
  // visibleIds empty, which would otherwise silently filter every flag out and
  // paint a FALSE "No open discrepancies" all-clear on the highest-risk panel.
  const isError = discrepancies.isError || exhibitList.isError;

  const headerClass =
    count > 0
      ? 'mb-3 flex items-center gap-2 rounded bg-amber-100 px-2 py-1 text-sm font-semibold uppercase tracking-wide text-amber-900'
      : 'mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-700';

  return (
    <section
      data-testid="discrepancies-panel"
      className="rounded-lg border bg-white p-4"
      aria-label="Discrepancies"
    >
      <h2 className={headerClass}>
        Discrepancies
        {count > 0 ? (
          <span
            data-testid="discrepancy-count"
            className="inline-flex min-w-7 items-center justify-center rounded-full bg-amber-500 px-2 py-0.5 text-base font-bold text-white"
          >
            {count}
          </span>
        ) : (
          <span className="font-normal text-gray-500">(0)</span>
        )}
      </h2>

      {isLoading && (
        <ul className="space-y-2" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-5 w-full animate-pulse rounded bg-gray-100" />
          ))}
        </ul>
      )}

      {isError && (
        <div className="text-sm text-red-600" role="alert">
          Unable to load discrepancies — please retry.{' '}
          <button
            type="button"
            onClick={() => {
              discrepancies.refetch();
              exhibitList.refetch();
            }}
            className="font-medium underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !isError && count === 0 && (
        <p className="text-sm text-gray-500">No open discrepancies.</p>
      )}

      {!isLoading && !isError && count > 0 && (
        <ul className="divide-y divide-gray-100">
          {flags.map((f) => (
            <li key={f.id}>
              <Link
                href={draftExists ? '/jury-package' : `/exhibit/${f.exhibitId}`}
                data-testid="discrepancy-row"
                className="flex items-baseline gap-2 px-1 py-2 text-sm hover:bg-amber-50"
              >
                <span className="text-amber-600" aria-hidden="true">
                  ⚑
                </span>
                {/* Plain-language rule text always visible (Y0-patterns
                    Discrepancy Flag Treatment) — mapped through the single
                    ruleLabel source, falling back to the raw code. */}
                <span className="flex-1 text-gray-800">{ruleLabel(f.ruleCode)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
