'use client';

import { Tag } from '@carbon/react';
import styles from './ExampleChips.module.scss';

// =============================================================================
// ExampleChips — the empty-state zero-typing path (CONTEXT.md).
//
// Renders the FIVE named demo questions as tappable chips. Tapping a chip calls
// `onPick(text)`, which the thread wires to the hook's `sendExample` (pre-fill +
// AUTO-SUBMIT). Chips are ONLY rendered in the empty state — once the
// conversation has messages they disappear (the thread stops rendering this).
//
// CARBON MIGRATION (Phase 6): each chip is a clickable Carbon `Tag` (outline,
// md). A clickable Tag renders as a real `<button type="button">` (keyboard
// reachable), and Carbon passes `data-testid`/`onClick` straight through to that
// button — so `data-testid="example-chip"` lands on the actual interactive
// element the test clicks. `Tag` is the closest Carbon visual match to the
// previous rounded pill-shaped chip.
//
// These exact five questions are the demo's scripted keystone (F7 / the roadmap's
// five named questions that must resolve grounded-or-decline). Keep them verbatim.
// =============================================================================

const EXAMPLE_QUESTIONS = [
  'What exhibits were admitted yesterday?',
  'What objections remain unresolved?',
  'Is Exhibit 14 in the jury package?',
  'Who currently has custody of Exhibit 7?',
  'What happened to Exhibit 14?',
] as const;

export function ExampleChips({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className={styles.container} data-testid="example-chips">
      <p className={styles.heading}>Try asking</p>
      <div className={styles.chips}>
        {EXAMPLE_QUESTIONS.map((q) => (
          <Tag
            key={q}
            type="outline"
            size="md"
            data-testid="example-chip"
            onClick={() => onPick(q)}
            className={styles.chip}
          >
            {q}
          </Tag>
        ))}
      </div>
    </div>
  );
}
