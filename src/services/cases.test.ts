import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { DEMO_CASE_NUMBER } from '@/lib/constants';
import { runSeed } from '@/data/seed';
import { getActiveCaseWithUsers } from '@/services/cases';

// Integration test for the active-case resolution service, run against the real
// Postgres from docker-compose.yml. Seeds the fixed demo case first, then proves
// getActiveCaseWithUsers() resolves it (and its full 6-persona roster) with no
// prior knowledge of any UUID — the bootstrapping step the app shell depends on.

const ALL_ROLES: Role[] = [
  'JUDGE',
  'CHAMBERS_STAFF',
  'DEPUTY',
  'CLERK',
  'ATTORNEY',
  'ADMIN',
];

describe('getActiveCaseWithUsers (case resolution service)', () => {
  beforeAll(async () => {
    await runSeed();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('resolves the seeded case matching DEMO_CASE_NUMBER', async () => {
    const result = await getActiveCaseWithUsers();
    expect(result).not.toBeNull();
    expect(result?.case.caseNumber).toBe(DEMO_CASE_NUMBER);
    expect(result?.case.id).toBeTruthy();
  });

  it('returns exactly 6 users, one per Role enum value, each with a non-empty name', async () => {
    const result = await getActiveCaseWithUsers();
    expect(result).not.toBeNull();

    const users = result!.users;
    expect(users).toHaveLength(6);

    for (const u of users) {
      expect(typeof u.name).toBe('string');
      expect(u.name.length).toBeGreaterThan(0);
      expect(u.id).toBeTruthy();
    }

    const roles = users.map((u) => u.role).sort();
    expect(roles).toEqual([...ALL_ROLES].sort());
  });
});
