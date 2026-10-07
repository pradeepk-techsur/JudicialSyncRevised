'use client';

import { useQuery } from '@tanstack/react-query';
import type { DiscrepancyFlag } from '@prisma/client';
import { apiFetch } from '@/lib/apiClient';
import { useRoleStore } from '@/stores/roleStore';

// F8 Command Center — Discrepancies panel. One of THREE independent live-sync
// queries (its own hook / own useQuery instance). Over Phase 3's
// GET /api/cases/:id/discrepancies, which returns ALL case-wide active
// (OPEN+ACKNOWLEDGED) flags regardless of viewer (it backs the jury sidebar
// count). role is in the query key so a role switch re-fetches immediately (threat
// T-05-06); apiFetch attaches X-User-Role.
//
// The sealed filter (dropping flags whose exhibit the role can't view) is applied
// by 05-03's Discrepancies panel — this hook only fetches and role-keys (threat
// T-05-07). DiscrepancyFlag + the /discrepancies route are Phase 3 artifacts: this
// hook is an intended HARD dependency on Phase 3 being merged (CONTEXT: build
// against the real contract, do NOT stub).
export function useDiscrepancies() {
  const caseId = useRoleStore((s) => s.caseId);
  const role = useRoleStore((s) => s.role);

  return useQuery<DiscrepancyFlag[]>({
    queryKey: ['discrepancies', caseId, role],
    queryFn: async () => {
      if (!caseId) return [];
      const res = await apiFetch(`/api/cases/${caseId}/discrepancies`);
      if (!res.ok) {
        throw new Error(`Failed to load discrepancies: ${res.status}`);
      }
      return res.json();
    },
    enabled: Boolean(caseId),
    refetchInterval: 4_000,
  });
}
