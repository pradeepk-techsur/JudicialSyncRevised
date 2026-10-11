'use client';

import { Tile } from '@carbon/react';
import type { ObjectionCurrentState } from '@prisma/client';
import styles from './ObjectionCard.module.scss';

// `raisedAt` arrives as an ISO string once the history payload has round-tripped
// through NextResponse.json, but is a Date in-process — accept both.
function elapsed(since: Date): string {
  const mins = Math.round((Date.now() - since.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  return `${hours}h ago`;
}

// T-05 (Phase 9): the Objection card is DETAILS-ONLY. The per-thread
// "Record ruling" button that previously lived here was a genuine DUPLICATE
// entry point — a second, independent Record-ruling control targeting the same
// objectionId while the discrepancy banner already carries one. Per the external
// UI/UX review there must be exactly ONE Record-ruling entry point on the Exhibit
// Detail page (the banner's single primary button), so the card's button +
// its inline ruling form are removed entirely. The card now shows only the
// objecting party, the grounds, and the elapsed-time caption. The "Only the
// judge can rule." sentence is kept as informative context (it no longer implies
// an action exists on THIS card). The authoritative JUDGE-only enforcement stays
// unchanged in recordRuling's server gate, reached only via the banner's button.
export function ObjectionCard({ objections }: { objections: ObjectionCurrentState[] }) {
  return (
    <Tile className={styles.card} data-testid="exhibit-objection-card" aria-label="Objection">
      <h2 className={styles.heading}>Objection</h2>
      {objections.length === 0 ? (
        <p className={styles.empty} data-testid="objection-card-empty">
          No open objections
        </p>
      ) : (
        objections.map((obj) => (
          <div
            key={obj.objectionId}
            className={styles.thread}
            data-testid="objection-thread"
            data-objection-id={obj.objectionId}
          >
            <p className={styles.grounds}>
              {obj.objectingParty}: {obj.grounds}
            </p>
            <p className={styles.caption}>
              Raised {elapsed(new Date(obj.raisedAt))}. Only the judge can rule.
            </p>
          </div>
        ))
      )}
    </Tile>
  );
}
