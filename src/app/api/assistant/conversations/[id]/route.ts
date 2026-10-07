import { NextResponse } from 'next/server';
import { getConversationDetail } from '@/services/assistant';
import { errorResponse } from '@/lib/apiError';

// GET /api/assistant/conversations/:id — replay a full assistant conversation
// thread (F7). Thin wrapper over getConversationDetail: returns 200 with
// { conversation, messages:[{ id, role, content, createdAt, citations[] }] },
// each citation carrying the additive exhibitId/eventId link fields so a replayed
// pill deep-links exactly like a fresh-stream one. A missing id maps to 404
// CONVERSATION_NOT_FOUND via the typed NotFoundError → errorResponse. Follows the
// Next 16 async-params convention used by the exhibit routes.
//
// INTENTIONALLY UNAUTHENTICATED AT READ TIME (W4). This route deliberately does
// NOT read X-User-Role or apply an ownership/visibility filter, and that is by
// design, not an oversight:
//   - The demo has NO per-user auth layer anywhere; every route trusts the
//     X-User-Role header. There is no identity to scope a thread to.
//   - Sealed-exhibit visibility is enforced at PERSIST time: the chat route
//     extracts citations under the turn's requesting role, so a sealed record a
//     role could not see never entered this thread's content. Replaying the
//     stored thread therefore cannot retroactively expose anything that was
//     hidden when the turn ran — the content is a durable audit record composed
//     under the original role's scope.
// If audit threads are ever made role-scoped at READ time (a new requirement, not
// in F7's scope), this is the single place to add the role/ownership check.
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const detail = await getConversationDetail(id);
    return NextResponse.json(detail, { status: 200 });
  } catch (err) {
    return errorResponse(err);
  }
}
