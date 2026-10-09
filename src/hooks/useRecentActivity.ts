'use client';

import { useQuery } from '@tanstack/react-query';
import type { ExhibitStatus } from '@prisma/client';
import { apiFetch } from '@/lib/apiClient';
import { useRoleStore } from '@/stores/roleStore';
import type { RecentActivityEntry } from '@/services/activity';

// The full Command Center activity response (08-10): the route now returns BOTH
// the recent-activity feed AND the per-status exhibit counts (F08 §Process step
// 2 — stat cards + status-distribution bar). A single query backs the feed, the
// freshness indicator, the stat cards, and the distribution bar, so the whole
// screen shares ONE 4s poll rather than fanning out duplicate activity fetches.
export interface ActivityResponse {
  recentActivity: RecentActivityEntry[];
  statusCounts: Record<ExhibitStatus, number>;
}

// F8 Command Center — Recent Activity feed + status counts. One of THREE
// independent live-sync queries (each its own hook / own useQuery instance) so
// one panel erroring or refetching never blocks the others. Copies the
// useExhibitList pattern exactly: role is in the query key so a role switch
// forces an immediate fresh, server-enforced query rather than reusing a cached
// response that could contain sealed rows the new role shouldn't see (threat
// T-05-06). apiFetch attaches X-User-Role. No `since` param — the server default
// (latest-trial-day window) is exactly what the Command Center wants.
export function useRecentActivity() {
  const caseId = useRoleStore((s) => s.caseId);
  const role = useRoleStore((s) => s.role);

  return useQuery<ActivityResponse>({
    queryKey: ['activity', caseId, role],
    queryFn: async () => {
      if (!caseId) {
        return {
          recentActivity: [],
          statusCounts: {} as Record<ExhibitStatus, number>,
        };
      }
      const res = await apiFetch(`/api/cases/${caseId}/activity`);
      if (!res.ok) {
        throw new Error(`Failed to load activity: ${res.status}`);
      }
      return res.json();
    },
    enabled: Boolean(caseId),
    refetchInterval: 4_000,
    // Live-sync panel: surface a failed poll's error promptly (own error state);
    // the 4s interval re-attempts naturally. See useDiscrepancies for rationale.
    retry: false,
  });
}
