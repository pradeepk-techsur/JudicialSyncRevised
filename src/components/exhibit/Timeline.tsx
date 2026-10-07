import type { ExhibitHistoryResponse } from '@/services/history';

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
  return (
    <ol className="space-y-3" aria-label="Exhibit history timeline">
      {entries.map((entry) => {
        const isHighlighted = highlightEventId != null && entry.eventId === highlightEventId;
        return (
          <li
            key={entry.eventId}
            id={`event-${entry.eventId}`}
            data-highlighted={isHighlighted ? 'true' : undefined}
            // The highlight is a brief amber wash reusing the Y0-patterns
            // live-sync highlight convention; the page clears highlightEventId
            // after ~400ms so the transition fades it out.
            className={`border-l-2 pl-3 transition-colors duration-500 ${
              isHighlighted ? 'border-amber-500 bg-amber-100' : ''
            }`}
          >
            {/* entry.summary is rendered VERBATIM — getExhibitHistory already
                translated the raw eventType/payload into plain language
                (US-10.1); this component performs zero re-derivation, so the
                Assistant's getExhibitHistory tool call (F7) and this screen are
                guaranteed to show identical text, not just identical underlying
                data. */}
            <p className="text-sm">{entry.summary}</p>
            <p className="text-xs text-gray-500">
              {new Date(entry.recordedAt).toLocaleString()} · by {entry.actorName}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
