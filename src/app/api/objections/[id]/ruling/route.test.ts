import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import type { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { recordEvent } from '@/services/events';
import { recordObjection } from '@/services/objections';
import { POST as rulingRoute } from '@/app/api/objections/[id]/ruling/route';
import { POST as objectionRoute } from '@/app/api/exhibits/[id]/events/objection/route';
import { GET as caseObjectionsRoute } from '@/app/api/cases/[id]/objections/route';

// Route-handler tests: invoke the handlers directly with a constructed
// NextRequest — no running server needed. Backed by the real Postgres from
// docker-compose.yml. Proves the judge-only ruling gate at the HTTP layer for
// ALL three dispositions, including RESERVED.

async function seedCase(roles: Role[] = ['JUDGE', 'DEPUTY', 'CLERK']) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const kase = await prisma.case.create({
    data: {
      caseNumber: `TEST-OBJ-ROUTE-${suffix}`,
      title: 'Objection Route Test Case',
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

async function seedOfferedExhibit(caseId: string, actorUserId: string, suffix: string) {
  const exhibit = await prisma.exhibit.create({
    data: {
      caseId,
      exhibitLabel: `Exhibit ${suffix}-${Math.random().toString(36).slice(2, 6)}`,
      description: 'A test exhibit',
      offeringParty: 'PLAINTIFF',
    },
  });
  await recordEvent({
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
  return exhibit.id;
}

function postRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const JUDGE_ONLY_MESSAGE = 'Only a judge may record a ruling on an objection';

describe('objection ruling API route', () => {
  let fx: Awaited<ReturnType<typeof seedCase>>;

  beforeEach(async () => {
    fx = await seedCase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // The core guarantee of this plan, proven at the HTTP layer for each
  // disposition — RESERVED is gated identically to SUSTAINED/OVERRULED.
  for (const disposition of ['SUSTAINED', 'OVERRULED', 'RESERVED'] as const) {
    it(`rejects a ${disposition} ruling by a non-judge (CLERK) with 403 ROLE_NOT_PERMITTED`, async () => {
      const exhibitId = await seedOfferedExhibit(fx.caseId, fx.users.DEPUTY, fx.suffix);
      const { objectionState } = await recordObjection({
        exhibitId,
        objectingParty: 'DEFENSE',
        grounds: 'hearsay',
        actorUserId: fx.users.DEPUTY,
      });

      const res = await rulingRoute(
        postRequest(`http://localhost/api/objections/${objectionState.objectionId}/ruling`, {
          disposition,
          actorUserId: fx.users.CLERK,
        }),
        { params: Promise.resolve({ id: objectionState.objectionId }) },
      );

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe('ROLE_NOT_PERMITTED');
      expect(body.error.message).toBe(JUDGE_ONLY_MESSAGE);
    });
  }

  it('rejects a RESERVED ruling by a DEPUTY at the HTTP layer (403)', async () => {
    const exhibitId = await seedOfferedExhibit(fx.caseId, fx.users.DEPUTY, fx.suffix);
    const { objectionState } = await recordObjection({
      exhibitId,
      objectingParty: 'DEFENSE',
      grounds: 'hearsay',
      actorUserId: fx.users.DEPUTY,
    });

    const res = await rulingRoute(
      postRequest(`http://localhost/api/objections/${objectionState.objectionId}/ruling`, {
        disposition: 'RESERVED',
        actorUserId: fx.users.DEPUTY,
      }),
      { params: Promise.resolve({ id: objectionState.objectionId }) },
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('ROLE_NOT_PERMITTED');
    expect(body.error.message).toBe(JUDGE_ONLY_MESSAGE);
  });

  it('accepts a SUSTAINED ruling by a JUDGE (201) and resolves the thread', async () => {
    const exhibitId = await seedOfferedExhibit(fx.caseId, fx.users.DEPUTY, fx.suffix);
    const { objectionState } = await recordObjection({
      exhibitId,
      objectingParty: 'DEFENSE',
      grounds: 'hearsay',
      actorUserId: fx.users.DEPUTY,
    });

    const res = await rulingRoute(
      postRequest(`http://localhost/api/objections/${objectionState.objectionId}/ruling`, {
        disposition: 'SUSTAINED',
        actorUserId: fx.users.JUDGE,
      }),
      { params: Promise.resolve({ id: objectionState.objectionId }) },
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.objectionState.status).toBe('SUSTAINED');
    expect(body.event.eventType).toBe('RULING_RECORDED');
  });

  it('returns 404 OBJECTION_NOT_FOUND for a nonexistent objection id', async () => {
    const missingId = '00000000-0000-0000-0000-000000000000';
    const res = await rulingRoute(
      postRequest(`http://localhost/api/objections/${missingId}/ruling`, {
        disposition: 'SUSTAINED',
        actorUserId: fx.users.JUDGE,
      }),
      { params: Promise.resolve({ id: missingId }) },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('OBJECTION_NOT_FOUND');
  });

  it('returns 409 OBJECTION_ALREADY_RESOLVED when ruling twice', async () => {
    const exhibitId = await seedOfferedExhibit(fx.caseId, fx.users.DEPUTY, fx.suffix);
    const { objectionState } = await recordObjection({
      exhibitId,
      objectingParty: 'DEFENSE',
      grounds: 'hearsay',
      actorUserId: fx.users.DEPUTY,
    });
    const params = { params: Promise.resolve({ id: objectionState.objectionId }) };
    const url = `http://localhost/api/objections/${objectionState.objectionId}/ruling`;

    const first = await rulingRoute(
      postRequest(url, { disposition: 'OVERRULED', actorUserId: fx.users.JUDGE }),
      params,
    );
    expect(first.status).toBe(201);

    const second = await rulingRoute(
      postRequest(url, { disposition: 'SUSTAINED', actorUserId: fx.users.JUDGE }),
      { params: Promise.resolve({ id: objectionState.objectionId }) },
    );
    expect(second.status).toBe(409);
    const body = await second.json();
    expect(body.error.code).toBe('OBJECTION_ALREADY_RESOLVED');
  });
});

describe('objection-raise and case-objections API routes', () => {
  let fx: Awaited<ReturnType<typeof seedCase>>;

  beforeEach(async () => {
    fx = await seedCase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('POST objection (201) then GET case objections includes the new unresolved thread', async () => {
    const exhibitId = await seedOfferedExhibit(fx.caseId, fx.users.DEPUTY, fx.suffix);

    const postRes = await objectionRoute(
      postRequest(`http://localhost/api/exhibits/${exhibitId}/events/objection`, {
        objectingParty: 'DEFENSE',
        grounds: 'hearsay',
        actorUserId: fx.users.DEPUTY,
      }),
      { params: Promise.resolve({ id: exhibitId }) },
    );
    expect(postRes.status).toBe(201);
    const created = await postRes.json();
    expect(created.objectionState.status).toBe('UNRESOLVED');

    const getRes = await caseObjectionsRoute(
      new NextRequest(
        `http://localhost/api/cases/${fx.caseId}/objections?status=unresolved`,
      ),
      { params: Promise.resolve({ id: fx.caseId }) },
    );
    expect(getRes.status).toBe(200);
    const list = await getRes.json();
    expect(list.map((o: { objectionId: string }) => o.objectionId)).toContain(
      created.objectionState.objectionId,
    );
  });

  it('POST objection against a MARKED exhibit returns 422 INVALID_OBJECTION_TARGET', async () => {
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

    const res = await objectionRoute(
      postRequest(`http://localhost/api/exhibits/${exhibit.id}/events/objection`, {
        objectingParty: 'DEFENSE',
        grounds: 'hearsay',
        actorUserId: fx.users.DEPUTY,
      }),
      { params: Promise.resolve({ id: exhibit.id }) },
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_OBJECTION_TARGET');
  });

  it('POST objection against a nonexistent exhibit returns 404 EXHIBIT_NOT_FOUND', async () => {
    const missingId = '00000000-0000-0000-0000-000000000000';
    const res = await objectionRoute(
      postRequest(`http://localhost/api/exhibits/${missingId}/events/objection`, {
        objectingParty: 'DEFENSE',
        grounds: 'hearsay',
        actorUserId: fx.users.DEPUTY,
      }),
      { params: Promise.resolve({ id: missingId }) },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('EXHIBIT_NOT_FOUND');
  });
});
