---
phase: 09-ui-tickets-and-typography-standard
plan: 04
subsystem: ui
tags: [command-center, activity-feed, react, nextjs, carbon, playwright]

# Dependency graph
requires:
  - phase: 09-01
    provides: Command Center first-viewport rebuild (the screen that hosts the Recent Activity panel)
  - phase: 08-10
    provides: ActivityResponse `{ recentActivity, statusCounts }` shape + date-group headers + filter pills on the panel
provides:
  - Recent Activity panel with no nested scrollbox (mouse-wheel trap removed)
  - 10-row cap on the panel + a stable "View all" link to a new /activity page
  - Full, uncapped /activity history page reusing the existing activity endpoint
  - 60-second consecutive same-exhibit STATUS_CHANGE grouping (expandable merged row)
  - One seconds-precise timestamp format across every row
  - Heading day-word that always agrees with the date-group header day-word
  - Exported, reusable grouping/formatting helpers for cross-surface parity
affects: [command-center, activity, F08, F15]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cross-surface parity by shared export: /activity imports the panel's grouping + formatting helpers rather than re-implementing"
    - "Native <details>/<summary> for an expandable collapsed row (no JS, no extra state)"
    - "Reuse an existing endpoint with a hardcoded constant param (since=epoch) instead of adding a backend route"

key-files:
  created:
    - src/app/activity/page.tsx
    - src/app/activity/page.module.scss
  modified:
    - src/components/command-center/RecentActivityPanel.tsx
    - src/components/command-center/RecentActivityPanel.module.scss
    - e2e/command-center.spec.ts

key-decisions:
  - "Merged runs use a native <details> disclosure summarized as '{exhibitLabel}: N status updates' — the robust, free-text-parse-free way to satisfy 'collapse into one expandable summary row' without deriving status words from summary strings"
  - "The merged summary / hidden members do NOT carry data-testid=recent-activity-row (that testid means a top-level single row that is a visible link) — avoids counting hidden collapsed-member text as empty rows"
  - "/activity reuses GET /api/cases/:id/activity with a hardcoded since=1970-01-01 constant (no new route, no injection surface) and NO polling (historical browse, not live-sync)"
  - "Task 3 was a confirmed no-op: the F15 seed staggering (sleep(1200) between exhibits + recordedAt passthrough) is present and intact; seed.ts left untouched"

patterns-established:
  - "Export panel formatters/grouping (formatTime, dateGroupLabel, dayKey, groupConsecutiveSameExhibit, groupedRecordedAt) so a sibling surface renders identically by construction"

# Metrics
duration: 21min
completed: 2026-10-10
---

# Phase 9 Plan 04: Recent Activity Rework (T-04) Summary

**The Command Center Recent Activity feed now page-scrolls (no nested mouse-wheel trap), caps at the latest 10 units with a stable "View all" link to a new full /activity history page, collapses 60s same-exhibit status runs into one expandable row, shows one seconds-precise timestamp everywhere, and keeps the heading day-word in lockstep with the date-group header.**

## Performance

- **Duration:** 21 min
- **Started:** 2026-10-10T18:13:04Z
- **Completed:** 2026-10-10T18:34:39Z
- **Tasks:** 3 (2 code, 1 no-op verification)
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments
- Removed the `.list` `max-height: 24rem; overflow-y: auto` nested scrollbox — the feed now flows with the already-scrollable `<main>` (the ticket's mouse-wheel-trap fix).
- Capped the panel at the latest 10 grouped units and added an always-present `View all →` link to a new, uncapped `/activity` page.
- Fixed the heading/date-group day-word mismatch structurally: a new `windowDayWord()` shares `dateGroupLabel`'s `dayKey`/`yesterday` comparison, fed the newest entry's `recordedAt`, so the heading can never say "today" while the date group shows a past date.
- Added 60-second consecutive same-exhibit `STATUS_CHANGE` grouping (`groupConsecutiveSameExhibit`), rendered as a native `<details>` expandable row, applied BEFORE the 10-cap and BEFORE the date-group walk.
- Extended the single shared `formatTime` with `second: '2-digit'` so every row uses one seconds-precise format.
- Built `/activity` reusing the existing endpoint + the panel's exported helpers for guaranteed parity; added 6 targeted Playwright tests.
- Confirmed the F15 seed staggering is intact (Task 3 no-op).

## Task Commits

1. **Task 1: Recent Activity panel rework** — `3a1ad7c` (feat)
2. **Task 2: Full /activity page + T-04 e2e coverage** — `f0455ab` (feat)
3. **Task 3: Seed staggering verification** — no commit (no-op: `src/data/seed.ts` confirmed unchanged)

**Plan metadata:** (docs commit, this summary + STATE.md)

## Files Created/Modified
- `src/app/activity/page.tsx` — new full, uncapped activity history page (the View all destination); reuses `GET /api/cases/:id/activity` with `since=epoch`, no polling, back link to Command Center.
- `src/app/activity/page.module.scss` — page styles mirroring the panel's row/date-group Carbon-token presentation.
- `src/components/command-center/RecentActivityPanel.tsx` — removed nested-scroll reliance, 10-cap + View all, `windowDayWord`, `groupConsecutiveSameExhibit`/`groupedRecordedAt`, seconds in `formatTime`; exported helpers for `/activity`.
- `src/components/command-center/RecentActivityPanel.module.scss` — dropped the scrollbox rule; added `.viewAll` + merged-row disclosure styles.
- `e2e/command-center.spec.ts` — 6 new T-04 tests (no nested scroll, 10-cap + View all, 60s merge/expandable, seconds format, full /activity + back link, heading/date-group day agreement).

## Decisions Made
- Merged-run row uses a native `<details>` summarized as "N status updates" + an expandable list of the original summaries — avoids fragile status-word parsing out of free-text `summary` strings while satisfying "collapse into one expandable row."
- Merged summaries / their hidden members deliberately do NOT reuse `data-testid="recent-activity-row"` (reserved for visible single-row links), so existing tests that iterate that testid never pick up hidden collapsed text.
- `/activity` reuses the existing endpoint with a hardcoded `since=1970-01-01T00:00:00.000Z` constant (no new route; no injection surface per T-09-05) and no polling (historical browse).
- Task 3 confirmed the F15 staggering (`sleep(1200)` between exhibits + `recordedAt` passthrough on interleaved events) is present and intact — `seed.ts` left untouched, per the plan's "report what needed no change" discipline.

## Deviations from Plan

None - plan executed exactly as written. (The only adjustment was a test-authoring correction within Task 2: the merged-member links were given a distinct testid rather than `recent-activity-row`, so the existing "every row shows a full date+time" test does not iterate hidden collapsed-row text — a correctness detail of the new grouping, not a deviation from the plan's instructions.)

**Total deviations:** 0 auto-fixed.
**Impact on plan:** None — all three tasks delivered as specified.

## Known Stubs
None found — the stub scan (`TODO|FIXME|placeholder|not implemented|coming soon`) over all changed files returned nothing.

## Issues Encountered
- **Shared-working-tree / shared-DB hazard (recurring, documented throughout Phase 8/9).** A sibling Phase-9 plan (09-09, later 09-06) had uncommitted files in the shared tree and concurrent vitest/seed runs against the shared `2026-CR-0142` case. Consequences and handling:
  - A one-time `git stash` (used to confirm pre-existing tsc errors on HEAD) swept sibling files; a sibling re-wrote `src/services/exhibits.test.ts` mid-stash, blocking `git stash pop`. Recovered with zero sibling work lost by saving the sibling's newer file aside, resetting, popping, and restoring. (Lesson reinforced: avoid `git stash` on a shared tree.)
  - Transient `tsc` errors in sibling-owned `ExhibitTable.tsx` / `JuryPackageChecklistCard.tsx` (`NOT_YET_EVALUATED`) appeared then cleared once the sibling committed — final `tsc --noEmit` is EXIT 0 tree-wide. Logged to `deferred-items.md` (out of scope per SCOPE BOUNDARY); only my own files were ever staged.
  - A full `command-center.spec.ts` run initially reported 4 "failures" (a `SEALED-HISTORY-<ts>` exhibit injected into the shared case by a sibling's `history.test.ts`; plus custody/quick-filter tests tied to sibling T-06 work). All passed after re-seeding in a stable window — final: **39/39 green**.
  - `seed.test.ts` flaked (5→4→2 failing across runs — a moving target, the signature of DB contention) under parallelism, then passed **8/8** single-threaded in a clean window. `seed.ts` is unchanged by this plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- T-04 (Recent Activity rework) is fully delivered and verified. Ready for the next Phase 9 ticket/plan.
- No blockers introduced. The new `/activity` route is a drill-through (reached via the panel's View all link), consistent with how `/exhibit/[id]` is not in the Sidebar.

---
*Phase: 09-ui-tickets-and-typography-standard*
*Completed: 2026-10-10*

## Self-Check: PASSED
- Created files exist: `src/app/activity/page.tsx`, `src/app/activity/page.module.scss` — FOUND.
- Task commits exist: `3a1ad7c`, `f0455ab` — FOUND.
- Plan-level build: `npm run build` → EXIT 0, `/activity` route emitted; `npx tsc --noEmit` → EXIT 0 tree-wide.
- E2E: `e2e/command-center.spec.ts` → 39/39 passed; `src/data/seed.test.ts` → 8/8 passed (isolated window).
- `## Known Stubs` present, no blocking stubs.
