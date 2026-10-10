---
phase: 08-ui-redesign-and-write-action-coverage
plan: 16
subsystem: ui
tags: [carbon, playwright, css-stacking-context, e2e-regression]

# Dependency graph
requires:
  - phase: 08-ui-redesign-and-write-action-coverage
    provides: "08-04 dark-dashboard shell (Sidebar/Header), 08-10 Command Center status-distribution widget — both already-shipped code this plan fixes defects in"
provides:
  - "Sidebar CSS fix (inset-block-start: 3rem) so the fixed SideNav never paints over the fixed Header's 48px band, regardless of DOM nesting"
  - "Durable Playwright regression test proving zero header/sidebar overlap via rendered bounding-box geometry + a center-point hit-test on the role-switcher"
  - "StatusDistributionBar simplified to legend-only (dot+label+count per status) — the loud multi-colored segmented bar removed entirely"
  - "Phase 8's final open UAT gap (08-UAT.md test 2) closed"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fixed-position sibling stacking-context conflicts are fixed with an explicit inset-block-start offset replicating the framework's own sibling-combinator rule, not by restructuring the DOM"
    - "Playwright regression tests for overlap bugs use boundingBox() comparison + elementFromPoint() hit-testing, not DOM order or testid presence (which pass even with the bug present)"

key-files:
  created: []
  modified:
    - src/components/shell/Sidebar.module.scss
    - e2e/app-shell.spec.ts
    - src/components/command-center/StatusDistributionBar.tsx
    - src/components/command-center/StatusDistributionBar.module.scss
    - e2e/command-center.spec.ts

key-decisions:
  - "Fixed the sidebar/header overlap via an explicit inset-block-start: 3rem CSS offset on .cds--side-nav rather than restructuring AppShell.tsx's DOM (which would risk the .body padding-left:16rem layout assumption) — replicates the exact offset Carbon's own .cds--header ~ .cds--side-nav sibling rule would have applied had the SideNav been a literal DOM sibling of the Header"
  - "Removed the StatusDistributionBar's segmented multi-colored bar entirely per locked user decision (not replaced with a single-tone bar, not deleted as a whole panel) — kept the legend's small per-row colored dot since that's the same understated cue pattern StatusBadge already uses, distinct from the wide segmented strip that was the actual complaint"

patterns-established: []

# Metrics
duration: 18min
completed: 2026-10-09
---

# Phase 8 Plan 16: Close Final UAT Gap — Sidebar/Header Overlap + Status-Distribution Bar Removal Summary

**Fixed a CSS fixed-position stacking-context collision (sidebar painting over the header) with an explicit `inset-block-start` offset, and removed the Command Center's loud segmented status-distribution bar down to its existing count legend — closing Phase 8's last open UAT gap.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-10-09T19:46:00Z
- **Completed:** 2026-10-09T20:04:12Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Sidebar's rendered `.cds--side-nav` now starts at `y=48px` (3rem), never overlapping the shared header's band — proven by a Playwright bounding-box comparison AND a center-point hit-test on the role-switcher resolving to the select itself, not the sidebar
- `StatusDistributionBar` now renders legend-only: zero `.bar`/`.segment`/`.emptyBar` markup, zero `status-distribution-bar`/`status-segment-*` testids, in any state — while the existing 6-status dot+label+count legend is unchanged
- Both existing e2e suites (`app-shell.spec.ts` 8/8, `command-center.spec.ts` 24/24) pass with 0 regressions
- Gap ref "2" (`08-UAT.md` test 2, severity major) is closed — Phase 8 has no remaining open UAT gaps

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix sidebar/header stacking overlap** - `bacbd20` (fix)
2. **Task 2: Remove segmented status-distribution bar, keep count legend** - `0dfa3be` (fix)

**Plan metadata:** (pending — committed alongside this SUMMARY)

## Files Created/Modified
- `src/components/shell/Sidebar.module.scss` - Added `inset-block-start: 3rem` / `block-size: calc(100% - 3rem)` to the `.cds--side-nav` override so the fixed SideNav clears the fixed Header's 48px band
- `e2e/app-shell.spec.ts` - New regression test: header/sidebar bounding-box non-overlap + role-switcher center-point hit-test
- `src/components/command-center/StatusDistributionBar.tsx` - Removed the segmented-bar block + unused `total` calculation; component now returns only the `<ul>` legend
- `src/components/command-center/StatusDistributionBar.module.scss` - Deleted `.bar`/`.segment`/`.emptyBar` rules; legend-dot colors (`.segMarked`..`.segWithdrawn`, `.legend*`) untouched
- `e2e/command-center.spec.ts` - Legend test now asserts permanent absence of the bar wrapper and all 6 `status-segment-*` testids (not merely omits checking them)

## Decisions Made
- CSS-offset fix over DOM restructuring for the sidebar overlap (see key-decisions above) — lower risk, matches Carbon's own intended behavior exactly
- Kept legend-dots, removed only the wide segmented strip, per the user's explicit locked scope cut (not a judgment call made during execution — it was pre-decided in the plan)

## Deviations from Plan

None - plan executed exactly as written. Both root-cause fixes matched the plan's prescribed diffs verbatim; both empirical re-confirmations (rendered offset, full e2e suites) passed on the first attempt.

## Known Stubs

None found. Grep for `TODO|FIXME|placeholder|not.?implemented|coming soon` across all 5 changed files returned only one pre-existing, unrelated comment (`// is no longer any disabled placeholder.` — documentation of a prior removal, not a new stub).

## Issues Encountered

None. `node_modules` was absent at run start (fresh sandbox clone) — ran `npm install --include=dev` per the runtime contract (§4) before any `tsc`/build/Playwright step; this is expected first-run setup, not a deviation. A stale `project-app-1` docker container was also occupying port 3000 (built from an older image, not live source) — stopped it so Playwright's own `webServer` (`npm run dev`) could bind the port against live source; the `project-db-1` Postgres container was left running and healthy throughout (DB untouched, no re-seed needed).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 8 (UI Redesign and Write-Action Coverage) is now fully UAT-clean — both F08/F24 feature delivery (08-01 through 08-15) and this gap-closure plan (08-16) are complete, with 0 open gaps against `08-UAT.md`.
- No blockers. Ready for phase verification / transition to the next milestone phase.

---
*Phase: 08-ui-redesign-and-write-action-coverage*
*Completed: 2026-10-09*

## Self-Check: PASSED

- All 5 key-files (modified) found on disk
- Both task commits (`bacbd20`, `0dfa3be`) found in `git log --oneline --all`
- Build check: `npm run build` → exit 0 (confirmed twice, after Task 1 and after Task 2)
- `tsc --noEmit` → clean (0 errors) after both tasks
- Combined `playwright test e2e/app-shell.spec.ts e2e/command-center.spec.ts --workers=1` → 32/32 passed, 0 skipped
- Known Stubs section present above — no blocking stubs found
