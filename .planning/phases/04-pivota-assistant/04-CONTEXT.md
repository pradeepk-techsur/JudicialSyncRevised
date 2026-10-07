# Phase 4: Pivota Assistant - Context

**Gathered:** 2026-10-07
**Status:** Ready for planning

<domain>
## Phase Boundary

A conversational, streaming natural-language assistant (F7) that answers courtroom questions about exhibit status, custody, rulings, objections, jury eligibility, and discrepancies — with every factual claim resolving to a specific, citable ledger/projection record, or an explicit decline.

**Architecture (locked by spec, not open for discussion):**
- Pure LLM **tool-calling** via the Vercel AI SDK (`streamText`, `tool()`, `useChat`) — **not** RAG, not embeddings, not vector search.
- A fixed set of **8 tool wrappers**, each a 1:1 thin pass-through to an existing service-layer function (zod-validated args, direct call-through, no independent business logic): `getExhibitStatus`, `getUnresolvedObjections`, `getCustodian`, `getCustodyHistory`, `getExhibitHistory`, `searchExhibits`, `getJuryPackageStatus`, `getDiscrepancies`.
- **Role-scoped identically to the UI** — tools pass the requesting user's role to the service layer; sealed-exhibit visibility is applied exactly as a UI query; no "assistant admin override".
- **Cite-or-decline:** every factual sentence carries an inline citation from a tool result in the same turn; when no tool returns a supporting record, the model emits an explicit Decline Response ("I don't have that information") — a valid, required path, never styled as an error.
- Conversation + citation **persistence** for audit (`AssistantConversation`, `AssistantMessage`, `AssistantCitation`).
- Delivered two ways: a **global slide-over panel** ("Ask ✦" on every screen) and a **full-page `/assistant`** view.

**Out of scope (later / deferred):** proactive unprompted alerts (ASST-V2-01), multi-case history (ASST-V2-02), SSE/WebSocket streaming infra beyond what the AI SDK provides, any retrieval/vector approach.

</domain>

<decisions>
## Implementation Decisions

### Provider, model & temperature
- **Anthropic via `@ai-sdk/anthropic`** (per TechArch), kept swappable through the AI SDK provider abstraction.
- Model: **Claude Sonnet (latest)** — balanced tool-calling quality + streaming latency for a live demo. Pin the model ID in a single config constant (e.g. `ANTHROPIC_MODEL` env with a code default) so it's trivial to change.
- **Temperature: 0** for both tool-selection and answer composition — deterministic repeated-question behavior for live/recorded demos (FRD §System Prompt Requirements).

### API-key handling & resilience
- **Missing/invalid `ANTHROPIC_API_KEY` must never break the build or the other four screens.** The app boots normally; the assistant route detects the absent/invalid key and returns `503 ASSISTANT_UNAVAILABLE`; the chat UI renders the distinct "temporarily unavailable" state. Every other screen stays fully usable for manual lookup (F7 success criterion 5).
- **Key wiring:** add `ANTHROPIC_API_KEY` (and optional `ANTHROPIC_MODEL`) to `.env.example` with a placeholder + comment; read **server-side only**, never in the client bundle (TechArch §7.1). Real key via local `.env` / Vercel env in deploy. No key committed. No runtime UI key entry.

### Citation rendering & click-through
- **Pill format:** `[RecordLabel · RecordType · Timestamp]`, monospace, bordered, inline immediately after the sentence it supports — same visual treatment as status badges elsewhere. Type-specific middle token: `STATUS_CHANGE` (and other event types) for `ExhibitEvent`, `DiscFlag` for `DiscrepancyFlag`, `JuryPkgRow` for `JuryPackageExhibit`. Same pill shape across all types.
- **List answers:** one citation pill **per listed item**, attached to that item's sentence/line — every factual claim individually traceable (not one aggregate pill for the set).
- **Click-through target:** **all** citation types navigate to that exhibit's **Exhibit Detail View** (`/exhibit/:id`), the single screen that shows every record type for an exhibit.
- **Highlight mechanism:** deep-link via an event id param (e.g. `/exhibit/:id?event=<eventId>`); the Timeline scrolls that entry into view and applies a brief (~400ms) highlight fade (reuse the Y0-patterns live-sync highlight convention). Falls back gracefully to top-of-timeline if the event isn't present for the role.

### Panel vs full-page behavior
- **Shared single conversation:** the slide-over panel and the full-page `/assistant` read/write the same active conversation — switching surfaces keeps the thread continuous.
- **Panel persists across navigation:** the "Ask ✦" panel stays open (thread + scroll preserved) as the user moves between screens ("without losing that screen's state underneath"). Panel UI state lives in **zustand** (same pattern as the existing role store).
- **Citation click from the panel:** routes the main screen underneath to `/exhibit/:id` (scrolled/highlighted) while the panel **stays open** over it — one-tap trust loop without losing conversation context.
- **Empty-state example chips:** the five named demo questions appear as tappable chips in **both** surfaces; tapping pre-fills and **auto-submits** (zero-typing path). Chips disappear once the conversation has messages.

### Conversation session & persistence
- **Created on first message sent** (not on panel/page open) — no empty orphan conversations; viewing creates no state.
- **One continuous conversation per browser session:** the active `conversationId` is held in zustand (alongside role); returning to the assistant reloads that thread via `GET /api/assistant/conversations/:id`.
- **Role switch starts a new conversation** (new `conversationId`) — prevents a single audit thread from mixing answers computed under different visibility scopes, and stops the model reusing a prior-role answer from history. Prior conversations remain persisted/reviewable.
- **Explicit "New conversation" control** in the panel/page header — starts a fresh thread on demand (brings back example chips), useful for demo resets and clean audit threads. Prior conversations stay persisted.

### Degraded / dependency-gap behavior
- **Build all 8 tools against the real service layer**, including `getJuryPackageStatus` and `getDiscrepancies` (Phase 3 functions). Phase 4 depends on Phase 3 per the roadmap's sequential execution (1→2→3→4); if Phase 3 isn't merged at build time that is a **sequencing blocker to surface**, not something to stub or feature-flag.
- **Timeout/unavailable retry:** on `503 ASSISTANT_UNAVAILABLE`, show the distinct unavailable notice with a **manual "Try again"** button that re-submits the user's preserved question. No auto-retry loop. The typed question is preserved in the input (F7 criterion 5).
- **Unavailable styling:** rendered as an inline **system notice** (distinct container, subtle warning tint + small icon + "Try again") — clearly NOT an assistant answer bubble and NOT the neutral decline styling. The three outcomes (grounded answer / decline / error) are visually unambiguous.
- **Error vs decline separation (correctness-critical):** `ASSISTANT_UNAVAILABLE` and tool/transport failures surface on the **error/transport channel** (503) and are rendered as the system-notice state — they **never** arrive as assistant message text. A **Decline is only ever the model's own grounded-fallback text** when tools returned no supporting record. This keeps "I don't have that information" strictly distinct from "the assistant broke". Enforce/verify this separation in tests.

### Claude's Discretion
- Exact system-prompt wording (must satisfy all FRD §System Prompt Requirements: cite-or-decline, no ungrounded facts, no hedging when grounded, prefer fresh tool call over stale history for status/custody, confident/concise courtroom-clerk tone, no emoji/filler).
- Streaming/typing-indicator micro-UX, suggestion-chip styling, message-bubble layout details.
- Tool-wrapper zod schemas and how tool errors (`TOOL_ARGS_INVALID`) are surfaced back to the model.
- How the active `conversationId` + role are threaded through `useChat` request tagging.
- Request timeout threshold that trips `ASSISTANT_UNAVAILABLE`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Feature requirements (FRD)
- `project_specs/FRD/F07-pivota-assistant.md` — the complete assistant contract: tool set (the 8 tools + which service fn each wraps), tool-wrapper definition (1:1, no business logic), grounded-answer/decline definitions, the non-negotiable System Prompt Requirements, inputs/outputs, validation (zero-citation = release blocker; role-scoping identical to UI; the 5 named questions must resolve), error states (TOOL_ARGS_INVALID, ASSISTANT_UNAVAILABLE 503, role/not-found → decline).
- `project_specs/FRD/00-header.md` §Role-Based Visibility — the role-scoping rule the tools must apply identically to the UI.
- `project_specs/FRD/Y1-api.md` §Assistant — `POST /api/assistant/chat` (streaming) and `GET /api/assistant/conversations/:id` contracts.
- `project_specs/FRD/Y2-errors.md` — error envelope conventions (existing `src/lib/errors.ts` + `src/lib/apiError.ts`).
- `project_specs/FRD/Y0-schema.md` §Assistant — `AssistantConversation`, `AssistantMessage` (MessageRole USER/ASSISTANT), `AssistantCitation` (recordType/recordId/timestamp/label; a zero-citation ASSISTANT message is only valid if it's a Decline). NOTE: these models are NOT yet in `prisma/schema.prisma` — a migration is required this phase.

### UX / interaction contracts
- `project_specs/UX-Mockup/Screen-04-pivota-assistant.md` — slide-over + full-page layouts, information hierarchy, the full States table (empty/streaming/grounded/decline/role-scoped-decline/citation-clicked/unavailable/repeat-question), interactive elements, and the tone/copy guidelines (confident, no hedging, no emoji, courtroom-clerk register).
- `project_specs/UX-Mockup/Y0-patterns.md` — Citation Pill, Decline-as-Valid-Response Styling, Sealed-Exhibit Invisibility, Status Badge Convention, Polling-Based Live Sync (highlight-fade convention reused for citation deep-link).

### Technical architecture
- `project_specs/TechArch/05-tech-stack.md` §6.1/§6.4/§6.5 — AI SDK packages (`ai`, `@ai-sdk/react`, `@ai-sdk/anthropic`), provider swappability, and the explicitly-avoided deps (no vector DB, no embeddings, no LangChain) that must NOT be reintroduced.
- `project_specs/TechArch/06-integrations.md` §7.1 — the LLM provider as the only external dependency, server-side-only key, near-zero temperature, no client-side LLM calls.
- `project_specs/TechArch/03-api.md` — API layering conventions (thin routes over service layer; tool wrappers are a parallel thin layer, never a parallel data path).
- `project_specs/TechArch/04-security.md` — role enforcement model the tools inherit.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (6 of 8 tool targets already exist)
- `src/services/status.ts` → `getExhibitStatus(exhibitId)` — wrapped by the `getExhibitStatus` tool.
- `src/services/objections.ts` → `getUnresolvedObjections(caseId)` — wrapped by `getUnresolvedObjections`.
- `src/services/custody.ts` → `getCustodian(exhibitId)` and `getCustodyHistory(exhibitId)` — wrapped by `getCustodian` / `getCustodyHistory`.
- `src/services/history.ts` → `getExhibitHistory(exhibitId)` — wrapped by `getExhibitHistory`; already returns plain-language, actor/custodian-resolved timeline entries with record ids/timestamps (ideal citation source).
- `src/services/exhibits.ts` → `searchExhibits(criteria)` (+ `SearchExhibitsCriteria`) — wrapped by `searchExhibits`; also `getExhibit` for the Exhibit Detail citation target.
- `src/services/cases.ts` → `getActiveCaseWithUsers()` — supplies the active `caseId` and persona roster for session context.
- **Phase 3 (dependency):** `getJuryPackageStatus(caseId, exhibitId?)` and `getDiscrepancies(caseId, exhibitId?)` are introduced by Phase 3 — wrapped by the remaining two tools. Must exist before Phase 4 build.
- `src/services/visibility.ts` — `canViewSealed` / `parseRequestingRole` (fail-closed to ATTORNEY). The assistant must apply the requesting role through the same service predicates; reuse rather than re-implement.
- `src/lib/errors.ts` + `src/lib/apiError.ts` — typed error layer; add `ASSISTANT_UNAVAILABLE` (503) and `TOOL_ARGS_INVALID` here.
- `src/lib/apiClient.ts` (`apiFetch`) + `useRoleStore` (zustand) — attach `X-User-Role`; `useChat` requests must be tagged with the current role the same way, and the active `conversationId` tracked alongside role in zustand.
- `src/components/StatusBadge.tsx` — reuse the status word/treatment so the assistant's rendered status matches every other screen (never paraphrase `ADMITTED`).
- `src/components/shell/Header.tsx` / `Sidebar.tsx` — the Header already references an "Ask ✦" button and the Sidebar an "Assistant" item (per mockups); wire the panel toggle + `/assistant` nav here.
- `src/app/exhibit/[id]/` + `src/components/exhibit/Timeline.tsx` — the citation click-through target; extend to accept an `?event=<id>` deep-link that scrolls-to + highlights a Timeline entry.
- `src/hooks/useExhibitHistory.ts` — established react-query hook pattern (role in key, 4s `refetchInterval`); any assistant-side data hooks follow the same shape.

### Established Patterns
- **Service layer is the sole data path** (01-02): tool wrappers are a thin parallel entry point to the SAME functions the UI API routes call — never a separate query path (prevents assistant/UI drift; FRD "no parallel retrieval path").
- **Fail-closed role scoping** (02-02): `parseRequestingRole` → least-privileged ATTORNEY on missing/invalid role; sealed records excluded as a WHERE predicate, returning byte-identical empty/not-found so the assistant can't leak existence (anti-enumeration) — the assistant decline for a sealed record must be indistinguishable from "no such record".
- **zustand = client session** (02-05): role store is the whole client session; add assistant panel state + active conversationId to this layer.
- **Shared presentational components, server-truth-only** (02-06/02-07): the chat UI renders server/tool results; it computes no facts itself.
- **vitest `fileParallelism:false`** (01-07): integration suites share one Postgres + the fixed-caseNumber seed; new assistant tests follow suit.
- **Playwright role injection via `page.route` X-User-Role** (02-07): the in-memory zustand session resets on full navigation, so E2E role scoping (e.g. sealed-decline tests) injects the header rather than driving the UI switcher.

### Integration Points
- **New dependencies:** `ai`, `@ai-sdk/react`, `@ai-sdk/anthropic` (not yet installed — see package.json).
- **New env:** `ANTHROPIC_API_KEY` (+ optional `ANTHROPIC_MODEL`) added to `.env.example`, server-side only.
- **Schema migration required:** add `AssistantConversation`, `AssistantMessage`, `AssistantCitation` (+ `MessageRole` enum, `Case.conversations` relation) to `prisma/schema.prisma`.
- **New API routes:** `src/app/api/assistant/chat/route.ts` (streaming `streamText`) and `src/app/api/assistant/conversations/[id]/route.ts` (history reload).
- **New screen/route:** `src/app/assistant/page.tsx` (full page) + a global slide-over panel component mounted in the app shell.
- **Testing focus:** zero-ungrounded-answer assertion (release blocker), the 5 named questions each resolving via the tool set, sealed-decline indistinguishability, and error-vs-decline separation (503 never rendered as decline text).

</code_context>

<specifics>
## Specific Ideas

- The assistant is the demo's keystone — "if this fails, nothing else about the demo matters." Determinism (temp 0) and the never-ungrounded guarantee are treated as release blockers, not nice-to-haves.
- Three visually unambiguous outcomes are a hard UX goal: a **grounded answer** (with pill), a **decline** (calm/neutral, no pill, not an error), and an **unavailable error** (distinct system notice). Blurring any two is a defect.
- Tone target: a courtroom clerk, not a consumer chatbot — confident and brief, no hedging when grounded, no emoji/exclamations/"Great question!" filler.
- Citations should feel like the same "one source of truth" as the rest of the app — reuse status treatment, land on Exhibit Detail, highlight the exact cited event.

</specifics>

<deferred>
## Deferred Ideas

- Proactive/unprompted discrepancy alerts in the assistant (ASST-V2-01) — v2.
- Multi-case / cross-trial history in answers (ASST-V2-02) — v2.
- SSE/WebSocket sub-second sync infrastructure — explicitly deferred (polling suffices; AI SDK handles answer streaming).
- Runtime UI-entered API key — rejected; server-side env only.
- OpenAI provider — supported in principle via AI SDK swap, but Anthropic/Sonnet is the chosen default; switching is a one-line provider change, not phase scope.

</deferred>

---

*Phase: 04-pivota-assistant*
*Context gathered: 2026-10-07*
