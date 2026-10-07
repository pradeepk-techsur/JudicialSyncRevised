import type { CustodyCurrentState, ExhibitEvent } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError, NotFoundError, ValidationError } from '@/lib/errors';
import { recordEvent } from '@/services/events';

// Chain-of-custody tracking (FRD F03).
//
// Custody is derived, never stored as a mutable "current holder" field: every
// transfer is a discrete immutable CUSTODY_TRANSFER ledger event (written via
// recordEvent — the single ledger writer), and CustodyCurrentState is a
// projection kept in step with the ledger. The current custodian is read from
// that projection; the full chain is reconstructed from the ordered ledger.
//
// The core invariant this feature exists to prove: a transfer "from" anyone who
// is not the exhibit's actual current custodian is refused outright
// (CUSTODY_CHAIN_BROKEN) — never silently reassigned, never partially applied.

/** 409 — the claimed `fromCustodian` does not match the exhibit's derived current custodian. */
export class CustodyChainBrokenError extends AppError {
  constructor() {
    super(
      'CUSTODY_CHAIN_BROKEN',
      "Recorded custodian does not match the exhibit's current custodian",
      409,
    );
  }
}

/** 422 — `toCustodianUserId` does not reference an existing, active user. */
export class InvalidCustodianError extends AppError {
  constructor() {
    super('INVALID_CUSTODIAN', 'toCustodianUserId does not reference a valid active user', 422);
  }
}

/** 422 — `fromCustodianUserId` and `toCustodianUserId` are identical (no-op). */
export class NoOpTransferError extends AppError {
  constructor() {
    super('NO_OP_TRANSFER', 'fromCustodianUserId and toCustodianUserId must differ', 422);
  }
}

export async function recordCustodyTransfer(args: {
  exhibitId: string;
  fromCustodianUserId: string | null;
  toCustodianUserId: string;
  reason?: string;
  actorUserId: string;
}): Promise<{ event: ExhibitEvent; custodyState: CustodyCurrentState }> {
  const { exhibitId, fromCustodianUserId, toCustodianUserId, reason, actorUserId } = args;

  // The exhibit must exist before anything else — routes map this to 404.
  const exhibit = await prisma.exhibit.findUnique({
    where: { id: exhibitId },
    select: { id: true },
  });
  if (!exhibit) {
    throw new NotFoundError('EXHIBIT_NOT_FOUND', 'No exhibit found with the given ID');
  }

  // 1. Read the exhibit's current derived custodian (null = custody gap / first transfer).
  const current = await prisma.custodyCurrentState.findUnique({ where: { exhibitId } });
  const currentCustodianUserId = current?.currentCustodianUserId ?? null;

  // 2. Chain validation — the invariant this feature exists to enforce. Strict
  //    equality against the actual current custodian; no fuzzy matching, no
  //    auto-correction. For the first-ever transfer, both must be null/absent.
  //    A mismatch is refused BEFORE any ledger write — the projection is left
  //    untouched.
  const claimedFrom = fromCustodianUserId ?? null;
  if (claimedFrom !== currentCustodianUserId) {
    throw new CustodyChainBrokenError();
  }

  // 3. No-op transfers are never valid, even when the chain would otherwise match.
  if (fromCustodianUserId !== null && fromCustodianUserId === toCustodianUserId) {
    throw new NoOpTransferError();
  }

  // 4. The target custodian must reference an existing, active user.
  const toUser = await prisma.user.findUnique({
    where: { id: toCustodianUserId },
    select: { isActive: true },
  });
  if (!toUser || !toUser.isActive) {
    throw new InvalidCustodianError();
  }

  // 5. Append the immutable ledger event (via the single ledger writer), then
  //    6. upsert the projection in the SAME transaction — the two can never drift.
  return prisma.$transaction(async (tx) => {
    const event = await recordEvent(
      {
        exhibitId,
        eventType: 'CUSTODY_TRANSFER',
        payload: { fromCustodianUserId, toCustodianUserId, reason },
        actorUserId,
      },
      tx,
    );

    const custodyState = await tx.custodyCurrentState.upsert({
      where: { exhibitId },
      create: {
        exhibitId,
        currentCustodianUserId: toCustodianUserId,
        since: event.recordedAt,
        lastEventId: event.id,
      },
      update: {
        currentCustodianUserId: toCustodianUserId,
        since: event.recordedAt,
        lastEventId: event.id,
      },
    });

    return { event, custodyState };
  });
}

export async function getCustodian(exhibitId: string): Promise<CustodyCurrentState | null> {
  // Returns null when no custody event has ever been recorded. Per F03
  // §Terminology "Custody Gap", this is a VALID, meaningful state — never an
  // error, never a backfilled placeholder row. The API layer maps it to an
  // explicit "no custodian of record" response.
  return prisma.custodyCurrentState.findUnique({ where: { exhibitId } });
}

export async function getCustodyHistory(exhibitId: string): Promise<
  Array<{
    fromCustodian: string | null;
    toCustodian: string;
    timestamp: Date;
    reason: string | null;
    eventId: string;
  }>
> {
  // The complete chain, reconstructed from the ledger in deterministic order —
  // no filtering, no truncation.
  const events = await prisma.exhibitEvent.findMany({
    where: { exhibitId, eventType: 'CUSTODY_TRANSFER' },
    orderBy: { sequenceNo: 'asc' },
  });

  return events.map((e) => {
    const payload = e.payload as {
      fromCustodianUserId: string | null;
      toCustodianUserId: string;
      reason?: string | null;
    };
    return {
      fromCustodian: payload.fromCustodianUserId ?? null,
      toCustodian: payload.toCustodianUserId,
      timestamp: e.recordedAt,
      reason: payload.reason ?? null,
      eventId: e.id,
    };
  });
}
