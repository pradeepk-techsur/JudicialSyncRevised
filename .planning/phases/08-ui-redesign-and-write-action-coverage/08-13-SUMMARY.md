---
phase: 08-ui-redesign-and-write-action-coverage
plan: 13
subsystem: ui
tags: [react, carbon, exhibit-detail, custody, objections, jury-package, playwright, F10, F24]

# Dependency graph
requires:
  - phase: 08-08
    provides: getExhibitHistory's objections[] / custodyCard / juryPackageChecklist read-time projections
  - phase: 08-09
    provides: shared RecordRulingForm (JUDGE-gated) consumed per-objection-thread
  - phase: 08-03
    provides: shared SeverityPill / Card primitives (SeverityPill evaluated, deliberately not used for the positive "Included" verdict)
  - phase: 08-07
    provides: loadJuryEligibilityByExhibit precedence (called by 08-08, surfaced unchanged here)
  - phase: 08-12
    provides: redesigned ExhibitHeader with the header-level Transfer-custody action (consumed by 08-13's P-1 custody e2e)
provides:
  - "ObjectionCard: per-thread UNRESOLVED objection list with its own correctly-scoped Record-ruling action, role-gated absent-not-disabled"
  - "CustodyCard: exactly-two-state chain-of-custody display + ordered chain + 'No gaps' confirmation, names resolved client-side from the roster"
  - "JuryPackageChecklistCard: 4-item ✓/✗ checklist + eligibility badge + Open-jury-package link"
  - "Timeline filter pills (All/Status/Custody/Objections) narrowing the already-loaded entries client-side"
  - "exhibit/[id]/page.tsx two-column layout (Timeline left, three-card right rail) reading ONE useExhibitHistory payload"
affects: [exhibit-detail, F10, verify-work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Right-rail cards read slices of ONE useExhibitHistory payload — zero independent per-card queries (F10 §Validation)"
    - "Client-side custodian-name resolution from the already-hydrated roleStore roster (no backend widening)"
    - "Client-side Timeline filtering via useMemo over the raw entries prop — zero change to the deep-link anchor/highlight contract"

key-files:
  created:
    - src/components/exhibit/ObjectionCard.tsx
    - src/components/exhibit/ObjectionCard.module.scss
    - src/components/exhibit/CustodyCard.tsx
    - src/components/exhibit/CustodyCard.module.scss
    - src/components/exhibit/JuryPackageChecklistCard.tsx
    - src/components/exhibit/JuryPackageChecklistCard.module.scss
  modified:
    - src/components/exhibit/Timeline.tsx
    - src/components/exhibit/Timeline.module.scss
    - src/app/exhibit/[id]/page.tsx
    - src/app/exhibit/[id]/page.module.scss
    - e2e/exhibit-detail.spec.ts

key-decisions:
  - "Jury-package eligibility badge rendered as a plain colored span, NOT SeverityPill — SeverityPill's tones (critical/high/pending/medium) are all urgency words that read oddly for the positive 'Included' verdict (plan's Claude's-Discretion allowance)"
  - "Timeline gains NO 'Rulings' pill (only All/Status/Custody/Objections) per Screenshot 2 — unlike Command Center's 5-pill set; 'Objections' covers both OBJECTION_RAISED and RULING_RECORDED"
  - "Custody/jury eligibility e2e assertions driven by mocks: eligibility is only INCLUDED/BLOCKED once a JuryPackage is computed (a fresh seed builds none → NOT_ELIGIBLE), so a live bucket read would be wrong independent of seed churn"

patterns-established:
  - "Belt-and-suspenders role gating: ObjectionCard's Record-ruling TRIGGER is wrapped in its own RULING_ROLES check in addition to RecordRulingForm's internal null-render (T-08-22)"

# Metrics
duration: 30 min
completed: 2026-10-09
---

# Phase 8 Plan 13: Exhibit Detail Right Rail + Timeline Filters Summary

**The Exhibit Detail two-column redesign — a wider Timeline (with client-side All/Status/Custody/Objections filter pills) beside a three-card right rail (per-thread Objection + Record-ruling, two-state Chain of Custody, 4-item Jury Package checklist), every card reading slices of the SAME getExhibitHistory payload.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-10-09T12:24:39Z
- **Completed:** 2026-10-09T12:54:30Z
- **Tasks:** 3
- **Files modified:** 11 (6 created, 5 modified)

## Accomplishments
- **ObjectionCard** renders every UNRESOLVED thread (zero → explicit "No open objections", never a blank card; one/several → one block each) with its OWN `RecordRulingForm` scoped to that row's `objectionId` — unambiguous with concurrent threads. The Record-ruling trigger is wrapped in a local `RULING_ROLES` gate (belt-and-suspenders over the form's own null-render) so a non-JUDGE role never even sees the affordance (T-08-22).
- **CustodyCard** has exactly two states (a resolved custodian name, or "No custodian of record") — never a pending third — plus an ordered chain with a "(current)" marker and a "✓ No gaps in the chain" confirmation when history is non-empty. Custodian names are resolved client-side from the already-hydrated `useRoleStore().users` roster (T-08-23 accept), since 08-08's `custodyCard.current`/`history` carry raw user ids, not joined names.
- **JuryPackageChecklistCard** renders the 4 per-condition ✓/✗ checks (admitted / no unresolved objections / custodian on record / not sealed) + the eligibility badge + an Open-jury-package link — all values computed by 08-08's backend (which calls 08-07's shared precedence), zero re-derivation.
- **Timeline** gained client-side filter pills (All/Status/Custody/Objections) narrowing the already-loaded `entries` via `useMemo` — zero new query, and the `id={event-${eventId}}` anchors + citation deep-link highlight contract (T-04-15/16) are untouched.
- **page.tsx** is now a two-column grid (Timeline left, three-card right rail) all fed by ONE `useExhibitHistory` call; the breadcrumb copy changed to "‹ Case Workspace" per Screenshot 2.
- Full `e2e/exhibit-detail.spec.ts` is **18/18 green, 0 skipped** (11 new 08-13 tests + the pre-existing + 08-12's header tests, which share the file).

## Task Commits

1. **Task 1: ObjectionCard** - `478ab58` (feat)
2. **Task 2: Custody/JuryPackage cards + Timeline pills + two-column layout** - `f2bc365` (feat)
3. **Task 3: e2e coverage** - `fabf3d2` (test) + `887da6e` (test — deterministic rewrite of the two seed-churn-flaky tests)

**Plan metadata:** (this commit) `docs(08-13): complete …`

## Files Created/Modified
- `src/components/exhibit/ObjectionCard.tsx(.module.scss)` - per-thread objection list + role-gated inline Record-ruling
- `src/components/exhibit/CustodyCard.tsx(.module.scss)` - two-state custody + ordered chain + no-gaps line, roster name resolution
- `src/components/exhibit/JuryPackageChecklistCard.tsx(.module.scss)` - 4-item checklist + eligibility badge + link-through
- `src/components/exhibit/Timeline.tsx(.module.scss)` - added client-side filter pills; became a `'use client'` component (useMemo/useState); entry rendering + anchors unchanged
- `src/app/exhibit/[id]/page.tsx(.module.scss)` - two-column grid wiring the three cards + Timeline; breadcrumb copy update
- `e2e/exhibit-detail.spec.ts` - 11 new tests covering all three cards' populated/empty states, the per-thread ruling role gate, the P-1 (OBJECTED, non-OFFERED) custody-fix + header Transfer-custody flow, and Timeline filter narrowing + deep-link highlight

## Decisions Made
- **Eligibility badge is a plain colored span, not SeverityPill** — the plan's explicit Claude's-Discretion allowance; SeverityPill's four tones are all urgency words and read oddly for the positive "Included" verdict. The ✓/✗ glyph + label text keep color from being the sole signal (Y2-accessibility).
- **No "Rulings" Timeline pill** — only All/Status/Custody/Objections per Screenshot 2 (Command Center's 5-pill set is a different surface). "Objections" admits both OBJECTION_RAISED and RULING_RECORDED.
- **e2e eligibility/custody-transfer/ruling flows are mock-driven** — mirrors the suite's established `page.route` technique; required both for determinism against the continuously-reseeded shared demo case AND because jury eligibility is only INCLUDED/BLOCKED once a JuryPackage exists (a fresh seed builds none).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Jury-checklist + Timeline e2e rewritten from live reads to mocks**
- **Found during:** Task 3 (verification)
- **Issue:** The plan's jury-checklist test assumed P-4 = INCLUDED and P-7 = BLOCKED from live fixtures. But `loadJuryEligibilityByExhibit`'s final branch returns NOT_ELIGIBLE for every exhibit when **no JuryPackage has been computed** — and a fresh seed builds none (packages are created by the 08-14 jury workspace, not the seed). So the live bucket assertion was incorrect independent of any seed churn. The Timeline test's live P-4 read was additionally non-deterministic against the shared demo case, which sibling Phase-8 plans re-seed continuously (observed `/api/case` returning nothing mid-run).
- **Fix:** Rewrote both tests to `page.route`-mock the history GET across the three eligibility buckets / a mixed timeline, exercising the real card rendering + real client-side filter + real `?event` highlight path with pinned data. 08-07/08-08 already prove the precedence rule itself against isolated fixtures.
- **Files modified:** e2e/exhibit-detail.spec.ts
- **Verification:** Full suite 18/18 green, 0 skipped.
- **Committed in:** `887da6e`

**2. [Rule 3 - Blocking] Extended the pre-existing F14 history mock with the three new payload slices**
- **Found during:** Task 3
- **Issue:** The redesigned page.tsx now renders ObjectionCard/CustodyCard/JuryPackageChecklistCard, which read `data.objections` / `data.custodyCard` / `data.juryPackageChecklist`. The pre-existing F14 test mocked a history payload WITHOUT those fields, which would crash the page.
- **Fix:** Added the three fields (empty/NOT_ELIGIBLE defaults) to that mock.
- **Files modified:** e2e/exhibit-detail.spec.ts
- **Verification:** F14 test green.
- **Committed in:** `fabf3d2`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking). **Impact:** Both necessary for a correct, deterministic test suite; no scope creep.

## Known Stubs
None found — no TODO/FIXME/placeholder/not-implemented markers in any 08-13 file; no blocking stubs.

## Issues Encountered
- **Recurring shared-working-tree / shared-DB hazard (documented throughout STATE.md).** Sibling Phase-8 plans (08-10/08-11/08-12/08-14) executed in parallel against the same working tree and the same seeded demo case. Transient whole-project `tsc`/`next build` errors from sibling-owned uncommitted files (ExhibitHeader.tsx, command-center/page.tsx) were observed and logged to `deferred-items.md` — **never fixed** (out of scope); the tree converged to tsc EXIT 0 + build EXIT 0 once siblings committed. The shared demo case was torn down and rebuilt by sibling `runSeed()` calls so frequently that live-fixture e2e reads flaked; the flaky real-fixture tests were converted to deterministic mocks (deviation 1). Staged ONLY 08-13's own files individually throughout; sibling-owned edits (including their appended sections in the shared `deferred-items.md` and their tests in the shared `exhibit-detail.spec.ts`) were preserved, never reverted.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- F10's Exhibit Detail redesign is complete together with 08-12 (header) — the full two-column screen is wired and e2e-covered.
- F24's "Record ruling" now has its third consuming surface (the per-thread Objection card) alongside the Command Center attention feed and the Jury Package workspace.
- No blockers introduced for remaining Phase 8 plans.

## Self-Check: PASSED
- All 6 created files exist on disk (verified with `[ -f ]`).
- All 4 task commits exist (478ab58, f2bc365, fabf3d2, 887da6e).
- Plan-level build check: `npm run build` → exit 0. `npx tsc --noEmit` → exit 0.
- `## Known Stubs` present, no blocking stubs.

---
*Phase: 08-ui-redesign-and-write-action-coverage*
*Completed: 2026-10-09*
