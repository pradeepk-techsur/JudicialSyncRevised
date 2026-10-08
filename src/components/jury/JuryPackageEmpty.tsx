'use client';

import { Button, InlineNotification } from '@carbon/react';
import { useRoleStore } from '@/stores/roleStore';
import type { Role } from '@prisma/client';
import { JuryPackageError } from '@/hooks/useJuryPackage';
import styles from './JuryPackageEmpty.module.scss';

const INITIATE_ROLES: Role[] = ['DEPUTY', 'CLERK', 'ADMIN'];

// The explicit "no package started yet" empty state (ROADMAP criterion 5 +
// CONTEXT + F11). CRITICAL: reaching this screen created NOTHING — the GET is
// read-only and returned `juryPackage: null`; a draft is created ONLY by the
// explicit Initiate button below. For DEPUTY/CLERK/ADMIN we render that button;
// for view-only roles we render a caption explaining a deputy/clerk/admin must
// start the package.
//
// Phase 6 swaps only the rendering layer: the hand-rolled dashed-border div and
// Tailwind button become a Carbon-token-styled container + Carbon `Button`, and
// the hard-error paragraph becomes a Carbon `InlineNotification kind="error"`
// (this IS a genuine failure). The NO_ELIGIBLE_EXHIBITS copy stays plain
// informational text — it is explicitly "not a hard error" — not a red
// notification. Every data-testid and the exact heading/body copy are preserved
// byte-for-byte for jury-package.spec.ts.
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
    <div className={styles.container} data-testid="jury-package-empty">
      <h2 className={styles.heading}>No jury package started yet</h2>
      <p className={styles.body}>
        A jury package is the authoritative handoff list of admitted exhibits. Viewing
        this screen does not start one — a deputy, clerk, or administrator must
        explicitly initiate it.
      </p>

      {noEligible && (
        <p className={styles.noEligible} data-testid="jury-no-eligible">
          No admitted exhibits yet — there is nothing to package until at least one
          exhibit is admitted.
        </p>
      )}

      {canInitiate ? (
        <div className={styles.action}>
          <Button
            kind="primary"
            type="button"
            data-testid="jury-initiate"
            onClick={onInitiate}
            disabled={pending}
          >
            {pending ? 'Initiating…' : 'Initiate jury package'}
          </Button>
        </div>
      ) : (
        <p className={styles.restricted} data-testid="jury-initiate-restricted">
          A deputy, clerk, or administrator must initiate the jury package.
        </p>
      )}

      {hardError && (
        <div className={styles.hardError}>
          <InlineNotification
            kind="error"
            lowContrast
            role="alert"
            hideCloseButton
            title="Unable to initiate the jury package — please retry."
            subtitle=""
          />
        </div>
      )}
    </div>
  );
}
