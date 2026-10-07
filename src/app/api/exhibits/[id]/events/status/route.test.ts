import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { POST } from '@/app/api/exhibits/[id]/events/status/route';
import { GET as getStatus } from '@/app/api/exhibits/[id]/status/route';

// Route-handler tests: import the handlers directly and invoke them with a
// constructed NextRequest — no running server needed. Backed by the real
// Postgres from docker-compose.yml. Asserts exact HTTP status codes and the
// Y2-errors.md envelope shape ({ error: { code, message } }).

async function seedFixture() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const kase = await prisma.case.create({
    data: {
      caseNumber: `TEST-STATUS-ROUTE-${suffix}`,
      title: 'Status Route Test Case',
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

function postStatus(exhibitId: string, body: unknown) {
  return POST(
    new NextRequest(`http://localhost/api/exhibits/${exhibitId}/events/status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: exhibitId }) },
  );
}

describe('status API routes', () => {
  let fixture: Awaited<ReturnType<typeof seedFixture>>;

  beforeEach(async () => {
    fixture = await seedFixture();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('POST records a valid first transition (201) and GET reflects it (200)', async () => {
    const { exhibitId, userId } = fixture;

    const res = await postStatus(exhibitId, { toStatus: 'MARKED', actorUserId: userId });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.currentState.currentStatus).toBe('MARKED');
    expect(body.event.eventType).toBe('STATUS_CHANGE');

    const getRes = await getStatus(
      new NextRequest(`http://localhost/api/exhibits/${exhibitId}/status`),
      { params: Promise.resolve({ id: exhibitId }) },
    );
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.currentStatus).toBe('MARKED');
  });

  it('POST an invalid first transition returns 422 INVALID_STATUS_TRANSITION with the envelope', async () => {
    const { exhibitId, userId } = fixture;

    const res = await postStatus(exhibitId, { toStatus: 'ADMITTED', actorUserId: userId });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_STATUS_TRANSITION');
    expect(typeof body.error.message).toBe('string');
  });

  it('POST on a terminal exhibit returns 409 STATUS_FINALIZED with the envelope', async () => {
    const { exhibitId, userId } = fixture;

    expect((await postStatus(exhibitId, { toStatus: 'MARKED', actorUserId: userId })).status).toBe(201);
    expect((await postStatus(exhibitId, { toStatus: 'OFFERED', actorUserId: userId })).status).toBe(201);
    expect((await postStatus(exhibitId, { toStatus: 'ADMITTED', actorUserId: userId })).status).toBe(201);

    const res = await postStatus(exhibitId, { toStatus: 'WITHDRAWN', actorUserId: userId });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe('STATUS_FINALIZED');
    expect(typeof body.error.message).toBe('string');
  });

  it('POST OBJECTED without an unresolved objection returns 422, and succeeds once one exists', async () => {
    const { exhibitId, userId, caseId } = fixture;

    expect((await postStatus(exhibitId, { toStatus: 'MARKED', actorUserId: userId })).status).toBe(201);
    expect((await postStatus(exhibitId, { toStatus: 'OFFERED', actorUserId: userId })).status).toBe(201);

    const rejected = await postStatus(exhibitId, { toStatus: 'OBJECTED', actorUserId: userId });
    expect(rejected.status).toBe(422);
    expect((await rejected.json()).error.code).toBe('INVALID_STATUS_TRANSITION');

    const raised = await prisma.exhibitEvent.create({
      data: {
        exhibitId,
        caseId,
        eventType: 'OBJECTION_RAISED',
        payload: {},
        actorUserId: userId,
        sequenceNo: 999,
      },
    });
    await prisma.objectionCurrentState.create({
      data: {
        objectionId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-obj`,
        exhibitId,
        status: 'UNRESOLVED',
        objectingParty: 'DEFENSE',
        grounds: 'hearsay',
        raisedEventId: raised.id,
        raisedAt: new Date(),
      },
    });

    const ok = await postStatus(exhibitId, { toStatus: 'OBJECTED', actorUserId: userId });
    expect(ok.status).toBe(201);
    expect((await ok.json()).currentState.currentStatus).toBe('OBJECTED');
  });

  it('POST to a nonexistent exhibit returns 404 EXHIBIT_NOT_FOUND with the envelope', async () => {
    const missingId = '00000000-0000-0000-0000-000000000000';
    const res = await postStatus(missingId, { toStatus: 'MARKED', actorUserId: fixture.userId });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('EXHIBIT_NOT_FOUND');
    expect(typeof body.error.message).toBe('string');
  });

  it('GET status for a nonexistent exhibit returns 404 EXHIBIT_NOT_FOUND', async () => {
    const missingId = '00000000-0000-0000-0000-000000000000';
    const res = await getStatus(
      new NextRequest(`http://localhost/api/exhibits/${missingId}/status`),
      { params: Promise.resolve({ id: missingId }) },
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('EXHIBIT_NOT_FOUND');
  });

  it('GET status for an exhibit with no status yet returns 200 with null currentStatus', async () => {
    const { exhibitId } = fixture;
    const res = await getStatus(
      new NextRequest(`http://localhost/api/exhibits/${exhibitId}/status`),
      { params: Promise.resolve({ id: exhibitId }) },
    );
    expect(res.status).toBe(200);
    expect((await res.json()).currentStatus).toBeNull();
  });
});
