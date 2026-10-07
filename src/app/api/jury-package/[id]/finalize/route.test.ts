import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { POST } from '@/app/api/jury-package/[id]/finalize/route';
import { initiateJuryPackage } from '@/services/juryPackage';
import { recordStatusChange } from '@/services/status';
import { recordCustodyTransfer } from '@/services/custody';
import { acknowledgeDiscrepancy } from '@/services/discrepancies';

// Route-handler tests for POST /api/jury-package/:id/finalize. Self-contained
// fixtures via live write paths; real Postgres from docker-compose.yml.

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
  await recordStatusChange({ exhibitId: clean.id, toStatus: 'MARKED', actorUserId: deputy.id });
  await recordStatusChange({ exhibitId: clean.id, toStatus: 'OFFERED', actorUserId: deputy.id });
  await recordStatusChange({ exhibitId: clean.id, toStatus: 'ADMITTED', actorUserId: deputy.id });
  await recordCustodyTransfer({
    exhibitId: clean.id,
    fromCustodianUserId: null,
    toCustodianUserId: deputy.id,
    actorUserId: deputy.id,
  });

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
  await recordStatusChange({ exhibitId: flagged.id, toStatus: 'ADMITTED', actorUserId: deputy.id });

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
