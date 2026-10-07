import { NextResponse, type NextRequest } from 'next/server';
import { getExhibits } from '@/services/exhibits';
import { parseRequestingRole } from '@/services/visibility';
import { errorResponse } from '@/lib/apiError';

// GET /api/cases/:id/exhibits — list all exhibits for a case as ExhibitListRow[]
// (F0/F9). Each row is enriched with currentStatus, currentCustodianName, and a
// structurally-present (always-empty-for-now) discrepancyFlags column so the Case
// Workspace screen renders directly with zero query logic of its own. Sealed
// exhibits are excluded by role via the same predicate as the single-exhibit
// reads (02-02); an unknown case id returns 404 CASE_NOT_FOUND.
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const requestingUserRole = parseRequestingRole(request);
    const exhibits = await getExhibits(id, requestingUserRole);
    return NextResponse.json(exhibits, { status: 200 });
  } catch (err) {
    return errorResponse(err);
  }
}
