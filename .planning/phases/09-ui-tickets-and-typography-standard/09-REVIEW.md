---
phase: 9
status: issues_found
blockers: 0
warnings: 1
files_reviewed: 28
files_reviewed_list:
  - src/app/case/page.tsx
  - src/app/command-center/page.tsx
  - src/app/activity/page.tsx
  - src/app/jury-package/page.tsx
  - src/app/layout.tsx
  - src/app/api/cases/[id]/jury-package/preview/route.ts
  - src/app/api/cases/[id]/exhibits/search/route.test.ts
  - src/services/juryPackage.ts
  - src/services/exhibits.ts
  - src/services/history.ts
  - src/services/attentionFeed.ts
  - src/lib/errors.ts
  - src/lib/fonts.ts
  - src/lib/types.ts
  - src/lib/apiClient.ts
  - src/services/visibility.ts
  - src/hooks/useJuryPackagePreview.ts
  - src/hooks/useFreshness.ts
  - src/hooks/useAssistantChat.ts
  - src/stores/roleStore.ts
  - src/stores/assistantStore.ts
  - src/components/jury/JuryPackageReadinessPreview.tsx
  - src/components/command-center/LiveIndicator.tsx
  - src/components/command-center/StatCardRow.tsx
  - src/components/shell/ActiveRoleBanner.tsx
  - src/components/shell/Header.tsx
  - src/components/shell/AppShell.tsx
  - src/components/shell/JuryPackageNavItem.tsx
  - src/components/case/SearchFilterBar.tsx
  - src/components/case/QuickFilterChips.tsx
  - src/components/case/ExhibitTable.tsx
  - src/components/assistant/ExampleChips.tsx
  - src/components/exhibit/ObjectionCard.tsx
  - src/components/exhibit/ExhibitHeader.tsx
  - src/components/shared/SeverityPill.tsx
reviewed_at: 2026-10-10T19:51:44Z
iteration: 1
---

# Phase 9 Code Review

Reviewed the full phase-9 diff (`293c151^..HEAD`, 92 changed paths excluding `.planning`/lockfiles). Concentrated on the logic-bearing `.ts`/`.tsx` files and their cross-file seams; the remaining changes are `.scss` (out of scope: style) and test files. `tsc --noEmit` is clean (EXIT 0). The `## Known Stubs` sections across all 17 SUMMARYs declare no blocking stubs; spot-verified — none found.

The new F25 service/route/hook/panel chain, the four-value `NOT_YET_EVALUATED` precedence across all three agreeing surfaces, the LiveIndicator/useFreshness retirement of FreshnessIndicator (deletion is clean, zero dangling references), the role-switch assistant-reset isolation, and the self-hosted `next/font` wiring are all sound.

## BLOCKERs

None.

## WARNINGs

### W1: Case Workspace "Showing X of Y" readout ignores the active quick filter — reachable directly from the Command Center "Custody gaps" KPI deep-link
- **File:** src/app/case/page.tsx:131 (and :93, :149)
- **Category:** bug
- **Evidence:** The table renders `visibleRows = applyQuickFilter(data, quickFilter, activeUserName)` (page.tsx:93, :149), but the "Showing X of Y" readout is fed `visibleCount={data?.length ?? 0}` — the *pre-quick-filter* list length — not the count of rows actually rendered. `SearchFilterBar`'s own prop doc states `visibleCount` is "Rows currently rendered (the filtered/visible count)", so the value contradicts its documented contract whenever a quick filter is active. This is directly user-reachable, not hypothetical: `StatCardRow` (StatCardRow.tsx:79-83) links the "Custody gaps" KPI tile to `/case?filter=no-custodian`, and `CaseWorkspaceInner` reads that param in its `useState` initializer (page.tsx:39-41) to pre-select the `no-custodian` chip on mount. Concrete case: a case with 14 admitted exhibits of which 3 lack a custodian → arriving via the Custody-gaps tile renders a 3-row table under a readout that reads "Showing 14 of 14". The search-filter path (keyword/status/witness/date) is correct because those narrow `data` itself via the query; only the client-side quick-filter narrowing is unaccounted for.
- **Fix direction:** Feed the readout the actually-rendered count. Pass `visibleCount={visibleRows.length}` (compute `visibleRows` before the `SearchFilterBar` render) rather than `data?.length`. Leave `totalCount` as the unfiltered total so "Showing 3 of 14" reads correctly for both the quick-filter and search paths.
- **Resolution:** fixed (53df8d1) — `visibleRows` was already computed at page.tsx:93 (before the `SearchFilterBar` render at :122); changed `visibleCount={data?.length ?? 0}` → `visibleCount={visibleRows.length}` so the readout reflects the post-quick-filter rendered rows. `totalCount` left as the unfiltered total. `tsc --noEmit` clean; no unit test covers the readout (Playwright-level), so flagged `requires human verification` on the commit.

## Cross-file seams checked
- `GET /api/cases/:id/jury-package/preview` route ↔ `getJuryPackageReadinessPreview` service — OK (shape `{ preview, summary }` matches; route throws `NotFoundError`/`JuryPackagePreviewLoadError`, both defined in errors.ts and mapped by `errorResponse`).
- `useJuryPackagePreview` hook ↔ preview route — OK (query-key includes `role` + `caseId`; `apiFetch` attaches `X-User-Role` from store `role`, which `parseRequestingRole` reads and fails-closed to ATTORNEY; `JuryPackageReadinessPreview` type imported from the service — no drift).
- `JuryPackageReadinessPreview` panel ↔ `SeverityPill` — OK (`toneFor` only returns `'critical' | 'medium'`, both present in `TONE_CONFIG`; `ExhibitTag` consumed as named import, exists).
- `loadJuryEligibilityByExhibit` ↔ its three consumers (`getExhibits`, `searchExhibits`, `getExhibitHistory`) — OK (single exported precedence impl; history passes a 1-element array and reads the one entry; `NOT_YET_EVALUATED` added consistently in `lib/types.ts`, `ExhibitTable` `JURY_PACKAGE_TEXT`, and the history checklist type).
- `JuryPackageNavItem` blocker count ↔ `command-center/page.tsx` `juryBlockers` ↔ Jury Package page — OK (identical `discrepancyStatus === 'FLAGGED' || isSealed` formula in all three; view already excludes EXCLUDED rows upstream).
- `LiveIndicator` ↔ `command-center/page.tsx` wiring ↔ `useFreshness` — OK (`dataUpdatedAt`/`isFetching`/`isError`/`onRefetch` all passed from the activity query; `onRefetch` is the query's own read-only `refetch`; 60s threshold constant shared with the unit test).
- FreshnessIndicator retirement — OK (both `.tsx` and `.module.scss` deleted; grep finds zero remaining references anywhere in `src/`).
- `roleStore.setActiveUser` ↔ `assistantStore.newConversation` ↔ `useAssistantChat` — OK (role switch nulls `activeConversationId` via lazy import; the hook's effect clears live `useChat` messages when the store id goes null, preventing prior-role history leaking across a visibility boundary on the next send).
- `Header` role switcher ↔ `NEXT_PUBLIC_DEMO_MODE` gate — OK (only the literal string `'false'` hides it; defaults to enabled when unset, preserving demo behavior; `.env.example` adds the flag).
- `ActiveRoleBanner` mount ↔ `AppShell` ↔ `roleStore.previousUserId` — OK (mounted once at shell level; self-hides until `previousUserId !== null`; `previousUserId` restored on the store and set only on a real cross-user switch).
- `layout.tsx` font variables ↔ `lib/fonts.ts` ↔ Carbon type tokens — OK (`ibmPlexSans.variable`/`ibmPlexMono.variable` applied on `<html>`; registered family names "IBM Plex Sans"/"IBM Plex Mono" match what globals.scss wires Carbon's sans/mono tokens to).
- `searchExhibits` filter construction — OK (all filter values flow through Prisma's parameterized builder; `status` validated against `exhibitStatusEnum` before query; no raw-SQL interpolation; sealed exclusion sits in the same WHERE as content filters — no leak path).
- `activity/page.tsx` `since=epoch` — OK (hardcoded `SINCE_EPOCH` constant, never user-supplied; `encodeURIComponent`-wrapped; no injection surface; reuses existing validated activity route).
- `ObjectionCard` / `ExhibitHeader` T-05 single Record-ruling entry point — OK (duplicate per-thread ruling control + form fully removed from the card; no dead handler left; the sole entry point is the banner; server JUDGE-only gate in `recordRuling` unchanged).
