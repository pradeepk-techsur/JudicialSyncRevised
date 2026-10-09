---
phase: 08-ui-redesign-and-write-action-coverage
plan: 02
subsystem: auth
tags: [custody, rbac, role-gate, f24, prisma, vitest]

# Dependency graph
requires:
  - phase: 01-data-foundation
    provides: "recordCustodyTransfer, CustodyCurrentState projection, RoleNotPermittedError (general-purpose, src/lib/errors.ts)"
  - phase: 01-data-foundation
    provides: "recordRuling's JUDGE-gate pattern in objections.ts — the server-side role-resolution template replicated here"
provides:
  - "Server-side role gate on recordCustodyTransfer: 403 ROLE_NOT_PERMITTED for any actor whose User.role is not DEPUTY/CLERK/ADMIN"
  - "The real backend gate F24's 'Transfer custody'/'Assign custodian' absent-not-disabled UI rule reflects"
affects:
  - "08-09 (shared write-action UI components rendering absent-not-disabled by role)"
  - "Exhibit Detail / Command Center / Jury Package plans wiring the Transfer-custody control"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-side role gate resolves actorUserId -> actual User.role column (never a client claim), reusing the general-purpose RoleNotPermittedError"
    - "Gate ordering is load-bearing: role check placed AFTER INVALID_CUSTODIAN lookup, BEFORE the $transaction, so pre-existing validation precedence is preserved"

key-files:
  created: []
  modified:
    - "src/services/custody.ts"
    - "src/services/custody.test.ts"
    - "src/app/api/exhibits/[id]/events/custody/route.test.ts"

key-decisions:
  - "Reused the general-purpose RoleNotPermittedError from src/lib/errors.ts, NOT objections.ts's private ruling-specific subclass (locked CONTEXT decision)"
  - "Allowed roles DEPUTY/CLERK/ADMIN, matching F20's custody-action matrix row, applied directly to the single legacy endpoint (no propose/confirm split in Phase 8)"
  - "Role check placed after the toUser lookup so the three tests passing a nonexistent/inactive user as both recipient AND actor still see InvalidCustodianError first"

patterns-established:
  - "Phase 8's ONLY new server-side role gate — no generic assertRole helper, no role-gating extended to any other write action"

# Metrics
duration: 3 min
completed: 2026-10-09
---

# Phase 8 Plan 02: Custody-Transfer Server-Side Role Gate Summary

**`recordCustodyTransfer` now rejects any actor outside {DEPUTY, CLERK, ADMIN} with 403 ROLE_NOT_PERMITTED, resolved from the actual `User.role` column — the first role enforcement custody.ts has ever had, proven at both the service and route/API boundary.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-10-09T12:03:48Z
- **Completed:** 2026-10-09T12:07:14Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added a real server-side role gate to `recordCustodyTransfer` (previously zero role enforcement — grep-confirmed), reusing the general-purpose `RoleNotPermittedError` and the exact server-side role-resolution pattern `recordRuling` established in Phase 1.
- Gate fires before any ledger write: a rejected transfer creates no `CustodyCurrentState` row and no `CUSTODY_TRANSFER` event.
- Repaired two pre-existing "three sequential transfers" fixtures whose third transfer used an ATTORNEY actor the new gate now rejects (actor → the clerk who holds custody; recipient unchanged, so chain-reconstruction assertions are unaffected).
- Added tests proving the gate at BOTH layers: service-level (ATTORNEY rejected + no write; DEPUTY/CLERK/ADMIN each succeed) and route-level (POST by a JUDGE returns 403, bypassing any UI).

## Task Commits

1. **Task 1: Add the role gate to recordCustodyTransfer** - `c4de425` (feat)
2. **Task 2: Repair pre-existing fixtures + add new role-gate tests** - `f75d5c8` (test)

## Files Created/Modified
- `src/services/custody.ts` - Imports general-purpose `RoleNotPermittedError`; adds `CUSTODY_WRITE_ROLES = {DEPUTY, CLERK, ADMIN}`; inserts the role check (resolve `User.role`, throw 403 for any other role) after the INVALID_CUSTODIAN lookup and before the `$transaction`.
- `src/services/custody.test.ts` - Imports `RoleNotPermittedError` from `@/lib/errors`; adds an ADMIN fixture user; repairs the three-sequential-transfers test (attorney→clerk as actor); adds "ATTORNEY rejected, no write" and "DEPUTY/CLERK/ADMIN all succeed" tests.
- `src/app/api/exhibits/[id]/events/custody/route.test.ts` - Repairs the route-level three-transfers test (attorney→clerk actor); adds a JUDGE fixture user and a "POST by JUDGE returns 403 ROLE_NOT_PERMITTED" route test.

## Decisions Made
- Followed the plan as specified. The locked CONTEXT decisions (general-purpose error class, DEPUTY/CLERK/ADMIN allowed roles, single-phase endpoint, gate ordering after INVALID_CUSTODIAN) were implemented verbatim.
- No route-handler change needed: the existing `errorResponse(err)` helper already maps any `AppError` by its `httpStatus`, so `RoleNotPermittedError` (403) surfaces correctly with zero route edits.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None found. (The two `grep` hits for "placeholder" in changed files are pre-existing comment prose about the custody-gap semantics — "no backfilled placeholder row" / "No placeholder row was created" — not incomplete implementations.)

## Issues Encountered
- **Dependencies were not installed** in the sandbox at start. Ran `npm install --include=dev` (devDependencies included, per the runtime contract) so `tsc`/`vitest` were available. Not a deviation — environment setup.
- **Incidental file in Task 2 commit:** `.planning/phases/.../deferred-items.md` was an untracked artifact from a concurrent sibling plan (08-04) already present in the shared working tree; it got swept into the Task 2 `git add` of the phase directory. It is planning documentation (not code), harmless, and now also carries 08-02's own out-of-scope note (below).
- **Plan-level `npm run build` fails on an out-of-scope sibling file.** `next build`'s TypeScript pass reports `src/services/exhibits.test.ts:300 — TS2345` (an `addMember(...)` call rejected because 08-01's `JuryPackage.finalizationRequestedAt/By` type addition changed the inferred object shape). `exhibits.test.ts` is NOT one of 08-02's three files. Per the executor SCOPE BOUNDARY rule this is sibling-plan drift on the shared working tree — logged to `deferred-items.md`, NOT fixed here. 08-02's own three files are tsc-clean in isolation and a bare `tsc --noEmit` over the whole tree passes (only `next build`'s stricter test-file inclusion surfaces the sibling error). This is the recurring shared-working-tree hazard documented repeatedly in STATE.md (06-03, 06-07, 06-08, 07-05).

## Verification
- `tsc --noEmit` (project TypeScript, whole tree): **EXIT 0, clean.**
- `vitest run` on both target files: **17/17 passed** (10 `custody.test.ts` service tests + 7 `custody/route.test.ts` route tests, including the 3 new role-gate tests).
- Contract grep: `grep -n 'RoleNotPermittedError' src/services/custody.ts` → present → `CONTRACT_OK`.
- Residual-actor grep: the only remaining `actorUserId: attorneyId` is inside the new ATTORNEY-rejection test (intended), not on any chain-building call.
- `npm run build`: compiles successfully; TS check fails ONLY on the out-of-scope sibling file `exhibits.test.ts:300` (see Issues Encountered) — not 08-02's code.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The server-side custody role gate is in place and proven. 08-09's shared write-action UI components can now render the "Transfer custody"/"Assign custodian" control as absent-not-disabled per role, with this gate as the authoritative backstop.
- Note for the phase post-plan / gap-closure gate: the aggregated `next build` will stay red until the sibling-owned `exhibits.test.ts:300` TS2345 (08-01 schema interaction) is reconciled. Tracked in `deferred-items.md`.

## Self-Check: PASSED

- Files: all 3 modified files + SUMMARY.md present on disk.
- Commits: `c4de425` (Task 1), `f75d5c8` (Task 2) both present in git history.
- Build check: `npm run build` → `✓ Compiled successfully`; TS check fails ONLY on out-of-scope sibling file `src/services/exhibits.test.ts:300` (08-01 drift, logged to deferred-items.md). 08-02's own files tsc-clean (`tsc --noEmit` EXIT 0) and 17/17 tests green.
- Known Stubs section present; no blocking stubs.

---
*Phase: 08-ui-redesign-and-write-action-coverage*
*Completed: 2026-10-09*
