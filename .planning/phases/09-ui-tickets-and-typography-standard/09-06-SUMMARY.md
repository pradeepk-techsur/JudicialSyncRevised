---
phase: 09-ui-tickets-and-typography-standard
plan: 06
subsystem: ui
tags: [jury-package, eligibility, case-workspace, exhibit-table, role-gating, carbon, playwright]

# Dependency graph
requires:
  - phase: 09-01
    provides: "case/page.tsx reading initial filter from useSearchParams (Suspense-wrapped CaseWorkspaceInner)"
  - phase: 08-07
    provides: "loadJuryEligibilityByExhibit single-source eligibility precedence + ExhibitListRow.juryPackageEligibility field"
  - phase: 08-08
    provides: "getExhibitHistory.juryPackageChecklist.eligibility calling the shared precedence"
  - phase: 08-11
    provides: "ExhibitTable redesign + Add-exhibit disabled placeholder + Jury Package column"
provides:
  - "Four-value jury-package eligibility precedence (INCLUDED|BLOCKED|NOT_ELIGIBLE|NOT_YET_EVALUATED) computed once in the service layer"
  - "NOT_ELIGIBLE narrowed to structural/permanent exclusion only (sealed or EXCLUDED member row)"
  - "NOT_YET_EVALUATED for exhibits never run through package computation"
  - "Case Workspace suppresses the eligibility tag for non-admitted rows; shows the real 4th value for admitted rows"
  - "Description column widened to the flexible, 2-line-wrapping column"
  - "Add exhibit role-gated to DEPUTY/CLERK/ADMIN (absent otherwise)"
affects: [jury-package, case-workspace, exhibit-detail]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Service-layer single-source precedence widened in place; three consuming surfaces inherit the union by construction"
    - "table-layout:fixed + explicit per-column widths to make one column the flexible wrapping remainder (Carbon Table)"
    - "Visibility role-gate (absent-not-disabled) layered on top of an existing disabled placeholder"

key-files:
  created: []
  modified:
    - src/services/exhibits.ts
    - src/lib/types.ts
    - src/services/history.ts
    - src/components/case/ExhibitTable.tsx
    - src/components/case/ExhibitTable.module.scss
    - src/components/exhibit/JuryPackageChecklistCard.tsx
    - src/components/exhibit/JuryPackageChecklistCard.module.scss
    - src/app/case/page.tsx
    - src/services/exhibits.test.ts
    - src/services/history.test.ts
    - e2e/case-workspace.spec.ts

key-decisions:
  - "isSealed takes precedence over package-row existence/state: a sealed exhibit is always NOT_ELIGIBLE (F16-classification substitute, matching attentionFeed/juryPackage precedent)"
  - "Fallback defaults at call sites changed from NOT_ELIGIBLE to NOT_YET_EVALUATED (the honest 'unknown' state)"
  - "No zebra-stripe rule existed to remove; attention tint (.tintedRow) preserved"
  - "Playwright admitted-row jury test anchored on stable P-4, not legacy-admit P-6, for independence from sibling re-seeding"

patterns-established:
  - "Widening a service-layer union surfaces every exhaustive Record consumer as a compile error (safety net for the 4th value)"

# Metrics
duration: 19 min
completed: 2026-10-10
---

# Phase 9 Plan 06: Case Workspace Jury-Eligibility Four-Value Precedence (T-06) Summary

**Split the jury-package eligibility column from a misleading 3-value collapse ("Not eligible" for everything un-computed) into the FRD's 4-value precedence (`INCLUDED`/`BLOCKED`/`NOT_ELIGIBLE` reserved for structural exclusion/`NOT_YET_EVALUATED`), fixed once in the service layer so getExhibits, searchExhibits and getExhibitHistory stay in lockstep; plus widened the Description column, confirmed zebra-free, and role-gated Add exhibit to DEPUTY/CLERK/ADMIN.**

## Performance

- **Duration:** 19 min
- **Started:** 2026-10-10T18:13:12Z
- **Completed:** 2026-10-10T18:32:16Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments
- `loadJuryEligibilityByExhibit` now returns the 4-value union with `NOT_ELIGIBLE` reserved strictly for structural exclusions (sealed exhibit or `EXCLUDED` member row) and `NOT_YET_EVALUATED` for every exhibit with no member row — the T-06 defect ("always Not eligible until a package is initiated") is fixed at its root.
- The Case Workspace Jury Package column renders nothing for non-admitted rows (F09 step 4) and the correct 4th value ("Not yet evaluated", neutral/italic) for admitted rows.
- The Description column is now the single flexible column (`table-layout: fixed` + explicit widths on every other column), wrapping to 2 lines instead of truncating.
- "Add exhibit" is visible only for DEPUTY/CLERK/ADMIN (absent, not disabled, for all other roles), layered on top of the unchanged disabled-placeholder scope boundary.
- The Exhibit Detail jury-package checklist card gained the 4th label + a distinct neutral style so the shared precedence surfaces there automatically.

## Task Commits

1. **Task 1: Four-value precedence in the service layer** - `d304b6a` (fix)
2. **Task 2: Render 4 values + widen Description + no zebra** - `c18e4a5` (feat)
3. **Task 3: Role-gate Add exhibit + unit/Playwright coverage** - `2639315` (feat)
4. **Task 3 follow-up: anchor admitted-row jury test on stable P-4** - `112c0f3` (test)

## Files Created/Modified
- `src/services/exhibits.ts` - `loadJuryEligibilityByExhibit` rewritten to the 4-value precedence; batch-fetches `isSealed` once; `toListRow` param + both call-site defaults widened.
- `src/lib/types.ts` - `ExhibitListRow.juryPackageEligibility` widened to the 4-value union (comment updated).
- `src/services/history.ts` - `juryPackageChecklist.eligibility` field type + default widened (inherits the shared precedence unchanged).
- `src/components/case/ExhibitTable.tsx` - 4th `JURY_PACKAGE_TEXT` entry; Jury Package cell suppressed for non-admitted rows; column classes for fixed layout.
- `src/components/case/ExhibitTable.module.scss` - `table-layout: fixed` + explicit `.col*` widths; Description wraps/clamps to 2 lines; new `.juryNotYetEvaluated`; attention tint preserved.
- `src/components/exhibit/JuryPackageChecklistCard.tsx` - 4th `ELIGIBILITY_LABEL` entry.
- `src/components/exhibit/JuryPackageChecklistCard.module.scss` - new `.eligibility_NOT_YET_EVALUATED` neutral style.
- `src/app/case/page.tsx` - `canSeeAddExhibit` role gate around the Add-exhibit button.
- `src/services/exhibits.test.ts` - 3 new direct branch tests; 2 now-correct assertions updated.
- `src/services/history.test.ts` - OFFERED checklist eligibility assertion updated to `NOT_YET_EVALUATED`.
- `e2e/case-workspace.spec.ts` - new non-admitted/admitted/role-gate tests; stale P-6 jury test corrected and re-anchored on P-4.

## Decisions Made
- **isSealed wins over package state:** a sealed exhibit is `NOT_ELIGIBLE` regardless of member-row existence/status, matching the established F16-classification substitution in `attentionFeed.ts`/`juryPackage.ts`.
- **Call-site fallbacks → `NOT_YET_EVALUATED`:** the map now covers every id, but the honest default for a missing id is "not yet evaluated", not the structural "not eligible".
- **No zebra striping to remove:** Carbon's plain `Table` has no zebra unless `useZebraStyles` is set (it isn't) and no `nth-child` rule exists in the SCSS — the ticket's "remove zebra" is a no-op; the attention tint (`.tintedRow`) is the only row-background rule and is preserved.
- **API docs already current:** `project_specs/TechArch/03-api.md` and `project_specs/FRD/Y1-api.md` already enumerate the 4-value union (added when the FRD was amended for Phase 9) — no doc edit was needed, so Task 1's doc-update instruction was a verified no-op.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated now-incorrect eligibility assertions in three test files**
- **Found during:** Tasks 1 & 3
- **Issue:** Existing unit/e2e tests encoded the pre-Phase-9 behavior (asserting `NOT_ELIGIBLE` for "no package computed" and "absent from package" and "OFFERED exhibit") — all now correctly `NOT_YET_EVALUATED`.
- **Fix:** Updated `exhibits.test.ts` (2 assertions + test names/comments), `history.test.ts` (OFFERED checklist eligibility), and the stale P-6 jury test in `case-workspace.spec.ts`.
- **Files modified:** src/services/exhibits.test.ts, src/services/history.test.ts, e2e/case-workspace.spec.ts
- **Verification:** vitest 32/32 (exhibits), 15/15 (history); the three jury e2e tests pass in isolation.
- **Committed in:** d304b6a (Task 1), 2639315 / 112c0f3 (Task 3)

**2. [Rule 3 - Blocking] Re-applied Task 1 edits after a concurrent sibling reverted them**
- **Found during:** Task 1
- **Issue:** A parallel Phase-9 plan's git operation reverted my in-flight edits to `exhibits.ts` (observed via `git status` + a failing test), the recurring shared-working-tree hazard documented throughout STATE.md.
- **Fix:** Re-applied the function/union edits and committed Task 1 immediately to lock it in; verified the committed HEAD matches the working tree (10 `NOT_YET_EVALUATED` occurrences, no post-commit revert).
- **Files modified:** src/services/exhibits.ts (re-applied)
- **Verification:** `git show HEAD:src/services/exhibits.ts | grep -c NOT_YET_EVALUATED` == working tree.
- **Committed in:** d304b6a

---

**Total deviations:** 2 auto-fixed (1 bug — stale test assertions; 1 blocking — concurrent revert recovery)
**Impact on plan:** Both were necessary for correctness. No scope creep — the test updates reflect the FRD-mandated behavior change, and the revert recovery restored planned work.

## Known Stubs
None found. The "placeholder" matches in `exhibits.ts`/`case/page.tsx` are comments describing the deliberate disabled-placeholder design (Add-exhibit scope boundary, unchanged), not incomplete implementations. No blocking or cosmetic stubs introduced.

## Issues Encountered
- **Shared-DB / shared-dev-server churn (environmental, not a code defect):** sibling Phase-9 plans continuously re-seed the shared `2026-CR-0142` case (the case UUID observably changes mid-run) and restart/kill the shared dev server on port 3000. This caused the combined `case-workspace + exhibit-detail` e2e run to show rotating single/multi-test failures across tests I did NOT touch (sealed-visibility, custodian, quick-filter, header-redesign, T-05). Each spec passed cleanly in stable windows: **exhibit-detail 19/19**, **case-workspace 15/15**, and all five of this plan's own new tests (Add-exhibit ×2, jury-eligibility ×3) pass in isolation. Authoritative gates that are immune to the churn all pass: `npx tsc --noEmit` exit 0 (full tree), `npm run build` exit 0, `vitest run src/services/exhibits.test.ts` 32/32, `vitest run src/services/history.test.ts` 15/15.

## Next Phase Readiness
- F9 T-06 fully delivered end-to-end: service-layer precedence + all three consuming surfaces + UI rendering + role gate + coverage.
- No blockers. The three-surface consistency rule (F09 §Validation) holds by construction since all surfaces call the single widened `loadJuryEligibilityByExhibit`.

---
*Phase: 09-ui-tickets-and-typography-standard*
*Completed: 2026-10-10*

## Self-Check: PASSED

- Created files: none (plan modifies existing files only) — all 11 modified files present on disk (verified with `[ -f ]`).
- Commits: d304b6a, c18e4a5, 2639315, 112c0f3 all present (`git log --oneline --all | grep`).
- Build gate: `npm run build` → exit 0 (Next.js production build succeeded, all routes compiled). `npx tsc --noEmit` → exit 0 (full tree).
- Known Stubs: section present, no blocking stubs.
- HEAD matches working tree for the re-applied service file (no post-commit revert).
