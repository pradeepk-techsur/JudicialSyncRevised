---
phase: 09-ui-tickets-and-typography-standard
plan: 15
subsystem: ui
tags: [carbon, scss, tile, layer-model, surface-nesting, command-center, css-audit]

# Dependency graph
requires:
  - phase: 09-ui-tickets-and-typography-standard
    provides: "09-14 e2e/accessibility-audit.spec.ts (axe-contrast-baseline) — the final-state audit suite this styling pass must not regress"
  - phase: 08-ui-redesign-and-write-action-coverage
    provides: "08-03 shared Card chrome + the single-Tile-per-panel Command Center redesign (08-10/08-15) this ticket audits"
provides:
  - "Documented audit outcome for T-13 (flatten triple-nested surfaces): no triple-nesting exists in the current build; every Command Center panel-level surface is exactly one Carbon Tile/ClickableTile with uniform default chrome"
  - "Confirmation (zero-change) that the ticket's two acceptance criteria are already satisfied by construction"
affects: [09-verify, typography-standard, command-center]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Carbon Layer two-level surface model (page → Tile) as the app's panel-nesting standard — confirmed, not newly introduced"
    - "Subtractive-audit outcome recorded rather than inventing a change to justify a plan (plan-sanctioned)"

key-files:
  created: []
  modified: []

key-decisions:
  - "Zero code change: the T-13 audit found no card-in-grey-wrapper-in-page triple-nesting in the current codebase; Phase 8's single-Tile-per-panel pattern + shared Card chrome already satisfy the ticket's structural and consistency requirements. Recording the audit outcome is the correct deliverable (plan explicitly sanctions this)."

patterns-established:
  - "Panel surface = one Carbon <Tile> directly on the page; no inner wrapper div carries its own background/border/box-shadow"
  - "Cross-panel chrome consistency achieved by every panel relying on Carbon's default Tile tokens — no per-panel box-shadow/border-radius/card-border overrides"

# Metrics
duration: 2 min
completed: 2026-10-10
---

# Phase 9 Plan 15: Flatten Surface Stack (T-13) Summary

**Audited the Command Center for triple-nested surfaces (white card inside grey wrapper inside page); none exist — every panel is exactly one Carbon Tile with uniform default chrome, so the ticket's two acceptance criteria are already satisfied by construction. Zero code change, verified against the full Command Center Playwright suite.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-10-10T19:18:44Z
- **Completed:** 2026-10-10T19:20:50Z
- **Tasks:** 1 (audit, zero-change outcome)
- **Files modified:** 0

## Accomplishments
- Audited `ObjectionsPanel`, `DiscrepanciesPanel`, `RecentActivityPanel`, and the Command Center page composition (`page.module.scss`) plus the shared `Card.module.scss` for the T-13 defect — a third surface (an inner wrapper `<div>` with its own `background-color`/`border`/`box-shadow` duplicating the Tile's card chrome).
- Confirmed **no such inner-surface duplication exists** in the current build: each of the three named panels renders its content in exactly one Carbon `<Tile>` (verified in each `.tsx`'s root return), i.e. Carbon's two-level page → Tile model — the single level of nesting this app needs.
- Confirmed the ticket's **second acceptance criterion** (one border/shadow token pair on every card/panel) is also already met: no Command Center panel declares its own `box-shadow`/`border-radius`/card-border; every panel-level surface (`ObjectionsPanel`, `DiscrepanciesPanel`, `RecentActivityPanel`, `AttentionFeedPanel`, `CustodyAtAGlancePanel`, `JuryPackageSummaryWidget` → `<Tile>`; `StatCardRow` → `<ClickableTile>`) inherits Carbon's identical default Tile chrome, so all cards/panels share one treatment by construction.
- Verified the styling-only (here, no-change) audit breaks nothing: full Command Center Playwright suite 41/41 green.

## Audit detail — what the SCSS `background`/`border`/`box-shadow` hits actually are

A grep of every Command Center `*.module.scss` for surface-chrome declarations returned only non-surface uses, none of which is a card-in-a-card:

| File | Declaration | Classification |
|------|-------------|----------------|
| `ObjectionsPanel.module.scss` | `.link:hover { background-color: $layer-hover-01 }` | list-row hover state, not a surface |
| `DiscrepanciesPanel.module.scss` | `.headingWarning { background-color: $support-warning; border-radius: 0.25rem }` | semantic warning-tinted **heading pill** (alert treatment), not a wrapping surface; plus `.link:hover` |
| `RecentActivityPanel.module.scss` | `.pill { border; border-radius: 1rem; background }`, `.pillActive`, `.highlighted`, `.link:hover` | filter-**pill buttons** + transient new-row highlight + hover — none is a panel surface |
| `page.module.scss` | (none) | pure CSS-grid/layout; no background/border/box-shadow at all |
| `Card.module.scss` | `.card { border; border-radius; box-shadow }` | the single shared card chrome; used only as a **leaf** surface (JuryPackageDraft items, exhibit right-rail cards) — never wrapped inside a Tile |

App-wide scan confirmed **no `Card` is nested inside a `Tile`** (nor Tile-in-Card) anywhere, so no triple-nesting exists outside the Command Center either.

## Task Commits

No task code commits — the audit outcome is zero source change (the plan-sanctioned correct result). Plan metadata committed separately.

**Plan metadata:** `docs(09-15): complete flatten-surface-stack plan`

## Files Created/Modified
- None (audit-only; zero code change).

## Decisions Made
- **Zero code change is the correct outcome.** The plan explicitly anticipates this ("If the audit finds NO such inner-surface duplication in the CURRENT codebase (plausible — 08-03's `Card` shared-chrome standardization and the per-panel single-Tile pattern may have already eliminated this during Phase 8), record this explicitly … rather than inventing a change to justify the plan's existence. This is an acceptable, correct outcome."). Phase 8's single-Tile-per-panel + shared Card chrome already delivers T-13's structural requirement and the border/shadow-consistency criterion.

## Deviations from Plan

None - plan executed exactly as written (its documented zero-change branch).

## Verification

Per the plan's `<verify>` and `<verification>` blocks (run against the live DB-backed app — Postgres via `docker compose up -d db`, migrate + seed, Playwright's own `webServer` running `npm run dev`):

- `npx tsc --noEmit` → **exit 0**
- `npm run build` → **exit 0** (Next build ✓)
- `npx playwright test e2e/command-center.spec.ts --workers=1 --reporter=list` → **41/41 passed** (1.0m)

## Known Stubs
None found — audit-only plan; no source changed, no placeholder/TODO introduced.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- T-13 closed: surface-stack flattening confirmed already satisfied; no regression risk introduced (zero code change, suite green).
- Ready for the next plan in Phase 9 / phase verification.

---
*Phase: 09-ui-tickets-and-typography-standard*
*Completed: 2026-10-10*

## Self-Check: PASSED

- SUMMARY.md exists on disk.
- No key-files to verify (zero-change plan).
- Build check ran: `npm run build` exit 0; `tsc --noEmit` exit 0; `command-center.spec.ts` 41/41.
- `## Known Stubs` section present; no blocking stubs (audit-only, no source change).
