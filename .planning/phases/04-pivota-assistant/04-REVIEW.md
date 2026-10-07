---
phase: 4
status: fixes_applied
blockers: 2
warnings: 4
blockers_fixed: 2
warnings_fixed: 4
files_reviewed: 31
files_reviewed_list:
  - .env.example
  - e2e/app-shell.spec.ts
  - e2e/assistant.spec.ts
  - package.json
  - prisma/migrations/20261007161004_add_assistant_tables/migration.sql
  - prisma/schema.prisma
  - src/app/api/assistant/chat/route.test.ts
  - src/app/api/assistant/chat/route.ts
  - src/app/api/assistant/conversations/[id]/route.ts
  - src/app/assistant/page.tsx
  - src/app/exhibit/[id]/page.tsx
  - src/components/assistant/AssistantPanel.tsx
  - src/components/assistant/AssistantThread.tsx
  - src/components/assistant/CitationPill.tsx
  - src/components/assistant/ExampleChips.tsx
  - src/components/assistant/MessageBubble.tsx
  - src/components/exhibit/Timeline.tsx
  - src/components/shell/AppShell.tsx
  - src/components/shell/Header.tsx
  - src/components/shell/Sidebar.tsx
  - src/data/seed.ts
  - src/hooks/useAssistantChat.ts
  - src/lib/assistant/schema.test.ts
  - src/lib/assistant/systemPrompt.ts
  - src/lib/assistant/tools.test.ts
  - src/lib/assistant/tools.ts
  - src/lib/assistantConfig.ts
  - src/lib/errors.ts
  - src/services/assistant.test.ts
  - src/services/assistant.ts
  - src/stores/assistantStore.ts
  - src/stores/roleStore.ts
reviewed_at: 2026-10-07T17:04:15Z
iteration: 1
---

# Phase 4 Code Review

## BLOCKERs

### B1: Role switch does not clear the chat hook's local messages — prior-role answers stay on screen AND are resent to the model, breaking the mandated role isolation
- **File:** src/stores/roleStore.ts:57-59, src/hooks/useAssistantChat.ts:239-270
- **Category:** bug
- **Evidence:** CONTEXT.md locks: *"Role switch starts a new conversation ... prevents a single audit thread from mixing answers computed under different visibility scopes, and stops the model reusing a prior-role answer from history."* On a role switch, `roleStore.setActiveUser` calls `assistantStore.newConversation()` **directly** (roleStore.ts:57-59), which only sets `activeConversationId = null` in the store. It never invokes the hook's `newConversation` callback (useAssistantChat.ts:291) — the only place `setMessages([])` is called. The hook's replay effect (useAssistantChat.ts:239-243) reacts to `activeConversationId → null` by early-returning (`if (!activeConversationId) { replayedForRef.current = null; return; }`) **without clearing `messages`**. Result:
  1. The previous role's answer bubbles stay rendered (`hasMessages` stays true, so the empty-state chips never return — contradicting CONTEXT "role-switch brings back example chips" and the fresh-thread intent).
  2. Worse: on the next send, `prepareSendMessagesRequest` (useAssistantChat.ts:184-200) forwards the **full local `messages` array** — still containing the prior-role turns — which the route feeds to `convertToModelMessages` → `streamText`. The model therefore DOES see prior-role history, the exact cross-role leakage the design forbids (and the new server conversationId gives a false sense of isolation because the model context is not actually reset).
  - Concrete failing flow: as JUDGE, ask "what happened to sealed exhibit S-1" (grounded, pills shown) → switch role to DEPUTY → ask any follow-up. The JUDGE answer about the sealed exhibit remains on screen and is included in the DEPUTY turn's message array sent to the model.
- **Fix direction:** The role-switch reset must clear the hook's live `useChat` messages too, not just the store's `activeConversationId`. Either have the hook subscribe to `activeConversationId` transitions to null and call `setMessages([])` (and reset `replayedForRef`/input), or route the role-switch reset through the same full `newConversation` path the header button uses. Ensure the next send after a role switch carries only the new turn.
- **Resolution:** fixed (c1d0b2d) — the hook's replay effect now reacts to any `activeConversationId → null` transition (which the role switch triggers via `assistantStore.newConversation()`) by clearing live `useChat` messages (`setMessages([])`), resetting `replayedForRef`/`lastSentRef` and the error channel. Prior-role bubbles are removed, chips return, and the next send carries only the new turn. tsc clean; no unit test covers the hook (E2E coverage), so flagged for human verification of the model-context reset in UAT.

### B2: USER and ASSISTANT messages in one turn get identical `created_at`; replay order has no tiebreaker, so a turn's answer can render before its question
- **File:** src/services/assistant.ts:116-146 (persist), src/services/assistant.ts:158-167 (replay orderBy)
- **Category:** bug
- **Evidence:** `persistTurn` inserts the USER row then the ASSISTANT row inside one `prisma.$transaction` (assistant.ts:116-146). Both rows use `createdAt @default(now())` → Postgres `DEFAULT CURRENT_TIMESTAMP` (migration.sql:20, schema.prisma:324/310). `CURRENT_TIMESTAMP` in Postgres returns the **transaction start time**, which is identical for every row inserted in the same transaction — so the two messages of a turn carry the SAME `created_at`. `getConversationDetail` orders strictly `orderBy: { createdAt: 'asc' }` (assistant.ts:163) with **no secondary sort key**. With equal timestamps the USER/ASSISTANT order is not defined by the query — it falls back to physical/index row order, which Postgres does not guarantee. A replay can therefore return ASSISTANT before USER, rendering the answer above the question. The existing test (`services/assistant.test.ts:126` `expect(detail.messages[0].role).toBe('USER')`) passes only incidentally on insert order and does not protect against this.
- **Fix direction:** Make intra-turn order deterministic: add a stable tiebreaker to the replay `orderBy` (e.g. order by `createdAt asc` then by an explicit per-turn sequence column or `id` with a monotonic component), or persist an explicit sequence/`turnIndex` on `AssistantMessage` and order by it. A pure `id`-UUID tiebreaker is NOT sufficient (random UUIDs don't encode insertion order).
- **Resolution:** fixed (a18e235) — added an explicit `seq` ordinal (USER=0, ASSISTANT=1) to `AssistantMessage` (new migration `20261007170631_assistant_message_seq_tiebreaker`, index `(conversation_id, created_at, seq)`); `getConversationDetail` now orders by `[{ createdAt: 'asc' }, { seq: 'asc' }]`. Note: in this env the two inserts actually land 1ms apart (Prisma interactive-transaction per-statement timestamps), but ms-precision collisions remain possible, so the `seq` tiebreaker is the robust guarantee. New test forces an identical-timestamp collision with ASSISTANT inserted physically before USER and asserts USER still replays first. All 3 service tests pass; tsc clean.

## WARNINGs

### W1: On /assistant the panel thread and the page thread are two independent useChat instances that can diverge
- **File:** src/app/assistant/page.tsx:15-20, src/components/shell/AppShell.tsx:19, src/components/assistant/AssistantThread.tsx:43-55
- **Evidence:** `/assistant` renders `AssistantThread variant="page"` while AppShell simultaneously mounts `AssistantPanel` → a second `AssistantThread variant="panel"`. Each calls `useAssistantChat()`, creating a separate `useChat` with its own `messages` array (e2e/assistant.spec.ts:342 confirms both threads are mounted). They share only `activeConversationId` in zustand, not the live message list. They converge only via a server replay fetch, which fires solely on mount / `activeConversationId` change and is skipped when `messages.length > 0` (useAssistantChat.ts:245-250). So a turn streamed in the page thread does not appear in the already-mounted panel thread (and vice-versa) until a remount/replay, contradicting CONTEXT's "one continuous shared thread across surfaces." Degraded (not data-corrupting), hence WARNING.
- **Fix direction:** Share one conversation message source across surfaces (e.g. lift the message list into the store, or suppress the duplicate thread when the full page is active), so both surfaces reflect the same live turns without a replay round-trip.
- **Resolution:** fixed (185b0e0) — took the suppress-duplicate option: `AssistantPanel` reads `usePathname()` and renders nothing (no backdrop, no `<aside>`, no thread) when `pathname === '/assistant'`, so the full page is the single live surface there and there is never a second divergent `useChat` for the same conversation. Elsewhere the panel is unchanged. E2E comment updated to match. tsc clean; behavioral (cross-surface live continuity) flagged for human verification in UAT.

### W2: A stale/invalid client-supplied conversationId throws a FK violation inside streamText onFinish, after the model already ran
- **File:** src/app/api/assistant/chat/route.ts:116-117, 156-164; src/services/assistant.ts:116-146
- **Evidence:** The route reuses `body.conversationId` as-is when present (route.ts:117) and only creates a conversation when it is absent. `persistTurn` then inserts messages with `conversationId` FK → if the client sends a conversationId that no longer exists (e.g. a thread cleared/reset elsewhere, a different browser session, or a hand-crafted request), the insert trips `assistant_messages_conversation_id_fkey` and throws **inside `onFinish`** (route.ts:156), after the LLM call completed — an unhandled rejection in the stream callback rather than a clean error, and the turn is lost. The happy path is fine; this is an unguarded edge, hence WARNING.
- **Fix direction:** Validate the supplied conversationId belongs to this case/user before reuse (or create-if-missing), and wrap the `onFinish` persistence so a persistence failure is handled on the error channel instead of rejecting unhandled inside the stream.
- **Resolution:** fixed (ac9c9f4) — new `resolveConversationId(suppliedId, caseId, userId)` service reuses a supplied id ONLY if it exists and belongs to the same case+user, else creates a fresh conversation (validation moved BEFORE the LLM call). The `onFinish` `persistTurn` is wrapped in try/catch and re-throws so a persistence failure routes to `createUIMessageStream`'s `onError` → ASSISTANT_UNAVAILABLE instead of an unhandled rejection. Route + service tests pass; tsc clean.

### W3: The server's `data-citations` stream emission is not covered by any automated test
- **File:** src/app/api/assistant/chat/route.ts:132-178; src/app/api/assistant/chat/route.test.ts:192-198
- **Evidence:** The pills' live-stream path depends on `writer.write({ type:'data-citations', ... })` in the inner `streamText.onFinish` landing in the outer `createUIMessageStream` before it closes (route.ts:167-173). The route tests read citations from DB persistence (`getConversationDetail`, route.test.ts:194), not from the streamed data part, so the ordering/timing of the custom data part relative to stream close is unverified server-side. The E2E mock (e2e/assistant.spec.ts:84-108) hand-writes the frame shape but does not exercise the real route's writer-merge-then-write sequence. If the data part races the stream close, live pills silently disappear (replay still works). WARNING (test gap + latent risk), not a confirmed defect.
- **Fix direction:** Add a server-side test that drains the real route's stream body and asserts a `data-citations` frame is present with the extracted citations, so the writer timing is pinned.
- **Resolution:** fixed (f230d00) — added a key-gated server test that drains the REAL route body, asserts the `data-citations` frame is present on the wire carrying this turn's conversationId, parses the frame's citations array, and asserts its length matches the persisted record — pinning the writer-merge-then-write timing. Test passes against the real stream.

### W4: GET /api/assistant/conversations/:id has no role/ownership check — any id replays its full thread + citations
- **File:** src/app/api/assistant/conversations/[id]/route.ts:12-22; src/services/assistant.ts:158-194
- **Evidence:** The replay route takes no `X-User-Role`/user and applies no ownership or visibility filter — `getConversationDetail(id)` returns every message and citation for any conversation id. Because citations were already role-filtered at persist time, this does not retroactively expose records that were hidden when the turn ran; and the app has no per-user auth anywhere (every route trusts the `X-User-Role` header in this single-case demo), so this matches the established no-auth model rather than introducing a new hole. Flagged as a WARNING for awareness: a conversation created under a privileged role can be replayed verbatim by a request that does not assert that role. If audit threads are ever considered role-scoped at read time, this is the gap to close.
- **Fix direction:** If read-time role scoping is in scope, require the role/user on the replay route and reject (or 404) replays whose conversation role scope doesn't match; otherwise record explicitly that assistant-thread replay is intentionally unauthenticated like the rest of the demo.
- **Resolution:** fixed (28f78c4) — read-time role scoping is NOT in F7 scope and the demo has no per-user auth anywhere; the finding confirms citations are role-filtered at persist time so replay cannot retroactively expose hidden records. Took the documentation option: added an explicit INTENTIONALLY-UNAUTHENTICATED block to the replay route recording the rationale and naming the single place to add a role/ownership check if audit threads ever become read-time role-scoped. No behavior change.

## Cross-file seams checked
- tools.ts imports ↔ service signatures (status/custody/history/objections/exhibits/juryPackage/discrepancies): OK — `tsc --noEmit` clean; getExhibit(exhibitId, role), getJuryPackage(caseId, role), searchExhibits(criteria), getExhibitDiscrepancies(exhibitId) all match call sites.
- route.ts citation extractor ↔ tool result shapes (lastStatusEventId/lastStatusAt, lastEventId/since, eventId/timestamp, raisedEventId/raisedAt, detectedAt/ruleCode, addedAt/exhibitLabel): OK — defensive `str()`/`asRecord()` readers tolerate Date→ISO; JuryPackageExhibitView has no `id` but extractor falls back to `exhibitId` (route.ts:463).
- Wire contract route.ts ↔ useAssistantChat ↔ MessageBubble/CitationPill (`data-citations` part, Citation{recordType,recordId,exhibitId,eventId,timestamp,label}): OK — shapes identical across server, hook, and components.
- CitationPill href ↔ exhibit/[id] deep-link (`/exhibit/:exhibitId?event=:eventId`) ↔ Timeline `event-<id>` anchor: OK — null eventId → top-of-timeline fallback handled.
- prisma schema ↔ migration (3 tables + message_role enum + indexes + FKs): OK — fields, maps, and FK targets match.
- seed.ts reset order ↔ FK constraints (citations→messages→conversations before users/case): OK — sequential `$transaction([...])` array.
- roleStore role-switch reset ↔ assistantStore.newConversation ↔ hook messages: FINDING B1 (store reset does not clear hook messages).
- persistTurn insert order ↔ getConversationDetail replay order: FINDING B2 (equal created_at, no tiebreaker).
- errors.ts (AssistantUnavailableError 503 / ToolArgsInvalidError) ↔ route 503 guard ↔ client 'unavailable' outcome: OK — error channel kept distinct from decline throughout.
- sealed seam: exhibitVisible(getExhibit role gate) ↔ tools ↔ tools.test DEPUTY/S-1 indistinguishability: OK — well covered.
