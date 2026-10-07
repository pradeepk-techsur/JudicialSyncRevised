---
phase: 02-core-screens
plan: 03
subsystem: api
tags: [seed, prisma, nextjs, api, bootstrap, role-based-visibility]

# Dependency graph
requires:
  - phase: 01-data-foundation
    provides: seed loader (runSeed/assertSeedIntegrity), createExhibit/recordStatusChange/recordCustodyTransfer service path, typed error layer + errorResponse envelope, Exhibit.isSealed column
provides:
  - "src/lib/constants.ts DEMO_CASE_NUMBER — single source of truth for the fixed demo case number"
  - "Seeded sealed exhibit (S-1, isSealed:true) with full status + custody history — Phase 2's first role-based-visibility fixture"
  - "assertSeedIntegrity 4th check — rejects any seed with zero sealed exhibits"
  - "src/services/cases.ts getActiveCaseWithUsers() — resolves the one demo case + its active persona roster"
  - "GET /api/case — app-shell bootstrap endpoint (caseId + 6-persona roster in one call)"
affects: [02-02 role-based visibility, 02-05 app shell / role switcher, 02-06 / 02-07 sealed-visibility Playwright assertions, F9 Case Workspace, F10 Exhibit Detail]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared constant extraction (DEMO_CASE_NUMBER) imported by both seed loader and service layer"
    - "Read-only bootstrap endpoint: thin GET route delegating to a single service function, null -> 404 via typed NotFoundError + errorResponse"

key-files:
  created:
    - src/lib/constants.ts
    - src/services/cases.ts
    - src/services/cases.test.ts
    - src/app/api/case/route.ts
    - src/app/api/case/route.test.ts
  modified:
    - src/data/seed.ts
    - src/data/seed.test.ts

key-decisions:
  - "makeExhibit gains an optional { isSealed } options object (defaulting false) so all 8 prior Phase 1 call sites stay untouched — minimal diff, no 5th positional param"
  - "The sealed exhibit (S-1) is built exclusively through createExhibit/recordStatusChange/recordCustodyTransfer — zero direct ledger/projection inserts, preserving Phase 1's T-01-17 seed-integrity guarantee (threat T-02-08)"
  - "GET /api/case returns the full 6-persona roster unfiltered — accepted risk T-02-07 (synthetic demo personas, no real PII; the role switcher needs the whole roster)"
  - "Not-found route path tested by deleting then restoring the shared seed, safe under vitest fileParallelism:false (files run sequentially against the one Postgres)"

patterns-established:
  - "Pattern: fixed demo identifiers live in src/lib/constants.ts, never re-literalled per module"
  - "Pattern: bootstrap/read service returns null for absence; the route maps null -> typed 404, not the service"

# Metrics
duration: 8 min
completed: 2026-10-07
---

# Phase 2 Plan 3: Case Bootstrap + Sealed-Exhibit Fixture Summary

**Added a sealed demo exhibit (S-1) with full status/custody history as Phase 2's first role-based-visibility fixture, plus a `GET /api/case` bootstrap endpoint resolving the active caseId and 6-persona roster in one call via a new `cases.ts` service keyed off the newly-extracted `DEMO_CASE_NUMBER` constant.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-10-07T06:05:00Z
- **Completed:** 2026-10-07T06:12:57Z
- **Tasks:** 2
- **Files modified:** 7 (5 created, 2 modified)

## Accomplishments
- `DEMO_CASE_NUMBER` extracted to `src/lib/constants.ts` as the single source of truth, imported by both the seed loader and the case-resolution service.
- Seed now plants a 9th exhibit `S-1` (`isSealed: true`) with a complete MARKED→OFFERED→ADMITTED status chain and a chambers-intake custody record — the concrete row later screens filter by role.
- `assertSeedIntegrity` grew a 4th check: the seed is rejected if zero sealed exhibits exist.
- New read-only `getActiveCaseWithUsers()` service + `GET /api/case` route give the client the caseId and persona roster with no prior UUID knowledge.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract DEMO_CASE_NUMBER + plant a sealed exhibit in seed data** - `1685cbc` (feat)
2. **Task 2: Active-case resolution service + bootstrap endpoint** - `b0c1340` (feat)

**Plan metadata:** (docs commit — this SUMMARY + STATE.md)

## Files Created/Modified
- `src/lib/constants.ts` - Exports `DEMO_CASE_NUMBER` (the fixed `2026-CR-0142`).
- `src/data/seed.ts` - Imports `DEMO_CASE_NUMBER`; `makeExhibit` gains `{ isSealed }` options; plants sealed exhibit `S-1`; `assertSeedIntegrity` adds the sealed-exhibit check.
- `src/data/seed.test.ts` - Asserts exactly one `S-1` sealed exhibit and that the loader always restores it.
- `src/services/cases.ts` - `getActiveCaseWithUsers()` resolving the demo case + active roster.
- `src/services/cases.test.ts` - Integration test: case matches `DEMO_CASE_NUMBER`, 6 users one-per-Role, non-empty names.
- `src/app/api/case/route.ts` - `GET /api/case` → 200 `{ case, users }` | 404 `CASE_NOT_FOUND`.
- `src/app/api/case/route.test.ts` - Covers both the 200 (6-user) and 404 paths.

## Decisions Made
- See key-decisions in frontmatter. In brief: optional-options arg on `makeExhibit` (minimal diff), sealed exhibit built only through the live service path, unfiltered roster (accepted T-02-07), not-found tested via delete-then-restore under serial file execution.

## Deviations from Plan

None - plan executed exactly as written.

The plan offered the `makeExhibit` options-object approach as its preferred option and it was adopted verbatim; the not-found route test followed the existing route-test style (direct handler invocation against the real DB).

## Issues Encountered
- **Transient file revert during Task 1:** `src/lib/constants.ts` and the first round of `src/data/seed.ts` edits were silently reverted after being written (the first seed run showed 8 exhibits, not 9), almost certainly a parallel wave-1 plan touching the working tree. Re-applied all edits; the re-run produced the expected 9 exhibits and all tests passed. No data loss, no scope impact.

## Deferred Issues
- **`npm run build` currently fails — out of scope.** `src/app/api/exhibits/[id]/route.ts` imports `@/services/visibility`, a module owned by the in-flight parallel plan **02-02** and not yet present. This also produces `tsc` errors in `src/services/exhibits.test.ts` and `src/services/visibility.test.ts`. None of these are 02-03 files; all 02-03 files compile and test cleanly in isolation (9/9 tests pass). Logged to `deferred-items.md`. The build is expected to go green once 02-02 lands. No action for 02-03.

## Known Stubs
None found — grep for TODO/FIXME/placeholder/not-implemented across all 02-03 files returned nothing; both tasks are fully implemented and verified against the real seeded Postgres.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `GET /api/case` + the seeded sealed exhibit `S-1` are the prerequisites for the 02-05 app shell / role switcher and the 02-06/02-07 sealed-visibility assertions — both are now in place.
- One cross-plan dependency remains: the whole-project build only goes green once the parallel 02-02 visibility plan lands `@/services/visibility`.

---
*Phase: 02-core-screens*
*Completed: 2026-10-07*

## Self-Check: PASSED

- All 5 created files present on disk (constants.ts, cases.ts, cases.test.ts, case/route.ts, case/route.test.ts) + SUMMARY.md.
- Both task commits present: `1685cbc` (Task 1), `b0c1340` (Task 2).
- All 9 plan-specified tests pass (seed.test.ts 5, cases.test.ts 2, case/route.test.ts 2).
- All three integration contracts verified (DEMO_CASE_NUMBER export, GET export, isSealed:true in seed).
- No blocking stubs. Plan-level `npm run build` fails only on the in-flight parallel plan 02-02's missing `@/services/visibility` — out of scope, logged to deferred-items.md; all 02-03 files compile cleanly in isolation.
