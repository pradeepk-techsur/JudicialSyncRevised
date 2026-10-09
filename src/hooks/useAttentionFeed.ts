'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiClient';
import { useRoleStore } from '@/stores/roleStore';
import type { AttentionFeedEntry } from '@/services/attentionFeed';

// F8 Command Center — "Needs your attention" feed (F08 §Process step 4). The
// established 4s-polling live-sync hook pattern (mirrors useRecentActivity /
// useDiscrepancies exactly): role + caseId in the query key so a role switch
// forces a fresh server-enforced query rather than reusing a cached response
// that could carry sealed CRITICAL rows the new role shouldn't see (threat
// T-08-10); apiFetch attaches X-User-Role. `retry: false` so a failed poll
// surfaces its error promptly and the 4s interval re-attempts naturally.
//
// The hook returns the server-given tier order VERBATIM — the panel performs no
// sort/re-order of its own (getAttentionFeed already concatenates tiers
// CRITICAL→HIGH→PENDING→MEDIUM, newest-first within each). Rendering the array
// as-is is itself the correctness guarantee.
export function useAttentionFeed() {
  const caseId = useRoleStore((s) => s.caseId);
  const role = useRoleStore((s) => s.role);
  return useQuery<AttentionFeedEntry[]>({
    queryKey: ['attention-feed', caseId, role],
    queryFn: async () => {
      if (!caseId) return [];
      const res = await apiFetch(`/api/cases/${caseId}/attention-feed`);
      if (!res.ok) throw new Error(`Failed to load attention feed: ${res.status}`);
      return res.json();
    },
    enabled: Boolean(caseId),
    refetchInterval: 4_000,
    retry: false,
  });
}
