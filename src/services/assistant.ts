import type { AssistantConversation, MessageRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { NotFoundError } from '@/lib/errors';

// =============================================================================
// Pivota Assistant persistence service (F7) — the SINGLE writer of the three
// assistant tables (AssistantConversation / AssistantMessage / AssistantCitation).
// =============================================================================
//
// SINGLE-WRITER DISCIPLINE (mirrors recordEvent's single-ledger-writer chokepoint,
// STATE.md 01-02): this module is the ONLY place that creates assistant
// conversations/messages/citations. The chat route (04-03) and the GET replay
// endpoint go through these three functions and nowhere else touches the tables.
// Keep this a PURE service — no Next types, no request parsing; the route layer
// owns HTTP concerns and the model owns answer composition.
//
// THE ZERO-CITATION INVARIANT (criteria 2/3): an assistant message with ZERO
// citations is valid ONLY when its content is a Decline ("I don't have that
// information"). This function does NOT itself judge decline-ness — the MODEL
// decides, and the route extracts citations from THIS turn's tool results. What
// persistTurn guarantees is FAITHFUL persistence: it writes exactly the citations
// it is given, so a grounded answer (whose route-extracted citations are non-empty)
// always lands >=1 citation row, and a Decline (route passes []) persists with
// zero rows. The decline-vs-grounded classification therefore survives a GET
// replay: a replayed message with zero citations was a Decline, one with >=1 was
// grounded.

// -----------------------------------------------------------------------------
// Citation shapes. The additive `exhibitId` (required) + `eventId` (nullable)
// link fields (04-01 columns) make the pill deep-link a FIRST-CLASS part of the
// citation, so a citation replayed via GET /conversations/:id navigates exactly
// like a fresh-stream one (to /exhibit/:exhibitId?event=:eventId).
// -----------------------------------------------------------------------------

/** The record kinds a citation can point at (TechArch 03-api.md §4.10). */
export type CitationRecordType = 'ExhibitEvent' | 'DiscrepancyFlag' | 'JuryPackageExhibit';

/**
 * A citation as handed to `persistTurn` by the chat route's extraction step.
 * `timestamp` is an ISO string here (the route derives it from tool-result
 * timestamps); persistTurn parses it into the DateTime column.
 */
export interface CitationInput {
  recordType: CitationRecordType;
  recordId: string;
  exhibitId: string; // ADDITIVE (04-01): pill deep-link target exhibit (required)
  eventId: string | null; // ADDITIVE (04-01): timeline anchor; null for types with no single event
  timestamp: string; // ISO
  label: string;
}

/**
 * A citation as RETURNED to a client (fresh stream or GET replay). Identical
 * field set to CitationInput — carrying exhibitId + eventId so the replayed pill
 * links exactly like the fresh-stream one. `timestamp` is an ISO string.
 */
export interface Citation {
  recordType: CitationRecordType;
  recordId: string;
  exhibitId: string;
  eventId: string | null;
  timestamp: string;
  label: string;
}

/** Full conversation replay shape returned by getConversationDetail. */
export interface ConversationDetail {
  conversation: { id: string; caseId: string; userId: string; startedAt: string };
  messages: Array<{
    id: string;
    role: 'USER' | 'ASSISTANT';
    content: string;
    createdAt: string;
    citations: Citation[];
  }>;
}

/**
 * Create a new conversation. A plain insert. Called by the chat route on the
 * FIRST message of a thread when no conversationId is supplied — so there are no
 * empty orphan conversations (CONTEXT.md): a conversation only exists once a
 * message is about to be persisted for it.
 */
export async function createConversation(
  caseId: string,
  userId: string,
): Promise<AssistantConversation> {
  return prisma.assistantConversation.create({
    data: { caseId, userId },
  });
}

/**
 * Persist one full turn — the user's message, the assistant's reply, and the
 * reply's citations — ATOMICALLY in one transaction, so a crash can never leave a
 * grounded answer with no citation rows (or an assistant message with no matching
 * user message). The citation rows point at the ASSISTANT message id.
 *
 * Each citation row persists `exhibitId` (required) and `eventId` (nullable)
 * alongside recordType/recordId/timestamp/label (the 04-01 columns), so the
 * deep-link target survives a GET replay.
 *
 * Zero-citation invariant: `citations` is `[]` ONLY for a Decline; persistTurn
 * does not enforce this (it cannot judge the content — the model/route does) but
 * it persists the array faithfully, which is what makes a grounded answer always
 * land >=1 citation row (criterion 2).
 */
export async function persistTurn(args: {
  conversationId: string;
  userMessage: string;
  assistantContent: string;
  citations: CitationInput[];
}): Promise<void> {
  const { conversationId, userMessage, assistantContent, citations } = args;

  await prisma.$transaction(async (tx) => {
    // USER message first. Both rows of this turn share an identical created_at
    // (the transaction's CURRENT_TIMESTAMP), so created_at cannot order them —
    // the explicit `seq` (0 for USER, 1 for ASSISTANT) is the deterministic
    // tiebreaker the replay orders by, guaranteeing the question renders above
    // the answer.
    await tx.assistantMessage.create({
      data: {
        conversationId,
        role: 'USER' as MessageRole,
        content: userMessage,
        seq: 0,
      },
    });

    // ASSISTANT message, with its citations nested so the rows are created in the
    // SAME statement pointing at this message's id. A Decline passes [] here and
    // persists with zero citation rows (valid). A grounded answer persists >=1.
    await tx.assistantMessage.create({
      data: {
        conversationId,
        role: 'ASSISTANT' as MessageRole,
        content: assistantContent,
        seq: 1,
        citations: {
          create: citations.map((c) => ({
            recordType: c.recordType,
            recordId: c.recordId,
            exhibitId: c.exhibitId,
            eventId: c.eventId,
            timestamp: new Date(c.timestamp),
            label: c.label,
          })),
        },
      },
    });
  });
}

/**
 * Replay a full conversation thread: all messages ordered oldest-first, each with
 * its citations attached. Throws NotFoundError CONVERSATION_NOT_FOUND (→ route
 * 404, Y2-errors.md) when the id does not resolve.
 *
 * Every returned citation carries `exhibitId` + `eventId` so a replayed pill
 * deep-links exactly like a fresh-stream one; timestamps are mapped back to ISO
 * strings.
 */
export async function getConversationDetail(id: string): Promise<ConversationDetail> {
  const conversation = await prisma.assistantConversation.findUnique({
    where: { id },
    include: {
      messages: {
        // created_at first (chronological across turns), then `seq` as the
        // intra-turn tiebreaker: the two messages of a turn share an identical
        // created_at (same transaction CURRENT_TIMESTAMP), so without `seq` the
        // USER/ASSISTANT order would be undefined and an answer could replay
        // above its question.
        orderBy: [{ createdAt: 'asc' }, { seq: 'asc' }],
        include: { citations: true },
      },
    },
  });

  if (!conversation) {
    throw new NotFoundError('CONVERSATION_NOT_FOUND', 'No conversation found with the given ID');
  }

  return {
    conversation: {
      id: conversation.id,
      caseId: conversation.caseId,
      userId: conversation.userId,
      startedAt: conversation.startedAt.toISOString(),
    },
    messages: conversation.messages.map((m) => ({
      id: m.id,
      role: m.role as 'USER' | 'ASSISTANT',
      content: m.content,
      createdAt: m.createdAt.toISOString(),
      citations: m.citations.map((c) => ({
        recordType: c.recordType as CitationRecordType,
        recordId: c.recordId,
        exhibitId: c.exhibitId,
        eventId: c.eventId,
        timestamp: c.timestamp.toISOString(),
        label: c.label,
      })),
    })),
  };
}
