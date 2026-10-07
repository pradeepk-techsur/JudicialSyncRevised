---
phase: 05-trial-command-center-live-sync
verified: 2026-10-07T21:49:38Z
status: passed
score: 3/3 success criteria verified (18/18 must-have truths across 3 plans)
human_verification:
  - test: "Discrepancies panel false-negative guard (W1 fix) — force only the /exhibits poll to fail while /discrepancies succeeds and genuine open flags exist"
    expected: "Panel surfaces the inline 'Unable to load discrepancies — please retry' error (NOT a false 'No open discrepancies' all-clear)"
    why_human: "The code folds exhibitList.isError into the panel isError (verified by inspection, REVIEW W1 c03537d), but the E2E only exercises the /discrepancies-500 path, not the /exhibits-fails-while-/discrepancies-succeeds path; this UI error-path has no unit/E2E coverage."
  - test: "Recent-activity fade-in timer race (W2 fix) — trigger two new events into the feed within the same ~400ms window"
    expected: "Both new rows highlight amber and each independently fades to transparent within ~400ms; neither stays highlighted indefinitely"
    why_human: "Timer-race UI behavior; the per-id Map<id,timeoutId> fix is verified by inspection (REVIEW W2 0b3e0ef) but has no automated timing test."
---

# Phase 5: Trial Command Center & Live-Sync Verification Report

**Phase Goal:** A judge or deputy can glance at one ambient screen at any point during live proceedings and immediately see the trial's current state — with zero configuration — and that screen, along with every other open screen, reflects new activity within the demo's live-sync window without a manual refresh. (Requirement F8)

**Verified:** 2026-10-07T21:49:38Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth (Success Criterion) | Status | Evidence |
| - | ------------------------- | ------ | -------- |
| 1 | Open Command Center with zero config → immediately see recent status changes, unresolved objections, outstanding discrepancies for the active trial | ✓ VERIFIED | `/command-center` page.tsx composes 3 panels; `/` → redirect('/command-center'); `getRecentActivity` rolling latest-event-day window guarantees non-empty feed; activity+objections+discrepancies endpoints boot-smoke-verified 200 with seeded data; E2E Test 1 asserts 3 panels + ≥1 row |
| 2 | A new event recorded in one tab reflects on Command Center + every other open screen within one polling interval, no manual refresh | ✓ VERIFIED | All 3 hooks `refetchInterval: 4_000` + `refetchOnWindowFocus: true` globally (providers.tsx); `refetchIntervalInBackground` left default (pause-while-hidden); E2E Test 4 records a status event via request and asserts it appears on an already-open tab within 6s, no reload |
| 3 | Command Center exposes NO path to record/edit/acknowledge — strictly passive/read-only | ✓ VERIFIED | grep across `src/components/command-center/` + `src/app/command-center/` finds NO form/input/textarea/onSubmit/POST/mutate/create/acknowledge; `activity.ts` performs zero writes (grep confirmed); only interactive elements are next/link + read-refetch retry; E2E Test 3 asserts 0 forms/inputs/textareas + no mutation-named buttons |

**Score:** 3/3 success criteria verified

### Supporting Truth Detail (18 plan-level must-have truths)

**Plan 05-01 (backend):** all 6 verified — activity endpoint returns RecentActivityEntry[] newest-first; rolling latest-event-day window; shared `summarizeEvent` reused (wording parity test deep-equals getExhibitHistory); sealed exclusion as WHERE predicate (`exhibit: { isSealed: false }` keyed on `canViewSealed(role)`); `since` 422 / 500 COMMAND_CENTER_LOAD_FAILED split; role-scoped getUnresolvedObjections.

**Plan 05-02 (hooks):** all 4 verified — three independent role-keyed 4s hooks; global refetchOnWindowFocus; pause-while-hidden via default; useFreshness seconds-since-last-success.

**Plan 05-03 (UI):** all 8 verified — three ambient panels; `/` redirect + sidebar first-item (Jury/Assistant preserved); fade-in on new rows (per-id Map timer); read-only link-through only; sealed absent from all three panels; independent per-panel states; deep-link routing; objections route passes parseRequestingRole.

### Required Artifacts (21 files, all levels)

| Artifact | Status | Details |
| -------- | ------ | ------- |
| src/services/activity.ts (142L) | ✓ VERIFIED | getRecentActivity + RecentActivityEntry; sealed WHERE predicate; reuses summarizeEvent; zero writes |
| src/services/activity.test.ts (158L) | ✓ VERIFIED | 6 tests pass (newest-first, sealed-absence, wording-parity, since-422, window) |
| src/app/api/cases/[id]/activity/route.ts (38L) | ✓ VERIFIED | thin GET; AppError→passthrough, else→CommandCenterLoadError |
| src/app/api/cases/[id]/activity/route.test.ts (132L) | ✓ VERIFIED | 5 tests pass |
| src/services/history.ts (202L) | ✓ VERIFIED | summarizeEvent exported |
| src/lib/errors.ts (121L) | ✓ VERIFIED | CommandCenterLoadError / COMMAND_CENTER_LOAD_FAILED |
| src/services/objections.ts (278L) | ✓ VERIFIED | getUnresolvedObjections optional role + isSealed predicate |
| src/hooks/useRecentActivity.ts (36L) | ✓ VERIFIED | ['activity',caseId,role] @4s, retry:false |
| src/hooks/useUnresolvedObjections.ts (38L) | ✓ VERIFIED | ['objections',caseId,role] @4s |
| src/hooks/useDiscrepancies.ts (43L) | ✓ VERIFIED | ['discrepancies',caseId,role] @4s |
| src/hooks/useFreshness.ts (29L) | ✓ VERIFIED | dataUpdatedAt→secondsAgo ticker |
| src/app/providers.tsx (28L) | ✓ VERIFIED | refetchOnWindowFocus:true, no background interval |
| src/app/command-center/page.tsx (39L) | ✓ VERIFIED | composes 3 panels, single activity instance |
| src/components/command-center/RecentActivityPanel.tsx (166L) | ✓ VERIFIED | full-width scrollable, fade-in (per-id Map), deep-link |
| src/components/command-center/ObjectionsPanel.tsx (89L) | ✓ VERIFIED | count+list, all-clear empty, link-through |
| src/components/command-center/DiscrepanciesPanel.tsx (144L) | ✓ VERIFIED | sealed-filtered (intersection), amber badge, isError folds exhibitList |
| src/components/command-center/FreshnessIndicator.tsx (40L) | ✓ VERIFIED | formats useFreshness, freshness-indicator testid |
| src/components/shell/Sidebar.tsx (35L) | ✓ VERIFIED | Command Center first; Case/Jury/Assistant preserved |
| src/app/page.tsx (7L) | ✓ VERIFIED | redirect('/command-center') |
| src/app/api/cases/[id]/objections/route.ts (36L) | ✓ VERIFIED | passes parseRequestingRole |
| e2e/command-center.spec.ts (228L) | ✓ VERIFIED | 7 tests across all criteria + sealed/isolation/link-through |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| activity.ts | history.ts summarizeEvent | import + call per event | ✓ WIRED |
| activity.ts | prisma.exhibitEvent | findMany + isSealed predicate + orderBy desc | ✓ WIRED |
| activity route | getRecentActivity | parseRequestingRole + since passthrough | ✓ WIRED |
| useRecentActivity | /api/cases/:id/activity | apiFetch keyed caseId+role | ✓ WIRED |
| useDiscrepancies | /api/cases/:id/discrepancies | apiFetch (Phase 3 route) | ✓ WIRED |
| providers.tsx | QueryClient defaultOptions | refetchOnWindowFocus:true | ✓ WIRED |
| page.tsx | 3 hooks | one per panel, single activity instance shared | ✓ WIRED |
| RecentActivityPanel | /exhibit/:id?event= | next/link per row | ✓ WIRED |
| page.tsx (root) | /command-center | redirect | ✓ WIRED |
| Sidebar | /command-center | Link, first nav item | ✓ WIRED |
| objections route | getUnresolvedObjections(caseId, role) | parseRequestingRole | ✓ WIRED |
| DiscrepanciesPanel | useExhibitList ∩ flags | visibleIds intersection (sealed filter) | ✓ WIRED |

### Requirements Coverage

| Requirement | Status | Note |
| ----------- | ------ | ---- |
| F8 — Trial Command Center Screen | ✓ SATISFIED | All 3 ROADMAP criteria verified end-to-end |

### Anti-Patterns Found

None. No TODO/FIXME/placeholder/stub in any Phase 5 file. SUMMARY "Known Stubs" sections all report none; confirmed by inspection. All panels substantive (89–166 lines), no empty returns, no console.log-only handlers.

### Gate & Review Evidence (cited, not re-litigated)

- **GATE.md:** `gate_status: passed`, `boot_smoke: pass`, `review_blockers_open: 0`, `shadowed_sources: 0`, `tests_disabled_during_fixes: none`. All 3 waves + phase_gate build+tests pass (195 passed | 3 skipped, 32 files). Phase gate re-ran the full suite on the final tree after fixer commits c03537d/0b3e0ef — green.
- **REVIEW.md:** iteration-2 status clean, 0 blockers, 0 warnings (both iteration-1 WARNINGs fixed and re-verified).
- **Boot-smoke (current source):** `/` → 307 → `/command-center` → 200; activity + objections?status=unresolved + discrepancies endpoints all 200 with real seeded data; 14 DB relations, migrations applied, seed complete.
- **Behavioral spot-check (this verification):** `vitest run src/services/activity.test.ts src/app/api/cases/[id]/activity/route.test.ts` → 11 passed (exercises sealed-absence, wording-parity, since-422, newest-first).

### Human Verification Required

Two recommended spot-checks (code verified correct by inspection; no automated coverage for these specific error/timing paths — both are the REVIEW.md W1/W2 fixes flagged "requires human verification"):

1. **Discrepancies false-negative guard (W1):** Force only `/exhibits` to fail while `/discrepancies` succeeds with open flags present → the panel must show its inline error, NOT a false "No open discrepancies."
2. **Fade-in timer race (W2):** Two new events into the feed within ~400ms → both rows highlight and each fades independently; neither sticks.

### Gaps Summary

None. All three ROADMAP success criteria are achieved and verified against the actual codebase: the Command Center opens with zero config and shows the three ambient panels for the active trial (criterion 1); every panel polls at 4s with focus-refetch so a new event appears on an already-open screen within one interval with no reload — proven by the multi-tab E2E (criterion 2); and the screen is strictly read-only with link-through-only navigation and zero write affordances anywhere (criterion 3). Sealed exhibits/events are excluded as server-side WHERE predicates across all three panels and are never counted. Gates are green and boot-smoke confirms the live stack serves the screen and its endpoints with seeded data. The two human-verification items are belt-and-suspenders confirmations of error/timing paths whose code is already verified correct by inspection and by the reviewer.

---

_Verified: 2026-10-07T21:49:38Z_
_Verifier: Claude (pivota_spec-verifier)_
