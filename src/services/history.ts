import type {
  CustodyCurrentState,
  EventType,
  Exhibit,
  ExhibitStatus,
  ObjectionCurrentState,
  Role,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { DiscrepancyFlagSummary } from '@/lib/types';
import { ruleLabel } from '@/lib/discrepancyLabels';
import { getExhibit, loadJuryEligibilityByExhibit } from '@/services/exhibits';
import { getExhibitDiscrepancies } from '@/services/discrepancies';
import { getCustodyHistory } from '@/services/custody';

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
  // The exhibit's active (OPEN+ACKNOWLEDGED) discrepancy flags as compact
  // render-ready summaries (Phase 3 / F6). This is what the Exhibit Detail
  // header banner (ExhibitHeader.tsx) reads to light up its amber block.
  discrepancyFlags: DiscrepancyFlagSummary[];
  timeline: TimelineEntry[];
  // Added Phase 8 (F10 §Process step 4): every UNRESOLVED ObjectionCurrentState
  // row for this exhibit — zero, one, or several (F02 permits N concurrent
  // threads). The full set (resolved + unresolved) remains visible via the
  // timeline, unchanged.
  objections: ObjectionCurrentState[];
  // Added Phase 8 (F10 §Process step 5). pendingTransfer is ALWAYS null this
  // phase — F19's propose/confirm/cancel is Phase 7.1 scope, skipped. The
  // Chain of Custody card has exactly two states: a name, or no custodian.
  custodyCard: {
    current: CustodyCurrentState | null;
    pendingTransfer: null;
    history: Array<{
      fromCustodian: string | null;
      toCustodian: string;
      timestamp: string;
      reason: string | null;
      eventId: string;
    }>;
  };
  // Added Phase 8 (F10 §Process step 6). classificationTrial substitutes
  // !exhibit.isSealed for F16's (skipped) classification column — matches the
  // same substitution already made this phase in 08-06's attention feed and
  // juryPackage.ts's existing CRITICAL-row treatment. eligibility uses the
  // IDENTICAL precedence rule F09/exhibits.ts computes — never redefined here.
  juryPackageChecklist: {
    admitted: boolean;
    objectionsResolved: boolean;
    custodianOnRecord: boolean;
    classificationTrial: boolean;
    eligibility: 'INCLUDED' | 'NOT_ELIGIBLE' | 'BLOCKED';
  };
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
export function summarizeEvent(
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
      // Live as of Phase 3 (F6): acknowledgeDiscrepancy appends this event. Render
      // it as a plain-language, auditable entry naming the rule and the operator's
      // justification so the timeline shows WHY the discrepancy was accepted.
      const p = payload as DiscrepancyAcknowledgedPayload;
      return `Discrepancy acknowledged (${p.ruleCode}): ${p.justification}`;
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
  //    joined through CustodyCurrentState → User. The exhibit's active
  //    discrepancy flags (OPEN+ACKNOWLEDGED) are loaded through the SAME shared
  //    query the Case Workspace / Jury screen use (getExhibitDiscrepancies), so
  //    the header banner can never drift from the list column.
  const [currentState, custodyState, discrepancyRows] = await Promise.all([
    prisma.exhibitCurrentState.findUnique({ where: { exhibitId } }),
    prisma.custodyCurrentState.findUnique({
      where: { exhibitId },
      include: { custodian: { select: { name: true } } },
    }),
    getExhibitDiscrepancies(exhibitId),
  ]);

  const discrepancyFlags: DiscrepancyFlagSummary[] = discrepancyRows.map((flag) => ({
    ruleCode: flag.ruleCode,
    status: flag.status as 'OPEN' | 'ACKNOWLEDGED',
    label: ruleLabel(flag.ruleCode),
  }));

  // objections[] — reuse the SAME query shape getUnresolvedObjections uses,
  // scoped to this one exhibit (no new business logic, F02's existing
  // ObjectionCurrentState projection).
  const objections = await prisma.objectionCurrentState.findMany({
    where: { exhibitId, status: 'UNRESOLVED' },
    orderBy: { raisedAt: 'asc' },
  });

  // custodyCard — current + full history, reusing custody.ts's own
  // getCustodyHistory (no new query, no new business logic). pendingTransfer
  // is always null this phase (F19 skipped).
  const custodyHistoryRaw = await getCustodyHistory(exhibitId);
  const custodyCard = {
    current: custodyState,
    pendingTransfer: null as null,
    history: custodyHistoryRaw.map((h) => ({ ...h, timestamp: h.timestamp.toISOString() })),
  };

  // juryPackageChecklist — four boolean conditions + eligibility. eligibility
  // MUST call 08-07's exported loadJuryEligibilityByExhibit (never re-derive
  // the Included/Blocked/Not-eligible precedence inline here) — it is the
  // SAME precedence 08-07's getExhibits/searchExhibits compute for the Case
  // Workspace, and both plans' tests assert cross-screen parity for the same
  // exhibit. Passing a 1-element exhibitIds array is the documented
  // single-exhibit usage of that batch helper.
  const admitted = currentState?.currentStatus === 'ADMITTED';
  const objectionsResolved = objections.length === 0;
  const custodianOnRecord = custodyState !== null;
  const classificationTrial = !exhibit.isSealed;

  const eligibilityByExhibit = await loadJuryEligibilityByExhibit(exhibit.caseId, [exhibitId]);
  const eligibility = eligibilityByExhibit.get(exhibitId) ?? 'NOT_ELIGIBLE';

  const juryPackageChecklist = {
    admitted,
    objectionsResolved,
    custodianOnRecord,
    classificationTrial,
    eligibility,
  };

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
    discrepancyFlags,
    timeline,
    objections,
    custodyCard,
    juryPackageChecklist,
  };
}
