'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiClient';
import { useRoleStore } from '@/stores/roleStore';
import type { CustodyByCustodianResult } from '@/services/custodyByCustodian';

// F8 Command Center — "Custody at a Glance" live-sync query (08-06's
// GET /api/cases/:id/custody-by-custodian). Follows the established
// useRecentActivity / useDiscrepancies hook pattern EXACTLY: role + caseId in
// the query key so a role switch forces an immediate fresh, server-enforced
// query (sealed exhibits never leak across a role boundary, threat T-05-06);
// apiFetch attaches X-User-Role; 4s refetchInterval; retry:false so a failed
// poll surfaces its own error promptly and the interval re-attempts naturally.
export function useCustodyByCustodian() {
  const caseId = useRoleStore((s) => s.caseId);
  const role = useRoleStore((s) => s.role);

  return useQuery<CustodyByCustodianResult>({
    queryKey: ['custody-by-custodian', caseId, role],
    queryFn: async () => {
      if (!caseId) return { groups: [], noCustodian: [] };
      const res = await apiFetch(`/api/cases/${caseId}/custody-by-custodian`);
      if (!res.ok) {
        throw new Error(`Failed to load custody-by-custodian: ${res.status}`);
      }
      return res.json();
    },
    enabled: Boolean(caseId),
    refetchInterval: 4_000,
    retry: false,
  });
}
