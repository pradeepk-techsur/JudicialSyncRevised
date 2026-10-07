---
phase: 02-core-screens
plan: 02
subsystem: security
tags: [authorization, sealed-exhibits, rbac, anti-enumeration, next-api, prisma]

# Dependency graph
requires:
  - phase: 01-data-foundation
    provides: "getExhibit / getExhibitHistory service functions, Exhibit.isSealed field, Role enum, typed error layer (NotFoundError), errorResponse envelope"
provides:
  - "src/services/visibility.ts — canViewSealed(role) + parseRequestingRole(request): the single shared sealed-visibility predicate and X-User-Role header parser"
  - "getExhibit(exhibitId, requestingUserRole) with sealed-masking WHERE predicate (findFirst)"
  - "getExhibitHistory(exhibitId, requestingUserRole) inheriting sealed-masking from getExhibit"
  - "GET /api/exhibits/:id and GET /api/exhibits/:id/history: byte-identical 404 for sealed-unauthorized vs genuinely-missing (anti-enumeration)"
affects: [02-04 (search reuses canViewSealed), 02-06 (Case Workspace), 02-07 (Exhibit Detail)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single shared visibility predicate module (visibility.ts) — sealed-masking lives in exactly one place, never duplicated per-route"
    - "Sealed exclusion applied as a findFirst WHERE predicate inside the service function, never a post-query filter"
    - "Fail-closed header parsing: missing/invalid X-User-Role → least-privileged role (ATTORNEY)"
    - "Anti-enumeration: masked and genuinely-missing records return byte-identical 404 bodies (deep-equal asserted at the HTTP layer)"

key-files:
  created:
    - src/services/visibility.ts
    - src/services/visibility.test.ts
    - src/app/api/exhibits/[id]/route.test.ts
    - src/app/api/exhibits/[id]/history/route.test.ts
  modified:
    - src/services/exhibits.ts
    - src/services/exhibits.test.ts
    - src/services/history.ts
    - src/services/history.test.ts
    - src/app/api/exhibits/[id]/route.ts
    - src/app/api/exhibits/[id]/history/route.ts
    - src/app/api/exhibits/[id]/status/route.ts
    - src/app/api/exhibits/[id]/events/status/route.ts

key-decisions:
  - "getExhibit switched from findUnique to findFirst to allow an isSealed predicate alongside the id (findUnique's where is unique-fields-only); id stays the PK, so no perf regression"
  - "parseRequestingRole fails closed to ATTORNEY (least-privileged) on missing/empty/invalid X-User-Role — never defaults to a privileged role or throws"
  - "Out-of-scope F1 status routes (status GET, events/status POST) pass JUDGE to the new getExhibit signature to preserve their existence-check behavior unchanged — compile-fix only, not a scope expansion"

patterns-established:
  - "Shared visibility predicate: all later role-scoped reads (02-04 search, the screens in 02-06/02-07) import canViewSealed rather than re-deriving the check"
  - "HTTP-layer anti-enumeration proof: route tests deep-equal the two 404 bodies, not just the status code"

# Metrics
duration: ~9 min active (118 min wall-clock incl. a blocking concurrency checkpoint)
completed: 2026-10-07
---

# Phase 2 Plan 02: Role-Based Sealed-Exhibit Visibility Summary

**Sealed exhibits become invisible (byte-identical 404) to unauthorized roles across the single-exhibit and full-history read paths, via one shared `canViewSealed`/`parseRequestingRole` predicate threaded through `getExhibit` and inherited by `getExhibitHistory`.**

## Performance

- **Duration:** ~9 min active execution (118 min wall-clock — inflated by a blocking concurrency checkpoint, see Issues Encountered)
- **Started:** 2026-10-07T06:08:24Z
- **Completed:** 2026-10-07T08:06:56Z
- **Tasks:** 2 (+1 Rule 3 blocking fix)
- **Files modified:** 12 (4 created, 8 modified)

## Accomplishments
- Created `src/services/visibility.ts` — the single shared authorization module: `canViewSealed(role)` (true only for JUDGE/CHAMBERS_STAFF/ADMIN) and `parseRequestingRole(request)` (reads `X-User-Role`, fails closed to ATTORNEY)
- Threaded `requestingUserRole` through `getExhibit`, applying `isSealed: false` as a `findFirst` WHERE predicate when the role cannot view sealed exhibits
- Threaded role through `getExhibitHistory`, which inherits masking from `getExhibit` (early `null` return before the ledger query ever runs) rather than reimplementing it
- Both routes (`/api/exhibits/:id`, `/api/exhibits/:id/history`) parse the role header and return byte-identical 404 bodies for sealed-unauthorized vs genuinely-missing — proven by deep-equal assertions at the HTTP layer

## Task Commits

1. **Task 1: visibility.ts + getExhibit sealed-masking** — `9119dc0` (feat)
2. **Task 2: getExhibitHistory sealed-masking** — `1568161` (feat)
3. **Rule 3 blocking fix: out-of-scope getExhibit callers** — `96900e7` (fix)

_(Commit `921e613 feat(02-01)` from a concurrently-running plan interleaved between Task 2 and the fix — see Issues Encountered.)_

## Files Created/Modified
- `src/services/visibility.ts` — shared `canViewSealed`/`parseRequestingRole`/`SEALED_VISIBLE_ROLES`
- `src/services/visibility.test.ts` — unit tests for both predicates incl. fail-closed cases
- `src/services/exhibits.ts` — `getExhibit(id, role)` with findFirst sealed-masking predicate
- `src/services/exhibits.test.ts` — sealed-visible/sealed-blocked role cases; existing call sites pass JUDGE
- `src/services/history.ts` — `getExhibitHistory(id, role)` threading role to getExhibit
- `src/services/history.test.ts` — sealed null/visible cases against the seeded case; call sites pass JUDGE
- `src/app/api/exhibits/[id]/route.ts` — parses X-User-Role, threads role
- `src/app/api/exhibits/[id]/route.test.ts` — deep-equal 404 anti-enumeration proof (new)
- `src/app/api/exhibits/[id]/history/route.ts` — parses X-User-Role, threads role
- `src/app/api/exhibits/[id]/history/route.test.ts` — deep-equal 404 anti-enumeration proof (new)
- `src/app/api/exhibits/[id]/status/route.ts` — existence check passes JUDGE (compile-fix)
- `src/app/api/exhibits/[id]/events/status/route.ts` — existence check passes JUDGE (compile-fix)

## Decisions Made
- **findFirst over findUnique** in `getExhibit`: `findUnique`'s `where` only accepts unique-indexed fields, so combining `id` with the `isSealed` predicate requires `findFirst`. `id` remains the primary key — no performance regression.
- **Fail closed to ATTORNEY**: `parseRequestingRole` returns the least-privileged role for a missing/empty/unrecognized header (threat T-02-06), never throwing or defaulting open.
- **Out-of-scope status routes pass JUDGE**: the two F1 status routes used `getExhibit` only as an existence check and broke `tsc` under the new signature. Passing JUDGE (a visibility superset) preserves their prior behavior exactly, consistent with the plan's explicit scope note that role-based visibility is not applied to those routes in this plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated two out-of-scope `getExhibit` callers for the new required-role signature**
- **Found during:** Post-Task-2 plan-level `tsc --noEmit`
- **Issue:** `getExhibit`'s signature now requires `requestingUserRole`. Two Phase 1 routes not named in this plan — `src/app/api/exhibits/[id]/status/route.ts` and `src/app/api/exhibits/[id]/events/status/route.ts` — call `getExhibit(id)` as a bare existence check, breaking the build (TS2554).
- **Fix:** Passed `'JUDGE'` (a visibility superset) at both call sites with an explanatory comment, preserving their pre-existing behavior exactly. This is a compile-fix forced by the signature change, not a scope expansion — no role-based visibility behavior was added to those routes.
- **Files modified:** `src/app/api/exhibits/[id]/status/route.ts`, `src/app/api/exhibits/[id]/events/status/route.ts`
- **Verification:** `tsc --noEmit` returns to exit 0; the 7 existing status-route tests still pass unchanged.
- **Committed in:** `96900e7`

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** Necessary to keep the build green; no behavior change to the out-of-scope routes, no scope creep.

## Known Stubs
None introduced by this plan. (One pre-existing "placeholder" comment in `history.ts:42` documents Phase 1's intentional `discrepancyFlags: []` honest-placeholder pending Phase 3's DiscrepancyFlag table — cosmetic, not blocking, and untouched here.)

## Verification
- Plan test suite: 27 passed across all 5 files (`visibility.test.ts`, `exhibits.test.ts`, `history.test.ts`, both route test files)
- Regression check: 7 status-route tests pass after the Rule 3 fix
- `npx tsc --noEmit` → exit 0
- `npx next build` → exit 0 (all 15 routes compile; static generation succeeds)
- Anti-enumeration (T-02-05) proven by deep-equal 404-body assertions in both new route test files

## Issues Encountered
- **Concurrent plan sharing the same working tree (resolved via checkpoint).** Partway through Task 1, a concurrently-running phase-2 plan (02-01, Tailwind/shadcn tooling) was actively editing `/home/daytona/project`: it reverted my in-progress `exhibits.ts` edit and deleted my new `visibility.ts` while leaving `route.ts`/test edits in place, producing a temporarily inconsistent (non-compiling) tree. `config.json` has `parallelization: true`. I paused and raised a decision checkpoint. Per the operator's instruction ("re-apply my edits and commit only my files"), I re-created `visibility.ts`, re-applied the `exhibits.ts` change, and committed strictly 02-02's files at each task, leaving 02-01's files (components, globals.css, layout.tsx, package.json, seed.ts) untouched. 02-01's own commit `921e613` landed cleanly between my Task 2 and fix commits. Final `tsc`/build/tests all green, confirming the two plans' changes coexist correctly.

## Next Phase Readiness
- `canViewSealed` is the shared predicate 02-04 (Exhibit Search) will reuse, and the exact `getExhibit`/`getExhibitHistory` signatures the 02-06 (Case Workspace) and 02-07 (Exhibit Detail) screens will call.
- `getExhibits` (plural) deliberately still returns raw rows; its role-masking upgrade to the `ExhibitListRow` shape is 02-04's scope, as planned.
- No blockers.

## Self-Check: PASSED
- All 4 created files present on disk
- All 3 task commits present in git (9119dc0, 1568161, 96900e7)
- Plan-level build ran: `tsc --noEmit` exit 0, `next build` exit 0
- `## Known Stubs` present; no blocking stubs

---
*Phase: 02-core-screens*
*Completed: 2026-10-07*
