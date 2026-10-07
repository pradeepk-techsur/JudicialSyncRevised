import type { Exhibit } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ConflictError, ValidationError } from '@/lib/errors';
import { offeringPartyEnum } from '@/lib/validation/eventPayloads';

// Exhibit identity-record CRUD (FRD F00 §Inputs/§Validation).
//
// createExhibit accepts ONLY identity fields — there is deliberately no
// status/custody parameter in its signature at all (structurally absent, not
// merely unused), per F00 §Validation: "An Exhibit cannot be created with any
// status/custody field directly." Status/custody are set exclusively via a
// later recordEvent() call (F1/F3).
//
// Scope decision (documented, deliberate): role-based visibility filtering
// (sealed-exhibit exclusion per 00-header.md §Role-Based Visibility) is NOT
// implemented in getExhibit/getExhibits here — it is deferred to Phase 2, where
// the first UI/API consumer actually needs requestingUserRole plumbed through.
// isSealed is stored faithfully now; filtering is added when a real caller needs
// it, avoiding speculative plumbing ahead of its consumer.

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

export async function getExhibit(exhibitId: string): Promise<Exhibit | null> {
  // Returns null (not a throw) for a missing id — the API route layer maps null
  // to 404 EXHIBIT_NOT_FOUND.
  return prisma.exhibit.findUnique({ where: { id: exhibitId } });
}

export async function getExhibits(caseId: string): Promise<Exhibit[]> {
  return prisma.exhibit.findMany({
    where: { caseId },
    orderBy: { createdAt: 'asc' },
  });
}
