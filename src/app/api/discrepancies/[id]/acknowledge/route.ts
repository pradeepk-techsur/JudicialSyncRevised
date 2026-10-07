import { NextResponse, type NextRequest } from 'next/server';
import { acknowledgeDiscrepancy } from '@/services/discrepancies';
import { ValidationError } from '@/lib/errors';
import { errorResponse } from '@/lib/apiError';

// POST /api/discrepancies/:id/acknowledge — acknowledge an OPEN discrepancy flag
// with a required justification (F6). Thin delegation to acknowledgeDiscrepancy,
// which performs the role gate (against the actor's ACTUAL User.role) and writes
// an auditable DISCREPANCY_ACKNOWLEDGED ledger event + flag flip in one tx.
//
// Returns 200 for both a fresh acknowledgment AND an idempotent re-ack (the
// service already returns existing state for an already-ack'd flag — no special
// casing here). JUSTIFICATION_REQUIRED 422 / DISCREPANCY_NOT_FOUND 404 /
// ROLE_NOT_PERMITTED 403 map via errorResponse.
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await context.params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError('Request body must be valid JSON');
    }

    const { actorUserId, justification } = (body ?? {}) as {
      actorUserId?: unknown;
      justification?: unknown;
    };

    if (typeof actorUserId !== 'string' || actorUserId.length === 0) {
      throw new ValidationError('actorUserId must be a non-empty string');
    }
    if (typeof justification !== 'string' || justification.length === 0) {
      throw new ValidationError('justification must be a non-empty string');
    }

    const result = await acknowledgeDiscrepancy({
      discrepancyFlagId: id,
      actorUserId,
      justification,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return errorResponse(err);
  }
}
