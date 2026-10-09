'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiClient';
import { useRoleStore } from '@/stores/roleStore';

// A single active discrepancy flag as returned by GET /api/cases/:id/discrepancies
// (the case-wide OPEN+ACKNOWLEDGED list). Shape mirrors toDiscrepancyFlagDto in
// the route; only the fields the UI needs are typed here.
export interface CaseDiscrepancyFlag {
  id: string;
  caseId: string;
  exhibitId: string;
  ruleCode: string;
  status: 'OPEN' | 'ACKNOWLEDGED';
  detectedAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  resolvedAt: string | null;
  // F14: the acknowledging justification text (read-time join in the backend).
  // Present (string | null) for ACKNOWLEDGED flags, absent for OPEN ones.
  justification?: string | null;
}

// THE shared case-wide discrepancy query (F6/F11). It is the single source the
// sidebar count badge AND the jury/exhibit acknowledge flows read:
//   - `count` → the ambient open-discrepancy count for the sidebar pill.
//   - `flags` → the full rows, so a component holding only a per-row
//     DiscrepancyFlagSummary (ruleCode + status, no id) can resolve the actual
//     DiscrepancyFlag.id needed to POST /api/discrepancies/:id/acknowledge,
//     WITHOUT the server view having to carry flag ids on every jury row.
//
// The badge is role-scoped (sealed exhibits' flags won't be returned for an
// unauthorized role) — acceptable and correct per the plan. Role is in the query
// key so a role switch re-fetches immediately rather than waiting for the poll.
export function useDiscrepancyCount() {
  const caseId = useRoleStore((s) => s.caseId);
  const role = useRoleStore((s) => s.role);

  const query = useQuery<CaseDiscrepancyFlag[]>({
    queryKey: ['discrepancy-count', caseId, role],
    queryFn: async () => {
      if (!caseId) return [];
      const res = await apiFetch(`/api/cases/${caseId}/discrepancies`);
      if (!res.ok) {
        throw new Error(`Failed to load discrepancies: ${res.status}`);
      }
      return res.json();
    },
    enabled: Boolean(caseId),
    // Live-sync polling so the ambient count badge stays fresh (Y0-patterns 4s).
    refetchInterval: 4_000,
  });

  const flags = query.data ?? [];
  const openCount = flags.filter((f) => f.status === 'OPEN').length;

  return { ...query, flags, openCount };
}

// Resolve the concrete DiscrepancyFlag.id for an (exhibitId, ruleCode) pair from
// the case-wide flag list. Prefers an OPEN flag (the acknowledge target); falls
// back to any matching flag. Returns null when none matches (already resolved).
export function resolveFlagId(
  flags: CaseDiscrepancyFlag[],
  exhibitId: string,
  ruleCode: string,
): string | null {
  const matches = flags.filter((f) => f.exhibitId === exhibitId && f.ruleCode === ruleCode);
  const open = matches.find((f) => f.status === 'OPEN');
  return (open ?? matches[0])?.id ?? null;
}
