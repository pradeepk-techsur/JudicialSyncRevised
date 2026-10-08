import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createExhibit } from '@/services/exhibits';
import { recordStatusChange } from '@/services/status';
import { getExhibitHistory } from '@/services/history';
import { getRecentActivity, type RecentActivityEntry } from '@/services/activity';

// Integration tests for getRecentActivity (F8) against the shared Postgres. Each
// run builds a SELF-CONTAINED fixture case with a unique caseNumber (so it never
// collides with the shared seed under fileParallelism:false), populated ONLY
// through the live service write paths (createExhibit + recordStatusChange) — the
// feed must prove it reads genuine ledger events the live system could produce.

const ENTRY_KEYS = [
  'eventId',
  'eventType',
  'exhibitId',
  'exhibitLabel',
  'summary',
  'recordedAt',
].sort();

describe('getRecentActivity (F8) against a self-contained fixture case', () => {
  let caseId: string;
  let actorUserId: string;
  let visibleExhibitId: string;
  let sealedExhibitId: string;
  let sealedEventId: string;

  beforeAll(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const kase = await prisma.case.create({
      data: {
        caseNumber: `TEST-ACTIVITY-${suffix}`,
        title: 'Recent Activity Service Test Case',
        court: 'Test Court',
      },
    });
    caseId = kase.id;

    const actor = await prisma.user.create({
      data: {
        caseId,
        name: 'Judge Fixture',
        role: 'JUDGE',
      },
    });
    actorUserId = actor.id;

    // A visible exhibit with ≥2 status events on the ledger (MARKED → OFFERED).
    const visible = await createExhibit({
      caseId,
      exhibitLabel: `A-Visible ${suffix}`,
      description: 'An ordinary visible exhibit',
      offeringParty: 'DEFENSE',
    });
    visibleExhibitId = visible.id;
    await recordStatusChange({ exhibitId: visibleExhibitId, toStatus: 'MARKED', actorUserId });
    await recordStatusChange({ exhibitId: visibleExhibitId, toStatus: 'OFFERED', actorUserId });

    // A sealed exhibit with ≥1 status event — a sealed event that must be absent
    // for a role without sealed visibility.
    const sealed = await createExhibit({
      caseId,
      exhibitLabel: `Z-Sealed ${suffix}`,
      description: 'A sealed exhibit — restricted visibility',
      offeringParty: 'PROSECUTION',
      isSealed: true,
    });
    sealedExhibitId = sealed.id;
    const sealedResult = await recordStatusChange({
      exhibitId: sealedExhibitId,
      toStatus: 'MARKED',
      actorUserId,
    });
    sealedEventId = sealedResult.event.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('returns entries newest-first with the exact RecentActivityEntry shape', async () => {
    const feed = await getRecentActivity(caseId, { role: 'JUDGE' });
    expect(feed.length).toBeGreaterThanOrEqual(2);

    for (const entry of feed) {
      expect(Object.keys(entry).sort()).toEqual(ENTRY_KEYS);
      expect(typeof entry.recordedAt).toBe('string');
      // recordedAt is an ISO 8601 string that round-trips.
      expect(new Date(entry.recordedAt).toISOString()).toBe(entry.recordedAt);
    }

    // Ordered recordedAt DESC (non-increasing).
    for (let i = 1; i < feed.length; i++) {
      expect(new Date(feed[i].recordedAt).getTime()).toBeLessThanOrEqual(
        new Date(feed[i - 1].recordedAt).getTime(),
      );
    }
  });

  it('includes a sealed exhibit event for JUDGE but excludes it entirely for ATTORNEY', async () => {
    const judgeIds = (await getRecentActivity(caseId, { role: 'JUDGE' })).map(
      (e) => e.eventId,
    );
    expect(judgeIds).toContain(sealedEventId);

    const attorneyFeed = await getRecentActivity(caseId, { role: 'ATTORNEY' });
    const attorneyIds = attorneyFeed.map((e) => e.eventId);
    // The sealed event is ABSENT — never a redacted row, never counted.
    expect(attorneyIds).not.toContain(sealedEventId);
    // ATTORNEY still sees the visible exhibit's events.
    expect(attorneyFeed.some((e) => e.exhibitId === visibleExhibitId)).toBe(true);
    // No feed entry references the sealed exhibit at all.
    expect(attorneyFeed.some((e) => e.exhibitId === sealedExhibitId)).toBe(false);
  });

  it('builds each summary via the SAME summarizer as getExhibitHistory (wording parity)', async () => {
    const feed = await getRecentActivity(caseId, { role: 'JUDGE' });
    const entry = feed.find((e) => e.exhibitId === visibleExhibitId);
    expect(entry).toBeDefined();

    const history = await getExhibitHistory(visibleExhibitId, 'JUDGE');
    expect(history).not.toBeNull();
    const timelineEntry = history!.timeline.find((t) => t.eventId === entry!.eventId);
    expect(timelineEntry).toBeDefined();

    // Same event, same summarizer → byte-identical summary string (proves reuse,
    // not a re-implementation that could drift).
    expect(entry!.summary).toBe(timelineEntry!.summary);
  });

  it('rejects a non-ISO `since` with VALIDATION_ERROR (422)', async () => {
    await expect(
      getRecentActivity(caseId, { role: 'JUDGE', since: 'not-a-date' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('rejects a future `since` with VALIDATION_ERROR (422)', async () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    await expect(
      getRecentActivity(caseId, { role: 'JUDGE', since: future }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('default window (no `since`) anchors to the latest-event day so the most recent event is in-window', async () => {
    const feed: RecentActivityEntry[] = await getRecentActivity(caseId, { role: 'JUDGE' });
    // The rolling latest-event-day anchor guarantees the most recent event is
    // always present regardless of run date.
    expect(feed.length).toBeGreaterThan(0);
    const latest = await prisma.exhibitEvent.findFirst({
      where: { caseId, exhibit: { isSealed: false } },
      orderBy: { recordedAt: 'desc' },
      select: { id: true },
    });
    expect(feed.map((e) => e.eventId)).toContain(latest!.id);
  });
});
