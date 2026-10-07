import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { runSeed } from '@/data/seed';
import { getExhibitHistory } from '@/services/history';

// Integration tests for getExhibitHistory (F10) run against the REAL seeded demo
// case produced by runSeed() (Plan 6). Exercising replay against the actual
// 8-exhibit dataset — with its varied, interleaved histories — is the point:
// these assertions would be trivially satisfiable against a toy fixture, but here
// they prove the full ledger-to-timeline reconstruction works on non-trivial,
// out-of-event-type-order data.
//
// The "Jury-Eligible Discrepancy" exhibit is seed label P-3: MARKED → OFFERED →
// (objection raised) → OBJECTED → ADMITTED, with the objection left UNRESOLVED —
// so its timeline interleaves STATUS_CHANGE and OBJECTION_RAISED events in true
// sequence order, not grouped by type.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('getExhibitHistory (F10) against the real seeded case', () => {
  let caseId: string;

  beforeAll(async () => {
    const result = await runSeed();
    caseId = result.caseId;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function exhibitIdByLabel(label: string): Promise<string> {
    const ex = await prisma.exhibit.findFirst({
      where: { caseId, exhibitLabel: label },
      select: { id: true },
    });
    if (!ex) throw new Error(`seed exhibit ${label} not found`);
    return ex.id;
  }

  it('returns null for a nonexistent exhibit (route maps to 404)', async () => {
    const result = await getExhibitHistory('00000000-0000-0000-0000-000000000000');
    expect(result).toBeNull();
  });

  it('reconstructs the complete, sequence-ordered timeline for the jury-eligible exhibit (P-3)', async () => {
    const exhibitId = await exhibitIdByLabel('P-3');
    const history = await getExhibitHistory(exhibitId);

    expect(history).not.toBeNull();
    if (!history) return;

    // Header fields: ADMITTED, with a custodian name resolved (P-3 has a chain).
    expect(history.currentStatus).toBe('ADMITTED');
    expect(history.currentCustodianName).toBeTruthy();

    // Timeline must be COMPLETE (every event, no truncation) and in sequence
    // order. P-3: STATUS_CHANGE(MARKED), STATUS_CHANGE(OFFERED),
    // OBJECTION_RAISED, STATUS_CHANGE(OBJECTED), STATUS_CHANGE(ADMITTED),
    // CUSTODY_TRANSFER x2.
    const types = history.timeline.map((t) => t.eventType);
    expect(types).toEqual([
      'STATUS_CHANGE',
      'STATUS_CHANGE',
      'OBJECTION_RAISED',
      'STATUS_CHANGE',
      'STATUS_CHANGE',
      'CUSTODY_TRANSFER',
      'CUSTODY_TRANSFER',
    ]);

    // The OBJECTION_RAISED event must appear AFTER the OFFERED status change and
    // BEFORE the OBJECTED one — proving interleaving by sequence, not grouping by
    // event type.
    const objectionIdx = types.indexOf('OBJECTION_RAISED');
    const offeredIdx = history.timeline.findIndex((t) =>
      t.summary.includes('to OFFERED'),
    );
    const objectedIdx = history.timeline.findIndex((t) =>
      t.summary.includes('to OBJECTED'),
    );
    expect(offeredIdx).toBeGreaterThanOrEqual(0);
    expect(objectedIdx).toBeGreaterThanOrEqual(0);
    expect(objectionIdx).toBeGreaterThan(offeredIdx);
    expect(objectionIdx).toBeLessThan(objectedIdx);

    // recordedAt timestamps are non-decreasing across the ordered timeline.
    for (let i = 1; i < history.timeline.length; i++) {
      expect(
        new Date(history.timeline[i].recordedAt).getTime(),
      ).toBeGreaterThanOrEqual(
        new Date(history.timeline[i - 1].recordedAt).getTime(),
      );
    }
  });

  it('renders every entry with a plain-language summary and a resolved actor name (no raw enum/JSON/UUID leaks)', async () => {
    const exhibitId = await exhibitIdByLabel('P-3');
    const history = await getExhibitHistory(exhibitId);
    expect(history).not.toBeNull();
    if (!history) return;

    for (const entry of history.timeline) {
      // Summary is non-empty, human-readable prose — not a bare enum token or a
      // JSON blob.
      expect(entry.summary.length).toBeGreaterThan(0);
      expect(entry.summary).not.toBe(entry.eventType);
      expect(entry.summary).not.toMatch(/[{}]/); // no leaked JSON
      expect(entry.summary).toMatch(/\s/); // multi-word prose

      // actorName is a resolved human name, never a bare UUID.
      expect(entry.actorName.length).toBeGreaterThan(0);
      expect(entry.actorName).not.toMatch(UUID_RE);
    }

    // Custody summaries resolve the from/to custodian to NAMES, not UUIDs.
    const custodyEntries = history.timeline.filter(
      (t) => t.eventType === 'CUSTODY_TRANSFER',
    );
    expect(custodyEntries.length).toBeGreaterThan(0);
    for (const c of custodyEntries) {
      expect(c.summary).toMatch(/^Custody transferred from .+ to .+/);
      // No embedded UUID anywhere in the custody summary.
      expect(c.summary).not.toMatch(UUID_RE);
    }
  });

  it('returns discrepancyFlags as [] for every exhibit in this phase', async () => {
    const exhibits = await prisma.exhibit.findMany({
      where: { caseId },
      select: { id: true },
    });
    expect(exhibits.length).toBeGreaterThanOrEqual(8);

    for (const ex of exhibits) {
      const history = await getExhibitHistory(ex.id);
      expect(history).not.toBeNull();
      expect(history?.discrepancyFlags).toEqual([]);
    }
  });

  it('reconstructs the full history for the custody-gap exhibit (P-2) with no custodian name', async () => {
    const exhibitId = await exhibitIdByLabel('P-2');
    const history = await getExhibitHistory(exhibitId);
    expect(history).not.toBeNull();
    if (!history) return;

    // P-2 is ADMITTED but has ZERO custody transfers — the gap is valid.
    expect(history.currentStatus).toBe('ADMITTED');
    expect(history.currentCustodianName).toBeNull();
    expect(
      history.timeline.filter((t) => t.eventType === 'CUSTODY_TRANSFER'),
    ).toHaveLength(0);
  });
});
