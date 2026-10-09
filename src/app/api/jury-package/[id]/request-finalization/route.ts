import { NextResponse, type NextRequest } from 'next/server';
import { requestFinalization } from '@/services/juryPackage';
import { ValidationError } from '@/lib/errors';
import { errorResponse } from '@/lib/apiError';

// POST /api/jury-package/:id/request-finalization — a lightweight notification
// path (F11 §Process steps 7-8) for a viewer who cannot finalize directly
// (JUDGE / CHAMBERS_STAFF / ATTORNEY) to flag an authorized role. Thin wrapper
// mirroring finalize/route.ts: parse { actorUserId }, call the service, surface
// typed errors via errorResponse. requestFinalization maps ROLE_NOT_PERMITTED
// 403 (an already-finalize-authorized role) / JURY_PACKAGE_ALREADY_FINALIZED
// 409 / JURY_PACKAGE_NOT_FOUND 404 through errorResponse.
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

    const { actorUserId } = (body ?? {}) as { actorUserId?: unknown };
    if (typeof actorUserId !== 'string' || actorUserId.length === 0) {
      throw new ValidationError('actorUserId must be a non-empty string');
    }

    const result = await requestFinalization(id, actorUserId);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return errorResponse(err);
  }
}
