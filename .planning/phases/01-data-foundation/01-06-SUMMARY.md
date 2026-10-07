---
phase: 01-data-foundation
plan: 06
subsystem: database
tags: [seed, prisma, event-sourcing, docker, demo-data, tsx]

# Dependency graph
requires:
  - phase: 01-02
    provides: createExhibit (exhibit identity records) + recordEvent (sole ledger writer)
  - phase: 01-03
    provides: recordStatusChange (status state machine)
  - phase: 01-04
    provides: recordObjection / recordRuling / getUnresolvedObjections (objection threads)
  - phase: 01-05
    provides: recordCustodyTransfer (chain-of-custody)
provides:
  - Deterministic, idempotent seed loader (runSeed) that builds the full demo case through the live write path
  - Three planted edge cases (unresolved objection, custody gap, jury-eligible discrepancy) enforced by a post-seed assertion
  - npm run seed + Docker migrate -> seed -> serve boot sequence (zero manual data entry)
affects: [phase-02-screens, phase-03-discrepancy-detection, phase-04-assistant, demo-walkthrough]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Seed data produced exclusively through service functions (never direct DB inserts) — structurally grep-enforced"
    - "Idempotent reset-then-rebuild seed safe to run on every container boot"
    - "Fail-fast post-seed integrity assertion with full rollback on missing edge case"

key-files:
  created:
    - src/data/seed.ts
    - src/data/seed.test.ts
  modified:
    - package.json
    - Dockerfile

key-decisions:
  - "Seed writes exclusively through createExhibit/recordStatusChange/recordObjection/recordRuling/recordCustodyTransfer — zero direct prisma.*.create for ledger/projection rows, grep-enforced in both the done-criteria and seed.test.ts (threat T-01-17)"
  - "Determinism achieved via clean-state reset (resetSeedCase) at the start of every runSeed, scoped strictly to the fixed caseNumber 2026-CR-0142 — never touches test-fixture cases"
  - "Rollback-on-failure implemented via try/catch calling resetSeedCase rather than one giant outer $transaction, since each recordEvent opens its own internal transaction (the plan's explicit sanctioned alternative)"
  - "Docker CMD runs migrate -> tsx seed -> next start; the idempotent seed makes re-running on every boot (persistent db volume) safe"

patterns-established:
  - "Service-layer-only seed: demo data can only represent states the live system could actually produce"
  - "Planted-edge-case + post-seed assertion: the demo is guaranteed to contain the conditions downstream phases must detect"

# Metrics
duration: 5min
completed: 2026-10-07
---

# Phase 1 Plan 6: Seed/Demo Data Loader (F0a) Summary

**Deterministic, idempotent seed loader that builds a complete 8-exhibit trial (State v. Harlan Doyle) entirely through the live event-sourced write path, with three deliberately-planted edge cases enforced by a fail-fast post-seed assertion, wired into the Docker migrate→seed→serve boot.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-10-07T02:48:25Z
- **Completed:** 2026-10-07T02:54:17Z
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `runSeed()` creates one `Case`, one `User` per `Role` (6 personas from PERSONAS spec), and 8 exhibits — every status change, objection, ruling, and custody transfer written through the exact service functions a live UI action would call. Zero direct ledger/projection inserts.
- Three planted edge cases, verified present after every run: **unresolved objection** (P-1), **custody gap** (P-2: ADMITTED with zero custody events), and **jury-eligible discrepancy** (P-3: ADMITTED while carrying an open objection thread).
- Idempotent clean-state reset makes the seed safe to re-run on every container boot without duplicate accumulation; a second consecutive run produces an identical exhibit count and still exactly one `Case` row.
- Post-seed `SeedIntegrityError` aborts and rolls back the entire seed if any required edge case is missing (never leaves partial data).
- Full Docker Compose stack boots through migrate → seed → serve with zero manual steps; verified in container logs (`Seed complete: case 2026-CR-0142 ... with 8 exhibits`) between migration and Next.js ready.

## Task Commits

1. **Task 1: Seed loader with planted edge-case histories** - `ab0ffae` (feat)
2. **Task 2: Wire seed into npm/Docker boot sequence** - `4117516` (chore)

## Files Created/Modified
- `src/data/seed.ts` - Deterministic seed loader: reset → identity setup → exhibit histories via service layer → post-seed integrity assertion; tsx CLI entry guarded by `import.meta.url`
- `src/data/seed.test.ts` - Edge-case presence, two-run determinism (identical count, single case row), and a comment-stripped static check that seed.ts never bypasses the service layer
- `package.json` - Added `seed` script (`tsx src/data/seed.ts`)
- `Dockerfile` - CMD now runs `prisma migrate deploy && tsx src/data/seed.ts && next start`

## Decisions Made
- **Service-layer-only writes, grep-enforced.** The seed exercises only Plan 2–5 service functions; both the done-criteria grep and a static check inside seed.test.ts (which strips comments first) confirm zero direct `prisma.exhibitEvent.create` / `prisma.*CurrentState.create`. This structurally guarantees seed data represents only states the live system could produce (threat T-01-17).
- **Rollback via explicit cleanup, not one outer transaction.** Because each `recordEvent` opens its own internal transaction, wrapping the whole seed in a single `$transaction` is impractical; the plan's sanctioned alternative — post-seed assertion then explicit `resetSeedCase()` on failure — is used, preserving the "abort entire seed, never partial data" guarantee.
- **Scoped reset.** `resetSeedCase()` deletes strictly within the fixed `caseNumber` (2026-CR-0142), in FK-safe order, so it never disturbs the per-test fixture cases other suites create.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Comment containing the banned pattern tripped the done-criteria grep**
- **Found during:** Task 1 (verification)
- **Issue:** A doc-comment in `seed.ts` literally spelled out `prisma.exhibitEvent.create / prisma.*CurrentState.create` to explain the rule to readers, causing the plan's `grep -c '...\.create' seed.ts` done-check to return `1` instead of `0` — a false positive (the match was a comment, not code).
- **Fix:** Reworded the comment to describe the banned inserts without the literal `.create` token. The structural guarantee is unchanged; seed.test.ts's comment-stripped static check already proved zero real direct writes.
- **Files modified:** src/data/seed.ts
- **Verification:** `grep -c` now returns 0; all seed tests still pass.
- **Committed in:** ab0ffae (Task 1 commit)

**2. [Rule 3 - Blocking] Stale app image masked the real boot sequence**
- **Found during:** Task 2 (verification)
- **Issue:** The first `docker compose up` reused a pre-existing `project-app` image built before `src/data/seed.ts` existed, so no `Seed complete` line appeared and `/app/src/data` was absent in the container — the seed step silently was not exercised.
- **Fix:** Removed the stale app container and ran `docker compose build app` to rebuild from current source, then re-booted. The `docker build -t pivota-build-check .` done-step builds a different tag than compose uses, so an explicit compose rebuild was needed to verify the real boot path.
- **Files modified:** none (build/verification procedure only)
- **Verification:** Freshly-built container logs show `migrate deploy → Seed complete: case 2026-CR-0142 ... with 8 exhibits → Next.js ✓ Ready`; `curl localhost:3000` returns 200.
- **Committed in:** n/a (no source change; procedural fix during verification)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both necessary to prove the done criteria genuinely hold. No scope creep.

## Known Stubs
None found.

## Issues Encountered
None — both tasks completed and verified. Note: per the sandbox database contract, the running `db` service was left up (integration tests connect to it directly); only the `app` container was stopped at the end of verification, satisfying "stops cleanly" without tearing down the shared DB.

## User Setup Required
None - no external service configuration required. All seeded data is fictional/demo-representative (threat T-01-19).

## Next Phase Readiness
- F0a capstone artifact complete: Phase 2's screens and every later phase's demo walkthrough now have a deterministic, fully-populated demo case to render against, including both flagged and clean exhibits.
- The jury-eligible-discrepancy and custody-gap conditions are now present in seed data, ready for Phase 3's discrepancy-detection rules to detect.
- **Phase 1 (Data Foundation) is now complete — 7 of 7 plans done.** Ready for phase transition / verify-work.

---
*Phase: 01-data-foundation*
*Completed: 2026-10-07*

## Self-Check: PASSED
- src/data/seed.ts — FOUND
- src/data/seed.test.ts — FOUND
- Commit ab0ffae — FOUND
- Commit 4117516 — FOUND
- Build check: `docker build` → exit 0; `docker compose build app` → exit 0; full stack boots migrate→seed→serve, curl :3000 → 200
- Known Stubs: none blocking
