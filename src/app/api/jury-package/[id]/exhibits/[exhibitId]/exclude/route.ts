import { NextResponse, type NextRequest } from 'next/server';
import { excludeJuryPackageExhibit } from '@/services/juryPackage';
import { ValidationError } from '@/lib/errors';
import { errorResponse } from '@/lib/apiError';

// POST /api/jury-package/:id/exhibits/:exhibitId/exclude — explicitly exclude a
// jury-package exhibit row (F13). Role-gated DEPUTY/CLERK/ADMIN inside the
// service (never a client-supplied role claim). Thin handler mirroring the
// finalize route: validate the body, delegate to the service, map every typed
// error via errorResponse. Errors: JURY_PACKAGE_NOT_FOUND 404,
// JURY_PACKAGE_ALREADY_FINALIZED 409, ROLE_NOT_PERMITTED 403,
// JURY_PACKAGE_EXHIBIT_NOT_FOUND 404.
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; exhibitId: string }> },
): Promise<NextResponse> {
  try {
    const { id, exhibitId } = await context.params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError('Request body must be valid JSON');
    }

    const { actorUserId, reason, note } = (body ?? {}) as {
      actorUserId?: unknown;
      reason?: unknown;
      note?: unknown;
    };

    if (typeof actorUserId !== 'string' || actorUserId.length === 0) {
      throw new ValidationError('actorUserId must be a non-empty string');
    }
    if (reason !== 'SEALED_EXPARTE' && reason !== 'MANUAL_REMOVAL') {
      throw new ValidationError("reason must be 'SEALED_EXPARTE' or 'MANUAL_REMOVAL'");
    }
    if (note !== undefined && typeof note !== 'string') {
      throw new ValidationError('note must be a string when provided');
    }

    const result = await excludeJuryPackageExhibit({
      juryPackageId: id,
      exhibitId,
      actorUserId,
      reason,
      note,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return errorResponse(err);
  }
}
