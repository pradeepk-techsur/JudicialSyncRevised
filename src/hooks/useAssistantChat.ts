'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';

import { useRoleStore } from '@/stores/roleStore';
import { useAssistantStore } from '@/stores/assistantStore';
import { apiFetch } from '@/lib/apiClient';

// =============================================================================
// useAssistantChat — the F7 client session hook.
//
// A thin wrapper over the AI SDK `useChat` that encapsulates ALL the session
// tagging and outcome classification so 04-05's panel + full-page view stay
// purely presentational. This hook is BOUND to 04-03's SUMMARY wire contract —
// it does NOT invent a shape. From that contract:
//
//   REQUEST  (POST /api/assistant/chat, shaped via DefaultChatTransport):
//     body:   { messages: UIMessage[], caseId, userId, conversationId? }
//     header: X-User-Role: <Role>   (role NEVER in the body — T-04-08)
//   RESPONSE (ai@6 UI-message SSE stream):
//     header: X-Conversation-Id: <uuid>  (freshly-created or echoed)
//     a custom data part written in onFinish AFTER the model text:
//       { type: 'data-citations', data: { conversationId, citations: Citation[] } }
//     where each Citation = { recordType, recordId, exhibitId, eventId,
//                             timestamp, label }. A Decline carries citations: [].
//
// The SDK primitives used are the ones 04-01 pinned on ai@6:
// DefaultChatTransport + prepareSendMessagesRequest for per-send tagging.
// =============================================================================

/** The citation shape carried on the wire (04-03) and surfaced by this hook —
 *  identical on BOTH the fresh-stream path and the GET-replay path so 04-05's
 *  CitationPill reads `citation.exhibitId` / `citation.eventId` directly (the pill
 *  deep-links to /exhibit/:exhibitId?event=:eventId) without re-deriving them. */
export interface Citation {
  recordType: 'ExhibitEvent' | 'DiscrepancyFlag' | 'JuryPackageExhibit';
  recordId: string;
  exhibitId: string;
  eventId: string | null;
  timestamp: string; // ISO
  label: string;
}

/** The server's data-citations part payload (04-03 wire contract). */
interface CitationsData {
  conversationId: string;
  citations: Citation[];
}

/** Our typed data parts: the single custom 'data-citations' part. Typing it lets
 *  TypeScript narrow `part.type === 'data-citations'` to a `{ data: CitationsData }`. */
type AssistantDataParts = {
  citations: CitationsData;
};

/** The concrete UIMessage type this chat uses (default metadata/tools + our one
 *  data part). */
type AssistantUIMessage = UIMessage<unknown, AssistantDataParts>;

/** The three unambiguous assistant outcomes (F7 criterion 5), plus transient
 *  states. Kept DISTINCT by INPUT at the client, mirroring 04-03's server-side
 *  error-vs-decline separation:
 *   - 'unavailable' comes STRICTLY off the ERROR channel (HTTP 503 /
 *     ASSISTANT_UNAVAILABLE surfaced as the SDK `error`), NEVER from message text.
 *   - 'decline'     comes STRICTLY from a COMPLETED assistant message with ZERO
 *     citations (the model's own grounded-fallback text).
 *   - 'grounded'    comes from a completed assistant message with ≥1 citation.
 *  An error is NEVER classified as a decline — the two inputs are different
 *  channels. (Client mirror of 04-03's error-vs-decline separation.) */
export type AssistantOutcome =
  | 'idle'
  | 'streaming'
  | 'grounded'
  | 'decline'
  | 'unavailable';

export interface UseAssistantChatResult {
  messages: AssistantUIMessage[];
  input: string;
  setInput: (value: string) => void;
  /** Submit the current `input` as a new user message. */
  handleSubmit: () => void;
  /** Pre-fill + auto-submit an example chip (zero-typing path, CONTEXT.md). */
  sendExample: (text: string) => void;
  status: ReturnType<typeof useChat>['status'];
  /** The current overall outcome (see AssistantOutcome). */
  outcome: AssistantOutcome;
  /** The active conversationId (null until the first message creates one). */
  conversationId: string | null;
  /** Read the normalized citations off a given assistant message (same shape on
   *  the fresh-stream and GET-replay paths). */
  citationsOf: (message: AssistantUIMessage) => Citation[];
  /** Start a fresh thread: resets the store AND clears useChat's local messages
   *  so the UI returns to the empty/chips state. */
  newConversation: () => void;
  /** Re-submit the preserved last user question (the "Try again" button on the
   *  unavailable state). No auto-retry loop — this is a manual action. */
  retry: () => void;
  /** True once an ASSISTANT_UNAVAILABLE / transport error surfaced on the error
   *  channel (distinct from a decline). */
  isUnavailable: boolean;
}

/** Pull the citations off a message's `data-citations` part (fresh-stream path)
 *  OR off a replayed message's attached metadata (GET path). Both normalize to
 *  the SAME Citation[] so 04-05 reads them identically. */
function citationsFromMessage(message: AssistantUIMessage): Citation[] {
  if (!Array.isArray(message.parts)) return [];
  for (const part of message.parts) {
    // Fresh-stream path: the server wrote a { type:'data-citations', data } part.
    if (part.type === 'data-citations') {
      const data = (part as { data?: CitationsData }).data;
      if (data && Array.isArray(data.citations)) return data.citations;
    }
  }
  return [];
}

/** Build a replayed assistant/user message (GET path) carrying its citations in
 *  the SAME 'data-citations' part shape the fresh stream uses, so citationsOf()
 *  and 04-05's pill rendering are path-agnostic. Each citation keeps exhibitId +
 *  eventId so a replayed pill deep-links exactly like a fresh-stream one. */
function replayMessageToUIMessage(m: {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  citations: Citation[];
}): AssistantUIMessage {
  const parts: AssistantUIMessage['parts'] = [{ type: 'text', text: m.content }];
  if (m.role === 'ASSISTANT') {
    // Surface replayed citations via the identical data part the stream emits
    // (exhibitId + eventId preserved verbatim — the GET response already carries
    // them per 04-03). A Decline replays with an empty citations array, so the
    // outcome derivation below classifies it as 'decline' exactly like a fresh one.
    parts.push({
      type: 'data-citations',
      data: { conversationId: '', citations: m.citations },
    });
  }
  return {
    id: m.id,
    role: m.role === 'USER' ? 'user' : 'assistant',
    parts,
  };
}

interface ConversationDetailResponse {
  conversation: { id: string };
  messages: Array<{
    id: string;
    role: 'USER' | 'ASSISTANT';
    content: string;
    citations: Citation[];
  }>;
}

export function useAssistantChat(): UseAssistantChatResult {
  const activeConversationId = useAssistantStore((s) => s.activeConversationId);
  const setActiveConversationId = useAssistantStore((s) => s.setActiveConversationId);
  const storeNewConversation = useAssistantStore((s) => s.newConversation);

  // Local input state. ai@6's useChat no longer manages `input`/`handleSubmit`
  // (you call sendMessage({ text })); the hook owns the controlled input so the
  // typed question survives an unavailable error for the "Try again" retry
  // (F7 criterion 5).
  const [input, setInput] = useState('');

  // The last user question actually sent — preserved so retry() can re-submit it
  // verbatim after an ASSISTANT_UNAVAILABLE error, without an auto-retry loop.
  const lastSentRef = useRef<string>('');

  // Transport: inject the per-SEND role header + conversation/case/user body.
  // prepareSendMessagesRequest runs at SEND time (not hook-init), so the CURRENT
  // role/conversationId/case/user are read fresh on every send — a role switch or
  // a freshly-captured conversationId between sends is always reflected
  // (mitigates T-04-12 stale-role). Role is read via useRoleStore.getState()
  // exactly like apiClient.apiFetch, and goes on the HEADER only — never the body.
  const transport = useMemo(
    () =>
      new DefaultChatTransport<AssistantUIMessage>({
        api: '/api/assistant/chat',
        prepareSendMessagesRequest: ({ messages }) => {
          const role = useRoleStore.getState().role;
          const caseId = useRoleStore.getState().caseId;
          const userId = useRoleStore.getState().activeUserId;
          const conversationId = useAssistantStore.getState().activeConversationId;
          return {
            headers: { 'X-User-Role': role },
            body: {
              messages,
              caseId,
              userId,
              // Omit on the first message (null) → server creates one; present on
              // follow-ups so the same thread is reused.
              ...(conversationId ? { conversationId } : {}),
            },
          };
        },
      }),
    [],
  );

  const chat = useChat<AssistantUIMessage>({
    transport,
    // Capture the server-returned conversationId as soon as the data-citations
    // part arrives (conversation-on-first-message). The X-Conversation-Id header
    // carries the same id, but reading it off the data part keeps capture inside
    // the SDK's stream handling without a custom fetch. Subsequent sends then
    // reuse this id via the transport above.
    onData: (dataPart) => {
      if (dataPart.type === 'data-citations') {
        const id = (dataPart.data as CitationsData | undefined)?.conversationId;
        if (id && id !== useAssistantStore.getState().activeConversationId) {
          setActiveConversationId(id);
        }
        // SUCCESS path: the server only writes the data-citations part on a
        // completed stream, so this is the earliest reliable "the send succeeded"
        // signal. Clear the input box HERE — not at submit time — so that a 503 /
        // ASSISTANT_UNAVAILABLE (which rides the error channel and never emits this
        // part) leaves the user's typed question IN the field, ready to edit or
        // re-send (F7 criterion 5 / T-11: "keep the user's typed question"). The
        // Send button is disabled while streaming, so the still-populated input
        // between submit and finish can't cause a double-send.
        setInput('');
      }
    },
    // onError is intentionally a no-op body: the SDK sets `chat.error`, which the
    // outcome derivation reads off the ERROR channel. We NEVER turn an error into
    // message text (that would masquerade an outage as a decline — T-04-13).
    onError: () => {
      /* error is surfaced via chat.error → outcome 'unavailable' */
    },
  });

  const { messages, sendMessage, status, error, setMessages } = chat;

  // REPLAY path: if a conversationId is already set when the hook mounts (e.g.
  // returning to the panel after navigating, or opening the full-page view with
  // the panel's thread active), seed useChat's messages by fetching the persisted
  // thread. Each replayed assistant message carries its citations in the SAME
  // data-citations part the stream uses (exhibitId + eventId preserved) so a
  // replayed pill deep-links exactly like a fresh-stream one. We only replay when
  // the local message list is empty (don't clobber an in-progress thread), and we
  // guard against re-replaying the same id.
  const replayedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeConversationId) {
      // The store's active conversation was reset to null. This happens on the
      // explicit "New conversation" control (which also calls the hook's
      // newConversation → setMessages([])) AND on a ROLE SWITCH, where
      // roleStore.setActiveUser calls assistantStore.newConversation() DIRECTLY
      // without going through this hook. In that role-switch path nothing else
      // clears the live useChat messages, so the prior role's answer bubbles
      // would stay rendered AND — worse — be resent to the model on the next
      // send (the transport forwards the full local `messages` array), leaking
      // prior-role history across a visibility boundary (CONTEXT.md role
      // isolation; T-04-12). Clearing the live messages here makes the fresh
      // thread the single source of truth regardless of who nulled the store:
      // the empty-state chips return and the next send carries only the new turn.
      replayedForRef.current = null;
      if (messages.length > 0) setMessages([]);
      lastSentRef.current = '';
      chat.clearError();
      return;
    }
    if (replayedForRef.current === activeConversationId) return;
    if (messages.length > 0) {
      // A fresh thread we just created/streamed — its id was captured from the
      // stream; nothing to replay. Mark it so we don't fetch over live messages.
      replayedForRef.current = activeConversationId;
      return;
    }
    let cancelled = false;
    replayedForRef.current = activeConversationId;
    void (async () => {
      try {
        const res = await apiFetch(`/api/assistant/conversations/${activeConversationId}`);
        if (!res.ok || cancelled) return;
        const detail = (await res.json()) as ConversationDetailResponse;
        if (cancelled) return;
        setMessages(detail.messages.map(replayMessageToUIMessage));
      } catch {
        // A failed replay is non-fatal: the thread simply starts empty. The next
        // send still reuses the conversationId. (Not an assistant outage.)
        if (!cancelled) replayedForRef.current = null;
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId]);

  const handleSubmit = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    lastSentRef.current = text;
    // NOTE: the input is deliberately NOT cleared here. It is cleared on the
    // SUCCESS path only (onData, above) so that a 503 / ASSISTANT_UNAVAILABLE
    // leaves the typed question in the field (F7 criterion 5 / T-11). The Send
    // button is disabled while streaming, preventing a double-send in the window
    // between submit and finish.
    void sendMessage({ text });
  }, [input, sendMessage]);

  const sendExample = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      lastSentRef.current = trimmed;
      // Chips don't populate the input field, so there is nothing to preserve or
      // clear here on submit; a successful stream still clears via onData.
      void sendMessage({ text: trimmed });
    },
    [sendMessage],
  );

  const newConversation = useCallback(() => {
    // Reset the store (clears activeConversationId → chips return) AND clear
    // useChat's local messages so the UI returns to the empty state immediately.
    storeNewConversation();
    setMessages([]);
    setInput('');
    lastSentRef.current = '';
    replayedForRef.current = null;
    chat.clearError();
  }, [storeNewConversation, setMessages, chat]);

  const retry = useCallback(() => {
    const text = lastSentRef.current;
    if (!text) return;
    // Clear the error channel first so the unavailable notice dismisses, then
    // re-submit the preserved question. Manual action only — no auto-retry loop
    // (CONTEXT.md / F7 criterion 5).
    chat.clearError();
    void sendMessage({ text });
  }, [sendMessage, chat]);

  const citationsOf = useCallback(
    (message: AssistantUIMessage) => citationsFromMessage(message),
    [],
  );

  // OUTCOME DERIVATION (three unambiguous outcomes — F7 criterion 5).
  // Precedence and INPUT separation are the whole point here:
  //   1. error channel (chat.error) → 'unavailable'  — NEVER derived from text.
  //   2. mid-stream                 → 'streaming'.
  //   3. no messages yet            → 'idle'.
  //   4. last assistant message has ≥1 citation → 'grounded'.
  //   5. last assistant message has  0 citations → 'decline'.
  // An error (1) and an empty-citations message (5) are DIFFERENT inputs — an
  // error is never reclassified as a decline (T-04-13).
  const isUnavailable = Boolean(error);
  const outcome: AssistantOutcome = useMemo(() => {
    if (error) return 'unavailable';
    if (status === 'submitted' || status === 'streaming') return 'streaming';
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
    if (!lastAssistant) return 'idle';
    return citationsFromMessage(lastAssistant).length > 0 ? 'grounded' : 'decline';
  }, [error, status, messages]);

  return {
    messages,
    input,
    setInput,
    handleSubmit,
    sendExample,
    status,
    outcome,
    conversationId: activeConversationId,
    citationsOf,
    newConversation,
    retry,
    isUnavailable,
  };
}
