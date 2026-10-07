---
phase: 4
status: issues_found
blockers: 0
warnings: 2
files_reviewed: 2
files_reviewed_list:
  - src/app/api/assistant/chat/route.ts
  - src/app/api/assistant/chat/route.test.ts
reviewed_at: 2026-10-07T19:56:31Z
iteration: 1
---

# Phase 4 Code Review

Scope note: per the orchestrator's framing, this review covers only the gap-closure diff introduced by plan 04-06 (commits `6dcdca3`, `6ebea5a`, `ff02a61`), confirmed via `git diff --stat bdde5da ff02a61 -- . ':!.planning'` to touch exactly `src/app/api/assistant/chat/route.ts` and `src/app/api/assistant/chat/route.test.ts`. The prior 5 plans (04-01..04-05) are out of scope and were not re-reviewed.

## BLOCKERs

None.

## WARNINGs

### W1: `isDeclineText` is a whole-text substring gate, so a mixed grounded+decline answer loses its legitimate citations too
- **File:** `src/app/api/assistant/chat/route.ts:168, 251-253`
- **Evidence:** `isDeclineText(text)` returns `true` if the decline phrase appears *anywhere* in `text`, and the route then forces `citations = []` for the *entire* turn (`const citations = isDeclineText(text) ? [] : extractCitations(steps)`). The system prompt explicitly allows multi-fact/list answers ("In a list answer, cite each item individually, not once for the whole list," `systemPrompt.ts:54`) and the model can legitimately mix a grounded fact with a decline about a different record in the same turn (the prompt's own example — "I don't have that information about Exhibit 22's custody record" — is phrased as a sentence that could follow a grounded sentence about a different exhibit in the same answer). Verified with a synthetic case:
  ```js
  isDeclineText("Custody of Exhibit 7: Officer Diaz, as of October 3, 2026. I don't have that information about Exhibit 22's custody record.")
  // => true
  ```
  Under the new gate this entire turn — including the genuinely grounded Exhibit 7 custody fact — would persist and stream with `citations: []`, i.e. a grounded factual sentence rendered with no citation pill. This is the exact "ungrounded-looking grounded answer" failure mode the feature's citation guarantee exists to prevent, just inverted (citation stripped from a true fact rather than attached to a false one). It does not corrupt data (the text itself is untouched, and declines are still safe), and the demo's query surface (5 fixed chips + single-topic freeform questions during manual QA) may never exercise a genuinely mixed single-turn answer, which is why I'm not escalating this to a BLOCKER — but it is a real behavioral regression for any multi-part question a judge might type (e.g. "who has custody of Exhibit 7 and what's the status of Exhibit 22" where only one half resolves).
- **Note for refutation record:** I checked whether the UI's free-text input (`AssistantThread.tsx:181-193`) restricts input to the 5 scripted chips — it does not; it is a plain `<input type="text">` accepting arbitrary typed questions, so this path is reachable outside the scripted demo flow, not merely a theoretical edge case.
- **Resolution:** fixed (`e98af51`) — `isDeclineText` now splits `text` into sentences and returns `true` only when EVERY sentence contains the decline phrase (a whole-answer check, not a substring-anywhere check). The synthetic repro from this finding (`"Custody of Exhibit 7: ... I don't have that information about Exhibit 22's custody record."`) now returns `false`, so the gate falls through to `extractCitations(steps)` as-is, preserving the grounded Exhibit-7 citation while the declined half naturally yields no citation (its tool call returned null/empty). Pure-decline (UAT test 7 repro) and pure-grounded cases are unaffected — re-verified both directions still hold via the existing key-gated tests (14/14 passing against a live Anthropic key) plus the updated `isDeclineText` unit block.

### W2: No test exercises the mixed-answer case the gate is weakest on
- **File:** `src/app/api/assistant/chat/route.test.ts` (whole file — the new tests at lines 134-155, 281-327)
- **Evidence:** The new tests prove exactly the two directions the plan specified (pure decline → `[]`, pure grounded → `>=1`), but neither the always-run `isDeclineText` unit block nor the two new key-gated tests assert anything about a single turn that is *both* partially grounded and partially a decline. Given W1, this is the one scenario where the fix's correctness is actually unproven — the plan's own "no-over-correction guard" task description talks only about a *fully* grounded answer never being over-corrected, not a mixed one. This is additive test-coverage scope, not a required blocker for this gap-closure plan (which was scoped to the single UAT-reported repro), but it leaves the riskiest edge of the new logic unverified.
- **Resolution:** fixed (`4f373d3`) — added two always-run unit tests directly against `isDeclineText`: (1) the exact W1 mixed-answer repro string must return `false` (not treated as a full decline), proving the fix's correctness on its riskiest edge; (2) a multi-sentence answer where EVERY sentence is a decline must still return `true`, proving the whole-answer check doesn't under-correct a genuinely pure (but multi-sentence) decline. Driving a live two-topic LLM turn deterministically was judged impractical (model phrasing of mixed answers is not reliably reproducible at temperature 0 across unrelated-topic combinations), so the test targets `isDeclineText` directly with synthetic text rather than a live `ask()` round-trip — this exercises the exact logic the gate depends on without depending on model non-determinism.

## Cross-file seams checked

- `isDeclineText` export ↔ `route.test.ts` import (`import { POST, isDeclineText } from '@/app/api/assistant/chat/route'`) — OK, named export matches named import, both present and typed `(text: string) => boolean`.
- `onFinish`'s gated `citations` var ↔ `persistTurn({ citations, ... })` (`@/services/assistant`) — OK, `persistTurn` still receives whatever array it's handed and persists it faithfully (W2-unrelated; `services/assistant.ts` untouched by this plan, confirmed unmodified in the 3-commit diff).
- `onFinish`'s gated `citations` var ↔ `writer.write({ type: 'data-citations', data: { citations: toCitations(citations) } })` — OK, same gated array feeds both the DB write and the live stream frame, so DB replay and live-stream citations stay in agreement (no fork between persisted vs. streamed citation counts introduced by this patch).
- Client outcome classifier (`src/hooks/useAssistantChat.ts:347`, `citationsFromMessage(lastAssistant).length > 0 ? 'grounded' : 'decline'`) ↔ server's now-gated `citations` array — OK for the UAT-7 repro case (decline text now always yields `citations.length === 0`, so the client classifies it as `'decline'`, agreeing with the model's own words) and OK for W1's mixed case too in a narrow sense (client still renders *some* text as `'decline'` with a neutral bubble — not an error — it just silently drops a true citation pill the user could have used to verify the Exhibit-7 fact; the classifier itself does not mis-fire, the upstream citations array is just incomplete).
- `extractCitations` / `citationsForToolResult` (the per-tool citation derivation this plan explicitly does not touch) — confirmed byte-identical pre/post-diff (same line count, same switch cases) via the file read; plan's "do not touch" constraint honored.
- Error-vs-decline separation (T-04-13) — OK, unchanged: `onError`/`isLikelyProviderError` and the pre-stream `isAssistantConfigured()` 503 guard are untouched and structurally precede `onFinish`; the new gate lives entirely inside the success-path `onFinish` callback, so a provider/transport failure still never reaches `isDeclineText`.
- Sealed-exhibit indistinguishability (T-04-04) — OK, unchanged: a sealed-unauthorized tool returns empty/null before `extractCitations` runs regardless of this gate, and the gate adds no new code path that could leak a sealed record (it only ever *removes* citations, never adds them).
- System-prompt decline phrase (`systemPrompt.ts:42`, `"I don't have that information"`) ↔ `isDeclineText`'s match string (`"i don't have that information"`) — OK, verified byte-for-byte identical ASCII apostrophe (U+0027) in both files via direct codepoint inspection; no unicode-apostrophe mismatch.
- `tsc --noEmit` and `next build` — both clean (re-ran independently during this review, not just trusting the plan's self-check).
