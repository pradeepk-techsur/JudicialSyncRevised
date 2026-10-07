---
phase: 01-data-foundation
plan: 04
subsystem: api
tags: [objections, rulings, event-sourcing, service-layer, role-enforcement, nextjs, prisma, vitest, api-routes]

# Dependency graph
requires:
  - phase: 01-02
    provides: "recordEvent() sole append-only ledger writer; typed error layer (errors.ts/apiError.ts); zod event payload schemas"
provides:
  - "recordObjection(args) — raises an independent objection thread (OBJECTION_RAISED event + UNRESOLVED ObjectionCurrentState projection row)"
  - "recordRuling(args) — judge-gated ruling for ALL dispositions incl RESERVED; SUSTAINED/OVERRULED resolve the thread, RESERVED keeps it UNRESOLVED"
  - "getUnresolvedObjections(caseId) — the single shared case-wide unresolved query (no caller-specific variant)"
  - "POST /api/exhibits/:id/events/objection, POST /api/objections/:id/ruling, GET /api/cases/:id/objections?status=unresolved"
affects: [F0a-seed-loader, F1-status, F3-custody, phase-03-discrepancy, phase-02-ui, phase-04-assistant, phase-05-command-center]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-thread objection lifecycle: one ObjectionCurrentState row per objectionId; an exhibit may hold N concurrent UNRESOLVED threads — queries never assume at-most-one"
    - "Server-side role enforcement reads the ACTUAL User.role column, never a client-supplied claim (threat T-01-11)"
    - "Ledger-first write ordering: recordEvent() appends the immutable event, then the derived ObjectionCurrentState projection is created/updated"
    - "Single shared query (getUnresolvedObjections) reused identically by every future consumer — no caller-specific variants"

key-files:
  created:
    - src/services/objections.ts
    - src/services/objections.test.ts
    - src/app/api/exhibits/[id]/events/objection/route.ts
    - src/app/api/objections/[id]/ruling/route.ts
    - src/app/api/cases/[id]/objections/route.ts
    - src/app/api/objections/[id]/ruling/route.test.ts
  modified: []

key-decisions:
  - "Judge-gated ALL three dispositions including RESERVED (plan tightens the FRD baseline, which names only SUSTAINED/OVERRULED) — per must_haves + threat T-01-11: reserving a ruling is itself a judicial act"
  - "Ruling 403 message uses the action-specific variant 'Only a judge may record a ruling on an objection' (covers RESERVED), per the plan's Task 2 instruction and Y2-errors.md's 'feature-specific variants' allowance"
  - "recordObjection distinguishes 404 EXHIBIT_NOT_FOUND (exhibit absent) from 422 INVALID_OBJECTION_TARGET (exists but not OFFERED/OBJECTED), matching the Y1-api §Objections error set"
  - "GET /api/cases/:id/objections returns unresolved threads (the single shared view every current consumer needs); resolved-thread listing deferred to the history/timeline feature (F10) when a consumer requires it"

patterns-established:
  - "Objection threads are independently resolvable per-thread, never collapsed into a single exhibit-level ruling field"
  - "Role-gated write actions resolve the actor's real role server-side before any ledger write"

# Metrics
duration: 3min
completed: 2026-10-07
---

# Phase 1 Plan 04: Objection and Ruling Tracking (F2) Summary

**Per-thread objection lifecycle with ledger-first writes — `recordObjection`/`recordRuling`/`getUnresolvedObjections` service plus three thin API routes — enforcing judge-only ruling for every disposition including RESERVED, and supporting multiple concurrent objection threads per exhibit.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-10-07T02:42:40Z
- **Completed:** 2026-10-07T02:45:37Z
- **Tasks:** 2
- **Files modified:** 6 (6 created)

## Accomplishments
- `recordObjection` opens an independent objection thread: validates `grounds` non-empty, confirms the exhibit exists (404) and is currently `OFFERED`/`OBJECTED` (422 otherwise), writes an `OBJECTION_RAISED` event through `recordEvent`, then creates the `UNRESOLVED` `ObjectionCurrentState` projection row keyed by a freshly-generated `objectionId`.
- `recordRuling` is the plan's highest-value check: it resolves the acting user's **real** `User.role` server-side and rejects any non-JUDGE actor for **all three dispositions, including RESERVED** (403 `ROLE_NOT_PERMITTED`), then writes `RULING_RECORDED`. `SUSTAINED`/`OVERRULED` close the thread (set `rulingEventId`/`ruledAt`); `RESERVED` records the ledger event but leaves the thread `UNRESOLVED`.
- `getUnresolvedObjections(caseId)` is the single shared query — no caller-specific variant — that Case Workspace (F9), Command Center (F8), and the assistant (F7) will all call identically.
- Three thin API routes wired with the existing typed-error envelope; HTTP-layer tests prove the judge-only gate for each disposition with the exact 403 message.

## Task Commits

Each task was committed atomically:

1. **Task 1: Objection-thread service** - `2699492` (feat)
2. **Task 2: Objection/ruling API routes + integration tests** - `cdffdb2` (feat)

**Plan metadata:** (docs commit — see git log)

## Files Created/Modified
- `src/services/objections.ts` - `recordObjection`/`recordRuling`/`getUnresolvedObjections`; typed F2 errors (INVALID_OBJECTION_TARGET, OBJECTION_ALREADY_RESOLVED, ROLE_NOT_PERMITTED)
- `src/services/objections.test.ts` - 8 integration tests (multi-thread, non-judge rejection for RESERVED/SUSTAINED/OVERRULED, judge acceptance, resolution, invalid target, already-resolved, not-found)
- `src/app/api/exhibits/[id]/events/objection/route.ts` - POST raise objection
- `src/app/api/objections/[id]/ruling/route.ts` - POST record ruling
- `src/app/api/cases/[id]/objections/route.ts` - GET case-wide unresolved objections
- `src/app/api/objections/[id]/ruling/route.test.ts` - 10 HTTP-layer tests incl. per-disposition judge-gate (exact 403 message), raise/list, 422/404 targets

## Decisions Made
- **Judge-gated RESERVED (deliberate FRD tightening):** FRD F02 §Validation / Y2-errors.md name only SUSTAINED/OVERRULED for the judge check. The plan's `must_haves.truths` and threat model T-01-11 are explicit and non-negotiable that RESERVED is gated identically ("reserving a ruling is itself a judicial act, not a clerical log entry"). The plan is the execution contract and intentionally tightens the baseline, so RESERVED is judge-gated. Not treated as a deviation — it is the plan's stated instruction.
- **403 message variant:** used "Only a judge may record a ruling on an objection" (Task 2's specified message), which correctly spans RESERVED, rather than the FRD's SUSTAINED/OVERRULED-specific wording. Y2-errors.md §Objection explicitly allows "feature-specific variants" for ROLE_NOT_PERMITTED.
- **404 vs 422 on objection raise:** added an explicit exhibit-existence check so a genuinely missing exhibit returns 404 `EXHIBIT_NOT_FOUND` (per Y1-api §Objections), distinct from an existing-but-non-objectable exhibit (422 `INVALID_OBJECTION_TARGET`).
- **GET objections scope:** the route returns unresolved threads via the shared query — the single view every current consumer needs. Listing resolved threads is left to F10 (history/timeline) when a consumer exists.

## Deviations from Plan

None - plan executed exactly as written.

The per-task items below are clarifications of plan instructions, not unplanned work: the RESERVED judge-gating and its 403 message are both explicitly specified by the plan (`must_haves`, threat T-01-11, Task 2). The 404/422 split on objection-raise is required by the plan's own named error set (Task 2 references `404 EXHIBIT_NOT_FOUND`) and the Y1-api contract, implemented within the Task 2 files.

**Total deviations:** 0.
**Impact on plan:** None — every change falls inside the plan's stated tasks, error sets, and must-haves.

## Known Stubs

None found. `grep -nE "TODO|FIXME|placeholder|not.?implemented|coming soon"` over all four source files returns zero matches. No blocking or cosmetic stubs.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- **Ready for the next Phase 1 plan.** `recordObjection`/`recordRuling` are available for the F0a seed loader to plant the unresolved-objection and discrepancy edge cases, and `getUnresolvedObjections` is the shared query F6 discrepancy detection and later UI/assistant consumers will use.
- Full suite green (56/56); `npm run build` exit 0 with all three new routes registered; `tsc --noEmit` exit 0.
- No blockers.

## Self-Check: PASSED

- All 6 key files verified present on disk.
- Both task commits (`2699492`, `cdffdb2`) verified in git history.
- Plan verification: `npx vitest run src/services/objections.test.ts src/app/api/objections/[id]/ruling/route.test.ts` → 18/18 passing.
- Full suite: `npx vitest run` → 56/56 passing (no regressions).
- Plan-level build: `npm run build` → exit 0 (routes `/api/cases/[id]/objections`, `/api/exhibits/[id]/events/objection`, `/api/objections/[id]/ruling` registered).
- Typecheck: `npx tsc --noEmit` → exit 0.
- Provides contract: `recordObjection` / `recordRuling` / `getUnresolvedObjections` all exported → CONTRACT_OK.
- `## Known Stubs` section present; no blocking stubs.

---
*Phase: 01-data-foundation*
*Completed: 2026-10-07*
