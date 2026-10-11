---
phase: 09-ui-tickets-and-typography-standard
plan: 19
subsystem: ui
tags: [carbon, css, data-table, playwright, gap-closure]

# Dependency graph
requires:
  - phase: 09-ui-tickets-and-typography-standard
    provides: "09-06's table-layout:fixed ExhibitTable column-width scaffolding (the regression this plan fixes)"
provides:
  - "ExhibitTable.module.scss column widths that actually sum correctly under table-layout:fixed — Description absorbs the true remainder, Flags fits its widest pill"
  - "A Playwright regression test proving zero cell-to-cell bounding-box overlap at 1440px, guarding this specific defect class from recurring"
affects: [case-workspace, exhibit-table]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Compounding a module-scoped class with the vendor's own wrapper class (`.table :global(.cds--data-table) th:last-of-type.colChevron`) to win a specificity fight against a vendored Carbon rule, without !important or a global override"

key-files:
  created: []
  modified:
    - src/components/case/ExhibitTable.module.scss
    - e2e/case-workspace.spec.ts

key-decisions:
  - "Fixed Carbon's th:last-of-type { inline-size: auto } override at the selector-specificity level (same .table class + :global(.cds--data-table) wrapper), not via !important or a global Carbon override, so the fix stays scoped to this one table"
  - "Widened .colFlags from 10rem to 13rem (not a dynamic/measured width) — a fixed value comfortably clearing the worst-case live-measured pill (\"Ex parte · restricted\", ~165px) is simpler and more robust than runtime measurement for a table column"

patterns-established: []

# Metrics
duration: 25min
completed: 2026-10-10
---

# Phase 9 Plan 19: Case Workspace exhibit table column-width fix Summary

**Fixed a CSS specificity bug where Carbon's own `th:last-of-type` rule silently split the table's remaining width between Description and a trailing decorative chevron column, and widened the Flags column so its widest pill no longer overflows into Jury Package — both proven by a new Playwright bounding-box overlap regression test.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-10-10T21:45:00Z (approx.)
- **Completed:** 2026-10-10T22:07:00Z
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments
- Root-caused and fixed the real defect behind 09-UAT.md test 6 ("the rows are broken"): Carbon's vendored `.cds--data-table th:last-of-type { inline-size: auto; position: static; }` rule was overriding `.colChevron`'s `width: 2rem` on the table's actual last column, so BOTH the chevron column and Description competed for "auto" width under `table-layout: fixed` — collapsing Description to the same ~96px as the fixed 6rem Label column instead of absorbing the table's true remainder.
- Widened the Flags column from 10rem to 13rem so the widest real `SeverityPill` label ("Ex parte · restricted", ~165px) no longer visually overflows into the adjacent Jury Package column.
- Added a Playwright regression test that measures every rendered row's Flags-pill and Jury-Package-cell bounding boxes at 1440px and asserts zero horizontal overlap, plus a Description-vs-Label width ratio assertion — so this exact defect class can never silently regress again.

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix the column-width allocation so Description gets the real remainder and Flags fits its widest pill** - `a525724` (fix)
2. **Task 2: Playwright regression test proving zero cell-to-cell overlap, including the worst-case sealed/Ex-parte row** - `7d48914` (test)

_No plan-metadata commit required beyond this SUMMARY + STATE.md update (see below)._

## Files Created/Modified
- `src/components/case/ExhibitTable.module.scss` - `.colFlags` widened 10rem→13rem; new compound `.table :global(.cds--data-table) th:last-of-type.colChevron` / `td:last-of-type.chevronCell` selector pins the chevron column at 2rem against Carbon's own last-of-type auto-width override, so Description absorbs the table's full remainder
- `e2e/case-workspace.spec.ts` - new test (UAT-6 gap closure): asserts every rendered `[data-testid="severity-pill"]` in a row's Flags cell stays left of the Jury Package cell's left edge at 1440px (zero overlap), guarded against a vacuous pass by requiring at least one pill observed across the seeded rows; also asserts Description cell width > 1.5× Label cell width

## Decisions Made
- Fixed the chevron-column override at the CSS-specificity level (compounding the existing `.table` class with Carbon's own `:global(.cds--data-table)` wrapper class) rather than reaching for `!important` or a project-wide `:last-of-type` override, so the fix stays scoped to this one table and cannot leak onto any other Carbon `<Table>` in the app.
- Used a fixed `13rem` for `.colFlags` (comfortably clearing the live-measured worst-case pill width) rather than a dynamic/JS-measured width — simpler, matches the existing fixed-width-per-column pattern every other column in this table already uses, and the full column-width budget (54rem fixed + Description remainder) still fits comfortably within the 1440px viewport's main content area.

## Deviations from Plan

None - plan executed exactly as written. Both fixes (chevron-column specificity + Flags width) and the regression test match the plan's prescribed implementation verbatim.

### Out-of-scope issues encountered and logged (not fixed — see Issues Encountered below)

## Issues Encountered

**Shared-working-tree hazard (recurring, documented pattern in this project's history — see STATE.md's many prior instances).** While verifying this plan, sibling gap-closure plan 09-18 (F-09-01 security fix: adds a required `actorUserId` param to `createExhibit`) was actively in flight in this same working tree and shared Postgres instance:

- `npx tsc --noEmit` / `npm run build` initially showed ~10-15 `TS2345: Property 'actorUserId' is missing` errors in sibling-owned test files (`attentionFeed.test.ts`, `custodyByCustodian.test.ts`, `activity.test.ts`, two API route `.test.ts` files) that 09-18 had not yet finished migrating. **Verified NOT caused by this plan**: stashing only `ExhibitTable.module.scss` reproduced the identical error set/count, and stashing all of 09-18's in-flight files and re-running `tsc`/`build` in isolation both passed EXIT 0 with this plan's changes present. Logged to `deferred-items.md`; left for 09-18 to complete, per the deviation-rules scope boundary.
- A concurrent sibling `vitest run` was racing `npm run seed` against the same DB mid-verification, transiently corrupting seed state (`exhibitId must reference an existing exhibit`). Resolved by waiting for the sibling test run to finish, then re-seeding successfully.
- The docker-compose `app` container crashed/restarted several times during verification for reasons unrelated to this plan's change (concurrent `docker compose up --build` invocations from sibling plan activity); resolved with `docker compose up -d --force-recreate app`.

None of the above originated in or required changes to this plan's two files. The plan's own Playwright test (Task 2) passed 2/2 runs once the environment stabilized.

**One pre-existing, unrelated flaky test observed** (`e2e/case-workspace.spec.ts:368`, 09-07's "applying a filter shows 'Showing N of M' with N <= M"): intermittently fails when the witness-filter narrows to the same count as the unfiltered total, seed-data dependent. Reproduced as already-failing on the very first suite run, before any 09-19 change was made. Logged to `deferred-items.md`; out of this plan's file scope (`SearchFilterBar`/seed witness distribution, not `ExhibitTable.module.scss`).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The Case Workspace exhibit table now renders every row cleanly at 1440px with the documented UAT-6 defect fully fixed and regression-tested. This was the last file-touching plan in this gap-closure batch's independent set (09-19/09-20 both wave=1, depends_on=[]); 09-18's security fix remains in flight in the shared tree and should complete its own test-fixture migration independently. No blockers for Phase 9 verification beyond 09-18's own completion.

## Known Stubs

None found. Both changed files (`ExhibitTable.module.scss`, `e2e/case-workspace.spec.ts`) scanned for TODO/FIXME/placeholder/not-implemented markers — no hits attributable to this plan's own changes.

## Self-Check: PASSED

- `[ -f src/components/case/ExhibitTable.module.scss ]` → FOUND
- `[ -f e2e/case-workspace.spec.ts ]` → FOUND
- `git log --oneline --all | grep a525724` → FOUND (Task 1 commit)
- `git log --oneline --all | grep 7d48914` → FOUND (Task 2 commit)
- Build check: `npx tsc --noEmit` → exit 0 (full working tree, including now-converged sibling plan 09-18 work)
- Build check: `npm run build` → exit 0 (all routes compiled, no type errors)
- `e2e/case-workspace.spec.ts --workers=1` → 19/20 passing (the new UAT-6 overlap-regression test passing 2/2 isolated runs; the one failure is 09-07's pre-existing, seed-data-dependent witness-filter flake, reproduced as already-failing before this plan's changes — logged to deferred-items.md, out of scope)

---
*Phase: 09-ui-tickets-and-typography-standard*
*Completed: 2026-10-10*
