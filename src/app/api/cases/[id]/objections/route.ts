import { NextResponse, type NextRequest } from 'next/server';
import { getUnresolvedObjections } from '@/services/objections';
import { errorResponse } from '@/lib/apiError';

// GET /api/cases/:id/objections?status=unresolved — list objection threads
// case-wide (F2, Y1-api.md §Objections). This route is one of the identical
// callers of getUnresolvedObjections (alongside Command Center F8 and the
// assistant F7) — it adds no caller-specific query logic.
// 200 ObjectionCurrentState[].
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id: caseId } = await context.params;
    // The only status filter this plan surfaces is `unresolved` (the shared
    // query). Default (no param) also returns unresolved threads — the single
    // view every current consumer needs. Resolved-thread listing is layered on
    // by the history/timeline feature (F10) when a consumer requires it.
    const objections = await getUnresolvedObjections(caseId);
    return NextResponse.json(objections, { status: 200 });
  } catch (err) {
    return errorResponse(err);
  }
}
