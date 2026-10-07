import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import {
  acknowledgeDiscrepancy,
  evaluateDiscrepancies,
  getDiscrepancies,
  getExhibitDiscrepancies,
} from '@/services/discrepancies';
import { recordStatusChange } from '@/services/status';
import { recordObjection, recordRuling } from '@/services/objections';
import { recordCustodyTransfer } from '@/services/custody';
import { NotFoundError, RoleNotPermittedError, UnprocessableError } from '@/lib/errors';

// Integration tests against the real Postgres provisioned by docker-compose.yml.
// Each test builds a SELF-CONTAINED fixture case (unique caseNumber) via the live
// service write paths — no reliance on the shared seed — so the suite is
// independent under fileParallelism:false.

async function seedFixture() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const kase = await prisma.case.create({
    data: {
      caseNumber: `TEST-DISC-${suffix}`,
      title: 'Discrepancy Test Case',
      court: 'Test Court',
    },
  });
  const judge = await prisma.user.create({
    data: { caseId: kase.id, name: 'Judge J', role: 'JUDGE' },
  });
  const deputy = await prisma.user.create({
    data: { caseId: kase.id, name: 'Deputy D', role: 'DEPUTY' },
  });
  const attorney = await prisma.user.create({
    data: { caseId: kase.id, name: 'Attorney A', role: 'ATTORNEY' },
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
    judgeId: judge.id,
    deputyId: deputy.id,
    attorneyId: attorney.id,
    exhibitId: exhibit.id,
  };
}

// Drive an exhibit MARKED → OFFERED → ADMITTED through the status service, then
// run an explicit evaluation. Task 3 wires evaluateDiscrepancies into the write
// paths so the explicit call becomes redundant (re-evaluation is idempotent), but
// calling it here keeps this suite self-contained regardless of task order.
async function admit(exhibitId: string, actorUserId: string) {
  await recordStatusChange({ exhibitId, toStatus: 'MARKED', actorUserId });
  await recordStatusChange({ exhibitId, toStatus: 'OFFERED', actorUserId });
  await recordStatusChange({ exhibitId, toStatus: 'ADMITTED', actorUserId });
  await evaluateDiscrepancies(exhibitId);
}

describe('discrepancy engine', () => {
  let fx: Awaited<ReturnType<typeof seedFixture>>;

  beforeEach(async () => {
    fx = await seedFixture();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates exactly one OPEN ADMITTED_NO_CUSTODIAN flag for an admitted, custody-less exhibit (idempotent)', async () => {
    const { exhibitId, deputyId } = fx;
    await admit(exhibitId, deputyId);

    // The wiring in status.ts already fires evaluate on ADMITTED, but call it
    // directly too to prove idempotency — a second eval must NOT duplicate.
    await evaluateDiscrepancies(exhibitId);
    await evaluateDiscrepancies(exhibitId);

    const flags = await prisma.discrepancyFlag.findMany({
      where: { exhibitId, ruleCode: 'ADMITTED_NO_CUSTODIAN' },
    });
    expect(flags).toHaveLength(1);
    expect(flags[0].status).toBe('OPEN');
  });

  it('resolves ADMITTED_NO_CUSTODIAN once custody is recorded', async () => {
    const { exhibitId, deputyId } = fx;
    await admit(exhibitId, deputyId);

    let open = await prisma.discrepancyFlag.findFirst({
      where: { exhibitId, ruleCode: 'ADMITTED_NO_CUSTODIAN', status: 'OPEN' },
    });
    expect(open).not.toBeNull();

    await recordCustodyTransfer({
      exhibitId,
      fromCustodianUserId: null,
      toCustodianUserId: deputyId,
      actorUserId: deputyId,
    });
    await evaluateDiscrepancies(exhibitId);

    open = await prisma.discrepancyFlag.findFirst({
      where: { exhibitId, ruleCode: 'ADMITTED_NO_CUSTODIAN', status: 'OPEN' },
    });
    expect(open).toBeNull();

    const resolved = await prisma.discrepancyFlag.findFirst({
      where: { exhibitId, ruleCode: 'ADMITTED_NO_CUSTODIAN', status: 'RESOLVED' },
    });
    expect(resolved).not.toBeNull();
  });

  it('flags then resolves UNRESOLVED_OBJECTION_JURY_ELIGIBLE across a ruling', async () => {
    const { exhibitId, deputyId, judgeId } = fx;

    // Offer, raise an objection, then admit (custody recorded so the custody rule
    // does not also fire and muddy the assertions).
    await recordStatusChange({ exhibitId, toStatus: 'MARKED', actorUserId: deputyId });
    await recordStatusChange({ exhibitId, toStatus: 'OFFERED', actorUserId: deputyId });
    const { objectionState } = await recordObjection({
      exhibitId,
      objectingParty: 'DEFENSE',
      grounds: 'hearsay',
      actorUserId: deputyId,
    });
    await recordCustodyTransfer({
      exhibitId,
      fromCustodianUserId: null,
      toCustodianUserId: deputyId,
      actorUserId: deputyId,
    });
    await recordStatusChange({ exhibitId, toStatus: 'ADMITTED', actorUserId: deputyId });
    await evaluateDiscrepancies(exhibitId);

    const open = await prisma.discrepancyFlag.findFirst({
      where: {
        exhibitId,
        ruleCode: 'UNRESOLVED_OBJECTION_JURY_ELIGIBLE',
        status: 'OPEN',
      },
    });
    expect(open).not.toBeNull();

    // Judge rules on the objection → the only unresolved thread closes → resolve.
    await recordRuling({
      objectionId: objectionState.objectionId,
      disposition: 'OVERRULED',
      actorUserId: judgeId,
    });
    await evaluateDiscrepancies(exhibitId);

    const stillOpen = await prisma.discrepancyFlag.findFirst({
      where: {
        exhibitId,
        ruleCode: 'UNRESOLVED_OBJECTION_JURY_ELIGIBLE',
        status: 'OPEN',
      },
    });
    expect(stillOpen).toBeNull();
    const resolved = await prisma.discrepancyFlag.findFirst({
      where: {
        exhibitId,
        ruleCode: 'UNRESOLVED_OBJECTION_JURY_ELIGIBLE',
        status: 'RESOLVED',
      },
    });
    expect(resolved).not.toBeNull();
  });

  it('acknowledges an OPEN flag: writes a ledger event AND flips the flag in one call', async () => {
    const { exhibitId, deputyId } = fx;
    await admit(exhibitId, deputyId);

    const flag = await prisma.discrepancyFlag.findFirstOrThrow({
      where: { exhibitId, ruleCode: 'ADMITTED_NO_CUSTODIAN', status: 'OPEN' },
    });

    const { event, discrepancyFlag } = await acknowledgeDiscrepancy({
      discrepancyFlagId: flag.id,
      actorUserId: deputyId,
      justification: 'Reviewed — custodian will be assigned at recess',
    });

    expect(event.eventType).toBe('DISCREPANCY_ACKNOWLEDGED');
    expect(discrepancyFlag.status).toBe('ACKNOWLEDGED');
    expect(discrepancyFlag.acknowledgedBy).toBe(deputyId);
    expect(discrepancyFlag.acknowledgedEventId).toBe(event.id);

    // getExhibitDiscrepancies still surfaces ACKNOWLEDGED flags.
    const active = await getExhibitDiscrepancies(exhibitId);
    expect(active.some((f) => f.id === flag.id)).toBe(true);
  });

  it('rejects empty/whitespace justification with JUSTIFICATION_REQUIRED (422)', async () => {
    const { exhibitId, deputyId } = fx;
    await admit(exhibitId, deputyId);
    const flag = await prisma.discrepancyFlag.findFirstOrThrow({
      where: { exhibitId, ruleCode: 'ADMITTED_NO_CUSTODIAN', status: 'OPEN' },
    });

    await expect(
      acknowledgeDiscrepancy({
        discrepancyFlagId: flag.id,
        actorUserId: deputyId,
        justification: '   ',
      }),
    ).rejects.toBeInstanceOf(UnprocessableError);
  });

  it('rejects an ATTORNEY acknowledger with ROLE_NOT_PERMITTED (403)', async () => {
    const { exhibitId, deputyId, attorneyId } = fx;
    await admit(exhibitId, deputyId);
    const flag = await prisma.discrepancyFlag.findFirstOrThrow({
      where: { exhibitId, ruleCode: 'ADMITTED_NO_CUSTODIAN', status: 'OPEN' },
    });

    await expect(
      acknowledgeDiscrepancy({
        discrepancyFlagId: flag.id,
        actorUserId: attorneyId,
        justification: 'I think this is fine',
      }),
    ).rejects.toBeInstanceOf(RoleNotPermittedError);
  });

  it('is idempotent on an already-ACKNOWLEDGED flag: no second ledger event', async () => {
    const { exhibitId, deputyId } = fx;
    await admit(exhibitId, deputyId);
    const flag = await prisma.discrepancyFlag.findFirstOrThrow({
      where: { exhibitId, ruleCode: 'ADMITTED_NO_CUSTODIAN', status: 'OPEN' },
    });

    const first = await acknowledgeDiscrepancy({
      discrepancyFlagId: flag.id,
      actorUserId: deputyId,
      justification: 'first ack',
    });
    const second = await acknowledgeDiscrepancy({
      discrepancyFlagId: flag.id,
      actorUserId: deputyId,
      justification: 'second attempt',
    });

    // Same event returned; exactly one DISCREPANCY_ACKNOWLEDGED event exists.
    expect(second.event.id).toBe(first.event.id);
    const count = await prisma.exhibitEvent.count({
      where: { exhibitId, eventType: 'DISCREPANCY_ACKNOWLEDGED' },
    });
    expect(count).toBe(1);
  });

  it('throws DISCREPANCY_NOT_FOUND for an unknown flag id', async () => {
    const { deputyId } = fx;
    await expect(
      acknowledgeDiscrepancy({
        discrepancyFlagId: '00000000-0000-0000-0000-000000000000',
        actorUserId: deputyId,
        justification: 'valid justification',
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('getDiscrepancies returns active flags case-wide, excluding RESOLVED', async () => {
    const { caseId, exhibitId, deputyId } = fx;
    await admit(exhibitId, deputyId);

    let active = await getDiscrepancies(caseId, 'JUDGE');
    expect(active.length).toBeGreaterThanOrEqual(1);

    // Record custody → ADMITTED_NO_CUSTODIAN resolves → drops out of the list.
    await recordCustodyTransfer({
      exhibitId,
      fromCustodianUserId: null,
      toCustodianUserId: deputyId,
      actorUserId: deputyId,
    });
    await evaluateDiscrepancies(exhibitId);
    active = await getDiscrepancies(caseId, 'JUDGE');
    expect(active.some((f) => f.ruleCode === 'ADMITTED_NO_CUSTODIAN')).toBe(false);
  });

  it('getDiscrepancies hides sealed-exhibit flags from roles that cannot view sealed', async () => {
    const { caseId, deputyId } = fx;
    // A sealed, ADMITTED exhibit with no custody row → an OPEN
    // ADMITTED_NO_CUSTODIAN flag that must never surface to an unauthorized role.
    const sealed = await prisma.exhibit.create({
      data: {
        caseId,
        exhibitLabel: `SEAL-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        description: 'Sealed, admitted, custody-less',
        offeringParty: 'PROSECUTION',
        isSealed: true,
      },
    });
    await recordStatusChange({ exhibitId: sealed.id, toStatus: 'MARKED', actorUserId: deputyId });
    await recordStatusChange({ exhibitId: sealed.id, toStatus: 'OFFERED', actorUserId: deputyId });
    await recordStatusChange({ exhibitId: sealed.id, toStatus: 'ADMITTED', actorUserId: deputyId });

    // JUDGE (sealed-visible) sees the sealed exhibit's flag...
    const asJudge = await getDiscrepancies(caseId, 'JUDGE');
    expect(asJudge.some((f) => f.exhibitId === sealed.id)).toBe(true);

    // ...but ATTORNEY (not sealed-visible) must not — no leak of its existence.
    const asAttorney = await getDiscrepancies(caseId, 'ATTORNEY');
    expect(asAttorney.some((f) => f.exhibitId === sealed.id)).toBe(false);
  });
});
