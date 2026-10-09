import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createExhibit } from '@/services/exhibits';
import { recordStatusChange } from '@/services/status';
import { recordCustodyTransfer } from '@/services/custody';
import * as custodyByCustodianService from '@/services/custodyByCustodian';
import { GET } from '@/app/api/cases/[id]/custody-by-custodian/route';

// Route-handler tests: invoke GET directly with a constructed NextRequest
// carrying the demo X-User-Role header — no running server needed. Backed by the
// real Postgres. Self-contained fixture (unique caseNumber) via live write paths.
// Proves the documented shape + 200 happy path, and the 500 → COMMAND_CENTER_
// LOAD_FAILED fallback when the underlying service throws (no custody-specific
// error code is introduced for this panel per F08 §Error States).

function custodyRoute(caseId: string, role?: string) {
  const headers = new Headers();
  if (role !== undefined) headers.set('X-User-Role', role);
  return GET(
    new NextRequest(`http://localhost/api/cases/${caseId}/custody-by-custodian`, { headers }),
    { params: Promise.resolve({ id: caseId }) },
  );
}

describe('GET /api/cases/:id/custody-by-custodian', () => {
  let caseId: string;
  let custodianId: string;
  let exhibitWithCustodyId: string;
  let exhibitNoCustodyId: string;

  beforeAll(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const kase = await prisma.case.create({
      data: {
        caseNumber: `TEST-CUSTODY-GLANCE-ROUTE-${suffix}`,
        title: 'Custody-by-Custodian Route Test',
        court: 'Test Court',
      },
    });
    caseId = kase.id;

    const custodian = await prisma.user.create({
      data: { caseId, name: 'Deputy Route', role: 'DEPUTY' },
    });
    custodianId = custodian.id;

    const withCustody = await createExhibit({
      caseId,
      exhibitLabel: `A-withCustody ${suffix}`,
      description: 'has a custodian',
      offeringParty: 'PROSECUTION',
    });
    exhibitWithCustodyId = withCustody.id;
    await recordStatusChange({
      exhibitId: exhibitWithCustodyId,
      toStatus: 'MARKED',
      actorUserId: custodianId,
    });
    await recordCustodyTransfer({
      exhibitId: exhibitWithCustodyId,
      fromCustodianUserId: null,
      toCustodianUserId: custodianId,
      actorUserId: custodianId,
    });

    const noCustody = await createExhibit({
      caseId,
      exhibitLabel: `B-noCustody ${suffix}`,
      description: 'no custodian of record',
      offeringParty: 'DEFENSE',
    });
    exhibitNoCustodyId = noCustody.id;
    await recordStatusChange({
      exhibitId: exhibitNoCustodyId,
      toStatus: 'MARKED',
      actorUserId: custodianId,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('returns 200 with the documented CustodyByCustodianResult shape', async () => {
    const res = await custodyRoute(caseId, 'JUDGE');
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(Array.isArray(body.groups)).toBe(true);
    expect(Array.isArray(body.noCustodian)).toBe(true);

    const group = body.groups.find(
      (g: { custodianUserId: string }) => g.custodianUserId === custodianId,
    );
    expect(group).toBeDefined();
    expect(group.custodianName).toBe('Deputy Route');
    expect(group.exhibits.map((e: { exhibitId: string }) => e.exhibitId)).toContain(
      exhibitWithCustodyId,
    );
    expect(group.pendingTransfersIn).toEqual([]);

    expect(
      body.noCustodian.map((e: { exhibitId: string }) => e.exhibitId),
    ).toContain(exhibitNoCustodyId);
  });

  it('returns 500 COMMAND_CENTER_LOAD_FAILED when the service throws', async () => {
    vi.spyOn(custodyByCustodianService, 'getCustodyByCustodian').mockRejectedValueOnce(
      new Error('boom'),
    );
    const res = await custodyRoute(caseId, 'JUDGE');
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('COMMAND_CENTER_LOAD_FAILED');
  });
});
