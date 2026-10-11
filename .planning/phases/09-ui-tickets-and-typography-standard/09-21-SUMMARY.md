---
phase: 09-ui-tickets-and-typography-standard
plan: 21
subsystem: ui
tags: [css, carbon-design-system, playwright, regression-test, gap-closure]

# Dependency graph
requires:
  - phase: 09-ui-tickets-and-typography-standard
    provides: "09-19's (incorrect) prior fix attempt for the same ExhibitTable chevron/description column-width defect (09-UAT.md test 6)"
provides:
  - "A working compound CSS selector that actually pins the Case Workspace exhibit table's chevron column to 2rem, letting Description absorb its true remainder width"
  - "Width-specific Playwright assertions (chevron <=33px, Description >200px) that directly pin the broken mechanism, so this exact dead-selector class of regression can never silently reappear and pass the existing overlap-only test"
affects: [09-UAT.md test 6 (re-closed), case-workspace.spec.ts]

# Tech tracking
tech-stack:
  added: []
  patterns: ["CSS compound selector (no combinator) required when two classes coexist on the SAME DOM element — a descendant combinator between them can never match"]

key-files:
  created: []
  modified:
    - src/components/case/ExhibitTable.module.scss
    - e2e/case-workspace.spec.ts

key-decisions:
  - "Root-caused independently via live DOM inspection against a freshly rebuilt Docker container (not copied from 09-19's narrative): Carbon's <Table> renders ONE <table> element carrying BOTH `.cds--data-table` and the local `.table` module class simultaneously, so 09-19's descendant-combinator selector (`.table :global(.cds--data-table) ...`) could never match — verified live with `element.matches(selector)` returning false both before and after the fix."
  - "Fix is a one-token change (remove the space between `.table` and `:global(.cds--data-table)`) rather than any selector restructuring, per the plan's own scope boundary."
  - "Extended the EXISTING 09-19 UAT-6 test rather than adding a new one, keeping the gap's full regression history in one place, per the plan's instruction."

patterns-established:
  - "When compounding a module-scoped class with a `:global(...)` vendor class to win a specificity fight, verify live via `element.className` / `element.matches()` whether the two classes land on the SAME element (compound, no space) or on nested elements (descendant, with space) — guessing wrong produces CSS that silently never matches and ships as dead code."

# Metrics
duration: 25min
completed: 2026-10-10
---

# Phase 9 Plan 21: Fix dead descendant-combinator selector in ExhibitTable chevron column Summary

**Converted 09-19's dead descendant-combinator CSS selector (`.table :global(.cds--data-table)`) into a working compound selector (`.table:global(.cds--data-table)`, no space), which actually matches Carbon's single-element `<table>` DOM and restores the chevron column to its intended 2rem width — letting Description absorb its true ~272px remainder instead of being squeezed to a dead-selector 50/50 split with the chevron column.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-10-10T23:47:52Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Identified and fixed the exact one-space CSS specificity bug that made 09-19's prior fix for this same defect a no-op: a descendant combinator between two classes that Carbon's `<Table>` places on the SAME element can never match.
- Proved the fix live, not by inference: rebuilt the Docker container from scratch with the ACTUAL file change (not just an injected style override), measured chevron header width dropping from 152px (broken) to 32px (fixed) and Description cell width rising from 152px to 272px.
- Extended the existing 09-19 Playwright regression test with two new width-specific assertions that pin the actual broken mechanism (not a downstream consequence), and confirmed by deliberately reverting the fix that the new assertions fail exactly as predicted (chevron measured 152px, assertion `<=33px` failed) — then restored the fix and confirmed the full suite (minus one unrelated pre-existing flake) passes.

## Task Commits

Each task was committed atomically:

1. **Task 1: Convert the dead descendant-combinator selector into a working compound selector** - `778901f` (fix)
2. **Task 2: Extend the 09-19 regression test with explicit chevron/description width assertions** - `6cdc489` (test)

_Note: no plan-metadata commit separate from this SUMMARY — committed together per step `git_commit_metadata`._

## Files Created/Modified
- `src/components/case/ExhibitTable.module.scss` - The two selector lines (`th:last-of-type.colChevron` / `td:last-of-type.chevronCell`) changed from a descendant combinator to a compound selector; added an explanatory comment documenting the root cause and live-verification evidence directly above the fixed rule.
- `e2e/case-workspace.spec.ts` - Extended the existing UAT-6 "zero cell-to-cell visual overlap" test with two new assertions: chevron header width `<=33px` (2rem + 1px tolerance) and Description cell width `>200px` (the real remainder, not a ~152px 50/50 split).

## Decisions Made
- Root-caused independently in this plan's own investigation (re-derived from live evidence, not copied from 09-19's prior narrative) before touching any code, per the plan's objective.
- Did not touch `.colFlags` or any other column-width rule — confirmed via live investigation that the Flags/Jury-Package pill-overlap fix from 09-19 was unrelated to this defect and remained correct throughout.
- Extended the existing test rather than writing a new one, to keep the UAT-6 gap's full regression history (09-19's overlap check + this plan's width-specific check) in a single test.

## Deviations from Plan

None - plan executed exactly as written. The plan's own investigation (root cause, live DOM evidence, selector fix, test extension) was already fully specified in the PLAN.md; execution matched it task-for-task with no scope changes.

## Issues Encountered

**Pre-existing, unrelated test flake (documented in the plan's own `<done>` criteria as out of scope):** `case-workspace.spec.ts`'s "T-07 ... applying a filter shows 'Showing N of M' with N <= M" test fails (`expect(visible).toBeLessThan(total)`, both measured as 11) both BEFORE and AFTER this plan's changes — confirmed by running it with this plan's test-file edits reverted via `git stash`, which reproduces the identical failure. This is the exact witness-filter flake the plan's Task 2 `<done>` criterion names explicitly as "independently reproducible on the UN-fixed file too... out of scope for this gap." Not fixed, per plan scope. 19/20 tests in the file pass; the one failure is this pre-existing, unrelated flake.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 09-UAT.md gap test 6 is now genuinely re-closed: the chevron/description column-width fix actually takes effect (proven via full Docker rebuild + live measurement, not just unit-level selector matching), and the regression is now covered by width-specific assertions that would have caught 09-19's original dead-selector mistake immediately.
- The one pre-existing "Showing N of M" flake in `case-workspace.spec.ts` remains open but is explicitly out of scope for this gap per the plan's own `<done>` criteria; it predates this plan and is unrelated to the chevron/description column-width defect.
- No blockers for phase transition.

---
*Phase: 09-ui-tickets-and-typography-standard*
*Completed: 2026-10-10*

## Known Stubs

None found — scanned both changed files (`src/components/case/ExhibitTable.module.scss`, `e2e/case-workspace.spec.ts`) for TODO/FIXME/placeholder/not-implemented markers. The only "placeholder" hits are pre-existing, unrelated references to the deliberate disabled "Add exhibit" placeholder button (a documented scope boundary from an earlier phase, not incomplete code from this plan).

## Self-Check: PASSED

- `src/components/case/ExhibitTable.module.scss` — FOUND on disk
- `e2e/case-workspace.spec.ts` — FOUND on disk
- `.planning/phases/09-ui-tickets-and-typography-standard/09-21-SUMMARY.md` — FOUND on disk
- Commit `778901f` (Task 1 fix) — FOUND in git log
- Commit `6cdc489` (Task 2 test) — FOUND in git log
- `npx tsc --noEmit` — EXIT 0
- `npm run build` — EXIT 0
- `npx playwright test e2e/case-workspace.spec.ts --workers=1` — 19/20 passed; the 1 failure is the pre-existing, unrelated "Showing N of M" witness-filter flake, independently reproduced as failing on the UN-fixed file (confirmed via `git stash`), and documented as out of scope by the plan's own `<done>` criteria.
- No blocking stubs found.
