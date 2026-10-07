---
phase: 05-trial-command-center-live-sync
plan: 03
subsystem: ui
tags: [react-query, next, command-center, live-sync, playwright, sealed-visibility]

# Dependency graph
requires:
  - phase: 05-01
    provides: getRecentActivity + /activity route; role-optional getUnresolvedObjections; shared summarizeEvent
  - phase: 05-02
    provides: useRecentActivity / useUnresolvedObjections / useDiscrepancies (three independent 4s role-keyed hooks) + useFreshness + global refetchOnWindowFocus
  - phase: 03
    provides: GET /api/cases/:id/discrepancies (DiscrepancyFlag[]) + ruleLabel + /jury-package screen & GET
  - phase: 04
    provides: /exhibit/:id?event= deep-link (scroll+highlight); global Ask✦ + Assistant nav
provides:
  - F8 Trial Command Center screen (/command-center) — ambient, zero-config, strictly read-only, default landing
  - Three ambient panels (RecentActivity full-width, Objections, Discrepancies) with independent loading/empty/error states
  - FreshnessIndicator formatting useFreshness
  - Sealed-safe Objections panel (objections route now passes parseRequestingRole)
  - Sealed-filtered Discrepancies panel (intersection with role-visible exhibit set)
  - Command Center as first/live sidebar nav item + / → /command-center redirect
affects: [milestone-completion]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Panel owns one hook (three independent queries); page passes the single useRecentActivity instance into the feed panel so feed + freshness share one query"
    - "Sealed filtering by COMPOSITION of two already-role-scoped server reads (flags ∩ role-visible exhibit set), never screen-local status derivation"
    - "Live-sync hooks set retry:false so a failed poll surfaces its independent inline error promptly; the 4s interval re-attempts on recovery"
    - "New-row fade-in via a useRef<Set> of previously-seen eventIds + a transient ~400ms highlight class, keyed by eventId (no re-sort/toast)"

key-files:
  created:
    - src/app/command-center/page.tsx
    - src/components/command-center/RecentActivityPanel.tsx
    - src/components/command-center/ObjectionsPanel.tsx
    - src/components/command-center/DiscrepanciesPanel.tsx
    - src/components/command-center/FreshnessIndicator.tsx
    - e2e/command-center.spec.ts
  modified:
    - src/app/api/cases/[id]/objections/route.ts
    - src/components/shell/Sidebar.tsx
    - src/app/page.tsx
    - src/hooks/useRecentActivity.ts
    - src/hooks/useUnresolvedObjections.ts
    - src/hooks/useDiscrepancies.ts
    - e2e/app-shell.spec.ts

key-decisions:
  - "Page owns the single useRecentActivity instance and passes it to RecentActivityPanel so the feed and the freshness indicator share ONE query (no duplicate activity fetch)"
  - "Discrepancies sealed filtering = intersection of Phase-3's viewer-independent flags with useExhibitList's role-visible (server-sealed-filtered) exhibit set — composition of two sealed-correct reads, so sealed flags are absent AND uncounted"
  - "Discrepancy-row routing reads GET /api/cases/:id/jury-package once (role-governed, read-only); a non-null juryPackage routes rows to /jury-package, else /exhibit/:id; any error defaults to Exhibit Detail"
  - "Live-sync hooks set retry:false (added in 05-03) so a failed poll shows the panel's independent inline error promptly instead of a multi-second skeleton through react-query's default 3× backoff"
  - "Command Center activated as the FIRST live sidebar link; the placeholder array removed entirely; Jury Package/Assistant preserved"

patterns-established:
  - "Command Center panels are strictly read-only: only next/link link-throughs + a read-only refetch retry — no form/input/mutation anywhere"

# Metrics
duration: 9min
completed: 2026-10-07
---

# Phase 5 Plan 03: Trial Command Center Screen Summary

**Shipped F8 — the ambient, zero-config, strictly read-only Command Center at /command-center (default landing) composing three independent live-sync panels (full-width Recent Activity over a two-column Objections/Discrepancies row) with a freshness indicator, link-through-only navigation, sealed absence across all panels, and a Playwright suite proving all three ROADMAP criteria including the multi-tab live-update.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-10-07T21:23:52Z
- **Completed:** 2026-10-07T21:33:07Z
- **Tasks:** 3
- **Files modified:** 13 (6 created, 7 modified)

## Accomplishments
- /command-center screen: Recent Activity (full-width, newest-first, scrollable, ~400ms fade-in on new top rows), Unresolved Objections, and Discrepancies (warning-amber + across-the-room count badge), each over its own hook with INDEPENDENT loading/empty/error states.
- Criterion 1: opens with zero config showing all three populated panels + freshness; default landing (/ redirects) and first sidebar item.
- Criterion 2: a status event recorded via a second request appears on an already-open tab within one 4s interval with no reload (proven in E2E).
- Criterion 3: the screen exposes no record/edit/acknowledge path — link-through only (no form/input/textarea, no mutation controls; proven in E2E).
- Sealed exhibits absent from all three panels + counts for roles without sealed visibility: Objections route now role-scoped; Discrepancies panel intersects flags with the role-visible exhibit set.

## Task Commits

1. **Task 1: Three panels + freshness indicator + role-scoped objections route** - `d853e5f` (feat)
2. **Task 2: /command-center page + sidebar activation + landing redirect** - `d61866e` (feat)
3. **Task 3: Playwright E2E + live-sync error surfacing + stale-assertion fixes** - `8ad336c` (test)

## Files Created/Modified
- `src/app/command-center/page.tsx` - Composes the ambient layout; owns the single useRecentActivity instance shared with the feed + freshness.
- `src/components/command-center/RecentActivityPanel.tsx` - Full-width newest-first scrollable feed; verbatim 05-01 summary + time; ~400ms fade-in; deep-link to /exhibit/:id?event=<eventId>.
- `src/components/command-center/ObjectionsPanel.tsx` - Count + list, "all clear" empty, link to /exhibit/:id.
- `src/components/command-center/DiscrepanciesPanel.tsx` - Sealed-filtered flags, warning-amber header + count badge, plain-language rule text, jury-package-vs-exhibit row routing.
- `src/components/command-center/FreshnessIndicator.tsx` - Formats useFreshness (updated Xs ago / updating…).
- `src/app/api/cases/[id]/objections/route.ts` - Now passes parseRequestingRole → sealed-safe Objections panel.
- `src/components/shell/Sidebar.tsx` - Command Center first/live; placeholder removed; Jury Package/Assistant preserved.
- `src/app/page.tsx` - redirect('/command-center').
- `src/hooks/useRecentActivity.ts`, `useUnresolvedObjections.ts`, `useDiscrepancies.ts` - Added retry:false for prompt per-panel error surfacing.
- `e2e/command-center.spec.ts` - 7 tests across all criteria + sealed/error-isolation/link-through.
- `e2e/app-shell.spec.ts` - Updated stale assertions for the new landing + first-live Command Center nav.

## Decisions Made
- **Single useRecentActivity instance:** the page instantiates the activity query once and passes the `UseQueryResult` into RecentActivityPanel, so the feed and the freshness indicator never run duplicate queries.
- **Sealed discrepancy filtering by composition:** Phase 3's `/discrepancies` is viewer-independent (it backs the jury count), so the panel intersects its flags with `useExhibitList({})`'s role-visible (server-sealed-filtered) exhibit set. Both inputs are sealed-correct server reads; the panel derives no state — it only drops rows for exhibits the role cannot see, so sealed discrepancies are never shown AND never counted.
- **Discrepancy-row routing:** reads `GET /api/cases/:id/jury-package` once (role-governed, read-only); a non-null `juryPackage` routes rows to `/jury-package`, otherwise `/exhibit/:id`; any error/unavailability defaults to Exhibit Detail (never blocks the panel).
- **Objections route role-pass:** 05-01 made the service's role param optional; wiring `parseRequestingRole(request)` here activates sealed exclusion for this consumer (threat T-05-08).
- **Fade-in mechanism:** a `useRef<Set<string>>` of previously-seen eventIds; on each render, eventIds not in the prior set get a transient `bg-amber-50` highlight removed ~400ms later (matches Phase 4's Timeline highlight). Rows keyed by eventId so react-query updates in place — no re-sort/flash, no toast/banner.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Live-sync hooks retry on a failed poll, delaying the independent inline error**
- **Found during:** Task 3 (per-panel error-isolation E2E)
- **Issue:** The 05-02 hooks inherited react-query's default `retry: 3` with exponential backoff. When a panel's poll 500s, the panel sat in its loading skeleton for several seconds before its independent error state could render — defeating the "one panel's error shows its own inline error promptly and never blanks the others" guarantee, and making the error-isolation test flaky/failing (>5s to surface).
- **Fix:** Set `retry: false` on `useRecentActivity`, `useUnresolvedObjections`, and `useDiscrepancies`. A failed poll now surfaces the panel's inline error immediately; the existing 4s `refetchInterval` re-attempts the fetch on recovery, so this is strictly better live-sync behavior.
- **Files modified:** src/hooks/useRecentActivity.ts, src/hooks/useUnresolvedObjections.ts, src/hooks/useDiscrepancies.ts
- **Verification:** The discrepancies-500 E2E now shows the inline error within the default timeout while the other two panels still render; full suite green.
- **Committed in:** 8ad336c (Task 3 commit)

**2. [Rule 1 - Bug] Stale app-shell E2E assertions encoded pre-Phase-5 behavior**
- **Found during:** Task 3 (full-suite non-regression run)
- **Issue:** `e2e/app-shell.spec.ts` asserted `home redirects to /case` and `Command Center [is] the sole disabled placeholder` — both intentionally changed by this plan (new default landing + Command Center activation). Same class of change 04-05 already handled for the nav.
- **Fix:** Updated the two tests to assert `/command-center` redirect and Command Center as the first live nav link, while still verifying Case Workspace / Jury Package / Assistant survive (non-regression).
- **Files modified:** e2e/app-shell.spec.ts
- **Verification:** Both tests pass; full 36-test suite green.
- **Committed in:** 8ad336c (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 bug).
**Impact on plan:** Both necessary for correctness/the error-isolation criterion and for keeping the suite honest about intentionally-changed behavior. No scope creep.

## Issues Encountered
- **Seed mutation from the multi-tab write (resolved):** the multi-tab live-update test records one real ledger event. An initial version picked the first transitionable exhibit (P-1), mutating a status other suites assert on and failing case-workspace/exhibit-detail/assistant. Fixed by pinning the write to **P-5** (referenced by no other spec), computing its valid next transition dynamically, and `test.skip`-ing if it has already advanced. Re-seeded afterward to leave the demo clean. Full suite green.
- The stale production app container on :3000 served pre-05-03 code; stopped it so Playwright's dev server (current code, host-reachable DB) drove the suite, then restarted it.

## Known Stubs
None found. (The only `placeholder` match in changed files is a Sidebar comment noting there is no remaining placeholder.)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- F8 complete end-to-end; all three ROADMAP criteria proven by Playwright (including the multi-tab live-update and the read-only assertion). This is the final plan of the final phase — the milestone's Command Center work is done.
- Full E2E suite (36 tests) green; `npx tsc --noEmit` and `npx next build` clean.

## Self-Check: PASSED

- All 6 created files exist on disk.
- All 3 task commits present (d853e5f, d61866e, 8ad336c).
- Plan-level build ran and passed: `npx next build` → exit 0.
- `## Known Stubs` present; no blocking stubs.
- Full E2E suite (36 tests) green; `npx tsc --noEmit` clean.

---
*Phase: 05-trial-command-center-live-sync*
*Completed: 2026-10-07*
