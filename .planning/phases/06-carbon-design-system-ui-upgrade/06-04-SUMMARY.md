---
phase: 06-carbon-design-system-ui-upgrade
plan: 04
subsystem: ui
tags: [carbon, react, table, dropdown, search, dismissible-tag, playwright, case-workspace]

requires:
  - phase: 06-carbon-design-system-ui-upgrade
    provides: "Wave-2 Carbon StatusBadge + DiscrepancyBadge (06-02), consumed here unchanged"
provides:
  - "Case Workspace screen (F9) rendered via Carbon Table primitives"
  - "Exhibit Search/filter bar (F4) rendered via Carbon Search/Dropdown/TextInput/DismissibleTag/Button"
  - "Removes the only consumers of src/components/ui/table.tsx, input.tsx, select.tsx, button.tsx (unblocks 06-09 cleanup)"
affects: ["06-09 final cleanup (can now delete the four shadcn ui primitives)"]

tech-stack:
  added: []
  patterns:
    - "Carbon static Table/TableHead/TableHeader/TableRow/TableBody/TableCell (NOT stateful DataTable) for a non-sortable list"
    - "Carbon Dropdown (not Select) for a filter needing role=option items; onChange adapter { selectedItem } -> same filter shape"
    - "Accessible-name discipline: the control's aria-label must not duplicate titleText, or getByLabel strict-mode-collides with Carbon's aria-labelledby'd listbox"

key-files:
  created: []
  modified:
    - "src/components/case/ExhibitTable.tsx"
    - "src/components/case/SearchFilterBar.tsx"
    - "src/app/case/page.tsx"

key-decisions:
  - "Used Carbon's static Table primitives, not DataTable — this screen has no sort/select/pagination and adding any would be out-of-scope functional change"
  - "Used Carbon Dropdown (not Select) for the status filter because the test asserts role=option items reachable via click; Dropdown renders <li role=option>, Select does not"
  - "Kept TextInput type=date (not DatePicker) to avoid behavioral drift from the native date picker, per the no-behavior-change constraint"
  - "Dropdown titleText set to 'Status' (distinct from the 'Filter by status' aria-label) so getByLabel resolves to the combobox only, not Carbon's aria-labelledby'd listbox"

patterns-established:
  - "Carbon naming inversion documented in-file: TableHead = <thead> wrapper, TableHeader = per-column <th> (the inverse of shadcn)"

duration: 3min
completed: 2026-10-08
---

# Phase 6 Plan 04: Case Workspace Carbon Migration Summary

**Case Workspace (F9) + Exhibit Search (F4) migrated from shadcn `ui/table`/`input`/`select`/`button` to Carbon `Table`/`Search`/`Dropdown`/`TextInput`/`DismissibleTag`/`Button`, consuming Wave-2's Carbon StatusBadge/DiscrepancyBadge unchanged, with the full 9-test case-workspace Playwright suite green.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-10-08T02:14:14Z
- **Completed:** 2026-10-08T02:18:05Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- `ExhibitTable` renders through Carbon static `Table` primitives, with the `data-testid="exhibit-row"` + `data-exhibit-label` attribute pair, row click-through, all 7 columns, and exact empty-state copy preserved.
- `SearchFilterBar` renders through Carbon `Search` (keyword, with onClear), `Dropdown` (status — role=option items), `TextInput` (witness + two `type="date"`), `DismissibleTag` (active-filter chips, per-key `onClose`) and a ghost `Button` ("Clear filters"); the AND-semantics `ExhibitFilters` shape is unchanged and the Dropdown `onChange` adapted mechanically from `{ selectedItem }`.
- `case/page.tsx` now uses Carbon `InlineLoading`/`InlineNotification kind="error"` for loading/error states with the exact copy and conditional structure intact.
- This removes the last consumers of the four shadcn UI primitive files, unblocking 06-09's cleanup.

## Task Commits

1. **Task 1: Migrate ExhibitTable to Carbon Table primitives** — `a9270d2` (feat)
2. **Task 2: Migrate SearchFilterBar to Carbon Search/Dropdown/TextInput/DismissibleTag/Button** — `8207c6e` (feat)
3. **Task 3: Carbon loading/error states in case page + Dropdown label fix** — `bbe3bc8` (feat)

## Files Created/Modified
- `src/components/case/ExhibitTable.tsx` — shadcn table → Carbon `Table/TableHead/TableHeader/TableRow/TableBody/TableCell`; corrected Carbon's `TableHead`(<thead>)/`TableHeader`(<th>) naming inversion.
- `src/components/case/SearchFilterBar.tsx` — shadcn input/select/button → Carbon `Search/Dropdown/TextInput/DismissibleTag/Button`; accessible names via `labelText`+`hideLabel`+`aria-label`.
- `src/app/case/page.tsx` — plain `<p>` loading/error → Carbon `InlineLoading`/`InlineNotification`.

## Decisions Made
- Static Carbon `Table` over stateful `DataTable` (no sort/select/pagination in scope).
- Carbon `Dropdown` over `Select` for the status filter (the test requires `role="option"` items reachable via `.click()`; this is the OPPOSITE of 06-03's role switcher, which needed native `<select>`/`<option>`).
- `TextInput type="date"` over `DatePicker` to avoid interaction-model drift under the no-behavior-change constraint.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Status Dropdown accessible-name collision with its own listbox**
- **Found during:** Task 3 (running the acceptance Playwright suite)
- **Issue:** Setting the Dropdown's `titleText` AND `aria-label` both to "Filter by status" made `getByLabel('Filter by status')` resolve to TWO elements — the combobox button (via `aria-label`) and the inner `<ul role="listbox">` (via `aria-labelledby` → the hidden `titleText` label) — a Playwright strict-mode violation that failed the combinable-AND-search test on `.click()`.
- **Fix:** Changed `titleText` to the distinct value "Status" while keeping `aria-label="Filter by status"` on the toggle button, so `getByLabel('Filter by status')` resolves only to the combobox.
- **Files modified:** `src/components/case/SearchFilterBar.tsx`
- **Verification:** Full suite re-run 9/9 green.
- **Committed in:** `bbe3bc8` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The fix was required for the acceptance gate and preserves the asserted accessible name; no scope creep. No out-of-scope sibling-plan unblocks were needed this run — HEAD compiled and built cleanly.

## Issues Encountered
None — HEAD built green throughout (`tsc` EXIT=0, `next build` EXIT=0); no concurrent sibling breakage required out-of-scope fixes this run.

## Known Stubs
None found. (The two `placeholder=` matches in the stub scan are legitimate HTML placeholder attributes on `Search`/`TextInput`, not stub markers.)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Case Workspace (F9) and Exhibit Search (F4) are fully on Carbon; Wave-2 shared badges consumed unchanged.
- `src/components/ui/{table,input,select,button}.tsx` now have no remaining consumers from this screen — ready for 06-09's final shadcn-primitive deletion (verify no other consumers remain before deleting).

---
*Phase: 06-carbon-design-system-ui-upgrade*
*Completed: 2026-10-08*

## Self-Check: PASSED
- All 3 modified files exist on disk.
- All 3 task commits present (a9270d2, 8207c6e, bbe3bc8).
- Plan-level build ran: `npm run build` (next build) → exit 0; `tsc --noEmit` → exit 0.
- Full acceptance gate: `playwright test e2e/case-workspace.spec.ts e2e/case-workspace-discrepancies.spec.ts` → 9/9 passed.
- `## Known Stubs` present; no blocking stubs.
