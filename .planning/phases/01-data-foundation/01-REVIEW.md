---
phase: 1
status: issues_found
blockers: 2
warnings: 3
files_reviewed: 24
files_reviewed_list:
  - prisma/schema.prisma
  - prisma/migrations/20261007022934_init/migration.sql
  - src/lib/errors.ts
  - src/lib/apiError.ts
  - src/lib/validation/eventPayloads.ts
  - src/services/events.ts
  - src/services/exhibits.ts
  - src/services/status.ts
  - src/services/objections.ts
  - src/services/custody.ts
  - src/services/history.ts
  - src/services/rebuild.ts
  - src/data/seed.ts
  - src/app/api/exhibits/route.ts
  - src/app/api/exhibits/[id]/route.ts
  - src/app/api/exhibits/[id]/status/route.ts
  - src/app/api/exhibits/[id]/history/route.ts
  - src/app/api/exhibits/[id]/custodian/route.ts
  - src/app/api/exhibits/[id]/custody-history/route.ts
  - src/app/api/exhibits/[id]/events/status/route.ts
  - src/app/api/exhibits/[id]/events/objection/route.ts
  - src/app/api/exhibits/[id]/events/custody/route.ts
  - src/app/api/objections/[id]/ruling/route.ts
  - src/app/api/cases/[id]/objections/route.ts
reviewed_at: 2026-10-07T03:05:01Z
iteration: 1
---

# Phase 1 Code Review

Phase 1 is a well-disciplined event-sourcing foundation. The sole-ledger-writer
invariant is genuinely upheld (the only production `exhibitEvent.create` call is
inside `recordEvent`; all projection writes are confined to the services), the
status state machine is correct and race-safe via a pg advisory lock, the seed is
driven entirely through the live service path, and `rebuildProjections` is a
read-only pure derivation. Two defects undermine the phase's core guarantees —
one breaks the chain-of-custody invariant under concurrency, one breaks
ledger↔projection atomicity for objections — and must be fixed before ship.

## BLOCKERs

### B1: Custody-chain validation is not serialized — concurrent transfers both pass the "from == current custodian" check and silently overwrite each other
- **File:** src/services/custody.ts:61-73 (read/check) vs 91-118 (write)
- **Category:** bug (concurrency / data integrity)
- **Evidence:** The derived current custodian is read at line 62 and the chain
  check at line 71 (`claimedFrom !== currentCustodianUserId → CUSTODY_CHAIN_BROKEN`)
  runs **outside** any transaction or lock. The ledger write + projection upsert
  only open a transaction afterward (line 91), and that transaction takes no lock
  on the exhibit's custody row. Contrast with `status.ts:63`, which deliberately
  takes `pg_advisory_xact_lock(...)` precisely to serialize read-check-write for
  the same exhibit.
  Concrete failing interleaving — exhibit's current custodian is A:
  1. Request X (A→B) reads current=A, passes the chain check.
  2. Request Y (A→C) reads current=A (X not yet committed), passes the chain check.
  3. Both open transactions; both `custodyCurrentState.upsert` (PK = exhibitId);
     the later commit wins. The projection ends at B *or* C, while the ledger now
     contains **two** CUSTODY_TRANSFER events that each claim they started from A.
  This is exactly the condition the feature's own header comment says must be
  "refused outright … never silently reassigned, never partially applied"
  (custody.ts:14-16). The custody chain is corrupted: a later `getCustodyHistory`
  replay shows A→B and A→C as if A handed the same exhibit to two people, and
  `rebuildProjections` will treat whichever lost the race as a divergence.
- **Fix direction:** Wrap the read, chain check, and write in a single
  transaction and serialize per-exhibit the same way `recordStatusChange` does —
  take `pg_advisory_xact_lock(advisoryLockKey(exhibitId))` at the top of the
  transaction, then re-read the current custodian *inside* the lock before
  validating and writing. (Share the `advisoryLockKey` helper rather than
  duplicating it.)

### B2: Objection and ruling writes are not atomic — the ledger event and its projection row are written in two separate transactions
- **File:** src/services/objections.ts:109-126 (recordObjection), 166-188 (recordRuling)
- **Category:** bug (data integrity / event-sourcing invariant)
- **Evidence:** `recordObjection` calls `recordEvent(...)` at line 109 **without**
  passing a `tx` client, so `recordEvent` opens and commits its own transaction
  (events.ts:87-90). The projection row is then created in a *second*, independent
  statement at line 116. `recordRuling` has the identical shape: `recordEvent` at
  166 (no `tx`), then a separate `objectionCurrentState.update` at 181. Both
  `status.ts` and `custody.ts` correctly pass `tx` into `recordEvent` and do the
  projection upsert in the *same* transaction (status.ts:104-132,
  custody.ts:91-118) — objections is the odd one out.
  Failure cases: if the process dies or the projection write throws between the
  two statements, the ledger holds an `OBJECTION_RAISED` event with **no**
  `ObjectionCurrentState` row (objection invisible to `getUnresolvedObjections`,
  so the OBJECTED-status guard at status.ts:89-99 and the Phase-3
  jury-eligibility detection both silently miss it), or a `RULING_RECORDED` event
  while the thread stays `UNRESOLVED` (a recorded judicial ruling that never
  resolves the objection). Either state is a true ledger↔projection divergence
  that `rebuildProjections` is designed to flag — i.e. the phase's own integrity
  check would report corruption.
- **Fix direction:** Wrap each of `recordObjection` and `recordRuling` in
  `prisma.$transaction`, passing the `tx` client into `recordEvent` and doing the
  `objectionCurrentState` create/update on that same `tx`, mirroring the pattern
  already used in `status.ts` and `custody.ts`.

## WARNINGs

### W1: Concurrent events on the same exhibit can collide on sequenceNo and surface as an unhandled 500 outside the status path
- **File:** src/services/events.ts:68-84; callers src/services/objections.ts:109,166 and src/services/custody.ts:92
- **Evidence:** `recordEvent` computes `sequenceNo` as `MAX(sequenceNo)+1` (line 72)
  then inserts. Under the default Read-Committed isolation two concurrent
  `recordEvent` calls for the same exhibit can read the same max and compute the
  same `sequenceNo`; the `@@unique([exhibitId, sequenceNo])` constraint then makes
  one insert fail with Prisma `P2002`. `recordStatusChange` is protected because
  it holds the advisory lock around the call, but the objection and custody
  callers invoke `recordEvent` with no such serialization, so a P2002 propagates
  uncaught and `errorResponse` renders it as a generic 500 (INTERNAL_ERROR). This
  is degraded behavior (spurious 500 under contention), not corruption — the
  unique constraint correctly prevents a bad row from being written. Note that
  fixing B1 (adding the advisory lock to custody) also closes this for the custody
  path; the objection path would still benefit from either the lock or a P2002
  retry/map.
- **Fix direction:** Either serialize per-exhibit around `recordEvent` for the
  objection/custody callers (same advisory-lock approach), or catch P2002 on the
  `(exhibitId, sequenceNo)` index inside `recordEvent` and retry the max+insert a
  bounded number of times.

### W2: Ruling route accepts an unvalidated disposition and casts it straight through
- **File:** src/app/api/objections/[id]/ruling/route.ts:27-28
- **Evidence:** `body.disposition` is cast `as 'SUSTAINED' | 'OVERRULED' | 'RESERVED'`
  and `body.actorUserId` `as string` with no runtime check at the route. A missing
  or malformed `disposition` reaches `recordEvent`, where the zod
  `rulingRecordedPayload` schema does reject it (eventPayloads.ts:30-33) — so this
  does not corrupt the ledger — but note the ordering in `recordRuling`: the
  thread-exists check (objections.ts:144) and the **judge role check**
  (objections.ts:157-163) both run *before* `recordEvent`, so an invalid-payload
  request still triggers DB reads and the role lookup before failing. Functionally
  safe (judge gating is enforced server-side against `User.role`, verified
  correct), but the route is thinner on input validation than its siblings
  (`events/status/route.ts` and `events/custody/route.ts` both validate body
  fields explicitly).
- **Fix direction:** Validate `disposition ∈ {SUSTAINED, OVERRULED, RESERVED}` and
  `actorUserId` is a non-empty string at the route before delegating, consistent
  with the other event routes.

### W3: recordObjection re-persists caller-supplied `grounds`/`objectingParty` into the projection instead of echoing the ledger-validated values
- **File:** src/services/objections.ts:112 vs 116-126
- **Evidence:** The OBJECTION_RAISED payload is validated by zod inside
  `recordEvent` (grounds `min(1)`, party enum), but the projection row at lines
  120-121 is written from the *original* `grounds`/`objectingParty` variables, not
  from the validated `event.payload`. In Phase 1 these are identical so there is
  no live divergence, and `rebuildProjections` reconstructs the thread status
  (not grounds/party) so it would not catch a future drift here. Low risk today;
  flagged because it is a latent source of ledger↔projection skew if payload
  normalization is ever added to the schema.
- **Fix direction:** Source the projection's `grounds`/`objectingParty` from the
  validated `event.payload` (single source of truth), or leave as-is with a note
  that the schema performs no normalization.

## Cross-file seams checked
- recordEvent sole-writer invariant (grep `exhibitEvent.create`): OK — only production call site is events.ts:74; all other matches are test files.
- Projection writes (grep `*CurrentState.(create|update|upsert|delete)`): OK in principle — confined to status.ts, custody.ts, objections.ts, seed.ts reset; but see B2 (objections writes not atomic with ledger).
- recordEvent `client?: PrismaLike` consumers: status.ts passes `tx`, custody.ts passes `tx` — OK; objections.ts omits it — see B2.
- ExhibitStatus enum ↔ ALLOWED_TRANSITIONS (status.ts:21-29): OK — all six statuses + NONE sentinel covered; ADMITTED/EXCLUDED/WITHDRAWN terminal.
- ObjectionStatus enum (no RESERVED) ↔ recordRuling RESERVED handling (objections.ts:177) ↔ rebuild.ts:115: OK — RESERVED writes a ledger event and leaves the thread UNRESOLVED consistently in both the live path and the replay.
- eventPayloadSchemas keys ↔ EventType enum: OK — all five EventType values keyed; recordEvent rejects unknown types (events.ts:34-37).
- Routes ↔ service signatures (status/objection/ruling/custody/custodian/custody-history/history/exhibits): OK — each thin route delegates to exactly one service fn with matching args.
- getUnresolvedObjections single-definition shared by seed assertion + cases route: OK — one definition, no caller-specific variant.
- Custody-gap / null-row "absence is meaningful" contract (schema.prisma:181-184) ↔ getCustodian/custodian route returning `{custodian: null}` ↔ seed planted P-2 gap ↔ assertSeedIntegrity check: OK — absence is never backfilled.
- Judge-only ruling enforcement (objections.ts:157-163) reads actual `User.role`, not a client claim: OK (threat T-01-11 satisfied).
