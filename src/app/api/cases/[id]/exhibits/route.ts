import { NextResponse, type NextRequest } from 'next/server';
import { getExhibits } from '@/services/exhibits';
import { errorResponse } from '@/lib/apiError';

// GET /api/cases/:id/exhibits — list all exhibits for a case (F0/F9).
// Phase 1 returns the raw identity rows; the richer current-state summary shape
// in Y1-api.md §Exhibits (F9) is layered on in a later phase that builds the
// projection reads and the case workspace consumer.
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const exhibits = await getExhibits(id);
    return NextResponse.json(exhibits, { status: 200 });
  } catch (err) {
    return errorResponse(err);
  }
}
