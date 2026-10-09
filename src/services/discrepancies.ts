import type { DiscrepancyFlag, ExhibitEvent, Prisma, PrismaClient, Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { NotFoundError, RoleNotPermittedError, UnprocessableError } from '@/lib/errors';
import { recordEvent } from '@/services/events';
import { canViewSealed } from '@/services/visibility';

// F6 — Discrepancy Identification (automatic cross-domain flagging).
//
// This engine reads the DERIVED PROJECTIONS only (ExhibitCurrentState,
// ObjectionCurrentState, CustodyCurrentState) — it NEVER scans exhibit_events
// (TechArch §3.8). It is called SYNCHRONOUSLY inside the status / ruling /
// custody write transactions (via the optional tx client, same PrismaLike
// pattern as recordEvent), so a flag appears or clears in the SAME service call
// that changed the exhibit's state — never on page load (Y3 §Internal Triggers).
//
// Acknowledgment is an auditable act: it can ONLY move OPEN→ACKNOWLEDGED by
// appending an immutable DISCREPANCY_ACKNOWLEDGED ledger event (through
// recordEvent, the single ledger writer) in the SAME transaction as the flag
// update — there is no code path that mutates flag.status to ACKNOWLEDGED
// without a corresponding ledger row (threat T-03-03/T-03-04).

// A Prisma client OR an interactive-transaction client — mirrors events.ts so
// callers can run evaluateDiscrepancies inside their own transaction.
type PrismaLike = PrismaClient | Prisma.TransactionClient;

/** Roles permitted to acknowledge a discrepancy (F6). */
const ACK_ALLOWED_ROLES = new Set(['DEPUTY', 'CLERK', 'JUDGE', 'ADMIN']);

/**
 * The rule registry. Each rule computes `fires` from the exhibit's projections;
 * `details` captures the mismatch snapshot stored on the flag at detection time.
 */
export const RULE_CODES = {
  ADMITTED_NO_CUSTODIAN: 'ADMITTED_NO_CUSTODIAN',
  UNRESOLVED_OBJECTION_JURY_ELIGIBLE: 'UNRESOLVED_OBJECTION_JURY_ELIGIBLE',
} as const;

export type RuleCode = (typeof RULE_CODES)[keyof typeof RULE_CODES];

interface ProjectionSnapshot {
  currentStatus: string | null;
  hasCustody: boolean;
  unresolvedObjectionCount: number;
}

interface RuleDefinition {
  code: RuleCode;
  fires: (s: ProjectionSnapshot) => boolean;
  details: (s: ProjectionSnapshot) => Record<string, unknown>;
}

const RULES: RuleDefinition[] = [
  {
    code: RULE_CODES.ADMITTED_NO_CUSTODIAN,
    fires: (s) => s.currentStatus === 'ADMITTED' && !s.hasCustody,
    details: (s) => ({ currentStatus: s.currentStatus, hasCustody: s.hasCustody }),
  },
  {
    code: RULE_CODES.UNRESOLVED_OBJECTION_JURY_ELIGIBLE,
    fires: (s) => s.currentStatus === 'ADMITTED' && s.unresolvedObjectionCount > 0,
    details: (s) => ({
      currentStatus: s.currentStatus,
      unresolvedObjectionCount: s.unresolvedObjectionCount,
    }),
  },
];

/**
 * Re-evaluate every discrepancy rule for one exhibit against its current
 * projections and create / resolve flags accordingly. Idempotent: safe to call
 * on every write — it never creates a duplicate OPEN/ACKNOWLEDGED flag when one
 * already exists for the same (exhibitId, ruleCode).
 *
 * @param exhibitId        the exhibit to evaluate
 * @param client           optional tx client so this composes atomically with
 *                         the caller's write transaction (omitted → own client)
 * @param resolvingEventId optional id of the event that triggered the
 *                         evaluation; attributed on flags this call RESOLVES
 */
export async function evaluateDiscrepancies(
  exhibitId: string,
  client?: PrismaLike,
  resolvingEventId?: string,
): Promise<void> {
  const db = client ?? prisma;

  // a. Load the exhibit's caseId + the three projections it depends on.
  const exhibit = await db.exhibit.findUnique({
    where: { id: exhibitId },
    select: { caseId: true },
  });
  if (!exhibit) {
    // Nothing to evaluate for a nonexistent exhibit; callers own existence checks.
    return;
  }

  const [currentState, custody, unresolvedObjectionCount] = await Promise.all([
    db.exhibitCurrentState.findUnique({
      where: { exhibitId },
      select: { currentStatus: true },
    }),
    db.custodyCurrentState.findUnique({
      where: { exhibitId },
      select: { exhibitId: true },
    }),
    db.objectionCurrentState.count({ where: { exhibitId, status: 'UNRESOLVED' } }),
  ]);

  const snapshot: ProjectionSnapshot = {
    currentStatus: currentState?.currentStatus ?? null,
    hasCustody: custody !== null,
    unresolvedObjectionCount,
  };

  const now = new Date();

  for (const rule of RULES) {
    const fires = rule.fires(snapshot);

    if (fires) {
      // c. Only create when no OPEN/ACKNOWLEDGED flag already exists (idempotent).
      const existing = await db.discrepancyFlag.findFirst({
        where: { exhibitId, ruleCode: rule.code, status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
        select: { id: true },
      });
      if (!existing) {
        await db.discrepancyFlag.create({
          data: {
            caseId: exhibit.caseId,
            exhibitId,
            ruleCode: rule.code,
            status: 'OPEN',
            detectedAt: now,
            details: rule.details(snapshot) as Prisma.InputJsonValue,
          },
        });
      }
    } else {
      // e. Condition no longer holds → resolve any active flag for this rule.
      await db.discrepancyFlag.updateMany({
        where: { exhibitId, ruleCode: rule.code, status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
        data: {
          status: 'RESOLVED',
          resolvedAt: now,
          resolvedByEventId: resolvingEventId ?? null,
        },
      });
    }
  }
}

/** Additive read-time join (F14): attach `justification` to each ACKNOWLEDGED
 * flag, extracted from its acknowledgedEventId's DISCREPANCY_ACKNOWLEDGED
 * payload — NOT a new column, purely a read-time enrichment. Flags that are
 * OPEN (acknowledgedEventId null) are returned unchanged. This surfaces the
 * IDENTICAL justification text already readable via the ledger timeline, through
 * the discrepancy-flag read paths — no new disclosure channel (threat T-07-11).
 */
async function withJustification(
  flags: DiscrepancyFlag[],
): Promise<Array<DiscrepancyFlag & { justification?: string }>> {
  const eventIds = flags
    .filter((f) => f.status === 'ACKNOWLEDGED' && f.acknowledgedEventId)
    .map((f) => f.acknowledgedEventId as string);
  if (eventIds.length === 0) return flags;
  const events = await prisma.exhibitEvent.findMany({
    where: { id: { in: eventIds } },
    select: { id: true, payload: true },
  });
  const justificationByEventId = new Map(
    events.map((e) => [e.id, (e.payload as { justification?: string })?.justification]),
  );
  return flags.map((f) =>
    f.acknowledgedEventId && justificationByEventId.has(f.acknowledgedEventId)
      ? { ...f, justification: justificationByEventId.get(f.acknowledgedEventId) }
      : f,
  );
}

/**
 * All active (OPEN or ACKNOWLEDGED) discrepancy flags case-wide, oldest first.
 * RESOLVED flags are history and are excluded — they surface only in the
 * timeline. THE shared query for F9 / F11 / Command Center.
 *
 * Sealed-aware (Sealed-Exhibit Invisibility, threat T-03-09): for a role that
 * cannot view sealed exhibits, flags whose exhibit is sealed are excluded via a
 * relational `exhibit: { isSealed: false }` predicate — mirroring getExhibits —
 * so a sealed exhibit's existence and defect never leak through the case-wide
 * feed (sidebar count pill / jury screen).
 *
 * ACKNOWLEDGED flags additionally carry `justification` (F14) via the read-time
 * withJustification join — see that helper.
 */
export async function getDiscrepancies(
  caseId: string,
  requestingUserRole: Role,
): Promise<Array<DiscrepancyFlag & { justification?: string }>> {
  const flags = await prisma.discrepancyFlag.findMany({
    where: {
      caseId,
      status: { in: ['OPEN', 'ACKNOWLEDGED'] },
      ...(canViewSealed(requestingUserRole) ? {} : { exhibit: { isSealed: false } }),
    },
    orderBy: { detectedAt: 'asc' },
  });
  return withJustification(flags);
}

/** Same as getDiscrepancies but scoped to one exhibit. ACKNOWLEDGED flags carry
 * `justification` via the read-time withJustification join (F14). */
export async function getExhibitDiscrepancies(
  exhibitId: string,
): Promise<Array<DiscrepancyFlag & { justification?: string }>> {
  const flags = await prisma.discrepancyFlag.findMany({
    where: { exhibitId, status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
    orderBy: { detectedAt: 'asc' },
  });
  return withJustification(flags);
}

/**
 * Acknowledge an OPEN discrepancy flag with a required justification. Writes a
 * DISCREPANCY_ACKNOWLEDGED ledger event and flips the flag to ACKNOWLEDGED in
 * ONE transaction (they must never diverge — TechArch §3.8). Idempotent on an
 * already-ACKNOWLEDGED/RESOLVED flag (200 no-op, no second ledger event).
 */
export async function acknowledgeDiscrepancy(args: {
  discrepancyFlagId: string;
  actorUserId: string;
  justification: string;
}): Promise<{ event: ExhibitEvent; discrepancyFlag: DiscrepancyFlag }> {
  const { discrepancyFlagId, actorUserId } = args;

  // 1. Justification is required (re-checked here even though the zod schema also
  //    enforces min(1), because empty/whitespace must 422 BEFORE any write).
  const justification = args.justification?.trim() ?? '';
  if (justification.length === 0) {
    throw new UnprocessableError(
      'JUSTIFICATION_REQUIRED',
      'A justification is required to acknowledge a discrepancy',
    );
  }

  // 2. The flag must exist.
  const flag = await prisma.discrepancyFlag.findUnique({
    where: { id: discrepancyFlagId },
  });
  if (!flag) {
    throw new NotFoundError('DISCREPANCY_NOT_FOUND', 'No discrepancy found with the given ID');
  }

  // 3. Role gate against the ACTUAL User.role (never a client claim) — T-03-01.
  const actor = await prisma.user.findUnique({
    where: { id: actorUserId },
    select: { role: true },
  });
  if (!actor || !ACK_ALLOWED_ROLES.has(actor.role)) {
    throw new RoleNotPermittedError();
  }

  // 4. Idempotent: an already-ACKNOWLEDGED/RESOLVED flag returns its current
  //    state + the most recent DISCREPANCY_ACKNOWLEDGED event for it (if any),
  //    WITHOUT writing a second ledger event. The route maps this to 200.
  if (flag.status !== 'OPEN') {
    const existingEvent = flag.acknowledgedEventId
      ? await prisma.exhibitEvent.findUnique({ where: { id: flag.acknowledgedEventId } })
      : await prisma.exhibitEvent.findFirst({
          where: { exhibitId: flag.exhibitId, eventType: 'DISCREPANCY_ACKNOWLEDGED' },
          orderBy: { sequenceNo: 'desc' },
        });
    if (existingEvent) {
      return { event: existingEvent, discrepancyFlag: flag };
    }
    // RESOLVED-without-ack (resolved before anyone acknowledged): nothing to
    // acknowledge and no ledger event to return — treat as a not-found ack
    // target so the caller doesn't fabricate a non-existent event.
    throw new NotFoundError(
      'DISCREPANCY_NOT_FOUND',
      'This discrepancy has already been resolved and cannot be acknowledged',
    );
  }

  // 5. OPEN → ACKNOWLEDGED, atomically with the ledger event (threat T-03-03).
  return prisma.$transaction(async (tx) => {
    const event = await recordEvent(
      {
        exhibitId: flag.exhibitId,
        eventType: 'DISCREPANCY_ACKNOWLEDGED',
        payload: { discrepancyFlagId, ruleCode: flag.ruleCode, justification },
        actorUserId,
      },
      tx,
    );

    const discrepancyFlag = await tx.discrepancyFlag.update({
      where: { id: discrepancyFlagId },
      data: {
        status: 'ACKNOWLEDGED',
        acknowledgedAt: new Date(),
        acknowledgedBy: actorUserId,
        acknowledgedEventId: event.id,
      },
    });

    return { event, discrepancyFlag };
  });
}
