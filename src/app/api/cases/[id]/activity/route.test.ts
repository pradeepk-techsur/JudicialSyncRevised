import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createExhibit } from '@/services/exhibits';
import { recordStatusChange } from '@/services/status';
import { GET } from '@/app/api/cases/[id]/activity/route';

// Route-handler tests: invoke GET directly with a constructed NextRequest
// carrying the demo X-User-Role header — no running server needed. Backed by the
// real Postgres. The fixture case is self-contained (unique caseNumber, built via
// the live service write paths) so it never collides with the shared seed under
// fileParallelism:false. Proves the `{ recentActivity, statusCounts }` shape
// (08-10 wired statusCounts into the route), newest-first ordering, sealed
// absence (absent, not 404), and 422 for bad/future `since`.

function activityRoute(caseId: string, role?: string, since?: string) {
  const headers = new Headers();
  if (role !== undefined) headers.set('X-User-Role', role);
  const qs = since !== undefined ? `?since=${encodeURIComponent(since)}` : '';
  return GET(
    new NextRequest(`http://localhost/api/cases/${caseId}/activity${qs}`, { headers }),
    { params: Promise.resolve({ id: caseId }) },
  );
}

describe('GET /api/cases/:id/activity', () => {
  let caseId: string;
  let visibleExhibitId: string;
  let sealedEventId: string;

  beforeAll(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const kase = await prisma.case.create({
      data: {
        caseNumber: `TEST-ACTIVITY-ROUTE-${suffix}`,
        title: 'Recent Activity Route Test Case',
        court: 'Test Court',
      },
    });
    caseId = kase.id;

    const actor = await prisma.user.create({
      data: { caseId, name: 'Judge Route Fixture', role: 'JUDGE' },
    });
    const actorUserId = actor.id;

    const visible = await createExhibit({
      caseId,
      exhibitLabel: `A-Visible ${suffix}`,
      description: 'An ordinary visible exhibit',
      offeringParty: 'DEFENSE',
    });
    visibleExhibitId = visible.id;
    await recordStatusChange({ exhibitId: visibleExhibitId, toStatus: 'MARKED', actorUserId });
    await recordStatusChange({ exhibitId: visibleExhibitId, toStatus: 'OFFERED', actorUserId });

    const sealed = await createExhibit({
      caseId,
      exhibitLabel: `Z-Sealed ${suffix}`,
      description: 'A sealed exhibit — restricted visibility',
      offeringParty: 'PROSECUTION',
      isSealed: true,
    });
    const sealedResult = await recordStatusChange({
      exhibitId: sealed.id,
      toStatus: 'MARKED',
      actorUserId,
    });
    sealedEventId = sealedResult.event.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('returns 200 with a newest-first recentActivity array + a full statusCounts map', async () => {
    const res = await activityRoute(caseId, 'JUDGE');
    expect(res.status).toBe(200);
    const body = await res.json();

    // 08-10: the route now returns `{ recentActivity, statusCounts }`, not a
    // bare array.
    expect(Array.isArray(body.recentActivity)).toBe(true);
    expect(body.recentActivity.length).toBeGreaterThanOrEqual(2);

    for (const entry of body.recentActivity) {
      expect(Object.keys(entry).sort()).toEqual(
        ['eventId', 'eventType', 'exhibitId', 'exhibitLabel', 'summary', 'recordedAt'].sort(),
      );
      expect(typeof entry.recordedAt).toBe('string');
      expect(new Date(entry.recordedAt).toISOString()).toBe(entry.recordedAt);
    }

    const times = body.recentActivity.map((e: { recordedAt: string }) =>
      new Date(e.recordedAt).getTime(),
    );
    const sortedDesc = [...times].sort((a: number, b: number) => b - a);
    expect(times).toEqual(sortedDesc);

    // statusCounts is present with ALL 6 ExhibitStatus keys, every value a
    // number (zero-filled where no exhibit holds that status).
    expect(body.statusCounts).toBeTypeOf('object');
    expect(Object.keys(body.statusCounts).sort()).toEqual(
      ['MARKED', 'OFFERED', 'OBJECTED', 'ADMITTED', 'EXCLUDED', 'WITHDRAWN'].sort(),
    );
    for (const key of Object.keys(body.statusCounts)) {
      expect(typeof body.statusCounts[key]).toBe('number');
    }
    // This fixture advanced its visible exhibit MARKED→OFFERED, so OFFERED≥1.
    expect(body.statusCounts.OFFERED).toBeGreaterThanOrEqual(1);
  });

  it('includes the sealed event for JUDGE but is absent (not 404) for ATTORNEY', async () => {
    const judgeRes = await activityRoute(caseId, 'JUDGE');
    const judgeIds = (await judgeRes.json()).recentActivity.map(
      (e: { eventId: string }) => e.eventId,
    );
    expect(judgeIds).toContain(sealedEventId);

    const attorneyRes = await activityRoute(caseId, 'ATTORNEY');
    // Still 200 — the sealed event is simply absent, never an error/redacted row.
    expect(attorneyRes.status).toBe(200);
    const attorneyBody = await attorneyRes.json();
    const attorneyIds = attorneyBody.recentActivity.map((e: { eventId: string }) => e.eventId);
    expect(attorneyIds).not.toContain(sealedEventId);
    expect(
      attorneyBody.recentActivity.some(
        (e: { exhibitId: string }) => e.exhibitId === visibleExhibitId,
      ),
    ).toBe(true);
  });

  it('returns 422 VALIDATION_ERROR for a non-ISO `since`', async () => {
    const res = await activityRoute(caseId, 'JUDGE', 'not-a-date');
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 VALIDATION_ERROR for a future `since`', async () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const res = await activityRoute(caseId, 'JUDGE', future);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('populates the default window (no `since`) with ≥1 entry', async () => {
    const res = await activityRoute(caseId, 'JUDGE');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.recentActivity.length).toBeGreaterThanOrEqual(1);
  });
});
