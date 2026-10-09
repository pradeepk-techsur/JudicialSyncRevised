---
phase: 07-fix-admission-integrity-and-ui-usability-issues
plan: 04
subsystem: ui
tags: [carbon, react, accessibility, keyboard, playwright, assistant, react-query]

# Dependency graph
requires:
  - phase: 02-core-screens
    provides: ExhibitTable + useExhibitList single-query path, ExhibitListRow shape
  - phase: 04-pivota-assistant
    provides: ExampleChips empty-state chips, chat route + its release-blocker test suite
  - phase: 06-carbon-design-system-ui-upgrade
    provides: Carbon Table/TableRow + Tag primitives the fixes build on
provides:
  - Fully clickable + keyboard-activatable Case Workspace exhibit rows (F15 item 1)
  - Assistant example prompts sourced from real seeded exhibit labels (F15 item 2)
  - An automated US-15.2 AC#3 cross-check test that fails on any chip referencing a non-seeded label
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fully Clickable List Row: tabIndex={0} + onKeyDown(Enter/Space) on the Carbon <tr> with a shared navigate() so click and keyboard paths cannot drift; role NOT overridden (a <tr> keeps its native row role)"
    - "Demo example prompts derived from live useExhibitList data (never hardcoded placeholder numbers), with stable seeded fallbacks that preserve the exactly-5-chips contract before the query resolves"

key-files:
  created: []
  modified:
    - src/components/case/ExhibitTable.tsx
    - src/components/case/ExhibitTable.module.scss
    - e2e/case-workspace.spec.ts
    - src/components/assistant/ExampleChips.tsx
    - src/app/api/assistant/chat/route.test.ts
    - e2e/assistant.spec.ts

key-decisions:
  - "Kept the <tr> native row role and added tabIndex={0}+onKeyDown rather than role='button' — role='button' on a <tr> is invalid table ARIA"
  - "Derived the 3 exhibit-specific prompts from useExhibitList (first ADMITTED / first-with-custodian / first exhibit) with 'P-4'/'P-1' fallbacks so exactly 5 chips always render even before the query warms"
  - "Updated chat-route DEMO_QUESTIONS to P-4/P-3 (real, grounded-resolvable) but left the isDeclineText string fixtures untouched — they are pure-function fixtures, not tied to seed data"

patterns-established:
  - "Cross-check test shape (US-15.2 AC#3): fetch the real seeded exhibit list, regex every P-/D-/S- token out of the rendered chips, assert each belongs to the real set — catches future fallback-literal drift, not just today's retired strings"

# Metrics
duration: ~35 min
completed: 2026-10-09
---

# Phase 7 Plan 04: Courtroom Usability Fixes (F15) Summary

**Case Workspace exhibit rows are now clickable across their entire area and keyboard-activatable (Tab+Enter/Space), and the Pivota Assistant's example prompts are sourced from the case's real seeded exhibit labels via useExhibitList — never the retired hardcoded "Exhibit 14"/"Exhibit 7" numbers that matched no real record.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-10-09T00:41Z
- **Completed:** 2026-10-09T01:16:30Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- **F15 item 1 — row clickability + keyboard parity.** Diagnosed the real cause against the running app: Carbon's `TableRow` already spreads `onClick` onto the native `<tr>` (so dead-center clicks worked), but it had **no keyboard support at all** (no `tabIndex`/`onKeyDown`). Added `tabIndex={0}` + an `onKeyDown` handler (Enter/Space, `preventDefault` on Space to stop page scroll) driving a shared `navigate()`, plus a `:hover` background and `:focus-visible` outline. Added a forward-looking comment that any future inline action control must `stopPropagation()`.
- **F15 item 2 — real example prompts.** Rewrote `ExampleChips` to derive its 3 exhibit-specific prompts from `useExhibitList({})` (the same single query path Case Workspace uses): jury-package ref = first `ADMITTED` exhibit, custody ref = first with a custodian, history ref = first exhibit — with stable fallbacks that keep exactly 5 chips before the query resolves.
- **Required automated cross-check (US-15.2 AC#3).** Added an `e2e/assistant.spec.ts` test that fetches the real seeded exhibit list and fails if any rendered chip mentions a `P-/D-/S-` label outside it — the literal shape the roadmap/FRD/user-story require (not a grep, not a chip-count check).
- **Chat-route test labels corrected.** `DEMO_QUESTIONS` now reference P-4/P-3; the key-gated "no-over-correction" grounded guard targets P-4 (which has a real custody chain), so it genuinely exercises the grounded-with-citations path.

## Task Commits

1. **Task 1: row clickability + keyboard activation** — `0d67eb8` (fix) — ExhibitTable.tsx + e2e/case-workspace.spec.ts
2. **Task 1 (follow-up): hover + focus-visible styles** — `58280b1` (fix) — ExhibitTable.module.scss (re-applied after a concurrent sibling plan clobbered the first write to the shared working tree; see Issues)
3. **Task 2: real-label example prompts + cross-check** — `2e361b4` (feat) — ExampleChips.tsx, chat/route.test.ts, e2e/assistant.spec.ts

_Plan metadata commit follows this SUMMARY._

## Files Created/Modified

- `src/components/case/ExhibitTable.tsx` — Shared `navigate()`; `tabIndex={0}` + `onKeyDown` (Enter/Space) on the `<tr>`; forward-looking stopPropagation comment.
- `src/components/case/ExhibitTable.module.scss` — Row `:hover` background (`$layer-hover`) + keyboard `:focus-visible` outline (`$focus`).
- `e2e/case-workspace.spec.ts` — 2 new tests: full-area edge clicks (far-left/far-right, not just dead-center) and Tab-focus + Enter navigation.
- `src/components/assistant/ExampleChips.tsx` — 3 exhibit-specific prompts derived from `useExhibitList` real data; `EXAMPLE_QUESTIONS` moved into the component body; defensive fallbacks preserve the 5-chip contract.
- `src/app/api/assistant/chat/route.test.ts` — `DEMO_QUESTIONS` → real labels (P-4/P-3); grounded guard retargeted to P-4; `isDeclineText` fixtures untouched.
- `e2e/assistant.spec.ts` — New US-15.2 AC#3 cross-check test (`realLabels.has`).

## Decisions Made

- Native `<tr>` role kept (no `role="button"`) — `tabIndex`+`onKeyDown` is the correct accessible mechanism for a table row (invalid ARIA otherwise).
- Example-prompt refs derived, not hardcoded; fallbacks are stable seeded labels used only until the query warms.
- `isDeclineText` string fixtures ("Exhibit 7"/"Exhibit 22"/…) left as-is — pure-function fixtures, explicitly out of scope per the plan.

## Deviations from Plan

None - plan executed exactly as written. (The one re-applied scss commit was a recovery from a concurrent sibling clobber, not a change in approach — see Issues Encountered.)

## Issues Encountered

The shared working tree / shared database hazard (long documented in STATE.md Blockers) manifested strongly during this run because multiple wave-1 plans (07-01/07-02/07-03/07-05) were executing concurrently against the same tree and the same `judicialsync` database. Three concrete incidents, all handled, all logged to `deferred-items.md`:

1. **scss write clobbered.** My Task-1 `ExhibitTable.module.scss` hover/focus edit was reverted by a sibling write before it was committed (the Task-1 commit landed with only the `.tsx`). Detected via post-commit grep, re-applied, and committed immediately as `58280b1`. Functionality was never at risk — the clickability/keyboard behaviour lives in the `.tsx` (committed) and the scss is cosmetic.

2. **Baked container image + thrashed shared DB.** The `docker-compose` `app` service runs from a COPY-baked image with **no bind mount**, so the running container never reflected live edits, and e2e against it initially "failed" (stale client bundle with no `tabindex`). Concurrent sibling seeds were also continuously re-running (sometimes crashing mid reset-rebuild on an FK violation) against the shared DB, repeatedly corrupting the demo case (observed reduced to a lone P-1). Resolved by verifying against a **host `next dev`** process (serving live source) pointed at an **isolated `verify0704` database** seeded from the known-good path — giving a stable P-1..P-5/D-1..D-3/S-1 fixture. The merged-HEAD gate should rebuild the app image (or add a dev bind mount).

3. **chat-route test `beforeAll` 10s timeout.** A sibling seed rewrite added `sleep(1200)` calls, pushing `runSeed()` to ~11s and timing out vitest's default `beforeAll`. Not a 07-04 defect (I only changed question strings). Proven by running with `--hookTimeout=30000`: the suite passes 16/16 (3 no-key paths skip since an ANTHROPIC key is present), including every real-label `DEMO_QUESTIONS` probe resolving grounded-or-decline and the P-4 grounded guard carrying ≥1 citation. Left to the owning plan / merged gate.

## Verification Results

- `npx tsc --noEmit` — **0 errors** across the whole project at completion (sibling files had stabilized by then; earlier transient cross-plan errors are documented in deferred-items.md).
- `npx next build` — **EXIT=0** (full app compiles with all changes).
- `npx playwright test e2e/case-workspace.spec.ts e2e/assistant.spec.ts --workers=1` — **15/15 passed** (7 case-workspace incl. the 2 new clickability/keyboard tests; 8 assistant incl. the new US-15.2 AC#3 cross-check).
- `npx vitest run src/app/api/assistant/chat/route.test.ts --hookTimeout=30000` — **16 passed / 3 skipped** (real-label DEMO_QUESTIONS all resolve correctly).
- Integration contracts: all 3 `CONTRACT_OK` (onKeyDown/tabIndex present; no hardcoded refs in ExampleChips; `realLabels.has` present in assistant.spec).
- Verification was performed against a host `next dev` server on `verify0704` (see Issues #2).

## Known Stubs

None found. (Stub-scan hits were false positives — the word "placeholder" appears only in a test description and in explanatory comments; no incomplete implementations.)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Both F15 usability defects in this plan's scope are fixed, tested, and build-clean.
- The merged-HEAD acceptance gate should: (a) rebuild the `app` docker image so the preview reflects merged source; (b) resolve the sibling seed's added `sleep()` vs vitest `beforeAll` 10s timeout (raise the hookTimeout or drop the sleeps). Both are logged in `deferred-items.md`.

## Self-Check: PASSED

- SUMMARY.md exists at the plan directory.
- All 6 modified files present on disk.
- All 3 task commits (`0d67eb8`, `58280b1`, `2e361b4`) present in git history.
- Plan-level `next build` ran with EXIT=0; full `tsc --noEmit` reports 0 errors.
- `## Known Stubs`: None (no blocking stubs).

---
*Phase: 07-fix-admission-integrity-and-ui-usability-issues*
*Completed: 2026-10-09*
