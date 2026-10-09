---
phase: 08-ui-redesign-and-write-action-coverage
plan: 06
subsystem: api
tags: [command-center, attention-feed, custody, status-counts, read-aggregation, sealed-visibility]

# Dependency graph
requires:
  - phase: 03-jury-package-discrepancy-detection
    provides: DiscrepancyFlag engine (ADMITTED_NO_CUSTODIAN, UNRESOLVED_OBJECTION_JURY_ELIGIBLE), JuryPackageExhibit membership
  - phase: 01-data-foundation
    provides: CustodyCurrentState / ObjectionCurrentState / ExhibitCurrentState projections, visibility.canViewSealed
  - phase: 05-trial-command-center-live-sync
    provides: getRecentActivity + activity route (the additive-field host), CommandCenterLoadError
provides:
  - getCustodyByCustodian(caseId, role) service + GET /api/cases/:id/custody-by-custodian route
  - getAttentionFeed(caseId, role) 4-tier ranked evaluator + GET /api/cases/:id/attention-feed route
  - AttentionFeedLoadError (ATTENTION_FEED_LOAD_FAILED) typed error
  - getStatusCounts(caseId, role) service function (service-level only; route wiring deferred to 08-10)
affects: [08-10, 08-15]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Read-only Command Center aggregation over existing projections (zero new tables/indexes), same shape as getRecentActivity"
    - "4-tier ranked feed: per-tier newest-first queries concatenated in fixed CRITICAL>HIGH>PENDING>MEDIUM order, never a global sort"
    - "Tier disambiguation by the exhibit's currentStatus at evaluation time (ADMITTED->HIGH vs OFFERED/OBJECTED->PENDING)"

key-files:
  created:
    - src/services/custodyByCustodian.ts
    - src/services/custodyByCustodian.test.ts
    - src/app/api/cases/[id]/custody-by-custodian/route.ts
    - src/app/api/cases/[id]/custody-by-custodian/route.test.ts
    - src/services/attentionFeed.ts
    - src/services/attentionFeed.test.ts
    - src/app/api/cases/[id]/attention-feed/route.ts
    - src/app/api/cases/[id]/attention-feed/route.test.ts
  modified:
    - src/lib/errors.ts
    - src/services/activity.ts
    - src/services/activity.test.ts

key-decisions:
  - "CRITICAL tier uses exhibit.isSealed as the Phase-8 substitute for F16's absent classification column, matching juryPackage.ts's existing CRITICAL-row treatment"
  - "custody-by-custodian route reuses the EXISTING COMMAND_CENTER_LOAD_FAILED code (no custody-specific code); attention-feed introduces the NEW ATTENTION_FEED_LOAD_FAILED code"
  - "getStatusCounts is service-level only this plan; wiring into the activity route's response is deferred to 08-10 to move backend + all consumers atomically and avoid an intermediate broken-consumer state"
  - "pendingTransfersIn is always [] (F19 pending-transfer concept skipped); kept in the output shape for contract-shape fidelity only"

patterns-established:
  - "Attention feed CRITICAL availableAction is REMOVE_FROM_PACKAGE (link-through to F13's existing remediation), HIGH/PENDING RECORD_RULING, MEDIUM TRANSFER_CUSTODY"

# Metrics
duration: 6 min
completed: 2026-10-09
---

# Phase 8 Plan 06: Command Center Backend Read Surfaces Summary

**Three read-only Command Center aggregations over existing projections: custody-by-custodian grouping, a 4-tier ranked attention feed (CRITICAL/HIGH/PENDING/MEDIUM with isSealed-based CRITICAL and currentStatus-based HIGH/PENDING disambiguation), and a sealed-filtered per-status exhibit count.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-10-09T12:04:00Z
- **Completed:** 2026-10-09T12:10:03Z
- **Tasks:** 3
- **Files modified:** 11 (8 created, 3 modified)

## Accomplishments
- `getCustodyByCustodian` groups every role-visible exhibit by current custodian over `CustodyCurrentState`, plus a distinct "no custodian of record" bucket via a left-anti-join; sorted by custodian name; `pendingTransfersIn` structurally `[]`.
- `getAttentionFeed` evaluates 4 tiers over `JuryPackageExhibit`/`DiscrepancyFlag`/`ObjectionCurrentState`, concatenated CRITICAL>HIGH>PENDING>MEDIUM (never a global sort), newest-first within each tier; an objection thread is counted in exactly one of HIGH/PENDING, disambiguated solely by the exhibit's `currentStatus`.
- `getStatusCounts` returns a fully zero-filled 6-key `Record<ExhibitStatus, number>` over `ExhibitCurrentState`, excluding never-statused exhibits, with the shared sealed predicate.
- Two new thin GET routes + one new typed error; every query applies the same `canViewSealed(role) ? {} : { isSealed: false }` WHERE predicate so sealed data is structurally absent for unauthorized roles.

## Task Commits

1. **Task 1: getCustodyByCustodian service + route** - `ddaee63` (feat)
2. **Task 2: getAttentionFeed service + route** - `4f087e8` (feat)
3. **Task 3: getStatusCounts service function** - `23848e6` (feat)

## Files Created/Modified
- `src/services/custodyByCustodian.ts` - custodian-grouping aggregation + no-custodian bucket
- `src/services/custodyByCustodian.test.ts` - grouping, no-custodian bucket, role parity
- `src/app/api/cases/[id]/custody-by-custodian/route.ts` - thin GET, reuses COMMAND_CENTER_LOAD_FAILED
- `src/app/api/cases/[id]/custody-by-custodian/route.test.ts` - happy path + 500
- `src/services/attentionFeed.ts` - 4-tier ranked evaluator
- `src/services/attentionFeed.test.ts` - tier order, no-interleave, within-tier recency, HIGH/PENDING single-count, role parity, field shape
- `src/app/api/cases/[id]/attention-feed/route.ts` - thin GET, new ATTENTION_FEED_LOAD_FAILED
- `src/app/api/cases/[id]/attention-feed/route.test.ts` - happy path + 500
- `src/lib/errors.ts` - added AttentionFeedLoadError
- `src/services/activity.ts` - added getStatusCounts (getRecentActivity untouched)
- `src/services/activity.test.ts` - added 3 getStatusCounts cases (existing cases untouched)

## Decisions Made
- See key-decisions in frontmatter. Notably: CRITICAL uses `isSealed` (Phase-8 substitute); `getStatusCounts` route wiring deferred to 08-10; custody panel reuses the existing command-center error code while the attention feed introduces its own.

## Deviations from Plan

None - plan executed exactly as written.

The attention-feed CRITICAL entry's `availableAction` was set to `'REMOVE_FROM_PACKAGE'` (one of the plan's declared `AttentionAction` union members) rather than the `null` shown in the plan's inline code snippet comment — the plan's own prose names a "link-through to F13's existing Remove-from-Package" and the union explicitly includes `REMOVE_FROM_PACKAGE`, so this is the intended action value, not a behavior change. Noted for transparency; not tracked as a rule-governed deviation.

## Known Stubs

None found. Stub scan (`TODO|FIXME|placeholder|not implemented|coming soon`) over all created/modified files returned clean. `pendingTransfersIn: []` is a deliberate, documented contract-shape field (F19 skipped), not an incomplete stub.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 08-10 and 08-15 (Command Center screen plans) can now render the stat cards, status-distribution bar, Custody-at-a-Glance panel, and Needs-Your-Attention feed from these surfaces.
- 08-10 owns wiring `getStatusCounts` into the `GET /api/cases/:id/activity` response (`{ recentActivity, statusCounts }`) and updating `useRecentActivity.ts`/`RecentActivityPanel.tsx`/`page.tsx` atomically — this plan deliberately left the route and its consumers untouched.

## Self-Check

- Created files all exist on disk (verified).
- All three task commits present (`ddaee63`, `4f087e8`, `23848e6`).
- Plan-level build ran and passed: `npx next build` → exit 0 (both new routes registered).
- Full plan test set: 25/25 green across the 6 relevant test files; existing activity route test re-run and still green (no regression).
- No blocking stubs.

## Self-Check: PASSED

---
*Phase: 08-ui-redesign-and-write-action-coverage*
*Completed: 2026-10-09*
