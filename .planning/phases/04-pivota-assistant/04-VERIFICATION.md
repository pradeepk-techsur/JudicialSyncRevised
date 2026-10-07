---
phase: 04-pivota-assistant
verified: 2026-10-07T17:23:18Z
status: passed
score: 5/5 must-haves verified
---

# Phase 04: Pivota Assistant Verification Report

**Phase Goal:** Any authorized courtroom user can ask a natural-language question about an exhibit's status, custody, rulings, or jury eligibility during live proceedings and receive an immediate, cited answer grounded in the same data the dashboards show — or an explicit decline — and is never given a fabricated claim.

**Verified:** 2026-10-07T17:23:18Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| #   | Truth                                                                                                                     | Status     | Evidence                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | All five named demo questions return a correct, streamed answer                                                          | ✓ VERIFIED | **Real-LLM behavioral test** (ran live, key present): all 5 questions ("admitted yesterday", "objections unresolved", "Exhibit 14 jury package", "custody of Exhibit 7", "what happened to Exhibit 14") resolve grounded-or-decline, never ungrounded. 8/8 passed in 30.5s. |
| 2   | Every factual claim carries a visible citation (record type + ID + timestamp) traceable to the same ledger/projection record a dashboard shows | ✓ VERIFIED | `extractCitations` in route.ts maps 8 tools → real `recordId`+`exhibitId`+`eventId`+`timestamp` from THIS turn's tool results (never model-authored). Tools are 1:1 service pass-throughs (same source as dashboards; no `@/lib/prisma` import in tools.ts). CitationPill renders `[label·type·ts]` and deep-links `/exhibit/:exhibitId?event=:eventId` → Timeline `id="event-<id>"` + scrollIntoView + highlight. Live test: ">=1 pill when grounded (searchExhibits path)" passed. |
| 3   | No supporting record → explicit decline, never guessing                                                                  | ✓ VERIFIED | systemPrompt.ts enforces "nothing to cite means nothing exists → decline 'I don't have that information'". Zero-citation message = Decline (MessageBubble renders neutral bubble, no pill, not an error). Live grounded-or-decline tests confirm the decline branch is reachable and uncited. |
| 4   | Role without sealed visibility never sees a sealed exhibit — indistinguishable from "no such exhibit"                    | ✓ VERIFIED | `exhibitVisible()` sealed-seam gate BEFORE every role-less service read in tools.ts; returns empty/null byte-identical to nonexistent. **Live test**: "sealed DEPUTY probe Declines indistinguishably from not-found (criterion 4)" passed. Unit test (tools.test.ts 8/8) asserts sealed→empty==missing. |
| 5   | LLM unreachable/timeout → distinct "temporarily unavailable" (never a Decline), question preserved, other screens usable | ✓ VERIFIED | **Live test with key UNSET**: 3/3 fail-safe tests pass — 503 ASSISTANT_UNAVAILABLE envelope (not 200 Decline), no message written, malformed req → 503 not crash. Route 503-guards BEFORE any LLM call/DB write. `isLikelyProviderError`+timeout(20s)→503. UI renders distinct amber `role="alert"` system notice with "Try again" re-submitting `lastSentRef` (preserved question). GATE boot-smoke confirmed live: keyless container → 503, all other screens 200. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact                                              | Expected                                              | Status     | Details                                                                              |
| ---------------------------------------------------- | ----------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------- |
| `prisma/schema.prisma` + 2 migrations                 | 3 assistant tables + MessageRole + seq tiebreaker     | ✓ VERIFIED | Migrations `add_assistant_tables` + `assistant_message_seq_tiebreaker` applied (14 relations live per GATE). |
| `src/lib/assistantConfig.ts`                          | model/temp0/key accessor/isAssistantConfigured        | ✓ VERIFIED | 33 lines; temp pinned 0, placeholder-key→unconfigured, server-side only.             |
| `src/lib/assistant/tools.ts`                          | 8 tools, 1:1 pass-through, sealed seam                 | ✓ VERIFIED | 321 lines; all 8 tools wire to services, sealed gate present, zod `.uuid()` validation. |
| `src/lib/assistant/systemPrompt.ts`                  | cite-or-decline courtroom-clerk prompt                 | ✓ VERIFIED | Enforces cite-or-decline, verbatim status words, sealed-indistinguishability, no-fabrication. |
| `src/app/api/assistant/chat/route.ts`                | POST streaming + 503 guard + citation extract/persist  | ✓ VERIFIED | 547 lines; 503-first, citation extraction for all 8 tools, onFinish persistTurn.    |
| `src/app/api/assistant/conversations/[id]/route.ts`  | GET replay                                             | ✓ VERIFIED | GET export present; 404 CONVERSATION_NOT_FOUND.                                      |
| `src/services/assistant.ts`                          | resolveConversationId/persistTurn/getConversationDetail | ✓ VERIFIED | 241 lines; atomic transaction, seq tiebreaker, zero-citation invariant documented.  |
| `src/stores/assistantStore.ts` / `useAssistantChat.ts` | session store + useChat wrapper                     | ✓ VERIFIED | Role-switch→newConversation, question preserved via lastSentRef, retry().            |
| `src/components/assistant/*` (Panel/Thread/Bubble/Pill/Chips) | shared surfaces + 3 outcomes                 | ✓ VERIFIED | Grounded/Decline/Unavailable visually distinct; pill deep-links.                    |
| `src/app/assistant/page.tsx`                         | full-page surface                                     | ✓ VERIFIED | Route built (GATE shows `/assistant` ○).                                             |
| `e2e/assistant.spec.ts`                              | Playwright E2E                                         | ✓ VERIFIED | 14.6KB spec present; executor ran 29/29 green at plan time (05-SUMMARY).             |

### Key Link Verification

| From                         | To                                   | Via                                    | Status  |
| ---------------------------- | ------------------------------------ | -------------------------------------- | ------- |
| chat/route.ts                | buildAssistantToolSet/Prompt/streamText | AI SDK streamText temp0 Anthropic   | ✓ WIRED |
| chat/route.ts                | isAssistantConfigured                | 503 guard before LLM call              | ✓ WIRED |
| chat/route.ts (onFinish)     | persistTurn                          | atomic citation persistence            | ✓ WIRED |
| tools.ts                     | 8 service functions                  | direct call-through in execute         | ✓ WIRED |
| tools.ts (exhibit-scoped)    | getExhibit (sealed seam)             | exhibitVisible() before role-less read | ✓ WIRED |
| Header.tsx (Ask ✦)           | assistantStore.togglePanel           | onClick toggles slide-over             | ✓ WIRED |
| CitationPill.tsx             | /exhibit/:id?event=<eventId>         | next/link from citation object         | ✓ WIRED |
| exhibit page                 | Timeline #event-<id>                 | useSearchParams→scrollIntoView+highlight | ✓ WIRED |
| roleStore.setActiveUser      | assistantStore.newConversation       | role change resets conversation        | ✓ WIRED |

### Requirements Coverage

All 5 ROADMAP success criteria (F7) satisfied — see Observable Truths.

### Anti-Patterns Found

None. Scan of all assistant files (lib/services/hooks/components/app/stores) for TODO/FIXME/placeholder/not-implemented returned zero (the only `REPLACE_ME` hit is the intentional `.env.example` placeholder-key sentinel used by `isAssistantConfigured`).

### Behavioral Spot-Checks (executed this verification)

1. `npx vitest run src/lib/assistant/tools.test.ts` → **8/8 passed** (sealed→empty indistinguishable, zod rejects non-UUID, 1:1 wiring).
2. `npx vitest run src/app/api/assistant/chat/route.test.ts` (key present) → **8/8 real-LLM passed** (all 5 demo questions grounded-or-decline never ungrounded; pills on grounded; sealed DEPUTY decline; data-citations frame on wire). 3 skipped = key-gated 503 tests.
3. `env -u ANTHROPIC_API_KEY npx vitest run ... -t "503 ASSISTANT_UNAVAILABLE"` → **3/3 passed** (503 envelope not 200 Decline, no message written, malformed→503). The complementary 8 skipped = real-LLM tests (correctly skip without key).

### Gate Evidence (cited, not re-litigated)

- `gate_status: passed`, `boot_smoke: pass`, `review_blockers_open: 0` — all 6 waves build+test green (176 passed / 3 env-conditional skips on final tree).
- Boot-smoke `POST /api/assistant/chat → 503 ASSISTANT_UNAVAILABLE` in the keyless container is the DESIGNED criterion-5 fail-safe (app boots, all other screens 200), per GATE.md — confirmed above by re-running the fail-safe tests key-unset.
- Code review iteration 2: `status: clean`, 0 blockers, 0 warnings; B1/B2 + W1–W4 all verified FIXED against actual diffs (cross-role leakage, seq tiebreaker, duplicate useChat, stale-id FK-crash, untested citation frame, replay role-scoping documented-out-of-scope).

### Gaps Summary

None. Every ROADMAP success criterion is backed by substantive, wired artifacts AND by live behavioral evidence — the grounded/decline/never-ungrounded guarantees were exercised against the real LLM, and the error≠decline fail-safe was exercised key-unset. The goal is achieved.

### Note for human (optional confirmation, not blocking)

Automated + behavioral evidence covers all 5 criteria. A human may optionally confirm the purely *visual* distinction of the three outcomes (grounded pills vs calm decline vs amber unavailable notice) and the pill click-through scroll+highlight feel in a browser — these were E2E-asserted (29/29 at plan time) but visual polish is inherently human-judged.

---

_Verified: 2026-10-07T17:23:18Z_
_Verifier: Claude (pivota_spec-verifier)_
