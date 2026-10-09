import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { recordStatusChange } from '@/services/status';
import { recordObjection, recordRuling } from '@/services/objections';
import { recordCustodyTransfer } from '@/services/custody';
import { AdmissionBlockedError } from '@/lib/errors';

// F12 — dedicated integration suite for the Admission Integrity Gate inside
// recordStatusChange. Backed by the real Postgres from docker-compose.yml.
// Every state change goes through the live service path (no direct ledger /
// projection inserts), so these tests assert the gate exactly as callers hit it.
//
// Isolation: a fresh Case/User/Exhibit per test (unique caseNumber), mirroring
// status.test.ts's fixture style.

async function seedFixture() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const kase = await prisma.case.create({
    data: {
      caseNumber: `TEST-ADMIT-GATE-${suffix}`,
      title: 'Admission Gate Test Case',
      court: 'Test Court',
    },
  });
  // A deputy performs status/custody actions; a judge is required for rulings.
  const deputy = await prisma.user.create({
    data: { caseId: kase.id, name: 'Test Deputy', role: 'DEPUTY' },
  });
  const judge = await prisma.user.create({
    data: { caseId: kase.id, name: 'Test Judge', role: 'JUDGE' },
  });
  // A second active user to transfer custody TO (must differ from the actor and
  // be an active user per recordCustodyTransfer's INVALID_CUSTODIAN check).
  const custodian = await prisma.user.create({
    data: { caseId: kase.id, name: 'Test Custodian', role: 'DEPUTY' },
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
    judgeId: judge.id,
    custodianId: custodian.id,
    exhibitId: exhibit.id,
  };
}

/** Drive MARKED -> OFFERED so the exhibit is in an admittable state. */
async function toOffered(exhibitId: string, actorUserId: string) {
  await recordStatusChange({ exhibitId, toStatus: 'MARKED', actorUserId });
  await recordStatusChange({ exhibitId, toStatus: 'OFFERED', actorUserId });
}

/** Establish custody of record (null -> custodian) so NO_CUSTODIAN does not fire. */
async function establishCustody(
  exhibitId: string,
  toCustodianUserId: string,
  actorUserId: string,
) {
  await recordCustodyTransfer({
    exhibitId,
    fromCustodianUserId: null,
    toCustodianUserId,
    actorUserId,
  });
}

describe('F12 admission integrity gate (recordStatusChange)', () => {
  let fixture: Awaited<ReturnType<typeof seedFixture>>;

  beforeEach(async () => {
    fixture = await seedFixture();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('NO_CUSTODIAN alone: blocks ADMITTED, writes nothing, status stays OFFERED', async () => {
    const { exhibitId, deputyId } = fixture;

    await toOffered(exhibitId, deputyId);

    // Baseline event count AFTER the setup transitions.
    const before = await prisma.exhibitEvent.count({ where: { exhibitId } });

    let caught: unknown;
    try {
      await recordStatusChange({ exhibitId, toStatus: 'ADMITTED', actorUserId: deputyId });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(AdmissionBlockedError);
    const err = caught as AdmissionBlockedError;
    expect(err.code).toBe('ADMISSION_BLOCKED');
    expect(err.httpStatus).toBe(422);
    const reasons = (err.details as { reasons: Array<{ code: string }> }).reasons;
    expect(reasons).toHaveLength(1);
    expect(reasons[0].code).toBe('NO_CUSTODIAN');

    // The rejected attempt wrote NOTHING: no new ExhibitEvent, status unchanged.
    const after = await prisma.exhibitEvent.count({ where: { exhibitId } });
    expect(after).toBe(before);
    const state = await prisma.exhibitCurrentState.findUnique({ where: { exhibitId } });
    expect(state?.currentStatus).toBe('OFFERED');
  });

  it('UNRESOLVED_OBJECTION alone: blocks ADMITTED with exactly that one reason', async () => {
    const { exhibitId, deputyId, custodianId } = fixture;

    await toOffered(exhibitId, deputyId);
    // Establish custody FIRST so NO_CUSTODIAN cannot also fire — isolate the reason.
    await establishCustody(exhibitId, custodianId, deputyId);
    // Raise an objection, then transition to OBJECTED (allowed from OFFERED).
    await recordObjection({
      exhibitId,
      objectingParty: 'DEFENSE',
      grounds: 'hearsay',
      actorUserId: deputyId,
    });
    await recordStatusChange({ exhibitId, toStatus: 'OBJECTED', actorUserId: deputyId });

    let caught: unknown;
    try {
      await recordStatusChange({ exhibitId, toStatus: 'ADMITTED', actorUserId: deputyId });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(AdmissionBlockedError);
    const reasons = ((caught as AdmissionBlockedError).details as {
      reasons: Array<{ code: string }>;
    }).reasons;
    expect(reasons).toHaveLength(1);
    expect(reasons[0].code).toBe('UNRESOLVED_OBJECTION');
  });

  it('BOTH reasons: blocks ADMITTED listing NO_CUSTODIAN and UNRESOLVED_OBJECTION', async () => {
    const { exhibitId, deputyId } = fixture;

    await toOffered(exhibitId, deputyId);
    // No custody transfer at all AND an open objection -> both conditions hold.
    await recordObjection({
      exhibitId,
      objectingParty: 'DEFENSE',
      grounds: 'relevance',
      actorUserId: deputyId,
    });
    await recordStatusChange({ exhibitId, toStatus: 'OBJECTED', actorUserId: deputyId });

    let caught: unknown;
    try {
      await recordStatusChange({ exhibitId, toStatus: 'ADMITTED', actorUserId: deputyId });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(AdmissionBlockedError);
    const reasons = ((caught as AdmissionBlockedError).details as {
      reasons: Array<{ code: string }>;
    }).reasons;
    expect(reasons).toHaveLength(2);
    expect(reasons.map((r) => r.code).sort()).toEqual([
      'NO_CUSTODIAN',
      'UNRESOLVED_OBJECTION',
    ]);
  });

  it('Normal admission (custody present, no open objection) still succeeds', async () => {
    const { exhibitId, deputyId, custodianId } = fixture;

    await toOffered(exhibitId, deputyId);
    await establishCustody(exhibitId, custodianId, deputyId);

    const admitted = await recordStatusChange({
      exhibitId,
      toStatus: 'ADMITTED',
      actorUserId: deputyId,
    });
    expect(admitted.currentState.currentStatus).toBe('ADMITTED');
    const state = await prisma.exhibitCurrentState.findUnique({ where: { exhibitId } });
    expect(state?.currentStatus).toBe('ADMITTED');
  });

  it('Resolving the objection first (OVERRULED), then admitting, succeeds', async () => {
    const { exhibitId, deputyId, judgeId, custodianId } = fixture;

    await toOffered(exhibitId, deputyId);
    await establishCustody(exhibitId, custodianId, deputyId);
    const { objectionState } = await recordObjection({
      exhibitId,
      objectingParty: 'DEFENSE',
      grounds: 'hearsay',
      actorUserId: deputyId,
    });
    await recordStatusChange({ exhibitId, toStatus: 'OBJECTED', actorUserId: deputyId });

    // A judge overrules the objection, resolving the only open thread.
    await recordRuling({
      objectionId: objectionState.objectionId,
      disposition: 'OVERRULED',
      actorUserId: judgeId,
    });

    const admitted = await recordStatusChange({
      exhibitId,
      toStatus: 'ADMITTED',
      actorUserId: deputyId,
    });
    expect(admitted.currentState.currentStatus).toBe('ADMITTED');
  });

  it('EXCLUDED is unaffected by an open objection / custody gap (gate never fires)', async () => {
    const { exhibitId, deputyId } = fixture;

    await toOffered(exhibitId, deputyId);
    // Open objection, no custody — exactly the state that blocks ADMITTED.
    await recordObjection({
      exhibitId,
      objectingParty: 'DEFENSE',
      grounds: 'hearsay',
      actorUserId: deputyId,
    });
    await recordStatusChange({ exhibitId, toStatus: 'OBJECTED', actorUserId: deputyId });

    // EXCLUDED (reachable from OBJECTED) must succeed — the gate only triggers
    // on toStatus === 'ADMITTED'.
    const excluded = await recordStatusChange({
      exhibitId,
      toStatus: 'EXCLUDED',
      actorUserId: deputyId,
    });
    expect(excluded.currentState.currentStatus).toBe('EXCLUDED');
  });

  it('WITHDRAWN is unaffected by a custody gap (gate never fires)', async () => {
    const { exhibitId, deputyId } = fixture;

    // WITHDRAWN is reachable directly from OFFERED; no objection needed, no
    // custody established — the gate still must not fire for a non-ADMITTED target.
    await toOffered(exhibitId, deputyId);

    const withdrawn = await recordStatusChange({
      exhibitId,
      toStatus: 'WITHDRAWN',
      actorUserId: deputyId,
    });
    expect(withdrawn.currentState.currentStatus).toBe('WITHDRAWN');
  });
});
