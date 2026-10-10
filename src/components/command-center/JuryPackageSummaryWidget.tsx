'use client';

import { Tile, Button, SkeletonText } from '@carbon/react';
import { useRouter } from 'next/navigation';
import { useJuryPackage } from '@/hooks/useJuryPackage';
import { SeverityPill } from '@/components/shared/SeverityPill';
import { TwoColorProgressBar } from '@/components/shared/TwoColorProgressBar';
import styles from './JuryPackageSummaryWidget.module.scss';

// F8 Command Center — Jury Package summary widget (UX Screen-00 §Process step 4,
// right column). This widget is LINK-THROUGH ONLY — it is NOT one of the two
// inline write actions; like every other ambient panel it stays read-only, with
// a single navigation affordance to the Jury Package Workspace.
//
// Cross-screen parity BY CONSTRUCTION: it reuses the EXISTING useJuryPackage()
// query (no new fetch) AND computes clean/total with the IDENTICAL expression the
// Jury Package Workspace's own header bar uses —
//   clean = exhibits where !isSealed && flags.length === 0
//   total = exhibits.length
// — rendered through the SAME shared TwoColorProgressBar. The two surfaces can
// therefore never display a different ratio for the same live state (a plan
// must-have). Note: an acknowledged-but-flagged row is NOT clean on either
// surface (its flags array is non-empty), so both agree there too.
export function JuryPackageSummaryWidget() {
  const { data, isLoading } = useJuryPackage();
  const router = useRouter();

  if (isLoading) {
    return (
      <Tile data-testid="command-center-jury-package-widget" aria-label="Jury package">
        <h2 className={styles.heading}>Jury package</h2>
        <div aria-hidden="true">
          <SkeletonText paragraph lineCount={2} width="100%" />
        </div>
      </Tile>
    );
  }

  if (!data?.juryPackage) {
    return (
      <Tile data-testid="command-center-jury-package-widget" aria-label="Jury package">
        <h2 className={styles.heading}>Jury package</h2>
        <p className={styles.empty}>No package started yet.</p>
      </Tile>
    );
  }

  const exhibits = data.exhibits;
  const total = exhibits.length;
  // IDENTICAL to JuryPackageDraft's cleanRows computation — the parity guarantee.
  const clean = exhibits.filter((e) => !e.isSealed && e.flags.length === 0).length;
  const blocked = total - clean;

  const finalized = data.juryPackage.status === 'FINALIZED';
  const statusLabel = finalized
    ? 'Finalized'
    : blocked > 0
      ? 'Not ready to finalize'
      : 'Ready to finalize';

  return (
    <Tile data-testid="command-center-jury-package-widget" aria-label="Jury package">
      <h2 className={styles.heading}>Jury package</h2>
      {blocked > 0 && !finalized ? (
        <SeverityPill tone="high" label={statusLabel} ariaLabel={`Status: ${statusLabel}`} />
      ) : (
        <p className={styles.status} data-testid="jury-widget-status">
          {statusLabel}
        </p>
      )}
      <TwoColorProgressBar clean={clean} total={total} />
      <Button
        kind="primary"
        data-testid="open-jury-package-button"
        onClick={() => router.push('/jury-package')}
      >
        Open jury package →
      </Button>
    </Tile>
  );
}
