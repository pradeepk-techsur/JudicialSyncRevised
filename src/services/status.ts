import type { ExhibitCurrentState, ExhibitEvent, ExhibitStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AdmissionBlockedError, ConflictError, UnprocessableError } from '@/lib/errors';
import { advisoryLockKey } from '@/lib/advisoryLock';
import { recordEvent } from '@/services/events';
import { evaluateDiscrepancies } from '@/services/discrepancies';

// Admission-lifecycle status state machine (FRD F01).
//
// Status is NEVER a mutable field: every transition is a STATUS_CHANGE event
// appended through recordEvent() (the single ledger writer, Plan 2), and the
// derived ExhibitCurrentState projection is updated inside the SAME transaction
// so the ledger and the projection can never diverge. getExhibitStatus reads the
// projection only — every consumer (UI, assistant) sees exactly the same value.

/**
 * Allowed forward transitions keyed by the exhibit's current status. `NONE` is a
 * sentinel for "no prior STATUS_CHANGE event" — the only legal first transition
 * is to MARKED. ADMITTED / EXCLUDED / WITHDRAWN are terminal (empty arrays): any
 * further transition is rejected (STATUS_FINALIZED). FRD F01 §Allowed Transitions.
 */
export const ALLOWED_TRANSITIONS: Record<string, ExhibitStatus[]> = {
  NONE: ['MARKED'], // sentinel for "no prior STATUS_CHANGE event"
  MARKED: ['OFFERED'],
  OFFERED: ['OBJECTED', 'ADMITTED', 'WITHDRAWN'],
  OBJECTED: ['ADMITTED', 'EXCLUDED', 'WITHDRAWN'],
  ADMITTED: [], // terminal
  EXCLUDED: [], // terminal
  WITHDRAWN: [], // terminal
};

const TERMINAL_STATUSES = new Set<string>(['ADMITTED', 'EXCLUDED', 'WITHDRAWN']);

export async function recordStatusChange(args: {
  exhibitId: string;
  toStatus: ExhibitStatus;
  actorUserId: string;
  notes?: string;
}): Promise<{ event: ExhibitEvent; currentState: ExhibitCurrentState }> {
  const { exhibitId, toStatus, actorUserId, notes } = args;

  try {
    return await prisma.$transaction(async (tx) => {
      // 1. Serialize concurrent writers for this exhibit. The lock is held until
      //    the transaction commits/rolls back, so the read-check-write sequence
      //    below is atomic against other status-change transactions. Works on the
      //    first-ever transition (no current-state row to row-lock).
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${advisoryLockKey(exhibitId)})`;

      // 2. Read current status inside the locked transaction.
      const currentState = await tx.exhibitCurrentState.findUnique({
        where: { exhibitId },
      });
      const fromStatus: string = currentState?.currentStatus ?? 'NONE';

      // 3. Terminal state rejects any further change, regardless of toStatus.
      if (TERMINAL_STATUSES.has(fromStatus)) {
        throw new ConflictError(
          'STATUS_FINALIZED',
          'Exhibit status is final and cannot be changed',
        );
      }

      // 4. The requested transition must be allowed from the current status.
      const allowed = ALLOWED_TRANSITIONS[fromStatus] ?? [];
      if (!allowed.includes(toStatus)) {
        throw new UnprocessableError(
          'INVALID_STATUS_TRANSITION',
          `Cannot transition from ${fromStatus} to ${toStatus}`,
        );
      }

      // 5. OBJECTED is only reachable while an unresolved objection exists.
      if (toStatus === 'OBJECTED') {
        const unresolved = await tx.objectionCurrentState.count({
          where: { exhibitId, status: 'UNRESOLVED' },
        });
        if (unresolved === 0) {
          throw new UnprocessableError(
            'INVALID_STATUS_TRANSITION',
            `Cannot transition from ${fromStatus} to OBJECTED: no unresolved objection exists for this exhibit`,
          );
        }
      }

      // 5b. F12 — Admission Integrity Gate. Runs ONLY for toStatus === 'ADMITTED',
      //     AFTER the fromStatus-match check (unchanged F1 behavior takes priority),
      //     BEFORE recordEvent() — so a blocked admission writes NOTHING, not even a
      //     partial projection update. The two projection reads run on the SAME `tx`
      //     client already holding this exhibit's advisory lock, so they are
      //     serialized against concurrent custody/ruling transactions (no race
      //     between the gate's read and the ledger write). No force-admit parameter
      //     or alternate code path bypasses this; every caller (UI routes, the seed
      //     loader) goes through recordStatusChange, so every caller is subject to it.
      if (toStatus === 'ADMITTED') {
        const [unresolvedObjectionCount, custody] = await Promise.all([
          tx.objectionCurrentState.count({ where: { exhibitId, status: 'UNRESOLVED' } }),
          tx.custodyCurrentState.findUnique({ where: { exhibitId }, select: { exhibitId: true } }),
        ]);
        const reasons: Array<{ code: 'UNRESOLVED_OBJECTION' | 'NO_CUSTODIAN'; message: string }> = [];
        if (unresolvedObjectionCount > 0) {
          reasons.push({
            code: 'UNRESOLVED_OBJECTION',
            message: 'This exhibit has an unresolved objection',
          });
        }
        if (!custody) {
          reasons.push({
            code: 'NO_CUSTODIAN',
            message: 'This exhibit has no custodian of record',
          });
        }
        if (reasons.length > 0) {
          throw new AdmissionBlockedError(reasons);
        }
      }

      // 6. Append the STATUS_CHANGE event through the single ledger writer. Pass
      //    the same transaction client so the ledger write and the projection
      //    upsert (step 7) commit or roll back together.
      const event = await recordEvent(
        {
          exhibitId,
          eventType: 'STATUS_CHANGE',
          payload: {
            fromStatus: fromStatus === 'NONE' ? null : (fromStatus as ExhibitStatus),
            toStatus,
            notes,
          },
          actorUserId,
        },
        tx,
      );

      // 7. Upsert the derived projection, atomically with the ledger write.
      const nextState = await tx.exhibitCurrentState.upsert({
        where: { exhibitId },
        create: {
          exhibitId,
          currentStatus: toStatus,
          lastStatusEventId: event.id,
          lastStatusAt: event.recordedAt,
        },
        update: {
          currentStatus: toStatus,
          lastStatusEventId: event.id,
          lastStatusAt: event.recordedAt,
        },
      });

      // 8. Re-evaluate discrepancy rules SYNCHRONOUSLY, inside the same
      //    transaction, so a flag appears/clears in the SAME write that changed
      //    the status (Y3 §Internal Triggers — never on page load). A transition
      //    into ADMITTED can fire ADMITTED_NO_CUSTODIAN and/or
      //    UNRESOLVED_OBJECTION_JURY_ELIGIBLE; the call is unconditional for
      //    correctness. The just-recorded event id attributes any resolution.
      await evaluateDiscrepancies(exhibitId, tx, event.id);

      return { event, currentState: nextState };
    });
  } catch (err) {
    // A serialization failure / deadlock surfaces as a retryable conflict, not a
    // 500 — the caller refetches and retries (Y2-errors.md STATUS_CONFLICT).
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      (err.code === 'P2034' /* write conflict / deadlock, retry */ ||
        err.code === 'P2028') /* transaction API error / timeout */
    ) {
      throw new ConflictError(
        'STATUS_CONFLICT',
        'Exhibit status has changed since this view was loaded — refresh and retry',
      );
    }
    throw err;
  }
}

export async function getExhibitStatus(
  exhibitId: string,
): Promise<ExhibitCurrentState | null> {
  // Plain projection read. Returns null when the exhibit has zero STATUS_CHANGE
  // events — per F00 §Outputs, that is "not yet entered into evidence", NOT an
  // error; the route layer decides 200-vs-404 by also checking exhibit existence.
  return prisma.exhibitCurrentState.findUnique({ where: { exhibitId } });
}
