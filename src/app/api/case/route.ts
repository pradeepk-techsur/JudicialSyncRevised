import { NextResponse } from 'next/server';
import { getActiveCaseWithUsers } from '@/services/cases';
import { NotFoundError } from '@/lib/errors';
import { errorResponse } from '@/lib/apiError';

// GET /api/case — the app shell's bootstrap call (single-case demo scope).
// Resolves the active case's id (for every /api/cases/:id/... call) and its
// seeded persona roster (for the role switcher). No role-based visibility
// applies — user identity rows are not sealed-exhibit-gated content.
export async function GET(): Promise<NextResponse> {
  try {
    const result = await getActiveCaseWithUsers();
    if (!result) {
      throw new NotFoundError('CASE_NOT_FOUND', 'No case found with the given ID');
    }
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return errorResponse(err);
  }
}
