import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { runSeed } from '@/data/seed';
import { getExhibitHistory } from '@/services/history';
import { recordStatusChange } from '@/services/status';
import { recordObjection } from '@/services/objections';
import { recordCustodyTransfer } from '@/services/custody';
import { initiateJuryPackage } from '@/services/juryPackage';
import { evaluateDiscrepancies } from '@/services/discrepancies';

// Integration tests for getExhibitHistory (F10) run against the REAL seeded demo
// case produced by runSeed() (Plan 6). Exercising replay against the actual
// 8-exhibit dataset — with its varied, interleaved histories — is the point:
// these assertions would be trivially satisfiable against a toy fixture, but here
// they prove the full ledger-to-timeline reconstruction works on non-trivial,
// out-of-event-type-order data.
//
// The "Jury-Eligible Discrepancy" exhibit is seed label P-3: MARKED → OFFERED →
// (objection raised) → OBJECTED → ADMITTED, with the objection left UNRESOLVED —
// so its timeline interleaves STATUS_CHANGE and OBJECTION_RAISED events in true
// sequence order, not grouped by type.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('getExhibitHistory (F10) against the real seeded case', () => {
  let caseId: string;

  beforeAll(async () => {
    const result = await runSeed();
    caseId = result.caseId;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function exhibitIdByLabel(label: string): Promise<string> {
    const ex = await prisma.exhibit.findFirst({
      where: { caseId, exhibitLabel: label },
      select: { id: true },
    });
    if (!ex) throw new Error(`seed exhibit ${label} not found`);
    return ex.id;
  }

  it('returns null for a nonexistent exhibit (route maps to 404)', async () => {
    const result = await getExhibitHistory('00000000-0000-0000-0000-000000000000', 'JUDGE');
    expect(result).toBeNull();
  });

  it('reconstructs the complete, sequence-ordered timeline for the jury-eligible exhibit (P-3)', async () => {
    const exhibitId = await exhibitIdByLabel('P-3');
    const history = await getExhibitHistory(exhibitId, 'JUDGE');

    expect(history).not.toBeNull();
    if (!history) return;

    // Header fields: post-F12, P-3's admission is blocked, so it stops at
    // OBJECTED with no custody chain (no custodian of record).
    expect(history.currentStatus).toBe('OBJECTED');
    expect(history.currentCustodianName).toBeNull();

    // Timeline must be COMPLETE (every event, no truncation) and in sequence
    // order. Post-F12 P-3: STATUS_CHANGE(MARKED), STATUS_CHANGE(OFFERED),
    // OBJECTION_RAISED, STATUS_CHANGE(OBJECTED) — 4 events, zero custody
    // transfers (admission-blocked fixture).
    const types = history.timeline.map((t) => t.eventType);
    expect(types).toEqual([
      'STATUS_CHANGE',
      'STATUS_CHANGE',
      'OBJECTION_RAISED',
      'STATUS_CHANGE',
    ]);

    // The OBJECTION_RAISED event must appear AFTER the OFFERED status change and
    // BEFORE the OBJECTED one — proving interleaving by sequence, not grouping by
    // event type.
    const objectionIdx = types.indexOf('OBJECTION_RAISED');
    const offeredIdx = history.timeline.findIndex((t) =>
      t.summary.includes('to OFFERED'),
    );
    const objectedIdx = history.timeline.findIndex((t) =>
      t.summary.includes('to OBJECTED'),
    );
    expect(offeredIdx).toBeGreaterThanOrEqual(0);
    expect(objectedIdx).toBeGreaterThanOrEqual(0);
    expect(objectionIdx).toBeGreaterThan(offeredIdx);
    expect(objectionIdx).toBeLessThan(objectedIdx);

    // recordedAt timestamps are non-decreasing across the ordered timeline.
    for (let i = 1; i < history.timeline.length; i++) {
      expect(
        new Date(history.timeline[i].recordedAt).getTime(),
      ).toBeGreaterThanOrEqual(
        new Date(history.timeline[i - 1].recordedAt).getTime(),
      );
    }
  });

  it('renders every entry with a plain-language summary and a resolved actor name (no raw enum/JSON/UUID leaks)', async () => {
    const exhibitId = await exhibitIdByLabel('P-3');
    const history = await getExhibitHistory(exhibitId, 'JUDGE');
    expect(history).not.toBeNull();
    if (!history) return;

    for (const entry of history.timeline) {
      // Summary is non-empty, human-readable prose — not a bare enum token or a
      // JSON blob.
      expect(entry.summary.length).toBeGreaterThan(0);
      expect(entry.summary).not.toBe(entry.eventType);
      expect(entry.summary).not.toMatch(/[{}]/); // no leaked JSON
      expect(entry.summary).toMatch(/\s/); // multi-word prose

      // actorName is a resolved human name, never a bare UUID.
      expect(entry.actorName.length).toBeGreaterThan(0);
      expect(entry.actorName).not.toMatch(UUID_RE);
    }

    // Custody summaries (on any exhibit that HAS them) resolve the from/to
    // custodian to NAMES, not UUIDs. Post-F12 P-3 has no custody transfers, so
    // assert the prose/UUID contract against a seeded exhibit that does: P-4
    // (cleanly admitted with a full custody chain).
    const p4History = await getExhibitHistory(await exhibitIdByLabel('P-4'), 'JUDGE');
    expect(p4History).not.toBeNull();
    const custodyEntries = (p4History?.timeline ?? []).filter(
      (t) => t.eventType === 'CUSTODY_TRANSFER',
    );
    expect(custodyEntries.length).toBeGreaterThan(0);
    for (const c of custodyEntries) {
      expect(c.summary).toMatch(/^Custody transferred from .+ to .+/);
      // No embedded UUID anywhere in the custody summary.
      expect(c.summary).not.toMatch(UUID_RE);
    }
  });

  it('discrepancyFlags is always [] post-F12 — no seeded exhibit can carry an open flag (structural guarantee)', async () => {
    // F12's admission gate makes it structurally impossible for a fresh seed
    // exhibit to reach ADMITTED while either F6 precondition holds (no custodian
    // / open objection), so neither rule can fire on seed data. P-2 is now
    // OFFERED and P-3 is OBJECTED — both yield []. P-4 (cleanly admitted) is []
    // as an additional confirming data point. F6's rule-engine logic itself is
    // still fully covered by discrepancies.test.ts's white-box fixtures (which
    // construct the precondition directly).
    const p2 = await getExhibitHistory(await exhibitIdByLabel('P-2'), 'JUDGE');
    expect(p2).not.toBeNull();
    expect(p2!.discrepancyFlags).toEqual([]);

    const p3 = await getExhibitHistory(await exhibitIdByLabel('P-3'), 'JUDGE');
    expect(p3).not.toBeNull();
    expect(p3!.discrepancyFlags).toEqual([]);

    const p4 = await getExhibitHistory(await exhibitIdByLabel('P-4'), 'JUDGE');
    expect(p4).not.toBeNull();
    expect(p4!.discrepancyFlags).toEqual([]);
  });

  it('reconstructs the full history for the admission-blocked exhibit (P-2) with no custodian name', async () => {
    const exhibitId = await exhibitIdByLabel('P-2');
    const history = await getExhibitHistory(exhibitId, 'JUDGE');
    expect(history).not.toBeNull();
    if (!history) return;

    // P-2 is OFFERED (never admitted — F12 blocks it) and has ZERO custody
    // transfers.
    expect(history.currentStatus).toBe('OFFERED');
    expect(history.currentCustodianName).toBeNull();
    expect(
      history.timeline.filter((t) => t.eventType === 'CUSTODY_TRANSFER'),
    ).toHaveLength(0);
  });

  describe('sealed-exhibit role-based visibility (inherited from getExhibit)', () => {
    let sealedId: string;

    beforeAll(async () => {
      // Create a sealed exhibit in the seeded case, with one ledger event so a
      // visible history would have a non-empty timeline — proving the null for an
      // unauthorized role is masking, not merely an empty history.
      const sealed = await prisma.exhibit.create({
        data: {
          caseId,
          exhibitLabel: `SEALED-HISTORY-${Date.now()}`,
          description: 'A sealed exhibit for history-masking tests',
          offeringParty: 'PROSECUTION',
          isSealed: true,
        },
      });
      sealedId = sealed.id;
      const actor = await prisma.user.findFirst({ where: { caseId } });
      if (!actor) throw new Error('seed produced no users');
      await prisma.exhibitEvent.create({
        data: {
          exhibitId: sealedId,
          caseId,
          eventType: 'STATUS_CHANGE',
          payload: { fromStatus: null, toStatus: 'MARKED' },
          actorUserId: actor.id,
          sequenceNo: 1,
        },
      });
    });

    it('resolves to null for a sealed exhibit read by an unauthorized role (ATTORNEY)', async () => {
      const history = await getExhibitHistory(sealedId, 'ATTORNEY');
      expect(history).toBeNull();
    });

    it('resolves to the full history for a sealed exhibit read by JUDGE', async () => {
      const history = await getExhibitHistory(sealedId, 'JUDGE');
      expect(history).not.toBeNull();
      expect(history?.exhibit.id).toBe(sealedId);
      expect(history?.timeline.length).toBeGreaterThan(0);
    });
  });
});

// Phase 8 (F10 §Process steps 4-6): the three new Exhibit Detail right-rail data
// sources getExhibitHistory now additionally returns — objections[], custodyCard,
// and juryPackageChecklist. These use SELF-CONTAINED fixtures built through the
// live service write paths (unique caseNumber per test, no reliance on the shared
// seed) so the precise cardinality/eligibility assertions below are deterministic
// under fileParallelism:false — mirroring discrepancies.test.ts/juryPackage.test.ts.
describe('getExhibitHistory — Phase 8 right-rail sections (F10)', () => {
  let caseId: string;
  let judgeId: string;
  let deputyId: string;
  let clerkId: string;
  let attorneyId: string;
  let suffix: string;

  beforeEach(async () => {
    suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const kase = await prisma.case.create({
      data: {
        caseNumber: `TEST-HISTORY-P8-${suffix}`,
        title: 'History Phase-8 Test Case',
        court: 'Test Court',
      },
    });
    caseId = kase.id;
    const judge = await prisma.user.create({
      data: { caseId, name: 'Judge J', role: 'JUDGE' },
    });
    judgeId = judge.id;
    const deputy = await prisma.user.create({
      data: { caseId, name: 'Deputy D', role: 'DEPUTY' },
    });
    deputyId = deputy.id;
    const clerk = await prisma.user.create({
      data: { caseId, name: 'Clerk C', role: 'CLERK' },
    });
    clerkId = clerk.id;
    const attorney = await prisma.user.create({
      data: { caseId, name: 'Attorney A', role: 'ATTORNEY' },
    });
    attorneyId = attorney.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function makeExhibit(
    label: string,
    opts: { isSealed?: boolean } = {},
  ): Promise<string> {
    const ex = await prisma.exhibit.create({
      data: {
        caseId,
        exhibitLabel: `${label}-${suffix}`,
        description: `Exhibit ${label}`,
        offeringParty: 'PROSECUTION',
        isSealed: opts.isSealed ?? false,
      },
    });
    return ex.id;
  }

  // Force the ADMITTED transition directly (F12's live gate forbids reaching
  // ADMITTED with an open objection / no custody for real callers — by design).
  // This is the SAME test-only bypass pattern discrepancies.test.ts uses, so a
  // genuinely-ADMITTED-with-open-issue subject can exist for these read-side tests.
  async function forceAdmit(exhibitId: string, fromStatus: string): Promise<void> {
    const agg = await prisma.exhibitEvent.aggregate({
      where: { exhibitId },
      _max: { sequenceNo: true },
    });
    const event = await prisma.exhibitEvent.create({
      data: {
        exhibitId,
        caseId,
        eventType: 'STATUS_CHANGE',
        payload: { fromStatus, toStatus: 'ADMITTED' },
        actorUserId: judgeId,
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
    await evaluateDiscrepancies(exhibitId);
  }

  // --- objections[] ---

  it('objections[] carries every UNRESOLVED thread — length 2 for two concurrent objections', async () => {
    const exhibitId = await makeExhibit('OBJ2');
    await recordStatusChange({ exhibitId, toStatus: 'MARKED', actorUserId: deputyId });
    await recordStatusChange({ exhibitId, toStatus: 'OFFERED', actorUserId: deputyId });
    await recordObjection({
      exhibitId,
      objectingParty: 'DEFENSE',
      grounds: 'Hearsay',
      actorUserId: attorneyId,
    });
    await recordObjection({
      exhibitId,
      objectingParty: 'DEFENSE',
      grounds: 'Lack of foundation',
      actorUserId: attorneyId,
    });

    const history = await getExhibitHistory(exhibitId, 'JUDGE');
    expect(history).not.toBeNull();
    expect(history!.objections).toHaveLength(2);
    // Each entry is a full ObjectionCurrentState row (UNRESOLVED), not a summary.
    for (const o of history!.objections) {
      expect(o.exhibitId).toBe(exhibitId);
      expect(o.status).toBe('UNRESOLVED');
      expect(typeof o.objectionId).toBe('string');
      expect(typeof o.grounds).toBe('string');
    }
  });

  it('objections[] is [] (not omitted) when there are zero unresolved objections', async () => {
    const exhibitId = await makeExhibit('OBJ0');
    await recordStatusChange({ exhibitId, toStatus: 'MARKED', actorUserId: deputyId });

    const history = await getExhibitHistory(exhibitId, 'JUDGE');
    expect(history).not.toBeNull();
    expect(history!.objections).toEqual([]);
  });

  // --- custodyCard ---

  it('custodyCard is empty (current null, pendingTransfer null, history []) for an exhibit with no custody row', async () => {
    const exhibitId = await makeExhibit('CUST0');
    await recordStatusChange({ exhibitId, toStatus: 'MARKED', actorUserId: deputyId });

    const history = await getExhibitHistory(exhibitId, 'JUDGE');
    expect(history).not.toBeNull();
    expect(history!.custodyCard.current).toBeNull();
    expect(history!.custodyCard.pendingTransfer).toBeNull();
    expect(history!.custodyCard.history).toEqual([]);
  });

  it('custodyCard.history has the full chain in chronological order (length 2), pendingTransfer null', async () => {
    const exhibitId = await makeExhibit('CUST2');
    await recordStatusChange({ exhibitId, toStatus: 'MARKED', actorUserId: deputyId });
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

    const history = await getExhibitHistory(exhibitId, 'JUDGE');
    expect(history).not.toBeNull();
    expect(history!.custodyCard.pendingTransfer).toBeNull();
    expect(history!.custodyCard.current).not.toBeNull();
    const chain = history!.custodyCard.history;
    expect(chain).toHaveLength(2);
    // Chronological: null→deputy, then deputy→clerk.
    expect(chain[0].fromCustodian).toBeNull();
    expect(chain[0].toCustodian).toBe(deputyId);
    expect(chain[1].fromCustodian).toBe(deputyId);
    expect(chain[1].toCustodian).toBe(clerkId);
    // timestamps are ISO strings (serialized for the HTTP response).
    expect(typeof chain[0].timestamp).toBe('string');
    expect(new Date(chain[0].timestamp).getTime()).toBeLessThanOrEqual(
      new Date(chain[1].timestamp).getTime(),
    );
  });

  // --- juryPackageChecklist ---

  it('juryPackageChecklist: a clean, admitted, custody-complete, objection-free, non-sealed, package-INCLUDED exhibit is all-true + INCLUDED', async () => {
    const exhibitId = await makeExhibit('CLEAN');
    await recordStatusChange({ exhibitId, toStatus: 'MARKED', actorUserId: deputyId });
    await recordStatusChange({ exhibitId, toStatus: 'OFFERED', actorUserId: deputyId });
    await recordCustodyTransfer({
      exhibitId,
      fromCustodianUserId: null,
      toCustodianUserId: deputyId,
      reason: 'intake',
      actorUserId: deputyId,
    });
    await recordStatusChange({ exhibitId, toStatus: 'ADMITTED', actorUserId: judgeId });
    // Build a jury package so the exhibit becomes an INCLUDED+CLEAN member row —
    // this is what loadJuryEligibilityByExhibit reads to return 'INCLUDED'.
    await initiateJuryPackage(caseId, deputyId, 'DEPUTY');

    const history = await getExhibitHistory(exhibitId, 'JUDGE');
    expect(history).not.toBeNull();
    const c = history!.juryPackageChecklist;
    expect(c.admitted).toBe(true);
    expect(c.objectionsResolved).toBe(true);
    expect(c.custodianOnRecord).toBe(true);
    expect(c.classificationTrial).toBe(true);
    expect(c.eligibility).toBe('INCLUDED');
  });

  it('juryPackageChecklist: an OFFERED (not-yet-admitted) exhibit is admitted=false, eligibility NOT_ELIGIBLE', async () => {
    const exhibitId = await makeExhibit('OFFERED');
    await recordStatusChange({ exhibitId, toStatus: 'MARKED', actorUserId: deputyId });
    await recordStatusChange({ exhibitId, toStatus: 'OFFERED', actorUserId: deputyId });

    const history = await getExhibitHistory(exhibitId, 'JUDGE');
    expect(history).not.toBeNull();
    const c = history!.juryPackageChecklist;
    expect(c.admitted).toBe(false);
    expect(c.eligibility).toBe('NOT_ELIGIBLE');
  });

  it('juryPackageChecklist: a sealed exhibit (read by JUDGE) has classificationTrial=false', async () => {
    const exhibitId = await makeExhibit('SEALED', { isSealed: true });
    await recordStatusChange({ exhibitId, toStatus: 'MARKED', actorUserId: deputyId });

    const history = await getExhibitHistory(exhibitId, 'JUDGE');
    expect(history).not.toBeNull();
    expect(history!.juryPackageChecklist.classificationTrial).toBe(false);
  });

  it('juryPackageChecklist: an ADMITTED exhibit with an unresolved objection is admitted=true but objectionsResolved=false', async () => {
    const exhibitId = await makeExhibit('ADMOBJ');
    await recordStatusChange({ exhibitId, toStatus: 'MARKED', actorUserId: deputyId });
    await recordStatusChange({ exhibitId, toStatus: 'OFFERED', actorUserId: deputyId });
    await recordObjection({
      exhibitId,
      objectingParty: 'DEFENSE',
      grounds: 'Relevance',
      actorUserId: attorneyId,
    });
    await recordStatusChange({ exhibitId, toStatus: 'OBJECTED', actorUserId: clerkId });
    await forceAdmit(exhibitId, 'OBJECTED');

    const history = await getExhibitHistory(exhibitId, 'JUDGE');
    expect(history).not.toBeNull();
    const c = history!.juryPackageChecklist;
    expect(c.admitted).toBe(true);
    expect(c.objectionsResolved).toBe(false);
    expect(history!.objections).toHaveLength(1);
  });
});
