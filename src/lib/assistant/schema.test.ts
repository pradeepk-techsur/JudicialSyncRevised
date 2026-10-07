import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { runSeed } from '@/data/seed';
import { getActiveCaseWithUsers } from '@/services/cases';
import { getAnthropicApiKey, isAssistantConfigured } from '@/lib/assistantConfig';

// Integration test for the Phase 4 foundation (04-01), run against the shared
// Postgres (fileParallelism:false). Proves:
//   1. the three assistant tables round-trip through the generated Prisma client,
//      including the additive exhibit_id (required) + event_id (nullable) link
//      columns that carry a citation's deep-link/replay target,
//   2. the MessageRole enum accepts USER and ASSISTANT,
//   3. the assistantConfig fail-safe reports "not configured" for an absent or
//      placeholder key (the later 503 ASSISTANT_UNAVAILABLE path).

describe('assistant schema + config foundation (04-01)', () => {
  beforeAll(async () => {
    await runSeed();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('round-trips conversation -> messages (USER + ASSISTANT) -> citations with link columns', async () => {
    const active = await getActiveCaseWithUsers();
    expect(active).not.toBeNull();
    const caseId = active!.case.id;
    const userId = active!.users[0]!.id;

    let conversationId: string | undefined;
    try {
      const conversation = await prisma.assistantConversation.create({
        data: { caseId, userId },
      });
      conversationId = conversation.id;

      // A USER turn (no citations) ...
      await prisma.assistantMessage.create({
        data: {
          conversationId: conversation.id,
          role: 'USER',
          content: 'What is the status of exhibit P-1?',
        },
      });

      // ... and an ASSISTANT turn carrying two citations:
      //  - an ExhibitEvent-style citation with a non-null eventId, and
      //  - a JuryPackageExhibit/search-style citation with eventId: null.
      const assistantMessage = await prisma.assistantMessage.create({
        data: {
          conversationId: conversation.id,
          role: 'ASSISTANT',
          content: 'Exhibit P-1 was admitted.',
          citations: {
            create: [
              {
                recordType: 'ExhibitEvent',
                recordId: 'evt-abc',
                exhibitId: 'exh-p1',
                eventId: 'evt-abc',
                timestamp: new Date(),
                label: 'P-1 admitted',
              },
              {
                recordType: 'JuryPackageExhibit',
                recordId: 'jpe-row-1',
                exhibitId: 'exh-p1',
                eventId: null,
                timestamp: new Date(),
                label: 'P-1 in jury package',
              },
            ],
          },
        },
      });
      expect(assistantMessage.role).toBe('ASSISTANT');

      // Read the whole conversation back, deeply.
      const loaded = await prisma.assistantConversation.findUniqueOrThrow({
        where: { id: conversation.id },
        include: { messages: { include: { citations: true }, orderBy: { createdAt: 'asc' } } },
      });

      expect(loaded.caseId).toBe(caseId);
      expect(loaded.userId).toBe(userId);
      expect(loaded.messages).toHaveLength(2);

      const roles = loaded.messages.map((m) => m.role).sort();
      expect(roles).toEqual(['ASSISTANT', 'USER']);

      const assistantLoaded = loaded.messages.find((m) => m.role === 'ASSISTANT')!;
      expect(assistantLoaded.citations).toHaveLength(2);

      const withEvent = assistantLoaded.citations.find((c) => c.recordType === 'ExhibitEvent')!;
      const withoutEvent = assistantLoaded.citations.find(
        (c) => c.recordType === 'JuryPackageExhibit',
      )!;

      // The additive link columns must persist and replay exactly.
      expect(withEvent.exhibitId).toBe('exh-p1');
      expect(withEvent.eventId).toBe('evt-abc');
      expect(withoutEvent.exhibitId).toBe('exh-p1');
      expect(withoutEvent.eventId).toBeNull();
    } finally {
      if (conversationId) {
        await prisma.assistantCitation.deleteMany({
          where: { message: { conversationId } },
        });
        await prisma.assistantMessage.deleteMany({ where: { conversationId } });
        await prisma.assistantConversation.delete({ where: { id: conversationId } });
      }
    }
  });

  describe('assistantConfig fail-safe', () => {
    const KEY = 'ANTHROPIC_API_KEY';
    let saved: string | undefined;

    beforeAll(() => {
      saved = process.env[KEY];
    });

    afterAll(() => {
      if (saved === undefined) delete process.env[KEY];
      else process.env[KEY] = saved;
    });

    it('reports NOT configured when the key is unset', () => {
      delete process.env[KEY];
      expect(getAnthropicApiKey()).toBeUndefined();
      expect(isAssistantConfigured()).toBe(false);
    });

    it('reports NOT configured when the key is the .env.example placeholder', () => {
      process.env[KEY] = 'sk-ant-REPLACE_ME';
      expect(getAnthropicApiKey()).toBeUndefined();
      expect(isAssistantConfigured()).toBe(false);
    });

    it('reports configured for a real, non-placeholder key', () => {
      process.env[KEY] = 'sk-ant-dummy-real-looking-key';
      expect(getAnthropicApiKey()).toBe('sk-ant-dummy-real-looking-key');
      expect(isAssistantConfigured()).toBe(true);
    });
  });
});
