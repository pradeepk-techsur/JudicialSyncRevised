import { NextResponse, type NextRequest } from 'next/server';
import { recordCustodyTransfer } from '@/services/custody';
import { ValidationError } from '@/lib/errors';
import { errorResponse } from '@/lib/apiError';

// POST /api/exhibits/:id/events/custody — record a custody transfer (F3, Y1-api.md §Custody).
// Thin wrapper: parse body, call exactly one service function, shape the response.
// All chain validation, no-op/invalid-custodian checks, and the ledger+projection
// write live in recordCustodyTransfer.
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
      throw new ValidationError('request body must be valid JSON');
    }

    const {
      fromCustodianUserId = null,
      toCustodianUserId,
      reason,
      actorUserId,
    } = (body ?? {}) as {
      fromCustodianUserId?: string | null;
      toCustodianUserId?: string;
      reason?: string;
      actorUserId?: string;
    };

    if (typeof toCustodianUserId !== 'string' || toCustodianUserId.length === 0) {
      throw new ValidationError('toCustodianUserId is required');
    }
    if (typeof actorUserId !== 'string' || actorUserId.length === 0) {
      throw new ValidationError('actorUserId is required');
    }

    const result = await recordCustodyTransfer({
      exhibitId: id,
      fromCustodianUserId: fromCustodianUserId ?? null,
      toCustodianUserId,
      reason,
      actorUserId,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
