'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiClient';
import { useRoleStore } from '@/stores/roleStore';
import { JuryPackageError, parseError } from '@/hooks/juryPackageError';

// Standalone acknowledge-discrepancy mutation (F6). Deliberately mounts NO query:
// a consumer that only needs to acknowledge a flag (e.g. the Exhibit Detail
// DiscrepancyBanner) must not drag in the jury-package 4s poll — that poll hits
// /api/cases/:id/jury-package, which runs a DRAFT reconcile that MAY write, so
// polling it from an unrelated screen is a wasteful background write (W3).
//
// On success it invalidates the same three query families useJuryPackage does,
// so whichever of those is mounted elsewhere re-reads live server state.
export function useAcknowledgeDiscrepancy() {
  const activeUserId = useRoleStore((s) => s.activeUserId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: { flagId: string; justification: string }) => {
      const res = await apiFetch(`/api/discrepancies/${args.flagId}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actorUserId: activeUserId,
          justification: args.justification,
        }),
      });
      if (!res.ok) {
        throw await parseError(res);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jury-package'] });
      queryClient.invalidateQueries({ queryKey: ['discrepancy-count'] });
      queryClient.invalidateQueries({ queryKey: ['exhibit-history'] });
    },
  });
}

export { JuryPackageError };
