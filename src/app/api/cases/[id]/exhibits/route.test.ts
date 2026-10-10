import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { GET } from '@/app/api/cases/[id]/exhibits/route';

// Route-handler tests: invoke the GET handler directly with a constructed
// NextRequest carrying the demo X-User-Role header — no running server needed.
// Backed by the real Postgres from docker-compose.yml. Proves the response body
// is the ExhibitListRow[] shape, sealed exclusion by role, and CASE_NOT_FOUND.

async function seedFixture() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const kase = await prisma.case.create({
    data: {
      caseNumber: `TEST-EXHIBITS-ROUTE-${suffix}`,
      title: 'Exhibits List Route Test Case',
      court: 'Test Court',
    },
  });
  const visible = await prisma.exhibit.create({
    data: {
      caseId: kase.id,
      exhibitLabel: `A-Visible ${suffix}`,
      description: 'An ordinary visible exhibit',
      offeringParty: 'DEFENSE',
    },
  });
  const sealed = await prisma.exhibit.create({
    data: {
      caseId: kase.id,
      exhibitLabel: `Z-Sealed ${suffix}`,
      description: 'A sealed exhibit — restricted visibility',
      offeringParty: 'PROSECUTION',
      isSealed: true,
    },
  });
  // A jury-package member (INCLUDED + FLAGGED) so juryPackageEligibility has a
  // known non-default value (BLOCKED) to prove it survives the HTTP round-trip —
  // not merely the NOT_ELIGIBLE default every exhibit would carry anyway.
  const pkg = await prisma.juryPackage.create({
    data: { caseId: kase.id, status: 'DRAFT' },
  });
  await prisma.juryPackageExhibit.create({
    data: { juryPackageId: pkg.id, exhibitId: visible.id, discrepancyStatus: 'FLAGGED' },
  });
  return { caseId: kase.id, visibleId: visible.id, sealedId: sealed.id };
}

function listExhibitsRoute(caseId: string, role?: string) {
  const headers = new Headers();
  if (role !== undefined) {
    headers.set('X-User-Role', role);
  }
  return GET(
    new NextRequest(`http://localhost/api/cases/${caseId}/exhibits`, { headers }),
    { params: Promise.resolve({ id: caseId }) },
  );
}

const MISSING_ID = '00000000-0000-0000-0000-000000000000';

describe('GET /api/cases/:id/exhibits', () => {
  let fixture: Awaited<ReturnType<typeof seedFixture>>;

  beforeEach(async () => {
    fixture = await seedFixture();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('returns 200 with ExhibitListRow[] shape (not raw Exhibit rows)', async () => {
    const res = await listExhibitsRoute(fixture.caseId, 'JUDGE');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    const row = body.find((r: { exhibitId: string }) => r.exhibitId === fixture.visibleId);
    expect(row).toBeDefined();
    // ExhibitListRow keys — exhibitId (not id), plus the composite columns.
    expect(row).toMatchObject({
      exhibitId: fixture.visibleId,
      offeringParty: 'DEFENSE',
      currentStatus: null,
      currentCustodianName: null,
      discrepancyFlags: [],
      // Additive Phase-8 Flags-column booleans survive the HTTP round-trip.
      hasUnresolvedObjection: false,
      isSealed: false,
    });
    expect(row).not.toHaveProperty('id');
  });

  it('juryPackageEligibility rides the HTTP JSON response for a known membership state (route needs no code change)', async () => {
    // visibleId is an INCLUDED + FLAGGED member of the case's one jury package
    // (seeded above), so its eligibility is BLOCKED. Proving it arrives intact
    // through NextResponse.json confirms the route's thin pass-through carries
    // the additive field automatically — no route code change required.
    const res = await listExhibitsRoute(fixture.caseId, 'JUDGE');
    expect(res.status).toBe(200);
    const body = await res.json();
    const row = body.find((r: { exhibitId: string }) => r.exhibitId === fixture.visibleId);
    expect(row.juryPackageEligibility).toBe('BLOCKED');
  });

  it('includes a sealed exhibit for JUDGE but excludes it for ATTORNEY', async () => {
    const judgeRes = await listExhibitsRoute(fixture.caseId, 'JUDGE');
    const judgeIds = (await judgeRes.json()).map((r: { exhibitId: string }) => r.exhibitId);
    expect(judgeIds).toContain(fixture.sealedId);

    const attorneyRes = await listExhibitsRoute(fixture.caseId, 'ATTORNEY');
    const attorneyIds = (await attorneyRes.json()).map((r: { exhibitId: string }) => r.exhibitId);
    expect(attorneyIds).not.toContain(fixture.sealedId);
    expect(attorneyIds).toContain(fixture.visibleId);
  });

  it('returns rows ordered by exhibitLabel ascending', async () => {
    const res = await listExhibitsRoute(fixture.caseId, 'JUDGE');
    const labels = (await res.json()).map((r: { exhibitLabel: string }) => r.exhibitLabel);
    const sorted = [...labels].sort();
    expect(labels).toEqual(sorted);
  });

  it('returns 404 CASE_NOT_FOUND for an unknown case id', async () => {
    const res = await listExhibitsRoute(MISSING_ID, 'JUDGE');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('CASE_NOT_FOUND');
  });
});
