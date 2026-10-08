'use client';

import { useRecentActivity } from '@/hooks/useRecentActivity';
import { RecentActivityPanel } from '@/components/command-center/RecentActivityPanel';
import { ObjectionsPanel } from '@/components/command-center/ObjectionsPanel';
import { DiscrepanciesPanel } from '@/components/command-center/DiscrepanciesPanel';
import { FreshnessIndicator } from '@/components/command-center/FreshnessIndicator';

// F8 — Trial Command Center (UX Screen-00): the ambient, zero-config, strictly
// read-only glance screen and the default landing. Composes the full-width Recent
// Activity feed over a two-column Objections/Discrepancies row, with the freshness
// indicator top-right. It renders NO write controls — only read-only panels and
// the inherited app-shell chrome (the global "Ask ✦" button is Phase 4's; this
// screen does not add one).
export default function CommandCenterPage() {
  // Recent Activity is the freshness anchor (the ambient pulse). The indicator
  // reflects THIS query's last successful fetch; the other two panels poll
  // independently on their own 4s cadence. The page owns the single
  // useRecentActivity instance and passes it into the panel, so the feed and the
  // freshness indicator share ONE query (no duplicate activity fetch).
  const activity = useRecentActivity();

  return (
    <div data-testid="command-center">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Trial Command Center</h1>
        <FreshnessIndicator
          dataUpdatedAt={activity.dataUpdatedAt}
          isFetching={activity.isFetching}
        />
      </div>
      <RecentActivityPanel query={activity} />
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <ObjectionsPanel />
        <DiscrepanciesPanel />
      </div>
    </div>
  );
}
