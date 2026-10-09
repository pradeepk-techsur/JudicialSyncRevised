'use client';

import { useRecentActivity } from '@/hooks/useRecentActivity';
import { useUnresolvedObjections } from '@/hooks/useUnresolvedObjections';
import { useDiscrepancies } from '@/hooks/useDiscrepancies';
import { useJuryPackage } from '@/hooks/useJuryPackage';
import { useRoleStore } from '@/stores/roleStore';
import { RecentActivityPanel } from '@/components/command-center/RecentActivityPanel';
import { ObjectionsPanel } from '@/components/command-center/ObjectionsPanel';
import { DiscrepanciesPanel } from '@/components/command-center/DiscrepanciesPanel';
import { CustodyAtAGlancePanel } from '@/components/command-center/CustodyAtAGlancePanel';
import { StatCardRow } from '@/components/command-center/StatCardRow';
import { StatusDistributionBar } from '@/components/command-center/StatusDistributionBar';
import { FreshnessIndicator } from '@/components/command-center/FreshnessIndicator';
import { RULE_CODES } from '@/services/discrepancies';
import type { ExhibitStatus } from '@prisma/client';
import styles from './page.module.scss';

// A fully zero-filled status map for the first render before the activity query
// resolves — keeps StatusDistributionBar's prop a complete Record (no undefined
// keys), matching getStatusCounts' own zero-filled contract.
const EMPTY_STATUS_COUNTS: Record<ExhibitStatus, number> = {
  MARKED: 0,
  OFFERED: 0,
  OBJECTED: 0,
  ADMITTED: 0,
  EXCLUDED: 0,
  WITHDRAWN: 0,
};

// F8 — Trial Command Center (UX Screen-00): the ambient, zero-config glance
// screen and the default landing. 08-10 redesigns it to the reference-screenshot
// layout: a page-local header (title + subtitle + live-status dot + freshness),
// the 4 stat cards, the proportional status-distribution bar, the (read-only)
// Objections/Discrepancies panels, and the Custody-at-a-Glance panel (whose one
// inline Transfer/Assign action is this screen's first-ever write affordance,
// role-gated to DEPUTY/CLERK/ADMIN). The "Needs your attention" feed and Jury
// Package summary widget are deliberately OUT of scope here — 08-15 (wave 4)
// inserts them into this layout.
export default function CommandCenterPage() {
  // Recent Activity is the freshness anchor (the ambient pulse) AND now carries
  // statusCounts for the stat cards + distribution bar — ONE query backs the
  // feed, the indicator, the cards, and the bar. The other panels poll
  // independently on their own 4s cadence.
  const activity = useRecentActivity();
  const objections = useUnresolvedObjections();
  const discrepancies = useDiscrepancies();
  const juryPackage = useJuryPackage();
  const caseNumber = useRoleStore((s) => s.caseNumber);

  // --- Stat-card sourcing (EXACTLY per F08's sourcing table) ---------------
  // Open objections: the count of case-wide UNRESOLVED objection threads.
  const openObjections = objections.data?.length ?? 0;
  // Custody gaps: OPEN ADMITTED_NO_CUSTODIAN discrepancies.
  const custodyGaps =
    discrepancies.data?.filter(
      (d) => d.ruleCode === RULE_CODES.ADMITTED_NO_CUSTODIAN && d.status === 'OPEN',
    ).length ?? 0;
  // Jury package blockers: every FLAGGED jury-package row PLUS any sealed
  // (CRITICAL / ex-parte) row. The view already excludes EXCLUDED rows, so a
  // FLAGGED-or-sealed INCLUDED row is a genuine blocker.
  const juryBlockers =
    juryPackage.data?.exhibits.filter((e) => e.discrepancyStatus === 'FLAGGED' || e.isSealed)
      .length ?? 0;

  // Admitted X of Y (+ excluded/withdrawn sub-caption) from statusCounts.
  const statusCounts = activity.data?.statusCounts;
  const admittedCount = statusCounts?.ADMITTED ?? 0;
  const excludedCount = statusCounts?.EXCLUDED ?? 0;
  const withdrawnCount = statusCounts?.WITHDRAWN ?? 0;
  const totalVisible = statusCounts
    ? Object.values(statusCounts).reduce((sum, n) => sum + n, 0)
    : 0;

  // Page-local header subtitle. The shared roleStore hydrates caseNumber (not
  // the case title) client-side; widening the case-bootstrap endpoint to carry
  // the title is out of this task's minimal scope, so we fall back to the case
  // number (Day 1 + today's date) per the reference screenshot's structure.
  const todayLabel = new Date().toLocaleDateString([], {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const subtitle = caseNumber ? `${caseNumber} · Day 1 · ${todayLabel}` : 'Loading case…';

  return (
    <div data-testid="command-center">
      <div className={styles.screenHeader}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>Trial Command Center</h1>
          <p className={styles.subtitle} data-testid="command-center-subtitle">
            {subtitle}
          </p>
        </div>
        <div className={styles.headerStatus}>
          <span className={styles.liveDot} data-testid="live-status-dot" aria-hidden="true" />
          <FreshnessIndicator
            dataUpdatedAt={activity.dataUpdatedAt}
            isFetching={activity.isFetching}
          />
        </div>
      </div>

      <StatCardRow
        openObjections={openObjections}
        custodyGaps={custodyGaps}
        juryBlockers={juryBlockers}
        admittedCount={admittedCount}
        totalVisible={totalVisible}
        excludedCount={excludedCount}
        withdrawnCount={withdrawnCount}
      />

      <StatusDistributionBar statusCounts={statusCounts ?? EMPTY_STATUS_COUNTS} />

      <RecentActivityPanel query={activity} />

      <div className={styles.lowerRow}>
        <ObjectionsPanel />
        <DiscrepanciesPanel />
      </div>

      {/* The right-hand column of Screenshot 1 is a two-up: the Jury Package
          summary widget (08-15, wave 4) + Custody at a Glance. This plan lands
          the custody panel; 08-15 fills the jury-widget slot alongside it. */}
      <div className={styles.lowerRow}>
        <CustodyAtAGlancePanel />
      </div>
    </div>
  );
}
