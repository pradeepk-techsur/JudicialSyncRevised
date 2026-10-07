---
phase: 03-jury-package-discrepancy-detection
plan: 03
subsystem: ui
tags: [discrepancy, case-workspace, react, prisma, playwright, seed]

# Dependency graph
requires:
  - phase: 03-01
    provides: getExhibitDiscrepancies, DiscrepancyFlag model, DiscrepancyFlagSummary type, ruleLabel() single-source label map, evaluateDiscrepancies wired into write paths
  - phase: 03-02
    provides: jury-package + discrepancy HTTP surface (acknowledge flips flags OPEN→ACKNOWLEDGED)
  - phase: 02-04
    provides: ExhibitListRow shared row shape + single toListRow mapper
  - phase: 02-06
    provides: Case Workspace one-hook + presentational-components pattern
provides:
  - ExhibitListRow.discrepancyFlags widened from [] placeholder to real DiscrepancyFlagSummary[]
  - Batch-load of OPEN+ACKNOWLEDGED flags per page (no N+1) in getExhibits/searchExhibits
  - ExhibitHistoryResponse.discrepancyFlags populated from getExhibitDiscrepancies
  - DiscrepancyBadge component (amber OPEN / muted ACKNOWLEDGED / "N issues" collapse)
  - Case Workspace ⚑ column surfacing live discrepancy badges
  - assertSeedIntegrity asserting both discrepancy rules fire out of the box
affects: [03-04 Jury Package Workspace Screen, Exhibit Detail banner, Trial Command Center]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Batch-load-then-group: one discrepancyFlag.findMany keyed on the page's sealed-filtered exhibitIds, grouped into a Map, fed to toListRow — never N+1 per row"
    - "Presentational badge consumes the single DiscrepancyFlagSummary type + ruleLabel source (never redefines them) so copy can't drift across screens"
    - "Seed integrity as a boot-time demo-blocking guarantee: engine-produced flags asserted post-seed, rolling back if a rule silently stops firing"

key-files:
  created:
    - src/components/case/DiscrepancyBadge.tsx
    - e2e/case-workspace-discrepancies.spec.ts
  modified:
    - src/lib/types.ts
    - src/services/exhibits.ts
    - src/services/exhibits.test.ts
    - src/services/history.ts
    - src/services/history.test.ts
    - src/components/case/ExhibitTable.tsx
    - src/data/seed.ts
    - src/data/seed.test.ts
    - src/app/api/cases/[id]/exhibits/search/route.test.ts

key-decisions:
  - "discrepancyFlags batch-loaded in a single grouped query keyed on already-sealed-filtered exhibitIds (no N+1; T-03-09 — a sealed exhibit's flags never reach an unauthorized client)"
  - "Multi-flag badge collapses to '⚠ N issues' with every label exposed via title + aria-label; single flag renders the plain-language label inline — text always visible, never icon-only"
  - "Seed integrity extended to assert ≥1 OPEN flag per rule; flags arise only from the live engine (grep forbids prisma.discrepancyFlag.create in seed.ts, extending T-01-17/T-03-10)"

patterns-established:
  - "Pattern: one shared row shape + one label source feeds the list column, the history banner, and the jury view — zero client-side discrepancy derivation"

# Metrics
duration: 10min
completed: 2026-10-07
---

# Phase 3 Plan 3: Case Workspace Discrepancy Surfacing Summary

**The Case Workspace ⚑ column now renders live amber/muted plain-language discrepancy badges from a widened ExhibitListRow, and the seeded demo provably fires both discrepancy rules on boot so the finalize gate visibly blocks.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-10-07T14:08:00Z
- **Completed:** 2026-10-07T14:16:30Z
- **Tasks:** 3
- **Files modified:** 10 (2 created, 8 modified)

## Accomplishments
- Widened the single shared `ExhibitListRow.discrepancyFlags` from the `[]` placeholder to real `DiscrepancyFlagSummary[]`, batch-loaded once per page (no N+1) via one grouped `discrepancyFlag.findMany` and mapped through the single `ruleLabel` source — both `getExhibits` and `searchExhibits` feed `toListRow` identically so they cannot drift.
- Built `DiscrepancyBadge`: amber badge + plain-language label for OPEN flags, muted "Ack'd" label for ACKNOWLEDGED, and an accessible "⚠ N issues" collapse for multiples (every label in `title`/`aria-label`) — text always visible, never icon-only. Wired it into the Case Workspace ⚑ column; row click-through to Exhibit Detail preserved (acknowledge is not inline here).
- Populated `ExhibitHistoryResponse.discrepancyFlags` from `getExhibitDiscrepancies`, lighting up the existing amber banner guard in `ExhibitHeader.tsx` (03-04 refines the banner).
- Extended `assertSeedIntegrity` to assert ≥1 OPEN `ADMITTED_NO_CUSTODIAN` and ≥1 OPEN `UNRESOLVED_OBJECTION_JURY_ELIGIBLE` flag exist after seed — a boot-time, demo-blocking guarantee that the flags arise purely from the live engine (no direct inserts; grep-enforced).

## Task Commits

Each task was committed atomically:

1. **Task 1: Widen ExhibitListRow + toListRow + history** - `8dce9a0` (feat)
2. **Task 2: DiscrepancyBadge + Case Workspace column** - `eae9b68` (feat)
3. **Task 3: Seed integrity asserts both rules fire** - `108e422` (feat)

**Follow-up deviation fix:** `64a49a5` (fix — search route test stale `discrepancyFlags:[]` expectation)

## Files Created/Modified
- `src/lib/types.ts` - `ExhibitListRow.discrepancyFlags` widened to `DiscrepancyFlagSummary[]`; stale comment updated
- `src/services/exhibits.ts` - `loadDiscrepancyFlagsByExhibit` batch-loader + grouped; `toListRow` takes flags; getExhibits/searchExhibits attach them
- `src/services/history.ts` - `discrepancyFlags` widened + populated from `getExhibitDiscrepancies`
- `src/components/case/DiscrepancyBadge.tsx` - new presentational badge (OPEN/ACKNOWLEDGED/collapse)
- `src/components/case/ExhibitTable.tsx` - ⚑ column renders `DiscrepancyBadge`
- `src/data/seed.ts` - `assertSeedIntegrity` asserts both OPEN rule flags present
- `src/data/seed.test.ts` - asserts both OPEN rule codes; grep forbids `discrepancyFlag.create`
- `src/services/exhibits.test.ts`, `src/services/history.test.ts`, `src/app/api/cases/[id]/exhibits/search/route.test.ts` - assert real flags on P-2/P-3, `[]` on clean rows
- `e2e/case-workspace-discrepancies.spec.ts` - new Playwright spec (4 tests)

## Decisions Made
- **Batch-load-then-group, keyed on sealed-filtered ids:** flags are loaded in one query over the page's already-visibility-filtered exhibitIds and grouped into a Map, so there is no N+1 and a sealed exhibit's flags can never reach an unauthorized client (T-03-09).
- **Text-always-visible badge:** a single flag renders its label inline; multiples collapse to "N issues" but still expose every label via `title`/`aria-label` and an inline list — satisfies US-9.2 "visible without drill-in" and accessibility.
- **Seed integrity as demo gate:** the two rule assertions convert "the engine is wired" into a fail-fast guarantee; if a future change stops a rule firing on seed, the seed throws and rolls back rather than shipping a jury screen that cannot demonstrate the gate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stale `discrepancyFlags: []` assertions in pre-Phase-3 tests**
- **Found during:** Task 1 (widening the row) and overall verification
- **Issue:** `history.test.ts` ("returns discrepancyFlags as [] for every exhibit in this phase") and `search/route.test.ts` ("witness=Finch matches P-3") both asserted the `[]` placeholder for seeded exhibits that Phase 3 now legitimately flags — their premise is exactly what this plan overturns. Left unchanged they would fail.
- **Fix:** Updated both to assert the real engine-produced flags (`ADMITTED_NO_CUSTODIAN` on P-2, `UNRESOLVED_OBJECTION_JURY_ELIGIBLE` on P-3) while still asserting `[]` for genuinely clean rows (P-4, fresh fixtures) and preserving the no-raw-`id`-leak check.
- **Files modified:** src/services/history.test.ts, src/app/api/cases/[id]/exhibits/search/route.test.ts
- **Verification:** full vitest suite 152/152 passing
- **Committed in:** 8dce9a0 (history test), 64a49a5 (route test)

The plan explicitly anticipated this ("update only clean-exhibit expectations"); the route test was the one not named in the plan's file list but broken by the same widening.

---

**Total deviations:** 1 auto-fixed (1 bug — stale test assertions).
**Impact on plan:** Necessary for correctness; no scope creep. All production code matches the plan exactly.

## Known Stubs

None found. (Two `grep` hits for "placeholder" in `src/services/exhibits.ts` are prose describing the *old* `[]` approach and the sealed-exclusion behaviour, not incomplete code.)

## Issues Encountered
- The running docker `app` container served the pre-change build, so the first Playwright run failed to find the badge. Resolved by `docker compose up -d --build app` (the compose-native path; also re-runs migrate → seed → serve). After restart, all 4 new + 5 existing Case Workspace e2e tests pass.

## Self-Check: PASSED

- Created files exist: `src/components/case/DiscrepancyBadge.tsx`, `e2e/case-workspace-discrepancies.spec.ts` — both FOUND.
- Commits exist: `8dce9a0`, `eae9b68`, `108e422`, `64a49a5` — all FOUND on `phase-3`.
- Build: `npm run build` → exit 0 (passed).
- tsc: `npx tsc --noEmit` → clean.
- Tests: vitest 152/152 passing; Playwright 19/19 passing (`--workers=1`).
- `## Known Stubs` present; no blocking stubs.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `DiscrepancyBadge` + the widened `ExhibitListRow`/history response are ready for 03-04 (Jury Package Workspace Screen) to reuse.
- The seeded demo now fires both rules on boot, so 03-04's finalize gate has real OPEN flags to block on and real ACKNOWLEDGED flags to re-enable on.

---
*Phase: 03-jury-package-discrepancy-detection*
*Completed: 2026-10-07*
