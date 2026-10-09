import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { getExhibitStatus, recordStatusChange } from '@/services/status';
import { recordCustodyTransfer } from '@/services/custody';
import { ConflictError, UnprocessableError } from '@/lib/errors';

// Integration tests against the real Postgres provisioned by docker-compose.yml.
// Parent rows (Case/User/Exhibit) are created directly via Prisma; status
// transitions go exclusively through recordStatusChange (the path under test).

async function seedFixture() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const kase = await prisma.case.create({
    data: {
      caseNumber: `TEST-STATUS-${suffix}`,
      title: 'Status Test Case',
      court: 'Test Court',
    },
  });
  const user = await prisma.user.create({
    data: { caseId: kase.id, name: 'Test Deputy', role: 'DEPUTY' },
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

describe('recordStatusChange / getExhibitStatus', () => {
  let fixture: Awaited<ReturnType<typeof seedFixture>>;

  beforeEach(async () => {
    fixture = await seedFixture();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('records a valid MARKED -> OFFERED -> ADMITTED sequence, reflected immediately after each step', async () => {
    const { exhibitId, userId } = fixture;

    // Fresh exhibit has no status yet.
    expect(await getExhibitStatus(exhibitId)).toBeNull();

    const marked = await recordStatusChange({ exhibitId, toStatus: 'MARKED', actorUserId: userId });
    expect(marked.currentState.currentStatus).toBe('MARKED');
    expect(marked.event.eventType).toBe('STATUS_CHANGE');
    // Read-after-write: the projection reflects the new status immediately.
    expect((await getExhibitStatus(exhibitId))?.currentStatus).toBe('MARKED');

    const offered = await recordStatusChange({ exhibitId, toStatus: 'OFFERED', actorUserId: userId });
    expect(offered.currentState.currentStatus).toBe('OFFERED');
    expect((await getExhibitStatus(exhibitId))?.currentStatus).toBe('OFFERED');

    // F12 admission gate: establish custody before ADMITTED so NO_CUSTODIAN
    // does not block this normal-admission sequence (this test is about the
    // status state machine, not the admission gate).
    await recordCustodyTransfer({
      exhibitId,
      fromCustodianUserId: null,
      toCustodianUserId: userId,
      reason: 'intake',
      actorUserId: userId,
    });

    const admitted = await recordStatusChange({ exhibitId, toStatus: 'ADMITTED', actorUserId: userId });
    expect(admitted.currentState.currentStatus).toBe('ADMITTED');
    const finalState = await getExhibitStatus(exhibitId);
    expect(finalState?.currentStatus).toBe('ADMITTED');
    expect(finalState?.lastStatusEventId).toBe(admitted.event.id);
  });

  it('rejects an invalid first transition (fresh exhibit -> ADMITTED) with INVALID_STATUS_TRANSITION', async () => {
    const { exhibitId, userId } = fixture;

    await expect(
      recordStatusChange({ exhibitId, toStatus: 'ADMITTED', actorUserId: userId }),
    ).rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });

    await expect(
      recordStatusChange({ exhibitId, toStatus: 'ADMITTED', actorUserId: userId }),
    ).rejects.toBeInstanceOf(UnprocessableError);

    // No projection row was created by the rejected attempt.
    expect(await getExhibitStatus(exhibitId)).toBeNull();
  });

  it('rejects any further transition once terminal (ADMITTED) with STATUS_FINALIZED', async () => {
    const { exhibitId, userId } = fixture;

    await recordStatusChange({ exhibitId, toStatus: 'MARKED', actorUserId: userId });
    await recordStatusChange({ exhibitId, toStatus: 'OFFERED', actorUserId: userId });
    // F12 admission gate: establish custody before ADMITTED so this test can
    // reach the terminal ADMITTED state it needs to exercise STATUS_FINALIZED.
    await recordCustodyTransfer({
      exhibitId,
      fromCustodianUserId: null,
      toCustodianUserId: userId,
      reason: 'intake',
      actorUserId: userId,
    });
    await recordStatusChange({ exhibitId, toStatus: 'ADMITTED', actorUserId: userId });

    await expect(
      recordStatusChange({ exhibitId, toStatus: 'WITHDRAWN', actorUserId: userId }),
    ).rejects.toMatchObject({ code: 'STATUS_FINALIZED' });
    await expect(
      recordStatusChange({ exhibitId, toStatus: 'EXCLUDED', actorUserId: userId }),
    ).rejects.toBeInstanceOf(ConflictError);

    // Status remains ADMITTED — the rejected attempts changed nothing.
    expect((await getExhibitStatus(exhibitId))?.currentStatus).toBe('ADMITTED');
  });

  it('gates OBJECTED on an unresolved objection existing for the exhibit', async () => {
    const { exhibitId, userId } = fixture;

    await recordStatusChange({ exhibitId, toStatus: 'MARKED', actorUserId: userId });
    await recordStatusChange({ exhibitId, toStatus: 'OFFERED', actorUserId: userId });

    // With zero unresolved objections, OBJECTED is unreachable.
    await expect(
      recordStatusChange({ exhibitId, toStatus: 'OBJECTED', actorUserId: userId }),
    ).rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
    expect((await getExhibitStatus(exhibitId))?.currentStatus).toBe('OFFERED');

    // Create an UNRESOLVED objection fixture directly, then the transition succeeds.
    const raised = await prisma.exhibitEvent.create({
      data: {
        exhibitId,
        caseId: fixture.caseId,
        eventType: 'OBJECTION_RAISED',
        payload: {},
        actorUserId: userId,
        sequenceNo: 999,
      },
    });
    await prisma.objectionCurrentState.create({
      data: {
        objectionId: `${Date.now()}-obj`,
        exhibitId,
        status: 'UNRESOLVED',
        objectingParty: 'DEFENSE',
        grounds: 'hearsay',
        raisedEventId: raised.id,
        raisedAt: new Date(),
      },
    });

    const objected = await recordStatusChange({ exhibitId, toStatus: 'OBJECTED', actorUserId: userId });
    expect(objected.currentState.currentStatus).toBe('OBJECTED');
    expect((await getExhibitStatus(exhibitId))?.currentStatus).toBe('OBJECTED');
  });
});
