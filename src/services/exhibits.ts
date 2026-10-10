import type { Exhibit, ExhibitStatus, OfferingParty, Role } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ConflictError, NotFoundError, UnprocessableError, ValidationError } from '@/lib/errors';
import { exhibitStatusEnum, offeringPartyEnum } from '@/lib/validation/eventPayloads';
import type { DiscrepancyFlagSummary, ExhibitListRow } from '@/lib/types';
import { ruleLabel } from '@/lib/discrepancyLabels';
import { canViewSealed } from '@/services/visibility';

// Exhibit identity-record CRUD (FRD F00 §Inputs/§Validation).
//
// createExhibit accepts ONLY identity fields — there is deliberately no
// status/custody parameter in its signature at all (structurally absent, not
// merely unused), per F00 §Validation: "An Exhibit cannot be created with any
// status/custody field directly." Status/custody are set exclusively via a
// later recordEvent() call (F1/F3).
//
// Role-based visibility (sealed-exhibit exclusion per 00-header.md §Role-Based
// Visibility): getExhibit (singular) and getExhibits (plural) both apply the
// sealed-masking WHERE predicate via the single shared canViewSealed() predicate
// in visibility.ts. getExhibits returns the composite ExhibitListRow[] shape
// (status badge + custodian name + structurally-present discrepancy column) that
// F9's Case Workspace and F4's Exhibit Search both consume — the UI derives none
// of this itself. searchExhibits returns the identical row shape via the shared
// toListRow mapper so the two endpoints can never drift.

const createExhibitSchema = z.object({
  caseId: z.string().min(1),
  exhibitLabel: z.string().min(1),
  description: z.string().min(1).max(1000),
  source: z.string().optional(),
  offeringParty: offeringPartyEnum,
  associatedWitness: z.string().optional(),
  isSealed: z.boolean().optional(),
});

export type CreateExhibitInput = z.infer<typeof createExhibitSchema>;

export async function createExhibit(input: {
  caseId: string;
  exhibitLabel: string;
  description: string;
  source?: string;
  offeringParty: 'PLAINTIFF' | 'PROSECUTION' | 'DEFENSE';
  associatedWitness?: string;
  isSealed?: boolean;
}): Promise<Exhibit> {
  // Validate identity fields at the service layer first, for a clean 422 instead
  // of a raw Postgres constraint error (description length is also DB-enforced
  // via the CHECK constraint per TechArch §3.2).
  let data: CreateExhibitInput;
  try {
    data = createExhibitSchema.parse(input);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const first = err.issues[0];
      const field = first?.path.join('.') || 'input';
      if (field === 'offeringParty') {
        throw new ValidationError(
          'offeringParty must be one of: PLAINTIFF, PROSECUTION, DEFENSE',
        );
      }
      if (field === 'description') {
        throw new ValidationError('description must be non-empty and at most 1000 characters');
      }
      throw new ValidationError(`${field} ${first?.message ?? 'is invalid'}`);
    }
    throw err;
  }

  try {
    return await prisma.exhibit.create({
      data: {
        caseId: data.caseId,
        exhibitLabel: data.exhibitLabel,
        description: data.description,
        source: data.source,
        offeringParty: data.offeringParty,
        associatedWitness: data.associatedWitness,
        isSealed: data.isSealed ?? false,
      },
    });
  } catch (err) {
    // Unique-constraint violation on (caseId, exhibitLabel) → typed conflict,
    // never let the raw Prisma P2002 leak to the API layer.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError(
        'EXHIBIT_LABEL_CONFLICT',
        'An exhibit with this label already exists in this case',
      );
    }
    throw err;
  }
}

export async function getExhibit(
  exhibitId: string,
  requestingUserRole: Role,
): Promise<Exhibit | null> {
  // Returns null (not a throw) both for a genuinely missing id AND for a sealed
  // exhibit read by a role that cannot view sealed exhibits — the two cases are
  // byte-identical at this layer (anti-enumeration, threat T-02-05). The API
  // route maps null to 404 EXHIBIT_NOT_FOUND.
  //
  // findFirst (not findUnique): findUnique's `where` is restricted to
  // unique-indexed fields only, so adding the isSealed predicate alongside id
  // requires findFirst. id remains the primary key, so this is not a
  // performance regression.
  return prisma.exhibit.findFirst({
    where: {
      id: exhibitId,
      ...(canViewSealed(requestingUserRole) ? {} : { isSealed: false }),
    },
  });
}

// Case-existence guard (FRD F09 §Error States: CASE_NOT_FOUND 404). Phase 1
// never implemented this since no consumer needed it yet; the Case Workspace /
// Exhibit Search screens do.
async function assertCaseExists(caseId: string): Promise<void> {
  const kase = await prisma.case.findUnique({ where: { id: caseId }, select: { id: true } });
  if (!kase) {
    throw new NotFoundError('CASE_NOT_FOUND', 'No case found with the given ID');
  }
}

// The single mapper from a Prisma exhibit-with-projections row to the shared
// ExhibitListRow shape. Both getExhibits and searchExhibits return this exact
// shape — reusing this mapper is what guarantees they never drift. The caller
// passes in the exhibit's already-grouped discrepancy flags (batch-loaded once
// for the whole page via loadDiscrepancyFlagsByExhibit — never N+1 per row), so
// the row carries real OPEN+ACKNOWLEDGED flags mapped through the single
// ruleLabel source rather than the old [] placeholder.
function toListRow(
  exhibit: {
    id: string;
    exhibitLabel: string;
    description: string;
    offeringParty: OfferingParty;
    associatedWitness: string | null;
    isSealed: boolean;
    currentState: { currentStatus: ExhibitStatus } | null;
    custodyState: { custodian: { name: string } } | null;
  },
  discrepancyFlags: DiscrepancyFlagSummary[],
  juryPackageEligibility: 'INCLUDED' | 'NOT_ELIGIBLE' | 'BLOCKED' | 'NOT_YET_EVALUATED',
  hasUnresolvedObjection: boolean,
): ExhibitListRow {
  return {
    exhibitId: exhibit.id,
    exhibitLabel: exhibit.exhibitLabel,
    description: exhibit.description,
    offeringParty: exhibit.offeringParty,
    associatedWitness: exhibit.associatedWitness,
    currentStatus: exhibit.currentState?.currentStatus ?? null,
    currentCustodianName: exhibit.custodyState?.custodian.name ?? null,
    discrepancyFlags,
    // F09 §Process step 3 — precedence computed once in loadJuryEligibilityByExhibit.
    juryPackageEligibility,
    hasUnresolvedObjection,
    // isSealed rides directly off the raw exhibit row (Prisma `include` does not
    // prune scalar fields, so it is already present on every returned object).
    isSealed: exhibit.isSealed,
  };
}

// Batch-load the active (OPEN+ACKNOWLEDGED) discrepancy flags for a page of
// exhibits in ONE query and group them by exhibitId, so toListRow can attach
// each row's flags without an N+1 per-row lookup. RESOLVED flags are history
// and are deliberately excluded (they surface only in the exhibit timeline).
// Keyed on the already-sealed-filtered exhibitIds, so a sealed exhibit's flags
// never reach an unauthorized client (threat T-03-09).
async function loadDiscrepancyFlagsByExhibit(
  exhibitIds: string[],
): Promise<Map<string, DiscrepancyFlagSummary[]>> {
  const byExhibit = new Map<string, DiscrepancyFlagSummary[]>();
  if (exhibitIds.length === 0) {
    return byExhibit;
  }
  const flags = await prisma.discrepancyFlag.findMany({
    where: { exhibitId: { in: exhibitIds }, status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
    select: { exhibitId: true, ruleCode: true, status: true },
    orderBy: { detectedAt: 'asc' },
  });
  for (const flag of flags) {
    const summary: DiscrepancyFlagSummary = {
      ruleCode: flag.ruleCode,
      status: flag.status as 'OPEN' | 'ACKNOWLEDGED',
      label: ruleLabel(flag.ruleCode),
    };
    const existing = byExhibit.get(flag.exhibitId);
    if (existing) {
      existing.push(summary);
    } else {
      byExhibit.set(flag.exhibitId, [summary]);
    }
  }
  return byExhibit;
}

/**
 * Batch-compute juryPackageEligibility for a page of exhibits in ONE query,
 * mirroring loadDiscrepancyFlagsByExhibit's batch-load shape (no N+1). Reads
 * the case's single most-recently-computed JuryPackage's JuryPackageExhibit
 * rows, plus each exhibit's isSealed flag (one extra batched query — see below).
 *
 * Precedence (F09 §Process step 3, exactly — FRD-authoritative; amended Phase 9
 * from three values to FOUR):
 *   INCLUDED          = an INCLUDED member row whose discrepancyStatus is CLEAN
 *   BLOCKED           = an INCLUDED member row whose discrepancyStatus is FLAGGED
 *   NOT_ELIGIBLE      = a *structural, permanent* exclusion that no future
 *                       package computation reverses: the exhibit is sealed
 *                       (isSealed=true — the established Phase-8 substitute for
 *                       F16's non-existent `classification != 'TRIAL'` column,
 *                       the SAME substitution attentionFeed.ts/juryPackage.ts
 *                       already make), OR a member row exists with status
 *                       EXCLUDED (F13's sealed/ex-parte or manual-removal
 *                       remediation).
 *   NOT_YET_EVALUATED = every other case — no member row exists for this exhibit
 *                       at all. Covers (a) not-yet-ADMITTED exhibits, (b)
 *                       ADMITTED but no JuryPackage ever computed for the case,
 *                       and (c) ADMITTED after the latest package's computation.
 *
 * Phase 9 precedence change: the former "no package ever computed → NOT_ELIGIBLE
 * for everyone" branch (and the "no member row → NOT_ELIGIBLE" fall-through) are
 * now NOT_YET_EVALUATED. NOT_ELIGIBLE is reserved strictly for the two
 * structural exclusions above, so the Case Workspace never reads "Not eligible"
 * merely because nobody has run package computation yet (the T-06 defect).
 *
 * isSealed takes precedence over row existence/state: a sealed exhibit is
 * NOT_ELIGIBLE regardless of whether it has a member row or what that row says,
 * because the sealed classification is the permanent structural fact.
 *
 * EXPORTED (not module-private): this is the ONLY implementation of this
 * precedence rule anywhere in the codebase. 08-08's getExhibitHistory computes
 * the SAME eligibility for a single exhibit's juryPackageChecklist and MUST call
 * this function (passing a 1-element exhibitIds array and reading that one Map
 * entry) rather than re-deriving the branch logic — the FRD's three-surface
 * consistency rule (F09 §Validation) requires getExhibits / searchExhibits /
 * getExhibitHistory to agree by construction, and a second hand-written copy of
 * this precedence would silently drift from this one over time.
 */
export async function loadJuryEligibilityByExhibit(
  caseId: string,
  exhibitIds: string[],
): Promise<Map<string, 'INCLUDED' | 'NOT_ELIGIBLE' | 'BLOCKED' | 'NOT_YET_EVALUATED'>> {
  const result = new Map<string, 'INCLUDED' | 'NOT_ELIGIBLE' | 'BLOCKED' | 'NOT_YET_EVALUATED'>();
  if (exhibitIds.length === 0) return result;

  // Batch-fetch each exhibit's isSealed flag. This is a genuinely new query:
  // the function previously read only juryPackageExhibit rows and never needed
  // the exhibit rows themselves. Batched once over the (already role-filtered)
  // id list — never per-row, never a sealed leak (the caller sealed-filters the
  // id list before this function sees it, threat T-09-10).
  const [latestPackage, sealedRows] = await Promise.all([
    prisma.juryPackage.findFirst({
      where: { caseId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    }),
    prisma.exhibit.findMany({
      where: { id: { in: exhibitIds } },
      select: { id: true, isSealed: true },
    }),
  ]);
  const sealedById = new Map(sealedRows.map((e) => [e.id, e.isSealed]));

  // Member rows from the latest package (if any). Absent → the whole set is
  // either sealed (NOT_ELIGIBLE) or NOT_YET_EVALUATED, resolved per-exhibit below.
  const byExhibit = new Map<string, { status: string; discrepancyStatus: string }>();
  if (latestPackage) {
    const rows = await prisma.juryPackageExhibit.findMany({
      where: { juryPackageId: latestPackage.id, exhibitId: { in: exhibitIds } },
      select: { exhibitId: true, status: true, discrepancyStatus: true },
    });
    for (const r of rows) {
      byExhibit.set(r.exhibitId, { status: r.status, discrepancyStatus: r.discrepancyStatus });
    }
  }

  for (const id of exhibitIds) {
    // 1. Sealed → NOT_ELIGIBLE, the permanent structural exclusion, regardless
    //    of row existence or package state.
    if (sealedById.get(id)) {
      result.set(id, 'NOT_ELIGIBLE');
      continue;
    }
    const row = byExhibit.get(id);
    // 2. No latest package at all, or no member row for this exhibit →
    //    NOT_YET_EVALUATED (replacing Phase 8's incorrect NOT_ELIGIBLE).
    if (!row) {
      result.set(id, 'NOT_YET_EVALUATED');
    } else if (row.status === 'EXCLUDED') {
      // 3. Explicit structural exclusion from the package.
      result.set(id, 'NOT_ELIGIBLE');
    } else if (row.discrepancyStatus === 'FLAGGED') {
      result.set(id, 'BLOCKED');
    } else {
      result.set(id, 'INCLUDED');
    }
  }
  return result;
}

/**
 * Batch-compute hasUnresolvedObjection for a page of exhibits in ONE query.
 * NOT a DiscrepancyFlag read — an unresolved objection on a non-ADMITTED
 * exhibit never fires a discrepancy rule, but still needs surfacing on the
 * Case Workspace's Flags column as "Ruling pending". Keyed on the already
 * sealed-filtered exhibitIds (threat T-08-12), identical to the discrepancy
 * batch-load, so a sealed exhibit's objection state never reaches an
 * unauthorized role.
 */
async function loadUnresolvedObjectionFlags(exhibitIds: string[]): Promise<Set<string>> {
  if (exhibitIds.length === 0) return new Set();
  const rows = await prisma.objectionCurrentState.findMany({
    where: { exhibitId: { in: exhibitIds }, status: 'UNRESOLVED' },
    select: { exhibitId: true },
  });
  return new Set(rows.map((r) => r.exhibitId));
}

export async function getExhibits(
  caseId: string,
  requestingUserRole: Role,
): Promise<ExhibitListRow[]> {
  await assertCaseExists(caseId);
  const exhibits = await prisma.exhibit.findMany({
    where: {
      caseId,
      // Same sealed-exclusion predicate as the single-exhibit reads (02-02):
      // a sealed exhibit is simply absent for an unauthorized role, never a
      // redacted placeholder row.
      ...(canViewSealed(requestingUserRole) ? {} : { isSealed: false }),
    },
    include: {
      currentState: { select: { currentStatus: true } },
      custodyState: { include: { custodian: { select: { name: true } } } },
    },
    // Sort by exhibitLabel ascending — both F9 (§Process "sorted by
    // exhibitLabel") and F4 (§Process step 4 default ordering) must agree.
    orderBy: { exhibitLabel: 'asc' },
  });
  const exhibitIds = exhibits.map((e) => e.id);
  // Batch-load all three per-row projections in parallel over the SAME already
  // sealed-filtered exhibitIds list (no N+1, no sealed leak — threat T-08-12).
  const [flagsByExhibit, eligibilityByExhibit, unresolvedObjectionIds] = await Promise.all([
    loadDiscrepancyFlagsByExhibit(exhibitIds),
    loadJuryEligibilityByExhibit(caseId, exhibitIds),
    loadUnresolvedObjectionFlags(exhibitIds),
  ]);
  return exhibits.map((e) =>
    toListRow(
      e,
      flagsByExhibit.get(e.id) ?? [],
      eligibilityByExhibit.get(e.id) ?? 'NOT_YET_EVALUATED',
      unresolvedObjectionIds.has(e.id),
    ),
  );
}

// F4 — Exhibit Search. Combinable AND-semantics filtering over the same
// ExhibitListRow shape getExhibits returns (via the shared toListRow mapper, so
// the two endpoints never drift). Every filter value flows through Prisma's
// parameterized query builder — never string-interpolated into raw SQL
// (threat T-02-09) — and `status` is validated against the exhibitStatusEnum
// before it reaches the query.
export interface SearchExhibitsCriteria {
  caseId: string;
  requestingUserRole: Role;
  keyword?: string;
  status?: string;
  witness?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function searchExhibits(criteria: SearchExhibitsCriteria): Promise<ExhibitListRow[]> {
  const { caseId, requestingUserRole, keyword, status, witness, dateFrom, dateTo } = criteria;

  // At least one criterion required (EMPTY_SEARCH_CRITERIA, 422) — the
  // unfiltered full list is a separate call (getExhibits).
  if (!keyword && !status && !witness && !dateFrom && !dateTo) {
    throw new UnprocessableError('EMPTY_SEARCH_CRITERIA', 'At least one search criterion is required');
  }

  if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
    throw new UnprocessableError('INVALID_DATE_RANGE', 'dateFrom must not be after dateTo');
  }

  if (status) {
    const parsed = exhibitStatusEnum.safeParse(status);
    if (!parsed.success) {
      throw new ValidationError('status must be a valid exhibit status value');
    }
  }

  await assertCaseExists(caseId);

  const exhibits = await prisma.exhibit.findMany({
    where: {
      caseId,
      // Sealed exclusion lives in the SAME WHERE clause as the content filters
      // (threat T-02-10): a sealed exhibit can never surface in results for an
      // unauthorized role regardless of how well it matches the keyword.
      ...(canViewSealed(requestingUserRole) ? {} : { isSealed: false }),
      ...(keyword
        ? {
            OR: [
              { exhibitLabel: { contains: keyword, mode: 'insensitive' } },
              { description: { contains: keyword, mode: 'insensitive' } },
              { source: { contains: keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(witness ? { associatedWitness: { contains: witness, mode: 'insensitive' } } : {}),
      ...(status || dateFrom || dateTo
        ? {
            currentState: {
              ...(status ? { currentStatus: status as ExhibitStatus } : {}),
              // F4 §Process step 5: no event-type hint given -> filter on the
              // most recent STATUS_CHANGE event's timestamp, which is exactly
              // what ExhibitCurrentState.lastStatusAt already records. For an
              // exhibit with no ExhibitCurrentState row yet, Prisma's relational
              // filter on an optional to-one relation requires the related row to
              // exist and match, so it is correctly excluded whenever either
              // filter is active — no manual null-handling needed.
              ...(dateFrom || dateTo
                ? {
                    lastStatusAt: {
                      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
                      ...(dateTo ? { lte: new Date(dateTo) } : {}),
                    },
                  }
                : {}),
            },
          }
        : {}),
    },
    include: {
      currentState: { select: { currentStatus: true } },
      custodyState: { include: { custodian: { select: { name: true } } } },
    },
    orderBy: { exhibitLabel: 'asc' },
  });
  const exhibitIds = exhibits.map((e) => e.id);
  const [flagsByExhibit, eligibilityByExhibit, unresolvedObjectionIds] = await Promise.all([
    loadDiscrepancyFlagsByExhibit(exhibitIds),
    loadJuryEligibilityByExhibit(caseId, exhibitIds),
    loadUnresolvedObjectionFlags(exhibitIds),
  ]);
  return exhibits.map((e) =>
    toListRow(
      e,
      flagsByExhibit.get(e.id) ?? [],
      eligibilityByExhibit.get(e.id) ?? 'NOT_YET_EVALUATED',
      unresolvedObjectionIds.has(e.id),
    ),
  );
}
