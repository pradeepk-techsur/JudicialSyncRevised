import { NextResponse, type NextRequest } from 'next/server';
import type { DiscrepancyFlag } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getDiscrepancies } from '@/services/discrepancies';
import { parseRequestingRole } from '@/services/visibility';
import { NotFoundError } from '@/lib/errors';
import { errorResponse } from '@/lib/apiError';

// Serialize a DiscrepancyFlag row to the TechArch 03-api.md DiscrepancyFlag shape
// (dates → ISO strings). Shared by the case- and exhibit-scoped routes so the two
// can never drift.
export function toDiscrepancyFlagDto(flag: DiscrepancyFlag & { justification?: string }) {
  return {
    id: flag.id,
    caseId: flag.caseId,
    exhibitId: flag.exhibitId,
    ruleCode: flag.ruleCode,
    status: flag.status,
    detectedAt: flag.detectedAt.toISOString(),
    details: flag.details,
    acknowledgedAt: flag.acknowledgedAt ? flag.acknowledgedAt.toISOString() : null,
    acknowledgedBy: flag.acknowledgedBy ?? null,
    resolvedAt: flag.resolvedAt ? flag.resolvedAt.toISOString() : null,
    // F14: the acknowledging justification text, surfaced inline on the Exhibit
    // Detail banner and Jury Package Workspace. Only present for ACKNOWLEDGED
    // flags (null when the read-time join found no payload text); undefined for
    // OPEN flags so the wire shape omits it entirely.
    justification: flag.status === 'ACKNOWLEDGED' ? (flag.justification ?? null) : undefined,
  };
}

// GET /api/cases/:id/discrepancies — all active (OPEN+ACKNOWLEDGED) discrepancy
// flags case-wide (F6). Consumed by the sidebar count badge and the jury screen.
// Unknown case id → 404 CASE_NOT_FOUND.
//
// Sealed-aware like its sibling read paths (threat T-03-09): the requesting role
// is parsed from X-User-Role and passed to getDiscrepancies, which excludes
// flags on sealed exhibits for roles that cannot view sealed — so the count pill
// / jury feed never disclose a sealed exhibit's existence or defect.
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const requestingUserRole = parseRequestingRole(request);

    const kase = await prisma.case.findUnique({ where: { id }, select: { id: true } });
    if (!kase) {
      throw new NotFoundError('CASE_NOT_FOUND', 'No case found with the given ID');
    }

    const flags = await getDiscrepancies(id, requestingUserRole);
    return NextResponse.json(flags.map(toDiscrepancyFlagDto), { status: 200 });
  } catch (err) {
    return errorResponse(err);
  }
}
