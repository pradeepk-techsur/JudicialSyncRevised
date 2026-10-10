'use client';

import { useMemo, useState } from 'react';
import type { EventType } from '@prisma/client';
import type { ExhibitHistoryResponse } from '@/services/history';
import styles from './Timeline.module.scss';

// Client-side Timeline filter pills (All/Status/Custody/Objections — NOTE: no
// "Rulings" pill here, per Screenshot 2, unlike the Command Center's 5-pill
// set). Each pill narrows the ALREADY-loaded `entries` prop by `eventType` via
// a `useMemo` — zero new query, zero change to how each entry renders, to the
// `id={event-${eventId}}` scroll anchors, or to the citation-deep-link
// highlight contract (T-04-15/16). The .map() below iterates the filtered
// subset; everything inside it is byte-for-byte the pre-filter rendering.
type TimelineFilter = 'ALL' | 'STATUS' | 'CUSTODY' | 'OBJECTIONS';

const FILTERS: Array<{ id: TimelineFilter; label: string }> = [
  { id: 'ALL', label: 'All' },
  { id: 'STATUS', label: 'Status' },
  { id: 'CUSTODY', label: 'Custody' },
  { id: 'OBJECTIONS', label: 'Objections' },
];

// Which raw ledger event types each pill admits. "Objections" covers both the
// raise and the ruling (a ruling is the resolution of an objection thread).
const FILTER_EVENT_TYPES: Record<Exclude<TimelineFilter, 'ALL'>, EventType[]> = {
  STATUS: ['STATUS_CHANGE'],
  CUSTODY: ['CUSTODY_TRANSFER'],
  OBJECTIONS: ['OBJECTION_RAISED', 'RULING_RECORDED'],
};

export function Timeline({
  entries,
  highlightEventId,
}: {
  entries: ExhibitHistoryResponse['timeline'];
  // The event id the citation deep-link (`/exhibit/:id?event=<eventId>`) wants
  // highlighted. The matching <li> gets a transient highlight class (the page
  // drives the fade-out by clearing the param after ~400ms). Absent/unmatched →
  // no highlight (top-of-timeline fallback), never an error.
  highlightEventId?: string | null;
}) {
  const [filter, setFilter] = useState<TimelineFilter>('ALL');

  const visibleEntries = useMemo(() => {
    if (filter === 'ALL') return entries;
    const allowed = FILTER_EVENT_TYPES[filter];
    return entries.filter((e) => allowed.includes(e.eventType));
  }, [entries, filter]);

  // Carbon has no dedicated "timeline" component, so this stays a plain semantic
  // ordered list — the `aria-label="Exhibit history timeline"` string is a
  // cross-plan contract (the Command Center's e2e suite asserts it
  // independently), and each entry's `id={`event-${eventId}`}` is the scroll
  // anchor THREE other screens' deep-links target. Both are preserved
  // byte-for-byte.
  return (
    <div>
      <div className={styles.filterRow} role="group" aria-label="Filter timeline" data-testid="timeline-filters">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`${styles.pill} ${filter === f.id ? styles.pillActive : ''}`}
            data-testid={`timeline-filter-${f.id.toLowerCase()}`}
            data-active={filter === f.id ? 'true' : undefined}
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <ol className={styles.list} aria-label="Exhibit history timeline">
        {visibleEntries.map((entry) => {
          const isHighlighted = highlightEventId != null && entry.eventId === highlightEventId;
          return (
            <li
              key={entry.eventId}
              id={`event-${entry.eventId}`}
              data-highlighted={isHighlighted ? 'true' : undefined}
              // The highlight is a brief warning wash reusing the Y0-patterns
              // live-sync highlight convention; the page clears highlightEventId
              // after ~400ms so the 500ms transition fades it out.
              className={`${styles.entry} ${isHighlighted ? styles.highlighted : ''}`}
            >
              {/* entry.summary is rendered VERBATIM — getExhibitHistory already
                  translated the raw eventType/payload into plain language
                  (US-10.1); this component performs zero re-derivation, so the
                  Assistant's getExhibitHistory tool call (F7) and this screen are
                  guaranteed to show identical text, not just identical underlying
                  data. */}
              <p className={styles.summary}>{entry.summary}</p>
              <p className={styles.meta}>
                {new Date(entry.recordedAt).toLocaleString()} · by {entry.actorName}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
