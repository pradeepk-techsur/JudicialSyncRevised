---
phase: 01-data-foundation
plan: 7
subsystem: database
tags: [event-sourcing, ledger-replay, projection-integrity, prisma, vitest, nextjs-api, audit]

# Dependency graph
requires:
  - phase: 01-06
    provides: runSeed() deterministic 8-exhibit demo case with planted edge cases
  - phase: 01-02
    provides: recordEvent ledger writer, getExhibit, typed error layer + apiError envelope
  - phase: 01-03
    provides: ExhibitCurrentState status projection
  - phase: 01-04
    provides: ObjectionCurrentState per-thread projection + RESERVED semantics
  - phase: 01-05
    provides: CustodyCurrentState projection
provides:
  - getExhibitHistory — full ordered timeline across all event types, plain-language summaries, resolved actor names
  - rebuildProjections — read-only ledger replay proving current-state projections are purely derived
  - GET /api/exhibits/:id/history API route
affects: [phase-02-exhibit-detail-view, phase-02-f10, phase-04-assistant]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ledger replay reconstruction: fetch ExhibitEvent orderBy sequenceNo asc, fold in memory"
    - "Projection-integrity diff: in-memory rebuild vs live rows, {exhibitId, field, live, rebuilt} diffs, ABSENT sentinel distinguishes no-row from null-field"
    - "Integration tests run file-serial (fileParallelism:false) because all share one Postgres + one fixed-caseNumber seed"

key-files:
  created:
    - src/services/history.ts
    - src/services/history.test.ts
    - src/services/rebuild.ts
    - src/services/rebuild.test.ts
    - src/app/api/exhibits/[id]/history/route.ts
  modified:
    - vitest.config.ts

key-decisions:
  - "discrepancyFlags returned as [] (honest Phase 1 placeholder per Y1-api.md); DiscrepancyFlag table arrives in Phase 3"
  - "RESERVED rulings do NOT close an objection thread in rebuild replay — mirrors recordRuling in objections.ts"
  - "rebuildProjections is strictly read-only (never recordEvent / never *CurrentState write) — threat T-01-20, asserted by a before/after side-effect test"
  - "ABSENT sentinel separates 'no projection row should exist' from a present-but-null field so the two never alias"
  - "fileParallelism:false in vitest.config.ts — shared-DB integration suites cannot safely rebuild the same seed case in parallel workers"

patterns-established:
  - "Projection integrity check: replay ledger -> in-memory projection -> field-by-field diff vs live, with a negative control proving the diff detects divergence"

# Metrics
duration: 4min
completed: 2026-10-07
---

# Phase 1 Plan 7: Ledger Replay & Projection Integrity Summary

**Closes Phase 1's auditability guarantee: `getExhibitHistory` reconstructs an exhibit's complete chronological timeline straight from the append-only ledger, and `rebuildProjections` replays that ledger to prove the current-state projections are byte-identical derivations — verified against the real seeded demo case, including a negative control.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-10-07T02:57:22Z
- **Completed:** 2026-10-07T03:01:11Z
- **Tasks:** 2
- **Files modified:** 6 (5 created, 1 modified)

## Accomplishments
- `getExhibitHistory` — replays the full `ExhibitEvent` ledger per exhibit in `sequenceNo` order across every event type (no filtering, no truncation, no "recent N"), translating each event into a plain-language `summary` and resolving `actorUserId`/custodian ids to human names. No raw enum, JSON, or UUID leaks into the response.
- `GET /api/exhibits/:id/history` — thin route wrapping the service; 404 `EXHIBIT_NOT_FOUND` on null. Registered in the Next.js build.
- `rebuildProjections` — read-only replay that recomputes status/custody/objection-thread projections in memory and diffs them field-by-field against the live `*CurrentState` tables, returning `{ matches, diffs }`.
- Direct proof of Phase 1 success criterion 5: `rebuildProjections(caseId)` reports `matches: true` / zero diffs against the real seeded case; a negative control (intentionally corrupted `currentStatus`) confirms the diff actually detects divergence; a side-effect test confirms zero live-state mutation (T-01-20).

## Task Commits

Each task was committed atomically:

1. **Task 1: getExhibitHistory + API route + test** - `5192b3a` (feat)
2. **Task 2: rebuildProjections + integrity test** - `555c0e1` (feat)
3. **Deviation fix: serialize integration test files** - `3d454f4` (fix)

**Plan metadata:** (docs commit, this summary + STATE.md)

## Files Created/Modified
- `src/services/history.ts` - `getExhibitHistory`: full ledger-replay timeline with plain-language summaries + resolved actor/custodian names
- `src/services/history.test.ts` - integration test: sequence-ordered interleaving (P-3), no enum/JSON/UUID leaks, `[]` discrepancyFlags, custody-gap exhibit (P-2)
- `src/services/rebuild.ts` - `rebuildProjections`: read-only ledger replay + field-by-field diff vs live projections
- `src/services/rebuild.test.ts` - positive case (zero diffs), read-only side-effect check (T-01-20), negative control (corrupted projection detected)
- `src/app/api/exhibits/[id]/history/route.ts` - GET route wrapping getExhibitHistory
- `vitest.config.ts` - `fileParallelism: false` (deviation fix, see below)

## Decisions Made
- `discrepancyFlags` is `[]` in the Phase 1 response — the `DiscrepancyFlag` table does not exist until Phase 3; `[]` is the honest placeholder the `Y1-api.md` shape prescribes, not a fabricated value.
- In rebuild replay, a `RESERVED` ruling leaves the thread `UNRESOLVED`; only `SUSTAINED`/`OVERRULED` close it — mirrors `recordRuling` in `objections.ts` exactly so the reconstruction matches the live write path.
- `rebuildProjections` is read-only by construction: it contains zero `recordEvent` calls and zero `*CurrentState` writes, and the test asserts a byte-identical projection snapshot + unchanged ledger count before/after a call (threat T-01-20).
- An `ABSENT` sentinel distinguishes "no projection row should exist" from a genuine null field value, so an absent row and a present-null field can never be mistaken for one another; orphaned live objection threads (no raise event in the ledger) are also flagged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Type cast on Prisma `JsonValue` payload rejected by tsc**
- **Found during:** Task 1 (history.ts batch custodian-name collection)
- **Issue:** `e.payload as CustodyTransferPayload` failed `tsc --noEmit` (TS2352) because Prisma's `JsonValue` union does not sufficiently overlap the target interface.
- **Fix:** Used the compiler-recommended `as unknown as CustodyTransferPayload` intermediate cast (the `summarizeEvent` helper already takes `payload: unknown`, so only this one site needed it).
- **Files modified:** src/services/history.ts
- **Verification:** `npx tsc --noEmit` exits 0; history test still green.
- **Committed in:** `5192b3a` (Task 1 commit)

**2. [Rule 1 - Bug] Shared-seed FK race when both new test files run in parallel**
- **Found during:** Plan verification (`npx vitest run history.test.ts rebuild.test.ts`, the plan's own `<verification>` command)
- **Issue:** Both suites call `runSeed()`, which resets and rebuilds the single fixed-caseNumber demo case. Vitest runs test *files* in parallel workers by default, so two workers executed `resetSeedCase()` concurrently and violated foreign-key constraints (P2003 on `users_case_id_fkey` / `exhibit_events_exhibit_id_fkey`). Each file passed in isolation but failed together.
- **Fix:** Set `fileParallelism: false` in `vitest.config.ts`. Every suite in this project is an integration test against the one shared Postgres and the same seed case, so file-level parallelism is unsafe by construction; tests within a file already run sequentially.
- **Files modified:** vitest.config.ts
- **Verification:** The plan's exact verification command passes (8/8), and the full suite passes (13 files / 67 tests).
- **Committed in:** `3d454f4`

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for correctness/verifiability — the first to compile, the second so the plan's own verification command (and the whole suite) passes deterministically. No scope creep.

## Issues Encountered
None beyond the two auto-fixed deviations above.

## Known Stubs
- `src/services/history.ts` — `discrepancyFlags: []` is an intentional, plan-prescribed Phase 1 placeholder (Phase 3 populates it once `DiscrepancyFlag` exists). **Cosmetic, not blocking** — the response shape is correct and honest per `Y1-api.md`; the plan's objective (complete timeline + projection integrity) fully works.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 1's auditability requirement is now closed: history is provably reconstructable from the ledger, and projections are provably pure derivations (verified + negative-controlled).
- `getExhibitHistory` is ready for Phase 2's Exhibit Detail View (F10) to consume directly.
- Phase 1 is the final plan of this phase (7 of 7). Plan 7 complete — phase ready for verification/transition.

## Self-Check

- Files created exist on disk: confirmed below
- Commits exist: confirmed below
- Build ran and passed: `npm run build` → exit 0
- Known Stubs section present; no blocking stubs

## Self-Check: PASSED

All created files exist on disk, all three task/deviation commits are present, `npm run build` exits 0, the full suite passes (13 files / 67 tests), and no blocking stubs remain.

---
*Phase: 01-data-foundation*
*Completed: 2026-10-07*
