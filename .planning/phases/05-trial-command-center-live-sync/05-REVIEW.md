---
phase: 5
status: clean
blockers: 0
warnings: 0
files_reviewed: 2
files_reviewed_list:
  - src/components/command-center/DiscrepanciesPanel.tsx
  - src/components/command-center/RecentActivityPanel.tsx
reviewed_at: 2026-10-07T22:05:00Z
iteration: 2
---

# Phase 5 Code Review

**Iteration 2 (re-review after fixes).** Iteration 1 found 0 BLOCKERs and 2
WARNINGs. Both were fixed (W1 in c03537d, W2 in 0b3e0ef); this pass read both
fixer-touched files in full, verified each fix against its original evidence,
traced for fix-introduced regressions, and ran `tsc --noEmit` (clean). Both
commits were surgical — scoped to exactly the two target files, 12 and 41 lines
respectively, touching nothing else. **Both WARNINGs are resolved and no
regression was introduced; status is now clean.**

## Re-review verification (iteration 2)

### W1 — RESOLVED (c03537d), verified
- **Fix:** `isError = discrepancies.isError || exhibitList.isError`
  (DiscrepanciesPanel.tsx:66); Retry `onClick` now refetches BOTH queries
  (:106-109).
- **Verified correct:** An exhibit-list failure now drives `isError` → the panel
  renders the `role="alert"` retry affordance (:101-115) instead of falling
  through to the `count === 0` all-clear branch (:117-119), which is gated on
  `!isError`. The original false-negative ("No open discrepancies" while flags
  exist) is closed.
- **No regression:** `isLoading` already OR'd both queries (:60), so there is no
  state where one query's error is masked by the other's loading. The error gate
  now mirrors the loading gate — symmetric and correct. The jury-package probe is
  independent and still fail-safe-defaults to Exhibit Detail. No new branch can
  leave `visibleIds` empty while rendering the success body.

### W2 — RESOLVED (0b3e0ef), verified
- **Fix:** Replaced the single-timer-per-run design with a
  `timersRef: Map<id, timeoutId>` (RecentActivityPanel.tsx:45). Each fresh id
  gets its OWN self-clearing 400ms timer that `timers.delete(id)` + removes only
  its own id (:66-81); the per-run `clearTimeout` cleanup was removed; a separate
  unmount-only effect tears down all pending timers (:91-97).
- **Verified correct:** The original trace (poll A adds X, poll B adds Y within
  400ms) no longer strands X — X's timer is independent and is never cancelled by
  B's effect run, so X's highlight clears on its own deadline. The "re-arm
  defensively" guard (:68-70) prevents duplicate timers if an id re-appears fresh.
- **No regression checked:**
  - *Unmount teardown:* the cleanup effect captures `timersRef.current` once
    (:92), but that Map reference is stable (only mutated, never reassigned), so
    `timers.values()` at unmount correctly drains whatever timers are live — no
    stale-reference leak.
  - *Self-clear safety:* each timer callback guards `if (!prev.has(id)) return prev`
    (:74) so a highlight already cleared elsewhere is a no-op; `setHighlighted`
    returns a new Set only when it actually changes.
  - *Memory:* each timer removes itself from the Map on fire (:72); the Map does
    not grow unbounded across polls.
  - *tsc --noEmit:* clean — the new `Map<string, ReturnType<typeof setTimeout>>`
    typing introduces no type error.

## BLOCKERs

None.

## WARNINGs

None remaining. Both prior WARNINGs are resolved (see verification above). The
original W1/W2 detail is retained below for the audit trail.

---

## Prior-iteration WARNINGs (resolved — retained for audit)

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
