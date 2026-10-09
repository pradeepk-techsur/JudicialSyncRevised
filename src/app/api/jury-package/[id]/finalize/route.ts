import { NextResponse, type NextRequest } from 'next/server';
import { finalizeJuryPackage } from '@/services/juryPackage';
import { ValidationError } from '@/lib/errors';
import { errorResponse } from '@/lib/apiError';

// POST /api/jury-package/:id/finalize — finalize a DRAFT jury package (F5). The
// hard gate is re-evaluated FRESH over MEMBERSHIP inside finalizeJuryPackage
// (including sealed exhibits the acting user cannot see), enforcing two
// server-authority blocks: (F13) a retained sealed/ex parte INCLUDED member →
// ConflictError('JURY_PACKAGE_SEALED_EXHIBIT_PRESENT', ..., { sealedExhibits })
// so the client can surface "remove ex parte material first"; and an unresolved
// OPEN discrepancy → ConflictError('JURY_PACKAGE_DISCREPANCIES_OPEN', ...,
// { blockingExhibits }). errorResponse surfaces each list under `error.details`
// so the client can name the blockers (ROADMAP criterion 3).
// JURY_PACKAGE_ALREADY_FINALIZED 409 / ROLE_NOT_PERMITTED 403 /
// JURY_PACKAGE_NOT_FOUND 404 all map via errorResponse.
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await context.params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError('Request body must be valid JSON');
    }

    const { actorUserId, acknowledgedDiscrepancyIds } = (body ?? {}) as {
      actorUserId?: unknown;
      acknowledgedDiscrepancyIds?: unknown;
    };

    if (typeof actorUserId !== 'string' || actorUserId.length === 0) {
      throw new ValidationError('actorUserId must be a non-empty string');
    }
    if (
      acknowledgedDiscrepancyIds !== undefined &&
      !(
        Array.isArray(acknowledgedDiscrepancyIds) &&
        acknowledgedDiscrepancyIds.every((v) => typeof v === 'string')
      )
    ) {
      throw new ValidationError('acknowledgedDiscrepancyIds must be an array of strings when provided');
    }

    const result = await finalizeJuryPackage(
      id,
      actorUserId,
      acknowledgedDiscrepancyIds as string[] | undefined,
    );
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return errorResponse(err);
  }
}
