---
phase: 4
status: clean
blockers: 0
warnings: 0
files_reviewed: 10
files_reviewed_list:
  - e2e/assistant.spec.ts
  - prisma/migrations/20261007170631_assistant_message_seq_tiebreaker/migration.sql
  - prisma/schema.prisma
  - src/app/api/assistant/chat/route.test.ts
  - src/app/api/assistant/chat/route.ts
  - src/app/api/assistant/conversations/[id]/route.ts
  - src/components/assistant/AssistantPanel.tsx
  - src/hooks/useAssistantChat.ts
  - src/services/assistant.test.ts
  - src/services/assistant.ts
reviewed_at: 2026-10-07T17:30:00Z
iteration: 2
---

# Phase 4 Code Review

Re-review of iteration-1 findings (B1, B2, W1–W4) after the code-fixer's six fix
commits (`c1d0b2d`, `a18e235`, `185b0e0`, `ac9c9f4`, `f230d00`, `28f78c4`). Scope:
the 10 files the fixer touched (a subset of the iteration-1 list). Each previous
finding was verified against the actual diff + current file state, and each fix
was checked for a regression it might introduce. `tsc --noEmit` is clean.

## BLOCKERs

None.

## WARNINGs

None.

## Previous findings — verification

### B1 (bug) — role-switch did not clear hook messages → cross-role leakage: FIXED
- **File:** src/hooks/useAssistantChat.ts:239–258
- **Verified:** The replay effect's null-branch now clears the live `useChat`
  messages on ANY `activeConversationId → null` transition — including the
  role-switch path where `roleStore.setActiveUser` calls
  `assistantStore.newConversation()` directly, bypassing the hook. It resets
  `replayedForRef.current = null`, calls `setMessages([])` (guarded by
  `messages.length > 0`), clears `lastSentRef`, and `chat.clearError()`. Prior-role
  bubbles are removed and the transport's `prepareSendMessagesRequest` (which
  forwards the live `messages` array) now carries only the new turn, closing the
  model-context leak. `clearError`/`setMessages` are valid on the SDK return type
  (tsc clean). No regression on initial mount (null branch is a no-op when
  messages are empty) and no replay clobber on the subsequent fresh turn
  (`messages.length > 0` short-circuits re-replay). Hook has E2E (not unit)
  coverage; model-context reset is UAT-verified per the original note.

### B2 (bug) — equal intra-turn created_at, no replay tiebreaker: FIXED
- **File:** prisma/schema.prisma:321–335, migration `20261007170631_...`, src/services/assistant.ts:157–209
- **Verified:** New `seq Int @default(0)` ordinal on `AssistantMessage` (USER=0,
  ASSISTANT=1 set explicitly in `persistTurn`); replay `orderBy` is now
  `[{ createdAt: 'asc' }, { seq: 'asc' }]`. Migration drops the old
  `(conversation_id, created_at)` index and creates `(conversation_id,
  created_at, seq)`; it is correctly ordered after the original assistant-tables
  migration. New service test forces an identical `createdAt` with ASSISTANT
  inserted physically before USER and asserts USER still replays first, proving
  the ordering comes from `seq`. `createdAt` is mapped via `.toISOString()`
  (string), so the test's string equality on the colliding timestamp is valid.

### W1 — divergent duplicate `useChat` on /assistant: FIXED
- **File:** src/components/assistant/AssistantPanel.tsx:28–72
- **Verified:** Panel reads `usePathname()` and suppresses BOTH its backdrop and
  its `<aside>`/thread when `pathname === '/assistant'`, so the full page is the
  single live surface and no second `useChat` exists for that conversation.
  `usePathname` is reactive: navigating away from `/assistant` re-renders the
  panel with its store-preserved `isPanelOpen` and replays from
  `activeConversationId` — no regression to the close→reopen persistence behavior
  elsewhere. E2E comment updated; the page-variant assertion still holds.

### W2 — stale conversationId FK-crash inside onFinish: FIXED
- **File:** src/services/assistant.ts:90–125, src/app/api/assistant/chat/route.ts:113–121, 160–188
- **Verified:** New `resolveConversationId(suppliedId, caseId, userId)` runs
  BEFORE the LLM call and reuses a supplied id only if it exists AND belongs to
  the same case+user, else creates a fresh conversation — eliminating the realistic
  stale/spoofed-id FK trigger entirely. The resolved id is returned on the
  `X-Conversation-Id` header AND written into the `data-citations` part (route
  line 184); the hook's `onData` reconciles the client's zustand id (hook
  213–217), so the silent fresh-conversation fallback keeps client and server in
  sync — no divergence regression. `onFinish`'s `persistTurn` is wrapped in
  try/catch and re-throws as defense-in-depth for unexpected DB errors; the
  primary defect is resolved by the pre-call validation regardless of the exact
  re-throw-to-onError propagation.

### W3 — data-citations stream frame untested server-side: FIXED
- **File:** src/app/api/assistant/chat/route.test.ts:247–299
- **Verified:** New key-gated test drains the REAL route body (via the existing
  `drain` helper), asserts a `data-citations` frame is on the wire carrying this
  turn's `X-Conversation-Id`, parses the frame's citations array, and asserts its
  length equals the persisted record's — pinning the writer-merge-then-write
  timing. Test-only addition; no production behavior change.

### W4 — replay route has no read-time role/ownership check: FIXED (documented)
- **File:** src/app/api/assistant/conversations/[id]/route.ts:9–28
- **Verified:** Read-time role scoping is confirmed out of F7 scope; citations are
  role-filtered at persist time so replay cannot retroactively expose hidden
  records, matching the demo's established header-trust model. An explicit
  INTENTIONALLY-UNAUTHENTICATED block records the rationale and names the single
  place to add a check if audit threads ever become read-time role-scoped. No
  behavior change.

## Cross-file seams checked (fix-touched seams only)
- roleStore role-switch → assistantStore.newConversation → hook null-transition clears live messages: OK (B1 fixed; next send carries only the new turn).
- persistTurn seq (0/1) ↔ getConversationDetail `orderBy [createdAt, seq]` ↔ (conversation_id, created_at, seq) index: OK (B2 fixed; tiebreaker deterministic).
- route.ts `resolveConversationId` ↔ `X-Conversation-Id` header ↔ data-citations `conversationId` ↔ hook `onData` capture: OK (client reconciles to the resolved id; no divergence on stale-id fallback).
- AssistantPanel `usePathname()` suppression ↔ /assistant page single thread ↔ navigate-away remount+replay: OK (store-preserved isPanelOpen, no persistence regression off-route).
- schema.prisma AssistantMessage.seq ↔ migration ADD COLUMN + index swap ↔ Prisma client types: OK (tsc clean).
- route.test.ts `drain` ↔ real stream body ↔ persisted citations count: OK (frame timing pinned).
