'use client';

import { useState } from 'react';
import { Button, InlineLoading, InlineNotification } from '@carbon/react';
import { useExhibitList, type ExhibitFilters } from '@/hooks/useExhibitList';
import { useRoleStore } from '@/stores/roleStore';
import { SearchFilterBar } from '@/components/case/SearchFilterBar';
import { ExhibitTable } from '@/components/case/ExhibitTable';
import {
  QuickFilterChips,
  applyQuickFilter,
  type QuickFilter,
} from '@/components/case/QuickFilterChips';
import styles from './page.module.scss';

function hasAnyCriterion(filters: ExhibitFilters): boolean {
  return Boolean(
    filters.keyword || filters.status || filters.witness || filters.dateFrom || filters.dateTo,
  );
}

export default function CaseWorkspacePage() {
  const [filters, setFilters] = useState<ExhibitFilters>({});
  // Quick-filter is a PURELY client-side narrowing on top of the server-returned
  // list — it never changes what useExhibitList fetches (mirrors the
  // hasAnyCriterion separation of concerns: the search bar drives the query, the
  // quick filter only reshapes what renders). Zero new query.
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const { data, isLoading, isError } = useExhibitList(filters);

  const caseNumber = useRoleStore((s) => s.caseNumber);
  const activeUserId = useRoleStore((s) => s.activeUserId);
  const users = useRoleStore((s) => s.users);
  const activeUserName = users.find((u) => u.id === activeUserId)?.name;

  // Distinguish the two empty states (Screen-01-case-workspace.md §States):
  // a genuinely empty case ("No exhibits recorded yet") vs. a filtered view
  // with no matches (handled by ExhibitTable's own "No exhibits match…" copy).
  const genuinelyEmpty = data && data.length === 0 && !hasAnyCriterion(filters);

  const visibleRows = data ? applyQuickFilter(data, quickFilter, activeUserName) : [];

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.heading}>Case Workspace</h1>
          <p className={styles.subtitle}>
            {data?.length ?? 0} exhibits{caseNumber ? ` · ${caseNumber}` : ''}
          </p>
        </div>
        {/* Scope note (08-11 PLAN §Scope note): creating exhibits has never had a
            UI and is explicitly OUTSIDE F24's two-action scope. The button is
            rendered for visual fidelity with the reference screenshot, but is a
            native-disabled placeholder with an explanatory tooltip — a deliberate,
            documented scope boundary, NOT the absent-not-disabled role-gating
            pattern (which is a permission boundary). No create-exhibit handler
            exists. */}
        <Button
          kind="primary"
          disabled
          title="Exhibit creation is not yet available in this build"
          data-testid="add-exhibit-button"
        >
          Add exhibit
        </Button>
      </div>
      <SearchFilterBar filters={filters} onChange={setFilters} />
      {data && !genuinelyEmpty && (
        <QuickFilterChips rows={data} active={quickFilter} onChange={setQuickFilter} />
      )}
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
      {data && !genuinelyEmpty && (
        <>
          <ExhibitTable rows={visibleRows} />
          <p className={styles.footerCaption}>
            Tinted rows need attention. Select any row to open the exhibit.
          </p>
        </>
      )}
    </div>
  );
}
