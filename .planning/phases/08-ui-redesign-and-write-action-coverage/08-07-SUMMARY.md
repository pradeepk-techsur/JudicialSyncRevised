---
phase: 08-ui-redesign-and-write-action-coverage
plan: 07
subsystem: api
tags: [exhibits, jury-package, case-workspace, discrepancy, objections, prisma, f09]

# Dependency graph
requires:
  - phase: 02-core-screens
    provides: ExhibitListRow + the shared toListRow mapper (getExhibits/searchExhibits never drift)
  - phase: 03-jury-package-discrepancy-detection
    provides: JuryPackage / JuryPackageExhibit projections + loadDiscrepancyFlagsByExhibit batch-load pattern
provides:
  - ExhibitListRow widened with juryPackageEligibility (INCLUDED|BLOCKED|NOT_ELIGIBLE), hasUnresolvedObjection, isSealed
  - loadJuryEligibilityByExhibit(caseId, exhibitIds) — the single F09 §Process step 3 precedence implementation (exported for 08-08 reuse)
  - getExhibits / searchExhibits populate all three additive fields via one batched, sealed-safe query path
affects: [08-08, 08-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single exported precedence function (loadJuryEligibilityByExhibit) consumed by both the list screen and 08-08's single-exhibit checklist — zero drift by construction"
    - "Additive ExhibitListRow fields batch-loaded in one Promise.all over the already sealed-filtered exhibitIds (no N+1, no sealed leak — T-08-12)"

key-files:
  created: []
  modified:
    - src/lib/types.ts
    - src/services/exhibits.ts
    - src/services/exhibits.test.ts
    - src/app/api/cases/[id]/exhibits/route.test.ts
    - src/app/api/cases/[id]/exhibits/search/route.test.ts

key-decisions:
  - "juryPackageEligibility precedence reads the case's SINGLE most-recently-computed JuryPackage only (orderBy createdAt desc); an older package never overrides the newest"
  - "hasUnresolvedObjection reads ObjectionCurrentState UNRESOLVED directly — deliberately NOT a DiscrepancyFlag read, since an unresolved objection on a non-ADMITTED exhibit fires no discrepancy rule"
  - "isSealed rides off the raw exhibit row (Prisma include does not prune scalars) — no extra query"
  - "loadJuryEligibilityByExhibit is EXPORTED (not module-private) so 08-08 calls it for its 1-exhibit case instead of re-deriving the branch logic"

patterns-established:
  - "Pattern 1: one exported precedence impl shared across screens — the Case Workspace eligibility column and the Exhibit Detail checklist can never disagree"
  - "Pattern 2: additive list-row projections batch-loaded over the sealed-filtered id set alongside the existing discrepancy batch-load"

# Metrics
duration: 11 min
completed: 2026-10-09
---

# Phase 8 Plan 07: Case Workspace Jury-Eligibility Column Data Surface Summary

**`getExhibits`/`searchExhibits` now compute `juryPackageEligibility` (Included/Blocked/Not eligible) via the single exported F09 precedence function, plus `hasUnresolvedObjection` and `isSealed` — the only backend change the Case Workspace redesign needs, with zero screen-local derivation.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-10-09T12:00:30Z
- **Completed:** 2026-10-09T12:11:06Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Widened `ExhibitListRow` with three additive fields: `juryPackageEligibility`, `hasUnresolvedObjection`, `isSealed`.
- Added the **single, exported** `loadJuryEligibilityByExhibit(caseId, exhibitIds)` implementing the exact F09 §Process step 3 precedence (Included = INCLUDED+CLEAN > Blocked = INCLUDED+FLAGGED > Not eligible = no row / EXCLUDED / no package ever computed), reading only the case's most-recently-computed `JuryPackage`.
- Added `loadUnresolvedObjectionFlags` batch-load (ObjectionCurrentState UNRESOLVED), proven genuinely independent of `discrepancyFlags`.
- Both `getExhibits` and `searchExhibits` populate all three via the shared `toListRow` mapper in one `Promise.all` batch keyed on the already sealed-filtered `exhibitIds` (no N+1, no sealed leak — T-08-12).
- Route-level tests prove the additive fields survive the HTTP round-trip unchanged, with **no route code modified**.

## Task Commits

1. **Task 1: Widen ExhibitListRow + compute the three fields** - `ba40896` (feat)
2. **Task 2: Route-level round-trip regression check** - `90f2dac` (test)

## Files Created/Modified
- `src/lib/types.ts` - `ExhibitListRow += juryPackageEligibility | hasUnresolvedObjection | isSealed` (documented precedence/independence/sealed-safety).
- `src/services/exhibits.ts` - exported `loadJuryEligibilityByExhibit`; module-private `loadUnresolvedObjectionFlags`; widened `toListRow`; both list/search funcs thread all three via one batched, sealed-safe `Promise.all`.
- `src/services/exhibits.test.ts` - 9 new/rewritten assertions: all 3 eligibility values + no-package + EXCLUDED + most-recent-only; `hasUnresolvedObjection` independence from flags; sealed `isSealed`.
- `src/app/api/cases/[id]/exhibits/route.test.ts` - seeded INCLUDED+FLAGGED member → asserts `BLOCKED` through JSON; added the two booleans to the shape assertion.
- `src/app/api/cases/[id]/exhibits/search/route.test.ts` - asserts P-3 (non-member) round-trips `NOT_ELIGIBLE`.

## Decisions Made
- **Most-recent-package-only semantics** for eligibility (verified by a dedicated test: older CLEAN member + newer FLAGGED member → `BLOCKED`).
- **`hasUnresolvedObjection` is an ObjectionCurrentState read, not a DiscrepancyFlag read** — the two are orthogonal signals the Flags column needs to render separately ("Ruling pending" vs a discrepancy pill).
- **`loadJuryEligibilityByExhibit` exported** so 08-08's single-exhibit checklist reuses it rather than re-deriving the precedence (cross-screen parity by construction).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Rewrote the obsolete "no seeded exhibit carries an open discrepancy flag" test**
- **Found during:** Task 1 (running `exhibits.test.ts`)
- **Issue:** The `searchExhibits (F4)` block asserted `rows.every(r => r.discrepancyFlags.length === 0)`. This premise ("post-F12 no seeded exhibit can carry an open flag") is now factually false: a sibling Phase-8 plan added the **P-6/P-7 legacy-admit fixtures** (per 08-CONTEXT) that deliberately fire `ADMITTED_NO_CUSTODIAN` / `UNRESOLVED_OBJECTION_JURY_ELIGIBLE` through the live engine. Confirmed the test fails at HEAD *before* any 08-07 edit (via `git stash`), so it is a pre-existing stale assertion, not a regression I introduced.
- **Fix:** Rewrote the test to assert the correct Phase-8 reality — exactly P-6 and P-7 carry open flags (with their specific rule codes), every other exhibit clean — keeping the batch-load's flag surfacing honestly covered.
- **Files modified:** src/services/exhibits.test.ts
- **Verification:** Passes whenever the shared demo seed is whole (42/42 full verify green on a stable window).
- **Committed in:** ba40896 (Task 1 commit)

**2. [Rule 1 - Bug] Dropped the now-false `not.toHaveProperty('isSealed')` route assertion**
- **Found during:** Task 2 (list route test)
- **Issue:** `route.test.ts` asserted the response row does **not** carry `isSealed`. As of this plan `ExhibitListRow` legitimately includes `isSealed`, so the assertion is now wrong.
- **Fix:** Removed that one assertion; added `hasUnresolvedObjection`/`isSealed` to the positive shape assertion instead.
- **Files modified:** src/app/api/cases/[id]/exhibits/route.test.ts
- **Verification:** List route tests 5/5 green (isolated fixture, deterministic).
- **Committed in:** 90f2dac (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — stale tests overtaken by the intended Phase-8 reality).
**Impact on plan:** Both are test-only corrections of assertions the plan's own widening/seed-evolution made obsolete. No production-logic scope creep. No route code changed, exactly as the plan intended.

## Known Stubs
None found. (Two grep hits — `exhibits.ts:134` "old `[]` placeholder" and `:291` "redacted placeholder row" — are pre-existing descriptive comments, not stubs.)

## Issues Encountered
- **Shared-DB reseed flakiness (environmental, not a code defect):** the demo-seed-dependent tests (`searchExhibits (F4)` block + the search route test) intermittently fail while sibling Phase-8 plans run `runSeed()` (reset-then-rebuild) against the SAME shared Postgres `2026-CR-0142` case in parallel. Polling showed the case cycling through 1→4→9→2→7 exhibits continuously. This is the recurring shared-working-tree/shared-DB hazard logged across Phase 6/7 SUMMARYs. Mitigated per the documented approach: all **isolated-fixture** tests (which own their own case) pass deterministically every run; the demo-seed tests pass on every stable-seed window (full plan verify reached **42/42 green**). My plan's correctness assertions (all 3 eligibility values, the two booleans, independence) live in the isolated block and are never flaky.

## Verification Results
- `npx tsc --noEmit` → **exit 0** (whole project, including sibling plans' uncommitted files).
- `npx next build` → **exit 0** (all routes incl. `/api/cases/[id]/exhibits` + `/search` compile).
- `npx vitest run src/services/exhibits.test.ts src/app/api/cases/[id]/exhibits/route.test.ts src/app/api/cases/[id]/exhibits/search/route.test.ts` → **42/42 passed** on a stable-seed window.

## Next Phase Readiness
- 08-08 can now call `loadJuryEligibilityByExhibit(caseId, [exhibitId])` directly for the Exhibit Detail `juryPackageChecklist.eligibility` — no re-derivation.
- 08-11 (Case Workspace redesign) can render `juryPackageEligibility` / `hasUnresolvedObjection` / `isSealed` verbatim with zero screen-local derivation.

---
*Phase: 08-ui-redesign-and-write-action-coverage*
*Completed: 2026-10-09*

## Self-Check: PASSED
- Created files: none (plan modified only existing files — all 5 present on disk).
- Commits ba40896 (feat) + 90f2dac (test): both present in git history.
- Plan-level build: `npx next build` → exit 0.
- `## Known Stubs` section present; no blocking stubs.
