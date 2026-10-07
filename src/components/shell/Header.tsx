'use client';

import { useEffect } from 'react';
import { useRoleStore } from '@/stores/roleStore';

export function Header() {
  const { caseNumber, users, activeUserId, setActiveUser, hydrate } = useRoleStore();

  useEffect(() => {
    if (caseNumber) return; // already hydrated
    fetch('/api/case')
      .then((res) => res.json())
      .then(hydrate)
      .catch(() => {
        // Demo-scoped: no retry/error UI for this one-time bootstrap call —
        // a failure here means the seed never ran, which every other screen's
        // own load-failure state already surfaces.
      });
  }, [caseNumber, hydrate]);

  return (
    <header className="no-print flex items-center justify-between border-b px-4 py-3">
      <div className="flex items-center gap-4">
        <span className="font-semibold">JudicialSync</span>
        <span className="text-sm text-gray-500">
          {caseNumber ? `Case: ${caseNumber}` : 'Loading case…'}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          Role:
          <select
            className="rounded border px-2 py-1"
            value={activeUserId ?? ''}
            onChange={(e) => setActiveUser(e.target.value)}
            aria-label="Switch active role"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role})
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled
          aria-disabled="true"
          title="Pivota Assistant — coming in a later phase"
          className="cursor-not-allowed rounded border px-3 py-1 text-sm text-gray-400"
        >
          Ask ✦
        </button>
      </div>
    </header>
  );
}
