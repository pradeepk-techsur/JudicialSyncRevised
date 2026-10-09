# Technical Architecture Document: JudicialSync

**Project Acronym:** JudicialSync
**Document Type:** TechArch (Technical Architecture Document)
**Version:** 1.2
**Status:** Draft
**Generated:** 2026-10-06
**Last Updated:** 2026-10-09 (Phase 7.1 — F16–F23, urgent inserted phase: exhibit classification taxonomy supersedes `isSealed` boolean, admission state-machine hardening confirmed documentation/test-only, custodian required atomically at intake, custody transfer converted to two-phase propose/confirm, full server-side RBAC permission matrix formally supersedes the prior "authorization out of scope" note for write actions, judge-facing pending-ruling queue, multi-case support, and versioned jury packages with real PDF export via the project's first new runtime dependency since stack lock-in)
**Previously:** 2026-10-08 (Phase 7 — F12–F15: admission integrity gate, jury-package sealed exclusion + migration, discrepancy-acknowledgment read-model join, usability fixes confirmed presentation-layer-only)
**Source Documents:** `PRD-JudicialSync.md`, `FRD-JudicialSync.md`
**Grounded in:** `.planning/research/SUMMARY.md`, `.planning/research/ARCHITECTURE.md`

---

## 1. Architectural Overview

### 1.1 Architecture Pattern

JudicialSync is a **single-tenant, monolithic full-stack Next.js application** built around one non-negotiable pattern established by project research and locked in by the FRD: **an append-only event ledger with derived current-state projections**, accessed exclusively through **one shared, typed service layer** consumed identically by UI screens and by the Pivota Assistant's tool-calling layer.

This is not a microservices system, not a CQRS-with-message-bus system, and not a RAG/vector-search system. It is intentionally the simplest architecture that satisfies a hard trust requirement: **the assistant must never be able to say something the dashboards don't also show.** The only way to structurally guarantee that is to remove all parallel data-access paths — hence one service layer, one database, one deployable artifact.

**Pattern name:** Event-sourced ledger + projected read model, single shared service layer, tool-calling LLM augmentation (Anthropic "augmented LLM" pattern — no agent framework, no RAG).

**Why this pattern (not alternatives):**
- **Event sourcing over mutable CRUD fields:** History questions ("what happened to Exhibit 14," full chain-of-custody, objection/ruling threads) are first-class product requirements (F2, F3, F10), not an afterthought. A mutable `currentStatus` column cannot answer "what was the status before this" without a second shadow history table — at which point you have reinvented event sourcing with extra steps and a consistency bug waiting to happen. Research (`ARCHITECTURE.md` §Architectural Patterns, `SUMMARY.md` §Critical Pitfalls #1) identifies this as the single highest-cost retrofit if deferred, so it is locked in at the schema level from day one.
- **Tool-calling over RAG/embeddings:** The data is small, structured, and relational (dozens–hundreds of exhibits, single case). Vector retrieval exists to handle *approximate* semantic matching over large unstructured corpora — exactly the opposite of what a courtroom exhibit record needs. Every assistant answer must resolve to an exact row ID and timestamp; embeddings would introduce approximation where zero approximation is tolerable (`ARCHITECTURE.md` §Anti-Patterns).
- **Monolith over microservices:** Single case, <10 concurrent demo users, one deployable Next.js app on Vercel. Splitting services would add operational complexity with zero benefit at this scale and would risk reintroducing a parallel data path between a "UI service" and an "assistant service" — the exact failure mode this architecture exists to prevent.
- **Synchronous writes over event queue/eventual consistency:** F5's jury-package finalization gate depends on discrepancy flags being re-evaluated *fresh*, not from a stale cache. An async queue between ledger write and projection update would reopen a trust gap. All five internal triggers (status → projection → discrepancy) fire synchronously within the same service-layer call (see `06-integrations.md` §Internal Triggers).

### 1.2 System Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                                  │
│                                                                            │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌────────────┐ │
│  │ Trial Command  │ │ Case Workspace │ │ Exhibit Detail │ │ Jury        │ │
│  │ Center (F8)    │ │ (F9)           │ │ View (F10)     │ │ Package     │ │
│  │ read-only,     │ │ list + search  │ │ timeline       │ │ Workspace   │ │
│  │ polling        │ │ + filters      │ │ + discrepancy  │ │ (F11)       │ │
│  └───────┬────────┘ └───────┬────────┘ └───────┬────────┘ └──────┬──────┘ │
│          │                  │                  │                 │        │
│          └──────────────────┴──────────────────┴─────────────────┘        │
│                              │ @tanstack/react-query (3-5s poll,          │
│                              │ refetch-on-focus) + zustand (role switch)  │
│                              │                                             │
│  ┌──────────────────────────▼───────────────────────────────────────┐    │
│  │  Pivota Assistant Chat Panel (F7)  — @ai-sdk/react `useChat`      │    │
│  │  streams tokens + renders inline citation markers                │    │
│  └──────────────────────────┬───────────────────────────────────────┘    │
└─────────────────────────────┼─────────────────────────────────────────────┘
                               │ HTTPS (Next.js API routes)
┌──────────────────────────────▼─────────────────────────────────────────────┐
│                    NEXT.JS 16 APP (single Vercel deployment)               │
│                                                                             │
│  ┌───────────────────────────┐   ┌────────────────────────────────────┐   │
│  │  API Routes (thin)        │   │  Assistant Route                   │   │
│  │  /api/exhibits/*          │   │  POST /api/assistant/chat          │   │
│  │  /api/cases/:id/*         │   │  - streamText() (Vercel AI SDK)    │   │
│  │  /api/objections/*        │   │  - fixed tool set (≤8 tools)       │   │
│  │  /api/discrepancies/*     │   │  - tools = 1:1 service wrappers    │   │
│  │  /api/jury-package/*      │   │  - cite-or-decline system prompt   │   │
│  │  parse req → call service │   │  - role passed into every tool     │   │
│  │  → shape response         │   │                                    │   │
│  └─────────────┬─────────────┘   └─────────────────┬──────────────────┘   │
│                │                                     │                     │
│                └──────────────────┬──────────────────┘                     │
│                                   ▼                                        │
│         ┌─────────────────────────────────────────────────────┐           │
│         │           SERVICE LAYER (sole entry point)           │           │
│         │  getExhibits · getExhibitStatus · getCustodian       │           │
│         │  getCustodyHistory · getExhibitHistory               │           │
│         │  getUnresolvedObjections · searchExhibits            │           │
│         │  getJuryPackageStatus · getDiscrepancies             │           │
│         │  recordEvent() · computeJuryCandidates()             │           │
│         │  evaluateDiscrepancies() · acknowledgeDiscrepancy()  │           │
│         │  — role-based visibility filtering applied here,     │           │
│         │    identically for every caller (UI route or tool)   │           │
│         └───────────────────────┬───────────────────────────────┘         │
│                                 ▼                                          │
│                      Prisma ORM (type-safe client)                        │
└──────────────────────────────┬──────────────────────────────────────────── ┘
                                │ TLS (pooled connection)
                 ┌──────────────▼───────────────┐
                 │   Neon Postgres (serverless)   │
                 │                                │
                 │  Ledger: ExhibitEvent           │
                 │  Projections: ExhibitCurrentState,
                 │    ObjectionCurrentState,       │
                 │    CustodyCurrentState,         │
                 │    DiscrepancyFlag              │
                 │  Identity: Case, User, Exhibit   │
                 │  Jury: JuryPackage,              │
                 │    JuryPackageExhibit            │
                 │  Assistant audit:                │
                 │    AssistantConversation,        │
                 │    AssistantMessage,              │
                 │    AssistantCitation             │
                 └────────────────────────────────┘

                 ┌────────────────────────────────┐
                 │  LLM Provider (Anthropic, via    │
                 │  @ai-sdk/anthropic) — the ONLY    │
                 │  external network dependency      │
                 │  (server-side tool-calling only)  │
                 └────────────────────────────────┘
```

### 1.3 Key Architectural Decisions

| Decision | Rationale | Consequence |
|---|---|---|
| Append-only event ledger (`ExhibitEvent`) as sole ground truth | History (custody chain, objection threads, "what happened") is a core requirement, not nice-to-have; retrofitting event-sourcing after shipping mutable fields is the costliest identified pitfall | No API or UI code path ever writes to a "current status" column directly — only `recordEvent()` writes the ledger; projections are derived, never independently edited |
| Current-state projections synchronously recomputed on every write | F5's finalization gate requires discrepancy re-evaluation to never be stale | No async queue, no eventual consistency window between a ledger write and its projection update |
| One service layer, shared by UI routes and assistant tools | This is what makes assistant citations trustworthy — assistant cannot state what the dashboard doesn't | Assistant tool wrappers contain *zero* business logic — 1:1 pass-through + zod validation only |
| Tool-calling LLM, not RAG/embeddings | Data is small, structured, exact-citation-critical; vector search introduces approximation where none is tolerable | No vector DB, no embeddings pipeline, no LangChain-style agent framework in the stack |
| Role-based visibility enforced inside the service layer (not per-route or per-tool) | A single enforcement point guarantees UI and assistant can never diverge on who sees sealed exhibits | Sealed-exhibit reads return identical 404s regardless of caller (UI route vs. assistant tool) — existence is never leaked |
| Polling (3–5s) for live multi-screen sync, not SSE/WebSocket | Sufficient at demo scale (<10 concurrent users, single case); avoids websocket infra for a one-time demo | `@tanstack/react-query` refetch interval + refetch-on-focus; SSE/WebSocket explicitly deferred unless a live demo script proves polling insufficient |
| Single Postgres database (Neon), no read replicas/caching | Demo scale is dozens–hundreds of exhibits, single case, <10 users — no bottleneck expected | Discrepancy rules read projections (not the full ledger) for performance; ledger scanned in full only for history views |
| No production auth; seeded users + role switcher | Explicitly out of scope per PROJECT.md — this is a sales demo, not a production system. **Narrowed by Phase 7.1 (F20):** this decision now governs *authentication* only — proving who a user is remains seeded-users-only, no OAuth/JWT. *Authorization* (what a known role may do) is, as of Phase 7.1, a fully enforced, in-scope capability covering every write action in the system — see `04-security.md` §5.2.2a for the superseding Permission Matrix. | `requestingUserRole` is derived from a client-side role-switcher component and passed with every request; no session/JWT/OAuth infrastructure exists. `actorUserId`'s role is independently resolved server-side from the `User` DB column for every write action (F20) — never trusted from the client. |
| Case scope widened from single-case to explicit multi-case, server stateless either way | PRD/FRD F22 (Phase 7.1) reversed the v1 single-case assumption; no schema change was required since `caseId` foreign keys already existed on every relevant table | `caseId` is now carried explicitly on every request (Case Selector client state) exactly as `requestingUserRole` already is — the server has no "current case" session value in either version |

### 1.4 Deployment Topology

JudicialSync ships as a **single deployable artifact**: one Next.js 16 application containing UI routes, API routes, and the assistant route, deployed to Vercel with Neon Postgres as the managed database.

```
┌────────────────────────┐        ┌──────────────────────────┐
│   Vercel (Production)   │        │   Neon Postgres           │
│                          │        │   (serverless, pooled)     │
│  ┌────────────────────┐  │  TLS   │                            │
│  │ Next.js 16 app      │──┼───────▶  single database, single   │
│  │ (UI + API +         │  │       │  schema, single `Case` row │
│  │  assistant routes)   │  │       │  for the demo's trial      │
│  │ Edge/Node runtime    │  │       └──────────────────────────┘
│  │ per-route as needed  │  │
│  └──────────┬──────────┘  │        ┌──────────────────────────┐
│             │              │        │  Anthropic API             │
│             └──────────────┼────────▶  (server-side only,        │
│                             │        │  tool-calling + streaming) │
└────────────────────────────┘        └──────────────────────────┘
```

**Environments:** A single `production`-equivalent environment is sufficient for a demo (plus a local dev environment backed by a Neon branch or local Postgres). No staging/multi-region topology is required — see `SUMMARY.md` §Scaling Considerations and PROJECT.md's explicit "single-case demo environment" scope.

**Runtime notes:**
- API routes that call the service layer and Prisma run on the Node.js runtime (Prisma requires Node, not Edge).
- The assistant route (`POST /api/assistant/chat`) also runs on Node runtime so it can call the same service-layer functions in-process (not over HTTP) before streaming the model's response back to the client.
- Static UI shells may be served via Next.js's standard rendering; all data-bearing screens fetch client-side via `@tanstack/react-query` against the API routes.

### 1.5 Explicitly Avoided Architecture

Per PRD §4 and research findings, the following are deliberately **not** part of this architecture, and any future addition should be treated as a scope change requiring re-justification:

- **Vector databases / embeddings** — data is structured and small, not a document corpus requiring semantic search.
- **Full OAuth / production *authentication* hardening** — out of scope for a demo; seeded users + role switcher instead. (**Narrowed by Phase 7.1, F20:** this bullet now refers to authentication only — server-side *authorization* enforcement for every write action is in scope as of this phase; see `04-security.md` §5.2.2a.)
- **LangChain-style agent frameworks** — unnecessary abstraction for a fixed, small (≤8) tool set.
- **Microservices / service mesh** — single deployable monolith is correct at this scale.
- **Message queues / background job runners** — all writes are synchronous request/response cycles; see `06-integrations.md`. (F19's custody-handoff pending state is deliberately resolved only by an explicit, synchronous confirm/cancel call — not a background expiry job — consistent with this constraint.)
- **SSE/WebSocket live sync** — polling is sufficient; deferred unless proven insufficient during demo rehearsal.
- **Headless-browser PDF generation (Puppeteer/Playwright)** *(considered and rejected, Phase 7.1, F23)* — would require bundling/cold-starting a full Chromium binary per Vercel serverless invocation; `@react-pdf/renderer`'s pure-JS, component-based approach was selected instead — see `05-tech-stack.md` §6.4.
