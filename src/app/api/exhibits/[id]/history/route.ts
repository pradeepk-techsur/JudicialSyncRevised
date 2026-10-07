import { NextResponse, type NextRequest } from 'next/server';
import { getExhibitHistory } from '@/services/history';
import { parseRequestingRole } from '@/services/visibility';
import { NotFoundError } from '@/lib/errors';
import { errorResponse } from '@/lib/apiError';

// GET /api/exhibits/:id/history — full chronological event timeline (F10,
// Y1-api.md §Exhibits). Returns the complete ordered timeline across every event
// type with plain-language summaries and resolved actor names. The requesting
// role is read from the demo's X-User-Role header and threaded into
// getExhibitHistory, which inherits sealed-masking from getExhibit. A null result
// means the exhibit does not exist OR is sealed+unauthorized → the SAME 404
// EXHIBIT_NOT_FOUND body (anti-enumeration, per F10 §Validation / threat T-02-05).
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const requestingUserRole = parseRequestingRole(request);

    const history = await getExhibitHistory(id, requestingUserRole);
    if (!history) {
      throw new NotFoundError('EXHIBIT_NOT_FOUND', 'No exhibit found with the given ID');
    }

    return NextResponse.json(history, { status: 200 });
  } catch (err) {
    return errorResponse(err);
  }
}
