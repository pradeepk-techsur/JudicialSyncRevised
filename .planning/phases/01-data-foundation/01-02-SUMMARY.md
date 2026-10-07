---
phase: 01-data-foundation
plan: 02
subsystem: api
tags: [prisma, postgres, zod, nextjs, event-sourcing, service-layer, vitest, api-routes]

# Dependency graph
requires:
  - phase: 01-01
    provides: "prisma/schema.prisma (ExhibitEvent/Exhibit/Case models), src/lib/prisma.ts singleton"
provides:
  - "recordEvent() — the sole append-only ExhibitEvent writer, stamps per-exhibit sequenceNo in a transaction"
  - "createExhibit / getExhibit / getExhibits — exhibit identity CRUD (no status/custody at creation)"
  - "Event payload zod schemas for every EventType (eventPayloads.ts)"
  - "POST /api/exhibits, GET /api/exhibits/:id, GET /api/cases/:id/exhibits"
  - "Typed error layer (AppError/ValidationError/ConflictError/NotFoundError) + common error envelope"
  - "tests/boot.test.ts context-boot test (DB + schema wiring sanity, re-run by every later phase)"
affects: [F0a-seed-loader, F1-status, F2-objection-ruling, F3-custody, phase-02, phase-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "recordEvent() is the single ledger-write chokepoint — all history flows through it, never prisma.exhibitEvent.create directly"
    - "Per-exhibit sequenceNo computed as max+1 inside a $transaction with the insert"
    - "Service layer throws typed AppErrors; thin route handlers map code->HTTP via a shared error-envelope helper"
    - "Payload shapes validated with zod keyed by EventType before any DB write"
    - "Context-boot test pattern (Next.js adaptation) catches Prisma schema/client drift automatically"

key-files:
  created:
    - src/lib/errors.ts
    - src/lib/apiError.ts
    - src/lib/validation/eventPayloads.ts
    - src/services/events.ts
    - src/services/events.test.ts
    - src/services/exhibits.ts
    - src/services/exhibits.test.ts
    - src/app/api/exhibits/route.ts
    - src/app/api/exhibits/[id]/route.ts
    - src/app/api/cases/[id]/exhibits/route.ts
    - src/app/api/exhibits/route.test.ts
    - tests/boot.test.ts
  modified:
    - vitest.config.ts

key-decisions:
  - "Added a typed error layer (errors.ts) + error-envelope helper (apiError.ts) beyond the plan's named files — needed so services throw clean codes and routes emit the Y1-api.md envelope"
  - "Deferred sealed-exhibit role-based visibility filtering to Phase 2 (per the plan's documented scope decision)"
  - "GET /api/cases/:id/exhibits returns raw identity rows this phase; the F9 current-state summary shape is layered on when the projection reads/consumer exist"

patterns-established:
  - "Single-writer ledger: recordEvent() is the only call site of prisma.exhibitEvent.create (grep-enforced)"
  - "Thin route handlers: parse -> one service call -> shape response; all business logic in the service layer"

# Metrics
duration: 5min
completed: 2026-10-07
---

# Phase 1 Plan 02: Event Ledger Writer + Exhibit Identity CRUD Summary

**`recordEvent()` as the sole append-only ExhibitEvent writer (zod-validated payloads, per-exhibit sequenceNo stamped inside a transaction) plus `createExhibit`/`getExhibit`/`getExhibits` identity CRUD, wired behind three thin Next.js API routes with a typed error envelope and a green context-boot test.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-10-07T02:33:30Z
- **Completed:** 2026-10-07T02:38:03Z
- **Tasks:** 3
- **Files modified:** 13 (12 created, 1 modified)

## Accomplishments
- `recordEvent()` is the architectural linchpin: it validates payloads against per-EventType zod schemas, resolves the exhibit's caseId, computes the next per-exhibit `sequenceNo` as `max+1`, and appends the row — all in one `$transaction`. It is the only call site of `prisma.exhibitEvent.create` in the codebase (grep-verified).
- Exhibit identity CRUD with structurally-absent status/custody parameters (cannot be set at creation), service-layer zod validation, and P2002 → typed `EXHIBIT_LABEL_CONFLICT` mapping.
- Three thin API routes (`POST /api/exhibits`, `GET /api/exhibits/:id`, `GET /api/cases/:id/exhibits`) returning correct status codes and the common `{ error: { code, message } }` envelope per Y1-api.md / Y2-errors.md.
- Context-boot test confirming DB connectivity, service-module importability, and schema-validation-free queries across all six Phase 1 models.

## Task Commits

Each task was committed atomically:

1. **Task 1: recordEvent — sole append-only ledger writer** - `ef62569` (feat)
2. **Task 2: Exhibit identity service (create/get/list)** - `60e6226` (feat)
3. **Task 3: Exhibit API routes + context-boot test** - `be441a4` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `src/lib/validation/eventPayloads.ts` - zod schemas for every EventType payload (Y0-schema)
- `src/services/events.ts` - `recordEvent()`, sole ledger writer, transactional sequenceNo
- `src/services/events.test.ts` - sequence numbering + immediate read-after-write + invalid-payload rejection
- `src/services/exhibits.ts` - `createExhibit`/`getExhibit`/`getExhibits`, identity-only create
- `src/services/exhibits.test.ts` - happy path, label conflict, invalid enum, not-found
- `src/lib/errors.ts` - typed AppError/ValidationError/ConflictError/NotFoundError
- `src/lib/apiError.ts` - maps thrown errors to the common response envelope
- `src/app/api/exhibits/route.ts` - POST create exhibit
- `src/app/api/exhibits/[id]/route.ts` - GET single exhibit (404 on null)
- `src/app/api/cases/[id]/exhibits/route.ts` - GET exhibits for a case
- `src/app/api/exhibits/route.test.ts` - route handler tests (201/409/422/404 + envelope shape)
- `tests/boot.test.ts` - context-boot test (DB + schema wiring)
- `vitest.config.ts` - added `@/` -> `./src` alias to mirror tsconfig (modified)

## Decisions Made
- **Typed error layer added (beyond named files):** the plan references a `ValidationError`/`ConflictError` the services throw and the routes catch, but does not list an errors module. Added `src/lib/errors.ts` (typed errors carrying `code`+`httpStatus`) and `src/lib/apiError.ts` (envelope mapper) so the service layer stays HTTP-agnostic and routes stay thin. Necessary to satisfy the plan's own contract.
- **Sealed-exhibit visibility deferred to Phase 2** — per the plan's explicit, documented scope decision; `isSealed` is stored faithfully, filtering is added when a real role-scoped consumer exists.
- **`GET /api/cases/:id/exhibits` returns raw identity rows this phase** — the richer F9 current-state summary shape (currentStatus, custodianName, discrepancyFlags) depends on projection reads that later phases build.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vitest could not resolve the `@/` path alias**
- **Found during:** Task 1 (first test run)
- **Issue:** `src/lib/prisma`, `src/services/*` are imported via the `@/` alias (from tsconfig `paths`), but `vitest.config.ts` had no matching `resolve.alias`, so every test failed with `ERR_MODULE_NOT_FOUND`. This blocked all three tasks' verification.
- **Fix:** Added `resolve.alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) }` to `vitest.config.ts`, mirroring the tsconfig mapping.
- **Files modified:** vitest.config.ts
- **Verification:** `npx vitest run` resolves all `@/` imports; full 13-test suite passes.
- **Committed in:** `ef62569` (Task 1 commit)

**2. [Rule 2 - Missing Critical] Typed error layer + response-envelope helper**
- **Found during:** Task 1 / Task 3
- **Issue:** The plan requires services to throw a typed `ValidationError`/`ConflictError` caught by routes and mapped to 422/409/404 with the common `{ error: { code, message } }` envelope, but lists no module providing them. Without it, raw zod/Prisma errors would leak to the API layer (wrong status codes, leaked internals).
- **Fix:** Added `src/lib/errors.ts` (AppError base + ValidationError/ConflictError/NotFoundError, each carrying `code` and `httpStatus`) and `src/lib/apiError.ts` (`errorResponse()` mapping thrown errors to the envelope; unknown → generic 500).
- **Files modified:** src/lib/errors.ts, src/lib/apiError.ts
- **Verification:** route.test.ts asserts exact 201/409/422/404 codes and envelope shape; all pass.
- **Committed in:** `ef62569` (errors.ts, Task 1) and `be441a4` (apiError.ts, Task 3)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical).
**Impact on plan:** Both were necessary to satisfy the plan's own stated contract (tests must run; services throw typed errors routes map to HTTP codes). No scope creep — no behavior beyond what the plan's tasks and done criteria require.

## Known Stubs

None found. `grep -rnE "TODO|FIXME|placeholder|not.?implemented|coming soon" src/ tests/` returns zero matches. The documented Phase-2 deferrals (sealed-exhibit filtering; F9 summary shape) are deliberate scope boundaries per the plan, not incomplete implementations of this plan's objective.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- **Ready for Plan 03.** `recordEvent()` is in place as the single ledger-write path every status/objection/custody plan will call, and the exhibit identity surface + its API routes are live and tested against real Postgres.
- The context-boot test is green and will catch schema/client drift automatically for every subsequent phase.
- No blockers.

## Self-Check: PASSED

- All 13 key files verified present on disk (12 created + vitest.config.ts modified).
- All 3 task commits (`ef62569`, `60e6226`, `be441a4`) verified in git history.
- Full test suite: `npx vitest run` → 13/13 passing.
- Single-writer invariant: `grep -rn 'exhibitEvent.create' src/` → exactly one code call site (events.ts:60).
- Plan-level build: `npm run build` → exit 0 (all three API routes registered).
- Typecheck: `npx tsc --noEmit` → exit 0.
- `## Known Stubs` section present; no blocking stubs.

---
*Phase: 01-data-foundation*
*Completed: 2026-10-07*
