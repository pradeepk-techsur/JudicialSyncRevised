'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiClient';
import { useRoleStore } from '@/stores/roleStore';
import type { JuryPackageReadinessPreview } from '@/services/juryPackage';

// F25 — Jury Package Readiness Preview live-sync hook. Mirrors useAttentionFeed's
// exact shape: role + caseId in the query key (so a role switch forces a fresh
// server-enforced query rather than reusing a cached response that could carry a
// sealed row the new role shouldn't see — anti-enumeration, T-09-14); apiFetch
// attaches X-User-Role; `refetchInterval: 4_000` is the standard live-sync cadence
// (F25 §Process step 7) so a ruling/custody transfer recorded elsewhere updates
// the ready/blocked breakdown without manual refresh; `retry: false` so a failed
// poll surfaces promptly and the 4s interval re-attempts naturally.
//
// There is no role gate on GET /api/cases/:id/jury-package/preview — every role
// receives a 200 for a valid case (F25 §Validation). This is deliberately a
// read-only hook: the panel it feeds has zero write affordances.
export function useJuryPackagePreview() {
  const caseId = useRoleStore((s) => s.caseId);
  const role = useRoleStore((s) => s.role);
  return useQuery<JuryPackageReadinessPreview>({
    queryKey: ['jury-package-preview', caseId, role],
    queryFn: async () => {
      if (!caseId) {
        return { preview: [], summary: { totalAdmitted: 0, readyCount: 0, blockedCount: 0 } };
      }
      const res = await apiFetch(`/api/cases/${caseId}/jury-package/preview`);
      if (!res.ok) throw new Error(`Failed to load jury package preview: ${res.status}`);
      return res.json();
    },
    enabled: Boolean(caseId),
    refetchInterval: 4_000,
    retry: false,
  });
}
