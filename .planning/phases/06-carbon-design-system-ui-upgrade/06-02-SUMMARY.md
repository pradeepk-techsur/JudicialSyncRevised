---
phase: 06-carbon-design-system-ui-upgrade
plan: 02
subsystem: ui
tags: [carbon, carbon-react, tag, textarea, button, scss-modules, status-badge, discrepancy, acknowledge]

requires:
  - phase: 06-carbon-design-system-ui-upgrade
    provides: "Carbon Sass build pipeline + globals.scss (@use '@carbon/react', White theme) wired into layout (06-01)"
  - phase: 03-jury-package-discrepancy-detection
    provides: "DiscrepancyFlagSummary type + single ruleLabel() copy source (03-01/03-03)"
  - phase: 02-core-screens
    provides: "StatusBadge single-shared-status-component contract (02-05); AcknowledgeInline inline-expansion shape (03-04)"
provides:
  - "StatusBadge rendered via Carbon Tag for all 6 ExhibitStatus values + null plain-text branch, same aria-label convention"
  - "DiscrepancyBadge rendered via warning-styled Carbon Tag (scoped CSS Module override), OPEN vs ACKNOWLEDGED distinction, single/multi collapse, responsive detail sentence"
  - "AcknowledgeInline rendered via Carbon TextArea + Button, all four data-testids + 500-char cap + canConfirm gate preserved"
affects: [06-04 Case Workspace, 06-05 Exhibit Detail, 06-06 Jury Package]

tech-stack:
  added: []
  patterns:
    - "Carbon Tag with colored status/warning surface customized via a colocated SCSS Module using @carbon/colors tokens (no invented hex) — Carbon's recommended pattern for colors outside the built-in Tag type enum"
    - "Carbon TextArea forwards rest props (data-testid, maxLength) onto its inner <textarea>; Carbon Button forwards data-testid onto its <button> — test contracts survive the primitive swap"
    - "sr-only md:not-sr-only recreated as a CSS Module visually-hidden (clip-rect) class un-hidden at 768px — Tailwind-free responsive disclosure"

key-files:
  created:
    - src/components/StatusBadge.module.scss
    - src/components/case/DiscrepancyBadge.module.scss
  modified:
    - src/components/StatusBadge.tsx
    - src/components/case/DiscrepancyBadge.tsx
    - src/components/jury/AcknowledgeInline.tsx

key-decisions:
  - "StatusBadge null branch stays plain muted text (not a Tag): a genuinely-absent status is not a status color"
  - "DiscrepancyBadge uses type='gray' Tag with color fully overridden to Carbon yellow/warning tokens via a scoped CSS Module — Carbon ships no 'amber' Tag type"
  - "AcknowledgeInline error line kept a plain <p role='alert'> (not Carbon InlineNotification) per the compact-inline / never-modal Y0-patterns constraint"

patterns-established:
  - "Carbon-primitive migration of a shared component preserves every data-testid/aria-label/conditional branch byte-for-byte so Wave 3 consumers import unchanged"

duration: 4min
completed: 2026-10-08
---

# Phase 6 Plan 2: Carbon Migration of Shared Status/Discrepancy/Acknowledge Components Summary

**StatusBadge, DiscrepancyBadge, and AcknowledgeInline re-rendered through IBM Carbon `Tag`/`TextArea`/`Button` primitives while preserving every data-testid, aria-label, and conditional branch byte-for-byte, so Wave 3 screens import them with zero consuming-side changes.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-10-08T01:55:50Z
- **Completed:** 2026-10-08T02:00:30Z
- **Tasks:** 3
- **Files modified:** 5 (3 modified, 2 created)

## Accomplishments
- `StatusBadge` renders a Carbon `Tag` for all 6 statuses with the colored dot preserved inside, keeps the plain-text null branch, and keeps the exact `aria-label="Current status: {Label}"` string tested by `exhibit-detail.spec.ts`.
- `DiscrepancyBadge` renders a warning-styled Carbon `Tag` (color surface overridden to Carbon yellow/warning tokens via a scoped CSS Module) with every `data-testid`/`data-discrepancy-status`/`data-rule-code`/`data-discrepancy-count`/`aria-label` preserved, zero-flags→null, single/multi collapse, OPEN vs ACKNOWLEDGED distinction, and the `sr-only md:not-sr-only` responsive sentence recreated as a CSS-Module visually-hidden class.
- `AcknowledgeInline` renders Carbon `TextArea` + `Button` with all four data-testids (inline/textarea/counter/confirm), the live N/500 counter, the 500-char `maxLength` cap, and the trim-then-empty `canConfirm` gate preserved — Carbon's rest-prop forwarding lands `data-testid`+`maxLength` on the inner `<textarea>`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate StatusBadge to Carbon Tag** — `3a794f1` (feat)
2. **Task 2: Migrate DiscrepancyBadge to warning-styled Carbon Tag** — `966b584` (feat)
3. **Task 3: Migrate AcknowledgeInline to Carbon TextArea + Button** — `06d0491` (feat)

_Note: commit 3a794f1's short hash collides visually with a parallel plan's Header commit in `git log`; this plan's StatusBadge commit is the one that touches `src/components/StatusBadge.tsx` + `StatusBadge.module.scss`._

## Files Created/Modified
- `src/components/StatusBadge.tsx` — Carbon `Tag` rendering for 6 statuses + plain-text null branch
- `src/components/StatusBadge.module.scss` — colored status dots via `@carbon/colors` tokens (created)
- `src/components/case/DiscrepancyBadge.tsx` — warning-styled Carbon `Tag`, all attributes preserved
- `src/components/case/DiscrepancyBadge.module.scss` — warning color override + responsive visually-hidden detail sentence (created)
- `src/components/jury/AcknowledgeInline.tsx` — Carbon `TextArea` + `Button`, all testids/counter/cap/gate preserved

## Decisions Made
- **StatusBadge null branch stays plain muted text** (not a Tag): a genuinely-absent status is not a status color, matching current design intent and the `aria-label="Current status: not yet entered"` contract.
- **DiscrepancyBadge color via CSS-Module override** of a `type="gray"` Tag to Carbon `$yellow-*` tokens — Carbon ships no literal "amber/warning" Tag `type`, and this is Carbon's own recommended pattern for status colors outside the built-in enum. No hex values invented; all from `@carbon/colors`.
- **AcknowledgeInline error line kept a plain `<p role="alert">`** rather than Carbon `InlineNotification`, per the "compact, inline expansion… never a modal" Y0-patterns constraint.

## Deviations from Plan

None - plan executed exactly as written. All three components migrated 1:1; every per-task `<verify>` grep and `tsc --noEmit` check passed; both new SCSS modules compile standalone via `npx sass`.

**Total deviations:** 0.
**Impact on plan:** None — rendering-layer swap only, all behavioral/test contracts preserved.

## Known Stubs

None found. (The `grep` for stub markers matched only the legitimate `<textarea placeholder=...>` UI copy in `AcknowledgeInline.tsx`, which is not a stub.)

## Issues Encountered

- **Concurrent execution on a shared working tree (known Phase-6 hazard).** `config.parallelization: true` ran plans 06-02, 06-03, 06-07, 06-08 against one working tree simultaneously. This plan staged its files individually (never `git add .`) and committed only its three files, so no cross-plan work was mixed into 06-02's commits.

## Deferred Issues (out of scope — logged to deferred-items.md)

- **`src/components/assistant/MessageBubble.module.scss` breaks `next build`** with `Undefined variable $button-primary` (line 24). This file was **committed by parallel plan 06-08** (`7be9a64 feat(06-08): migrate MessageBubble and AssistantThread to Carbon`); it references Carbon theme variables without `@use`-ing a module that defines them. It is **not** one of 06-02's three files and is out of 06-02's scope — left for plan 06-08 to resolve. **Confirmed NOT introduced by 06-02:** all three 06-02 TSX files type-check clean (`tsc --noEmit` EXIT=0, zero errors in these files) and both 06-02 SCSS modules compile standalone via `npx sass`. The plan-level `next build` therefore could not run to green solely because of this parallel-plan file; 06-02's own artifacts are all verified green by type-check + standalone SCSS compile.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The three shared components (`StatusBadge`, `DiscrepancyBadge`, `AcknowledgeInline`) are Carbon-based with identical import paths and prop signatures — Wave 3's Case Workspace (06-04), Exhibit Detail (06-05), and Jury Package (06-06) can import them unchanged.
- **Blocker for a green phase build:** parallel plan 06-08's `MessageBubble.module.scss` must define/import `$button-primary` (and sibling Carbon theme tokens) before `next build` can pass phase-wide. Tracked in `deferred-items.md`; not a 06-02 defect.

---
*Phase: 06-carbon-design-system-ui-upgrade*
*Completed: 2026-10-08*

## Self-Check: PASSED

- Created files exist on disk: `StatusBadge.module.scss`, `DiscrepancyBadge.module.scss`, plus all 3 modified TSX files — FOUND.
- Task commits exist in git history: `3a794f1` (Task 1), `966b584` (Task 2), `06d0491` (Task 3) — FOUND.
- Type-check: `npx tsc --noEmit` → EXIT 0; zero errors in the three 06-02 files.
- Plan-level build: `npx next build` → EXIT 1, failure isolated to parallel plan 06-08's `MessageBubble.module.scss` (`$button-primary` undefined). NOT a 06-02 artifact — see Deferred Issues. 06-02's own SCSS compiles standalone (`npx sass` on both modules → OK).
- `## Known Stubs` section present; no blocking stubs.
