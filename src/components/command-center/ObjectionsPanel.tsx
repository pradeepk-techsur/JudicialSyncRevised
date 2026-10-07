'use client';

import Link from 'next/link';
import { useUnresolvedObjections } from '@/hooks/useUnresolvedObjections';

// F8 Command Center — Unresolved Objections panel (lower-row LEFT). Presentational
// over its OWN useUnresolvedObjections hook (one hook per panel — three independent
// queries, so this panel's loading/error/empty never blanks the others). STRICTLY
// read-only: the only interactive elements are per-row link-throughs to Exhibit
// Detail plus a READ-retry on error (criterion 3).
//
// Sealed-safe via the route change in Task 1A: the /objections route now passes the
// parsed role into getUnresolvedObjections, so threads on sealed exhibits are
// absent (and uncounted) for a role without sealed visibility (threat T-05-08).

// The hook types rows as ObjectionCurrentState (raisedAt: Date), but the value
// arrives over the wire as an ISO string — accept either and normalize.
function formatTime(value: string | Date): string {
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function ObjectionsPanel() {
  const { data, isLoading, isError, refetch } = useUnresolvedObjections();
  const objections = data ?? [];

  return (
    <section
      data-testid="objections-panel"
      className="rounded-lg border bg-white p-4"
      aria-label="Unresolved objections"
    >
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">
        Unresolved Objections{' '}
        <span className="font-normal text-gray-500">({objections.length})</span>
      </h2>

      {isLoading && (
        <ul className="space-y-2" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-5 w-full animate-pulse rounded bg-gray-100" />
          ))}
        </ul>
      )}

      {isError && (
        <div className="text-sm text-red-600" role="alert">
          Unable to load objections — please retry.{' '}
          <button
            type="button"
            onClick={() => refetch()}
            className="font-medium underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !isError && objections.length === 0 && (
        <p className="text-sm text-gray-500">
          <span className="text-green-600" aria-hidden="true">
            ✓
          </span>{' '}
          No unresolved objections — all clear
        </p>
      )}

      {!isLoading && !isError && objections.length > 0 && (
        <ul className="divide-y divide-gray-100">
          {objections.map((o) => (
            <li key={o.objectionId}>
              <Link
                href={`/exhibit/${o.exhibitId}`}
                data-testid="objection-row"
                className="flex items-baseline gap-2 px-1 py-2 text-sm hover:bg-gray-50"
              >
                <span className="flex-1 text-gray-800">
                  {o.objectingParty} — {o.grounds}
                </span>
                <span className="shrink-0 text-xs text-gray-400">
                  {formatTime(o.raisedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
