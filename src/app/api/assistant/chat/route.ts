import type { NextRequest } from 'next/server';
import {
  streamText,
  stepCountIs,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

import { ANTHROPIC_MODEL, ASSISTANT_TEMPERATURE, isAssistantConfigured } from '@/lib/assistantConfig';
import { buildAssistantToolSet } from '@/lib/assistant/tools';
import { buildSystemPrompt } from '@/lib/assistant/systemPrompt';
import { parseRequestingRole } from '@/services/visibility';
import { AssistantUnavailableError } from '@/lib/errors';
import { errorResponse } from '@/lib/apiError';
import {
  resolveConversationId,
  persistTurn,
  type Citation,
  type CitationInput,
} from '@/services/assistant';

// =============================================================================
// POST /api/assistant/chat — the streaming Pivota Assistant chat endpoint (F7).
// =============================================================================
//
// This route is thin orchestration over 04-02's tool set + cite-or-decline
// prompt and 04-01's config/error layer. It enforces the three release-blocker
// guarantees:
//   - NEVER ungrounded: every grounded claim gets a persisted citation extracted
//     from THIS turn's tool results (criteria 1/2).
//   - Error ≠ Decline: a missing key or provider/transport failure surfaces on
//     the 503 ASSISTANT_UNAVAILABLE channel, NEVER as streamed assistant text
//     (criterion 5). A Decline is ONLY ever the model's own grounded-fallback text.
//   - Missing key → 503 BEFORE any LLM call or DB write (criterion 5).
//
// =============================================================================
// THE CLIENT↔SERVER WIRE CONTRACT (this route is the SINGLE SOURCE OF TRUTH —
// 04-04's hook and 04-05's UI + E2E mock are BOUND to exactly this shape):
// =============================================================================
//
// REQUEST (what useChat POSTs, shaped via DefaultChatTransport on the client):
//   - Body: { messages: UIMessage[], caseId: string, userId: string,
//             conversationId?: string }
//       * `messages` is the useChat UI-message array; the latest user message's
//         text is the question. 04-04 threads caseId/userId/conversationId via
//         the transport's `body`.
//   - Header: `X-User-Role: <Role>` — the demo's role (same header every other
//     route reads via parseRequestingRole; fail-closed to ATTORNEY). The role is
//     NEVER taken from the body (T-04-08 role-spoofing defense).
//
// RESPONSE (ai@6 UI-message stream via toUIMessageStreamResponse()):
//   - Header: `X-Conversation-Id: <uuid>` — the conversation id (freshly created
//     on first message, or echoed back). The client captures this into its
//     zustand session so subsequent turns reuse the thread.
//   - Stream body: the standard ai@6 UI-message stream. Citations for the turn
//     are carried as a custom DATA PART written in onFinish:
//         { type: 'data-citations', data: { conversationId, citations: Citation[] } }
//     where each Citation is
//         { recordType, recordId, exhibitId, eventId, timestamp, label }
//     (04-04 reads message.parts for the 'data-citations' part; 04-05 mocks it).
//     A Decline carries `citations: []`.
//
// Persistence happens in onFinish: the user message, the assistant's final text,
// and the extracted citations are written atomically via persistTurn. The stream
// is NOT required to reach the client for persistence — onFinish fires once the
// model+tools complete, which is also what the integration tests drain.
//
// =============================================================================

export const runtime = 'nodejs';

/** Abort the model call after this long; a timeout trips ASSISTANT_UNAVAILABLE
 *  on the error channel rather than hanging the request (criterion 5). */
const ASSISTANT_TIMEOUT_MS = 20_000;

/** Max agentic steps: enough for the model to call one-or-more tools and then
 *  compose the grounded answer. stopWhen is ai@6's multi-step control (04-01). */
const MAX_STEPS = 6;

interface ChatRequestBody {
  messages?: UIMessage[];
  caseId?: string;
  userId?: string;
  conversationId?: string;
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    // 1. Parse the request envelope. The role ALWAYS comes from the header
    //    (never the body) so the model/client cannot spoof it (T-04-08).
    const role = parseRequestingRole(request);
    const body = (await request.json()) as ChatRequestBody;
    const { messages, caseId, userId } = body;

    if (!caseId || !userId || !Array.isArray(messages) || messages.length === 0) {
      return errorResponse(
        new AssistantUnavailableError(
          'A chat request requires caseId, userId, and at least one message',
        ),
      );
    }

    // 2. 503 GUARD FIRST (criterion 5): if the assistant is not configured, return
    //    503 ASSISTANT_UNAVAILABLE BEFORE any LLM call or DB write. The app itself
    //    boots fine without a key (04-01); only this route gates on it.
    if (!isAssistantConfigured()) {
      return errorResponse(new AssistantUnavailableError());
    }

    // 3. Conversation: resolve the thread to persist against BEFORE the LLM call.
    //    A supplied conversationId is reused ONLY if it exists and belongs to this
    //    case+user; otherwise (absent, stale, or spoofed) a FRESH conversation is
    //    created. This moves validation ahead of the model run so a stale id can
    //    never FK-crash inside onFinish and lose the turn (W2), and keeps the
    //    no-orphan-conversation rule (a conversation only exists once a turn is
    //    about to persist). Capture the id to return via a response header so the
    //    client can hold it in zustand.
    const conversationId = await resolveConversationId(body.conversationId, caseId, userId);

    // 4. Derive the latest user message's text for persistence (the model reads
    //    the full converted message array; persistTurn stores just this turn's
    //    user text). convertToModelMessages is async in ai@6.
    const userMessage = latestUserText(messages);
    const modelMessages = await convertToModelMessages(messages);

    // 5. Build the UI-message stream. createUIMessageStream gives us a WRITER so
    //    we can both (a) merge the model's streamed text/tool chunks AND (b) write
    //    the extracted citations as a custom 'data-citations' data part — the wire
    //    contract 04-04/04-05 bind to. streamText runs inside execute(); its
    //    onFinish extracts THIS turn's citations, persists the turn atomically,
    //    and writes the citations data part so the UI renders pills without a
    //    second fetch.
    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        const result = streamText({
          model: anthropic(ANTHROPIC_MODEL),
          temperature: ASSISTANT_TEMPERATURE,
          system: buildSystemPrompt(role),
          tools: buildAssistantToolSet({ caseId, requestingUserRole: role }),
          messages: modelMessages,
          stopWhen: stepCountIs(MAX_STEPS),
          abortSignal: AbortSignal.timeout(ASSISTANT_TIMEOUT_MS),
          // 6. ERROR ≠ DECLINE (criterion 5): a provider/transport error must
          //    NEVER become streamed assistant text. onError here plus the
          //    createUIMessageStream onError below route failures to the stream's
          //    ERROR channel (a fixed code), never a token. Pre-stream failures are
          //    caught by the outer try/catch → HTTP 503.
          onError: ({ error }) => {
            void error;
          },
          // 7. CITATION EXTRACTION + PERSISTENCE (criterion 2): once the model +
          //    tools finish, walk THIS turn's tool results, derive the citations,
          //    persist the turn atomically, and emit the citations data part. A
          //    grounded answer from ANY citation-producing tool yields >=1
          //    citation; a Decline yields [] (persisted as a valid zero-citation
          //    assistant message).
          onFinish: async ({ text, steps }) => {
            // Gate citation extraction on the model's own final text (criterion 2 /
            // 04-UAT.md test 7 fix): a tool returning rows this turn is NOT sufficient
            // for "grounded" — only the model's text actually asserting a fact grounded
            // in those rows is. A textual Decline ALWAYS persists/streams citations: [],
            // regardless of what extractCitations(steps) would otherwise derive, so the
            // client's citations.length-keyed outcome classifier (04-04) never shows
            // pills on a declining answer.
            const citations = isDeclineText(text) ? [] : extractCitations(steps);
            try {
              // Persist first so the thread is durable even if the client dropped.
              await persistTurn({
                conversationId,
                userMessage,
                assistantContent: text,
                citations,
              });
            } catch (persistError) {
              // A persistence failure inside onFinish (e.g. an unexpected DB/FK
              // error) must NOT reject unhandled in the stream callback. Route it
              // to the createUIMessageStream error channel below so the client sees
              // the stable "temporarily unavailable" notice rather than a silently
              // dropped turn with no feedback (W2). Re-throw: createUIMessageStream's
              // onError maps it to the fixed ASSISTANT_UNAVAILABLE code.
              throw persistError;
            }
            // Then surface them to the live client (with exhibitId/eventId) so the
            // pills render without a second fetch. toCitations maps ISO strings.
            writer.write({
              type: 'data-citations',
              data: {
                conversationId,
                citations: toCitations(citations),
              },
            });
          },
        });

        // Merge the model's streamed chunks into our writer's stream.
        writer.merge(result.toUIMessageStream());
      },
      // The client renders this as the fixed "temporarily unavailable" system
      // notice, NEVER as a Decline (criterion 5 / T-04-09). Emit the stable error
      // CODE only — never the raw provider error (which could echo config).
      onError: (error) => {
        void error;
        return new AssistantUnavailableError().code;
      },
    });

    // 8. Return the SDK's UI-message stream Response. conversationId rides on a
    //    header so the client captures a freshly-created conversation.
    return createUIMessageStreamResponse({
      stream,
      headers: { 'X-Conversation-Id': conversationId },
    });
  } catch (err) {
    // Any failure BEFORE streaming starts (bad body, provider setup error, etc.)
    // becomes an HTTP error on the proper channel. A provider/transport failure
    // here is specifically the 503 ASSISTANT_UNAVAILABLE path (criterion 5) — but
    // we only reach this catch for pre-stream errors; mid-stream errors go to the
    // stream error channel above. Map any non-AppError provider failure to 503.
    if (isLikelyProviderError(err)) {
      return errorResponse(new AssistantUnavailableError());
    }
    return errorResponse(err);
  }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** The system prompt's required decline phrasing (systemPrompt.ts: "respond with
 *  a brief, plain decline of the form 'I don't have that information'"; FRD §F07
 *  line 8/41/67/69 — "I don't have that information" or an equivalent explicit
 *  statement).
 *
 *  CRITICAL (criterion 2 / 04-UAT.md test 7): a tool call returning rows THIS
 *  TURN does not make the answer grounded — only the model's own final text
 *  deciding to state a fact grounded in those rows does. When the model's ENTIRE
 *  text is a Decline (because, e.g., the returned rows don't actually answer the
 *  literal question — no date-filter support in searchExhibits is the proven
 *  repro), citations MUST be forced to [] even though extractCitations(steps)
 *  would otherwise derive one per returned row. This keeps the wire contract's
 *  "a Decline carries citations: []" promise (04-03 SUMMARY) true in EVERY
 *  case, not just the no-tool-call case, which is what 04-04's purely
 *  citations.length-keyed outcome classifier depends on.
 *
 *  WHOLE-ANSWER CHECK (not a bare substring match): the system prompt explicitly
 *  permits a single turn to mix a grounded fact about one record with a decline
 *  about a different record (its own example: "I don't have that information
 *  about Exhibit 22's custody record" read as a sentence that could follow a
 *  grounded sentence about a different exhibit). A naive "does the phrase appear
 *  anywhere in the text" check would force citations: [] on that WHOLE turn,
 *  silently stripping the legitimate citation off the grounded half. So this
 *  checks every sentence of the answer: the text counts as a Decline ONLY when
 *  EVERY sentence contains the decline phrase — i.e. the answer is wholly a
 *  decline, not merely mentions one. A purely grounded answer (no sentence
 *  matches) is unaffected, same as before. A mixed answer (some sentences match,
 *  some don't) is treated as NOT a full decline, so extractCitations(steps) is
 *  used as-is — which already naturally yields no citation for the declined
 *  half (its tool call returned null/empty) while preserving the grounded
 *  half's real citation. */
export function isDeclineText(text: string): boolean {
  const sentences = splitIntoSentences(text);
  if (sentences.length === 0) return false;
  return sentences.every((sentence) => sentenceIsDecline(sentence));
}

function sentenceIsDecline(sentence: string): boolean {
  return sentence.toLowerCase().includes("i don't have that information");
}

/** Naive sentence splitter: break on a sentence-ending punctuation mark followed
 *  by whitespace, keeping the punctuation on the preceding sentence. Good enough
 *  for the model's plain, courtroom-register prose (systemPrompt.ts: "Be
 *  confident, brief, and factual") — this is a heuristic gate, not a full NLP
 *  sentence boundary detector. */
function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Extract the plain text of the latest USER message from a useChat UI-message
 *  array (its text parts concatenated). */
function latestUserText(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === 'user') {
      return textOfUIMessage(m);
    }
  }
  // Fallback: last message of any role.
  const last = messages[messages.length - 1];
  return last ? textOfUIMessage(last) : '';
}

function textOfUIMessage(message: UIMessage): string {
  if (!Array.isArray(message.parts)) return '';
  return message.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('');
}

/** Heuristic: a failure that is NOT one of our typed AppErrors and arose around
 *  the provider call is treated as a transport/availability failure → 503. */
function isLikelyProviderError(err: unknown): boolean {
  if (err instanceof AssistantUnavailableError) return true;
  // AbortError from the timeout, or any provider SDK error (name/message-based),
  // is an availability problem, not a client error.
  if (err instanceof Error) {
    const name = err.name.toLowerCase();
    const msg = err.message.toLowerCase();
    return (
      name.includes('abort') ||
      name.includes('timeout') ||
      msg.includes('timeout') ||
      msg.includes('fetch') ||
      msg.includes('network') ||
      msg.includes('anthropic') ||
      msg.includes('api key') ||
      msg.includes('unauthorized') ||
      msg.includes('401') ||
      msg.includes('403')
    );
  }
  return false;
}

// -----------------------------------------------------------------------------
// Citation extraction — the per-tool mapping (criterion 2).
//
// Every citation-producing tool's result rows are turned into CitationInput[].
// Citations are extracted ONLY from THIS turn's tool results (real recordIds +
// timestamps from the service layer), never model-authored (T-04-10). A grounded
// answer from ANY of these tools yields >=1 citation; a turn with no supporting
// tool records yields [] (the model Declines).
//
// The route knows each tool call's `exhibitId` argument and each result row's
// source event id, so it populates the link fields per record type.
// -----------------------------------------------------------------------------

// Minimal structural step shape we read (ai@6 StepResult): the tool results of
// each step, each with its toolName / input / output. We read defensively with
// `unknown` + narrowing so a shape change never throws inside onFinish.
interface ToolResultLike {
  toolName: string;
  input?: unknown;
  output?: unknown;
}
interface StepLike {
  toolResults?: ToolResultLike[];
}

/** Map persisted CitationInput[] to the client Citation[] shape (ISO strings —
 *  CitationInput already carries ISO `timestamp`, so this is a passthrough that
 *  pins the returned type to the wire-contract Citation shape). */
function toCitations(citations: CitationInput[]): Citation[] {
  return citations.map((c) => ({
    recordType: c.recordType,
    recordId: c.recordId,
    exhibitId: c.exhibitId,
    eventId: c.eventId,
    timestamp: c.timestamp,
    label: c.label,
  }));
}

function extractCitations(steps: ReadonlyArray<StepLike>): CitationInput[] {
  const citations: CitationInput[] = [];
  for (const step of steps) {
    for (const tr of step.toolResults ?? []) {
      citations.push(...citationsForToolResult(tr));
    }
  }
  return citations;
}

function citationsForToolResult(tr: ToolResultLike): CitationInput[] {
  const input = (tr.input ?? {}) as Record<string, unknown>;
  const argExhibitId = typeof input.exhibitId === 'string' ? input.exhibitId : null;
  const out = tr.output;

  switch (tr.toolName) {
    // getExhibitStatus → ExhibitCurrentState → ONE ExhibitEvent citation.
    case 'getExhibitStatus': {
      const s = asRecord(out);
      if (!s) return [];
      const eventId = str(s.lastStatusEventId);
      const exhibitId = str(s.exhibitId) ?? argExhibitId;
      const ts = str(s.lastStatusAt);
      if (!eventId || !exhibitId || !ts) return [];
      return [
        {
          recordType: 'ExhibitEvent',
          recordId: eventId,
          exhibitId,
          eventId,
          timestamp: ts,
          label: `Status: ${str(s.currentStatus) ?? 'UNKNOWN'} · ${fmt(ts)}`,
        },
      ];
    }

    // getCustodian → CustodyCurrentState → ONE ExhibitEvent citation.
    case 'getCustodian': {
      const c = asRecord(out);
      if (!c) return [];
      const eventId = str(c.lastEventId);
      const exhibitId = str(c.exhibitId) ?? argExhibitId;
      const ts = str(c.since);
      if (!eventId || !exhibitId || !ts) return [];
      return [
        {
          recordType: 'ExhibitEvent',
          recordId: eventId,
          exhibitId,
          eventId,
          timestamp: ts,
          label: `Custody since ${fmt(ts)}`,
        },
      ];
    }

    // getCustodyHistory → each entry { …, eventId } → ONE ExhibitEvent citation per entry.
    case 'getCustodyHistory': {
      const arr = asArray(out);
      const exhibitId = argExhibitId;
      if (!exhibitId) return [];
      return arr.flatMap((raw) => {
        const e = asRecord(raw);
        if (!e) return [];
        const eventId = str(e.eventId);
        const ts = str(e.timestamp);
        if (!eventId || !ts) return [];
        return [
          {
            recordType: 'ExhibitEvent' as const,
            recordId: eventId,
            exhibitId,
            eventId,
            timestamp: ts,
            label: `Custody transfer · ${fmt(ts)}`,
          },
        ];
      });
    }

    // getExhibitHistory → each cited timeline[] entry → ONE ExhibitEvent citation.
    case 'getExhibitHistory': {
      const h = asRecord(out);
      if (!h) return [];
      const exhibitRec = asRecord(h.exhibit);
      const exhibitId = str(exhibitRec?.id) ?? argExhibitId;
      if (!exhibitId) return [];
      const timeline = asArray(h.timeline);
      return timeline.flatMap((raw) => {
        const e = asRecord(raw);
        if (!e) return [];
        const eventId = str(e.eventId);
        const ts = str(e.recordedAt);
        if (!eventId || !ts) return [];
        return [
          {
            recordType: 'ExhibitEvent' as const,
            recordId: eventId,
            exhibitId,
            eventId,
            timestamp: ts,
            label: str(e.summary) ?? `Event · ${fmt(ts)}`,
          },
        ];
      });
    }

    // getUnresolvedObjections → each ObjectionCurrentState row → ONE ExhibitEvent
    // citation per listed objection (one pill per listed item).
    case 'getUnresolvedObjections': {
      const arr = asArray(out);
      return arr.flatMap((raw) => {
        const o = asRecord(raw);
        if (!o) return [];
        const eventId = str(o.raisedEventId);
        const exhibitId = str(o.exhibitId);
        const ts = str(o.raisedAt);
        if (!eventId || !exhibitId || !ts) return [];
        return [
          {
            recordType: 'ExhibitEvent' as const,
            recordId: eventId,
            exhibitId,
            eventId,
            timestamp: ts,
            label: `Objection (${str(o.objectingParty) ?? 'party'}) · ${fmt(ts)}`,
          },
        ];
      });
    }

    // getDiscrepancies → each DiscrepancyFlag → ONE DiscrepancyFlag citation per flag.
    // (eventId null — a flag has no single timeline event; the pill lands at
    // top-of-timeline for the exhibit.)
    case 'getDiscrepancies': {
      const arr = asArray(out);
      return arr.flatMap((raw) => {
        const f = asRecord(raw);
        if (!f) return [];
        const recordId = str(f.id);
        const exhibitId = str(f.exhibitId);
        const ts = str(f.detectedAt);
        if (!recordId || !exhibitId || !ts) return [];
        return [
          {
            recordType: 'DiscrepancyFlag' as const,
            recordId,
            exhibitId,
            eventId: null,
            timestamp: ts,
            label: `Discrepancy: ${str(f.ruleCode) ?? 'flag'}`,
          },
        ];
      });
    }

    // getJuryPackageStatus → each JuryPackageExhibit row → ONE JuryPackageExhibit
    // citation per row. (eventId null — a membership row has no timeline event.)
    case 'getJuryPackageStatus': {
      const pkg = asRecord(out);
      if (!pkg) return [];
      const rows = asArray(pkg.exhibits);
      return rows.flatMap((raw) => {
        const r = asRecord(raw);
        if (!r) return [];
        const recordId = str(r.id) ?? str(r.exhibitId);
        const exhibitId = str(r.exhibitId);
        const ts = str(r.addedAt);
        if (!recordId || !exhibitId || !ts) return [];
        return [
          {
            recordType: 'JuryPackageExhibit' as const,
            recordId,
            exhibitId,
            eventId: null,
            timestamp: ts,
            label: `Jury package: ${str(r.exhibitLabel) ?? exhibitId}`,
          },
        ];
      });
    }

    // searchExhibits → each ExhibitListRow (widened with lastStatusEventId/
    // lastStatusAt in the tool) → ONE ExhibitEvent citation per row. A row whose
    // exhibit has no status yet (null event id) is skipped — it has no anchor.
    case 'searchExhibits': {
      const arr = asArray(out);
      return arr.flatMap((raw) => {
        const r = asRecord(raw);
        if (!r) return [];
        const eventId = str(r.lastStatusEventId);
        const exhibitId = str(r.exhibitId);
        const ts = str(r.lastStatusAt);
        if (!eventId || !exhibitId || !ts) return [];
        return [
          {
            recordType: 'ExhibitEvent' as const,
            recordId: eventId,
            exhibitId,
            eventId,
            timestamp: ts,
            label: `${str(r.exhibitLabel) ?? 'Exhibit'} · ${str(r.currentStatus) ?? ''}`.trim(),
          },
        ];
      });
    }

    default:
      return [];
  }
}

// --- tiny defensive readers ---

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function str(v: unknown): string | null {
  if (typeof v === 'string') return v;
  if (v instanceof Date) return v.toISOString();
  return null;
}

/** Best-effort short date for a citation label; falls back to the raw ISO. */
function fmt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
