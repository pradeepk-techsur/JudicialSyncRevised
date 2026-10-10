'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiClient';
import { parseError } from '@/hooks/juryPackageError';
import { useRoleStore } from '@/stores/roleStore';

// useMutation wrapper over POST /api/exhibits/:id/events/custody — mirrors
// useRecordRuling's shape exactly, POSTing to the single legacy custody endpoint
// (locked decision 08-CONTEXT: single-phase only, no propose/confirm/cancel).
// Used identically for first-time assignment (fromCustodianUserId: null) AND for
// transferring an exhibit that already has a custodian — only fromCustodianUserId
// differs; recordCustodyTransfer branches on it internally (F03), and its new
// DEPUTY/CLERK/ADMIN role gate (08-02) is the authoritative check.
export function useTransferCustody() {
  const activeUserId = useRoleStore((s) => s.activeUserId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: {
      exhibitId: string;
      fromCustodianUserId: string | null;
      toCustodianUserId: string;
      reason?: string;
    }) => {
      const res = await apiFetch(`/api/exhibits/${args.exhibitId}/events/custody`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...args, actorUserId: activeUserId }),
      });
      if (!res.ok) throw await parseError(res);
      return res.json();
    },
    onSuccess: () => {
      // Scoped refetch of every query a custody transfer could affect — no
      // optimistic state; the originating card re-renders from live server
      // state on the next poll tick.
      queryClient.invalidateQueries({ queryKey: ['attention-feed'] });
      queryClient.invalidateQueries({ queryKey: ['custody-by-custodian'] });
      queryClient.invalidateQueries({ queryKey: ['exhibit-history'] });
      queryClient.invalidateQueries({ queryKey: ['discrepancy-count'] });
      queryClient.invalidateQueries({ queryKey: ['jury-package'] });
    },
  });
}
