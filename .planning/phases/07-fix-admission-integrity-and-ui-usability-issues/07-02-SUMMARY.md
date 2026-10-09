---
phase: 07-fix-admission-integrity-and-ui-usability-issues
plan: 02
subsystem: testing
tags: [seed, discrepancies, admission-gate, f12, f15, vitest, playwright, event-sourcing]

requires:
  - phase: 07-01
    provides: AdmissionBlockedError + F12 admission gate in recordStatusChange
provides:
  - Gate-compliant seed loader (every ADMITTED transition preceded by custody/ruling)
  - Redefined P-2 (OFFERED, single-reason blockable) and P-3 (OBJECTED, dual-reason blockable) demo fixtures
  - Seed-only recordedAt passthrough on recordEvent/custody/objection/ruling
  - Green pre-existing test suite under the new gate (status/discrepancies/route/exhibits/history/search tests)
  - forceAdmitBypassingGate test helper pattern for white-box discrepancy/finalize fixtures
affects: [07-03, 07-04, 07-06, jury-package, discrepancies]

tech-stack:
  added: []
  patterns:
    - "Seed-only recordedAt override threaded through recordEvent (default stays new Date())"
    - "forceAdmitBypassingGate test helper: direct STATUS_CHANGE + projection write for white-box discrepancy preconditions, never shipped in src/services or routes"
    - "Admission-blockable demo fixtures demonstrate F12's gate directly (pre-admitted status) instead of now-impossible post-admission flags"

key-files:
  created: []
  modified:
    - src/services/events.ts
    - src/services/custody.ts
    - src/services/objections.ts
    - src/data/seed.ts
    - src/data/seed.test.ts
    - src/services/status.test.ts
    - src/services/discrepancies.test.ts
    - src/app/api/cases/[id]/discrepancies/route.test.ts
    - src/app/api/discrepancies/[id]/acknowledge/route.test.ts
    - src/app/api/jury-package/[id]/finalize/route.test.ts
    - src/services/exhibits.test.ts
    - src/services/history.test.ts
    - src/app/api/cases/[id]/exhibits/search/route.test.ts
    - e2e/case-workspace-discrepancies.spec.ts
    - vitest.config.ts

key-decisions:
  - "P-2/P-3 redefined as pre-admitted admission-blockable fixtures (OFFERED / OBJECTED) — the gate itself is the demonstration, not a post-hoc flag"
  - "Removed assertSeedIntegrity check #5 (both F6 rule codes OPEN) — structurally unsatisfiable post-F12; no synthetic flag"
  - "forceAdmitBypassingGate lives ONLY in *.test.ts for white-box discrepancy/finalize preconditions"
  - "nextRecordedAt() resolves to real-now (not SEED_START+minutes) to preserve the per-exhibit non-decreasing timeline contract, since status.ts timestamps are un-overridable this plan"

patterns-established:
  - "Seed-only recordedAt passthrough: additive optional param, byte-identical for every live caller"
  - "forceAdmitBypassingGate: construct genuinely-firing ADMITTED-with-flag preconditions despite the live gate"

duration: 21min
completed: 2026-10-09
---

# Phase 7 Plan 02: Make the Seed Loader & Pre-existing Tests Gate-Compliant (F12/F15) Summary

**Reordered every seeded ADMITTED transition behind its custody/ruling, redefined P-2/P-3 as F12 admission-blockable demo fixtures, threaded a seed-only recordedAt override, and brought the entire pre-existing test suite green under 07-01's new admission gate.**

## Performance

- **Duration:** 21 min
- **Started:** 2026-10-09T01:11:00Z
- **Completed:** 2026-10-09T01:32:21Z
- **Tasks:** 3 (plus one in-scope deviation)
- **Files modified:** 15

## Accomplishments

- **Seed loader is gate-compliant.** Every exhibit that reaches ADMITTED (P-4, D-1, S-1) now records custody (and, for D-1, the OVERRULED ruling) BEFORE the ADMIT call, so 07-01's gate passes. `npx tsx src/data/seed.ts` runs end-to-end and prints "Seed complete … 9 exhibits".
- **P-2 and P-3 redefined as F12 demonstrations.** P-2 stops at OFFERED (single-reason `NO_CUSTODIAN` blockable); P-3 stops at OBJECTED with an unresolved objection and no custody (dual-reason `NO_CUSTODIAN` + `UNRESOLVED_OBJECTION` blockable). They now showcase the gate blocking admission directly, rather than modeling a now-impossible post-admission discrepancy flag.
- **Seed-only `recordedAt?` passthrough** added to `recordEvent` and its custody/objection/ruling callers (never `status.ts`). Every live caller omits it and is byte-identical to before (`recordedAt ?? new Date()`).
- **assertSeedIntegrity** checks #2/#3 rewritten to the new OFFERED/OBJECTED admission-blockable shapes; the now-unsatisfiable check #5 (both F6 rule codes OPEN) removed with an explanatory F12 note — no synthetic flag.
- **Entire pre-existing suite green under the gate.** Pattern A (establish custody before ADMIT) for status/finalize-clean fixtures; Pattern B (`forceAdmitBypassingGate`) for white-box discrepancy/acknowledge/finalize fixtures that genuinely need a custody-less/open-objection ADMITTED subject.
- **P-2/P-3 narrative tests updated** across `exhibits.test.ts`, `history.test.ts`, `search/route.test.ts`, and the `case-workspace-discrepancies` e2e spec to the permanent reality: no seeded exhibit ever carries an open discrepancy flag.

## Task Commits

1. **Task 1: Seed gate-compliance + recordedAt passthrough + staggering** - `6f9027b` (feat)
2. **Task 2: Fix pre-existing fixtures broken by the gate** - `2bd65e5` (test)
3. **Task 3: Update P-2/P-3 narrative tests** - `3201c26` (test)
4. **[Rule 1] Fix F4 search route test (4th broken file)** - `3b51352` (test)

_Note: `status.ts` was NOT modified by this plan — it is owned exclusively by 07-01 (commit a00843d). Verified: none of my commits touch it._

## Files Created/Modified

- `src/services/events.ts` — added seed-only `recordedAt?: Date` to `recordEvent`; `recordedAt ?? new Date()`.
- `src/services/custody.ts` / `src/services/objections.ts` — forward optional `recordedAt` to `recordEvent` (custody / objection + ruling).
- `src/data/seed.ts` — reordered custody/ruling before every ADMIT; redefined P-2/P-3; staggering helpers; rewrote `assertSeedIntegrity` #2/#3, removed #5.
- `src/data/seed.test.ts` — new `edgeCaseCounts` shape; F12 demo-blocking test asserting `AdmissionBlockedError` for P-2 (NO_CUSTODIAN) and P-3 (both).
- `src/services/status.test.ts` — Pattern A custody before ADMIT (2 sequences).
- `src/services/discrepancies.test.ts` — `forceAdmitBypassingGate` helper; `admit()` + 2 inline fixtures routed through it.
- `src/app/api/cases/[id]/discrepancies/route.test.ts`, `…/discrepancies/[id]/acknowledge/route.test.ts`, `…/jury-package/[id]/finalize/route.test.ts` — Pattern B bypass for custody-less fixtures; finalize `clean` reordered to Pattern A.
- `src/services/exhibits.test.ts`, `src/services/history.test.ts`, `src/app/api/cases/[id]/exhibits/search/route.test.ts` — P-3 OBJECTED / [] flags / null custodian; structural "no open flag post-F12" tests.
- `e2e/case-workspace-discrepancies.spec.ts` — rewritten to assert zero OPEN badges + clean exhibit + row navigation.
- `vitest.config.ts` — `testTimeout` and `hookTimeout` raised to 60s (the F15 staggering makes `runSeed()` ~11s; several suites call it in hooks and the determinism test runs it twice).

## Decisions Made

- **P-2/P-3 as pre-admitted admission-blockable fixtures.** The gate makes reaching ADMITTED-with-either-precondition structurally impossible, so the fixtures demonstrate the gate itself — the more correct demonstration than the old post-hoc flag.
- **Removed assertSeedIntegrity #5** rather than leave a permanently-failing assertion or synthesize a fake flag; F6 rule logic stays covered by `discrepancies.test.ts`'s white-box fixtures.
- **`forceAdmitBypassingGate` is test-only.** A grep audit (`grep -rn forceAdmitBypassingGate src/` excluding `*.test.ts`) returns nothing (threat T-07-05).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a 4th pre-existing file asserting P-3's old ADMITTED narrative**
- **Found during:** Final full-suite verification (after Task 3)
- **Issue:** `src/app/api/cases/[id]/exhibits/search/route.test.ts` (not in the plan's `files_modified`) asserted the identical now-impossible narrative Task 3 fixes elsewhere — `witness=Finch` returning an ADMITTED P-3 with an `UNRESOLVED_OBJECTION_JURY_ELIGIBLE` flag, and `status=ADMITTED` matching P-3. Two tests failed in the full run.
- **Fix:** Updated both to the post-F12 reality (P-3 is OBJECTED, `[]` flags; `status=ADMITTED` matches nothing, `status=OBJECTED` narrows to P-3). Directly required by the plan's own success criterion "Full `vitest run` suite is green".
- **Files modified:** src/app/api/cases/[id]/exhibits/search/route.test.ts
- **Verification:** `npx vitest run …/search/route.test.ts` → 7/7 green; full suite 206 passed / 0 failed.
- **Committed in:** 3b51352

**2. [Rule 1 - Bug] nextRecordedAt() minute-offsets broke the per-exhibit timeline contract**
- **Found during:** Task 3 (history.test.ts P-3 timeline)
- **Issue:** The plan's `SEED_START + minutes` offset pushed interleaved OBJECTION/CUSTODY/RULING timestamps minutes ahead of the surrounding real-now STATUS_CHANGE events (which `status.ts` — out of scope — emits), violating `history.test.ts`'s non-decreasing-timeline assertion.
- **Fix:** `nextRecordedAt()` resolves to real-now at the call site, so an interleaved event always sits chronologically between its surrounding status events. The `recordedAt` plumbing (Part A) remains in place for a future `status.ts` override. See "Known Limitations".
- **Files modified:** src/data/seed.ts
- **Verification:** history.test.ts 7/7 green.
- **Committed in:** 3201c26

**3. [Rule 3 - Blocking] Raised vitest testTimeout/hookTimeout to 60s**
- **Found during:** Tasks 1 and 3
- **Issue:** The required F15 per-exhibit `sleep(1200)` makes `runSeed()` ~11s; the determinism test runs it twice (~22s) and several suites call it in `beforeAll/beforeEach`, blowing vitest's 5s test / 10s hook defaults.
- **Fix:** `testTimeout: 60000` + `hookTimeout: 60000` in `vitest.config.ts` (test-runner only; container boot unaffected).
- **Committed in:** 6f9027b (testTimeout), 3201c26 (hookTimeout)

---

**Total deviations:** 3 auto-fixed (2 bug, 1 blocking). **Impact:** All necessary for correctness and the plan's "fully green suite" criterion. No scope creep — deviation 1 is the same Task-3 class of fix the plan already prescribed, just a file the plan didn't enumerate.

## Known Limitations

- **F15 item 6 (visibly different displayed minutes) is partially met.** Because `status.ts` is owned by 07-01 and cannot accept a `recordedAt` override this plan, STATUS_CHANGE events keep their real-now timestamp. The explicit `recordedAt` for custody/objection/ruling events therefore must stay real-now too (to preserve the non-decreasing per-exhibit timeline), so the visible spread comes from the inter-exhibit real delay (seconds, not minutes). The `recordedAt` plumbing is fully in place so a later change letting `status.ts` accept an override can stagger whole timelines into distinct minutes with no further seed work. Noted for the Verify stage and any follow-up.

## Known Stubs

None found. (A pre-existing comment in `custody.ts` mentions "placeholder row" but is documentation, not a stub.)

## Issues Encountered

- **Concurrent shared-working-tree hazard (the documented recurring one).** A sibling wave-7 plan running `tsx src/data/seed.ts` partially clobbered my P-2/P-3 edits mid-task (re-applied) and caused transient FK-constraint/timeout races on the shared demo DB. Resolved by re-applying the reverted edits and re-running verifications when sibling processes were quiescent / using separate verify DBs. The final full suite (33 files, 206 passed, 0 failed), build (EXIT=0), tsc (clean), and Playwright spec (3/3) all pass on the committed state.

## Next Phase Readiness

- Seed boot (`migrate → seed → serve`) is unblocked under 07-01's gate.
- 07-03 (F13 sealed regression) relies on S-1 remaining ADMITTED + sealed — preserved (custody moved before its ADMIT).
- Full `vitest run` green, `next build` EXIT=0, `e2e/case-workspace-discrepancies.spec.ts` 3/3 green.

---
*Phase: 07-fix-admission-integrity-and-ui-usability-issues*
*Completed: 2026-10-09*

## Self-Check: PASSED

- SUMMARY.md exists on disk.
- All four task commits present (6f9027b, 2bd65e5, 3201c26, 3b51352).
- Plan-level build ran: `npm run build` → exit 0.
- Full suite: `npx vitest run` → 33 files, 206 passed / 3 skipped / 0 failed.
- `e2e/case-workspace-discrepancies.spec.ts` → 3/3 passed (Playwright, workers=1).
- `status.ts` untouched by this plan's commit range (owned by 07-01).
- `forceAdmitBypassingGate` present only in `*.test.ts` (threat T-07-05 audit clean).
- No blocking stubs.
