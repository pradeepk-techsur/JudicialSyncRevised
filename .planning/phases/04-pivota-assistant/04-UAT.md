---
status: complete
phase: 04-pivota-assistant
source: 04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md, 04-04-SUMMARY.md, 04-05-SUMMARY.md
started: 2026-10-07T18:35:58Z
updated: 2026-10-07T18:52:00Z
---

## Current Test

[testing complete]

## Tests

### 7. Five named example questions all resolve sensibly
expected: From the assistant's empty state, tap each of the five example chips in turn ("What exhibits were admitted yesterday?", "What objections remain unresolved?", "Is Exhibit 14 in the jury package?", "Who currently has custody of Exhibit 7?", "What happened to Exhibit 14?"). Each produces either a grounded cited answer or an explicit decline — never a vague or factual-sounding answer with no citation, and a decline NEVER shows a citation pill.
result: issue
reported: "First attempt: 'The assistant is temporarily unavailable' (transient — no corresponding error in the app log; likely collided with the self-check's own concurrent live-API probing against the same Anthropic key). Retried after self-check re-confirmed the backend healthy: 'Retried — works now, no bug (all correct)' for the literal chip text. However, after being shown that a one-character phrasing variant of the same question deterministically reproduces the exact previously-reported defect (decline text paired with non-empty citations) via live self-check evidence, user chose to keep the gap open rather than close it: 'Fail — keep the gap open'."
severity: major

## Summary

total: 1
passed: 0
issues: 1
pending: 0
skipped: 0

## Self-Check

boot: 307 (already running, warm — no cold-boot wait needed)
data: all preconditions present — same deterministic seed loader output as last round (9 exhibits, 2 unresolved objections, 1 custody gap, 2 discrepancy rules fired, 1 sealed exhibit S-1)
routes_probed: 2 ok / 0 failed (/, POST /api/assistant/chat)
cookie: n/a (no auth/session cookies issued — role is a client-side zustand selector, not a server session)
browser_urls: none (unchanged since last round — no presigned URLs, no hardcoded internal hosts)
repairs: none this round (prior round's ANTHROPIC_API_KEY compose passthrough, commit dfd4541, already on HEAD)
per_test:
  - test: 7
    verdict: fail
    note: "🤖 Auto-check (re-verify round 2): the previously-reported defect is UNCHANGED in the code — zero commits have touched src/app/api/assistant/chat/route.ts since the last round (`git log` shows only 7183c4d, the original execution commit). Re-drove the exact flow live against JUDGE role: 'what exhibits were admitted yesterday' (no leading capital, no '?') deterministically (6/6 runs) tool-calls searchExhibits({status:'ADMITTED'}), gets 5 real ADMITTED rows back, and the model's OWN FINAL TEXT is an unambiguous decline — 'I don't have that information about which exhibits were admitted yesterday. The search returns all ADMITTED exhibits but does not filter by the date they were admitted.' — yet the same turn's data-citations part still carries all 5 citations (D-1, P-2, P-3, P-4, S-1, each a real ExhibitEvent id/timestamp). Confirmed root cause unchanged by reading the current file: extractCitations()/citationsForToolResult() (src/app/api/assistant/chat/route.ts:312-322+) still walks every tool result's output rows unconditionally, with no gate on whether the model's final text references the record. Per 04-04's useAssistantChat, outcome is classified purely by citations.length > 0, so this turn will still render as 'grounded' (pills shown) in the UI despite the model's own words being a plain decline. Note: the exact capitalized chip text with a trailing '?' ('What exhibits were admitted yesterday?') deterministically takes a DIFFERENT path this round — the model asks a clarifying 'what is today's date?' instead of calling the tool (0 citations, correct behavior) — but the lowercase/no-'?' phrasing variant, and the original UAT-recorded wording, still hits the exact defect. This is the same bug, not a new one: the underlying extractor has no decline-vs-grounded gate regardless of which path triggers it, and the literal chip wording remains one query-phrasing away from reproducing it per the system prompt's inherent non-determinism around natural language. This is a REGRESSION-FROM-FIX-EXPECTATION: the UAT round was re-dispatched implying a fix had landed; none has. Carrying the gap forward unchanged (same root_cause/artifacts/missing) rather than re-diagnosing from scratch, since nothing about the mechanism has changed."
    confidence: proven

## Gaps

- truth: "A Decline always carries zero citations (04-03's own documented wire contract: 'A Decline carries citations: []'), so the client's outcome classifier (04-04, keyed purely on citations.length) never renders citation pills on a declining answer."
  status: failed
  reason: "POST /api/assistant/chat for 'what exhibits were admitted yesterday' (JUDGE role) returns assistant text that is unambiguously a decline (\"I don't have that information about which exhibits were admitted yesterday. The search returns all ADMITTED exhibits but does not filter by the date they were admitted.\") but the same turn's data-citations part carries 5 citations — one per row the searchExhibits tool happened to return, regardless of whether the model's final text actually cited them. Root cause (read directly in src/app/api/assistant/chat/route.ts, UNCHANGED since last round): extractCitations()/citationsForToolResult() unconditionally derives a citation for every row in EVERY tool's output in `steps[].toolResults`, with no check against whether the model's final text references that record. Reproduced live again this round (6/6 runs, deterministic) against real seed data (D-1/P-2/P-3/P-4/S-1, real ExhibitEvent ids). Because 04-04's useAssistantChat classifies outcome purely as `citationsFromMessage(lastAssistant).length > 0 ? 'grounded' : 'decline'`, this turn renders as 'grounded' (citation pills shown) in the UI despite the model's own words being a plain decline — visually contradicting the text and violating the three-unambiguous-outcomes guarantee (ROADMAP Phase 4 criterion 1 / F7 criterion 5's sibling decline-is-decline guarantee)."
  severity: major
  test: 7
  source: self_check
  confidence: proven
  root_cause: "src/app/api/assistant/chat/route.ts extractCitations()/citationsForToolResult() (the searchExhibits case, and in principle every other case) derives citations from ALL rows a tool call returned this turn, not from the subset of records the model's final answer text actually asserts. When the model declines despite having tool output in hand (e.g. because it judged the data didn't answer the literal question — a temporal filter it has no tool support for), the extractor still emits one citation per returned row."
  artifacts:
    - path: "src/app/api/assistant/chat/route.ts"
      issue: "extractCitations(steps) walks every tool result's output rows unconditionally; citationsForToolResult's searchExhibits (and other) branches have no gate on whether the final `text` references the record, so a model that calls a tool but then declines in its final text still yields a non-empty citations array."
  missing:
    - "A guard in onFinish (or in extractCitations) that either (a) skips citation extraction entirely when the model's final text matches a decline pattern (e.g. the system prompt's own \"I don't have that information\" phrasing), or (b) only keeps citations for records the final text actually references (e.g. by exhibit label/id substring match), so a textual decline is never paired with a non-empty citations array."
  debug_session: ""
