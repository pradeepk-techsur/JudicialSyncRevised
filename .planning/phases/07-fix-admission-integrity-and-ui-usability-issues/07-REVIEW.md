---
phase: 7
status: issues_found
blockers: 1
warnings: 2
files_reviewed: 24
files_reviewed_list:
  - prisma/migrations/20261009010505_add_jury_package_exhibit_exclusion/migration.sql
  - prisma/schema.prisma
  - src/app/api/cases/[id]/discrepancies/route.ts
  - src/app/api/cases/[id]/jury-package/route.ts
  - src/app/api/jury-package/[id]/exhibits/[exhibitId]/exclude/route.ts
  - src/app/api/jury-package/[id]/finalize/route.ts
  - src/app/jury-package/page.tsx
  - src/components/assistant/ExampleChips.tsx
  - src/components/case/ExhibitTable.tsx
  - src/components/command-center/DiscrepanciesPanel.tsx
  - src/components/command-center/RecentActivityPanel.tsx
  - src/components/exhibit/DiscrepancyBanner.tsx
  - src/components/jury/AcknowledgeInline.tsx
  - src/components/jury/JuryPackageDraft.tsx
  - src/components/shell/Header.tsx
  - src/data/seed.ts
  - src/hooks/useDiscrepancyCount.ts
  - src/hooks/useJuryPackage.ts
  - src/lib/errors.ts
  - src/lib/types.ts
  - src/lib/validation/eventPayloads.ts
  - src/services/custody.ts
  - src/services/discrepancies.ts
  - src/services/events.ts
  - src/services/juryPackage.ts
  - src/services/objections.ts
  - src/services/status.ts
reviewed_at: 2026-10-09T02:10:57Z
iteration: 1
---

# Phase 7 Code Review

## BLOCKERs

### B1: `finalizeJuryPackage` does not block a retained sealed/ex-parte row server-side — the sealed-exclusion hard-block is enforced ONLY in the UI
- **File:** src/services/juryPackage.ts:453-496 (finalize gate); contrast src/components/jury/JuryPackageDraft.tsx:105-107 (UI-only `hasCritical` block)
- **Category:** security / bug (server-authority gap)
- **Evidence:**
  Phase 7's explicit, highest-severity goal (07-07-PLAN §Objective line 69, UX-Mockup line 97) is that a sealed/ex-parte row "never again count[s] as included, **finalizable**, or assistant-visible," and that "The Finalize control stays disabled while any such row is present, same as for an open discrepancy."

  The client enforces this: `JuryPackageDraft` computes `criticalRows = exhibits.filter(r => r.isSealed)` and `disableFinalize = hasOpen || hasCritical || finalizePending` (lines 105-107), so the button is disabled.

  But `finalizeJuryPackage` — the server authority — only queries `status: 'INCLUDED'` rows and blocks *solely* on OPEN discrepancy flags:
  ```ts
  const members = await tx.juryPackageExhibit.findMany({
    where: { juryPackageId, status: 'INCLUDED' }, ...
  });
  for (const m of members) {
    await evaluateDiscrepancies(m.exhibitId, tx);
    const active = await tx.discrepancyFlag.findMany({
      where: { exhibitId: m.exhibitId, status: 'OPEN' }, ...
    });
    if (active.length > 0) blockingExhibits.push(...);
  }
  ```
  There is **no `isSealed` check**. A retained legacy sealed-but-ADMITTED row is deliberately kept as an `INCLUDED` member (reconcileDraftMembership, lines 263-289, and the service's own doc-comment lines 35-39). Such a row that has custody and no unresolved objection carries NO OPEN discrepancy flag, so the finalize gate passes it.

  Concrete failing input: the state is directly reachable and is exactly what the exclude route test constructs — `src/app/api/jury-package/[id]/exhibits/[exhibitId]/exclude/route.test.ts:66-98` creates a sealed+ADMITTED exhibit and a `juryPackageExhibit` row with `status: 'INCLUDED'` in a DRAFT package. In that state, a direct `POST /api/jury-package/:id/finalize` (bypassing the disabled UI button — the server is the authority, the button is a hint) finalizes a package that permanently contains an ex parte sealed exhibit. The `finalizeJuryPackage` service has no sealed guard, so nothing on the server rejects it.

  This is the precise originating defect Phase 7 exists to close ("a sealed exhibit could previously be admitted into a package and shown like any other," juryPackage.ts:29-30): structurally new sealed members are now impossible, but a *retained legacy* sealed member remains server-side-finalizable until a human happens to click Remove — the server never enforces the "not finalizable" half of the goal.
- **Fix direction:** In `finalizeJuryPackage`'s membership loop, also treat any INCLUDED member whose exhibit `isSealed === true` as a hard blocker (join `exhibit.isSealed` into the `findMany` select and push it onto `blockingExhibits`, ideally with a distinct code/reason so the route surfaces "remove ex parte material first"), so finalize fails server-side with the same posture the UI shows. Add a service-layer test asserting a package with a retained sealed INCLUDED row cannot be finalized even with zero open discrepancies.

## WARNINGs

### W1: Seed loader adds ~11s of real `setTimeout` sleeps to every seed/boot run
- **File:** src/data/seed.ts:169-170 (`sleep` helper) + nine `await sleep(1200)` call sites (lines ~204, 221, 240, 262, 291, 311, 345, 373, 395)
- **Evidence:** To make the Command Center date+time fix visually verifiable, the seed now inserts a real 1.2s delay between each exhibit's history (~9 × 1200ms ≈ 10.8s added to seed wall-time). This is deliberate and documented (lines 146-168), and the gate shows the seed test taking ~10.9-21.9s. It is not a correctness bug, but it materially slows every `npm run seed` / Docker boot / test that seeds, and the stated staggering benefit is undercut by the comment's own admission (lines 161-167) that STATUS_CHANGE events still all land at real-now because `status.ts` was intentionally not given a `recordedAt` override — so within a single exhibit the events are NOT staggered, only between exhibits. The cost (fixed multi-second boot delay) is paid in full while the staggering is partial. Flagging for a judgment call on whether the real-time sleeps are worth the boot-time cost vs. passing explicit staggered `recordedAt` values with no sleep.

### W2: `ALTER TYPE ... ADD VALUE` on the `event_type` enum is the first such migration in the repo
- **File:** prisma/migrations/20261009010505_add_jury_package_exhibit_exclusion/migration.sql:5
- **Evidence:** `ALTER TYPE "event_type" ADD VALUE 'JURY_PACKAGE_EXHIBIT_EXCLUDED';` is the only `ADD VALUE` in prisma/migrations (all prior enum work used `CREATE TYPE`). On PostgreSQL < 12, `ADD VALUE` cannot run inside a transaction block, and a newly-added enum value cannot be used in the same transaction that adds it. The migration here only adds the value (it is used by application code at runtime, not in the same migration), and the phase build+test gate passed with this migration applied, so this is NOT currently broken. Noted only so that if the deployment target is ever an older Postgres or Prisma is configured to wrap migrations differently, this is the line to watch. No action needed if the target remains the gate's Postgres version.

## Cross-file seams checked
- `POST /api/jury-package/:id/exhibits/:exhibitId/exclude` (route) ↔ `excludeJuryPackageExhibit` (service): arg shape (juryPackageId/exhibitId/actorUserId/reason/note) matches — OK
- `useJuryPackage().exclude` mutation ↔ exclude route payload `{ actorUserId, reason }` ↔ page.tsx `onExclude({ juryPackageId, exhibitId, reason: 'SEALED_EXPARTE' })`: three-layer shape agrees — OK
- `JuryPackageExhibitView` (service, +isSealed/+status) ↔ `useJuryPackage` re-export ↔ `JuryPackageDraft` consumption (`row.isSealed`): in sync — OK
- `JURY_PACKAGE_EXHIBIT_EXCLUDED` payload schema (eventPayloads.ts enum+note) ↔ `excludeJuryPackageExhibit` recordEvent payload `{ juryPackageId, exhibitId, reason, note }`: aligned (07-03 placeholder free-text reason correctly tightened to enum) — OK
- migration enum `jury_package_exhibit_status {INCLUDED,EXCLUDED}` + new columns ↔ service reads/writes `status`/`excludedAt`/`excludedBy`/`exclusionReason`: in sync — OK
- `recordedAt` override: events.ts param ↔ custody.ts / objections.ts passthrough ↔ seed.ts call sites: threaded consistently; `status.ts` deliberately NOT given the override (seed accounts for this) — OK
- ExampleChips `exhibits.find(e => e.currentStatus === 'ADMITTED' | e.currentCustodianName)` ↔ `ExhibitListRow` (types.ts:9-18 has both fields): seam valid, no silent-undefined — OK
- RecentActivityPanel `e.exhibitLabel` ↔ `RecentActivityEntry` (activity.ts:34 has exhibitLabel): OK
- Header + JuryPackageDraft + DiscrepancyBanner all read `useDiscrepancyCount` / `CaseDiscrepancyFlag` (+justification): shape consistent, DTO omits `justification` for OPEN (undefined → dropped by JSON) — OK
- F12 admission gate (status.ts:96-117) ↔ `AdmissionBlockedError` (errors.ts:88-97, details.reasons[]) ↔ seed fixtures P-2/P-3 (never attempt ADMITTED) ↔ assertSeedIntegrity (checks OFFERED/OBJECTED-no-custody instead of old ADMITTED checks): coherent — OK
- Jury finalize UI gate: `disableFinalize = hasOpen || hasCritical` (UI) vs. server `finalizeJuryPackage` (OPEN-only) — MISMATCH → see B1
