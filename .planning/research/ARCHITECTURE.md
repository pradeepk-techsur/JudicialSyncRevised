# Architecture Research

**Domain:** Courtroom exhibit-tracking demo with embedded conversational assistant
**Researched:** 2026-10-06
**Confidence:** HIGH (patterns are well-established; verified against Anthropic's agent architecture guidance and Vercel AI SDK tool-calling docs — no exotic domain-specific architecture needed)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│  UI Layer: Trial Command Center │ Case Workspace │           │
│            Exhibit Detail │ Jury Package │ Assistant Panel   │
├─────────────────────────────────────────────────────────────┤
│  Service Layer (single set of typed query/command functions)│
│  getExhibits() getHistory() getUnresolvedObjections()        │
│  getCustodian() getJuryPackage() recordEvent()                │
├──────────────────────────┬────────────────────────────────────┤
│  Assistant: tool-calling │  Data Layer                        │
│  LLM wraps the SAME      │  - exhibits (current-state table)  │
│  service functions as    │  - events (append-only ledger:     │
│  tools; no separate      │    status/objection/ruling/custody)│
│  retrieval path          │  - seed data loader                │
└──────────────────────────┴────────────────────────────────────┘
```

The critical decision: dashboards and the assistant read through **one service
layer**, not parallel paths. This is what makes citations trustworthy — the
assistant can't say something the UI doesn't also show.

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| UI screens | Render current state + history, no business logic | React components, fetch via service layer |
| Service layer | Single source of truth for reads/writes; both UI and assistant call it | Typed functions (TS), one per query shape |
| Event ledger | Append-only record of every status/objection/ruling/custody change | SQLite/Postgres table: `(id, exhibit_id, type, payload, actor, ts)` |
| Current-state table | Denormalized "latest view" derived from ledger, for fast dashboard reads | Materialized on write, or computed view |
| Assistant | Tool-calling LLM; tools = service layer functions; returns answer + cited record IDs | Anthropic/OpenAI tool-use API |

## Recommended Project Structure

```
src/
├── data/
│   ├── schema.ts         # exhibit/event/objection/ruling/custody types
│   ├── seed.ts           # deterministic seed scenario (one trial)
│   └── store.ts          # SQLite/in-memory store + migrations
├── services/
│   ├── exhibits.ts        # getExhibits, getHistory, getCustodian
│   ├── juryPackage.ts      # getJuryPackage + discrepancy detection
│   └── events.ts           # recordEvent (append to ledger, update current state)
├── assistant/
│   ├── tools.ts            # thin wrappers: each service fn → one LLM tool
│   ├── system-prompt.ts    # grounding + citation-format instructions
│   └── client.ts           # LLM call loop (tool-use, multi-step)
├── app/ (or pages/)
│   ├── command-center/
│   ├── case/[id]/
│   ├── exhibit/[id]/
│   └── jury-package/
└── components/            # shared dashboard widgets (status badges, timelines)
```

- **services/:** one file per aggregate, not per screen — screens compose multiple service calls; the assistant's tools are 1:1 wrappers around these same calls, so there is no logic to keep in sync.
- **assistant/tools.ts:** deliberately thin — if a tool needs new logic, it goes in `services/`, not here, or the assistant and UI will drift.

## Architectural Patterns

### Event-sourced ledger + derived current state

**What:** Every status change, objection, ruling, and custody transfer is an
immutable event row; "current status" is a view/projection over the ledger,
not a separately-edited field.
**When to use:** History matters as much as current state here — custody
chain, ruling history, and discrepancy detection all need "what happened and
when," not just "what is true now."
**Trade-offs:** Slightly more write-path code than plain CRUD; pays off
immediately because Exhibit Detail's timeline and the assistant's "what
happened to Exhibit 14" read the same ledger with zero extra modeling.

### Tool-calling LLM over typed queries (not vector RAG)

**What:** The assistant is an "augmented LLM" (Anthropic's agent pattern)
with a small, fixed set of function tools — `getUnresolvedObjections`,
`getCustodian`, etc. — each returning structured JSON with record IDs and
timestamps the model is instructed to cite.
**When to use:** The data is structured and relational, not a document
corpus — nothing to embed. Tool calls give exact, auditable answers; vector
retrieval would introduce approximation where none is needed.
**Trade-offs:** Requires enumerating tools up front (fine — the question set
is known); doesn't generalize to free-text document search, but nothing in
scope needs that.

```typescript
const getUnresolvedObjections = tool({
  description: "List objections with no recorded ruling",
  inputSchema: z.object({ caseId: z.string() }),
  execute: async ({ caseId }) =>
    services.events.unresolvedObjections(caseId), // same fn UI uses
});
```

## Data Flow

### Request Flow

```
Dashboard:  [Screen] → service.getX(caseId) → current-state table → render
Assistant:  [Question] → LLM+tools → service fn(s) → ledger/current-state
                ↓                                           ↓
            [answer, citing ids/timestamps] ←───────── [JSON result]
```

### Live multi-screen updates

For the demo beat where a deputy updates an exhibit and the judge's screen
reflects it live: client-side polling (refetch every 3–5s, or on window
focus) is sufficient at this scale and avoids websocket infra. Upgrade to
SSE/WebSocket only if the live demo script needs sub-second visible sync
across two screens side-by-side — flag as a phase-specific decision, not one
to make now.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Demo (1 case, <10 users) | Monolith, SQLite/embedded Postgres, polling for live updates — this is the whole target |
| Hypothetical multi-case/multi-tenant | Out of scope per PROJECT.md; schema's `case_id` would need real partitioning + auth |

**First bottleneck:** none expected at demo scale. **Second:** LLM response latency during the assistant's live Q&A is the one thing a non-technical audience would notice; mitigate with a fast model tier and a tight (≤6) tool set so tool-selection stays single-step.

## Anti-Patterns

### Vector-embedding RAG over the exhibit data

**What people do:** Default to chunk-and-embed-and-retrieve for "natural
language Q&A," treating this like a document search problem.
**Why it's wrong:** The data is structured and small; embeddings add
approximation, lose exact citations (record IDs, timestamps), and can't
guarantee the assistant's claim matches what the dashboard shows.
**Do this instead:** Typed tool calls against the same service layer the UI
uses — see pattern above.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| LLM provider (Anthropic/OpenAI) | Tool-calling API, server-side only | Only external dependency; no court-system integrations per scope |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| UI screens ↔ service layer | Direct function calls / REST | No screen owns query logic — keeps 4 screens consistent |
| Assistant ↔ service layer | Tool wrappers (1:1) | Prevents assistant drifting from what dashboards show |
| Event ledger ↔ current-state view | Append triggers projection update | Enables both "now" and "history" reads cheaply |

## Sources

- Anthropic, "Building Effective Agents" — augmented-LLM/tool-use pattern — HIGH, official
- Vercel AI SDK docs, "Tools" (ai-sdk.dev/docs/foundations/tools) — tool schema/execution — HIGH, official
- Event sourcing for audit-trail domains (custody chain, status history) — MEDIUM, general architecture consensus, no domain-specific source found

---
*Architecture research for: courtroom exhibit-tracking demo with conversational assistant*
*Researched: 2026-10-06*
