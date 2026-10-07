import type { ExhibitStatus, ObjectionStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

// Projection-integrity verification (TechArch §3.8 "Projection Integrity" / FRD
// F00 §Process step 7).
//
// rebuildProjections replays the ExhibitEvent ledger for an entire case —
// per exhibit, strictly in sequenceNo order — to recompute, IN MEMORY, what each
// current-state projection (ExhibitCurrentState, ObjectionCurrentState,
// CustodyCurrentState) SHOULD be, then diffs that reconstruction against the LIVE
// projection rows. If the projections are genuinely pure derivations of the
// ledger (never independently edited), the two are identical and `matches` is
// true. Any divergence is reported as a precise {exhibitId, field, live, rebuilt}
// diff.
//
// This is a read-only admin/dev sanity check (TechArch §3.8: "should be run as a
// pre-demo sanity check, not relied upon as a live write path"). It NEVER calls
// recordEvent and NEVER writes to any *CurrentState table under any circumstance:
// it only computes an in-memory reconstruction and compares (threat T-01-20).

export interface ProjectionDiff {
  exhibitId: string;
  field: string;
  live: unknown;
  rebuilt: unknown;
}

export interface RebuildResult {
  matches: boolean;
  diffs: ProjectionDiff[];
}

// Narrow payload views (shapes guaranteed by recordEvent's validation).
interface StatusChangePayload {
  fromStatus: ExhibitStatus | null;
  toStatus: ExhibitStatus;
}
interface ObjectionRaisedPayload {
  objectionId: string;
}
interface RulingRecordedPayload {
  objectionId: string;
  disposition: 'SUSTAINED' | 'OVERRULED' | 'RESERVED';
}
interface CustodyTransferPayload {
  toCustodianUserId: string;
}

// Sentinel for "no projection row should exist" — distinguished from a genuine
// null field value so an absent row and a present-but-null field never alias.
const ABSENT = Symbol('ABSENT');

export async function rebuildProjections(caseId: string): Promise<RebuildResult> {
  const diffs: ProjectionDiff[] = [];

  // 1. Every exhibit in the case, with its full ordered ledger.
  const exhibits = await prisma.exhibit.findMany({
    where: { caseId },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  // 2. Live projections for the whole case, indexed for O(1) lookup.
  const [liveExhibitStates, liveObjectionStates, liveCustodyStates] = await Promise.all([
    prisma.exhibitCurrentState.findMany({ where: { exhibit: { caseId } } }),
    prisma.objectionCurrentState.findMany({ where: { exhibit: { caseId } } }),
    prisma.custodyCurrentState.findMany({ where: { exhibit: { caseId } } }),
  ]);

  const liveStatusByExhibit = new Map(liveExhibitStates.map((s) => [s.exhibitId, s]));
  const liveCustodyByExhibit = new Map(liveCustodyStates.map((s) => [s.exhibitId, s]));
  const liveObjectionByThread = new Map(
    liveObjectionStates.map((o) => [o.objectionId, o]),
  );
  // Track which live objection threads we actually account for, so an orphaned
  // live thread (present in the DB but never raised in the ledger) is caught too.
  const seenLiveThreads = new Set<string>();

  for (const { id: exhibitId } of exhibits) {
    const events = await prisma.exhibitEvent.findMany({
      where: { exhibitId },
      orderBy: { sequenceNo: 'asc' },
    });

    // --- Replay STATUS_CHANGE: last one wins; none → ABSENT. ---
    let rebuiltStatus: ExhibitStatus | typeof ABSENT = ABSENT;
    // --- Replay CUSTODY_TRANSFER: last one's toCustodian; none → ABSENT. ---
    let rebuiltCustodian: string | typeof ABSENT = ABSENT;
    // --- Replay objection threads grouped by objectionId. ---
    const rebuiltThreadStatus = new Map<string, ObjectionStatus>();

    for (const e of events) {
      switch (e.eventType) {
        case 'STATUS_CHANGE': {
          const p = e.payload as unknown as StatusChangePayload;
          rebuiltStatus = p.toStatus;
          break;
        }
        case 'CUSTODY_TRANSFER': {
          const p = e.payload as unknown as CustodyTransferPayload;
          rebuiltCustodian = p.toCustodianUserId;
          break;
        }
        case 'OBJECTION_RAISED': {
          const p = e.payload as unknown as ObjectionRaisedPayload;
          // A raised thread starts UNRESOLVED.
          rebuiltThreadStatus.set(p.objectionId, 'UNRESOLVED');
          break;
        }
        case 'RULING_RECORDED': {
          const p = e.payload as unknown as RulingRecordedPayload;
          // SUSTAINED/OVERRULED close the thread to that disposition. RESERVED is
          // itself a judicial act but does NOT resolve the thread — it stays
          // UNRESOLVED (mirrors recordRuling in objections.ts).
          if (p.disposition === 'SUSTAINED' || p.disposition === 'OVERRULED') {
            rebuiltThreadStatus.set(p.objectionId, p.disposition);
          }
          break;
        }
        default:
          // DISCREPANCY_ACKNOWLEDGED and any future type do not affect these
          // three projections in Phase 1.
          break;
      }
    }

    // --- Compare status projection. ---
    const liveStatusRow = liveStatusByExhibit.get(exhibitId);
    const liveStatus: ExhibitStatus | typeof ABSENT = liveStatusRow
      ? liveStatusRow.currentStatus
      : ABSENT;
    if (liveStatus !== rebuiltStatus) {
      diffs.push({
        exhibitId,
        field: 'currentStatus',
        live: liveStatus === ABSENT ? null : liveStatus,
        rebuilt: rebuiltStatus === ABSENT ? null : rebuiltStatus,
      });
    }

    // --- Compare custody projection. ---
    const liveCustodyRow = liveCustodyByExhibit.get(exhibitId);
    const liveCustodian: string | typeof ABSENT = liveCustodyRow
      ? liveCustodyRow.currentCustodianUserId
      : ABSENT;
    if (liveCustodian !== rebuiltCustodian) {
      diffs.push({
        exhibitId,
        field: 'currentCustodianUserId',
        live: liveCustodian === ABSENT ? null : liveCustodian,
        rebuilt: rebuiltCustodian === ABSENT ? null : rebuiltCustodian,
      });
    }

    // --- Compare each objection thread for this exhibit. ---
    for (const [objectionId, rebuiltThread] of rebuiltThreadStatus) {
      seenLiveThreads.add(objectionId);
      const liveThread = liveObjectionByThread.get(objectionId);
      const liveThreadStatus: ObjectionStatus | typeof ABSENT = liveThread
        ? liveThread.status
        : ABSENT;
      if (liveThreadStatus !== rebuiltThread) {
        diffs.push({
          exhibitId,
          field: `objection:${objectionId}.status`,
          live: liveThreadStatus === ABSENT ? null : liveThreadStatus,
          rebuilt: rebuiltThread,
        });
      }
    }
  }

  // --- Orphan check: any live objection thread in this case that the ledger
  //     replay never produced is itself a divergence. ---
  for (const liveThread of liveObjectionStates) {
    if (!seenLiveThreads.has(liveThread.objectionId)) {
      diffs.push({
        exhibitId: liveThread.exhibitId,
        field: `objection:${liveThread.objectionId}.status`,
        live: liveThread.status,
        rebuilt: null,
      });
    }
  }

  return { matches: diffs.length === 0, diffs };
}
