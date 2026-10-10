---
phase: 09-ui-tickets-and-typography-standard
plan: 16
subsystem: ui
tags: [carbon, scss, spacing-tokens, button-sizing, design-system]

requires:
  - phase: 09-15
    provides: shared Card.module.scss card chrome (box-shadow convention)
provides:
  - "ActionButtonRow.module.scss gap routed through the Carbon $spacing-03 token (no raw rem)"
  - "Audit confirmation: every audited surface uses Carbon spacing tokens exclusively for margin/padding/gap"
  - "Audit confirmation: no Carbon <Button> across this phase's touched files carries a custom width/padding/min-width override away from Carbon's size=md/sm defaults"
affects: [future-ui-tickets, design-system-consistency]

tech-stack:
  added: []
  patterns:
    - "Button-pair spacing expressed via named Carbon spacing tokens, never raw rem/px"
    - "ActionButtonRow is layout-only — never constrains child button width/sizing"

key-files:
  created: []
  modified:
    - src/components/shared/ActionButtonRow.module.scss

key-decisions:
  - "Border widths (1px/3px) and border-radius (0.25rem) are NOT spacing rhythm and stay as literals — the Carbon spacing scale governs margin/padding/gap only"
  - "margin:0 / padding:0 resets are correct literals (there is no $spacing-00); left unchanged"
  - "ActiveRoleBanner .switchBack is a native text LINK (padding:0;border:0;background:none), not a sized Carbon Button — its zeroed box is link styling, correctly kept per the plan's button-vs-layout distinction"

patterns-established:
  - "Spacing-token sweep: distinguish spacing rhythm (tokenize) from border width / border-radius / zero-reset (leave literal)"

duration: 4min
completed: 2026-10-10
---

# Phase 9 Plan 16: Spacing Tokens & Button-Sizing Standard (T-14) Summary

**Routed the shared ActionButtonRow button-pair gap through the Carbon `$spacing-03` token (the one remaining raw `0.5rem` in the audited surfaces) and verified by full audit that every audited file uses Carbon spacing tokens exclusively and that no Carbon `<Button>` this phase touched carries a custom width/padding override away from Carbon's `size="md"/"sm"` defaults.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-10-10T19:23:33Z
- **Completed:** 2026-10-10T19:27:10Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- **Spacing-token sweep (6 audited files):** `ExhibitHeader`, `DiscrepancyBanner`, `RecordRulingForm`, `TransferCustodyForm`, `case/page`, and `ActionButtonRow` module SCSS. Five of the six already used Carbon `$spacing-01..$spacing-13` exclusively for margin/padding/gap (migrated by prior Phase 6/8/9 plans). The one real one-off — `ActionButtonRow`'s `gap: 0.5rem` — was replaced with `$spacing-03` (8px, the exact token for that value).
- **Button-size audit (this phase's own newly-added/touched Buttons):** Audited the Carbon `<Button>` usages in `DiscrepancyBanner.tsx` (09-05), `AttentionFeedPanel.tsx` (09-01), `ActiveRoleBanner.tsx` (09-09), and `LiveIndicator.tsx` (09-13). **No** button carries a custom `width`/`min-width`/`padding` CSS override — grep across every `src/**/*.module.scss` for a button-targeting width/padding class and for `:global(.cds--btn)` overrides returned nothing; no inline `style=`/`width`/`minWidth` on any `<Button>`; every explicit `size=` prop is Carbon's own `sm` (dense table/banner contexts) or the default `md`. Carbon's own component CSS governs all button sizing.
- **ActionButtonRow contract confirmed intact:** the shared primary/secondary pairing wrapper remains layout-only (flex row + token gap) and imposes **no** width constraint on its children, still correct after this phase's new consumers were added.

## Task Commits

1. **Task 1: Spacing-token sweep + button-size audit** - `ea5a602` (fix)

_Plan metadata: see final docs commit._

## Files Created/Modified

- `src/components/shared/ActionButtonRow.module.scss` - Replaced the raw `0.5rem` button-pair gap with the named Carbon `$spacing-03` token (added the `@use '@carbon/styles/scss/spacing'` import); documented the layout-only / no-width-constraint contract.

## Decisions Made

- **Border widths and border-radius are out of scope for a spacing-token sweep.** `DiscrepancyBanner`'s `border: 1px` / `border-left: 3px` and the `border-radius: 0.25rem` values are border/corner styling, not spacing rhythm — the Carbon spacing scale governs margin/padding/gap. Left as literals.
- **`margin: 0` / `padding: 0` resets are correct literals** (there is no `$spacing-00`). The grep hits for raw `margin/padding` in the audited files are all zeroing resets (`ExhibitHeader .heading`, `DiscrepancyBanner .list`), left unchanged.
- **`ActiveRoleBanner .switchBack` is a native text link, not a sized Button.** Its `padding:0;border:0;background:none` is deliberate link styling (the plan itself calls it "the switch-back link"), not a Carbon Button box-model override. Correctly distinguished and kept per the plan's "button's OWN box model (remove) vs layout/link styling (keep)" guidance.

## Deviations from Plan

None - plan executed exactly as written. The plan anticipated this audit might find either a real one-off or confirm existing correctness ("confirm, don't assume"); it found exactly one real one-off (the ActionButtonRow gap) and fixed it, with everything else already compliant.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- T-14 (spacing + button sizing standard) complete: spacing uses Carbon tokens throughout the audited surfaces; primary buttons share one `size="md"` height/padding and secondary actions share one consistent `size="sm"`/tertiary style app-wide, all governed by Carbon's own component CSS with zero per-call overrides.
- This was the LAST of the CSS-sweep tickets (run last by design to audit the buttons this phase itself added). Phase 9 Wave 6 plan 16 of the phase is complete.

## Known Stubs

None found - the single changed file is a token substitution in a layout SCSS module with no code logic.

## Self-Check: PASSED

- Modified file exists on disk: `src/components/shared/ActionButtonRow.module.scss` (FOUND)
- SUMMARY.md exists: `.planning/phases/09-ui-tickets-and-typography-standard/09-16-SUMMARY.md` (FOUND)
- Task commit exists: `ea5a602` (FOUND)
- `$spacing-03` token present in the modified file (FOUND)
- Build check: `npm run build` → exit 0
- Type check: `npx tsc --noEmit` → exit 0
- E2E: `npx playwright test e2e/exhibit-detail.spec.ts e2e/command-center.spec.ts e2e/app-shell.spec.ts --workers=1` → 72 passed, exit 0
- Known Stubs: none found

---
*Phase: 09-ui-tickets-and-typography-standard*
*Completed: 2026-10-10*
