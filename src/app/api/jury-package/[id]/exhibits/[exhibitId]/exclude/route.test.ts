import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { POST } from '@/app/api/jury-package/[id]/exhibits/[exhibitId]/exclude/route';
import { GET as caseJuryGET } from '@/app/api/cases/[id]/jury-package/route';
import { recordStatusChange } from '@/services/status';
import { recordCustodyTransfer } from '@/services/custody';

// Route-handler tests for POST /api/jury-package/:id/exhibits/:exhibitId/exclude
// (F13). Self-contained fixtures via live write paths + a direct legacy-row
// insert; real Postgres from docker-compose.yml.

// Directly write the ADMITTED STATUS_CHANGE + projection for an exhibit,
// bypassing the F12 admission gate (plan 07-01/07-02). Used to create a
// sealed-but-ADMITTED exhibit — a state the normal admission path still permits
// (sealing doesn't block admission) but kept here explicit for parity with the
// finalize-route fixture's direct-write convention.
async function admitDirect(exhibitId: string, caseId: string, actorUserId: string): Promise<void> {
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
}

async function seedFixture() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const kase = await prisma.case.create({
    data: {
      caseNumber: `TEST-EXCLUDE-ROUTE-${suffix}`,
      title: 'Exclude Route Test',
      court: 'Test Court',
    },
  });
  const deputy = await prisma.user.create({
    data: { caseId: kase.id, name: 'Deputy D', role: 'DEPUTY' },
  });
  const attorney = await prisma.user.create({
    data: { caseId: kase.id, name: 'Attorney A', role: 'ATTORNEY' },
  });

  // A sealed, gate-compliant-ADMITTED exhibit (custody established before ADMIT).
  const sealed = await prisma.exhibit.create({
    data: {
      caseId: kase.id,
      exhibitLabel: `S-sealed-${suffix}`,
      description: 'sealed ex parte',
      offeringParty: 'PROSECUTION',
      isSealed: true,
    },
  });
  await recordStatusChange({ exhibitId: sealed.id, toStatus: 'MARKED', actorUserId: deputy.id });
  await recordStatusChange({ exhibitId: sealed.id, toStatus: 'OFFERED', actorUserId: deputy.id });
  await recordCustodyTransfer({
    exhibitId: sealed.id,
    fromCustodianUserId: null,
    toCustodianUserId: deputy.id,
    actorUserId: deputy.id,
  });
  await admitDirect(sealed.id, kase.id, deputy.id);

  // A DRAFT package with a LEGACY JuryPackageExhibit row for the sealed exhibit —
  // inserted directly because, post-07-03, the normal initiate/reconcile path can
  // no longer create a membership row for a sealed exhibit. This is exactly the
  // data-predating-the-fix scenario F13 remediates.
  const juryPackage = await prisma.juryPackage.create({
    data: { caseId: kase.id, status: 'DRAFT' },
  });
  const legacyRow = await prisma.juryPackageExhibit.create({
    data: {
      juryPackageId: juryPackage.id,
      exhibitId: sealed.id,
      discrepancyStatus: 'CLEAN',
      status: 'INCLUDED',
    },
  });

  return {
    caseId: kase.id,
    deputyId: deputy.id,
    attorneyId: attorney.id,
    sealedId: sealed.id,
    juryPackageId: juryPackage.id,
    legacyRowId: legacyRow.id,
  };
}

function excludeRoute(juryPackageId: string, exhibitId: string, body: unknown) {
  return POST(
    new NextRequest(
      `http://localhost/api/jury-package/${juryPackageId}/exhibits/${exhibitId}/exclude`,
      {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
      },
    ),
    { params: Promise.resolve({ id: juryPackageId, exhibitId }) },
  );
}

describe('POST /api/jury-package/:id/exhibits/:exhibitId/exclude', () => {
  let fx: Awaited<ReturnType<typeof seedFixture>>;

  beforeEach(async () => {
    fx = await seedFixture();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('happy path: DEPUTY excludes an INCLUDED row → 200, status EXCLUDED, audit fields + event', async () => {
    const res = await excludeRoute(fx.juryPackageId, fx.sealedId, {
      actorUserId: fx.deputyId,
      reason: 'SEALED_EXPARTE',
    });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.juryPackageExhibit.status).toBe('EXCLUDED');
    expect(body.juryPackageExhibit.excludedAt).toBeTruthy();
    expect(body.juryPackageExhibit.excludedBy).toBe(fx.deputyId);
    expect(body.juryPackageExhibit.exclusionReason).toBe('SEALED_EXPARTE');
    expect(body.event.eventType).toBe('JURY_PACKAGE_EXHIBIT_EXCLUDED');
  });

  it('404 JURY_PACKAGE_EXHIBIT_NOT_FOUND: exhibit not currently INCLUDED', async () => {
    // Exclude once (row → EXCLUDED), then try again → no INCLUDED row remains.
    await excludeRoute(fx.juryPackageId, fx.sealedId, {
      actorUserId: fx.deputyId,
      reason: 'SEALED_EXPARTE',
    });
    const res = await excludeRoute(fx.juryPackageId, fx.sealedId, {
      actorUserId: fx.deputyId,
      reason: 'SEALED_EXPARTE',
    });
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('JURY_PACKAGE_EXHIBIT_NOT_FOUND');
  });

  it('409 JURY_PACKAGE_ALREADY_FINALIZED: excluding from a FINALIZED package', async () => {
    await prisma.juryPackage.update({
      where: { id: fx.juryPackageId },
      data: { status: 'FINALIZED', finalizedAt: new Date(), finalizedBy: fx.deputyId },
    });
    const res = await excludeRoute(fx.juryPackageId, fx.sealedId, {
      actorUserId: fx.deputyId,
      reason: 'SEALED_EXPARTE',
    });
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe('JURY_PACKAGE_ALREADY_FINALIZED');
  });

  it('403 ROLE_NOT_PERMITTED: an ATTORNEY attempting to exclude', async () => {
    const res = await excludeRoute(fx.juryPackageId, fx.sealedId, {
      actorUserId: fx.attorneyId,
      reason: 'SEALED_EXPARTE',
    });
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('ROLE_NOT_PERMITTED');
  });

  it('row retained, never deleted: after exclude the row still exists as EXCLUDED', async () => {
    await excludeRoute(fx.juryPackageId, fx.sealedId, {
      actorUserId: fx.deputyId,
      reason: 'MANUAL_REMOVAL',
    });
    const retained = await prisma.juryPackageExhibit.findUnique({
      where: { id: fx.legacyRowId },
    });
    expect(retained).not.toBeNull();
    expect(retained!.status).toBe('EXCLUDED');
    expect(retained!.exclusionReason).toBe('MANUAL_REMOVAL');
  });

  it('GET /api/cases/:id/jury-package never returns the excluded row afterward', async () => {
    await excludeRoute(fx.juryPackageId, fx.sealedId, {
      actorUserId: fx.deputyId,
      reason: 'SEALED_EXPARTE',
    });
    const headers = new Headers();
    headers.set('X-User-Role', 'ADMIN'); // full visibility — sealed row would be visible if present
    const getRes = await caseJuryGET(
      new NextRequest(`http://localhost/api/cases/${fx.caseId}/jury-package`, { headers }),
      { params: Promise.resolve({ id: fx.caseId }) },
    );
    const body = await getRes.json();
    expect(
      body.exhibits.some((e: { exhibitId: string }) => e.exhibitId === fx.sealedId),
    ).toBe(false);
  });
});
