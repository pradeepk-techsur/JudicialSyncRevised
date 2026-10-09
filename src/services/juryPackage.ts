import type {
  ExhibitEvent,
  ExhibitStatus,
  JuryPackage,
  JuryPackageExhibit,
  Prisma,
  PrismaClient,
  Role,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ConflictError, NotFoundError, RoleNotPermittedError, UnprocessableError } from '@/lib/errors';
import type { DiscrepancyFlagSummary } from '@/lib/types';
import { ruleLabel } from '@/lib/discrepancyLabels';
import { canViewSealed } from '@/services/visibility';
import { recordEvent } from '@/services/events';
import { evaluateDiscrepancies, getExhibitDiscrepancies } from '@/services/discrepancies';

// F5 — Jury-Ready Exhibit List Generation (discrepancy-gated).
//
// This service is the server-side authority for the jury package: candidate
// computation, one-living-DRAFT initiate, a strictly READ-ONLY reconciling GET
// (ROADMAP criterion 5 — never a side-effect draft), and a fresh-gated finalize.
//
// SEALED-MEMBERSHIP POLICY (F13 — supersedes the pre-Phase-7 design):
// A sealed/ex-parte exhibit is now STRUCTURALLY EXCLUDED from jury-package
// membership itself, not merely from the role-filtered view. `computeJuryCandidates`
// filters `isSealed: false` in the SAME query as the ADMITTED filter, so a sealed
// exhibit's JuryPackageExhibit row can never be created by the normal computation
// path. (This closes the highest-severity defect motivating Phase 7: a sealed
// exhibit could previously be admitted into a package and shown like any other.)
//
// Non-sealed membership remains CASE TRUTH and viewer-independent — computed over
// all ADMITTED, non-sealed exhibits regardless of the acting role; role-based
// view filtering in toView() is an additional, orthogonal narrowing. A LEGACY
// JuryPackageExhibit row for a sealed-but-still-ADMITTED exhibit (predating this
// fix) is deliberately RETAINED by reconcileDraftMembership — never silently
// deleted — so it can be explicitly remediated by the exclude workflow (plan
// 07-07). Staleness is therefore computed from the exhibit's ACTUAL currentStatus,
// not from absence in the sealed-filtered candidate set.

// A Prisma client OR an interactive-transaction client (mirrors events.ts /
// discrepancies.ts) so finalize can re-evaluate + gate + finalize atomically.
type PrismaLike = PrismaClient | Prisma.TransactionClient;

/** Roles permitted to initiate/finalize a jury package (F5). */
const JURY_WRITE_ROLES = new Set<Role>(['DEPUTY', 'CLERK', 'ADMIN']);

/**
 * One row of the jury-package exhibit list as returned to the client.
 *
 * NOTE (divergence from TechArch 03-api.md — recorded in 03-02 SUMMARY): this
 * interface extends the TechArch shape with ONE additive field, `flags`. The
 * TechArch `discrepancyStatus: CLEAN|FLAGGED` collapses OPEN and ACKNOWLEDGED,
 * but 03-04's hard-disabled finalize gate must block ONLY on OPEN and re-enable
 * once all flags are acknowledged. `flags[]` carries exactly enough per-flag
 * detail (`{ ruleCode, status, label }`) for both per-flag badge styling AND the
 * `flags.some(f => f.status === 'OPEN')` gate computation client-side.
 */
export interface JuryPackageExhibitView {
  exhibitId: string;
  exhibitLabel: string;
  currentStatus: ExhibitStatus; // ADMITTED for all rows
  discrepancyStatus: 'CLEAN' | 'FLAGGED'; // LIVE, freshly evaluated; backward-compat with TechArch
  flags: DiscrepancyFlagSummary[]; // ADDITIVE per-flag OPEN/ACKNOWLEDGED; empty [] when CLEAN
  isSealed: boolean; // ADDITIVE (F13): drives the CRITICAL-row UI treatment (⛔ ex parte)
  status: 'INCLUDED'; // ADDITIVE (F13): the view NEVER contains EXCLUDED rows (filtered in toView)
  addedAt: string;
}

/** A membership candidate: an ADMITTED exhibit, carrying its sealed flag so the
 *  view layer (and only the view layer) can role-filter it out. */
export interface JuryCandidate {
  exhibitId: string;
  exhibitLabel: string;
  currentStatus: 'ADMITTED';
  isSealed: boolean;
}

/**
 * The ADMITTED, NON-SEALED exhibits of a case — the jury-package MEMBERSHIP set.
 *
 * F13: sealed/ex-parte exhibits are EXCLUDED FROM MEMBERSHIP here, via an
 * `isSealed: false` predicate applied in the SAME query as the ADMITTED filter —
 * a sealed exhibit's row is never materialized as a candidate at all, so it can
 * never become a JuryPackageExhibit member through the normal computation path.
 * (Before F13 this function returned sealed exhibits too and relied solely on
 * toView() to drop them per-role; that left sealed exhibits as real member rows,
 * the highest-severity defect Phase 7 fixes.)
 *
 * Each candidate still carries `isSealed` for callers that want it, though it is
 * now always `false` here. The `requestingUserRole` param is retained for
 * signature symmetry with the view-shaping callers but does not change membership.
 */
export async function computeJuryCandidates(
  caseId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  requestingUserRole: Role,
  client?: PrismaLike,
): Promise<JuryCandidate[]> {
  const db = client ?? prisma;
  const rows = await db.exhibitCurrentState.findMany({
    where: { currentStatus: 'ADMITTED', exhibit: { caseId, isSealed: false } },
    select: {
      exhibit: { select: { id: true, exhibitLabel: true, isSealed: true } },
    },
    orderBy: { exhibit: { exhibitLabel: 'asc' } },
  });
  return rows.map((r) => ({
    exhibitId: r.exhibit.id,
    exhibitLabel: r.exhibit.exhibitLabel,
    currentStatus: 'ADMITTED' as const,
    isSealed: r.exhibit.isSealed,
  }));
}

/**
 * Build the live discrepancy projection for one exhibit: its fresh
 * OPEN+ACKNOWLEDGED flags mapped to DiscrepancyFlagSummary[], plus the
 * collapsed CLEAN|FLAGGED hint. `flags[]` is ALWAYS freshly computed, never read
 * from the stored discrepancy_status column.
 */
async function liveFlags(
  exhibitId: string,
): Promise<{ flags: DiscrepancyFlagSummary[]; discrepancyStatus: 'CLEAN' | 'FLAGGED' }> {
  const active = await getExhibitDiscrepancies(exhibitId);
  const flags: DiscrepancyFlagSummary[] = active.map((f) => ({
    ruleCode: f.ruleCode,
    status: f.status as 'OPEN' | 'ACKNOWLEDGED',
    label: ruleLabel(f.ruleCode),
  }));
  return { flags, discrepancyStatus: flags.length > 0 ? 'FLAGGED' : 'CLEAN' };
}

/**
 * Shape the role-filtered, live view from a set of member candidates.
 *
 * Two orthogonal narrowings happen here and ONLY here:
 *  1. F13 status filter — an EXCLUDED JuryPackageExhibit row is NEVER part of the
 *     returned view (per F13 point 6). The persisted status lives on the row, not
 *     on the candidate, so it is threaded in via `statusByExhibit`; a member with
 *     no persisted status yet (a fresh initiate-loop row) is treated as INCLUDED,
 *     matching the schema default.
 *  2. Sealed role filter — drops rows that are `isSealed && !canViewSealed(role)`.
 *
 * A kept row carries `isSealed` (drives the CRITICAL-row UI) and a `status` that
 * is always `'INCLUDED'` by construction. Each row's `flags`/`discrepancyStatus`
 * are freshly computed; `addedAt` comes from the persisted membership row.
 */
async function toView(
  members: JuryCandidate[],
  requestingUserRole: Role,
  addedAtByExhibit: Map<string, Date>,
  statusByExhibit: Map<string, 'INCLUDED' | 'EXCLUDED'>,
): Promise<JuryPackageExhibitView[]> {
  const included = members.filter(
    (m) => statusByExhibit.get(m.exhibitId) !== 'EXCLUDED',
  );
  const visible = included.filter(
    (m) => !(m.isSealed && !canViewSealed(requestingUserRole)),
  );
  const rows: JuryPackageExhibitView[] = [];
  for (const m of visible) {
    const { flags, discrepancyStatus } = await liveFlags(m.exhibitId);
    rows.push({
      exhibitId: m.exhibitId,
      exhibitLabel: m.exhibitLabel,
      currentStatus: 'ADMITTED',
      discrepancyStatus,
      flags,
      isSealed: m.isSealed,
      status: 'INCLUDED',
      addedAt: (addedAtByExhibit.get(m.exhibitId) ?? new Date()).toISOString(),
    });
  }
  return rows;
}

/** Resolve an actor's ACTUAL role and reject if not permitted to write (T-03-05). */
async function assertJuryWriteRole(actorUserId: string): Promise<void> {
  const actor = await prisma.user.findUnique({
    where: { id: actorUserId },
    select: { role: true },
  });
  if (!actor || !JURY_WRITE_ROLES.has(actor.role)) {
    throw new RoleNotPermittedError();
  }
}

/**
 * Reconcile an existing DRAFT's persisted membership to the live ADMITTED set
 * (full-visibility, viewer-independent): add rows for newly-admitted exhibits,
 * remove rows for exhibits no longer ADMITTED, and refresh each surviving row's
 * stored CLEAN/FLAGGED hint. Returns the reconciled membership candidates.
 *
 * This MAY write — it is a legitimate reconcile of an EXISTING draft, explicitly
 * distinct from "creating a draft on view" (which is prohibited).
 */
async function reconcileDraftMembership(
  caseId: string,
  juryPackageId: string,
): Promise<{
  members: JuryCandidate[];
  addedAtByExhibit: Map<string, Date>;
  statusByExhibit: Map<string, 'INCLUDED' | 'EXCLUDED'>;
}> {
  const candidates = await computeJuryCandidates(caseId, 'ADMIN' /* full-visibility lens */);

  const existingRows = await prisma.juryPackageExhibit.findMany({
    where: { juryPackageId },
    select: { id: true, exhibitId: true, addedAt: true, status: true },
  });
  const existingByExhibit = new Map(existingRows.map((r) => [r.exhibitId, r]));

  // Determine staleness from each existing row's exhibit's ACTUAL currentStatus
  // (a direct, unfiltered query), NOT from absence in `candidates` — `candidates`
  // is sealed-filtered post-F13, so a sealed-but-still-ADMITTED row would be
  // absent from it yet is NOT stale.
  const existingExhibitIds = existingRows.map((r) => r.exhibitId);
  const actualStates = await prisma.exhibitCurrentState.findMany({
    where: { exhibitId: { in: existingExhibitIds } },
    select: { exhibitId: true, currentStatus: true },
  });
  const stillAdmitted = new Set(
    actualStates.filter((s) => s.currentStatus === 'ADMITTED').map((s) => s.exhibitId),
  );
  // A row is stale ONLY when its exhibit is no longer ADMITTED at all — NOT
  // merely because it's sealed and therefore absent from `candidates` (F13: a
  // sealed-but-still-ADMITTED row must be RETAINED, never silently deleted, so
  // it can be explicitly remediated via the exclude workflow in plan 07-07).
  const staleRowIds = existingRows
    .filter((r) => !stillAdmitted.has(r.exhibitId))
    .map((r) => r.id);

  // Add rows for newly-admitted exhibits.
  const newCandidates = candidates.filter((c) => !existingByExhibit.has(c.exhibitId));

  await prisma.$transaction(async (tx) => {
    if (staleRowIds.length > 0) {
      await tx.juryPackageExhibit.deleteMany({ where: { id: { in: staleRowIds } } });
    }
    for (const c of newCandidates) {
      const { discrepancyStatus } = await liveFlags(c.exhibitId);
      await tx.juryPackageExhibit.create({
        data: {
          juryPackageId,
          exhibitId: c.exhibitId,
          discrepancyStatus,
        },
      });
    }
    // Refresh surviving rows' stored hint so it never silently diverges.
    for (const c of candidates) {
      if (existingByExhibit.has(c.exhibitId)) {
        const { discrepancyStatus } = await liveFlags(c.exhibitId);
        await tx.juryPackageExhibit.updateMany({
          where: { juryPackageId, exhibitId: c.exhibitId },
          data: { discrepancyStatus },
        });
      }
    }
  });

  // Rebuild the membership + maps from the ACTUAL persisted rows after reconcile.
  // Members are derived from the persisted JuryPackageExhibit rows (not from the
  // sealed-filtered `candidates`) so a RETAINED legacy sealed-but-ADMITTED row —
  // absent from `candidates` post-F13 but kept in the DB — is still surfaced as a
  // member, letting toView() render it as the CRITICAL blocker and offer the
  // Remove-from-Package action (F13). Each member carries its real `isSealed`.
  const finalRows = await prisma.juryPackageExhibit.findMany({
    where: { juryPackageId },
    select: {
      exhibitId: true,
      addedAt: true,
      status: true,
      exhibit: { select: { exhibitLabel: true, isSealed: true } },
    },
    orderBy: { exhibit: { exhibitLabel: 'asc' } },
  });
  const addedAtByExhibit = new Map(finalRows.map((r) => [r.exhibitId, r.addedAt]));
  const statusByExhibit = new Map<string, 'INCLUDED' | 'EXCLUDED'>(
    finalRows.map((r) => [r.exhibitId, r.status]),
  );
  const members: JuryCandidate[] = finalRows.map((r) => ({
    exhibitId: r.exhibitId,
    exhibitLabel: r.exhibit.exhibitLabel,
    currentStatus: 'ADMITTED' as const,
    isSealed: r.exhibit.isSealed,
  }));
  return { members, addedAtByExhibit, statusByExhibit };
}

/**
 * EXPLICIT initiate (POST). Role-gated (DEPUTY/CLERK/ADMIN). One-living-DRAFT and
 * idempotent: an existing DRAFT is reconciled and returned (never a duplicate);
 * a case whose most recent package is FINALIZED gets a NEW DRAFT. Membership is
 * full-visibility; the returned view is role-filtered.
 */
export async function initiateJuryPackage(
  caseId: string,
  actorUserId: string,
  requestingUserRole: Role,
): Promise<{ juryPackage: JuryPackage; exhibits: JuryPackageExhibitView[] }> {
  await assertJuryWriteRole(actorUserId);

  // One-living-DRAFT: reuse an existing DRAFT rather than creating a second.
  const existingDraft = await prisma.juryPackage.findFirst({
    where: { caseId, status: 'DRAFT' },
    orderBy: { createdAt: 'desc' },
  });
  if (existingDraft) {
    const { members, addedAtByExhibit, statusByExhibit } = await reconcileDraftMembership(
      caseId,
      existingDraft.id,
    );
    const exhibits = await toView(members, requestingUserRole, addedAtByExhibit, statusByExhibit);
    return { juryPackage: existingDraft, exhibits };
  }

  // No living DRAFT → create a fresh one from current candidates (full-visibility).
  const candidates = await computeJuryCandidates(caseId, 'ADMIN');
  if (candidates.length === 0) {
    throw new UnprocessableError(
      'NO_ELIGIBLE_EXHIBITS',
      'No admitted exhibits are eligible for a jury package',
    );
  }

  const juryPackage = await prisma.$transaction(async (tx) => {
    const pkg = await tx.juryPackage.create({
      data: { caseId, status: 'DRAFT' },
    });
    for (const c of candidates) {
      const { discrepancyStatus } = await liveFlags(c.exhibitId);
      await tx.juryPackageExhibit.create({
        data: {
          juryPackageId: pkg.id,
          exhibitId: c.exhibitId,
          discrepancyStatus,
        },
      });
    }
    return pkg;
  });

  const rows = await prisma.juryPackageExhibit.findMany({
    where: { juryPackageId: juryPackage.id },
    select: { exhibitId: true, addedAt: true, status: true },
  });
  const addedAtByExhibit = new Map(rows.map((r) => [r.exhibitId, r.addedAt]));
  // A fresh initiate's rows are all newly-created INCLUDED candidates; map their
  // persisted status (defaulting any not-yet-readable row to INCLUDED, the schema
  // default) so toView's F13 filter has a complete map.
  const statusByExhibit = new Map<string, 'INCLUDED' | 'EXCLUDED'>(
    rows.map((r) => [r.exhibitId, r.status]),
  );
  for (const c of candidates) {
    if (!statusByExhibit.has(c.exhibitId)) statusByExhibit.set(c.exhibitId, 'INCLUDED');
  }
  const exhibits = await toView(candidates, requestingUserRole, addedAtByExhibit, statusByExhibit);
  return { juryPackage, exhibits };
}

/**
 * READ-ONLY accessor (ROADMAP criterion 5 + F11). MUST NOT create a package as a
 * side effect.
 *
 * SUPERSESSION NOTE (recorded in SUMMARY): ROADMAP criterion 5 ("never create on
 * view") SUPERSEDES both CONTEXT line 23's "...returns the existing DRAFT or
 * creates one" wording AND Y1-api's non-nullable GET response type. GET returns
 * `juryPackage: null` when none exists (creating nothing), and reconcile-only
 * (never create) on an existing DRAFT.
 */
export async function getJuryPackage(
  caseId: string,
  requestingUserRole: Role,
): Promise<{ juryPackage: JuryPackage | null; exhibits: JuryPackageExhibitView[] }> {
  const latest = await prisma.juryPackage.findFirst({
    where: { caseId },
    orderBy: { createdAt: 'desc' },
  });

  // No package ever started → the "no package yet" state. Create nothing.
  if (!latest) {
    return { juryPackage: null, exhibits: [] };
  }

  if (latest.status === 'FINALIZED') {
    // Read-only finalized snapshot: map persisted membership rows to the view,
    // dropping sealed rows the requesting role can't see. Membership untouched.
    const rows = await prisma.juryPackageExhibit.findMany({
      where: { juryPackageId: latest.id },
      select: {
        exhibitId: true,
        addedAt: true,
        status: true,
        exhibit: { select: { exhibitLabel: true, isSealed: true } },
      },
    });
    const members: JuryCandidate[] = rows.map((r) => ({
      exhibitId: r.exhibitId,
      exhibitLabel: r.exhibit.exhibitLabel,
      currentStatus: 'ADMITTED' as const,
      isSealed: r.exhibit.isSealed,
    }));
    const addedAtByExhibit = new Map(rows.map((r) => [r.exhibitId, r.addedAt]));
    const statusByExhibit = new Map<string, 'INCLUDED' | 'EXCLUDED'>(
      rows.map((r) => [r.exhibitId, r.status]),
    );
    const exhibits = await toView(members, requestingUserRole, addedAtByExhibit, statusByExhibit);
    return { juryPackage: latest, exhibits };
  }

  // DRAFT → reconcile membership to the live ADMITTED set (viewer-independent),
  // then return the role-filtered live view. Reconcile MAY write; it never
  // CREATES a package.
  const { members, addedAtByExhibit, statusByExhibit } = await reconcileDraftMembership(
    caseId,
    latest.id,
  );
  const exhibits = await toView(members, requestingUserRole, addedAtByExhibit, statusByExhibit);
  return { juryPackage: latest, exhibits };
}

/**
 * Finalize with a hard gate re-evaluated FRESH over MEMBERSHIP (all
 * JuryPackageExhibit rows — INCLUDING sealed exhibits the acting user cannot
 * see), never a role-filtered view and never the cached discrepancy_status
 * column (T-03-07). An exhibit BLOCKS iff it has ≥1 OPEN flag; ACKNOWLEDGED and
 * RESOLVED satisfy the gate. A 409 names the blocking exhibits via `details`.
 */
export async function finalizeJuryPackage(
  juryPackageId: string,
  actorUserId: string,
  // acknowledgedDiscrepancyIds is accepted for API symmetry; acknowledgment is
  // performed via acknowledgeDiscrepancy before finalize, so the gate simply
  // reads current flag state. Retained so the route contract is stable.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  acknowledgedDiscrepancyIds?: string[],
): Promise<{ juryPackage: JuryPackage }> {
  const pkg = await prisma.juryPackage.findUnique({ where: { id: juryPackageId } });
  if (!pkg) {
    throw new NotFoundError('JURY_PACKAGE_NOT_FOUND', 'No jury package found with the given ID');
  }
  if (pkg.status === 'FINALIZED') {
    throw new ConflictError(
      'JURY_PACKAGE_ALREADY_FINALIZED',
      'This jury package has already been finalized',
    );
  }

  await assertJuryWriteRole(actorUserId);

  const finalized = await prisma.$transaction(async (tx) => {
    // MEMBERSHIP = all INCLUDED rows (incl. sealed ones the actor cannot see);
    // the gate reads membership, not a role-filtered view. F13: an EXCLUDED row is
    // never evaluated against the discrepancy gate (point 7).
    const members = await tx.juryPackageExhibit.findMany({
      where: { juryPackageId, status: 'INCLUDED' },
      select: {
        exhibitId: true,
        exhibit: { select: { exhibitLabel: true } },
      },
    });

    const blockingExhibits: { exhibitId: string; exhibitLabel: string; ruleCodes: string[] }[] = [];

    for (const m of members) {
      // FRESH re-evaluation so flags reflect current state, inside the finalize
      // transaction for atomicity.
      await evaluateDiscrepancies(m.exhibitId, tx);
      const active = await tx.discrepancyFlag.findMany({
        where: { exhibitId: m.exhibitId, status: 'OPEN' },
        select: { ruleCode: true },
      });
      if (active.length > 0) {
        blockingExhibits.push({
          exhibitId: m.exhibitId,
          exhibitLabel: m.exhibit.exhibitLabel,
          ruleCodes: active.map((f) => f.ruleCode),
        });
      }
    }

    if (blockingExhibits.length > 0) {
      throw new ConflictError(
        'JURY_PACKAGE_DISCREPANCIES_OPEN',
        `Cannot finalize: ${blockingExhibits.length} exhibit(s) have unresolved discrepancies`,
        { blockingExhibits },
      );
    }

    return tx.juryPackage.update({
      where: { id: juryPackageId },
      data: { status: 'FINALIZED', finalizedAt: new Date(), finalizedBy: actorUserId },
    });
  });

  return { juryPackage: finalized };
}

/**
 * Explicitly EXCLUDE one INCLUDED jury-package exhibit row (F13).
 *
 * This is the human-remediation half of F13: plan 07-03 made it structurally
 * impossible for a NEW sealed exhibit to become a member, and this function lets
 * an authorized user permanently remove a LEGACY/regression row (e.g. a
 * sealed-but-ADMITTED row predating the fix) from a DRAFT package.
 *
 * AUDIT CONTRACT (T-07-14): the row is UPDATED (status → EXCLUDED, with
 * excludedAt/excludedBy/exclusionReason populated) — NEVER deleted — and the
 * exclusion is paired with an immutable JURY_PACKAGE_EXHIBIT_EXCLUDED ledger
 * event via recordEvent (the sole ledger writer), so the removal is a permanent,
 * auditable record rather than a silent disappearance.
 *
 * Ordering mirrors finalizeJuryPackage: existence check → finalized-immutability
 * check (409, BEFORE any role check or write, T-07-13) → role gate (403 via the
 * actor's ACTUAL User.role, never a client claim, T-07-12) → INCLUDED-row lookup
 * → transactional event + update.
 */
export async function excludeJuryPackageExhibit(args: {
  juryPackageId: string;
  exhibitId: string;
  actorUserId: string;
  reason: 'SEALED_EXPARTE' | 'MANUAL_REMOVAL';
  note?: string;
}): Promise<{ event: ExhibitEvent; juryPackageExhibit: JuryPackageExhibit }> {
  const { juryPackageId, exhibitId, actorUserId, reason, note } = args;

  const pkg = await prisma.juryPackage.findUnique({ where: { id: juryPackageId } });
  if (!pkg) {
    throw new NotFoundError('JURY_PACKAGE_NOT_FOUND', 'No jury package found with the given ID');
  }
  if (pkg.status === 'FINALIZED') {
    throw new ConflictError(
      'JURY_PACKAGE_ALREADY_FINALIZED',
      'This jury package has already been finalized',
    );
  }

  await assertJuryWriteRole(actorUserId);

  const row = await prisma.juryPackageExhibit.findFirst({
    where: { juryPackageId, exhibitId, status: 'INCLUDED' },
  });
  if (!row) {
    throw new NotFoundError(
      'JURY_PACKAGE_EXHIBIT_NOT_FOUND',
      'No included jury-package exhibit row found for this exhibit',
    );
  }

  return prisma.$transaction(async (tx) => {
    const event = await recordEvent(
      {
        exhibitId,
        eventType: 'JURY_PACKAGE_EXHIBIT_EXCLUDED',
        payload: { juryPackageId, exhibitId, reason, note },
        actorUserId,
      },
      tx,
    );
    const juryPackageExhibit = await tx.juryPackageExhibit.update({
      where: { id: row.id },
      data: {
        status: 'EXCLUDED',
        excludedAt: new Date(),
        excludedBy: actorUserId,
        exclusionReason: reason,
      },
    });
    return { event, juryPackageExhibit };
  });
}
