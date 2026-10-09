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
  juryPackageEligibility: 'INCLUDED' | 'NOT_ELIGIBLE' | 'BLOCKED',
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
 * rows — an exhibit absent from that set (no package ever computed, not yet a
 * member, or excluded) is NOT_ELIGIBLE by the precedence rule's final branch.
 *
 * Precedence (F09 §Process step 3, exactly):
 *   Included  = an INCLUDED member row whose discrepancyStatus is CLEAN
 *   Blocked   = an INCLUDED member row whose discrepancyStatus is FLAGGED
 *   Not eligible = everything else (no package ever computed for the case; an
 *                  exhibit with no member row; or a member row with status
 *                  EXCLUDED)
 *
 * EXPORTED (not module-private): this is the ONLY implementation of the
 * Included/Blocked/Not-eligible precedence rule anywhere in the codebase.
 * 08-08's getExhibitHistory computes the SAME eligibility for a single
 * exhibit's juryPackageChecklist and MUST call this function (passing a
 * 1-element exhibitIds array and reading that one Map entry) rather than
 * re-deriving the branch logic — both plans' own tests assert cross-screen
 * parity between Case Workspace and Exhibit Detail, and a second hand-written
 * copy of this precedence would silently drift from this one over time.
 */
export async function loadJuryEligibilityByExhibit(
  caseId: string,
  exhibitIds: string[],
): Promise<Map<string, 'INCLUDED' | 'NOT_ELIGIBLE' | 'BLOCKED'>> {
  const result = new Map<string, 'INCLUDED' | 'NOT_ELIGIBLE' | 'BLOCKED'>();
  if (exhibitIds.length === 0) return result;

  const latestPackage = await prisma.juryPackage.findFirst({
    where: { caseId },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  if (!latestPackage) {
    // No package ever computed — every exhibit is NOT_ELIGIBLE (F09 §Process
    // step 4, expected behavior, not a defect).
    for (const id of exhibitIds) result.set(id, 'NOT_ELIGIBLE');
    return result;
  }

  const rows = await prisma.juryPackageExhibit.findMany({
    where: { juryPackageId: latestPackage.id, exhibitId: { in: exhibitIds } },
    select: { exhibitId: true, status: true, discrepancyStatus: true },
  });
  const byExhibit = new Map(rows.map((r) => [r.exhibitId, r]));

  for (const id of exhibitIds) {
    const row = byExhibit.get(id);
    if (!row || row.status === 'EXCLUDED') {
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
      eligibilityByExhibit.get(e.id) ?? 'NOT_ELIGIBLE',
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
      eligibilityByExhibit.get(e.id) ?? 'NOT_ELIGIBLE',
      unresolvedObjectionIds.has(e.id),
    ),
  );
}
