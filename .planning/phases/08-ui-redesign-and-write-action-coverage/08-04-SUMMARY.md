---
phase: 08-ui-redesign-and-write-action-coverage
plan: 04
subsystem: ui
tags: [carbon, react, scss, playwright, app-shell, ui-shell, dark-theme]

# Dependency graph
requires:
  - phase: 06-carbon-design-system-ui-upgrade
    provides: Carbon UI Shell app shell (Header/Sidebar via @carbon/react), CSS-Module-with-Carbon-tokens pattern
  - phase: 07-fix-admission-integrity-and-ui-usability-issues
    provides: F15 labeled header discrepancy indicator (now removed by this plan) + F12 gate seed with zero organic OPEN flags
provides:
  - Dark-navy, full-height Sidebar — the single most visually distinct shell region (Phase 8 dark-dashboard visual foundation)
  - Simplified shared Header — brand name + role switcher + "Ask Pivota" button only (no case-number text, no discrepancy-count badge)
  - app-shell.spec.ts aligned to the two intentional header removals (7/7 green)
affects: [08-10, 08-11, 08-12, 08-13, 08-14, 08-15, command-center, case-workspace, exhibit-detail, jury-package]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dark-theme a Carbon UI Shell region via a scoped CSS Module overriding the component's :global class names (verified against installed @carbon/styles source), not !important"

key-files:
  created:
    - src/components/shell/Sidebar.module.scss
  modified:
    - src/components/shell/Sidebar.tsx
    - src/components/shell/Header.tsx
    - e2e/app-shell.spec.ts

key-decisions:
  - "Dark-navy applied by scoping :global(.cds--side-nav*) overrides inside a CSS Module on the Sidebar wrapper — verified class names (cds--side-nav, __link, --current, __link-text) against the installed @carbon/styles ui-shell source rather than assuming"
  - "Case-number text node and discrepancy-count badge removed from the shared Header entirely (not relocated here) — they move to per-screen subtitles and the Command Center stat cards / attention feed, per 08-CONTEXT §Header layout"
  - "The two e2e removals are documented, intentional test edits: case-number test → role-switcher-only; both discrepancy-indicator tests → one asserting permanent absence even under a mocked nonzero count"

patterns-established:
  - "Carbon UI Shell dark-region theming: scoped CSS Module + :global Carbon class overrides, selectors source-verified"

# Metrics
duration: 18 min
completed: 2026-10-09
---

# Phase 8 Plan 04: App Shell Dark-Dashboard Migration Summary

**Dark-navy full-height Carbon Sidebar + a simplified shared Header (brand + role switcher + "Ask Pivota" only, case-number and discrepancy-badge removed), with the app-shell Playwright suite re-aligned to the two intentional removals.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-10-09T11:51:00Z
- **Completed:** 2026-10-09T12:09:17Z
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- Sidebar now renders as a dark-navy (#0f1b3d), full-height panel — the single most visually distinct region of the shell — via a new scoped CSS Module overriding Carbon's SideNav `:global` classes (background, idle/active/hover link colors), landing the Phase 8 dark-dashboard visual foundation first so every later wave-3 screen builds against the final shell.
- Shared Header simplified to match the reference screenshots exactly: removed the raw case-number text node and the discrepancy-count badge entirely (plus their now-unused `useDiscrepancyCount` + `useRouter` imports), and relabeled the assistant button from "Ask ✦" to "Ask Pivota" (all three identifying attributes unchanged).
- `e2e/app-shell.spec.ts` updated with documented, intentional edits — no silent regression — and passes 7/7 (0 skipped), explicitly covering the permanent absence of the discrepancy indicator even when the underlying count is mocked nonzero.

## Task Commits

Each task was committed atomically:

1. **Task 1: Dark-navy Sidebar** — `efc7dd3` (feat)
2. **Task 2: Simplify Header + update e2e** — `6efcced` (feat)

**Plan metadata:** (docs commit — SUMMARY + STATE)

## Files Created/Modified
- `src/components/shell/Sidebar.module.scss` (created) — dark-navy Carbon SideNav override (`:global(.cds--side-nav*)`), selectors source-verified against the installed `@carbon/styles`.
- `src/components/shell/Sidebar.tsx` — import the module, apply `styles.darkNav` to the `no-print` wrapper.
- `src/components/shell/Header.tsx` — removed case-number span, discrepancy-indicator block + `useDiscrepancyCount`/`useRouter` imports; relabeled button "Ask Pivota".
- `e2e/app-shell.spec.ts` — case-number test → role-switcher-only; two discrepancy-indicator tests → one permanent-absence test; Ask test relabeled.

## Decisions Made
- Used the verified Carbon active-link class `.cds--side-nav__link--current` (Carbon applies this, not `[aria-current='page']`) — confirmed in `node_modules/@carbon/react` SideNavLink source — so the active/hover wash actually targets the rendered DOM.
- Kept the `caseNumber` roleStore field in the hydrate-guard effect (still needed) while removing only its visible rendering — the bootstrap `GET /api/case` flow is untouched.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- **Shared-working-tree drift (recurring hazard, not a deviation of this plan):** Task 1's first `npm run build` failed TypeScript on `src/services/exhibits.ts:303/:391` (TS2554) — a sibling Wave-1 plan's uncommitted change to the shared `toListRow`/`types.ts` signature. 08-04 touches only `src/components/shell/*` + `e2e/app-shell.spec.ts`; the failure was out-of-scope sibling drift. Logged to `deferred-items.md` and NOT fixed here per the SCOPE BOUNDARY rule. By Task 2's verification the sibling plan (08-02) had committed its reconciliation and both `tsc --noEmit` and `npm run build` returned EXIT=0 on merged HEAD. Resolution noted in `deferred-items.md`.
- **Stale preview container:** a bundled `project-app-1` container was serving `:3000` from the image (not live source); stopped it (DB container left healthy) so Playwright's `webServer` ran `next dev` against the live edits, mirroring the 07-05 harness note.

## Known Stubs
None found. (The only "placeholder" grep hit is a pre-existing comment in `app-shell.spec.ts` that documents the *absence* of a nav placeholder.)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The final dark-dashboard shell (dark-navy sidebar + simplified header) is landed in Wave 1 — every wave-3 screen redesign plan (08-10 through 08-15) now renders inside the final shell, never a half-migrated one.
- Verification state at completion: `npx tsc --noEmit` clean; `npm run build` EXIT=0; `e2e/app-shell.spec.ts` 7/7 green, 0 skipped.

## Self-Check: PASSED
- `src/components/shell/Sidebar.module.scss` exists on disk ✓
- Commits `efc7dd3` and `6efcced` present in history ✓
- Plan-level `npm run build` ran and returned EXIT=0 ✓
- `## Known Stubs` present, no blocking stubs ✓

---
*Phase: 08-ui-redesign-and-write-action-coverage*
*Completed: 2026-10-09*
