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
