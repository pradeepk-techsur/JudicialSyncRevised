'use client';

import { Tag } from '@carbon/react';
import { useExhibitList } from '@/hooks/useExhibitList';
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
// F15 FIX (07-04): the three exhibit-specific questions previously hardcoded
// placeholder exhibit numbers that matched NO real seeded exhibit (real labels
// are P-/D-/S- prefixed). A user tapping them got a confident-sounding question
// that could never resolve to a real record. They are now DERIVED from the
// case's REAL seeded exhibit list via `useExhibitList({})` (the same single
// query path the Case Workspace uses — not a second data-fetching path):
//   - jury-package reference  → first ADMITTED exhibit's label
//   - custody reference       → first exhibit with a known custodian's label
//   - general-history ref     → first exhibit's label (any status)
// The two NON-exhibit-specific questions reference no exhibit and are unchanged.
// =============================================================================

export function ExampleChips({ onPick }: { onPick: (text: string) => void }) {
  // Same single query path the Case Workspace uses. `{}` = no filters = the
  // unfiltered list. Realistically already warm from the Case Workspace visit
  // the user made before opening the assistant, so this resolves synchronously
  // from the react-query cache in practice.
  const exhibits = useExhibitList({}).data ?? [];

  // Derive real labels, never hardcoded placeholder numbers. Fallbacks ('P-4',
  // 'P-1') are stable seeded labels (plan 07-02 seed) used ONLY until the query
  // resolves — code defensively so we always render exactly 5 chips (the
  // assistant empty-state test asserts toHaveCount(5) immediately on open).
  const juryRef = exhibits.find((e) => e.currentStatus === 'ADMITTED')?.exhibitLabel ?? 'P-4';
  const custodyRef = exhibits.find((e) => e.currentCustodianName)?.exhibitLabel ?? 'P-4';
  const historyRef = exhibits[0]?.exhibitLabel ?? 'P-1';

  // Computed inside the component body (was a module-level constant) since the
  // three exhibit-specific prompts now depend on live hook data.
  const EXAMPLE_QUESTIONS = [
    'What exhibits were admitted yesterday?',
    'What objections remain unresolved?',
    `Is ${juryRef} in the jury package?`,
    `Who currently has custody of ${custodyRef}?`,
    `What happened to ${historyRef}?`,
  ] as const;

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
