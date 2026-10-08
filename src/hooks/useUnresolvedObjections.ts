'use client';

import { useQuery } from '@tanstack/react-query';
import type { ObjectionCurrentState } from '@prisma/client';
import { apiFetch } from '@/lib/apiClient';
import { useRoleStore } from '@/stores/roleStore';

// F8 Command Center — Unresolved Objections panel. One of THREE independent
// live-sync queries (its own hook / own useQuery instance). role is in the query
// key so a role switch forces an immediate fresh, server-enforced query (threat
// T-05-06); apiFetch attaches X-User-Role.
//
// Sealed-objection safety: the existing /objections ROUTE currently calls
// getUnresolvedObjections(caseId) with no role, so it is viewer-independent. 05-01
// made the service's role param OPTIONAL; wiring the route to pass the parsed role
// (making this panel sealed-safe) is a 05-03 concern — this hook only fetches and
// role-keys.
export function useUnresolvedObjections() {
  const caseId = useRoleStore((s) => s.caseId);
  const role = useRoleStore((s) => s.role);

  return useQuery<ObjectionCurrentState[]>({
    queryKey: ['objections', caseId, role],
    queryFn: async () => {
      if (!caseId) return [];
      const res = await apiFetch(`/api/cases/${caseId}/objections?status=unresolved`);
      if (!res.ok) {
        throw new Error(`Failed to load objections: ${res.status}`);
      }
      return res.json();
    },
    enabled: Boolean(caseId),
    refetchInterval: 4_000,
    // Live-sync panel: surface a failed poll's error promptly (own error state);
    // the 4s interval re-attempts naturally. See useDiscrepancies for rationale.
    retry: false,
  });
}
