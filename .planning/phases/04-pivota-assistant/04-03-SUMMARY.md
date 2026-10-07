---
phase: 04-pivota-assistant
plan: 03
subsystem: api
tags: [ai-sdk, anthropic, streamtext, streaming, citations, prisma, postgres, llm, tool-calling, wire-contract]

# Dependency graph
requires:
  - phase: 04-pivota-assistant
    provides: "04-01 — ai@6 primitives (streamText/toUIMessageStream/createUIMessageStream/stepCountIs/convertToModelMessages), assistantConfig (model/temp0/isAssistantConfigured), AssistantUnavailableError (503), AssistantConversation/Message/Citation tables w/ additive exhibit_id+event_id"
  - phase: 04-pivota-assistant
    provides: "04-02 — buildAssistantToolSet(ctx) 8-tool set + sealed seam; buildSystemPrompt(role) cite-or-decline"
  - phase: 01-data-foundation
    provides: "typed AppError + errorResponse; parseRequestingRole (fail-closed ATTORNEY); runSeed/getActiveCaseWithUsers; vitest fileParallelism:false shared-Postgres"
  - phase: 03-jury-package-discrepancy-detection
    provides: "getJuryPackage / getDiscrepancies result shapes cited by the extractor"
provides:
  - "src/services/assistant.ts — createConversation, persistTurn (atomic user+assistant+citations), getConversationDetail (replay w/ citations); single-writer of the 3 assistant tables"
  - "POST /api/assistant/chat — streaming chat route (temp 0, Anthropic, 8-tool set, cite-or-decline), 503 guard, error-vs-decline separation, citation extraction+persistence, in-stream data-citations part + X-Conversation-Id header"
  - "GET /api/assistant/conversations/:id — ConversationDetail replay (messages + citations); 404 CONVERSATION_NOT_FOUND"
  - "The FIXED client↔server wire contract (request envelope, X-Conversation-Id header, data-citations stream part) that 04-04 + 04-05 bind to"
affects: [04-04 client session hook (useChat transport + reads data-citations/X-Conversation-Id), 04-05 assistant UI + E2E mock (copies the captured stream frame byte-for-byte)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "createUIMessageStream({ execute({writer}) }) + writer.merge(result.toUIMessageStream()) + writer.write({type:'data-citations'}) — carries model text AND extracted citations in ONE stream"
    - "503-guard-first: isAssistantConfigured() gate BEFORE any LLM call / DB write; missing key never streams a Decline (criterion 5)"
    - "Error≠Decline: streamText.onError + createUIMessageStream.onError route transport failures to the stream ERROR channel (fixed ASSISTANT_UNAVAILABLE code), never a text token; pre-stream failures → HTTP 503"
    - "Citations extracted ONLY from THIS turn's tool results (real recordIds/timestamps), never model-authored (T-04-10)"
    - "assistant.ts is the single writer of the 3 assistant tables (mirrors recordEvent chokepoint)"

key-files:
  created:
    - "src/services/assistant.ts"
    - "src/app/api/assistant/chat/route.ts"
    - "src/app/api/assistant/conversations/[id]/route.ts"
    - "src/services/assistant.test.ts"
    - "src/app/api/assistant/chat/route.test.ts"
  modified:
    - "src/lib/assistant/tools.ts (searchExhibits tool widened with lastStatusEventId/lastStatusAt — assistant-facing only)"

key-decisions:
  - "searchExhibits citation path = WIDENED (preferred): the assistant-facing searchExhibits tool attaches lastStatusEventId/lastStatusAt per row (sourced from getExhibitStatus — same projection, same role-filtered rows), so each search row cites its status event. Service return + UI endpoints untouched."
  - "Citations carried in-stream via a custom data part type 'data-citations' { conversationId, citations[] }; conversationId ALSO on the X-Conversation-Id response header for fresh-conversation capture."
  - "Role ALWAYS from X-User-Role header (parseRequestingRole), NEVER the body (T-04-08 role-spoofing defense); caseId/userId/conversationId from the JSON body."
  - "streamText multi-step via stopWhen: stepCountIs(6); provider timeout AbortSignal.timeout(20_000ms) trips ASSISTANT_UNAVAILABLE."
  - "convertToModelMessages is async in ai@6 — awaited before streamText."

patterns-established:
  - "The chat route is the SINGLE authority for the wire contract; 04-04/04-05 bind to this SUMMARY, not to re-invention."

# Metrics
duration: 9min
completed: 2026-10-07
---

# Phase 4 Plan 03: Assistant Chat Route + Persistence + Wire Contract Summary

**Streaming `POST /api/assistant/chat` (AI SDK `streamText` at temperature 0 against Anthropic with the 8-tool set + cite-or-decline prompt), the single-writer conversation/citation persistence service, and `GET /conversations/:id` replay — enforcing missing-key→503, error-vs-decline separation, and never-ungrounded citation extraction across all 8 tools.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-10-07T16:23:47Z
- **Completed:** 2026-10-07T16:32:41Z
- **Tasks:** 3
- **Files modified:** 6 (5 created, 1 modified)

## Accomplishments
- `src/services/assistant.ts` — the single writer of the three assistant tables: `createConversation`, `persistTurn` (user msg + assistant msg + citations in ONE `$transaction`), `getConversationDetail` (ordered replay with citations). Each citation persists/returns the additive `exhibitId` (required) + `eventId` (nullable) deep-link fields.
- `POST /api/assistant/chat` — streaming route: 503 guard first, `streamText` at temp 0 with the role-bound 8-tool set and cite-or-decline prompt, conversation-on-first-message, citation extraction for ALL 8 tools in `onFinish`, atomic persistence, in-stream `data-citations` part + `X-Conversation-Id` header. Error/transport failures ride the 503/error channel, never streamed Decline text.
- `GET /api/assistant/conversations/:id` — thin replay wrapper (200 ConversationDetail / 404 CONVERSATION_NOT_FOUND).
- Release-blocker test suite: permanent no-key gate (503 + error≠decline + malformed→503) AND the key-gated behavioral proof (5 named questions grounded-or-decline, searchExhibits pill path, sealed DEPUTY decline). **A real `ANTHROPIC_API_KEY` was present at execution, so the key-gated block RAN and passed.**

## THE WIRE CONTRACT (binding for 04-04 and 04-05)

### Request (what `useChat` POSTs, shaped via `DefaultChatTransport` on the client)
- **Body (JSON):**
  ```json
  {
    "messages": [ /* useChat UIMessage[] — the latest user message's text parts are the question */ ],
    "caseId": "<uuid>",
    "userId": "<uuid>",
    "conversationId": "<uuid?>"   // omit on the first message; present on follow-ups
  }
  ```
  04-04 threads `caseId`/`userId`/`conversationId` via the transport's `body`.
- **Header:** `X-User-Role: <Role>` — the demo role (same header every route reads; fail-closed to `ATTORNEY`). **Role is NEVER read from the body** (T-04-08).

### Response (ai@6 UI-message SSE stream via `createUIMessageStreamResponse`)
- **Header:** `X-Conversation-Id: <uuid>` — the conversation id (freshly created on the first message, or echoed). Client captures this into zustand for subsequent turns.
- **`Content-Type: text/event-stream`**, standard ai@6 UI-message stream (`data: {…}\n\n` frames, terminated by `data: [DONE]`).
- **Citations** ride as a custom data part, written in `onFinish` AFTER the model text:
  ```
  data: {"type":"data-citations","data":{"conversationId":"<uuid>","citations":[ Citation, … ]}}
  ```
  where each `Citation` is:
  ```ts
  { recordType: 'ExhibitEvent'|'DiscrepancyFlag'|'JuryPackageExhibit';
    recordId: string; exhibitId: string; eventId: string | null;
    timestamp: string /* ISO */; label: string }
  ```
  A Decline carries `citations: []`. **04-04 reads `message.parts` for the `data-citations` part and keys decline-vs-grounded off `citations.length`; 04-05 mocks this exact part.**
- The pill deep-links to `/exhibit/:exhibitId?event=:eventId` (eventId omitted when null).

### CAPTURED REAL STREAM FRAME (grounded answer — copy byte-for-byte for the 04-05 E2E mock)
Captured live against the real Anthropic key for "what is the status of exhibit D-1" (JUDGE):
```
data: {"type":"start","messageId":"<id>"}

data: {"type":"start-step"}

data: {"type":"tool-input-start","toolCallId":"toolu_…","toolName":"searchExhibits"}

data: {"type":"tool-input-available","toolCallId":"toolu_…","toolName":"searchExhibits","input":{"keyword":"D-1"},"providerMetadata":{"anthropic":{"caller":{"type":"direct"}}}}

data: {"type":"tool-output-available","toolCallId":"toolu_…","output":[{"exhibitId":"a46a251e-…","exhibitLabel":"D-1","description":"…","offeringParty":"DEFENSE","associatedWitness":"…","currentStatus":"ADMITTED","currentCustodianName":"Deputy Dana Reyes","discrepancyFlags":[],"lastStatusEventId":"7c762787-…","lastStatusAt":"2026-10-07T16:31:35.128Z"}],"providerMetadata":{…}}

data: {"type":"finish-step"}

data: {"type":"start-step"}

data: {"type":"text-start","id":"0"}

data: {"type":"text-delta","id":"0","delta":"Exhibit D-1 is"}
data: {"type":"text-delta","id":"0","delta":" ADMITTED (…)."}

data: {"type":"text-end","id":"0"}

data: {"type":"finish-step"}

data: {"type":"finish","finishReason":"stop"}

data: {"type":"data-citations","data":{"conversationId":"b55ace7e-…","citations":[{"recordType":"ExhibitEvent","recordId":"7c762787-141e-4f7f-84b9-d87b54393289","exhibitId":"a46a251e-c7c1-4eeb-97bd-1566cb36256f","eventId":"7c762787-141e-4f7f-84b9-d87b54393289","timestamp":"2026-10-07T16:31:35.128Z","label":"D-1 · ADMITTED"}]}}

data: [DONE]
```
And a Decline variant (no supporting record → `output:[]` → the model declines) ends with:
```
data: {"type":"text-delta","id":"0","delta":"I don't have that information about …"}
…
data: {"type":"data-citations","data":{"conversationId":"<uuid>","citations":[]}}

data: [DONE]
```

## Per-tool citation extraction mapping (all 8 tools — criterion 2)

Citations are derived ONLY from THIS turn's `step.toolResults` (`{ toolName, input, output }`), never model-authored:

| Tool | Source row(s) | recordType | recordId | exhibitId | eventId | timestamp |
|------|---------------|-----------|----------|-----------|---------|-----------|
| getExhibitStatus | ExhibitCurrentState | ExhibitEvent | `lastStatusEventId` | `exhibitId`/arg | `lastStatusEventId` | `lastStatusAt` |
| getCustodian | CustodyCurrentState | ExhibitEvent | `lastEventId` | `exhibitId`/arg | `lastEventId` | `since` |
| getCustodyHistory | each entry | ExhibitEvent (1/entry) | entry `eventId` | arg `exhibitId` | entry `eventId` | entry `timestamp` |
| getExhibitHistory | each `timeline[]` | ExhibitEvent (1/entry) | entry `eventId` | `exhibit.id`/arg | entry `eventId` | `recordedAt` |
| getUnresolvedObjections | each row | ExhibitEvent (1/objection) | `raisedEventId` | row `exhibitId` | `raisedEventId` | `raisedAt` |
| getDiscrepancies | each flag | DiscrepancyFlag (1/flag) | flag `id` | flag `exhibitId` | **null** | `detectedAt` |
| getJuryPackageStatus | each `exhibits[]` row | JuryPackageExhibit (1/row) | row `id` | row `exhibitId` | **null** | `addedAt` |
| searchExhibits | each row (**widened**) | ExhibitEvent (1/row) | `lastStatusEventId` | row `exhibitId` | `lastStatusEventId` | `lastStatusAt` |

**searchExhibits path = WIDENED (the plan's preferred path).** The assistant-facing `searchExhibits` tool now attaches `lastStatusEventId`/`lastStatusAt` to each returned row by reading `getExhibitStatus(exhibitId)` for the (already role-filtered) rows the service returned — the same projection every screen reads, no divergent query path, sealed rows already excluded. The service's own `searchExhibits` return and the UI list/search endpoints are **unchanged**; the widening lives only in the tool. The existing `tools.test.ts` (8 tests) still passes. Rows with no status yet (null event id) are simply skipped by the extractor (no anchor), but every ADMITTED/statused row — i.e. every row "what exhibits were admitted yesterday" lists — gets a pill.

## streamText config
- `model: anthropic(ANTHROPIC_MODEL)` (pinned `claude-sonnet-4-5`), `temperature: ASSISTANT_TEMPERATURE` (0).
- Multi-step: `stopWhen: stepCountIs(6)` (ai@6 has no `maxSteps`).
- Timeout: `abortSignal: AbortSignal.timeout(20_000)` → trips ASSISTANT_UNAVAILABLE rather than hanging.
- Key-gated behavioral tests **RAN** (real key present): 5 named questions all resolved grounded-or-decline (zero ungrounded), searchExhibits pill path produced ≥1 citation, sealed DEPUTY probe Declined with zero citations.

## Task Commits

1. **Task 1: persistence service** - `c8a6398` (feat)
2. **Task 2: chat route + searchExhibits widening** - `a7d335c` (feat)
3. **Task 3: GET endpoint + release-blocker tests** - `cfdf422` (test)

**Plan metadata:** docs commit (this SUMMARY + STATE.md)

## Files Created/Modified
- `src/services/assistant.ts` — single-writer persistence service (createConversation/persistTurn/getConversationDetail) with Citation/CitationInput/ConversationDetail shapes.
- `src/app/api/assistant/chat/route.ts` — streaming POST route: 503 guard, streamText, citation extraction (8 tools), in-stream data-citations, X-Conversation-Id header, error-vs-decline separation.
- `src/app/api/assistant/conversations/[id]/route.ts` — GET replay endpoint.
- `src/services/assistant.test.ts` — persistence round-trip (grounded w/ exhibitId+eventId preserved, Decline, CONVERSATION_NOT_FOUND).
- `src/app/api/assistant/chat/route.test.ts` — permanent no-key gate + key-gated behavioral proof.
- `src/lib/assistant/tools.ts` — searchExhibits tool widened (assistant-facing) with lastStatusEventId/lastStatusAt.

## Decisions Made
- **searchExhibits citation path:** WIDENED (preferred), sourced from the same projection via getExhibitStatus — no second query path, service/UI shape untouched.
- **Citations in-stream** via a `data-citations` custom data part + `X-Conversation-Id` header (not stream-only) so a freshly-created conversation id reaches the client even before the first data part.
- **Role from header only** (never body) — T-04-08.
- **convertToModelMessages awaited** (async in ai@6).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `convertToModelMessages` is async in ai@6**
- **Found during:** Task 2 (chat route type-check)
- **Issue:** `tsc` reported `Type 'Promise<ModelMessage[]>' is missing … from type 'ModelMessage[]'` — in ai@6 `convertToModelMessages` returns a Promise.
- **Fix:** `await convertToModelMessages(messages)` into `modelMessages` before passing to `streamText`.
- **Files modified:** src/app/api/assistant/chat/route.ts
- **Verification:** `tsc --noEmit` clean; `next build` clean.
- **Committed in:** a7d335c (Task 2 commit)

**2. [Rule 3 - Blocking] Carrying citations in-stream requires the writer pattern, not `toUIMessageStreamResponse`**
- **Found during:** Task 2 (implementing the wire contract's data-citations part)
- **Issue:** `result.toUIMessageStreamResponse()` emits only the model's own chunks — there is no hook to append a custom `data-citations` part. The plan requires citations carried in-stream.
- **Fix:** Switched to `createUIMessageStream({ execute({writer}) { … writer.merge(result.toUIMessageStream()); } })` + `writer.write({ type:'data-citations', data })` in `streamText.onFinish`, wrapped by `createUIMessageStreamResponse` with the `X-Conversation-Id` header. This is still built entirely from the ai@6 primitives pinned in 04-01's SUMMARY (createUIMessageStream / createUIMessageStreamResponse / toUIMessageStream).
- **Files modified:** src/app/api/assistant/chat/route.ts
- **Verification:** Captured real grounded + decline stream frames showing the data-citations part; full suite green.
- **Committed in:** a7d335c (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both blocking — ai@6 API reality). **Impact on plan:** None on behavior or contract; both were API-shape adaptations to the installed ai@6 major. The wire contract as specified (data-citations part + X-Conversation-Id header) is fully realized and captured.

## Known Stubs
None found. (`grep` for TODO/FIXME/placeholder/not-implemented across all changed files returned nothing except the intentional `PLACEHOLDER_KEY` missing-key fail-safe in assistantConfig, which is 04-01's feature, not this plan's.)

## Deferred Issues
None.

## Issues Encountered
None. A real `ANTHROPIC_API_KEY` was present in the execution environment, so the normally-gated behavioral tests ran (not skipped); the no-key 503 gate was independently verified by re-running the suite with a placeholder key (3 passed, 7 skipped).

## User Setup Required
None new (04-01 already documented the `ANTHROPIC_API_KEY` requirement). With a placeholder/unset key the route returns 503 ASSISTANT_UNAVAILABLE and the app otherwise works; with a real key the 5 demo questions resolve grounded.

## Next Phase Readiness
- **Ready for 04-04** (client session hook): bind `useChat` to this route via `DefaultChatTransport` — POST body `{ messages, caseId, userId, conversationId? }`, header `X-User-Role`, read `X-Conversation-Id` from the response and the `data-citations` part from `message.parts`.
- **Ready for 04-05** (assistant UI + E2E mock): copy the captured stream frame above byte-for-byte; render pills from the `data-citations` citations (deep-link `/exhibit/:exhibitId?event=:eventId`); treat zero-citation assistant messages as Declines and the 503 channel as the "temporarily unavailable" notice (never a Decline).

## Self-Check: PASSED
- Created files exist: `src/services/assistant.ts`, `src/app/api/assistant/chat/route.ts`, `src/app/api/assistant/conversations/[id]/route.ts`, `src/services/assistant.test.ts`, `src/app/api/assistant/chat/route.test.ts` — all FOUND.
- Commits exist: `c8a6398`, `a7d335c`, `cfdf422` — all in `git log`.
- Build check: `npx next build` → exit 0. `npx tsc --noEmit` → exit 0.
- Full suite: `npx vitest run` → 175 passed | 3 skipped (30 files). No-key 503 gate verified separately (3 passed | 7 skipped with placeholder key).
- `## Known Stubs` present, no blocking entries.

---
*Phase: 04-pivota-assistant*
*Completed: 2026-10-07*
