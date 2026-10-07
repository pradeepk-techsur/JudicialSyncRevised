import { NextResponse, type NextRequest } from 'next/server';
import { recordRuling } from '@/services/objections';
import { ValidationError } from '@/lib/errors';
import { errorResponse } from '@/lib/apiError';

// POST /api/objections/:id/ruling — record a ruling against an objection thread
// (F2, Y1-api.md §Objections). Judge-only enforcement for ALL dispositions
// (incl. RESERVED) is in the service layer (recordRuling / threat T-01-11).
// 201 { event, objectionState } | 404 OBJECTION_NOT_FOUND
// | 409 OBJECTION_ALREADY_RESOLVED | 403 ROLE_NOT_PERMITTED.
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id: objectionId } = await context.params;

    let body: { disposition?: unknown; actorUserId?: unknown };
    try {
      body = await request.json();
    } catch {
      throw new ValidationError('request body must be valid JSON');
    }

    const result = await recordRuling({
      objectionId,
      disposition: body.disposition as 'SUSTAINED' | 'OVERRULED' | 'RESERVED',
      actorUserId: body.actorUserId as string,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
