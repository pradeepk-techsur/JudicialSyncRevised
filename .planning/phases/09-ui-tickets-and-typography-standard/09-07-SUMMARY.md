---
phase: 09-ui-tickets-and-typography-standard
plan: 07
subsystem: ui
tags: [carbon, combobox, dropdown, accessibility, filters, react, playwright]

# Dependency graph
requires:
  - phase: 09-06
    provides: "src/app/case/page.tsx role-gated Add exhibit (DEPUTY/CLERK/ADMIN) — the page this plan threads witnessOptions/visibleCount/totalCount through"
provides:
  - "SearchFilterBar with a visible text label on every filter control (Search/Status/Witness/From/To)"
  - "Witness filter as a searchable Carbon ComboBox bound to a witnessOptions: string[] prop sourced from the loaded exhibit list's real associatedWitness values"
  - "A live 'Showing X of Y' result-count readout + single Clear filters control replacing the old static 'Enter at least one filter…' hint sentence"
affects: [case-workspace, exhibit-filters]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Carbon ComboBox for a searchable single-select built from already-loaded data (no new query, no new dependency)"
    - "Result-count readout threaded from the page (filtered count + unfiltered total via a react-query-deduped useExhibitList({}) call) into a presentational filter bar"

key-files:
  created: []
  modified:
    - src/components/case/SearchFilterBar.tsx
    - src/components/case/SearchFilterBar.module.scss
    - src/app/case/page.tsx
    - e2e/case-workspace.spec.ts

key-decisions:
  - "Dropped the Status Dropdown's aria-label once titleText='Status' became visible — a visible label is the accessible name, and a differing aria-label would risk a Playwright strict-mode collision between getByText and the accessible name."
  - "Witness options derived directly from `data` (narrowing as other filters narrow), matching the ticket's literal 'distinct associatedWitness values in loaded list' rather than maintaining a separate full-list cache."
  - "Removed the duplicate standalone 'Clear filters' button from the chips row; the always-present readout is now the single reset-all affordance, avoiding two identically-labeled buttons (strict-mode safety). DismissibleTag per-chip clear is unchanged."

patterns-established:
  - "Visible-label-above-control layout for every Carbon filter: Dropdown/ComboBox/TextInput render their own titleText/labelText; the label-less Search is wrapped with an explicit visible <span> label."

# Metrics
duration: 8 min
completed: 2026-10-10
---

# Phase 9 Plan 07: Case Workspace filter labeling + witness select + result-count readout Summary

**Every Case Workspace search filter now carries a visible text label, the two date fields read From/To, the free-text Witness field is a searchable Carbon ComboBox sourced from real seeded witness values, and the confusing "Enter at least one filter…" sentence is replaced by a live "Showing X of Y" readout + Clear filters control.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-10-10T18:48:19Z
- **Completed:** 2026-10-10T18:56:24Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Removed `hideLabel` from every filter control so sighted users see real labels (previously four indistinguishable inputs carrying only `aria-label`).
- Date fields shortened to visible **From** / **To** labels (clearer than "Date from"/"Date to" side by side).
- Witness converted from a free-text `TextInput` to a searchable `ComboBox` that can only submit a value already present in the role-visibility-filtered loaded list (threat T-09-11: narrows, never widens, the `searchExhibits` validation surface).
- Replaced the static helper sentence with an always-visible "Showing X of Y" readout + a single Clear filters button.
- Confirmed the `getExhibits`-vs-`searchExhibits` routing in `useExhibitList.ts` already behaves per the ticket (`searching ? …/search… : …/exhibits`) — **no change needed** (see Deviations → "Already satisfied").

## Task Commits

1. **Task 1: Visible labels, From/To clarity, witness ComboBox** - `9d29d1d` (feat)
2. **Task 2: Result-count readout + derive witness options** - `bfc6112` (feat)
3. **Task 3: Playwright coverage for labels + witness select + readout** - `f469db9` (test)

_The final metadata commit records this SUMMARY + STATE.md._

## Files Created/Modified
- `src/components/case/SearchFilterBar.tsx` - Visible labels on every control; Status Dropdown un-hidden; Witness → ComboBox bound to new `witnessOptions` prop; date labels From/To; new `visibleCount`/`totalCount` props + "Showing X of Y" readout + single Clear filters; `data-testid="search-filter-bar"`.
- `src/components/case/SearchFilterBar.module.scss` - `.field`/`.fieldLabel` for the Search visible label; `.row` `align-items: flex-start` so label-above-control layouts align; `.readout` row; widened witness field.
- `src/app/case/page.tsx` - Derive `witnessOptions` (distinct sorted `associatedWitness`); add an unfiltered `useExhibitList({})` for the readout total; thread `witnessOptions`/`visibleCount`/`totalCount` into `SearchFilterBar`.
- `e2e/case-workspace.spec.ts` - Repaired two existing tests broken by the UI change (witness ComboBox select; status Dropdown by id; readout replaces hint); added a 4-test T-07 block (visible labels; witness combobox opens seeded names; "Showing N of M" with N ≤ M; Clear filters resets + updates readout).

## Decisions Made
- See `key-decisions` in frontmatter. Notably: dropped the Status `aria-label` once the label became visible; derive witness options directly from `data`; a single Clear filters control in the readout.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Repaired existing e2e tests broken by the Task 1/2 UI change**
- **Found during:** Task 2
- **Issue:** The witness field was a free-text input and the old "Enter at least one filter…" hint existed; three existing tests (`getByLabel('Filter by witness').fill`, `getByLabel('Filter by status').click`, and the hint-sentence assertion) would fail after the redesign.
- **Fix:** Rewrote the witness interaction to open the ComboBox and pick a seeded option; addressed the Status Dropdown by `#exhibit-status-filter`; replaced the hint assertion with a "Showing X of Y" readout assertion.
- **Files modified:** e2e/case-workspace.spec.ts
- **Verification:** Full `case-workspace.spec.ts` 19/19 green.
- **Committed in:** bfc6112 (Task 2) and f469db9 (Task 3)

**2. [Rule 1 - Bug] New T-07 readout tests read the total before the list loaded**
- **Found during:** Task 3
- **Issue:** Two new tests captured `result-count` text immediately after `goto`, reading the pre-load "Showing 0 of 0" and parsing total=0.
- **Fix:** Wait for `P-1` visible and `not.toHaveText('Showing 0 of 0')` before capturing the total.
- **Files modified:** e2e/case-workspace.spec.ts
- **Verification:** 19/19 green on re-run.
- **Committed in:** f469db9 (Task 3)

### Already satisfied (reported per the plan's reverse-discipline instruction)

- **`getExhibits` vs `searchExhibits` routing:** `src/hooks/useExhibitList.ts` already calls `…/exhibits` when no criterion is set and `…/exhibits/search?…` only when ≥1 filter is active (`searching ? … : …`). This sub-requirement of T-07 was already met by existing code; **no change made**.

### Out-of-scope / shared-working-tree (NOT fixed, logged to deferred-items.md)

- **Sibling 09-13 (LiveIndicator) contamination:** The shared working tree carried uncommitted sibling edits to `src/app/command-center/page.tsx` (FreshnessIndicator → LiveIndicator). At the time of the Task 2 commit, two sibling-owned file **deletions** (`FreshnessIndicator.tsx` / `.module.scss`) were already staged in the index and were swept into commit `bfc6112` despite only my own four files being explicitly `git add`-ed. The deletions are fully consistent with 09-13's retirement of that component (which committed its own LiveIndicator work — `e969442`, `3a911a6` — interleaved with mine), LiveIndicator exists, and no dangling reference remains, so nothing is broken. Documented rather than reverted (resurrect-then-re-delete would add churn on a shared tree; `git stash` deliberately avoided per the recurring hazard).
- A transient mid-edit `tsc` error on the sibling's `command-center/page.tsx` (`Cannot find name 'FreshnessIndicator'`) was observed during Task 2 and self-resolved once the sibling converged; final tree-wide `tsc --noEmit` is **EXIT 0**.

---

**Total deviations:** 2 auto-fixed (both Rule 1 test fixes). 1 "already satisfied" no-op recorded; 1 shared-tree contamination documented (not a code defect).
**Impact on plan:** No scope creep. All four acceptance criteria met; the plan's intended UI and tests are delivered and green.

## Issues Encountered
- **Shared-DB seed race:** the first `npm run seed` failed with a `ValidationError` (a concurrent sibling re-seeding the shared `2026-CR-0142` case — the recurring Phase-8/9 hazard); the idempotent seed succeeded on immediate retry, restoring the full canonical P-1..P-7 + S-1 fixture set. All Playwright assertions depend only on canonical seeded exhibits.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- T-07 (Case Workspace filter labeling/messaging) complete. SearchFilterBar now exposes `witnessOptions`/`visibleCount`/`totalCount` props and a visible-label layout for any future consumer.
- `tsc --noEmit` EXIT 0 tree-wide, `npm run build` EXIT 0, `e2e/case-workspace.spec.ts` 19/19 green.
- Ready for the next Phase 9 plan.

## Known Stubs
None found — the only "placeholder" matches are legitimate HTML input `placeholder=` attributes and comments describing the pre-existing, deliberate "Add exhibit" disabled-placeholder (08-11 scope boundary, unrelated to this plan).

## Self-Check: PASSED

- All 4 modified files present on disk.
- All 3 task commits present (`9d29d1d`, `bfc6112`, `f469db9`).
- Plan-level build: `npm run build` → EXIT 0. Tree-wide `npx tsc --noEmit` → EXIT 0.
- `e2e/case-workspace.spec.ts` → 19/19 passed (`--workers=1`).
- `## Known Stubs` present; no blocking stubs.

---
*Phase: 09-ui-tickets-and-typography-standard*
*Completed: 2026-10-10*
