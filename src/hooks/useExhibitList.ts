'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiClient';
import { useRoleStore } from '@/stores/roleStore';
import type { ExhibitListRow } from '@/lib/types';

export interface ExhibitFilters {
  keyword?: string;
  status?: string;
  witness?: string;
  dateFrom?: string;
  dateTo?: string;
}

function hasAnyCriterion(filters: ExhibitFilters): boolean {
  return Boolean(
    filters.keyword || filters.status || filters.witness || filters.dateFrom || filters.dateTo,
  );
}

export function useExhibitList(filters: ExhibitFilters) {
  const caseId = useRoleStore((s) => s.caseId);
  // Included in the query key so switching role re-fetches immediately rather
  // than waiting for the next poll tick (threat T-02-15: a role switch must
  // never reuse a cached response that could contain sealed rows the new role
  // shouldn't see).
  const role = useRoleStore((s) => s.role);
  const searching = hasAnyCriterion(filters);

  return useQuery<ExhibitListRow[]>({
    queryKey: ['exhibits', caseId, role, searching ? filters : 'all'],
    queryFn: async () => {
      if (!caseId) return [];
      const path = searching
        ? `/api/cases/${caseId}/exhibits/search?${new URLSearchParams(
            Object.entries(filters).filter(([, v]) => Boolean(v)) as [string, string][],
          ).toString()}`
        : `/api/cases/${caseId}/exhibits`;
      const res = await apiFetch(path);
      if (!res.ok) {
        throw new Error(`Failed to load exhibits: ${res.status}`);
      }
      return res.json();
    },
    enabled: Boolean(caseId),
    // Live-sync polling (Y0-patterns.md "Polling-Based Live Sync Indicator",
    // 3-5s). react-query's default behavior already updates in place without
    // unmounting the previous data while refetching, satisfying "no full
    // re-render/flicker" as long as the table keys rows by exhibitId (Task 2).
    refetchInterval: 4_000,
  });
}
