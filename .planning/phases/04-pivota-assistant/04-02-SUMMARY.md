---
phase: 04-pivota-assistant
plan: 02
subsystem: api
tags: [ai-sdk, tool-calling, zod, anthropic, sealed-visibility, role-scoping, llm, system-prompt]

# Dependency graph
requires:
  - phase: 04-pivota-assistant
    provides: "04-01 — ai@6 installed + tool() primitive; ToolArgsInvalidError (TOOL_ARGS_INVALID); assistantConfig temperature 0"
  - phase: 01-data-foundation
    provides: "getExhibitStatus, getUnresolvedObjections, getCustodian, getCustodyHistory, getExhibitHistory, searchExhibits, getExhibit; typed AppError layer; runSeed/getActiveCaseWithUsers; vitest fileParallelism:false shared-Postgres"
  - phase: 02-core-screens
    provides: "getExhibit canViewSealed WHERE-predicate gate (sealed → null, indistinguishable from missing); getExhibitHistory internal sealed seam; searchExhibits SearchExhibitsCriteria"
  - phase: 03-jury-package-discrepancy-detection
    provides: "getJuryPackage (read-only, role-filtered view); getDiscrepancies (case-wide, sealed-aware) + getExhibitDiscrepancies (per-exhibit, role-less)"
provides:
  - "src/lib/assistant/tools.ts — buildAssistantToolSet(ctx) returning the 8 AI SDK tool() defs bound to {caseId, requestingUserRole}"
  - "src/lib/assistant/systemPrompt.ts — buildSystemPrompt(role) cite-or-decline courtroom-clerk prompt"
  - "The role-scoped sealed seam (exhibitVisible helper) that makes an unauthorized sealed probe byte-identical to not-found (criterion 4)"
affects: [04-03 chat route (consumes buildAssistantToolSet + buildSystemPrompt via streamText), 04-04 client session, 04-05 assistant UI]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tool wrapper = thin 1:1 zod-validated pass-through to one service fn; zero business logic, zero Prisma, zero second query path (grep-enforced: no @/lib/prisma import)"
    - "Shared exhibitVisible(id, role) sealed seam: gate role-LESS services behind getExhibit(id, role) before the read; sealed-unauthorized ⇒ empty result (null/[]) with no hint"
    - "role + caseId always from ctx, never model args (no assistant admin override — T-04-05)"
    - "safeEmpty(err, empty): known AppError inside a tool collapses to the empty value; unexpected errors re-thrown to the SDK (never a silent swallow, never a stream crash)"

key-files:
  created:
    - "src/lib/assistant/tools.ts"
    - "src/lib/assistant/systemPrompt.ts"
    - "src/lib/assistant/tools.test.ts"
  modified: []

key-decisions:
  - "ai@6 tool() shape: { description, inputSchema (zod), execute(args, { toolCallId, messages }) } — matches 04-01's pinned major; execute's 2nd options arg verified by node export inspection"
  - "EMPTY_SEARCH_CRITERIA (422) from searchExhibits is caught and returned as [] — a no-criteria search is 'no matching records' from the assistant's view, so the model declines rather than the stream erroring"
  - "getCustodyHistory tool typed with Awaited<ReturnType<typeof getCustodyHistory>> (the service exports NO named CustodyHistoryEntry — it returns an inline Array<{fromCustodian,toCustodian,timestamp,reason,eventId}>); each entry's eventId is the 04-03 citation anchor"
  - "Tool keys follow the FRD names; the jury tool key is getJuryPackageStatus (wraps Phase 3 getJuryPackage); the 8th is getDiscrepancies (case-wide OR per-exhibit via optional exhibitId)"

patterns-established:
  - "Sealed seam placement: BEFORE the role-less read for tools 1/3/4 and the per-exhibit discrepancy branch; getExhibitHistory + searchExhibits + getJuryPackage + case-wide getDiscrepancies rely on the service's own internal role filter"
  - "getUnresolvedObjections (case-wide, role-less service) post-filtered by batch per-exhibit visibility (distinct ids → Promise.all(exhibitVisible) → visible-set filter)"

# Metrics
duration: 5min
completed: 2026-10-07
---

# Phase 4 Plan 02: Assistant Tool Layer + System Prompt Summary

**The 8 AI SDK `tool()` wrappers (each a 1:1 zod-validated pass-through to one existing service fn) with the role-scoped sealed seam that makes an unauthorized sealed probe byte-identical to not-found, plus the cite-or-decline courtroom-clerk system prompt.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-10-07T16:15:44Z
- **Completed:** 2026-10-07T16:21:00Z
- **Tasks:** 3
- **Files modified:** 3 (3 created, 0 modified)

## Accomplishments
- `buildAssistantToolSet(ctx)` returns the 8 tools keyed by the FRD names — each a thin call-through to the identical service function a UI route already calls, with zod `.uuid()` args and no independent business logic / no direct Prisma (structural anti-drift guarantee).
- The sealed seam (`exhibitVisible(id, role)` → `getExhibit`) gates the four role-LESS wrapped services before the read; a sealed-and-unauthorized exhibit yields the empty result (`null`/`[]`) indistinguishable from a nonexistent one — criterion 4, proven by a deep-equal test.
- `getUnresolvedObjections` (case-wide) is post-filtered by per-exhibit visibility so a sealed exhibit's objection never leaks to an unauthorized role.
- `buildSystemPrompt(role)` encodes all 7 FRD System-Prompt Requirements and embeds the active visibility scope.
- A read-only integration test drives the tool `execute` functions directly against the real seed, proving 1:1 parity, sealed invisibility, role-scoped visibility, case-wide objection filtering, zod rejection, and the jury-package exhibit filter.

## AI SDK tool() / execute invocation shape (ai@6.0.301)

`tool({ description, inputSchema: z.object({...}), execute: async (args, options) => result })`.
Verified by `node -e` export inspection:
- `tool` is a function; the returned object has keys `['description','inputSchema','execute']`.
- `execute(args, options)` — the 2nd `options` arg carries `{ toolCallId, messages }`. The test invokes tools directly with a minimal `{ toolCallId: 'test-call', messages: [] }`.
- `inputSchema` exposes `safeParse` (the zod schema) — the test asserts `.uuid()` rejection directly on it, proving malformed args fail at the SDK boundary before `execute`/the service runs.

04-03 consumes this record directly as `streamText({ tools: buildAssistantToolSet(ctx) })`.

## Sealed seam wiring per tool

| Tool | Wrapped service | Role param? | Seam |
|------|-----------------|-------------|------|
| getExhibitStatus | getExhibitStatus(id) | no | `exhibitVisible` gate BEFORE read → null |
| getUnresolvedObjections | getUnresolvedObjections(ctx.caseId) | no | post-filter by batch per-exhibit visibility |
| getCustodian | getCustodian(id) | no | `exhibitVisible` gate BEFORE read → null |
| getCustodyHistory | getCustodyHistory(id) | no | `exhibitVisible` gate BEFORE read → [] |
| getExhibitHistory | getExhibitHistory(id, role) | yes | service-internal seam (pass role) |
| searchExhibits | searchExhibits({caseId, role, …}) | yes | service-internal seam (pass role) |
| getJuryPackageStatus | getJuryPackage(ctx.caseId, role) | yes | service-internal view filter (pass role) |
| getDiscrepancies | getDiscrepancies(caseId, role) / getExhibitDiscrepancies(id) | mixed | case-wide: service seam; per-exhibit: `exhibitVisible` gate BEFORE read → [] |

## EMPTY_SEARCH_CRITERIA handling
`searchExhibits` throws `EMPTY_SEARCH_CRITERIA` (422) when no criterion is supplied. The tool's `execute` catches that specific code and returns `[]` so the model simply declines ("no matching records") rather than the stream erroring. All other stray `AppError`s collapse to the tool's empty value via `safeEmpty`; a non-AppError is re-thrown so it is never silently swallowed.

## getCustodyHistory return type
The custody service exports NO named `CustodyHistoryEntry` type — `getCustodyHistory` returns an inline `Array<{ fromCustodian; toCustodian; timestamp; reason; eventId }>`. The tool types its result as `Awaited<ReturnType<typeof getCustodyHistory>>` (rather than referencing a non-exported type), which keeps `tsc` clean and makes the test's deep-equal exact. Each entry's `eventId` is the citation anchor 04-03 will attach to custody claims.

## Phase 3 dependency presence confirmation
Both Phase 3 services were present in the working tree at execution time (the execution prerequisite in the plan held):
- `src/services/juryPackage.ts::getJuryPackage(caseId, role)` — present (contract verify passed).
- `src/services/discrepancies.ts::getDiscrepancies(caseId, role)` + `getExhibitDiscrepancies(exhibitId)` — present (contract verify passed).
Built against the REAL contracts — no stub, no feature-flag (CONTEXT.md locked decision honored).

## Task Commits

1. **Task 1: 8 tool wrappers + sealed seam** - `0a6c95e` (feat)
2. **Task 2: cite-or-decline system prompt** - `678ceea` (feat)
3. **Task 3: tool-layer integration test** - `5cd5f98` (test)

**Plan metadata:** docs commit (this SUMMARY + STATE.md)

## Files Created/Modified
- `src/lib/assistant/tools.ts` - `buildAssistantToolSet(ctx)` → 8 AI SDK tool defs; `exhibitVisible` sealed seam; `safeEmpty` error collapse.
- `src/lib/assistant/systemPrompt.ts` - `buildSystemPrompt(role)` cite-or-decline prompt encoding all 7 FRD requirements.
- `src/lib/assistant/tools.test.ts` - read-only integration proof against the seed (8 tests).

## Decisions Made
- Caught `EMPTY_SEARCH_CRITERIA` → `[]` (decline path) instead of letting it surface as an error.
- Typed `getCustodyHistory` via `Awaited<ReturnType<...>>` (no exported entry type).
- `getUnresolvedObjections` visibility handled by post-query per-exhibit filtering (the service is role-less and case-wide); N is small (demo scope).

## Deviations from Plan

None - plan executed exactly as written. All three artifacts created to spec, all verify commands pass, the sealed byte-identical-to-not-found assertion holds, role is always taken from ctx, and no parallel data path exists.

**Total deviations:** 0.
**Impact on plan:** None.

## Known Stubs
None found. (`grep` for TODO/FIXME/placeholder/not-implemented across all three files returned nothing. The `.optional().describe('Ignored; …')` schema fields on caseId are intentional: the model may supply a caseId but the tool always uses `ctx.caseId` — this is the T-04-05 override defense, not an unimplemented path.)

## Deferred Issues
None.

## Issues Encountered
None. The project's `npm run lint` (`next lint`) was not run as a standalone gate because a bare `npx eslint` resolves eslint v10 with no flat config; `tsc --noEmit` (clean) and the full vitest suite (165 passing) cover correctness.

## Next Phase Readiness
- **Ready for 04-03** (chat route): it consumes `buildAssistantToolSet(ctx)` as `streamText({ tools })` and `buildSystemPrompt(role)` as the system message, binding to the ai@6 wire-contract primitives pinned in 04-01's SUMMARY.
- The sealed seam and cite-or-decline prompt are the correctness foundation 04-03's grounded-answer / decline / sealed-decline tests assert against.

## Self-Check: PASSED
- Created files exist: `src/lib/assistant/tools.ts`, `src/lib/assistant/systemPrompt.ts`, `src/lib/assistant/tools.test.ts` — all FOUND.
- Commits exist: `0a6c95e`, `678ceea`, `5cd5f98` — all in `git log`.
- Build check: `npm run build` → exit 0.
- Type check: `npx tsc --noEmit` → clean. Full suite: `npx vitest run` → 165/165 passing (28 files; +8 new).
- `## Known Stubs` present, no blocking entries.

---
*Phase: 04-pivota-assistant*
*Completed: 2026-10-07*
