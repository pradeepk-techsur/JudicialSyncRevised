import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import {
  computeJuryCandidates,
  finalizeJuryPackage,
  getJuryPackage,
  initiateJuryPackage,
} from '@/services/juryPackage';
import { recordStatusChange } from '@/services/status';
import { recordObjection } from '@/services/objections';
import { recordCustodyTransfer } from '@/services/custody';
import { acknowledgeDiscrepancy } from '@/services/discrepancies';
import { ConflictError, RoleNotPermittedError, UnprocessableError } from '@/lib/errors';

// Integration tests against the real Postgres provisioned by docker-compose.yml.
// Each test builds a SELF-CONTAINED fixture case (unique caseNumber) via the live
// service write paths — no reliance on the shared seed — so the suite is
// independent under fileParallelism:false.

async function seedFixture() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const kase = await prisma.case.create({
    data: {
      caseNumber: `TEST-JURY-${suffix}`,
      title: 'Jury Package Test Case',
      court: 'Test Court',
    },
  });
  const judge = await prisma.user.create({
    data: { caseId: kase.id, name: 'Judge J', role: 'JUDGE' },
  });
  const deputy = await prisma.user.create({
    data: { caseId: kase.id, name: 'Deputy D', role: 'DEPUTY' },
  });
  const clerk = await prisma.user.create({
    data: { caseId: kase.id, name: 'Clerk C', role: 'CLERK' },
  });
  const attorney = await prisma.user.create({
    data: { caseId: kase.id, name: 'Attorney A', role: 'ATTORNEY' },
  });
  return {
    caseId: kase.id,
    judgeId: judge.id,
    deputyId: deputy.id,
    clerkId: clerk.id,
    attorneyId: attorney.id,
    suffix,
  };
}

async function makeExhibit(
  caseId: string,
  label: string,
  opts?: { isSealed?: boolean },
): Promise<string> {
  const ex = await prisma.exhibit.create({
    data: {
      caseId,
      exhibitLabel: label,
      description: `Exhibit ${label}`,
      offeringParty: 'PLAINTIFF',
      isSealed: opts?.isSealed ?? false,
    },
  });
  return ex.id;
}

// Admit an exhibit WITH custody recorded so no ADMITTED_NO_CUSTODIAN flag fires
// (a genuinely CLEAN admitted exhibit).
async function admitClean(exhibitId: string, actorUserId: string) {
  await recordStatusChange({ exhibitId, toStatus: 'MARKED', actorUserId });
  await recordStatusChange({ exhibitId, toStatus: 'OFFERED', actorUserId });
  await recordStatusChange({ exhibitId, toStatus: 'ADMITTED', actorUserId });
  await recordCustodyTransfer({
    exhibitId,
    fromCustodianUserId: null,
    toCustodianUserId: actorUserId,
    actorUserId,
  });
}

// Admit an exhibit WITHOUT custody → an OPEN ADMITTED_NO_CUSTODIAN flag fires.
async function admitFlagged(exhibitId: string, actorUserId: string) {
  await recordStatusChange({ exhibitId, toStatus: 'MARKED', actorUserId });
  await recordStatusChange({ exhibitId, toStatus: 'OFFERED', actorUserId });
  await recordStatusChange({ exhibitId, toStatus: 'ADMITTED', actorUserId });
}

describe('jury package service', () => {
  let fx: Awaited<ReturnType<typeof seedFixture>>;

  beforeEach(async () => {
    fx = await seedFixture();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('computeJuryCandidates returns ALL ADMITTED exhibits (full visibility) incl. a sealed one', async () => {
    const { caseId, deputyId } = fx;
    const clean = await makeExhibit(caseId, `C-${fx.suffix}`);
    const sealed = await makeExhibit(caseId, `S-${fx.suffix}`, { isSealed: true });
    await admitClean(clean, deputyId);
    await admitClean(sealed, deputyId);

    // Query as DEPUTY (no sealed visibility) — membership must still include the sealed exhibit.
    const candidates = await computeJuryCandidates(caseId, 'DEPUTY');
    const ids = candidates.map((c) => c.exhibitId);
    expect(ids).toContain(clean);
    expect(ids).toContain(sealed);
    const sealedCand = candidates.find((c) => c.exhibitId === sealed);
    expect(sealedCand?.isSealed).toBe(true);
  });

  it('initiate by DEPUTY: membership includes a sealed exhibit but the DEPUTY view omits it', async () => {
    const { caseId, deputyId } = fx;
    const clean = await makeExhibit(caseId, `C-${fx.suffix}`);
    const sealed = await makeExhibit(caseId, `S-${fx.suffix}`, { isSealed: true });
    await admitClean(clean, deputyId);
    await admitClean(sealed, deputyId);

    const { juryPackage, exhibits } = await initiateJuryPackage(caseId, deputyId, 'DEPUTY');

    // The sealed exhibit IS a member row in the DB...
    const memberRow = await prisma.juryPackageExhibit.findFirst({
      where: { juryPackageId: juryPackage.id, exhibitId: sealed },
    });
    expect(memberRow).not.toBeNull();

    // ...but it is ABSENT from the role-filtered DEPUTY view.
    const viewIds = exhibits.map((e) => e.exhibitId);
    expect(viewIds).toContain(clean);
    expect(viewIds).not.toContain(sealed);
  });

  it('initiate is idempotent (same DRAFT on second call) and role-gated against ATTORNEY', async () => {
    const { caseId, deputyId, attorneyId } = fx;
    const ex = await makeExhibit(caseId, `C-${fx.suffix}`);
    await admitClean(ex, deputyId);

    const first = await initiateJuryPackage(caseId, deputyId, 'DEPUTY');
    const second = await initiateJuryPackage(caseId, deputyId, 'DEPUTY');
    expect(second.juryPackage.id).toBe(first.juryPackage.id);

    const count = await prisma.juryPackage.count({ where: { caseId, status: 'DRAFT' } });
    expect(count).toBe(1);

    await expect(initiateJuryPackage(caseId, attorneyId, 'ATTORNEY')).rejects.toBeInstanceOf(
      RoleNotPermittedError,
    );
  });

  it('initiate with zero admitted exhibits → NO_ELIGIBLE_EXHIBITS 422', async () => {
    const { caseId, deputyId } = fx;
    await expect(initiateJuryPackage(caseId, deputyId, 'DEPUTY')).rejects.toBeInstanceOf(
      UnprocessableError,
    );
  });

  it('each returned row carries flags[]: FLAGGED(OPEN), CLEAN([]), and ACKNOWLEDGED-distinguished', async () => {
    const { caseId, deputyId } = fx;
    const clean = await makeExhibit(caseId, `A-clean-${fx.suffix}`);
    const flagged = await makeExhibit(caseId, `B-flagged-${fx.suffix}`);
    const acked = await makeExhibit(caseId, `C-acked-${fx.suffix}`);
    await admitClean(clean, deputyId);
    await admitFlagged(flagged, deputyId);
    await admitFlagged(acked, deputyId);

    // Acknowledge the acked exhibit's OPEN flag.
    const ackFlag = await prisma.discrepancyFlag.findFirstOrThrow({
      where: { exhibitId: acked, status: 'OPEN' },
    });
    await acknowledgeDiscrepancy({
      discrepancyFlagId: ackFlag.id,
      actorUserId: deputyId,
      justification: 'custodian assigned at recess',
    });

    const { exhibits } = await initiateJuryPackage(caseId, deputyId, 'DEPUTY');
    const byId = new Map(exhibits.map((e) => [e.exhibitId, e]));

    const cleanRow = byId.get(clean)!;
    expect(cleanRow.discrepancyStatus).toBe('CLEAN');
    expect(cleanRow.flags).toEqual([]);

    const flaggedRow = byId.get(flagged)!;
    expect(flaggedRow.discrepancyStatus).toBe('FLAGGED');
    expect(flaggedRow.flags.length).toBeGreaterThan(0);
    expect(flaggedRow.flags[0].ruleCode).toBe('ADMITTED_NO_CUSTODIAN');
    expect(flaggedRow.flags[0].status).toBe('OPEN');
    expect(flaggedRow.flags[0].label.length).toBeGreaterThan(0);

    const ackedRow = byId.get(acked)!;
    // discrepancyStatus collapses to FLAGGED, but the per-flag status is ACKNOWLEDGED.
    expect(ackedRow.discrepancyStatus).toBe('FLAGGED');
    expect(ackedRow.flags.some((f) => f.status === 'ACKNOWLEDGED')).toBe(true);
    expect(ackedRow.flags.some((f) => f.status === 'OPEN')).toBe(false);
  });

  it('getJuryPackage before any initiate → { juryPackage: null } and creates NOTHING', async () => {
    const { caseId } = fx;
    const before = await prisma.juryPackage.count({ where: { caseId } });
    expect(before).toBe(0);

    const result = await getJuryPackage(caseId, 'DEPUTY');
    expect(result.juryPackage).toBeNull();
    expect(result.exhibits).toEqual([]);

    const after = await prisma.juryPackage.count({ where: { caseId } });
    expect(after).toBe(0);
  });

  it('getJuryPackage on a DRAFT reconciles in a newly-admitted exhibit', async () => {
    const { caseId, deputyId } = fx;
    const first = await makeExhibit(caseId, `A-${fx.suffix}`);
    await admitClean(first, deputyId);
    const { juryPackage } = await initiateJuryPackage(caseId, deputyId, 'DEPUTY');

    // Admit a new exhibit AFTER the draft exists.
    const second = await makeExhibit(caseId, `B-${fx.suffix}`);
    await admitClean(second, deputyId);

    const reloaded = await getJuryPackage(caseId, 'DEPUTY');
    expect(reloaded.juryPackage?.id).toBe(juryPackage.id);
    const ids = reloaded.exhibits.map((e) => e.exhibitId);
    expect(ids).toContain(first);
    expect(ids).toContain(second);
  });

  it('WARNING-3 gate honesty: a sealed OPEN discrepancy blocks finalize for a DEPUTY who cannot see it', async () => {
    const { caseId, deputyId } = fx;
    const clean = await makeExhibit(caseId, `A-${fx.suffix}`);
    const sealedFlagged = await makeExhibit(caseId, `S-${fx.suffix}`, { isSealed: true });
    await admitClean(clean, deputyId);
    await admitFlagged(sealedFlagged, deputyId); // sealed + ADMITTED + no custody → OPEN flag

    const { juryPackage, exhibits } = await initiateJuryPackage(caseId, deputyId, 'DEPUTY');

    // The sealed exhibit is NOT in the DEPUTY view...
    expect(exhibits.map((e) => e.exhibitId)).not.toContain(sealedFlagged);

    // ...yet finalize is BLOCKED because membership includes it.
    try {
      await finalizeJuryPackage(juryPackage.id, deputyId);
      throw new Error('expected finalize to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictError);
      const ce = err as ConflictError;
      expect(ce.code).toBe('JURY_PACKAGE_DISCREPANCIES_OPEN');
      const details = ce.details as { blockingExhibits: { exhibitId: string }[] };
      expect(details.blockingExhibits.some((b) => b.exhibitId === sealedFlagged)).toBe(true);
    }
  });

  it('finalize blocks with named blockers on OPEN, succeeds after acknowledgment, 409s on re-finalize', async () => {
    const { caseId, deputyId } = fx;
    const flagged = await makeExhibit(caseId, `F-${fx.suffix}`);
    await admitFlagged(flagged, deputyId);
    const { juryPackage } = await initiateJuryPackage(caseId, deputyId, 'DEPUTY');

    // Blocked, with named blocking exhibit.
    try {
      await finalizeJuryPackage(juryPackage.id, deputyId);
      throw new Error('expected finalize to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictError);
      const details = (err as ConflictError).details as {
        blockingExhibits: { exhibitLabel: string; ruleCodes: string[] }[];
      };
      const blocker = details.blockingExhibits.find((b) =>
        b.exhibitLabel.startsWith('F-'),
      );
      expect(blocker).toBeTruthy();
      expect(blocker!.ruleCodes).toContain('ADMITTED_NO_CUSTODIAN');
    }

    // Acknowledge the blocking flag.
    const flag = await prisma.discrepancyFlag.findFirstOrThrow({
      where: { exhibitId: flagged, status: 'OPEN' },
    });
    await acknowledgeDiscrepancy({
      discrepancyFlagId: flag.id,
      actorUserId: deputyId,
      justification: 'custodian will be assigned at recess',
    });

    // Now finalize succeeds.
    const result = await finalizeJuryPackage(juryPackage.id, deputyId);
    expect(result.juryPackage.status).toBe('FINALIZED');
    expect(result.juryPackage.finalizedBy).toBe(deputyId);
    expect(result.juryPackage.finalizedAt).not.toBeNull();

    // Re-finalize → ALREADY_FINALIZED 409.
    await expect(finalizeJuryPackage(juryPackage.id, deputyId)).rejects.toMatchObject({
      code: 'JURY_PACKAGE_ALREADY_FINALIZED',
      httpStatus: 409,
    });
  });
});
