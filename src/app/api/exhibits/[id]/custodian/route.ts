import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCustodian } from '@/services/custody';
import { NotFoundError } from '@/lib/errors';
import { errorResponse } from '@/lib/apiError';

// GET /api/exhibits/:id/custodian — current custodian only (F3, Y1-api.md §Custody).
//
// A custody gap (no CUSTODY_TRANSFER event ever recorded) is a VALID, distinct,
// non-error state: the route returns 200 with an explicit `{ custodian: null }`
// shape rather than a blank body or an empty-object ambiguity. The exhibit itself
// must exist, otherwise 404 EXHIBIT_NOT_FOUND — this distinguishes "exhibit has
// no custodian of record yet" (200, custodian: null) from "no such exhibit" (404).
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

    const custodian = await getCustodian(id);
    return NextResponse.json({ custodian }, { status: 200 });
  } catch (err) {
    return errorResponse(err);
  }
}
