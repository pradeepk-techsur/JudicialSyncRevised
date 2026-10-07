import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createExhibit, getExhibit, getExhibits } from '@/services/exhibits';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';

// Integration tests against the real Postgres provisioned by docker-compose.yml.

async function seedCase() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const kase = await prisma.case.create({
    data: {
      caseNumber: `TEST-EXHIBITS-${suffix}`,
      title: 'Exhibits Test Case',
      court: 'Test Court',
    },
  });
  return { caseId: kase.id, suffix };
}

describe('exhibits service', () => {
  let fixture: Awaited<ReturnType<typeof seedCase>>;

  beforeEach(async () => {
    fixture = await seedCase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('createExhibit returns a row with a generated id; getExhibit and getExhibits find it', async () => {
    const { caseId, suffix } = fixture;

    const created = await createExhibit({
      caseId,
      exhibitLabel: `Exhibit ${suffix}`,
      description: 'A knife recovered at the scene',
      offeringParty: 'PROSECUTION',
      source: 'Evidence locker',
      associatedWitness: 'Det. Rivera',
    });

    expect(created.id).toBeTruthy();
    expect(created.exhibitLabel).toBe(`Exhibit ${suffix}`);
    expect(created.offeringParty).toBe('PROSECUTION');
    expect(created.isSealed).toBe(false);

    const fetched = await getExhibit(created.id, 'JUDGE');
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe(created.id);

    const list = await getExhibits(caseId, 'JUDGE');
    // getExhibits now returns the composite ExhibitListRow shape keyed by
    // exhibitId, not raw Exhibit rows.
    const row = list.find((e) => e.exhibitId === created.id);
    expect(row).toBeDefined();
    expect(row).toMatchObject({
      exhibitId: created.id,
      exhibitLabel: `Exhibit ${suffix}`,
      offeringParty: 'PROSECUTION',
      associatedWitness: 'Det. Rivera',
      currentStatus: null,
      currentCustodianName: null,
      discrepancyFlags: [],
    });
  });

  it('rejects a duplicate exhibitLabel within the same case with EXHIBIT_LABEL_CONFLICT', async () => {
    const { caseId, suffix } = fixture;
    const label = `Dup ${suffix}`;

    await createExhibit({
      caseId,
      exhibitLabel: label,
      description: 'first',
      offeringParty: 'DEFENSE',
    });

    await expect(
      createExhibit({
        caseId,
        exhibitLabel: label,
        description: 'second',
        offeringParty: 'DEFENSE',
      }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ConflictError && err.code === 'EXHIBIT_LABEL_CONFLICT',
    );
  });

  it('rejects an offeringParty outside the enum before any DB write', async () => {
    const { caseId, suffix } = fixture;

    const before = await prisma.exhibit.count({ where: { caseId } });

    await expect(
      createExhibit({
        caseId,
        exhibitLabel: `Bad ${suffix}`,
        description: 'bad party',
        // @ts-expect-error — intentionally invalid enum value to exercise validation.
        offeringParty: 'WITNESS',
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    const after = await prisma.exhibit.count({ where: { caseId } });
    expect(after).toBe(before);
  });

  it('getExhibit returns null for a nonexistent id (not a throw)', async () => {
    const result = await getExhibit('00000000-0000-0000-0000-000000000000', 'JUDGE');
    expect(result).toBeNull();
  });

  describe('getExhibit sealed-exhibit role-based visibility', () => {
    let sealedId: string;

    beforeEach(async () => {
      const { caseId, suffix } = fixture;
      const sealed = await createExhibit({
        caseId,
        exhibitLabel: `Sealed ${suffix}`,
        description: 'A sealed exhibit — restricted visibility',
        offeringParty: 'PROSECUTION',
        isSealed: true,
      });
      sealedId = sealed.id;
    });

    it('returns the sealed row for every role that can view sealed exhibits', async () => {
      for (const role of ['JUDGE', 'CHAMBERS_STAFF', 'ADMIN'] as const) {
        const fetched = await getExhibit(sealedId, role);
        expect(fetched, `role ${role} should see the sealed exhibit`).not.toBeNull();
        expect(fetched?.id).toBe(sealedId);
        expect(fetched?.isSealed).toBe(true);
      }
    });

    it('returns null for a sealed exhibit read by every role that cannot view sealed exhibits', async () => {
      for (const role of ['ATTORNEY', 'DEPUTY', 'CLERK'] as const) {
        const fetched = await getExhibit(sealedId, role);
        expect(fetched, `role ${role} must NOT see the sealed exhibit`).toBeNull();
      }
    });
  });

  describe('getExhibits (ExhibitListRow list)', () => {
    let sealedId: string;
    let visibleId: string;

    beforeEach(async () => {
      const { caseId, suffix } = fixture;
      const visible = await createExhibit({
        caseId,
        exhibitLabel: `A-Visible ${suffix}`,
        description: 'An ordinary visible exhibit',
        offeringParty: 'DEFENSE',
      });
      visibleId = visible.id;
      const sealed = await createExhibit({
        caseId,
        exhibitLabel: `Z-Sealed ${suffix}`,
        description: 'A sealed exhibit — restricted visibility',
        offeringParty: 'PROSECUTION',
        isSealed: true,
      });
      sealedId = sealed.id;
    });

    it('includes a sealed exhibit for a role that can view sealed exhibits (JUDGE)', async () => {
      const list = await getExhibits(fixture.caseId, 'JUDGE');
      const ids = list.map((e) => e.exhibitId);
      expect(ids).toContain(sealedId);
      expect(ids).toContain(visibleId);
    });

    it('excludes a sealed exhibit for a role that cannot (ATTORNEY) — absent, not redacted', async () => {
      const list = await getExhibits(fixture.caseId, 'ATTORNEY');
      const ids = list.map((e) => e.exhibitId);
      expect(ids).not.toContain(sealedId);
      expect(ids).toContain(visibleId);
    });

    it('throws CASE_NOT_FOUND for a nonexistent caseId', async () => {
      await expect(
        getExhibits('00000000-0000-0000-0000-000000000000', 'JUDGE'),
      ).rejects.toSatisfy(
        (err: unknown) => err instanceof NotFoundError && err.code === 'CASE_NOT_FOUND',
      );
    });
  });
});
