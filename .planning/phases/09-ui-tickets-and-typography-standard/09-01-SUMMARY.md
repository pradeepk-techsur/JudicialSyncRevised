---
phase: 09-ui-tickets-and-typography-standard
plan: 01
subsystem: ui
tags: [command-center, carbon, datatable, clickable-tile, deep-link, attention-feed, react, nextjs]

# Dependency graph
requires:
  - phase: 08-ui-redesign-and-write-action-coverage
    provides: "AttentionFeedPanel/StatCardRow/QuickFilterChips components, getAttentionFeed service, shared ExhibitTag/SeverityPill primitives, RecordRulingForm/TransferCustodyForm"
provides:
  - "Dense Carbon DataTable attention feed (Exhibit/Issue/Severity/Age/Action) with objection grounds inline"
  - "AttentionFeedEntry.objectionGrounds additive service field (HIGH/PENDING tiers)"
  - "Compact (<=80px) clickable KPI tile row linking to filtered views"
  - "Case Workspace read-on-mount of ?status / ?filter deep-link params"
  - "'no-custodian' QuickFilter chip"
affects: [09-06-case-workspace-deep-link, 09-15-live-indicator, command-center, case-workspace]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Carbon DataTable (raw Table/TableHead/TableRow/TableHeader/TableBody/TableCell primitives) for dense tabular panels"
    - "Carbon ClickableTile + router.push for KPI deep-links (no Next <Link> as-prop)"
    - "useSearchParams read in useState initializer (read-on-mount, no useEffect) behind a Suspense boundary"

key-files:
  created: []
  modified:
    - src/services/attentionFeed.ts
    - src/components/command-center/AttentionFeedPanel.tsx
    - src/components/command-center/AttentionFeedPanel.module.scss
    - src/components/command-center/StatCardRow.tsx
    - src/components/command-center/StatCardRow.module.scss
    - src/components/command-center/ObjectionsPanel.tsx
    - src/app/case/page.tsx
    - src/components/case/QuickFilterChips.tsx
    - e2e/command-center.spec.ts

key-decisions:
  - "objectionGrounds is additive to the existing AttentionFeedEntry TS type — no API contract doc edit needed (not a breaking shape change)"
  - "KPI tiles navigate via router.push in onClick (ClickableTile has no Next Link as-prop); red-outline reapplied via conditional .critical class since ClickableTile has no critical prop"
  - "Admitted sub-caption rendered compactly on the label line with a native title tooltip to hold the 80px ceiling"
  - "Deep-link params read in useState initializers (not useEffect) so the first render reflects the URL; only status/filter are deep-linkable per ticket scope"

patterns-established:
  - "Dense DataTable for at-a-glance panels that must fit above the fold"
  - "KPI tile → filtered-view deep-link via ClickableTile + router.push"

# Metrics
duration: 35 min
completed: 2026-10-10
---

# Phase 9 Plan 01: Command Center First-Viewport Rebuild (T-01) Summary

**Rebuilt the Command Center's first viewport so the ranked attention list is visible without scrolling at 1440x900: KPI tiles shrunk to a compact (<=80px) clickable row linking to filtered views, and the attention feed replaced with a dense Carbon DataTable showing objection grounds inline.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-10-10T17:28:00Z
- **Completed:** 2026-10-10T18:03:34Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- Attention feed rebuilt from stacked Cards into a dense Carbon DataTable (Exhibit / Issue / Severity / Age / Action), rendering the server tier order verbatim with zero client sort and showing each objection's grounds inline in the Issue cell with no extra click.
- Added the additive `objectionGrounds?: string` field to `AttentionFeedEntry`, populated on HIGH (from the existing objection lookup) and PENDING (from the row's own grounds) tiers; undefined on CRITICAL/MEDIUM.
- The 4 KPI tiles are now compact (<=80px tall), clickable `ClickableTile`s deep-linking to their filtered views (Open objections → `#objections`, Custody gaps → `/case?filter=no-custodian`, Jury package blockers → `/jury-package`, Admitted → `/case?status=ADMITTED`).
- Case Workspace now reads `?status` and `?filter` on mount (via `useState` initializers behind a `Suspense` boundary) so the KPI deep-links pre-select the matching status filter / quick-filter chip on the first render; added the new `no-custodian` QuickFilter.

## Task Commits

Each task was committed atomically:

1. **Task 1: objectionGrounds field + attention-feed DataTable** - `76c1deb` (feat)
2. **Task 2: compact clickable KPI tile row** - `33136db` (feat)
3. **Task 3: Case Workspace deep-link read + Playwright coverage** - `d1c4620` (feat)

## Files Created/Modified
- `src/services/attentionFeed.ts` - additive `objectionGrounds?` field on `AttentionFeedEntry`, populated on HIGH/PENDING tiers
- `src/components/command-center/AttentionFeedPanel.tsx` - Carbon DataTable rewrite (5 columns, inline grounds, local `elapsed()` Age helper, all inline actions + `data-*` attrs preserved on `TableRow`)
- `src/components/command-center/AttentionFeedPanel.module.scss` - `.table`/`.grounds`/`.age` classes; dead Card-era `.entry`/`.entryHeader`/`.detectedAt` removed
- `src/components/command-center/StatCardRow.tsx` - `ClickableTile` rebuild, side-by-side number+label, `router.push` deep-links, conditional `.critical`
- `src/components/command-center/StatCardRow.module.scss` - side-by-side flex, `heading-03`, `$spacing-04` padding, `max-height:80px`, `.critical` outline
- `src/components/command-center/ObjectionsPanel.tsx` - `id="objections"` on the wrapping Tile for the `#objections` anchor
- `src/app/case/page.tsx` - split into `CaseWorkspaceInner` (read-on-mount of `status`/`filter`) + `Suspense`-wrapping default export
- `src/components/case/QuickFilterChips.tsx` - `no-custodian` QuickFilter member, chip, count, and `applyQuickFilter` branch
- `e2e/command-center.spec.ts` - 10 new tests (tile height + 4 tile links; 3 deep-link read-on-mount; inline-grounds + column headers)

## Decisions Made
- `objectionGrounds` is additive to the existing TS type, so no API contract document edit was required (TechArch/03-api.md already describes `AttentionFeedEntry` generically).
- KPI tiles navigate via `router.push` inside `onClick` (ClickableTile exposes no Next `<Link>` as-prop), mirroring the existing pattern in `AttentionFeedPanel`.
- Jury-blockers red-outline reapplied via a conditional `.critical` CSS Module class since `ClickableTile` has no `critical` prop.
- Deep-link params read in `useState` initializers (not `useEffect`) so the first render already reflects the URL — no flash of the unfiltered list.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None found. (The one grep hit — `src/app/case/page.tsx:68` "native-disabled placeholder" — is a pre-existing documented scope-boundary comment from plan 08-11, not introduced here and not blocking.)

## Issues Encountered
- **Shared-working-tree build/dev-server churn (environment, recurring).** Multiple Phase-9 sibling plans execute in parallel against the same working tree and the same shared Postgres. During verification this caused: (1) a concurrent `git reset` that wiped Task 1's uncommitted edits once (re-applied and committed immediately — no work lost); (2) the shared `next dev` server on :3000 repeatedly dying mid-Playwright-run (every failure was `net::ERR_CONNECTION_REFUSED`, not a code defect); and (3) a sibling `next build` overwriting `.next` so `next start` briefly served a stale snapshot. Resolved by running the test suite against a self-owned `next start` production build (a static snapshot immune to source churn), on which the full `command-center.spec.ts` passed **32/32 (+1 skip)**.
- **Seed drift on a shared-DB regression test (environment, pre-existing hazard).** `case-workspace-discrepancies.spec.ts`'s "P-7 shows Open objection pill" test failed once because a sibling plan's `recordRuling` test had resolved P-7's objection on the shared seed (`hasUnresolvedObjection: false`). The test file is untouched by this plan; it passes deterministically after `runSeed()` (verified). Documented in STATE.md as the recurring shared-DB flake.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The Command Center first viewport is rebuilt per T-01; the ranked attention list is visible without scrolling at 1440x900.
- `case/page.tsx` and `command-center/page.tsx` are now the base the sequenced siblings (T-06 Case Workspace deep-link, T-15 Live Indicator) build on.
- Verification gates all green: `tsc --noEmit` EXIT 0; `next build` EXIT 0; `attentionFeed.test.ts` 5/5; `command-center.spec.ts` 32 passed / 1 skipped / 0 failed.

## Self-Check: PASSED
- All modified files present on disk (9/9 + SUMMARY.md)
- All 3 task commits present in git history (76c1deb, 33136db, d1c4620)
- Plan-level build: `next build` EXIT 0 ("Compiled successfully")
- `## Known Stubs` section present; no blocking stubs

---
*Phase: 09-ui-tickets-and-typography-standard*
*Completed: 2026-10-10*
