import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { POST } from '@/app/api/jury-package/[id]/finalize/route';
import { initiateJuryPackage } from '@/services/juryPackage';
import { recordStatusChange } from '@/services/status';
import { recordCustodyTransfer } from '@/services/custody';
import { acknowledgeDiscrepancy, evaluateDiscrepancies } from '@/services/discrepancies';

// Route-handler tests for POST /api/jury-package/:id/finalize. Self-contained
// fixtures via live write paths; real Postgres from docker-compose.yml.

// Test-only bypass for the ADMITTED-transition step alone (see
// discrepancies.test.ts for the rationale). The `flagged` fixture is
// deliberately custody-less → OPEN ADMITTED_NO_CUSTODIAN flag, which is the
// entire point of this finalize-gate test. F12's live gate would block that
// admission, and finalize's fresh re-evaluation would silently resolve a
// synthetic flag if custody were added — so build the genuinely-firing
// precondition directly and re-evaluate.
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
      caseNumber: `TEST-FINALIZE-ROUTE-${suffix}`,
      title: 'Finalize Route Test',
      court: 'Test Court',
    },
  });
  const deputy = await prisma.user.create({
    data: { caseId: kase.id, name: 'Deputy D', role: 'DEPUTY' },
  });

  // Clean exhibit + flagged exhibit (no custody → OPEN flag).
  const clean = await prisma.exhibit.create({
    data: {
      caseId: kase.id,
      exhibitLabel: `A-clean-${suffix}`,
      description: 'clean',
      offeringParty: 'PROSECUTION',
    },
  });
  // Pattern A — establish custody BEFORE the ADMITTED call so F12's gate passes
  // (the real admission path, no bypass needed: this exhibit is meant to be clean).
  await recordStatusChange({ exhibitId: clean.id, toStatus: 'MARKED', actorUserId: deputy.id });
  await recordStatusChange({ exhibitId: clean.id, toStatus: 'OFFERED', actorUserId: deputy.id });
  await recordCustodyTransfer({
    exhibitId: clean.id,
    fromCustodianUserId: null,
    toCustodianUserId: deputy.id,
    actorUserId: deputy.id,
  });
  await recordStatusChange({ exhibitId: clean.id, toStatus: 'ADMITTED', actorUserId: deputy.id });

  const flagged = await prisma.exhibit.create({
    data: {
      caseId: kase.id,
      exhibitLabel: `B-flagged-${suffix}`,
      description: 'flagged',
      offeringParty: 'PROSECUTION',
    },
  });
  await recordStatusChange({ exhibitId: flagged.id, toStatus: 'MARKED', actorUserId: deputy.id });
  await recordStatusChange({ exhibitId: flagged.id, toStatus: 'OFFERED', actorUserId: deputy.id });
  // Pattern B — custody-less ADMITTED is the whole point of this fixture; bypass
  // the gate so the OPEN ADMITTED_NO_CUSTODIAN flag genuinely fires.
  await forceAdmitBypassingGate(flagged.id, kase.id, deputy.id);

  const { juryPackage } = await initiateJuryPackage(kase.id, deputy.id, 'DEPUTY');

  return {
    caseId: kase.id,
    deputyId: deputy.id,
    juryPackageId: juryPackage.id,
    flaggedId: flagged.id,
    flaggedLabel: `B-flagged-${suffix}`,
  };
}

function finalizeRoute(juryPackageId: string, body: unknown) {
  return POST(
    new NextRequest(`http://localhost/api/jury-package/${juryPackageId}/finalize`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }),
    { params: Promise.resolve({ id: juryPackageId }) },
  );
}

describe('POST /api/jury-package/:id/finalize', () => {
  let fx: Awaited<ReturnType<typeof seedFixture>>;

  beforeEach(async () => {
    fx = await seedFixture();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('blocked by an OPEN flag → 409 JURY_PACKAGE_DISCREPANCIES_OPEN naming the blocker', async () => {
    const res = await finalizeRoute(fx.juryPackageId, { actorUserId: fx.deputyId });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe('JURY_PACKAGE_DISCREPANCIES_OPEN');
    const blockers = body.error.details.blockingExhibits as {
      exhibitLabel: string;
      ruleCodes: string[];
    }[];
    const blocker = blockers.find((b) => b.exhibitLabel === fx.flaggedLabel);
    expect(blocker).toBeTruthy();
    expect(blocker!.ruleCodes).toContain('ADMITTED_NO_CUSTODIAN');
  });

  it('succeeds once the blocking flag is acknowledged → 200 FINALIZED', async () => {
    const flag = await prisma.discrepancyFlag.findFirstOrThrow({
      where: { exhibitId: fx.flaggedId, status: 'OPEN' },
    });
    await acknowledgeDiscrepancy({
      discrepancyFlagId: flag.id,
      actorUserId: fx.deputyId,
      justification: 'custodian assigned at recess',
    });

    const res = await finalizeRoute(fx.juryPackageId, { actorUserId: fx.deputyId });
    expect(res.status).toBe(200);
    expect((await res.json()).juryPackage.status).toBe('FINALIZED');
  });

  it('re-finalize → 409 JURY_PACKAGE_ALREADY_FINALIZED', async () => {
    const flag = await prisma.discrepancyFlag.findFirstOrThrow({
      where: { exhibitId: fx.flaggedId, status: 'OPEN' },
    });
    await acknowledgeDiscrepancy({
      discrepancyFlagId: flag.id,
      actorUserId: fx.deputyId,
      justification: 'ack',
    });
    await finalizeRoute(fx.juryPackageId, { actorUserId: fx.deputyId });

    const res = await finalizeRoute(fx.juryPackageId, { actorUserId: fx.deputyId });
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe('JURY_PACKAGE_ALREADY_FINALIZED');
  });
});
