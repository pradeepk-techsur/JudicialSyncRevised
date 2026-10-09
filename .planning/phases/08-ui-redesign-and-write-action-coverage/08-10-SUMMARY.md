---
phase: 08-ui-redesign-and-write-action-coverage
plan: 10
subsystem: ui
tags: [command-center, react-query, carbon, status-counts, custody, activity-feed, F08, F24]

# Dependency graph
requires:
  - phase: 08-03
    provides: Card shared chrome + ExhibitTag chip
  - phase: 08-04
    provides: dark-dashboard app Header (role dropdown + Ask Pivota), untouched by this plan
  - phase: 08-06
    provides: getStatusCounts service + GET /api/cases/:id/custody-by-custodian route
  - phase: 08-09
    provides: TransferCustodyForm shared write-action form + useTransferCustody
provides:
  - "GET /api/cases/:id/activity now returns { recentActivity, statusCounts } (08-06 hand-off completed)"
  - "useRecentActivity ActivityResponse shape (feed + statusCounts in one query)"
  - "StatCardRow (4 cards, jury-blockers critical-when-nonzero, zero drill-in)"
  - "StatusDistributionBar (proportional segmented bar + legend, StatusBadge color tokens reused)"
  - "useCustodyByCustodian 4s-polling hook + CustodyAtAGlancePanel with role-gated inline transfer"
  - "Recent Activity client-side filter pills + date-group headers + shared ExhibitTag chip"
  - "command-center/page.tsx redesigned to the reference-screenshot layout (header/cards/bar/panels)"
affects: ["08-15"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One activity query backs feed + freshness + stat cards + distribution bar (no fan-out)"
    - "Client-side filter-pill narrowing via useMemo over already-loaded data (zero new query)"
    - "Role-gated inline write action: absent-not-disabled client gate over an authoritative server gate"

key-files:
  created:
    - src/components/command-center/StatCardRow.tsx
    - src/components/command-center/StatCardRow.module.scss
    - src/components/command-center/StatusDistributionBar.tsx
    - src/components/command-center/StatusDistributionBar.module.scss
    - src/components/command-center/CustodyAtAGlancePanel.tsx
    - src/components/command-center/CustodyAtAGlancePanel.module.scss
    - src/hooks/useCustodyByCustodian.ts
  modified:
    - src/app/api/cases/[id]/activity/route.ts
    - src/app/api/cases/[id]/activity/route.test.ts
    - src/hooks/useRecentActivity.ts
    - src/app/command-center/page.tsx
    - src/app/command-center/page.module.scss
    - src/components/command-center/RecentActivityPanel.tsx
    - src/components/command-center/RecentActivityPanel.module.scss
    - e2e/command-center.spec.ts

key-decisions:
  - "Screen-header subtitle falls back to caseNumber (not case title): roleStore hydrates caseNumber only, and widening the case-bootstrap endpoint was out of this task's minimal scope (plan-sanctioned fallback)"
  - "RecentActivityPanel's prop-type + data-access fix was made in Task 1 (not deferred to Task 3) because Task 1's tsc gate requires a compiling atomic commit; the ExhibitTag swap + pills + date headers stayed in Task 3"
  - "Count-sensitive e2e assertions (stat cards, distribution bar, filter pills, date headers) use a mocked /activity payload for determinism under the shared-DB; structural/role tests use the real seed"

patterns-established:
  - "StatusDistributionBar reuses StatusBadge's exact @carbon/colors per-status tokens (one authoritative color mapping, never a second)"

# Metrics
duration: 13 min
completed: 2026-10-09
---

# Phase 8 Plan 10: Trial Command Center — baseline redesign + read-only widgets Summary

**statusCounts wired end-to-end into the activity route, 4 stat cards + a proportional status-distribution bar, a Custody-at-a-Glance panel with its one role-gated inline Transfer/Assign write action, Recent Activity filter pills + date-group headers, and a page-local live-status screen header — all against the reference-screenshot layout.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-10-09T12:35:00Z (approx)
- **Completed:** 2026-10-09T12:48:03Z
- **Tasks:** 3
- **Files modified:** 15 (7 created, 8 modified)

## Accomplishments
- Completed 08-06's deferred hand-off: `GET /api/cases/:id/activity` now returns `{ recentActivity, statusCounts }` (both reads sealed-filtered by the requesting role, run concurrently), and every consumer (`useRecentActivity` → `ActivityResponse`, `RecentActivityPanel`, `page.tsx`) moved atomically.
- Built `StatCardRow` (Open objections / Custody gaps / Jury package blockers / Admitted X of Y) sourced EXACTLY per F08's sourcing table from the existing objections/discrepancies/jury-package hooks + statusCounts; the jury-blockers card carries the shared `Card` critical red-outline only when its count > 0; no card is clickable.
- Built `StatusDistributionBar` — one proportional segmented bar + a 6-status legend, reusing StatusBadge's exact per-status `@carbon/colors` tokens (no new color mapping), native `title` tooltip, no navigation.
- Built `useCustodyByCustodian` (4s-polling, role+caseId in key) + `CustodyAtAGlancePanel`: groups by custodian, a distinct red "No custodian" row, and an inline Transfer/Assign trigger that expands 08-09's shared `TransferCustodyForm` — present only for DEPUTY/CLERK/ADMIN (absent-not-disabled), with the pending-transfer grouping deliberately omitted (F19 skipped, documented inline).
- Layered Recent Activity's client-side filter pills (All/Status/Custody/Objections/Rulings, All default, `useMemo` narrowing, zero new query) and date-group headers (TODAY/YESTERDAY · date) on top of the already-shipped date/time fix, and swapped its last plain-text exhibit label for the shared `ExhibitTag` chip.
- Added the page-local screen header (title + caseNumber subtitle + pulsing live dot + freshness) per Screenshot 1; the shared app Header from 08-04 is untouched.

## Task Commits

1. **Task 1: statusCounts end-to-end + stat cards + distribution bar + screen header** — `91a0605` (feat)
2. **Task 2: Custody-at-a-Glance panel + hook** — `e9027ba` (feat)
3. **Task 3: filter pills + date-group headers + ExhibitTag + full e2e** — `f1d21bc` (feat)

_Plan metadata commit follows this SUMMARY._

## Files Created/Modified
- `src/app/api/cases/[id]/activity/route.ts` — amended to `{ recentActivity, statusCounts }` via `Promise.all`
- `src/app/api/cases/[id]/activity/route.test.ts` — assertions moved to `body.recentActivity` + new 6-key statusCounts assertion
- `src/hooks/useRecentActivity.ts` — `ActivityResponse` interface + queryFn/return-type update
- `src/hooks/useCustodyByCustodian.ts` — new 4s-polling hook over 08-06's route
- `src/components/command-center/StatCardRow.{tsx,module.scss}` — the 4-card row
- `src/components/command-center/StatusDistributionBar.{tsx,module.scss}` — the segmented bar + legend
- `src/components/command-center/CustodyAtAGlancePanel.{tsx,module.scss}` — custody groups + no-custodian row + inline action
- `src/components/command-center/RecentActivityPanel.{tsx,module.scss}` — prop shape fix, filter pills, date headers, ExhibitTag
- `src/app/command-center/page.{tsx,module.scss}` — redesigned layout + screen header + live dot
- `e2e/command-center.spec.ts` — 8 new 08-10 cases

## Decisions Made
- Screen-header subtitle falls back to `caseNumber` rather than the case title (roleStore hydrates only caseNumber; widening the bootstrap endpoint was out of minimal scope — the plan explicitly sanctioned this fallback).
- The `RecentActivityPanel` prop-type/data-access change was made in Task 1 (the plan suggested Task 3) because Task 1's `tsc --noEmit` gate requires an atomic, compiling commit; the richer panel work (ExhibitTag chip, pills, date headers) remained in Task 3 as planned.
- Count-sensitive e2e assertions use a mocked `/activity` payload for determinism against the continuously-reseeded shared DB; structural/role tests run against the real seed.

## Deviations from Plan

None - plan executed exactly as written. (The Task-1 placement of the `RecentActivityPanel` prop-type fix is a documented execution-ordering choice forced by the per-task tsc gate, not a scope deviation — the same edits the plan assigned, split to keep each commit compiling.)

## Known Stubs

None found. A scan of all created/modified files for TODO/FIXME/placeholder/not-implemented returned no hits. The one intentional non-render — the `custody-group-pending` grouping — is a documented F19/Phase-7.1 scope exclusion (pendingTransfersIn is always `[]` this phase), not a stub.

## Issues Encountered

- **Shared-DB seed churn (recurring, environmental — not a code defect).** Multiple sibling Phase-8 plans ran their full Playwright suites in parallel on the same working tree + Postgres throughout this execution, continuously re-seeding the shared `2026-CR-0142` case (`npm run seed` failed intermittently with FK/validation errors mid-run; two real-seed e2e tests — the multi-tab live-update probe and the sealed-S-1-absence probe — failed on their API-setup lines when a sibling deleted/rebuilt the case mid-test). Both tests **pass deterministically on a stable seed window** (re-seeded + re-run: `2 passed`), confirming the failures are concurrent-reseed collateral, not regressions. This is the same hazard logged in STATE.md for 08-04/08-05/08-07. My own 8 new tests and all count-sensitive assertions use mocked payloads and are immune.

## Verification

- `npx tsc --noEmit` — exit 0
- `npm run build` — exit 0 (plan-level gate, after last task)
- `npx vitest run src/app/api/cases/[id]/activity/route.test.ts` — 5/5 passed
- `npx playwright test e2e/command-center.spec.ts --workers=1` — all 8 new 08-10 tests green on every run; the full 16-test file is green on a stable seed window (the only failures observed were the two pre-existing real-seed probes flaking under concurrent sibling re-seeding, re-verified passing after a clean re-seed).

## Next Phase Readiness
- Command Center baseline + read-only widgets complete. `page.tsx` is laid out with the two-column lower rows ready for **08-15 (wave 4)** to insert the "Needs Your Attention" feed and the Jury Package summary widget alongside Custody at a Glance.
- No blockers introduced. The one inline write surface (custody transfer) reuses 08-09's proven form over 08-02's server gate — no new authorization logic.

---
*Phase: 08-ui-redesign-and-write-action-coverage*
*Completed: 2026-10-09*

## Self-Check: PASSED

- All 7 created files exist on disk (verified with `[ -f ]`).
- All 3 task commits present in git history (`91a0605`, `e9027ba`, `f1d21bc`).
- Plan-level build ran and passed: `npm run build` → exit 0.
- `## Known Stubs` section present; no blocking stubs.
