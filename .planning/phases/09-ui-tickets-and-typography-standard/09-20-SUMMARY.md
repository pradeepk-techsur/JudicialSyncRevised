---
phase: 09-ui-tickets-and-typography-standard
plan: 20
subsystem: ui
tags: [carbon, scss, playwright, shell-layout, accessibility]

# Dependency graph
requires:
  - phase: 09-ui-tickets-and-typography-standard
    provides: "09-09's ActiveRoleBanner/Header role-switcher safety affordances (T-09), which this plan repairs a horizontal-overlap readability regression and a label-visibility/alignment defect in"
provides:
  - "ActiveRoleBanner text is never hidden under the fixed sidebar after a role switch (padding-inline-start: 16rem)"
  - "Role switcher has no visible 'Demo role:' label text (Carbon hideLabel), while the aria-label-driven accessible name is unchanged"
  - "Role switcher's left edge pixel-aligns with every page title's own left edge (17.5rem absolute positioning via new Header.module.scss)"
  - "2 new Playwright regression tests locking both fixes in e2e/app-shell.spec.ts"
affects: ["09-UAT gaps UAT-9 and UAT-16"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shell-chrome rail-width/header-height constants (16rem sidebar, 17.5rem = 16rem+1.5rem main padding) are shared, undocumented-by-code literals across AppShell.module.scss/Sidebar.module.scss/ActiveRoleBanner.module.scss/Header.module.scss — kept in sync manually via comments, same pattern Sidebar.module.scss already used for its 3rem header-height constant"

key-files:
  created:
    - src/components/shell/Header.module.scss
  modified:
    - src/components/shell/ActiveRoleBanner.module.scss
    - src/components/shell/Header.tsx
    - e2e/app-shell.spec.ts

key-decisions:
  - "Fixed the banner's sidebar-overlap at the single .banner padding-inline-start property (not a component restructure) — the overlap was purely a missing horizontal offset, identical root-cause CLASS to 08-16's vertical sidebar/header fix but a distinct bug"
  - "Used Carbon's own hideLabel prop (applies cds--visually-hidden) rather than removing the <label> element, so the existing aria-label/htmlFor-driven accessible name and every pre-existing Playwright getByLabel('Switch active role') locator stay completely unaffected"
  - "Absolutely positioned the switcher's form-item at a literal 17.5rem via a new Header.module.scss, rather than restructuring Header's flex layout — Carbon's fixed-position Header gives an absolutely-positioned child the exact coordinate space the page title's own margin/padding chain resolves into"

patterns-established: []

# Metrics
duration: 12min
completed: 2026-10-10
---

# Phase 9 Plan 20: App Shell Header/Banner Gap Closure (UAT-9, UAT-16) Summary

**Added a 16rem left inset to ActiveRoleBanner so the fixed sidebar never covers its text, and absolutely-positioned the role switcher at 17.5rem (hideLabel + pixel-aligned with the page title) via a new Header.module.scss.**

## Performance

- **Duration:** 12 min (task commits) — full session including seed/verification overhead longer due to shared-working-tree contention from sibling Phase 9 plans
- **Started:** 2026-10-10T21:53:33Z
- **Completed:** 2026-10-10T22:05:11Z
- **Tasks:** 3/3 completed
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- UAT-9 fixed: after a role switch, the "Active role: X" banner's text is now fully visible — never hidden under the fixed 16rem-wide sidebar — confirmed via both a bounding-box check and a center-point hit-test
- UAT-16 fixed: the redundant visible "Demo role:" label is gone (Carbon's `hideLabel`), and the switcher's dropdown now pixel-aligns (≤2px) with the page title's left edge on every main screen
- 2 new Playwright regression tests lock both fixes against future shell-layout regressions; full `app-shell.spec.ts` suite (14/14) green with zero regressions in the 12 pre-existing tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix the ActiveRoleBanner's sidebar-hidden text (UAT-9)** - `f99f866` (fix)
2. **Task 2: Drop the visible "Demo role:" label and left-align the switcher (UAT-16)** - `3100c07` (fix)
3. **Task 3: Playwright regression coverage for both fixes** - `3ff554b` (test)

_No plan-metadata commit yet — pending (this commit)._

## Files Created/Modified
- `src/components/shell/ActiveRoleBanner.module.scss` - Added `padding-inline-start: 16rem` to `.banner`, matching the shared sidebar rail-width constant
- `src/components/shell/Header.module.scss` - **New.** `.roleSwitcherWrap` absolutely positions the role-switcher's Carbon form-item at `inset-inline-start: 17.5rem` (16rem sidebar + 1.5rem main padding)
- `src/components/shell/Header.tsx` - Role-switcher `<Select>` gets `hideLabel` + `className={styles.roleSwitcherWrap}`; updated the surrounding comment block to reflect both changes
- `e2e/app-shell.spec.ts` - 2 new tests: banner-not-obscured-by-sidebar (UAT-9), and label-hidden+title-aligned (UAT-16)

## Decisions Made
- Single-property CSS fix for the banner (no component restructuring) — see key-decisions in frontmatter
- Carbon's native `hideLabel` prop over DOM-level label removal, to keep the accessible name and every dependent Playwright locator byte-for-byte unchanged
- Absolute positioning at a literal `17.5rem` (not a computed/shared SCSS variable) — matches the existing pattern in `AppShell.module.scss`/`Sidebar.module.scss`, which also hardcode their shared rail-width/header-height constants with a "keep in sync" code comment rather than a shared SCSS token

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Generated the missing Prisma client**
- **Found during:** Task 1 verification (`npx tsc --noEmit`)
- **Issue:** `node_modules/.prisma/client` did not exist in this fresh sandbox checkout, so every file importing `@prisma/client` types failed with "no exported member" errors — a pre-existing environment gap, not caused by this plan's edits
- **Fix:** Ran `npx prisma generate`
- **Files modified:** none (generated artifact, not source-controlled)
- **Verification:** `tsc --noEmit` error count dropped from ~30 Prisma-type errors to zero in that category
- **Committed in:** N/A (no source change — a one-time environment fix)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary one-time environment fix with zero footprint on the plan's actual deliverables. No scope creep.

## Issues Encountered

**Shared-working-tree / shared-DB hazard (the same recurring Phase 8/9 pattern documented in every prior plan's STATE.md entry and `deferred-items.md`):**
- Sibling Phase 9 plan **09-18** (F-09-01 `POST /api/exhibits` role gate fix) had in-flight, uncommitted edits to `src/services/exhibits.ts` adding a new required `actorUserId` field, mid-landing its own dependent test-fixture updates across ~8 test files throughout this plan's execution. This caused `tsc --noEmit`/`npm run build` to transiently fail on ~15 "actorUserId is missing" errors in files entirely outside 09-20's scope (`exhibits.test.ts`, `activity.test.ts`, `attentionFeed.test.ts`, `custodyByCustodian.test.ts`, two `route.test.ts` files) at the time of Task 1's verification. Confirmed NOT caused by my changes: none of my touched files (`Header.tsx`, `Header.module.scss`, `ActiveRoleBanner.*`, `e2e/app-shell.spec.ts`) appeared anywhere in the error list, verified via targeted `grep`. By the time of final verification the sibling had finished landing its fixture updates in the shared working tree, and `tsc --noEmit`/`npm run build` both reached a clean EXIT 0 tree-wide. Documented in `.planning/phases/09-ui-tickets-and-typography-standard/deferred-items.md` per SCOPE BOUNDARY; not fixed by this plan (not this plan's files).
- A concurrent sibling Playwright run (`e2e/case-workspace.spec.ts`) and vitest run were mutating the shared seeded demo case (`2026-CR-0142`) during my own `command-center.spec.ts` confirmation runs, producing transient failures (`Seed fixture P-5 not found`, missing quick-filter chips, empty attention-feed row) in tests entirely unrelated to this plan's Header/ActiveRoleBanner changes. Re-ran each individually in isolation once the sibling processes finished and the shared DB was re-seeded cleanly — all passed. This plan's actual `<verification>` target, `e2e/app-shell.spec.ts`, was run repeatedly throughout (including once concurrently with the sibling's active Playwright run) and was 14/14 green every time, proving the fix is stable independent of the shared-DB noise. Not a defect in this plan's work.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Both UAT-9 and UAT-16 gaps are closed with automated regression coverage; `tsc --noEmit` and `npm run build` are clean tree-wide as of this plan's completion
- This was a gap-closure plan (`gap_closure: true`) against Phase 9's UAT findings — no new phase work is blocked or enabled by it
- The remaining open item from `09-18`/`09-19`'s concurrent sibling work (F-09-01 exhibits role gate, UAT-6 table column fix) is each of those plans' own responsibility to commit and summarize — left untouched here per SCOPE BOUNDARY

---
*Phase: 09-ui-tickets-and-typography-standard*
*Completed: 2026-10-10*

## Self-Check: PASSED

- `src/components/shell/Header.module.scss` — FOUND
- `src/components/shell/ActiveRoleBanner.module.scss` (padding-inline-start: 16rem) — FOUND
- `src/components/shell/Header.tsx` (hideLabel + styles.roleSwitcherWrap) — FOUND
- `e2e/app-shell.spec.ts` (2 new UAT-9/UAT-16 tests) — FOUND
- Commit `f99f866` — FOUND (`git log --oneline --all | grep f99f866`)
- Commit `3100c07` — FOUND
- Commit `3ff554b` — FOUND
- Build check: `npm run build` → exit 0 (tree-wide, after sibling 09-18 landed its own fixture updates)
- `tsc --noEmit` → exit 0 (tree-wide)
- `npx playwright test e2e/app-shell.spec.ts --workers=1` → 14/14 passed (verified across 3 separate runs, including one concurrent with a sibling plan's active Playwright suite)

## Known Stubs

None found. Scanned all 4 touched files for TODO/FIXME/placeholder/not-implemented markers — the single hit (`e2e/app-shell.spec.ts:56`) is a pre-existing comment describing an already-shipped, unrelated Phase 5 feature ("no longer any disabled placeholder"), not a stub introduced by this plan.
