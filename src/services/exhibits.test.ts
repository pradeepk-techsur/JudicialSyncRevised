import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createExhibit, getExhibit, getExhibits, searchExhibits } from '@/services/exhibits';
import { ConflictError, NotFoundError, UnprocessableError, ValidationError } from '@/lib/errors';
import { DEMO_CASE_NUMBER } from '@/lib/constants';

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

// searchExhibits runs against the deterministic Phase 1 seed (DEMO_CASE_NUMBER),
// whose known fixtures anchor the AND-combination assertions:
//   - P-3 "Lab report — DNA match analysis", witness "Dr. Amara Finch", ADMITTED
//   - S-1 "Chambers sidebar note", isSealed:true, ADMITTED (role-scoped)
// `npm run seed` must have populated the DB (the plan's verify step runs it).
describe('searchExhibits (F4)', () => {
  let demoCaseId: string;

  beforeEach(async () => {
    const kase = await prisma.case.findUnique({
      where: { caseNumber: DEMO_CASE_NUMBER },
      select: { id: true },
    });
    if (!kase) {
      throw new Error(
        `Demo case ${DEMO_CASE_NUMBER} not seeded — run \`npx tsx src/data/seed.ts\` first`,
      );
    }
    demoCaseId = kase.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejects an empty request with 422 EMPTY_SEARCH_CRITERIA', async () => {
    await expect(
      searchExhibits({ caseId: demoCaseId, requestingUserRole: 'JUDGE' }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof UnprocessableError && err.code === 'EMPTY_SEARCH_CRITERIA',
    );
  });

  it('rejects dateFrom after dateTo with 422 INVALID_DATE_RANGE', async () => {
    await expect(
      searchExhibits({
        caseId: demoCaseId,
        requestingUserRole: 'JUDGE',
        dateFrom: '2026-12-31',
        dateTo: '2026-01-01',
      }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof UnprocessableError && err.code === 'INVALID_DATE_RANGE',
    );
  });

  it('rejects an invalid status value with 422 VALIDATION_ERROR', async () => {
    await expect(
      searchExhibits({
        caseId: demoCaseId,
        requestingUserRole: 'JUDGE',
        status: 'NOT_A_STATUS',
      }),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ValidationError && err.code === 'VALIDATION_ERROR',
    );
  });

  it('witness=Finch matches only P-3', async () => {
    const results = await searchExhibits({
      caseId: demoCaseId,
      requestingUserRole: 'JUDGE',
      witness: 'Finch',
    });
    expect(results.map((r) => r.exhibitLabel)).toEqual(['P-3']);
  });

  it('AND-combination: witness=Finch & status=ADMITTED still matches P-3', async () => {
    const results = await searchExhibits({
      caseId: demoCaseId,
      requestingUserRole: 'JUDGE',
      witness: 'Finch',
      status: 'ADMITTED',
    });
    expect(results.map((r) => r.exhibitLabel)).toEqual(['P-3']);
  });

  it('AND-combination narrows to zero: witness=Finch & status=MARKED matches nothing', async () => {
    const results = await searchExhibits({
      caseId: demoCaseId,
      requestingUserRole: 'JUDGE',
      witness: 'Finch',
      status: 'MARKED',
    });
    expect(results).toHaveLength(0);
  });

  it('returns the ExhibitListRow shape with enriched currentStatus/custodian', async () => {
    const [p3] = await searchExhibits({
      caseId: demoCaseId,
      requestingUserRole: 'JUDGE',
      witness: 'Finch',
    });
    expect(p3).toMatchObject({
      exhibitLabel: 'P-3',
      associatedWitness: 'Dr. Amara Finch',
      currentStatus: 'ADMITTED',
    });
    // P-3 is ADMITTED while carrying an unresolved objection, so Phase 3's engine
    // flags it — discrepancyFlags is non-empty (no longer the [] placeholder).
    expect(p3.discrepancyFlags.map((f) => f.ruleCode)).toContain(
      'UNRESOLVED_OBJECTION_JURY_ELIGIBLE',
    );
    // P-3's custody chain ends at the clerk (seed) — custodian name is resolved.
    expect(p3.currentCustodianName).toBeTruthy();
  });

  it('results are ordered by exhibitLabel ascending', async () => {
    const results = await searchExhibits({
      caseId: demoCaseId,
      requestingUserRole: 'JUDGE',
      status: 'ADMITTED',
    });
    const labels = results.map((r) => r.exhibitLabel);
    expect(labels).toEqual([...labels].sort());
    expect(labels.length).toBeGreaterThan(1);
  });

  it('surfaces real discrepancy flags on a flagged exhibit and [] on a clean one (Phase 3)', async () => {
    // getExhibits over the seeded demo case: P-3 is ADMITTED with an UNRESOLVED
    // objection (UNRESOLVED_OBJECTION_JURY_ELIGIBLE fires); P-2 is ADMITTED with
    // no custodian (ADMITTED_NO_CUSTODIAN fires); P-4 is cleanly ADMITTED with a
    // full custody chain and no open objection (no flag).
    const rows = await getExhibits(demoCaseId, 'JUDGE');
    const byLabel = new Map(rows.map((r) => [r.exhibitLabel, r]));

    const p3 = byLabel.get('P-3');
    expect(p3).toBeDefined();
    expect(p3!.discrepancyFlags.length).toBeGreaterThanOrEqual(1);
    expect(p3!.discrepancyFlags.map((f) => f.ruleCode)).toContain(
      'UNRESOLVED_OBJECTION_JURY_ELIGIBLE',
    );
    const p3Flag = p3!.discrepancyFlags.find(
      (f) => f.ruleCode === 'UNRESOLVED_OBJECTION_JURY_ELIGIBLE',
    );
    expect(p3Flag!.status).toBe('OPEN');
    expect(p3Flag!.label).toBe('Unresolved objection');

    const p2 = byLabel.get('P-2');
    expect(p2).toBeDefined();
    expect(p2!.discrepancyFlags.map((f) => f.ruleCode)).toContain('ADMITTED_NO_CUSTODIAN');

    const p4 = byLabel.get('P-4');
    expect(p4).toBeDefined();
    expect(p4!.discrepancyFlags).toEqual([]);
  });

  it('excludes a sealed exhibit from results for an unauthorized role even on a matching keyword', async () => {
    // S-1 is sealed (keyword "sidebar" matches its description). JUDGE sees it,
    // ATTORNEY must not — T-02-10.
    const judgeResults = await searchExhibits({
      caseId: demoCaseId,
      requestingUserRole: 'JUDGE',
      keyword: 'sidebar',
    });
    expect(judgeResults.map((r) => r.exhibitLabel)).toContain('S-1');

    const attorneyResults = await searchExhibits({
      caseId: demoCaseId,
      requestingUserRole: 'ATTORNEY',
      keyword: 'sidebar',
    });
    expect(attorneyResults.map((r) => r.exhibitLabel)).not.toContain('S-1');
  });
});
