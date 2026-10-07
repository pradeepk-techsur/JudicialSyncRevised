---
phase: 01-data-foundation
plan: 03
subsystem: api
tags: [status-state-machine, event-sourcing, prisma, postgres, advisory-lock, nextjs, vitest, projection]

# Dependency graph
requires:
  - phase: 01-02
    provides: "recordEvent() (sole ledger writer, now accepts an optional tx client for atomic composition), getExhibit, typed error layer + error envelope"
provides:
  - "recordStatusChange(args) — admission-lifecycle state machine: validates transitions, rejects terminal/invalid/out-of-order, gates OBJECTED on an unresolved objection, atomically appends STATUS_CHANGE + upserts ExhibitCurrentState"
  - "getExhibitStatus(exhibitId) — reads the ExhibitCurrentState projection (null when no status yet)"
  - "ALLOWED_TRANSITIONS table — the single source of truth for the admission lifecycle"
  - "POST /api/exhibits/:id/events/status, GET /api/exhibits/:id/status"
  - "UnprocessableError (422 with a feature-specific code) added to the typed error layer"
affects: [F0a-seed-loader, F2-objection-ruling, F3-custody, F8-command-center, F9-case-workspace, F10-exhibit-detail, phase-02, phase-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Status is derived-only: every transition is a STATUS_CHANGE ledger event; ExhibitCurrentState is a projection upserted in the SAME transaction as the ledger write"
    - "Read-check-write serialized with a transaction-scoped Postgres advisory lock (pg_advisory_xact_lock) keyed by a hash of exhibitId — works on an exhibit's first transition when no row exists to SELECT ... FOR UPDATE"
    - "Serialization/deadlock failures (Prisma P2034/P2028) re-thrown as STATUS_CONFLICT (409), never a 500"
    - "Lifecycle rules live in the service; API routes stay thin and only map codes -> HTTP via the shared error envelope"
    - "Routes resolve exhibit existence (getExhibit) to return EXHIBIT_NOT_FOUND (404) distinctly from lifecycle validation errors"

key-files:
  created:
    - src/services/status.ts
    - src/services/status.test.ts
    - src/app/api/exhibits/[id]/events/status/route.ts
    - src/app/api/exhibits/[id]/status/route.ts
    - src/app/api/exhibits/[id]/events/status/route.test.ts
  modified:
    - src/lib/errors.ts

key-decisions:
  - "Used a Postgres transaction-scoped advisory lock (not SELECT ... FOR UPDATE) to serialize concurrent status changes, because an exhibit's first-ever transition has no ExhibitCurrentState row to lock"
  - "Added UnprocessableError (422 + feature-specific code) so INVALID_STATUS_TRANSITION keeps its own code rather than collapsing into the generic VALIDATION_ERROR"
  - "GET /api/exhibits/:id/status returns 200 with a null-ish body for an existing exhibit that has no status yet, reserving 404 for a genuinely absent exhibit (F00 'not yet entered into evidence')"

patterns-established:
  - "Domain state machine over the ledger: validate-against-table -> recordEvent(tx) -> upsert projection, all in one transaction"
  - "Advisory-lock serialization pattern reusable by the objection and custody write paths (Plans 4/5)"

# Metrics
duration: 5min
completed: 2026-10-07
---

# Phase 1 Plan 03: Exhibit Status State Machine Summary

**Admission-lifecycle state machine (`recordStatusChange`/`getExhibitStatus`) that validates every transition against `ALLOWED_TRANSITIONS`, rejects terminal/invalid/out-of-order changes, gates `OBJECTED` on an unresolved objection, and atomically appends a `STATUS_CHANGE` ledger event + upserts the `ExhibitCurrentState` projection under an advisory lock — exposed via two thin Next.js API routes.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-10-07T02:42:00Z
- **Completed:** 2026-10-07T02:45:00Z
- **Tasks:** 2
- **Files modified:** 6 (5 created, 1 modified)

## Accomplishments
- `recordStatusChange` is the full F1 state machine: it serializes concurrent writers with a transaction-scoped Postgres advisory lock (keyed by a hash of `exhibitId`, so it works even on an exhibit's first transition), reads the current status inside that lock, rejects terminal states (`STATUS_FINALIZED` 409), rejects disallowed transitions (`INVALID_STATUS_TRANSITION` 422), cross-checks `ObjectionCurrentState` for the `OBJECTED` gate, then appends the `STATUS_CHANGE` event through `recordEvent(..., tx)` and upserts `ExhibitCurrentState` — all in one transaction, so the ledger and projection can never diverge.
- `getExhibitStatus` reads the projection only, returning `null` for an exhibit with zero status events (the "not yet entered into evidence" case).
- Two thin API routes with the full F1 error surface: `POST /api/exhibits/:id/events/status` (201 `{ event, currentState }`) and `GET /api/exhibits/:id/status` (200, with a null-body 200 vs 404 distinction via `getExhibit`).
- Serialization/deadlock failures surface as retryable `STATUS_CONFLICT` (409) rather than leaking a 500.

## Task Commits

Each task was committed atomically:

1. **Task 1: Status state machine service (recordStatusChange, getExhibitStatus)** - `f176bbe` (feat)
2. **Task 2: Status API routes + integration tests** - `0549fb7` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `src/services/status.ts` - `ALLOWED_TRANSITIONS`, `recordStatusChange`, `getExhibitStatus`; advisory-lock-serialized, atomic ledger-write + projection-upsert
- `src/services/status.test.ts` - valid sequence, invalid first transition, terminal rejection, OBJECTED gating (4 scenarios)
- `src/app/api/exhibits/[id]/events/status/route.ts` - POST status transition
- `src/app/api/exhibits/[id]/status/route.ts` - GET current derived status
- `src/app/api/exhibits/[id]/events/status/route.test.ts` - 7 route tests asserting exact codes + envelope shape
- `src/lib/errors.ts` - added `UnprocessableError` (422 with a feature-specific code) (modified)

## Decisions Made
- **Advisory lock over `SELECT ... FOR UPDATE`:** the plan allowed either, but `FOR UPDATE` cannot lock a row that does not exist, and an exhibit's first transition has no `ExhibitCurrentState` row. A transaction-scoped `pg_advisory_xact_lock` keyed by a stable hash of `exhibitId` serializes all writers for an exhibit uniformly, whether or not a row exists yet.
- **`UnprocessableError` added:** the existing `ValidationError` hardcodes the `VALIDATION_ERROR` code, but F1 requires `INVALID_STATUS_TRANSITION` (also 422) to keep its own code per Y2-errors.md. Added a 422 error class that carries an arbitrary code.
- **GET 200-vs-404 split:** an existing exhibit with no status yet returns 200 with a null `currentStatus` body (F00 "not yet entered into evidence"); only a genuinely absent exhibit returns 404 `EXHIBIT_NOT_FOUND`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added `UnprocessableError` for the feature-specific 422 code**
- **Found during:** Task 1
- **Issue:** The plan requires `INVALID_STATUS_TRANSITION` (422) as a distinct, named error code (Y2-errors.md), but the existing typed error layer only had `ValidationError`, which hardcodes the generic `VALIDATION_ERROR` code. Without a 422-with-custom-code class, the route could not emit the correct code the FRD and route tests require.
- **Fix:** Added `UnprocessableError(code, message)` (httpStatus 422) to `src/lib/errors.ts`; the status service throws it for both invalid transitions and the OBJECTED gate.
- **Files modified:** src/lib/errors.ts
- **Verification:** Route test asserts `body.error.code === 'INVALID_STATUS_TRANSITION'` with HTTP 422; passes.
- **Committed in:** `f176bbe` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical).
**Impact on plan:** The addition was necessary to satisfy the plan's own stated error contract (named F1 codes mapped to the right HTTP status). No scope creep — no behavior beyond the plan's tasks and done criteria. `recordEvent`'s optional-`tx` parameter, which the plan's step-7 atomicity requirement depends on, was already present from Plan 2, so no change was needed there.

## Known Stubs
None found. `grep -rnE "TODO|FIXME|placeholder|not.?implemented|coming soon"` across the created/modified files returns zero matches. The single-writer invariant holds: `grep -rn 'exhibitEvent.create' src/` (excluding tests) shows exactly one real call site (`events.ts:74`); the status service records all history through `recordEvent`.

## Issues Encountered
None beyond the auto-fixed deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- **Ready for Plan 04.** The status domain proves the ledger pattern end-to-end for one domain (validate-against-table → `recordEvent(tx)` → projection upsert, all atomic under an advisory lock); Plans 4 (objections) and 5 (custody) repeat the same shape.
- The advisory-lock serialization and the atomic ledger-write + projection-upsert pattern are directly reusable by the objection and custody write paths.
- `recordStatusChange` is available for the F0a seed loader to build exhibit status histories.
- No blockers.

## Self-Check: PASSED

- All 6 key files verified present on disk (5 created + `src/lib/errors.ts` modified).
- Both task commits (`f176bbe`, `0549fb7`) verified in git history.
- Status service test: 4/4 passing. Status route test: 7/7 passing. Full suite: `npx vitest run` → 40/40 passing.
- Plan-level build: `npm run build` → exit 0 (both new routes `/api/exhibits/[id]/events/status` and `/api/exhibits/[id]/status` registered).
- Typecheck: `npx tsc --noEmit` → exit 0.
- Single-writer invariant intact (one non-test `exhibitEvent.create` call site, `events.ts:74`).
- `## Known Stubs` section present; no blocking stubs.

---
*Phase: 01-data-foundation*
*Completed: 2026-10-07*
