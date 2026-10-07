---
phase: 02-core-screens
plan: 05
subsystem: ui
tags: [zustand, react, nextjs, app-shell, status-badge, playwright, accessibility, role-switcher]

# Dependency graph
requires:
  - phase: 02-01
    provides: src/app/providers.tsx (QueryClientProvider), zustand + @playwright/test tooling
  - phase: 02-03
    provides: GET /api/case (caseId + 6-persona roster) + DEMO_CASE_NUMBER seed
provides:
  - "useRoleStore — client-side session holding active persona/role/caseId, hydrate + setActiveUser"
  - "apiFetch — fetch wrapper attaching X-User-Role from the store to every request"
  - "StatusBadge — one shared dot+label+aria-label component for every ExhibitStatus plus null"
  - "AppShell (Header + Sidebar) wrapping every page via the root layout"
  - "/ redirects to /case; minimal /case route rendering inside the shell"
affects: [02-06, 02-07, F4, F9, F10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Client-side session as a zustand store read via getState() from non-component contexts (apiFetch)"
    - "Role threaded into every request as a plain X-User-Role header (no cookie/session infra)"
    - "Status conveyed by text label + aria-label, never color alone (decorative dot is aria-hidden)"
    - "Not-yet-built nav items render as aria-disabled <span>, never <Link> — no dead links by construction"

key-files:
  created:
    - src/stores/roleStore.ts
    - src/lib/apiClient.ts
    - src/components/StatusBadge.tsx
    - src/components/shell/Header.tsx
    - src/components/shell/Sidebar.tsx
    - src/components/shell/AppShell.tsx
    - src/app/case/page.tsx
    - e2e/app-shell.spec.ts
  modified:
    - src/app/layout.tsx
    - src/app/page.tsx

key-decisions:
  - "Role switcher uses a native <select> (keyboard/SR-accessible out of the box) rather than Radix/shadcn Select (portal-rendered options complicate the test)"
  - "Store defaults role to JUDGE until GET /api/case hydrates, avoiding a flash of an artificially-restricted view"
  - "UI behavior verified end-to-end via Playwright; no jsdom/testing-library added this phase (vitest stays environment:node for the API suites)"

patterns-established:
  - "AppShell is the single mount point — 02-06/02-07 render inside it and cannot diverge on shell chrome"
  - "StatusBadge is the single status representation — both screens import it identically (US-1.2 structural guarantee)"

# Metrics
duration: 5 min
completed: 2026-10-07
---

# Phase 2 Plan 05: App Shell + Role Store + StatusBadge Summary

**Persistent app shell (header with case label + native-select role switcher + disabled Ask button; sidebar with one live link and three aria-disabled placeholders) plus a zustand role "session" and an `apiFetch` wrapper that threads `X-User-Role` into every request, with a shared `StatusBadge` both upcoming screens reuse identically.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-10-07T08:14:18Z
- **Completed:** 2026-10-07T08:18:53Z
- **Tasks:** 3
- **Files modified:** 10 (8 created, 2 modified)

## Accomplishments
- `useRoleStore` client-side session (active persona/role/caseId, `hydrate` + `setActiveUser`), defaulting to JUDGE until the one-time `GET /api/case` bootstrap resolves
- `apiFetch` attaches the active role as an `X-User-Role` header to every call, read via `getState()` so it works from react-query query functions
- `StatusBadge` — one shared dot+label+aria-label mapping for all six `ExhibitStatus` values plus the null (not-yet-entered) case; status never conveyed by color alone
- `AppShell` (Header + Sidebar) wraps every page via the root layout inside `Providers`; `/` redirects to `/case`; `/case` is a real (minimal) route 02-06 will fill in
- `e2e/app-shell.spec.ts`: 6 passing specs covering redirect, seeded case label, JUDGE default, 6-persona roster + role switching, disabled Ask button, disabled nav placeholders, and `nav`/`main` landmarks

## Task Commits

Each task was committed atomically:

1. **Task 1: Role store + apiFetch wrapper** - `9394032` (feat)
2. **Task 2: StatusBadge + app shell, wired into root layout** - `f87155e` (feat)
3. **Task 3: App shell Playwright spec (+ drop smoke spec)** - `73efe96` (test)

**Plan metadata:** (docs: complete plan — this commit)

## Files Created/Modified
- `src/stores/roleStore.ts` - zustand store: active persona/role/caseId, `hydrate`, `setActiveUser`
- `src/lib/apiClient.ts` - `apiFetch` wrapper injecting `X-User-Role` from the store
- `src/components/StatusBadge.tsx` - shared status dot+label+aria-label, all statuses + null
- `src/components/shell/Header.tsx` - case label, hydrating role switcher (native `<select>`), disabled Ask button
- `src/components/shell/Sidebar.tsx` - Case Workspace live `<Link>` + three aria-disabled placeholders
- `src/components/shell/AppShell.tsx` - Header + Sidebar + `<main>` wrapper
- `src/app/layout.tsx` - nests `AppShell` inside `Providers`
- `src/app/page.tsx` - redirects `/` → `/case`
- `src/app/case/page.tsx` - minimal placeholder so the shell is testable now (02-06 fills it in)
- `e2e/app-shell.spec.ts` - full shell-chrome Playwright coverage

## Decisions Made
- Native `<select>` for the role switcher (fully keyboard/SR-accessible, simple to test) over the portal-rendering shadcn/Radix `Select`; the richer shadcn primitives stay for the two screens' filter controls
- Store defaults role to JUDGE pre-hydration to avoid a flash of a restricted view
- UI verified end-to-end via Playwright; no jsdom/testing-library added (vitest stays `environment: node` for the 02-02/03/04 API suites)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Role-switcher spec raced the async roster hydration**
- **Found during:** Task 3 (Playwright spec)
- **Issue:** The "lists all 6 personas" test read `select.locator('option').allTextContents()` immediately after `goto`, before the shell's one-time `GET /api/case` bootstrap populated the store and rendered the `<option>`s → received 0 options. (The adjacent tests passed only because they first awaited a `toBeVisible()` that incidentally gave hydration time.)
- **Fix:** Added a web-first retrying assertion `await expect(select.locator('option')).toHaveCount(6)` before reading option text, so the spec deterministically waits for hydration.
- **Files modified:** e2e/app-shell.spec.ts
- **Verification:** `npx playwright test e2e/app-shell.spec.ts --workers=1` → 6 passed
- **Committed in:** `73efe96` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — flaky test timing)
**Impact on plan:** Fix was necessary for a deterministic spec; no scope creep. Shell implementation itself matched the plan exactly.

## Known Stubs
- `src/app/case/page.tsx` — intentional minimal placeholder ("Loading exhibit list…"), explicitly scoped by the plan for 02-06 to replace with the real table/search UI. **Cosmetic, not blocking** — the shell's objective (header/sidebar/role-switcher/StatusBadge/apiFetch) is fully implemented and verified.
- `Sidebar.tsx` "(soon)" placeholders — intentional, planned disabled-nav design (threat T-02-12 mitigation), not stubs.

## Issues Encountered
- **Shared-working-tree collision with parallel plan 02-04.** A stale `next start`/`next-server` from a prior run was holding port 3000 and serving the old build, so Playwright's `reuseExistingServer` ran specs against pre-shell content (all 6 failed on first run). Resolved by killing the stale server (freeing 3000) so Playwright booted a fresh `next dev` — all specs then passed.
- During Task 3's commit, the peer 02-04 executor was concurrently committing and resetting HEAD in the same tree; an in-flight `git commit` briefly swept my e2e spec into a peer-labeled commit that was then reset away. Recovered cleanly: re-staged **only** this plan's two e2e files by path and re-committed as `73efe96`. All of this plan's Task 1/Task 2 commits (`9394032`, `f87155e`) and the layout/page edits remained intact in HEAD throughout; no peer files were committed under this plan and none were reverted. Reinforces STATE.md's standing recommendation for per-plan git worktrees or serialized intra-phase execution.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The shell, `useRoleStore`, `apiFetch`, and `StatusBadge` are all in place and verified — plan 02-06 (Case Workspace) and 02-07 (Exhibit Detail View) can mount inside `AppShell`, import `StatusBadge`, and fetch role-aware data via `apiFetch` with no further foundation work.
- Final `npm run build` passes against current HEAD (which includes peer 02-04's merged `searchExhibits`/`ExhibitListRow` work).
- Ready for 02-06.

---
*Phase: 02-core-screens*
*Completed: 2026-10-07*

## Self-Check: PASSED

- All 8 key created files present on disk
- All 3 task commits present in history (9394032, f87155e, 73efe96)
- `npm run build` → exit 0 (against current HEAD incl. peer 02-04 work)
- `npx playwright test e2e/app-shell.spec.ts` → 6/6 passed
- `## Known Stubs` section present; no blocking stubs
