---
phase: 01-data-foundation
verified: 2026-10-07T03:12:09Z
status: passed
score: 5/5 must-haves verified
---

# Phase 1: Data Foundation Verification Report

**Phase Goal:** The system records every exhibit's identity and every status/objection/ruling/custody change as immutable, replayable ledger events — with deterministic seed data loaded through that same path — producing a demo-ready case containing the specific discrepancy edge cases the later differentiator features depend on.

**Verified:** 2026-10-07T03:12:09Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| #   | Truth                                                                                               | Status     | Evidence                                                                                                                    |
| --- | --------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| 1   | Current status/custody/objection state always reflects most recent event; no stale/cached value     | ✓ VERIFIED | Live spot-check: recorded P-5 MARKED→OFFERED, immediate re-query returned OFFERED. Projection upsert is in same tx as ledger write (status.ts:89-117). |
| 2   | Full chronological history reconstructable by replaying ledger events in order                      | ✓ VERIFIED | Live spot-check: `getExhibitHistory(D-1)` returned 7 entries in sequenceNo order spanning all event types (STATUS_CHANGE×4, OBJECTION_RAISED, RULING_RECORDED, CUSTODY_TRANSFER). history.ts reads ledger directly, no filtering/limit. |
| 3   | Invalid actions refused (out-of-order status, non-judge ruling, wrong-holder custody)               | ✓ VERIFIED | Live spot-check: all 3 threw — `INVALID_STATUS_TRANSITION`, `ROLE_NOT_PERMITTED`, `CUSTODY_CHAIN_BROKEN`. Checks run inside locked tx before any ledger write. |
| 4   | Seed re-runs deterministically; produces ≥1 unresolved objection, ≥1 custody gap, ≥1 jury-eligible   | ✓ VERIFIED | Live spot-check: two clean re-runs both → 8 exhibits; 2 unresolved objections, 1 custody gap, 1 jury-eligible. Seed uses only live service fns (grep: no direct event/projection insert). `assertSeedIntegrity` enforces all 3 or rolls back. |
| 5   | Rebuilding projections by replaying ledger produces results identical to live projections            | ✓ VERIFIED | Live spot-check: `rebuildProjections` → matches:true, 0 diffs. rebuild.ts is read-only (no recordEvent, no *CurrentState writes). Negative-control test corrupts a projection and asserts detection — the check has teeth. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact                               | Expected                                   | Status     | Details                                                                                     |
| -------------------------------------- | ------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------- |
| `src/services/events.ts`               | Sole append-only ledger writer             | ✓ VERIFIED | Only production `exhibitEvent.create` call site (events.ts:74). Validates payload, accepts caller tx for atomic composition. |
| `src/services/status.ts`               | Status state machine + projection          | ✓ VERIFIED | Advisory-lock serialized read-check-write; ledger + projection in one tx; terminal-state + transition guards. |
| `src/services/objections.ts`           | Objection/ruling threads, judge-gating     | ✓ VERIFIED | Per-thread lifecycles; judge role checked against actual User.role; atomic ledger+projection (B2 fix verified). |
| `src/services/custody.ts`              | Chain-of-custody, from-holder validation   | ✓ VERIFIED | Advisory-lock serialized; chain check re-read inside lock (B1 fix verified); custody-gap null is meaningful. |
| `src/services/history.ts`              | Full chronological replay from ledger      | ✓ VERIFIED | Reads complete ordered ledger, no limit; resolves actor/custodian names; honest empty discrepancyFlags placeholder. |
| `src/services/rebuild.ts`             | Read-only projection-integrity check       | ✓ VERIFIED | In-memory replay + diff; never writes; distinguishes absent row from null via ABSENT sentinel; orphan-thread check. |
| `src/data/seed.ts`                    | Deterministic seed via live service path   | ✓ VERIFIED | 8 exhibits incl. 3 planted edge cases; idempotent reset; integrity assertion with rollback; no direct DB-insert backdoor. |
| `src/app/api/**` routes                | Thin delegating API surface                | ✓ VERIFIED | 13 routes build cleanly (gate wave 5/6); each delegates to one service fn. |

### Key Link Verification

| From                | To                        | Via                                   | Status | Details                                                              |
| ------------------- | ------------------------- | ------------------------------------- | ------ | ------------------------------------------------------------------- |
| status/custody/objection services | events.recordEvent | pass `tx` for atomic ledger+projection | WIRED  | All three pass tx; projection upsert in same transaction.           |
| recordEvent         | exhibitEvent table        | sole `tx.exhibitEvent.create`          | WIRED  | Grep confirms single production writer.                             |
| seed.ts             | live service functions    | createExhibit/recordStatusChange/etc.  | WIRED  | No prisma.exhibitEvent/*CurrentState create in seed body.           |
| rebuild.ts          | ledger (read-only)        | findMany + in-memory diff              | WIRED  | No writes; live spot-check confirmed 0 side-effect rows.            |
| ruling service      | User.role (server-side)   | prisma.user lookup, not client claim   | WIRED  | Non-judge ruling refused live (ROLE_NOT_PERMITTED), T-01-11 satisfied. |

### Requirements Coverage

| Requirement | Status      | Blocking Issue |
| ----------- | ----------- | -------------- |
| F0          | ✓ SATISFIED | —              |
| F0a         | ✓ SATISFIED | —              |
| F1          | ✓ SATISFIED | —              |
| F2          | ✓ SATISFIED | —              |
| F3          | ✓ SATISFIED | —              |

### Anti-Patterns Found

None. Production source (`src/services`, `src/data`, `src/lib`, `src/app/api`, excluding tests) scanned for TODO/FIXME/placeholder/"not implemented" — none found. The one empty value (`discrepancyFlags: []` in history.ts) is a documented, API-contract-prescribed placeholder for Phase 3, not a stub.

### Gate Evidence (cited, not re-litigated)

- `gate_status: passed_with_warnings` — warnings are wave-1 tests skipped (scaffold-only, no test files yet); all subsequent waves pass. Benign.
- `boot_smoke: skipped` — first phase, no `.pivota/start-dev.sh` yet. Not a failure. Build passes all 6 waves; app compiles and routes generate.
- `review_blockers_open: 0` — 2 BLOCKERs (B1 custody concurrency, B2 objection/ruling atomicity) found, fixed (5d0c2f0, 002293e), and re-reviewed CLEAN with fixer code read directly. Both fixes independently confirmed in this verification by reading custody.ts (lock + in-lock re-read) and objections.ts (both paths in prisma.$transaction with tx passed to recordEvent).
- `shadowed_sources: 0`, `tests_disabled_during_fixes: none`.
- Final suite: 67/67 tests green (gate waves 5 & 6).

### Behavioral Spot-Checks (live DB, localhost:5432)

1. **Seed determinism + edge cases** — `runSeed()` twice from clean:
   `SEED1 exhibits: 8 SEED2 exhibits: 8 determin: true` / `UNRESOLVED objections: 2` / `CUSTODY GAP: 1` / `JURY-ELIGIBLE: 1`
2. **Rebuild = live** — `rebuildProjections(caseId)` → `REBUILD matches: true diffs: 0`
3. **Read-after-write** — `C1 read-after-write: before= MARKED after= OFFERED => true`
4. **History replay** — `C2 history D-1 entries: 7 types: STATUS_CHANGE,STATUS_CHANGE,OBJECTION_RAISED,STATUS_CHANGE,RULING_RECORDED,STATUS_CHANGE,CUSTODY_TRANSFER`
5. **Invalid-action rejection** — `C3a INVALID_STATUS_TRANSITION`, `C3b ROLE_NOT_PERMITTED`, `C3c CUSTODY_CHAIN_BROKEN` (P-4 current custodian correctly = clerk; transfer claiming from=deputy refused)
6. **Sole-writer grep** — only production `exhibitEvent.create` is events.ts:74 (other matches are comments + test fixtures)

All spot-checks produced expected output. Each restored a clean seed afterward.

### Human Verification Required

None required for phase pass. Two items carry `requires human verification` from code review as follow-ups (not gate blockers, not goal-defeating):
- **Concurrency correctness under real contention** (B1 fix): no multi-connection race test exists in the suite; the advisory-lock design is verified by code reading and mirrors the proven status path.
- **Atomicity-on-process-crash** (B2 fix): no process-kill test exists; atomicity is verified structurally (both writes in one `prisma.$transaction`).

These are inherent limits of automated in-process testing, not gaps in the delivered behavior.

### Gaps Summary

No gaps. All 5 ROADMAP success criteria are independently verified against the running codebase — not merely asserted by SUMMARY files. The event-sourcing invariant (single ledger writer), the derived-projection guarantee (rebuild equals live), the validation refusals, and the deterministic seed with all three planted edge cases are each observed live. The two previously-found BLOCKERs are confirmed genuinely fixed by direct code inspection. Phase goal achieved; ready to proceed.

---

_Verified: 2026-10-07T03:12:09Z_
_Verifier: Claude (pivota_spec-verifier)_
