'use client';

import { Tile, SkeletonText } from '@carbon/react';
import { ExhibitTag } from '@/components/shared/ExhibitTag';
import { SeverityPill } from '@/components/shared/SeverityPill';
import { useJuryPackagePreview } from '@/hooks/useJuryPackagePreview';
import type { JuryPackageReadinessRow } from '@/services/juryPackage';
import styles from './JuryPackageReadinessPreview.module.scss';

// F25 — the read-only Jury Package Readiness Preview panel. A full-content-width
// Carbon Tile listing every currently-ADMITTED exhibit visible to the requesting
// role and, for each, whether it is ready for the jury package or — if not —
// which blocker(s) apply.
//
// READ-ONLY FOR EVERY ROLE: there are NO action buttons and NO links to
// remediation here. Per F25 ("there is no preview-with-actions variant") this
// panel is deliberately inert — the existing Draft view already provides the
// remediation actions. It renders IDENTICALLY regardless of role: nothing in this
// component branches on `role`. A JUDGE (who cannot start or finalize a package)
// sees the exact same panel a DEPUTY does; the only difference between roles is
// the server-side sealed-exhibit visibility masking already applied upstream.
//
// It polls every 4s via useJuryPackagePreview (F25 §Process step 7), so a ruling
// or custody transfer recorded elsewhere updates the ready/blocked breakdown with
// no manual refresh. It computes nothing locally — the service is the sole
// authority for readiness; this component only renders what it returns.

// SEALED_EXPARTE → critical (the most urgent tone, matching the CRITICAL-row
// treatment the rest of the product uses for ex parte material); any other
// blocker → medium. We do NOT invent a new pill tone — this maps onto the shared
// 4-tone SeverityPill reasonably (Y0-patterns §Readable Flag Pill).
function toneFor(row: JuryPackageReadinessRow): 'critical' | 'medium' {
  return row.blockers.some((b) => b.code === 'SEALED_EXPARTE') ? 'critical' : 'medium';
}

export function JuryPackageReadinessPreview() {
  const { data, isLoading, isError } = useJuryPackagePreview();

  const summary = data?.summary;
  const rows = data?.preview ?? [];

  return (
    <Tile
      className={styles.panel}
      data-testid="jury-readiness-preview"
      aria-label="Jury package readiness preview"
    >
      <h2 className={styles.heading}>Readiness preview</h2>
      {summary && (
        <p className={styles.subtitle} data-testid="jury-readiness-summary">
          {summary.readyCount} ready, {summary.blockedCount} blocked of{' '}
          {summary.totalAdmitted} admitted
        </p>
      )}
      <p className={styles.caption}>
        A read-only, always-available snapshot of which admitted exhibits are
        ready for the jury package — shown identically to every role.
      </p>

      {isLoading && (
        <div aria-hidden="true">
          <SkeletonText paragraph lineCount={3} width="100%" />
        </div>
      )}

      {isError && (
        <p role="alert" className={styles.error}>
          Unable to load the jury package readiness preview — please retry.
        </p>
      )}

      {!isLoading && !isError && rows.length === 0 && (
        <p className={styles.empty} data-testid="jury-readiness-empty">
          No admitted exhibits yet — nothing to preview until at least one exhibit
          is admitted.
        </p>
      )}

      {rows.map((row) => (
        <div
          key={row.exhibitId}
          className={styles.row}
          data-testid="jury-readiness-row"
          data-exhibit-id={row.exhibitId}
          data-exhibit-label={row.exhibitLabel}
          data-ready={row.ready ? 'true' : 'false'}
        >
          <div className={styles.rowHeader}>
            <ExhibitTag label={row.exhibitLabel} />
            {row.ready ? (
              <span className={styles.ready} data-testid="jury-readiness-ready">
                ✓ Ready
              </span>
            ) : (
              <SeverityPill
                tone={toneFor(row)}
                label="Blocked"
                ariaLabel={`Blocked: ${row.exhibitLabel}`}
              />
            )}
          </div>
          {row.blockers.length > 0 && (
            <ul className={styles.blockers}>
              {row.blockers.map((b) => (
                <li key={b.code} className={styles.blocker} data-blocker-code={b.code}>
                  {b.detail}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </Tile>
  );
}
