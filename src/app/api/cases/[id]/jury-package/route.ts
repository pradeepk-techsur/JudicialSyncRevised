import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getJuryPackage, initiateJuryPackage } from '@/services/juryPackage';
import { parseRequestingRole } from '@/services/visibility';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { errorResponse } from '@/lib/apiError';

// GET /api/cases/:id/jury-package — READ-ONLY (F5/F11). Returns the current
// jury-package state: `{ juryPackage, exhibits }`, where juryPackage is null when
// none has been initiated (the "no package yet" state). The service enforces that
// this never creates a package as a side effect (ROADMAP criterion 5); the route
// just delegates. Unknown case id → 404 CASE_NOT_FOUND.
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await context.params;

    const kase = await prisma.case.findUnique({ where: { id }, select: { id: true } });
    if (!kase) {
      throw new NotFoundError('CASE_NOT_FOUND', 'No case found with the given ID');
    }

    const requestingUserRole = parseRequestingRole(request);
    const result = await getJuryPackage(id, requestingUserRole);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return errorResponse(err);
  }
}

// POST /api/cases/:id/jury-package — initiate (or idempotently reuse) a DRAFT
// jury package (F5). Authorization for the write is resolved from the actor's
// ACTUAL User.role inside initiateJuryPackage (never the client header);
// requestingUserRole is passed ONLY to role-filter the returned VIEW — membership
// stays full-visibility. 201 `{ juryPackage, exhibits }`. NO_ELIGIBLE_EXHIBITS
// 422 / ROLE_NOT_PERMITTED 403 via errorResponse.
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

    const { actorUserId } = (body ?? {}) as { actorUserId?: unknown };
    if (typeof actorUserId !== 'string' || actorUserId.length === 0) {
      throw new ValidationError('actorUserId must be a non-empty string');
    }

    const requestingUserRole = parseRequestingRole(request);
    const result = await initiateJuryPackage(id, actorUserId, requestingUserRole);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
