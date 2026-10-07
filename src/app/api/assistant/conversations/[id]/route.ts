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
