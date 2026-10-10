import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createExhibit } from '@/services/exhibits';
import { recordStatusChange } from '@/services/status';
import { recordCustodyTransfer } from '@/services/custody';
import { getCustodyByCustodian } from '@/services/custodyByCustodian';

// Integration tests for getCustodyByCustodian (F8 §Process step 3) against the
// shared Postgres. A SELF-CONTAINED fixture case (unique caseNumber) populated
// ONLY through the live service write paths — custody groupings must prove they
// read genuine CustodyCurrentState rows the live system could produce.

describe('getCustodyByCustodian (F8) against a self-contained fixture case', () => {
  let caseId: string;
  let custodianAId: string;
  let custodianBId: string;
  let exhibitAId: string;
  let exhibitBId: string;
  let exhibitNoCustodyId: string;
  let sealedExhibitId: string;

  beforeAll(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const kase = await prisma.case.create({
      data: {
        caseNumber: `TEST-CUSTODY-GLANCE-${suffix}`,
        title: 'Custody-by-Custodian Service Test Case',
        court: 'Test Court',
      },
    });
    caseId = kase.id;

    // Two custodians (DEPUTY/CLERK — both permitted to hold/receive custody and
    // to record transfers per the F24 custody role gate).
    const custodianA = await prisma.user.create({
      data: { caseId, name: 'Alice Deputy', role: 'DEPUTY' },
    });
    custodianAId = custodianA.id;
    const custodianB = await prisma.user.create({
      data: { caseId, name: 'Bob Clerk', role: 'CLERK' },
    });
    custodianBId = custodianB.id;

    // Exhibit A → custodian A.
    const exA = await createExhibit({
      caseId,
      exhibitLabel: `A-withCustodyA ${suffix}`,
      description: 'Exhibit with custodian A',
      offeringParty: 'PROSECUTION',
    });
    exhibitAId = exA.id;
    await recordStatusChange({ exhibitId: exhibitAId, toStatus: 'MARKED', actorUserId: custodianAId });
    await recordCustodyTransfer({
      exhibitId: exhibitAId,
      fromCustodianUserId: null,
      toCustodianUserId: custodianAId,
      actorUserId: custodianAId,
    });

    // Exhibit B → custodian B.
    const exB = await createExhibit({
      caseId,
      exhibitLabel: `B-withCustodyB ${suffix}`,
      description: 'Exhibit with custodian B',
      offeringParty: 'DEFENSE',
    });
    exhibitBId = exB.id;
    await recordStatusChange({ exhibitId: exhibitBId, toStatus: 'MARKED', actorUserId: custodianBId });
    await recordCustodyTransfer({
      exhibitId: exhibitBId,
      fromCustodianUserId: null,
      toCustodianUserId: custodianBId,
      actorUserId: custodianBId,
    });

    // Exhibit with NO custody row at all → the distinct "no custodian" bucket.
    const exNone = await createExhibit({
      caseId,
      exhibitLabel: `C-noCustody ${suffix}`,
      description: 'Exhibit with no custodian of record',
      offeringParty: 'PLAINTIFF',
    });
    exhibitNoCustodyId = exNone.id;
    await recordStatusChange({
      exhibitId: exhibitNoCustodyId,
      toStatus: 'MARKED',
      actorUserId: custodianAId,
    });

    // A sealed exhibit WITH a custody row — its grouping must be absent for a
    // role that cannot view sealed and present for one that can.
    const sealed = await createExhibit({
      caseId,
      exhibitLabel: `Z-sealed ${suffix}`,
      description: 'A sealed exhibit — restricted visibility',
      offeringParty: 'PROSECUTION',
      isSealed: true,
    });
    sealedExhibitId = sealed.id;
    await recordStatusChange({
      exhibitId: sealedExhibitId,
      toStatus: 'MARKED',
      actorUserId: custodianAId,
    });
    await recordCustodyTransfer({
      exhibitId: sealedExhibitId,
      fromCustodianUserId: null,
      toCustodianUserId: custodianBId,
      actorUserId: custodianBId,
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('groups each exhibit under its current custodian and surfaces a distinct no-custodian bucket', async () => {
    const result = await getCustodyByCustodian(caseId, 'JUDGE');

    // Three custodian groups for a JUDGE (A, B, and the sealed exhibit's B-group
    // merges into B). Find the A and B groups.
    const groupA = result.groups.find((g) => g.custodianUserId === custodianAId);
    const groupB = result.groups.find((g) => g.custodianUserId === custodianBId);
    expect(groupA).toBeDefined();
    expect(groupB).toBeDefined();

    expect(groupA!.custodianName).toBe('Alice Deputy');
    expect(groupA!.exhibits.map((e) => e.exhibitId)).toEqual([exhibitAId]);
    expect(groupA!.pendingTransfersIn).toEqual([]);

    // B holds exhibit B AND the sealed exhibit (JUDGE can see sealed).
    const bIds = groupB!.exhibits.map((e) => e.exhibitId).sort();
    expect(bIds).toEqual([exhibitBId, sealedExhibitId].sort());

    // The no-custody exhibit lands ONLY in the noCustodian bucket, never a group.
    const noCustodyIds = result.noCustodian.map((e) => e.exhibitId);
    expect(noCustodyIds).toContain(exhibitNoCustodyId);
    for (const g of result.groups) {
      expect(g.exhibits.map((e) => e.exhibitId)).not.toContain(exhibitNoCustodyId);
    }

    // currentStatus is carried through (MARKED for these fixtures).
    expect(groupA!.exhibits[0].currentStatus).toBe('MARKED');

    // Groups are sorted by custodian name ascending.
    const names = result.groups.map((g) => g.custodianName);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('excludes a sealed exhibit custody row for a DEPUTY-role call but includes it for JUDGE', async () => {
    const judge = await getCustodyByCustodian(caseId, 'JUDGE');
    const judgeBGroup = judge.groups.find((g) => g.custodianUserId === custodianBId);
    expect(judgeBGroup!.exhibits.map((e) => e.exhibitId)).toContain(sealedExhibitId);

    const deputy = await getCustodyByCustodian(caseId, 'DEPUTY');
    const deputyBGroup = deputy.groups.find((g) => g.custodianUserId === custodianBId);
    // The sealed exhibit is structurally ABSENT for DEPUTY — not a redacted row.
    expect(deputyBGroup!.exhibits.map((e) => e.exhibitId)).not.toContain(sealedExhibitId);
    // And it never leaks into the no-custodian bucket either.
    expect(deputy.noCustodian.map((e) => e.exhibitId)).not.toContain(sealedExhibitId);
    // DEPUTY still sees the ordinary exhibit B under custodian B.
    expect(deputyBGroup!.exhibits.map((e) => e.exhibitId)).toContain(exhibitBId);
  });
});
