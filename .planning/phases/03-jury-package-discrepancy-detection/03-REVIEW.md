---
phase: 3
status: fixes_applied
blockers: 1
warnings: 3
files_reviewed: 48
files_reviewed_list:
  - prisma/migrations/20261007134940_phase3_discrepancy_jury_package/migration.sql
  - prisma/schema.prisma
  - src/app/api/cases/[id]/discrepancies/route.ts
  - src/app/api/cases/[id]/jury-package/route.ts
  - src/app/api/discrepancies/[id]/acknowledge/route.ts
  - src/app/api/exhibits/[id]/discrepancies/route.ts
  - src/app/api/jury-package/[id]/finalize/route.ts
  - src/app/jury-package/page.tsx
  - src/app/globals.css
  - src/components/case/DiscrepancyBadge.tsx
  - src/components/case/ExhibitTable.tsx
  - src/components/exhibit/DiscrepancyBanner.tsx
  - src/components/exhibit/ExhibitHeader.tsx
  - src/components/jury/AcknowledgeInline.tsx
  - src/components/jury/JuryPackageDraft.tsx
  - src/components/jury/JuryPackageEmpty.tsx
  - src/components/jury/JuryPackageFinalized.tsx
  - src/components/shell/Header.tsx
  - src/components/shell/JuryPackageNavItem.tsx
  - src/components/shell/Sidebar.tsx
  - src/data/seed.ts
  - src/hooks/useDiscrepancyCount.ts
  - src/hooks/useJuryPackage.ts
  - src/lib/apiError.ts
  - src/lib/discrepancyLabels.ts
  - src/lib/errors.ts
  - src/lib/types.ts
  - src/services/custody.ts
  - src/services/discrepancies.ts
  - src/services/exhibits.ts
  - src/services/history.ts
  - src/services/juryPackage.ts
  - src/services/objections.ts
  - src/services/status.ts
  - src/app/api/case/route.test.ts
  - src/app/api/cases/[id]/discrepancies/route.test.ts
  - src/app/api/cases/[id]/exhibits/search/route.test.ts
  - src/app/api/cases/[id]/jury-package/route.test.ts
  - src/app/api/discrepancies/[id]/acknowledge/route.test.ts
  - src/app/api/jury-package/[id]/finalize/route.test.ts
  - src/data/seed.test.ts
  - src/services/discrepancies.test.ts
  - src/services/exhibits.test.ts
  - src/services/history.test.ts
  - src/services/juryPackage.test.ts
  - e2e/app-shell.spec.ts
  - e2e/case-workspace-discrepancies.spec.ts
  - e2e/exhibit-detail.spec.ts
  - e2e/jury-package.spec.ts
reviewed_at: 2026-10-07T14:41:48Z
iteration: 1
---

# Phase 3 Code Review

The event-sourcing seams are strong: `evaluateDiscrepancies` is wired into all three
write paths (`status.ts`/`objections.ts`/`custody.ts`) inside the same transaction as
`recordEvent`; acknowledge writes the ledger event + flag flip atomically; the finalize
gate re-evaluates fresh over full membership (incl. sealed) and is proven honest by test.
The one material defect is a sealed-exhibit information-disclosure hole on the case-wide
discrepancy feed — the single read path in this phase that was NOT given the sealed guard
its siblings (`getExhibits`, `getExhibitHistory`, `/exhibits/:id/discrepancies`) all carry.

## BLOCKERs

### B1: Case-wide discrepancy route leaks sealed-exhibit flags to unauthorized roles
- **File:** src/app/api/cases/[id]/discrepancies/route.ts:29-45 (service: src/services/discrepancies.ts:156-161)
- **Category:** security
- **Evidence:** `GET /api/cases/:id/discrepancies` calls `getDiscrepancies(caseId)`, whose
  query is `discrepancyFlag.findMany({ where: { caseId, status: { in: ['OPEN','ACKNOWLEDGED'] } } })`
  — there is **no** `canViewSealed` / role predicate anywhere in the route or the service,
  and the route never reads `X-User-Role` (contrast `parseRequestingRole` used by the
  jury-package and exhibit-discrepancies routes). Every sibling read path in this phase was
  deliberately guarded: `getExhibits`/`searchExhibits` filter via `loadDiscrepancyFlagsByExhibit`
  on already-sealed-filtered ids (exhibits.ts:159-164, cites threat T-03-09),
  `getExhibitHistory` inherits the guard from `getExhibit` (history.ts:127-136), and
  `/api/exhibits/:id/discrepancies` calls `getExhibit(id, role)` first (route.ts:16-27).
  This route is the sole exception. Its two consumers both **document the opposite guarantee
  as if it were true**: `useDiscrepancyCount.ts:30-32` ("a sealed exhibit's flags won't be
  returned for an unauthorized role") and `JuryPackageNavItem.tsx:11-12` ("The count is
  role-scoped"). CONTEXT line 44 states the Sealed-Exhibit Invisibility pattern applies here.
  Concrete leak: a sealed, ADMITTED exhibit with no custody row produces an OPEN
  `ADMITTED_NO_CUSTODIAN` flag; an ATTORNEY/DEPUTY/CLERK then sees it in the sidebar count
  pill (`openCount` includes it) and can read the flag's `exhibitId`, `ruleCode`, and
  `details` straight off the JSON response — disclosing the existence and defect of an
  exhibit they must never see. Currently latent only because the demo seed's sole sealed
  exhibit (`S-1`) is admitted *with* a full custody chain and no unresolved objection
  (seed.ts:349-373), so it carries no active flag today — the invariant is broken, the
  exploit is one seed/data change away.
- **Fix direction:** Make the route sealed-aware like its siblings — parse the requesting
  role and have `getDiscrepancies` accept it and exclude flags whose exhibit is
  `isSealed && !canViewSealed(role)` (e.g. add an   `exhibit: { isSealed: false }` relational
  predicate when the role can't view sealed, mirroring the `getExhibits` pattern). Keep the
  jury-package finalize gate reading membership directly (it already does), so gate honesty
  is unaffected.

**Resolution:** fixed (919346c) — `getDiscrepancies(caseId, requestingUserRole)` now adds
`exhibit: { isSealed: false }` for roles that fail `canViewSealed`, and the route parses
`X-User-Role` via `parseRequestingRole` and passes it through, mirroring the sibling read
paths. New regression test in `discrepancies.test.ts` asserts a sealed ADMITTED/custody-less
exhibit's flag is visible to JUDGE but absent for ATTORNEY. tsc clean; targeted + full suite green.

## WARNINGs

### W1: `evaluateDiscrepancies` find-then-create is not atomic → possible duplicate OPEN flags
- **File:** src/services/discrepancies.ts:119-136
- **Evidence:** The "fires" branch does a `findFirst` for an existing OPEN/ACKNOWLEDGED flag
  and then a `create` if none is found, with no uniqueness backstop — the schema has only a
  non-unique `@@index([exhibitId, ruleCode])` (schema.prisma:257), not a unique constraint.
  The status and custody write paths serialize per-exhibit via `pg_advisory_xact_lock`
  (status.ts:49, custody.ts:92), but `recordObjection`/`recordRuling` (objections.ts:115,182)
  take **no** advisory lock, so two concurrent rulings on the same exhibit can both evaluate,
  both observe no existing flag, and both insert a duplicate OPEN
  `UNRESOLVED_OBJECTION_JURY_ELIGIBLE` row. Low-likelihood in the single-operator demo, but a
  genuine correctness gap (duplicate badges, double-counted sidebar pill). Stated uncertainty:
  the window is narrow and the UI de-dups visually by ruleCode in some places but not in the
  count.
- **Fix direction:** Add a partial unique index on `(exhibitId, ruleCode)` for active
  statuses (or `(exhibitId, ruleCode, status)`) and treat the P2002 as a no-op, or run the
  objection write paths under the same advisory lock the status/custody paths use.

**Resolution:** fixed (6abbb34) — took the second (lock) option: `recordObjection` and
`recordRuling` now acquire the shared `pg_advisory_xact_lock(advisoryLockKey(exhibitId))` at
the top of their transactions and re-check state inside the lock, so all per-exhibit writers
(status / custody / objection / ruling) serialize on one key — closing the concurrent-ruling
window where two `evaluateDiscrepancies` find-then-create paths could both insert a duplicate
OPEN flag. tsc clean; objection + discrepancy tests and full suite green. Commit body carries
`fixed: requires human verification` — the race window is not deterministically reproducible in
a unit test, so the serialization guarantee should be confirmed under concurrent-load UAT.

### W2: `useDiscrepancyCount` sidebar count is case-wide, not scoped to the active case view
- **File:** src/hooks/useDiscrepancyCount.ts:38-55
- **Evidence:** This is secondary to B1 and shares its root cause: once B1 is fixed the count
  becomes role-correct, but note the badge still counts **all** OPEN flags case-wide
  (`openCount = flags.filter(f => f.status === 'OPEN').length`). That matches CONTEXT's
  "case-wide open discrepancies" intent, so this is informational — flagged only so the fixer
  confirms the B1 fix flows through here (the count must drop sealed flags for unauthorized
  roles after the fix) rather than re-introducing client-side filtering.
- **Fix direction:** No change needed beyond B1; verify the count reflects the now-filtered
  server list and do not add a client-side sealed filter (server-truth stance).

**Resolution:** fixed via B1 (919346c) — no code change here. Verified `useDiscrepancyCount`
reads the server list directly (role already in the query key, no client-side sealed filter),
so once `getDiscrepancies` drops sealed flags server-side the `openCount` / sidebar pill are
automatically role-correct. Server-truth stance preserved.

### W3: Exhibit Detail banner instantiates the full jury-package polling query for a mutation
- **File:** src/components/exhibit/DiscrepancyBanner.tsx:29
- **Evidence:** `DiscrepancyBanner` calls `useJuryPackage()` only to obtain the `acknowledge`
  mutation, but that hook unconditionally starts the `['jury-package', caseId, role]` `useQuery`
  with `refetchInterval: 4_000` (useJuryPackage.ts:78-93). Every Exhibit Detail page view now
  issues a 4s poll against `/api/cases/:id/jury-package` (which also runs a DRAFT reconcile
  that MAY write — juryPackage.ts:330) despite the jury package being irrelevant to that
  screen. Functionally correct (acknowledge works; invalidation hits `exhibit-history`), but a
  wasteful background write-capable poll on an unrelated screen. Degraded, not broken.
- **Fix direction:** Extract the acknowledge mutation into its own small hook (or accept an
  injected mutation) so the Exhibit Detail banner doesn't mount the jury-package query/poll.

**Resolution:** fixed (320edcb) — extracted `useAcknowledgeDiscrepancy` (mutation + the same
three-family invalidation, mounts NO query) plus a shared `juryPackageError` module
(`JuryPackageError`/`BlockingExhibit`/`parseError`). `useJuryPackage` now delegates its
`acknowledge` to the standalone hook and re-exports the error types for existing consumers;
`DiscrepancyBanner` imports the standalone hook, so Exhibit Detail no longer mounts the 4s
write-capable jury-package poll. tsc clean; full suite green.

## Cross-file seams checked
- `GET/POST /api/cases/:id/jury-package` ↔ `useJuryPackage` (payload `{actorUserId}`, response `{juryPackage,exhibits}`) — OK
- `POST /api/jury-package/:id/finalize` ↔ `useJuryPackage.finalize` + 409 `details.blockingExhibits` ↔ `BlockingExhibit`/`JuryPackageDraft` stale banner — OK
- `POST /api/discrepancies/:id/acknowledge` ↔ `useJuryPackage.acknowledge` ↔ `AcknowledgeInline`/`DiscrepancyBanner` — OK (422/403/404 mapped via `errorResponse`)
- `GET /api/cases/:id/discrepancies` ↔ `useDiscrepancyCount`/`JuryPackageNavItem` — **B1** (route lacks the sealed guard both consumers' comments assert)
- `GET /api/exhibits/:id/discrepancies` ↔ shared `toDiscrepancyFlagDto` import + `getExhibit` sealed guard — OK
- `DiscrepancyFlagSummary` (lib/types) ↔ juryPackage view / exhibits list / history / `DiscrepancyBadge` / `DiscrepancyBanner` — OK (single definition, single `ruleLabel` source)
- `evaluateDiscrepancies` trigger ↔ status.ts / objections.ts / custody.ts write paths (in-transaction, `event.id` attribution) — OK
- Finalize gate reads membership (incl. sealed) not the role-filtered view — OK (asserted by juryPackage.test.ts:231-254)
- Prisma schema ↔ migration SQL (enums, tables, FKs, `uq_jury_package_exhibit`) — OK
- `roleStore` (`activeUserId`/`users`/`caseNumber`/`role`) ↔ Header / jury components consumers — OK
- Seed reset order (flags → jury rows → jury pkg → projections → ledger → exhibits → users → case) vs FK graph — OK
- Print CSS `.no-print` / `.jury-print-root` ↔ `JuryPackageFinalized` + Header/Sidebar chrome — OK
