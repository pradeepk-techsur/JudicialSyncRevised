'use client';

import { useState } from 'react';
import { InlineLoading, InlineNotification } from '@carbon/react';
import { useExhibitList, type ExhibitFilters } from '@/hooks/useExhibitList';
import { SearchFilterBar } from '@/components/case/SearchFilterBar';
import { ExhibitTable } from '@/components/case/ExhibitTable';
import styles from './page.module.scss';

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
      <h1 className={styles.heading}>Case Workspace</h1>
      <SearchFilterBar filters={filters} onChange={setFilters} />
      {isLoading && <InlineLoading description="Loading exhibits…" />}
      {isError && (
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title="Unable to load case exhibits — please retry."
        />
      )}
      {genuinelyEmpty && <p className={styles.empty}>No exhibits recorded yet.</p>}
      {data && !genuinelyEmpty && <ExhibitTable rows={data} />}
    </div>
  );
}
