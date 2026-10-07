---
phase: 5
status: issues_found
blockers: 0
warnings: 2
files_reviewed: 18
files_reviewed_list:
  - src/services/activity.ts
  - src/services/activity.test.ts
  - src/services/history.ts
  - src/services/objections.ts
  - src/app/api/cases/[id]/activity/route.ts
  - src/app/api/cases/[id]/activity/route.test.ts
  - src/app/api/cases/[id]/objections/route.ts
  - src/lib/errors.ts
  - src/app/providers.tsx
  - src/hooks/useRecentActivity.ts
  - src/hooks/useUnresolvedObjections.ts
  - src/hooks/useDiscrepancies.ts
  - src/hooks/useFreshness.ts
  - src/app/command-center/page.tsx
  - src/components/command-center/RecentActivityPanel.tsx
  - src/components/command-center/ObjectionsPanel.tsx
  - src/components/command-center/DiscrepanciesPanel.tsx
  - src/components/command-center/FreshnessIndicator.tsx
  - src/components/shell/Sidebar.tsx
  - src/app/page.tsx
  - e2e/command-center.spec.ts
  - e2e/app-shell.spec.ts
reviewed_at: 2026-10-07T21:40:20Z
iteration: 1
---

# Phase 5 Code Review

The Trial Command Center (F8) landed across its three plans cleanly. The
backend data path (`getRecentActivity`, role-scoped `getUnresolvedObjections`),
the three independent polling hooks, and the four panels are well-structured and
the cross-file seams all reconcile. No BLOCKERs: the role-scoping is a true
in-query `WHERE` predicate on every read (never a post-filter), the route error
mapping is correct, and the default-window anchor logic is sound. Two WARNINGs
below — both error-path/cosmetic, neither breaks the happy path.

## BLOCKERs

None.

## WARNINGs

### W1: Discrepancies panel shows a false "No open discrepancies" when the exhibit-list fetch fails
- **File:** src/components/command-center/DiscrepanciesPanel.tsx:55-61, 109-111
- **Category:** bug
- **Evidence:** The panel intersects the discrepancy flags against the
  role-visible exhibit set to drop sealed rows:
  `const visibleIds = new Set((exhibitList.data ?? []).map((r) => r.exhibitId));`
  then `flags = (discrepancies.data ?? []).filter((f) => visibleIds.has(f.exhibitId))`.
  But the panel's error gate is `isError = discrepancies.isError` only —
  `exhibitList.isError` is never consulted. If the `/exhibits` poll fails while
  `/discrepancies` succeeds, `exhibitList.data` is `undefined` → `visibleIds` is
  empty → **every** flag is filtered out → `count === 0` → the panel
  affirmatively renders "No open discrepancies." On the single highest-risk,
  safety-critical panel (UX: "visible from across the room"), a transient
  exhibit-endpoint failure silently paints a reassuring all-clear while genuine
  open discrepancies exist. It self-heals on the next successful 4s poll, which
  is why this is degraded rather than a BLOCKER, but the false-negative state is
  real and user-visible. (Note: the mirror case — `exhibitList` succeeds but
  `discrepancies` fails — IS handled, since `discrepancies.isError` drives the
  inline error.)
- **Fix direction:** Fold `exhibitList.isError` into the panel's `isError` (or
  into a distinct "unable to load" state) so an exhibit-list failure surfaces the
  retry affordance instead of a filtered-to-empty list. Do not let an empty
  `visibleIds` set (from a failed/absent fetch) masquerade as "no visible
  discrepancies."
- **Resolution:** fixed (c03537d) — folded `exhibitList.isError` into the panel's
  `isError` so an exhibit-list failure surfaces the retry affordance instead of a
  filtered-to-empty all-clear; retry now refetches both queries. (requires human
  verification — UI error-path, no unit test coverage for these components.)

### W2: Recent-activity row highlight can stick permanently when a second new event arrives within 400ms
- **File:** src/components/command-center/RecentActivityPanel.tsx:61-72
- **Category:** bug
- **Evidence:** The new-row fade-in effect schedules a single 400ms timer per run
  to clear exactly the ids that were fresh on that run (`fresh`), and its cleanup
  is `return () => clearTimeout(timer)`. The effect re-runs whenever the joined
  id list changes. Trace: poll A adds id X → timer_A scheduled to remove {X}.
  Before 400ms elapses, poll B adds id Y → effect re-runs, cleanup fires
  `clearTimeout(timer_A)` (so X's removal is cancelled), `fresh` is now only
  `[Y]`, and timer_B is scheduled to remove only {Y}. X was added to
  `highlighted` but its removal was cancelled and never re-scheduled → the amber
  highlight on row X persists indefinitely. Purely cosmetic (the row remains
  correct and clickable; no data impact), and only triggers under back-to-back
  new events inside one 400ms window, hence WARNING.
- **Fix direction:** Track a per-id expiry (e.g. a `Map<id, timeoutId>` or a
  single sweep interval that removes any highlight older than its deadline) so a
  later batch's cleanup does not cancel an earlier batch's pending removal.
- **Resolution:** fixed (0b3e0ef) — replaced the single-timer-per-run design with
  a `Map<id, timeoutId>` where each highlighted row owns an independent 400ms timer
  that self-clears its own id; per-run cleanup removed, timers torn down only on
  unmount, so a later batch never cancels an earlier batch's removal. (requires
  human verification — timer-race UI behavior, no unit test coverage.)

## Cross-file seams checked
- `GET /api/cases/:id/activity` → `useRecentActivity` → `RecentActivityPanel`: payload is `RecentActivityEntry[]`; panel reads `eventId/exhibitId/summary/recordedAt` — all present. OK
- `getRecentActivity` → `summarizeEvent` (now `export`ed from history.ts): same summarizer as `getExhibitHistory`; wording parity asserted in activity.test.ts. OK
- `getUnresolvedObjections(caseId, role?)` optional 2nd arg: route passes parsed role; existing callers (seed.ts, assistant tools.ts, jury sidebar) omit it → viewer-independent behavior preserved; ruling route test (no header → ATTORNEY, non-sealed exhibit) still returns the thread. OK
- `/objections` route role-scoping: sole consumer is `useUnresolvedObjections` (Command Center); no jury-count component reads `/objections` directly (count is driven by `/discrepancies`), so no regression. OK
- `useDiscrepancies` → `/api/cases/:id/discrepancies` DTO: route returns `{ id, exhibitId, ruleCode, ... }`; panel reads `f.id/f.exhibitId/f.ruleCode`. OK
- `DiscrepanciesPanel` jury-package probe → `/api/cases/:id/jury-package`: route returns `{ juryPackage, exhibits }`; panel reads `body?.juryPackage` and defaults to Exhibit Detail on any non-ok/error. OK
- `useExhibitList({})` → `ExhibitListRow.exhibitId`: field exists in lib/types.ts; intersection key matches. OK
- `CommandCenterLoadError` (errors.ts) ↔ activity route 500 mapping: `AppError` passes through (422 ValidationError preserved), everything else → `COMMAND_CENTER_LOAD_FAILED`. OK
- `parseRequestingRole` fail-closed → ATTORNEY on missing/invalid `X-User-Role`: applied uniformly by activity + objections routes. OK
- `/` redirect → `/command-center` and Sidebar first-item activation: page.tsx + Sidebar.tsx consistent; app-shell.spec.ts + command-center.spec.ts updated to match (no lingering disabled-placeholder assertion). OK
- `providers.tsx` `refetchOnWindowFocus: true` with per-query `refetchInterval: 4s`: background pausing left at react-query default; no custom visibility code required. OK
