---
phase: 04-pivota-assistant
plan: 04
subsystem: ui
tags: [ai-sdk, usechat, zustand, client-session, streaming, citations, react-hook]

# Dependency graph
requires:
  - phase: 04-pivota-assistant
    provides: "04-03 — POST /api/assistant/chat wire contract (body {messages,caseId,userId,conversationId?} + X-User-Role header; response X-Conversation-Id header + in-stream data-citations part); GET /api/assistant/conversations/:id replay"
  - phase: 04-pivota-assistant
    provides: "04-01 — ai@6 / @ai-sdk/react@3 primitives (DefaultChatTransport, prepareSendMessagesRequest, UIMessage data parts); AssistantCitation additive exhibitId+eventId link fields"
  - phase: 02-core-screens
    provides: "02-05 — useRoleStore (zustand client session) + apiClient.apiFetch attaching X-User-Role via getState()"
provides:
  - "src/stores/assistantStore.ts — useAssistantStore: panel open/close/toggle + activeConversationId + setActiveConversationId + newConversation()"
  - "src/hooks/useAssistantChat.ts — useAssistantChat(): useChat wrapper tagging each send with role/conversationId/case/user, capturing the server conversationId, replaying an existing thread, surfacing normalized citations (exhibitId+eventId) on both fresh-stream and GET-replay paths, and deriving a three-way outcome"
  - "roleStore.setActiveUser role-switch → newConversation() reset (lazy dynamic import)"
affects: [04-05 assistant UI (panel + full-page) + E2E — consumes useAssistantChat + useAssistantStore; reads citationsOf(message) for pills, outcome for the three visual states]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DefaultChatTransport + prepareSendMessagesRequest — per-SEND request tagging: role header + conversation/case/user body read fresh from getState() at each send (not hook-init) so a role switch or freshly-captured conversationId between sends is always reflected"
    - "Server conversationId captured via onData off the 'data-citations' part → zustand (conversation-on-first-message)"
    - "Path-agnostic citations: the GET-replay path reconstructs the SAME { type:'data-citations', data } part the fresh stream emits, so one citationsOf() reader serves both and replayed pills keep exhibitId+eventId"
    - "Three-way outcome by INPUT CHANNEL: 'unavailable' strictly from chat.error, 'decline' strictly from a completed zero-citation message — an error is never reclassified as a decline (client mirror of 04-03's error-vs-decline separation)"
    - "Role-switch → newConversation reset via lazy dynamic import inside roleStore.setActiveUser (avoids a static store import cycle)"

key-files:
  created:
    - "src/stores/assistantStore.ts"
    - "src/hooks/useAssistantChat.ts"
  modified:
    - "src/stores/roleStore.ts"

key-decisions:
  - "Per-send tagging via DefaultChatTransport.prepareSendMessagesRequest (not static body/headers) — reads role/caseId/userId/conversationId from the stores' getState() AT SEND TIME so the CURRENT role is always sent (T-04-12 stale-role defense), role on the header only (never body, T-04-08)."
  - "Server conversationId captured from the data-citations part via useChat's onData (the X-Conversation-Id header carries the same id) → setActiveConversationId; subsequent sends reuse it via the transport."
  - "Role-switch reset wired in roleStore.setActiveUser via a lazy `import('@/stores/assistantStore')` (dynamic) rather than a top-level import or a subscribe — avoids any static import cycle between the two session stores; fire-and-forget."
  - "GET-replay reconstructs the identical 'data-citations' part shape so citationsOf() + 04-05's pill rendering are path-agnostic and replayed pills keep exhibitId+eventId; replay only runs when local messages are empty and is guarded against re-replaying the same id."
  - "ai@6 useChat no longer owns input/handleSubmit — the hook manages a controlled input via useState and preserves the last-sent question in a ref so retry() re-submits it verbatim with no auto-retry loop (F7 criterion 5)."

patterns-established:
  - "04-05's two assistant surfaces stay purely presentational: all session tagging, conversationId capture, replay, outcome classification, and retry live in this one hook + store."

# Metrics
duration: 3min
completed: 2026-10-07
---

# Phase 4 Plan 04: Assistant Client Session (store + useChat hook) Summary

**A zustand `assistantStore` (panel state + active conversationId) and a `useAssistantChat` hook that wraps ai@6 `useChat` to 04-03's exact wire contract — per-send role/conversation/case/user tagging via `DefaultChatTransport.prepareSendMessagesRequest`, server-conversationId capture, GET-replay, normalized `exhibitId`+`eventId` citations on both stream and replay paths, and a three-way `grounded/decline/unavailable` outcome kept distinct by input channel — plus the role-switch→new-conversation reset.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-10-07T16:38:23Z
- **Completed:** 2026-10-07T16:41:46Z
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- `src/stores/assistantStore.ts` — browser-session zustand store (no persistence, mirrors roleStore): `isPanelOpen` + panel controls, `activeConversationId` (null until the first message creates one), `setActiveConversationId`, and `newConversation()` (clears the id → example chips return; prior conversations stay persisted server-side).
- `src/hooks/useAssistantChat.ts` — the thin connective layer between 04-03's backend and 04-05's UI. Tags every send, captures the server conversationId, replays an existing thread on mount, surfaces normalized citations on both paths, and classifies the three outcomes.
- `src/stores/roleStore.ts` — `setActiveUser` now resets the active assistant conversation whenever the role actually changes (lazy dynamic import), so answers from different sealed-visibility scopes never mix in one audit thread.

## The useChat transport config (how each send is tagged — matches 04-03's wire contract)

`useAssistantChat` builds one `DefaultChatTransport<AssistantUIMessage>({ api: '/api/assistant/chat', prepareSendMessagesRequest })`. `prepareSendMessagesRequest` runs **at send time** and returns:

```ts
{
  headers: { 'X-User-Role': useRoleStore.getState().role },  // header only — never body (T-04-08)
  body: {
    messages,                                                // the useChat UIMessage[]
    caseId:  useRoleStore.getState().caseId,
    userId:  useRoleStore.getState().activeUserId,
    ...(activeConversationId ? { conversationId: activeConversationId } : {}),  // omit on first msg
  },
}
```

Reading from `getState()` per send (not at hook-init) is the T-04-12 defense: the role sent is always the CURRENT role, and a conversationId captured between sends is used on the very next send. This is the ai@6 primitive 04-01 pinned (`DefaultChatTransport` + `prepareSendMessagesRequest`).

## How the server conversationId is captured (conversation-on-first-message)

`useChat`'s `onData` callback watches for the `data-citations` part (04-03 writes it in `onFinish`, and its `data.conversationId` equals the `X-Conversation-Id` header). On the first message `activeConversationId` is null → the server creates a conversation and returns its id in that part → the hook calls `setActiveConversationId(id)`. Every subsequent send then threads that id via the transport body. No separate header-reading fetch is needed; capture stays inside the SDK's stream handling.

## Citation → message mapping (identical on BOTH fresh-stream and GET-replay)

- **Fresh stream:** the server's `{ type: 'data-citations', data: { conversationId, citations } }` part lands in `message.parts`. `citationsFromMessage()` finds that part and returns `data.citations` verbatim — each `Citation { recordType, recordId, exhibitId, eventId, timestamp, label }` already carries the link fields.
- **GET replay:** on mount, when `activeConversationId` is set and local messages are empty, the hook `apiFetch`es `GET /api/assistant/conversations/:id` and maps each `ConversationDetail` message through `replayMessageToUIMessage()`, which rebuilds the **same** `data-citations` part (`exhibitId`+`eventId` preserved from the GET response). So `citationsOf(message)` and 04-05's `CitationPill` read citations off one shape regardless of path, and a replayed pill deep-links to `/exhibit/:exhibitId?event=:eventId` exactly like a fresh-stream one. A Decline replays with `citations: []`, classified as `'decline'` identically.

Replay is guarded: it only runs when the local message list is empty (never clobbers an in-progress/just-streamed thread) and a ref prevents re-replaying the same id; a failed GET is non-fatal (thread starts empty, the next send still reuses the id — not an outage).

## Outcome classification (three unambiguous outcomes, F7 criterion 5)

`outcome: 'idle' | 'streaming' | 'grounded' | 'decline' | 'unavailable'`, by precedence and **input channel**:
1. `chat.error` present → `'unavailable'` — STRICTLY the error/transport channel (HTTP 503 / ASSISTANT_UNAVAILABLE surfaced as the SDK `error`), NEVER derived from message text.
2. `status` submitted/streaming → `'streaming'`.
3. no messages → `'idle'`.
4. last assistant message has ≥1 citation → `'grounded'`.
5. last assistant message has 0 citations → `'decline'` — the model's own grounded-fallback text.

An error (1) and an empty-citations message (5) are DIFFERENT inputs; an error is never reclassified as a decline (T-04-13). `isUnavailable` is exposed for the system-notice state, and `retry()` clears the error then re-submits the preserved last question (no auto-retry loop).

## Role-switch → new-conversation reset mechanism (chosen: lazy dynamic import)

In `roleStore.setActiveUser`, after setting the new role, if `user.role !== prevRole` the store fires `void import('@/stores/assistantStore').then(m => m.useAssistantStore.getState().newConversation())`. Dynamic import (not a top-level import or a `subscribe`) keeps the two session stores free of any static import cycle — `assistantStore` never imports `roleStore`, and `apiClient`/`useAssistantChat` already import `roleStore`, so a top-level import the other way would risk a cycle. The requirement — role change ⇒ `activeConversationId` becomes null — holds; prior conversations remain persisted server-side.

## Task Commits

1. **Task 1: assistantStore + role-switch conversation reset** - `e17775b` (feat)
2. **Task 2: useAssistantChat hook** - `59110f8` (feat)

**Plan metadata:** docs commit (this SUMMARY + STATE.md)

## Files Created/Modified
- `src/stores/assistantStore.ts` — zustand client-session store: panel state + activeConversationId + newConversation.
- `src/hooks/useAssistantChat.ts` — useChat wrapper: per-send tagging, conversationId capture, GET-replay, normalized citations, three-way outcome, sendExample/retry/newConversation.
- `src/stores/roleStore.ts` — setActiveUser resets the active conversation on role change (lazy dynamic import).

## Decisions Made
See `key-decisions` frontmatter above. Headline: per-send tagging via `prepareSendMessagesRequest` (fresh `getState()` reads, header-only role), conversationId captured via `onData`, role-switch reset via lazy dynamic import, GET-replay reconstructing the identical data-citations part shape.

## Deviations from Plan

None - plan executed exactly as written. (The plan explicitly allowed a cleaner non-dynamic pattern for the role-switch reset "if it fits"; the dynamic-import form the plan sketched was kept as it is the minimal, cycle-free choice here.)

## Known Stubs
None found. (`grep -nE "TODO|FIXME|placeholder|not.?implemented|coming soon"` across the two created files + the modified roleStore returned nothing.)

## Deferred Issues
None.

## Issues Encountered
None. ai@6's `useChat` no longer owns `input`/`handleSubmit` (you call `sendMessage({ text })`), which was anticipated by the plan's "use the installed SDK's primitives" note — the hook manages a controlled input via `useState` and preserves the last-sent question in a ref for `retry()`, satisfying the plan's exposed API exactly.

## User Setup Required
None new (04-01 already documented the `ANTHROPIC_API_KEY` requirement; this plan is client-only and adds no env).

## Next Phase Readiness
- **Ready for 04-05** (assistant panel + full-page UI + E2E): consume `useAssistantChat()` and `useAssistantStore`. Render `messages`, read `citationsOf(message)` for the per-item pills (deep-link `/exhibit/:exhibitId?event=:eventId`), switch the three visual states off `outcome` (`grounded` / `decline` / `unavailable`), wire the empty-state chips to `sendExample`, the header "New conversation" control to `newConversation`, and the unavailable "Try again" button to `retry`. The E2E mock copies 04-03's captured stream frame byte-for-byte; `data-citations` + `X-Conversation-Id` are exactly what this hook reads.

## Self-Check: PASSED
- Created files exist: `src/stores/assistantStore.ts`, `src/hooks/useAssistantChat.ts` — both FOUND; `src/stores/roleStore.ts` modified.
- Commits exist: `e17775b`, `59110f8` — both in `git log`.
- Build check: `npx next build` → exit 0 ("Compiled successfully"). `npx tsc --noEmit` → exit 0 (no output).
- Test suite: `npx vitest run` → 175 passed | 3 skipped (30 files) — no regressions (the 3 skips are 04-03's no-key assistant gate).
- `## Known Stubs` present, no blocking entries.

---
*Phase: 04-pivota-assistant*
*Completed: 2026-10-07*
