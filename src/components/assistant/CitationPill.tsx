'use client';

import Link from 'next/link';
import type { Citation } from '@/hooks/useAssistantChat';

// =============================================================================
// CitationPill — the visible proof behind the never-ungrounded guarantee.
//
// Renders a single citation as a monospace, bordered, INLINE pill
// `[RecordLabel · RecordType · Timestamp]` (CONTEXT.md pill format; Y0-patterns
// Citation Pill). The pill is a LINK that deep-links into the cited exhibit's
// Exhibit Detail View — ALL citation types land on `/exhibit/:exhibitId`
// (CONTEXT.md), the single screen showing every record type for an exhibit.
//
// It reads `citation.exhibitId` and `citation.eventId` DIRECTLY off the object
// (surfaced by the hook from 04-03's wire contract) — it does NOT re-derive the
// link target from recordId/recordType. `recordId` only equals the eventId for
// an ExhibitEvent; the authoritative deep-link coordinates travel WITH the
// citation. When `eventId` is non-null the pill appends `?event=<eventId>` so the
// Timeline scrolls+highlights that exact entry; when it is null (a
// DiscrepancyFlag or JuryPackageExhibit row, which has no single timeline anchor)
// the pill lands at top-of-timeline — the documented graceful fallback.
// =============================================================================

/** Type-specific middle token (same pill SHAPE across all three types). For an
 *  ExhibitEvent we surface the concrete event kind baked into the label when
 *  available (e.g. STATUS_CHANGE); the other two carry fixed short tokens. */
const RECORD_TYPE_TOKEN: Record<Citation['recordType'], string> = {
  ExhibitEvent: 'ExhibitEvent',
  DiscrepancyFlag: 'DiscFlag',
  JuryPackageExhibit: 'JuryPkgRow',
};

/** Format the citation timestamp compactly for the pill's trailing token. */
function formatPillTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export function CitationPill({ citation }: { citation: Citation }) {
  // Link target comes STRAIGHT from the citation object — never re-derived.
  const href = citation.eventId
    ? `/exhibit/${citation.exhibitId}?event=${citation.eventId}`
    : `/exhibit/${citation.exhibitId}`;

  const typeToken = RECORD_TYPE_TOKEN[citation.recordType];
  const timeToken = formatPillTimestamp(citation.timestamp);

  return (
    <Link
      href={href}
      data-testid="citation-pill"
      data-record-type={citation.recordType}
      data-exhibit-id={citation.exhibitId}
      data-event-id={citation.eventId ?? ''}
      // Bordered, small, monospace, clearly inline and SECONDARY to the answer
      // text (never louder than the answer — information-hierarchy rule).
      className="mx-0.5 inline-flex items-center gap-1 rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 align-baseline font-mono text-[11px] leading-tight text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      aria-label={`Citation: ${citation.label}, ${citation.recordType}, ${timeToken}. View source record.`}
    >
      <span className="font-semibold">[{citation.label}</span>
      <span aria-hidden="true">·</span>
      <span>{typeToken}</span>
      <span aria-hidden="true">·</span>
      <span>{timeToken}]</span>
    </Link>
  );
}
