import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { GET } from '@/app/api/exhibits/[id]/route';

// Route-handler tests: import the GET handler directly and invoke it with a
// constructed NextRequest carrying the demo X-User-Role header — no running
// server needed. Backed by the real Postgres from docker-compose.yml. Proves the
// sealed-exhibit anti-enumeration guarantee holds at the HTTP layer: a
// sealed-unauthorized read and a genuinely-missing read must return byte-identical
// 404 bodies (threat T-02-05), not merely the same status code.

async function seedFixture() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const kase = await prisma.case.create({
    data: {
      caseNumber: `TEST-EXHIBIT-ROUTE-${suffix}`,
      title: 'Exhibit Route Test Case',
      court: 'Test Court',
    },
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
  return { caseId: kase.id, sealedId: sealed.id };
}

function getExhibitRoute(exhibitId: string, role?: string) {
  const headers = new Headers();
  if (role !== undefined) {
    headers.set('X-User-Role', role);
  }
  return GET(
    new NextRequest(`http://localhost/api/exhibits/${exhibitId}`, { headers }),
    { params: Promise.resolve({ id: exhibitId }) },
  );
}

const MISSING_ID = '00000000-0000-0000-0000-000000000000';

describe('GET /api/exhibits/:id sealed-exhibit visibility', () => {
  let fixture: Awaited<ReturnType<typeof seedFixture>>;

  beforeEach(async () => {
    fixture = await seedFixture();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('returns 200 with the exhibit body for a sealed exhibit read by JUDGE', async () => {
    const res = await getExhibitRoute(fixture.sealedId, 'JUDGE');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(fixture.sealedId);
    expect(body.isSealed).toBe(true);
  });

  it('returns 404 EXHIBIT_NOT_FOUND for a sealed exhibit read by ATTORNEY', async () => {
    const res = await getExhibitRoute(fixture.sealedId, 'ATTORNEY');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('EXHIBIT_NOT_FOUND');
  });

  it('returns byte-identical 404 bodies for sealed-unauthorized and genuinely-missing', async () => {
    const sealedUnauthorized = await getExhibitRoute(fixture.sealedId, 'ATTORNEY');
    const genuinelyMissing = await getExhibitRoute(MISSING_ID, 'ATTORNEY');

    expect(sealedUnauthorized.status).toBe(404);
    expect(genuinelyMissing.status).toBe(404);

    const sealedBody = await sealedUnauthorized.json();
    const missingBody = await genuinelyMissing.json();

    // Deep-equal, not just matching status — the two cases must be
    // indistinguishable to the client (anti-enumeration, T-02-05).
    expect(sealedBody).toEqual(missingBody);
  });

  it('a missing X-User-Role header fails closed: sealed exhibit returns 404', async () => {
    const res = await getExhibitRoute(fixture.sealedId, undefined);
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('EXHIBIT_NOT_FOUND');
  });
});
