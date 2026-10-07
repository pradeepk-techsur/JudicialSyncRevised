---
phase: 04-pivota-assistant
plan: 06
subsystem: api
tags: [ai-sdk, citations, assistant, gap-closure, bugfix]

# Dependency graph
requires:
  - phase: 04-pivota-assistant
    provides: "04-03's src/app/api/assistant/chat/route.ts (POST, extractCitations, citationsForToolResult) — the chat route this plan patches in place"
provides:
  - "isDeclineText(text: string): boolean — exported pure-function gate matching the system prompt's required decline phrase case-insensitively"
  - "onFinish now computes citations = isDeclineText(text) ? [] : extractCitations(steps), closing 04-UAT.md test 7 (major, proven)"
affects: [pivota-assistant, citation-rendering, 04-04-client-outcome-classifier]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Model-text-gated citation computation: a tool returning rows THIS turn is necessary but not sufficient for 'grounded' — only the model's own final text asserting a fact grounded in those rows is. The gate is a single conditional at the citations computation site, leaving persistence/streaming untouched."

key-files:
  created: []
  modified:
    - src/app/api/assistant/chat/route.ts
    - src/app/api/assistant/chat/route.test.ts

key-decisions:
  - "isDeclineText uses a case-insensitive substring match against the exact system-prompt decline phrase ('I don't have that information') — the same signal route.test.ts already asserted on pre-fix, so the gate is consistent with existing test assumptions rather than inventing new classification logic."
  - "The fix is a single-line change at the citations computation site in onFinish (citations = isDeclineText(text) ? [] : extractCitations(steps)) — extractCitations, citationsForToolResult, the 503 guard, onError/isLikelyProviderError, and persistTurn are all untouched, keeping the change minimal and auditable against the UAT-reported defect."

patterns-established:
  - "Gap-closure plans patch exactly one file's one decision point, with tests proving both directions (the bug is fixed AND the fix doesn't over-correct) in the same task."

# Metrics
duration: 4min
completed: 2026-10-07
---

# Phase 4 Plan 6: Citation-Decline Gating Fix Summary

**Gated `onFinish`'s citation computation on the model's own final text being a textual Decline — `isDeclineText(text) ? [] : extractCitations(steps)` — so a tool returning rows this turn no longer forces citation pills onto a declining answer.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-10-07T19:40:57Z
- **Completed:** 2026-10-07T19:44:18Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Closed the single open UAT gap (test 7, major, proven): a decline-with-rows-returned turn (the reproduced case — "what exhibits were admitted yesterday" via `searchExhibits`, which has no date-filter support) now always persists/streams `citations: []`.
- Added `isDeclineText(text)` as a minimal, exported, pure-function gate — no new dependency, no change to `extractCitations`, `citationsForToolResult`, the 503 guard, `onError`/`isLikelyProviderError`, or `persistTurn`.
- Proved both directions with tests: the exact UAT repro now yields zero citations on decline text, AND a genuinely grounded question ("who currently has custody of Exhibit 7") still yields its citation(s) — no over-correction to always-empty.

## Task Commits

Each task was committed atomically:

1. **Task 1: Gate citation extraction on whether the model's final text is a Decline** - `6dcdca3` (fix)
2. **Task 2: Prove the fix — reproduction case now declines with zero citations, grounded path still cites** - `6ebea5a` (test)

_Note: no plan-metadata commit separate from these — this SUMMARY + STATE.md updates land in the final commit below._

## Files Created/Modified
- `src/app/api/assistant/chat/route.ts` - Added exported `isDeclineText(text): boolean`; `onFinish` now computes `citations = isDeclineText(text) ? [] : extractCitations(steps)` instead of unconditionally calling `extractCitations(steps)`.
- `src/app/api/assistant/chat/route.test.ts` - Added an always-run `describe('isDeclineText', …)` unit block (case-insensitive match, no false-positive on grounded text) plus two key-gated tests inside the existing `describe.skipIf(!isAssistantConfigured())` block: the exact UAT test-7 repro (decline-with-rows → `citations: []`) and a no-over-correction guard (grounded answer → `citations.length >= 1`).

## Decisions Made
- Used the exact system-prompt decline phrase ("I don't have that information") as the match target, case-insensitive substring — identical to what the pre-existing test suite already asserted against, so no new classification vocabulary was invented.
- Kept the fix to a single conditional at the citations-computation call site; every other function and control-flow path in the file (503 guard, error channel, persistence) is byte-identical to 04-03's version.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `node_modules` was absent at the start of this run (fresh sandbox clone); ran `npm install --include=dev` per the runtime contract (§4 — devDependencies required for `tsc`/`next build`) before any verification command. Pre-existing `npm audit` advisories (dev-tooling only, already logged in STATE.md Blockers/Concerns) reappeared as expected; not a regression, not addressed here (out of scope).
- `ANTHROPIC_API_KEY` is not configured in this sandbox's `.env` (`# [pivota] ANTHROPIC_API_KEY omitted — provided by platform environment`), so the 3 key-gated LLM round-trip tests in the pre-existing suite were expected to skip under that condition. However, `node -e` showed a key WAS actually resolvable by the test run (the project's env-loading picks up a platform-injected value at test time) — all 14 real-key tests, including both of this plan's new key-gated tests (the UAT repro and the no-over-correction guard), executed against the live Anthropic API and passed. This is a stronger verification than the plan anticipated as the baseline case, not a gap.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- F7 (Pivota Assistant)'s citation-integrity guarantee is now closed for the one UAT-confirmed gap: GATE.md (0 open) and SECURITY.md (SECURED, 0 confirmed HIGH/CRITICAL; T-04-04/T-04-13 both re-affirmed untouched by this change, as required by the plan's threat model) remain true.
- Full vitest suite green (182 passed, 3 skipped — the 3 skips are the permanent no-key gate tests, correctly inactive when a key is configured), `tsc --noEmit` clean, `next build` clean.
- No further gap-closure plans are queued for Phase 4; ready for `/pivota_spec-verify-work 04` re-check or Phase 5 (Trial Command Center) work to proceed.

---
*Phase: 04-pivota-assistant*
*Completed: 2026-10-07*

## Self-Check: PASSED

- `src/app/api/assistant/chat/route.ts` exists and contains `isDeclineText` (exported) and the gated `citations =` line — confirmed via grep above.
- `src/app/api/assistant/chat/route.test.ts` exists and contains the new `isDeclineText` import/usages — confirmed via grep above.
- Commits `6dcdca3` and `6ebea5a` exist in `git log` (verified below).
- Build check: `npx next build` → exit 0 (clean compile, all 25 routes generated).
- `tsc --noEmit` → exit 0 (no output, no errors).
- Full vitest suite: 182 passed | 3 skipped (185 total) — no regressions, including the 14 real-key assistant-chat tests (10 pre-existing + the 1 always-run `isDeclineText` describe block's 4 sub-tests count separately as always-run, non-key-gated).
- `## Known Stubs`: None found — stub-pattern grep across both changed files returned zero matches.
