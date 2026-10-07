import { randomUUID } from 'node:crypto';
import type { ExhibitEvent, ObjectionCurrentState } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError, NotFoundError, ValidationError } from '@/lib/errors';
import { recordEvent } from '@/services/events';
import { evaluateDiscrepancies } from '@/services/discrepancies';
import { advisoryLockKey } from '@/lib/advisoryLock';

// F2 — Objection and Ruling Tracking.
//
// Objection threads are tracked as INDEPENDENT, per-thread lifecycles (one
// ObjectionCurrentState row per `objectionId`), never collapsed into a single
// exhibit-level "last ruling" field. A single exhibit may therefore carry N
// concurrently-open UNRESOLVED threads — every query here is written to assume
// many, never at-most-one (FRD F02 §Validation).
//
// Ledger invariant: every state change is written through recordEvent() (the
// sole append-only ExhibitEvent writer from Plan 2) BEFORE the derived
// ObjectionCurrentState projection row is created/updated. The projection is
// rebuildable by replaying OBJECTION_RAISED / RULING_RECORDED events grouped by
// payload.objectionId (see schema.prisma §ObjectionCurrentState), so the ledger
// write is the source of truth and the projection write follows it.

/** 422 — INVALID_OBJECTION_TARGET (Y2-errors.md F2). */
class InvalidObjectionTargetError extends AppError {
  constructor() {
    super(
      'INVALID_OBJECTION_TARGET',
      'Cannot raise an objection before the exhibit is offered',
      422,
    );
  }
}

/** 409 — OBJECTION_ALREADY_RESOLVED (Y2-errors.md F2). */
class ObjectionAlreadyResolvedError extends AppError {
  constructor() {
    super(
      'OBJECTION_ALREADY_RESOLVED',
      'This objection has already been ruled on',
      409,
    );
  }
}

// 403 — ROLE_NOT_PERMITTED.
//
// Judge-gating scope (plan 01-04 must_haves + threat model T-01-11): EVERY
// disposition — SUSTAINED, OVERRULED, AND RESERVED — requires the acting user to
// hold role JUDGE. This plan deliberately tightens the FRD's baseline (which
// names only SUSTAINED/OVERRULED): reserving a ruling is itself a judicial act,
// not a clerical log entry a deputy/clerk may enter on the judge's behalf, so
// there is NO exception for RESERVED. The message is the catalog's
// action-specific variant for ruling-recording (Y2-errors.md §Objection line 30
// / §Authorization notes: "feature-specific variants").
class RoleNotPermittedError extends AppError {
  constructor() {
    super(
      'ROLE_NOT_PERMITTED',
      'Only a judge may record a ruling on an objection',
      403,
    );
  }
}

const OBJECTABLE_STATUSES = new Set(['OFFERED', 'OBJECTED']);

/**
 * Raise an objection against an exhibit, creating a new independent objection
 * thread. Writes an OBJECTION_RAISED ledger event, then its UNRESOLVED
 * ObjectionCurrentState projection row.
 */
export async function recordObjection(args: {
  exhibitId: string;
  objectingParty: 'PLAINTIFF' | 'PROSECUTION' | 'DEFENSE';
  grounds: string;
  actorUserId: string;
}): Promise<{ event: ExhibitEvent; objectionState: ObjectionCurrentState }> {
  const { exhibitId, objectingParty, grounds, actorUserId } = args;

  // 1. grounds must be non-empty (F02 §Validation).
  if (!grounds || grounds.trim().length === 0) {
    throw new ValidationError('grounds must be a non-empty string');
  }

  // 2. The exhibit must exist (404 EXHIBIT_NOT_FOUND per Y1-api.md §Objections)
  //    — distinct from "exists but is in a non-objectable status" (422 below).
  const exhibit = await prisma.exhibit.findUnique({
    where: { id: exhibitId },
    select: { id: true },
  });
  if (!exhibit) {
    throw new NotFoundError('EXHIBIT_NOT_FOUND', 'No exhibit found with the given ID');
  }

  // 4. Generate the thread id shared by this raise event and its future ruling.
  const objectionId = randomUUID();

  // 5. Append the ledger event (sole writer) and 6. create the projection row
  //    in the SAME transaction — passing the tx client into recordEvent so the
  //    OBJECTION_RAISED event and its ObjectionCurrentState row commit or roll
  //    back together. A crash between the two can no longer leave a ledger event
  //    with no projection row (invisible to getUnresolvedObjections) — mirrors
  //    status.ts / custody.ts.
  return prisma.$transaction(async (tx) => {
    // Serialize all writers for this exhibit on the shared per-exhibit advisory
    // lock (status / custody / ruling all contend on the same key), so the
    // status re-check below and any future flag evaluation observe a consistent
    // projection against concurrent rulings — W1.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${advisoryLockKey(exhibitId)})`;

    // 3. The exhibit must currently be OFFERED or OBJECTED, re-checked inside the
    //    lock. An exhibit with no ExhibitCurrentState row (never offered — still
    //    only MARKED) or one in a terminal status cannot be objected to.
    const currentState = await tx.exhibitCurrentState.findUnique({
      where: { exhibitId },
      select: { currentStatus: true },
    });
    if (!currentState || !OBJECTABLE_STATUSES.has(currentState.currentStatus)) {
      throw new InvalidObjectionTargetError();
    }

    const event = await recordEvent(
      {
        exhibitId,
        eventType: 'OBJECTION_RAISED',
        payload: { objectionId, objectingParty, grounds },
        actorUserId,
      },
      tx,
    );

    const objectionState = await tx.objectionCurrentState.create({
      data: {
        objectionId,
        exhibitId,
        status: 'UNRESOLVED',
        objectingParty,
        grounds,
        raisedEventId: event.id,
        raisedAt: event.recordedAt,
      },
    });

    return { event, objectionState };
  });
}

/**
 * Record a judicial ruling against a specific objection thread. Judge-gated for
 * ALL dispositions including RESERVED. SUSTAINED/OVERRULED resolve the thread;
 * RESERVED writes the ledger event but keeps the thread UNRESOLVED.
 */
export async function recordRuling(args: {
  objectionId: string;
  disposition: 'SUSTAINED' | 'OVERRULED' | 'RESERVED';
  actorUserId: string;
}): Promise<{ event: ExhibitEvent; objectionState: ObjectionCurrentState }> {
  const { objectionId, disposition, actorUserId } = args;

  // Resolve the thread's exhibitId first so we can serialize all ruling writers
  // for that exhibit on the same per-exhibit advisory lock the status/custody
  // paths use. Without this, two concurrent rulings on the same exhibit could
  // both reach evaluateDiscrepancies, both observe no existing flag, and both
  // insert a duplicate OPEN flag (the engine's find-then-create has no DB
  // uniqueness backstop) — W1.
  const thread = await prisma.objectionCurrentState.findUnique({
    where: { objectionId },
    select: { exhibitId: true },
  });
  if (!thread) {
    throw new NotFoundError('OBJECTION_NOT_FOUND', 'No objection found with the given ID');
  }

  // Server-side role check against the ACTUAL User.role column (never a client
  // claim) — T-01-11, the highest-value check in this plan. Required for every
  // disposition, RESERVED included. Checked before the lock so an unauthorized
  // caller never contends on it.
  const actor = await prisma.user.findUnique({
    where: { id: actorUserId },
    select: { role: true },
  });
  if (!actor || actor.role !== 'JUDGE') {
    throw new RoleNotPermittedError();
  }

  return prisma.$transaction(async (tx) => {
    // 1. Serialize concurrent ruling writers for this exhibit (mirrors
    //    status.ts / custody.ts). Held until commit/rollback, so the
    //    read-check-write + evaluateDiscrepancies sequence below is atomic
    //    against other ruling/status/custody transactions on the same exhibit.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${advisoryLockKey(thread.exhibitId)})`;

    // 2. Re-read the thread INSIDE the lock: it must exist and be UNRESOLVED.
    const objectionState = await tx.objectionCurrentState.findUnique({
      where: { objectionId },
    });
    if (!objectionState) {
      throw new NotFoundError('OBJECTION_NOT_FOUND', 'No objection found with the given ID');
    }
    if (objectionState.status !== 'UNRESOLVED') {
      throw new ObjectionAlreadyResolvedError();
    }

    // 3. Append the RULING_RECORDED ledger event (sole writer) and apply the
    //    projection update in the SAME transaction — passing the tx client into
    //    recordEvent so the ledger event and the ObjectionCurrentState change
    //    commit or roll back together.
    const event = await recordEvent(
      {
        exhibitId: objectionState.exhibitId,
        eventType: 'RULING_RECORDED',
        payload: { objectionId, disposition },
        actorUserId,
      },
      tx,
    );

    // 4/5. SUSTAINED/OVERRULED close the thread; RESERVED leaves it UNRESOLVED
    //      and does NOT set rulingEventId/ruledAt (F02 §Process step 7). The
    //      ledger event above is the durable record of the reservation for
    //      timeline/history (F10) and keeps the thread counting as unresolved
    //      for F6. Either way we recompute the current state THEN re-evaluate
    //      discrepancies before returning, so the UNRESOLVED_OBJECTION rule
    //      sees the up-to-date projection in the SAME transaction.
    const nextState =
      disposition === 'RESERVED'
        ? objectionState
        : await tx.objectionCurrentState.update({
            where: { objectionId },
            data: {
              status: disposition,
              rulingEventId: event.id,
              ruledAt: event.recordedAt,
            },
          });

    // Resolving the LAST unresolved thread of an ADMITTED exhibit clears
    // UNRESOLVED_OBJECTION_JURY_ELIGIBLE; RESERVED keeps it (no-op). Runs for
    // both branches (Y3 §Internal Triggers), attributing to the ruling event.
    await evaluateDiscrepancies(objectionState.exhibitId, tx, event.id);

    return { event, objectionState: nextState };
  });
}

/**
 * Case-wide unresolved-objections query. This is THE single shared function
 * every future caller uses identically (Case Workspace F9, Command Center F8,
 * assistant tool F7) — there is deliberately no caller-specific variant, so the
 * "unresolved" definition can never drift between consumers.
 */
export async function getUnresolvedObjections(
  caseId: string,
): Promise<ObjectionCurrentState[]> {
  return prisma.objectionCurrentState.findMany({
    where: { status: 'UNRESOLVED', exhibit: { caseId } },
    orderBy: { raisedAt: 'asc' },
  });
}
