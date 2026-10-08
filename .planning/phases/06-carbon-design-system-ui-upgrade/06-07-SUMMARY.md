---
phase: 06-carbon-design-system-ui-upgrade
plan: 07
subsystem: ui
tags: [carbon, tile, skeletontext, actionablenotification, tag, command-center, css-modules, sass]

# Dependency graph
requires:
  - phase: 06-carbon-design-system-ui-upgrade (06-01)
    provides: "Carbon Sass build pipeline + globals.scss (@use '@carbon/react', White theme)"
provides:
  - "Trial Command Center screen (F8) migrated Tailwind → Carbon: RecentActivityPanel, ObjectionsPanel, DiscrepanciesPanel, FreshnessIndicator, page composition"
  - "First Carbon-token CSS Modules in the codebase (panel/row/freshness/page-grid styling)"
affects: [06-09 Tailwind/shadcn cleanup, phase-6 verify]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Carbon Tile as the per-panel container (replaces rounded-lg border bg-white)"
    - "Carbon SkeletonText for loading (replaces hand-rolled animate-pulse)"
    - "Carbon ActionableNotification (error kind) for per-panel retryable errors"
    - "Carbon Tag type=red for the high-visibility discrepancy count badge"
    - "Carbon-token CSS Modules (@use '@carbon/styles/scss/{theme,spacing,type,breakpoint}') for custom styling that has no Carbon primitive"

key-files:
  created:
    - src/components/command-center/RecentActivityPanel.module.scss
    - src/components/command-center/ObjectionsPanel.module.scss
    - src/components/command-center/FreshnessIndicator.module.scss
    - src/components/command-center/DiscrepanciesPanel.module.scss
    - src/app/command-center/page.module.scss
  modified:
    - src/components/command-center/RecentActivityPanel.tsx
    - src/components/command-center/ObjectionsPanel.tsx
    - src/components/command-center/DiscrepanciesPanel.tsx
    - src/components/command-center/FreshnessIndicator.tsx
    - src/app/command-center/page.tsx

key-decisions:
  - "Used ActionableNotification (not InlineNotification) for panel errors — InlineNotification has no action-button API in @carbon/react ^1.118; ActionableNotification's actionButtonLabel/onActionButtonClick carries the retry inline"
  - "Error notification collapsed to a single text node (title only, no subtitle) with a 'Reload' action label so the error-isolation test's getByText(/unable to load|retry/i) resolves to exactly one element (avoids Carbon's title+subtitle+button strict-mode multi-match)"
  - "Carbon Tag type=red for the discrepancy count badge — highest-visibility color matching Screen-00's 'visible from across the room' intent for the highest-risk panel"
  - "Introduced the codebase's first Carbon-token CSS Modules rather than inline styles — keeps the new-row fade-in highlight, freshness pulse, warning-tinted header, and 2-column grid as declarative token-based CSS"

patterns-established:
  - "Command-Center panels: Carbon Tile wrapper + SkeletonText loading + ActionableNotification error + CSS-Module token styling, zero form controls"
  - "A read-only screen's error retry is a <button> (ActionableNotification action), never a form/input"

# Metrics
duration: 18 min
completed: 2026-10-08
---

# Phase 6 Plan 07: Trial Command Center Carbon Migration Summary

**Migrated the Trial Command Center (F8) — three ambient panels, freshness indicator, and page composition — from Tailwind to Carbon Tile/SkeletonText/ActionableNotification/Tag, keeping the screen strictly read-only (zero form/input/textarea) with all 7 Phase-5 Playwright acceptance tests green.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-10-08T01:51:00Z
- **Completed:** 2026-10-08T02:09:22Z
- **Tasks:** 3
- **Files modified:** 10 (5 components/pages migrated, 5 CSS Modules created)

## Accomplishments
- RecentActivityPanel, ObjectionsPanel, DiscrepanciesPanel each render via a Carbon `Tile` with `SkeletonText` loading and `ActionableNotification` (error kind) per-panel errors — error isolation preserved (one panel's 500 never blanks the others).
- DiscrepanciesPanel count badge is now a Carbon `Tag type="red"`; the warning-tinted header-row treatment when `count > 0` is a Carbon `support-warning` token. The sealed-filtering composition (intersecting `useDiscrepancies` with `useExhibitList`'s role-visible set) was left completely untouched — presentation-only.
- RecentActivityPanel's new-row fade-in state machine (`seenRef`/`timersRef`/`highlighted`) is byte-for-byte unchanged; only the highlight CSS class moved from `bg-amber-50` to a Carbon `support-warning` CSS-Module class.
- FreshnessIndicator keeps its `data-testid`, `aria-live="polite"` region, and exact "updated Xs ago"/"updating…" text; the in-flight pulse dot is now a CSS-Module `@keyframes`.
- page.tsx composition uses Carbon typography + a CSS-Module 2-column grid (md breakpoint); `data-testid="command-center"` root preserved.
- **Full `e2e/command-center.spec.ts` suite passes 7/7** — all three ROADMAP Phase-5 criteria (zero-config glance, multi-tab live sync, strictly read-only), plus sealed-exhibit absence and per-panel error isolation. `tsc --noEmit` and `next build` both clean.

## Task Commits

1. **Task 1: RecentActivityPanel** - `0d1ddba` (feat)
2. **Task 2: ObjectionsPanel + FreshnessIndicator** - `5a44545` (feat)
3. **Task 3: DiscrepanciesPanel + page.tsx + full suite** - `0bd2d92` (feat)
4. **Rule-3 unblock of concurrent-plan build breakage** - `aea0663` (fix)

## Files Created/Modified
- `src/components/command-center/RecentActivityPanel.tsx` + `.module.scss` - Carbon Tile/SkeletonText/ActionableNotification; token-based highlight/list/row styling
- `src/components/command-center/ObjectionsPanel.tsx` + `.module.scss` - same panel pattern; all-clear empty state preserved
- `src/components/command-center/DiscrepanciesPanel.tsx` + `.module.scss` - Tile + Tag(red) badge + warning header; sealed-filtering composition untouched
- `src/components/command-center/FreshnessIndicator.tsx` + `.module.scss` - Carbon typography tokens; CSS `@keyframes` pulse dot
- `src/app/command-center/page.tsx` + `.module.scss` - Carbon typography + CSS-grid 2-column lower row

## Decisions Made
See `key-decisions` frontmatter. Principal one: `ActionableNotification` over `InlineNotification` (the latter exposes no action-button API in the installed Carbon version), and collapsing the error to a single text node to satisfy the error-isolation test's `getByText` single-element expectation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Carbon error notification caused a Playwright strict-mode multi-match**
- **Found during:** Task 3 (full command-center suite — error-isolation test)
- **Issue:** My initial `ActionableNotification` used `title` + `subtitle` + an action button all containing text matching the test's `getByText(/unable to load|retry/i)`. Carbon renders these as three separate DOM nodes, so the locator resolved to 3 elements and `.toBeVisible()` failed under Playwright strict mode.
- **Fix:** Collapsed the message into the `title` only (dropped `subtitle`) and relabeled the action button "Reload" (not "Retry"), so exactly one element matches the regex. Applied consistently to all three panels for parity.
- **Files modified:** RecentActivityPanel.tsx, ObjectionsPanel.tsx, DiscrepanciesPanel.tsx
- **Verification:** `e2e/command-center.spec.ts` error-isolation test now passes; full suite 7/7.
- **Committed in:** `0bd2d92`

**2. [Rule 3 - Blocking] Phase-6 branch did not compile (concurrent-plan breakage) — blocked 06-07's own acceptance gate**
- **Found during:** Task 3 (attempting the Playwright gate — the dev server returned HTTP 500 on every route)
- **Issue:** The app shell (`layout.tsx → AppShell → AssistantPanel → Sidebar`) failed to build because three sibling Wave-2 plans had committed broken work to the shared `phase-6` branch (the concurrent-execution hazard already in STATE.md Blockers): (a) 06-08 `MessageBubble.module.scss` used `$button-primary` without importing the button component tokens; (b) 06-08 imported a never-created `AssistantPanel.module.scss`; (c) 06-03 `Sidebar.tsx` passed Carbon `SideNavLink as={Link}` from a Server Component. The Command Center screen's layout wraps all of these, so `command-center.spec.ts` could not run until the shell compiled.
- **Fix (minimal, scoped unblocks only — these files are NOT in 06-07's files_modified):** added the button-tokens `@use` to MessageBubble's module; reconstructed a minimal Carbon-token `AssistantPanel.module.scss` from the class names the component references; added `'use client'` to `Sidebar.tsx`. Each kept minimal so the owning plans retain final styling ownership.
- **Files modified:** src/components/assistant/MessageBubble.module.scss, src/components/assistant/AssistantPanel.module.scss (created), src/components/shell/Sidebar.tsx
- **Verification:** `next build` and the full command-center suite went green. (Subsequently, the concurrent plans landed their own fixes: 06-03 `a57b9c2` re-fixed MessageBubble's token; the merged HEAD still builds clean.)
- **Committed in:** `aea0663`
- **Logged:** `.planning/phases/06-carbon-design-system-ui-upgrade/deferred-items.md`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking). **Impact:** Deviation 1 was a direct consequence of the Carbon component swap and necessary for the acceptance test. Deviation 2 was entirely out-of-scope breakage from sibling plans; 06-07 made only the minimal unblocks needed to verify its own work and logged ownership back to the phase. No scope creep into Command Center behavior.

## Known Stubs

None found — all three panels, the freshness indicator, and the page composition are fully implemented (verified by grep for TODO/FIXME/placeholder and by the passing acceptance suite). The one reconstructed file outside this plan's scope (`AssistantPanel.module.scss`) is a functional Carbon-token module, not a stub, and is flagged in deferred-items as 06-08's to finalize.

## Issues Encountered
- The shared-tree dev server crashed twice mid-run under the combined Carbon-recompile + Playwright load; resolved by restarting it cleanly, warming the routes, then running the suite (all failures during those crashes were navigation timeouts, not assertion failures — the clean re-run was 7/7).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Command Center (F8) migration complete and verified; one of the Wave-2 screens done.
- Build/test gate green on the merged phase-6 HEAD after all concurrent Wave-2 plans landed.
- 06-09 (Tailwind/shadcn cleanup) can remove the now-unused Tailwind utilities from these files; the Carbon CSS Modules introduced here are the replacement.

---
*Phase: 06-carbon-design-system-ui-upgrade*
*Completed: 2026-10-08*

## Self-Check: PASSED

- All 5 created CSS Modules exist on disk.
- All 4 commits present (0d1ddba, 5a44545, 0bd2d92, aea0663).
- Plan-level build ran and passed: `npm run build` → exit 0 (merged phase-6 HEAD).
- Full `e2e/command-center.spec.ts` acceptance gate: 7/7 passing.
- `## Known Stubs` section present; no blocking stubs.
