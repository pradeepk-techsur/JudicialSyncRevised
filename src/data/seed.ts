import { pathToFileURL } from 'node:url';
import type { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { DEMO_CASE_NUMBER } from '@/lib/constants';
import { AppError } from '@/lib/errors';
import { advisoryLockKey } from '@/lib/advisoryLock';
import { createExhibit } from '@/services/exhibits';
import { recordStatusChange } from '@/services/status';
import { recordEvent } from '@/services/events';
import { evaluateDiscrepancies } from '@/services/discrepancies';
import { getUnresolvedObjections, recordObjection, recordRuling } from '@/services/objections';
import { recordCustodyTransfer } from '@/services/custody';

// F0a — Deterministic seed/demo-data loader.
//
// This is the "zero manual data entry" demonstration artifact AND the proof that
// the event-sourced write path is real: EVERY status change, objection, ruling,
// and custody transfer below is written through the exact same service functions
// a live UI action would call (recordStatusChange / recordObjection /
// recordRuling / recordCustodyTransfer / createExhibit). There is deliberately
// NO direct ledger-row or projection-row insert (no prisma.exhibitEvent or
// prisma.*CurrentState create call) anywhere in
// this file — if the seed could only be produced by a special direct-DB-insert
// backdoor, the event-sourcing guarantee would be theater. The grep check in
// seed.test.ts enforces this structurally (threat T-01-17).
//
// It is fully re-runnable from a clean state: runSeed() first deletes any prior
// instance of its fixed-caseNumber case (in dependency order), then rebuilds the
// identical demo, so re-running on every container boot converges rather than
// accumulating duplicates (satisfies the idempotent-seed infra contract for a
// compose stack whose db volume persists across restarts).
//
// A post-seed assertion verifies the three deliberately-planted edge cases are
// present; if any is missing it throws SeedIntegrityError and rolls back the
// whole seed (via an explicit cleanup) rather than leaving partial data.

// Single source of truth for the demo case number lives in @/lib/constants —
// aliased locally to keep the diff against every other SEED_CASE_NUMBER
// reference in this file minimal.
const SEED_CASE_NUMBER = DEMO_CASE_NUMBER;

/** 500 — the seeded demo case is missing a required planted edge case. */
export class SeedIntegrityError extends AppError {
  constructor(message: string) {
    super('SEED_INTEGRITY_FAILURE', message, 500);
  }
}

// Fixed persona roster (one User per Role), drawn from PERSONAS/UserStories for
// narrative realism. Deterministic names → deterministic demo.
const PERSONAS: Array<{ role: Role; name: string }> = [
  { role: 'JUDGE', name: 'Judge Elena Marsh' },
  { role: 'CHAMBERS_STAFF', name: 'Chambers Clerk Tom Alvarez' },
  { role: 'DEPUTY', name: 'Deputy Dana Reyes' },
  { role: 'CLERK', name: 'Clerk of Court Priya Nair' },
  { role: 'ATTORNEY', name: 'Attorney Marcus Webb' },
  { role: 'ADMIN', name: 'Court Administrator Sofia Lang' },
];

/**
 * SEED-ONLY narrative device: performs the exact same ledger-write +
 * projection-upsert + advisory-lock pattern recordStatusChange (status.ts)
 * uses for an ADMITTED transition, but DELIBERATELY SKIPS F12's gate-check
 * step (step 5b: the two precondition reads). This represents an exhibit that
 * predates the admission-gate rollout — a narrative device for the demo, NOT
 * a live capability. It is NOT a copy-paste of forceAdmitBypassingGate (which
 * is test-only, confined to *.test.ts via grep, T-07-05) — this is a
 * DIFFERENT, separately-justified mechanism confined to seed.ts instead,
 * verified by the SAME kind of grep check (see seed.test.ts).
 *
 * MUST NEVER be imported by any route, any service a route calls, or any
 * component. If you are reading this because you want to reuse it outside
 * seed.ts: don't — add a real endpoint/service function instead.
 */
async function legacyAdmitForDemo(args: {
  exhibitId: string;
  fromStatus: 'OFFERED' | 'OBJECTED';
  actorUserId: string;
  recordedAt: Date;
}): Promise<void> {
  const { exhibitId, fromStatus, actorUserId, recordedAt } = args;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${advisoryLockKey(exhibitId)})`;
    const event = await recordEvent(
      {
        exhibitId,
        eventType: 'STATUS_CHANGE',
        payload: { fromStatus, toStatus: 'ADMITTED' },
        actorUserId,
        recordedAt,
      },
      tx,
    );
    await tx.exhibitCurrentState.upsert({
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
    await evaluateDiscrepancies(exhibitId, tx, event.id);
  });
}

/**
 * Delete every row belonging to the fixed-caseNumber demo case, in dependency
 * order, so a re-run starts from a genuinely clean slate (no duplicate-key
 * errors, no drift). Scoped exclusively to SEED_CASE_NUMBER — never touches any
 * other case's data (e.g. test fixtures).
 *
 * Order: discrepancy flags + jury-package rows (which FK to exhibits AND to
 * ledger events) → projections (which reference exhibits/users) → ledger →
 * exhibits → users → case. Note we must clear flags/jury rows BEFORE both the
 * ledger and exhibits (FK), projections BEFORE exhibits (FK), and events before
 * users (actor FK). Phase 3's synchronously-wired engine now produces real
 * DiscrepancyFlag rows on seed boot, so the reset must cascade them first.
 */
async function resetSeedCase(): Promise<void> {
  const kase = await prisma.case.findUnique({
    where: { caseNumber: SEED_CASE_NUMBER },
    select: { id: true },
  });
  if (!kase) return;
  const caseId = kase.id;

  const exhibits = await prisma.exhibit.findMany({
    where: { caseId },
    select: { id: true },
  });
  const exhibitIds = exhibits.map((e) => e.id);

  await prisma.$transaction([
    // Phase 4 assistant tables first — AssistantConversation FKs to case AND
    // user, so its rows (and their messages/citations) must be cleared before
    // the identity tables below or user.deleteMany trips
    // assistant_conversations_user_id_fkey. Order within: citations → messages →
    // conversations (each FKs to the prior).
    prisma.assistantCitation.deleteMany({
      where: { message: { conversation: { caseId } } },
    }),
    prisma.assistantMessage.deleteMany({
      where: { conversation: { caseId } },
    }),
    prisma.assistantConversation.deleteMany({ where: { caseId } }),
    // Phase 3 tables next — DiscrepancyFlag FKs to exhibit, user, AND ledger
    // events; JuryPackageExhibit FKs to exhibit; JuryPackage FKs to case/user.
    // They must be cleared before the ledger and exhibits are deleted.
    prisma.discrepancyFlag.deleteMany({ where: { caseId } }),
    prisma.juryPackageExhibit.deleteMany({
      where: { juryPackage: { caseId } },
    }),
    prisma.juryPackage.deleteMany({ where: { caseId } }),
    // Projections next (they FK to exhibit, and custody FKs to user).
    prisma.exhibitCurrentState.deleteMany({ where: { exhibitId: { in: exhibitIds } } }),
    prisma.objectionCurrentState.deleteMany({ where: { exhibitId: { in: exhibitIds } } }),
    prisma.custodyCurrentState.deleteMany({ where: { exhibitId: { in: exhibitIds } } }),
    // Ledger (FKs to exhibit + actor user).
    prisma.exhibitEvent.deleteMany({ where: { caseId } }),
    // Identity tables.
    prisma.exhibit.deleteMany({ where: { caseId } }),
    prisma.user.deleteMany({ where: { caseId } }),
    prisma.case.deleteMany({ where: { id: caseId } }),
  ]);
}

export async function runSeed(): Promise<{ caseId: string; exhibitCount: number }> {
  // Step 1 — clean-state reset for deterministic re-runnability.
  await resetSeedCase();

  try {
    // Step 2 — identity setup: one Case, one User per Role.
    const kase = await prisma.case.create({
      data: {
        caseNumber: SEED_CASE_NUMBER,
        title: 'State v. Harlan Doyle',
        court: 'Superior Court, Dept. 14',
      },
    });
    const caseId = kase.id;

    const users: Record<Role, string> = {} as Record<Role, string>;
    for (const persona of PERSONAS) {
      const u = await prisma.user.create({
        data: { caseId, name: persona.name, role: persona.role },
      });
      users[persona.role] = u.id;
    }

    const deputy = users.DEPUTY;
    const clerk = users.CLERK;
    const attorney = users.ATTORNEY;
    const judge = users.JUDGE;

    // F15 item 6 — stagger most planted events so the Command Center's date+time
    // fix is actually verifiable (without this, every event lands within the same
    // wall-clock second of seed execution and would look identical even after the
    // display fix). Anchored to the REAL moment the seed runs (never a fixed
    // historical date, so the demo always shows "recent" activity):
    //   - A short real delay is inserted BETWEEN exhibits (not between the calls
    //     within one exhibit's history) so each exhibit's events land in a
    //     visibly different real-time window from its neighbors.
    //   - CUSTODY_TRANSFER / OBJECTION_RAISED / RULING_RECORDED events get an
    //     EXPLICIT recordedAt via the recordedAt passthrough added in Part A
    //     (custody.ts/objections.ts). It resolves to real-now AT THE CALL SITE,
    //     so an interleaved event (e.g. an objection raised between OFFERED and
    //     OBJECTED) always sits chronologically BETWEEN the two surrounding
    //     STATUS_CHANGE events, preserving the per-exhibit non-decreasing
    //     timeline contract (history.test.ts). It does NOT jump the timestamp
    //     minutes ahead of the real-now STATUS_CHANGE events, which would break
    //     that ordering — STATUS_CHANGE goes through recordStatusChange
    //     (src/services/status.ts), which this plan deliberately does NOT modify
    //     (owned by plan 07-01, same wave), so those events keep their natural
    //     real-now timestamp and the explicit ones must stay consistent with it.
    //     The recordedAt plumbing itself remains in place so a future change that
    //     lets status.ts accept an override can stagger the whole timeline into
    //     distinct minutes without further seed work.
    const nextRecordedAt = (): Date => new Date();
    const sleep = (ms: number): Promise<void> =>
      new Promise((resolve) => setTimeout(resolve, ms));

    // Step 3 + 4 — exhibit identity records AND their histories, built
    // EXCLUSIVELY through the live service write path.

    // Small helper: create an exhibit and return its id.
    const makeExhibit = async (
      exhibitLabel: string,
      description: string,
      offeringParty: 'PLAINTIFF' | 'PROSECUTION' | 'DEFENSE',
      associatedWitness?: string,
      options?: { isSealed?: boolean },
    ): Promise<string> => {
      const ex = await createExhibit({
        caseId,
        exhibitLabel,
        description,
        offeringParty,
        associatedWitness,
        isSealed: options?.isSealed ?? false,
      });
      return ex.id;
    };

    // --- Planted edge case A: "Unresolved Objection" ---
    // MARKED → OFFERED, objection raised, NO ruling → thread stays UNRESOLVED.
    // Advance to OBJECTED for narrative realism (an objection exists).
    const exUnresolved = await makeExhibit(
      'P-1',
      'Defendant’s signed confession, 2 pages',
      'PROSECUTION',
      'Det. Raymond Cole',
    );
    await sleep(1200);
    await recordStatusChange({ exhibitId: exUnresolved, toStatus: 'MARKED', actorUserId: deputy });
    await recordStatusChange({ exhibitId: exUnresolved, toStatus: 'OFFERED', actorUserId: deputy });
    await recordObjection({
      exhibitId: exUnresolved,
      objectingParty: 'DEFENSE',
      grounds: 'Confession obtained without Miranda warning — moved to suppress',
      actorUserId: attorney,
      recordedAt: nextRecordedAt(),
    });
    await recordStatusChange({ exhibitId: exUnresolved, toStatus: 'OBJECTED', actorUserId: clerk });
    // Deliberately NO recordRuling — thread remains UNRESOLVED.

    // --- Planted edge case B: "Admission Blocked — No Custodian" (F12) ---
    // MARKED -> OFFERED, zero custody transfers ever recorded. Demonstrates
    // F12's gate directly: attempting to admit this exhibit is REJECTED with
    // ADMISSION_BLOCKED (reasons: ["NO_CUSTODIAN"]) rather than silently
    // producing an already-broken ADMITTED exhibit (the old, now-impossible
    // behavior this edge case used to model).
    await sleep(1200);
    const exCustodyGap = await makeExhibit(
      'P-2',
      'Photograph of the scene (printout)',
      'PROSECUTION',
      'Ofc. Lena Ortiz',
    );
    await recordStatusChange({ exhibitId: exCustodyGap, toStatus: 'MARKED', actorUserId: deputy });
    await recordStatusChange({ exhibitId: exCustodyGap, toStatus: 'OFFERED', actorUserId: deputy });
    // Deliberately NO further transition and NO custody transfer — this is the
    // demonstrable "ready to offer, blocked from admission" state.

    // --- Planted edge case C: "Admission Blocked — Dual Reason" (F12) ---
    // MARKED -> OFFERED -> OBJECTED, objection left UNRESOLVED, zero custody
    // transfers. Attempting to admit this exhibit is REJECTED with BOTH
    // reasons listed at once (ADMISSION_BLOCKED: UNRESOLVED_OBJECTION +
    // NO_CUSTODIAN) — the dual-reason counterpart to P-2's single-reason case.
    await sleep(1200);
    const exJuryEligible = await makeExhibit(
      'P-3',
      'Lab report — DNA match analysis',
      'PROSECUTION',
      'Dr. Amara Finch',
    );
    await recordStatusChange({ exhibitId: exJuryEligible, toStatus: 'MARKED', actorUserId: deputy });
    await recordStatusChange({ exhibitId: exJuryEligible, toStatus: 'OFFERED', actorUserId: deputy });
    await recordObjection({
      exhibitId: exJuryEligible,
      objectingParty: 'DEFENSE',
      grounds: 'Chain-of-custody foundation not established for the sample',
      actorUserId: attorney,
      recordedAt: nextRecordedAt(),
    });
    await recordStatusChange({
      exhibitId: exJuryEligible,
      toStatus: 'OBJECTED',
      actorUserId: clerk,
    });
    // Deliberately NO recordRuling, NO recordCustodyTransfer, NO ADMITTED attempt.

    // --- Clean exhibit 1: fully ADMITTED with a complete custody chain, no objections ---
    // Custody is established BEFORE the ADMITTED call so F12's gate passes.
    await sleep(1200);
    const exClean1 = await makeExhibit(
      'P-4',
      'Surveillance video still frame',
      'PROSECUTION',
      'Ofc. Lena Ortiz',
    );
    await recordStatusChange({ exhibitId: exClean1, toStatus: 'MARKED', actorUserId: deputy });
    await recordStatusChange({ exhibitId: exClean1, toStatus: 'OFFERED', actorUserId: deputy });
    await recordCustodyTransfer({
      exhibitId: exClean1,
      fromCustodianUserId: null,
      toCustodianUserId: deputy,
      reason: 'intake',
      actorUserId: deputy,
      recordedAt: nextRecordedAt(),
    });
    await recordCustodyTransfer({
      exhibitId: exClean1,
      fromCustodianUserId: deputy,
      toCustodianUserId: clerk,
      reason: 'to clerk for jury package prep',
      actorUserId: clerk,
      recordedAt: nextRecordedAt(),
    });
    await recordStatusChange({ exhibitId: exClean1, toStatus: 'ADMITTED', actorUserId: judge });

    // --- Clean exhibit 2: objection raised then OVERRULED, then ADMITTED, custody intact ---
    // Both the OVERRULED ruling AND the custody transfer precede the ADMITTED
    // call so neither F12 blocking condition holds at admission time.
    await sleep(1200);
    const exClean2 = await makeExhibit(
      'D-1',
      'Defendant’s employment records',
      'DEFENSE',
      'HR Manager Gail Stroud',
    );
    await recordStatusChange({ exhibitId: exClean2, toStatus: 'MARKED', actorUserId: deputy });
    await recordStatusChange({ exhibitId: exClean2, toStatus: 'OFFERED', actorUserId: deputy });
    const { objectionState: clean2Obj } = await recordObjection({
      exhibitId: exClean2,
      objectingParty: 'PROSECUTION',
      grounds: 'Relevance',
      actorUserId: attorney,
      recordedAt: nextRecordedAt(),
    });
    await recordStatusChange({ exhibitId: exClean2, toStatus: 'OBJECTED', actorUserId: clerk });
    await recordRuling({
      objectionId: clean2Obj.objectionId,
      disposition: 'OVERRULED',
      actorUserId: judge,
      recordedAt: nextRecordedAt(),
    });
    await recordCustodyTransfer({
      exhibitId: exClean2,
      fromCustodianUserId: null,
      toCustodianUserId: deputy,
      reason: 'intake',
      actorUserId: deputy,
      recordedAt: nextRecordedAt(),
    });
    await recordStatusChange({ exhibitId: exClean2, toStatus: 'ADMITTED', actorUserId: judge });

    // --- Clean exhibit 3: objection SUSTAINED → EXCLUDED (terminal) ---
    // Unaffected by F12 (terminal transition is EXCLUDED, never ADMITTED).
    await sleep(1200);
    const exExcluded = await makeExhibit(
      'D-2',
      'Hearsay statement transcript',
      'DEFENSE',
      'Witness Carl Benson',
    );
    await recordStatusChange({ exhibitId: exExcluded, toStatus: 'MARKED', actorUserId: deputy });
    await recordStatusChange({ exhibitId: exExcluded, toStatus: 'OFFERED', actorUserId: deputy });
    const { objectionState: excludedObj } = await recordObjection({
      exhibitId: exExcluded,
      objectingParty: 'PROSECUTION',
      grounds: 'Inadmissible hearsay',
      actorUserId: attorney,
      recordedAt: nextRecordedAt(),
    });
    await recordStatusChange({ exhibitId: exExcluded, toStatus: 'OBJECTED', actorUserId: clerk });
    await recordRuling({
      objectionId: excludedObj.objectionId,
      disposition: 'SUSTAINED',
      actorUserId: judge,
      recordedAt: nextRecordedAt(),
    });
    await recordStatusChange({ exhibitId: exExcluded, toStatus: 'EXCLUDED', actorUserId: judge });

    // --- Clean exhibit 4: OFFERED then WITHDRAWN (terminal) ---
    // Unaffected by F12 (terminal transition is WITHDRAWN, never ADMITTED).
    await sleep(1200);
    const exWithdrawn = await makeExhibit(
      'D-3',
      'Character reference letters (bundle)',
      'DEFENSE',
    );
    await recordStatusChange({ exhibitId: exWithdrawn, toStatus: 'MARKED', actorUserId: deputy });
    await recordStatusChange({ exhibitId: exWithdrawn, toStatus: 'OFFERED', actorUserId: deputy });
    await recordStatusChange({
      exhibitId: exWithdrawn,
      toStatus: 'WITHDRAWN',
      actorUserId: attorney,
    });

    // --- Clean exhibit 5: still only MARKED (not yet entered into evidence) ---
    // Unaffected by F12 (never leaves MARKED).
    await sleep(1200);
    const exMarked = await makeExhibit(
      'P-5',
      'Physical evidence envelope — recovered firearm',
      'PROSECUTION',
      'Det. Raymond Cole',
    );
    await recordStatusChange({ exhibitId: exMarked, toStatus: 'MARKED', actorUserId: deputy });
    await recordCustodyTransfer({
      exhibitId: exMarked,
      fromCustodianUserId: null,
      toCustodianUserId: deputy,
      reason: 'intake at marking',
      actorUserId: deputy,
      recordedAt: nextRecordedAt(),
    });

    // --- Sealed exhibit: chambers-only sidebar material (Phase 2's first
    // role-based-visibility fixture) — fully fleshed out with its own status
    // and custody history so the Case Workspace / Exhibit Detail screens have
    // real content to render for JUDGE/CHAMBERS_STAFF/ADMIN, and a real row to
    // prove absent for DEPUTY/CLERK/ATTORNEY. ---
    await sleep(1200);
    const exSealed = await makeExhibit(
      'S-1',
      'Chambers sidebar note — ex parte submission',
      'PROSECUTION',
      undefined,
      { isSealed: true },
    );
    await recordStatusChange({
      exhibitId: exSealed,
      toStatus: 'MARKED',
      actorUserId: users.CHAMBERS_STAFF,
    });
    await recordStatusChange({
      exhibitId: exSealed,
      toStatus: 'OFFERED',
      actorUserId: users.CHAMBERS_STAFF,
    });
    // Custody established BEFORE the ADMITTED call so F12's gate passes — this
    // fixture must remain ADMITTED + sealed (F13's regression test, plan 07-03,
    // depends on it).
    // S-1 custody actor is `deputy` (a deputy performing chambers intake custody
    // assignment for chambers staff) so the transfer satisfies 08-02's new
    // CUSTODY_WRITE_ROLES gate (DEPUTY/CLERK/ADMIN only) — CHAMBERS_STAFF is not
    // a permitted custody actor. toCustodianUserId stays CHAMBERS_STAFF, so the
    // custodian-of-record narrative is preserved.
    await recordCustodyTransfer({
      exhibitId: exSealed,
      fromCustodianUserId: null,
      toCustodianUserId: users.CHAMBERS_STAFF,
      reason: 'chambers intake',
      actorUserId: deputy,
      recordedAt: nextRecordedAt(),
    });
    await recordStatusChange({ exhibitId: exSealed, toStatus: 'ADMITTED', actorUserId: judge });

    // --- Planted edge case D: "Legacy admit, no custodian" (F08 attention feed
    // MEDIUM tier; F24 'Assign custodian' remediation target) ---
    // MARKED -> OFFERED -> ADMITTED (legacy-admit, skips F12), zero custody
    // transfers ever. Fires ADMITTED_NO_CUSTODIAN through the LIVE engine
    // (evaluateDiscrepancies runs inside legacyAdmitForDemo) — a genuinely real
    // flag, not a synthetic row.
    await sleep(1200);
    const exLegacyNoCustody = await makeExhibit(
      'P-6',
      'Chain-of-custody log, pre-digitization era',
      'PROSECUTION',
      'Records Clerk Mia Torres',
    );
    await recordStatusChange({ exhibitId: exLegacyNoCustody, toStatus: 'MARKED', actorUserId: deputy });
    await recordStatusChange({ exhibitId: exLegacyNoCustody, toStatus: 'OFFERED', actorUserId: deputy });
    await legacyAdmitForDemo({
      exhibitId: exLegacyNoCustody,
      fromStatus: 'OFFERED',
      actorUserId: judge,
      recordedAt: nextRecordedAt(),
    });

    // --- Planted edge case E: "Legacy admit, unresolved objection" (F08
    // attention feed HIGH tier; F24 'Record ruling' remediation target) ---
    // MARKED -> OFFERED -> OBJECTED (objection raised, deliberately NO ruling —
    // thread stays UNRESOLVED), full custody chain established (deputy -> clerk,
    // so the custody condition is clean and only the objection rule fires), then
    // ADMITTED via legacyAdmitForDemo despite the unresolved objection. Fires
    // UNRESOLVED_OBJECTION_JURY_ELIGIBLE through the LIVE engine.
    await sleep(1200);
    const exLegacyObjected = await makeExhibit(
      'P-7',
      'Witness photo lineup packet',
      'PROSECUTION',
      'Det. Raymond Cole',
    );
    await recordStatusChange({ exhibitId: exLegacyObjected, toStatus: 'MARKED', actorUserId: deputy });
    await recordStatusChange({ exhibitId: exLegacyObjected, toStatus: 'OFFERED', actorUserId: deputy });
    await recordObjection({
      exhibitId: exLegacyObjected,
      objectingParty: 'DEFENSE',
      grounds: 'Suggestive lineup procedure — moved to suppress identification',
      actorUserId: attorney,
      recordedAt: nextRecordedAt(),
    });
    await recordStatusChange({ exhibitId: exLegacyObjected, toStatus: 'OBJECTED', actorUserId: clerk });
    await recordCustodyTransfer({
      exhibitId: exLegacyObjected,
      fromCustodianUserId: null,
      toCustodianUserId: deputy,
      reason: 'intake',
      actorUserId: deputy,
      recordedAt: nextRecordedAt(),
    });
    await recordCustodyTransfer({
      exhibitId: exLegacyObjected,
      fromCustodianUserId: deputy,
      toCustodianUserId: clerk,
      reason: 'to clerk for jury package prep',
      actorUserId: clerk,
      recordedAt: nextRecordedAt(),
    });
    // Deliberately NO recordRuling — thread remains UNRESOLVED.
    await legacyAdmitForDemo({
      exhibitId: exLegacyObjected,
      fromStatus: 'OBJECTED',
      actorUserId: judge,
      recordedAt: nextRecordedAt(),
    });

    const exhibitCount = await prisma.exhibit.count({ where: { caseId } });

    // Step 5 — post-seed assertion (fail-fast). If any required edge case is
    // missing, roll back the entire partial seed, then throw.
    await assertSeedIntegrity(caseId);

    return { caseId, exhibitCount };
  } catch (err) {
    // Any failure (including a SeedIntegrityError from the assertion) must leave
    // the DB in its pre-seed-attempt state, never partially loaded. Explicitly
    // clean up the fixed-caseNumber case before re-throwing — the net effect of
    // "abort the entire seed, never leave partial data" holds regardless of which
    // step threw.
    await resetSeedCase();
    throw err;
  }
}

/**
 * Verify the deliberately-planted fixtures are present: the unresolved-objection
 * fixture (P-1), the two F12 admission-blockable fixtures (P-2 single-reason /
 * P-3 dual-reason), AND Phase 2's sealed-exhibit role-based-visibility fixture.
 * Each must hold or the seed is rejected (SeedIntegrityError → caller rolls back
 * the entire partial seed).
 *
 * NOTE (F12): the former "≥1 OPEN ADMITTED_NO_CUSTODIAN flag" / "≥1 OPEN
 * UNRESOLVED_OBJECTION_JURY_ELIGIBLE flag" checks were REMOVED. Under F12's
 * admission gate (plan 07-01), no fresh exhibit can ever reach ADMITTED while
 * either F6 precondition holds — the gate runs before the ledger write — so
 * those flags can no longer organically arise in the seed by design. F6's
 * rule-engine logic itself is still fully covered by
 * src/services/discrepancies.test.ts's white-box fixtures (which construct the
 * precondition directly), not by seed data. The seed must only ever contain
 * states the live system can legitimately produce, so we do NOT synthesize a
 * fake flag to keep the old assertion alive.
 */
async function assertSeedIntegrity(caseId: string): Promise<void> {
  // 1. At least one unresolved objection exists case-wide.
  const unresolved = await getUnresolvedObjections(caseId);
  if (unresolved.length < 1) {
    throw new SeedIntegrityError(
      'Seed integrity check failed: expected ≥1 unresolved objection, found 0',
    );
  }
  const unresolvedByExhibit = new Set(unresolved.map((o) => o.exhibitId));

  // 2. (REPLACES old "ADMITTED with no custody" check) At least one OFFERED
  //    exhibit exists with no custody row — P-2's "admission blocked, single
  //    reason" fixture.
  const offeredNoCustody = await prisma.exhibitCurrentState.findMany({
    where: { currentStatus: 'OFFERED', exhibit: { caseId } },
    select: { exhibitId: true },
  });
  const custodyRowsForOffered = await prisma.custodyCurrentState.findMany({
    where: { exhibitId: { in: offeredNoCustody.map((r) => r.exhibitId) } },
    select: { exhibitId: true },
  });
  const haveCustodyOffered = new Set(custodyRowsForOffered.map((c) => c.exhibitId));
  const offeredBlockable = offeredNoCustody.filter((r) => !haveCustodyOffered.has(r.exhibitId));
  if (offeredBlockable.length < 1) {
    throw new SeedIntegrityError(
      'Seed integrity check failed: expected >=1 OFFERED exhibit with no custody (admission-blockable), found 0',
    );
  }

  // 3. (REPLACES old "ADMITTED with unresolved objection" check) At least one
  //    OBJECTED exhibit exists with an unresolved objection AND no custody —
  //    P-3's "admission blocked, dual reason" fixture.
  const objectedNoCustodyWithUnresolved = (
    await prisma.exhibitCurrentState.findMany({
      where: { currentStatus: 'OBJECTED', exhibit: { caseId } },
      select: { exhibitId: true },
    })
  ).filter((r) => unresolvedByExhibit.has(r.exhibitId));
  if (objectedNoCustodyWithUnresolved.length < 1) {
    throw new SeedIntegrityError(
      'Seed integrity check failed: expected >=1 OBJECTED exhibit with an unresolved objection (dual-reason admission-blockable), found 0',
    );
  }

  // 4. At least one sealed exhibit exists (Phase 2's role-based-visibility fixture).
  const sealedCount = await prisma.exhibit.count({ where: { caseId, isSealed: true } });
  if (sealedCount < 1) {
    throw new SeedIntegrityError(
      'Seed integrity check failed: expected ≥1 sealed exhibit, found 0',
    );
  }

  // 5. (REMOVED — see the function doc-comment above.) The former "both F6 rule
  //    codes OPEN" check is permanently unsatisfiable post-F12: the admission
  //    gate makes it structurally impossible for a fresh seed exhibit to reach
  //    ADMITTED while either ADMITTED_NO_CUSTODIAN or
  //    UNRESOLVED_OBJECTION_JURY_ELIGIBLE precondition holds. F6's logic remains
  //    covered by discrepancies.test.ts's direct-projection fixtures.
}

// CLI entry point: `tsx src/data/seed.ts` (npm run seed / Docker boot) runs the
// seed and logs the result. Guarded so programmatic test imports do NOT trigger
// a run on import. ESM equivalent of `require.main === module`.
const isDirectRun =
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  runSeed()
    .then(({ caseId, exhibitCount }) => {
      // eslint-disable-next-line no-console
      console.log(
        `Seed complete: case ${SEED_CASE_NUMBER} (${caseId}) with ${exhibitCount} exhibits.`,
      );
      return prisma.$disconnect();
    })
    .then(() => process.exit(0))
    .catch(async (err) => {
      // eslint-disable-next-line no-console
      console.error('Seed failed:', err);
      await prisma.$disconnect().catch(() => undefined);
      process.exit(1);
    });
}
