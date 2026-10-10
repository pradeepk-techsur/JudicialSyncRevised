# Phase 08 — Deferred / Out-of-Scope Items

Items discovered during plan execution that are OUTSIDE the current plan's scope
(sibling-plan drift on the shared working tree, pre-existing failures in
unrelated files). Logged per the executor SCOPE BOUNDARY rule — NOT fixed by the
discovering plan.

## 08-04 (Dark-navy Sidebar + simplified Header)

- **`src/services/exhibits.ts:303` and `:391` — TS2554 "Expected 4 arguments, but got 2."**
  Discovered when running `npm run build` for 08-04 Task 1's verification. The
  errors are in `exhibits.ts` calling `toListRow(...)`, whose signature was
  changed (to 4 params) by a concurrent Wave-1 plan that modified
  `src/lib/types.ts` / the shared `toListRow` mapper. `exhibits.ts`,
  `types.ts`, `seed.ts`, `juryPackage.ts`, `custody.test.ts`, and the new
  `custodyByCustodian.ts` / shared-component dirs are all uncommitted
  sibling-plan work present in the shared working tree at execution time.
  08-04 touches ONLY `src/components/shell/*` + `e2e/app-shell.spec.ts`; its own
  files compile and the Sass layer builds (`✓ Compiled successfully`). The TS
  check failure is pre-existing drift owned by those sibling plans and is left
  for them / the phase's post-plan gate to converge. This is the recurring
  shared-working-tree hazard already documented repeatedly in STATE.md
  (06-03, 06-07, 06-08, 07-05).
  - **RESOLVED during 08-04 Task 2:** by the time 08-04's Task 2 verification ran,
    the sibling plan had committed its `toListRow`/`types.ts` reconciliation —
    `npx tsc --noEmit` and `npm run build` both returned EXIT=0 on the merged
    HEAD. No 08-04 file was ever involved in the failure or the fix.

## 08-02 (custody-transfer server-side role gate)

- **`src/services/exhibits.test.ts:300` — TS2345: `addMember(newer.id, ...)`
  rejected because the JuryPackage object type now carries
  `finalizationRequestedAt`/`finalizationRequestedBy`.**
  Surfaced when running `npm run build` as 08-02's plan-level gate. The failing
  line is in `exhibits.test.ts` (a sibling plan's file — 08-02 touches ONLY
  `src/services/custody.ts`, `src/services/custody.test.ts`, and
  `src/app/api/exhibits/[id]/events/custody/route.test.ts`). The mismatch stems
  from 08-01's `JuryPackage.finalizationRequestedAt/By` schema/type addition
  interacting with an `addMember` test helper in the shared working tree. 08-02's
  own three files are tsc-clean in isolation and its full test suite (10 service
  + 7 route = 17) is green. Left for the owning sibling plan / phase post-plan
  gate to converge — same shared-working-tree hazard as above. (Note: a bare
  `tsc --noEmit` over the tree passes; only `next build`'s stricter test-file
  inclusion surfaces this, so it is invisible until the aggregated phase gate.)

## 08-13 shared-working-tree observations (out of scope — NOT fixed by 08-13)
- `src/components/exhibit/ExhibitHeader.tsx` (sibling 08-12 WIP, uncommitted): tsc error TS2322 — passes an `objections` prop to `DiscrepancyBanner` that the committed DiscrepancyBanner signature does not yet accept. 08-12 owns both files; converging their own two edits resolves it. 08-13 did not touch either file.
- `src/app/command-center/page.tsx` (sibling WIP, uncommitted): tsc errors present. Out of 08-13 scope (right-rail cards + Timeline + exhibit page.tsx only).

## 08-11 shared-working-tree observations (out of scope — NOT fixed by 08-11)
- **`src/app/command-center/page.tsx:33` — TS2322**: `useRecentActivity()` now returns
  `UseQueryResult<ActivityResponse>` (the `{recentActivity, statusCounts}` shape 08-10
  is wiring in), but `command-center/page.tsx` still consumes it as
  `RecentActivityEntry[]`. The mismatch comes entirely from uncommitted sibling-plan
  drift in `src/hooks/useRecentActivity.ts` + `src/app/api/cases/[id]/activity/route.ts`
  (08-10's statusCounts wiring, deliberately deferred there per STATE.md). 08-11 touches
  ONLY `src/components/case/*`, `src/app/case/*`, and the two case-workspace e2e specs —
  none of the files in this error path. `npx tsc --noEmit` passes clean over the whole tree
  (including all 08-11 files); only `next build`'s stricter Turbopack type-check surfaces
  the sibling page/hook mismatch. Left for 08-10 / the phase post-plan gate to converge —
  the recurring shared-working-tree hazard documented throughout STATE.md.

## 08-12 (Exhibit Detail header + discrepancy banner)
- **`src/app/command-center/page.tsx:33` — TS2322: `UseQueryResult<ActivityResponse>` not assignable to `UseQueryResult<RecentActivityEntry[]>`.**
  Surfaced running `npx tsc --noEmit` as 08-12's Task 1/2 gate. The failing file is
  the Command Center page — 08-10's scope (the deferred activity-route
  `statusCounts` amendment STATE.md recorded under 08-06 Task 3 as "route wiring
  into the activity response deliberately DEFERRED to 08-10", which changes the
  activity response from a bare array to `{recentActivity, statusCounts}`). The
  error pre-exists at HEAD (verified: `git stash` my three files → tsc still reports
  exactly 1 error, in `command-center/page.tsx`). 08-12 touches ONLY
  `src/components/exhibit/ExhibitHeader.tsx(.scss)`,
  `src/components/exhibit/DiscrepancyBanner.tsx(.scss)`, and
  `e2e/exhibit-detail.spec.ts`; those files are tsc-clean in isolation and add zero
  new errors. Left for 08-10 / the phase post-plan gate to converge — recurring
  shared-working-tree hazard documented throughout STATE.md.
