import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { runSeed } from '@/data/seed';
import { getActiveCaseWithUsers } from '@/services/cases';
import {
  createConversation,
  persistTurn,
  getConversationDetail,
  type CitationInput,
} from '@/services/assistant';

// =============================================================================
// Assistant persistence service integration test (F7).
// =============================================================================
//
// Proves the three persistence guarantees against the real shared Postgres:
//   1. Grounded round-trip: persistTurn writes user + assistant messages and the
//      assistant's citations atomically; getConversationDetail replays both
//      messages in order with citations attached, and the additive exhibitId /
//      eventId link fields round-trip EXACTLY (non-null AND null preserved) so a
//      replayed pill deep-links like a fresh-stream one.
//   2. Decline round-trip: a zero-citation assistant message persists and replays
//      with citations: [] (a valid Decline).
//   3. CONVERSATION_NOT_FOUND: getConversationDetail on an unknown uuid throws the
//      typed NotFoundError (→ route 404).
//
// Serialized shared-Postgres suite (vitest fileParallelism:false). Cleans up its
// own inserted rows in afterAll so it never pollutes the seed-dependent suites.

const NONEXISTENT_UUID = '00000000-0000-0000-0000-000000000000';

describe('assistant persistence service (F7)', () => {
  let caseId: string;
  let userId: string;
  let exhibitAId: string;
  let exhibitBId: string;
  let eventId: string;
  const createdConversationIds: string[] = [];

  beforeAll(async () => {
    await runSeed();
    const active = await getActiveCaseWithUsers();
    if (!active) throw new Error('active seeded case not found');
    caseId = active.case.id;
    userId = active.users[0]!.id;

    // Real exhibit ids + a real event id so the citations point at genuine FK-free
    // string records (the citation columns are plain strings, not FKs, but using
    // real ids keeps the test honest about the shape it persists).
    const exhibits = await prisma.exhibit.findMany({
      where: { caseId },
      select: { id: true },
      orderBy: { exhibitLabel: 'asc' },
      take: 2,
    });
    exhibitAId = exhibits[0]!.id;
    exhibitBId = exhibits[1]?.id ?? exhibits[0]!.id;

    const event = await prisma.exhibitEvent.findFirst({
      where: { exhibitId: exhibitAId },
      select: { id: true },
      orderBy: { sequenceNo: 'asc' },
    });
    eventId = event?.id ?? NONEXISTENT_UUID;
  });

  afterAll(async () => {
    // Cascade-free cleanup in FK order: citations → messages → conversations.
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

  it('round-trips a grounded turn: both messages ordered, citations with exhibitId/eventId preserved', async () => {
    const conversation = await createConversation(caseId, userId);
    createdConversationIds.push(conversation.id);

    // Two citations: an ExhibitEvent (non-null eventId) AND a JuryPackageExhibit
    // (eventId: null) — exercising BOTH the non-null and null link-field paths.
    const citations: CitationInput[] = [
      {
        recordType: 'ExhibitEvent',
        recordId: eventId,
        exhibitId: exhibitAId,
        eventId,
        timestamp: new Date('2026-10-06T12:00:00.000Z').toISOString(),
        label: 'Status: ADMITTED',
      },
      {
        recordType: 'JuryPackageExhibit',
        recordId: 'jpe-row-1',
        exhibitId: exhibitBId,
        eventId: null,
        timestamp: new Date('2026-10-06T13:00:00.000Z').toISOString(),
        label: 'Jury package: Exhibit B',
      },
    ];

    await persistTurn({
      conversationId: conversation.id,
      userMessage: 'what exhibits were admitted yesterday',
      assistantContent: 'Exhibit A is ADMITTED and Exhibit B is in the jury package.',
      citations,
    });

    const detail = await getConversationDetail(conversation.id);

    expect(detail.conversation.id).toBe(conversation.id);
    expect(detail.conversation.caseId).toBe(caseId);
    expect(detail.conversation.userId).toBe(userId);

    // Two messages, USER first then ASSISTANT (chronological).
    expect(detail.messages).toHaveLength(2);
    expect(detail.messages[0]!.role).toBe('USER');
    expect(detail.messages[0]!.content).toBe('what exhibits were admitted yesterday');
    expect(detail.messages[0]!.citations).toEqual([]);

    const assistant = detail.messages[1]!;
    expect(assistant.role).toBe('ASSISTANT');
    expect(assistant.citations).toHaveLength(2);

    // ExhibitEvent citation: eventId non-null, round-tripped exactly.
    const ee = assistant.citations.find((c) => c.recordType === 'ExhibitEvent')!;
    expect(ee.exhibitId).toBe(exhibitAId);
    expect(ee.eventId).toBe(eventId);
    expect(ee.recordId).toBe(eventId);
    expect(ee.eventId).not.toBeNull();

    // JuryPackageExhibit citation: eventId null preserved as null (not "" / undefined).
    const jpe = assistant.citations.find((c) => c.recordType === 'JuryPackageExhibit')!;
    expect(jpe.exhibitId).toBe(exhibitBId);
    expect(jpe.eventId).toBeNull();
    expect(jpe.recordId).toBe('jpe-row-1');
  });

  it('round-trips a Decline: assistant message persists with zero citations', async () => {
    const conversation = await createConversation(caseId, userId);
    createdConversationIds.push(conversation.id);

    await persistTurn({
      conversationId: conversation.id,
      userMessage: 'who currently has custody of Exhibit 999',
      assistantContent: "I don't have that information about Exhibit 999's custody record.",
      citations: [],
    });

    const detail = await getConversationDetail(conversation.id);
    expect(detail.messages).toHaveLength(2);
    const assistant = detail.messages[1]!;
    expect(assistant.role).toBe('ASSISTANT');
    expect(assistant.citations).toEqual([]);
  });

  it('throws CONVERSATION_NOT_FOUND for an unknown conversation id', async () => {
    await expect(getConversationDetail(NONEXISTENT_UUID)).rejects.toMatchObject({
      code: 'CONVERSATION_NOT_FOUND',
      httpStatus: 404,
    });
  });
});
