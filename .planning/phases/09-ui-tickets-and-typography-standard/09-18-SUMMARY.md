---
phase: 09-ui-tickets-and-typography-standard
plan: 18
subsystem: security
tags: [role-enforcement, authorization, prisma, zod, gap-closure]

# Dependency graph
requires:
  - phase: 09-ui-tickets-and-typography-standard
    provides: "09-SECURITY.md's security audit, which identified F-09-01 (createExhibit has zero role enforcement) as the one CONFIRMED HIGH finding"
provides:
  - "createExhibit's new server-side role gate (DEPUTY/CLERK/ADMIN only), mirroring custody.ts's recordCustodyTransfer pattern"
  - "F20 row 1 ('Create exhibit' role restriction) now actually enforced, closing the gap between the FRD's documented matrix and the live code"
affects: [09-SECURITY, F20-server-side-role-enforcement-matrix]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ad hoc per-function role gate (EXHIBIT_CREATE_ROLES Set + prisma.user.findUnique + RoleNotPermittedError) — the established per-service pattern already used by custody.ts/objections.ts/discrepancies.ts/juryPackage.ts, explicitly NOT a new centralized assertRole helper (09-CONTEXT decision #1)"

key-files:
  created: []
  modified:
    - src/services/exhibits.ts
    - src/data/seed.ts
    - src/services/exhibits.test.ts
    - src/app/api/exhibits/route.test.ts
    - src/app/api/cases/[id]/activity/route.test.ts
    - src/app/api/cases/[id]/attention-feed/route.test.ts
    - src/app/api/cases/[id]/custody-by-custodian/route.test.ts
    - src/services/activity.test.ts
    - src/services/attentionFeed.test.ts
    - src/services/custodyByCustodian.test.ts

key-decisions:
  - "No route-level change to src/app/api/exhibits/route.ts — it already forwards the full body generically to createExhibit, whose own zod schema + role gate now own all validation/authorization; adding a manual actorUserId check in the route would duplicate the schema's z.string().min(1)."
  - "Scope held strictly to createExhibit per 09-CONTEXT decision #1 — no centralized assertRole helper introduced, no other currently-ungated write path (status transitions, objection-raising) touched."

patterns-established: []

# Metrics
duration: 35min
completed: 2026-10-10
---

# Phase 9 Plan 18: Role gate on createExhibit (F-09-01) Summary

**`createExhibit` now requires `actorUserId`, resolves the real `User.role` via Prisma, and throws `RoleNotPermittedError` (403) for any actor outside DEPUTY/CLERK/ADMIN — closing the one CONFIRMED HIGH finding from the Phase 9 security audit where `POST /api/exhibits` had zero role enforcement.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-10-10T21:38:00Z (approx, from plan file mtime)
- **Completed:** 2026-10-10T22:07:00Z
- **Tasks:** 2
- **Files modified:** 10 (1 service file + 9 test/seed files)

## Accomplishments
- `createExhibit`'s signature widened to require `actorUserId: string`, validated via `createExhibitSchema`'s new `z.string().min(1)` field (clean 422 for missing/empty, not a raw Prisma error)
- A new server-side role gate — `EXHIBIT_CREATE_ROLES = new Set(['DEPUTY', 'CLERK', 'ADMIN'])` — resolves the actor's real `User.role` from the DB via `prisma.user.findUnique` and throws the general-purpose `RoleNotPermittedError` (403) for any other role or nonexistent user, placed strictly after zod validation and strictly before the `prisma.exhibit.create` write (mirroring `custody.ts`'s `recordCustodyTransfer` pattern byte-for-byte in structure)
- Every one of the 31 `createExhibit(` call sites across the codebase (seed.ts + 9 test files) repaired to supply a valid DEPUTY/CLERK/ADMIN `actorUserId`, reusing whatever role-appropriate fixture user was already in scope in each file rather than inventing new ones
- 3 new tests proving the gate closes the exploit at both layers: a service-level `RoleNotPermittedError` test (ATTORNEY actor, zero rows created), a route-level 403 `ROLE_NOT_PERMITTED` test, and a route-level 422 `VALIDATION_ERROR` test for a request with no `actorUserId` at all (the exact "no role header at all" path 09-SECURITY.md's live-exploit transcript documented as reachable)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the role gate to createExhibit and wire it through the route** - `ba49153` (feat)
2. **Task 2: Repair every existing createExhibit caller (seed + tests) and add new gate-coverage tests** - `ca954a4` (test)

_Note: `.planning/STATE.md` and plan-metadata files are intentionally excluded from these commits — a concurrent sibling plan (09-19/09-20) was updating STATE.md in the same shared working tree at commit time; see Deviations below._

## Files Created/Modified
- `src/services/exhibits.ts` — `createExhibit` role gate + required `actorUserId` zod field
- `src/data/seed.ts` — `makeExhibit` helper passes `actorUserId: deputy`
- `src/services/exhibits.test.ts` — DEPUTY fixture in `seedCase()`, `actorUserId` on all 8 call sites, new role-gate describe block
- `src/app/api/exhibits/route.test.ts` — DEPUTY fixture in `seedCase()`, `actorUserId` on all POST bodies, 2 new 403/422 tests
- `src/app/api/cases/[id]/activity/route.test.ts`, `src/services/activity.test.ts` — DEPUTY fixture added alongside existing JUDGE actor
- `src/app/api/cases/[id]/attention-feed/route.test.ts`, `src/services/attentionFeed.test.ts` — existing `deputy` fixture reused
- `src/app/api/cases/[id]/custody-by-custodian/route.test.ts`, `src/services/custodyByCustodian.test.ts` — existing DEPUTY/CLERK custodian fixtures reused

## Decisions Made
- No route-level change to `src/app/api/exhibits/route.ts` — it already does `createExhibit(body as Parameters<typeof createExhibit>[0])`, a fully generic pass-through. Since `createExhibit`'s own zod schema now validates `actorUserId` presence and its own role check throws the correctly-mapped error, adding a manual route-level check would be redundant scope creep.
- Scope held strictly to `createExhibit` per the locked 09-CONTEXT decision #1 — no centralized `assertRole` helper, no gating added to any other currently-ungated write path (status transitions, objection-raising remain untouched, as instructed).

## Deviations from Plan

None — plan executed exactly as written. One environmental note, not a deviation:

**Shared-working-tree hazard (observed, not caused by this plan):** mid-execution, the full-suite `npx vitest run` showed 10 failures entirely confined to `searchExhibits (F4)` tests that depend on the shared demo-seed case (`2026-CR-0142`). Root-caused to a concurrent sibling plan in the same working tree re-running `docker compose up --build` / Playwright (which itself runs `npm run dev` → a second `next dev` fighting for port 3000) and re-seeding the shared demo case mid-run — a documented recurring pattern already called out in prior Phase 8/9 STATE.md entries for shared-DB/shared-working-tree parallel execution. Confirmed via re-seed + immediate isolated re-run: all 33 `exhibits.test.ts` tests (including every `searchExhibits` case) pass cleanly when the demo case isn't being concurrently reset. The plan's own affected-file suite (64 tests across 8 files) was run and passed cleanly in isolation per the plan's own `<verify>` commands.

## Issues Encountered
- A stray orphaned `next dev` process (unrelated to this plan, left running from an earlier session) was occupying port 3000 and blocking `docker compose up`; killed it to restore the compose stack's `app` service. No code change required.
- See "Shared-working-tree hazard" above — resolved by isolating the verification run, not by any code change.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
F-09-01 is closed: `POST /api/exhibits` now rejects any non-DEPUTY/CLERK/ADMIN actor (or a request with no `actorUserId` at all) with the documented 403/422, proven by direct route-level tests bypassing the UI. Every pre-existing caller of `createExhibit` is repaired and green. No new centralized `assertRole` helper was introduced and no other write path was touched, per 09-CONTEXT decision #1 — this closes exactly the one gap the Phase 9 security audit found, nothing more.

## Known Stubs

None found. Grep for `TODO|FIXME|placeholder|not.?implemented|coming soon` across every file this plan touched returned only two pre-existing, unrelated prose comments in `exhibits.ts` (an old-code-comment use of the word "placeholder" describing a historical `[]` default, and "redacted placeholder row" describing sealed-exhibit masking semantics) — neither is an incomplete implementation.

## Self-Check: PASSED

- All 10 modified files confirmed present on disk (`[ -f ]` checks above).
- Both commits (`ba49153`, `ca954a4`) confirmed in `git log`.
- Build check: `npm run build` → exit 0 (Next.js 16.4.0, all 32 routes compiled, TypeScript check passed in 3.6s).
- `npx tsc --noEmit` → exit 0 (tree-wide).
- Plan-affected test suite (8 files, 64 tests) → all green when run in isolation from the sibling plan's concurrent reseed activity.
- `npx tsx src/data/seed.ts` → succeeds, demo case `2026-CR-0142` seeded with 11 exhibits.
- `## Known Stubs` section present above; no blocking stubs found.

---
*Phase: 09-ui-tickets-and-typography-standard*
*Completed: 2026-10-10*
