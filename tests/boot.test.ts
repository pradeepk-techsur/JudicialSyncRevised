import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';

// Context-boot test — keep green forever. Every later phase's gates re-run this.
// A Next.js-idiomatic adaptation of the context-boot-test pattern: it catches
// Prisma schema/client mismatches and import-time wiring failures immediately
// and automatically, rather than discovering them at human verify.
describe('application boot', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('connects to the database and the schema is queryable', async () => {
    const result = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 as ok`;
    expect(result[0].ok).toBe(1);
  });

  it('every Phase 1 service module imports without throwing', async () => {
    await expect(import('@/services/events')).resolves.toBeDefined();
    await expect(import('@/services/exhibits')).resolves.toBeDefined();
  });

  it('Prisma can query every Phase 1 model without a schema-validation error', async () => {
    await expect(prisma.case.findMany()).resolves.toBeDefined();
    await expect(prisma.exhibit.findMany()).resolves.toBeDefined();
    await expect(prisma.exhibitEvent.findMany()).resolves.toBeDefined();
    await expect(prisma.exhibitCurrentState.findMany()).resolves.toBeDefined();
    await expect(prisma.objectionCurrentState.findMany()).resolves.toBeDefined();
    await expect(prisma.custodyCurrentState.findMany()).resolves.toBeDefined();
  });
});
