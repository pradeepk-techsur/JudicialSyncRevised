---
phase: 8
status: issues_found
blockers: 0
warnings: 1
files_reviewed: 100
files_reviewed_list:
  - e2e/app-shell.spec.ts
  - e2e/case-workspace-discrepancies.spec.ts
  - e2e/case-workspace.spec.ts
  - e2e/command-center.spec.ts
  - e2e/exhibit-detail.spec.ts
  - e2e/jury-package.spec.ts
  - prisma/migrations/20261009120430_add_jury_package_finalization_request/migration.sql
  - prisma/schema.prisma
  - src/app/api/cases/[id]/activity/route.test.ts
  - src/app/api/cases/[id]/activity/route.ts
  - src/app/api/cases/[id]/attention-feed/route.test.ts
  - src/app/api/cases/[id]/attention-feed/route.ts
  - src/app/api/cases/[id]/custody-by-custodian/route.test.ts
  - src/app/api/cases/[id]/custody-by-custodian/route.ts
  - src/app/api/cases/[id]/exhibits/route.test.ts
  - src/app/api/cases/[id]/exhibits/search/route.test.ts
  - src/app/api/exhibits/[id]/events/custody/route.test.ts
  - src/app/api/exhibits/[id]/history/route.test.ts
  - src/app/api/jury-package/[id]/request-finalization/route.test.ts
  - src/app/api/jury-package/[id]/request-finalization/route.ts
  - src/app/case/page.module.scss
  - src/app/case/page.tsx
  - src/app/command-center/page.module.scss
  - src/app/command-center/page.tsx
  - src/app/exhibit/[id]/page.module.scss
  - src/app/exhibit/[id]/page.tsx
  - src/app/jury-package/page.tsx
  - src/components/actions/RecordRulingForm.module.scss
  - src/components/actions/RecordRulingForm.tsx
  - src/components/actions/TransferCustodyForm.module.scss
  - src/components/actions/TransferCustodyForm.tsx
  - src/components/case/ExhibitTable.module.scss
  - src/components/case/ExhibitTable.tsx
  - src/components/case/QuickFilterChips.module.scss
  - src/components/case/QuickFilterChips.tsx
  - src/components/command-center/AttentionFeedPanel.module.scss
  - src/components/command-center/AttentionFeedPanel.tsx
  - src/components/command-center/CustodyAtAGlancePanel.module.scss
  - src/components/command-center/CustodyAtAGlancePanel.tsx
  - src/components/command-center/JuryPackageSummaryWidget.module.scss
  - src/components/command-center/JuryPackageSummaryWidget.tsx
  - src/components/command-center/RecentActivityPanel.module.scss
  - src/components/command-center/RecentActivityPanel.tsx
  - src/components/command-center/StatCardRow.module.scss
  - src/components/command-center/StatCardRow.tsx
  - src/components/command-center/StatusDistributionBar.module.scss
  - src/components/command-center/StatusDistributionBar.tsx
  - src/components/exhibit/CustodyCard.module.scss
  - src/components/exhibit/CustodyCard.tsx
  - src/components/exhibit/DiscrepancyBanner.module.scss
  - src/components/exhibit/DiscrepancyBanner.tsx
  - src/components/exhibit/ExhibitHeader.module.scss
  - src/components/exhibit/ExhibitHeader.tsx
  - src/components/exhibit/JuryPackageChecklistCard.module.scss
  - src/components/exhibit/JuryPackageChecklistCard.tsx
  - src/components/exhibit/ObjectionCard.module.scss
  - src/components/exhibit/ObjectionCard.tsx
  - src/components/exhibit/Timeline.module.scss
  - src/components/exhibit/Timeline.tsx
  - src/components/jury/JuryPackageDraft.module.scss
  - src/components/jury/JuryPackageDraft.tsx
  - src/components/jury/JuryPackageFinalized.tsx
  - src/components/shared/ActionButtonRow.module.scss
  - src/components/shared/ActionButtonRow.tsx
  - src/components/shared/Card.module.scss
  - src/components/shared/Card.tsx
  - src/components/shared/ExhibitTag.module.scss
  - src/components/shared/ExhibitTag.tsx
  - src/components/shared/SeverityPill.module.scss
  - src/components/shared/SeverityPill.tsx
  - src/components/shared/TwoColorProgressBar.module.scss
  - src/components/shared/TwoColorProgressBar.test.ts
  - src/components/shared/TwoColorProgressBar.tsx
  - src/components/shell/Header.tsx
  - src/components/shell/Sidebar.module.scss
  - src/components/shell/Sidebar.tsx
  - src/data/seed.test.ts
  - src/data/seed.ts
  - src/hooks/useAttentionFeed.ts
  - src/hooks/useCustodyByCustodian.ts
  - src/hooks/useJuryPackage.ts
  - src/hooks/useRecentActivity.ts
  - src/hooks/useRecordRuling.ts
  - src/hooks/useTransferCustody.ts
  - src/lib/errors.ts
  - src/lib/types.ts
  - src/services/activity.test.ts
  - src/services/activity.ts
  - src/services/attentionFeed.test.ts
  - src/services/attentionFeed.ts
  - src/services/custody.test.ts
  - src/services/custody.ts
  - src/services/custodyByCustodian.test.ts
  - src/services/custodyByCustodian.ts
  - src/services/exhibits.test.ts
  - src/services/exhibits.ts
  - src/services/history.test.ts
  - src/services/history.ts
  - src/services/juryPackage.test.ts
  - src/services/juryPackage.ts
reviewed_at: 2026-10-09T20:26:16Z
iteration: 2
---

# Phase 8 Code Review

Full-phase re-review (iteration 2), scoped from the pre-phase baseline (`31b55bc`, last commit before `feat(08-02)` started the phase) through `HEAD` (`4e0ff18`), with focused attention on the three newest gap-closure commits (`bacbd20`, `0dfa3be`, `4e0ff18` — plan 08-16, Wave 5) that postdate the prior (stale) 08-REVIEW.md.

## BLOCKERs

None found.

## WARNINGs

### W1: Three stale comments still describe the removed "status-distribution bar" as present
- **File:** `src/app/command-center/page.tsx:36,45,121`; `src/hooks/useRecentActivity.ts:11-12`; `src/services/activity.ts:145`
- **Evidence:** 08-16 (`0dfa3be`) deleted the segmented proportional bar from `StatusDistributionBar.tsx` entirely, leaving only the legend. However, several nearby comments were not updated and still describe "the proportional status-distribution bar" / "the distribution bar" as a rendered element, e.g. `page.tsx:36`: `// the 4 stat cards, the proportional status-distribution bar, the (read-only)` and `page.tsx:121`: `distribution bar and the lower two-column rows (Screenshot 1)`. This is documentation drift only — the actual `<StatusDistributionBar>` component and its call site (`page.tsx:118`) are correct and render legend-only; no runtime behavior is affected.
- **Fix direction:** Update the stale comments to say "status-distribution legend" (matching the updated comment already present in `StatusDistributionBar.tsx`/`.module.scss`) to avoid confusing a future reader into thinking the bar still exists.

## Cross-file seams checked

### Gap-closure commit `bacbd20` (sidebar/header overlap fix)
- ✓ `Sidebar.module.scss`'s new `inset-block-start: 3rem` / `block-size: calc(100% - 3rem)` on `.cds--side-nav` correctly replicates the effect of Carbon's own `.cds--header ~ .cds--side-nav` sibling rule (verified directly against `node_modules/@carbon/styles/scss/components/ui-shell/side-nav/_side-nav.scss:105-108`, which sets `inset-block-start: mini-units(6)` = 3rem and `block-size: calc(100% - 48px)` for that selector) — confirms the fix's rationale comment is factually accurate, not just plausible-sounding.
- ✓ `AppShell.tsx`'s DOM nesting (`Header` then a sibling `.body` div containing `Sidebar`) confirms the CSS sibling-combinator truly never matches in this app's structure, so the manual override is necessary (not a redundant/duplicate rule).
- ✓ `AppShell.module.scss`'s `.shell { padding-top: 3rem }` header-height constant matches the `3rem` hardcoded in the new Sidebar override, as the fix's own comment requires ("keep both in sync") — currently in sync.
- ✓ New `app-shell.spec.ts` overlap test (bounding-box comparison + `elementFromPoint` hit-test resolving to `#role-switcher`) exercises the actual rendered geometry rather than DOM order or testid presence, so it is a genuine regression guard, not a tautological pass.
- ✓ Carbon's base `.cds--side-nav` rule (`inset-block: 0`, `position: fixed`, `z-index: z('header')` — same z-index as the Header) confirms the pre-fix overlap failure mode described in the commit's rationale comment is accurate.

### Gap-closure commit `0dfa3be` (status-distribution bar removal)
- ✓ `StatusDistributionBar.tsx` now renders only the `<ul data-testid="status-distribution-legend">` — zero remaining `.bar`/`.segment`/`.emptyBar` JSX or `status-distribution-bar`/`status-segment-*` testids (confirmed via full-file read + grep).
- ✓ `StatusDistributionBar.module.scss` deletes `.bar`/`.segment`/`.emptyBar` rules; `.segMarked`..`.segWithdrawn` legend-dot color classes are untouched and still consumed by the legend's `<span className={... STATUS_META[status].segClass}>`.
- ✓ Sole call site (`src/app/command-center/page.tsx:118`, `<StatusDistributionBar statusCounts={...} />`) is unchanged and compatible — the component's prop contract (`{ statusCounts: Record<ExhibitStatus, number> }`) was not altered by the removal, only the render output shrank.
- ✓ `e2e/command-center.spec.ts`'s updated legend test now asserts `toHaveCount(0)` for both the bar wrapper testid and all 6 `status-segment-*` testids (not merely omitting the check), genuinely proving permanent absence rather than silently passing regardless of whether the bar exists.
- ✓ Grep across the entire `src/` and `e2e/` trees confirms no other file still references the removed `status-distribution-bar` or `status-segment-*` testids (the only remaining hits are the two in the updated, assert-absence test itself).

### Full-phase diff (iteration-2 scope beyond prior review)
- ✓ `src/services/activity.ts` (`getRecentActivity` + `getStatusCounts`) ↔ `src/app/api/cases/[id]/activity/route.ts`: route calls both functions with matching signatures (`caseId`, `{ since, role }` / `caseId, role`), returns `{ recentActivity, statusCounts }` per the hook's `ActivityResponse` type.
- ✓ `src/hooks/useRecentActivity.ts`'s `ActivityResponse` shape ↔ `RecentActivityPanel.tsx`'s `data?.recentActivity` and `page.tsx`'s `activity.data?.statusCounts` — both consumers read the correct nested field, no shape drift.
- ✓ `src/services/attentionFeed.ts` (`getAttentionFeed`) ↔ `src/app/api/cases/[id]/attention-feed/route.ts` ↔ `src/hooks/useAttentionFeed.ts` ↔ `AttentionFeedPanel.tsx`: tier ordering (CRITICAL→HIGH→PENDING→MEDIUM) is produced once server-side via array concatenation (never a cross-tier sort) and rendered verbatim (`entries.map(...)`, no client re-sort) — confirmed by direct read of all four layers.
- ✓ `AttentionFeedPanel.tsx`'s local `RULING_ROLES`/`CUSTODY_ROLES` arrays match `RecordRulingForm.tsx`'s/`TransferCustodyForm.tsx`'s own internal gates and the server-side `JURY_WRITE_ROLES`/`CUSTODY_WRITE_ROLES` sets in `juryPackage.ts`/`custody.ts` — no drift across the 3-layer role-gate duplication pattern this codebase deliberately uses.
- ✓ `src/services/exhibits.ts`'s new `loadJuryEligibilityByExhibit` (exported) is the single precedence implementation; `history.ts:222` (single-exhibit checklist) and `exhibits.ts` itself (`getExhibits`/`searchExhibits`, list rows) both call it rather than re-deriving the Included/Blocked/Not-eligible branch logic — confirmed no second copy of the precedence exists anywhere in the diff.
- ✓ `ExhibitListRow` (`lib/types.ts`) additive fields (`juryPackageEligibility`, `hasUnresolvedObjection`, `isSealed`) ↔ `ExhibitTable.tsx`'s `flagPillsFor`/`needsAttention`/`JURY_PACKAGE_TEXT` consumption — all three new fields are read correctly and match the documented precedence semantics.
- ✓ `ExhibitHistoryResponse` (`history.ts`) additive fields (`objections`, `custodyCard`, `juryPackageChecklist`) ↔ `ExhibitHeader.tsx` / `ObjectionCard.tsx` / `CustodyCard.tsx` / `JuryPackageChecklistCard.tsx` — every new field is destructured and rendered by its matching component with correct typing (`ExhibitHistoryResponse['juryPackageChecklist']` etc.), no shape mismatch.
- ✓ `requestFinalization` (`juryPackage.ts`) role-check inversion (rejects `JURY_WRITE_ROLES`, the INVERSE of `assertJuryWriteRole`) ↔ route (`request-finalization/route.ts`) ↔ `useJuryPackage.ts` ↔ `JuryPackageDraft.tsx`'s `canFinalize`-gated `onRequestFinalization` button — consistent end-to-end; `finalizeJuryPackage` clears both `finalizationRequestedAt`/`By` atomically in the same transaction as the FINALIZED transition.
- ✓ `custody.ts`'s new `CUSTODY_WRITE_ROLES` server gate (added 08-02, pre-existing from prior review but re-verified this pass) is placed after the `InvalidCustodianError` check as documented, and `seed.ts`'s S-1 fixture was correctly updated (`actorUserId: deputy` instead of `CHAMBERS_STAFF`) to satisfy the new gate without changing the custodian-of-record narrative — confirmed by reading the diff comment and the surrounding seed code together.
- ✓ `src/data/seed.ts`'s `legacyAdmitForDemo` (P-6/P-7 fixtures) is confined to `seed.ts` only (grep for its name across `src/` shows zero route/service/component imports) and its own test (`seed.test.ts`) asserts the P-6/P-7 flags are produced by the live `evaluateDiscrepancies` engine, not synthesized rows.
- ✓ `tsc --noEmit` run clean (0 errors) against the current `HEAD` worktree.
- ✓ Gate's own full Vitest run (`08-GATE.md`) shows 265 passed / 3 skipped across 40 files, including every service/route test touched this phase (`activity.test.ts`, `attentionFeed.test.ts`, `custodyByCustodian.test.ts`, `history.test.ts`, `seed.test.ts`'s P-6/P-7 assertions, `request-finalization/route.test.ts`) — re-confirmed as still representative of the current HEAD (no test files changed since that gate run).

## Review Summary

Re-reviewed the full Phase 8 diff (100 files, pre-phase baseline `31b55bc` → `HEAD` `4e0ff18`) with specific focus on the three gap-closure commits not covered by the stale 88-file review. Both gap-closure fixes are correct and verifiably close their respective UAT findings:

1. The sidebar/header overlap fix's rationale (`.cds--header ~ .cds--side-nav` sibling rule not matching due to DOM nesting) was verified directly against the installed Carbon SCSS source — the claim is accurate, not just plausible, and the new Playwright test exercises real rendered geometry rather than a tautological DOM-order check.
2. The status-distribution bar removal is complete and clean — no dangling references to the removed markup/testids remain anywhere in source or tests, and the updated e2e assertion proves permanent absence rather than merely omitting a check.

One non-blocking WARNING: a handful of comments elsewhere in the Command Center page/hook/service layer still describe the removed bar as if it still renders. This is pure documentation drift with zero runtime impact — flagged for cleanup, not a defect.

No BLOCKERs found in this pass. No regressions introduced by the gap-closure commits into the broader phase surface (role gates, finalization-request flow, attention feed tier ordering, jury-eligibility precedence, and discrepancy/custody integrations all re-verified intact).

---
*Phase: 08-ui-redesign-and-write-action-coverage*
*Reviewed: 2026-10-09 (iteration 2)*
