'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiClient';
import { useRoleStore } from '@/stores/roleStore';
import type { ExhibitHistoryResponse } from '@/services/history';

export class NotFoundError extends Error {}

export function useExhibitHistory(exhibitId: string) {
  const role = useRoleStore((s) => s.role); // in the query key: switching role must re-fetch (sealed exhibit should flip to not-found immediately, not wait for the next poll)

  return useQuery<ExhibitHistoryResponse>({
    queryKey: ['exhibit-history', exhibitId, role],
    queryFn: async () => {
      const res = await apiFetch(`/api/exhibits/${exhibitId}/history`);
      if (res.status === 404) {
        throw new NotFoundError('Exhibit not found');
      }
      if (!res.ok) {
        throw new Error(`Failed to load exhibit history: ${res.status}`);
      }
      return res.json();
    },
    retry: (failureCount, error) => !(error instanceof NotFoundError) && failureCount < 2,
    // Live-sync polling (Y0-patterns.md) — a custody transfer or new timeline
    // entry recorded elsewhere must appear without manual refresh.
    refetchInterval: 4_000,
  });
}
