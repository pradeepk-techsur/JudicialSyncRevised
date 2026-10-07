---
status: testing
phase: 04-pivota-assistant
source: 04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md, 04-04-SUMMARY.md, 04-05-SUMMARY.md
started: 2026-10-07T17:26:00Z
updated: 2026-10-07T17:41:05Z
---

## Current Test

number: 1
position: 1 of 9
name: Ask a grounded question and see a cited answer
expected: |
  Typing or tapping "Is Exhibit 14 in the jury package?" (or any of the five
  example chips) streams back a plain-language answer. If the fact is grounded
  in a specific record, the answer carries one or more citation pills; if no
  supporting record exists, the assistant says "I don't have that information"
  with no pills.
awaiting: user response

## Tests

### 1. Ask a grounded question and see a cited answer
expected: Open the assistant (Ask ✦ in the header, or go to /assistant). Ask "what is the status of exhibit D-1" (or tap an example chip). The answer streams in, states the exhibit's status using the exact status word (e.g. ADMITTED), and shows a citation pill.
result: [pending]

### 2. Click a citation pill and land on the cited event
expected: On a grounded answer with a pill, click the pill. The page navigates to that exhibit's detail page; if the citation has an event anchor, the Timeline scrolls to and briefly highlights that specific event.
result: [pending]

### 3. Ask about a nonexistent or out-of-scope exhibit and get an explicit decline
expected: Ask about an exhibit that doesn't exist (e.g. "what happened to Exhibit 99"). The assistant replies "I don't have that information..." with NO citation pill — a plain, confident decline, never an apology or error-looking message.
result: [pending]

### 4. Sealed exhibit is invisible to an unauthorized role
expected: Switch to a role without sealed-exhibit visibility (DEPUTY, CLERK, or ATTORNEY). Ask about the sealed exhibit S-1 by name. The assistant declines exactly as it would for a nonexistent exhibit — no hint that a sealed record exists, no privileged data.
result: [pending]

### 5. Panel persists across navigation
expected: Open the assistant slide-over panel (Ask ✦), ask a question, then click a citation pill. The underlying screen navigates to the cited exhibit, but the panel STAYS OPEN with the conversation still visible — only an explicit close action closes it.
result: [pending]

### 6. Switching surfaces keeps the same conversation
expected: Start a conversation in the slide-over panel, then navigate to the full /assistant page (or vice versa). The same conversation thread is visible on the other surface — it is one shared conversation, not two separate ones.
result: [pending]

### 7. Five named example questions all resolve sensibly
expected: From the assistant's empty state, tap each of the five example chips in turn ("What exhibits were admitted yesterday?", "What objections remain unresolved?", "Is Exhibit 14 in the jury package?", "Who currently has custody of Exhibit 7?", "What happened to Exhibit 14?"). Each produces either a grounded cited answer or an explicit decline — never a vague or factual-sounding answer with no citation, and a decline NEVER shows a citation pill.
result: issue
reported: "self_check: 'What exhibits were admitted yesterday?' streams decline-worded text (\"I don't have that information...\") but the stream's data-citations part still carries 5 citations (one per ADMITTED exhibit row), so the UI will render citation pills on what the model itself says is a decline. Reproduced twice, identically, at temperature 0."
severity: major

### 8. Assistant nav is live everywhere
expected: The header's Ask ✦ button is enabled (not greyed out) and opens the panel from any screen (Case Workspace, Exhibit Detail, Jury Package). The sidebar's "Assistant" link navigates to the full /assistant page. Jury Package nav is unaffected.
result: [pending]

### 9. "Temporarily unavailable" notice (only if assistant misconfigured)
expected: If the assistant provider is unreachable/misconfigured, asking a question shows a visually distinct warning-style "assistant temporarily unavailable" notice (not styled like a normal answer) with the typed question preserved and a "Try again" control — never silently rendered as a Decline.
result: [pending]

## Summary

total: 9
passed: 0
issues: 1
pending: 8
skipped: 0

## Self-Check

boot: 307 (redirects / -> /case; booted cold, DB container healthy ~1min after dispatch)
data: all preconditions present — seed loader provides a full demo case (9 exhibits, 2 unresolved objections, 1 custody gap/no-custodian discrepancy, 1 unresolved-objection discrepancy, 1 sealed exhibit S-1) deterministically on every boot
routes_probed: 3 ok / 0 failed (/, /case, preview-path proxy)
cookie: n/a (no auth/session cookies issued — role is a client-side zustand selector, not a server session)
browser_urls: none (no presigned URLs, no hardcoded internal hosts, no NEXT_PUBLIC_ absolute-URL emission found in source scan)
repairs:
  - kind: file
    what: "docker-compose.yml: app service never forwarded ANTHROPIC_API_KEY/ANTHROPIC_MODEL from the host sandbox environment into the container, so the Assistant permanently returned 503 ASSISTANT_UNAVAILABLE even though a real, working Anthropic key was present in the sandbox. Added `ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:-}` / `ANTHROPIC_MODEL: ${ANTHROPIC_MODEL:-}` to the app service's environment block."
    resolution: committed dfd4541
per_test:
  - test: 1
    verdict: advisory
    note: "🤖 Auto-check: direct POST /api/assistant/chat probes (JUDGE role) for 'what is the status of exhibit D-1' and 'what objections remain unresolved' both returned grounded, cited, streamed answers with correct status-word usage and real citation pills (exhibitId/eventId resolve to real seed records) — AFTER the ANTHROPIC_API_KEY passthrough repair above. Before the repair every assistant request 503'd. Provisional pass; please confirm the UI renders the same."
    confidence: proven
  - test: 3
    verdict: advisory
    note: "🤖 Auto-check: asked about nonexistent Exhibit Z-99 and about 'who currently has custody of Exhibit 7' / 'is Exhibit 14 in the jury package' / 'what happened to Exhibit 14' (none of these labels exist in the seed, which uses D-1..D-3/P-1..P-5/S-1) — all four produced a clean 'I don't have that information...' decline with zero citations. Provisional pass."
    confidence: proven
  - test: 4
    verdict: advisory
    note: "🤖 Auto-check: as DEPUTY, asked 'what happened to exhibit S-1' (the seed's sealed exhibit) — declined with zero citations, phrasing indistinguishable from the nonexistent-exhibit case in test 3. Provisional pass for the backend; please confirm the UI shows no hint of S-1's existence."
    confidence: proven
  - test: 7
    verdict: fail
    note: "🤖 Auto-check: 'what exhibits were admitted yesterday' (JUDGE) streams DECLINE-WORDED TEXT (\"I don't have that information. The search returns exhibits with ADMITTED status but does not filter by the date they were admitted...\") while the data-citations part STILL carries 5 citations (one per ADMITTED exhibit the searchExhibits tool returned). Reproduced twice, identically (temperature 0). See ## Gaps below — this is a contract violation of 04-03's own documented wire contract (\"A Decline carries citations: []\") and will make the 04-04 client hook misclassify this turn as outcome='grounded' (renders citation pills) even though the model's own words are a decline. The other four named example questions behaved correctly (citations present only when the text was substantively grounded, empty when declining)."
    confidence: proven
  - test: 2
    verdict: skipped (needs human)
    note: "Citation pill click + Timeline scroll/highlight is a visual/interaction behavior only confirmable by clicking in a real browser; the existing e2e/assistant.spec.ts (7 tests, all passing) already exercises this exact path with mocked data, but a human click-through confirms the real UI."
  - test: 5
    verdict: skipped (needs human)
  - test: 6
    verdict: skipped (needs human)
  - test: 8
    verdict: skipped (needs human)
  - test: 9
    verdict: skipped (needs human)
    note: "Not reproducible without breaking the (now-working) ANTHROPIC_API_KEY on purpose. e2e/assistant.spec.ts's 'unavailable' test already proves this path works against a mocked 503."

e2e: 29/29 Playwright tests passed (clean reseed on restart; ran once with host `npm run dev` against the compose Postgres while the app container was briefly stopped to free port 3000, then the app container was restarted for this UAT session — DB persists via the `pgdata` volume so the two runs share no state drift relevant to these tests)
screenshots:
  - .pivota/uat-shots/1-case-workspace.png
  - .pivota/uat-shots/1-assistant-page.png

## Gaps

- truth: "A Decline always carries zero citations (04-03's own documented wire contract: 'A Decline carries citations: []'), so the client's outcome classifier (04-04, keyed purely on citations.length) never renders citation pills on a declining answer."
  status: failed
  reason: "POST /api/assistant/chat for 'what exhibits were admitted yesterday' (JUDGE role) returns assistant text that is unambiguously a decline (\"I don't have that information. The search returns exhibits with ADMITTED status but does not filter by the date they were admitted...\") but the same turn's data-citations part carries 5 citations — one per row the searchExhibits tool happened to return, regardless of whether the model's final text actually cited them. Root cause (read directly in src/app/api/assistant/chat/route.ts): extractCitations()/citationsForToolResult() unconditionally derives a citation for every row in EVERY tool's output in `steps[].toolResults`, with no check against whether the model's final text references that record. Reproduced identically twice at temperature 0 (deterministic, not a flake). Because 04-04's useAssistantChat classifies outcome purely as `citationsFromMessage(lastAssistant).length > 0 ? 'grounded' : 'decline'`, this turn will render as 'grounded' (citation pills shown) in the UI despite the model's own words being a plain decline — visually contradicting the text and violating the three-unambiguous-outcomes guarantee (ROADMAP Phase 4 criterion 1 / F7 criterion 5's sibling decline-is-decline guarantee)."
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
</content>
