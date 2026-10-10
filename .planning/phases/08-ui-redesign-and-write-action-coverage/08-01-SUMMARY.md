---
phase: 08-ui-redesign-and-write-action-coverage
plan: 01
subsystem: api
tags: [jury-package, prisma, migration, role-gate, nextjs, finalization-request, F11]

# Dependency graph
requires:
  - phase: 03-jury-package-discrepancy-detection
    provides: JuryPackage/JuryPackageExhibit models, finalizeJuryPackage service, finalize route pattern
  - phase: 07-fix-admission-integrity-and-ui-usability-issues
    provides: excludeJuryPackageExhibit ordering contract (existence -> finalized -> role), JURY_WRITE_ROLES
provides:
  - "JuryPackage.finalizationRequestedAt (DateTime?) + finalizationRequestedBy (String?) columns (the only Phase 8 schema migration)"
  - "requestFinalization(juryPackageId, actorUserId) service — inverted role check, 404/409/403 ordering"
  - "POST /api/jury-package/:id/request-finalization route"
  - "finalizeJuryPackage clears finalizationRequestedAt/By atomically with the FINALIZED transition"
affects: [08-14-jury-package-workspace-redesign, F11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inverted role gate: a finalize-authorized role (DEPUTY/CLERK/ADMIN) is REJECTED from requesting, reusing JURY_WRITE_ROLES"
    - "Request-fulfillment cleanup: the write that satisfies a request clears the request marker in the same transaction"

key-files:
  created:
    - src/app/api/jury-package/[id]/request-finalization/route.ts
    - src/app/api/jury-package/[id]/request-finalization/route.test.ts
    - prisma/migrations/20261009120430_add_jury_package_finalization_request/migration.sql
  modified:
    - prisma/schema.prisma
    - src/services/juryPackage.ts
    - src/services/juryPackage.test.ts

key-decisions:
  - "Reused JURY_WRITE_ROLES for the inverted request-finalization gate rather than a new FINALIZE_ROLES alias — identical set (DEPUTY/CLERK/ADMIN), one source of truth"
  - "An actor with no User row falls through to the stamp (not rejected) — F11's error table only names the over-authorized-role rejection; no stricter unknown-actor rule invented"
  - "finalize clears both request fields in the SAME tx.juryPackage.update as the FINALIZED transition, not a separate write"

patterns-established:
  - "Request-finalization notification: additive metadata, confers no authority, bypasses no gate"

# Metrics
duration: 9 min
completed: 2026-10-09
---

# Phase 8 Plan 01: Jury Package Finalization-Request Schema + Service Summary

**`JuryPackage.finalizationRequestedAt/By` migration + `requestFinalization` service/route (inverted DEPUTY/CLERK/ADMIN gate) with `finalizeJuryPackage` clearing the request atomically — the only schema change in Phase 8, unblocking the F11 Jury Package Workspace redesign (08-14).**

## Performance

- **Duration:** 9 min
- **Started:** 2026-10-09T12:00:00Z
- **Completed:** 2026-10-09T12:09:21Z
- **Tasks:** 2
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments
- Added the two nullable `JuryPackage` columns (`finalization_requested_at`, `finalization_requested_by`) — a clean 2-column ALTER TABLE, no other model touched.
- Implemented `requestFinalization` with an INVERTED role check: a role that can finalize directly (DEPUTY/CLERK/ADMIN) is rejected with 403; a JUDGE/CHAMBERS_STAFF/ATTORNEY stamps the request. Ordering: existence (404) → already-finalized (409) → role (403), mirroring `excludeJuryPackageExhibit`.
- Added `POST /api/jury-package/:id/request-finalization` as a thin wrapper exactly matching `finalize/route.ts`.
- Amended `finalizeJuryPackage` to clear both request fields in the same `tx.juryPackage.update` as the FINALIZED transition — a finalized package never carries a dangling request marker.
- The fields ride along on the existing `GET /api/cases/:id/jury-package` response for free (no route change there), so a finalize-authorized viewer will see who asked and when once 08-14 renders it.

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema migration — JuryPackage.finalizationRequestedAt/By** — `702302e` (feat)
2. **Task 2: requestFinalization service + route + finalize clears the request** — `22ec578` (feat)

## Files Created/Modified
- `prisma/schema.prisma` — added two nullable columns to the `JuryPackage` model.
- `prisma/migrations/20261009120430_add_jury_package_finalization_request/migration.sql` — the 2-column ALTER TABLE.
- `src/services/juryPackage.ts` — new `requestFinalization`; `finalizeJuryPackage` now clears request fields.
- `src/services/juryPackage.test.ts` — unit cases: finalize clears request fields; request role/state matrix.
- `src/app/api/jury-package/[id]/request-finalization/route.ts` — thin POST wrapper.
- `src/app/api/jury-package/[id]/request-finalization/route.test.ts` — 4 scenarios (200 JUDGE / 403 DEPUTY / 409 finalized / newest-requester-wins).

## Decisions Made
- Reused the existing `JURY_WRITE_ROLES` set (DEPUTY/CLERK/ADMIN) for the inverted gate instead of defining a separate `FINALIZE_ROLES` alias — identical membership, single source of truth, less drift risk.
- An actor with no `User` row at all is NOT rejected (it's not a finalize-authorized role) and falls through to the stamp — consistent with F11's single named error scenario (reject an already-authorized role); no stricter unknown-actor rejection was invented.
- Both request fields are cleared in the SAME write as the FINALIZED transition (atomic), not a follow-up update.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None found.

## Issues Encountered
- **Dependencies not installed in the fresh sandbox tree** — `node_modules/.bin/prisma` was absent and `npx prisma` pulled Prisma 7.10.0 (incompatible: it rejects `url` in the datasource block). Resolved by `npm install --include=dev` and invoking the project-pinned `node_modules/.bin/prisma` (6.19.3). Not a code deviation — environment setup.
- **Stale `next build` lock / lingering build process** — a leftover `sh -c next build` process held `.next/lock`, blocking the plan-level build. Cleared the stale process and lock, after which `next build` ran to `EXIT=0` with the new `/api/jury-package/[id]/request-finalization` route registered.
- **Shared working tree (recurring hazard, per STATE.md)** — the tree also carried uncommitted edits from parallel Phase-8 plans (`seed.ts`, `activity.ts`, `exhibits.ts`, `types.ts`, an `08-03-SUMMARY.md`). Staged ONLY this plan's four files individually (never `git add .`); those sibling changes were left untouched.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The F11 schema field + request-finalization endpoint are in place; **08-14** (Jury Package Workspace redesign) can now render the "Request finalization from Clerk" control and the finalize-authorized-role "Finalization requested by {name} at {time}" banner directly off the existing GET response.
- No blockers.

---
*Phase: 08-ui-redesign-and-write-action-coverage*
*Completed: 2026-10-09*

## Self-Check: PASSED

- All created files exist on disk (migration, route, route test, service, service test).
- Both task commits present (702302e, 22ec578).
- Plan-level build: `next build` exited 0 with the new route registered.
- `## Known Stubs` present; no blocking stubs.
