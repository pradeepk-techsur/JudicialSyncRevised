'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { JuryPackage } from '@prisma/client';
import { apiFetch } from '@/lib/apiClient';
import { useRoleStore } from '@/stores/roleStore';
import type { JuryPackageExhibitView } from '@/services/juryPackage';

export type { JuryPackageExhibitView } from '@/services/juryPackage';

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

// An entry in the finalize 409's blocking-exhibit list (error.details) surfaced
// by the server so the Draft view can name the blockers inline (ROADMAP crit 3).
export interface BlockingExhibit {
  exhibitId: string;
  exhibitLabel: string;
  ruleCodes: string[];
}

// A typed error carrying the parsed server error envelope so callers can branch
// on the code (e.g. JURY_PACKAGE_DISCREPANCIES_OPEN) and read details.
export class JuryPackageError extends Error {
  code: string;
  details?: { blockingExhibits?: BlockingExhibit[] };
  status: number;
  constructor(
    code: string,
    message: string,
    status: number,
    details?: { blockingExhibits?: BlockingExhibit[] },
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

async function parseError(res: Response): Promise<JuryPackageError> {
  let body: { error?: { code?: string; message?: string; details?: unknown } } = {};
  try {
    body = await res.json();
  } catch {
    /* non-JSON error body */
  }
  const code = body.error?.code ?? 'UNKNOWN_ERROR';
  const message = body.error?.message ?? `Request failed (${res.status})`;
  const details = body.error?.details as { blockingExhibits?: BlockingExhibit[] } | undefined;
  return new JuryPackageError(code, message, res.status, details);
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

  const acknowledge = useMutation({
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
    onSuccess: invalidateAll,
  });

  return { ...query, initiate, finalize, acknowledge };
}
