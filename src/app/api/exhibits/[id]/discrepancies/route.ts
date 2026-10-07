import { NextResponse, type NextRequest } from 'next/server';
import { getExhibit } from '@/services/exhibits';
import { getExhibitDiscrepancies } from '@/services/discrepancies';
import { parseRequestingRole } from '@/services/visibility';
import { NotFoundError } from '@/lib/errors';
import { errorResponse } from '@/lib/apiError';
import { toDiscrepancyFlagDto } from '@/app/api/cases/[id]/discrepancies/route';

// GET /api/exhibits/:id/discrepancies — active (OPEN+ACKNOWLEDGED) discrepancy
// flags for one exhibit (F6).
//
// Anti-enumeration (threat T-03-08): call getExhibit(id, role) FIRST; a missing
// exhibit AND a sealed exhibit read by an unauthorized role both return a
// byte-identical 404 EXHIBIT_NOT_FOUND, mirroring the history route guard. Only
// an authorized read reaches getExhibitDiscrepancies.
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const requestingUserRole = parseRequestingRole(request);

    const exhibit = await getExhibit(id, requestingUserRole);
    if (!exhibit) {
      throw new NotFoundError('EXHIBIT_NOT_FOUND', 'No exhibit found with the given ID');
    }

    const flags = await getExhibitDiscrepancies(id);
    return NextResponse.json(flags.map(toDiscrepancyFlagDto), { status: 200 });
  } catch (err) {
    return errorResponse(err);
  }
}
