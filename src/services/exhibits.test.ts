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

    it('a visible exhibit with no jury package ever computed is NOT_ELIGIBLE and carries the additive booleans', async () => {
      const list = await getExhibits(fixture.caseId, 'JUDGE');
      const row = list.find((e) => e.exhibitId === visibleId);
      expect(row).toBeDefined();
      // No JuryPackage exists for this freshly-created case → every exhibit is
      // NOT_ELIGIBLE (F09 §Process step 3 final branch, "no package yet").
      expect(row?.juryPackageEligibility).toBe('NOT_ELIGIBLE');
      expect(row?.hasUnresolvedObjection).toBe(false);
      expect(row?.isSealed).toBe(false);
    });

    it('a sealed exhibit visible to JUDGE carries isSealed: true', async () => {
      const list = await getExhibits(fixture.caseId, 'JUDGE');
      const sealedRow = list.find((e) => e.exhibitId === sealedId);
      expect(sealedRow).toBeDefined();
      expect(sealedRow?.isSealed).toBe(true);
    });
  });

  // F09 §Process step 3 — juryPackageEligibility precedence, plus the two other
  // additive Flags-column booleans. These fixtures construct the underlying
  // JuryPackage / JuryPackageExhibit / ObjectionCurrentState projection rows
  // directly (the eligibility helper reads exactly those projections), so each
  // of the three output values and the "no package / excluded" fall-through are
  // exercised deterministically without depending on the live admission gate.
  describe('juryPackageEligibility precedence + Flags-column booleans', () => {
    async function makeExhibit(label: string, isSealed = false): Promise<string> {
      const ex = await createExhibit({
        caseId: fixture.caseId,
        exhibitLabel: `${label} ${fixture.suffix}`,
        description: `exhibit ${label}`,
        offeringParty: 'PROSECUTION',
        isSealed,
      });
      return ex.id;
    }

    async function makePackage(): Promise<string> {
      const pkg = await prisma.juryPackage.create({
        data: { caseId: fixture.caseId, status: 'DRAFT' },
      });
      return pkg.id;
    }

    async function addMember(
      juryPackageId: string,
      exhibitId: string,
      discrepancyStatus: 'CLEAN' | 'FLAGGED',
      status: 'INCLUDED' | 'EXCLUDED' = 'INCLUDED',
    ): Promise<void> {
      await prisma.juryPackageExhibit.create({
        data: { juryPackageId, exhibitId, discrepancyStatus, status },
      });
    }

    async function rowFor(exhibitId: string) {
      const list = await getExhibits(fixture.caseId, 'JUDGE');
      return list.find((e) => e.exhibitId === exhibitId);
    }

    it('INCLUDED + CLEAN member → INCLUDED', async () => {
      const exId = await makeExhibit('JP-INCLUDED');
      const pkgId = await makePackage();
      await addMember(pkgId, exId, 'CLEAN');
      const row = await rowFor(exId);
      expect(row?.juryPackageEligibility).toBe('INCLUDED');
    });

    it('INCLUDED + FLAGGED member → BLOCKED', async () => {
      const exId = await makeExhibit('JP-BLOCKED');
      const pkgId = await makePackage();
      await addMember(pkgId, exId, 'FLAGGED');
      const row = await rowFor(exId);
      expect(row?.juryPackageEligibility).toBe('BLOCKED');
    });

    it('EXCLUDED member row → NOT_ELIGIBLE (even though a package row exists)', async () => {
      const exId = await makeExhibit('JP-EXCLUDED');
      const pkgId = await makePackage();
      await addMember(pkgId, exId, 'CLEAN', 'EXCLUDED');
      const row = await rowFor(exId);
      expect(row?.juryPackageEligibility).toBe('NOT_ELIGIBLE');
    });

    it('exhibit absent from the computed package → NOT_ELIGIBLE', async () => {
      const memberId = await makeExhibit('JP-MEMBER');
      const nonMemberId = await makeExhibit('JP-NONMEMBER');
      const pkgId = await makePackage();
      // Only memberId is in the package; nonMemberId has no row at all.
      await addMember(pkgId, memberId, 'CLEAN');
      const nonMember = await rowFor(nonMemberId);
      expect(nonMember?.juryPackageEligibility).toBe('NOT_ELIGIBLE');
    });

    it('eligibility is read from the MOST RECENT package only', async () => {
      const exId = await makeExhibit('JP-LATEST');
      // Older package: member CLEAN (would be INCLUDED).
      const older = await makePackage();
      await addMember(older, exId, 'CLEAN');
      // Newer package (later createdAt): member FLAGGED → BLOCKED must win.
      const newer = await prisma.juryPackage.create({
        data: {
          caseId: fixture.caseId,
          status: 'DRAFT',
          createdAt: new Date(Date.now() + 60_000),
        },
      });
      await addMember(newer.id, exId, 'FLAGGED');
      const row = await rowFor(exId);
      expect(row?.juryPackageEligibility).toBe('BLOCKED');
    });

    it('hasUnresolvedObjection is true for an UNRESOLVED objection on a still-OFFERED exhibit — and independent of discrepancyFlags', async () => {
      const exId = await makeExhibit('OBJ-OFFERED');
      // Raise an objection thread, left UNRESOLVED (no ruling), while the
      // exhibit is still OFFERED — a state that fires NO F6 discrepancy rule.
      await prisma.objectionCurrentState.create({
        data: {
          objectionId: `obj-${fixture.suffix}-offered`,
          exhibitId: exId,
          status: 'UNRESOLVED',
          objectingParty: 'DEFENSE',
          grounds: 'Hearsay',
          // raisedEventId is a plain NOT-NULL string column (no FK relation in
          // the schema) — a synthetic id suffices for this projection-only fixture.
          raisedEventId: `evt-${fixture.suffix}-offered`,
          raisedAt: new Date(),
        },
      });
      const row = await rowFor(exId);
      expect(row?.hasUnresolvedObjection).toBe(true);
      // Proven genuinely independent of the discrepancy signal: the row carries
      // the objection flag while its discrepancyFlags array stays empty.
      expect(row?.discrepancyFlags).toEqual([]);
    });

    it('hasUnresolvedObjection is false when every objection thread is resolved', async () => {
      const exId = await makeExhibit('OBJ-RESOLVED');
      await prisma.objectionCurrentState.create({
        data: {
          objectionId: `obj-${fixture.suffix}-resolved`,
          exhibitId: exId,
          status: 'OVERRULED',
          objectingParty: 'DEFENSE',
          grounds: 'Relevance',
          raisedEventId: `evt-${fixture.suffix}-resolved`,
          raisedAt: new Date(),
          ruledAt: new Date(),
        },
      });
      const row = await rowFor(exId);
      expect(row?.hasUnresolvedObjection).toBe(false);
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

  it('AND-combination: witness=Finch & status=ADMITTED matches nothing (P-3 no longer reaches ADMITTED post-F12)', async () => {
    // Post-F12, P-3 is OBJECTED (admission blocked), not ADMITTED, so this
    // combination matches zero results.
    const results = await searchExhibits({
      caseId: demoCaseId,
      requestingUserRole: 'JUDGE',
      witness: 'Finch',
      status: 'ADMITTED',
    });
    expect(results).toHaveLength(0);
  });

  it('AND-combination: witness=Finch & status=OBJECTED matches P-3 (narrowing still works)', async () => {
    // The AND-narrowing behavior itself still has live coverage: P-3's current
    // status is OBJECTED, so the combined filter resolves to exactly P-3.
    const results = await searchExhibits({
      caseId: demoCaseId,
      requestingUserRole: 'JUDGE',
      witness: 'Finch',
      status: 'OBJECTED',
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
      currentStatus: 'OBJECTED',
    });
    // Post-F12, P-3 is OBJECTED (admission blocked), not ADMITTED, so no F6 rule
    // fires — discrepancyFlags is [].
    expect(p3.discrepancyFlags).toEqual([]);
    // P-3 now has zero custody transfers (admission-blocked fixture) — no
    // custodian of record.
    expect(p3.currentCustodianName).toBeNull();
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

  it('only the Phase-8 legacy-admit fixtures (P-6/P-7) carry open discrepancy flags; all others are clean', async () => {
    // Phase 8 (per 08-CONTEXT) adds two deliberately-legacy-admitted fixtures
    // via a seed-only legacy-admit helper that bypasses the F12 gate: P-6
    // (ADMITTED, no custodian → ADMITTED_NO_CUSTODIAN) and P-7 (ADMITTED with an
    // unresolved objection → UNRESOLVED_OBJECTION_JURY_ELIGIBLE). These are the
    // ONLY seeded exhibits that carry an open flag — every other exhibit stays
    // clean, since the live gate still makes those preconditions unreachable
    // through the normal service path. This both keeps the batch-load's flag
    // surfacing honest and documents the intended Phase-8 seed shape.
    const rows = await getExhibits(demoCaseId, 'JUDGE');
    const flagged = rows.filter((r) => r.discrepancyFlags.length > 0).map((r) => r.exhibitLabel);
    expect(flagged.sort()).toEqual(['P-6', 'P-7']);
    // P-6 fires ADMITTED_NO_CUSTODIAN; P-7 fires UNRESOLVED_OBJECTION_JURY_ELIGIBLE.
    const p6 = rows.find((r) => r.exhibitLabel === 'P-6');
    const p7 = rows.find((r) => r.exhibitLabel === 'P-7');
    expect(p6?.discrepancyFlags.map((f) => f.ruleCode)).toContain('ADMITTED_NO_CUSTODIAN');
    expect(p7?.discrepancyFlags.map((f) => f.ruleCode)).toContain(
      'UNRESOLVED_OBJECTION_JURY_ELIGIBLE',
    );
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
