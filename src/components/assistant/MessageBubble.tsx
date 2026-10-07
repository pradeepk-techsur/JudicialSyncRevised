'use client';

import type { Citation } from '@/hooks/useAssistantChat';
import { CitationPill } from './CitationPill';

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
// rendered as a distinct system notice by AssistantThread. An error is never a
// decline (T-04-13).
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
      <div className="flex justify-end" data-testid="message-user">
        <div className="max-w-[80%] rounded-lg bg-blue-600 px-3 py-2 text-sm text-white">
          {content}
        </div>
      </div>
    );
  }

  // ASSISTANT — left-aligned, highest-contrast answer text. The decline shares
  // the grounded styling MINUS pills (neutral, never an error treatment).
  return (
    <div
      className="flex justify-start"
      data-testid="message-assistant"
      data-outcome={outcome}
    >
      <div className="max-w-[80%] rounded-lg bg-gray-100 px-3 py-2">
        {/* Answer text — rendered verbatim, auto-escaped, highest contrast. */}
        <p className="whitespace-pre-wrap text-sm text-gray-900">{content}</p>

        {/* Grounded answers carry their citation pills inline, in order. A
            decline renders NO pills (zero citations) — the distinguishing mark
            between the two outcomes. */}
        {outcome === 'grounded' && citations.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1" data-testid="citation-list">
            {citations.map((c) => (
              <CitationPill key={`${c.recordType}:${c.recordId}`} citation={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
