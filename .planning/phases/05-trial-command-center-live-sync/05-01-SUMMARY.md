---
phase: 05-trial-command-center-live-sync
plan: 01
subsystem: api
tags: [command-center, activity-feed, sealed-visibility, event-ledger, nextjs, prisma, vitest]

# Dependency graph
requires:
  - phase: 01-data-foundation
    provides: ExhibitEvent ledger, recordEvent writer, summarizeEvent (was private) in history.ts
  - phase: 02-core-screens
    provides: visibility.ts (canViewSealed, parseRequestingRole), thin-route + errorResponse pattern
  - phase: 01-data-foundation
    provides: getUnresolvedObjections (case-wide shared query)
provides:
  - "summarizeEvent exported from history.ts (shared summarizer for Command Center + Exhibit Detail)"
  - "getRecentActivity(caseId, {since?, role}) + RecentActivityEntry — read-only Recent Activity feed (F8)"
  - "GET /api/cases/:id/activity route (200 RecentActivityEntry[] | 422 VALIDATION_ERROR | 500 COMMAND_CENTER_LOAD_FAILED)"
  - "CommandCenterLoadError (code COMMAND_CENTER_LOAD_FAILED, 500)"
  - "getUnresolvedObjections gains optional requestingUserRole (sealed-thread exclusion)"
affects: [05-02 live-sync hooks, 05-03 Command Center UI + Objections/Discrepancies panels]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Read-only ledger-composition service reusing the single shared summarizer (no re-implemented switch) so cross-screen wording can never drift"
    - "Rolling latest-event-day default window (start-of-day of the most recent case event) so a seeded demo feed is never empty regardless of run date"
    - "Route catch split: typed AppError (incl. ValidationError 422) passes through errorResponse; any non-AppError is wrapped as a feature-specific 500"
    - "Additive optional role param widens a shared viewer-independent query into a role-scoped one without breaking existing no-arg callers"

key-files:
  created:
    - src/services/activity.ts
    - src/services/activity.test.ts
    - src/app/api/cases/[id]/activity/route.ts
    - src/app/api/cases/[id]/activity/route.test.ts
  modified:
    - src/services/history.ts
    - src/lib/errors.ts
    - src/services/objections.ts

key-decisions:
  - "summarizeEvent exported in place (not moved to a new module) — minimal, keeps it co-located with its payload interfaces and the only other caller; additive and compatible with 03-01's DISCREPANCY_ACKNOWLEDGED wording"
  - "Default activity window anchored to start-of-day of the LATEST case event (rolling anchor), never wall-clock today"
  - "getUnresolvedObjections role param is OPTIONAL so the existing case-wide /objections route (jury sidebar count) keeps its viewer-independent behavior; 05-03 passes the parsed role"
  - "Route maps typed ValidationError → 422, everything else → 500 COMMAND_CENTER_LOAD_FAILED"

patterns-established:
  - "Recent Activity feed is the SOLE data path for the Command Center — UI derives nothing; sealed exclusion is a WHERE predicate, never a post-filter"

# Metrics
duration: 5min
completed: 2026-10-07
---

# Phase 5 Plan 01: Command Center Recent-Activity Backend Summary

**Read-only `getRecentActivity` service + `GET /api/cases/:id/activity` composing the ExhibitEvent ledger through the shared `summarizeEvent`, with role-based sealed exclusion extended to `getUnresolvedObjections`.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-10-07T21:08:03Z
- **Completed:** 2026-10-07T21:12:34Z
- **Tasks:** 3
- **Files modified:** 7 (4 created, 3 modified)

## Accomplishments
- `GET /api/cases/:id/activity` returns `RecentActivityEntry[]` newest-first (exact TechArch §4.9 shape) — criterion 1 backend.
- Row summaries are byte-identical to the Exhibit Detail timeline (proven by a wording-parity test deep-equalling against `getExhibitHistory`).
- Sealed exhibit events are absent (WHERE predicate, never counted) for roles without sealed visibility; the Objections panel's underlying `getUnresolvedObjections` now excludes sealed threads when a non-sealed role is supplied.
- Default feed window is anchored to the latest-event day, so a seeded case is never empty regardless of run date.

## Task Commits

1. **Task 1: Export summarizeEvent + add CommandCenterLoadError** - `f8240bc` (feat)
2. **Task 2: getRecentActivity service + role-scoped getUnresolvedObjections** - `2acbcc0` (feat)
3. **Task 3: GET /api/cases/:id/activity route + tests** - `cba785a` (feat)

## Files Created/Modified
- `src/services/activity.ts` - `getRecentActivity` + `RecentActivityEntry`; ledger query with sealed WHERE predicate, rolling latest-event-day window, `since` validation, custody-name resolution, reuses `summarizeEvent`; zero writes.
- `src/services/activity.test.ts` - Integration tests: newest-first+shape, sealed absence by role, wording parity vs `getExhibitHistory`, `since` 422 (bad/future), latest-event-day window.
- `src/app/api/cases/[id]/activity/route.ts` - Thin GET delegation; `parseRequestingRole` + `since` passthrough; 422 ValidationError pass-through, 500 `COMMAND_CENTER_LOAD_FAILED` for any other failure.
- `src/app/api/cases/[id]/activity/route.test.ts` - Route tests: 200 shape+ordering, sealed absence (200 not 404), 422 bad/future `since`, default-window populates.
- `src/services/history.ts` - `summarizeEvent` widened from private to `export` (body + `getExhibitHistory` call unchanged).
- `src/lib/errors.ts` - Added `CommandCenterLoadError` (code `COMMAND_CENTER_LOAD_FAILED`, 500).
- `src/services/objections.ts` - `getUnresolvedObjections` gains optional `requestingUserRole`; excludes sealed-exhibit threads for non-sealed roles; no-arg behavior preserved.

## Decisions Made
- Exported `summarizeEvent` in place rather than extracting to a new module — minimal and co-located; additive over 03-01's DISCREPANCY_ACKNOWLEDGED wording.
- Rolling latest-event-day default window (not wall-clock today) so the demo is never empty.
- Optional role param on `getUnresolvedObjections` keeps the case-wide `/objections` route viewer-independent (jury sidebar count); 05-03 will pass the parsed role for the Command Center panel.
- Route catch: typed `ValidationError` → 422, any non-`AppError` → 500 `COMMAND_CENTER_LOAD_FAILED`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed project dependencies + generated Prisma client**
- **Found during:** Task 1 (verification)
- **Issue:** `node_modules` was empty in the fresh working tree — `npx tsc` and `npx vitest` could not run, blocking every task's `<verify>` step.
- **Fix:** `npm install --include=dev` (matched the committed `package-lock.json`, no lockfile change) then `npx prisma generate` to produce the client the service/test imports require.
- **Files modified:** None committed (install artifacts are gitignored; lockfile unchanged).
- **Verification:** `npx tsc --noEmit` clean; full `npx vitest run` green (195 passed, 3 skipped); `npm run build` exit 0.
- **Committed in:** N/A (environment setup, no source change)

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** Environment-only; no scope change. All plan tasks executed exactly as written.

## Known Stubs
None found — grep for TODO/FIXME/placeholder/not-implemented/coming-soon across all changed files returned nothing.

## Issues Encountered
None — all three tasks' verifications passed on first run after the dependency install.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend for F8 Recent Activity is complete and tested; 05-02 (live-sync hooks) and 05-03 (Command Center UI + Objections/Discrepancies panels) can consume `getRecentActivity`, the `/activity` route, and the role-scoped `getUnresolvedObjections`.
- Regression gates for later waves re-run: `src/services/activity.test.ts` and `src/app/api/cases/[id]/activity/route.test.ts` (plus the unchanged `objections` suite, confirmed green after the signature widening).

## Self-Check: PASSED

- All 4 created files present on disk.
- All 3 task commits present (f8240bc, 2acbcc0, cba785a).
- `npm run build` exit 0; full `npx vitest run` green (195 passed, 3 skipped).
- `## Known Stubs` section present; no blocking stubs.

---
*Phase: 05-trial-command-center-live-sync*
*Completed: 2026-10-07*
