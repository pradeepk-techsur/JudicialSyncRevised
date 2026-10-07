---
phase: 02-core-screens
plan: 06
subsystem: ui
tags: [react-query, zustand, next, case-workspace, exhibit-search, playwright, base-ui]

# Dependency graph
requires:
  - phase: 02-core-screens
    provides: "02-04 ExhibitListRow shared row shape + /exhibits and /exhibits/search routes (AND-semantics filtering, role-based sealed exclusion)"
  - phase: 02-core-screens
    provides: "02-05 app shell (useRoleStore client session, apiFetch X-User-Role wrapper, shared StatusBadge, role switcher)"
provides:
  - "Case Workspace screen at /case: live-polling exhibit list table (F9) + integrated search/filter bar (F4)"
  - "useExhibitList hook — single query path switching getExhibits/searchExhibits on filter state, role-keyed, 4s polling"
  - "ExhibitTable + SearchFilterBar presentational components reusable by later list surfaces"
affects: [jury-package-workspace, trial-command-center, exhibit-detail-view]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single data-fetching hook per screen (one query path, zero screen-local status/custody derivation)"
    - "react-query key includes role so a role switch forces a cache miss + fresh server-enforced query (sealed-row leak prevention)"
    - "Client-side empty-search guard routes all-empty filters to the unfiltered list; the API's 422 EMPTY_SEARCH_CRITERIA is defense-in-depth only"

key-files:
  created:
    - src/hooks/useExhibitList.ts
    - src/components/case/ExhibitTable.tsx
    - src/components/case/SearchFilterBar.tsx
    - e2e/case-workspace.spec.ts
  modified:
    - src/app/case/page.tsx

key-decisions:
  - "SearchFilterBar status control uses the @base-ui/react Select wrapper (02-01); its SelectValue supports a placeholder prop so the plan's markup worked unchanged against the base-ui API"
  - "page.tsx owns the two distinct empty states (genuinely-empty 'No exhibits recorded yet' vs filtered-empty), keeping ExhibitTable criteria-agnostic per the plan"

patterns-established:
  - "Screen = one useQuery hook + presentational table/filter components; no derivation in the view layer"
  - "role-keyed react-query cache invalidation for role-scoped visibility (threat T-02-15)"

# Metrics
duration: 12 min
completed: 2026-10-07
---

# Phase 2 Plan 6: Case Workspace Screen Summary

**Live-polling Case Workspace at /case — full exhibit list table (F9) with combinable keyword/status/witness/date search (F4), role-keyed sealed-exhibit invisibility, and row-click drill-through to Exhibit Detail — reading exclusively through the 02-04 API with zero screen-local derivation.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-10-07T08:25:00Z
- **Completed:** 2026-10-07T08:37:00Z
- **Tasks:** 3
- **Files modified:** 5 (4 created, 1 replaced)

## Accomplishments
- `useExhibitList` — the screen's single query path, switching between `getExhibits` and `searchExhibits` based on active filter state, keyed on `role` for immediate refetch on role switch, polling every 4s for live-sync.
- `ExhibitTable` — label/description/party/witness/status (via shared `StatusBadge`)/custodian + a structurally-present (always-empty until Phase 3) discrepancy column; rows keyed by `exhibitId` (no flicker on poll) and drill through to `/exhibit/:id`.
- `SearchFilterBar` — keyword/status/witness/date controls with individually-removable active-filter chips and an inline empty-search hint; empty criteria never reach the search API.
- `/case` page wires the two components through the hook, distinguishing genuinely-empty vs filtered-empty states.
- Playwright spec proving all six must-have truths end-to-end; 02-05's app-shell spec still passes against the real `/case` content.

## Task Commits

1. **Task 1: useExhibitList data hook** - `5a0acd6` (feat)
2. **Task 2: ExhibitTable + SearchFilterBar + /case page** - `11f997a` (feat)
3. **Task 3: Case Workspace Playwright spec** - `8cc8dca` (test)

**Plan metadata:** (docs commit, this summary + STATE.md)

## Files Created/Modified
- `src/hooks/useExhibitList.ts` - react-query hook; one query path, role-keyed, 4s polling, empty-search guard
- `src/components/case/ExhibitTable.tsx` - exhibit list table, StatusBadge per row, row-click → /exhibit/:id, empty discrepancy column
- `src/components/case/SearchFilterBar.tsx` - keyword/status/witness/date controls + removable filter chips + inline empty-search hint
- `src/app/case/page.tsx` - replaced 02-05 placeholder with the real screen; owns the two empty-state copies
- `e2e/case-workspace.spec.ts` - 5 scenarios covering browse/search/role-visibility/empty-hint/navigation

## Decisions Made
- The status filter control uses the project's `@base-ui/react`-backed `Select` wrapper (installed in 02-01), not Radix. `base-ui`'s `SelectValue` accepts a `placeholder` prop and `SelectRoot` uses `value`/`onValueChange`, so the plan's markup compiled and ran unchanged — no adaptation beyond a narrowing cast on the `onValueChange` value.
- `page.tsx` distinguishes the genuinely-empty case ("No exhibits recorded yet") from a filtered-empty view, keeping `ExhibitTable` criteria-agnostic exactly as the plan directed.

## Deviations from Plan

None - plan executed exactly as written. (The one adaptation anticipated by the plan — honoring the actual shadcn/base-ui `Select` API from 02-01 — required no code change, as base-ui's `SelectValue` already supports the `placeholder` prop the plan used.)

**Total deviations:** 0
**Impact on plan:** None.

## Known Stubs
- `src/components/case/ExhibitTable.tsx` discrepancy column renders nothing — intentional and documented: `ExhibitListRow.discrepancyFlags` is typed `[]` until Phase 3's DiscrepancyFlag table exists (shared contract from 02-04). This is an honest structural placeholder, not a blocking stub; the column exists so Phase 3 can populate it without a table-shape change.
- `placeholder` matches in SearchFilterBar are HTML input placeholder attributes (hint text), not incomplete implementations.
- **Blocking stubs: none.**

## Issues Encountered
- Running Playwright via the config's `webServer: npm run dev` cold-start inside the sandbox exceeded the Bash tool timeout (next dev first-compile + 11 tests). Resolved by starting the already-built app with `npm run start` (Ready in ~50ms) in the same Bash invocation as the test run, which Playwright reused via `reuseExistingServer`. All 11 tests passed in 1.8s. No source change required — purely a local verification harness nuance.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `/case` is the primary browsing/searching surface and is fully interactive; the F5 Jury Package Workspace (Phase 3) can reuse the one-hook + presentational-table pattern established here.
- Plan 02-07 (Exhibit Detail View, `/exhibit/[id]`) is this plan's row-click target — the route already exists in the build, so drill-through works end-to-end.
- Phase 2 (Core Screens) plans: this is 02-06 of the wave-3 pair with 02-07.

## Self-Check: PASSED

- All created files exist on disk (useExhibitList.ts, ExhibitTable.tsx, SearchFilterBar.tsx, case-workspace.spec.ts, case/page.tsx, 02-06-SUMMARY.md).
- All task commits present in git history (5a0acd6, 11f997a, 8cc8dca).
- Plan-level build gate: `npm run build` → exit 0.
- Verification: `npx playwright test e2e/case-workspace.spec.ts e2e/app-shell.spec.ts --workers=1` → 11 passed.
- Known Stubs section present; no blocking stubs.

---
*Phase: 02-core-screens*
*Completed: 2026-10-07*
