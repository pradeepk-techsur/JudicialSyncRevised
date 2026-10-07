---
phase: 03-jury-package-discrepancy-detection
plan: 01
subsystem: discrepancy-engine
tags: [prisma, postgres, discrepancy, jury-package, event-ledger, zod, vitest]

# Dependency graph
requires:
  - phase: 01-data-foundation
    provides: ExhibitEvent ledger + recordEvent single-writer, ExhibitCurrentState / ObjectionCurrentState / CustodyCurrentState projections, typed error layer (AppError/errorResponse)
  - phase: 02-core-screens
    provides: ExhibitListRow shared row type, DEMO_CASE_NUMBER constant, sealed-visibility service
provides:
  - "DiscrepancyFlag / JuryPackage / JuryPackageExhibit tables + three enums (migrated)"
  - "src/services/discrepancies.ts: evaluateDiscrepancies (tx-aware), getDiscrepancies, getExhibitDiscrepancies, acknowledgeDiscrepancy"
  - "evaluateDiscrepancies wired synchronously into recordStatusChange / recordRuling / recordCustodyTransfer"
  - "Shared RoleNotPermittedError (403) + optional AppError.details plumbing surfaced by errorResponse"
  - "DiscrepancyFlagSummary shared type (src/lib/types.ts) + ruleLabel source (src/lib/discrepancyLabels.ts)"
  - "history.ts DISCREPANCY_ACKNOWLEDGED summarizer (live)"
affects: [03-02 jury-package-finalize, 03-03 exhibit-row-discrepancy-badge, 03-04 discrepancy-banners, F11 jury-package-screen]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Rule engine reads derived projections only (never scans the event ledger)"
    - "Discrepancy evaluation runs synchronously inside the state-change transaction (tx-threaded, same PrismaLike pattern as recordEvent) — flags appear/clear on write, never on page load"
    - "Acknowledgment commits a DISCREPANCY_ACKNOWLEDGED ledger event + flag update in one transaction; idempotent on already-acked/resolved"
    - "Single ruleLabel() copy source; single DiscrepancyFlagSummary type produced in wave 1 for all downstream plans"

key-files:
  created:
    - src/services/discrepancies.ts
    - src/services/discrepancies.test.ts
    - src/lib/discrepancyLabels.ts
    - prisma/migrations/20261007134940_phase3_discrepancy_jury_package/migration.sql
  modified:
    - prisma/schema.prisma
    - src/lib/errors.ts
    - src/lib/apiError.ts
    - src/lib/types.ts
    - src/services/status.ts
    - src/services/objections.ts
    - src/services/custody.ts
    - src/services/history.ts
    - src/data/seed.ts
    - src/app/api/case/route.test.ts

key-decisions:
  - "DiscrepancyFlag ids use Prisma @default(uuid()) (app-side) rather than the DDL's gen_random_uuid(); consistent with Phase 1 identity tables"
  - "acknowledgeDiscrepancy on a RESOLVED flag that never had an ack event throws DISCREPANCY_NOT_FOUND rather than fabricating an event — idempotency only returns a real prior event"
  - "resetSeedCase (and the case route test's deleteSeedCase) extended to cascade the three Phase 3 tables before exhibits/ledger — the newly-wired engine now produces real flags on seed boot"

patterns-established:
  - "Synchronous cross-domain rule evaluation inside write transactions"
  - "Shared, single-source rule-label + summary types placed in wave 1"

# Metrics
duration: ~15 min
completed: 2026-10-07
---

# Phase 3 Plan 01: Discrepancy Engine + Phase 3 Data Model Summary

**Cross-domain discrepancy rule engine (ADMITTED_NO_CUSTODIAN, UNRESOLVED_OBJECTION_JURY_ELIGIBLE) wired synchronously into the status/ruling/custody write transactions, backed by three new migrated tables and an auditable, idempotent acknowledge flow.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-10-07T13:40:00Z (approx)
- **Completed:** 2026-10-07T13:55:35Z
- **Tasks:** 3
- **Files modified/created:** 14

## Accomplishments
- Added `DiscrepancyFlag`, `JuryPackage`, `JuryPackageExhibit` models + `discrepancy_status` / `jury_package_status` / `jury_exhibit_discrepancy_status` enums, with snake_case `@map`/`@@map` matching the TechArch DDL (FKs, indexes, unique constraint) — migrated and client regenerated.
- Built `src/services/discrepancies.ts`: a projection-only rule engine (`evaluateDiscrepancies`, tx-aware), `getDiscrepancies` / `getExhibitDiscrepancies` (OPEN+ACKNOWLEDGED only), and `acknowledgeDiscrepancy` (atomic ledger event + flag flip, idempotent, 422 JUSTIFICATION_REQUIRED, 403 role gate against actual User.role).
- Wired `evaluateDiscrepancies(exhibitId, tx, event.id)` into `recordStatusChange`, `recordRuling` (both RESERVED and resolved branches), and `recordCustodyTransfer` so flags appear/clear on the state-change write.
- Added the shared wave-1 primitives: `RoleNotPermittedError` + optional `AppError.details` (surfaced by `errorResponse` only when present), `DiscrepancyFlagSummary` type, and the single `ruleLabel()` copy source.
- Upgraded the history summarizer's DISCREPANCY_ACKNOWLEDGED case to `Discrepancy acknowledged ({ruleCode}): {justification}`.

## Task Commits

1. **Task 1: Add Phase 3 models + enums and migrate** - `4079d6c` (feat)
2. **Task 2: Discrepancy rule engine + error codes + shared types/labels + AppError.details** - `0fb878c` (feat)
3. **Task 3: Wire evaluateDiscrepancies into write paths + history summarizer** - `8c33d36` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - three models + three enums, named relations on User/ExhibitEvent/Case/Exhibit
- `prisma/migrations/20261007134940_phase3_discrepancy_jury_package/migration.sql` - the migration
- `src/services/discrepancies.ts` - rule engine + acknowledge flow
- `src/services/discrepancies.test.ts` - 9 integration cases
- `src/lib/discrepancyLabels.ts` - single `ruleLabel()` source
- `src/lib/errors.ts` - `RoleNotPermittedError` + optional `AppError.details`
- `src/lib/apiError.ts` - surface `details` in the envelope when present
- `src/lib/types.ts` - `DiscrepancyFlagSummary`
- `src/services/status.ts` / `objections.ts` / `custody.ts` - synchronous evaluate wiring
- `src/services/history.ts` - live DISCREPANCY_ACKNOWLEDGED summary
- `src/data/seed.ts`, `src/app/api/case/route.test.ts` - reset cascades Phase 3 tables (deviation)

## Decisions Made
- `@default(uuid())` for new table ids (app-side), consistent with existing identity tables, rather than the DDL's `gen_random_uuid()`.
- Idempotent `acknowledgeDiscrepancy` returns only a *real* prior ledger event; a RESOLVED-without-ack flag throws `DISCREPANCY_NOT_FOUND` instead of fabricating an event.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Seed reset + case-route test deletion broke on the new DiscrepancyFlag FK**
- **Found during:** Task 3 (full suite run after wiring)
- **Issue:** Once `evaluateDiscrepancies` is wired in, running the seed admits exhibits and produces real `DiscrepancyFlag` rows. `resetSeedCase()` (and the `GET /api/case` route test's `deleteSeedCase`) deleted exhibits/ledger before the flags, violating `discrepancy_flags_exhibit_id_fkey` (P2003) and failing 4, then 1, suites.
- **Fix:** Extended both reset transactions to delete `DiscrepancyFlag`, `JuryPackageExhibit`, and `JuryPackage` first (before projections/ledger/exhibits), with explanatory comments.
- **Files modified:** `src/data/seed.ts`, `src/app/api/case/route.test.ts`
- **Verification:** Full suite 123/123 pass; `npm run build` clean.
- **Committed in:** `8c33d36` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug). **Impact:** Necessary for correctness — the wiring is the plan's core deliverable and it made the pre-existing seed reset order invalid. No scope creep; the ExhibitListRow widening was deliberately left to 03-03 as the plan specifies.

## Issues Encountered
- `node_modules` was absent in the workspace (app runs via docker-compose). Ran `npm install --include=dev` + `prisma generate` to enable local tsc/vitest/build. The local Prisma CLI (6.19.3) matches the client; `npx prisma` resolves to 7.10.0, so the local binary was used for validate/migrate.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Schema + generated client expose `DiscrepancyFlag` / `JuryPackage` / `JuryPackageExhibit` for 03-02 (finalize gate reads flags via `getDiscrepancies`) and 03-03 (row/badge consume `DiscrepancyFlagSummary` + `ruleLabel`).
- `AppError.details` channel is in place for 03-02's finalize 409 blocking-exhibit list.
- 03-03 still owns widening `ExhibitListRow.discrepancyFlags` and the seed-produces-flags assertion.

## Known Stubs
None found — the three pre-existing "placeholder" comments in `types.ts`/`custody.ts`/`history.ts` describe intentional, correct behavior (ExhibitListRow widening is 03-03's scope; custody-gap null and history `discrepancyFlags: []` are honest states, left untouched per the plan). No incomplete implementations, empty bodies, or hardcoded returns in the changed code.

## Build / Verification Check
- `./node_modules/.bin/prisma validate` → valid
- `npx tsc --noEmit` → exit 0
- `npx vitest run` (full suite) → 123 passed, 0 failed, 7 skipped
- `npm run build` → exit 0
- grep: `evaluateDiscrepancies` wired once each into status/objections/custody; zero direct `exhibitEvent.create` in discrepancies.ts

## Self-Check: PASSED
- All created files present on disk (discrepancies.ts, discrepancies.test.ts, discrepancyLabels.ts, migration.sql, SUMMARY.md)
- All three task commits present (4079d6c, 0fb878c, 8c33d36)
- Plan-level build ran and passed (`npm run build` exit 0)
- Known Stubs section present; no blocking stubs

---
*Phase: 03-jury-package-discrepancy-detection*
*Completed: 2026-10-07*
