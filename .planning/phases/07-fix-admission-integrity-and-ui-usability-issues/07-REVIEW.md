---
phase: 7
status: issues_found
blockers: 0
warnings: 1
files_reviewed: 5
files_reviewed_list:
  - src/services/juryPackage.ts
  - src/services/juryPackage.test.ts
  - src/app/api/jury-package/[id]/finalize/route.ts
  - src/app/api/jury-package/[id]/finalize/route.test.ts
  - src/components/jury/JuryPackageDraft.tsx
reviewed_at: 2026-10-09T02:15:42Z
iteration: 2
---

# Phase 7 Code Review

Re-review scope (iteration 2): verify the fixer's B1 resolution (commit 8745a07)
and look for fix-introduced regressions. Reviewed the three fixer-touched files
(`src/services/juryPackage.ts`, `src/services/juryPackage.test.ts`,
`src/app/api/jury-package/[id]/finalize/route.ts`) plus the two direct consumers
of the new error path (the finalize route test and `JuryPackageDraft.tsx`, the
sole UI consumer of `finalizeError`). Prior W1 (seed sleeps) and W2 (enum
`ADD VALUE`) were disputed/left-unchanged in iteration 1, live in files the fixer
did not touch, and are out of this iteration's scope.

## B1 verification — FIXED (confirmed, not merely claimed)

Read `finalizeJuryPackage` (juryPackage.ts:437-525) line by line against the
iteration-1 fix direction:

- **Sealed data joined:** the membership `findMany` now selects
  `exhibit.isSealed` (line 467). ✓
- **Hard block runs BEFORE the discrepancy loop:** the sealed filter + throw is
  lines 480-489; the OPEN-flag loop starts at line 493. A retained sealed member
  can never reach the discrepancy loop, so the OPEN-only gate can never wrongly
  pass it. ✓
- **Correct error:** `ConflictError('JURY_PACKAGE_SEALED_EXHIBIT_PRESENT', …,
  { sealedExhibits })` — distinct code, maps to HTTP 409 via `ConflictError`
  (errors.ts:44-48), `details.sealedExhibits` carries `{exhibitId, exhibitLabel}`
  per blocker. ✓
- **Scope is exactly INCLUDED members:** the `findMany` filters
  `status: 'INCLUDED'` (line 464), so an EXCLUDED (already-remediated) row is
  never treated as a sealed blocker — consistent with F13 point 7. ✓
- **No regression to the OK path:** the "a sealed exhibit is never a member via
  normal initiate" invariant (computeJuryCandidates `isSealed: false`) is
  untouched; the existing test `F13: a sealed exhibit is NOT a member, so its
  OPEN discrepancy does not block finalize` (test.ts:256-282) still finalizes
  successfully because that sealed exhibit is genuinely not a member row — the
  new gate only fires on retained/legacy INCLUDED sealed rows. ✓
- **Service test added and genuinely exercises the gap:** test.ts:284-332 admits
  the sealed exhibit *with custody* (`admitClean`) so it carries ZERO open
  discrepancies, asserts `openFlags === 0` (the exact state the old OPEN-only gate
  would have passed), then asserts finalize throws `ConflictError` with code
  `JURY_PACKAGE_SEALED_EXHIBIT_PRESENT`, `details.sealedExhibits` naming the row,
  and that the package stays `DRAFT`. This is a correct, non-tautological
  regression guard. ✓
- `tsc --noEmit` clean (re-run this iteration, EXIT=0). ✓

The server-authority integrity hole B1 named is closed. The data-corruption risk
(a finalized, immutable package permanently containing ex parte material reachable
via a direct POST) is eliminated.

## BLOCKERs

None.

## WARNINGs

### W1: The new `JURY_PACKAGE_SEALED_EXHIBIT_PRESENT` 409 is never surfaced in the UI — a finalize-capable role that cannot see the sealed row clicks Finalize and gets silent no-op feedback
- **File:** src/components/jury/JuryPackageDraft.tsx:113-117 (and 152-166); interacts with src/services/juryPackage.ts:149-160 (`toView` sealed role filter) and the new throw at juryPackage.ts:483-489
- **Category:** bug (UX / error-surfacing gap exposed by the B1 fix)
- **Evidence:**
  Sealed visibility (`SEALED_VISIBLE_ROLES`, visibility.ts) is JUDGE / CHAMBERS_STAFF / ADMIN. Finalize roles (`FINALIZE_ROLES`, JuryPackageDraft.tsx:32) are DEPUTY / CLERK / ADMIN. The overlap that can *see* a sealed row is only ADMIN; **DEPUTY and CLERK can finalize but cannot see sealed rows.**

  For a DEPUTY/CLERK viewing a DRAFT that contains a retained legacy sealed INCLUDED member (exactly the B1 state), `toView` drops that row (juryPackage.ts:158-160: `isSealed && !canViewSealed(role)`), so their `exhibits` array has no sealed row → `criticalRows` is empty (JuryPackageDraft.tsx:105) → `hasCritical === false` → `disableFinalize` is false. **The Finalize button is enabled.** They click it; the server (correctly, per the B1 fix) returns `JURY_PACKAGE_SEALED_EXHIBIT_PRESENT` 409 — nothing is finalized, so **there is no integrity failure**. But `staleBlockers` (JuryPackageDraft.tsx:113-117) only renders a banner when `finalizeError.code === 'JURY_PACKAGE_DISCREPANCIES_OPEN'`; for the new sealed code it evaluates to `null`, so no `InlineNotification` is shown. `finalizeError` has no other consumer (grep: it is read only here). Net effect: the button spins, re-enables on the `onSettled` refetch, and the user sees no explanation and has no visible row to Remove — a silent dead-end.

  This is strictly a degraded-UX path, not a data defect: the server gate the fix added is the authority and it holds. It is a WARNING rather than a BLOCKER because the integrity outcome is correct (no ex parte material is ever finalized); only the feedback is missing, and only for the DEPUTY/CLERK-cannot-see-sealed combination (ADMIN sees the row, so `hasCritical` disables the button and routes them to Remove; a JUDGE cannot finalize at all).

  Uncertainty noted: whether this reaches a real user depends on a retained/legacy sealed INCLUDED row actually existing in a case a DEPUTY/CLERK opens. Such rows are precisely the scenario F13/B1 exist to handle, so the path is reachable, but it is an edge state rather than the common flow.
- **Fix direction:** Extend the `JuryPackageDraft` finalize-error handling to also recognize `JURY_PACKAGE_SEALED_EXHIBIT_PRESENT` and render an explanatory banner (e.g. "This package still contains sealed/ex parte material that must be removed before finalizing; ask a judge or administrator to remove it"), since a DEPUTY/CLERK cannot see or Remove the row themselves. This is purely additive UI; no server change needed.

## Cross-file seams checked
- `finalizeJuryPackage` sealed gate (juryPackage.ts:480-489) ↔ `ConflictError` (errors.ts:44-48 → HTTP 409, `details` passthrough) ↔ finalize route `errorResponse` (route.ts:56): sealed 409 + `details.sealedExhibits` propagate correctly — OK
- `finalizeJuryPackage` membership `findMany` `status:'INCLUDED'` ↔ F13 EXCLUDED-row semantics (excludeJuryPackageExhibit sets EXCLUDED): an already-excluded sealed row is NOT re-flagged by the new gate — OK
- New service test (test.ts:284-332) ↔ actual throw shape (code + `details.sealedExhibits[].exhibitId`): assertions match the thrown object exactly — OK
- Existing finalize route tests (route.test.ts:137-180): unchanged behavior for the OPEN-discrepancy path; the fix did not alter the `JURY_PACKAGE_DISCREPANCIES_OPEN` ordering or payload — OK
- `finalizeError` (page.tsx:75 → JuryPackageDraft.tsx:80) ↔ UI rendering: ONLY handles `JURY_PACKAGE_DISCREPANCIES_OPEN`; new `JURY_PACKAGE_SEALED_EXHIBIT_PRESENT` code is parsed but never displayed — MISMATCH → see W1
- UI `hasCritical`/`disableFinalize` (JuryPackageDraft.tsx:105-107) ↔ server sealed gate: aligned for sealed-visible roles (ADMIN); diverges for DEPUTY/CLERK who cannot see the row (server still blocks correctly, UI just can't pre-disable or explain) → see W1
