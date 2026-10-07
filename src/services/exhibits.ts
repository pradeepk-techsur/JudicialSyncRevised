import type { Exhibit, ExhibitStatus, OfferingParty, Role } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { offeringPartyEnum } from '@/lib/validation/eventPayloads';
import type { ExhibitListRow } from '@/lib/types';
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
// shape — reusing this mapper is what guarantees they never drift.
function toListRow(exhibit: {
  id: string;
  exhibitLabel: string;
  description: string;
  offeringParty: OfferingParty;
  associatedWitness: string | null;
  currentState: { currentStatus: ExhibitStatus } | null;
  custodyState: { custodian: { name: string } } | null;
}): ExhibitListRow {
  return {
    exhibitId: exhibit.id,
    exhibitLabel: exhibit.exhibitLabel,
    description: exhibit.description,
    offeringParty: exhibit.offeringParty,
    associatedWitness: exhibit.associatedWitness,
    currentStatus: exhibit.currentState?.currentStatus ?? null,
    currentCustodianName: exhibit.custodyState?.custodian.name ?? null,
    discrepancyFlags: [],
  };
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
  return exhibits.map(toListRow);
}
