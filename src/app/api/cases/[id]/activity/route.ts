import { NextResponse, type NextRequest } from 'next/server';
import { getRecentActivity, getStatusCounts } from '@/services/activity';
import { parseRequestingRole } from '@/services/visibility';
import { errorResponse } from '@/lib/apiError';
import { AppError, CommandCenterLoadError } from '@/lib/errors';

// GET /api/cases/:id/activity — the Trial Command Center Recent Activity feed
// (F8; TechArch 03-api.md §4.9). A thin delegation over getRecentActivity +
// getStatusCounts, mirroring the exhibits-list route: parse the requesting role
// from X-User-Role (fails CLOSED to ATTORNEY), pass the optional `since`
// through, and map errors to the common envelope.
//
// 08-10 completes 08-06's deferred hand-off: this route now returns the FRD F08
// §Process-step-2 shape `{ recentActivity, statusCounts }` rather than a bare
// RecentActivityEntry[]. The two reads run concurrently (Promise.all); both
// apply the SAME role-based sealed-exclusion predicate, so a sealed exhibit is
// absent from the feed AND uncounted for a role that cannot view sealed.
//
//   200 → { recentActivity: RecentActivityEntry[], statusCounts: Record<ExhibitStatus, number> }
//   422 → VALIDATION_ERROR            (since not a valid past/present datetime)
//   500 → COMMAND_CENTER_LOAD_FAILED  (any underlying query failure)
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id: caseId } = await context.params;
    const requestingUserRole = parseRequestingRole(request);
    const since = request.nextUrl.searchParams.get('since') ?? undefined;
    const [recentActivity, statusCounts] = await Promise.all([
      getRecentActivity(caseId, { since, role: requestingUserRole }),
      getStatusCounts(caseId, requestingUserRole),
    ]);
    return NextResponse.json({ recentActivity, statusCounts }, { status: 200 });
  } catch (err) {
    // A client-input problem (bad/future `since`) is a typed ValidationError
    // (422) and must pass through unchanged. Anything else — an unexpected DB/
    // service failure — becomes COMMAND_CENTER_LOAD_FAILED (500) per FRD F08
    // §Error States, so the panel can show "Unable to load trial activity —
    // please retry" rather than a bare 500. Always return a response; never
    // catch-and-swallow.
    if (err instanceof AppError) {
      return errorResponse(err);
    }
    return errorResponse(new CommandCenterLoadError());
  }
}
