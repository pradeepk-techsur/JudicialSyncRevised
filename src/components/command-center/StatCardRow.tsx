'use client';

import { ClickableTile } from '@carbon/react';
import { useRouter } from 'next/navigation';
import styles from './StatCardRow.module.scss';

// F8 Command Center — the 4-stat-card row (UX Screen-00 §Stat Card Row). Phase 9
// (09-01, T-01): each card is rebuilt as a compact, CLICKABLE tile (<=80px tall)
// linking to its filtered view — the original tall stacked Card row pushed the
// attention list below the fold, and none of the cards was clickable.
//
// Layout: Carbon ClickableTile with the number and label SIDE BY SIDE (not
// stacked) at a reduced type scale + tighter padding to hold the 80px ceiling.
// Every value is still sourced in page.tsx EXACTLY per F08's stat-card sourcing
// table and passed down — this component derives nothing, so the counts can never
// drift from their authoritative hooks. The destinations are static per tile
// (not data-driven), so this component builds its own hrefs internally.
//
// The one card that gets the critical/red-outline treatment is "Jury package
// blockers", and ONLY when its count is > 0 (Screenshot 1). ClickableTile has no
// `critical` prop, so the shared `.critical` CSS Module class is applied
// conditionally via className.
//
// Navigation uses useRouter().push inside onClick (Next.js App Router):
// ClickableTile does not take a Next `<Link>` `as` prop the way SideNavLink does,
// mirroring the existing router.push pattern in AttentionFeedPanel.tsx.

export interface StatCardRowProps {
  /** Count of case-wide UNRESOLVED objections. */
  openObjections: number;
  /** Count of OPEN ADMITTED_NO_CUSTODIAN discrepancies. */
  custodyGaps: number;
  /** Jury-package blockers (FLAGGED rows + any sealed/CRITICAL row). */
  juryBlockers: number;
  /** Exhibits currently ADMITTED. */
  admittedCount: number;
  /** Total exhibits that have reached any status (the statusCounts sum). */
  totalVisible: number;
  /** Exhibits currently EXCLUDED (sub-caption). */
  excludedCount: number;
  /** Exhibits currently WITHDRAWN (sub-caption). */
  withdrawnCount: number;
}

export function StatCardRow({
  openObjections,
  custodyGaps,
  juryBlockers,
  admittedCount,
  totalVisible,
  excludedCount,
  withdrawnCount,
}: StatCardRowProps) {
  const router = useRouter();

  // Admitted sub-caption, compacted onto one thin line; also used as a native
  // tooltip so the tile stays within 80px without losing the information.
  const subCaptionParts: string[] = [];
  if (excludedCount > 0) subCaptionParts.push(`${excludedCount} excluded`);
  if (withdrawnCount > 0) subCaptionParts.push(`${withdrawnCount} withdrawn`);
  const subCaption = subCaptionParts.join(' · ');

  return (
    <div className={styles.row} data-testid="stat-card-row">
      <ClickableTile
        className={styles.tile}
        href="/command-center#objections"
        onClick={(e) => {
          e.preventDefault();
          router.push('/command-center#objections');
        }}
      >
        <span className={styles.value}>{openObjections}</span>
        <span className={styles.label}>Open objections</span>
      </ClickableTile>

      <ClickableTile
        className={styles.tile}
        href="/case?filter=no-custodian"
        onClick={(e) => {
          e.preventDefault();
          router.push('/case?filter=no-custodian');
        }}
      >
        <span className={styles.value}>{custodyGaps}</span>
        <span className={styles.label}>Custody gaps</span>
      </ClickableTile>

      <ClickableTile
        className={juryBlockers > 0 ? `${styles.tile} ${styles.critical}` : styles.tile}
        data-testid="stat-card-jury-blockers"
        data-critical={juryBlockers > 0 ? 'true' : 'false'}
        href="/jury-package"
        onClick={(e) => {
          e.preventDefault();
          router.push('/jury-package');
        }}
      >
        <span className={styles.value}>{juryBlockers}</span>
        <span className={styles.label}>Jury package blockers</span>
      </ClickableTile>

      <ClickableTile
        className={styles.tile}
        href="/case?status=ADMITTED"
        onClick={(e) => {
          e.preventDefault();
          router.push('/case?status=ADMITTED');
        }}
      >
        <span className={styles.value}>
          {admittedCount} of {totalVisible}
        </span>
        <span className={styles.label} title={subCaption || undefined}>
          Admitted{subCaption ? ` · ${subCaption}` : ''}
        </span>
      </ClickableTile>
    </div>
  );
}
