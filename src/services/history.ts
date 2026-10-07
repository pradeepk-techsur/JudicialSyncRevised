import type {
  EventType,
  Exhibit,
  ExhibitStatus,
  Role,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getExhibit } from '@/services/exhibits';

// F10 — Full chronological exhibit history (Y1-api.md §Exhibits GET
// /api/exhibits/:id/history; FRD F00 §Process step 7 "ledger replay").
//
// getExhibitHistory reconstructs the COMPLETE timeline for one exhibit DIRECTLY
// from the append-only ExhibitEvent ledger — every event type, in sequenceNo
// order, with ZERO filtering, truncation, or "recent N" limiting (F10
// §Validation/US-10.1: "complete history, not 'recent N events'"). This is the
// direct demonstration of Phase 1's auditability guarantee: history is genuinely
// derived from the ledger, not maintained in a separate shadow log.
//
// Each raw event is translated into a plain-language `summary` string and its
// `actorUserId` is resolved to the actor's human-readable name — no raw enum
// values, JSON payloads, or bare UUIDs leak into the response. The free-text
// fields interpolated here (grounds, reason, notes, justification) are rendered
// later by Phase 2's UI, where React auto-escaping owns safe rendering (threat
// T-01-21); this layer only constructs the string.

/** A single resolved, human-readable timeline entry. */
export interface TimelineEntry {
  eventId: string;
  eventType: EventType;
  summary: string;
  actorName: string;
  recordedAt: string;
}

/** Full history response shape (Y1-api.md §Exhibits). */
export interface ExhibitHistoryResponse {
  exhibit: Exhibit;
  currentStatus: ExhibitStatus | null;
  currentCustodianName: string | null;
  // Always [] in Phase 1 — the DiscrepancyFlag table does not exist yet. Phase 3
  // populates this field; returning [] now is the honest placeholder the
  // Y1-api.md response shape prescribes, never a fabricated value.
  discrepancyFlags: [];
  timeline: TimelineEntry[];
}

// Narrow payload types, matching the discriminated schemas in
// src/lib/validation/eventPayloads.ts. The ledger guarantees these shapes
// because recordEvent() validates every payload before it is written.
interface StatusChangePayload {
  fromStatus: ExhibitStatus | null;
  toStatus: ExhibitStatus;
  notes?: string;
}
interface ObjectionRaisedPayload {
  objectionId: string;
  objectingParty: string;
  grounds: string;
}
interface RulingRecordedPayload {
  objectionId: string;
  disposition: string;
}
interface CustodyTransferPayload {
  fromCustodianUserId: string | null;
  toCustodianUserId: string;
  reason?: string | null;
}
interface DiscrepancyAcknowledgedPayload {
  discrepancyFlagId: string;
  ruleCode: string;
  justification: string;
}

/**
 * Render a raw ledger event into a plain-language summary. `nameOf` resolves a
 * userId to a display name (null → "(none)").
 */
function summarizeEvent(
  eventType: EventType,
  payload: unknown,
  nameOf: (userId: string | null | undefined) => string | null,
): string {
  switch (eventType) {
    case 'STATUS_CHANGE': {
      const p = payload as StatusChangePayload;
      return `Status changed from ${p.fromStatus ?? '(none)'} to ${p.toStatus}`;
    }
    case 'OBJECTION_RAISED': {
      const p = payload as ObjectionRaisedPayload;
      return `Objection raised by ${p.objectingParty} — ${p.grounds}`;
    }
    case 'RULING_RECORDED': {
      const p = payload as RulingRecordedPayload;
      return `Ruling recorded: ${p.disposition}`;
    }
    case 'CUSTODY_TRANSFER': {
      const p = payload as CustodyTransferPayload;
      const from = nameOf(p.fromCustodianUserId) ?? '(none)';
      const to = nameOf(p.toCustodianUserId) ?? '(unknown)';
      const reason = p.reason ? ` — ${p.reason}` : '';
      return `Custody transferred from ${from} to ${to}${reason}`;
    }
    case 'DISCREPANCY_ACKNOWLEDGED': {
      // Dead code path in Phase 1 — no such events exist yet — but included for
      // completeness since the enum value exists in the schema.
      const p = payload as DiscrepancyAcknowledgedPayload;
      return `Discrepancy acknowledged: ${p.justification}`;
    }
    default: {
      // Defensive: an unknown event type should never silently render as a raw
      // enum. Exhaustiveness is enforced above; this guards future enum values.
      return `${String(eventType)} recorded`;
    }
  }
}

export async function getExhibitHistory(
  exhibitId: string,
  requestingUserRole: Role,
): Promise<ExhibitHistoryResponse | null> {
  // 1. Fetch the exhibit identity — null (→ route 404) BOTH when the exhibit does
  //    not exist AND when it is sealed and the requesting role cannot view sealed
  //    exhibits. Sealed-masking is INHERITED from getExhibit, never reimplemented
  //    here: because this early return fires before the event-ledger query runs,
  //    a masked exhibit never reaches the timeline reconstruction at all (threat
  //    T-02-03).
  const exhibit = await getExhibit(exhibitId, requestingUserRole);
  if (!exhibit) {
    return null;
  }

  // 2. Header summary fields from the derived projections. The custodian name is
  //    joined through CustodyCurrentState → User.
  const [currentState, custodyState] = await Promise.all([
    prisma.exhibitCurrentState.findUnique({ where: { exhibitId } }),
    prisma.custodyCurrentState.findUnique({
      where: { exhibitId },
      include: { custodian: { select: { name: true } } },
    }),
  ]);

  // 3. The COMPLETE, ordered ledger — every event type, no filtering, no limit.
  //    The actor is joined here so each entry resolves to a name, never a UUID.
  const events = await prisma.exhibitEvent.findMany({
    where: { exhibitId },
    orderBy: { sequenceNo: 'asc' },
    include: { actor: { select: { name: true } } },
  });

  // 4. Custody summaries also reference the from/to custodian by id — resolve
  //    those names in one batch query rather than N per-event lookups.
  const custodianIds = new Set<string>();
  for (const e of events) {
    if (e.eventType === 'CUSTODY_TRANSFER') {
      const p = e.payload as unknown as CustodyTransferPayload;
      if (p.fromCustodianUserId) custodianIds.add(p.fromCustodianUserId);
      if (p.toCustodianUserId) custodianIds.add(p.toCustodianUserId);
    }
  }
  const custodianNameById = new Map<string, string>();
  if (custodianIds.size > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: [...custodianIds] } },
      select: { id: true, name: true },
    });
    for (const u of users) custodianNameById.set(u.id, u.name);
  }
  const nameOf = (userId: string | null | undefined): string | null =>
    userId ? custodianNameById.get(userId) ?? null : null;

  const timeline: TimelineEntry[] = events.map((e) => ({
    eventId: e.id,
    eventType: e.eventType,
    summary: summarizeEvent(e.eventType, e.payload, nameOf),
    actorName: e.actor.name,
    recordedAt: e.recordedAt.toISOString(),
  }));

  return {
    exhibit,
    currentStatus: currentState?.currentStatus ?? null,
    currentCustodianName: custodyState?.custodian.name ?? null,
    discrepancyFlags: [],
    timeline,
  };
}
