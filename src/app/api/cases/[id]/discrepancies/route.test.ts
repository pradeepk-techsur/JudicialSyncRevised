import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { GET } from '@/app/api/cases/[id]/discrepancies/route';
import { recordStatusChange } from '@/services/status';
import { evaluateDiscrepancies } from '@/services/discrepancies';

// Route-handler tests for GET /api/cases/:id/discrepancies. Self-contained
// fixtures (unique caseNumber) via the live write paths — independent under
// fileParallelism:false. Backed by the real Postgres from docker-compose.yml.

// Test-only bypass for the ADMITTED-transition step alone (see
// discrepancies.test.ts for the rationale). F12's live gate forbids reaching
// ADMITTED with no custodian for every real caller; this directly writes the
// STATUS_CHANGE event + projection and re-evaluates so the resulting
// ADMITTED_NO_CUSTODIAN flag is genuinely firing.
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
      caseNumber: `TEST-CASE-DISC-ROUTE-${suffix}`,
      title: 'Case Discrepancies Route Test',
      court: 'Test Court',
    },
  });
  const deputy = await prisma.user.create({
    data: { caseId: kase.id, name: 'Deputy D', role: 'DEPUTY' },
  });
  // ADMITTED with no custody → an OPEN ADMITTED_NO_CUSTODIAN flag fires on the write.
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
  return { caseId: kase.id, exhibitId: exhibit.id };
}

function getRoute(caseId: string) {
  return GET(new NextRequest(`http://localhost/api/cases/${caseId}/discrepancies`), {
    params: Promise.resolve({ id: caseId }),
  });
}

const MISSING_ID = '00000000-0000-0000-0000-000000000000';

describe('GET /api/cases/:id/discrepancies', () => {
  let fx: Awaited<ReturnType<typeof seedFixture>>;

  beforeEach(async () => {
    fx = await seedFixture();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('returns the active discrepancy flags for the case as an array', async () => {
    const res = await getRoute(fx.caseId);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.some((f: { ruleCode: string }) => f.ruleCode === 'ADMITTED_NO_CUSTODIAN')).toBe(
      true,
    );
    // DTO shape: detectedAt is an ISO string.
    const flag = body.find((f: { ruleCode: string }) => f.ruleCode === 'ADMITTED_NO_CUSTODIAN');
    expect(typeof flag.detectedAt).toBe('string');
    expect(flag.exhibitId).toBe(fx.exhibitId);
  });

  it('returns 404 CASE_NOT_FOUND for an unknown case id', async () => {
    const res = await getRoute(MISSING_ID);
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('CASE_NOT_FOUND');
  });
});
