'use client';

import type { Role } from '@prisma/client';
import { StatusBadge } from '@/components/StatusBadge';
import { useRoleStore } from '@/stores/roleStore';
import type { JuryPackageDto, JuryPackageExhibitView } from '@/hooks/useJuryPackage';

const INITIATE_ROLES: Role[] = ['DEPUTY', 'CLERK', 'ADMIN'];

// Read-only FINALIZED view (CONTEXT export/print + finalize success). The screen
// computes nothing — it renders the server-provided (already role-filtered)
// exhibit list, so sealed exhibits never appear for an unauthorized viewer, and
// window.print() prints exactly that DOM (T-03-14). finalizedBy is resolved to a
// name via the already-hydrated useRoleStore roster, avoiding an API change.
export function JuryPackageFinalized({
  juryPackage,
  exhibits,
  onStartNewDraft,
  startDraftPending,
}: {
  juryPackage: JuryPackageDto;
  exhibits: JuryPackageExhibitView[];
  onStartNewDraft: () => void;
  startDraftPending?: boolean;
}) {
  const role = useRoleStore((s) => s.role);
  const users = useRoleStore((s) => s.users);
  const caseNumber = useRoleStore((s) => s.caseNumber);
  const canStartNew = INITIATE_ROLES.includes(role);

  const finalizedByName =
    users.find((u) => u.id === juryPackage.finalizedBy)?.name ?? juryPackage.finalizedBy ?? 'Unknown';
  const finalizedAt = juryPackage.finalizedAt
    ? new Date(juryPackage.finalizedAt).toLocaleString()
    : '—';

  return (
    <div data-testid="jury-package-finalized" className="jury-print-root">
      {/* Print-only handoff header — hidden on screen, shown when printing. */}
      <div className="hidden print:block print:mb-4">
        <p className="text-sm">Case {caseNumber ?? ''}</p>
        <h1 className="text-lg font-bold">Jury Package — FINALIZED</h1>
      </div>

      <div
        className="mb-4 rounded border border-green-300 bg-green-50 p-4"
        data-testid="jury-finalized-banner"
      >
        <h1 className="text-lg font-semibold text-green-800">
          FINALIZED ✓ Zero discrepancies
        </h1>
        <p className="mt-1 text-sm text-green-700">
          Finalized by {finalizedByName} on {finalizedAt}.
        </p>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
            <th className="px-2 py-2">Label</th>
            <th className="px-2 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {exhibits.map((row) => (
            <tr key={row.exhibitId} className="border-b" data-exhibit-label={row.exhibitLabel}>
              <td className="px-2 py-2 font-medium">{row.exhibitLabel}</td>
              <td className="px-2 py-2">
                <StatusBadge status={row.currentStatus} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="no-print mt-6 flex gap-3">
        <button
          type="button"
          data-testid="jury-export-print"
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          onClick={() => window.print()}
        >
          Export / Print
        </button>
        {canStartNew && (
          <button
            type="button"
            data-testid="jury-start-new-draft"
            className="rounded border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            onClick={onStartNewDraft}
            disabled={startDraftPending}
          >
            {startDraftPending ? 'Starting…' : 'Start New Draft'}
          </button>
        )}
      </div>
    </div>
  );
}
