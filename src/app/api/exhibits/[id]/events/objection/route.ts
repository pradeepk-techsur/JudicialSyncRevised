import { NextResponse, type NextRequest } from 'next/server';
import { recordObjection } from '@/services/objections';
import { ValidationError } from '@/lib/errors';
import { errorResponse } from '@/lib/apiError';

// POST /api/exhibits/:id/events/objection — raise an objection against an
// exhibit (F2, Y1-api.md §Objections). Thin wrapper: parse body, call one
// service function, shape the response. All business logic (status-target
// validation, projection write) lives in recordObjection.
// 201 { event, objectionState } | 422 INVALID_OBJECTION_TARGET | 404 EXHIBIT_NOT_FOUND.
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id: exhibitId } = await context.params;

    let body: { objectingParty?: unknown; grounds?: unknown; actorUserId?: unknown };
    try {
      body = await request.json();
    } catch {
      throw new ValidationError('request body must be valid JSON');
    }

    const result = await recordObjection({
      exhibitId,
      objectingParty: body.objectingParty as 'PLAINTIFF' | 'PROSECUTION' | 'DEFENSE',
      grounds: body.grounds as string,
      actorUserId: body.actorUserId as string,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
