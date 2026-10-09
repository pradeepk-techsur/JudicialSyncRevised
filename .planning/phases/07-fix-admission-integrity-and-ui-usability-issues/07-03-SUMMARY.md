---
phase: 07-fix-admission-integrity-and-ui-usability-issues
plan: 03
subsystem: database
tags: [prisma, migration, jury-package, sealed-exhibit, discrepancy, F13]

# Dependency graph
requires:
  - phase: 03-jury-package-discrepancy-detection
    provides: computeJuryCandidates, reconcileDraftMembership, JuryPackageExhibit model, discrepancy engine
provides:
  - "JuryPackageExhibitStatus enum (INCLUDED/EXCLUDED) + JuryPackageExhibit.status/excludedAt/excludedBy/exclusionReason columns + excludedByUser relation + idx_jury_package_exhibits_package_status index"
  - "JURY_PACKAGE_EXHIBIT_EXCLUDED EventType value + its payload schema"
  - "computeJuryCandidates structurally excludes sealed exhibits from membership (isSealed:false in the candidate query)"
  - "reconcileDraftMembership retains (never deletes) a legacy sealed-but-ADMITTED JuryPackageExhibit row"
affects: [07-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Structural exclusion at the query layer (isSealed:false applied in the same findMany as the ADMITTED filter) rather than post-query view filtering"
    - "Staleness computed from each row's ACTUAL currentStatus (direct unfiltered query), decoupled from the sealed-filtered candidate set"

key-files:
  created:
    - prisma/migrations/20261009010505_add_jury_package_exhibit_exclusion/migration.sql
  modified:
    - prisma/schema.prisma
    - src/lib/validation/eventPayloads.ts
    - src/services/juryPackage.ts
    - src/services/juryPackage.test.ts
    - src/app/api/cases/[id]/jury-package/route.test.ts

key-decisions:
  - "Added JURY_PACKAGE_EXHIBIT_EXCLUDED payload schema now (ahead of its 07-07 emitter) because adding the enum value broke eventPayloadSchemas's EventType-keyed type map — a Rule 3 blocking fix"
  - "Updated three pre-F13 tests that asserted 'sealed exhibit is a member' to assert the new exclusion behavior — the plan's objective deliberately reverses that policy"

patterns-established:
  - "Pattern: sealed-exhibit exclusion is enforced at candidate computation, not at the view layer — a sealed exhibit can never become a member row via the normal path"
  - "Pattern: legacy data (a sealed row predating the fix) is retained for explicit remediation, never silently deleted during reconcile"

# Metrics
duration: 11min
completed: 2026-10-09
---

# Phase 7 Plan 03: Jury Package Ex Parte / Sealed Exclusion (schema + candidate-query half) Summary

**Sealed/ex-parte exhibits are now structurally excluded from jury-package membership via an `isSealed:false` predicate in `computeJuryCandidates`, with the Prisma schema carrying the new exclusion enum/columns/index and `reconcileDraftMembership` corrected to retain (never delete) legacy sealed member rows.**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-10-09T01:00:00Z (approx)
- **Completed:** 2026-10-09T01:11:00Z (approx)
- **Tasks:** 2
- **Files modified:** 5 (+1 migration created)

## Accomplishments
- Landed the phase's only Prisma migration: `JURY_PACKAGE_EXHIBIT_EXCLUDED` EventType value, `JuryPackageExhibitStatus` enum, four new `JuryPackageExhibit` columns (`status` default `INCLUDED`, `excludedAt`, `excludedBy`, `exclusionReason`), the `excludedByUser` relation, and `idx_jury_package_exhibits_package_status`.
- Closed the highest-severity defect of the phase: `computeJuryCandidates` now filters `isSealed:false` in the same query as the ADMITTED filter, so a sealed exhibit can never materialize as a jury-package member via the normal computation path.
- Fixed the latent reconcile bug the sealed-filter would otherwise create: `reconcileDraftMembership` computes staleness from each existing row's ACTUAL `currentStatus` (a direct, unfiltered `exhibitCurrentState` query) instead of absence-from-`candidates`, so a legacy sealed-but-still-ADMITTED row is retained for later remediation (plan 07-07) rather than silently deleted.
- Added two regression tests (sealed exhibit never a candidate; legacy sealed member row survives a DRAFT reconcile) and updated the pre-F13 sealed-membership tests to the new policy. Full owned-file suite green (15 tests).

## Task Commits

1. **Task 1: Prisma schema migration** - `7a574b3` (feat)
2. **Task 2: Sealed-exclusion candidate query + reconcile correction + regression tests** - `01b9fc7` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - new EventType value, `JuryPackageExhibitStatus` enum, four new `JuryPackageExhibit` columns + `excludedByUser` relation + reverse relation on `User`, new index
- `prisma/migrations/20261009010505_add_jury_package_exhibit_exclusion/migration.sql` - generated migration (CreateEnum, AlterEnum, AlterTable, CreateIndex, AddForeignKey)
- `src/lib/validation/eventPayloads.ts` - `juryPackageExhibitExcludedPayload` schema + its entry in `eventPayloadSchemas` (Rule 3 blocking)
- `src/services/juryPackage.ts` - `computeJuryCandidates` seal filter + corrected doc comments; `reconcileDraftMembership` staleness-from-actual-status
- `src/services/juryPackage.test.ts` - F12-gate-safe fixtures, updated pre-F13 tests, two new regression tests
- `src/app/api/cases/[id]/jury-package/route.test.ts` - F12-gate-safe `clean`/`flagged` fixtures + explicit `evaluateDiscrepancies`

## Decisions Made
- **Added the `JURY_PACKAGE_EXHIBIT_EXCLUDED` payload schema in this plan** (`{ juryPackageId, exhibitId, reason }`) even though its emitter lands in 07-07. Adding the enum value to `EventType` broke the `eventPayloadSchemas` type map (indexed by every `EventType`), so `tsc` failed. Declaring a forward-compatible schema now is the minimal unblock — a Rule 3 blocking fix.
- **Updated three pre-F13 tests** that encoded "a sealed exhibit is a member row (membership is case truth regardless of seal)". The plan's stated objective deliberately reverses that policy, so those assertions were correct for the old behavior and wrong for F13. They now assert the sealed exhibit is NOT a member and does not block finalize.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added JURY_PACKAGE_EXHIBIT_EXCLUDED payload schema**
- **Found during:** Task 1 (after running `tsc --noEmit` post-migration)
- **Issue:** Adding `JURY_PACKAGE_EXHIBIT_EXCLUDED` to the `EventType` enum broke `src/services/events.ts`'s `eventPayloadSchemas[eventType]` lookup — the `as const` schema map is indexed by `EventType` and now lacked a key for the new value, a compile error.
- **Fix:** Added `juryPackageExhibitExcludedPayload` (`{ juryPackageId, exhibitId, reason }`) and its entry in `eventPayloadSchemas`. The plan listed only the four schema changes for Task 1; the payload schema is a necessary consequence of adding the enum value and was not called out.
- **Files modified:** src/lib/validation/eventPayloads.ts
- **Verification:** `npx tsc --noEmit` → EXIT 0
- **Committed in:** `7a574b3` (Task 1 commit)

**2. [Rule 1 - Bug] Updated pre-F13 sealed-membership tests to the new exclusion policy**
- **Found during:** Task 2 (updating call sites per the plan's "check each calling test" instruction)
- **Issue:** Three existing tests asserted a sealed exhibit IS a jury-package member ("computeJuryCandidates returns ... incl. a sealed one", "initiate ... membership includes a sealed exhibit", "WARNING-3 gate honesty: a sealed OPEN discrepancy blocks finalize"). F13 structurally excludes sealed exhibits from membership, making those assertions incorrect under the new behavior.
- **Fix:** Rewrote the three tests to assert the F13 behavior: a sealed exhibit is not a candidate, not a member row, and (being a non-member) cannot block finalize. The plan explicitly anticipated this via its "update every call site / check each calling test" guidance; the specific test-intent reversal is the deviation.
- **Files modified:** src/services/juryPackage.test.ts
- **Verification:** `npx vitest run` on both owned test files → 15 passed
- **Committed in:** `01b9fc7` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug). **Impact on plan:** Both were required to keep the plan's own objective internally consistent — the payload schema makes the new enum value usable/compilable, and the test updates reflect the exact policy reversal the plan specifies. No scope creep.

## Known Stubs
None found. The `JURY_PACKAGE_EXHIBIT_EXCLUDED` payload schema is a real, validated schema (not a placeholder); its emitter arrives in plan 07-07 by design, which is the plan's stated sequencing, not an incomplete implementation of this plan.

## Issues Encountered
- Prisma CLI quirk: the first `prisma migrate dev` run reported "Already in sync" despite the live DB lacking the new columns (a stale diff read). Re-running `migrate dev` after confirming the schema delta via `migrate diff --from-schema-datasource ... --to-schema-datamodel ...` correctly generated and applied `20261009010505_add_jury_package_exhibit_exclusion`. The global `prisma` binary is v7 and errors on the schema's `env("DATABASE_URL")`; used the project-local `./node_modules/.bin/prisma` (v6.19.3) throughout.
- Shared-tree hazard (as documented in STATE.md, recurring this milestone): sibling wave-1 plans (07-01, 07-02, ...) were committing to the same `phase-7` branch/working tree concurrently. Staged only this plan's own files individually (never `git add .`) to avoid cross-plan contamination. `next build` on the merged tree passed (EXIT 0).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 07-07 (wave 3) can now build the exclude API/route/UI: the schema columns, the `JURY_PACKAGE_EXHIBIT_EXCLUDED` event + payload schema, and the corrected reconcile (which retains legacy sealed rows) are all in place.
- F12 admission-gate (plan 07-02) landing is compatible: all owned fixtures were made gate-safe (custody before ADMITTED; direct-write bypass + explicit `evaluateDiscrepancies` for no-custody fixtures), so they pass whether or not the gate is present.

---

## Self-Check: PASSED
- Created files exist on disk (migration.sql, 07-03-SUMMARY.md).
- Both task commits present in git history (7a574b3, 01b9fc7).
- Plan-level build ran: `npx next build` → EXIT 0.
- Owned test files green: `npx vitest run` → 15 passed (incl. 2 new regression tests).
- `## Known Stubs` section present; no blocking stubs.
