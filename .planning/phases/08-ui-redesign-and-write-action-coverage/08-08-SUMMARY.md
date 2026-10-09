---
phase: 08-ui-redesign-and-write-action-coverage
plan: 08
subsystem: api
tags: [exhibit-detail, jury-eligibility, custody, objections, read-projection]

# Dependency graph
requires:
  - phase: 08-07
    provides: "exported loadJuryEligibilityByExhibit — the single Included/Blocked/Not-eligible precedence implementation"
provides:
  - "getExhibitHistory additionally returns objections[] (UNRESOLVED ObjectionCurrentState rows), custodyCard (current + full history, pendingTransfer always null), and juryPackageChecklist (4 booleans + shared eligibility)"
affects: [08-12, 08-13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Read-time projection: new response fields are projections of data already loaded or loadable from existing services — zero new query path, zero new business logic"
    - "Single-source precedence reuse: eligibility calls 08-07's loadJuryEligibilityByExhibit with a 1-element array rather than re-deriving branch logic (cross-screen parity by construction)"

key-files:
  created: []
  modified:
    - "src/services/history.ts — ExhibitHistoryResponse += objections/custodyCard/juryPackageChecklist"
    - "src/services/history.test.ts — 8 new self-contained cases for the three sections"
    - "src/app/api/exhibits/[id]/history/route.test.ts — HTTP JSON round-trip assertion for the three new fields"

key-decisions:
  - "custodyCard.pendingTransfer is a hard-typed null literal (F19 propose/confirm/cancel is Phase-7.1 scope, skipped) — the card has exactly two states"
  - "classificationTrial = !exhibit.isSealed (F16 classification column is skipped; isSealed is this phase's substitute, matching 08-06's attention feed and juryPackage.ts)"
  - "New Phase-8 test cases use self-contained fixtures (live service write paths, unique caseNumber) rather than the shared seed, so cardinality/eligibility assertions are deterministic under fileParallelism:false"

patterns-established:
  - "Read-side amendments ride along on the existing response object — no route code change needed; tests prove the HTTP round-trip"

# Metrics
duration: 3min
completed: 2026-10-09
---

# Phase 8 Plan 08: Exhibit Detail right-rail data surface Summary

**getExhibitHistory now additionally returns objections[], custodyCard, and juryPackageChecklist — the three Exhibit Detail right-rail data sources — as read-time projections with zero new query path, eligibility delegated to 08-07's single-source precedence helper.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-10-09T12:20:37Z
- **Completed:** 2026-10-09T12:23:47Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Widened `ExhibitHistoryResponse` with `objections` (every UNRESOLVED `ObjectionCurrentState` row — zero/one/several), `custodyCard` (`{current, pendingTransfer: null, history[]}` via `custody.ts`'s own `getCustodyHistory`), and `juryPackageChecklist` (`admitted`, `objectionsResolved`, `custodianOnRecord`, `classificationTrial`, `eligibility`).
- `juryPackageChecklist.eligibility` is computed by calling 08-07's exported `loadJuryEligibilityByExhibit(caseId, [exhibitId])` — zero re-derivation of the Included/Blocked/Not-eligible precedence anywhere in `history.ts` (verified by grep: only the type-union literal references those tokens, no branch logic).
- All three new sections are computed **after** the existing `getExhibit` sealed-masking early return, inheriting the same anti-enumeration guarantee (threat T-08-13) — a sealed/unauthorized request never reaches the new code.
- No change to the existing `timeline`/`discrepancyFlags`/`currentStatus`/`currentCustodianName` computation or the sealed-masking gate.

## Task Commits

1. **Task 1: Add objections[]/custodyCard/juryPackageChecklist to getExhibitHistory** — `14174ec` (feat)
2. **Task 2: Tests for the three new response sections** — `fb8936e` (test)

## Files Created/Modified
- `src/services/history.ts` — imports (`CustodyCurrentState`, `ObjectionCurrentState`, `loadJuryEligibilityByExhibit`, `getCustodyHistory`); widened response interface; computed the three sections; added them to the return object.
- `src/services/history.test.ts` — new `describe('getExhibitHistory — Phase 8 right-rail sections (F10)')` block with 8 self-contained-fixture cases.
- `src/app/api/exhibits/[id]/history/route.test.ts` — one assertion proving all three new fields survive the HTTP JSON round-trip (always-present empty/default forms).

## Decisions Made
- `custodyCard.pendingTransfer` is a hard-typed `null` literal — F19's propose/confirm/cancel is Phase-7.1 scope (skipped per CONTEXT), so the Chain of Custody card has exactly two states.
- `classificationTrial` is `!exhibit.isSealed` — F16's classification column doesn't exist; `isSealed=false` is this phase's substitute, matching every other classification-shaped check already made this phase.
- New Phase-8 test cases use self-contained fixtures (live service write paths, unique `caseNumber`) rather than the shared seed — this makes the precise cardinality/eligibility assertions (2 concurrent objections, INCLUDED-in-package all-true, sealed) deterministic under `fileParallelism:false`, sidestepping the recurring shared-seed flakiness noted by sibling Phase-8 plans. The existing seed-backed assertions in the file are untouched.

## Deviations from Plan

None - plan executed exactly as written.

The plan's worked example showed `const eligibilityByExhibit = await loadJuryEligibilityByExhibit(...)` placed inline among the `custodyState`-dependent computation; that ordering was followed verbatim. The plan's test `<action>` suggested mapping some scenarios onto the real seed (which creates no JuryPackage, so every seed exhibit is `NOT_ELIGIBLE`); the INCLUDED/2-concurrent-objection/sealed scenarios genuinely require controlled state, so they were built as self-contained fixtures — this is the file's other established pattern (the sealed-masking `describe` already creates its own fixture), not a deviation from the plan's intent (all seven requested scenarios are covered).

## Known Stubs

None found — grep for `TODO|FIXME|placeholder|not.?implemented|coming soon` across all three changed files returned nothing; no hardcoded/static returns, no swallowed errors.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- This is the **only** backend change the Exhibit Detail redesign (08-12, 08-13) needs — the right-rail Objection / Chain-of-Custody / Jury-Package-checklist cards now have a stable data contract to render against.
- `juryPackageChecklist.eligibility` is guaranteed identical to the Case Workspace's `juryPackageEligibility` for the same exhibit (both call the one exported `loadJuryEligibilityByExhibit`), so cross-screen parity holds by construction.

## Self-Check: PASSED
- FOUND: `src/services/history.ts`
- FOUND: commit `14174ec` (Task 1)
- FOUND: commit `fb8936e` (Task 2)
- Build check: `npx next build` → exit 0
- Verify: `npx tsc --noEmit` → exit 0; `npx vitest run src/services/history.test.ts src/app/api/exhibits/[id]/history/route.test.ts` → 19 passed (19)
- `## Known Stubs` present, no blocking entries

---
*Phase: 08-ui-redesign-and-write-action-coverage*
*Completed: 2026-10-09*
