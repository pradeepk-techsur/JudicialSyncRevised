---
status: complete
phase: 01-data-foundation
source: 01-01-SUMMARY.md, 01-02-SUMMARY.md, 01-03-SUMMARY.md, 01-04-SUMMARY.md, 01-05-SUMMARY.md, 01-06-SUMMARY.md, 01-07-SUMMARY.md
started: 2026-10-07T03:25:51Z
updated: 2026-10-07T03:40:15Z
---

## Current Test

[testing complete]

## Tests

### 1. Real-time status read reflects the latest recorded event
expected: Recording a new status change for an exhibit and immediately re-reading its status shows the update — no stale or cached value, no delay.
result: pass

### 2. Full chronological history reconstructs from the ledger
expected: Fetching an exhibit's history returns every status change, objection, ruling, and custody transfer it has ever had, in the exact order they happened — a complete story, not a partial one.
result: pass

### 3. Invalid status transition is rejected
expected: Attempting to change an already-finalized exhibit's status fails with a clear error instead of silently applying — the exhibit's status does not change.
result: pass

### 4. Non-judge ruling attempt is rejected
expected: A non-judge user attempting to record a ruling on an objection (including a RESERVED disposition) is refused with a clear "only a judge" error — the objection remains unresolved.
result: pass

### 5. Wrong-holder custody transfer is rejected
expected: Attempting to transfer custody "from" someone who is not the exhibit's actual current custodian is refused, and the exhibit's custody record is completely unchanged afterward.
result: pass

### 6. Seed loader produces a deterministic demo case
expected: Running the seed loader produces the same complete 8-exhibit demo case every time, with zero manual data entry, even after re-running it from a clean state.
result: pass

### 7. Seed data contains the required discrepancy edge cases
expected: The demo case always contains at least one unresolved objection, one custody gap (an admitted exhibit with no custodian on record), and one jury-package-eligible discrepancy (an admitted exhibit still carrying an open objection).
result: pass

### 8. Rebuilding projections from the ledger matches live state
expected: Replaying the full event ledger and recomputing every exhibit's current status/custody/objection state produces results identical to what is actually stored — proving the "current state" views are purely derived, never independently-edited.
result: pass

### 9. Docker Compose dev stack boots clean
expected: `docker compose up` brings up Postgres and the app, runs migrations and the seed automatically, and the app responds on port 3000 — with no manual setup steps.
result: pass

## Summary

total: 9
passed: 9
issues: 0
pending: 0
skipped: 0

## Self-Check

boot: 200
data: all preconditions present (seed loader produces deterministic demo case automatically on boot; no UI-driven tests this phase — API/CLI only)
routes_probed: 12 ok / 0 failed
cookie: n/a (no auth/session in Phase 1 — no UI, no login)
browser_urls: none (headless API phase, no object storage, no browser-facing URLs emitted)
repairs: []
per_test:
  - test: 1
    verdict: pass
    note: "🤖 Auto-check: POST MARKED→OFFERED on P-5, then immediate GET /status showed OFFERED with matching event id. No staleness. (Verified via direct API call; seed was idempotently re-run afterward to restore the clean baseline for your testing — this is the seed's own designed behavior, not a workaround.)"
    confidence: proven
  - test: 2
    verdict: pass
    note: "🤖 Auto-check: GET /api/exhibits/:id/history on P-3 (the jury-eligible-discrepancy exhibit) returned all 7+ ledger events in sequenceNo order — STATUS_CHANGE x3, OBJECTION_RAISED, STATUS_CHANGE, CUSTODY_TRANSFER — each with a plain-language summary and resolved actor name, no raw enums/UUIDs leaked."
    confidence: proven
  - test: 3
    verdict: pass
    note: "🤖 Auto-check: POST a status change on P-4 (ADMITTED, terminal) was rejected 409 STATUS_FINALIZED; re-read confirmed status unchanged."
    confidence: proven
  - test: 4
    verdict: pass
    note: "🤖 Auto-check: POST a RESERVED ruling as the seeded DEPUTY user on P-1's unresolved objection was rejected 403 ROLE_NOT_PERMITTED ('Only a judge may record a ruling on an objection'); objection remained UNRESOLVED."
    confidence: proven
  - test: 5
    verdict: pass
    note: "🤖 Auto-check: POST a custody transfer on P-3 claiming 'from' the Deputy (actual holder was the Clerk) was rejected 409 CUSTODY_CHAIN_BROKEN; re-read confirmed custodian unchanged (still the Clerk)."
    confidence: proven
  - test: 6
    verdict: pass
    note: "🤖 Auto-check: re-ran the idempotent seed loader live (docker compose exec app npx tsx src/data/seed.ts) against the running stack; it reset and rebuilt the single fixed-caseNumber (2026-CR-0142) case, producing exactly 8 exhibits again with no duplicate accumulation."
    confidence: proven
  - test: 7
    verdict: pass
    note: "🤖 Auto-check: after the re-seed, confirmed via API: P-1 unresolved objection present (Miranda grounds), P-2 is ADMITTED with custodian:null (custody gap), P-3 is ADMITTED with a still-unresolved objection (chain-of-custody grounds) — all three required edge cases present post-reseed, not just at original seed time."
    confidence: proven
  - test: 8
    verdict: pass
    note: "🤖 Auto-check: ran the project's own rebuild.test.ts inside the running container (npx vitest run) — all 3 tests passed: zero-diff match against live seeded case, a read-only side-effect check (zero ledger/projection mutation), and a negative control proving the diff detects a deliberately corrupted projection. Full suite also run: 13 files / 67 tests, all green."
    confidence: proven
  - test: 9
    verdict: pass
    note: "🤖 Auto-check: booted via `.pivota/boot-ctl.sh start 3000` (wraps `docker compose up --build`) from a cold stop — Postgres health-gated, migrate deploy found no pending migrations, seed ran automatically, Next.js bound :3000 in under 30s total. Preview-path probe (port 7777 proxy) also returned 200, matching the direct probe."
    confidence: proven

## Gaps

[none yet]
