# Technical Architecture Document: JudicialSync

**Project Acronym:** JudicialSync
**Document Type:** TechArch (Technical Architecture Document)
**Version:** 1.0
**Status:** Draft
**Generated:** 2026-10-06
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
| No production auth; seeded users + role switcher | Explicitly out of scope per PROJECT.md — this is a sales demo, not a production system | `requestingUserRole` is derived from a client-side role-switcher component and passed with every request; no session/JWT/OAuth infrastructure exists |

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
- **Full OAuth / production auth hardening** — out of scope for a demo; seeded users + role switcher instead.
- **LangChain-style agent frameworks** — unnecessary abstraction for a fixed, small (≤8) tool set.
- **Microservices / service mesh** — single deployable monolith is correct at this scale.
- **Message queues / background job runners** — all writes are synchronous request/response cycles; see `06-integrations.md`.
- **SSE/WebSocket live sync** — polling is sufficient; deferred unless proven insufficient during demo rehearsal.

## 2. Component Architecture

Components are grouped into four layers, matching `ARCHITECTURE.md` §Component Responsibilities exactly: **UI layer** (render-only), **Service layer** (sole business-logic entry point), **Data layer** (ledger + projections), **Assistant layer** (thin tool wrappers over the service layer). No component in the UI or Assistant layer is permitted to query Prisma directly.

### 2.1 UI Layer Components

All UI screens are **render-only** — they compose service-layer reads, display state, and trigger writes via API routes; none contains derivation logic (status computation, discrepancy evaluation, custody resolution) of its own. This is a deliberate constraint (FRD F8–F11 §Validation) that keeps the UI and assistant provably consistent.

| Component | Screen(s) | Responsibility | Reads | Writes |
|---|---|---|---|---|
| `CommandCenterPage` | F8 Trial Command Center | Ambient, passive-monitoring view; three panels (recent activity, unresolved objections, discrepancies); polls every 3–5s | `getRecentActivity`, `getUnresolvedObjections`, `getDiscrepancies` | None — this screen never writes to the ledger |
| `CaseWorkspacePage` | F9 Case Workspace | Full exhibit list + integrated search/filter bar; inline discrepancy indicators; row-level drill-through | `getExhibits`, `searchExhibits` | None directly — status/objection/custody mutations happen via dedicated action flows, not this screen's core list |
| `ExhibitDetailPage` | F10 Exhibit Detail View | Chronological timeline reconstructed from the ledger; header shows current status/custodian/discrepancies | `getExhibitHistory` | Discrepancy acknowledgment action (if role-authorized), delegates to F6 endpoint |
| `JuryPackageWorkspacePage` | F11 Jury Package Workspace | Draft/finalized package display; disabled "Finalize" control while open discrepancies remain; read-only post-finalization | `GET /api/cases/:id/jury-package` | `POST /api/jury-package/:id/finalize`, discrepancy acknowledgment |
| `AssistantChatPanel` | F7 Pivota Assistant | Streaming chat UI via `useChat`; renders inline citation markers as visible, distinguishable UI elements (not hidden metadata) | `POST /api/assistant/chat` (streamed) | Persists conversation server-side via the same route |
| `RoleSwitcher` | Global (header/nav) | Demo-only seeded-role selector; sets the active `requestingUserRole`/`userId` consumed by every subsequent request | — | Local client state only (zustand); no backend write |
| `StatusBadge`, `DiscrepancyIndicator`, `TimelineEntry` | Shared across F8–F11 | Consistent visual vocabulary for status, discrepancy flags, and ledger-event display across every screen (FRD F1 §Sub-features: "Consistent visual status indicator shared across all screens") | — | — |

**Action-flow components** (status transition form, objection/ruling recorder, custody transfer recorder) are intentionally minimal, conversational-feeling controls rather than heavy data-entry forms — reinforcing the PRD's "assistant, not system" positioning. They call their respective F1/F2/F3 API routes and never touch Prisma or current-state tables directly.

### 2.2 Service Layer Components

The service layer is the **sole entry point** for every read and write in the system — both UI API routes and assistant tool wrappers call these exact functions, in-process. This is the architectural linchpin that makes cross-screen consistency and assistant-citation trust structurally guaranteed rather than merely tested-for.

| Module | Key Functions | Responsibility |
|---|---|---|
| `services/exhibits.ts` | `createExhibit`, `getExhibit`, `getExhibits(caseId)`, `searchExhibits(criteria)` | Exhibit identity CRUD (create/read only — no status fields); role-based visibility filtering (sealed-exhibit exclusion) applied here for every list/search/get call |
| `services/events.ts` | `recordEvent({ exhibitId, eventType, payload, actorUserId })` | **The only function that writes `ExhibitEvent` rows.** Validates payload shape per `eventType` (zod, discriminated union), stamps `sequenceNo` and `recordedAt`, appends the immutable row, then synchronously triggers the relevant projection update(s) and discrepancy re-evaluation (see `06-integrations.md` §Internal Triggers) |
| `services/status.ts` | `getExhibitStatus(exhibitId)`, `recordStatusChange(...)` | F1 admission-lifecycle state machine validation (allowed-transitions table), current-status projection read |
| `services/objections.ts` | `getUnresolvedObjections(caseId)`, `recordObjection(...)`, `recordRuling(...)` | F2 objection-thread lifecycle; judge-role enforcement for SUSTAINED/OVERRULED dispositions |
| `services/custody.ts` | `getCustodian(exhibitId)`, `getCustodyHistory(exhibitId)`, `recordCustodyTransfer(...)` | F3 chain-of-custody validation (from-custodian must match current projection), current-custodian projection read |
| `services/discrepancies.ts` | `evaluateDiscrepancies(exhibitId)`, `getDiscrepancies(caseId, exhibitId?)`, `acknowledgeDiscrepancy(...)` | F6 rule registry (extensible); fires after every status/objection/ruling/custody write; idempotent acknowledgment |
| `services/juryPackage.ts` | `computeJuryCandidates(caseId)`, `getJuryPackageStatus(caseId, exhibitId?)`, `finalizeJuryPackage(...)` | F5 jury-eligible computation + hard discrepancy gate re-evaluated fresh at finalization time (never from cached draft-time annotation) |
| `services/activity.ts` | `getRecentActivity(caseId, { since })` | F8 Command Center's ledger-wide recent-events feed, joined to exhibit labels |
| `services/visibility.ts` | `applyRoleScoping(query, role)` (internal helper, not directly exported as a tool/route) | Single implementation of the Role-Based Visibility table (FRD `00-header.md`); called by every other service module — the one place sealed-exhibit exclusion logic lives |
| `services/rebuild.ts` | `rebuildProjections(caseId)` | Admin/dev utility: replays `ExhibitEvent` rows per exhibit in `sequenceNo` order to verify projection/ledger consistency (auditability NFR) — not part of the live write path |

**Design constraint (non-negotiable):** If new business logic is ever needed by the assistant, it is added to a `services/*.ts` module, never to `assistant/tools.ts`. This is the single rule that prevents assistant/UI behavioral drift over time (`ARCHITECTURE.md` §Recommended Project Structure).

### 2.3 Assistant Layer Components

| Component | Responsibility |
|---|---|
| `assistant/tools.ts` | Defines the fixed ≤8-tool set (`getExhibitStatus`, `getUnresolvedObjections`, `getCustodian`, `getCustodyHistory`, `getExhibitHistory`, `searchExhibits`, `getJuryPackageStatus`, `getDiscrepancies`). Each tool is a zod-validated, 1:1 pass-through to the identically-named service function — **zero independent logic** |
| `assistant/system-prompt.ts` | Cite-or-decline system prompt: every factual claim must carry a citation from a tool result in the current turn; explicit "I don't have that information" is a required, valid response path; low/near-zero temperature for deterministic repeated-question behavior during live/recorded demos |
| `assistant/route.ts` (`POST /api/assistant/chat`) | Server-side `streamText()` call wiring the tool set + system prompt + user message + role context; persists `AssistantConversation`/`AssistantMessage`/`AssistantCitation` rows after the turn completes |
| `assistant/citations.ts` | Extracts `{ recordType, recordId, timestamp, label }` from each tool result and attaches it to the composed answer for both streaming display and persistence |

### 2.4 Data Layer Components

| Component | Responsibility |
|---|---|
| Event ledger (`ExhibitEvent`) | Single append-only table, discriminated by `eventType`; the system's ground truth. See `02-data-model.md` §Event Ledger |
| Current-state projections (`ExhibitCurrentState`, `ObjectionCurrentState`, `CustodyCurrentState`) | Denormalized, derived, rebuildable views recomputed synchronously on every relevant ledger write |
| Discrepancy flags (`DiscrepancyFlag`) | Rule-engine-derived rows, never user-created (only acknowledgment is user-triggered) |
| Jury package (`JuryPackage`, `JuryPackageExhibit`) | Stateful DRAFT/FINALIZED collection computed from current-state projections |
| Assistant audit trail (`AssistantConversation`, `AssistantMessage`, `AssistantCitation`) | Persisted conversation + citation history for audit/replay and cross-screen-consistency spot-checks |
| Seed data loader (`data/seed.ts`) | Calls the identical `recordEvent()`/`createExhibit()` service functions a live user would — guarantees seeded data exercises the exact same write path as production use, with deliberately planted edge cases (unresolved objection, custody gap, jury-package discrepancy) |

### 2.5 Component Interaction Rules (Enforced, Not Just Documented)

1. **No screen queries Prisma directly.** Every UI data need routes through an API route → service-layer function.
2. **No assistant tool contains business logic.** Every tool is `zod.parse(args) → service.fn(args) → return`.
3. **No current-state table is ever written except by the write-path trigger inside `recordEvent()`.** There is no second code path that mutates `ExhibitCurrentState`, `ObjectionCurrentState`, `CustodyCurrentState`, or `DiscrepancyFlag`.
4. **Role-based visibility is applied once, in `services/visibility.ts`,** and composed into every other service module's read functions — not re-implemented per route or per tool.
5. **Discrepancy evaluation is triggered synchronously inside `recordEvent()`**, not polled, not queued, not deferred to page load — see `06-integrations.md` §Internal Triggers for the full trigger table.

## 3. Data Model

The data model is built on one rule, repeated throughout the FRD and enforced here at the schema level: **status, objections/rulings, and custody are modeled exclusively as rows in the append-only `exhibit_events` ledger table.** Every "current state" table below is a derived projection — if dropped and rebuilt by replaying `exhibit_events` in `sequence_no` order, the result must be byte-identical. No application code path writes to a projection table except the synchronous trigger inside the `recordEvent()` service function.

### 3.1 Entity-Relationship Diagram

```
┌───────────┐       ┌──────────┐        ┌──────────────────┐
│   cases   │1─────*│  users   │        │     exhibits      │
└─────┬─────┘       └────┬─────┘        └─────────┬─────────┘
      │1                  │                        │1
      │                   │ custodian (FK)          │
      │*                  │                         │*
┌─────▼─────────────┐     │               ┌─────────▼─────────┐
│   jury_packages    │     │               │   exhibit_events    │ ◄── LEDGER
└─────┬──────────────┘     │               │  (append-only,      │     (ground truth)
      │1                   │               │   immutable)         │
      │*                   │               └─────────┬─────────┘
┌─────▼───────────────┐    │                          │ derives (replay)
│ jury_package_exhibits│    │          ┌───────────────┼────────────────┐
└──────────────────────┘    │          │               │                │
                             │  ┌───────▼──────┐ ┌──────▼───────┐ ┌─────▼────────┐
                             │  │exhibit_current│ │objection_   │ │custody_      │
                             │  │_state         │ │current_state │ │current_state  │
                             └──┤(1:1 exhibit)  │ │(1:N exhibit) │ │(1:1 exhibit,  │
                                └───────────────┘ └──────────────┘ │ FK→users)     │
                                                                    └───────────────┘
                                        │ feeds (rule engine)
                                ┌───────▼────────┐
                                │ discrepancy_    │
                                │ flags           │  (1:N exhibit, rule-derived)
                                └────────────────┘

┌────────────────────┐     ┌──────────────────┐     ┌────────────────────┐
│assistant_          │1───*│assistant_        │1───*│assistant_          │
│conversations        │     │messages           │     │citations            │
│(FK→cases, users)    │     │                   │     │(points to any       │
└────────────────────┘     └──────────────────┘     │ ledger/projection   │
                                                       │ record by id)        │
                                                       └────────────────────┘
```

**Legend:** Solid tables with "LEDGER" are append-only/immutable. Tables marked "(derived)" are fully rebuildable by replaying `exhibit_events`. `discrepancy_flags` is the one table that is rule-engine-derived but *not* a pure ledger replay — it is recomputed by evaluating rules against the current-state projections, with its own history preserved via `DISCREPANCY_ACKNOWLEDGED` ledger events for audit parity.

### 3.2 Core Identity Entities

```sql
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE role_type AS ENUM (
    'JUDGE', 'CHAMBERS_STAFF', 'DEPUTY', 'CLERK', 'ATTORNEY', 'ADMIN'
);

CREATE TYPE offering_party AS ENUM (
    'PLAINTIFF', 'PROSECUTION', 'DEFENSE'
);

CREATE TYPE exhibit_status AS ENUM (
    'MARKED', 'OFFERED', 'OBJECTED', 'ADMITTED', 'EXCLUDED', 'WITHDRAWN'
);

CREATE TYPE objection_status AS ENUM (
    'UNRESOLVED', 'SUSTAINED', 'OVERRULED'
);

CREATE TYPE event_type AS ENUM (
    'STATUS_CHANGE', 'OBJECTION_RAISED', 'RULING_RECORDED',
    'CUSTODY_TRANSFER', 'DISCREPANCY_ACKNOWLEDGED'
);

CREATE TYPE discrepancy_status AS ENUM (
    'OPEN', 'ACKNOWLEDGED', 'RESOLVED'
);

CREATE TYPE jury_package_status AS ENUM (
    'DRAFT', 'FINALIZED'
);

CREATE TYPE jury_exhibit_discrepancy_status AS ENUM (
    'CLEAN', 'FLAGGED'
);

CREATE TYPE message_role AS ENUM (
    'USER', 'ASSISTANT'
);

-- =========================================================
-- CORE ENTITIES
-- =========================================================

-- Single trial/proceeding scoping all exhibits, events, and users (single-case demo scope).
CREATE TABLE cases (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_number TEXT UNIQUE NOT NULL,
    title       TEXT NOT NULL,
    court       TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seeded users (one per role minimum) — demo-level role switcher, no production auth.
CREATE TABLE users (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id    UUID NOT NULL REFERENCES cases(id),
    name       TEXT NOT NULL,
    role       role_type NOT NULL,
    is_active  BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_case_role ON users (case_id, role);

-- Root identity record. Holds NO status/custody/ruling fields — those are
-- entirely derived from exhibit_events. Creating a row here never implies
-- any lifecycle state (an exhibit with zero events is "not yet entered
-- into evidence").
CREATE TABLE exhibits (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id            UUID NOT NULL REFERENCES cases(id),
    exhibit_label      TEXT NOT NULL,
    description        TEXT NOT NULL CHECK (char_length(description) <= 1000),
    source             TEXT,
    offering_party     offering_party NOT NULL,
    associated_witness TEXT,
    is_sealed          BOOLEAN NOT NULL DEFAULT false,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_exhibits_case_label UNIQUE (case_id, exhibit_label)
);

CREATE INDEX idx_exhibits_case ON exhibits (case_id);
```

### 3.3 Event Ledger (Ground Truth — Append-Only, Immutable)

```sql
-- The single append-only ledger table. Rows are NEVER updated or deleted
-- after creation — enforced at the application layer (recordEvent() is the
-- only writer) and recommended as a DB-level safeguard via REVOKE UPDATE,
-- DELETE on this table from the application role in production-adjacent
-- environments.
--
-- `payload` is a discriminated-union JSON shape validated by zod BEFORE
-- insert (see services/events.ts) — shapes documented below, not enforced
-- at the DB level (Postgres JSONB has no native discriminated-union check,
-- and adding one would duplicate validation already guaranteed upstream).
--
-- `sequence_no` is a per-exhibit monotonically increasing integer stamped
-- at write time, guaranteeing deterministic replay order independent of
-- clock skew between concurrent writers.
CREATE TABLE exhibit_events (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exhibit_id    UUID NOT NULL REFERENCES exhibits(id),
    case_id       UUID NOT NULL REFERENCES cases(id),
    event_type    event_type NOT NULL,
    payload       JSONB NOT NULL,
    actor_user_id UUID NOT NULL REFERENCES users(id),
    sequence_no   INTEGER NOT NULL,
    recorded_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_exhibit_events_seq UNIQUE (exhibit_id, sequence_no)
);

CREATE INDEX idx_exhibit_events_exhibit_time ON exhibit_events (exhibit_id, recorded_at);
CREATE INDEX idx_exhibit_events_case_type_time ON exhibit_events (case_id, event_type, recorded_at);
```

**Payload shapes by `event_type`** (zod-validated at the service layer before insert, not DB-enforced):

| `event_type` | Payload shape |
|---|---|
| `STATUS_CHANGE` | `{ fromStatus: exhibit_status \| null, toStatus: exhibit_status, notes?: string }` |
| `OBJECTION_RAISED` | `{ objectionId: uuid, objectingParty: offering_party, grounds: string }` |
| `RULING_RECORDED` | `{ objectionId: uuid, disposition: 'SUSTAINED' \| 'OVERRULED' \| 'RESERVED' }` |
| `CUSTODY_TRANSFER` | `{ fromCustodianUserId: uuid \| null, toCustodianUserId: uuid, reason?: string }` |
| `DISCREPANCY_ACKNOWLEDGED` | `{ discrepancyFlagId: uuid, ruleCode: string, justification: string }` |

### 3.4 Current-State Projections (Derived — Rebuildable, Never Independently Edited)

```sql
-- One row per exhibit once it has at least one STATUS_CHANGE event.
-- Fully rebuildable by replaying exhibit_events WHERE event_type =
-- 'STATUS_CHANGE' in sequence_no order. Absence of a row means the
-- exhibit has no recorded status yet.
CREATE TABLE exhibit_current_state (
    exhibit_id          UUID PRIMARY KEY REFERENCES exhibits(id),
    current_status      exhibit_status NOT NULL,
    last_status_event_id UUID NOT NULL REFERENCES exhibit_events(id),
    last_status_at      TIMESTAMPTZ NOT NULL
);

-- One row per objection THREAD (not per exhibit — an exhibit may have many
-- concurrently open threads). Rebuildable by replaying OBJECTION_RAISED /
-- RULING_RECORDED events grouped by payload->>'objectionId'.
CREATE TABLE objection_current_state (
    objection_id    UUID PRIMARY KEY,
    exhibit_id      UUID NOT NULL REFERENCES exhibits(id),
    status          objection_status NOT NULL DEFAULT 'UNRESOLVED',
    objecting_party offering_party NOT NULL,
    grounds         TEXT NOT NULL,
    raised_event_id UUID NOT NULL REFERENCES exhibit_events(id),
    raised_at       TIMESTAMPTZ NOT NULL,
    ruling_event_id UUID REFERENCES exhibit_events(id),
    ruled_at        TIMESTAMPTZ
);

CREATE INDEX idx_objection_current_state_exhibit_status
    ON objection_current_state (exhibit_id, status);

-- One row per exhibit once it has at least one CUSTODY_TRANSFER event.
-- An exhibit with NO row here despite being ADMITTED is exactly the
-- ADMITTED_NO_CUSTODIAN discrepancy condition (F6) — absence is meaningful
-- and must never be backfilled with a default/placeholder row.
CREATE TABLE custody_current_state (
    exhibit_id               UUID PRIMARY KEY REFERENCES exhibits(id),
    current_custodian_user_id UUID NOT NULL REFERENCES users(id),
    since                    TIMESTAMPTZ NOT NULL,
    last_event_id            UUID NOT NULL REFERENCES exhibit_events(id)
);
```

### 3.5 Discrepancy Detection

```sql
-- Derived/materialized by the rule engine (F6), recomputed on every
-- relevant ledger write — never user-created. Acknowledgment is recorded
-- BOTH here (fast-read status, for F5/F9/F11 display) AND as a
-- DISCREPANCY_ACKNOWLEDGED ledger event (audit ground truth) — the two
-- must never diverge; the service layer writes both in the same
-- transaction.
CREATE TABLE discrepancy_flags (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id               UUID NOT NULL REFERENCES cases(id),
    exhibit_id            UUID NOT NULL REFERENCES exhibits(id),
    rule_code             TEXT NOT NULL,  -- e.g. 'ADMITTED_NO_CUSTODIAN'
    status                discrepancy_status NOT NULL DEFAULT 'OPEN',
    detected_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    details               JSONB NOT NULL,
    acknowledged_at       TIMESTAMPTZ,
    acknowledged_by       UUID REFERENCES users(id),
    acknowledged_event_id UUID REFERENCES exhibit_events(id),
    resolved_at           TIMESTAMPTZ,
    resolved_by_event_id  UUID REFERENCES exhibit_events(id)
);

CREATE INDEX idx_discrepancy_flags_case_status ON discrepancy_flags (case_id, status);
CREATE INDEX idx_discrepancy_flags_exhibit_rule ON discrepancy_flags (exhibit_id, rule_code);
```

**Rule registry (extensible; two rules required at launch per FRD F6):**

| `rule_code` | Fires when | Clears when |
|---|---|---|
| `ADMITTED_NO_CUSTODIAN` | `exhibit_current_state.current_status = 'ADMITTED'` AND no `custody_current_state` row exists (or `current_custodian_user_id` is null) | A `CUSTODY_TRANSFER` event is recorded for the exhibit |
| `UNRESOLVED_OBJECTION_JURY_ELIGIBLE` | `exhibit_current_state.current_status = 'ADMITTED'` AND ≥1 `objection_current_state` row for the exhibit has `status = 'UNRESOLVED'` | The objection thread receives a `SUSTAINED`/`OVERRULED` ruling |

### 3.6 Jury Package

```sql
CREATE TABLE jury_packages (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id       UUID NOT NULL REFERENCES cases(id),
    status        jury_package_status NOT NULL DEFAULT 'DRAFT',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    finalized_at  TIMESTAMPTZ,
    finalized_by  UUID REFERENCES users(id)
);

CREATE INDEX idx_jury_packages_case_status ON jury_packages (case_id, status);

-- discrepancy_status here is a point-in-time annotation captured at
-- computation time for display; F5's finalization gate ALWAYS re-queries
-- discrepancy_flags fresh rather than trusting this cached column — see
-- 03-api.md §Jury Package.
CREATE TABLE jury_package_exhibits (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jury_package_id    UUID NOT NULL REFERENCES jury_packages(id),
    exhibit_id         UUID NOT NULL REFERENCES exhibits(id),
    discrepancy_status jury_exhibit_discrepancy_status NOT NULL,
    added_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_jury_package_exhibit UNIQUE (jury_package_id, exhibit_id)
);
```

### 3.7 Assistant Audit Trail

```sql
CREATE TABLE assistant_conversations (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id    UUID NOT NULL REFERENCES cases(id),
    user_id    UUID NOT NULL REFERENCES users(id),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE assistant_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES assistant_conversations(id),
    role            message_role NOT NULL,
    content         TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_assistant_messages_conversation ON assistant_messages (conversation_id, created_at);

-- Every factual claim in an ASSISTANT-role message must have at least one
-- row here pointing to the ledger/projection record that backs it. A
-- message with zero citations is only valid when its content is a Decline
-- Response ("I don't have that information").
CREATE TABLE assistant_citations (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES assistant_messages(id),
    record_type TEXT NOT NULL,  -- e.g. 'ExhibitEvent', 'DiscrepancyFlag', 'JuryPackageExhibit'
    record_id  UUID NOT NULL,
    timestamp  TIMESTAMPTZ NOT NULL,
    label      TEXT NOT NULL   -- human-readable citation label shown in the UI
);

CREATE INDEX idx_assistant_citations_message ON assistant_citations (message_id);
```

### 3.8 Performance & Integrity Notes

- **Discrepancy rules read projections, never the raw ledger.** `evaluateDiscrepancies()` queries `exhibit_current_state`, `objection_current_state`, `custody_current_state` — it never scans `exhibit_events` on every write. The ledger is read in full only for history views (F10 timeline) and the assistant's `getExhibitHistory` tool.
- **`exhibit_events` is the only table requiring immutability enforcement.** At demo scale, this is enforced at the application layer (only `recordEvent()` writes to it); a production-adjacent environment would additionally `REVOKE UPDATE, DELETE` on this table from the application's DB role.
- **Projection integrity is independently verifiable.** All current-state projection tables (§3.4) must be exactly reproducible by replaying `exhibit_events` rows per exhibit in `sequence_no` order via the `rebuildProjections(caseId)` admin utility — this is the mechanism satisfying the PRD's Auditability non-functional requirement, and should be run as a pre-demo sanity check, not relied upon as a live write path.
- **No further indexing/caching required at demo scale** (dozens–hundreds of exhibits, single case, <10 concurrent users) — see `.planning/research/ARCHITECTURE.md` §Scaling Considerations.
- **ORM mapping:** This SQL DDL is the canonical Postgres schema; it maps 1:1 to the Prisma schema models (`Case`, `User`, `Exhibit`, `ExhibitEvent`, `ExhibitCurrentState`, `ObjectionCurrentState`, `CustodyCurrentState`, `DiscrepancyFlag`, `JuryPackage`, `JuryPackageExhibit`, `AssistantConversation`, `AssistantMessage`, `AssistantCitation`) used by the application's Prisma client — table/column names above are `snake_case` per SQL convention; Prisma model/field names are `PascalCase`/`camelCase` per FRD `Y0-schema.md` convention, mapped via `@@map`/`@map` directives.

## 4. API Design

All endpoints are thin REST wrappers around the service layer (`01-components.md` §2.2) — route handlers parse the request, extract `requestingUserRole`/`actorUserId` from the session/role-switcher context, call exactly one service function, and shape the response. No route contains business logic beyond this. The Pivota Assistant's tools call the identical underlying service functions as **in-process function calls**, not HTTP round-trips to these routes — but the request/response shapes below describe the same contract both consumers rely on.

Every endpoint applies role-based visibility (`00-header.md` §Role-Based Visibility in the FRD) uniformly: sealed exhibits are excluded from results, and direct reads of a sealed exhibit by an unauthorized role return a **404** (not 403) so existence is never leaked.

### 4.1 Shared TypeScript Types

```typescript
// Shared enums — mirror the Postgres enum types 1:1
type Role = 'JUDGE' | 'CHAMBERS_STAFF' | 'DEPUTY' | 'CLERK' | 'ATTORNEY' | 'ADMIN';
type OfferingParty = 'PLAINTIFF' | 'PROSECUTION' | 'DEFENSE';
type ExhibitStatus = 'MARKED' | 'OFFERED' | 'OBJECTED' | 'ADMITTED' | 'EXCLUDED' | 'WITHDRAWN';
type ObjectionStatus = 'UNRESOLVED' | 'SUSTAINED' | 'OVERRULED';
type RulingDisposition = 'SUSTAINED' | 'OVERRULED' | 'RESERVED';
type EventType =
  | 'STATUS_CHANGE'
  | 'OBJECTION_RAISED'
  | 'RULING_RECORDED'
  | 'CUSTODY_TRANSFER'
  | 'DISCREPANCY_ACKNOWLEDGED';
type DiscrepancyStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
type JuryPackageStatus = 'DRAFT' | 'FINALIZED';
type JuryExhibitDiscrepancyStatus = 'CLEAN' | 'FLAGGED';

interface Exhibit {
  id: string;
  caseId: string;
  exhibitLabel: string;
  description: string;
  source: string | null;
  offeringParty: OfferingParty;
  associatedWitness: string | null;
  isSealed: boolean;
  createdAt: string; // ISO 8601
}

interface ExhibitEvent {
  id: string;
  exhibitId: string;
  caseId: string;
  eventType: EventType;
  payload: Record<string, unknown>; // discriminated by eventType, see 02-data-model.md §3.3
  actorUserId: string;
  sequenceNo: number;
  recordedAt: string;
}

interface ExhibitCurrentState {
  exhibitId: string;
  currentStatus: ExhibitStatus;
  lastStatusEventId: string;
  lastStatusAt: string;
}

interface ObjectionCurrentState {
  objectionId: string;
  exhibitId: string;
  status: ObjectionStatus;
  objectingParty: OfferingParty;
  grounds: string;
  raisedEventId: string;
  raisedAt: string;
  rulingEventId: string | null;
  ruledAt: string | null;
}

interface CustodyCurrentState {
  exhibitId: string;
  currentCustodianUserId: string;
  since: string;
  lastEventId: string;
}

interface DiscrepancyFlag {
  id: string;
  caseId: string;
  exhibitId: string;
  ruleCode: string;
  status: DiscrepancyStatus;
  detectedAt: string;
  details: Record<string, unknown>;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
}

interface JuryPackage {
  id: string;
  caseId: string;
  status: JuryPackageStatus;
  createdAt: string;
  finalizedAt?: string;
  finalizedBy?: string;
}

interface JuryPackageExhibit {
  exhibitId: string;
  exhibitLabel: string;
  currentStatus: ExhibitStatus;
  discrepancyStatus: JuryExhibitDiscrepancyStatus;
  addedAt: string;
}

interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

// Composite row shape returned by GET /api/cases/:id/exhibits and
// GET /api/cases/:id/exhibits/search — avoids a second round-trip per row.
interface ExhibitListRow {
  exhibitId: string;
  exhibitLabel: string;
  description: string;
  offeringParty: OfferingParty;
  associatedWitness: string | null;
  currentStatus: ExhibitStatus | null; // null = no STATUS_CHANGE event yet
  currentCustodianName: string | null;
  discrepancyFlags: DiscrepancyFlag[];
}
```

### 4.2 Exhibits & History (F0, F9, F10)

| Method & Path | Description | Request Body / Query | Response | Errors |
|---|---|---|---|---|
| `POST /api/exhibits` | Create exhibit identity record | `{ caseId, exhibitLabel, description, source?, offeringParty, associatedWitness?, isSealed? }` | `201 Exhibit` | `EXHIBIT_LABEL_CONFLICT` 409, `VALIDATION_ERROR` 422 |
| `GET /api/exhibits/:id` | Fetch single exhibit identity | — | `200 Exhibit` | `EXHIBIT_NOT_FOUND` 404 |
| `GET /api/cases/:id/exhibits` | List all visible exhibits for a case | — (unfiltered; use search for filters) | `200 ExhibitListRow[]` | `CASE_NOT_FOUND` 404 |
| `GET /api/exhibits/:id/history` | Full chronological event timeline | — | `200 ExhibitHistoryResponse` (below) | `EXHIBIT_NOT_FOUND` 404 (also returned for sealed/unauthorized) |

```typescript
interface ExhibitHistoryResponse {
  exhibit: Exhibit;
  currentStatus: ExhibitStatus | null;
  currentCustodianName: string | null;
  discrepancyFlags: DiscrepancyFlag[];
  timeline: Array<{
    eventId: string;
    eventType: EventType;
    summary: string; // plain-language, e.g. "Status changed from Offered to Admitted"
    actorName: string;
    recordedAt: string;
  }>;
}
```

### 4.3 Status (F1)

| Method & Path | Description | Request Body | Response | Errors |
|---|---|---|---|---|
| `POST /api/exhibits/:id/events/status` | Record a status transition | `{ toStatus: ExhibitStatus, actorUserId, notes? }` | `201 { event: ExhibitEvent, currentState: ExhibitCurrentState }` | `INVALID_STATUS_TRANSITION` 422, `STATUS_FINALIZED` 409, `STATUS_CONFLICT` 409, `EXHIBIT_NOT_FOUND` 404 |
| `GET /api/exhibits/:id/status` | Current derived status | — | `200 ExhibitCurrentState` | `EXHIBIT_NOT_FOUND` 404 |

**Allowed transitions (state machine, enforced server-side):**

| From | To |
|---|---|
| *(none)* | `MARKED` |
| `MARKED` | `OFFERED` |
| `OFFERED` | `OBJECTED`, `ADMITTED`, `WITHDRAWN` |
| `OBJECTED` | `ADMITTED`, `EXCLUDED`, `WITHDRAWN` |

### 4.4 Objections & Rulings (F2)

| Method & Path | Description | Request Body | Response | Errors |
|---|---|---|---|---|
| `POST /api/exhibits/:id/events/objection` | Raise an objection | `{ objectingParty, grounds, actorUserId }` | `201 { event: ExhibitEvent, objectionState: ObjectionCurrentState }` | `INVALID_OBJECTION_TARGET` 422, `EXHIBIT_NOT_FOUND` 404 |
| `POST /api/objections/:id/ruling` | Record a ruling against an objection thread | `{ disposition: RulingDisposition, actorUserId }` | `201 { event: ExhibitEvent, objectionState: ObjectionCurrentState }` | `OBJECTION_NOT_FOUND` 404, `OBJECTION_ALREADY_RESOLVED` 409, `ROLE_NOT_PERMITTED` 403 (SUSTAINED/OVERRULED requires `JUDGE` role) |
| `GET /api/cases/:id/objections?status=unresolved` | List objection threads, filterable | Query: `status?` | `200 ObjectionCurrentState[]` | `CASE_NOT_FOUND` 404 |

### 4.5 Custody (F3)

| Method & Path | Description | Request Body | Response | Errors |
|---|---|---|---|---|
| `POST /api/exhibits/:id/events/custody` | Record a custody transfer | `{ fromCustodianUserId?, toCustodianUserId, reason?, actorUserId }` | `201 { event: ExhibitEvent, custodyState: CustodyCurrentState }` | `CUSTODY_CHAIN_BROKEN` 409, `INVALID_CUSTODIAN` 422, `NO_OP_TRANSFER` 422, `EXHIBIT_NOT_FOUND` 404 |
| `GET /api/exhibits/:id/custodian` | Current custodian only | — | `200 CustodyCurrentState` | `EXHIBIT_NOT_FOUND` 404 |
| `GET /api/exhibits/:id/custody-history` | Full ordered chain-of-custody | — | `200 CustodyHistoryEntry[]` | `EXHIBIT_NOT_FOUND` 404 |

```typescript
interface CustodyHistoryEntry {
  fromCustodian: string | null;
  toCustodian: string;
  timestamp: string;
  reason: string | null;
  eventId: string;
}
```

### 4.6 Search (F4)

| Method & Path | Description | Query Params | Response | Errors |
|---|---|---|---|---|
| `GET /api/cases/:id/exhibits/search` | Multi-criteria combinable (AND) search | `keyword?, status?, witness?, dateFrom?, dateTo?` | `200 ExhibitListRow[]` | `EMPTY_SEARCH_CRITERIA` 422, `INVALID_DATE_RANGE` 422, `VALIDATION_ERROR` 422 |

```typescript
interface SearchExhibitsCriteria {
  caseId: string;
  keyword?: string;        // substring match: exhibitLabel, description, source
  status?: ExhibitStatus;
  witness?: string;
  dateFrom?: string;       // ISO 8601
  dateTo?: string;         // ISO 8601
  requestingUserRole: Role; // derived from session, not user-supplied
}
```

### 4.7 Jury Package (F5)

| Method & Path | Description | Request Body | Response | Errors |
|---|---|---|---|---|
| `POST /api/cases/:id/jury-package` | Compute/refresh draft jury-eligible set | `{ actorUserId }` | `201 { juryPackage: JuryPackage, exhibits: JuryPackageExhibit[] }` | `NO_ELIGIBLE_EXHIBITS` 422, `ROLE_NOT_PERMITTED` 403 |
| `GET /api/cases/:id/jury-package` | Fetch current package with live discrepancy status | — | `200 { juryPackage: JuryPackage, exhibits: JuryPackageExhibit[] }` | `CASE_NOT_FOUND` 404 |
| `POST /api/jury-package/:id/finalize` | Attempt finalization — hard-gated, re-evaluated fresh | `{ actorUserId, acknowledgedDiscrepancyIds? }` | `200 { juryPackage: JuryPackage }` (status: `FINALIZED`) | `JURY_PACKAGE_DISCREPANCIES_OPEN` 409 (includes blocking list), `JURY_PACKAGE_ALREADY_FINALIZED` 409, `ROLE_NOT_PERMITTED` 403 |

`actorUserId` must resolve to role `DEPUTY`, `CLERK`, or `ADMIN` to initiate or finalize. Finalization re-runs `evaluateDiscrepancies` fresh for every included exhibit — never trusting the cached `discrepancyStatus` captured at draft-computation time.

### 4.8 Discrepancies (F6)

| Method & Path | Description | Request Body | Response | Errors |
|---|---|---|---|---|
| `GET /api/cases/:id/discrepancies` | All open/acknowledged flags case-wide | — | `200 DiscrepancyFlag[]` | `CASE_NOT_FOUND` 404 |
| `GET /api/exhibits/:id/discrepancies` | Flags for a single exhibit | — | `200 DiscrepancyFlag[]` | `EXHIBIT_NOT_FOUND` 404 |
| `POST /api/discrepancies/:id/acknowledge` | Explicitly acknowledge an open flag | `{ actorUserId, justification }` | `200 { event: ExhibitEvent, discrepancyFlag: DiscrepancyFlag }` (idempotent) | `JUSTIFICATION_REQUIRED` 422, `DISCREPANCY_NOT_FOUND` 404, `ROLE_NOT_PERMITTED` 403 |

### 4.9 Command Center (F8)

| Method & Path | Description | Query Params | Response | Errors |
|---|---|---|---|---|
| `GET /api/cases/:id/activity` | Recent-activity feed | `since?` (ISO 8601, default: start of current trial day) | `200 RecentActivityEntry[]` | `VALIDATION_ERROR` 422, `COMMAND_CENTER_LOAD_FAILED` 500 |

```typescript
interface RecentActivityEntry {
  eventId: string;
  eventType: EventType;
  exhibitId: string;
  exhibitLabel: string;
  summary: string;
  recordedAt: string;
}
```

Command Center also composes `GET /api/cases/:id/objections?status=unresolved` (§4.4) and `GET /api/cases/:id/discrepancies` (§4.8) client-side — no server-side aggregation endpoint beyond `/activity` is required.

### 4.10 Pivota Assistant (F7)

| Method & Path | Description | Request Body | Response | Errors |
|---|---|---|---|---|
| `POST /api/assistant/chat` | Streaming tool-calling chat (Vercel AI SDK `streamText`) | `{ caseId, userId, message, conversationId? }` | Streamed text (SSE/chunked) + final structured payload incl. `citations[]` | `TOOL_ARGS_INVALID` (tool-level, surfaced to model), `ASSISTANT_UNAVAILABLE` 503 |
| `GET /api/assistant/conversations/:id` | Retrieve persisted conversation + citations (audit/replay) | — | `200 ConversationDetail` | `CONVERSATION_NOT_FOUND` 404 |

```typescript
interface AssistantChatRequest {
  caseId: string;
  userId: string;
  message: string;
  conversationId?: string;
}

interface Citation {
  recordType: 'ExhibitEvent' | 'DiscrepancyFlag' | 'JuryPackageExhibit';
  recordId: string;
  timestamp: string;
  label: string; // human-readable, e.g. "Status change recorded Oct 6, 2026 2:14pm"
}

interface ConversationDetail {
  conversation: { id: string; caseId: string; userId: string; startedAt: string };
  messages: Array<{
    id: string;
    role: 'USER' | 'ASSISTANT';
    content: string;
    createdAt: string;
    citations: Citation[];
  }>;
}

// Tool definitions (server-side only; AI SDK `tool()` + zod schemas).
// Each tool is a 1:1 pass-through to the identically-named service
// function — see 01-components.md §2.3.
interface AssistantToolSet {
  getExhibitStatus(args: { exhibitId: string }): Promise<ExhibitCurrentState | null>;
  getUnresolvedObjections(args: { caseId: string }): Promise<ObjectionCurrentState[]>;
  getCustodian(args: { exhibitId: string }): Promise<CustodyCurrentState | null>;
  getCustodyHistory(args: { exhibitId: string }): Promise<CustodyHistoryEntry[]>;
  getExhibitHistory(args: { exhibitId: string }): Promise<ExhibitHistoryResponse | null>;
  searchExhibits(args: SearchExhibitsCriteria): Promise<ExhibitListRow[]>;
  getJuryPackageStatus(args: { caseId: string; exhibitId?: string }): Promise<{
    juryPackage: JuryPackage;
    exhibits: JuryPackageExhibit[];
  }>;
  getDiscrepancies(args: { caseId: string; exhibitId?: string }): Promise<DiscrepancyFlag[]>;
}
```

Each tool in `AssistantToolSet` is implemented against the exact same service-layer function backing the corresponding REST route above — e.g., `getExhibitStatus` the tool and `GET /api/exhibits/:id/status` the route both call `services/status.ts#getExhibitStatus(exhibitId)`. This 1:1 mapping is what structurally guarantees cross-screen/assistant consistency rather than relying on manual testing alone.

### 4.11 Common Response Envelope

All non-streaming endpoints return errors in a consistent shape:

```typescript
interface ApiErrorResponse {
  error: {
    code: string;    // e.g. "EXHIBIT_NOT_FOUND"
    message: string; // e.g. "No exhibit found with the given ID"
  };
}
```

See `05-tech-stack.md` and the FRD's `Y2-errors.md` for the complete cross-feature error code catalog (reproduced in full there; not duplicated here to keep this document the single canonical reference per the FRD's own "don't duplicate, reference" convention).

### 4.12 Authentication & Request Context

No endpoint performs cryptographic authentication (PROJECT.md explicitly scopes production auth out). Every request carries:

```typescript
interface RequestContext {
  caseId: string;            // single-case demo scope; effectively constant
  requestingUserRole: Role;  // from the client-side role switcher (zustand store)
  actorUserId?: string;      // required only on write endpoints; the acting user's seeded User.id
}
```

`requestingUserRole` governs **read visibility** (sealed-exhibit exclusion); `actorUserId`'s resolved `Role` governs **write authorization** (e.g., only `JUDGE` may record `SUSTAINED`/`OVERRULED`; only `DEPUTY`/`CLERK`/`ADMIN` may finalize a jury package). Both checks are enforced in `services/visibility.ts` and the relevant domain service module — never re-implemented per route. See `04-security.md` for the full authorization model.

## 5. Security Architecture

JudicialSync's security model is explicitly scoped for a **sales/demo environment**, not a production court system. Per PROJECT.md, production-grade authentication/authorization hardening is out of scope — but role-based *visibility* and *write-authorization* are still first-class, enforced requirements because they are core to the demo's credibility with a legal audience (a judge seeing sealed sidebar material leaked to an attorney's screen would be a trust-ending failure during a sales demo, even without real cryptographic stakes).

### 5.1 Authentication (Demo-Scoped)

| Aspect | Approach |
|---|---|
| Identity mechanism | Seeded `users` rows (one per `role_type` minimum), selected via a client-side **role switcher** component — no password, OAuth, SSO, or JWT |
| Session | A lightweight client-side session (zustand store, optionally mirrored to a cookie) holds the active `userId`/`role`; sent with every request as part of `RequestContext` (`03-api.md` §4.12) |
| What's explicitly NOT implemented | OAuth/OIDC providers, password hashing, MFA, session-fixation protections, CSRF tokens on state-changing routes, rate limiting — all out of scope per PROJECT.md and justified by the single-case, <10-user, live-demo context |
| Why this is acceptable here | The demo runs in a controlled environment (live walkthrough or recording) with no real PII, no real case data, and no public internet exposure beyond the presenter's controlled session — explicitly called out as an "Explicitly avoided" architecture decision in the PRD |
| Upgrade path (if ever productionized) | Replace the role-switcher's `userId`/`role` resolution with a real identity provider (e.g., NextAuth + court-system SSO) feeding the *same* `RequestContext.requestingUserRole` shape — because authorization logic is centralized in `services/visibility.ts`, swapping authentication underneath requires no change to any authorization check |

### 5.2 Authorization Model

Authorization is **role-based**, enforced in exactly one place (`services/visibility.ts` plus per-domain service checks), and applied identically regardless of whether the caller is a UI API route or an assistant tool wrapper. There is no separate "assistant privilege level" — the assistant always presents the same role as the requesting user's active session.

#### 5.2.1 Role-Based Visibility (Read Authorization)

| Role | Sees Sealed Exhibits? | Notes |
|---|---|---|
| `JUDGE` | Yes | Full visibility, including chambers-only annotations |
| `CHAMBERS_STAFF` | Yes | Mirrors judge visibility |
| `ADMIN` | Yes | Compliance/audit review requires full visibility |
| `DEPUTY` | No | Operational role; sealed material is chambers-restricted |
| `CLERK` | No | Maintains official record but not sealed/in-camera content |
| `ATTORNEY` | No | Default deny; per-attorney ACL grants are explicitly out of scope for this demo |

**Enforcement mechanics:**
- Sealed-exhibit exclusion is applied as a `WHERE` predicate inside every service-layer read function that returns exhibit rows (`getExhibits`, `searchExhibits`, `getExhibitHistory`, and transitively every assistant tool that wraps them) — never as a post-query filter in the API route or UI component.
- A direct-ID read of a sealed exhibit by an unauthorized role (`GET /api/exhibits/:id`, `GET /api/exhibits/:id/history`, or the assistant's equivalent tool call) returns **404 `EXHIBIT_NOT_FOUND`** — byte-identical in shape, message, and (as far as practical) timing to the genuine not-found case. This is a deliberate anti-enumeration measure: an unauthorized role must never be able to distinguish "doesn't exist" from "exists but you can't see it."
- The assistant's Decline Response ("I don't have that information") is the natural-language equivalent of this same 404-masking behavior — the system prompt instructs the model to never reveal that a sealed record exists, even indirectly (e.g., never say "I can't show you Exhibit 9 because it's sealed"; the correct response is identical to the no-such-exhibit case).

#### 5.2.2 Write Authorization (Action Gating)

| Action | Required Role(s) | Enforcement Point |
|---|---|---|
| Record `SUSTAINED`/`OVERRULED` ruling | `JUDGE` | `services/objections.ts#recordRuling` |
| Finalize jury package | `DEPUTY`, `CLERK`, `ADMIN` | `services/juryPackage.ts#finalizeJuryPackage` |
| Initiate/compute jury package draft | `DEPUTY`, `CLERK`, `ADMIN` | `services/juryPackage.ts#computeJuryCandidates` |
| Acknowledge a discrepancy flag | `DEPUTY`, `CLERK`, `JUDGE`, `ADMIN` | `services/discrepancies.ts#acknowledgeDiscrepancy` |
| Record status change, objection, custody transfer | Any authenticated (seeded) user via `actorUserId` | No role restriction beyond being a valid active `users` row — the demo does not gate routine recording actions by role beyond the two cases above |

**Rule:** `403 ROLE_NOT_PERMITTED` is reserved exclusively for write/action gating. It is **never** used to signal "this record exists but you can't see it" — that is always the 404-masking pattern above. Conflating the two would leak existence information through the HTTP status code itself.

### 5.3 Data Protection

| Concern | Approach |
|---|---|
| Data at rest | Neon Postgres managed encryption-at-rest (provider default); no additional application-level encryption of exhibit/ledger data — not warranted for seeded demo data |
| Data in transit | TLS for all client↔Vercel and Vercel↔Neon connections (provider default); TLS for the server↔Anthropic API call |
| Input validation | Every write endpoint's body and every assistant tool-call's arguments are validated via **zod schemas** before reaching Prisma — malformed input (e.g., non-UUID `exhibitId`, out-of-enum `offeringParty`) is rejected with `422 VALIDATION_ERROR` (API) or a tool-level `TOOL_ARGS_INVALID` error (assistant), never silently coerced or passed through |
| Ledger immutability | `exhibit_events` rows are never updated or deleted post-insert — enforced at the application layer (only `recordEvent()` writes) and recommended as a DB-role-level `REVOKE UPDATE, DELETE` safeguard if this schema is ever deployed beyond a single presenter's demo environment |
| Secrets management | Anthropic API key and Neon connection string stored as Vercel environment variables, never committed to source control or exposed to the client bundle (assistant route runs server-side only; the API key never reaches `@ai-sdk/react`'s client-side `useChat` hook) |
| PII / sensitive content | Seed data is synthetic/representative (PROJECT.md scope: no real case data) — no real PII protection regime is required, but the sealed-exhibit visibility model is implemented with production-equivalent rigor specifically because it is the feature most likely to be scrutinized by a legal audience evaluating trustworthiness |

### 5.4 Assistant-Specific Trust & Safety Controls

Because F7 is the feature the entire demo's success depends on, its trust controls are treated as security-equivalent requirements, not merely UX polish:

| Control | Mechanism |
|---|---|
| No ungrounded factual claims | System prompt requires every factual sentence to carry a citation from a tool result returned in the *current turn*; a factual claim with zero citation is treated as a release-blocking defect in testing, not a tunable preference |
| No stale-data reuse across turns | System prompt instructs the model to prefer a fresh tool call over reusing conversation history for status/custody/objection questions, since underlying data may have changed between turns (live proceedings) |
| No "assistant admin override" | Every tool call passes the requesting user's actual role through to the identical service-layer function a UI route would call — there is no elevated or unscoped retrieval path available only to the assistant |
| Deterministic repeated-question behavior | Low/near-zero model temperature configured for tool-selection and answer composition, minimizing answer variance across repeated identical questions during a live or recorded demo walkthrough |
| Full auditability of assistant claims | Every `AssistantMessage` and its `AssistantCitation` rows are persisted (never ephemeral), enabling post-demo spot-check verification that 100% of assistant answers trace to a real ledger/projection record (PRD Success Metrics: "0 instances of ungrounded answers") |
| Tool-argument injection resistance | zod schemas validate every tool-call argument's shape and type before it reaches Prisma — the model cannot pass an arbitrary SQL fragment or malformed filter through a tool call, because tool arguments are typed and parsed, never string-interpolated into a query |

### 5.5 Explicitly Out of Scope (Per PROJECT.md)

- Full OAuth/OIDC or SSO integration
- Password-based authentication, MFA, session hijacking protections
- Rate limiting / abuse prevention (acceptable for a controlled demo audience)
- Multi-tenant data isolation (single-case scope — `case_id` exists in the schema for future partitioning but no tenant-isolation enforcement is implemented)
- Formal penetration testing / security audit
- Encryption key management beyond provider defaults (Neon, Vercel, Anthropic)

Any future productionization of JudicialSync beyond its demo scope would require revisiting every item in this section — this document deliberately does not pretend otherwise.

## 6. Technology Stack

This stack is adopted directly from the PRD (§4 Technical Architecture) and corroborated by `.planning/research/SUMMARY.md`/`ARCHITECTURE.md` as the current (Oct 2026), well-documented toolkit for "chat over app data via tool-calling." No component below was chosen speculatively — each maps to a specific requirement in the FRD.

### 6.1 Core Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Frontend/Full-stack framework | Next.js | 16.x | Single codebase for all 5 screens plus API routes; App Router |
| Language | TypeScript | 5.x | Type safety across service layer, API routes, assistant tools, and UI |
| Database | Postgres (Neon) | 16.x (managed) | Relational store for exhibits, event ledger, custody, rulings, jury package, assistant audit trail |
| ORM | Prisma | 5.x / 6.x | Type-safe queries over the exhibit/objection/ruling/custody graph; schema mirrors the SQL DDL in `02-data-model.md` |
| AI/Assistant SDK | Vercel AI SDK (`ai`, `@ai-sdk/react`, `@ai-sdk/anthropic`) | current (Oct 2026 dist-tags) | Tool-calling + streaming chat (`streamText`, `tool()`, `useChat`) for the Pivota Assistant |
| LLM Provider | Anthropic (via `@ai-sdk/anthropic`) | — | Server-side tool-calling model; swappable to `@ai-sdk/openai` with no architecture change (AI SDK provider abstraction) |
| Validation | zod | 3.x | Validates API request bodies, tool-call arguments, and `ExhibitEvent.payload` discriminated-union shapes before any Prisma write |
| UI components | IBM Carbon Design System (`@carbon/react`) | current | Consistent, accessible, enterprise-grade component layer across all screens (status badges, timelines, chat panel) — WCAG 2.1 AA conformant by default |
| Server-state/caching | `@tanstack/react-query` | 5.x | Polling-based live sync (3–5s refetch interval + refetch-on-focus) across Command Center, Case Workspace, Exhibit Detail, Jury Package |
| Client state | zustand | 4.x/5.x | Lightweight client state for the role switcher and chat-panel UI state |
| Hosting | Vercel | — | Single deployable artifact hosting UI, API routes, and the assistant route together |

### 6.2 Data Model Pattern

| Pattern | Implementation |
|---|---|
| Append-only event ledger | `exhibit_events` table (Postgres) / `ExhibitEvent` (Prisma model) — ground-truth history for status/objection/ruling/custody changes |
| Current-state projection | `exhibit_current_state`, `objection_current_state`, `custody_current_state`, `discrepancy_flags` — derived, fast-read views recomputed synchronously on every relevant ledger write |

### 6.3 Service Layer

| Pattern | Implementation |
|---|---|
| Single typed service module | `services/*.ts` — `getExhibits`, `getCustodian`, `getUnresolvedObjections`, `recordEvent`, `computeJuryCandidates`, `evaluateDiscrepancies`, etc. — sole entry point for both UI API routes and assistant tool wrappers; no parallel retrieval path |

### 6.4 Key Dependencies (package-level detail)

| Package | Role |
|---|---|
| `next` | Full-stack framework (App Router, API routes, server components where applicable) |
| `react`, `react-dom` | UI runtime (React 19.x, bundled with Next.js 16) |
| `typescript` | Static typing across the entire codebase |
| `@prisma/client`, `prisma` (CLI) | Generated type-safe DB client + migration tooling |
| `ai` | Vercel AI SDK core (`streamText`, `tool()`, provider-agnostic primitives) |
| `@ai-sdk/react` | `useChat` hook powering the streaming chat panel |
| `@ai-sdk/anthropic` | Anthropic provider adapter for the AI SDK |
| `zod` | Schema validation for API payloads, tool-call arguments, and ledger event payloads |
| `@tanstack/react-query` | Query caching + polling-based live sync |
| `zustand` | Role-switcher state + lightweight UI state |
| `@carbon/react`, `@carbon/styles`, `@carbon/icons-react` | Carbon component library, design tokens/SCSS theming, and icon set |
| `@neondatabase/serverless` (optional, if using Neon's HTTP/WebSocket driver) | Serverless-friendly Postgres connectivity from Vercel's runtime, as an alternative/complement to a standard pooled TCP connection via Prisma |

### 6.5 Explicitly Avoided Dependencies

Per PRD §4 and research findings — any reintroduction of these should be treated as a scope/architecture change requiring re-justification, not an incremental addition:

| Avoided | Reason |
|---|---|
| Vector database (Pinecone, pgvector, Weaviate, etc.) | Data is structured and small, not a document corpus requiring semantic/approximate search |
| Embeddings pipeline | Same as above — would introduce approximation where exact citation is required |
| LangChain / LangGraph / agent-framework abstraction | Unnecessary abstraction over a fixed, small (≤8) tool set already well-served by the AI SDK's native `tool()` |
| NextAuth / OAuth provider / SSO | Production auth hardening explicitly out of scope for a demo (seeded users + role switcher instead) |
| Message queue (SQS, BullMQ, etc.) | All writes are synchronous request/response cycles at demo scale — no async job processing is needed |
| Redis / caching layer | No read bottleneck expected at demo scale (dozens–hundreds of exhibits, single case, <10 concurrent users) |
| WebSocket/SSE infrastructure | Polling (3–5s) is sufficient for the live multi-screen sync requirement; deferred unless demo rehearsal proves it insufficient |

### 6.6 Development & Build Tooling

| Tool | Purpose |
|---|---|
| Prisma Migrate | Schema migrations against Neon (dev branch + production branch) |
| `tsx` / `ts-node` (dev) | Running the deterministic seed-data loader (`data/seed.ts`) |
| ESLint + TypeScript compiler | Static checks; Next.js's built-in ESLint config as a baseline |
| Vercel CLI / Git-integrated deploys | Single-command deploy of the full-stack artifact |

## 7. Integration Points

JudicialSync is a self-contained demo with exactly **one external network dependency**. This section documents that dependency plus the internal synchronization and trigger mechanisms that stand in for "integrations" at this scale — these internal triggers are the system's most important integration points, even though they never cross a network boundary.

### 7.1 External Services

| Service | Integration Pattern | Notes |
|---|---|---|
| LLM Provider — Anthropic (via `@ai-sdk/anthropic`), or OpenAI (via `@ai-sdk/openai`) as an alternative | Server-side tool-calling API (`streamText` + `tool()`), never called client-side | The only external network dependency in the entire system. Swappable via the AI SDK's provider abstraction with no architecture change. Low/near-zero temperature configured for deterministic repeated-question behavior during a live or recorded demo. API key stored server-side only (Vercel environment variable), never exposed to the client bundle. |

**Explicitly no other external integrations exist or are planned for this demo**, per PROJECT.md scope:

- **No real court case-management system (CMS) integration.** JudicialSync is positioned as an assistant augmenting existing CMS workflows, not replacing or integrating with one.
- **No real evidence-locker / DEMS integration.** All custody data is seeded/representative.
- **No external auth provider (no OAuth/SSO).** Auth is scoped to a seeded-users + role-switcher pattern.
- **No vector database or embeddings provider.** Deliberately avoided per research findings — the assistant's only "external" call is the LLM tool-calling round-trip itself.

### 7.2 Internal Triggers (Ledger → Projection → Discrepancy)

These synchronous, in-process triggers are the system's actual integration fabric between subsystems. They must fire reliably and **synchronously** — not via an eventually-consistent queue — because F5's jury-package finalization gate depends on discrepancy re-evaluation never being stale.

| Trigger | Source Event | Downstream Effect | Feature Chain |
|---|---|---|---|
| Status write | `recordEvent(STATUS_CHANGE)` | Updates `exhibit_current_state`; re-evaluates `ADMITTED_NO_CUSTODIAN` and `UNRESOLVED_OBJECTION_JURY_ELIGIBLE` discrepancy rules for the exhibit | F1 → F6 |
| Objection raised | `recordEvent(OBJECTION_RAISED)` | Creates `objection_current_state` row (`UNRESOLVED`) | F2 |
| Ruling recorded | `recordEvent(RULING_RECORDED)` | Updates `objection_current_state`; if the exhibit is `ADMITTED`, re-evaluates `UNRESOLVED_OBJECTION_JURY_ELIGIBLE` | F2 → F6 |
| Custody transfer | `recordEvent(CUSTODY_TRANSFER)` | Updates `custody_current_state`; re-evaluates `ADMITTED_NO_CUSTODIAN` | F3 → F6 |
| Discrepancy acknowledged | `recordEvent(DISCREPANCY_ACKNOWLEDGED)` | Updates `discrepancy_flags.status` to `ACKNOWLEDGED` | F6 |

All five triggers execute **synchronously within the same service-layer call** that appends the ledger event — there is no async job queue or eventual-consistency window between a ledger write and its projection/discrepancy update. This is a hard architectural requirement, not a performance optimization: F5 §Process step 5 (re-evaluating discrepancies "fresh" at finalization time) is only trustworthy if the projection is guaranteed never to lag behind the ledger.

### 7.3 Live Multi-Screen Sync

| Mechanism | Pattern | Applies To |
|---|---|---|
| Polling (`@tanstack/react-query`) | Client refetch every 3–5 seconds, plus refetch-on-window-focus | Command Center (F8), Case Workspace (F9), Exhibit Detail (F10), Jury Package Workspace (F11, while `DRAFT` — polling stops once `FINALIZED` since content becomes immutable) |
| SSE/WebSocket | **Not implemented in v1** | Explicitly deferred — revisit only if a live demo script requires sub-second visible sync between two screens displayed side-by-side; flagged as a phase-specific decision, not a v1 requirement |

This is sufficient at demo scale (single case, <10 concurrent users) per `.planning/research/ARCHITECTURE.md` §Scaling Considerations, and avoids introducing websocket infrastructure for a one-time or occasionally-repeated live demo.

### 7.4 Seed Data Loader (Pseudo-Integration)

The seed data loader (F0) is the system's sole "data import" path. It is documented here, not as an external integration, but because it behaves like one architecturally: it calls the **identical** `recordEvent()` and `createExhibit()`/`getExhibits()`-family service functions a live user or UI action would, rather than inserting rows directly into current-state projection tables.

This guarantees seeded demo data exercises the exact same write path (ledger-first, projection-derived, discrepancy-triggering) that the live UI uses — there is no risk of the seed data representing a state the live system could never actually produce. The loader deliberately plants:

- At least one exhibit with an unresolved objection (no `RULING_RECORDED` event closes the thread)
- At least one exhibit admitted with no `CUSTODY_TRANSFER` event ever recorded
- At least one exhibit with an unresolved objection that is otherwise eligible for the jury package (triggers both named F6 discrepancy rules)

A post-seed assertion fails the entire seed transaction fast if fewer than these required edge cases are present (`SEED_INTEGRITY_FAILURE`, 500) — enforced programmatically, not by manual review, per FRD F0 §Validation.

### 7.5 Deployment/Runtime Dependencies

| Dependency | Purpose | Notes |
|---|---|---|
| Neon Postgres | Primary datastore | Serverless Postgres, zero-ops, pairs natively with Vercel hosting |
| Vercel (or equivalent Next.js hosting) | Hosting for the full-stack Next.js 16 app | Single deployable artifact — UI, API routes, and the assistant route all ship together; no separate deployment for the assistant |
| Anthropic API | LLM tool-calling + streaming | Server-side only; the only outbound network call beyond the Vercel↔Neon connection |

No message queues, caches, or background job runners are part of this architecture — all writes are synchronous request/response cycles, which is appropriate and sufficient for single-case demo scale (`.planning/research/ARCHITECTURE.md` §Scaling Considerations). Should JudicialSync ever move beyond a demo (out of current scope), this is the first section to revisit: multi-case partitioning, real CMS/DEMS integration points, and async discrepancy re-evaluation at larger scale would all need fresh design work, not incremental extension of the patterns documented here.
