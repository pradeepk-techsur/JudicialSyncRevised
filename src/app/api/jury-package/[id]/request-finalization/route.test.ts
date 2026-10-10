import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { POST } from '@/app/api/jury-package/[id]/request-finalization/route';
import { initiateJuryPackage } from '@/services/juryPackage';
import { recordStatusChange } from '@/services/status';
import { recordCustodyTransfer } from '@/services/custody';
import { evaluateDiscrepancies } from '@/services/discrepancies';

// Route-handler tests for POST /api/jury-package/:id/request-finalization (F11).
// Self-contained fixtures via live write paths; real Postgres from
// docker-compose.yml. The DRAFT carries a genuinely-blocking exhibit (custody-
// less ADMITTED → OPEN ADMITTED_NO_CUSTODIAN flag) so the request-finalization
// scenario matches F11's "DRAFT with open blockers" precondition.

// Test-only bypass for the ADMITTED-transition step alone (mirrors
// finalize/route.test.ts): the F12 live gate would block a custody-less
// admission, but a genuinely custody-less ADMITTED exhibit is exactly the
// blocked DRAFT shape this test needs.
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
      caseNumber: `TEST-REQUEST-FINALIZATION-${suffix}`,
      title: 'Request Finalization Route Test',
      court: 'Test Court',
    },
  });
  const judge = await prisma.user.create({
    data: { caseId: kase.id, name: 'Judge J', role: 'JUDGE' },
  });
  const attorney = await prisma.user.create({
    data: { caseId: kase.id, name: 'Attorney A', role: 'ATTORNEY' },
  });
  const deputy = await prisma.user.create({
    data: { caseId: kase.id, name: 'Deputy D', role: 'DEPUTY' },
  });

  // A clean admitted exhibit (so the package has an eligible member) ...
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
  await recordCustodyTransfer({
    exhibitId: clean.id,
    fromCustodianUserId: null,
    toCustodianUserId: deputy.id,
    actorUserId: deputy.id,
  });
  await recordStatusChange({ exhibitId: clean.id, toStatus: 'ADMITTED', actorUserId: deputy.id });

  // ... plus a custody-less ADMITTED exhibit → OPEN blocker, so the DRAFT is
  // genuinely "not ready to finalize" (the F11 request-finalization scenario).
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
  await forceAdmitBypassingGate(flagged.id, kase.id, deputy.id);

  const { juryPackage } = await initiateJuryPackage(kase.id, deputy.id, 'DEPUTY');

  return {
    caseId: kase.id,
    judgeId: judge.id,
    attorneyId: attorney.id,
    deputyId: deputy.id,
    juryPackageId: juryPackage.id,
  };
}

function requestRoute(juryPackageId: string, body: unknown) {
  return POST(
    new NextRequest(
      `http://localhost/api/jury-package/${juryPackageId}/request-finalization`,
      {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
      },
    ),
    { params: Promise.resolve({ id: juryPackageId }) },
  );
}

describe('POST /api/jury-package/:id/request-finalization', () => {
  let fx: Awaited<ReturnType<typeof seedFixture>>;

  beforeEach(async () => {
    fx = await seedFixture();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('a JUDGE requests finalization on a DRAFT with blockers → 200, fields set', async () => {
    const res = await requestRoute(fx.juryPackageId, { actorUserId: fx.judgeId });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.juryPackage.finalizationRequestedBy).toBe(fx.judgeId);
    expect(body.juryPackage.finalizationRequestedAt).not.toBeNull();

    // Persisted, so a finalize-authorized viewer sees it on the next GET.
    const persisted = await prisma.juryPackage.findUniqueOrThrow({
      where: { id: fx.juryPackageId },
    });
    expect(persisted.finalizationRequestedBy).toBe(fx.judgeId);
    expect(persisted.finalizationRequestedAt).not.toBeNull();
  });

  it('a DEPUTY (already finalize-authorized) requesting → 403 ROLE_NOT_PERMITTED', async () => {
    const res = await requestRoute(fx.juryPackageId, { actorUserId: fx.deputyId });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('ROLE_NOT_PERMITTED');

    // The over-authorized request stamped nothing.
    const persisted = await prisma.juryPackage.findUniqueOrThrow({
      where: { id: fx.juryPackageId },
    });
    expect(persisted.finalizationRequestedBy).toBeNull();
  });

  it('requesting on an already-FINALIZED package → 409 JURY_PACKAGE_ALREADY_FINALIZED', async () => {
    // Force the package to FINALIZED directly (the gate/finalize path is tested
    // elsewhere; here we only need the terminal state).
    await prisma.juryPackage.update({
      where: { id: fx.juryPackageId },
      data: { status: 'FINALIZED', finalizedAt: new Date(), finalizedBy: fx.deputyId },
    });

    const res = await requestRoute(fx.juryPackageId, { actorUserId: fx.judgeId });
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe('JURY_PACKAGE_ALREADY_FINALIZED');
  });

  it('a second request from a different non-authorized role overwrites the first', async () => {
    await requestRoute(fx.juryPackageId, { actorUserId: fx.judgeId });
    const res = await requestRoute(fx.juryPackageId, { actorUserId: fx.attorneyId });
    expect(res.status).toBe(200);

    const persisted = await prisma.juryPackage.findUniqueOrThrow({
      where: { id: fx.juryPackageId },
    });
    // Newest requester wins — at most one outstanding request is tracked.
    expect(persisted.finalizationRequestedBy).toBe(fx.attorneyId);
  });
});
