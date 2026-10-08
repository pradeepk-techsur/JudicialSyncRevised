'use client';

import { Search, Dropdown, TextInput, DismissibleTag, Button } from '@carbon/react';
import type { ExhibitFilters } from '@/hooks/useExhibitList';

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
}: {
  filters: ExhibitFilters;
  onChange: (next: ExhibitFilters) => void;
}) {
  const hasAny = Boolean(
    filters.keyword || filters.status || filters.witness || filters.dateFrom || filters.dateTo,
  );

  const chips = (Object.entries(filters) as [keyof ExhibitFilters, string | undefined][]).filter(
    ([, v]) => v,
  );

  return (
    <div className="mb-4 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Search
          id="exhibit-keyword-search"
          labelText="Keyword search"
          aria-label="Keyword search"
          placeholder="Search exhibits…"
          size="md"
          value={filters.keyword ?? ''}
          onChange={(e) => onChange({ ...filters, keyword: e.target.value || undefined })}
          onClear={() => onChange({ ...filters, keyword: undefined })}
          className="max-w-xs"
        />
        <Dropdown
          id="exhibit-status-filter"
          // titleText drives the accessible name (getByLabel('Filter by status'))
          // and is hidden inline via hideLabel; `label` is the placeholder text.
          titleText="Filter by status"
          hideLabel
          aria-label="Filter by status"
          label="Status"
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
        <TextInput
          id="exhibit-witness-filter"
          labelText="Filter by witness"
          hideLabel
          aria-label="Filter by witness"
          placeholder="Witness"
          value={filters.witness ?? ''}
          onChange={(e) => onChange({ ...filters, witness: e.target.value || undefined })}
          className="max-w-[10rem]"
        />
        <TextInput
          id="exhibit-date-from"
          labelText="Date from"
          hideLabel
          aria-label="Date from"
          type="date"
          value={filters.dateFrom ?? ''}
          onChange={(e) => onChange({ ...filters, dateFrom: e.target.value || undefined })}
        />
        <TextInput
          id="exhibit-date-to"
          labelText="Date to"
          hideLabel
          aria-label="Date to"
          type="date"
          value={filters.dateTo ?? ''}
          onChange={(e) => onChange({ ...filters, dateTo: e.target.value || undefined })}
        />
      </div>
      {!hasAny && (
        <p className="text-xs text-gray-500">
          Enter at least one filter above to search — showing the full list.
        </p>
      )}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500">Active filters:</span>
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
