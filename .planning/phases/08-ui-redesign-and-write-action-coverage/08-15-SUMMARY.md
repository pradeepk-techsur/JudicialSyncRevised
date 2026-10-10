---
phase: 08-ui-redesign-and-write-action-coverage
plan: 15
subsystem: ui
tags: [react, react-query, carbon, attention-feed, write-actions, f08, f24, command-center]

# Dependency graph
requires:
  - phase: 08-03
    provides: shared Card chrome (critical red-left-border variant), SeverityPill, ExhibitTag, TwoColorProgressBar
  - phase: 08-06
    provides: getAttentionFeed service + GET /api/cases/:id/attention-feed (4-tier ranked evaluator)
  - phase: 08-09
    provides: RecordRulingForm / TransferCustodyForm shared write-action forms + their mutation hooks
  - phase: 08-10
    provides: command-center/page.tsx baseline redesign (stat cards, distribution bar, custody panel) with the attention-feed + jury-widget slots left open
provides:
  - "useAttentionFeed — 4s-polling live-sync hook over the attention-feed endpoint (role+caseId query key)"
  - "AttentionFeedPanel — tier-ranked feed with F20-gated inline Record-ruling / Assign-custodian / Review-and-remove actions; the Command Center's ONLY write surface"
  - "JuryPackageSummaryWidget — link-through-only widget with cross-screen clean/total parity to the Jury Package Workspace"
  - "Completed F08 Command Center redesign + F24's final (5th) consuming surface"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-given ordering rendered verbatim (zero client re-sort) as the correctness guarantee"
    - "Cross-screen ratio parity by CONSTRUCTION: identical source query + identical derivation expression + same shared component"
    - "No-optimistic-update inline write: the entry waits for the next (invalidation-triggered) server read, never a client-side splice"

key-files:
  created:
    - src/hooks/useAttentionFeed.ts
    - src/components/command-center/AttentionFeedPanel.tsx
    - src/components/command-center/AttentionFeedPanel.module.scss
    - src/components/command-center/JuryPackageSummaryWidget.tsx
    - src/components/command-center/JuryPackageSummaryWidget.module.scss
  modified:
    - src/app/command-center/page.tsx
    - e2e/command-center.spec.ts

key-decisions:
  - "JuryPackageSummaryWidget computes clean = exhibits.filter(!isSealed && flags.length===0).length (IDENTICAL to JuryPackageDraft's cleanRows), NOT the plan's illustrative total-minus-blocked, so an acknowledged-but-flagged row counts identically on both surfaces — true cross-screen parity"
  - "Tier-ordering + all-4-tier + no-optimistic-update tests use deterministic page.route mocks (the live seed carries no CRITICAL row); role-gating still proven against the real role-switcher so the client absent-not-disabled gate is exercised for real"
  - "The pre-existing blanket 'strictly read-only' e2e test was rescoped to every panel EXCEPT the attention feed — the feed is F08's single deliberate reversal of Phase 5's read-only criterion"

patterns-established:
  - "Attention-feed entry = shared Card (critical for CRITICAL tier) + SeverityPill + ExhibitTag + inline action, never a bespoke div"

# Metrics
duration: 18 min
completed: 2026-10-09
---

# Phase 8 Plan 15: Command Center Attention Feed + Jury Package Summary Widget Summary

**Tier-ranked "Needs your attention" feed with F20-gated inline Record-ruling/Assign-custodian actions (the Command Center's sole, deliberate write surface) plus a link-through Jury Package summary widget whose clean/total ratio matches the Jury Package Workspace by construction — completing F08's redesign and F24's final consuming surface.**

## Performance

- **Duration:** 18 min
- **Tasks:** 2
- **Files created:** 5
- **Files modified:** 2

## Accomplishments
- `useAttentionFeed` — the 4s-polling live-sync hook over `GET /api/cases/:id/attention-feed`, role+caseId in the query key, `retry: false`, returning the server-given tier order verbatim.
- `AttentionFeedPanel` — renders entries in the EXACT server order (CRITICAL→HIGH→PENDING→MEDIUM, newest-first within tier) with ZERO client re-sort; each entry wrapped in the shared `Card` (critical red-left-border for CRITICAL tier), carrying `SeverityPill` + `ExhibitTag` + the correct inline action. Record ruling (JUDGE) / Assign custodian (DEPUTY/CLERK/ADMIN) are ABSENT-not-disabled per role and expand the 08-09 shared forms INLINE (never a modal, never navigation); CRITICAL's "Review and remove →" links through to the Jury Package Workspace. No optimistic removal — a successful action waits for the next (invalidation-triggered) server read.
- `JuryPackageSummaryWidget` — link-through-only, reusing the existing `useJuryPackage` query (no new fetch), rendering the IDENTICAL clean/total ratio the Jury Package Workspace computes via the SAME `TwoColorProgressBar`.
- Both wired into `command-center/page.tsx`: the feed full-width between the distribution bar and the lower rows; the widget alongside `CustodyAtAGlancePanel`.
- Full Playwright coverage: 8 new tests; the entire `command-center.spec.ts` suite is **24/24 green, 0 skipped**.

## Task Commits

1. **Task 1: useAttentionFeed hook + AttentionFeedPanel** - `6cf939f` (feat)
2. **Task 2: JuryPackageSummaryWidget + page wiring + full attention-feed e2e** - `ff2ad57` (feat)

## Files Created/Modified
- `src/hooks/useAttentionFeed.ts` - 4s-polling live-sync hook over the attention-feed endpoint.
- `src/components/command-center/AttentionFeedPanel.tsx` - tier-ranked feed + F20-gated inline actions.
- `src/components/command-center/AttentionFeedPanel.module.scss` - entry/header/summary styling (Carbon tokens).
- `src/components/command-center/JuryPackageSummaryWidget.tsx` - link-through widget with cross-screen parity.
- `src/components/command-center/JuryPackageSummaryWidget.module.scss` - widget styling.
- `src/app/command-center/page.tsx` - wires both panels into the layout; updated block comment.
- `e2e/command-center.spec.ts` - 8 new attention-feed/widget tests + rescoped read-only test.

## Decisions Made
- **Parity by construction, not by the plan's example math.** The plan's illustrative widget computed `blocked = flags.some(OPEN) || isSealed; clean = total - blocked`. The Jury Package Workspace actually renders `clean = exhibits.filter(!isSealed && flags.length===0).length` (acknowledged-but-flagged rows are NOT clean). I matched the Workspace's exact expression so the two surfaces can never diverge — directly satisfying the must_have. (See Deviations, Rule 1.)
- **Mocked tier fixtures for the ordering/4-tier/no-optimistic-update tests.** The live seed carries HIGH (P-7), two PENDING (P-3, P-1), and MEDIUM (P-6) but NO CRITICAL row (no sealed exhibit is in a jury package), so a deterministic `page.route` mock is the only way to exercise all four tiers and a clean no-optimistic-update window. Role-gating is still proven against the real role-switcher (the client absent-not-disabled gate runs for real).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Widget clean/total derivation corrected for true cross-screen parity**
- **Found during:** Task 2 (JuryPackageSummaryWidget)
- **Issue:** The plan's illustrative widget code derived `clean` as `total - blocked` where `blocked = flags.some(f=>f.status==='OPEN') || isSealed`. The Jury Package Workspace's own header bar derives `clean = exhibits.filter(r => !r.isSealed && r.flags.length===0).length`. These differ for an acknowledged-but-flagged row (flags non-empty but no OPEN flag): the plan's version counts it clean, the Workspace does not — breaking the must_have "identical ratio … via the SAME component."
- **Fix:** Used the Workspace's exact expression in the widget so the ratio matches by construction.
- **Files modified:** src/components/command-center/JuryPackageSummaryWidget.tsx
- **Verification:** New cross-screen parity e2e asserts the widget's and the Workspace's `two-color-progress-caption` are byte-identical ("2 of 3 exhibits are clean · 1 blocker remain") off one mocked payload.
- **Committed in:** ff2ad57

**2. [Rule 1 - Bug] Pre-existing "strictly read-only" e2e test rescoped**
- **Found during:** Task 2 (e2e coverage)
- **Issue:** The existing test `exposes no record/edit/acknowledge path — link-through only` asserted the ENTIRE command center has zero mutation-named buttons. As the default JUDGE, the new attention feed renders a "Record ruling" button on HIGH/PENDING entries — the test would (correctly) fail, because the feed is F08's single deliberate reversal of the read-only criterion.
- **Fix:** Rescoped the test to assert read-only on every panel EXCEPT the attention feed (recent activity, objections, discrepancies, stat cards, jury-package widget), proving exactly the must_have boundary.
- **Files modified:** e2e/command-center.spec.ts
- **Verification:** Rescoped test passes; full suite 24/24 green.
- **Committed in:** ff2ad57

---

**Total deviations:** 2 auto-fixed (both Rule 1 — correctness). **Impact on plan:** Both were necessary to satisfy the plan's own must_haves (cross-screen parity; the feed as the one sanctioned write surface). No scope creep.

## Known Stubs
None found — grep for TODO/FIXME/placeholder/not-implemented across all changed files returned nothing; the widget's three states (loading / no-package / live) and the feed's loading/error/empty/populated states are all real.

## Issues Encountered
- Carbon `RadioButton`'s native input is overlaid by its visual span (a recurring Phase-8 finding, also seen in 08-12): the no-optimistic-update test clicks the "Sustained" label text rather than `.check()`-ing the input. Resolved inline, no deviation needed.

## Next Phase Readiness
- **Phase 8 is now code-complete:** this was the final plan in the dependency chain (wave 4). The Command Center redesign (F08) and Write-Action UI Coverage (F24) are both fully delivered — F24's two actions now render across all intended surfaces (Command Center attention feed, Exhibit Detail header + Objection card, Jury Package blocker cards).
- Full `command-center.spec.ts` (24 tests, old + new) green; `tsc --noEmit` EXIT 0; `npm run build` EXIT 0.
- Ready for phase verification / transition.

## Self-Check: PASSED

---
*Phase: 08-ui-redesign-and-write-action-coverage*
*Completed: 2026-10-09*
