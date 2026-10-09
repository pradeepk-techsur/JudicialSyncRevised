import { NextResponse, type NextRequest } from 'next/server';
import { getCustodyByCustodian } from '@/services/custodyByCustodian';
import { parseRequestingRole } from '@/services/visibility';
import { errorResponse } from '@/lib/apiError';
import { AppError, CommandCenterLoadError } from '@/lib/errors';

// GET /api/cases/:id/custody-by-custodian — the Trial Command Center "Custody at
// a Glance" panel (F8; FRD F08-trial-command-center-screen.md §Process step 3).
// A thin delegation over getCustodyByCustodian, mirroring the activity route:
// parse the requesting role from X-User-Role (fails CLOSED to ATTORNEY), call
// the service, map errors to the common envelope.
//
// On any underlying failure this surfaces the EXISTING COMMAND_CENTER_LOAD_FAILED
// code (per F08 §Error States: "same code, no new code introduced for this
// panel") — it does NOT introduce a custody-specific error code.
//
//   200 → CustodyByCustodianResult
//   500 → COMMAND_CENTER_LOAD_FAILED  (any underlying query failure)
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id: caseId } = await context.params;
    const requestingUserRole = parseRequestingRole(request);
    const result = await getCustodyByCustodian(caseId, requestingUserRole);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err);
    }
    return errorResponse(new CommandCenterLoadError());
  }
}
