import { NextResponse, type NextRequest } from 'next/server';
import { getExhibit } from '@/services/exhibits';
import { recordStatusChange } from '@/services/status';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { errorResponse } from '@/lib/apiError';

// POST /api/exhibits/:id/events/status — record a status transition (F1).
//
// Thin handler: validate the request body shape, confirm the exhibit exists
// (404 EXHIBIT_NOT_FOUND otherwise), then delegate all lifecycle rules to
// recordStatusChange. Thrown AppErrors (INVALID_STATUS_TRANSITION 422,
// STATUS_FINALIZED 409, STATUS_CONFLICT 409) map to their codes via errorResponse.
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await context.params;

    // Distinguish "exhibit does not exist" (404) from a lifecycle rule violation
    // before we attempt the transition — gives the correct EXHIBIT_NOT_FOUND code
    // rather than a generic validation error from the ledger writer. getExhibit
    // now requires a role (plan 02-02 sealed-masking); this F1 write route is out
    // of scope for role-based visibility (plan 02-02 scope note), so it passes
    // JUDGE — a visibility superset — to keep its existence check unchanged.
    const exhibit = await getExhibit(id, 'JUDGE');
    if (!exhibit) {
      throw new NotFoundError('EXHIBIT_NOT_FOUND', 'No exhibit found with the given ID');
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError('Request body must be valid JSON');
    }

    const { toStatus, actorUserId, notes } = (body ?? {}) as {
      toStatus?: unknown;
      actorUserId?: unknown;
      notes?: unknown;
    };

    if (typeof toStatus !== 'string') {
      throw new ValidationError('toStatus must be a valid status value');
    }
    if (typeof actorUserId !== 'string' || actorUserId.length === 0) {
      throw new ValidationError('actorUserId must be a non-empty string');
    }
    if (notes !== undefined && typeof notes !== 'string') {
      throw new ValidationError('notes must be a string when provided');
    }

    const result = await recordStatusChange({
      exhibitId: id,
      // Cast is safe: an unknown enum value is rejected by ALLOWED_TRANSITIONS
      // (INVALID_STATUS_TRANSITION) inside the service, never silently coerced.
      toStatus: toStatus as never,
      actorUserId,
      notes,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
