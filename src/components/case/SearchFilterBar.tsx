'use client';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
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
        <Input
          placeholder="Search exhibits…"
          value={filters.keyword ?? ''}
          onChange={(e) => onChange({ ...filters, keyword: e.target.value || undefined })}
          className="max-w-xs"
          aria-label="Keyword search"
        />
        <Select
          value={filters.status ?? ''}
          onValueChange={(v) => onChange({ ...filters, status: (v as string) || undefined })}
        >
          <SelectTrigger className="w-40" aria-label="Filter by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Witness"
          value={filters.witness ?? ''}
          onChange={(e) => onChange({ ...filters, witness: e.target.value || undefined })}
          className="max-w-[10rem]"
          aria-label="Filter by witness"
        />
        <Input
          type="date"
          value={filters.dateFrom ?? ''}
          onChange={(e) => onChange({ ...filters, dateFrom: e.target.value || undefined })}
          aria-label="Date from"
        />
        <Input
          type="date"
          value={filters.dateTo ?? ''}
          onChange={(e) => onChange({ ...filters, dateTo: e.target.value || undefined })}
          aria-label="Date to"
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
            <span
              key={key}
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
            >
              {key}={value}
              <button
                type="button"
                aria-label={`Remove ${key} filter`}
                onClick={() => onChange({ ...filters, [key]: undefined })}
                className="font-bold"
              >
                ×
              </button>
            </span>
          ))}
          <Button variant="ghost" size="sm" onClick={() => onChange({})}>
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}
