import { pathToFileURL } from 'node:url';
import type { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';
import { createExhibit } from '@/services/exhibits';
import { recordStatusChange } from '@/services/status';
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

const SEED_CASE_NUMBER = '2026-CR-0142';

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
 * Delete every row belonging to the fixed-caseNumber demo case, in dependency
 * order, so a re-run starts from a genuinely clean slate (no duplicate-key
 * errors, no drift). Scoped exclusively to SEED_CASE_NUMBER — never touches any
 * other case's data (e.g. test fixtures).
 *
 * Order: ledger + projections (which reference exhibits/users) → exhibits →
 * users → case. Note we must clear projections BEFORE exhibits (FK), and events
 * before users (actor FK).
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
    // Projections first (they FK to exhibit, and custody FKs to user).
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

    // Step 3 + 4 — exhibit identity records AND their histories, built
    // EXCLUSIVELY through the live service write path.

    // Small helper: create an exhibit and return its id.
    const makeExhibit = async (
      exhibitLabel: string,
      description: string,
      offeringParty: 'PLAINTIFF' | 'PROSECUTION' | 'DEFENSE',
      associatedWitness?: string,
    ): Promise<string> => {
      const ex = await createExhibit({
        caseId,
        exhibitLabel,
        description,
        offeringParty,
        associatedWitness,
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
    await recordStatusChange({ exhibitId: exUnresolved, toStatus: 'MARKED', actorUserId: deputy });
    await recordStatusChange({ exhibitId: exUnresolved, toStatus: 'OFFERED', actorUserId: deputy });
    await recordObjection({
      exhibitId: exUnresolved,
      objectingParty: 'DEFENSE',
      grounds: 'Confession obtained without Miranda warning — moved to suppress',
      actorUserId: attorney,
    });
    await recordStatusChange({ exhibitId: exUnresolved, toStatus: 'OBJECTED', actorUserId: clerk });
    // Deliberately NO recordRuling — thread remains UNRESOLVED.

    // --- Planted edge case B: "Custody Gap" ---
    // MARKED → OFFERED → ADMITTED with ZERO custody transfers ever recorded.
    const exCustodyGap = await makeExhibit(
      'P-2',
      'Photograph of the scene (printout)',
      'PROSECUTION',
      'Ofc. Lena Ortiz',
    );
    await recordStatusChange({ exhibitId: exCustodyGap, toStatus: 'MARKED', actorUserId: deputy });
    await recordStatusChange({ exhibitId: exCustodyGap, toStatus: 'OFFERED', actorUserId: deputy });
    await recordStatusChange({ exhibitId: exCustodyGap, toStatus: 'ADMITTED', actorUserId: judge });
    // Deliberately NO recordCustodyTransfer — the gap is the ABSENCE of events.

    // --- Planted edge case C: "Jury-Eligible Discrepancy" ---
    // MARKED → OFFERED → OBJECTED → ADMITTED, objection raised and left
    // UNRESOLVED. Simultaneously ADMITTED AND carrying an open objection thread —
    // exactly the UNRESOLVED_OBJECTION_JURY_ELIGIBLE condition Phase 3 detects.
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
    });
    await recordStatusChange({
      exhibitId: exJuryEligible,
      toStatus: 'OBJECTED',
      actorUserId: clerk,
    });
    // OBJECTED → ADMITTED is an allowed transition even with an open objection.
    await recordStatusChange({
      exhibitId: exJuryEligible,
      toStatus: 'ADMITTED',
      actorUserId: judge,
    });
    // Give it a full custody chain so the ONLY flagged condition is the open
    // objection (keeps this distinct from the custody-gap exhibit).
    await recordCustodyTransfer({
      exhibitId: exJuryEligible,
      fromCustodianUserId: null,
      toCustodianUserId: deputy,
      reason: 'intake at marking',
      actorUserId: deputy,
    });
    await recordCustodyTransfer({
      exhibitId: exJuryEligible,
      fromCustodianUserId: deputy,
      toCustodianUserId: clerk,
      reason: 'to clerk for record',
      actorUserId: clerk,
    });
    // Deliberately NO recordRuling — objection thread stays UNRESOLVED.

    // --- Clean exhibit 1: fully ADMITTED with a complete custody chain, no objections ---
    const exClean1 = await makeExhibit(
      'P-4',
      'Surveillance video still frame',
      'PROSECUTION',
      'Ofc. Lena Ortiz',
    );
    await recordStatusChange({ exhibitId: exClean1, toStatus: 'MARKED', actorUserId: deputy });
    await recordStatusChange({ exhibitId: exClean1, toStatus: 'OFFERED', actorUserId: deputy });
    await recordStatusChange({ exhibitId: exClean1, toStatus: 'ADMITTED', actorUserId: judge });
    await recordCustodyTransfer({
      exhibitId: exClean1,
      fromCustodianUserId: null,
      toCustodianUserId: deputy,
      reason: 'intake',
      actorUserId: deputy,
    });
    await recordCustodyTransfer({
      exhibitId: exClean1,
      fromCustodianUserId: deputy,
      toCustodianUserId: clerk,
      reason: 'to clerk for jury package prep',
      actorUserId: clerk,
    });

    // --- Clean exhibit 2: objection raised then OVERRULED, then ADMITTED, custody intact ---
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
    });
    await recordStatusChange({ exhibitId: exClean2, toStatus: 'OBJECTED', actorUserId: clerk });
    await recordRuling({
      objectionId: clean2Obj.objectionId,
      disposition: 'OVERRULED',
      actorUserId: judge,
    });
    await recordStatusChange({ exhibitId: exClean2, toStatus: 'ADMITTED', actorUserId: judge });
    await recordCustodyTransfer({
      exhibitId: exClean2,
      fromCustodianUserId: null,
      toCustodianUserId: deputy,
      reason: 'intake',
      actorUserId: deputy,
    });

    // --- Clean exhibit 3: objection SUSTAINED → EXCLUDED (terminal) ---
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
    });
    await recordStatusChange({ exhibitId: exExcluded, toStatus: 'OBJECTED', actorUserId: clerk });
    await recordRuling({
      objectionId: excludedObj.objectionId,
      disposition: 'SUSTAINED',
      actorUserId: judge,
    });
    await recordStatusChange({ exhibitId: exExcluded, toStatus: 'EXCLUDED', actorUserId: judge });

    // --- Clean exhibit 4: OFFERED then WITHDRAWN (terminal) ---
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
 * Verify the three deliberately-planted edge cases are present. Each must hold
 * ≥1 or the seed is rejected (SeedIntegrityError → caller rolls back).
 */
async function assertSeedIntegrity(caseId: string): Promise<void> {
  // 1. At least one unresolved objection exists case-wide.
  const unresolved = await getUnresolvedObjections(caseId);
  if (unresolved.length < 1) {
    throw new SeedIntegrityError(
      'Seed integrity check failed: expected ≥1 unresolved objection, found 0',
    );
  }

  // 2. At least one ADMITTED exhibit with NO custody-current-state row (gap).
  const admitted = await prisma.exhibitCurrentState.findMany({
    where: { currentStatus: 'ADMITTED', exhibit: { caseId } },
    select: { exhibitId: true },
  });
  const admittedIds = admitted.map((a) => a.exhibitId);

  const custodyRows = await prisma.custodyCurrentState.findMany({
    where: { exhibitId: { in: admittedIds } },
    select: { exhibitId: true },
  });
  const haveCustody = new Set(custodyRows.map((c) => c.exhibitId));
  const admittedNoCustody = admittedIds.filter((id) => !haveCustody.has(id));
  if (admittedNoCustody.length < 1) {
    throw new SeedIntegrityError(
      'Seed integrity check failed: expected ≥1 ADMITTED exhibit with no custody record, found 0',
    );
  }

  // 3. At least one ADMITTED exhibit carrying ≥1 UNRESOLVED objection
  //    (jury-package-eligible discrepancy).
  const unresolvedByExhibit = new Set(
    unresolved.map((o) => o.exhibitId),
  );
  const admittedWithUnresolved = admittedIds.filter((id) => unresolvedByExhibit.has(id));
  if (admittedWithUnresolved.length < 1) {
    throw new SeedIntegrityError(
      'Seed integrity check failed: expected ≥1 ADMITTED exhibit with an unresolved objection, found 0',
    );
  }
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
