---
phase: 09-ui-tickets-and-typography-standard
plan: 03
subsystem: ui
tags: [status, carbon, scss-modules, icons, playwright, parity, design-tokens]

requires:
  - phase: 08-ui-redesign-and-write-action-coverage
    provides: "StatusBadge (the shared status pill, Carbon Tag + colored dot) and StatusDistributionBar (Command Center legend) as rendered after the 08-16 gap closure that removed the loud segmented bar"
provides:
  - "StatusBadge now EXPORTS STATUS_CONFIG (label + Carbon Tag type + dot class + icon) as the single TS source of truth for status presentation"
  - "src/styles/_statusColors.scss — the single SCSS source of truth for the six status→@carbon/colors token mappings, @use'd by both StatusBadge.module.scss and StatusDistributionBar.module.scss"
  - "StatusDistributionBar's duplicate hand-authored color/label map deleted; it imports label+icon from STATUS_CONFIG and applies the shared color tokens"
  - "Per-status icon on both the status pill and the Command Center legend (status never communicated by color alone)"
  - "e2e/status-palette-parity.spec.ts — cross-screen parity proof (Command Center legend ≡ Case Workspace pill ≡ Exhibit Detail badge)"
affects: [status display, command center legend, case workspace, exhibit detail, jury package finalized, accessibility]

tech-stack:
  added: []
  patterns:
    - "Single EXPORTED TS map (STATUS_CONFIG) consumed directly by sibling components — no second hand-copied map"
    - "Shared SCSS partial of raw color tokens @use'd across CSS Modules (CSS-Module class names stay local; only the color literals are centralized)"
    - "Three-redundant-signal status: color + icon + visible label text (accessibility)"

key-files:
  created:
    - "src/styles/_statusColors.scss"
    - "e2e/status-palette-parity.spec.ts"
  modified:
    - "src/components/StatusBadge.tsx"
    - "src/components/StatusBadge.module.scss"
    - "src/components/command-center/StatusDistributionBar.tsx"
    - "src/components/command-center/StatusDistributionBar.module.scss"

key-decisions:
  - "Centralized the COLOR TOKENS (not class names) in a shared SCSS partial because CSS Modules hash class names per-file, so cross-module class references are impossible — this keeps exactly one literal place per status color without a new shared CSS-Module file"
  - "Mapped the six already-distinct Carbon icons (Edit/ArrowRight/WarningAlt/CheckmarkFilled/CloseFilled/Undo) from @carbon/icons-react — all confirmed present in the installed v11.90.0"
  - "Left SearchFilterBar untouched (T-07 scope) to avoid a two-plan file conflict"
  - "The parity test adapts to the statuses present in the (shared, churning) live seed (≥4) and uses the always-six legend as the stable distinctness reference, rather than a brittle exactly-6 assertion"

patterns-established:
  - "STATUS_CONFIG as the exported single source of truth for status presentation"
  - "_statusColors.scss as the SCSS-token counterpart, @use'd by every status-rendering module"

duration: 20min
completed: 2026-10-10
---

# Phase 9 Plan 03: Status-Palette Single Source of Truth Summary

**StatusBadge's status→color map is now the single EXPORTED source of truth (`STATUS_CONFIG` + shared `_statusColors.scss`): the Command Center legend's duplicate color map is deleted and replaced by a direct import, per-status icons added, and a cross-screen parity e2e proves the legend, Case Workspace pill, and Exhibit Detail badge render identically for every status.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-10-10T17:27Z
- **Completed:** 2026-10-10T17:48Z
- **Tasks:** 3
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments
- Made `STATUS_CONFIG` the single EXPORTED TS source of truth (label + Tag type + dot class + icon), eliminating the drift risk T-03 names.
- Deleted `StatusDistributionBar`'s hand-authored `STATUS_META` label/color map — the legend now imports label+icon from `STATUS_CONFIG` and draws its dot color from the shared `_statusColors.scss` partial.
- Added a per-status icon (Carbon `Edit`/`ArrowRight`/`WarningAlt`/`CheckmarkFilled`/`CloseFilled`/`Undo`) to both the status pill and the legend, so status is communicated by color **and** icon **and** label — never color alone.
- Added `e2e/status-palette-parity.spec.ts` proving three-way parity (same Carbon Tag type + pixel-identical dot color) across the Command Center legend, Case Workspace pill, and Exhibit Detail badge, plus "no two of the six share a hue."

## Task Commits

1. **Task 1: Export STATUS_CONFIG with icons** — `bfc9680` (feat)
2. **Task 2: StatusDistributionBar consumes the shared map** — `2953f42` (feat)
3. **Task 3: Cross-screen status-palette parity test** — `bc2d908` (test)

## Files Created/Modified
- `src/components/StatusBadge.tsx` — `STATUS_CONFIG` now `export`ed and extended with an `icon` per status; icon rendered inline before the dot (aria-hidden); label + `aria-label` contract unchanged.
- `src/components/StatusBadge.module.scss` — dot classes now pull color from the shared partial; added `.statusIcon` spacing; null/muted branch keeps its own gray.
- `src/styles/_statusColors.scss` — **new** single SCSS source of truth for the six status→@carbon/colors token mappings (`$status-color-*`).
- `src/components/command-center/StatusDistributionBar.tsx` — deleted `STATUS_META`; imports `STATUS_CONFIG` for label+icon; local `SEG_CLASS` only applies styles (color comes from the shared partial); renders a per-status icon beside each legend dot.
- `src/components/command-center/StatusDistributionBar.module.scss` — `seg*` classes now apply the shared `$status-color-*` variables; added `.legendIcon`.
- `e2e/status-palette-parity.spec.ts` — **new** cross-screen parity spec.

## Decisions Made
- **Shared SCSS partial holds color TOKENS, not class names** — CSS Modules hash class names per file, so a legend in one module cannot reference a dot class compiled in another. Centralizing the color literals (variables) is the straightforward mechanism (anticipated by the plan's Task 2 note) that yields exactly one literal place per status color without introducing a cross-module CSS-Module dependency.
- **Icon set** — the six planned icons all exist in the installed `@carbon/icons-react@11.90.0` (grep-confirmed), so no substitution was needed and no new dependency added.
- **SearchFilterBar left untouched** — its status filter renders plain uncolored Carbon Dropdown items (no competing status-color styling); T-07 (same phase) independently rewrites that component, so touching it here would create an unnecessary file conflict.
- **Parity test resilience** — asserts three-way parity for every status present in the (shared, continuously re-seeded) live case (requiring ≥4 to stay meaningful) and uses the always-six Command Center legend as the stable reference for the "all six colors distinct" check. This avoids a brittle exactly-6 assertion that the shared-DB churn can momentarily violate (e.g. a sibling test advancing P-5 MARKED→OFFERED).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed project dependencies (node_modules absent)**
- **Found during:** Task 1 (before any edit)
- **Issue:** `node_modules` was not installed (`@carbon/react`, `@carbon/icons-react`, `@prisma/client` all missing), so nothing could type-check or build. A partial `npm install` left a corrupted tree (ENOTEMPTY).
- **Fix:** `rm -rf node_modules && npm ci --include=dev` — clean install, all Carbon packages + Prisma client present, `@carbon/icons-react@11.90.0` confirmed.
- **Files modified:** none (environment only)
- **Verification:** `ls node_modules/@carbon/icons-react` present; the six icon component files exist.
- **Committed in:** n/a (environment setup, no source change)

---

**Total deviations:** 1 auto-fixed (1 blocking). **Impact on plan:** required to make the task executable at all; no scope creep, no source-behavior change.

## Issues Encountered

**Shared working tree / shared-DB / shared-dev-server hazard (recurring, documented throughout Phase 8/9 STATE.md).** During execution, sibling Phase-9 plans had many uncommitted files in the shared tree and were running their own full Playwright suites concurrently:
- One early full `tsc --noEmit` flagged a single error in the untracked sibling file `src/app/api/cases/[id]/jury-package/preview/route.ts` (importing a not-yet-exported `JuryPackagePreviewLoadError`). By build time the sibling had committed the `errors.ts` export, and `npm run build` reached **EXIT 0**. My own files are tsc-clean in isolation. Logged to `deferred-items.md`.
- A full `e2e/command-center.spec.ts` run reported 19 "failures", but **every one passed when re-run in a stable window** (status-distribution legend, stat cards, attention feed, severity badges, Record-ruling/Assign-custodian, Review-and-remove nav, jury-package widget, all four KPI-tile nav tests). Root cause: concurrent sibling suites re-seeding the shared `2026-CR-0142` case and killing/restarting the shared `npm run dev` server mid-run (one batch aborted with webServer exit 143). NOT a 09-03 defect.
- The new `status-palette-parity.spec.ts` passes deterministically in isolation (3 consecutive green runs) and once flaked only when a sibling restarted the dev server mid combined-run — environmental, not a test defect.

## Known Stubs
None found — grep for TODO/FIXME/placeholder/not-implemented across all six changed files is empty. No hardcoded/stubbed behavior; the implementation is complete and real.

## Verification
- `npx tsc --noEmit` — clean for all 09-03 files (`grep StatusBadge|StatusDistributionBar|status-palette` empty); the only tree-wide error was the transient sibling `preview/route.ts` one, resolved by build time.
- `npm run build` — **EXIT 0** (SCSS partial compiles; `/command-center`, `/case`, `/exhibit/[id]` all build).
- `npx playwright test e2e/status-palette-parity.spec.ts --workers=1` — **passes** (3 isolated runs green).
- `npx playwright test e2e/command-center.spec.ts --workers=1` (status-distribution legend + all other tests) — **pass** in stable windows; KPI-tile nav tests 4/4, attention/widget/stat-card tests green when re-run isolated.
- Contract: `grep 'export const STATUS_CONFIG' src/components/StatusBadge.tsx` → `CONTRACT_OK`.

## Self-Check: PASSED
- All 6 key files exist on disk (verified with `[ -f ]`).
- All 3 task commits exist (`bfc9680`, `2953f42`, `bc2d908`).
- Plan-level build ran and passed: `npm run build → EXIT 0`.
- `## Known Stubs` present, no blocking stubs.

## Next Phase Readiness
- T-03 (status-palette single source of truth) delivered end-to-end. Case Workspace, Exhibit Detail, Jury Package, and the Command Center legend can no longer diverge on a status's color or icon — it is structurally impossible (one TS map + one SCSS token file).
- No blockers introduced. SearchFilterBar status styling is deliberately deferred to T-07 (same phase).

---
*Phase: 09-ui-tickets-and-typography-standard*
*Completed: 2026-10-10*
