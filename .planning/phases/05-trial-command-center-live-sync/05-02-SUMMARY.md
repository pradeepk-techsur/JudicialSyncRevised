---
phase: 05-trial-command-center-live-sync
plan: 02
subsystem: ui
tags: [react-query, tanstack-query, live-sync, polling, hooks, freshness, zustand]

# Dependency graph
requires:
  - phase: 05-01
    provides: "GET /api/cases/:id/activity route + RecentActivityEntry type (src/services/activity.ts)"
  - phase: 03-jury-package-discrepancy-detection
    provides: "GET /api/cases/:id/discrepancies route + DiscrepancyFlag Prisma model (hard dependency — hooks build against the real contract, not a stub)"
provides:
  - "Global refetchOnWindowFocus:true on the shared QueryClient (backgrounded tabs catch up on focus; hidden tabs pause via react-query default)"
  - "useRecentActivity — react-query hook over GET /api/cases/:id/activity, key ['activity', caseId, role], 4s poll"
  - "useUnresolvedObjections — hook over GET /api/cases/:id/objections?status=unresolved, key ['objections', caseId, role], 4s poll"
  - "useDiscrepancies — hook over GET /api/cases/:id/discrepancies, key ['discrepancies', caseId, role], 4s poll"
  - "useFreshness(dataUpdatedAt, isFetching) — seconds-since-last-success ticker for the '🕐 updated Xs ago' indicator"
affects: [05-03, command-center-ui, live-sync, criterion-2]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Three INDEPENDENT live-sync queries = three separate hook files / separate useQuery instances so one panel erroring or refetching never blocks the others"
    - "role in the query key (T-05-06) forces an immediate fresh server-enforced fetch on a role switch — never a stale cross-role cache hit"
    - "Global refetchOnWindowFocus with refetchIntervalInBackground left default (false) = pause-while-hidden + catch-up-on-focus, zero custom visibilitychange code"
    - "useFreshness driven by react-query dataUpdatedAt (advances only on success) so staleness is reported honestly across failed polls"

key-files:
  created:
    - src/hooks/useRecentActivity.ts
    - src/hooks/useUnresolvedObjections.ts
    - src/hooks/useDiscrepancies.ts
    - src/hooks/useFreshness.ts
  modified:
    - src/app/providers.tsx

key-decisions:
  - "refetchIntervalInBackground left at react-query's default (false) — pause-while-hidden is the default, so no custom document.visibilitychange code is needed; refetchOnWindowFocus:true handles catch-up"
  - "useFreshness kept pure/standalone (takes dataUpdatedAt+isFetching, not a query) so 05-03 can drive it from whichever query is the screen's freshness anchor (useRecentActivity)"
  - "Hooks type over the plan-prescribed shapes (RecentActivityEntry[] / ObjectionCurrentState[] / DiscrepancyFlag[]) at the res.json() boundary, matching the established useExhibitList pattern; wire-level date serialization is not re-typed (consistent with the whole hook layer)"

patterns-established:
  - "Independent-queries live-sync: one hook per panel, each its own useQuery, each role-keyed @4s"
  - "Freshness primitive decoupled from any specific query"

# Metrics
duration: 7 min
completed: 2026-10-07
---

# Phase 5 Plan 02: Command Center Live-Sync Hooks Summary

**Finalized the polling-based live-sync model (global refetch-on-focus, pause-while-hidden) and shipped the three independent role-keyed Command Center query hooks plus a `useFreshness` ticker — the pure client-data layer the 05-03 UI renders.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-10-07T21:14:00Z
- **Completed:** 2026-10-07T21:21:00Z
- **Tasks:** 2
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments
- Enabled `refetchOnWindowFocus: true` globally on the shared QueryClient — returning to a backgrounded tab now catches up without a manual refresh (criterion 2, multi-tab demo), while `refetchIntervalInBackground` left at its default (`false`) keeps hidden tabs paused with no custom visibility code.
- Shipped three INDEPENDENT Command Center hooks — `useRecentActivity`, `useUnresolvedObjections`, `useDiscrepancies` — each its own file / own `useQuery`, each keyed `[<domain>, caseId, role]`, each `refetchInterval: 4_000`, each fetching via `apiFetch` (attaches `X-User-Role`). A failure/refetch in one never blocks the others, and a role switch forces an immediate fresh server-enforced query (T-05-06).
- Added `useFreshness(dataUpdatedAt, isFetching)` — converts react-query's `dataUpdatedAt` (advances only on a SUCCESSFUL fetch) into a live-counting `secondsAgo` (null before first success, resets on each success, climbs on a failed poll) for the "🕐 updated Xs ago" indicator.

## Task Commits

Each task was committed atomically:

1. **Task 1: Global refetchOnWindowFocus + useFreshness** - `9159964` (feat)
2. **Task 2: Three independent Command Center polling hooks** - `2ea9ad4` (feat)

**Plan metadata:** (docs: complete plan — this commit)

## Files Created/Modified
- `src/app/providers.tsx` - Added `refetchOnWindowFocus: true` to the QueryClient `defaultOptions.queries` (staleTime 2_000 + existing comment preserved; background interval deliberately left default).
- `src/hooks/useFreshness.ts` - Pure, query-agnostic seconds-since-last-success ticker → `{ secondsAgo, isFetching }`, ticks once/second.
- `src/hooks/useRecentActivity.ts` - react-query hook over 05-01's `GET /api/cases/:id/activity` → `RecentActivityEntry[]`, key `['activity', caseId, role]`.
- `src/hooks/useUnresolvedObjections.ts` - hook over `GET /api/cases/:id/objections?status=unresolved` → `ObjectionCurrentState[]`, key `['objections', caseId, role]`.
- `src/hooks/useDiscrepancies.ts` - hook over Phase 3's `GET /api/cases/:id/discrepancies` → `DiscrepancyFlag[]`, key `['discrepancies', caseId, role]`.

## Decisions Made
- **`refetchIntervalInBackground` left at default (false):** pause-while-hidden is react-query's out-of-the-box behavior; combined with `refetchOnWindowFocus: true` it satisfies the CONTEXT requirement (pause on hide, catch up on focus) with zero custom `visibilitychange` code.
- **`useFreshness` kept standalone:** it takes `dataUpdatedAt`/`isFetching` rather than a specific query, so 05-03 can anchor it to `useRecentActivity` (or any query) without coupling the primitive to one panel.
- **Hooks type at the `res.json()` boundary** over the plan-prescribed shapes, matching the existing `useExhibitList` convention (wire-level date serialization not re-typed).

## Deviations from Plan

None - plan executed exactly as written. (Phase 3 artifacts `DiscrepancyFlag` and `GET /api/cases/:id/discrepancies` were confirmed present before Task 2, so the intended hard dependency compiled with no stub needed.)

## Known Stubs

None found - all four hooks and the provider change are complete, real implementations.

## Issues Encountered
None.

## Cross-Plan Handoffs (05-03 MUST honor)
1. **Objections route role wiring:** `src/app/api/cases/[id]/objections/route.ts` still calls `getUnresolvedObjections(caseId)` with no role (viewer-independent). For the Objections panel to be sealed-safe, 05-03 must update the route to pass `parseRequestingRole(request)` (05-01 made the service's role param optional for exactly this).
2. **Sealed-discrepancy filter:** Phase 3's `/discrepancies` route is viewer-independent (backs the jury count). `useDiscrepancies` fetches it verbatim and role-keys only; 05-03's Discrepancies panel must apply the sealed filter (drop flags whose exhibit the role can't view) so sealed discrepancies stay absent from the panel (T-05-07).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Live-sync data layer complete and verified (tsc clean, full vitest suite 195 passed | 3 skipped, `next build` clean).
- Ready for 05-03 (Command Center UI + Objections/Discrepancies panels) — consumes these four hooks and owns the two sealed-safety handoffs above.

---
*Phase: 05-trial-command-center-live-sync*
*Completed: 2026-10-07*

## Self-Check: PASSED
- src/app/providers.tsx — FOUND (modified, refetchOnWindowFocus:true)
- src/hooks/useFreshness.ts — FOUND
- src/hooks/useRecentActivity.ts — FOUND
- src/hooks/useUnresolvedObjections.ts — FOUND
- src/hooks/useDiscrepancies.ts — FOUND
- Commit 9159964 — FOUND
- Commit 2ea9ad4 — FOUND
- Build check: `npm run build` (next build) → exit 0
- Full suite: `npx vitest run` → 195 passed | 3 skipped
- Known Stubs: none, no blocking stubs
