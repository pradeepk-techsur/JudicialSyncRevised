import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createExhibit } from '@/services/exhibits';
import { recordStatusChange } from '@/services/status';
import { recordObjection } from '@/services/objections';
import { recordCustodyTransfer } from '@/services/custody';
import { evaluateDiscrepancies } from '@/services/discrepancies';
import { getAttentionFeed, type AttentionTier } from '@/services/attentionFeed';

// Integration tests for getAttentionFeed (F8 §Process step 4) against the shared
// Postgres. A SELF-CONTAINED fixture case (unique caseNumber), one exhibit per
// tier condition, built through the live write paths — with a local direct-
// construction ADMITTED helper (mirroring discrepancies.test.ts's
// forceAdmitBypassingGate) to deterministically produce the legacy
// "ADMITTED-with-an-open-issue" preconditions the F12 gate otherwise forbids, so
// the resulting discrepancy flags are REAL (survive fresh re-evaluation).

// Directly append a STATUS_CHANGE → ADMITTED ledger event + projection upsert,
// bypassing the F12 admission gate, then evaluate discrepancies so the flag is
// genuine. Mirrors discrepancies.test.ts's forceAdmitBypassingGate.
async function forceAdmit(exhibitId: string, caseId: string, actorUserId: string): Promise<void> {
  const agg = await prisma.exhibitEvent.aggregate({
    where: { exhibitId },
    _max: { sequenceNo: true },
  });
  const event = await prisma.exhibitEvent.create({
    data: {
      exhibitId,
      caseId,
      eventType: 'STATUS_CHANGE',
      payload: { fromStatus: 'OFFERED', toStatus: 'ADMITTED' },
      actorUserId,
      sequenceNo: (agg._max.sequenceNo ?? 0) + 1,
    },
  });
  await prisma.exhibitCurrentState.upsert({
    where: { exhibitId },
    create: {
      exhibitId,
      currentStatus: 'ADMITTED',
      lastStatusEventId: event.id,
      lastStatusAt: event.recordedAt,
    },
    update: {
      currentStatus: 'ADMITTED',
      lastStatusEventId: event.id,
      lastStatusAt: event.recordedAt,
    },
  });
  await evaluateDiscrepancies(exhibitId);
}

describe('getAttentionFeed (F8) against a self-contained fixture case', () => {
  let caseId: string;
  let criticalExhibitId: string;
  let highExhibitId: string;
  let pendingExhibitId: string;
  let mediumExhibitId: string;

  beforeAll(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const kase = await prisma.case.create({
      data: {
        caseNumber: `TEST-ATTENTION-${suffix}`,
        title: 'Attention Feed Service Test Case',
        court: 'Test Court',
      },
    });
    caseId = kase.id;

    const judge = await prisma.user.create({ data: { caseId, name: 'Judge J', role: 'JUDGE' } });
    const deputy = await prisma.user.create({ data: { caseId, name: 'Deputy D', role: 'DEPUTY' } });

    // CRITICAL — a SEALED exhibit that is an INCLUDED member of a jury package.
    const criticalExhibit = await createExhibit({
      caseId,
      exhibitLabel: `CRIT-${suffix}`,
      description: 'sealed, in jury package',
      offeringParty: 'PROSECUTION',
      isSealed: true,
    });
    criticalExhibitId = criticalExhibit.id;
    await recordStatusChange({ exhibitId: criticalExhibitId, toStatus: 'MARKED', actorUserId: deputy.id });
    await recordStatusChange({ exhibitId: criticalExhibitId, toStatus: 'OFFERED', actorUserId: deputy.id });
    await recordCustodyTransfer({
      exhibitId: criticalExhibitId,
      fromCustodianUserId: null,
      toCustodianUserId: deputy.id,
      actorUserId: deputy.id,
    });
    await forceAdmit(criticalExhibitId, caseId, deputy.id);
    const pkg = await prisma.juryPackage.create({ data: { caseId, status: 'DRAFT' } });
    await prisma.juryPackageExhibit.create({
      data: {
        juryPackageId: pkg.id,
        exhibitId: criticalExhibitId,
        discrepancyStatus: 'CLEAN',
        status: 'INCLUDED',
      },
    });

    // HIGH — ADMITTED with an open, UNRESOLVED objection (fires
    // UNRESOLVED_OBJECTION_JURY_ELIGIBLE). Custody recorded so the ONLY open flag
    // is the objection one (not ADMITTED_NO_CUSTODIAN).
    const highExhibit = await createExhibit({
      caseId,
      exhibitLabel: `HIGH-${suffix}`,
      description: 'admitted with unresolved objection',
      offeringParty: 'DEFENSE',
    });
    highExhibitId = highExhibit.id;
    await recordStatusChange({ exhibitId: highExhibitId, toStatus: 'MARKED', actorUserId: deputy.id });
    await recordStatusChange({ exhibitId: highExhibitId, toStatus: 'OFFERED', actorUserId: deputy.id });
    await recordObjection({
      exhibitId: highExhibitId,
      objectingParty: 'PROSECUTION',
      grounds: 'Hearsay',
      actorUserId: judge.id,
    });
    await recordCustodyTransfer({
      exhibitId: highExhibitId,
      fromCustodianUserId: null,
      toCustodianUserId: deputy.id,
      actorUserId: deputy.id,
    });
    await forceAdmit(highExhibitId, caseId, deputy.id);

    // PENDING — UNRESOLVED objection, exhibit still OFFERED/OBJECTED (not admitted).
    const pendingExhibit = await createExhibit({
      caseId,
      exhibitLabel: `PEND-${suffix}`,
      description: 'objection unresolved, not admitted',
      offeringParty: 'PLAINTIFF',
    });
    pendingExhibitId = pendingExhibit.id;
    await recordStatusChange({ exhibitId: pendingExhibitId, toStatus: 'MARKED', actorUserId: deputy.id });
    await recordStatusChange({ exhibitId: pendingExhibitId, toStatus: 'OFFERED', actorUserId: deputy.id });
    await recordObjection({
      exhibitId: pendingExhibitId,
      objectingParty: 'DEFENSE',
      grounds: 'Relevance',
      actorUserId: judge.id,
    });

    // MEDIUM — ADMITTED, no custody at all (fires ADMITTED_NO_CUSTODIAN).
    const mediumExhibit = await createExhibit({
      caseId,
      exhibitLabel: `MED-${suffix}`,
      description: 'admitted, no custodian',
      offeringParty: 'PROSECUTION',
    });
    mediumExhibitId = mediumExhibit.id;
    await recordStatusChange({ exhibitId: mediumExhibitId, toStatus: 'MARKED', actorUserId: deputy.id });
    await recordStatusChange({ exhibitId: mediumExhibitId, toStatus: 'OFFERED', actorUserId: deputy.id });
    await forceAdmit(mediumExhibitId, caseId, deputy.id);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('ranks CRITICAL → HIGH → PENDING → MEDIUM with ZERO interleaving', async () => {
    const feed = await getAttentionFeed(caseId, 'JUDGE');

    // Every seeded tier is represented.
    const tiers = feed.map((e) => e.tier);
    expect(tiers).toContain('CRITICAL');
    expect(tiers).toContain('HIGH');
    expect(tiers).toContain('PENDING');
    expect(tiers).toContain('MEDIUM');

    // Tiers never interleave: the sequence of tier values must be
    // non-decreasing in the fixed CRITICAL<HIGH<PENDING<MEDIUM rank order.
    const rank: Record<AttentionTier, number> = {
      CRITICAL: 0,
      HIGH: 1,
      PENDING: 2,
      MEDIUM: 3,
    };
    for (let i = 1; i < feed.length; i++) {
      expect(rank[feed[i].tier]).toBeGreaterThanOrEqual(rank[feed[i - 1].tier]);
    }
  });

  it('orders entries newest-first WITHIN each tier', async () => {
    const feed = await getAttentionFeed(caseId, 'JUDGE');
    const byTier = new Map<AttentionTier, string[]>();
    for (const e of feed) {
      const arr = byTier.get(e.tier) ?? [];
      arr.push(e.detectedAt);
      byTier.set(e.tier, arr);
    }
    for (const [, times] of byTier) {
      const ts = times.map((t) => new Date(t).getTime());
      expect(ts).toEqual([...ts].sort((a, b) => b - a));
    }
  });

  it('counts an ADMITTED-with-unresolved-objection exhibit ONLY in HIGH, never also PENDING', async () => {
    const feed = await getAttentionFeed(caseId, 'JUDGE');
    const high = feed.filter((e) => e.exhibitId === highExhibitId);
    expect(high.length).toBe(1);
    expect(high[0].tier).toBe('HIGH');
    // The same exhibit must NOT appear as a PENDING entry.
    expect(feed.some((e) => e.exhibitId === highExhibitId && e.tier === 'PENDING')).toBe(false);
    // The pending exhibit is ONLY in PENDING.
    const pend = feed.filter((e) => e.exhibitId === pendingExhibitId);
    expect(pend.length).toBe(1);
    expect(pend[0].tier).toBe('PENDING');
  });

  it('surfaces a sealed CRITICAL entry for JUDGE but never for DEPUTY', async () => {
    const judgeFeed = await getAttentionFeed(caseId, 'JUDGE');
    expect(judgeFeed.some((e) => e.exhibitId === criticalExhibitId && e.tier === 'CRITICAL')).toBe(
      true,
    );

    const deputyFeed = await getAttentionFeed(caseId, 'DEPUTY');
    // The sealed CRITICAL row is structurally ABSENT for DEPUTY.
    expect(deputyFeed.some((e) => e.exhibitId === criticalExhibitId)).toBe(false);
    expect(deputyFeed.some((e) => e.tier === 'CRITICAL')).toBe(false);
  });

  it('carries the documented AttentionFeedEntry fields incl. an availableAction per tier', async () => {
    const feed = await getAttentionFeed(caseId, 'JUDGE');
    const critical = feed.find((e) => e.tier === 'CRITICAL');
    const high = feed.find((e) => e.tier === 'HIGH');
    const pending = feed.find((e) => e.tier === 'PENDING');
    const medium = feed.find((e) => e.tier === 'MEDIUM');

    expect(critical!.availableAction).toBe('REMOVE_FROM_PACKAGE');
    expect(high!.availableAction).toBe('RECORD_RULING');
    expect(high!.objectionId).toBeDefined();
    expect(pending!.availableAction).toBe('RECORD_RULING');
    expect(pending!.objectionId).toBeDefined();
    expect(medium!.availableAction).toBe('TRANSFER_CUSTODY');

    for (const e of feed) {
      expect(typeof e.id).toBe('string');
      expect(typeof e.ruleCode).toBe('string');
      expect(typeof e.summary).toBe('string');
      expect(new Date(e.detectedAt).toISOString()).toBe(e.detectedAt);
    }
  });
});
