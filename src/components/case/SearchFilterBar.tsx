'use client';

import { Search, Dropdown, ComboBox, TextInput, DismissibleTag, Button } from '@carbon/react';
import type { ExhibitFilters } from '@/hooks/useExhibitList';
import styles from './SearchFilterBar.module.scss';

const STATUS_OPTIONS = [
  'MARKED',
  'OFFERED',
  'OBJECTED',
  'ADMITTED',
  'EXCLUDED',
  'WITHDRAWN',
] as const;

export function SearchFilterBar({
  filters,
  onChange,
  witnessOptions,
}: {
  filters: ExhibitFilters;
  onChange: (next: ExhibitFilters) => void;
  // Distinct `associatedWitness` values from the already-loaded exhibit list
  // (derived in case/page.tsx). Turns the former free-text witness field into a
  // searchable select bound to real seeded values — the ComboBox can only submit
  // a value already present in the list (threat T-09-11), narrowing the
  // searchExhibits validation surface rather than widening it.
  witnessOptions: string[];
}) {
  const chips = (Object.entries(filters) as [keyof ExhibitFilters, string | undefined][]).filter(
    ([, v]) => v,
  );

  return (
    <div className={styles.bar}>
      <div className={styles.row}>
        {/* Carbon's Search renders `labelText` as a visually-hidden <label> even
            in non-compact mode, so a sighted user never sees it. Pair it with a
            visible <span> label above the control (matching the label-above
            pattern Dropdown/ComboBox/date inputs now use), while keeping the
            existing aria-label/placeholder behaviour intact. */}
        <div className={styles.field}>
          <span className={styles.fieldLabel} id="exhibit-keyword-search-label">
            Search
          </span>
          <Search
            id="exhibit-keyword-search"
            labelText="Keyword search"
            aria-label="Keyword search"
            placeholder="Search exhibits…"
            size="md"
            value={filters.keyword ?? ''}
            onChange={(e) => onChange({ ...filters, keyword: e.target.value || undefined })}
            onClear={() => onChange({ ...filters, keyword: undefined })}
            className={styles.searchField}
          />
        </div>
        <Dropdown
          id="exhibit-status-filter"
          // `hideLabel` removed: Carbon's Dropdown now renders titleText="Status"
          // as a real VISIBLE label above the control. aria-label is dropped — a
          // visible titleText already provides the accessible name, and keeping a
          // differing aria-label would make Playwright's getByText('Status')/the
          // accessible-name both resolve, risking a strict-mode collision. The
          // control is addressable by its visible "Status" label.
          titleText="Status"
          label="Select…"
          items={STATUS_OPTIONS as unknown as string[]}
          itemToString={(item) => item ?? ''}
          selectedItem={filters.status ?? null}
          // Carbon's Dropdown onChange yields { selectedItem } (not a raw string
          // like shadcn's onValueChange) — mechanical adaptation, same resulting
          // ExhibitFilters shape.
          onChange={({ selectedItem }) =>
            onChange({ ...filters, status: selectedItem || undefined })
          }
        />
        <ComboBox
          id="exhibit-witness-filter"
          // Searchable single-select built from the loaded list's distinct
          // witness values. Visible titleText="Witness" (no hideLabel). The
          // selected value flows into ExhibitFilters.witness exactly as the old
          // free-text input did, so searchExhibits query-param parsing is
          // unchanged downstream.
          titleText="Witness"
          placeholder="Any witness"
          items={witnessOptions}
          itemToString={(item) => item ?? ''}
          selectedItem={filters.witness ?? null}
          onChange={({ selectedItem }) =>
            onChange({ ...filters, witness: selectedItem ?? undefined })
          }
          className={styles.witnessField}
        />
        <TextInput
          id="exhibit-date-from"
          // Visible label — shortened to "From" (clearer than "Date from" sitting
          // beside "Date to"). Native type="date" already localizes its own
          // picker UI, so no placeholder formatting is needed.
          labelText="From"
          type="date"
          value={filters.dateFrom ?? ''}
          onChange={(e) => onChange({ ...filters, dateFrom: e.target.value || undefined })}
        />
        <TextInput
          id="exhibit-date-to"
          labelText="To"
          type="date"
          value={filters.dateTo ?? ''}
          onChange={(e) => onChange({ ...filters, dateTo: e.target.value || undefined })}
        />
      </div>
      {chips.length > 0 && (
        <div className={styles.row}>
          <span className={styles.hint}>Active filters:</span>
          {chips.map(([key, value]) => (
            <DismissibleTag
              key={key}
              type="gray"
              size="sm"
              text={`${key}=${value}`}
              // `title` labels the dismiss button (preserves the old
              // "Remove {key} filter" affordance aria/tooltip).
              title={`Remove ${key} filter`}
              onClose={() => onChange({ ...filters, [key]: undefined })}
            />
          ))}
          <Button kind="ghost" size="sm" onClick={() => onChange({})}>
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}
