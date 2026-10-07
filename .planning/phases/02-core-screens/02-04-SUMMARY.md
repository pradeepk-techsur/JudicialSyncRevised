---
phase: 02-core-screens
plan: 04
subsystem: api
tags: [exhibits, search, projections, sealed-exhibits, rbac, prisma, next-api, f4, f9]

# Dependency graph
requires:
  - phase: 02-core-screens
    provides: "02-02 — canViewSealed / parseRequestingRole (shared sealed-visibility predicate + X-User-Role parser)"
  - phase: 01-data-foundation
    provides: "ExhibitCurrentState / CustodyCurrentState projections, typed error layer (NotFoundError/UnprocessableError/ValidationError), errorResponse envelope, exhibitStatusEnum, deterministic seed (P-3/S-1 fixtures)"
provides:
  - "src/lib/types.ts — ExhibitListRow: the shared composite row shape both the list and search endpoints return"
  - "getExhibits(caseId, role) returning ExhibitListRow[] with status/custodian enrichment + role-based sealed exclusion + CASE_NOT_FOUND guard"
  - "searchExhibits(criteria) — AND-combined keyword/status/witness/dateFrom/dateTo filtering returning the identical ExhibitListRow shape"
  - "GET /api/cases/:id/exhibits (upgraded) and GET /api/cases/:id/exhibits/search (new) routes"
affects: [02-06 (Case Workspace Screen — calls both functions through their routes)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single shared toListRow mapper: getExhibits and searchExhibits return the byte-identical ExhibitListRow shape, so the two endpoints can never drift"
    - "Date filtering nested on the optional currentState relation (lastStatusAt) — Prisma's relational filter on an optional to-one auto-excludes never-statused exhibits with no manual null-handling"
    - "Sealed exclusion applied in the SAME WHERE clause as the content filters (never a post-query filter), inheriting the 02-02 canViewSealed predicate"

key-files:
  created:
    - src/lib/types.ts
    - src/app/api/cases/[id]/exhibits/search/route.ts
    - src/app/api/cases/[id]/exhibits/search/route.test.ts
    - src/app/api/cases/[id]/exhibits/route.test.ts
  modified:
    - src/services/exhibits.ts
    - src/services/exhibits.test.ts
    - src/app/api/cases/[id]/exhibits/route.ts

key-decisions:
  - "getExhibits sort key changed from createdAt (Phase 1) to exhibitLabel ascending so F9 and F4 agree on a single default order"
  - "toListRow is a module-private mapper shared by both getExhibits and searchExhibits — the structural guarantee that the two row shapes never diverge"
  - "assertCaseExists (CASE_NOT_FOUND 404) added here, as F09 §Error States requires it and this is its first consumer"

patterns-established:
  - "ExhibitListRow is the one row shape every exhibit-list consumer imports — the Case Workspace (02-06) renders it directly with zero query logic"
  - "AND-semantics search: each optional criterion contributes its own spread into the Prisma WHERE; absence of all criteria is EMPTY_SEARCH_CRITERIA, not an unfiltered dump"

# Metrics
duration: ~8 min
completed: 2026-10-07
---

# Phase 2 Plan 04: Exhibit List + Search Data Layer Summary

**`getExhibits`/`searchExhibits` both return the identical `ExhibitListRow` shape (status badge + custodian name + structurally-present discrepancy column) with role-based sealed exclusion, plus F4's AND-semantics `/search` route enforcing EMPTY_SEARCH_CRITERIA / INVALID_DATE_RANGE / VALIDATION_ERROR.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-10-07T08:11:30Z (approx, agent dispatch)
- **Completed:** 2026-10-07T08:18:39Z
- **Tasks:** 2
- **Files modified:** 7 (4 created, 3 modified)

## Accomplishments
- `src/lib/types.ts` defines `ExhibitListRow` exactly per TechArch 03-api §4.1 — the single shared shape both endpoints (and 02-06's screen) consume
- `getExhibits(caseId, role)` rewritten to join the current-state/custody projections, enrich each row with `currentStatus`/`currentCustodianName`/`discrepancyFlags: []`, apply the 02-02 `canViewSealed` sealed-exclusion predicate, guard with `CASE_NOT_FOUND`, and sort by `exhibitLabel` ascending
- `searchExhibits(criteria)` combines keyword (label/description/source OR), status, witness, and date range with AND semantics over the same `ExhibitListRow` shape via the shared `toListRow` mapper; enforces all three 422 error codes and validates `status` against `exhibitStatusEnum` before it reaches the query (T-02-09)
- Sealed exhibits are excluded in the same WHERE clause as the content filters on both endpoints (T-02-10) — a sealed exhibit never surfaces for an unauthorized role even on a matching keyword
- Both routes (`/exhibits`, `/exhibits/search`) parse `X-User-Role` and 404 on an unknown case id

## Task Commits

1. **Task 1: ExhibitListRow + getExhibits upgrade** — `14b97c3` (feat)
2. **Task 2: searchExhibits + /search route** — `4e766c6` (feat)

_(Commit `f87155e feat(02-05)` from the concurrently-running peer plan interleaved between the two task commits — see Issues Encountered.)_

## Files Created/Modified
- `src/lib/types.ts` — `ExhibitListRow` shared composite row shape (created)
- `src/services/exhibits.ts` — `getExhibits` upgraded to `ExhibitListRow[]`; added `assertCaseExists`, `toListRow`, `searchExhibits` + `SearchExhibitsCriteria`
- `src/services/exhibits.test.ts` — updated `getExhibits` calls to the role signature + list-shape assertions; added `getExhibits` sealed-by-role + CASE_NOT_FOUND cases; added full `searchExhibits (F4)` describe block against the seeded P-3/S-1 fixtures
- `src/app/api/cases/[id]/exhibits/route.ts` — parses `X-User-Role`, threads role, returns `ExhibitListRow[]`
- `src/app/api/cases/[id]/exhibits/route.test.ts` — list-shape, sealed-by-role, ordering, CASE_NOT_FOUND (created)
- `src/app/api/cases/[id]/exhibits/search/route.ts` — F4 search route (created)
- `src/app/api/cases/[id]/exhibits/search/route.test.ts` — AND-combination, all three 422 codes, sealed exclusion, CASE_NOT_FOUND (created)

## Decisions Made
- **exhibitLabel ascending sort** replaces Phase 1's `createdAt` ordering on `getExhibits`, matching F9 §Process ("sorted by exhibitLabel") and F4 §Process step 4's default so both screens agree on the same order.
- **Shared `toListRow` mapper** (module-private) is reused by both `getExhibits` and `searchExhibits` — this is the structural guarantee that the list and search row shapes never drift.
- **`assertCaseExists` added here**: F09 §Error States requires `CASE_NOT_FOUND` 404; Phase 1 never implemented it because no consumer needed it. Both endpoints now guard with it.
- **Date range filters on `currentState.lastStatusAt`** (F4 §Process step 5 — most recent STATUS_CHANGE timestamp). Nesting inside the optional `currentState` relation means Prisma automatically excludes never-statused exhibits whenever a status/date filter is active, with no manual null-handling.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs
None introduced. `discrepancyFlags: []` in `ExhibitListRow` is a deliberate, plan-mandated honest placeholder (the `DiscrepancyFlag` table arrives in Phase 3) — documented in `src/lib/types.ts`, structurally present so consumers need no change when Phase 3 populates it. The two `grep` hits in changed files ("honest placeholder", "redacted placeholder row") are explanatory comments, not code stubs.

## Verification
- Plan test suite: **29 passed** across all 3 files (`src/services/exhibits.test.ts` 18, `exhibits/route.test.ts` 4, `exhibits/search/route.test.ts` 7)
- Task 1 verify (`npx vitest run exhibits.test.ts + route.test.ts`): 13 passed → "LIST API TESTS PASSED"
- Task 2 verify (`npx vitest run exhibits.test.ts + search/route.test.ts`): 25 passed → "SEARCH API TESTS PASSED"
- `npx tsc --noEmit` → exit 0
- `npx next build` → exit 0 (all 17 routes compile; both new API routes listed; static generation succeeds)
- DB prepared per the plan's verify step: `docker compose up -d db` → `npx prisma migrate deploy` (no pending) → `npx tsx src/data/seed.ts` (9 exhibits)

## Issues Encountered
- **Concurrent peer plan sharing the working tree (recovered).** Config has `parallelization: true` and plan 02-05 runs in the same tree. On the first attempt to commit Task 2, peer plan 02-05's uncommitted `e2e/` changes (`e2e/app-shell.spec.ts` added, `e2e/smoke.spec.ts` deleted) were already in the git index and got swept into my commit despite my explicit per-file `git add`. I `git reset --soft HEAD~1`, unstaged the two `e2e/` files with `git restore --staged` (leaving them untouched in the working tree for 02-05 to commit), and re-committed only this plan's four files (`4e766c6`). No peer work was lost — the e2e files remain in the working tree exactly as 02-05 left them. This is the known shared-tree hazard already noted in STATE.md's Blockers from 02-01/02-02.

## Next Phase Readiness
- `ExhibitListRow`, `getExhibits`, and `searchExhibits` are the exact data layer the Case Workspace screen (02-06) calls through these two routes — the UI plan is now pure rendering with zero query logic of its own.
- Sealed-exhibit exclusion and the composite row shape are settled once, here, for both the full-list and search paths.
- No blockers.

## Self-Check: PASSED
- All 4 created files present on disk (types.ts, search/route.ts, search/route.test.ts, exhibits/route.test.ts)
- Both task commits present in git (14b97c3, 4e766c6)
- Plan-level build ran: `tsc --noEmit` exit 0, `next build` exit 0
- `## Known Stubs` present; no blocking stubs
- Peer plan 02-05's e2e files left uncommitted in the working tree (not owned by this plan)

---
*Phase: 02-core-screens*
*Completed: 2026-10-07*
