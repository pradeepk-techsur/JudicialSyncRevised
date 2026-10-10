import type { EventType, ExhibitStatus, Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ValidationError } from '@/lib/errors';
import { canViewSealed } from '@/services/visibility';
import { summarizeEvent } from '@/services/history';

// F8 — Trial Command Center: Recent Activity feed (TechArch 03-api.md §4.9).
//
// getRecentActivity is the SOLE data path for the Command Center's recent-activity
// feed — the UI derives nothing from it. It composes the existing append-only
// ExhibitEvent ledger into render-ready rows, newest-first, using:
//   - the SAME sealed-exclusion predicate every other read applies (a sealed
//     exhibit's events are ABSENT for a role that cannot view sealed — a WHERE
//     predicate, never a post-filter, so they are never counted and never leak), and
//   - the SAME summarizer getExhibitHistory uses (summarizeEvent), so Command
//     Center phrasing is byte-identical to the Exhibit Detail timeline and the two
//     can never drift.
//
// It performs ZERO writes: it only reads the ledger. The free-text fields
// interpolated into summary strings are rendered later by React auto-escaping in
// the UI (same posture as history.ts, threat T-05-05) — this layer only builds
// strings.

/**
 * One render-ready recent-activity row (TechArch 03-api.md §4.9 — exact shape,
 * do NOT abstract). Note it carries exhibit identity (exhibitId/exhibitLabel) and
 * NO actorName — the inverse of TimelineEntry — while still producing `summary`
 * via the shared summarizer.
 */
export interface RecentActivityEntry {
  eventId: string;
  eventType: EventType;
  exhibitId: string;
  exhibitLabel: string;
  summary: string;
  recordedAt: string;
}

// CUSTODY_TRANSFER payloads reference custodians by userId; summarizeEvent renders
// their names through its nameOf callback. Mirror the narrow shape history.ts uses
// so the custody-name resolution here is byte-identical.
interface CustodyTransferPayload {
  fromCustodianUserId: string | null;
  toCustodianUserId: string;
  reason?: string | null;
}

/**
 * Read the recent-activity feed for a case, newest-first, with role-based sealed
 * exclusion applied in-query.
 *
 * - `opts.since` (optional): when supplied, it is the window start. It must be a
 *   valid ISO datetime that is not in the future; otherwise a 422
 *   VALIDATION_ERROR is thrown before any query runs.
 * - When `since` is omitted, the window is anchored to the START OF THE DAY of
 *   the LATEST ledger event in the case (a rolling "latest trial day" so the demo
 *   is never empty regardless of run date — NOT wall-clock today). An empty case
 *   has no anchor and returns [].
 */
export async function getRecentActivity(
  caseId: string,
  opts: { since?: string; role: Role },
): Promise<RecentActivityEntry[]> {
  let windowStart: Date;

  if (opts.since !== undefined) {
    // 1. Validate a supplied `since` (FRD F08 §Validation): a non-ISO or future
    //    value is a client-input error (422), never a 500.
    const d = new Date(opts.since);
    if (Number.isNaN(d.getTime()) || d.getTime() > Date.now()) {
      throw new ValidationError('since must be a valid past or present datetime');
    }
    windowStart = d;
  } else {
    // 2. Default window = start-of-day of the LATEST ledger event in this case.
    const latest = await prisma.exhibitEvent.findFirst({
      where: { caseId },
      orderBy: { recordedAt: 'desc' },
      select: { recordedAt: true },
    });
    if (!latest) {
      // Empty case — no anchor to establish a window; the UI shows the calm
      // empty state.
      return [];
    }
    const anchor = new Date(latest.recordedAt);
    anchor.setHours(0, 0, 0, 0);
    windowStart = anchor;
  }

  // 3. Query the ledger, newest-first, with the sealed-exclusion predicate keyed
  //    on canViewSealed(role) — the SAME predicate every other read applies. A
  //    sealed exhibit's events are simply ABSENT for a role without sealed
  //    visibility (never a redacted row, never counted). Backed by the existing
  //    @@index([caseId, eventType, recordedAt]); NO hard row cap (scroll, don't
  //    truncate/paginate).
  const events = await prisma.exhibitEvent.findMany({
    where: {
      caseId,
      recordedAt: { gte: windowStart },
      ...(canViewSealed(opts.role) ? {} : { exhibit: { isSealed: false } }),
    },
    orderBy: { recordedAt: 'desc' },
    include: {
      exhibit: { select: { id: true, exhibitLabel: true } },
    },
  });

  // 4. Resolve custodian names for CUSTODY_TRANSFER summaries exactly as
  //    history.ts does — batch-fetch every referenced custodian userId once and
  //    build a Map, so the custody wording is byte-identical.
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

  // 5. Map each event to the FRD RecentActivityEntry shape, building `summary`
  //    via the shared summarizeEvent so the Command Center and Exhibit Detail can
  //    never drift. No local switch, no re-implementation.
  return events.map((e) => ({
    eventId: e.id,
    eventType: e.eventType,
    exhibitId: e.exhibit.id,
    exhibitLabel: e.exhibit.exhibitLabel,
    summary: summarizeEvent(e.eventType, e.payload, nameOf),
    recordedAt: e.recordedAt.toISOString(),
  }));
}

// F8 — Trial Command Center: per-status exhibit counts for the status-
// distribution legend / stat cards (FRD F08 §Process step 2).
//
// SERVICE-LEVEL ONLY this plan (08-06): getStatusCounts is proven by a direct
// test against the function. It is NOT yet wired into the GET /api/cases/:id/
// activity route — that route today returns a BARE RecentActivityEntry[] array,
// and amending it to the FRD's `{ recentActivity, statusCounts }` shape is a
// breaking change its current consumers (useRecentActivity.ts /
// RecentActivityPanel.tsx, typed against the bare array) would also have to move
// for in the same change. To avoid an intermediate broken-consumer state, that
// wiring is deferred to 08-10 (Command Center Part A, wave 3), which updates the
// route AND every consumer atomically. This plan hands off a tested, ready-to-
// wire function and does not touch the route.

const ALL_STATUSES: ExhibitStatus[] = [
  'MARKED',
  'OFFERED',
  'OBJECTED',
  'ADMITTED',
  'EXCLUDED',
  'WITHDRAWN',
];

/**
 * Per-status exhibit count breakdown (F08 §Process step 2) — grouped from the
 * same ExhibitCurrentState data getExhibits reads elsewhere, with the SAME
 * sealed-exclusion predicate every other read applies. An exhibit with NO
 * ExhibitCurrentState row (never reached MARKED) is NOT counted in any bucket —
 * statusCounts sums to the count of exhibits that have at least one STATUS_CHANGE
 * event, not the case's total exhibit count. Every one of the 6 ExhibitStatus
 * keys is present, zero-filled when no exhibit holds that status.
 */
export async function getStatusCounts(
  caseId: string,
  role: Role,
): Promise<Record<ExhibitStatus, number>> {
  const counts = Object.fromEntries(ALL_STATUSES.map((s) => [s, 0])) as Record<
    ExhibitStatus,
    number
  >;
  const rows = await prisma.exhibitCurrentState.groupBy({
    by: ['currentStatus'],
    where: { exhibit: { caseId, ...(canViewSealed(role) ? {} : { isSealed: false }) } },
    _count: { currentStatus: true },
  });
  for (const row of rows) {
    counts[row.currentStatus] = row._count.currentStatus;
  }
  return counts;
}
