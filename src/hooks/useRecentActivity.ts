'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiClient';
import { useRoleStore } from '@/stores/roleStore';
import type { RecentActivityEntry } from '@/services/activity';

// F8 Command Center — Recent Activity feed. One of THREE independent live-sync
// queries (each its own hook / own useQuery instance) so one panel erroring or
// refetching never blocks the others. Copies the useExhibitList pattern exactly:
// role is in the query key so a role switch forces an immediate fresh,
// server-enforced query rather than reusing a cached response that could contain
// sealed rows the new role shouldn't see (threat T-05-06). apiFetch attaches
// X-User-Role. No `since` param — the server default (latest-trial-day window) is
// exactly what the Command Center wants.
export function useRecentActivity() {
  const caseId = useRoleStore((s) => s.caseId);
  const role = useRoleStore((s) => s.role);

  return useQuery<RecentActivityEntry[]>({
    queryKey: ['activity', caseId, role],
    queryFn: async () => {
      if (!caseId) return [];
      const res = await apiFetch(`/api/cases/${caseId}/activity`);
      if (!res.ok) {
        throw new Error(`Failed to load activity: ${res.status}`);
      }
      return res.json();
    },
    enabled: Boolean(caseId),
    refetchInterval: 4_000,
  });
}
