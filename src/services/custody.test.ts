import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { RoleNotPermittedError } from '@/lib/errors';
import {
  CustodyChainBrokenError,
  InvalidCustodianError,
  NoOpTransferError,
  getCustodian,
  getCustodyHistory,
  recordCustodyTransfer,
} from '@/services/custody';

// Integration tests against the real Postgres provisioned by docker-compose.yml.
// Each test gets a fresh case + three users + one exhibit so custody chains can
// be built without cross-test interference.

async function seedFixture() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const kase = await prisma.case.create({
    data: {
      caseNumber: `TEST-CUSTODY-${suffix}`,
      title: 'Custody Test Case',
      court: 'Test Court',
    },
  });
  const deputy = await prisma.user.create({
    data: { caseId: kase.id, name: 'Deputy A', role: 'DEPUTY' },
  });
  const clerk = await prisma.user.create({
    data: { caseId: kase.id, name: 'Clerk B', role: 'CLERK' },
  });
  const attorney = await prisma.user.create({
    data: { caseId: kase.id, name: 'Attorney C', role: 'ATTORNEY' },
  });
  const admin = await prisma.user.create({
    data: { caseId: kase.id, name: 'Admin D', role: 'ADMIN' },
  });
  const exhibit = await prisma.exhibit.create({
    data: {
      caseId: kase.id,
      exhibitLabel: `Exhibit ${suffix}`,
      description: 'A test exhibit',
      offeringParty: 'PLAINTIFF',
    },
  });
  return {
    caseId: kase.id,
    deputyId: deputy.id,
    clerkId: clerk.id,
    attorneyId: attorney.id,
    adminId: admin.id,
    exhibitId: exhibit.id,
  };
}

describe('custody service', () => {
  let fx: Awaited<ReturnType<typeof seedFixture>>;

  beforeEach(async () => {
    fx = await seedFixture();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('records a first-ever transfer (fromCustodian null) and reflects it immediately', async () => {
    const { exhibitId, deputyId } = fx;

    const { event, custodyState } = await recordCustodyTransfer({
      exhibitId,
      fromCustodianUserId: null,
      toCustodianUserId: deputyId,
      reason: 'initial intake',
      actorUserId: deputyId,
    });

    expect(event.eventType).toBe('CUSTODY_TRANSFER');
    expect(custodyState.currentCustodianUserId).toBe(deputyId);

    const current = await getCustodian(exhibitId);
    expect(current?.currentCustodianUserId).toBe(deputyId);
    expect(current?.lastEventId).toBe(event.id);
  });

  it('continues the chain when fromCustodian matches the current holder', async () => {
    const { exhibitId, deputyId, clerkId } = fx;

    await recordCustodyTransfer({
      exhibitId,
      fromCustodianUserId: null,
      toCustodianUserId: deputyId,
      actorUserId: deputyId,
    });

    const { custodyState } = await recordCustodyTransfer({
      exhibitId,
      fromCustodianUserId: deputyId,
      toCustodianUserId: clerkId,
      reason: 'transferred to clerk for jury package prep',
      actorUserId: clerkId,
    });

    expect(custodyState.currentCustodianUserId).toBe(clerkId);
    const current = await getCustodian(exhibitId);
    expect(current?.currentCustodianUserId).toBe(clerkId);
  });

  it('rejects a transfer from the WRONG holder (CUSTODY_CHAIN_BROKEN) and leaves the projection unchanged', async () => {
    const { exhibitId, deputyId, clerkId, attorneyId } = fx;

    // Deputy currently holds the exhibit.
    await recordCustodyTransfer({
      exhibitId,
      fromCustodianUserId: null,
      toCustodianUserId: deputyId,
      actorUserId: deputyId,
    });

    const before = await getCustodian(exhibitId);
    expect(before?.currentCustodianUserId).toBe(deputyId);

    // A transfer claiming to be "from" the clerk (who does NOT hold it) → refused.
    await expect(
      recordCustodyTransfer({
        exhibitId,
        fromCustodianUserId: clerkId,
        toCustodianUserId: attorneyId,
        actorUserId: clerkId,
      }),
    ).rejects.toBeInstanceOf(CustodyChainBrokenError);

    // Projection is untouched — still shows the deputy, no ledger row added.
    const after = await getCustodian(exhibitId);
    expect(after?.currentCustodianUserId).toBe(deputyId);
    expect(after?.lastEventId).toBe(before?.lastEventId);

    const count = await prisma.exhibitEvent.count({
      where: { exhibitId, eventType: 'CUSTODY_TRANSFER' },
    });
    expect(count).toBe(1);
  });

  it('rejects a no-op transfer (from === to) with NO_OP_TRANSFER', async () => {
    const { exhibitId, deputyId } = fx;

    await recordCustodyTransfer({
      exhibitId,
      fromCustodianUserId: null,
      toCustodianUserId: deputyId,
      actorUserId: deputyId,
    });

    await expect(
      recordCustodyTransfer({
        exhibitId,
        fromCustodianUserId: deputyId,
        toCustodianUserId: deputyId,
        actorUserId: deputyId,
      }),
    ).rejects.toBeInstanceOf(NoOpTransferError);
  });

  it('rejects a transfer to a nonexistent user with INVALID_CUSTODIAN', async () => {
    const { exhibitId } = fx;
    const missingUserId = '00000000-0000-0000-0000-000000000000';

    await expect(
      recordCustodyTransfer({
        exhibitId,
        fromCustodianUserId: null,
        toCustodianUserId: missingUserId,
        actorUserId: missingUserId,
      }),
    ).rejects.toBeInstanceOf(InvalidCustodianError);
  });

  it('rejects a transfer to an inactive user with INVALID_CUSTODIAN', async () => {
    const { exhibitId, caseId } = fx;
    const inactive = await prisma.user.create({
      data: { caseId, name: 'Inactive D', role: 'CLERK', isActive: false },
    });

    await expect(
      recordCustodyTransfer({
        exhibitId,
        fromCustodianUserId: null,
        toCustodianUserId: inactive.id,
        actorUserId: inactive.id,
      }),
    ).rejects.toBeInstanceOf(InvalidCustodianError);
  });

  it('treats a custody gap as valid: getCustodian returns null, getCustodyHistory is empty', async () => {
    const { exhibitId } = fx;

    const current = await getCustodian(exhibitId);
    expect(current).toBeNull();

    const history = await getCustodyHistory(exhibitId);
    expect(history).toEqual([]);

    // No placeholder row was created.
    const rowCount = await prisma.custodyCurrentState.count({ where: { exhibitId } });
    expect(rowCount).toBe(0);
  });

  it('reconstructs the full chronological chain for three sequential transfers', async () => {
    const { exhibitId, deputyId, clerkId, attorneyId } = fx;

    await recordCustodyTransfer({
      exhibitId,
      fromCustodianUserId: null,
      toCustodianUserId: deputyId,
      reason: 'intake',
      actorUserId: deputyId,
    });
    await recordCustodyTransfer({
      exhibitId,
      fromCustodianUserId: deputyId,
      toCustodianUserId: clerkId,
      reason: 'to clerk',
      actorUserId: clerkId,
    });
    await recordCustodyTransfer({
      exhibitId,
      fromCustodianUserId: clerkId,
      toCustodianUserId: attorneyId,
      reason: 'to attorney',
      // The clerk (who currently holds custody) performs the transfer TO the
      // attorney. ATTORNEY is not an authorized custody-transfer actor under the
      // new F24 role gate, so the ACTOR is the clerk; the recipient is unchanged.
      actorUserId: clerkId,
    });

    const history = await getCustodyHistory(exhibitId);
    expect(history).toHaveLength(3);

    expect(history[0].fromCustodian).toBeNull();
    expect(history[0].toCustodian).toBe(deputyId);
    expect(history[0].reason).toBe('intake');
    expect(history[0].eventId).toBeTruthy();
    expect(history[0].timestamp).toBeInstanceOf(Date);

    expect(history[1].fromCustodian).toBe(deputyId);
    expect(history[1].toCustodian).toBe(clerkId);
    expect(history[1].reason).toBe('to clerk');

    expect(history[2].fromCustodian).toBe(clerkId);
    expect(history[2].toCustodian).toBe(attorneyId);
    expect(history[2].reason).toBe('to attorney');

    // Chronological ordering: timestamps non-decreasing.
    expect(history[0].timestamp.getTime()).toBeLessThanOrEqual(history[1].timestamp.getTime());
    expect(history[1].timestamp.getTime()).toBeLessThanOrEqual(history[2].timestamp.getTime());
  });

  it('rejects a transfer by an unauthorized role (ATTORNEY) with ROLE_NOT_PERMITTED', async () => {
    const { exhibitId, deputyId, attorneyId } = fx;

    // First-time assignment attempted BY an attorney — the gate must fire
    // before any ledger write, regardless of the transfer being otherwise valid.
    await expect(
      recordCustodyTransfer({
        exhibitId,
        fromCustodianUserId: null,
        toCustodianUserId: deputyId,
        actorUserId: attorneyId,
      }),
    ).rejects.toBeInstanceOf(RoleNotPermittedError);

    // The gate fires before any write — no CustodyCurrentState row was created.
    const rowCount = await prisma.custodyCurrentState.count({ where: { exhibitId } });
    expect(rowCount).toBe(0);
    const eventCount = await prisma.exhibitEvent.count({
      where: { exhibitId, eventType: 'CUSTODY_TRANSFER' },
    });
    expect(eventCount).toBe(0);
  });

  it('allows DEPUTY, CLERK, and ADMIN to record a transfer', async () => {
    const { exhibitId, deputyId, clerkId, adminId } = fx;

    // DEPUTY performs the first-time assignment (to self).
    const first = await recordCustodyTransfer({
      exhibitId,
      fromCustodianUserId: null,
      toCustodianUserId: deputyId,
      actorUserId: deputyId,
    });
    expect(first.custodyState.currentCustodianUserId).toBe(deputyId);

    // CLERK transfers it onward (deputy → clerk).
    const second = await recordCustodyTransfer({
      exhibitId,
      fromCustodianUserId: deputyId,
      toCustodianUserId: clerkId,
      actorUserId: clerkId,
    });
    expect(second.custodyState.currentCustodianUserId).toBe(clerkId);

    // ADMIN transfers it onward (clerk → admin).
    const third = await recordCustodyTransfer({
      exhibitId,
      fromCustodianUserId: clerkId,
      toCustodianUserId: adminId,
      actorUserId: adminId,
    });
    expect(third.custodyState.currentCustodianUserId).toBe(adminId);
  });
});
