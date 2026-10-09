'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { JuryPackage } from '@prisma/client';
import { apiFetch } from '@/lib/apiClient';
import { useRoleStore } from '@/stores/roleStore';
import type { JuryPackageExhibitView } from '@/services/juryPackage';
import { JuryPackageError, parseError, type BlockingExhibit } from '@/hooks/juryPackageError';
import { useAcknowledgeDiscrepancy } from '@/hooks/useAcknowledgeDiscrepancy';

export type { JuryPackageExhibitView } from '@/services/juryPackage';
// Re-export so existing consumers that import these from this hook keep working.
export { JuryPackageError, type BlockingExhibit };

// Serialized JuryPackage as it crosses the wire (NextResponse.json turns the
// Date fields into ISO strings). We keep the Prisma JuryPackage shape but relax
// the date fields to the string | null they actually arrive as.
export interface JuryPackageDto extends Omit<JuryPackage, 'createdAt' | 'finalizedAt'> {
  createdAt: string;
  finalizedAt: string | null;
}

export interface JuryPackageResponse {
  juryPackage: JuryPackageDto | null;
  exhibits: JuryPackageExhibitView[];
}

// THE single query + mutation path for the Jury Package Workspace (F11). Follows
// the established one-hook pattern (useExhibitList / useExhibitHistory): apiFetch,
// role in the query key, 4s polling. The screen computes NOTHING — every
// eligibility/discrepancy decision is server truth re-read live. Mutations never
// hold optimistic client-derived state; on success they invalidate so the UI
// re-renders from the refetched server response.
export function useJuryPackage() {
  const caseId = useRoleStore((s) => s.caseId);
  const role = useRoleStore((s) => s.role);
  const activeUserId = useRoleStore((s) => s.activeUserId);
  const queryClient = useQueryClient();

  const queryKey = ['jury-package', caseId, role];

  const query = useQuery<JuryPackageResponse>({
    queryKey,
    queryFn: async () => {
      if (!caseId) return { juryPackage: null, exhibits: [] };
      const res = await apiFetch(`/api/cases/${caseId}/jury-package`);
      if (!res.ok) {
        throw await parseError(res);
      }
      return res.json();
    },
    enabled: Boolean(caseId),
    // Live-sync polling, but STOP once finalized (CONTEXT "polling stops"): a
    // finalized package is an immutable artifact — nothing left to re-read.
    refetchInterval: (q) =>
      q.state.data?.juryPackage?.status === 'FINALIZED' ? false : 4_000,
  });

  // Invalidate both the jury-package view AND the ambient discrepancy count so a
  // mutation that clears/opens a flag updates the sidebar badge too.
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['jury-package'] });
    queryClient.invalidateQueries({ queryKey: ['discrepancy-count'] });
    queryClient.invalidateQueries({ queryKey: ['exhibit-history'] });
  };

  const initiate = useMutation({
    mutationFn: async () => {
      if (!caseId) throw new JuryPackageError('NO_CASE', 'No active case', 400);
      const res = await apiFetch(`/api/cases/${caseId}/jury-package`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorUserId: activeUserId }),
      });
      if (!res.ok) {
        throw await parseError(res);
      }
      return (await res.json()) as JuryPackageResponse;
    },
    onSuccess: invalidateAll,
  });

  const finalize = useMutation({
    mutationFn: async (juryPackageId: string) => {
      const res = await apiFetch(`/api/jury-package/${juryPackageId}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorUserId: activeUserId }),
      });
      if (!res.ok) {
        // Surface the server's fresh-gate 409 (blockingExhibits) to the caller —
        // do NOT swallow it; the Draft view renders the inline banner from it.
        throw await parseError(res);
      }
      return (await res.json()) as { juryPackage: JuryPackageDto };
    },
    // Always refetch after finalize (success flips to FINALIZED; a 409 refetches
    // the fresh gate so re-flagged rows re-disable the button).
    onSettled: invalidateAll,
  });

  // F13: explicitly remove a CRITICAL (sealed/ex-parte) row from the package.
  // Mirrors the finalize mutation's shape exactly: POST to the exclude route with
  // the active user's id (whose ACTUAL role the server authorizes), surface the
  // server error on failure, invalidate on success so the row disappears.
  const exclude = useMutation({
    mutationFn: async (args: {
      juryPackageId: string;
      exhibitId: string;
      reason: 'SEALED_EXPARTE' | 'MANUAL_REMOVAL';
    }) => {
      const res = await apiFetch(
        `/api/jury-package/${args.juryPackageId}/exhibits/${args.exhibitId}/exclude`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ actorUserId: activeUserId, reason: args.reason }),
        },
      );
      if (!res.ok) {
        throw await parseError(res);
      }
      return res.json();
    },
    onSuccess: invalidateAll,
  });

  // Reuse the standalone acknowledge mutation (same invalidation set) so the
  // jury screen and the Exhibit Detail banner share one acknowledge path.
  const acknowledge = useAcknowledgeDiscrepancy();

  return { ...query, initiate, finalize, exclude, acknowledge };
}
