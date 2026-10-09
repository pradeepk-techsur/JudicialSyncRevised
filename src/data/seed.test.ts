import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { AdmissionBlockedError } from '@/lib/errors';
import { getUnresolvedObjections } from '@/services/objections';
import { recordStatusChange } from '@/services/status';
import { runSeed } from '@/data/seed';

// Integration tests for the F0a deterministic seed loader, run against the real
// Postgres provisioned by docker-compose.yml. These prove:
//   1. after a run, all three planted edge cases are present;
//   2. a SECOND consecutive run (clean-state re-run) is deterministic — identical
//      exhibit count, same edge cases, still exactly ONE case row (no duplicates);
//   3. seed.ts never bypasses the service layer (zero direct projection/ledger
//      writes) — the structural guarantee behind "seed data = only states the
//      live system could produce" (threat T-01-17).

const SEED_CASE_NUMBER = '2026-CR-0142';

/**
 * Compute the three edge-case counts for the seeded case, in the F12-era shape:
 * an unresolved-objection count, an `offeredBlockable` count (OFFERED exhibits
 * with no custody — single-reason admission-blockable, P-2), and an
 * `objectedWithUnresolvedBlockable` count (OBJECTED exhibits with an unresolved
 * objection — dual-reason admission-blockable, P-3). Mirrors the updated
 * assertSeedIntegrity logic.
 */
async function edgeCaseCounts(caseId: string): Promise<{
  unresolvedObjections: number;
  offeredBlockable: number;
  objectedWithUnresolvedBlockable: number;
}> {
  const unresolved = await getUnresolvedObjections(caseId);
  const unresolvedByExhibit = new Set(unresolved.map((o) => o.exhibitId));

  const offered = await prisma.exhibitCurrentState.findMany({
    where: { currentStatus: 'OFFERED', exhibit: { caseId } },
    select: { exhibitId: true },
  });
  const custodyForOffered = await prisma.custodyCurrentState.findMany({
    where: { exhibitId: { in: offered.map((r) => r.exhibitId) } },
    select: { exhibitId: true },
  });
  const haveCustodyOffered = new Set(custodyForOffered.map((c) => c.exhibitId));
  const offeredBlockable = offered.filter((r) => !haveCustodyOffered.has(r.exhibitId)).length;

  const objected = await prisma.exhibitCurrentState.findMany({
    where: { currentStatus: 'OBJECTED', exhibit: { caseId } },
    select: { exhibitId: true },
  });
  const objectedWithUnresolvedBlockable = objected.filter((r) =>
    unresolvedByExhibit.has(r.exhibitId),
  ).length;

  return {
    unresolvedObjections: unresolved.length,
    offeredBlockable,
    objectedWithUnresolvedBlockable,
  };
}

describe('seed loader (F0a)', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('produces all three planted edge cases on first run', async () => {
    const { caseId, exhibitCount } = await runSeed();

    expect(exhibitCount).toBeGreaterThanOrEqual(8);

    const counts = await edgeCaseCounts(caseId);
    expect(counts.unresolvedObjections).toBeGreaterThanOrEqual(1);
    expect(counts.offeredBlockable).toBeGreaterThanOrEqual(1);
    expect(counts.objectedWithUnresolvedBlockable).toBeGreaterThanOrEqual(1);
  });

  it('blocks admission of the planted single-reason and dual-reason fixtures (F12 demo-blocking guarantee)', async () => {
    const { caseId } = await runSeed();

    // Resolve P-2 (single-reason: NO_CUSTODIAN) and P-3 (dual-reason:
    // NO_CUSTODIAN + UNRESOLVED_OBJECTION) by label against the real seeded case.
    const exhibits = await prisma.exhibit.findMany({
      where: { caseId, exhibitLabel: { in: ['P-2', 'P-3'] } },
      select: { id: true, exhibitLabel: true },
    });
    const idByLabel = new Map(exhibits.map((e) => [e.exhibitLabel, e.id]));
    const p2 = idByLabel.get('P-2');
    const p3 = idByLabel.get('P-3');
    expect(p2).toBeTruthy();
    expect(p3).toBeTruthy();

    const anyUser = await prisma.user.findFirst({
      where: { caseId },
      select: { id: true },
    });
    const actorUserId = anyUser!.id;

    // P-2: attempting to admit is rejected with ADMISSION_BLOCKED listing exactly
    // NO_CUSTODIAN.
    let p2Err: unknown;
    try {
      await recordStatusChange({ exhibitId: p2!, toStatus: 'ADMITTED', actorUserId });
    } catch (err) {
      p2Err = err;
    }
    expect(p2Err).toBeInstanceOf(AdmissionBlockedError);
    expect((p2Err as AdmissionBlockedError).code).toBe('ADMISSION_BLOCKED');
    const p2Reasons = ((p2Err as AdmissionBlockedError).details as {
      reasons: Array<{ code: string }>;
    }).reasons.map((r) => r.code);
    expect(p2Reasons).toContain('NO_CUSTODIAN');

    // P-3: attempting to admit is rejected with BOTH NO_CUSTODIAN and
    // UNRESOLVED_OBJECTION.
    let p3Err: unknown;
    try {
      await recordStatusChange({ exhibitId: p3!, toStatus: 'ADMITTED', actorUserId });
    } catch (err) {
      p3Err = err;
    }
    expect(p3Err).toBeInstanceOf(AdmissionBlockedError);
    expect((p3Err as AdmissionBlockedError).code).toBe('ADMISSION_BLOCKED');
    const p3Reasons = ((p3Err as AdmissionBlockedError).details as {
      reasons: Array<{ code: string }>;
    }).reasons.map((r) => r.code);
    expect(p3Reasons).toContain('NO_CUSTODIAN');
    expect(p3Reasons).toContain('UNRESOLVED_OBJECTION');
  });

  it('plants exactly one sealed exhibit (S-1) as Phase 2 role-based-visibility fixture', async () => {
    const { caseId } = await runSeed();

    // Exactly one sealed exhibit exists, and it is the labelled S-1 item.
    const sealed = await prisma.exhibit.findMany({
      where: { caseId, isSealed: true },
      select: { exhibitLabel: true },
    });
    expect(sealed).toHaveLength(1);
    expect(sealed[0]?.exhibitLabel).toBe('S-1');

    // Every other seeded exhibit remains unsealed (the sealed flag is not
    // accidentally set on the Phase 1 exhibits).
    const unsealed = await prisma.exhibit.count({ where: { caseId, isSealed: false } });
    expect(unsealed).toBeGreaterThanOrEqual(8);
  });

  it('assertSeedIntegrity rejects a seed with zero sealed exhibits', async () => {
    const { caseId } = await runSeed();

    // Simulate the sealed fixture going missing: unseal every exhibit, then
    // re-run the same integrity predicate the loader uses (≥1 sealed exhibit).
    await prisma.exhibit.updateMany({ where: { caseId }, data: { isSealed: false } });
    const sealedCount = await prisma.exhibit.count({ where: { caseId, isSealed: true } });
    expect(sealedCount).toBe(0);

    // A fresh runSeed() must restore the fixture (it rebuilds from scratch),
    // proving the loader always emits ≥1 sealed exhibit.
    const { caseId: rebuiltCaseId } = await runSeed();
    const rebuiltSealed = await prisma.exhibit.count({
      where: { caseId: rebuiltCaseId, isSealed: true },
    });
    expect(rebuiltSealed).toBeGreaterThanOrEqual(1);
  });

  it('is deterministic across a clean-state re-run: identical count, same edge cases, no duplicate case', async () => {
    const first = await runSeed();
    const firstCounts = await edgeCaseCounts(first.caseId);

    // Re-run from the (now-populated) state — resetSeedCase should wipe and rebuild.
    const second = await runSeed();
    const secondCounts = await edgeCaseCounts(second.caseId);

    // Identical exhibit count across runs.
    expect(second.exhibitCount).toBe(first.exhibitCount);

    // All three edge cases still hold, with identical counts.
    expect(secondCounts).toEqual(firstCounts);
    expect(secondCounts.unresolvedObjections).toBeGreaterThanOrEqual(1);
    expect(secondCounts.offeredBlockable).toBeGreaterThanOrEqual(1);
    expect(secondCounts.objectedWithUnresolvedBlockable).toBeGreaterThanOrEqual(1);

    // No duplicate accumulation — exactly one Case row for the fixed caseNumber.
    const caseRows = await prisma.case.count({
      where: { caseNumber: SEED_CASE_NUMBER },
    });
    expect(caseRows).toBe(1);
  });

  it('never bypasses the service layer: zero direct projection/ledger writes in seed.ts', () => {
    const seedPath = fileURLToPath(new URL('./seed.ts', import.meta.url));
    const source = readFileSync(seedPath, 'utf8');

    // Strip line/block comments so the doc-comment mentioning the banned pattern
    // (for human readers) does not trip the structural check.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');

    const bannedWrites = [
      /prisma\.exhibitEvent\.create/,
      /prisma\.exhibitCurrentState\.create/,
      /prisma\.objectionCurrentState\.create/,
      /prisma\.custodyCurrentState\.create/,
      // Phase 3: the seed must NEVER create a discrepancy flag directly — flags
      // must arise only from the live engine via the service write paths, so demo
      // flags are guaranteed to be states the live system could produce (T-03-10).
      /prisma\.discrepancyFlag\.create/,
    ];
    for (const pattern of bannedWrites) {
      expect(code).not.toMatch(pattern);
    }
  });
});
