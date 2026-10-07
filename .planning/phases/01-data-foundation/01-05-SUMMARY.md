---
phase: 01-data-foundation
plan: 05
subsystem: api
tags: [prisma, postgres, nextjs, event-sourcing, custody, chain-of-custody, service-layer, vitest, api-routes]

# Dependency graph
requires:
  - phase: 01-02
    provides: "recordEvent() ledger writer, typed error layer (errors.ts/apiError.ts), eventPayloads zod schemas, thin-route pattern"
provides:
  - "recordCustodyTransfer() — appends a CUSTODY_TRANSFER ledger event and upserts CustodyCurrentState atomically, after strict chain validation"
  - "getCustodian(exhibitId) — reads the CustodyCurrentState projection; null is a valid custody-gap state"
  - "getCustodyHistory(exhibitId) — reconstructs the full chronological chain from the ledger"
  - "POST /api/exhibits/:id/events/custody, GET /api/exhibits/:id/custodian, GET /api/exhibits/:id/custody-history"
  - "recordEvent() now accepts an optional transaction client so ledger write + projection upsert compose in one transaction"
  - "Typed custody errors: CustodyChainBrokenError (409), InvalidCustodianError (422), NoOpTransferError (422)"
affects: [F0a-seed-loader, F6-discrepancy-detection, F9-case-workspace, F10-exhibit-detail, F7-assistant, phase-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Projection-write pattern: validate derived state -> recordEvent() -> upsert *CurrentState in the SAME transaction, so ledger and projection can never drift"
    - "recordEvent() is composable: an optional transaction client lets callers wrap the ledger write with their own projection write atomically"
    - "Custody gap (absent projection row) is modelled as a first-class valid state (getCustodian -> null; GET /custodian -> 200 {custodian:null}), distinct from a missing exhibit (404)"

key-files:
  created:
    - src/services/custody.ts
    - src/services/custody.test.ts
    - src/app/api/exhibits/[id]/events/custody/route.ts
    - src/app/api/exhibits/[id]/custodian/route.ts
    - src/app/api/exhibits/[id]/custody-history/route.ts
    - src/app/api/exhibits/[id]/events/custody/route.test.ts
  modified:
    - src/services/events.ts

key-decisions:
  - "recordEvent() extended with an optional transaction client (non-breaking — existing 1-arg callers unchanged) so the custody ledger write and CustodyCurrentState upsert commit atomically"
  - "Custody gap returned as 200 {custodian:null} (never 404, never a blank body); 404 is reserved for a genuinely missing exhibit, keeping the two states unambiguous for consumers (F6/F9/F10)"
  - "Strict equality chain check runs BEFORE any ledger write, so a wrong-holder transfer leaves the projection and ledger completely untouched"

patterns-established:
  - "Service throws typed, code-bearing errors (CustodyChainBrokenError/InvalidCustodianError/NoOpTransferError) that the shared errorResponse() maps straight to the Y2-errors envelope"
  - "recordEvent(args, tx) composition pattern for any future per-domain write that must keep a projection in step with the ledger"

# Metrics
duration: 3min
completed: 2026-10-07
---

# Phase 1 Plan 05: Chain-of-Custody Tracking Summary

**`recordCustodyTransfer` records each custody handoff as an immutable CUSTODY_TRANSFER ledger event — validated by strict equality against the exhibit's derived current custodian — then upserts `CustodyCurrentState` in the same transaction, with `getCustodian`/`getCustodyHistory` reads and three thin API routes; a wrong-holder transfer is refused (`CUSTODY_CHAIN_BROKEN`) before any write and a custody gap is a first-class valid state.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-10-07T02:41:55Z
- **Completed:** 2026-10-07T02:45:02Z
- **Tasks:** 2
- **Files modified:** 7 (6 created, 1 modified)

## Accomplishments
- Chain-of-custody service with the core invariant proven by test: a transfer "from" anyone who is not the actual current custodian is refused with `CUSTODY_CHAIN_BROKEN` **before** any ledger row is written, leaving the projection byte-for-byte unchanged.
- Ledger write and projection upsert now commit atomically — `recordEvent()` accepts an optional transaction client, so `recordCustodyTransfer` wraps both in one `$transaction`; they can never drift.
- Custody gap modelled as a meaningful, non-error state: `getCustodian` returns `null`, `GET /custodian` returns `200 { custodian: null }`, `getCustodyHistory` returns `[]` — never a backfilled placeholder row (exactly the condition Phase 3's ADMITTED_NO_CUSTODIAN rule will flag).
- Full chronological chain reconstructable from the ledger with no filtering or truncation.
- Three thin routes registered and building (`POST .../events/custody`, `GET .../custodian`, `GET .../custody-history`) returning correct status codes and the common error envelope.

## Task Commits

Each task was committed atomically:

1. **Task 1: Custody chain service (recordCustodyTransfer, getCustodian, getCustodyHistory)** - `138327f` (feat)
2. **Task 2: Custody API routes + integration tests** - `9a8c9a9` (feat)

**Plan metadata:** (docs commit — see final metadata commit)

## Files Created/Modified
- `src/services/custody.ts` - `recordCustodyTransfer`/`getCustodian`/`getCustodyHistory` + typed custody errors
- `src/services/custody.test.ts` - 8 integration tests (first transfer, chain continuation, wrong-holder rejection leaving projection unchanged, no-op, invalid+inactive custodian, custody gap, full chain)
- `src/services/events.ts` - `recordEvent()` now accepts an optional transaction client (modified)
- `src/app/api/exhibits/[id]/events/custody/route.ts` - POST record custody transfer
- `src/app/api/exhibits/[id]/custodian/route.ts` - GET current custodian (200 {custodian:null} for a gap)
- `src/app/api/exhibits/[id]/custody-history/route.ts` - GET full ordered chain
- `src/app/api/exhibits/[id]/events/custody/route.test.ts` - 6 route tests (gap shape, 404, HTTP CUSTODY_CHAIN_BROKEN, round trip, validation, missing exhibit)

## Decisions Made
- **`recordEvent()` extended with an optional transaction client** (non-breaking): the plan requires the ledger event and the `CustodyCurrentState` upsert to happen "in the same transaction" (Task 1 step 6), but the Plan-02 `recordEvent` opened its own transaction with no way for a caller to compose. Added an optional second `client` parameter; omitted → unchanged self-transaction behaviour (existing callers and the events test are untouched and still green). This keeps `recordEvent` the single `exhibitEvent.create` call site while making it composable.
- **Custody gap as `200 { custodian: null }`, 404 reserved for a missing exhibit** — per the plan's explicit requirement to avoid blank/empty-object ambiguity, and to keep "no custodian of record yet" cleanly distinguishable from "no such exhibit" for the F6/F9/F10 consumers.
- **Chain check precedes every write** — strict equality against the derived current custodian is evaluated before `recordEvent`, guaranteeing a refused transfer mutates nothing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `recordEvent()` could not participate in a caller's transaction**
- **Found during:** Task 1 (implementing the atomic "append event + upsert projection" requirement)
- **Issue:** Task 1 step 6 requires the `CUSTODY_TRANSFER` event and the `CustodyCurrentState` upsert to be written "in the same transaction," but the Plan-02 `recordEvent(args)` always opened its own `$transaction` and returned only the event, giving a caller no way to compose a second write atomically with it.
- **Fix:** Added an optional `client?: PrismaClient | Prisma.TransactionClient` second parameter to `recordEvent`. When supplied, the append runs inside that transaction; when omitted, behaviour is identical to before. `recordCustodyTransfer` then does `prisma.$transaction(tx => recordEvent(args, tx) then tx.custodyCurrentState.upsert(...))`.
- **Files modified:** src/services/events.ts
- **Verification:** `npx tsc --noEmit` clean; existing `events.test.ts` (2 tests) still passes unchanged; custody tests confirm projection + ledger stay consistent and a rejected transfer writes neither.
- **Committed in:** `138327f` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** The change was necessary to satisfy the plan's own atomicity requirement, is backward-compatible (no behaviour change for existing callers), and preserves the single-ledger-writer invariant. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- **Ready for Plan 06 (seed loader).** All three Phase-1 per-domain write paths (status, objections, custody) now share the identical `recordEvent`-then-project pattern; `recordCustodyTransfer` is available for the seed loader to build custody chains and plant the deliberate custody-gap edge case (F0a).
- The custody-gap-as-valid-state contract is in place for Phase 3's ADMITTED_NO_CUSTODIAN discrepancy rule to detect.
- No blockers.

## Self-Check: PASSED

- All 6 key files verified present on disk (6 created); `src/services/events.ts` modified.
- Both task commits (`138327f`, `9a8c9a9`) verified in git history.
- Plan verification: `npx vitest run src/services/custody.test.ts src/app/api/exhibits/[id]/events/custody/route.test.ts` → 14/14 passing.
- Contract check: `grep` confirms `recordCustodyTransfer`, `getCustodian`, `getCustodyHistory` all exported from `src/services/custody.ts`.
- Plan-level build: `npm run build` → exit 0 (all three custody routes registered).
- Typecheck: `npx tsc --noEmit` → exit 0.
- `## Known Stubs` section present; no blocking stubs.

## Known Stubs

None found. `grep -nE "TODO|FIXME|placeholder|not.?implemented|coming soon"` across all created/modified files returns no real stubs (the only match is a comment in `custody.ts` explaining that a placeholder custody row is deliberately NOT created for a custody gap).

---
*Phase: 01-data-foundation*
*Completed: 2026-10-07*
