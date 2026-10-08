---
phase: 06-carbon-design-system-ui-upgrade
plan: 03
subsystem: ui
tags: [carbon, ui-shell, react, nextjs, navigation, accessibility, sass]

# Dependency graph
requires:
  - phase: 06-01
    provides: "Carbon Sass build pipeline + globals.scss (@use '@carbon/react', White theme)"
provides:
  - "Carbon UI-Shell app chrome: AppShell + Header + Sidebar + JuryPackageNavItem rendered via Carbon Header/HeaderGlobalBar/Select and SideNav/SideNavItems/SideNavLink"
  - "Role switcher as a Carbon Select (real native <select>) with accessible name 'Switch active role'"
  - "AssistantPanel still mounted exactly once at the shell level (route-navigation-persistent thread state preserved)"
affects: [06-07, 06-08, 06-09, "all Wave 3 screen plans (render inside this shell, children contract unchanged)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Carbon Select aria-label passthrough: Carbon spreads {...other} onto the real <select>, so aria-label overrides the visible <label> text as the accessible name — keeps native-select Playwright assertions working while showing a 'Role:' label"
    - "Carbon SideNavLink as={Link}: polymorphic Link renders the nav item through Next.js <Link>, preserving client-side routing (and zustand role-store state across routes) with Carbon's cds--side-nav__link styling"
    - "Thin CSS Module for the product-required shell frame (fixed header / fixed sidebar / independently-scrolling main) offset below Carbon's fixed 3rem Header — Carbon Content grid doesn't map this shape"

key-files:
  created:
    - src/components/shell/AppShell.module.scss
  modified:
    - src/components/shell/AppShell.tsx
    - src/components/shell/Header.tsx
    - src/components/shell/Sidebar.tsx
    - src/components/shell/JuryPackageNavItem.tsx
    - src/components/assistant/MessageBubble.module.scss

key-decisions:
  - "Role switcher uses Carbon Select (NOT Dropdown): Select wraps a real native <select> so option-count/option-text/option:checked assertions pass; Dropdown is a downshift listbox and would fail them"
  - "'Ask ✦' kept as a Carbon ghost Button, not HeaderGlobalAction: HeaderGlobalAction is icon-only but app-shell.spec asserts visible text /Ask/, so a text Button preserves the label faithfully"
  - "SideNav rendered isFixedNav+expanded (always open, no rail collapse/inert) so all four links stay in the accessibility tree for landmark/link assertions"
  - "no-print applied to Header container and a wrapper div around SideNav so 06-01's print CSS still hides the chrome during Jury Package export"

patterns-established:
  - "Carbon UI Shell composition for app chrome (Header/HeaderGlobalBar + SideNav/SideNavItems/SideNavLink)"
  - "aria-label passthrough on Carbon Select to decouple visible label text from accessible name"

# Metrics
duration: 10 min
completed: 2026-10-08
---

# Phase 6 Plan 03: App Shell Carbon Migration Summary

**App shell chrome (AppShell/Header/Sidebar/JuryPackageNavItem) migrated from Tailwind flexbox to Carbon's UI Shell components — Carbon Header/HeaderGlobalBar + native Carbon Select role switcher + SideNav/SideNavLink navigation — with zero behavioral regression and all 6 app-shell.spec tests green.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-10-08T01:56:06Z
- **Completed:** 2026-10-08T02:06:33Z
- **Tasks:** 3
- **Files modified:** 5 (1 created)

## Accomplishments
- `Header` now renders via Carbon `Header`/`HeaderName`/`HeaderGlobalBar`; the role switcher is a Carbon `Select`/`SelectItem` (a real native `<select>`) whose accessible name is forced to exactly `"Switch active role"` via `aria-label` passthrough while the visible label stays `"Role:"` and option text stays `"{name} ({role})"`. The `/api/case` hydration and `no-print` are untouched.
- `Sidebar` + `JuryPackageNavItem` now render via Carbon `SideNav`/`SideNavItems`/`SideNavLink` (`as={Link}` → Next.js client-side routing preserved). Command Center stays first; all four links keep their exact accessible names/hrefs; the discrepancy-count pill is now a Carbon red `Tag`, still conditional on `openCount > 0`, keeping both testids and the `aria-label`.
- `AppShell` composes the Carbon chrome with a `role="main"` region via a thin `AppShell.module.scss` (fixed header / fixed sidebar / independently-scrolling main), with `AssistantPanel` still mounted exactly once at the shell level.
- Full `e2e/app-shell.spec.ts` suite passes (6/6): home→/command-center redirect, case number + JUDGE default, 6-persona roster + role switch, Ask ✦ opens the panel, 4 nav links (Command Center first) + nav/main landmarks. `npm run build` green.

## Task Commits

1. **Task 1: Header → Carbon UI Shell + native Select** — `3a794f1` (feat)
2. **Task 2: Sidebar + JuryPackageNavItem → Carbon SideNav** — `3d695f2` (feat)
3. **Blocking fix: MessageBubble SCSS undefined token** — `a57b9c2` (fix)
4. **Task 3: AppShell → Carbon shell composition + acceptance suite** — `1a48319` (feat)

_Note: Task 3's commit was preceded by the `a57b9c2` blocking fix, which had to land before the dev server could compile and the acceptance suite could run._

## Files Created/Modified
- `src/components/shell/Header.tsx` — Carbon Header/HeaderName/HeaderGlobalBar; role switcher as Carbon Select with aria-label passthrough; Ask ✦ as a ghost Button
- `src/components/shell/Sidebar.tsx` — Carbon SideNav/SideNavItems/SideNavLink (`as={Link}`); `no-print` wrapper; `aria-label="Main navigation"`
- `src/components/shell/JuryPackageNavItem.tsx` — Carbon SideNavLink + red Tag count pill, testids/aria-label preserved
- `src/components/shell/AppShell.tsx` — Carbon chrome composition + `role="main"`; AssistantPanel mounted once
- `src/components/shell/AppShell.module.scss` (new) — product-required fixed-header/fixed-sidebar/scrolling-main frame
- `src/components/assistant/MessageBubble.module.scss` — blocking fix: `$button-primary` → `$interactive`

## Decisions Made
See frontmatter `key-decisions`. Core: Carbon `Select` (not `Dropdown`) for native-`<select>` test compatibility; `Button` (not `HeaderGlobalAction`) for the visible-text Ask button; `SideNavLink as={Link}` to keep client-side routing; `isFixedNav+expanded` to keep links in the a11y tree.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Undefined `$button-primary` Sass token broke the shared dev-server compile**
- **Found during:** Task 3 (running the app-shell acceptance suite)
- **Issue:** `src/components/assistant/MessageBubble.module.scss` — committed by the parallel wave-2 plan **06-08** (`7be9a64`) on the same `phase-6` branch — referenced `$button-primary`, a Carbon **button component** token that `@carbon/styles/scss/theme` does not forward. Dart Sass threw `Undefined variable`, so `npm run dev` failed to compile the whole app. Because `AppShell → AssistantPanel → AssistantThread → MessageBubble` is in this plan's own render tree, the shell could not boot and 06-03's acceptance gate could not run.
- **Fix:** Replaced `$button-primary` with `$interactive` (the theme-exported interactive color — same intent as the file's own "high-contrast interactive color" comment for the user bubble).
- **Files modified:** `src/components/assistant/MessageBubble.module.scss`
- **Verification:** `npm run dev` compiles; full `app-shell.spec.ts` runs and passes 6/6; `npm run build` green.
- **Committed in:** `a57b9c2`

---

**Total deviations:** 1 auto-fixed (1 blocking). **Impact on plan:** The blocking fix was a cross-plan, minimal, same-intent token swap required to boot the shell and run this plan's acceptance gate — no scope creep into 06-08's component logic. All of 06-03's four shell files type-check clean and render through pure Carbon UI Shell components.

## Issues Encountered
- **Concurrent execution on a shared working tree / branch** (the standing STATE.md blocker): wave-2 plans 06-02 / 06-07 / 06-08 interleaved commits on `phase-6` while 06-03 ran, and 06-08 landed the broken SCSS above. A separate pre-existing `tsc --noEmit` error in `RecentActivityPanel.tsx` (uncommitted, owned by a Command Center migration plan — `InlineNotification` given a non-existent `actions` prop) was observed but is **out of scope** for 06-03 and logged to `deferred-items.md`; it does not fail `npm run build`.
- **Stale dev-server port**: a `next dev` from a failed Playwright attempt lingered on :3000; killed via `fuser -k 3000/tcp`. The compose app stack was brought back up with `docker compose up -d` (not `docker start`, which had left the app off the compose network) and verified healthy (200 on `/api/case`).

## Known Stubs
None found — no TODO/FIXME/placeholder/not-implemented markers in any of the 06-03 shell files or the blocking-fix file.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- App shell fully Carbon-based; every Wave 3 screen renders inside it with the unchanged `AppShell({ children })` contract.
- 06-09 cleanup can still remove the now-unimported Tailwind/shadcn remnants (`globals.css`, `postcss.config.mjs`) once all screens migrate.
- Recommend serializing intra-phase execution or using per-plan git worktrees — the 06-08 broken-SCSS collision is the second concrete instance of the concurrent-shared-tree hazard this milestone.

## Self-Check: PASSED

- All 5 shell files + SUMMARY.md exist on disk.
- All 4 commits present (`3a794f1`, `3d695f2`, `a57b9c2`, `1a48319`).
- Build check: `npm run build` → exit 0.
- `## Known Stubs` present; no blocking stubs.
- Acceptance gate: `npx playwright test e2e/app-shell.spec.ts` → 6/6 passed.

---
*Phase: 06-carbon-design-system-ui-upgrade*
*Completed: 2026-10-08*
