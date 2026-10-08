'use client';

import type { Citation } from '@/hooks/useAssistantChat';
import { CitationPill } from './CitationPill';
import styles from './MessageBubble.module.scss';

// =============================================================================
// MessageBubble — one rendered conversation turn (user OR assistant).
//
// Renders the TWO valid assistant outcomes as VISUALLY DISTINCT shapes
// (F7 criterion 3/5):
//   - 'grounded' : the highest-contrast ANSWER text followed by the citation
//                  pills (one pill PER listed item for list answers — all
//                  citations rendered in order).
//   - 'decline'  : a calm NEUTRAL bubble — the SAME styling as a grounded answer
//                  MINUS any pill. NO red, NO warning icon, NOT an error
//                  (Y0-patterns Decline-as-Valid-Response). "I don't have that
//                  information" must read as a valid answer, never as broken.
//
// The 'unavailable' outcome is NEVER a message bubble — it is the error channel,
// rendered as a distinct system notice (Carbon InlineNotification) by
// AssistantThread. An error is never a decline (T-04-13).
//
// CARBON MIGRATION (Phase 6): Carbon has no chat-bubble primitive, so the bubble
// shape stays a custom CSS Module (per plan context) — but it now uses Carbon's
// color/spacing/radius THEME TOKENS instead of Tailwind utility classes
// (bg-blue-600 / bg-gray-100). The decline bubble shares the EXACT same assistant
// bubble class as grounded (`.assistantBubble`) minus the citation list — no new
// red/warning styling for decline (Decline-as-Valid-Response).
//
// Answer/label strings are rendered as React text children (auto-escaped), never
// via dangerouslySetInnerHTML (T-04-15 XSS). Status words inside `content` are
// rendered VERBATIM from the model — the system prompt already enforces the exact
// StatusBadge words, so this bubble does NOT re-derive or paraphrase them.
// =============================================================================

export interface MessageBubbleProps {
  role: 'USER' | 'ASSISTANT';
  content: string;
  citations: Citation[];
  outcome: 'grounded' | 'decline';
}

export function MessageBubble({ role, content, citations, outcome }: MessageBubbleProps) {
  if (role === 'USER') {
    return (
      <div className={styles.userRow} data-testid="message-user">
        <div className={styles.userBubble}>{content}</div>
      </div>
    );
  }

  // ASSISTANT — left-aligned, highest-contrast answer text. The decline shares
  // the grounded styling MINUS pills (neutral, never an error treatment).
  return (
    <div
      className={styles.assistantRow}
      data-testid="message-assistant"
      data-outcome={outcome}
    >
      <div className={styles.assistantBubble}>
        {/* Answer text — rendered verbatim, auto-escaped, highest contrast. */}
        <p className={styles.answerText}>{content}</p>

        {/* Grounded answers carry their citation pills inline, in order. A
            decline renders NO pills (zero citations) — the distinguishing mark
            between the two outcomes. */}
        {outcome === 'grounded' && citations.length > 0 && (
          <div className={styles.citationList} data-testid="citation-list">
            {citations.map((c) => (
              <CitationPill key={`${c.recordType}:${c.recordId}`} citation={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
