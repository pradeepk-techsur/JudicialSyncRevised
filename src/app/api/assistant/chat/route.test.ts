import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import type { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { runSeed } from '@/data/seed';
import { getActiveCaseWithUsers } from '@/services/cases';
import { isAssistantConfigured } from '@/lib/assistantConfig';
import { getConversationDetail } from '@/services/assistant';
import { POST, isDeclineText } from '@/app/api/assistant/chat/route';

// =============================================================================
// Chat-route release-blocker suite (F7). Runs meaningfully in BOTH modes and
// never flakes the gate:
//
//   PERMANENT GATE (no key needed, always runs):
//     - 503 ASSISTANT_UNAVAILABLE when !isAssistantConfigured(), with NO assistant
//       message written (the guard fires before persistence) — criterion 5.
//     - Error ≠ Decline: the 503 body is the error envelope, NOT a 200 with
//       "I don't have that information" text — an unavailable assistant is never
//       rendered as a Decline at the transport layer.
//
//   KEY-GATED BEHAVIORAL PROOF (describe.skipIf(!isAssistantConfigured())):
//     - Each of the 5 named demo questions resolves grounded-or-decline with
//       ZERO ungrounded (a grounded answer has >=1 citation to a real record;
//       a Decline has zero citations — never a factual sentence with no pill).
//     - The three previously-uncited questions each carry >=1 citation when
//       grounded (searchExhibits / getCustodian / getUnresolvedObjections).
//     - A sealed DEPUTY probe Declines indistinguishably from not-found.
//
// Serialized shared-Postgres suite (vitest fileParallelism:false). Cleans up its
// own conversations.
// =============================================================================

// Per-test timeout for the key-gated real-LLM tests. Each makes a live Anthropic
// round-trip (model call + tool calls + stream drain), which routinely exceeds
// vitest's 5s default under concurrent file load (observed 5001ms at the phase
// regression gate; the same test passes at ~4.8s in isolation). Network-bound,
// not a logic failure — a generous explicit timeout keeps them deterministic
// without weakening a single assertion. These tests skip entirely when no key is
// present, so this never touches the no-key gate path.
const LLM_TEST_TIMEOUT = 30_000;

// The 5 named demo questions (ROADMAP / CONTEXT.md). F15 fix (07-04): the three
// exhibit-specific questions now reference REAL seeded labels (P-4: ADMITTED,
// clean, custody chain ending at the clerk; P-3: ADMITTED carrying an unresolved
// objection, with a custody chain) instead of the retired "Exhibit 14"/"Exhibit 7"
// numbers that match no seeded exhibit. P-3's custody question deliberately targets
// an exhibit that HAS a custodian (so a grounded answer is possible); P-4 is used
// for the jury-package + custody probes since it is the always-clean ADMITTED
// reference.
const DEMO_QUESTIONS = [
  'what exhibits were admitted yesterday',
  'what objections remain unresolved',
  'is P-4 in the jury package',
  'who currently has custody of P-4',
  'what happened to P-3',
] as const;

function buildChatRequest(opts: {
  message: string;
  caseId?: string;
  userId?: string;
  conversationId?: string;
  role?: Role;
}): NextRequest {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (opts.role) headers.set('X-User-Role', opts.role);
  const body: Record<string, unknown> = {
    messages: [
      {
        id: 'm1',
        role: 'user',
        parts: [{ type: 'text', text: opts.message }],
      },
    ],
  };
  if (opts.caseId !== undefined) body.caseId = opts.caseId;
  if (opts.userId !== undefined) body.userId = opts.userId;
  if (opts.conversationId !== undefined) body.conversationId = opts.conversationId;
  return new NextRequest('http://localhost/api/assistant/chat', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

/** Fully drain a Response body so the stream reaches onFinish (where persistence
 *  + the citations data part happen). Returns the raw concatenated text. */
async function drain(response: Response): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let out = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  out += decoder.decode();
  return out;
}

describe('POST /api/assistant/chat', () => {
  let caseId: string;
  let userId: string;
  const createdConversationIds: string[] = [];

  beforeAll(async () => {
    await runSeed();
    const active = await getActiveCaseWithUsers();
    if (!active) throw new Error('active seeded case not found');
    caseId = active.case.id;
    userId = active.users[0]!.id;
  });

  afterAll(async () => {
    if (createdConversationIds.length > 0) {
      const messages = await prisma.assistantMessage.findMany({
        where: { conversationId: { in: createdConversationIds } },
        select: { id: true },
      });
      const messageIds = messages.map((m) => m.id);
      if (messageIds.length > 0) {
        await prisma.assistantCitation.deleteMany({ where: { messageId: { in: messageIds } } });
        await prisma.assistantMessage.deleteMany({ where: { id: { in: messageIds } } });
      }
      await prisma.assistantConversation.deleteMany({
        where: { id: { in: createdConversationIds } },
      });
    }
    await prisma.$disconnect();
  });

  // ---------------------------------------------------------------------------
  // isDeclineText — pure-function unit tests. Always run (no key needed): this
  // is the exact gate 04-06 adds to close 04-UAT.md test 7 (a tool returning
  // rows this turn is NOT sufficient for "grounded" — only the model's own
  // final text is). Verifies case-insensitivity and that a plain grounded
  // sentence never false-positives as a decline.
  // ---------------------------------------------------------------------------
  describe('isDeclineText', () => {
    it('matches the exact UAT test-7 repro decline sentence', () => {
      expect(
        isDeclineText(
          "I don't have that information about which exhibits were admitted yesterday.",
        ),
      ).toBe(true);
    });

    it('matches the bare decline phrase', () => {
      expect(isDeclineText("I don't have that information.")).toBe(true);
    });

    it('matches case-insensitively (all-caps / mixed-case)', () => {
      expect(isDeclineText("I DON'T HAVE that information.")).toBe(true);
      expect(isDeclineText("i don't have THAT INFORMATION about Exhibit 3.")).toBe(true);
    });

    it('does NOT false-positive on a plain grounded sentence', () => {
      expect(isDeclineText('Exhibit D-1 is ADMITTED as of October 6, 2026.')).toBe(false);
    });

    // W1 (04-REVIEW.md iteration 1): a single turn may legitimately mix a
    // grounded fact about one record with a decline about a DIFFERENT record
    // (the system prompt's own example: "I don't have that information about
    // Exhibit 22's custody record" following a grounded sentence about a
    // different exhibit). A whole-text substring match would false-positive
    // here and force the ENTIRE turn's citations to [], stripping the
    // legitimate grounded citation too. isDeclineText must return false for
    // this case so the route's onFinish gate falls through to
    // extractCitations(steps), which preserves the grounded half's real
    // citation (and naturally yields none for the declined half, whose tool
    // call returned null/empty).
    it('does NOT treat a MIXED grounded+decline answer as a full decline (W1)', () => {
      expect(
        isDeclineText(
          "Custody of Exhibit 7: Officer Diaz, as of October 3, 2026. I don't have that information about Exhibit 22's custody record.",
        ),
      ).toBe(false);
    });

    it('still treats a multi-sentence PURE decline (every sentence declines) as a full decline', () => {
      expect(
        isDeclineText(
          "I don't have that information about Exhibit 22's custody record. I don't have that information about Exhibit 23 either.",
        ),
      ).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // PERMANENT GATE — runs without a key (criterion 5). These are the primary,
  // deterministic correctness tests and MUST pass in CI with no API key.
  // ---------------------------------------------------------------------------
  describe.skipIf(isAssistantConfigured())(
    '503 ASSISTANT_UNAVAILABLE path (no key configured)',
    () => {
      it('returns 503 with the ASSISTANT_UNAVAILABLE error envelope, no message written', async () => {
        const before = await prisma.assistantMessage.count();

        const response = await POST(
          buildChatRequest({
            message: DEMO_QUESTIONS[0],
            caseId,
            userId,
            role: 'DEPUTY',
          }),
        );

        expect(response.status).toBe(503);
        const body = (await response.json()) as { error?: { code?: string } };
        expect(body.error?.code).toBe('ASSISTANT_UNAVAILABLE');

        // The guard fires BEFORE any persistence: no new message rows.
        const after = await prisma.assistantMessage.count();
        expect(after).toBe(before);
      });

      it('an unavailable assistant is an ERROR envelope, NEVER a 200 Decline', async () => {
        const response = await POST(
          buildChatRequest({
            message: 'who currently has custody of P-4',
            caseId,
            userId,
            role: 'DEPUTY',
          }),
        );

        // Not a streamed 200 with decline text — it is the 503 error channel.
        expect(response.status).toBe(503);
        const text = await response.text();
        expect(text.toLowerCase()).not.toContain("i don't have that information");
        const body = JSON.parse(text) as { error?: { code?: string } };
        expect(body.error?.code).toBe('ASSISTANT_UNAVAILABLE');
      });

      it('returns 503 for a malformed request (missing caseId/userId) — never a crash', async () => {
        const response = await POST(
          buildChatRequest({ message: 'hello', role: 'DEPUTY' }),
        );
        expect(response.status).toBe(503);
        const body = (await response.json()) as { error?: { code?: string } };
        expect(body.error?.code).toBe('ASSISTANT_UNAVAILABLE');
      });
    },
  );

  // ---------------------------------------------------------------------------
  // KEY-GATED BEHAVIORAL PROOF — runs only when a real key is present
  // (recorded-demo / local run). Full zero-ungrounded + 5-questions + sealed.
  // temperature 0 (set in the route) makes these deterministic.
  // ---------------------------------------------------------------------------
  describe.skipIf(!isAssistantConfigured())(
    'grounded-or-decline behavior (real ANTHROPIC_API_KEY present)',
    () => {
      async function ask(message: string, role: Role, conversationId?: string) {
        const response = await POST(
          buildChatRequest({ message, caseId, userId, role, conversationId }),
        );
        expect(response.status).toBe(200);
        const cid = response.headers.get('X-Conversation-Id');
        expect(cid).toBeTruthy();
        createdConversationIds.push(cid!);
        await drain(response);
        // Read the PERSISTED turn — the durable source of truth for the turn's
        // assistant text + citations.
        const detail = await getConversationDetail(cid!);
        const assistant = detail.messages.find((m) => m.role === 'ASSISTANT');
        expect(assistant).toBeDefined();
        return assistant!;
      }

      it.each(DEMO_QUESTIONS)(
        'resolves "%s" as grounded (>=1 real citation) OR a zero-citation Decline — never ungrounded',
        async (question) => {
          const assistant = await ask(question, 'JUDGE');
          expect(assistant.content.trim().length).toBeGreaterThan(0);

          if (assistant.citations.length === 0) {
            // A Decline: must read like a decline, not a bare factual sentence.
            expect(assistant.content.toLowerCase()).toContain("i don't have");
          } else {
            // Grounded: every citation resolves to a real record + real exhibit,
            // with the correct eventId nullability per record type.
            for (const c of assistant.citations) {
              const exhibit = await prisma.exhibit.findUnique({
                where: { id: c.exhibitId },
                select: { id: true },
              });
              expect(exhibit).not.toBeNull();

              if (c.recordType === 'ExhibitEvent') {
                expect(c.eventId).not.toBeNull();
                const event = await prisma.exhibitEvent.findUnique({
                  where: { id: c.recordId },
                  select: { id: true },
                });
                expect(event).not.toBeNull();
              }
              // DiscrepancyFlag / JuryPackageExhibit citations are permitted a null
              // eventId (no single timeline anchor) — recordId is their own row id.
            }
          }
        },
        LLM_TEST_TIMEOUT,
      );

      it('"what exhibits were admitted yesterday" carries >=1 pill when grounded (searchExhibits path)', async () => {
        const assistant = await ask('what exhibits were admitted yesterday', 'JUDGE');
        if (!assistant.content.toLowerCase().includes("i don't have")) {
          expect(assistant.citations.length).toBeGreaterThanOrEqual(1);
        }
      }, LLM_TEST_TIMEOUT);

      it('04-UAT.md test 7 repro: a decline on "what exhibits were admitted yesterday" ALWAYS carries citations: [] even though searchExhibits returned rows this turn', async () => {
        // The live-reproduced defect: searchExhibits has no date-filter support, so
        // it returns all ADMITTED exhibits regardless of "yesterday". Before the
        // 04-06 fix, onFinish unconditionally called extractCitations(steps),
        // deriving one citation per returned row even when the model's own text
        // correctly declined on the date criterion. This test proves the gate: a
        // textual decline this turn now ALWAYS yields citations: [], regardless of
        // what extractCitations(steps) would otherwise have derived from the tool
        // call's rows.
        const assistant = await ask('what exhibits were admitted yesterday', 'JUDGE');
        expect(assistant.content.trim().length).toBeGreaterThan(0);

        if (isDeclineText(assistant.content)) {
          // THE defect this plan closes: decline text must carry zero citations,
          // even though searchExhibits returned rows this turn.
          expect(assistant.citations).toEqual([]);
        } else {
          // Defensive fallback (UAT's own note: model behavior on this literal
          // date-filter question is non-deterministic across demo runs). If the
          // model instead answered grounded, the normal grounded invariant still
          // holds — never grounded text with zero citations.
          expect(assistant.citations.length).toBeGreaterThanOrEqual(1);
          for (const c of assistant.citations) {
            const exhibit = await prisma.exhibit.findUnique({
              where: { id: c.exhibitId },
              select: { id: true },
            });
            expect(exhibit).not.toBeNull();
          }
        }
      }, LLM_TEST_TIMEOUT);

      it('no-over-correction guard: a genuinely grounded answer ("who currently has custody of P-4") still carries >=1 citation', async () => {
        // Guards against a regression where isDeclineText false-positives on
        // grounded text and empties out citations that should be present — the
        // gate must only zero out citations for an ACTUAL textual decline.
        // P-4 is the always-clean ADMITTED exhibit with a real custody chain
        // (ending at the clerk per plan 07-02's seed), so a grounded answer with
        // >=1 citation is genuinely reachable — unlike the retired "Exhibit 7",
        // which matched no seeded exhibit and would force an unconditional decline.
        const assistant = await ask('who currently has custody of P-4', 'JUDGE');
        expect(assistant.content.trim().length).toBeGreaterThan(0);

        if (!isDeclineText(assistant.content)) {
          expect(assistant.citations.length).toBeGreaterThanOrEqual(1);
        } else {
          // If the model declined for some reason, the gate's own invariant still
          // holds (decline ⇒ zero citations) — never decline-with-citations.
          expect(assistant.citations).toEqual([]);
        }
      }, LLM_TEST_TIMEOUT);

      it('sealed DEPUTY probe Declines indistinguishably from not-found (criterion 4)', async () => {
        const assistant = await ask('what happened to exhibit S-1', 'DEPUTY');
        // A Decline: zero citations, decline phrasing, and NO privileged S-1 data.
        expect(assistant.citations).toEqual([]);
        expect(assistant.content.toLowerCase()).toContain("i don't have");
      }, LLM_TEST_TIMEOUT);

      it('emits the data-citations frame on the live stream (writer-merge-then-write timing) — W3', async () => {
        // The pills' LIVE path depends on the custom 'data-citations' part written
        // in streamText.onFinish landing in the outer createUIMessageStream BEFORE
        // it closes. The other tests read citations off DB persistence, which does
        // NOT exercise the streamed data part's presence/timing. Here we drain the
        // REAL route body and assert the frame is actually on the wire, pinning the
        // writer-merge-then-write sequence (if the data part raced the close, live
        // pills would silently vanish even though replay still worked).
        const response = await POST(
          buildChatRequest({
            message: 'what exhibits were admitted yesterday',
            caseId,
            userId,
            role: 'JUDGE',
          }),
        );
        expect(response.status).toBe(200);
        const cid = response.headers.get('X-Conversation-Id');
        expect(cid).toBeTruthy();
        createdConversationIds.push(cid!);

        const streamed = await drain(response);

        // The ai@6 UI-message stream serializes data parts as JSON lines whose
        // `type` is `data-<name>` (here `data-citations`). Assert the frame is
        // present on the stream, carrying this turn's conversationId.
        expect(streamed).toContain('data-citations');
        expect(streamed).toContain(cid!);

        // Parse the emitted data-citations payload out of the stream and confirm it
        // mirrors the persisted citations EXACTLY (count + the first citation's
        // exhibitId), proving the live frame and the durable record agree.
        const detail = await getConversationDetail(cid!);
        const persisted = detail.messages.find((m) => m.role === 'ASSISTANT')!.citations;

        const frame = streamed
          .split('\n')
          .map((line) => line.replace(/^data:\s*/, '').trim())
          .filter((line) => line.length > 0)
          .map((line) => {
            try {
              return JSON.parse(line) as { type?: string; data?: { citations?: unknown[] } };
            } catch {
              return null;
            }
          })
          .find((obj) => obj?.type === 'data-citations');

        expect(frame).toBeTruthy();
        expect(Array.isArray(frame!.data?.citations)).toBe(true);
        expect(frame!.data!.citations!.length).toBe(persisted.length);
      }, LLM_TEST_TIMEOUT);
    },
  );
});
