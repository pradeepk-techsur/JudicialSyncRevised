'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiClient';
import { parseError } from '@/hooks/juryPackageError';
import { useRoleStore } from '@/stores/roleStore';

// useMutation wrapper over POST /api/objections/:id/ruling — mirrors
// useJuryPackage's finalize mutation shape exactly (apiFetch, error via the
// shared parseError/JuryPackageError channel, invalidate-on-success only, NO
// optimistic client-derived state). recordRuling's JUDGE-only gate has existed
// server-side since Phase 1 (01-04); this hook adds the client surface over it.
export function useRecordRuling() {
  const activeUserId = useRoleStore((s) => s.activeUserId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: {
      objectionId: string;
      disposition: 'SUSTAINED' | 'OVERRULED' | 'RESERVED';
    }) => {
      const res = await apiFetch(`/api/objections/${args.objectionId}/ruling`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disposition: args.disposition, actorUserId: activeUserId }),
      });
      if (!res.ok) throw await parseError(res);
      return res.json();
    },
    onSuccess: () => {
      // Scoped refetch of every query a ruling could affect — attention feed,
      // Exhibit Detail history, Command Center objections panel. No optimistic
      // entry removal (Y0-patterns §Attention Feed Inline Action: wait for the
      // next poll tick, re-render from live server state).
      queryClient.invalidateQueries({ queryKey: ['attention-feed'] });
      queryClient.invalidateQueries({ queryKey: ['exhibit-history'] });
      queryClient.invalidateQueries({ queryKey: ['objections'] });
      queryClient.invalidateQueries({ queryKey: ['discrepancy-count'] });
      queryClient.invalidateQueries({ queryKey: ['jury-package'] });
    },
  });
}
