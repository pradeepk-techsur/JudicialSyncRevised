---
phase: 3
status: clean
blockers: 0
warnings: 0
files_reviewed: 7
files_reviewed_list:
  - src/app/api/cases/[id]/discrepancies/route.ts
  - src/services/discrepancies.ts
  - src/services/discrepancies.test.ts
  - src/services/objections.ts
  - src/hooks/useJuryPackage.ts
  - src/hooks/useAcknowledgeDiscrepancy.ts
  - src/hooks/juryPackageError.ts
  - src/components/exhibit/DiscrepancyBanner.tsx
reviewed_at: 2026-10-07T14:50:38Z
iteration: 2
---

# Phase 3 Code Review — Iteration 2 (re-review)

Re-review scoped to the three fix commits (919346c, 6abbb34, 320edcb) and the files
they touched. All three prior findings — B1 (sealed-exhibit leak on the case-wide
discrepancy feed), W1 (non-atomic flag creation on the objection write paths), and W3
(Exhibit Detail banner mounting the full jury-package poll) — are verified fixed by
reading the fixes, not trusting the commit messages. No fix-introduced regressions
found. `tsc --noEmit` clean; discrepancy + objection unit suites green (18/18, incl.
the new sealed-exhibit regression test). Status: **clean**.

## Prior findings — verification

### B1 (security) — FIXED ✓
- `getDiscrepancies(caseId, requestingUserRole)` now adds `exhibit: { isSealed: false }`
  to the `findMany` WHERE for any role that fails `canViewSealed` (discrepancies.ts:163-175),
  mirroring the `getExhibits` sealed-exclusion pattern exactly. The relational predicate is
  valid — `DiscrepancyFlag` carries the `exhibit Exhibit @relation` (schema.prisma:251).
- The route parses `X-User-Role` via `parseRequestingRole` (fails CLOSED to ATTORNEY on a
  missing/invalid header, visibility.ts:36-41) and threads the role through
  (route.ts:41,48) — now consistent with its sibling read paths.
- The sole caller is the route; signature change has no other consumers (`grep` confirms
  only route.ts + tests call `getDiscrepancies`). Tests updated to pass a role; new
  regression `getDiscrepancies hides sealed-exhibit flags...` asserts a sealed ADMITTED
  custody-less exhibit's flag is visible to JUDGE and absent for ATTORNEY — passes.
- Downstream consumers (`useDiscrepancyCount` → sidebar pill, `JuryPackageNavItem`) now
  receive a server-filtered list, so W2's informational concern resolves through B1 with
  no client-side sealed filter reintroduced. Server-truth stance preserved.

### W1 (bug/correctness) — FIXED ✓
- `recordObjection` and `recordRuling` now acquire
  `pg_advisory_xact_lock(advisoryLockKey(exhibitId))` as the first statement inside their
  `$transaction` (objections.ts:110, :192), identical in key function and call form to the
  status (status.ts:49) and custody (custody.ts:92) paths. All four per-exhibit writers now
  contend on the same key, so the `evaluateDiscrepancies` find-then-create can no longer
  interleave between two concurrent rulings.
- Both paths correctly re-read state INSIDE the lock: `recordObjection` re-checks the
  objectable-status projection (objections.ts:115-121); `recordRuling` resolves `exhibitId`
  (for the key) outside the tx, then re-reads the thread and its UNRESOLVED status inside the
  lock before writing (objections.ts:195-203). The role check stays before the lock so an
  unauthorized caller never contends — correct ordering.
- Lock-ordering/deadlock check: each transaction only ever holds one exhibit's single lock,
  so no cross-lock acquisition cycle is possible — no deadlock risk introduced.
- Error-propagation check: moving the 422 INVALID_OBJECTION_TARGET and 409
  OBJECTION_ALREADY_RESOLVED throws inside `$transaction` still surfaces them (a throw rolls
  back and propagates to the route's `errorResponse`). 404 EXHIBIT_NOT_FOUND / OBJECTION_NOT_FOUND
  remain correctly ordered relative to the transaction. objections.test.ts 8/8 green.
- Note (carried from iteration 1, not a new finding): the fix closes the window by
  serialization rather than a DB uniqueness backstop; the race is not deterministically
  unit-reproducible, so the serialization guarantee warrants confirmation under
  concurrent-load UAT — the fixer flagged this as `requires human verification`.

### W3 (degraded) — FIXED ✓
- Acknowledge mutation extracted into standalone `useAcknowledgeDiscrepancy`
  (useAcknowledgeDiscrepancy.ts) that mounts NO `useQuery` — only `useMutation` — with the
  same three-family invalidation (`jury-package` / `discrepancy-count` / `exhibit-history`)
  as `useJuryPackage.invalidateAll`.
- `DiscrepancyBanner` now imports the standalone hook (DiscrepancyBanner.tsx:7,29); Exhibit
  Detail therefore no longer instantiates the 4s write-capable `/api/cases/:id/jury-package`
  poll. Mutation-object usage is unchanged in shape (`mutateAsync`, `isPending` — both
  standard `useMutation` members), so the component behaves identically.
- `useJuryPackage` delegates its `acknowledge` to the same standalone hook
  (useJuryPackage.ts:104), so the jury screen and the banner share one acknowledge path with
  one invalidation set — no drift.

## Regression sweep (fix-introduced)

- **Shared error module (`juryPackageError.ts`):** `JuryPackageError`/`BlockingExhibit`/
  `parseError` were extracted to one module; both `useJuryPackage` and
  `useAcknowledgeDiscrepancy` re-export the SAME class from it, so `instanceof JuryPackageError`
  remains valid regardless of import path (no duplicate-class hazard). Verified consumers:
  `JuryPackageDraft` (imports `JuryPackageError`/`BlockingExhibit` from `useJuryPackage` →
  re-exported, line 13), `JuryPackageEmpty` (same), `DiscrepancyBanner` (imports from
  `useAcknowledgeDiscrepancy` → re-exported, line 43). All resolve.
- **Dangling imports/refs:** `useJuryPackage` still consumes `parseError`, `JuryPackageError`,
  `BlockingExhibit`, `useMutation`, `activeUserId`, `queryClient` — no orphaned imports left
  by the extraction. `tsc --noEmit` clean confirms no unresolved symbols.
- **`getDiscrepancies` signature drift:** only consumer is the route (+tests), all updated.
- **No source regressions elsewhere:** only the three fix commits (+ a docs commit) touched
  source; working tree clean apart from one unrelated untracked planning fragment.

## Cross-file seams re-checked
- `GET /api/cases/:id/discrepancies` ↔ `getDiscrepancies(id, role)` ↔ `useDiscrepancyCount`/`JuryPackageNavItem` — OK (B1 sealed guard now present; server-filtered)
- `getDiscrepancies` sealed predicate ↔ `DiscrepancyFlag.exhibit` relation (schema.prisma:251) — OK (relational filter valid)
- `recordObjection`/`recordRuling` advisory lock ↔ `advisoryLockKey` (shared w/ status.ts, custody.ts) — OK (same key/form, single-lock-per-tx, no deadlock)
- `useAcknowledgeDiscrepancy` ↔ `DiscrepancyBanner` (mutateAsync/isPending shape) + `useJuryPackage.acknowledge` delegation — OK
- `JuryPackageError`/`BlockingExhibit`/`parseError` single source (`juryPackageError.ts`) ↔ re-exports from both hooks ↔ Draft/Empty/Banner `instanceof` consumers — OK
- `POST /api/discrepancies/:id/acknowledge` payload (`{actorUserId, justification}`) ↔ standalone hook mutationFn — OK (unchanged)
