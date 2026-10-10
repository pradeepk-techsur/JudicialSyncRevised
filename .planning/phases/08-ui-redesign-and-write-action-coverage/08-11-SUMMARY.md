---
phase: 08-ui-redesign-and-write-action-coverage
plan: 11
subsystem: ui
tags: [react, carbon, case-workspace, severity-pill, exhibit-tag, jury-eligibility, quick-filters, playwright]

# Dependency graph
requires:
  - phase: 08-03
    provides: shared ExhibitTag + SeverityPill presentational primitives
  - phase: 08-07
    provides: ExhibitListRow.juryPackageEligibility / hasUnresolvedObjection / isSealed additive fields
  - phase: 08-04
    provides: dark-dashboard app shell the redesigned screen renders inside
provides:
  - Redesigned Case Workspace (F09) consuming the shared primitives + backend eligibility data
  - ExhibitTable with ExhibitTag chips, readable SeverityPill flag stacks, server-computed Jury Package text, red Unassigned, tinted rows, trailing chevron
  - QuickFilterChips: client-side narrowing (All / Needs attention / In my custody / Awaiting ruling) with live counts, zero new query
  - Redesigned case/page header (subtitle count + case number) + documented disabled "Add exhibit" placeholder + footer caption
affects: [verify-work, phase-08 post-plan gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Flags column derives readable pills from the FULL signal set (discrepancyFlags + hasUnresolvedObjection + isSealed), never discrepancyFlags alone"
    - "Quick-filter counts and the narrowed table share one exported applyQuickFilter predicate so they can never disagree"
    - "Present-but-disabled placeholder (scope boundary) is distinct from absent-not-disabled (permission boundary)"

key-files:
  created:
    - src/components/case/QuickFilterChips.tsx
    - src/components/case/QuickFilterChips.module.scss
  modified:
    - src/components/case/ExhibitTable.tsx
    - src/components/case/ExhibitTable.module.scss
    - src/app/case/page.tsx
    - src/app/case/page.module.scss
    - e2e/case-workspace.spec.ts
    - e2e/case-workspace-discrepancies.spec.ts

key-decisions:
  - "Add exhibit rendered as a native-disabled placeholder with an explanatory tooltip (deliberate scope boundary — exhibit creation is outside F24's two-action scope), per the plan's explicit scope note"
  - "Narrowed the description column 20rem->10rem so the 8-column redesign fits inside the app-shell <main> content box, preserving F15's whole-row clickability at the far-right edge"
  - "DiscrepancyBadge fully replaced by SeverityPill on this screen; both e2e specs re-pointed to data-testid=severity-pill"

patterns-established:
  - "Readable flag pill derivation (flagPillsFor): isSealed->Ex parte · restricted (critical), ADMITTED_NO_CUSTODIAN->No custodian (medium), UNRESOLVED_OBJECTION_JURY_ELIGIBLE->Open objection (high), hasUnresolvedObjection-not-already-covered->Ruling pending (pending)"
  - "needsAttention(row) predicate shared between the row tint and the quick-filter 'needs attention' count"

# Metrics
duration: 13min
completed: 2026-10-09
---

# Phase 8 Plan 11: Case Workspace Redesign Summary

**Case Workspace (F09) redesigned to Screenshot 5: ExhibitTag label chips, readable SeverityPill flag stacks replacing the icon-only DiscrepancyBadge, a server-computed plain-language Jury Package eligibility column, red "Unassigned" custodian text, tinted attention rows + trailing chevron, quick-filter chips, and a redesigned header with a documented disabled "Add exhibit" placeholder.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-10-09T12:32:19Z
- **Completed:** 2026-10-09T12:46:00Z
- **Tasks:** 2
- **Files modified:** 8 (2 created, 6 modified)

## Accomplishments
- Every exhibit label on the screen now renders via the shared `ExhibitTag` chip (standardization requirement).
- The Flags column renders readable `SeverityPill` text pills derived from the exhibit's full signal set — surfacing the two NEW condition types ("Ruling pending", "Ex parte · restricted") that 08-07's additive fields (`hasUnresolvedObjection`, `isSealed`) carry but that fire no DiscrepancyFlag of their own. Multiple conditions stack as multiple pills, never collapsed.
- New "Jury Package" column renders server-computed plain-language colored text (Included/Not eligible/Blocked) verbatim from `row.juryPackageEligibility` — never re-derived client-side.
- A null custodian renders as red bold "Unassigned", never a blank cell. Rows needing attention are tinted; a trailing decorative chevron confirms row-clickability.
- New `QuickFilterChips` narrows the already-loaded list client-side (All / Needs attention / In my custody / Awaiting ruling) with live counts and zero new query.
- Redesigned header (subtitle "{N} exhibits · {case number}") + a deliberately disabled "Add exhibit" placeholder + footer caption.

## Task Commits

1. **Task 1: ExhibitTable redesign** - `342f838` (feat)
2. **Task 2: Quick-filter chips + header + footer + e2e** - `9ea0002` (feat)

**Plan metadata:** (docs commit, this summary + STATE.md)

## Files Created/Modified
- `src/components/case/QuickFilterChips.tsx` - client-side narrowing chips + exported `applyQuickFilter` predicate
- `src/components/case/QuickFilterChips.module.scss` - outlined/solid chip styling
- `src/components/case/ExhibitTable.tsx` - ExhibitTag, readable SeverityPill stacks, Jury Package text, red Unassigned, tint, chevron
- `src/components/case/ExhibitTable.module.scss` - tint/unassigned/flag-stack/jury-text/chevron styles; description narrowed to 10rem
- `src/app/case/page.tsx` - quick-filter state, redesigned header, disabled Add-exhibit, footer caption
- `src/app/case/page.module.scss` - header/subtitle/footer styles
- `e2e/case-workspace.spec.ts` - new coverage (jury text, Unassigned, quick-filter narrowing+counts, footer, disabled Add-exhibit)
- `e2e/case-workspace-discrepancies.spec.ts` - rewritten for the SeverityPill selector + live P-6/P-7 flag-pill assertions

## Decisions Made
- **"Add exhibit" = present-but-disabled placeholder.** Exhibit creation has never had a UI and is explicitly outside F24's two-action scope; rendered disabled with an explanatory tooltip for visual fidelity, per the plan's scope note. This is a scope boundary, deliberately distinct from the absent-not-disabled role-gating pattern (a permission boundary) used elsewhere.
- **"In my custody" matches by custodian name** against the active user's name — a reasonable client-side approximation given the demo's one-user-per-role model (no `currentCustodianUserId` on `ExhibitListRow`); no new backend field added, per 08-CONTEXT discretion.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Restored F15 whole-row clickability broken by the wider redesigned table**
- **Found during:** Task 2 (running the plan's own `<verify>` e2e block)
- **Issue:** The redesign adds three columns (Flags, Jury Package, trailing chevron). At the inherited 20rem description width the 8-column table overflowed the app-shell `<main>`'s content box (main has 1.5rem padding on every side). A click in that trailing strip landed on `<main>`, not the row — failing the already-shipped F15 test "entire row area is clickable" at the far-right edge (`box.width - 5`). Confirmed by `elementFromPoint` returning `MAIN` (inRow:false) at the test's click coordinate.
- **Fix:** Narrowed the description column `max-width` 20rem → 10rem so the whole table (and therefore the whole clickable row) fits inside main's content box (table right edge now exactly equals main's content-box right edge). Verified `elementFromPoint` at the far-right click point now returns a `<td>` inside the row.
- **Files modified:** src/components/case/ExhibitTable.module.scss
- **Verification:** e2e "entire row area is clickable" test passes; full 17-test suite green.
- **Committed in:** `9ea0002` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The fix was necessary to preserve a shipped F15 guarantee the redesign would otherwise have silently regressed. No scope creep.

## Known Stubs
None found. The single `grep` hit for "placeholder" is a code comment documenting the deliberate, in-scope disabled "Add exhibit" button (a documented scope-boundary choice, not a blocking stub).

## Issues Encountered
- **Shared-DB seed race (recurring, documented throughout STATE.md).** While sibling Phase-8 plans continuously `runSeed()` the shared `2026-CR-0142` case, the P-7 "Open objection" flag-pill assertion flaked once (and a seed run once returned a transient 422). Re-seeding and re-running produced a clean, deterministic 17/17 green. Not a code defect — the recurring shared-working-tree/DB hazard. Final verification was run on a fresh seed.

## Out-of-Scope Observations
- A transient `next build` TS2322 in `src/app/command-center/page.tsx` (sibling 08-10's `useRecentActivity` → `ActivityResponse` reconciliation, mid-flight on the shared tree) was observed early in this run and logged to `deferred-items.md` per the SCOPE BOUNDARY rule — NOT fixed here. It had converged to EXIT 0 by the plan-level build gate (the owning plan committed its reconciliation in the interim), the same convergence pattern documented for 08-04.

## Next Phase Readiness
- Case Workspace is a leaf consumer (no later plan builds on its output). The last of the four screen redesigns to consume the 08-03 shared primitives + 08-07 backend eligibility data is complete.
- `npx tsc --noEmit` EXIT 0; `npm run build` EXIT 0; both case-workspace e2e specs 17/17 green, 0 skipped.

## Self-Check: PASSED
- Created files exist on disk: QuickFilterChips.tsx, QuickFilterChips.module.scss, ExhibitTable.tsx, case/page.tsx — all FOUND.
- Commits exist: 342f838 (Task 1), 9ea0002 (Task 2) — both FOUND.
- Plan-level build: `npm run build` → EXIT 0.
- `## Known Stubs` present, no blocking entries.

---
*Phase: 08-ui-redesign-and-write-action-coverage*
*Completed: 2026-10-09*
