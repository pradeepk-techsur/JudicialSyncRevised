import { randomUUID } from 'node:crypto';
import type { ExhibitEvent, ObjectionCurrentState } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError, NotFoundError, ValidationError } from '@/lib/errors';
import { recordEvent } from '@/services/events';

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

  // 2. The exhibit must currently be OFFERED or OBJECTED. An exhibit with no
  //    ExhibitCurrentState row (never offered — still only MARKED or
  //    unrecorded) or one in a terminal status cannot be objected to.
  const currentState = await prisma.exhibitCurrentState.findUnique({
    where: { exhibitId },
    select: { currentStatus: true },
  });
  if (!currentState || !OBJECTABLE_STATUSES.has(currentState.currentStatus)) {
    throw new InvalidObjectionTargetError();
  }

  // 3. Generate the thread id shared by this raise event and its future ruling.
  const objectionId = randomUUID();

  // 4. Append the ledger event (sole writer), then 5. create the projection row.
  const event = await recordEvent({
    exhibitId,
    eventType: 'OBJECTION_RAISED',
    payload: { objectionId, objectingParty, grounds },
    actorUserId,
  });

  const objectionState = await prisma.objectionCurrentState.create({
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

  // 1. The referenced thread must exist and currently be UNRESOLVED.
  const objectionState = await prisma.objectionCurrentState.findUnique({
    where: { objectionId },
  });
  if (!objectionState) {
    throw new NotFoundError('OBJECTION_NOT_FOUND', 'No objection found with the given ID');
  }
  if (objectionState.status !== 'UNRESOLVED') {
    throw new ObjectionAlreadyResolvedError();
  }

  // 2. Server-side role check against the ACTUAL User.role column (never a
  //    client claim) — T-01-11, the highest-value check in this plan. Required
  //    for every disposition, RESERVED included.
  const actor = await prisma.user.findUnique({
    where: { id: actorUserId },
    select: { role: true },
  });
  if (!actor || actor.role !== 'JUDGE') {
    throw new RoleNotPermittedError();
  }

  // 3. Append the RULING_RECORDED ledger event (sole writer) first.
  const event = await recordEvent({
    exhibitId: objectionState.exhibitId,
    eventType: 'RULING_RECORDED',
    payload: { objectionId, disposition },
    actorUserId,
  });

  // 4/5. SUSTAINED/OVERRULED close the thread; RESERVED leaves it UNRESOLVED and
  //      does NOT set rulingEventId/ruledAt (F02 §Process step 7). The ledger
  //      event above is the durable record of the reservation for timeline/
  //      history (F10) and keeps the thread counting as unresolved for F6.
  if (disposition === 'RESERVED') {
    return { event, objectionState };
  }

  const updated = await prisma.objectionCurrentState.update({
    where: { objectionId },
    data: {
      status: disposition,
      rulingEventId: event.id,
      ruledAt: event.recordedAt,
    },
  });

  return { event, objectionState: updated };
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
