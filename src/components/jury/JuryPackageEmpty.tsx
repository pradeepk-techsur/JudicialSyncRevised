'use client';

import { useRoleStore } from '@/stores/roleStore';
import type { Role } from '@prisma/client';
import { JuryPackageError } from '@/hooks/useJuryPackage';

const INITIATE_ROLES: Role[] = ['DEPUTY', 'CLERK', 'ADMIN'];

// The explicit "no package started yet" empty state (ROADMAP criterion 5 +
// CONTEXT + F11). CRITICAL: reaching this screen created NOTHING — the GET is
// read-only and returned `juryPackage: null`; a draft is created ONLY by the
// explicit Initiate button below. For DEPUTY/CLERK/ADMIN we render that button;
// for view-only roles we render a caption explaining a deputy/clerk/admin must
// start the package.
export function JuryPackageEmpty({
  onInitiate,
  pending,
  error,
}: {
  onInitiate: () => void;
  pending?: boolean;
  error?: unknown;
}) {
  const role = useRoleStore((s) => s.role);
  const canInitiate = INITIATE_ROLES.includes(role);

  // A NO_ELIGIBLE_EXHIBITS 422 is NOT a hard error — it just means no admitted
  // exhibits exist yet. Surface it as informational copy, not a red error.
  const noEligible =
    error instanceof JuryPackageError && error.code === 'NO_ELIGIBLE_EXHIBITS';
  const hardError = error instanceof Error && !noEligible ? error : null;

  return (
    <div
      className="rounded border border-dashed p-8 text-center"
      data-testid="jury-package-empty"
    >
      <h2 className="text-lg font-semibold text-gray-800">No jury package started yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
        A jury package is the authoritative handoff list of admitted exhibits. Viewing
        this screen does not start one — a deputy, clerk, or administrator must
        explicitly initiate it.
      </p>

      {noEligible && (
        <p className="mt-3 text-sm text-gray-600" data-testid="jury-no-eligible">
          No admitted exhibits yet — there is nothing to package until at least one
          exhibit is admitted.
        </p>
      )}

      {canInitiate ? (
        <button
          type="button"
          data-testid="jury-initiate"
          className="mt-4 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onInitiate}
          disabled={pending}
        >
          {pending ? 'Initiating…' : 'Initiate jury package'}
        </button>
      ) : (
        <p className="mt-4 text-sm italic text-gray-500" data-testid="jury-initiate-restricted">
          A deputy, clerk, or administrator must initiate the jury package.
        </p>
      )}

      {hardError && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          Unable to initiate the jury package — please retry.
        </p>
      )}
    </div>
  );
}
