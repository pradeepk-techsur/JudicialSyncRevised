import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { recordEvent } from '@/services/events';
import { ValidationError } from '@/lib/errors';

// Integration tests against the real Postgres provisioned by docker-compose.yml.
// Fixtures (Case/User/Exhibit) are created directly via Prisma — NOT via
// recordEvent — because there is no status-recording path yet and we only need
// the parent rows to exist so the ledger write has a valid exhibit to attach to.

async function seedFixture() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const kase = await prisma.case.create({
    data: {
      caseNumber: `TEST-EVENTS-${suffix}`,
      title: 'Events Test Case',
      court: 'Test Court',
    },
  });
  const user = await prisma.user.create({
    data: { caseId: kase.id, name: 'Test Judge', role: 'JUDGE' },
  });
  const exhibit = await prisma.exhibit.create({
    data: {
      caseId: kase.id,
      exhibitLabel: `Exhibit ${suffix}`,
      description: 'A test exhibit',
      offeringParty: 'PLAINTIFF',
    },
  });
  return { caseId: kase.id, userId: user.id, exhibitId: exhibit.id };
}

describe('recordEvent', () => {
  let fixture: Awaited<ReturnType<typeof seedFixture>>;

  beforeEach(async () => {
    fixture = await seedFixture();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('stamps an incrementing per-exhibit sequenceNo and rows are immediately readable', async () => {
    const { exhibitId, userId } = fixture;

    const first = await recordEvent({
      exhibitId,
      eventType: 'STATUS_CHANGE',
      payload: { fromStatus: null, toStatus: 'MARKED' },
      actorUserId: userId,
    });
    const second = await recordEvent({
      exhibitId,
      eventType: 'STATUS_CHANGE',
      payload: { fromStatus: 'MARKED', toStatus: 'OFFERED' },
      actorUserId: userId,
    });

    expect(first.sequenceNo).toBe(1);
    expect(second.sequenceNo).toBe(2);
    expect(first.id).toBeTruthy();

    // Immediate read-after-write: no caching layer between the write and the read.
    const rows = await prisma.exhibitEvent.findMany({
      where: { exhibitId },
      orderBy: { sequenceNo: 'asc' },
    });
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.sequenceNo)).toEqual([1, 2]);
    expect(rows[0].caseId).toBe(fixture.caseId);
  });

  it('rejects an invalid payload before any row is inserted', async () => {
    const { exhibitId, userId } = fixture;

    const before = await prisma.exhibitEvent.count({ where: { exhibitId } });

    await expect(
      recordEvent({
        exhibitId,
        eventType: 'STATUS_CHANGE',
        // Missing the required `toStatus` field.
        payload: { fromStatus: 'MARKED' },
        actorUserId: userId,
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    const after = await prisma.exhibitEvent.count({ where: { exhibitId } });
    expect(after).toBe(before);
  });
});
