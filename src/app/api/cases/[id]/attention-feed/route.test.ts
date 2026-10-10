import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createExhibit } from '@/services/exhibits';
import { recordStatusChange } from '@/services/status';
import { recordObjection } from '@/services/objections';
import * as attentionFeedService from '@/services/attentionFeed';
import { GET } from '@/app/api/cases/[id]/attention-feed/route';

// Route-handler tests: invoke GET directly with a constructed NextRequest
// carrying the demo X-User-Role header — no running server needed. Backed by the
// real Postgres; self-contained fixture via live write paths. Proves the 200
// happy-path shape and the 500 → ATTENTION_FEED_LOAD_FAILED fallback (the NEW
// code this endpoint introduces per F08 §Error States).

function attentionRoute(caseId: string, role?: string) {
  const headers = new Headers();
  if (role !== undefined) headers.set('X-User-Role', role);
  return GET(
    new NextRequest(`http://localhost/api/cases/${caseId}/attention-feed`, { headers }),
    { params: Promise.resolve({ id: caseId }) },
  );
}

describe('GET /api/cases/:id/attention-feed', () => {
  let caseId: string;
  let pendingExhibitId: string;

  beforeAll(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const kase = await prisma.case.create({
      data: {
        caseNumber: `TEST-ATTENTION-ROUTE-${suffix}`,
        title: 'Attention Feed Route Test',
        court: 'Test Court',
      },
    });
    caseId = kase.id;

    const judge = await prisma.user.create({ data: { caseId, name: 'Judge R', role: 'JUDGE' } });
    const deputy = await prisma.user.create({ data: { caseId, name: 'Deputy R', role: 'DEPUTY' } });

    // A PENDING-tier exhibit: OFFERED with an unresolved objection.
    const pending = await createExhibit({
      caseId,
      exhibitLabel: `PEND-ROUTE-${suffix}`,
      description: 'unresolved objection, not admitted',
      offeringParty: 'PLAINTIFF',
    });
    pendingExhibitId = pending.id;
    await recordStatusChange({ exhibitId: pendingExhibitId, toStatus: 'MARKED', actorUserId: deputy.id });
    await recordStatusChange({ exhibitId: pendingExhibitId, toStatus: 'OFFERED', actorUserId: deputy.id });
    await recordObjection({
      exhibitId: pendingExhibitId,
      objectingParty: 'DEFENSE',
      grounds: 'Relevance',
      actorUserId: judge.id,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('returns 200 with an AttentionFeedEntry[] body carrying the documented fields', async () => {
    const res = await attentionRoute(caseId, 'JUDGE');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);

    const pend = body.find((e: { exhibitId: string }) => e.exhibitId === pendingExhibitId);
    expect(pend).toBeDefined();
    expect(pend.tier).toBe('PENDING');
    expect(pend.availableAction).toBe('RECORD_RULING');
    expect(typeof pend.summary).toBe('string');
    expect(typeof pend.detectedAt).toBe('string');
  });

  it('returns 500 ATTENTION_FEED_LOAD_FAILED when the service throws', async () => {
    vi.spyOn(attentionFeedService, 'getAttentionFeed').mockRejectedValueOnce(new Error('boom'));
    const res = await attentionRoute(caseId, 'JUDGE');
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('ATTENTION_FEED_LOAD_FAILED');
  });
});
