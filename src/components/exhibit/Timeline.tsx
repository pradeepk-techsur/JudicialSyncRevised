import type { ExhibitHistoryResponse } from '@/services/history';
import styles from './Timeline.module.scss';

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
  // Carbon has no dedicated "timeline" component, so this stays a plain semantic
  // ordered list — the `aria-label="Exhibit history timeline"` string is a
  // cross-plan contract (the Command Center's e2e suite asserts it
  // independently), and each entry's `id={`event-${eventId}`}` is the scroll
  // anchor THREE other screens' deep-links target. Both are preserved
  // byte-for-byte; Phase 6 only swaps the Tailwind utilities for a Carbon-token
  // CSS Module (Timeline.module.scss), including the warning-token highlight.
  return (
    <ol className={styles.list} aria-label="Exhibit history timeline">
      {entries.map((entry) => {
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
  );
}
