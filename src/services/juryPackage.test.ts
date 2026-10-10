import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import {
  computeJuryCandidates,
  finalizeJuryPackage,
  getJuryPackage,
  getJuryPackageReadinessPreview,
  initiateJuryPackage,
  requestFinalization,
} from '@/services/juryPackage';
import { recordStatusChange } from '@/services/status';
import { recordObjection } from '@/services/objections';
import { recordCustodyTransfer } from '@/services/custody';
import { acknowledgeDiscrepancy, evaluateDiscrepancies } from '@/services/discrepancies';
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
// (a genuinely CLEAN admitted exhibit). Custody is recorded BEFORE the ADMITTED
// transition so the F12 admission gate (plan 07-02: admission requires custody)
// is satisfied rather than blocked.
async function admitClean(exhibitId: string, actorUserId: string) {
  await recordStatusChange({ exhibitId, toStatus: 'MARKED', actorUserId });
  await recordStatusChange({ exhibitId, toStatus: 'OFFERED', actorUserId });
  await recordCustodyTransfer({
    exhibitId,
    fromCustodianUserId: null,
    toCustodianUserId: actorUserId,
    actorUserId,
  });
  await recordStatusChange({ exhibitId, toStatus: 'ADMITTED', actorUserId });
}

// Admit an exhibit WITHOUT custody → an OPEN ADMITTED_NO_CUSTODIAN flag fires.
// This fixture's whole point is "ADMITTED with no custody", which the F12
// admission gate (plan 07-02) would block via the normal recordStatusChange
// path. So the final ADMITTED step is written directly (bypassing the gate),
// mirroring plan 07-02's forceAdmitBypassingGate pattern, to preserve the
// no-custody-ADMITTED state these discrepancy tests rely on.
async function admitFlagged(exhibitId: string, caseId: string, actorUserId: string) {
  await recordStatusChange({ exhibitId, toStatus: 'MARKED', actorUserId });
  await recordStatusChange({ exhibitId, toStatus: 'OFFERED', actorUserId });
  const agg = await prisma.exhibitEvent.aggregate({ where: { exhibitId }, _max: { sequenceNo: true } });
  const event = await prisma.exhibitEvent.create({
    data: {
      exhibitId, caseId, eventType: 'STATUS_CHANGE',
      payload: { fromStatus: 'OFFERED', toStatus: 'ADMITTED' },
      actorUserId, sequenceNo: (agg._max.sequenceNo ?? 0) + 1,
    },
  });
  await prisma.exhibitCurrentState.upsert({
    where: { exhibitId },
    create: { exhibitId, currentStatus: 'ADMITTED', lastStatusEventId: event.id, lastStatusAt: event.recordedAt },
    update: { currentStatus: 'ADMITTED', lastStatusEventId: event.id, lastStatusAt: event.recordedAt },
  });
}

// Admit an exhibit WITH custody but carrying an UNRESOLVED objection. The F12
// admission gate (plan 07-01) would block an ADMITTED transition while an
// objection is unresolved, so — exactly like admitFlagged — the final ADMITTED
// step is written directly (bypassing the gate) to preserve the
// "ADMITTED + custody + unresolved objection" state the readiness test needs.
async function admitWithUnresolvedObjection(
  exhibitId: string,
  caseId: string,
  actorUserId: string,
) {
  await recordStatusChange({ exhibitId, toStatus: 'MARKED', actorUserId });
  await recordStatusChange({ exhibitId, toStatus: 'OFFERED', actorUserId });
  await recordObjection({
    exhibitId,
    objectingParty: 'DEFENSE',
    grounds: 'Hearsay',
    actorUserId,
  });
  await recordCustodyTransfer({
    exhibitId,
    fromCustodianUserId: null,
    toCustodianUserId: actorUserId,
    actorUserId,
  });
  const agg = await prisma.exhibitEvent.aggregate({
    where: { exhibitId },
    _max: { sequenceNo: true },
  });
  const event = await prisma.exhibitEvent.create({
    data: {
      exhibitId,
      caseId,
      eventType: 'STATUS_CHANGE',
      payload: { fromStatus: 'OBJECTED', toStatus: 'ADMITTED' },
      actorUserId,
      sequenceNo: (agg._max.sequenceNo ?? 0) + 1,
    },
  });
  await prisma.exhibitCurrentState.upsert({
    where: { exhibitId },
    create: {
      exhibitId,
      currentStatus: 'ADMITTED',
      lastStatusEventId: event.id,
      lastStatusAt: event.recordedAt,
    },
    update: {
      currentStatus: 'ADMITTED',
      lastStatusEventId: event.id,
      lastStatusAt: event.recordedAt,
    },
  });
}

describe('jury package service', () => {
  let fx: Awaited<ReturnType<typeof seedFixture>>;

  beforeEach(async () => {
    fx = await seedFixture();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('computeJuryCandidates returns ADMITTED non-sealed exhibits and EXCLUDES sealed ones (F13)', async () => {
    // POLICY CHANGE (F13, supersedes the pre-Phase-7 "membership is case truth
    // regardless of seal" assertion this replaces): sealed exhibits are now
    // structurally excluded from candidate computation itself, not just the view.
    const { caseId, deputyId } = fx;
    const clean = await makeExhibit(caseId, `C-${fx.suffix}`);
    const sealed = await makeExhibit(caseId, `S-${fx.suffix}`, { isSealed: true });
    await admitClean(clean, deputyId);
    await admitClean(sealed, deputyId);

    const candidates = await computeJuryCandidates(caseId, 'ADMIN');
    const ids = candidates.map((c) => c.exhibitId);
    expect(ids).toContain(clean);
    expect(ids).not.toContain(sealed);
  });

  it('initiate by DEPUTY: a sealed exhibit is NOT a member row and is absent from the view (F13)', async () => {
    // POLICY CHANGE (F13): a sealed exhibit is excluded from membership entirely,
    // so no JuryPackageExhibit row is created for it via the normal initiate path.
    const { caseId, deputyId } = fx;
    const clean = await makeExhibit(caseId, `C-${fx.suffix}`);
    const sealed = await makeExhibit(caseId, `S-${fx.suffix}`, { isSealed: true });
    await admitClean(clean, deputyId);
    await admitClean(sealed, deputyId);

    const { juryPackage, exhibits } = await initiateJuryPackage(caseId, deputyId, 'DEPUTY');

    // The sealed exhibit is NOT a member row in the DB...
    const memberRow = await prisma.juryPackageExhibit.findFirst({
      where: { juryPackageId: juryPackage.id, exhibitId: sealed },
    });
    expect(memberRow).toBeNull();

    // ...and is absent from the view; the clean exhibit is present.
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
    await admitFlagged(flagged, caseId, deputyId);
    await admitFlagged(acked, caseId, deputyId);
    // admitFlagged bypasses the gate and skips evaluateDiscrepancies, so fire it
    // explicitly here where the test needs real OPEN DiscrepancyFlag rows.
    await evaluateDiscrepancies(flagged);
    await evaluateDiscrepancies(acked);

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

  it('F13: a sealed exhibit is NOT a member, so its OPEN discrepancy does not block finalize', async () => {
    // POLICY CHANGE (F13, supersedes the pre-Phase-7 "membership is case truth
    // regardless of seal" test this replaces): a sealed/ex-parte exhibit is now
    // structurally excluded from membership by computeJuryCandidates. It can never
    // be a member via the normal initiate path, so it can neither appear in the
    // view NOR block finalize — exclusion happens earlier, at candidate computation.
    const { caseId, deputyId } = fx;
    const clean = await makeExhibit(caseId, `A-${fx.suffix}`);
    const sealedFlagged = await makeExhibit(caseId, `S-${fx.suffix}`, { isSealed: true });
    await admitClean(clean, deputyId);
    await admitFlagged(sealedFlagged, caseId, deputyId); // sealed + ADMITTED + no custody → OPEN flag
    await evaluateDiscrepancies(sealedFlagged);

    const { juryPackage, exhibits } = await initiateJuryPackage(caseId, deputyId, 'DEPUTY');

    // The sealed exhibit is absent from the view AND is not a member row at all.
    expect(exhibits.map((e) => e.exhibitId)).not.toContain(sealedFlagged);
    const memberRow = await prisma.juryPackageExhibit.findFirst({
      where: { juryPackageId: juryPackage.id, exhibitId: sealedFlagged },
    });
    expect(memberRow).toBeNull();

    // Finalize SUCCEEDS: the only member (clean) has no open discrepancy, and the
    // sealed flagged exhibit — never a member — cannot block it.
    const result = await finalizeJuryPackage(juryPackage.id, deputyId);
    expect(result.juryPackage.status).toBe('FINALIZED');
  });

  it('finalize HARD-BLOCKS a retained sealed INCLUDED member even with zero open discrepancies (B1, F13)', async () => {
    // B1 (server-authority gap): the sealed-exclusion block is enforced in the UI
    // (JuryPackageDraft disables Finalize on an isSealed row). This asserts the
    // SERVER also rejects finalize for a retained LEGACY sealed-but-ADMITTED
    // INCLUDED row that carries NO open discrepancy — the exact state the OPEN-only
    // gate used to pass. A direct finalize (bypassing the disabled UI button) must
    // fail with a DISTINCT code so the route can surface "remove ex parte material
    // first".
    const { caseId, deputyId } = fx;
    const cleanId = await makeExhibit(caseId, `CLEAN-${fx.suffix}`);
    await admitClean(cleanId, deputyId);
    const sealedId = await makeExhibit(caseId, `SEALED-LEGACY-${fx.suffix}`, { isSealed: true });
    // admitClean records custody, so this sealed+ADMITTED exhibit carries NO
    // ADMITTED_NO_CUSTODIAN flag → zero OPEN discrepancies on the member.
    await admitClean(sealedId, deputyId);

    const { juryPackage } = await initiateJuryPackage(caseId, deputyId, 'DEPUTY');

    // Simulate a legacy row predating F13: insert the sealed INCLUDED member
    // directly (the post-F13 initiate/reconcile path can no longer create it).
    await prisma.juryPackageExhibit.create({
      data: { juryPackageId: juryPackage.id, exhibitId: sealedId, discrepancyStatus: 'CLEAN' },
    });

    // Sanity: the sealed member has zero OPEN discrepancies, so the OLD OPEN-only
    // gate would have passed it.
    await evaluateDiscrepancies(sealedId);
    const openFlags = await prisma.discrepancyFlag.count({
      where: { exhibitId: sealedId, status: 'OPEN' },
    });
    expect(openFlags).toBe(0);

    // The server must STILL reject finalize, with the distinct sealed code.
    try {
      await finalizeJuryPackage(juryPackage.id, deputyId);
      throw new Error('expected finalize to throw on a retained sealed INCLUDED member');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictError);
      expect((err as ConflictError).code).toBe('JURY_PACKAGE_SEALED_EXHIBIT_PRESENT');
      const details = (err as ConflictError).details as {
        sealedExhibits: { exhibitId: string; exhibitLabel: string }[];
      };
      expect(details.sealedExhibits.some((s) => s.exhibitId === sealedId)).toBe(true);
    }

    // The package remains a DRAFT — nothing was finalized.
    const stillDraft = await prisma.juryPackage.findUnique({ where: { id: juryPackage.id } });
    expect(stillDraft?.status).toBe('DRAFT');
  });

  it('finalize blocks with named blockers on OPEN, succeeds after acknowledgment, 409s on re-finalize', async () => {
    const { caseId, deputyId } = fx;
    const flagged = await makeExhibit(caseId, `F-${fx.suffix}`);
    await admitFlagged(flagged, caseId, deputyId);
    await evaluateDiscrepancies(flagged);
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

  it('finalizeJuryPackage clears a previously-set finalizationRequestedAt/By on success (F11)', async () => {
    const { caseId, deputyId } = fx;
    const clean = await makeExhibit(caseId, `A-${fx.suffix}`);
    await admitClean(clean, deputyId);
    const { juryPackage } = await initiateJuryPackage(caseId, deputyId, 'DEPUTY');

    // Stamp an outstanding finalization request (as requestFinalization would).
    await prisma.juryPackage.update({
      where: { id: juryPackage.id },
      data: { finalizationRequestedAt: new Date(), finalizationRequestedBy: deputyId },
    });

    const result = await finalizeJuryPackage(juryPackage.id, deputyId);
    expect(result.juryPackage.status).toBe('FINALIZED');
    // The request it answered is now fulfilled → both fields cleared atomically.
    expect(result.juryPackage.finalizationRequestedAt).toBeNull();
    expect(result.juryPackage.finalizationRequestedBy).toBeNull();

    const persisted = await prisma.juryPackage.findUniqueOrThrow({
      where: { id: juryPackage.id },
    });
    expect(persisted.finalizationRequestedAt).toBeNull();
    expect(persisted.finalizationRequestedBy).toBeNull();
  });

  it('requestFinalization: non-authorized role stamps, authorized role is rejected, already-finalized 409 (F11)', async () => {
    const { caseId, deputyId, judgeId } = fx;
    const clean = await makeExhibit(caseId, `A-${fx.suffix}`);
    await admitClean(clean, deputyId);
    const { juryPackage } = await initiateJuryPackage(caseId, deputyId, 'DEPUTY');

    // A JUDGE (cannot finalize directly) successfully requests.
    const { juryPackage: requested } = await requestFinalization(juryPackage.id, judgeId);
    expect(requested.finalizationRequestedBy).toBe(judgeId);
    expect(requested.finalizationRequestedAt).not.toBeNull();

    // A DEPUTY (already finalize-authorized) is rejected.
    await expect(requestFinalization(juryPackage.id, deputyId)).rejects.toMatchObject({
      code: 'ROLE_NOT_PERMITTED',
      httpStatus: 403,
    });

    // Once finalized, further requests 409.
    await finalizeJuryPackage(juryPackage.id, deputyId);
    await expect(requestFinalization(juryPackage.id, judgeId)).rejects.toMatchObject({
      code: 'JURY_PACKAGE_ALREADY_FINALIZED',
      httpStatus: 409,
    });
  });

  it('computeJuryCandidates never returns a sealed exhibit, even when ADMITTED (F13)', async () => {
    const { caseId, deputyId } = fx;
    const sealedId = await makeExhibit(caseId, `SEALED-${Date.now()}`, { isSealed: true });
    await admitClean(sealedId, deputyId);

    const candidates = await computeJuryCandidates(caseId, 'ADMIN');
    expect(candidates.some((c) => c.exhibitId === sealedId)).toBe(false);
  });

  it('reconcileDraftMembership never deletes a legacy JuryPackageExhibit row for a still-ADMITTED sealed exhibit', async () => {
    const { caseId, deputyId } = fx;
    // A non-sealed admitted exhibit so the package has at least one eligible
    // member (initiate throws NO_ELIGIBLE_EXHIBITS on an all-sealed case).
    const cleanId = await makeExhibit(caseId, `CLEAN-${Date.now()}`);
    await admitClean(cleanId, deputyId);
    const sealedId = await makeExhibit(caseId, `SEALED-LEGACY-${Date.now()}`, { isSealed: true });
    await admitClean(sealedId, deputyId);

    // Simulate a legacy row predating this fix: insert directly (the normal
    // initiate/reconcile path can no longer create this row post-F13 — this
    // is exactly the "regression/legacy data" scenario F13 names).
    const pkg = await initiateJuryPackage(caseId, deputyId, 'DEPUTY');
    await prisma.juryPackageExhibit.create({
      data: { juryPackageId: pkg.juryPackage.id, exhibitId: sealedId, discrepancyStatus: 'CLEAN' },
    });

    // Re-fetching the DRAFT (triggers reconcileDraftMembership) must NOT
    // delete the legacy row — the sealed exhibit is still genuinely ADMITTED.
    await getJuryPackage(caseId, 'ADMIN');

    const survived = await prisma.juryPackageExhibit.findFirst({
      where: { juryPackageId: pkg.juryPackage.id, exhibitId: sealedId },
    });
    expect(survived).not.toBeNull();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // F25 — getJuryPackageReadinessPreview (read-only, zero-write)
  // ──────────────────────────────────────────────────────────────────────────

  it('F25: a clean admitted exhibit (custody, no objection, not sealed) → ready, no blockers', async () => {
    const { caseId, deputyId } = fx;
    const clean = await makeExhibit(caseId, `A-clean-${fx.suffix}`);
    await admitClean(clean, deputyId);

    const { preview } = await getJuryPackageReadinessPreview(caseId, 'DEPUTY');
    const row = preview.find((p) => p.exhibitId === clean)!;
    expect(row).toBeTruthy();
    expect(row.ready).toBe(true);
    expect(row.blockers).toEqual([]);
  });

  it('F25: an admitted exhibit with no custody → NO_CUSTODIAN blocker, not ready', async () => {
    const { caseId, deputyId } = fx;
    const noCustody = await makeExhibit(caseId, `B-nocust-${fx.suffix}`);
    await admitFlagged(noCustody, caseId, deputyId);

    const { preview } = await getJuryPackageReadinessPreview(caseId, 'DEPUTY');
    const row = preview.find((p) => p.exhibitId === noCustody)!;
    expect(row.ready).toBe(false);
    expect(row.blockers.map((b) => b.code)).toContain('NO_CUSTODIAN');
  });

  it('F25: an admitted exhibit with an unresolved objection → UNRESOLVED_OBJECTION blocker', async () => {
    const { caseId, deputyId } = fx;
    const objected = await makeExhibit(caseId, `C-obj-${fx.suffix}`);
    await admitWithUnresolvedObjection(objected, caseId, deputyId);

    const { preview } = await getJuryPackageReadinessPreview(caseId, 'DEPUTY');
    const row = preview.find((p) => p.exhibitId === objected)!;
    expect(row.ready).toBe(false);
    expect(row.blockers.map((b) => b.code)).toContain('UNRESOLVED_OBJECTION');
  });

  it('F25: a sealed admitted exhibit, viewed by an authorized role (ADMIN), is LISTED with SEALED_EXPARTE', async () => {
    const { caseId, deputyId } = fx;
    const sealed = await makeExhibit(caseId, `D-sealed-${fx.suffix}`, { isSealed: true });
    await admitClean(sealed, deputyId); // custody + not objected → SEALED is the only blocker

    const { preview } = await getJuryPackageReadinessPreview(caseId, 'ADMIN');
    const row = preview.find((p) => p.exhibitId === sealed)!;
    expect(row).toBeTruthy();
    expect(row.ready).toBe(false);
    expect(row.blockers.map((b) => b.code)).toContain('SEALED_EXPARTE');
  });

  it('F25: the SAME sealed exhibit is ENTIRELY ABSENT when queried by an unauthorized role (ATTORNEY)', async () => {
    const { caseId, deputyId } = fx;
    const sealed = await makeExhibit(caseId, `E-sealed-${fx.suffix}`, { isSealed: true });
    await admitClean(sealed, deputyId);

    // ADMIN (authorized) sees it listed...
    const admin = await getJuryPackageReadinessPreview(caseId, 'ADMIN');
    expect(admin.preview.some((p) => p.exhibitId === sealed)).toBe(true);

    // ...ATTORNEY (unauthorized) does NOT see it at all — never as a masked/
    // blocked row, entirely omitted (anti-enumeration, T-09-14).
    const attorney = await getJuryPackageReadinessPreview(caseId, 'ATTORNEY');
    expect(attorney.preview.some((p) => p.exhibitId === sealed)).toBe(false);
  });

  it('F25: an exhibit can carry MULTIPLE blockers simultaneously (no custody + unresolved objection)', async () => {
    const { caseId, deputyId } = fx;
    // MARKED→OFFERED, raise objection, then force ADMITTED with NO custody.
    const both = await makeExhibit(caseId, `F-both-${fx.suffix}`);
    await recordStatusChange({ exhibitId: both, toStatus: 'MARKED', actorUserId: deputyId });
    await recordStatusChange({ exhibitId: both, toStatus: 'OFFERED', actorUserId: deputyId });
    await recordObjection({
      exhibitId: both,
      objectingParty: 'DEFENSE',
      grounds: 'Hearsay',
      actorUserId: deputyId,
    });
    const agg = await prisma.exhibitEvent.aggregate({
      where: { exhibitId: both },
      _max: { sequenceNo: true },
    });
    const ev = await prisma.exhibitEvent.create({
      data: {
        exhibitId: both,
        caseId,
        eventType: 'STATUS_CHANGE',
        payload: { fromStatus: 'OBJECTED', toStatus: 'ADMITTED' },
        actorUserId: deputyId,
        sequenceNo: (agg._max.sequenceNo ?? 0) + 1,
      },
    });
    await prisma.exhibitCurrentState.upsert({
      where: { exhibitId: both },
      create: {
        exhibitId: both,
        currentStatus: 'ADMITTED',
        lastStatusEventId: ev.id,
        lastStatusAt: ev.recordedAt,
      },
      update: {
        currentStatus: 'ADMITTED',
        lastStatusEventId: ev.id,
        lastStatusAt: ev.recordedAt,
      },
    });

    const { preview } = await getJuryPackageReadinessPreview(caseId, 'DEPUTY');
    const row = preview.find((p) => p.exhibitId === both)!;
    const codes = row.blockers.map((b) => b.code);
    expect(codes).toContain('NO_CUSTODIAN');
    expect(codes).toContain('UNRESOLVED_OBJECTION');
    expect(row.ready).toBe(false);
  });

  it('F25: viewing the preview any number of times creates ZERO JuryPackage/JuryPackageExhibit rows', async () => {
    const { caseId, deputyId } = fx;
    const clean = await makeExhibit(caseId, `G-clean-${fx.suffix}`);
    await admitClean(clean, deputyId);

    const pkgBefore = await prisma.juryPackage.count({ where: { caseId } });
    const rowBefore = await prisma.juryPackageExhibit.count({
      where: { juryPackage: { caseId } },
    });
    expect(pkgBefore).toBe(0);
    expect(rowBefore).toBe(0);

    // Call it many times, as several roles.
    for (let i = 0; i < 5; i++) {
      await getJuryPackageReadinessPreview(caseId, 'DEPUTY');
      await getJuryPackageReadinessPreview(caseId, 'JUDGE');
      await getJuryPackageReadinessPreview(caseId, 'ATTORNEY');
    }

    const pkgAfter = await prisma.juryPackage.count({ where: { caseId } });
    const rowAfter = await prisma.juryPackageExhibit.count({
      where: { juryPackage: { caseId } },
    });
    expect(pkgAfter).toBe(0);
    expect(rowAfter).toBe(0);
  });

  it('F25: summary counts reflect the role-visible ready/blocked split', async () => {
    const { caseId, deputyId } = fx;
    const ready = await makeExhibit(caseId, `H-ready-${fx.suffix}`);
    const blocked = await makeExhibit(caseId, `I-blocked-${fx.suffix}`);
    await admitClean(ready, deputyId);
    await admitFlagged(blocked, caseId, deputyId); // no custody → blocked

    const { summary } = await getJuryPackageReadinessPreview(caseId, 'DEPUTY');
    expect(summary.totalAdmitted).toBe(2);
    expect(summary.readyCount).toBe(1);
    expect(summary.blockedCount).toBe(1);
  });
});
