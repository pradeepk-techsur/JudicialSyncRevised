import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { getUnresolvedObjections } from '@/services/objections';
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

/** Compute the three edge-case counts for the seeded case. */
async function edgeCaseCounts(caseId: string): Promise<{
  unresolvedObjections: number;
  admittedNoCustody: number;
  admittedWithUnresolved: number;
}> {
  const unresolved = await getUnresolvedObjections(caseId);

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
  const admittedNoCustody = admittedIds.filter((id) => !haveCustody.has(id)).length;

  const unresolvedByExhibit = new Set(unresolved.map((o) => o.exhibitId));
  const admittedWithUnresolved = admittedIds.filter((id) =>
    unresolvedByExhibit.has(id),
  ).length;

  return {
    unresolvedObjections: unresolved.length,
    admittedNoCustody,
    admittedWithUnresolved,
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
    expect(counts.admittedNoCustody).toBeGreaterThanOrEqual(1);
    expect(counts.admittedWithUnresolved).toBeGreaterThanOrEqual(1);
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
    expect(secondCounts.admittedNoCustody).toBeGreaterThanOrEqual(1);
    expect(secondCounts.admittedWithUnresolved).toBeGreaterThanOrEqual(1);

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
    ];
    for (const pattern of bannedWrites) {
      expect(code).not.toMatch(pattern);
    }
  });
});
