import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { POST } from '@/app/api/discrepancies/[id]/acknowledge/route';
import { GET as getExhibitDiscrepancies } from '@/app/api/exhibits/[id]/discrepancies/route';
import { recordStatusChange } from '@/services/status';
import { evaluateDiscrepancies } from '@/services/discrepancies';

// Route-handler tests for POST /api/discrepancies/:id/acknowledge and a sealed
// masking check on GET /api/exhibits/:id/discrepancies. Self-contained fixtures,
// real Postgres from docker-compose.yml.

// Test-only bypass for the ADMITTED-transition step alone (see
// discrepancies.test.ts for the rationale). F12's live gate forbids reaching
// ADMITTED with no custodian for every real caller; both fixtures below are
// "admitted, custody-less" by design (so there's a flag to acknowledge / mask),
// so they build that precondition directly and re-evaluate.
async function forceAdmitBypassingGate(
  exhibitId: string,
  caseId: string,
  actorUserId: string,
): Promise<void> {
  const agg = await prisma.exhibitEvent.aggregate({
    where: { exhibitId },
    _max: { sequenceNo: true },
  });
  const event = await prisma.exhibitEvent.create({
    data: {
      exhibitId,
      caseId,
      eventType: 'STATUS_CHANGE',
      payload: { fromStatus: 'OFFERED', toStatus: 'ADMITTED' },
      actorUserId,
      sequenceNo: (agg._max.sequenceNo ?? 0) + 1,
    },
  });
  await prisma.exhibitCurrentState.upsert({
    where: { exhibitId },
    create: {
      exhibitId,
      currentStatus: 'ADMITTED',
      lastStatusEventId: event.id,
      lastStatusAt: event.recordedAt,
    },
    update: {
      currentStatus: 'ADMITTED',
      lastStatusEventId: event.id,
      lastStatusAt: event.recordedAt,
    },
  });
  await evaluateDiscrepancies(exhibitId);
}

async function seedFixture() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const kase = await prisma.case.create({
    data: {
      caseNumber: `TEST-ACK-ROUTE-${suffix}`,
      title: 'Acknowledge Route Test',
      court: 'Test Court',
    },
  });
  const deputy = await prisma.user.create({
    data: { caseId: kase.id, name: 'Deputy D', role: 'DEPUTY' },
  });
  const attorney = await prisma.user.create({
    data: { caseId: kase.id, name: 'Attorney A', role: 'ATTORNEY' },
  });
  // Normal exhibit: ADMITTED, no custody → OPEN ADMITTED_NO_CUSTODIAN flag.
  const exhibit = await prisma.exhibit.create({
    data: {
      caseId: kase.id,
      exhibitLabel: `P-${suffix}`,
      description: 'Admitted, custody-less',
      offeringParty: 'PROSECUTION',
    },
  });
  await recordStatusChange({ exhibitId: exhibit.id, toStatus: 'MARKED', actorUserId: deputy.id });
  await recordStatusChange({ exhibitId: exhibit.id, toStatus: 'OFFERED', actorUserId: deputy.id });
  await forceAdmitBypassingGate(exhibit.id, kase.id, deputy.id);

  // Sealed exhibit with its own OPEN flag (for the exhibit-discrepancies sealed test).
  const sealed = await prisma.exhibit.create({
    data: {
      caseId: kase.id,
      exhibitLabel: `S-${suffix}`,
      description: 'Sealed, admitted, custody-less',
      offeringParty: 'PROSECUTION',
      isSealed: true,
    },
  });
  await recordStatusChange({ exhibitId: sealed.id, toStatus: 'MARKED', actorUserId: deputy.id });
  await recordStatusChange({ exhibitId: sealed.id, toStatus: 'OFFERED', actorUserId: deputy.id });
  await forceAdmitBypassingGate(sealed.id, kase.id, deputy.id);

  const flag = await prisma.discrepancyFlag.findFirstOrThrow({
    where: { exhibitId: exhibit.id, status: 'OPEN' },
  });

  return {
    caseId: kase.id,
    deputyId: deputy.id,
    attorneyId: attorney.id,
    flagId: flag.id,
    sealedId: sealed.id,
  };
}

function ackRoute(flagId: string, body: unknown) {
  return POST(
    new NextRequest(`http://localhost/api/discrepancies/${flagId}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }),
    { params: Promise.resolve({ id: flagId }) },
  );
}

function exhibitDiscRoute(exhibitId: string, role?: string) {
  const headers = new Headers();
  if (role !== undefined) headers.set('X-User-Role', role);
  return getExhibitDiscrepancies(
    new NextRequest(`http://localhost/api/exhibits/${exhibitId}/discrepancies`, { headers }),
    { params: Promise.resolve({ id: exhibitId }) },
  );
}

const MISSING_ID = '00000000-0000-0000-0000-000000000000';

describe('POST /api/discrepancies/:id/acknowledge', () => {
  let fx: Awaited<ReturnType<typeof seedFixture>>;

  beforeEach(async () => {
    fx = await seedFixture();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('acknowledges an OPEN flag as DEPUTY → 200 with event + ACKNOWLEDGED flag', async () => {
    const res = await ackRoute(fx.flagId, {
      actorUserId: fx.deputyId,
      justification: 'Reviewed — custodian will be assigned at recess',
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.event.eventType).toBe('DISCREPANCY_ACKNOWLEDGED');
    expect(body.discrepancyFlag.status).toBe('ACKNOWLEDGED');
  });

  it('empty justification → 422 JUSTIFICATION_REQUIRED (whitespace caught by service)', async () => {
    // Empty string is caught by the route (VALIDATION_ERROR); whitespace reaches
    // the service and 422s as JUSTIFICATION_REQUIRED. Assert the service path.
    const res = await ackRoute(fx.flagId, { actorUserId: fx.deputyId, justification: '   ' });
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe('JUSTIFICATION_REQUIRED');
  });

  it('empty-string justification → 422 VALIDATION_ERROR at the route', async () => {
    const res = await ackRoute(fx.flagId, { actorUserId: fx.deputyId, justification: '' });
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe('VALIDATION_ERROR');
  });

  it('as ATTORNEY → 403 ROLE_NOT_PERMITTED', async () => {
    const res = await ackRoute(fx.flagId, {
      actorUserId: fx.attorneyId,
      justification: 'I think this is fine',
    });
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('ROLE_NOT_PERMITTED');
  });

  it('acknowledge again → 200 (idempotent)', async () => {
    await ackRoute(fx.flagId, { actorUserId: fx.deputyId, justification: 'first ack' });
    const res = await ackRoute(fx.flagId, {
      actorUserId: fx.deputyId,
      justification: 'second attempt',
    });
    expect(res.status).toBe(200);
    expect((await res.json()).discrepancyFlag.status).toBe('ACKNOWLEDGED');
  });

  it('unknown flag id → 404 DISCREPANCY_NOT_FOUND', async () => {
    const res = await ackRoute(MISSING_ID, {
      actorUserId: fx.deputyId,
      justification: 'valid justification',
    });
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('DISCREPANCY_NOT_FOUND');
  });
});

describe('GET /api/exhibits/:id/discrepancies sealed masking', () => {
  let fx: Awaited<ReturnType<typeof seedFixture>>;

  beforeEach(async () => {
    fx = await seedFixture();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('returns the flags for a sealed exhibit read by JUDGE (200)', async () => {
    const res = await exhibitDiscRoute(fx.sealedId, 'JUDGE');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.some((f: { ruleCode: string }) => f.ruleCode === 'ADMITTED_NO_CUSTODIAN')).toBe(
      true,
    );
  });

  it('returns 404 EXHIBIT_NOT_FOUND for a sealed exhibit read by ATTORNEY', async () => {
    const res = await exhibitDiscRoute(fx.sealedId, 'ATTORNEY');
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('EXHIBIT_NOT_FOUND');
  });

  it('byte-identical 404 for sealed-unauthorized and genuinely-missing', async () => {
    const sealedUnauthorized = await exhibitDiscRoute(fx.sealedId, 'ATTORNEY');
    const genuinelyMissing = await exhibitDiscRoute(MISSING_ID, 'ATTORNEY');
    expect(await sealedUnauthorized.json()).toEqual(await genuinelyMissing.json());
  });
});
