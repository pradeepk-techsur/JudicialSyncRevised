
## 09-08 out-of-scope discovery (shared working tree)
- `src/app/api/cases/[id]/jury-package/preview/route.ts` (untracked, NOT in 09-08's file set) imports `JuryPackagePreviewLoadError` from `@/lib/errors`, which is not yet exported — a sibling Phase-9 plan's uncommitted in-flight work. Full `tsc --noEmit` therefore exits 2 on this one error. 09-08's own files (Sidebar.tsx, Sidebar.module.scss, JuryPackageNavItem.tsx) are tsc-clean in isolation. Not fixed (out of scope per SCOPE BOUNDARY).
- **[09-02]** `src/app/api/cases/[id]/jury-package/preview/route.ts(6,20)`: imports `JuryPackagePreviewLoadError` from `@/lib/errors`, which is not yet exported. This is uncommitted, in-progress sibling-plan work (shared working tree — the recurring Phase-8/9 hazard). NOT caused by and NOT in scope of 09-02 (SeverityPill styling only). My SeverityPill files type-check clean in isolation.

## 09-12 out-of-scope discovery (shared working tree)
- Same pre-existing sibling issue as above: untracked `src/app/api/cases/[id]/jury-package/preview/route.ts` imports `JuryPackagePreviewLoadError` from `@/lib/errors` (not yet exported by its in-flight sibling plan), so full `tsc --noEmit` / `npm run build` exit non-zero on that one error. 09-12's own files (src/lib/fonts.ts, src/app/layout.tsx, src/app/globals.scss, e2e/typography-fonts.spec.ts) are clean in isolation. Not fixed (out of scope per SCOPE BOUNDARY).

## 09-03 out-of-scope discovery (shared working tree)
- `src/app/api/cases/[id]/jury-package/preview/route.ts` imported `JuryPackagePreviewLoadError` from `@/lib/errors` (sibling in-flight work). At first tsc this errored; by build time the sibling had committed the `errors.ts` export, so `npm run build` reached EXIT 0. 09-03's own files (StatusBadge.tsx/.scss, StatusDistributionBar.tsx/.scss, src/styles/_statusColors.scss, e2e/status-palette-parity.spec.ts) are tsc-clean in isolation.
- RECURRING shared-DB / shared-dev-server hazard (documented throughout Phase 8/9 STATE.md): a full `e2e/command-center.spec.ts` run during 09-03 execution reported 19/29 "failures", but EVERY one passed when re-run in a stable window (status-distribution legend test, stat cards, attention feed, severity badges, Record-ruling/Assign-custodian actions, Review-and-remove nav, jury-package widget, all 4 KPI tile nav tests — all green on re-run). Root cause: sibling Phase-9 plans running their OWN full Playwright suites concurrently kept re-seeding the shared `2026-CR-0142` case AND killed/restarted the shared `npm run dev` server mid-run (one batch aborted with webServer exit 143). NOT a 09-03 defect — the test that directly exercises my StatusDistributionBar change passes deterministically in isolation.

## 09-05 out-of-scope discovery (shared working tree)
- The shared working tree carries many uncommitted sibling-plan edits (StatusBadge.tsx/.scss, ExampleChips.tsx, AttentionFeedPanel.tsx/.scss, SeverityPill.tsx/.scss, Sidebar.tsx, JuryPackageNavItem.tsx, errors.ts, attentionFeed.ts, juryPackage.ts, assistantStore.ts, layout.tsx, and untracked preview route + fonts.ts). During 09-05 execution `tsc --noEmit` momentarily showed transient StatusBadge.tsx / Sidebar.tsx overload errors (sibling-owned, mid-edit) which self-resolved once the sibling `juryPackage.ts`/`errors.ts` edits converged — final `tsc --noEmit` is EXIT 0 with zero errors tree-wide. 09-05's own files (DiscrepancyBanner.tsx/.scss, ObjectionCard.tsx, e2e/exhibit-detail.spec.ts) are clean in isolation. Only my own files were staged/committed; all sibling edits left untouched (the recurring Phase-8/9 parallel-plan hazard). Not fixed (out of scope per SCOPE BOUNDARY).

## 09-13 out-of-scope discovery (shared working tree)
- The shared working tree carries uncommitted sibling 09-07 (F15 filter-label/ComboBox) work in `src/components/case/SearchFilterBar.tsx`. Full `tsc --noEmit` exits 1 on one sibling-owned error: `src/app/case/page.tsx(95,8)` — `<SearchFilterBar>` is rendered without the newly-required `witnessOptions` prop that 09-07's committed `SearchFilterBar.tsx` (commit 9d29d1d) added. Confirmed PRE-EXISTING on clean HEAD (before any 09-13 edit) — NOT caused by and NOT in scope of 09-13 (LiveIndicator). My own files — `src/hooks/useFreshness.ts`, `src/components/command-center/LiveIndicator.tsx`/`.module.scss`, `src/app/command-center/page.tsx`, `e2e/command-center.spec.ts`, `src/hooks/useFreshness.test.ts` — type-check clean in isolation. Not fixed (out of scope per SCOPE BOUNDARY); only my own files staged/committed, all sibling edits left untouched. `git stash` deliberately avoided after one confirmatory use (the documented shared-tree hazard from 09-04).

## 09-07 out-of-scope discovery (shared working tree)
- The shared working tree carries uncommitted sibling 09-13 (T-15 LiveIndicator) work in `src/app/command-center/page.tsx` (import swapped `FreshnessIndicator` → `LiveIndicator` while line 101 still referenced the old name mid-edit). Full `tsc --noEmit` exits 2 on exactly that one sibling-owned error: `src/app/command-center/page.tsx(101,12): Cannot find name 'FreshnessIndicator'`. This is NOT in 09-07's file set and NOT caused by my changes — it is 09-13's in-flight rework (its own deferred-items entry above independently names my 09-07 `SearchFilterBar` work as ITS sibling blocker, the mirror image). 09-07's own files (`src/components/case/SearchFilterBar.tsx`/`.module.scss`, `src/app/case/page.tsx`, `e2e/case-workspace.spec.ts`) are tsc-clean in isolation (`tsc --noEmit | grep -iE "SearchFilterBar|case/page"` returns nothing). Not fixed (out of scope per SCOPE BOUNDARY); only my own files staged/committed, all sibling edits left untouched. `git stash` deliberately avoided (the documented shared-tree hazard from 09-04).

## 09-04 out-of-scope discovery (shared working tree)
- The shared working tree carries uncommitted sibling T-06 (F09) work: `src/components/case/ExhibitTable.tsx`, `src/components/exhibit/JuryPackageChecklistCard.tsx`, `src/lib/types.ts`, `src/services/exhibits.ts`, `src/services/exhibits.test.ts`, `src/services/history.ts`, `src/components/shell/AppShell.tsx`, `src/stores/roleStore.ts` + untracked `src/components/shell/ActiveRoleBanner.{tsx,module.scss}`. Full `tsc --noEmit` exits 1 on two sibling-owned errors (`ExhibitTable.tsx:62` / `JuryPackageChecklistCard.tsx:16` — both missing the in-flight `NOT_YET_EVALUATED` eligibility key). These are NOT in 09-04's file set and NOT caused by my changes; `RecentActivityPanel.tsx` and the new `/activity` page are tsc-clean in isolation. Not fixed (out of scope per SCOPE BOUNDARY). Only my own files staged/committed; all sibling edits left untouched.
- **Stash hazard (severe this run):** `git stash` (used once to confirm the pre-existing tsc errors on HEAD) swept the sibling's uncommitted files too; a concurrent sibling process then re-wrote `src/services/exhibits.test.ts` mid-stash, blocking `git stash pop`. Recovered by saving the sibling's newer `exhibits.test.ts` aside, resetting it, popping my stash, then restoring the sibling's newer version — zero sibling work lost. Lesson reinforced: avoid `git stash` on a shared working tree.
- RECURRING shared-DB hazard: a full `e2e/command-center.spec.ts` run reported 4 "failures" (`every Recent Activity row shows a full date+time` picked up a `SEALED-HISTORY-<ts>` exhibit injected into the shared `2026-CR-0142` case by a sibling's concurrent `src/services/history.test.ts` vitest fixture; plus `Custody at a Glance no-custodian` and two `quick-filter-no-custodian` tests, the latter two tied to the sibling's in-flight T-06 exhibits.ts/types). All passed on re-run after re-seeding (`npm run seed`) in a stable window: the whole spec went 32→33 passing with only the transient sibling-contamination failures remaining, and the one test that directly exercises my change passes deterministically in isolation.

## 09-20 out-of-scope discovery (shared working tree)
- The shared working tree carries uncommitted sibling 09-18 (F20 `POST /api/exhibits` role gate, F-09-01 fix) in-flight work in `src/services/exhibits.ts` — a new required `actorUserId: string` field added to `createExhibit`'s input type, matching 09-18-PLAN.md's file set exactly (`src/services/exhibits.ts`, `src/app/api/exhibits/route.ts`, `src/data/seed.ts`, plus 6 test files) — but the sibling hasn't yet landed the corresponding test-fixture updates, so `tsc --noEmit`/`npm run build` fail on ~15 `actorUserId is missing` errors across `exhibits.test.ts`/`activity.test.ts`/`attentionFeed.test.ts`/`custodyByCustodian.test.ts`/two route.test.ts files — none of which are in 09-20's file set. Confirmed NOT caused by 09-20: none of 09-20's touched files (`Header.tsx`, `Header.module.scss`, `ActiveRoleBanner.tsx`/`.module.scss`, `e2e/app-shell.spec.ts`) appear anywhere in the error list; `npx tsc --noEmit 2>&1 | grep -iE "ActiveRoleBanner|Header\.tsx|Header\.module"` returns empty. Not fixed (out of scope per SCOPE BOUNDARY, same recurring shared-tree hazard documented by every prior Phase 9 plan above). Only 09-20's own files staged/committed; 09-18's in-flight `exhibits.ts` edit left untouched for its own plan to land.

## 09-19 execution (shared-working-tree hazard, out of scope)

Date: 2026-10-10

While executing 09-19 (ExhibitTable column-width CSS fix), `npx tsc --noEmit` and
`npm run build` both failed with ~10-15 `TS2345: Property 'actorUserId' is missing`
errors across `src/services/*.test.ts` and `src/app/api/**/*.test.ts`.

Root cause: sibling plan 09-18 (F-09-01 security gap-closure — adds a required
`actorUserId` param to `createExhibit`) is mid-edit in this shared working tree.
`src/services/exhibits.ts` already requires `actorUserId`, but several sibling
test files (`attentionFeed.test.ts`, `custodyByCustodian.test.ts`,
`activity.test.ts`, the two route `.test.ts` files) have not yet been updated to
pass it — 09-18's own `exhibits.test.ts` fixture update is present, confirming
the plan is actively in flight, not abandoned.

Verified NOT caused by 09-19: `git stash push -- src/components/case/ExhibitTable.module.scss`
(09-19's only changed file) still reproduces the identical error set/count —
09-19's CSS-only change contributes zero tsc/build errors on its own.

Per the deviation-rules scope boundary ("Only auto-fix issues DIRECTLY caused by
the current task's changes... out-of-scope discoveries logged, not fixed"), this
is sibling plan 09-18's own unfinished work and is left for 09-18 to complete and
commit. Not fixed here.

## 09-19 execution — pre-existing flaky test (out of scope)

`e2e/case-workspace.spec.ts:368` ("applying a filter shows 'Showing N of M' with
N <= M", from 09-07's T-07 work) intermittently fails with `visible === total`
when narrowing by witness "Dr. Amara Finch" — seed-data dependent (apparently all
11 seeded exhibits can share that witness value after certain re-seeds), not
related to 09-19's ExhibitTable column-width scope. Reproduced as failing BEFORE
any 09-19 change was made (very first suite run, against the stale pre-fix Docker
image). Not fixed here — outside 09-19's file scope (`SearchFilterBar`/seed
witness distribution, not `ExhibitTable.module.scss`/the new overlap-regression
test).
