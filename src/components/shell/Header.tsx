'use client';

import { useEffect } from 'react';
import { useRoleStore } from '@/stores/roleStore';
import { useAssistantStore } from '@/stores/assistantStore';

export function Header() {
  const { caseNumber, users, activeUserId, setActiveUser, hydrate } = useRoleStore();
  const togglePanel = useAssistantStore((s) => s.togglePanel);

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
          onClick={togglePanel}
          data-testid="ask-assistant"
          aria-label="Open Pivota Assistant"
          title="Ask the Pivota Assistant"
          className="rounded border px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          Ask ✦
        </button>
      </div>
    </header>
  );
}
