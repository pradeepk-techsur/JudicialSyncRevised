import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getJuryPackageReadinessPreview } from '@/services/juryPackage';
import { parseRequestingRole } from '@/services/visibility';
import { errorResponse } from '@/lib/apiError';
import { AppError, JuryPackagePreviewLoadError, NotFoundError } from '@/lib/errors';

// GET /api/cases/:id/jury-package/preview — the read-only Jury Package Readiness
// Preview (F25). A thin delegation over getJuryPackageReadinessPreview, mirroring
// the attention-feed route's error-handling shape exactly: parse the requesting
// role from X-User-Role (fails CLOSED to ATTORNEY), guard case existence (404),
// call the service, map errors to the common envelope.
//
// NO role gate exists on this route by design (F25 §Validation): every role —
// JUDGE, CHAMBERS_STAFF, ATTORNEY, DEPUTY, CLERK, ADMIN — receives the identical
// 200 response shape for a valid caseId; there is no 403 path here (unlike every
// other jury-package endpoint). `requestingUserRole` applies only standard
// sealed-exhibit visibility masking inside the service.
//
// On any underlying computation failure this surfaces
// JURY_PACKAGE_PREVIEW_LOAD_FAILED — the code this endpoint introduces, per F25
// §Error States.
//
//   200 → { preview, summary }
//   404 → CASE_NOT_FOUND                     (unknown case id)
//   500 → JURY_PACKAGE_PREVIEW_LOAD_FAILED   (any underlying query failure)
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id: caseId } = await context.params;

    const kase = await prisma.case.findUnique({ where: { id: caseId }, select: { id: true } });
    if (!kase) {
      throw new NotFoundError('CASE_NOT_FOUND', 'No case found with the given ID');
    }

    const requestingUserRole = parseRequestingRole(request);
    const result = await getJuryPackageReadinessPreview(caseId, requestingUserRole);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err);
    }
    return errorResponse(new JuryPackagePreviewLoadError());
  }
}
