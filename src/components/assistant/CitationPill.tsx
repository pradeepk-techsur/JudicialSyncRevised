'use client';

import Link from 'next/link';
import { Tag } from '@carbon/react';
import type { Citation } from '@/hooks/useAssistantChat';
import styles from './CitationPill.module.scss';

// =============================================================================
// CitationPill — the visible proof behind the never-ungrounded guarantee.
//
// Renders a single citation as a small, bordered, INLINE pill
// `[RecordLabel · RecordType · Timestamp]` (CONTEXT.md pill format; Y0-patterns
// Citation Pill, annotated in Phase 6 as "implemented as a clickable Carbon
// Tag"). The pill is a LINK that deep-links into the cited exhibit's Exhibit
// Detail View — ALL citation types land on `/exhibit/:exhibitId` (CONTEXT.md),
// the single screen showing every record type for an exhibit.
//
// CARBON MIGRATION (Phase 6): the visible chip is now a Carbon `Tag` (gray, sm),
// wrapped in a Next.js `<Link>` so the pill is a REAL `<a>` in the DOM tab order
// (Y2-accessibility.md: "Citation pills are real `<a>`/button elements in the DOM
// tab order, never a styled `<span>`"). Carbon's `Tag` renders a `<div>` by
// itself, so wrapping it in `<Link>` is the composition that preserves both the
// Carbon visual treatment AND keyboard reachability. All data-* attributes live
// on the `<Link>` (the anchor the test locators target).
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
      // Real <a> in the tab order; the Carbon Tag inside provides the visual
      // pill treatment. The link stays SECONDARY to the answer text
      // (information-hierarchy rule — never louder than the answer).
      className={styles.pillLink}
      aria-label={`Citation: ${citation.label}, ${citation.recordType}, ${timeToken}. View source record.`}
    >
      <Tag type="gray" size="sm" className={styles.pillTag}>
        <span className={styles.pillContent}>
          <span className={styles.pillLabel}>[{citation.label}</span>
          <span aria-hidden="true">·</span>
          <span>{typeToken}</span>
          <span aria-hidden="true">·</span>
          <span>{timeToken}]</span>
        </span>
      </Tag>
    </Link>
  );
}
