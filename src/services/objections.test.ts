import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { recordEvent } from '@/services/events';
import {
  getUnresolvedObjections,
  recordObjection,
  recordRuling,
} from '@/services/objections';

// Integration tests against the real Postgres provisioned by docker-compose.yml.
// Each test seeds its own isolated case so concurrent/other tests never leak
// into the case-wide getUnresolvedObjections assertions.

async function seedCase(roles: Role[] = ['JUDGE', 'DEPUTY', 'CLERK']) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const kase = await prisma.case.create({
    data: {
      caseNumber: `TEST-OBJ-${suffix}`,
      title: 'Objections Test Case',
      court: 'Test Court',
    },
  });
  const users: Record<string, string> = {};
  for (const role of roles) {
    const user = await prisma.user.create({
      data: { caseId: kase.id, name: `Test ${role}`, role },
    });
    users[role] = user.id;
  }
  return { caseId: kase.id, users, suffix };
}

/** Create an exhibit and advance it to OFFERED so objections are valid targets. */
async function seedOfferedExhibit(caseId: string, actorUserId: string, suffix: string) {
  const exhibit = await prisma.exhibit.create({
    data: {
      caseId,
      exhibitLabel: `Exhibit ${suffix}-${Math.random().toString(36).slice(2, 6)}`,
      description: 'A test exhibit',
      offeringParty: 'PLAINTIFF',
    },
  });
  // Drive status to OFFERED via the ledger + its projection (minimal, direct —
  // the F1 status service does not exist in this plan's scope).
  const marked = await recordEvent({
    exhibitId: exhibit.id,
    eventType: 'STATUS_CHANGE',
    payload: { fromStatus: null, toStatus: 'MARKED' },
    actorUserId,
  });
  const offered = await recordEvent({
    exhibitId: exhibit.id,
    eventType: 'STATUS_CHANGE',
    payload: { fromStatus: 'MARKED', toStatus: 'OFFERED' },
    actorUserId,
  });
  await prisma.exhibitCurrentState.upsert({
    where: { exhibitId: exhibit.id },
    create: {
      exhibitId: exhibit.id,
      currentStatus: 'OFFERED',
      lastStatusEventId: offered.id,
      lastStatusAt: offered.recordedAt,
    },
    update: {
      currentStatus: 'OFFERED',
      lastStatusEventId: offered.id,
      lastStatusAt: offered.recordedAt,
    },
  });
  void marked;
  return exhibit.id;
}

describe('objections service', () => {
  let fx: Awaited<ReturnType<typeof seedCase>>;

  beforeEach(async () => {
    fx = await seedCase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('supports multiple independent, concurrently-open threads on one exhibit', async () => {
    const exhibitId = await seedOfferedExhibit(fx.caseId, fx.users.DEPUTY, fx.suffix);

    const first = await recordObjection({
      exhibitId,
      objectingParty: 'DEFENSE',
      grounds: 'hearsay',
      actorUserId: fx.users.DEPUTY,
    });
    const second = await recordObjection({
      exhibitId,
      objectingParty: 'PLAINTIFF',
      grounds: 'lack of foundation',
      actorUserId: fx.users.DEPUTY,
    });

    expect(first.objectionState.objectionId).not.toBe(second.objectionState.objectionId);
    expect(first.objectionState.status).toBe('UNRESOLVED');
    expect(second.objectionState.status).toBe('UNRESOLVED');

    const unresolved = await getUnresolvedObjections(fx.caseId);
    const ids = unresolved.map((o) => o.objectionId).sort();
    expect(ids).toContain(first.objectionState.objectionId);
    expect(ids).toContain(second.objectionState.objectionId);
    expect(unresolved.filter((o) => o.exhibitId === exhibitId)).toHaveLength(2);
  });

  it('rejects a RESERVED ruling by a non-judge (DEPUTY) — no exception for RESERVED', async () => {
    const exhibitId = await seedOfferedExhibit(fx.caseId, fx.users.DEPUTY, fx.suffix);
    const { objectionState } = await recordObjection({
      exhibitId,
      objectingParty: 'DEFENSE',
      grounds: 'hearsay',
      actorUserId: fx.users.DEPUTY,
    });

    await expect(
      recordRuling({
        objectionId: objectionState.objectionId,
        disposition: 'RESERVED',
        actorUserId: fx.users.DEPUTY,
      }),
    ).rejects.toMatchObject({ code: 'ROLE_NOT_PERMITTED' });

    // Thread untouched — still UNRESOLVED.
    const unresolved = await getUnresolvedObjections(fx.caseId);
    expect(unresolved.map((o) => o.objectionId)).toContain(objectionState.objectionId);
  });

  it('rejects SUSTAINED and OVERRULED rulings by a non-judge (CLERK)', async () => {
    const exhibitId = await seedOfferedExhibit(fx.caseId, fx.users.DEPUTY, fx.suffix);

    const a = await recordObjection({
      exhibitId,
      objectingParty: 'DEFENSE',
      grounds: 'hearsay',
      actorUserId: fx.users.DEPUTY,
    });
    const b = await recordObjection({
      exhibitId,
      objectingParty: 'PLAINTIFF',
      grounds: 'relevance',
      actorUserId: fx.users.DEPUTY,
    });

    await expect(
      recordRuling({
        objectionId: a.objectionState.objectionId,
        disposition: 'SUSTAINED',
        actorUserId: fx.users.CLERK,
      }),
    ).rejects.toMatchObject({ code: 'ROLE_NOT_PERMITTED' });

    await expect(
      recordRuling({
        objectionId: b.objectionState.objectionId,
        disposition: 'OVERRULED',
        actorUserId: fx.users.CLERK,
      }),
    ).rejects.toMatchObject({ code: 'ROLE_NOT_PERMITTED' });
  });

  it('accepts a RESERVED ruling by a JUDGE and keeps the thread UNRESOLVED', async () => {
    const exhibitId = await seedOfferedExhibit(fx.caseId, fx.users.DEPUTY, fx.suffix);
    const { objectionState } = await recordObjection({
      exhibitId,
      objectingParty: 'DEFENSE',
      grounds: 'hearsay',
      actorUserId: fx.users.DEPUTY,
    });

    const ruling = await recordRuling({
      objectionId: objectionState.objectionId,
      disposition: 'RESERVED',
      actorUserId: fx.users.JUDGE,
    });

    expect(ruling.event.eventType).toBe('RULING_RECORDED');
    expect(ruling.objectionState.status).toBe('UNRESOLVED');
    expect(ruling.objectionState.rulingEventId).toBeNull();
    expect(ruling.objectionState.ruledAt).toBeNull();

    const unresolved = await getUnresolvedObjections(fx.caseId);
    expect(unresolved.map((o) => o.objectionId)).toContain(objectionState.objectionId);
  });

  it('a SUSTAINED ruling by a JUDGE resolves the thread (drops from unresolved)', async () => {
    const exhibitId = await seedOfferedExhibit(fx.caseId, fx.users.DEPUTY, fx.suffix);
    const { objectionState } = await recordObjection({
      exhibitId,
      objectingParty: 'DEFENSE',
      grounds: 'hearsay',
      actorUserId: fx.users.DEPUTY,
    });

    const ruling = await recordRuling({
      objectionId: objectionState.objectionId,
      disposition: 'SUSTAINED',
      actorUserId: fx.users.JUDGE,
    });
    expect(ruling.objectionState.status).toBe('SUSTAINED');
    expect(ruling.objectionState.rulingEventId).toBe(ruling.event.id);
    expect(ruling.objectionState.ruledAt).not.toBeNull();

    const unresolved = await getUnresolvedObjections(fx.caseId);
    expect(unresolved.map((o) => o.objectionId)).not.toContain(objectionState.objectionId);
  });

  it('rejects an objection against an exhibit still at MARKED status', async () => {
    // Exhibit created but only advanced to MARKED (never OFFERED).
    const exhibit = await prisma.exhibit.create({
      data: {
        caseId: fx.caseId,
        exhibitLabel: `Marked ${fx.suffix}-${Math.random().toString(36).slice(2, 6)}`,
        description: 'still marked',
        offeringParty: 'PLAINTIFF',
      },
    });
    const marked = await recordEvent({
      exhibitId: exhibit.id,
      eventType: 'STATUS_CHANGE',
      payload: { fromStatus: null, toStatus: 'MARKED' },
      actorUserId: fx.users.DEPUTY,
    });
    await prisma.exhibitCurrentState.create({
      data: {
        exhibitId: exhibit.id,
        currentStatus: 'MARKED',
        lastStatusEventId: marked.id,
        lastStatusAt: marked.recordedAt,
      },
    });

    await expect(
      recordObjection({
        exhibitId: exhibit.id,
        objectingParty: 'DEFENSE',
        grounds: 'hearsay',
        actorUserId: fx.users.DEPUTY,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_OBJECTION_TARGET' });
  });

  it('rejects a ruling against an already-resolved objection', async () => {
    const exhibitId = await seedOfferedExhibit(fx.caseId, fx.users.DEPUTY, fx.suffix);
    const { objectionState } = await recordObjection({
      exhibitId,
      objectingParty: 'DEFENSE',
      grounds: 'hearsay',
      actorUserId: fx.users.DEPUTY,
    });

    await recordRuling({
      objectionId: objectionState.objectionId,
      disposition: 'SUSTAINED',
      actorUserId: fx.users.JUDGE,
    });

    await expect(
      recordRuling({
        objectionId: objectionState.objectionId,
        disposition: 'OVERRULED',
        actorUserId: fx.users.JUDGE,
      }),
    ).rejects.toMatchObject({ code: 'OBJECTION_ALREADY_RESOLVED' });
  });

  it('rejects a ruling against a nonexistent objection id', async () => {
    await expect(
      recordRuling({
        objectionId: '00000000-0000-0000-0000-000000000000',
        disposition: 'SUSTAINED',
        actorUserId: fx.users.JUDGE,
      }),
    ).rejects.toMatchObject({ code: 'OBJECTION_NOT_FOUND' });
  });
});
