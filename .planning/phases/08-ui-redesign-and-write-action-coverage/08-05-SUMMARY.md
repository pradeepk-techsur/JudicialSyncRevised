---
phase: 08-ui-redesign-and-write-action-coverage
plan: 05
subsystem: database
tags: [seed, discrepancies, prisma, event-sourcing, fixtures]

# Dependency graph
requires:
  - phase: 07-fix-admission-integrity-and-ui-usability-issues
    provides: F12 admission gate (recordStatusChange), forceAdmitBypassingGate grep-confinement pattern (T-07-05)
  - phase: 03-jury-package-discrepancy-detection
    provides: evaluateDiscrepancies engine + ADMITTED_NO_CUSTODIAN / UNRESOLVED_OBJECTION_JURY_ELIGIBLE rules
provides:
  - P-6 seed fixture (legacy-admit, zero custody) firing ADMITTED_NO_CUSTODIAN OPEN through the live engine
  - P-7 seed fixture (legacy-admit, unresolved objection, clean custody) firing UNRESOLVED_OBJECTION_JURY_ELIGIBLE OPEN
  - legacyAdmitForDemo seed-only legacy-admit helper, grep-confined to seed.ts
  - two new assertSeedIntegrity checks + grep-confinement/integration tests
affects: [08-06, 08-10, 08-15, command-center, attention-feed, F24-write-actions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Seed-only gate-skipping helper (legacyAdmitForDemo) confined to seed.ts, grep-audited — distinct from the test-only forceAdmitBypassingGate (T-07-05)"
    - "Legacy/pre-gate fixtures produced through the real ledger-write + projection-upsert + advisory-lock + evaluateDiscrepancies path, never a synthetic flag row"

key-files:
  created: []
  modified:
    - src/data/seed.ts
    - src/data/seed.test.ts

key-decisions:
  - "legacyAdmitForDemo skips ONLY F12's two precondition reads (step 5b); it still writes through recordEvent (sole ledger writer) + evaluateDiscrepancies (sole flag engine), so P-6/P-7 flags are genuine, not synthetic"
  - "Grep-confinement test excludes *.test.ts from the confinement scope (the audit file necessarily names the symbol) — exactly the T-07-05 carve-out; asserts seed.ts is the only NON-TEST referencer"
  - "S-1 custody-transfer actor changed from users.CHAMBERS_STAFF to deputy so the transfer satisfies 08-02's CUSTODY_WRITE_ROLES gate (DEPUTY/CLERK/ADMIN); toCustodianUserId stays CHAMBERS_STAFF (custodian-of-record narrative preserved)"

patterns-established:
  - "A seed fixture representing a state the live system can no longer produce (post-F12) is legitimate ONLY via a narrowly-scoped, grep-confined, separately-justified seed helper — never a direct projection/flag insert"

# Metrics
duration: 18 min
completed: 2026-10-09
---

# Phase 8 Plan 05: Legacy-admit seed fixtures (P-6/P-7) + seed-only legacyAdmitForDemo helper Summary

**Two new seeded exhibits (P-6 legacy-admit/zero-custody, P-7 legacy-admit/unresolved-objection) that genuinely fire ADMITTED_NO_CUSTODIAN and UNRESOLVED_OBJECTION_JURY_ELIGIBLE through the live discrepancy engine via a grep-confined, seed-only legacyAdmitForDemo helper that skips F12's admission gate to represent pre-gate-rollout exhibits.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-10-09T11:54:00Z
- **Completed:** 2026-10-09T12:12:04Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `legacyAdmitForDemo` — a seed-only helper performing the exact ledger-write + projection-upsert + advisory-lock + `evaluateDiscrepancies` pattern `recordStatusChange` uses for an ADMITTED transition, but deliberately skipping F12's gate (step 5b), so P-6/P-7 can honestly represent "admitted before the gate rollout."
- Planted P-6 (`MARKED → OFFERED → ADMITTED` via legacy-admit, zero custody) — fires `ADMITTED_NO_CUSTODIAN` OPEN; and P-7 (`MARKED → OFFERED → OBJECTED` unresolved, full custody chain, then legacy-admit) — fires `UNRESOLVED_OBJECTION_JURY_ELIGIBLE` OPEN. Both through the LIVE engine, verified against the DB.
- Seeded demo case now loads **11 exhibits** deterministically and idempotently (run twice, identical result, no duplicate case).
- Added two `assertSeedIntegrity` checks (#5 P-6, #6 P-7) that fail the seed if either new OPEN flag is absent.
- Added the explicit security-auditor grep-confinement test (mirrors T-07-05) proving `legacyAdmitForDemo` is referenced by no non-test source file but `seed.ts`, plus an integration test asserting P-6/P-7 reach ADMITTED and both OPEN flags surface through `getDiscrepancies(caseId, 'JUDGE')`.
- Fixed the one pre-existing S-1 custody-transfer actor (`users.CHAMBERS_STAFF` → `deputy`) to satisfy 08-02's new `CUSTODY_WRITE_ROLES` gate, preserving the custodian-of-record narrative.

## Task Commits

Each task was committed atomically:

1. **Task 1: legacyAdmitForDemo helper + P-6/P-7 fixtures** - `607c7ed` (feat)
2. **Task 2: assertSeedIntegrity additions + grep-confinement test** - `36b8a84` (test)

## Files Created/Modified
- `src/data/seed.ts` - Added `advisoryLockKey`/`recordEvent`/`evaluateDiscrepancies` imports, the `legacyAdmitForDemo` seed-only helper, the P-6/P-7 fixture blocks, two new `assertSeedIntegrity` checks, and the S-1 custody-actor fix.
- `src/data/seed.test.ts` - Added the `execSync`/`getDiscrepancies` imports, the grep-confinement test (test-file-excluded confinement scope), and the P-6/P-7 live-engine integration test. Purely additive (65 insertions, 0 removals of existing P-1..S-1 assertions).

## Decisions Made
- **legacyAdmitForDemo is distinct from forceAdmitBypassingGate, not an alias/copy.** It is confined to `seed.ts` (not `*.test.ts`), is called for real seed data, and is grep-audited by its own test — a separately-justified mechanism per CONTEXT.md.
- **Grep-confinement test excludes test files from scope.** The audit file necessarily names the symbol it asserts on; the confinement claim that matters is "no reachable import path" = no non-test source file but `seed.ts`. This is the identical carve-out T-07-05 uses (where `forceAdmitBypassingGate` is permitted to live only in `*.test.ts`).
- **S-1 actor fix was narratively sound and order-independent.** A deputy performing chambers intake custody assignment; the custodian (`toCustodianUserId`) stays CHAMBERS_STAFF.

## Deviations from Plan

None - plan executed exactly as written.

The grep-confinement test as literally quoted in the plan (`expect(files).toEqual(['src/data/seed.ts'])` with no test-file filter) would fail because the audit test file itself contains the string `legacyAdmitForDemo`. The plan's own CONTEXT (and the cited T-07-05 precedent) require confinement to mean "no reachable import path," which excludes the auditing test file by construction — so the test filters out `*.test.ts` before asserting `seed.ts` is the sole referencer. This realizes the plan's stated intent exactly; it is not a deviation from the required behavior (the helper IS confined to `seed.ts` among all production code), only a correct reading of the confinement semantics the plan specifies.

## Known Stubs

None found. Scanned both modified files for TODO/FIXME/placeholder/not-implemented — zero hits. No empty bodies, no hardcoded-data handlers, no swallowed errors.

## Issues Encountered
- The shared working tree carries pre-existing uncommitted changes from parallel plans (`prisma/schema.prisma`, `src/services/custody.ts` — the latter already containing 08-02's `CUSTODY_WRITE_ROLES` gate). These were left untouched and NOT staged; only `src/data/seed.ts` and `src/data/seed.test.ts` were committed. Full `tsc --noEmit` and `next build` both pass (exit 0) against the merged tree, so the S-1 actor fix was both necessary and sufficient. This is the recurring shared-working-tree hazard noted throughout Phase 6/7 STATE.md.

## Verification Evidence
- `npm run seed` → "11 exhibits", no `SeedIntegrityError` (checks #5/#6 pass). Run twice → identical, idempotent.
- DB query confirms `P-6 → ADMITTED_NO_CUSTODIAN [OPEN]`, `P-7 → UNRESOLVED_OBJECTION_JURY_ELIGIBLE [OPEN]`, both `status=ADMITTED`.
- `npx vitest run src/data/seed.test.ts` → 8/8 passed (incl. grep-confinement + P-6/P-7 integration + determinism).
- `npx tsc --noEmit` → exit 0. `npx next build` → exit 0 (all routes compile).

## Next Phase Readiness
- P-6/P-7 flags are live in the seeded case and ready for 08-06 (Command Center attention-feed service reads these flags), and 08-10/08-15 (Command Center screens that render and remediate them via F24 "Record ruling" / "Assign custodian").
- No blockers. The two new fixtures are the demo substrate the HIGH (P-7) and MEDIUM (P-6) attention-feed tiers and the two F24 write actions require.

## Self-Check: PASSED
- Files modified exist: `src/data/seed.ts` FOUND, `src/data/seed.test.ts` FOUND.
- Commits exist: `607c7ed` FOUND, `36b8a84` FOUND.
- Build check: `npx next build` → exit 0 (ran after last task).
- `## Known Stubs` section present; no blocking stubs.

---
*Phase: 08-ui-redesign-and-write-action-coverage*
*Completed: 2026-10-09*
