import type { ExhibitHistoryResponse } from '@/services/history';

export function Timeline({ entries }: { entries: ExhibitHistoryResponse['timeline'] }) {
  return (
    <ol className="space-y-3" aria-label="Exhibit history timeline">
      {entries.map((entry) => (
        <li key={entry.eventId} id={`event-${entry.eventId}`} className="border-l-2 pl-3">
          {/* entry.summary is rendered VERBATIM — getExhibitHistory already
              translated the raw eventType/payload into plain language
              (US-10.1); this component performs zero re-derivation, so the
              Assistant's future getExhibitHistory tool call (F7) and this
              screen are guaranteed to show identical text, not just
              identical underlying data. */}
          <p className="text-sm">{entry.summary}</p>
          <p className="text-xs text-gray-500">
            {new Date(entry.recordedAt).toLocaleString()} · by {entry.actorName}
          </p>
        </li>
      ))}
    </ol>
  );
}
