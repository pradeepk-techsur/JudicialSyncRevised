import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { GET } from '@/app/api/exhibits/[id]/history/route';

// Route-handler tests for GET /api/exhibits/:id/history. Mirrors the single
// exhibit route test: the history route inherits sealed-masking from
// getExhibitHistory → getExhibit, and must return byte-identical 404 bodies for
// sealed-unauthorized and genuinely-missing (anti-enumeration, threat T-02-05).
// Backed by the real Postgres from docker-compose.yml.

async function seedFixture() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const kase = await prisma.case.create({
    data: {
      caseNumber: `TEST-HISTORY-ROUTE-${suffix}`,
      title: 'History Route Test Case',
      court: 'Test Court',
    },
  });
  const actor = await prisma.user.create({
    data: { caseId: kase.id, name: 'Test Deputy', role: 'DEPUTY' },
  });
  const sealed = await prisma.exhibit.create({
    data: {
      caseId: kase.id,
      exhibitLabel: `Sealed ${suffix}`,
      description: 'A sealed exhibit — restricted visibility',
      offeringParty: 'PROSECUTION',
      isSealed: true,
    },
  });
  // One ledger event so an authorized history read has a non-empty timeline —
  // proving the null for an unauthorized role is masking, not an empty history.
  await prisma.exhibitEvent.create({
    data: {
      exhibitId: sealed.id,
      caseId: kase.id,
      eventType: 'STATUS_CHANGE',
      payload: { fromStatus: null, toStatus: 'MARKED' },
      actorUserId: actor.id,
      sequenceNo: 1,
    },
  });
  return { caseId: kase.id, sealedId: sealed.id };
}

function getHistoryRoute(exhibitId: string, role?: string) {
  const headers = new Headers();
  if (role !== undefined) {
    headers.set('X-User-Role', role);
  }
  return GET(
    new NextRequest(`http://localhost/api/exhibits/${exhibitId}/history`, { headers }),
    { params: Promise.resolve({ id: exhibitId }) },
  );
}

const MISSING_ID = '00000000-0000-0000-0000-000000000000';

describe('GET /api/exhibits/:id/history sealed-exhibit visibility', () => {
  let fixture: Awaited<ReturnType<typeof seedFixture>>;

  beforeEach(async () => {
    fixture = await seedFixture();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('returns 200 with a populated timeline for a sealed exhibit read by JUDGE', async () => {
    const res = await getHistoryRoute(fixture.sealedId, 'JUDGE');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.exhibit.id).toBe(fixture.sealedId);
    expect(Array.isArray(body.timeline)).toBe(true);
    expect(body.timeline.length).toBeGreaterThan(0);
  });

  it('returns 404 EXHIBIT_NOT_FOUND for a sealed exhibit read by ATTORNEY', async () => {
    const res = await getHistoryRoute(fixture.sealedId, 'ATTORNEY');
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('EXHIBIT_NOT_FOUND');
  });

  it('returns byte-identical 404 bodies for sealed-unauthorized and genuinely-missing', async () => {
    const sealedUnauthorized = await getHistoryRoute(fixture.sealedId, 'ATTORNEY');
    const genuinelyMissing = await getHistoryRoute(MISSING_ID, 'ATTORNEY');

    expect(sealedUnauthorized.status).toBe(404);
    expect(genuinelyMissing.status).toBe(404);

    const sealedBody = await sealedUnauthorized.json();
    const missingBody = await genuinelyMissing.json();

    // Deep-equal, not just matching status — indistinguishable to the client.
    expect(sealedBody).toEqual(missingBody);
  });

  it('a missing X-User-Role header fails closed: sealed history returns 404', async () => {
    const res = await getHistoryRoute(fixture.sealedId, undefined);
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('EXHIBIT_NOT_FOUND');
  });
});
