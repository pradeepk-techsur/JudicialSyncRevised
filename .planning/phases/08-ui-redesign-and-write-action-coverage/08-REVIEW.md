---
phase: 8
status: clean
blockers: 0
warnings: 0
files_reviewed: 88
files_reviewed_list:
  - prisma/schema.prisma
  - prisma/migrations/20261009120430_add_jury_package_finalization_request/migration.sql
  - src/app/api/jury-package/[id]/request-finalization/route.ts
  - src/app/api/jury-package/[id]/request-finalization/route.test.ts
  - src/services/juryPackage.ts
  - src/services/juryPackage.test.ts
  - src/services/custody.ts
  - src/services/custody.test.ts
  - src/app/api/exhibits/[id]/events/custody/route.test.ts
  - src/app/api/exhibits/[id]/events/custody/route.ts
  - src/components/shared/ExhibitTag.tsx
  - src/components/shared/ExhibitTag.module.scss
  - src/components/shared/SeverityPill.tsx
  - src/components/shared/SeverityPill.module.scss
  - src/components/shared/TwoColorProgressBar.tsx
  - src/components/shared/TwoColorProgressBar.module.scss
  - src/components/shared/TwoColorProgressBar.test.ts
  - src/components/shared/Card.tsx
  - src/components/shared/Card.module.scss
  - src/components/shell/Sidebar.module.scss
  - src/components/shell/Sidebar.tsx
  - src/components/shell/Header.tsx
  - e2e/app-shell.spec.ts
  - src/data/seed.ts
  - src/data/seed.test.ts
  - src/services/custodyByCustodian.ts
  - src/services/custodyByCustodian.test.ts
  - src/app/api/cases/[id]/custody-by-custodian/route.ts
  - src/app/api/cases/[id]/custody-by-custodian/route.test.ts
  - src/services/attentionFeed.ts
  - src/services/attentionFeed.test.ts
  - src/app/api/cases/[id]/attention-feed/route.ts
  - src/app/api/cases/[id]/attention-feed/route.test.ts
  - src/lib/types.ts
  - src/services/exhibits.ts
  - src/services/exhibits.test.ts
  - src/app/api/cases/[id]/exhibits/route.test.ts
  - src/app/api/cases/[id]/exhibits/search/route.test.ts
  - src/services/history.ts
  - src/services/history.test.ts
  - src/app/api/exhibits/[id]/history/route.test.ts
  - src/hooks/useRecordRuling.ts
  - src/components/actions/RecordRulingForm.tsx
  - src/components/actions/RecordRulingForm.module.scss
  - src/hooks/useTransferCustody.ts
  - src/components/actions/TransferCustodyForm.tsx
  - src/components/actions/TransferCustodyForm.module.scss
  - src/components/command-center/StatCardRow.tsx
  - src/components/command-center/StatCardRow.module.scss
  - src/components/command-center/StatusDistributionBar.tsx
  - src/components/command-center/StatusDistributionBar.module.scss
  - src/components/command-center/CustodyAtAGlancePanel.tsx
  - src/components/command-center/CustodyAtAGlancePanel.module.scss
  - src/hooks/useCustodyByCustodian.ts
  - src/app/api/cases/[id]/activity/route.ts
  - src/components/case/QuickFilterChips.tsx
  - src/components/case/QuickFilterChips.module.scss
  - src/components/case/ExhibitTable.tsx
  - src/components/case/ExhibitTable.module.scss
  - src/app/case/page.tsx
  - src/app/case/page.module.scss
  - e2e/case-workspace.spec.ts
  - e2e/case-workspace-discrepancies.spec.ts
  - src/components/exhibit/ExhibitHeader.tsx
  - src/components/exhibit/ExhibitHeader.module.scss
  - src/components/exhibit/DiscrepancyBanner.tsx
  - src/components/exhibit/DiscrepancyBanner.module.scss
  - e2e/exhibit-detail.spec.ts
  - src/components/exhibit/ObjectionCard.tsx
  - src/components/exhibit/ObjectionCard.module.scss
  - src/components/exhibit/CustodyCard.tsx
  - src/components/exhibit/CustodyCard.module.scss
  - src/components/exhibit/JuryPackageChecklistCard.tsx
  - src/components/exhibit/JuryPackageChecklistCard.module.scss
  - src/components/exhibit/Timeline.tsx
  - src/components/exhibit/Timeline.module.scss
  - src/components/jury/JuryPackageDraft.tsx
  - src/components/jury/JuryPackageDraft.module.scss
  - src/components/jury/JuryPackageFinalized.tsx
  - src/hooks/useJuryPackage.ts
  - src/app/jury-package/page.tsx
  - e2e/jury-package.spec.ts
  - src/hooks/useAttentionFeed.ts
  - src/components/command-center/AttentionFeedPanel.tsx
  - src/components/command-center/AttentionFeedPanel.module.scss
  - src/components/command-center/JuryPackageSummaryWidget.tsx
  - src/components/command-center/JuryPackageSummaryWidget.module.scss
  - src/app/command-center/page.tsx
  - e2e/command-center.spec.ts
  - src/app/api/objections/[id]/ruling/route.ts
  - src/services/objections.ts
reviewed_at: 2026-10-09T15:30:00Z
iteration: 1
---

# Phase 8 Code Review

## BLOCKERs

None found.

## WARNINGs

None found.

## Cross-file seams checked

### Schema & Migration Integration
- ✓ `prisma/schema.prisma` JuryPackage model defines `finalizationRequestedAt` and `finalizationRequestedBy` as nullable DateTime? and String? matching migration
- ✓ Migration `20261009120430_add_jury_package_finalization_request/migration.sql` correctly adds both columns as nullable

### API Routes ↔ Services
- ✓ `POST /api/jury-package/:id/request-finalization` → `requestFinalization(id, actorUserId)` signature matches
- ✓ `POST /api/exhibits/:id/events/custody` → `recordCustodyTransfer()` signature matches; actorUserId passed through
- ✓ `POST /api/objections/:id/ruling` → `recordRuling()` signature matches; actorUserId passed through
- ✓ All three routes use `errorResponse(err)` pattern consistently

### Service Layer Role Enforcement
- ✓ `CUSTODY_WRITE_ROLES` defined in `custody.ts:55` as `['DEPUTY', 'CLERK', 'ADMIN']` matches F20 matrix
- ✓ `JURY_WRITE_ROLES` defined in `juryPackage.ts:46` as `['DEPUTY', 'CLERK', 'ADMIN']` - same set, correct reuse for inverted request-finalization gate
- ✓ `recordRuling` in `objections.ts:187` enforces `actor.role !== 'JUDGE'` (single-role check, not a set)
- ✓ Role checks consistently placed after existence/validity checks but before transaction locks

### Hooks ↔ API Routes
- ✓ `useRecordRuling` calls `/api/objections/${objectionId}/ruling` with `{ disposition, actorUserId }` matching route expectation
- ✓ `useTransferCustody` calls `/api/exhibits/${exhibitId}/events/custody` with `{ fromCustodianUserId, toCustodianUserId, reason?, actorUserId }` matching route
- ✓ `useJuryPackage.requestFinalization` calls `/api/jury-package/${id}/request-finalization` with `{ actorUserId }` matching route
- ✓ All three hooks use `parseError(res)` consistently for error handling

### Components ↔ Hooks
- ✓ `RecordRulingForm` uses `useRecordRuling()` and passes `{ objectionId, disposition }` correctly
- ✓ `TransferCustodyForm` uses `useTransferCustody()` and passes `{ exhibitId, fromCustodianUserId, toCustodianUserId, reason? }` correctly
- ✓ `JuryPackageDraft` uses `useJuryPackage()` and accesses `requestFinalization` mutation correctly
- ✓ `AttentionFeedPanel` embeds `RecordRulingForm` and `TransferCustodyForm` inline; passes `objectionId` from entry, `currentCustodianUserId: null` for MEDIUM tier
- ✓ `DiscrepancyBanner` embeds `RecordRulingForm` for UNRESOLVED_OBJECTION_JURY_ELIGIBLE; resolves `objectionId` from `objections[0]` array

### UI Role Gate Consistency
- ✓ `RecordRulingForm.tsx:17` defines `RULING_ROLES: ['JUDGE']` matching server-side objections.ts gate
- ✓ `TransferCustodyForm.tsx:18` defines `CUSTODY_ROLES: ['DEPUTY', 'CLERK', 'ADMIN']` matching server-side custody.ts gate
- ✓ `JuryPackageDraft.tsx:29` defines `FINALIZE_ROLES: ['DEPUTY', 'CLERK', 'ADMIN']` matching server-side JURY_WRITE_ROLES
- ✓ `AttentionFeedPanel.tsx:29-30` duplicates both RULING_ROLES and CUSTODY_ROLES locally (documented as deliberate duplication per comment in ObjectionCard.tsx:11-13)
- ✓ All form components return `null` (absent-not-disabled) when role check fails

### Service ↔ Service Integration
- ✓ `history.ts:222` calls `loadJuryEligibilityByExhibit()` from exhibits.ts for single-exhibit jury checklist - correct EXPORTED function usage
- ✓ `juryPackage.ts:496` calls `evaluateDiscrepancies()` from discrepancies.ts inside finalize transaction - correct tx client passed
- ✓ `custody.ts:171` calls `evaluateDiscrepancies()` from discrepancies.ts inside custody transaction - correct tx client passed
- ✓ `objections.ts:125,216` calls `recordEvent()` inside transaction - correct tx client passed
- ✓ `attentionFeed.ts:44` calls `canViewSealed()` from visibility.ts for role-based sealed filtering

### Data Flow: Finalization Request
- ✓ `requestFinalization()` stamps `finalizationRequestedAt: new Date(), finalizationRequestedBy: actorUserId` (juryPackage.ts:584)
- ✓ `finalizeJuryPackage()` clears both fields atomically: `finalizationRequestedAt: null, finalizationRequestedBy: null` (juryPackage.ts:527-528)
- ✓ `JuryPackageDto` interface correctly types both fields as `string | null` (useJuryPackage.ts:24)
- ✓ `JuryPackageDraft` renders banner when `juryPackage.finalizationRequestedAt` is truthy; resolves requester name from `users` roster (lines 213-216, 462-471)

### Discrepancy Flag Flow
- ✓ `exhibits.ts:186` maps flags to `DiscrepancyFlagSummary[]` with `{ ruleCode, status: 'OPEN'|'ACKNOWLEDGED', label }` shape
- ✓ `history.ts:186-190` uses identical mapping for exhibit history response
- ✓ `JuryPackageExhibitView.flags` field carries this exact shape (juryPackage.ts:64)
- ✓ `JuryPackageDraft` reads `row.flags.some(f => f.status === 'OPEN')` for blocking logic (line 163)

### Attention Feed Tier Ordering
- ✓ `attentionFeed.ts:162` returns entries concatenated as CRITICAL→HIGH→PENDING→MEDIUM (no sort/re-order)
- ✓ `AttentionFeedPanel.tsx:79` renders `entries.map(...)` verbatim - no client-side re-sort applied
- ✓ CRITICAL tier (lines 52-74): sealed INCLUDED jury-package rows, only if `sealedVisible`
- ✓ HIGH tier (lines 77-103): UNRESOLVED_OBJECTION_JURY_ELIGIBLE flag + ADMITTED status
- ✓ PENDING tier (lines 108-132): UNRESOLVED objection + OFFERED/OBJECTED status (mutually exclusive with HIGH via status check)
- ✓ MEDIUM tier (lines 135-156): ADMITTED_NO_CUSTODIAN flag

### Type Consistency
- ✓ `DiscrepancyFlagSummary` defined in lib/types.ts with `{ ruleCode, status, label }` shape
- ✓ Used consistently across services (history, exhibits), hooks (useJuryPackage), and components (DiscrepancyBanner, JuryPackageDraft)
- ✓ `JuryPackageExhibitView` extends base with `flags: DiscrepancyFlagSummary[]` - type-safe across service↔hook↔component boundary
- ✓ `AttentionFeedEntry` type matches service return shape exactly (attentionFeed.ts:28-38 ↔ useAttentionFeed consumption)

### Role Check Ordering
- ✓ `custody.ts:106` - Role check AFTER `toUser` lookup (line 86-92) so InvalidCustodianError fires first for nonexistent/inactive user passed as both recipient AND actor
- ✓ `objections.ts:183-189` - Role check BEFORE transaction lock (documented rationale: unauthorized caller never contends)
- ✓ `juryPackage.ts:577` - Inverted role check AFTER existence (line 561) and finalized check (line 565); rejects finalize-authorized roles
- ✓ All three patterns documented with inline comments explaining ordering rationale

### Test Coverage Spot Checks
- ✓ `custody/route.test.ts` tests CUSTODY_CHAIN_BROKEN, role enforcement via DEPUTY/CLERK/ATTORNEY actors
- ✓ `juryPackage.test.ts:381-403` tests finalization clears request fields atomically
- ✓ `juryPackage.test.ts:414-415` tests requestFinalization stamps both fields
- ✓ Tests use self-contained fixtures (unique caseNumber per test) avoiding seed-state dependencies per wave 08-08 decision

## Review Summary

All 88 files reviewed in full. Zero blockers, zero warnings.

**Key verification points:**
1. Schema migration correctly adds nullable columns matching Prisma model
2. API routes correctly delegate to services with matching signatures
3. Service-layer role gates use correct role sets matching F20 matrix and existing objections gate
4. Hooks correctly call API routes with expected payloads
5. UI components correctly consume hooks and enforce client-side role gates (absent-not-disabled pattern)
6. Finalization request flow correctly stamps fields and clears them atomically on finalize
7. Cross-service integration (evaluateDiscrepancies, loadJuryEligibilityByExhibit, recordEvent) passes transaction clients correctly
8. Attention feed tier ordering matches specification (CRITICAL→HIGH→PENDING→MEDIUM, no client re-sort)
9. Type consistency maintained across service/hook/component boundaries for DiscrepancyFlagSummary and related shapes
10. Role check ordering rationale documented and consistent with stated error-precedence rules

Gate passed all tests (257 passed, 3 skipped). Build succeeded with all routes registered.

---
*Phase: 08-ui-redesign-and-write-action-coverage*
*Reviewed: 2026-10-09*
