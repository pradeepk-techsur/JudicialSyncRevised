'use client';

import { useEffect, useRef } from 'react';
import { useAssistantChat } from '@/hooks/useAssistantChat';
import { MessageBubble } from './MessageBubble';
import { ExampleChips } from './ExampleChips';

// =============================================================================
// AssistantThread — the SHARED conversation renderer used by BOTH surfaces:
// the slide-over panel (variant="panel") and the full-page /assistant view
// (variant="page"). Both consume the SAME useAssistantChat() hook over the SAME
// zustand store, so one conversation is continuous across surfaces (CONTEXT.md).
//
// It is surface-agnostic: `variant` drives only minor layout, and `onClose`
// (panel only) renders the close control.
//
// It renders every state in F7's States table:
//   - empty      → ExampleChips (tap → sendExample → pre-fill + auto-submit)
//   - streaming  → a left bubble + typing indicator (tokens stream in)
//   - grounded   → MessageBubble with pills
//   - decline    → MessageBubble, neutral, no pill (NOT an error)
//   - unavailable→ a DISTINCT inline SYSTEM NOTICE (the error channel, never a
//                  message) with a "Try again" that re-submits the preserved
//                  question (criterion 5). This is visually unambiguous vs a
//                  decline bubble (neutral) and a grounded answer.
// =============================================================================

/** Pull the plain assistant/user text out of a UIMessage's text parts. The
 *  citations ride a separate data part (read via the hook's citationsOf). */
function messageText(message: { parts?: Array<{ type: string; text?: string }> }): string {
  if (!Array.isArray(message.parts)) return '';
  return message.parts
    .filter((p) => p.type === 'text')
    .map((p) => p.text ?? '')
    .join('');
}

export interface AssistantThreadProps {
  variant?: 'panel' | 'page';
  onClose?: () => void;
}

export function AssistantThread({ variant = 'page', onClose }: AssistantThreadProps) {
  const {
    messages,
    input,
    setInput,
    handleSubmit,
    sendExample,
    outcome,
    citationsOf,
    newConversation,
    retry,
    isUnavailable,
  } = useAssistantChat();

  const hasMessages = messages.length > 0;
  const isStreaming = outcome === 'streaming';

  // Auto-scroll to the newest content as the thread grows / streams.
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, outcome]);

  return (
    <div className="flex h-full flex-col" data-testid="assistant-thread" data-variant={variant}>
      {/* Header row: title + New conversation + (panel) close. */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Pivota Assistant</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="new-conversation"
            onClick={newConversation}
            className="rounded border px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
          >
            New conversation
          </button>
          {variant === 'panel' && onClose && (
            <button
              type="button"
              data-testid="assistant-close"
              onClick={onClose}
              aria-label="Close assistant panel"
              className="rounded border px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Message scroll area. */}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {!hasMessages && !isUnavailable && (
          <div className="pt-2">
            {/* onPick → sendExample: pre-fill + auto-submit. Chips vanish once a
                message exists (hasMessages gate above). */}
            <ExampleChips onPick={sendExample} />
          </div>
        )}

        {messages.map((m) => {
          if (m.role === 'user') {
            return (
              <MessageBubble
                key={m.id}
                role="USER"
                content={messageText(m)}
                citations={[]}
                outcome="grounded"
              />
            );
          }
          // Assistant message: derive the per-message outcome from its own
          // citations (grounded = ≥1 pill, decline = zero). This is per-MESSAGE,
          // independent of the hook's overall transient outcome.
          const citations = citationsOf(m);
          const msgOutcome = citations.length > 0 ? 'grounded' : 'decline';
          return (
            <MessageBubble
              key={m.id}
              role="ASSISTANT"
              content={messageText(m)}
              citations={citations}
              outcome={msgOutcome}
            />
          );
        })}

        {/* Streaming: typing indicator while tokens stream in. */}
        {isStreaming && (
          <div className="flex justify-start" data-testid="assistant-typing">
            <div className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-500">
              <span className="inline-flex gap-1">
                <span className="animate-pulse">●</span>
                <span className="animate-pulse [animation-delay:150ms]">●</span>
                <span className="animate-pulse [animation-delay:300ms]">●</span>
              </span>
            </div>
          </div>
        )}

        {/* UNAVAILABLE (criterion 5): a DISTINCT inline SYSTEM NOTICE — NOT an
            assistant message bubble, NOT the neutral decline styling. This is the
            ERROR CHANNEL; an error is never a decline (T-04-13). The "Try again"
            re-submits the preserved question (no auto-retry). */}
        {isUnavailable && (
          <div
            role="alert"
            data-testid="assistant-unavailable"
            className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800"
          >
            <span aria-hidden="true" className="mt-0.5">⚠</span>
            <div className="flex flex-col gap-1.5">
              <span>The assistant is temporarily unavailable</span>
              <button
                type="button"
                data-testid="assistant-retry"
                onClick={retry}
                className="self-start rounded border border-amber-400 bg-white px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Input row: natural language only (no command syntax). Enter submits. */}
      <form
        className="flex items-center gap-2 border-t px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <input
          type="text"
          data-testid="assistant-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about an exhibit…"
          aria-label="Ask the Pivota Assistant"
          className="flex-1 rounded border px-3 py-2 text-sm"
        />
        <button
          type="submit"
          data-testid="assistant-send"
          disabled={!input.trim() || isStreaming}
          className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
