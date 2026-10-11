---
phase: 09-ui-tickets-and-typography-standard
plan: 13
subsystem: ui
tags: [react, tanstack-query, carbon, command-center, live-indicator, freshness]

# Dependency graph
requires:
  - phase: 09-01
    provides: Command Center first-viewport rebuild (page-local header the LiveIndicator mounts into)
  - phase: 09-04
    provides: Recent Activity rework (useRecentActivity is the freshness anchor query the indicator reads)
provides:
  - LiveIndicator component — green "Live" (<60s) / amber "Connection lost" + Refresh (>=60s or error), driven purely by TanStack Query state
  - computeIsStale + STALE_THRESHOLD_SECONDS (60s) exported from useFreshness for a node-testable boundary
affects: [command-center, freshness, live-sync]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure, exported derivation (computeIsStale) extracted from a React hook so its boundary is unit-testable in the node-only vitest harness (mirrors SeverityPill/TwoColorProgressBar)"
    - "Live-awareness indicators flip on a hard threshold driven by react-query metadata (dataUpdatedAt/isError), never a bespoke timer"

key-files:
  created:
    - src/components/command-center/LiveIndicator.tsx
    - src/components/command-center/LiveIndicator.module.scss
    - src/hooks/useFreshness.test.ts
  modified:
    - src/hooks/useFreshness.ts
    - src/app/command-center/page.tsx
    - src/app/command-center/page.module.scss
    - e2e/command-center.spec.ts

key-decisions:
  - "isStale threshold is 60s inclusive (secondsAgo >= 60), and an active query error is itself treated as stale regardless of last-success age"
  - "LiveIndicator subsumes the former standalone live-status dot + 'updated Xs ago' text; the wrapper retains the live-status-dot testid for non-regression"
  - "The 60s time-based boundary is covered by a unit test (node env); the e2e layer forces the query error state as a fast, deterministic trigger for the 'Connection lost' + Refresh markup"

patterns-established:
  - "Extract a pure helper from a hook to make a threshold unit-testable without jsdom"

# Metrics
duration: 7min
completed: 2026-10-10
---

# Phase 9 Plan 13: LiveIndicator (Live / Connection lost at 60s) Summary

**Replaced the Command Center's tiny "updated 44s ago" freshness text (T-15) with a labeled LiveIndicator — green "Live" + pulsing dot while the latest successful activity fetch is under 60s old, flipping to an amber "Connection lost" + working Refresh once it exceeds 60s or the query errors — driven purely by TanStack Query state (dataUpdatedAt/isError), no bespoke timer.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-10-10T18:48:43Z
- **Completed:** 2026-10-10T18:55:09Z
- **Tasks:** 2
- **Files modified:** 7 (3 created, 3 modified, 2 deleted via sibling commit)

## Accomplishments
- `LiveIndicator` component: labeled green "Live" <60s; amber "Connection lost" + ghost `Refresh` button >=60s or on query error. The Refresh calls the activity query's own `refetch()` — a read-only re-poll, no new write path (threat T-09-19).
- `useFreshness` extended additively: optional `isError` third param, exported `computeIsStale(secondsAgo, isError)` pure helper + `STALE_THRESHOLD_SECONDS = 60`, now returns `{ secondsAgo, isFetching, isStale }`. Existing two-arg callers are unaffected.
- Wired into the Command Center page header replacing `FreshnessIndicator`; the now-dead `.liveDot`/`@keyframes livePulse` migrated from `page.module.scss` into `LiveIndicator.module.scss`.
- `FreshnessIndicator.tsx`/`.module.scss` fully retired (its only consumer was this page header; the `JuryPackageDraft` local `FreshnessIndicator` function is a separate, untouched symbol).
- Coverage: a node-env unit test for the 60s `isStale` boundary (59→false, 60→true, null→false, error→true), and two Playwright tests (green "Live" under normal polling; forced query error → amber "Connection lost" + working Refresh that recovers to "Live").

## Task Commits

1. **Task 1: useFreshness isError/isStale + LiveIndicator component** - `e969442` (feat)
2. **Task 2: wire LiveIndicator into header, retire FreshnessIndicator, tests** - `3a911a6` (feat)

_Note: the `FreshnessIndicator.tsx`/`.module.scss` deletions (staged via `git rm` during Task 2) landed in sibling commit `bfc6112` through the shared git index — the documented recurring Phase-8/9 shared-working-tree hazard. The files are gone from the tree; my Task 2 code changes committed cleanly and separately in `3a911a6`._

## Files Created/Modified
- `src/components/command-center/LiveIndicator.tsx` - The labeled Live/Connection-lost indicator (created)
- `src/components/command-center/LiveIndicator.module.scss` - Green pulse (migrated) + amber tones + inline Refresh button styling (created)
- `src/hooks/useFreshness.test.ts` - Unit tests for the 60s `isStale` boundary (created)
- `src/hooks/useFreshness.ts` - Additive `isError` param + exported `computeIsStale`/`STALE_THRESHOLD_SECONDS`; returns `isStale` (modified)
- `src/app/command-center/page.tsx` - `FreshnessIndicator` → `LiveIndicator` with `isError`/`onRefetch` (modified)
- `src/app/command-center/page.module.scss` - Removed dead `.liveDot`/`@keyframes`/unused `@carbon/colors` (modified)
- `e2e/command-center.spec.ts` - Updated freshness assertion → `live-indicator`; new T-15 tests (modified)
- `src/components/command-center/FreshnessIndicator.tsx` + `.module.scss` - Deleted (superseded)

## Decisions Made
- **60s inclusive threshold + error-as-stale:** `isStale = isError || (secondsAgo !== null && secondsAgo >= 60)`. An active failure is itself the "connection lost" signal, so it overrides a recent success.
- **LiveIndicator subsumes the standalone dot:** rather than keeping both a `live-status-dot` span and the indicator, the LiveIndicator's own green dot + "Live" IS the live signal. The wrapper keeps the `live-status-dot` testid so the existing header test is non-regressed.
- **Testing split:** the time-based 60s boundary is unit-tested (the node-only vitest harness cannot render a `useState`/`useEffect` hook), while the e2e layer uses a forced query error as a fast, deterministic trigger for the stale markup — exactly as the plan prescribed.

## Deviations from Plan

None - plan executed exactly as written.

The one notable out-of-scope discovery was a pre-existing sibling-plan tsc error (09-07's `witnessOptions` prop on `SearchFilterBar`), logged to `deferred-items.md` and NOT fixed (SCOPE BOUNDARY); it had self-resolved via sibling convergence by final verification, and `tsc --noEmit` ended at 0 errors tree-wide.

## Known Stubs

None found - the `grep` stub scan over all changed files returned no TODO/FIXME/placeholder/not-implemented matches.

## Issues Encountered
- **Shared-working-tree hazard (recurring Phase-8/9):** a sibling 09-07 commit (`bfc6112`) swept my staged `git rm` of the FreshnessIndicator files into its own commit via the shared index. No work lost — the files are correctly deleted and my code changes committed separately. `git stash` was used exactly once (to confirm the pre-existing tsc error on HEAD) and then deliberately avoided, per the 09-04 lesson.
- **Shared-DB seed race:** the first `npm run seed` hit a P2003 FK error (a concurrent sibling reset); a retry after a brief wait seeded cleanly (11 exhibits). All 41 command-center e2e tests then passed in a stable window.

## Verification
- `npx tsc --noEmit` — 0 errors tree-wide
- `npx vitest run src/hooks/useFreshness.test.ts` — 8/8 passed
- `npx playwright test e2e/command-center.spec.ts --workers=1` — 41/41 passed (incl. the 2 new T-15 tests)
- `npm run build` — EXIT 0

## Next Phase Readiness
- Plan 13 complete. The Command Center live-awareness ticket (T-15) is delivered end-to-end.
- Remaining Phase 9 plans (09-14..09-17) are independent; no blockers introduced.

---
*Phase: 09-ui-tickets-and-typography-standard*
*Completed: 2026-10-10*

## Self-Check: PASSED
- All created files verified present on disk (LiveIndicator.tsx/.module.scss, useFreshness.ts, useFreshness.test.ts)
- FreshnessIndicator.tsx confirmed deleted
- Both task commits found (e969442, 3a911a6)
- Build check: `npm run build` → exit 0
- Known Stubs section present, no blocking stubs
