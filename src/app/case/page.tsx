'use client';

import { useState } from 'react';
import { useExhibitList, type ExhibitFilters } from '@/hooks/useExhibitList';
import { SearchFilterBar } from '@/components/case/SearchFilterBar';
import { ExhibitTable } from '@/components/case/ExhibitTable';

function hasAnyCriterion(filters: ExhibitFilters): boolean {
  return Boolean(
    filters.keyword || filters.status || filters.witness || filters.dateFrom || filters.dateTo,
  );
}

export default function CaseWorkspacePage() {
  const [filters, setFilters] = useState<ExhibitFilters>({});
  const { data, isLoading, isError } = useExhibitList(filters);

  // Distinguish the two empty states (Screen-01-case-workspace.md §States):
  // a genuinely empty case ("No exhibits recorded yet") vs. a filtered view
  // with no matches (handled by ExhibitTable's own "No exhibits match…" copy).
  const genuinelyEmpty = data && data.length === 0 && !hasAnyCriterion(filters);

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Case Workspace</h1>
      <SearchFilterBar filters={filters} onChange={setFilters} />
      {isLoading && <p className="text-sm text-gray-500">Loading exhibits…</p>}
      {isError && (
        <p className="text-sm text-red-600">Unable to load case exhibits — please retry.</p>
      )}
      {genuinelyEmpty && <p className="text-sm text-gray-500">No exhibits recorded yet.</p>}
      {data && !genuinelyEmpty && <ExhibitTable rows={data} />}
    </div>
  );
}
