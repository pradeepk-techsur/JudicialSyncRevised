import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { POST as postCustody } from '@/app/api/exhibits/[id]/events/custody/route';
import { GET as getCustodianRoute } from '@/app/api/exhibits/[id]/custodian/route';
import { GET as getHistoryRoute } from '@/app/api/exhibits/[id]/custody-history/route';

// Route-handler tests: import the handlers directly and invoke them with a
// constructed NextRequest — no running server needed. Backed by the real
// Postgres from docker-compose.yml.

async function seedFixture() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const kase = await prisma.case.create({
    data: {
      caseNumber: `TEST-CUSTODY-RT-${suffix}`,
      title: 'Custody Routes Test Case',
      court: 'Test Court',
    },
  });
  const deputy = await prisma.user.create({
    data: { caseId: kase.id, name: 'Deputy A', role: 'DEPUTY' },
  });
  const clerk = await prisma.user.create({
    data: { caseId: kase.id, name: 'Clerk B', role: 'CLERK' },
  });
  const attorney = await prisma.user.create({
    data: { caseId: kase.id, name: 'Attorney C', role: 'ATTORNEY' },
  });
  const judge = await prisma.user.create({
    data: { caseId: kase.id, name: 'Judge D', role: 'JUDGE' },
  });
  const exhibit = await prisma.exhibit.create({
    data: {
      caseId: kase.id,
      exhibitLabel: `Exhibit ${suffix}`,
      description: 'A test exhibit',
      offeringParty: 'PLAINTIFF',
    },
  });
  return {
    exhibitId: exhibit.id,
    deputyId: deputy.id,
    clerkId: clerk.id,
    attorneyId: attorney.id,
    judgeId: judge.id,
  };
}

function postRequest(exhibitId: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/exhibits/${exhibitId}/events/custody`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('custody API routes', () => {
  let fx: Awaited<ReturnType<typeof seedFixture>>;

  beforeEach(async () => {
    fx = await seedFixture();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('GET /custodian for an exhibit with no custody event returns 200 { custodian: null }', async () => {
    const { exhibitId } = fx;

    const res = await getCustodianRoute(
      new NextRequest(`http://localhost/api/exhibits/${exhibitId}/custodian`),
      { params: Promise.resolve({ id: exhibitId }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('custodian');
    expect(body.custodian).toBeNull();
  });

  it('GET /custodian for a nonexistent exhibit returns 404 EXHIBIT_NOT_FOUND', async () => {
    const missingId = '00000000-0000-0000-0000-000000000000';
    const res = await getCustodianRoute(
      new NextRequest(`http://localhost/api/exhibits/${missingId}/custodian`),
      { params: Promise.resolve({ id: missingId }) },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('EXHIBIT_NOT_FOUND');
  });

  it('POST a transfer from the WRONG holder returns 409 CUSTODY_CHAIN_BROKEN', async () => {
    const { exhibitId, deputyId, clerkId, attorneyId } = fx;

    // First transfer: deputy takes custody.
    const first = await postCustody(
      postRequest(exhibitId, {
        fromCustodianUserId: null,
        toCustodianUserId: deputyId,
        actorUserId: deputyId,
      }),
      { params: Promise.resolve({ id: exhibitId }) },
    );
    expect(first.status).toBe(201);

    // Attempt a transfer claiming to be from the clerk (who does not hold it).
    const bad = await postCustody(
      postRequest(exhibitId, {
        fromCustodianUserId: clerkId,
        toCustodianUserId: attorneyId,
        actorUserId: clerkId,
      }),
      { params: Promise.resolve({ id: exhibitId }) },
    );
    expect(bad.status).toBe(409);
    const body = await bad.json();
    expect(body.error.code).toBe('CUSTODY_CHAIN_BROKEN');

    // Projection unchanged — still the deputy.
    const custRes = await getCustodianRoute(
      new NextRequest(`http://localhost/api/exhibits/${exhibitId}/custodian`),
      { params: Promise.resolve({ id: exhibitId }) },
    );
    const custBody = await custRes.json();
    expect(custBody.custodian.currentCustodianUserId).toBe(deputyId);
  });

  it('POST transfers then GET /custody-history returns the full chain in order', async () => {
    const { exhibitId, deputyId, clerkId, attorneyId } = fx;

    const r1 = await postCustody(
      postRequest(exhibitId, {
        fromCustodianUserId: null,
        toCustodianUserId: deputyId,
        reason: 'intake',
        actorUserId: deputyId,
      }),
      { params: Promise.resolve({ id: exhibitId }) },
    );
    expect(r1.status).toBe(201);
    const r1body = await r1.json();
    expect(r1body.event.eventType).toBe('CUSTODY_TRANSFER');
    expect(r1body.custodyState.currentCustodianUserId).toBe(deputyId);

    await postCustody(
      postRequest(exhibitId, {
        fromCustodianUserId: deputyId,
        toCustodianUserId: clerkId,
        reason: 'to clerk',
        actorUserId: clerkId,
      }),
      { params: Promise.resolve({ id: exhibitId }) },
    );
    await postCustody(
      postRequest(exhibitId, {
        fromCustodianUserId: clerkId,
        toCustodianUserId: attorneyId,
        reason: 'to attorney',
        // Clerk (current holder) performs the transfer TO the attorney; ATTORNEY
        // is not an authorized custody actor under the new F24 role gate.
        actorUserId: clerkId,
      }),
      { params: Promise.resolve({ id: exhibitId }) },
    );

    const histRes = await getHistoryRoute(
      new NextRequest(`http://localhost/api/exhibits/${exhibitId}/custody-history`),
      { params: Promise.resolve({ id: exhibitId }) },
    );
    expect(histRes.status).toBe(200);
    const history = await histRes.json();
    expect(history).toHaveLength(3);
    expect(history[0].fromCustodian).toBeNull();
    expect(history[0].toCustodian).toBe(deputyId);
    expect(history[1].toCustodian).toBe(clerkId);
    expect(history[2].toCustodian).toBe(attorneyId);
    expect(history[2].reason).toBe('to attorney');
  });

  it('POST missing toCustodianUserId returns 422 VALIDATION_ERROR', async () => {
    const { exhibitId, deputyId } = fx;
    const res = await postCustody(
      postRequest(exhibitId, { fromCustodianUserId: null, actorUserId: deputyId }),
      { params: Promise.resolve({ id: exhibitId }) },
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST by a JUDGE actor returns 403 ROLE_NOT_PERMITTED', async () => {
    const { exhibitId, deputyId, judgeId } = fx;

    // Direct API-level check bypassing any UI: a JUDGE is not an authorized
    // custody-transfer actor, so the request is rejected at the route/service
    // boundary with 403, not merely hidden client-side.
    const res = await postCustody(
      postRequest(exhibitId, {
        fromCustodianUserId: null,
        toCustodianUserId: deputyId,
        actorUserId: judgeId,
      }),
      { params: Promise.resolve({ id: exhibitId }) },
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('ROLE_NOT_PERMITTED');

    // The gate fired before any write — no custody row exists.
    const custRes = await getCustodianRoute(
      new NextRequest(`http://localhost/api/exhibits/${exhibitId}/custodian`),
      { params: Promise.resolve({ id: exhibitId }) },
    );
    const custBody = await custRes.json();
    expect(custBody.custodian).toBeNull();
  });

  it('POST to a nonexistent exhibit returns 404 EXHIBIT_NOT_FOUND', async () => {
    const { deputyId } = fx;
    const missingId = '00000000-0000-0000-0000-000000000000';
    const res = await postCustody(
      postRequest(missingId, {
        fromCustodianUserId: null,
        toCustodianUserId: deputyId,
        actorUserId: deputyId,
      }),
      { params: Promise.resolve({ id: missingId }) },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('EXHIBIT_NOT_FOUND');
  });
});
