import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { DEMO_CASE_NUMBER } from '@/lib/constants';
import { runSeed } from '@/data/seed';
import { GET } from '@/app/api/case/route';

// Route-handler test for the app-shell bootstrap endpoint. Imports GET directly
// and invokes it — no running server needed. Backed by the real Postgres from
// docker-compose.yml and the fixed demo seed. fileParallelism:false (vitest
// config) guarantees this file runs without another suite rebuilding the shared
// seed concurrently, so the not-found path can safely delete and restore it.

async function deleteSeedCase(): Promise<void> {
  const kase = await prisma.case.findUnique({
    where: { caseNumber: DEMO_CASE_NUMBER },
    select: { id: true },
  });
  if (!kase) return;
  const caseId = kase.id;
  const exhibits = await prisma.exhibit.findMany({ where: { caseId }, select: { id: true } });
  const exhibitIds = exhibits.map((e) => e.id);
  await prisma.$transaction([
    // Phase 3 tables first — DiscrepancyFlag/JuryPackage* FK to exhibit, ledger
    // events, case and user, so they must be cleared before those are deleted.
    prisma.discrepancyFlag.deleteMany({ where: { caseId } }),
    prisma.juryPackageExhibit.deleteMany({ where: { juryPackage: { caseId } } }),
    prisma.juryPackage.deleteMany({ where: { caseId } }),
    prisma.exhibitCurrentState.deleteMany({ where: { exhibitId: { in: exhibitIds } } }),
    prisma.objectionCurrentState.deleteMany({ where: { exhibitId: { in: exhibitIds } } }),
    prisma.custodyCurrentState.deleteMany({ where: { exhibitId: { in: exhibitIds } } }),
    prisma.exhibitEvent.deleteMany({ where: { caseId } }),
    prisma.exhibit.deleteMany({ where: { caseId } }),
    prisma.user.deleteMany({ where: { caseId } }),
    prisma.case.deleteMany({ where: { id: caseId } }),
  ]);
}

describe('GET /api/case (app-shell bootstrap route)', () => {
  beforeAll(async () => {
    await runSeed();
  });

  afterAll(async () => {
    // Restore the shared seed for any later-running suites, then disconnect.
    await runSeed();
    await prisma.$disconnect();
  });

  it('returns 200 with { case, users } where users.length === 6 when seed data exists', async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.case).toBeTruthy();
    expect(body.case.caseNumber).toBe(DEMO_CASE_NUMBER);
    expect(Array.isArray(body.users)).toBe(true);
    expect(body.users).toHaveLength(6);
    for (const u of body.users) {
      expect(u.id).toBeTruthy();
      expect(typeof u.name).toBe('string');
      expect(u.role).toBeTruthy();
    }
  });

  it('returns 404 CASE_NOT_FOUND with the error envelope when no case exists', async () => {
    await deleteSeedCase();

    const res = await GET();
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.error.code).toBe('CASE_NOT_FOUND');
    expect(typeof body.error.message).toBe('string');
  });
});
