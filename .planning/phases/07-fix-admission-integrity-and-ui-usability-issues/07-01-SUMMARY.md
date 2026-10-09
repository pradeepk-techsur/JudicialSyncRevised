---
phase: 07-fix-admission-integrity-and-ui-usability-issues
plan: 01
subsystem: api
tags: [admission-gate, event-ledger, prisma, transaction, status-state-machine, F12]

# Dependency graph
requires:
  - phase: 01-data-foundation
    provides: recordEvent single-writer ledger, recordStatusChange state machine, ObjectionCurrentState/CustodyCurrentState projections, AppError/errorResponse typed-error layer
provides:
  - AdmissionBlockedError (code ADMISSION_BLOCKED, httpStatus 422, details.reasons[])
  - recordStatusChange hard pre-write admission gate — rejects ADMITTED while an unresolved objection and/or custody gap exists, before any ledger write, for every caller (no bypass)
  - admissionGate.test.ts integration suite (single-reason x2, dual-reason, normal-admission, resolve-then-admit, EXCLUDED/WITHDRAWN-unaffected)
affects: [07-02 (owns status.test.ts + 4 other test-file + seed-loader regression fallout from this gate), 07-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hard pre-write gate inside the existing status $transaction (same tx client, same per-exhibit advisory lock) — a blocked transition writes nothing, not even a partial projection update"
    - "Multi-reason AppError.details.reasons[] surfaced verbatim by the existing generic errorResponse — zero route-file change needed"

key-files:
  created:
    - src/services/admissionGate.test.ts
  modified:
    - src/lib/errors.ts
    - src/services/status.ts
    - src/app/api/exhibits/[id]/events/status/route.test.ts

key-decisions:
  - "Gate reads (objection count + custody lookup) run on the SAME tx client already holding the per-exhibit advisory lock, so they serialize against concurrent custody/ruling writes — no read-then-write race (T-07-01)"
  - "No bypass parameter of any kind (no force/skipGate/override) — every caller is subject to the identical gate, enforced by review/grep not a runtime flag (T-07-02)"
  - "status.test.ts regression fallout is deliberately left to plan 07-02, which explicitly owns that file — fixing it in 07-01 would overwrite an unowned file and pre-empt 07-02's scope"

patterns-established:
  - "F12 gate: when toStatus==='ADMITTED', collect EVERY applicable blocking reason (never short-circuit on the first) before throwing AdmissionBlockedError(reasons)"

# Metrics
duration: 5 min
completed: 2026-10-09
---

# Phase 7 Plan 01: Admission Integrity Gate Summary

**`recordStatusChange` now hard-rejects any ADMITTED transition — with a 422 `ADMISSION_BLOCKED` listing every blocking reason — while an exhibit has an unresolved objection and/or no custodian of record, before any ledger write, for 100% of callers with no bypass.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-10-09T01:03:00Z
- **Completed:** 2026-10-09T01:08:33Z
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- Added `AdmissionBlockedError` (code `ADMISSION_BLOCKED`, httpStatus 422, `details.reasons[]` of `{ code: 'UNRESOLVED_OBJECTION' | 'NO_CUSTODIAN'; message }`) to the typed-error layer.
- Inserted the F12 admission gate inside the existing `prisma.$transaction` in `recordStatusChange`, after the fromStatus-match check and **before** `recordEvent()`, firing only for `toStatus==='ADMITTED'`. It runs two projection reads on the same `tx` client (unresolved-objection count + custody lookup), aggregates every applicable reason, and throws when any hold — so a blocked admission writes nothing (no event, no projection update).
- Preserved all other behavior verbatim: terminal check, INVALID_STATUS_TRANSITION, the OBJECTED gate, EXCLUDED/WITHDRAWN transitions, and normal (custody-present, no-open-objection) admissions. No signature change (no `recordedAt`, no bypass param).
- New `admissionGate.test.ts` covers NO_CUSTODIAN alone (asserting zero new events + status unchanged), UNRESOLVED_OBJECTION alone, both reasons at once (order-independent), normal admission, resolve-then-admit, and EXCLUDED/WITHDRAWN-unaffected.
- Fixed the one route test the gate broke (terminal-exhibit test now establishes custody before its ADMIT) and added a new route-level 422 `ADMISSION_BLOCKED` test asserting `details.reasons[]` contains `NO_CUSTODIAN`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement the Admission Gate** - `a00843d` (feat)
2. **Task 2: Dedicated gate test suite + fix now-broken route test** - `98ffb1f` (test)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `src/lib/errors.ts` - Added `AdmissionBlockedError` AppError subclass (422, ADMISSION_BLOCKED, details.reasons[]).
- `src/services/status.ts` - Imported the new error; inserted the F12 admission gate block (the plan's entire functional diff) inside the status transaction before `recordEvent()`.
- `src/services/admissionGate.test.ts` - New dedicated integration suite (7 tests) for the gate, via the live service path against real Postgres.
- `src/app/api/exhibits/[id]/events/status/route.test.ts` - Added a custody POST helper + second fixture user; established custody before the terminal test's ADMIT; added a route-level ADMISSION_BLOCKED test.

## Decisions Made
- **Same-transaction, same-lock gate reads** (T-07-01): the two projection reads run on the `tx` client already holding the exhibit's `pg_advisory_xact_lock`, so they are serialized against concurrent custody-transfer / ruling transactions — no race between the gate's read and the ledger write.
- **No bypass of any kind** (T-07-02): there is exactly one admission code path (`recordStatusChange`); the gate has no `force`/`skipGate`/role-override, enforced by review/grep rather than a runtime flag an attacker could set.
- **status.test.ts fallout left to 07-02:** the two `status.test.ts` tests that admit with no custody now correctly throw `ADMISSION_BLOCKED`. Per 07-01's verification step 2 AND 07-02's own plan (which lists `src/services/status.test.ts` in `files_modified` and names the exact test to fix), this fixture repair is 07-02's scope, not 07-01's.

## Deviations from Plan

None - plan executed exactly as written. The gate diff, error class, and both test additions match the plan's specifications verbatim; no auto-fixes (Rules 1-3) or architectural decisions (Rule 4) were required.

## Issues Encountered
- **Shared working tree / concurrent sibling plans (the phase's RECURRING HAZARD).** The working tree already carried uncommitted mid-edits from sibling wave-1 plans (ExhibitTable.tsx, schema.prisma, custody.ts, objections.ts, events.ts, seed.ts, Header.tsx, juryPackage.test.ts, …). A whole-tree `npx tsc --noEmit` flickered between EXIT=0 and single transient errors in those unowned files across consecutive runs — classic shared-tree interleaving. **07-01's own four files are tsc-clean in every run** (verified by filtering tsc output to 07-01-owned paths: zero matches). This matches the deferred-items notes from 07-04/07-05 and STATE.md Blockers. Logged to `deferred-items.md`.
- **Expected status.test.ts regression (2 tests).** Noted and routed to 07-02 per the plan's explicit instruction; NOT fixed here. See `deferred-items.md` → "From 07-01".

## Known Stubs
None found — grep of the four changed files for TODO/FIXME/placeholder/not-implemented returned nothing.

## Deferred Issues
- `src/services/status.test.ts` (2 failing tests under the new gate) — owned by plan 07-02 (F12 regression/compliance half). Not a 07-01 defect; the gate is behaving exactly as specified. Full-suite green is 07-02's acceptance gate.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- F12's admission gate is complete and proven at both the service and route layers. `AdmissionBlockedError` + `recordStatusChange`'s gate are the contracts plan 07-02 (test/seed regression repair) and 07-03 build on.
- Blocker for full-suite green: 07-02 must land the downstream test-fixture + seed-loader repairs before the phase acceptance gate (`npx vitest run` full suite) passes.

## Self-Check: PASSED
- `src/services/admissionGate.test.ts` — FOUND (created, 7 tests pass)
- `src/lib/errors.ts` AdmissionBlockedError — FOUND (`class AdmissionBlockedError`)
- `src/services/status.ts` gate — FOUND (throws AdmissionBlockedError before recordEvent)
- Commit `a00843d` (Task 1) — present
- Commit `98ffb1f` (Task 2) — present
- `npx tsc --noEmit` → 07-01-owned files: zero errors (whole-tree flicker is unowned sibling-plan work)
- Plan verification: admissionGate.test.ts + status/route.test.ts → 15/15 pass; bypass grep → no force/skipGate/bypass code path
- `## Known Stubs` present, no blocking stubs

---
*Phase: 07-fix-admission-integrity-and-ui-usability-issues*
*Completed: 2026-10-09*
