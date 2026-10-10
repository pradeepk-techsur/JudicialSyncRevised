import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DEMO_CASE_NUMBER } from '@/lib/constants';
import { GET } from '@/app/api/cases/[id]/exhibits/search/route';

// Route-handler tests for F4 Exhibit Search. Invoke GET directly with a
// constructed NextRequest carrying query params + X-User-Role — no running
// server. Runs against the deterministic Phase 1 seed (DEMO_CASE_NUMBER); the
// plan's verify step seeds the DB first.

function searchRoute(caseId: string, query: Record<string, string>, role?: string) {
  const headers = new Headers();
  if (role !== undefined) {
    headers.set('X-User-Role', role);
  }
  const qs = new URLSearchParams(query).toString();
  return GET(
    new NextRequest(`http://localhost/api/cases/${caseId}/exhibits/search?${qs}`, { headers }),
    { params: Promise.resolve({ id: caseId }) },
  );
}

describe('GET /api/cases/:id/exhibits/search', () => {
  let demoCaseId: string;

  beforeEach(async () => {
    const kase = await prisma.case.findUnique({
      where: { caseNumber: DEMO_CASE_NUMBER },
      select: { id: true },
    });
    if (!kase) {
      throw new Error(
        `Demo case ${DEMO_CASE_NUMBER} not seeded — run \`npx tsx src/data/seed.ts\` first`,
      );
    }
    demoCaseId = kase.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('returns 200 with ExhibitListRow[] for witness=Finch (matches P-3)', async () => {
    const res = await searchRoute(demoCaseId, { witness: 'Finch' }, 'JUDGE');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.map((r: { exhibitLabel: string }) => r.exhibitLabel)).toEqual(['P-3']);
    // Post-F12, P-3's admission is blocked, so it stops at OBJECTED and carries
    // no discrepancy flag (the admission gate makes either F6 precondition
    // unreachable on an ADMITTED exhibit). The composite ExhibitListRow shape is
    // still returned (never the raw `id`).
    expect(body[0]).toMatchObject({ currentStatus: 'OBJECTED' });
    expect(body[0].discrepancyFlags).toEqual([]);
    expect(body[0]).not.toHaveProperty('id');
  });

  it('juryPackageEligibility survives the HTTP round-trip for a known-state exhibit (P-3)', async () => {
    // P-3 is OBJECTED (admission-blocked post-F12), so it is never an ADMITTED
    // jury-package member → its eligibility is NOT_ELIGIBLE. Asserting the exact
    // value through the JSON response proves the additive field rides the route's
    // thin NextResponse.json(rows) pass-through with no route code change.
    const res = await searchRoute(demoCaseId, { witness: 'Finch' }, 'JUDGE');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0].exhibitLabel).toBe('P-3');
    expect(body[0].juryPackageEligibility).toBe('NOT_ELIGIBLE');
  });

  it('AND-combines filters: witness=Finch & status=OBJECTED matches P-3 (ADMITTED now matches nothing post-F12)', async () => {
    // P-3 is OBJECTED (admission blocked), so the ADMITTED combination matches
    // nothing while the OBJECTED combination still narrows to exactly P-3 —
    // keeping the AND-narrowing behavior covered.
    const admittedRes = await searchRoute(
      demoCaseId,
      { witness: 'Finch', status: 'ADMITTED' },
      'JUDGE',
    );
    expect(admittedRes.status).toBe(200);
    expect(await admittedRes.json()).toHaveLength(0);

    const objectedRes = await searchRoute(
      demoCaseId,
      { witness: 'Finch', status: 'OBJECTED' },
      'JUDGE',
    );
    expect(objectedRes.status).toBe(200);
    const body = await objectedRes.json();
    expect(body.map((r: { exhibitLabel: string }) => r.exhibitLabel)).toEqual(['P-3']);
  });

  it('returns 422 EMPTY_SEARCH_CRITERIA when no criteria are supplied', async () => {
    const res = await searchRoute(demoCaseId, {}, 'JUDGE');
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe('EMPTY_SEARCH_CRITERIA');
  });

  it('returns 422 INVALID_DATE_RANGE when dateFrom is after dateTo', async () => {
    const res = await searchRoute(
      demoCaseId,
      { dateFrom: '2026-12-31', dateTo: '2026-01-01' },
      'JUDGE',
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe('INVALID_DATE_RANGE');
  });

  it('returns 422 VALIDATION_ERROR for an invalid status value', async () => {
    const res = await searchRoute(demoCaseId, { status: 'NOT_A_STATUS' }, 'JUDGE');
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe('VALIDATION_ERROR');
  });

  it('excludes a sealed exhibit from results for ATTORNEY even on a matching keyword', async () => {
    const judgeRes = await searchRoute(demoCaseId, { keyword: 'sidebar' }, 'JUDGE');
    const judgeLabels = (await judgeRes.json()).map((r: { exhibitLabel: string }) => r.exhibitLabel);
    expect(judgeLabels).toContain('S-1');

    const attorneyRes = await searchRoute(demoCaseId, { keyword: 'sidebar' }, 'ATTORNEY');
    const attorneyLabels = (await attorneyRes.json()).map(
      (r: { exhibitLabel: string }) => r.exhibitLabel,
    );
    expect(attorneyLabels).not.toContain('S-1');
  });

  it('returns 404 CASE_NOT_FOUND for an unknown case id (with a criterion present)', async () => {
    const res = await searchRoute(
      '00000000-0000-0000-0000-000000000000',
      { keyword: 'anything' },
      'JUDGE',
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('CASE_NOT_FOUND');
  });
});
