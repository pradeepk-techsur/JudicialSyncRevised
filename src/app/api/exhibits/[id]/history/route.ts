import { NextResponse, type NextRequest } from 'next/server';
import { getExhibitHistory } from '@/services/history';
import { NotFoundError } from '@/lib/errors';
import { errorResponse } from '@/lib/apiError';

// GET /api/exhibits/:id/history — full chronological event timeline (F10,
// Y1-api.md §Exhibits). Returns the complete ordered timeline across every event
// type with plain-language summaries and resolved actor names. A null result
// from getExhibitHistory means the exhibit does not exist → 404 EXHIBIT_NOT_FOUND
// (also the response for sealed/unauthorized per F10 §Validation).
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await context.params;

    const history = await getExhibitHistory(id);
    if (!history) {
      throw new NotFoundError('EXHIBIT_NOT_FOUND', 'No exhibit found with the given ID');
    }

    return NextResponse.json(history, { status: 200 });
  } catch (err) {
    return errorResponse(err);
  }
}
