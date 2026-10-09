import { NextResponse, type NextRequest } from 'next/server';
import { getAttentionFeed } from '@/services/attentionFeed';
import { parseRequestingRole } from '@/services/visibility';
import { errorResponse } from '@/lib/apiError';
import { AppError, AttentionFeedLoadError } from '@/lib/errors';

// GET /api/cases/:id/attention-feed — the Trial Command Center "Needs your
// attention" feed (F8; FRD F08-trial-command-center-screen.md §Process step 4).
// A thin delegation over getAttentionFeed, same shape as the activity /
// custody-by-custodian routes: parse the requesting role from X-User-Role (fails
// CLOSED to ATTORNEY), call the service, map errors to the common envelope.
//
// On any underlying failure this surfaces ATTENTION_FEED_LOAD_FAILED — the NEW
// code this endpoint introduces, per F08 §Error States.
//
//   200 → AttentionFeedEntry[] (CRITICAL→HIGH→PENDING→MEDIUM, newest-first within tier)
//   500 → ATTENTION_FEED_LOAD_FAILED  (any underlying query failure)
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id: caseId } = await context.params;
    const requestingUserRole = parseRequestingRole(request);
    const feed = await getAttentionFeed(caseId, requestingUserRole);
    return NextResponse.json(feed, { status: 200 });
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err);
    }
    return errorResponse(new AttentionFeedLoadError());
  }
}
