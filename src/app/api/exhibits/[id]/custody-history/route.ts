import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCustodyHistory } from '@/services/custody';
import { NotFoundError } from '@/lib/errors';
import { errorResponse } from '@/lib/apiError';

// GET /api/exhibits/:id/custody-history — full ordered chain-of-custody (F3, Y1-api.md §Custody).
// Returns the complete chronological chain reconstructed from the ledger (empty
// array for a custody gap). The exhibit must exist, otherwise 404 EXHIBIT_NOT_FOUND.
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await context.params;

    const exhibit = await prisma.exhibit.findUnique({ where: { id }, select: { id: true } });
    if (!exhibit) {
      throw new NotFoundError('EXHIBIT_NOT_FOUND', 'No exhibit found with the given ID');
    }

    const history = await getCustodyHistory(id);
    return NextResponse.json(history, { status: 200 });
  } catch (err) {
    return errorResponse(err);
  }
}
