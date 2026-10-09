'use client';

import Link from 'next/link';
import { Tile } from '@carbon/react';
import type { ExhibitHistoryResponse } from '@/services/history';
import styles from './JuryPackageChecklistCard.module.scss';

// Exhibit Detail right-rail Jury-Package checklist card. The 4 per-condition
// checks (admitted / objections resolved / custodian on record / not sealed)
// and the overall `eligibility` verdict are BOTH computed by 08-08's backend,
// which calls 08-07's shared `loadJuryEligibilityByExhibit` precedence — the
// IDENTICAL Included/Blocked/Not-eligible rule the Case Workspace column uses
// — so this card can never drift from the Case Workspace for the same exhibit.
// This component only renders those pre-computed values.

const ELIGIBILITY_LABEL: Record<
  ExhibitHistoryResponse['juryPackageChecklist']['eligibility'],
  string
> = {
  INCLUDED: 'Included',
  BLOCKED: 'Blocked',
  NOT_ELIGIBLE: 'Not eligible',
};

// A positive "Included" verdict reads oddly through SeverityPill's severity
// tones (critical/high/pending/medium are all urgency words), so — per the
// plan's Claude's-Discretion note — the eligibility badge is a plain colored
// span keyed by the verdict, not a forced SeverityPill. The checklist items
// below carry their own always-visible ✓/✗ glyph + label text, so color is
// never the sole signal (Y2-accessibility).
export function JuryPackageChecklistCard({
  checklist,
}: {
  checklist: ExhibitHistoryResponse['juryPackageChecklist'];
  exhibitId: string;
}) {
  const items = [
    { met: checklist.admitted, label: 'Admitted' },
    { met: checklist.objectionsResolved, label: 'No unresolved objections' },
    { met: checklist.custodianOnRecord, label: 'Custodian on record' },
    { met: checklist.classificationTrial, label: 'Not sealed / ex parte' },
  ];

  return (
    <Tile className={styles.card} data-testid="exhibit-jury-checklist-card" aria-label="Jury package">
      <h2 className={styles.heading}>Jury Package</h2>
      <span
        className={`${styles.eligibility} ${styles[`eligibility_${checklist.eligibility}`]}`}
        data-testid="jury-eligibility-badge"
        data-eligibility={checklist.eligibility}
      >
        {ELIGIBILITY_LABEL[checklist.eligibility]}
      </span>
      <ul className={styles.checklist}>
        {items.map((item) => (
          <li
            key={item.label}
            className={styles.item}
            data-testid="jury-checklist-item"
            data-met={item.met}
          >
            <span aria-hidden="true">{item.met ? '✓' : '✗'}</span> {item.label}
          </li>
        ))}
      </ul>
      <Link href="/jury-package" className={styles.link} data-testid="jury-checklist-open-link">
        Open jury package →
      </Link>
    </Tile>
  );
}
