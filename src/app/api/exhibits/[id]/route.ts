import { NextResponse, type NextRequest } from 'next/server';
import { getExhibit } from '@/services/exhibits';
import { parseRequestingRole } from '@/services/visibility';
import { NotFoundError } from '@/lib/errors';
import { errorResponse } from '@/lib/apiError';

// GET /api/exhibits/:id — fetch a single exhibit's identity fields (F0).
// The requesting role is read from the demo's X-User-Role header (no auth layer
// exists) and threaded into getExhibit, which applies sealed-exhibit masking.
// A sealed exhibit read by an unauthorized role, and a genuinely missing id,
// both yield null → the SAME 404 EXHIBIT_NOT_FOUND body (anti-enumeration).
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const requestingUserRole = parseRequestingRole(request);
    const exhibit = await getExhibit(id, requestingUserRole);
    if (!exhibit) {
      throw new NotFoundError('EXHIBIT_NOT_FOUND', 'No exhibit found with the given ID');
    }
    return NextResponse.json(exhibit, { status: 200 });
  } catch (err) {
    return errorResponse(err);
  }
}
