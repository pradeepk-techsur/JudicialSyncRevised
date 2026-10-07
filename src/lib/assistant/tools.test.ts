import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { runSeed } from '@/data/seed';
import { getActiveCaseWithUsers } from '@/services/cases';

import { buildAssistantToolSet } from '@/lib/assistant/tools';
import { getExhibitStatus } from '@/services/status';
import { getExhibitHistory } from '@/services/history';

// =============================================================================
// Tool-layer integration test (F7 / criterion 4).
// =============================================================================
//
// Drives the tool `execute` functions DIRECTLY against the REAL seeded demo case
// (no LLM involved) to prove the three load-bearing correctness properties:
//   1. 1:1 parity — a tool result is byte-identical to the service fn it wraps
//      (no divergent data path; assistant can never drift from the UI).
//   2. Sealed invisibility — for a role that cannot view the sealed exhibit S-1,
//      the exhibit-scoped tools return the EMPTY result, DEEP-EQUAL to the result
//      for a random nonexistent uuid (unauthorized-sealed indistinguishable from
//      not-found — anti-enumeration).
//   3. Role-scoping is real, not a blanket block — an authorized role (JUDGE)
//      sees S-1's data through the same tools.
//
// Serialized shared-Postgres suite (vitest fileParallelism:false). Read-only
// against the seed; no cleanup needed.

const NONEXISTENT_UUID = '00000000-0000-0000-0000-000000000000';

// The installed AI SDK is ai@6: tool().execute(args, options) where options
// carries { toolCallId, messages }. A minimal options object satisfies the
// signature for direct invocation in tests.
const EXEC_OPTS = { toolCallId: 'test-call', messages: [] } as const;

type ToolSet = ReturnType<typeof buildAssistantToolSet>;

async function invoke(tools: ToolSet, name: string, args: Record<string, unknown>) {
  const t = tools[name];
  if (!t || typeof t.execute !== 'function') {
    throw new Error(`tool ${name} has no execute`);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (t.execute as any)(args, EXEC_OPTS);
}

describe('buildAssistantToolSet (F7) against the real seeded case', () => {
  let caseId: string;

  async function exhibitIdByLabel(label: string): Promise<string> {
    const ex = await prisma.exhibit.findFirst({
      where: { caseId, exhibitLabel: label },
      select: { id: true },
    });
    if (!ex) throw new Error(`seed exhibit ${label} not found`);
    return ex.id;
  }

  beforeAll(async () => {
    await runSeed();
    const active = await getActiveCaseWithUsers();
    if (!active) throw new Error('active seeded case not found');
    caseId = active.case.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ---------------------------------------------------------------------------
  // 1. Happy path / 1:1 parity — tool result deep-equals direct service result.
  // ---------------------------------------------------------------------------
  describe('1:1 pass-through parity (no divergent data path)', () => {
    it('getExhibitStatus tool result equals the direct service result for an ADMITTED exhibit', async () => {
      const exhibitId = await exhibitIdByLabel('P-4'); // clean ADMITTED, non-sealed
      const tools = buildAssistantToolSet({ caseId, requestingUserRole: 'JUDGE' });

      const toolResult = await invoke(tools, 'getExhibitStatus', { exhibitId });
      const serviceResult = await getExhibitStatus(exhibitId);

      expect(toolResult).toEqual(serviceResult);
      expect(toolResult?.currentStatus).toBe('ADMITTED');
    });

    it('getExhibitHistory tool result equals the direct service result (role threaded)', async () => {
      const exhibitId = await exhibitIdByLabel('P-3');
      const role: Role = 'JUDGE';
      const tools = buildAssistantToolSet({ caseId, requestingUserRole: role });

      const toolResult = await invoke(tools, 'getExhibitHistory', { exhibitId });
      const serviceResult = await getExhibitHistory(exhibitId, role);

      expect(toolResult).toEqual(serviceResult);
      expect(toolResult).not.toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Sealed invisibility (criterion 4) — the critical case.
  // ---------------------------------------------------------------------------
  describe('sealed invisibility: unauthorized role → empty, indistinguishable from not-found', () => {
    it('DEPUTY sees S-1 exactly as a nonexistent uuid across status/custodian/custody-history/history', async () => {
      const sealedId = await exhibitIdByLabel('S-1');
      const tools = buildAssistantToolSet({ caseId, requestingUserRole: 'DEPUTY' });

      // Status: null, and deep-equal to the nonexistent-uuid result.
      const statusSealed = await invoke(tools, 'getExhibitStatus', { exhibitId: sealedId });
      const statusMissing = await invoke(tools, 'getExhibitStatus', { exhibitId: NONEXISTENT_UUID });
      expect(statusSealed).toBeNull();
      expect(statusSealed).toEqual(statusMissing);

      // Custodian: null, deep-equal.
      const custSealed = await invoke(tools, 'getCustodian', { exhibitId: sealedId });
      const custMissing = await invoke(tools, 'getCustodian', { exhibitId: NONEXISTENT_UUID });
      expect(custSealed).toBeNull();
      expect(custSealed).toEqual(custMissing);

      // Custody history: [], deep-equal.
      const histSealed = await invoke(tools, 'getCustodyHistory', { exhibitId: sealedId });
      const histMissing = await invoke(tools, 'getCustodyHistory', { exhibitId: NONEXISTENT_UUID });
      expect(histSealed).toEqual([]);
      expect(histSealed).toEqual(histMissing);

      // Exhibit history: null, deep-equal.
      const exHistSealed = await invoke(tools, 'getExhibitHistory', { exhibitId: sealedId });
      const exHistMissing = await invoke(tools, 'getExhibitHistory', { exhibitId: NONEXISTENT_UUID });
      expect(exHistSealed).toBeNull();
      expect(exHistSealed).toEqual(exHistMissing);
    });

    it('DEPUTY getDiscrepancies for the sealed exhibitId is empty, deep-equal to not-found', async () => {
      const sealedId = await exhibitIdByLabel('S-1');
      const tools = buildAssistantToolSet({ caseId, requestingUserRole: 'DEPUTY' });

      const discSealed = await invoke(tools, 'getDiscrepancies', { exhibitId: sealedId });
      const discMissing = await invoke(tools, 'getDiscrepancies', { exhibitId: NONEXISTENT_UUID });
      expect(discSealed).toEqual([]);
      expect(discSealed).toEqual(discMissing);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Sealed visibility for an AUTHORIZED role — mask is role-scoped, not blanket.
  // ---------------------------------------------------------------------------
  describe('sealed visibility: authorized role (JUDGE) sees S-1', () => {
    it('JUDGE gets non-empty status / custodian / custody-history / history for S-1', async () => {
      const sealedId = await exhibitIdByLabel('S-1');
      const tools = buildAssistantToolSet({ caseId, requestingUserRole: 'JUDGE' });

      const status = await invoke(tools, 'getExhibitStatus', { exhibitId: sealedId });
      expect(status).not.toBeNull();
      expect(status?.currentStatus).toBe('ADMITTED'); // S-1 is MARKED→OFFERED→ADMITTED in seed

      const custodian = await invoke(tools, 'getCustodian', { exhibitId: sealedId });
      expect(custodian).not.toBeNull();

      const custodyHistory = await invoke(tools, 'getCustodyHistory', { exhibitId: sealedId });
      expect(Array.isArray(custodyHistory)).toBe(true);
      expect(custodyHistory.length).toBeGreaterThan(0);
      // Each entry carries an eventId — the citation anchor 04-03 uses.
      expect(custodyHistory[0].eventId).toBeTruthy();

      const history = await invoke(tools, 'getExhibitHistory', { exhibitId: sealedId });
      expect(history).not.toBeNull();
      expect(history.timeline.length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. getUnresolvedObjections case-wide filtering by per-exhibit visibility.
  // ---------------------------------------------------------------------------
  describe('getUnresolvedObjections case-wide visibility filtering', () => {
    it('a DEPUTY result never contains an objection whose exhibit is the sealed S-1; JUDGE is a superset', async () => {
      const sealedId = await exhibitIdByLabel('S-1');

      const deputyTools = buildAssistantToolSet({ caseId, requestingUserRole: 'DEPUTY' });
      const judgeTools = buildAssistantToolSet({ caseId, requestingUserRole: 'JUDGE' });

      const deputyObjections = await invoke(deputyTools, 'getUnresolvedObjections', {});
      const judgeObjections = await invoke(judgeTools, 'getUnresolvedObjections', {});

      // No deputy-visible objection may reference the sealed exhibit.
      expect(deputyObjections.every((o: { exhibitId: string }) => o.exhibitId !== sealedId)).toBe(true);

      // The judge sees at least as many (visibility is a superset). The seed's
      // sealed S-1 is ADMITTED with no open objection, so counts may be equal —
      // the invariant is deputy ⊆ judge, never the reverse.
      expect(judgeObjections.length).toBeGreaterThanOrEqual(deputyObjections.length);
      const judgeIds = new Set(judgeObjections.map((o: { objectionId: string }) => o.objectionId));
      for (const o of deputyObjections as Array<{ objectionId: string }>) {
        expect(judgeIds.has(o.objectionId)).toBe(true);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 5. zod rejection (TOOL_ARGS_INVALID) — malformed args never reach Prisma.
  // ---------------------------------------------------------------------------
  describe('zod validation rejects malformed args before the service layer', () => {
    it('getExhibitStatus with a non-UUID exhibitId is rejected by the inputSchema', () => {
      const tools = buildAssistantToolSet({ caseId, requestingUserRole: 'JUDGE' });
      const t = tools.getExhibitStatus;
      // The tool's inputSchema (zod .uuid()) is the SDK's validation gate; a
      // non-uuid fails parse, so the model never gets `execute` run with it and
      // the service/Prisma is never reached.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const schema = (t as any).inputSchema as {
        safeParse: (v: unknown) => { success: boolean };
      };
      expect(schema.safeParse({ exhibitId: 'not-a-uuid' }).success).toBe(false);
      expect(schema.safeParse({ exhibitId: NONEXISTENT_UUID }).success).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 6. getJuryPackageStatus exhibit filter narrows correctly.
  // ---------------------------------------------------------------------------
  describe('getJuryPackageStatus exhibit filter', () => {
    it('filters exhibits to the requested id, or returns no package without throwing', async () => {
      const tools = buildAssistantToolSet({ caseId, requestingUserRole: 'JUDGE' });

      // Case-wide: the GET is read-only; the seed starts no jury package, so
      // juryPackage is null and exhibits is []. Must not throw.
      const whole = await invoke(tools, 'getJuryPackageStatus', {});
      expect(whole).toHaveProperty('juryPackage');
      expect(whole).toHaveProperty('exhibits');
      expect(Array.isArray(whole.exhibits)).toBe(true);

      if (whole.juryPackage && whole.exhibits.length > 0) {
        // If a package exists, the exhibitId filter must narrow to that one row.
        const memberId: string = whole.exhibits[0].exhibitId;
        const filtered = await invoke(tools, 'getJuryPackageStatus', { exhibitId: memberId });
        expect(filtered.exhibits.every((e: { exhibitId: string }) => e.exhibitId === memberId)).toBe(
          true,
        );
        expect(filtered.exhibits.length).toBe(1);

        // A non-member exhibitId narrows to empty.
        const nonMember = await invoke(tools, 'getJuryPackageStatus', {
          exhibitId: NONEXISTENT_UUID,
        });
        expect(nonMember.exhibits).toEqual([]);
      } else {
        // No package (seed default): juryPackage null, exhibits empty, no throw.
        expect(whole.juryPackage).toBeNull();
        expect(whole.exhibits).toEqual([]);
      }
    });
  });
});
