import type { Tool } from 'ai';
import { tool } from 'ai';
import { z } from 'zod';
import type { Role } from '@prisma/client';

import { getExhibitStatus } from '@/services/status';
import { getUnresolvedObjections } from '@/services/objections';
import { getCustodian, getCustodyHistory } from '@/services/custody';
import { getExhibitHistory } from '@/services/history';
import { searchExhibits } from '@/services/exhibits';
import { getExhibit } from '@/services/exhibits';
import { getJuryPackage } from '@/services/juryPackage';
import { getDiscrepancies, getExhibitDiscrepancies } from '@/services/discrepancies';
import { AppError } from '@/lib/errors';

// =============================================================================
// Pivota Assistant tool set (F7) — the ONLY data path the LLM can touch.
// =============================================================================
//
// THE 1:1 PASS-THROUGH CONTRACT (FRD F07 §Tool Set; TechArch 03-api.md §4.10):
// Each of the 8 tools below is a thin, zod-validated wrapper that calls EXACTLY
// ONE existing service-layer function — the IDENTICAL function the corresponding
// UI screen/API route already calls. There is deliberately ZERO independent
// business logic, ZERO Prisma access, and ZERO second query path in this file
// (enforced by grep: no `@/lib/prisma` import). "New logic goes in the service
// layer, never the tool wrapper." This is what STRUCTURALLY guarantees the
// assistant and the dashboards can never drift: they read the same source of
// truth through the same functions.
//
// THE SEALED SEAM (criterion 4 — the single most important correctness item):
// Four of the wrapped services (getExhibitStatus, getCustodian, getCustodyHistory,
// and the per-exhibit getExhibitDiscrepancies) do NOT take a role parameter, so
// calling them directly for a sealed exhibit would leak data to a role that
// cannot view sealed exhibits. For every exhibit-scoped tool that wraps such a
// role-LESS service, `execute` FIRST calls `exhibitVisible(exhibitId, role)`
// (which delegates to getExhibit's canViewSealed WHERE-predicate gate, 02-02). A
// sealed-and-unauthorized exhibit yields the EMPTY result (null / []) WITHOUT
// ever calling the underlying service — byte-identical to a genuinely nonexistent
// exhibit, so the model receives nothing to cite and must Decline. We NEVER throw
// and NEVER return an error string that would hint the record exists-but-is-hidden
// (anti-enumeration). getExhibitHistory and the role-aware reads (searchExhibits,
// getJuryPackage, getDiscrepancies case-wide) already apply the seam internally,
// so we simply thread ctx.requestingUserRole into them.
//
// ROLE/CASE ARE NEVER TAKEN FROM MODEL ARGS (T-04-05): the requesting role and
// the active caseId are always taken from `ctx`, exactly as the UI threads them.
// A model-supplied caseId/role is ignored; this prevents an "assistant admin
// override" elevation-of-privilege.
//
// ARG VALIDATION (T-04-06): every id field is zod `.uuid()`. The AI SDK rejects
// a schema failure back to the model as a tool error before `execute` runs, so
// malformed args never reach a service / Prisma. A defensive per-tool try/catch
// converts any stray thrown AppError into a safe empty/null result rather than
// an unhandled rejection that would crash the stream.

export interface AssistantToolContext {
  caseId: string;
  requestingUserRole: Role;
}

/**
 * True iff the exhibit is visible to this role. A sealed exhibit the role cannot
 * view returns false — INDISTINGUISHABLE from a nonexistent exhibit, because
 * getExhibit applies canViewSealed as a WHERE predicate (02-02) and returns null
 * for BOTH cases. This is the shared sealed-seam primitive for every tool that
 * wraps a role-less service.
 */
async function exhibitVisible(exhibitId: string, role: Role): Promise<boolean> {
  return (await getExhibit(exhibitId, role)) !== null;
}

// Shared zod field — a UUID exhibit id. `.uuid()` is what makes TOOL_ARGS_INVALID
// fire at the SDK boundary for malformed ids, before any service call.
const exhibitIdSchema = z.string().uuid();
const caseIdSchema = z.string().uuid();

/**
 * Build the 8 AI SDK tool definitions bound to a single request's
 * `{ caseId, requestingUserRole }`. The returned record's keys are the FRD Tool
 * Set names; `streamText({ tools })` consumes it directly (04-03).
 */
export function buildAssistantToolSet(ctx: AssistantToolContext): Record<string, Tool> {
  const { caseId, requestingUserRole: role } = ctx;

  return {
    // 1. getExhibitStatus — current lifecycle status of ONE exhibit.
    //    role-less service → sealed seam BEFORE the read.
    getExhibitStatus: tool({
      description:
        'Current lifecycle status (MARKED, OFFERED, OBJECTED, ADMITTED, EXCLUDED, WITHDRAWN) of a single exhibit by its id. Returns null if the exhibit has no status yet or does not exist.',
      inputSchema: z.object({ exhibitId: exhibitIdSchema }),
      execute: async ({ exhibitId }) => {
        try {
          if (!(await exhibitVisible(exhibitId, role))) return null;
          return await getExhibitStatus(exhibitId);
        } catch (err) {
          return safeEmpty(err, null);
        }
      },
    }),

    // 2. getUnresolvedObjections — case-wide. role-aware post-filter by per-exhibit
    //    visibility so a sealed exhibit's objection never leaks to an unauthorized
    //    role. Model-supplied caseId is IGNORED; always ctx.caseId.
    getUnresolvedObjections: tool({
      description:
        'All currently unresolved objection threads across the active case. Each entry names the exhibit, the objecting party, the grounds, and when it was raised.',
      inputSchema: z.object({
        caseId: caseIdSchema.optional().describe('Ignored; the active case is always used.'),
      }),
      execute: async () => {
        try {
          const objections = await getUnresolvedObjections(caseId);
          if (objections.length === 0) return [];
          // Batch-resolve distinct exhibit visibility, then drop any objection
          // whose exhibit is sealed-unauthorized (N is small — demo scope).
          const distinctIds = [...new Set(objections.map((o) => o.exhibitId))];
          const visibility = await Promise.all(
            distinctIds.map((id) => exhibitVisible(id, role)),
          );
          const visibleSet = new Set(
            distinctIds.filter((_, i) => visibility[i]),
          );
          return objections.filter((o) => visibleSet.has(o.exhibitId));
        } catch (err) {
          return safeEmpty(err, []);
        }
      },
    }),

    // 3. getCustodian — current custodian of ONE exhibit.
    //    role-less service → sealed seam BEFORE the read.
    getCustodian: tool({
      description:
        'The current custodian of record for a single exhibit by its id. Returns null if no custody has been recorded (a custody gap) or the exhibit does not exist.',
      inputSchema: z.object({ exhibitId: exhibitIdSchema }),
      execute: async ({ exhibitId }) => {
        try {
          if (!(await exhibitVisible(exhibitId, role))) return null;
          return await getCustodian(exhibitId);
        } catch (err) {
          return safeEmpty(err, null);
        }
      },
    }),

    // 4. getCustodyHistory — full chain-of-custody for ONE exhibit.
    //    role-less service → sealed seam BEFORE the read. Result is the service's
    //    ACTUAL inline entry shape (no exported CustodyHistoryEntry type) — each
    //    entry carries an `eventId`, the citation anchor 04-03 uses.
    getCustodyHistory: tool({
      description:
        'The complete chain-of-custody history for a single exhibit: every transfer in order, with from/to custodian, timestamp, reason, and the event id for citation. Returns an empty array if there are no transfers or the exhibit does not exist.',
      inputSchema: z.object({ exhibitId: exhibitIdSchema }),
      execute: async ({
        exhibitId,
      }): Promise<Awaited<ReturnType<typeof getCustodyHistory>>> => {
        try {
          if (!(await exhibitVisible(exhibitId, role))) return [];
          return await getCustodyHistory(exhibitId);
        } catch (err) {
          return safeEmpty(err, [] as Awaited<ReturnType<typeof getCustodyHistory>>);
        }
      },
    }),

    // 5. getExhibitHistory — full chronological timeline for ONE exhibit. This
    //    service ALREADY applies the sealed seam internally (returns null for
    //    missing AND sealed-unauthorized), so we simply pass the role — NO extra
    //    gate. timeline[] entries are the ideal citation source.
    getExhibitHistory: tool({
      description:
        "A single exhibit's complete chronological history: every status change, objection, ruling, custody transfer, and discrepancy acknowledgment as plain-language timeline entries with event ids and timestamps. Returns null if the exhibit does not exist.",
      inputSchema: z.object({ exhibitId: exhibitIdSchema }),
      execute: async ({ exhibitId }) => {
        try {
          return await getExhibitHistory(exhibitId, role);
        } catch (err) {
          return safeEmpty(err, null);
        }
      },
    }),

    // 6. searchExhibits — combinable filters over the case. role-aware service
    //    already role-filters sealed rows. Always ctx.caseId + ctx.requestingUserRole
    //    (never model-overridden — criterion 4). EMPTY_SEARCH_CRITERIA → [] (so the
    //    model declines) rather than a thrown error.
    //
    //    ASSISTANT-FACING SHAPE WIDENING (04-03, the citation preferred path): a raw
    //    ExhibitListRow carries an exhibitId but NO event id, so a grounded "what
    //    exhibits were admitted yesterday" answer would have nothing to cite. We
    //    therefore ATTACH each row's current-status event id + timestamp
    //    (lastStatusEventId / lastStatusAt), sourced from the SAME role-filtered
    //    read's projection via getExhibitStatus — NOT a second divergent query path:
    //    getExhibitStatus reads the identical ExhibitCurrentState projection every
    //    screen reads, and we only call it for rows searchExhibits already returned
    //    (so sealed rows are already excluded; 1:1 data provenance preserved). The
    //    row's own fields are untouched; this is purely additive. The service's own
    //    searchExhibits return is unchanged — the widening lives ONLY here, in the
    //    assistant-facing tool, so the UI list/search endpoints keep their shape.
    searchExhibits: tool({
      description:
        'Search the active case\'s exhibits by any combination of keyword, status, witness, and status-date range. Returns matching exhibit rows (label, description, status, custodian, discrepancy flags, and the current-status event id/timestamp for citation). Returns an empty array when nothing matches.',
      inputSchema: z.object({
        keyword: z.string().optional(),
        status: z
          .enum([
            'MARKED',
            'OFFERED',
            'OBJECTED',
            'ADMITTED',
            'EXCLUDED',
            'WITHDRAWN',
          ])
          .optional(),
        witness: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }),
      execute: async ({ keyword, status, witness, dateFrom, dateTo }) => {
        try {
          const rows = await searchExhibits({
            caseId,
            requestingUserRole: role,
            keyword,
            status,
            witness,
            dateFrom,
            dateTo,
          });
          // Attach the current-status event id/timestamp to each already-visible
          // row from the SAME projection (getExhibitStatus) so the assistant can
          // cite the status event (04-03 citation preferred path). An exhibit with
          // no status yet (lastStatusEventId absent) yields nulls — the citation
          // extractor simply has no ExhibitEvent anchor for that row.
          const statuses = await Promise.all(
            rows.map((r) => getExhibitStatus(r.exhibitId)),
          );
          return rows.map((r, i) => ({
            ...r,
            lastStatusEventId: statuses[i]?.lastStatusEventId ?? null,
            lastStatusAt: statuses[i]?.lastStatusAt?.toISOString() ?? null,
          }));
        } catch (err) {
          // An empty-criteria search is "no matching records" from the assistant's
          // view, not an error — return [] so the model declines. Any other stray
          // AppError likewise collapses to [] rather than crashing the stream.
          if (err instanceof AppError && err.code === 'EMPTY_SEARCH_CRITERIA') {
            return [];
          }
          return safeEmpty(err, []);
        }
      },
    }),

    // 7. getJuryPackageStatus — jury package membership + per-row discrepancy
    //    state. role-aware service already drops sealed rows. If exhibitId is
    //    supplied, narrow `exhibits` to that one row (empty ⇒ not in package).
    getJuryPackageStatus: tool({
      description:
        'The current jury package for the active case and the exhibits in it (each row ADMITTED, with its discrepancy status). Pass an exhibitId to check whether that specific exhibit is in the package. Returns juryPackage: null when none has been started.',
      inputSchema: z.object({
        caseId: caseIdSchema.optional().describe('Ignored; the active case is always used.'),
        exhibitId: exhibitIdSchema.optional(),
      }),
      execute: async ({ exhibitId }) => {
        try {
          const result = await getJuryPackage(caseId, role);
          if (exhibitId) {
            return {
              juryPackage: result.juryPackage,
              exhibits: result.exhibits.filter((e) => e.exhibitId === exhibitId),
            };
          }
          return result;
        } catch (err) {
          return safeEmpty(err, { juryPackage: null, exhibits: [] });
        }
      },
    }),

    // 8. getDiscrepancies — case-wide (role-aware, sealed-filtered) OR per-exhibit.
    //    For the per-exhibit branch the wrapped service (getExhibitDiscrepancies)
    //    is role-LESS → sealed seam BEFORE the read. Case-wide getDiscrepancies is
    //    role-aware and needs no extra gate.
    getDiscrepancies: tool({
      description:
        'Open and acknowledged discrepancy flags for the active case, or for a single exhibit when exhibitId is supplied (e.g. an admitted exhibit with no custodian, or an unresolved objection on a jury-eligible exhibit). Returns an empty array when there are none.',
      inputSchema: z.object({
        caseId: caseIdSchema.optional().describe('Ignored; the active case is always used.'),
        exhibitId: exhibitIdSchema.optional(),
      }),
      execute: async ({ exhibitId }) => {
        try {
          if (exhibitId) {
            if (!(await exhibitVisible(exhibitId, role))) return [];
            return await getExhibitDiscrepancies(exhibitId);
          }
          return await getDiscrepancies(caseId, role);
        } catch (err) {
          return safeEmpty(err, []);
        }
      },
    }),
  };
}

/**
 * Convert an unexpected thrown error inside a tool `execute` into a safe empty
 * result. A known AppError (a service's typed failure) collapses to the tool's
 * empty value so the model simply receives nothing to cite and declines — it is
 * never surfaced as an error string that could hint at a hidden record. A truly
 * unexpected error is re-thrown so it is not silently swallowed (the SDK surfaces
 * it as a tool error to the model within the turn, not as a stream crash).
 */
function safeEmpty<T>(err: unknown, empty: T): T {
  if (err instanceof AppError) {
    return empty;
  }
  throw err;
}
