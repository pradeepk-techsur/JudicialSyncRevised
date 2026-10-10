## F07: Pivota Assistant (Natural-Language Q&A)

**Description:** A conversational assistant answering natural-language courtroom questions about exhibit status, custody, rulings, and jury eligibility, with every factual claim resolving to a specific, citable ledger record. This is the feature the entire demo's success depends on: "if this fails, nothing else about the demo matters." The assistant is implemented purely via LLM tool-calling against the exact same service-layer functions every UI screen calls — **not** retrieval-augmented generation, not embeddings, not vector search. Because the underlying data is small, structured, and exact-citation-critical, any approximate-retrieval approach would introduce exactly the risk (plausible-but-wrong answers) this feature exists to eliminate.

**Terminology:**
- **Tool Wrapper:** A thin function exposed to the LLM (via the AI SDK's `tool()`) that is a 1:1 pass-through to one service-layer function — it contains no independent business logic, only zod input validation and a direct call-through. If new logic is ever needed, it is added to the service layer, never to the tool wrapper, preventing the assistant's behavior from drifting from the UI's.
- **Grounded Answer:** An assistant response where every factual sentence is backed by at least one citation (`recordType`, `recordId`, `timestamp`) returned from a tool call in that same turn.
- **Decline Response:** The assistant's required fallback — "I don't have that information" (or an equivalent explicit statement) — used whenever no tool call returns a record supporting the user's question. This is a valid, expected, and required response path, not a failure mode to be avoided.

**Sub-features:**
- Streaming chat interface (Vercel AI SDK `useChat` + `streamText`)
- Fixed, small tool set (≤8 tools) wrapping the service layer 1:1
- Citation-enforcing system prompt (cite-or-decline, no free-generation fallback for factual claims)
- Role-scoped tool execution identical to UI role-based visibility rules
- Conversation and citation persistence for audit/replay
- *(Phase 9)* Context-aware example/suggested-question prompts — when the assistant is opened with an optional exhibit-context parameter (e.g., via F10's "Ask Pivota about {exhibitLabel}" header action), the chip set references that specific exhibit's label (e.g., "Why is P-7 flagged?", "What happened to P-7?") instead of the case-wide generic example set F15 already sources from real `exhibitLabel` values

**Tool Set:**
| Tool Name | Wraps Service Function | Purpose |
|---|---|---|
| `getExhibitStatus` | `getExhibitStatus(exhibitId)` | Current lifecycle status of a specific exhibit |
| `getUnresolvedObjections` | `getUnresolvedObjections(caseId)` | List all currently-unresolved objection threads case-wide |
| `getCustodian` | `getCustodian(exhibitId)` | Current custodian of a specific exhibit |
| `getCustodyHistory` | `getCustodyHistory(exhibitId)` | Full chain-of-custody history for a specific exhibit |
| `getExhibitHistory` | `getExhibitHistory(exhibitId)` | Full chronological event timeline for a specific exhibit (status + objections + rulings + custody) |
| `searchExhibits` | `searchExhibits(criteria)` | Multi-criteria exhibit search (F4) |
| `getJuryPackageStatus` | `getJuryPackageStatus(caseId, exhibitId?)` | Whether a specific exhibit is in the jury package, or the full package contents |
| `getDiscrepancies` | `getDiscrepancies(caseId, exhibitId?)` | Open/acknowledged discrepancy flags case-wide or per exhibit |

**Process:**
1. An authorized user submits a natural-language question via the chat panel (`useChat`), tagged with their `userId`/`role` from the active session (role switcher, per PROJECT.md scope).
1a. **(Phase 9) Context-aware example prompts:** if the assistant panel was opened with a `contextExhibitId` (carried as client-side route/URL state, e.g., from F10's "Ask Pivota about {exhibitLabel}" header action), the chip set of suggested questions is generated referencing that specific exhibit's label and known state (e.g., "Why is P-7 flagged?" when the exhibit has an open discrepancy, "What happened to P-7?" generically) rather than the standard case-wide example set F15 already sources from real `exhibitLabel` values. This selection happens entirely client-side against already-loaded exhibit data (the same `getExhibits` result F15's fix relies on) — no new endpoint, tool, or query is introduced for this purpose, and `contextExhibitId` is never sent to or persisted by `POST /api/assistant/chat` (it governs only which example chips render, not the chat request itself).
2. The server-side route handler calls `streamText` with the fixed tool set, the user's message, and a system prompt (see §System Prompt Requirements below) including the requesting user's role.
3. The model selects and calls one or more tools; each tool wrapper validates arguments with zod, then calls the identical service-layer function used by the UI — passing the requesting user's role through so role-based visibility filtering (sealed exhibits, etc.) is applied identically to a UI query (see `00-header.md` §Role-Based Visibility).
4. Each tool returns structured JSON including record IDs and timestamps (e.g., `{ exhibitId, currentStatus, lastStatusEventId, lastStatusAt }`).
5. The model is instructed to compose its natural-language answer using only facts present in tool results from this turn, attaching an inline citation (record type + ID + timestamp) to every factual claim.
6. The response streams to the client; the chat UI renders citations as visible, distinguishable inline markers (not hidden metadata) so a judge or clerk can see exactly which record backs each statement.
7. If no tool call returns a record relevant to the question (e.g., asking about a nonexistent exhibit, or a sealed exhibit the user's role cannot see), the model must respond with an explicit Decline Response rather than inferring or guessing.
8. Every assistant message and its citations are persisted (`AssistantConversation`, `AssistantMessage`, `AssistantCitation`) for audit review (PER-04's compliance use case) and for spot-check cross-screen-consistency testing.

**System Prompt Requirements (non-negotiable, enforced via prompt + validated in testing):**
- The assistant must never state a fact about exhibit status, custody, rulings, objections, or jury eligibility without a tool call having returned the supporting record in the current turn.
- The assistant must decline explicitly ("I don't have that information about Exhibit X") when no tool result supports an answer — this is correct behavior, not an error to minimize.
- The assistant must not hedge with vague caveats ("it appears that...") when it *does* have a grounded answer — confident, concise statement plus visible citation (per PITFALLS.md §UX Pitfalls).
- The assistant must not answer from conversation history alone across turns without re-querying if the underlying data could have changed (favor a fresh tool call over stale reuse within the same session for status/custody questions).
- Temperature is set low/near-zero for tool-selection and answer composition to minimize answer variance across repeated identical questions during a live or recorded demo (per STACK.md integration guidance).

**Inputs:**
- `caseId` (string/UUID, required, from session context)
- `userId` (string/UUID, required, from session/role switcher)
- `message` (string, required): the user's natural-language question
- `conversationId` (string/UUID, optional): continues an existing conversation if supplied
- `contextExhibitId` (string/UUID, optional, Phase 9): supplied when the assistant is opened via an exhibit-scoped entry point (F10's "Ask Pivota about {exhibitLabel}" action); carried as client-side route/URL state only — it governs example-prompt chip generation (§Process step 1a) and is never forwarded to or stored as part of the `AssistantConversation`/`AssistantMessage` record

**Outputs:**
- Streamed assistant message text
- `citations[]`: array of `{ recordType: 'ExhibitEvent' | 'DiscrepancyFlag' | 'JuryPackageExhibit', recordId, timestamp, label }` attached to the persisted `AssistantMessage`
- Persisted `AssistantConversation`/`AssistantMessage`/`AssistantCitation` rows

**Validation:**
- Every tool call's arguments are validated via zod before reaching the service layer — malformed tool-call arguments (e.g., non-UUID `exhibitId`) are rejected back to the model as a tool error, not passed through to Prisma
- Tool execution must apply the requesting user's role to any visibility-sensitive query exactly as the equivalent UI endpoint would (sealed exhibits excluded identically — see `00-header.md` §Role-Based Visibility); there is no "assistant admin override"
- A response containing a factual claim with zero associated citation is a defect to be caught in testing (see Success Metrics: "0 instances of ungrounded answers") — not merely discouraged but treated as a release blocker
- The five named example questions (admitted-yesterday, unresolved-objections, jury-package-membership, current-custodian, exhibit-history) must each resolve via the tool set above with no gaps requiring a new tool at demo time
- *(Phase 9)* `contextExhibitId`, when supplied, must correspond to an exhibit currently visible to the requesting role under standard role-based visibility (`00-header.md` §Role-Based Visibility) — if the supplied exhibit is sealed/ex-parte and the role is unauthorized, the panel falls back to the standard case-wide example set rather than generating a chip that references (and so reveals the existence of) a masked exhibit

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| Tool-call arguments fail zod validation | 400 (tool-level, surfaced to model) | TOOL_ARGS_INVALID | "Invalid arguments for tool {toolName}" |
| Referenced exhibit/case not found inside a tool call | — (tool returns empty/null, model must decline) | — | Model responds: "I don't have that information" |
| LLM provider unavailable/timeout | 503 | ASSISTANT_UNAVAILABLE | "The assistant is temporarily unavailable — please try again" |
| User role lacks visibility into the only matching (sealed) record | — (tool returns empty result set, model must decline) | — | Model responds: "I don't have that information" (never reveals the record's existence) |

**(Phase 9)** Context-aware example prompts (`contextExhibitId`) introduce no new error code — an unresolvable or unauthorized context exhibit silently falls back to the standard example set (§Validation above), never a surfaced error.

**API Surface (this feature):** see `Y1-api.md` §Assistant for `POST /api/assistant/chat` (streaming), `GET /api/assistant/conversations/:id`. The Phase 9 `contextExhibitId` example-prompt behavior introduces no new endpoint and no change to either request/response shape above — it is a client-side-only chip-generation input, not a chat-request field.

**Schema Surface (this feature):** owns `AssistantConversation`, `AssistantMessage`, `AssistantCitation`; reads (via tools) every projection and ledger table defined across F0–F6 — see `Y0-schema.md` §Assistant.
