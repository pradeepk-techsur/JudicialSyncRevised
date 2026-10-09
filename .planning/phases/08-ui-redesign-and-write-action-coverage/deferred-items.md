# Phase 08 — Deferred Items (out-of-scope discoveries)

## 08-03 run (2026-10-09)

- **Pre-existing full-project `tsc` error in `src/services/exhibits.ts` (line ~147)** — `ExhibitListRow` in `src/lib/types.ts` gained required `juryPackageEligibility` / `hasUnresolvedObjection` / `isSealed` fields (a parallel in-flight Phase 8 plan), but `exhibits.ts` was not updated in step. OUT OF SCOPE for 08-03 (pure presentational component plan; never touches services/types). The 08-03-owned files in `src/components/shared/` produce zero tsc errors in the full-project check. Recurrence of the STATE.md-documented shared-working-tree hazard.
- **No ESLint configured in this project** — the plan's `<verify>` blocks call `npx eslint`, but the repo has no `eslint.config.*`/`.eslintrc` and no eslint devDependency; Next 16 also removed `next lint`. Matching Phase 6/7 precedent, the authoritative gate for this project is `tsc --noEmit` + `next build`, which 08-03 used instead.
