---
phase: 04-pivota-assistant
plan: 01
subsystem: api
tags: [ai-sdk, anthropic, vercel-ai-sdk, prisma, postgres, llm, tool-calling, errors]

# Dependency graph
requires:
  - phase: 01-data-foundation
    provides: "AppError typed-error layer + errorResponse envelope; prisma schema w/ Case & User; getActiveCaseWithUsers; vitest fileParallelism:false shared-Postgres convention"
  - phase: 03-jury-package-discrepancy-detection
    provides: "AppError.details + RoleNotPermittedError already present in errors.ts (not re-added here)"
provides:
  - "ai@6 + @ai-sdk/react@3 + @ai-sdk/anthropic@3 installed (no vector/LangChain deps)"
  - "src/lib/assistantConfig.ts — single provider/model/temperature(0) config with server-side-only key seam + fail-safe"
  - "AssistantUnavailableError (ASSISTANT_UNAVAILABLE/503) + ToolArgsInvalidError (TOOL_ARGS_INVALID/422) in the error layer"
  - "MessageRole enum + AssistantConversation/AssistantMessage/AssistantCitation tables (migrated) incl. additive exhibit_id (required) + event_id (nullable)"
affects: [04-02 tool layer, 04-03 chat route + wire contract, 04-04 client session, 04-05 assistant UI]

# Tech tracking
tech-stack:
  added:
    - "ai@6.0.301 (Vercel AI SDK core)"
    - "@ai-sdk/react@3.0.304 (useChat, DefaultChatTransport)"
    - "@ai-sdk/anthropic@3.0.127 (Anthropic provider)"
  patterns:
    - "Single server-side-only config seam (assistantConfig.ts) — key read from process.env in one place, never NEXT_PUBLIC_"
    - "Fail-safe config: placeholder/unset key => isAssistantConfigured() false => 503 path, never a throw at import"
    - "Citation carries its own deep-link target (exhibit_id + nullable event_id) so a persisted/replayed pill can navigate without re-deriving"

key-files:
  created:
    - "src/lib/assistantConfig.ts"
    - "src/lib/assistant/schema.test.ts"
    - "prisma/migrations/20261007161004_add_assistant_tables/migration.sql"
  modified:
    - "package.json / package-lock.json"
    - ".env.example"
    - "src/lib/errors.ts"
    - "prisma/schema.prisma"

key-decisions:
  - "Installed AI SDK resolved to ai@6 / @ai-sdk/react@3 / @ai-sdk/anthropic@3 (current dist-tags), not the plan's predicted ^7/^4/^4 — no --legacy-peer-deps needed"
  - "Pinned model id: claude-sonnet-4-5 (overridable via ANTHROPIC_MODEL)"
  - "AssistantCitation diverges from TechArch canonical Citation with additive exhibit_id (required) + event_id (nullable) for pill deep-link + GET-reload replay"
  - "Migration applied via prisma migrate dev (interactive DB available on localhost:5432 via compose)"

patterns-established:
  - "assistantConfig.ts is the ONLY reader of process.env.ANTHROPIC_API_KEY (server-side)"
  - "AssistantUnavailableError is the sole 503 transport channel for the assistant (never message text / Decline)"

# Metrics
duration: 2min
completed: 2026-10-07
---

# Phase 4 Plan 01: Pivota Assistant Foundation Summary

**Vercel AI SDK (ai@6 + Anthropic provider) + server-side-only `assistantConfig` with a missing-key fail-safe, two assistant error codes, and the migrated three-table assistant data model with deep-link-carrying citations.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-10-07T16:08:31Z
- **Completed:** 2026-10-07T16:11:30Z
- **Tasks:** 3
- **Files modified:** 7 (3 created, 4 modified)

## Accomplishments
- Installed the Vercel AI SDK stack (`ai`, `@ai-sdk/react`, `@ai-sdk/anthropic`) with zero forbidden architecture deps (no vector DB / embeddings / LangChain).
- `src/lib/assistantConfig.ts` is the single provider/model/temperature(0) config with a server-side-only key accessor and a fail-safe that makes a missing/placeholder key return 503 instead of crashing the app (ROADMAP criterion 5).
- Added `AssistantUnavailableError` (503) and `ToolArgsInvalidError` (422) to the typed error layer; `apiError.ts` needed no change (inherited `AppError` mapping).
- Added and migrated `MessageRole` + `AssistantConversation`/`AssistantMessage`/`AssistantCitation`, with the additive `exhibit_id`/`event_id` link columns and `conversations` back-relations on `Case`/`User`.
- Added a permanent regression test proving the tables round-trip and the config fail-safe behaves.

## AI SDK versions + wire-contract primitives (for 04-03)

**Installed (exact):** `ai@6.0.301`, `@ai-sdk/react@3.0.304`, `@ai-sdk/anthropic@3.0.127`. **`--legacy-peer-deps` was NOT needed** — install resolved cleanly (react@19.3.0 satisfied all peers).

> Note: the plan predicted `ai@^7` / `@ai-sdk/react@^4` / `@ai-sdk/anthropic@^4`; the current npm `latest` dist-tags resolve one major lower for each. These are the current latest published majors. 04-03 must bind to the ai@6 primitive names below, not the plan's predicted major numbers.

Concrete primitive NAMES later plans are bound to (verified present in the installed build — `node -e` export inspection):

- **Server streaming-response function:** `streamText(...).toUIMessageStreamResponse()` (result method). Lower-level builders also available: `createUIMessageStream` + `createUIMessageStreamResponse` / `pipeUIMessageStreamToResponse`.
- **Client transport + per-send request-prep:** `DefaultChatTransport` (from `@ai-sdk/react` / re-exported by `ai`), configured with `prepareSendMessagesRequest` (plus `body` / `headers`) to shape each outgoing request. `useChat` is the hook.
- **Multi-step control:** `stopWhen: stepCountIs(n)` (both `stopWhen` and `stepCountIs` exported from `ai`). There is no `maxSteps` option in this major — use `stopWhen`.
- **Custom-data / annotations for carrying citations in the stream:** the UI-message-stream writer path — `createUIMessageStream({ execute({ writer }) { writer.write({ type: 'data-...', data }) } })` (data parts), consumed on the client via `useChat` message `parts` / `readUIMessageStream`. `tool()` + `dynamicTool()` define tools; `convertToModelMessages` adapts UI messages to model messages.

**04-03 is the single authority that FIXES the wire contract using these primitives; 04-04/04-05 bind to 04-03's SUMMARY.**

## Task Commits

1. **Task 1: Install AI SDK + server-side config** - `5b1d849` (feat)
2. **Task 2: Assistant error codes + schema tables + migrate** - `aff0132` (feat)
3. **Task 3: Schema + config sanity test** - `22fa5bf` (test)

**Plan metadata:** _(docs commit — this SUMMARY + STATE.md)_

## Files Created/Modified
- `src/lib/assistantConfig.ts` - Single source of truth for model/temperature(0) + server-side-only key accessor + `isAssistantConfigured()` fail-safe.
- `src/lib/errors.ts` - Added `AssistantUnavailableError` (503) + `ToolArgsInvalidError` (422).
- `prisma/schema.prisma` - `MessageRole` enum + three assistant models (additive `exhibit_id`/`event_id`); `conversations` back-relation on `Case`/`User`.
- `prisma/migrations/20261007161004_add_assistant_tables/` - Migration creating `assistant_conversations`, `assistant_messages`, `assistant_citations` (`exhibit_id` NOT NULL, `event_id` nullable).
- `.env.example` - `ANTHROPIC_API_KEY` placeholder (`sk-ant-REPLACE_ME`) + optional `ANTHROPIC_MODEL` comment; no real key.
- `src/lib/assistant/schema.test.ts` - Round-trip + config fail-safe regression test.
- `package.json` / `package-lock.json` - AI SDK deps.

## Migration path
Applied with **`npx prisma migrate dev --name add_assistant_tables --skip-seed`** against the compose Postgres on `localhost:5432` (healthy), then `prisma generate`. The create-only + deploy fallback was not needed. A migration file landed under `prisma/migrations/`. Confirmed the migration SQL adds `"exhibit_id" TEXT NOT NULL` and `"event_id" TEXT` (nullable) to `assistant_citations`.

## Decisions Made
- **AI SDK majors:** took the current published `latest` (`ai@6`, `@ai-sdk/react@3`, `@ai-sdk/anthropic@3`) rather than forcing the plan's predicted `^7/^4/^4`. Install was clean; no react/next downgrade, no `--legacy-peer-deps`. Later plans bind to the ai@6 primitive names above.
- **Model id:** `claude-sonnet-4-5` (pinned default, env-overridable).
- **Citation divergence from TechArch (documented):** `AssistantCitation` adds `exhibitId` (required) and `eventId` (nullable) beyond TechArch's canonical `recordType/recordId/timestamp/label`. **Why:** the 04-05 pill must deep-link to `/exhibit/:exhibitId?event=:eventId`, and a replayed citation (loaded via `GET /conversations/:id`) has no other way to carry its navigation target. `recordId === eventId` holds only for `ExhibitEvent` citations; for `DiscrepancyFlag` (recordId = flag id) and `JuryPackageExhibit` (recordId = row id) it does not — hence the dedicated columns. `eventId` is nullable for citation types with no single timeline anchor (a JuryPackageExhibit row, a search row); the pill then lands at top-of-timeline.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] AI SDK major versions resolved lower than the plan predicted**
- **Found during:** Task 1 (`npm install ai @ai-sdk/react @ai-sdk/anthropic`)
- **Issue:** The plan expected `ai@^7` / `@ai-sdk/react@^4` / `@ai-sdk/anthropic@^4`. The current npm `latest` dist-tags resolve to `ai@6.0.301` / `@ai-sdk/react@3.0.304` / `@ai-sdk/anthropic@3.0.127`.
- **Fix:** Installed the current latest majors as-is. No ERESOLVE conflict occurred (react@19.3.0 satisfied all peers), so `--legacy-peer-deps` was NOT used and no framework downgrade was performed. Verified the primitive names 04-03 needs are present in the installed build and pinned them in this SUMMARY.
- **Files modified:** package.json, package-lock.json
- **Verification:** `grep` of package.json for the three deps + absence of vector/LangChain deps; `node -e` export inspection confirming `streamText().toUIMessageStreamResponse`, `DefaultChatTransport`, `stepCountIs`/`stopWhen`, `createUIMessageStream`; `tsc --noEmit` clean; full vitest suite green; build passes.
- **Committed in:** 5b1d849 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — version reality vs predicted). **Impact on plan:** None on behavior; only the pinned major numbers and the wire-contract primitive names changed. No scope creep. Later plans must read the "AI SDK versions + wire-contract primitives" section above rather than the plan's predicted majors.

## Known Stubs
None found. (The `PLACEHOLDER_KEY` / "placeholder" references in `assistantConfig.ts` and the test are the intentional missing-key fail-safe feature, not incomplete implementation.)

## Deferred Issues
None.

## Issues Encountered
None.

## User Setup Required
**External service configuration required for grounded answers.** The assistant calls Anthropic server-side. With `ANTHROPIC_API_KEY` left as the placeholder or unset, the app boots and every other screen works; the assistant route (built in 04-03) returns 503 `ASSISTANT_UNAVAILABLE`. To exercise real answers, set a real key:
- `ANTHROPIC_API_KEY` — from the Anthropic Console → Settings → API Keys (https://console.anthropic.com/settings/keys)
- `ANTHROPIC_MODEL` (optional) — override the pinned `claude-sonnet-4-5`

## Next Phase Readiness
- Foundation complete: SDK deps, config seam, error codes, and the migrated data model are in place.
- **Ready for 04-02** (tool layer) and **04-03** (chat route — the authority that fixes the wire contract using the ai@6 primitives pinned above).

## Self-Check: PASSED
- Created files exist: `src/lib/assistantConfig.ts`, `src/lib/assistant/schema.test.ts`, `prisma/migrations/20261007161004_add_assistant_tables/migration.sql` — all FOUND.
- Commits exist: `5b1d849`, `aff0132`, `22fa5bf` — all in `git log`.
- Build check: `npm run build` → exit 0.
- Full test suite: `npx vitest run` → 157/157 passing (27 files). `tsc --noEmit` → exit 0.
- `## Known Stubs` present, no blocking entries.

---
*Phase: 04-pivota-assistant*
*Completed: 2026-10-07*
