import { NextResponse, type NextRequest } from 'next/server';
import { getExhibit } from '@/services/exhibits';
import { NotFoundError } from '@/lib/errors';
import { errorResponse } from '@/lib/apiError';

// GET /api/exhibits/:id — fetch a single exhibit's identity fields (F0).
// getExhibit returns null for a missing id; the route maps that to 404.
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const exhibit = await getExhibit(id);
    if (!exhibit) {
      throw new NotFoundError('EXHIBIT_NOT_FOUND', 'No exhibit found with the given ID');
    }
    return NextResponse.json(exhibit, { status: 200 });
  } catch (err) {
    return errorResponse(err);
  }
}
