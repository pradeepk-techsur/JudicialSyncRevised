---
phase: 07-fix-admission-integrity-and-ui-usability-issues
plan: 05
subsystem: ui
tags: [carbon, header, command-center, discrepancy-count, activity-feed, usability, playwright]

# Dependency graph
requires:
  - phase: 03-jury-package-discrepancy-detection
    provides: "useDiscrepancyCount shared case-wide OPEN-flag hook + /api/cases/:id/discrepancies"
  - phase: 05-trial-command-center-live-sync
    provides: "RecentActivityPanel + RecentActivityEntry.exhibitLabel/recordedAt"
  - phase: 06-carbon-design-system-ui-upgrade
    provides: "Carbon Header/HeaderGlobalBar/Button + Carbon Tile command-center panels"
provides:
  - "Shared labeled header discrepancy-count indicator (⚠ N, aria-label 'N open discrepancies'), absent when zero, navigating to /command-center#discrepancies"
  - "Recent Activity rows render full date+time and are prefixed with their exhibit label"
affects: [any screen consuming the shared Header, Command Center]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Labeled Header Indicator: ambient numeric header element is either labeled+explained or completely absent from the DOM — never a bare unexplained numeral"
    - "Activity Feed Row Format: full date+time stamp + exhibit-label prefix on every row, including raw STATUS_CHANGE transitions"

key-files:
  created: []
  modified:
    - src/components/shell/Header.tsx
    - src/components/command-center/DiscrepanciesPanel.tsx
    - src/components/command-center/RecentActivityPanel.tsx
    - e2e/app-shell.spec.ts
    - e2e/command-center.spec.ts

key-decisions:
  - "Header indicator reuses the SAME useDiscrepancyCount query as the sidebar pill — no second discrepancy-count query introduced"
  - "Indicator is completely absent from the DOM when openCount === 0 (common case against the fresh seed), demonstrating the 'or not rendered at all' half of the Labeled Header Indicator pattern"
  - "Activity-feed label fix is rendering-only — RecentActivityEntry already carries exhibitLabel; summarizeEvent (shared with Exhibit Detail's single-exhibit timeline) deliberately left unchanged"

patterns-established:
  - "Labeled Header Indicator pattern enforced in the one shared Header component → identical on every screen"
  - "Activity Feed Row Format pattern (date+time + exhibit-label prefix) in the Command Center feed"

# Metrics
duration: 7min
completed: 2026-10-09
---

# Phase 7 Plan 05: Shared Header Indicator + Activity Feed Format Summary

**Shared, labeled `⚠ N` header discrepancy-count indicator (reusing the existing `useDiscrepancyCount` query, omitted entirely when zero) plus Recent Activity rows that now render a full date+time stamp and their exhibit label.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-10-09T01:03:38Z
- **Completed:** 2026-10-09T01:11:08Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Net-new labeled header discrepancy-count indicator in the one shared `Header` component — `⚠ N` with a visible `aria-label="N open discrepancies"`, navigating to `/command-center#discrepancies` on click, and **completely absent from the DOM** when the open count is zero (never a bare, unexplained numeral).
- Wired the `#discrepancies` link target by adding `id="discrepancies"` to the Discrepancies panel's root Tile.
- Fixed the Command Center Recent Activity feed: every row now shows a full **date+time** (`toLocaleString` with year/month/day/hour/minute) instead of a time-only stamp, and is **prefixed with its exhibit label** (em-dash separator), attributing even raw `STATUS_CHANGE` rows to an exhibit.
- Confirmed `Timeline.tsx` already renders date+time (`toLocaleString()` with no options) — left unmodified as the plan specified.

## Task Commits

1. **Task 1: Labeled header discrepancy-count indicator** — `e2adbff` (feat)
2. **Task 2: Activity feed date+time and exhibit-label fix** — `3a896cf` (fix)

## Files Created/Modified
- `src/components/shell/Header.tsx` - Added the shared `⚠ N` indicator (ghost Button) sourced from `useDiscrepancyCount`, rendered only when `openCount > 0`, with `aria-label`/`title` "{N} open discrepancies" and router navigation to `/command-center#discrepancies`.
- `src/components/command-center/DiscrepanciesPanel.tsx` - Added `id="discrepancies"` to the root Tile so the header indicator's fragment link resolves.
- `src/components/command-center/RecentActivityPanel.tsx` - `formatTime` now renders date+time; each row's summary span is prefixed with `e.exhibitLabel`.
- `e2e/app-shell.spec.ts` - Two new tests: indicator absent at zero count (default seed); indicator labeled + navigates on click when count is forced nonzero via route mock.
- `e2e/command-center.spec.ts` - New test asserting every Recent Activity row has a 4-digit year (full date+time) and a `[PDS]-N` exhibit-label prefix.

## Decisions Made
- Reuse the existing `useDiscrepancyCount` hook in the Header rather than issuing a second discrepancy-count query — the key-link contract (`JuryPackageNavItem` already consumes the same `openCount`) is preserved, so the header and sidebar can never disagree.
- Keep the two-span (summary + time) row structure in the activity feed; the exhibit label is prepended into the summary span only, so existing styling/layout is undisturbed.
- Left `src/services/history.ts#summarizeEvent` untouched — it is shared with Exhibit Detail's single-exhibit timeline where omitting the exhibit label is correct (the exhibit is unambiguous from page context). This was a panel-template rendering change only.

## Deviations from Plan

None - plan executed exactly as written.

The plan's two auto tasks were implemented verbatim (hook reuse, DOM-absence-when-zero, `#discrepancies` anchor, date+time + label prefix). No bugs, missing critical functionality, or blocking issues were introduced by this plan's own changes, so no deviation rules fired.

---

**Total deviations:** 0.
**Impact on plan:** None — both tasks landed as specified with their acceptance Playwright suites fully green.

## Known Stubs

None found. A stub scan of all five changed files (`TODO|FIXME|placeholder|not.?implemented|coming soon`) returned only a pre-existing prose comment ("no longer any disabled placeholder") in `e2e/app-shell.spec.ts`, not an implementation stub.

## Issues Encountered

- **Shared-working-tree concurrency (the RECURRING HAZARD from STATE.md), observed again.** During this plan's acceptance gate, a full-project `npx tsc --noEmit` reported errors in files owned by **sibling wave-1 plans editing the same working tree concurrently** — `src/components/case/ExhibitTable.tsx(90,10): TS1005` (07-03/07-04 "clickable rows") and `src/data/seed.ts(194,11): TS2304 'sleep'` (07-02 seed rewrite) — which appeared and disappeared between consecutive tsc runs. This plan's own three changed source files are tsc-clean in isolation (grep of tsc output for those paths returns zero matches), and by the time the plan-level build ran, the tree had converged: **`npx next build` finished `EXIT=0`** with all routes compiled, including `/command-center` and `/case`. The transient out-of-scope errors are logged to `deferred-items.md` and left to their owning plans / the merged-HEAD acceptance.
- **Stale production app vs. live source (test-harness detail).** The sandbox's docker `project-app-1` runs `next start` from the image-build-time bundle, which does not reflect live source edits; Playwright's `reuseExistingServer` was reusing it. Stopping the stale container let Playwright's own `webServer` start `next dev` on :3000 from live source. The DB container (`project-db-1`, healthy on :5432) was never touched. First-run cold-compile races (empty `/api/case`, a `/exhibit/:id` first-navigation exceeding the 5s click→URL timeout) cleared on a warm re-run.

## Self-Check

- **Created files exist:** n/a (no new source files; SUMMARY.md written).
- **Commits exist:** `e2adbff` (Task 1), `3a896cf` (Task 2) — both present in `git log`.
- **Plan-level build:** `npx next build` → exit 0 (all routes compiled).
- **Acceptance suites:** `e2e/app-shell.spec.ts` 8/8 green (incl. both new indicator tests); `e2e/command-center.spec.ts` 8/8 green (incl. new row-format test).
- **Known Stubs:** none blocking.

## Next Phase Readiness
- F15 header-indicator (item 3), activity-feed date+time (item 4), and activity-feed exhibit-label (item 5) are complete and verified.
- Remaining Phase 7 F15 items (admission-over-open-objection/missing-custody gates, assistant example labels, ex-parte→jury gap) are handled by sibling plans in this phase.
- Recommend per-plan git worktrees or serialized intra-phase execution to eliminate the recurring shared-working-tree tsc interleaving noted above.

---
*Phase: 07-fix-admission-integrity-and-ui-usability-issues*
*Completed: 2026-10-09*
