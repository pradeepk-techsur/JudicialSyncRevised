'use client';

import { useEffect, useRef } from 'react';
import { Button, TextInput, InlineLoading, InlineNotification } from '@carbon/react';
import { useAssistantChat } from '@/hooks/useAssistantChat';
import { MessageBubble } from './MessageBubble';
import { ExampleChips } from './ExampleChips';
import styles from './AssistantThread.module.scss';

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
//   - streaming  → a Carbon InlineLoading typing indicator (tokens stream in)
//   - grounded   → MessageBubble with pills
//   - decline    → MessageBubble, neutral, no pill (NOT an error)
//   - unavailable→ a DISTINCT Carbon InlineNotification (warning) SYSTEM NOTICE
//                  (the error channel, never a message) with a "Try again" that
//                  re-submits the preserved question (criterion 5). This is a
//                  STRUCTURALLY different component from MessageBubble — not a
//                  restyled bubble — so an error can never be mistaken for a
//                  decline (T-04-13 / T-06-09).
//
// CARBON MIGRATION (Phase 6): the input row is Carbon `TextInput` + `Button`, the
// typing indicator is Carbon `InlineLoading`, and the unavailable notice is
// Carbon `InlineNotification kind="warning"` (role="alert", retry Button). The
// input stays single-line (as the pre-Carbon `<input type="text">` was): Enter
// submits via the form; a single-line field has no newline to insert, so the
// Enter-submits keyboard contract is preserved exactly and Shift+Enter is a
// no-op on this control just as before (no multiline support was ever present,
// and none is silently dropped).
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
    <div className={styles.thread} data-testid="assistant-thread" data-variant={variant}>
      {/* Header row: title + New conversation + (panel) close. */}
      <div className={styles.header}>
        <h2 className={styles.title}>Pivota Assistant</h2>
        <div className={styles.headerActions}>
          <Button
            kind="ghost"
            size="sm"
            data-testid="new-conversation"
            onClick={newConversation}
          >
            New conversation
          </Button>
          {variant === 'panel' && onClose && (
            <Button
              kind="ghost"
              size="sm"
              data-testid="assistant-close"
              onClick={onClose}
              aria-label="Close assistant panel"
            >
              ✕
            </Button>
          )}
        </div>
      </div>

      {/* Message scroll area. */}
      <div className={styles.messages}>
        {!hasMessages && !isUnavailable && (
          <div className={styles.emptyState}>
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

        {/* Streaming: Carbon InlineLoading typing indicator while tokens stream
            in. Wrapped in the testid container the suite asserts on. */}
        {isStreaming && (
          <div className={styles.typingRow} data-testid="assistant-typing">
            <InlineLoading description="Assistant is typing…" />
          </div>
        )}

        {/* UNAVAILABLE (criterion 5): a DISTINCT Carbon InlineNotification
            (warning) SYSTEM NOTICE — NOT an assistant message bubble, NOT the
            neutral decline styling. This is the ERROR CHANNEL; an error is never
            a decline (T-04-13 / T-06-09). A STRUCTURALLY different component from
            MessageBubble. The "Try again" re-submits the preserved question (no
            auto-retry). role="alert" + data-testid preserved on the notice. */}
        {isUnavailable && (
          <div className={styles.unavailable}>
            <InlineNotification
              kind="warning"
              lowContrast
              role="alert"
              data-testid="assistant-unavailable"
              hideCloseButton
              title="The assistant is temporarily unavailable"
              subtitle=""
            />
            <Button
              kind="tertiary"
              size="sm"
              data-testid="assistant-retry"
              onClick={retry}
              className={styles.retryButton}
            >
              Try again
            </Button>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Input row: natural language only (no command syntax). Enter submits via
          the form (single-line field, as before). */}
      <form
        className={styles.inputRow}
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <div className={styles.inputField}>
          <TextInput
            id="assistant-input"
            type="text"
            data-testid="assistant-input"
            labelText="Ask the Pivota Assistant"
            hideLabel
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about an exhibit…"
          />
        </div>
        <Button
          type="submit"
          size="md"
          data-testid="assistant-send"
          disabled={!input.trim() || isStreaming}
        >
          Send
        </Button>
      </form>
    </div>
  );
}
