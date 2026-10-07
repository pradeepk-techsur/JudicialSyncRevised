import { NextResponse, type NextRequest } from 'next/server';
import { getExhibit } from '@/services/exhibits';
import { getExhibitStatus } from '@/services/status';
import { NotFoundError } from '@/lib/errors';
import { errorResponse } from '@/lib/apiError';

// GET /api/exhibits/:id/status — current derived status (F1).
//
// Distinguishes "exhibit exists but has no status yet" from "exhibit does not
// exist": a null projection for a real exhibit is NOT an error (F00 §Outputs —
// "not yet entered into evidence"), it returns 200 with a null-ish body; a null
// projection for a nonexistent exhibit is 404 EXHIBIT_NOT_FOUND.
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await context.params;

    const currentState = await getExhibitStatus(id);
    if (currentState) {
      return NextResponse.json(currentState, { status: 200 });
    }

    // No status row — decide 200 (exhibit exists, not yet entered) vs 404 (no
    // such exhibit) by checking exhibit identity.
    const exhibit = await getExhibit(id);
    if (!exhibit) {
      throw new NotFoundError('EXHIBIT_NOT_FOUND', 'No exhibit found with the given ID');
    }

    // Exhibit exists but has recorded no STATUS_CHANGE event yet.
    return NextResponse.json(
      { exhibitId: id, currentStatus: null, lastStatusEventId: null, lastStatusAt: null },
      { status: 200 },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
