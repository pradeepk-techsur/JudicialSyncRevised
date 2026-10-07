import { NextResponse, type NextRequest } from 'next/server';
import { searchExhibits } from '@/services/exhibits';
import { parseRequestingRole } from '@/services/visibility';
import { errorResponse } from '@/lib/apiError';

// GET /api/cases/:id/exhibits/search — F4 Exhibit Search. Combines
// keyword/status/witness/dateFrom/dateTo with AND semantics, returning the same
// ExhibitListRow[] shape as the full list. An empty request (no criteria) is
// rejected with 422 EMPTY_SEARCH_CRITERIA; sealed exhibits are excluded by role.
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id: caseId } = await context.params;
    const { searchParams } = new URL(request.url);
    const requestingUserRole = parseRequestingRole(request);
    const results = await searchExhibits({
      caseId,
      requestingUserRole,
      keyword: searchParams.get('keyword') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      witness: searchParams.get('witness') ?? undefined,
      dateFrom: searchParams.get('dateFrom') ?? undefined,
      dateTo: searchParams.get('dateTo') ?? undefined,
    });
    return NextResponse.json(results, { status: 200 });
  } catch (err) {
    return errorResponse(err);
  }
}
