import type { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { canViewSealed } from '@/services/visibility';

// F8 — Trial Command Center: "Custody at a Glance" panel (FRD
// F08-trial-command-center-screen.md §Process step 3).
//
// getCustodyByCustodian is a READ-ONLY aggregation over the EXISTING
// CustodyCurrentState projection + the Exhibit identity/currentState rows — zero
// new tables, zero new indexes. It groups every role-visible exhibit by its
// current custodian of record, and surfaces a DISTINCT "no custodian of record"
// bucket for exhibits that have never had a CUSTODY_TRANSFER event (a custody
// gap is a first-class, meaningful state — never silently folded into a group).
//
// Sealed-exhibit exclusion uses the SAME `canViewSealed(role) ? {} : { isSealed:
// false }` WHERE predicate every other read in this codebase applies (a WHERE
// predicate in-query, never a post-query filter) — a sealed exhibit's custody
// grouping is structurally ABSENT for a role that cannot view sealed, never a
// redacted row (threat T-08-10).

export interface CustodyGroupExhibit {
  exhibitId: string;
  exhibitLabel: string;
  currentStatus: string | null;
}

export interface CustodyByCustodianGroup {
  custodianUserId: string;
  custodianName: string;
  exhibits: CustodyGroupExhibit[];
  // ALWAYS [] this phase — F19's propose/confirm pending-transfer concept is
  // explicitly out of scope (Phase 7.1, skipped). Kept in the output shape for
  // contract-shape fidelity with Y1-api.md; the UI (08-10) never renders this.
  pendingTransfersIn: [];
}

export interface CustodyByCustodianResult {
  groups: CustodyByCustodianGroup[];
  // Exhibits with NO CustodyCurrentState row at all — a distinct "no custodian
  // of record" bucket, never silently folded into a group.
  noCustodian: CustodyGroupExhibit[];
}

export async function getCustodyByCustodian(
  caseId: string,
  requestingUserRole: Role,
): Promise<CustodyByCustodianResult> {
  const sealedFilter = canViewSealed(requestingUserRole) ? {} : { isSealed: false };

  const custodyRows = await prisma.custodyCurrentState.findMany({
    where: { exhibit: { caseId, ...sealedFilter } },
    include: {
      custodian: { select: { id: true, name: true } },
      exhibit: {
        select: {
          id: true,
          exhibitLabel: true,
          currentState: { select: { currentStatus: true } },
        },
      },
    },
  });

  const byCustodian = new Map<string, CustodyByCustodianGroup>();
  for (const row of custodyRows) {
    const key = row.custodian.id;
    const entry: CustodyGroupExhibit = {
      exhibitId: row.exhibit.id,
      exhibitLabel: row.exhibit.exhibitLabel,
      currentStatus: row.exhibit.currentState?.currentStatus ?? null,
    };
    const group = byCustodian.get(key);
    if (group) {
      group.exhibits.push(entry);
    } else {
      byCustodian.set(key, {
        custodianUserId: key,
        custodianName: row.custodian.name,
        exhibits: [entry],
        pendingTransfersIn: [],
      });
    }
  }

  // "No custodian of record": every visible exhibit with NO CustodyCurrentState
  // row — a left-anti-join via the set of ids that DO have a row.
  const custodiedExhibitIds = new Set(custodyRows.map((r) => r.exhibit.id));
  const allVisible = await prisma.exhibit.findMany({
    where: { caseId, ...sealedFilter },
    select: {
      id: true,
      exhibitLabel: true,
      currentState: { select: { currentStatus: true } },
    },
  });
  const noCustodian: CustodyGroupExhibit[] = allVisible
    .filter((e) => !custodiedExhibitIds.has(e.id))
    .map((e) => ({
      exhibitId: e.id,
      exhibitLabel: e.exhibitLabel,
      currentStatus: e.currentState?.currentStatus ?? null,
    }));

  return {
    groups: [...byCustodian.values()].sort((a, b) =>
      a.custodianName.localeCompare(b.custodianName),
    ),
    noCustodian,
  };
}
