---
phase: 08-ui-redesign-and-write-action-coverage
plan: 03
subsystem: ui
tags: [react, carbon, scss-modules, shared-components, dark-dashboard, accessibility]

# Dependency graph
requires:
  - phase: 06-carbon-design-system-ui-upgrade
    provides: StatusBadge/DiscrepancyBadge precedent (one-shared-component pattern, Carbon-token CSS Modules, aria-label contract)
provides:
  - "ExhibitTag — single shared exhibit-label chip (P-3, S-1) for all four Phase 8 screens"
  - "SeverityPill — one pill for attention-feed tier badges AND condition/flag pills (4 fixed tones, never color-alone)"
  - "TwoColorProgressBar — one clean-vs-blocked bar for Command Center summary widget + Jury Package Workspace header"
  - "Card — shared rounded white card chrome with one reusable red-left-border critical variant"
  - "ActionButtonRow — layout-only primary/secondary Carbon-Button pairing"
  - "progressBarModel — pure, unit-tested {clean,total} → {blocked,cleanPct,caption} helper"
affects: ["08-10", "08-11", "08-12", "08-13", "08-14", "08-15", "F08", "F09", "F10", "F11", "F24"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Extract pure render-math into an exported helper so it is unit-testable in the project's node-env vitest (no jsdom/testing-library)"
    - "Carbon-token CSS Modules (@use '@carbon/colors') for every new visual primitive, matching the StatusBadge precedent"

key-files:
  created:
    - src/components/shared/ExhibitTag.tsx
    - src/components/shared/ExhibitTag.module.scss
    - src/components/shared/SeverityPill.tsx
    - src/components/shared/SeverityPill.module.scss
    - src/components/shared/TwoColorProgressBar.tsx
    - src/components/shared/TwoColorProgressBar.module.scss
    - src/components/shared/TwoColorProgressBar.test.ts
    - src/components/shared/Card.tsx
    - src/components/shared/Card.module.scss
    - src/components/shared/ActionButtonRow.tsx
    - src/components/shared/ActionButtonRow.module.scss
  modified:
    - .planning/phases/08-ui-redesign-and-write-action-coverage/deferred-items.md

key-decisions:
  - "SeverityPill uses one TONE_CONFIG map → 4 visually-distinct named CSS classes (toneCritical/toneHigh/tonePending/toneMedium); pending is amber-light with a defining border so it reads distinct from high at a glance"
  - "TwoColorProgressBar ratio math extracted into the pure progressBarModel helper, tested via *.test.ts, because the project's vitest is node-env with no jsdom/testing-library and only includes *.test.ts (not .tsx)"
  - "progressBarModel clamps negative/over-count inputs in addition to guarding total===0, so the bar can never emit a NaN width"
  - "Card forwards className + React.HTMLAttributes<HTMLDivElement> so consumers attach data-testids/handlers without the wrapper knowing about them"

patterns-established:
  - "Shared dark-dashboard visual primitives live in src/components/shared/ and are imported identically by every consuming screen (extends the StatusBadge one-shared-component rationale)"
  - "Pure-helper extraction for any component whose only breakable logic is a calculation, enabling node-env unit tests without rendering infrastructure"

# Metrics
duration: 3min
completed: 2026-10-09
---

# Phase 8 Plan 03: Shared Dark-Dashboard Visual Primitives Summary

**Five pure presentational primitives — ExhibitTag, SeverityPill, TwoColorProgressBar, Card, ActionButtonRow — that the four Phase 8 screen redesigns all consume, so exhibit labels, severity/condition pills, the clean-vs-blocked bar, card chrome, and button pairs can never visually drift across screens.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-10-09T12:04:13Z
- **Completed:** 2026-10-09T12:08:07Z
- **Tasks:** 2
- **Files modified:** 12 (11 created, 1 deferred-items log)

## Accomplishments
- **ExhibitTag** — the single shared representation of an exhibit label (`P-3`, `S-1`), a small bold monospace-ish chip with no status-color variation (status stays StatusBadge's job).
- **SeverityPill** — the ONE component for both attention-feed tier badges and condition/flag pills, with a fixed 4-tone color map (critical=dark-red/white, high=amber, pending=amber-light+border, medium=yellow); the label text is always visible and an `aria-label` carries the tier to assistive tech (never color-alone).
- **TwoColorProgressBar** — the one clean-vs-blocked bar (Command Center jury summary widget + Jury Package Workspace header read the identical `{clean,total}` shape), with the ratio math in a pure, unit-tested helper that guards `total===0` and clamps nonsensical inputs.
- **Card** — shared rounded white card chrome with a single reusable red-left-border critical variant applied identically regardless of consumer.
- **ActionButtonRow** — a layout-only primary/secondary Carbon-Button pairing guaranteeing consistent flex spacing on every card type.

## Task Commits

1. **Task 1: ExhibitTag + SeverityPill** - `a1cf5d4` (feat)
2. **Task 2: TwoColorProgressBar + Card + ActionButtonRow** - `242bc5c` (feat)

**Plan metadata:** (docs: complete plan — see final commit)

## Files Created/Modified
- `src/components/shared/ExhibitTag.tsx` / `.module.scss` - Exhibit-label chip
- `src/components/shared/SeverityPill.tsx` / `.module.scss` - Tier/condition pill, 4 fixed tones
- `src/components/shared/TwoColorProgressBar.tsx` / `.module.scss` - Clean-vs-blocked bar + `progressBarModel` pure helper
- `src/components/shared/TwoColorProgressBar.test.ts` - 6 vitest cases for `progressBarModel`
- `src/components/shared/Card.tsx` / `.module.scss` - Card chrome + critical variant
- `src/components/shared/ActionButtonRow.tsx` / `.module.scss` - Primary/secondary button-pair layout

## Decisions Made
- **Pure-helper extraction for the progress bar's math.** The plan's done-criteria asked for a `TwoColorProgressBar.test.tsx` vitest test covering `total=0` and the 100%/0% boundaries. The project's vitest is `environment: "node"` with no jsdom/testing-library and an `include` of `*.test.ts` only (not `.tsx`). Rather than add heavy rendering-test infrastructure (an unjustified infra change for a pure presentational plan), the ratio math was extracted into the exported pure `progressBarModel` helper and tested via `TwoColorProgressBar.test.ts` — testing exactly the logic the done-criteria care about, in the project's existing harness. All 6 tests pass.
- SeverityPill's `pending` tone is deliberately amber-light **with a border** so it is unmistakable from `high`'s amber at a glance (Y2-accessibility "never color alone" + the Severity Tier Badge pattern's distinctness requirement).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Progress-bar unit test written as `.test.ts` against an extracted pure helper, not `.test.tsx`**
- **Found during:** Task 2
- **Issue:** The plan's `<done>` named a `TwoColorProgressBar.test.tsx` rendering test, but the project has no jsdom/testing-library and its vitest `include` matches only `*.test.ts` — a `.test.tsx` rendering test would not run and would require adding rendering-test infrastructure out of scope for a pure-component plan.
- **Fix:** Extracted the ratio math into the exported pure `progressBarModel()` helper and tested it via `src/components/shared/TwoColorProgressBar.test.ts` (6 cases: 0-total/no-NaN, 100%-clean, 0%-clean, partial ratio, singular/plural blocker, input clamping). Covers the exact edge cases the done-criteria name.
- **Files modified:** src/components/shared/TwoColorProgressBar.tsx, src/components/shared/TwoColorProgressBar.test.ts
- **Verification:** `npx vitest run src/components/shared/TwoColorProgressBar.test.ts` → 6 passed.
- **Committed in:** `242bc5c` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The deviation keeps the test actually runnable in the project's harness while asserting the identical behavior the plan required. No scope creep.

## Issues Encountered
- **Pre-existing shared-working-tree `tsc` error (out of scope).** Early in the run, `src/services/exhibits.ts` failed `tsc` because a parallel in-flight Phase 8 plan had added required `juryPackageEligibility`/`hasUnresolvedObjection`/`isSealed` fields to `ExhibitListRow` in `src/lib/types.ts` without updating `exhibits.ts` in step. This is the exact shared-working-tree hazard documented repeatedly in STATE.md (Phases 6/7). The 08-03-owned files never produced any tsc error. By the time the plan-level build ran, a sibling plan had committed the `exhibits.ts` fix and the tree converged: full-project `npx tsc --noEmit` → EXIT 0 and `npx next build` → EXIT 0. Logged to `deferred-items.md`.
- **No ESLint in the project.** The plan's `<verify>` blocks call `npx eslint`, but the repo has no `eslint.config.*`/`.eslintrc`, no eslint devDependency, and Next 16 removed `next lint`. Matching the Phase 6/7 precedent, `tsc --noEmit` + `next build` were used as the authoritative gates. Logged to `deferred-items.md`.

## Known Stubs
None found — all five components are complete pure presentational implementations with no TODO/FIXME/placeholder/unimplemented paths.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All five shared primitives exist, export their documented shapes, compile clean (`tsc` EXIT 0), and the full app builds (`next build` EXIT 0). The `progressBarModel` unit test passes (6/6).
- Ready for the Wave-3 screen plans (08-10 … 08-15) to import these components when they redesign Command Center / Case Workspace / Exhibit Detail / Jury Package Workspace. Full behavioral/visual verification (in-situ rendering, aria-label correctness, color contrast) arrives with those screens' own Playwright suites, mirroring the Phase 6 precedent (06-02 shipped StatusBadge/DiscrepancyBadge with tsc+build-only verification; e2e arrived with the consuming screens).

## Self-Check: PASSED

- All 11 created files exist on disk.
- Both task commits present (`a1cf5d4`, `242bc5c`).
- Plan-level build ran: `npx tsc --noEmit` → EXIT 0; `npx next build` → EXIT 0.
- Unit test ran: `npx vitest run src/components/shared/TwoColorProgressBar.test.ts` → 6 passed.
- `## Known Stubs` present; no blocking stubs.

---
*Phase: 08-ui-redesign-and-write-action-coverage*
*Completed: 2026-10-09*
