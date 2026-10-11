---
phase: 09-ui-tickets-and-typography-standard
plan: 08
subsystem: ui
tags: [navigation, carbon, sidebar, usePathname, jury-package, accessibility]

# Dependency graph
requires:
  - phase: 08-ui-redesign-and-write-action-coverage
    provides: "Sidebar.module.scss dark-navy theme incl. .cds--side-nav__link--current active wash (08-04); useJuryPackage hook + JuryPackageExhibitView shape (FLAGGED/isSealed); Command Center juryBlockers formula (08-10)"
provides:
  - "Route-driven active nav state in the sidebar (current screen's item marked via Carbon isActive -> .cds--side-nav__link--current)"
  - "A leading @carbon/icons-react glyph on every sidebar nav item"
  - "Jury Package nav badge that counts jury-package blockers (FLAGGED or sealed), matching the Jury Package page's own Blockers heading and the Command Center stat card by construction"
affects: [verify-work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "usePathname()-driven Carbon SideNavLink isActive for route-aware active nav (coalesced to '' for the hydration-null window)"
    - "Small, deliberate duplication of the jury-blocker formula (filter FLAGGED || isSealed) across 3 call sites (nav badge, Command Center stat card, Jury Package page) so the numbers agree by construction — the codebase's established cross-surface-parity pattern"

key-files:
  created: []
  modified:
    - src/components/shell/Sidebar.tsx
    - src/components/shell/JuryPackageNavItem.tsx
    - e2e/app-shell.spec.ts

key-decisions:
  - "Used Carbon's native SideNavLink isActive + renderIcon props (both present on @carbon/react ^1.118.0) rather than a hand-rolled className — isActive emits Carbon's own .cds--side-nav__link--current, which 08-04's Sidebar.module.scss already styles with the dark-navy active wash"
  - "Case Workspace nav item is also active on /exhibit/[id] detail pages (startsWith('/exhibit')) since the sidebar is the only entry point into an exhibit"
  - "Updated the badge aria-label from 'N open discrepancies' to 'N jury package blockers' because the semantics changed; a stale label describing the old meaning would itself be a usability defect"

# Metrics
duration: 16min
completed: 2026-10-10
---

# Phase 9 Plan 08: Sidebar active-nav feedback + Jury Package badge parity Summary

**Route-aware active nav state (Carbon `isActive` -> `.cds--side-nav__link--current`) with per-item icons, plus a Jury Package badge that now counts jury-package blockers (`FLAGGED || isSealed`) so it always matches the page it links to — closing T-08 from the external UI/UX review.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-10-10T17:28:39Z
- **Completed:** 2026-10-10T17:45:28Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- The current route's sidebar item is clearly marked active (Carbon's background + left-bar + the 08-04 dark-navy wash), not just by default link styling; navigating updates which item is active.
- Every sidebar nav item renders a leading `@carbon/icons-react` glyph (Dashboard / Folder / DocumentExport / Chat).
- The Jury Package nav badge count now equals the Jury Package page's own "Blockers (N)" heading and the Command Center "Jury package blockers" stat card for the same case state — the exact "badge shows 2 while the page shows nothing" defect is eliminated.

## Task Commits

Each task was committed atomically:

1. **Task 1: Route-driven active nav styling with icons** - `05de0e5` (feat)
2. **Task 2: Fix the Jury Package badge to match the page** - `ad92dd2` (fix)

## Files Created/Modified
- `src/components/shell/Sidebar.tsx` - Added `usePathname()`-driven `isActive` per route (Case Workspace also active on `/exhibit/*`) and a `renderIcon` glyph per `SideNavLink`; passes `isActive`/`renderIcon` down to `JuryPackageNavItem`.
- `src/components/shell/JuryPackageNavItem.tsx` - Accepts + forwards `renderIcon`/`isActive` onto its own `SideNavLink`; switched the badge data source from `useDiscrepancyCount().openCount` (case-wide OPEN flags) to `useJuryPackage()` with the identical `exhibits.filter((e) => e.discrepancyStatus === 'FLAGGED' || e.isSealed).length` formula; aria-label updated to `"N jury package blockers"`.
- `e2e/app-shell.spec.ts` - 3 new tests: active item tracks the route and flips on navigation; every nav item renders a leading icon; the badge reads the blocker count (2) with the new aria-label (matching the page's Blockers heading).

## Decisions Made
- Carbon's built-in `isActive`/`renderIcon` (both verified present on the installed `@carbon/react` ^1.118.0 `SideNavLinkProps`) were used rather than conditional classNames — `isActive` produces exactly the `.cds--side-nav__link--current` class that 08-04's `Sidebar.module.scss` already themes, so no SCSS change was needed.
- `usePathname()` is coalesced to `''` to avoid marking any item active during the brief hydration window where it can be null.

## Deviations from Plan

None - plan executed exactly as written. (The plan's `files_modified` lists `Sidebar.module.scss`; no change to it was required because 08-04 already ships the `.cds--side-nav__link--current` active styling that Carbon's `isActive` prop triggers.)

**Total deviations:** 0 auto-fixed.
**Impact on plan:** None — both tasks completed as specified; verification green.

## Issues Encountered
- **Parallel shared-working-tree collision (recurring Phase-8/9 hazard):** mid-execution, a sibling Phase-9 plan's `git` operation reverted my uncommitted `Sidebar.tsx` and `JuryPackageNavItem.tsx` back to their original contents (confirmed: files showed no `renderIcon`/`usePathname` despite a successful earlier Write; identical reverted mtimes). Resolved by re-applying both files and committing Task 1 immediately so the work could not be clobbered again. This is why Task 1 was committed before any Task 2 edit.
- **Out-of-scope sibling tsc error (logged, not fixed):** at one point `tsc --noEmit` exited 2 on an untracked sibling file `src/app/api/cases/[id]/jury-package/preview/route.ts` importing a not-yet-exported `JuryPackagePreviewLoadError`. Logged to `deferred-items.md`; my files were tsc-clean in isolation throughout. By the final build the sibling had committed the export and the full `tsc --noEmit` + `next build` both returned exit 0.
- **Dev-server / memory handling:** stopped the stale `project-app-1` preview container (kept `project-db-1` healthy) so Playwright ran `next dev` from live source; a manually pre-warmed dev server was OOM-killed once (sandbox ~7 GB limit, >6 GB threshold so browser E2E stayed permitted) but the `next-server` child survived and served the suite. All E2E runs green.

## Known Stubs
None found — no TODO/FIXME/placeholder/stub in the changed files; both behaviors are fully implemented and E2E-verified.

## Verification
- `npx tsc --noEmit` → exit 0 (full tree, after sibling settled).
- `npx next build` → exit 0 (all routes incl. /case, /command-center, /jury-package, /assistant, /exhibit/[id]).
- `npx playwright test e2e/app-shell.spec.ts e2e/jury-package.spec.ts --workers=1` → 23/23 passed (11 app-shell incl. 3 new 09-08 tests + the badge-parity test, 12 jury-package, 0 skipped).

## Next Phase Readiness
- T-08 (courtroom navigation usability) closed end-to-end. Independent of the remaining Phase-9 UI-ticket/typography plans (disjoint files). Ready for the next plan in Phase 9.

## Self-Check: PASSED
- SUMMARY.md present.
- Both task commits present on branch (`05de0e5`, `ad92dd2`); committed `JuryPackageNavItem.tsx` blob contains the new `useJuryPackage` source + "jury package blockers" label.
- All 3 changed files present on disk and working tree matches HEAD (no sibling revert of committed content).
- Plan-level build ran: `npx tsc --noEmit` exit 0 and `npx next build` exit 0.
- `## Known Stubs` section present; no blocking stubs.

---
*Phase: 09-ui-tickets-and-typography-standard*
*Completed: 2026-10-10*
