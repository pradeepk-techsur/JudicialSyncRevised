---
phase: 8
status: issues_found
blockers: 0
warnings: 3
files_reviewed: 38
files_reviewed_list:
  - prisma/schema.prisma
  - prisma/migrations/20261009120430_add_jury_package_finalization_request/migration.sql
  - src/app/api/cases/[id]/activity/route.ts
  - src/app/api/cases/[id]/attention-feed/route.ts
  - src/app/api/cases/[id]/custody-by-custodian/route.ts
  - src/app/api/jury-package/[id]/request-finalization/route.ts
  - src/app/api/exhibits/[id]/events/custody/route.ts
  - src/app/case/page.tsx
  - src/app/command-center/page.tsx
  - src/app/exhibit/[id]/page.tsx
  - src/app/jury-package/page.tsx
  - src/components/actions/RecordRulingForm.tsx
  - src/components/actions/TransferCustodyForm.tsx
  - src/components/case/ExhibitTable.tsx
  - src/components/command-center/AttentionFeedPanel.tsx
  - src/components/command-center/CustodyAtAGlancePanel.tsx
  - src/components/command-center/JuryPackageSummaryWidget.tsx
  - src/components/command-center/RecentActivityPanel.tsx
  - src/components/command-center/StatCardRow.tsx
  - src/components/command-center/StatusDistributionBar.tsx
  - src/components/exhibit/CustodyCard.tsx
  - src/components/exhibit/DiscrepancyBanner.tsx
  - src/components/exhibit/JuryPackageChecklistCard.tsx
  - src/components/exhibit/ObjectionCard.tsx
  - src/components/exhibit/ExhibitHeader.tsx
  - src/components/jury/JuryPackageDraft.tsx
  - src/components/shared/TwoColorProgressBar.tsx
  - src/components/shell/Header.tsx
  - src/components/shell/Sidebar.tsx
  - src/data/seed.ts
  - src/hooks/useAttentionFeed.ts
  - src/hooks/useCustodyByCustodian.ts
  - src/hooks/useJuryPackage.ts
  - src/hooks/useRecentActivity.ts
  - src/hooks/useRecordRuling.ts
  - src/hooks/useTransferCustody.ts
  - src/lib/errors.ts
  - src/lib/types.ts
  - src/services/activity.ts
  - src/services/attentionFeed.ts
  - src/services/custody.ts
  - src/services/custodyByCustodian.ts
  - src/services/exhibits.ts
  - src/services/history.ts
  - src/services/juryPackage.ts
reviewed_at: 2026-10-09T13:24:51Z
iteration: 1
---

# Phase 8 Code Review

Scope: UI redesign (Command Center, Case Workspace, Exhibit Detail, Jury Package)
plus write-action coverage (F24). The phase's explicit goal is to add write
surfaces across screens, all delegating to the service-layer chokepoint.

Verification highlights (survived refutation):
- **Ledger chokepoint intact.** Every new/changed write — `recordCustodyTransfer`,
  `requestFinalization`, `finalizeJuryPackage`, `excludeJuryPackageExhibit`, and the
  seed-only `legacyAdmitForDemo` — appends via `recordEvent` inside a transaction
  with projection upsert. No write bypasses it.
- **Role gates are server-side.** `recordCustodyTransfer` now resolves the actual
  `User.role` (`CUSTODY_WRITE_ROLES`) — the first custody gate ever. `juryPackage.ts`
  uses `assertJuryWriteRole`/inverted check from `User.role`. UI role arrays are
  explicitly redundant belt-and-suspenders; the forms re-check and the service is
  authoritative.
- **Sealed anti-enumeration preserved.** `getExhibitHistory` early-returns null
  (route → 404) when `getExhibit` masks a sealed exhibit, before any ledger query.
  All new read services (`attentionFeed`, `custodyByCustodian`, `getStatusCounts`,
  `loadUnresolvedObjectionFlags`, `loadJuryEligibilityByExhibit`) apply the
  `canViewSealed ? {} : { isSealed:false }` predicate IN-QUERY, keyed on
  already-sealed-filtered id lists — no post-query redaction, no leak.
- **No divergent fact source.** `loadJuryEligibilityByExhibit` is the single
  Included/Blocked/Not-eligible precedence implementation; both `getExhibits`/
  `searchExhibits` and `getExhibitHistory` call it. Attention-feed PENDING vs HIGH
  tiers are disambiguated solely by `currentStatus`, so no double-count.
- `tsc --noEmit` passes clean.

## BLOCKERs

None.

## WARNINGs

### W1: Unguarded non-null assertion on `objectionId` in the attention feed's Record-ruling action
- **File:** src/components/command-center/AttentionFeedPanel.tsx:124
- **Category:** bug
- **Evidence:** For a HIGH-tier entry, `entry.objectionId` is sourced in
  `attentionFeed.ts:88-98` from `prisma.objectionCurrentState.findFirst({ where: {
  exhibitId, status:'UNRESOLVED' } })` as `objection?.objectionId` — an OPTIONAL
  field (`objectionId?: string`). The panel renders
  `<RecordRulingForm objectionId={entry.objectionId!} />` with a bare `!`. If the
  `UNRESOLVED_OBJECTION_JURY_ELIGIBLE` discrepancy flag is present but the
  `ObjectionCurrentState` findFirst returns null (projection skew, or a resolved
  thread whose flag has not yet been re-evaluated), `objectionId` is `undefined`
  and a JUDGE clicking "Record ruling" would POST to
  `/api/objections/undefined/ruling` (404-ish failure rather than a clean no-op).
  The sibling surfaces handle the same case defensively: `DiscrepancyBanner.tsx`
  guards with `alertObjection ? ... : undefined` and `ObjectionCard.tsx` iterates
  real objection rows — only this panel uses a bare assertion.
- **Fix direction:** Mirror the DiscrepancyBanner pattern — render the Record-ruling
  button/form only when `entry.objectionId` is truthy; otherwise fall back to a
  link-through. Low likelihood given derived-projection consistency, hence WARNING,
  but the `!` is a latent defect inconsistent with the rest of the codebase.

### W2: Command Center "Custody at a Glance" panel carries an inline write action, contradicting the "attention feed is the ONE write surface" invariant
- **File:** src/components/command-center/CustodyAtAGlancePanel.tsx:75-91, 113-129
- **Category:** integration / design-invariant
- **Evidence:** The stated phase invariant is that the attention feed is the single
  sanctioned Command Center write surface and "every other panel stays read-only."
  `CustodyAtAGlancePanel` — a Command Center panel — renders an inline
  "Transfer"/"Assign" trigger that expands `TransferCustodyForm` (a real write via
  `recordCustodyTransfer`). The page header comment and 08-10 CONTEXT explicitly
  sanction this as "this screen's first-ever write affordance," so this is a
  *documented* reversal within the phase, not an accidental one — and the write
  still flows through the service chokepoint with the server-side role gate, so
  there is no security hole. Flagging it as a WARNING only because it directly
  contradicts the invariant as stated in the review brief and warrants human
  adjudication (either the invariant text or the panel's scope needs reconciling).
  Stated uncertainty: this may be an intended, approved scope decision, in which
  case it is not a defect at all.
- **Fix direction:** No code change needed if the Custody-at-a-Glance write is
  approved scope (it is server-gated and chokepoint-routed). If the single-surface
  invariant is binding, remove the inline trigger from this panel and route
  custody remediation exclusively through the attention feed's MEDIUM-tier action.

### W3: `finalizationRequestedBy` is stored unvalidated (no FK), and the request path accepts an actor with no User row
- **File:** src/services/juryPackage.ts:557-587; prisma/schema.prisma:287
- **Category:** bug (data integrity, low severity)
- **Evidence:** `requestFinalization` rejects only roles that CAN finalize
  (inverted gate); an `actorUserId` with no `User` row falls through and is stamped
  into `finalizationRequestedBy`. That column is a bare nullable `TEXT` with NO
  foreign-key relation (unlike `finalizedBy`, which has the `finalizedByUser`
  relation), so an arbitrary/stale id persists silently. `JuryPackageDraft.tsx:213`
  then displays it, falling back to the raw id string when the roster lookup misses.
  The service doc-comment explicitly documents this ("no stricter unknown-actor
  rejection is invented beyond the spec"), so it is an accepted design posture for
  a demo notification field rather than an exploitable hole — hence WARNING, not
  BLOCKER.
- **Fix direction:** If demo-only, leave as-is (documented). If tightening is
  desired, validate the actor exists (`prisma.user.findUnique`) before stamping,
  and/or add the FK relation on `finalizationRequestedBy`.

## Cross-file seams checked
- `POST /api/exhibits/:id/events/custody` ↔ `recordCustodyTransfer` payload (`fromCustodianUserId`/`toCustodianUserId`/`reason`/`actorUserId`) — OK; route defaults `fromCustodianUserId` to null, service branches correctly.
- `useTransferCustody` body `{ ...args, actorUserId }` ↔ custody route parse — OK.
- `POST /api/jury-package/:id/request-finalization` ↔ `requestFinalization` ↔ `useJuryPackage.requestFinalization` ↔ `JuryPackagePage` wiring ↔ `JuryPackageDraft` props — OK, full chain consistent.
- `GET /api/cases/:id/activity` shape change `{ recentActivity, statusCounts }` ↔ `useRecentActivity.ActivityResponse` ↔ `RecentActivityPanel`/`StatCardRow`/`StatusDistributionBar` consumers — OK, all consumers migrated atomically.
- `GET /api/cases/:id/attention-feed` ↔ `getAttentionFeed` return ↔ `AttentionFeedEntry` ↔ `useAttentionFeed`/`AttentionFeedPanel` — OK.
- `GET /api/cases/:id/custody-by-custodian` ↔ `getCustodyByCustodian` ↔ `useCustodyByCustodian`/`CustodyAtAGlancePanel` — OK.
- `loadJuryEligibilityByExhibit` export ↔ `exhibits.ts` + `history.ts` consumers (single precedence source, cross-screen parity) — OK.
- `ExhibitHistoryResponse` additive fields (`objections`, `custodyCard`, `juryPackageChecklist`) ↔ `ObjectionCard`/`CustodyCard`/`JuryPackageChecklistCard`/`DiscrepancyBanner` props — OK.
- react-query invalidation keys (`attention-feed`, `custody-by-custodian`, `exhibit-history`, `jury-package`, `discrepancy-count`) ↔ consuming hooks' query-key prefixes — OK.
- `JuryPackage.finalizationRequestedAt/By` schema ↔ migration ↔ `JuryPackageDto` ↔ `JuryPackageDraft` usage — OK (migration matches schema; DTO relaxes only date fields).
- Seed `legacyAdmitForDemo` ledger-write + `recordCustodyTransfer` actor change (CHAMBERS_STAFF → deputy) ↔ new `CUSTODY_WRITE_ROLES` gate — OK (actor change is required by the new gate; all identifiers in scope).
- Attention-feed `objectionId` seam — see W1.
