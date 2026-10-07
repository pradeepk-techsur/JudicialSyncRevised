import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { runSeed } from '@/data/seed';
import { rebuildProjections } from '@/services/rebuild';

// Integration tests for rebuildProjections (TechArch §3.8) against the REAL
// seeded demo case. This is the direct, hard-to-fake proof of Phase 1 success
// criterion 5: "rebuilding current-state projections from scratch by replaying
// the ledger produces results identical to the live projections."
//
// The negative-control test is the crux — it deliberately corrupts a live
// projection and asserts the rebuild DETECTS the divergence, proving the
// comparison has teeth and does not trivially always pass.

describe('rebuildProjections (projection integrity) against the real seeded case', () => {
  let caseId: string;

  beforeAll(async () => {
    const result = await runSeed();
    caseId = result.caseId;
  });

  afterAll(async () => {
    // Restore a clean seed so a corrupted projection from the negative-control
    // test never leaks into other test files sharing this database.
    await runSeed();
    await prisma.$disconnect();
  });

  it('reports matches:true with zero diffs for the freshly seeded case (success criterion 5)', async () => {
    const result = await rebuildProjections(caseId);

    expect(result.diffs).toEqual([]);
    expect(result.matches).toBe(true);
  });

  it('is read-only: calling it does not mutate any live projection row (T-01-20)', async () => {
    const snapshot = async () => {
      const [exhibitStates, objectionStates, custodyStates] = await Promise.all([
        prisma.exhibitCurrentState.findMany({
          where: { exhibit: { caseId } },
          orderBy: { exhibitId: 'asc' },
        }),
        prisma.objectionCurrentState.findMany({
          where: { exhibit: { caseId } },
          orderBy: { objectionId: 'asc' },
        }),
        prisma.custodyCurrentState.findMany({
          where: { exhibit: { caseId } },
          orderBy: { exhibitId: 'asc' },
        }),
      ]);
      return JSON.stringify({ exhibitStates, objectionStates, custodyStates });
    };

    const before = await snapshot();
    const eventCountBefore = await prisma.exhibitEvent.count({ where: { caseId } });

    await rebuildProjections(caseId);

    const after = await snapshot();
    const eventCountAfter = await prisma.exhibitEvent.count({ where: { caseId } });

    // Projections byte-identical, and no ledger row appended as a side effect.
    expect(after).toBe(before);
    expect(eventCountAfter).toBe(eventCountBefore);
  });

  it('detects a corrupted ExhibitCurrentState.currentStatus (negative control)', async () => {
    // Pick an exhibit that has a live status projection, and flip its status to a
    // value the ledger never produced.
    const target = await prisma.exhibitCurrentState.findFirst({
      where: { exhibit: { caseId } },
    });
    expect(target).not.toBeNull();
    if (!target) return;

    const correctStatus = target.currentStatus;
    const wrongStatus = correctStatus === 'ADMITTED' ? 'EXCLUDED' : 'ADMITTED';

    // Directly (test-only, bypassing the service layer) corrupt the projection.
    await prisma.exhibitCurrentState.update({
      where: { exhibitId: target.exhibitId },
      data: { currentStatus: wrongStatus },
    });

    try {
      const result = await rebuildProjections(caseId);

      expect(result.matches).toBe(false);
      const diff = result.diffs.find(
        (d) => d.exhibitId === target.exhibitId && d.field === 'currentStatus',
      );
      expect(diff).toBeDefined();
      expect(diff?.live).toBe(wrongStatus);
      expect(diff?.rebuilt).toBe(correctStatus);
    } finally {
      // Repair the corruption so the DB returns to a consistent state.
      await prisma.exhibitCurrentState.update({
        where: { exhibitId: target.exhibitId },
        data: { currentStatus: correctStatus },
      });
    }

    // Sanity: after repair, the rebuild matches again.
    const repaired = await rebuildProjections(caseId);
    expect(repaired.matches).toBe(true);
  });
});
