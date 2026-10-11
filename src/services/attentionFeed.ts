import type { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { canViewSealed } from '@/services/visibility';

// F8 — Trial Command Center: "Needs your attention" feed (FRD
// F08-trial-command-center-screen.md §Process step 4). A READ-ONLY, 4-tier
// ranked rule evaluator over EXISTING projections (JuryPackageExhibit,
// DiscrepancyFlag, ObjectionCurrentState, ExhibitCurrentState) — zero new
// tables, zero new indexes.
//
// Ranking (F08 §Process steps 4-5): CRITICAL → HIGH → PENDING → MEDIUM, each
// tier's own query already newest-first, the tiers CONCATENATED in that fixed
// order — never a single global sort by detectedAt (which would interleave
// tiers, explicitly forbidden). An objection thread is counted in HIGH OR
// PENDING, never both — disambiguated SOLELY by the exhibit's currentStatus at
// evaluation time (ADMITTED → HIGH; OFFERED/OBJECTED → PENDING).
//
// Phase-8 CRITICAL-tier substitution: F16's `classification != 'TRIAL'` does not
// exist as a column (Phase 7.1 skipped), so the CRITICAL tier uses
// `exhibit.isSealed = true` — the EXACT same substitution juryPackage.ts's
// existing CRITICAL-row treatment already makes. A sealed CRITICAL row is only
// surfaced to a role that can view sealed at all, so it never leaks via the feed
// (threat T-08-10).

export type AttentionTier = 'CRITICAL' | 'HIGH' | 'PENDING' | 'MEDIUM';
export type AttentionAction = 'RECORD_RULING' | 'REMOVE_FROM_PACKAGE' | 'TRANSFER_CUSTODY' | null;

// Phase 9 (09-01) addition: `objectionGrounds` is the one explicitly-sanctioned
// additive field for the Command Center first-viewport rebuild (09-CONTEXT
// decisions). It carries the objection's free-text grounds on HIGH/PENDING-tier
// entries so the attention DataTable can render the grounds inline on the row
// with no extra click. CRITICAL/MEDIUM tiers carry no objection → the field is
// left undefined. This is additive to an existing TS type (not a breaking shape
// change), so no API contract document needs a parallel edit (TechArch/03-api.md
// already describes AttentionFeedEntry generically).
export interface AttentionFeedEntry {
  id: string;
  tier: AttentionTier;
  ruleCode: string;
  exhibitId: string;
  exhibitLabel: string;
  objectionId?: string;
  detectedAt: string;
  summary: string;
  availableAction: AttentionAction;
  /** Objection grounds text — present on HIGH/PENDING tiers only (Phase 9). */
  objectionGrounds?: string;
}

export async function getAttentionFeed(
  caseId: string,
  requestingUserRole: Role,
): Promise<AttentionFeedEntry[]> {
  const sealedVisible = canViewSealed(requestingUserRole);
  const entries: AttentionFeedEntry[] = [];

  // CRITICAL — INCLUDED jury-package row whose exhibit is sealed (Phase-8
  // substitute for F16's classification != 'TRIAL', which does not exist). Only
  // rendered for a role that can see sealed exhibits at all (a sealed row must
  // never leak to an unauthorized role even via this feed).
  if (sealedVisible) {
    const criticalRows = await prisma.juryPackageExhibit.findMany({
      where: {
        status: 'INCLUDED',
        exhibit: { caseId, isSealed: true },
        juryPackage: { caseId },
      },
      include: { exhibit: { select: { id: true, exhibitLabel: true } } },
      orderBy: { addedAt: 'desc' },
    });
    for (const row of criticalRows) {
      entries.push({
        id: `critical-${row.id}`,
        tier: 'CRITICAL',
        ruleCode: 'SEALED_IN_JURY_PACKAGE',
        exhibitId: row.exhibit.id,
        exhibitLabel: row.exhibit.exhibitLabel,
        detectedAt: row.addedAt.toISOString(),
        summary: `${row.exhibit.exhibitLabel} — ex parte material improperly included in jury package`,
        // link-through to F13's existing Remove-from-Package, not a new inline action
        availableAction: 'REMOVE_FROM_PACKAGE',
      });
    }
  }

  // HIGH — ADMITTED with an OPEN UNRESOLVED_OBJECTION_JURY_ELIGIBLE flag.
  const highFlags = await prisma.discrepancyFlag.findMany({
    where: {
      caseId,
      ruleCode: 'UNRESOLVED_OBJECTION_JURY_ELIGIBLE',
      status: 'OPEN',
      ...(sealedVisible ? {} : { exhibit: { isSealed: false } }),
    },
    include: { exhibit: { select: { id: true, exhibitLabel: true } } },
    orderBy: { detectedAt: 'desc' },
  });
  for (const flag of highFlags) {
    const objection = await prisma.objectionCurrentState.findFirst({
      where: { exhibitId: flag.exhibitId, status: 'UNRESOLVED' },
      orderBy: { raisedAt: 'asc' },
    });
    entries.push({
      id: `high-${flag.id}`,
      tier: 'HIGH',
      ruleCode: flag.ruleCode,
      exhibitId: flag.exhibitId,
      exhibitLabel: flag.exhibit.exhibitLabel,
      objectionId: objection?.objectionId,
      detectedAt: flag.detectedAt.toISOString(),
      summary: `${flag.exhibit.exhibitLabel} — admitted with an open, unresolved objection`,
      // Phase 9: surface the objection's grounds inline on the HIGH row. The
      // objection lookup above reads the full row, so grounds is available
      // without an extra query.
      objectionGrounds: objection?.grounds,
      availableAction: 'RECORD_RULING',
    });
  }

  // PENDING — UNRESOLVED objection whose exhibit is OFFERED or OBJECTED (NOT
  // ADMITTED — that case is HIGH above; never counted in both tiers, the
  // exhibit's currentStatus at evaluation time is the sole disambiguator).
  const pendingObjections = await prisma.objectionCurrentState.findMany({
    where: {
      status: 'UNRESOLVED',
      exhibit: {
        caseId,
        currentState: { currentStatus: { in: ['OFFERED', 'OBJECTED'] } },
        ...(sealedVisible ? {} : { isSealed: false }),
      },
    },
    include: { exhibit: { select: { id: true, exhibitLabel: true } } },
    orderBy: { raisedAt: 'desc' },
  });
  for (const obj of pendingObjections) {
    entries.push({
      id: `pending-${obj.objectionId}`,
      tier: 'PENDING',
      ruleCode: 'PENDING_RULING',
      exhibitId: obj.exhibitId,
      exhibitLabel: obj.exhibit.exhibitLabel,
      objectionId: obj.objectionId,
      detectedAt: obj.raisedAt.toISOString(),
      summary: `${obj.exhibit.exhibitLabel} — objection unresolved, not yet admitted`,
      // Phase 9: the PENDING-tier row already carries grounds directly (no extra
      // query) — surface it inline on the row.
      objectionGrounds: obj.grounds,
      availableAction: 'RECORD_RULING',
    });
  }

  // MEDIUM — OPEN ADMITTED_NO_CUSTODIAN flag.
  const mediumFlags = await prisma.discrepancyFlag.findMany({
    where: {
      caseId,
      ruleCode: 'ADMITTED_NO_CUSTODIAN',
      status: 'OPEN',
      ...(sealedVisible ? {} : { exhibit: { isSealed: false } }),
    },
    include: { exhibit: { select: { id: true, exhibitLabel: true } } },
    orderBy: { detectedAt: 'desc' },
  });
  for (const flag of mediumFlags) {
    entries.push({
      id: `medium-${flag.id}`,
      tier: 'MEDIUM',
      ruleCode: flag.ruleCode,
      exhibitId: flag.exhibitId,
      exhibitLabel: flag.exhibit.exhibitLabel,
      detectedAt: flag.detectedAt.toISOString(),
      summary: `${flag.exhibit.exhibitLabel} — admitted, no custodian of record`,
      availableAction: 'TRANSFER_CUSTODY',
    });
  }

  // Tiers are concatenated in CRITICAL→HIGH→PENDING→MEDIUM order and each tier's
  // own query is already newest-first — NEVER a single global sort by detectedAt
  // across tiers (that would interleave them, which F08 §Process step 5
  // explicitly forbids).
  return entries;
}
