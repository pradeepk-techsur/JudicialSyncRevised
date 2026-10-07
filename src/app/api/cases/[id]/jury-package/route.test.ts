import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { GET, POST } from '@/app/api/cases/[id]/jury-package/route';
import { recordStatusChange } from '@/services/status';
import { recordCustodyTransfer } from '@/services/custody';

// Route-handler tests for GET/POST /api/cases/:id/jury-package. Self-contained
// fixtures via live write paths; real Postgres from docker-compose.yml.

async function seedFixture() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const kase = await prisma.case.create({
    data: {
      caseNumber: `TEST-JURY-ROUTE-${suffix}`,
      title: 'Jury Package Route Test',
      court: 'Test Court',
    },
  });
  const deputy = await prisma.user.create({
    data: { caseId: kase.id, name: 'Deputy D', role: 'DEPUTY' },
  });
  const attorney = await prisma.user.create({
    data: { caseId: kase.id, name: 'Attorney A', role: 'ATTORNEY' },
  });

  // Clean admitted exhibit (custody recorded).
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

  // Flagged admitted exhibit (no custody → OPEN ADMITTED_NO_CUSTODIAN).
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

  return {
    caseId: kase.id,
    deputyId: deputy.id,
    attorneyId: attorney.id,
    cleanId: clean.id,
    flaggedId: flagged.id,
  };
}

function getRoute(caseId: string, role = 'DEPUTY') {
  const headers = new Headers();
  headers.set('X-User-Role', role);
  return GET(new NextRequest(`http://localhost/api/cases/${caseId}/jury-package`, { headers }), {
    params: Promise.resolve({ id: caseId }),
  });
}

function postRoute(caseId: string, body: unknown, role = 'DEPUTY') {
  const headers = new Headers({ 'content-type': 'application/json' });
  headers.set('X-User-Role', role);
  return POST(
    new NextRequest(`http://localhost/api/cases/${caseId}/jury-package`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers,
    }),
    { params: Promise.resolve({ id: caseId }) },
  );
}

describe('GET/POST /api/cases/:id/jury-package', () => {
  let fx: Awaited<ReturnType<typeof seedFixture>>;

  beforeEach(async () => {
    fx = await seedFixture();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('GET before initiate → 200 juryPackage:null and creates NOTHING', async () => {
    const res = await getRoute(fx.caseId);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.juryPackage).toBeNull();
    expect(body.exhibits).toEqual([]);

    const count = await prisma.juryPackage.count({ where: { caseId: fx.caseId } });
    expect(count).toBe(0);
  });

  it('POST (initiate) as DEPUTY → 201 DRAFT with rows carrying discrepancyStatus + flags[]', async () => {
    const res = await postRoute(fx.caseId, { actorUserId: fx.deputyId });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.juryPackage.status).toBe('DRAFT');
    expect(Array.isArray(body.exhibits)).toBe(true);

    const flaggedRow = body.exhibits.find(
      (e: { exhibitId: string }) => e.exhibitId === fx.flaggedId,
    );
    expect(flaggedRow.discrepancyStatus).toBe('FLAGGED');
    expect(Array.isArray(flaggedRow.flags)).toBe(true);
    expect(flaggedRow.flags[0].ruleCode).toBe('ADMITTED_NO_CUSTODIAN');
    expect(flaggedRow.flags[0].status).toBe('OPEN');

    const cleanRow = body.exhibits.find((e: { exhibitId: string }) => e.exhibitId === fx.cleanId);
    expect(cleanRow.discrepancyStatus).toBe('CLEAN');
    expect(cleanRow.flags).toEqual([]);
  });

  it('POST as ATTORNEY → 403 ROLE_NOT_PERMITTED', async () => {
    const res = await postRoute(fx.caseId, { actorUserId: fx.attorneyId }, 'ATTORNEY');
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('ROLE_NOT_PERMITTED');
  });

  it('GET after initiate → 200 with the non-null DRAFT and reconciled rows carrying flags[]', async () => {
    await postRoute(fx.caseId, { actorUserId: fx.deputyId });
    const res = await getRoute(fx.caseId);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.juryPackage).not.toBeNull();
    expect(body.juryPackage.status).toBe('DRAFT');
    const row = body.exhibits.find((e: { exhibitId: string }) => e.exhibitId === fx.flaggedId);
    expect(Array.isArray(row.flags)).toBe(true);
  });
});
