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
| `CaseSelector` *(added Phase 7.1, F22)* | Global (header/nav, alongside `RoleSwitcher`) | Lists and switches the active `caseId`; modeled on `RoleSwitcher`'s zustand pattern. Defaults to the first case by `createdAt` ascending on first load (zero-interaction parity with the prior single-case demo script). Switching triggers a refetch on every open screen and the assistant's working context — no screen may silently continue displaying a previously-selected case's data | `GET /api/cases` | Local client state only (`activeCaseStore`, zustand); no backend write |
| `PendingRulingQueuePage` *(added Phase 7.1, F21)* | New, `JUDGE`-role-restricted screen | Lists every case-wide `UNRESOLVED` objection thread, client-side sorted longest-waiting-first by `raisedAt`; recomputes elapsed-time display on every live-sync poll tick (reuses the existing `useUnresolvedObjections` hook — no new hook, no new polling interval). Each row links into the existing ruling-recording action and Exhibit Detail View. Navigation entry point is restricted to `JUDGE`; the underlying read endpoint remains readable by any role with case visibility, since F20's matrix governs writes, not reads | `GET /api/cases/:id/objections?status=unresolved` (now additionally includes `exhibitLabel`, F21) | None — this screen performs no write of its own; ruling recording happens via the existing F2 action it links to |
| `StatusBadge`, `DiscrepancyIndicator`, `TimelineEntry` | Shared across F8–F11 | Consistent visual vocabulary for status, discrepancy flags, and ledger-event display across every screen (FRD F1 §Sub-features: "Consistent visual status indicator shared across all screens") | — | — |

**Action-flow components** (status transition form, objection/ruling recorder, custody transfer recorder) are intentionally minimal, conversational-feeling controls rather than heavy data-entry forms — reinforcing the PRD's "assistant, not system" positioning. They call their respective F1/F2/F3 API routes and never touch Prisma or current-state tables directly.

**F15 confirmation (added Phase 7):** all five Courtroom Usability Fixes are client-rendering corrections against existing, already-correct service-layer responses — `ExhibitTable.tsx` (full-row click-through on `CaseWorkspacePage`), `ExampleChips.tsx` (assistant example prompts on `AssistantChatPanel`, sourced from the existing `getExhibits` call), `Header.tsx` (remove/label the unexplained numeric element), and `RecentActivityPanel.tsx` (date-qualified timestamps + exhibit label on every row, backed by `services/activity.ts#getRecentActivity` and staggered `data/seed.ts` timestamps for unambiguous ordering). None of these touch an API contract, the service layer, or the schema — they are listed here only because they amend the rendering behavior of components already documented in this table, not because they introduce new architecture. No row in §2.2–2.4 changes as a result of F15.

### 2.2 Service Layer Components

The service layer is the **sole entry point** for every read and write in the system — both UI API routes and assistant tool wrappers call these exact functions, in-process. This is the architectural linchpin that makes cross-screen consistency and assistant-citation trust structurally guaranteed rather than merely tested-for.

| Module | Key Functions | Responsibility |
|---|---|---|
| `services/exhibits.ts` | `createExhibit`, `getExhibit`, `getExhibits(caseId)`, `searchExhibits(criteria)` | Exhibit identity CRUD (create/read only — no status fields); role-based visibility filtering (sealed-exhibit exclusion) applied here for every list/search/get call. **Amended Phase 7.1 (F16):** `createExhibit` now requires `classification` (`TRIAL` \| `CHAMBERS_EX_PARTE` \| `SEALED`) and, within the same write, sets `isSealed = (classification !== 'TRIAL')` — `isSealed` is no longer an independently client-settable input; any client-supplied value in the request body is ignored and overwritten. No call site in `services/visibility.ts` requires a change, since `isSealed` remains classification-consistent by construction. **Amended Phase 7.1 (F20):** `createExhibit` now begins with `assertRole(actorUserId, ['DEPUTY','CLERK','ADMIN'], 'create exhibit')` before any other validation runs — see `services/authorization.ts` below and `04-security.md` §5.2.2a. |
| `services/events.ts` | `recordEvent({ exhibitId, eventType, payload, actorUserId })` | **The only function that writes `ExhibitEvent` rows.** Validates payload shape per `eventType` (zod, discriminated union), stamps `sequenceNo` and `recordedAt`, appends the immutable row, then synchronously triggers the relevant projection update(s) and discrepancy re-evaluation (see `06-integrations.md` §Internal Triggers). **Amended Phase 7.1 (F19):** the discriminated union now additionally accepts `CUSTODY_TRANSFER_PROPOSED`, `CUSTODY_TRANSFER_CONFIRMED`, `CUSTODY_TRANSFER_CANCELLED` payload shapes (see `02-data-model.md` §3.3). |
| `services/status.ts` | `getExhibitStatus(exhibitId)`, `recordStatusChange(...)` | F1 admission-lifecycle state machine validation (allowed-transitions table), current-status projection read. **Amended Phase 7 (F12):** when `toStatus = ADMITTED`, `recordStatusChange` additionally runs the **Admission Gate** — two precondition queries (`ObjectionCurrentState WHERE status = 'UNRESOLVED'`, `CustodyCurrentState` row presence/non-null custodian) against existing current-state projections, inside the same transaction as F1's existing `fromStatus` check — before any `ExhibitEvent` row is appended or `ExhibitCurrentState` is updated. Rejects with `ADMISSION_BLOCKED` (422, `reasons[]`) if either condition applies. No new tables are read; no new writes occur on rejection. There is no bypass flag or elevated-role override — every caller (UI, API client, seed loader) is subject to it. **Documentation/test-only (Phase 7.1, F17):** the Admission Gate above already and unconditionally prevents an `OBJECTED → ADMITTED` transition with any `UNRESOLVED` objection thread, because `ObjectionCurrentState.status` can leave `UNRESOLVED` only via a `RULING_RECORDED` event — there is no other write path. F17 adds **no new runtime mechanism, no new code path, and no new function** to this module; it formally names this guarantee as an invariant and adds dedicated regression test coverage (bypass attempt rejected; legal direct `OFFERED → ADMITTED` with zero objection threads unaffected). Anyone looking for F17's "implementation" in this module will not find one — that absence is the point. **Amended Phase 7.1 (F18):** `recordStatusChange` now requires a `custodianUserId` parameter **only** when the call is the exhibit's first-ever `STATUS_CHANGE` event (`toStatus = MARKED` with zero prior events) — validated (must reference an existing, active `User`, reusing F03's `INVALID_CUSTODIAN` check) and written **in the same database transaction** as the `STATUS_CHANGE` event itself. On success, this single transaction appends both the `STATUS_CHANGE` event and a `CUSTODY_TRANSFER_CONFIRMED` event (`fromCustodianUserId: null`) establishing the exhibit's first custody link directly — no preceding `CUSTODY_TRANSFER_PROPOSED` event, per F19's documented intake-bootstrap exception (see `services/custody.ts` below). If the transaction fails for any reason, neither event persists — there is no intermediate state where an exhibit is `MARKED` with no custodian, even transiently. Rejects with `CUSTODIAN_REQUIRED_AT_INTAKE` (422) if absent on a first-ever `MARKED` transition. F12's later admission-time custodian check is retained unchanged as a second, independent backstop — F18 does not replace it. **Amended Phase 7.1 (F20):** every transition handled by this module now begins with `assertRole(actorUserId, ['DEPUTY','CLERK','ADMIN'], <action label>)` before any state-machine or admission-gate validation runs. |
| `services/objections.ts` | `getUnresolvedObjections(caseId)`, `recordObjection(...)`, `recordRuling(...)` | F2 objection-thread lifecycle; judge-role enforcement for SUSTAINED/OVERRULED dispositions. **Amended Phase 7.1 (F20):** `recordObjection` now begins with `assertRole(actorUserId, ['ATTORNEY','DEPUTY','CLERK','ADMIN'], 'raise objection')` before any other validation — the one write action in the system an `ATTORNEY` role is permitted to perform; `recordRuling`'s pre-existing ad hoc judge-check for `SUSTAINED`/`OVERRULED` is retrofitted onto the same shared `assertRole` helper for consistency, with no change to its allowed-role set (`JUDGE` only) or its message. **Amended Phase 7.1 (F21):** `getUnresolvedObjections` now additionally joins `Exhibit.exhibitLabel` into each returned row (read-time join, same pattern as F14's existing `justification` join) — no schema change, no new function; this is the only backend change powering the new Pending-Ruling Queue screen, which sorts and live-updates the existing response client-side. |
| `services/custody.ts` | `getCustodian(exhibitId)`, `getCustodyHistory(exhibitId)`, `proposeCustodyTransfer(...)`, `confirmCustodyTransfer(...)`, `cancelCustodyTransfer(...)`, `recordCustodyTransfer(...)` *(legacy, intake-only as of Phase 7.1)* | **Significantly amended Phase 7.1 (F19) — unilateral transfer replaced by a two-phase propose/confirm model.** `recordCustodyTransfer` (F3's original unilateral function) is retained **only** for F18's intake-bootstrap case (`fromCustodianUserId: null`); any call with a non-null `fromCustodianUserId` is now rejected with `CUSTODY_TRANSFER_REQUIRES_CONFIRMATION` (409), directing callers to the propose/confirm functions below. **New function `proposeCustodyTransfer({ exhibitId, fromCustodianUserId, toCustodianUserId, reason?, actorUserId })`:** validates `fromCustodianUserId` matches `CustodyCurrentState.currentCustodianUserId` exactly (F3's existing `CUSTODY_CHAIN_BROKEN` check, unchanged) and that no transfer is already pending (`CUSTODY_TRANSFER_ALREADY_PENDING`, 409); appends a `CUSTODY_TRANSFER_PROPOSED` event and sets `CustodyCurrentState.pendingTransferToUserId`/`pendingTransferEventId`/`pendingTransferProposedAt` — `currentCustodianUserId` is **not** modified. **New function `confirmCustodyTransfer({ exhibitId, proposedEventId, actorUserId })`:** rejects unless a transfer is currently pending and `actorUserId` exactly equals `pendingTransferToUserId` (`CUSTODY_CONFIRM_WRONG_USER`, 403 — an identity match, independent of and in addition to F20's role check, see `04-security.md` §5.2.2b); appends a `CUSTODY_TRANSFER_CONFIRMED` event and **only now** updates `currentCustodianUserId`, clearing all three pending fields. **New function `cancelCustodyTransfer({ exhibitId, proposedEventId, reason?, actorUserId })`:** callable by the original proposer or any F20-authorized propose role; appends a `CUSTODY_TRANSFER_CANCELLED` event and clears the pending fields — `currentCustodianUserId` is unaffected, since it was never changed by the proposal. `getCustodian` is amended to additionally return `pendingTransfer: { toUserId, proposedAt, eventId } | null`; `getCustodyHistory` is amended to include all three new event types in the ordered timeline, so a cancelled/superseded proposal remains visible rather than disappearing. There is deliberately **no background expiry job** for an indefinitely-pending transfer — consistent with this architecture's queue-free, synchronous-only write model (`06-integrations.md`); `cancelCustodyTransfer` is the only resolution path for a transfer nobody confirms. **Amended Phase 7.1 (F20):** `proposeCustodyTransfer`/`confirmCustodyTransfer`/`cancelCustodyTransfer` each begin with `assertRole(actorUserId, ['DEPUTY','CLERK','ADMIN'], <action label>)` before their respective identity/state checks run. |
| `services/discrepancies.ts` | `evaluateDiscrepancies(exhibitId)`, `getDiscrepancies(caseId, exhibitId?)`, `acknowledgeDiscrepancy(...)` | F6 rule registry (extensible); fires after every status/objection/ruling/custody write; idempotent acknowledgment. **Amended Phase 7 (F14):** `getDiscrepancies` additively joins `acknowledgedEventId → ExhibitEvent.payload.justification` for any flag with `status = 'ACKNOWLEDGED'`, surfacing `justification` in its response — a read-time join only; no schema change, no new write path. **Amended Phase 7.1 (F20):** `acknowledgeDiscrepancy`'s pre-existing ad hoc role check (`DEPUTY`/`CLERK`/`JUDGE`/`ADMIN`) is retrofitted onto the shared `assertRole` helper — no change to its allowed-role set or message. |
| `services/juryPackage.ts` | `computeJuryCandidates(caseId)`, `getJuryPackageStatus(caseId, exhibitId?)`, `finalizeJuryPackage(...)` | F5 jury-eligible computation + hard discrepancy gate re-evaluated fresh at finalization time (never from cached draft-time annotation). **Amended Phase 7 (F13):** `computeJuryCandidates`'s candidate query filtered `exhibit.isSealed = false` in the *same* query as `currentStatus = 'ADMITTED'`. **Amended again Phase 7.1 (F16):** that filter now reads `exhibit.classification = 'TRIAL'` instead — `CHAMBERS_EX_PARTE` and `SEALED` are hard-excluded identically, driven by the three-value taxonomy rather than the boolean — a sealed/chambers/ex-parte exhibit's row is never created, is never passed into `evaluateDiscrepancies` for jury-package purposes, and can never acquire `CLEAN`/`FLAGGED`. **New function (F13):** `excludeJuryPackageExhibit({ juryPackageId, exhibitId, actorUserId, reason, note? })` — role-gated (`DEPUTY`/`CLERK`/`ADMIN`, identical to the finalize gate, now via `assertRole`), appends a `JURY_PACKAGE_EXHIBIT_EXCLUDED` ledger event and sets the row's `status = 'EXCLUDED'` (`excludedAt`/`excludedBy`/`exclusionReason` populated, row retained for audit). This is the remediation/regression-safety path for legacy rows; the classification filter above is the primary exclusion mechanism. **Amended Phase 7.1 (F23):** `finalizeJuryPackage` now additionally computes `version = (MAX(version) WHERE caseId = :caseId AND status = 'FINALIZED') + 1` (or `1` if none exists) and sets it atomically in the same transaction as `status = 'FINALIZED'`/`finalizedAt`/`finalizedBy` — `version` is never client-supplied, never reassigned after finalization. **New function `listJuryPackageVersions(caseId)` (F23):** returns every `JuryPackage` for the case (every `FINALIZED` version plus the current `DRAFT`, if any), each annotated with `isMostRecent` (computed at read time as `MAX(version)` per case — never stored). **New function `exportJuryPackagePdf(juryPackageId)` (F23):** rejects with `JURY_PACKAGE_EXPORT_NOT_FINALIZED` (422) unless the package is `FINALIZED`; otherwise renders the package's immutable `INCLUDED` `JuryPackageExhibit` rows via the new `lib/pdf/JuryPackageDocument.tsx` component (see note below) and returns a PDF buffer — deterministic per version, since a `FINALIZED` package's rows never change. `finalizeJuryPackage`/`computeJuryCandidates`/`excludeJuryPackageExhibit` continue to call `assertRole(actorUserId, ['DEPUTY','CLERK','ADMIN'], <action label>)` unchanged, now via the shared helper. |
| `services/cases.ts` | `getCases()`, `getActiveCaseWithUsers(caseId)` | **New module, Phase 7.1 (F22).** `getCases()` lists every `Case` row (`{ id, caseNumber, title, court, createdAt }`) — no role restriction, since case existence is not the sensitive boundary (exhibit-level classification/visibility remains sensitive and is unaffected). `getActiveCaseWithUsers` **evolves from its prior no-argument, implicit-`DEMO_CASE_NUMBER` form to an explicit `getActiveCaseWithUsers(caseId)`** — every call site that previously relied on the implicit constant (exhibit list, search, activity feed, discrepancies, jury package, assistant tool calls) is amended to thread the caller-supplied `caseId` through explicitly, exactly as `requestingUserRole` is already threaded per-request. This is additive query-parameter plumbing against tables that already carry a `caseId` foreign key — no new join, no new index, no new table (see `02-data-model.md` §3.10). |
| `services/activity.ts` | `getRecentActivity(caseId, { since })` | F8 Command Center's ledger-wide recent-events feed, joined to exhibit labels. **Amended Phase 7.1 (F22):** `caseId` is now sourced from the client's explicit Case Selector state rather than an implicit single-case constant — the function signature is unchanged (it already took `caseId`), only the caller's origin of that value changes. |
| `services/visibility.ts` | `applyRoleScoping(query, role)` (internal helper, not directly exported as a tool/route) | Single implementation of the Role-Based Visibility table (FRD `00-header.md`); called by every other service module — the one place sealed-exhibit exclusion logic lives. **Confirmed unchanged by Phase 7.1 (F16):** this module continues to branch on `Exhibit.isSealed` exactly as before every call site — no call site requires modification, since `isSealed` is now a write-once mirror of `classification` and therefore remains classification-consistent by construction (see `services/exhibits.ts` above). |
| `services/authorization.ts` | `assertRole(actorUserId, allowedRoles: Role[], actionLabel: string)` | **New module, Phase 7.1 (F20).** The single shared helper generalizing the role-check pattern previously implemented ad hoc, separately, by `recordRuling`'s judge-check and `finalizeJuryPackage`'s `assertJuryWriteRole`. Resolves `actorUserId` to its `User.role` database column via a direct lookup — **never** from a client-supplied role claim in a request body, header, or store — and throws (surfaced by the calling route as `403 ROLE_NOT_PERMITTED` with an action-specific message) if the resolved role is not in `allowedRoles`. Every write action in the Permission Matrix (`04-security.md` §5.2.2a) calls this helper, or an action-specific wrapper around it, as the **first** statement in its handler — before any field-level validation, state-machine check, or ledger write — so a disallowed-role request never leaks information about the request's validity. This is the single rule that prevents role-check drift across the ten gated actions. |
| `services/rebuild.ts` | `rebuildProjections(caseId)` | Admin/dev utility: replays `ExhibitEvent` rows per exhibit in `sequenceNo` order to verify projection/ledger consistency (auditability NFR) — not part of the live write path |

**PDF export rendering (Phase 7.1, F23):** `lib/pdf/JuryPackageDocument.tsx` is a new, non-interactive React component tree (`<Document>`/`<Page>`/`<View>`/`<Text>` from `@react-pdf/renderer`) rendered server-side only, inside `services/juryPackage.ts#exportJuryPackagePdf` — it is not a route, not a UI screen, and not reachable client-side; it exists solely to produce a deterministic `application/pdf` buffer from a `FINALIZED` package's immutable exhibit set. See `05-tech-stack.md` §6.4 for the new dependency and `06-integrations.md` §Deployment/Runtime Dependencies for the serverless-fit rationale.

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
6. **Admission integrity is enforced once, inside `services/status.ts#recordStatusChange()`** (added Phase 7, F12) — the pre-write Admission Gate runs for every caller attempting `toStatus = ADMITTED`; there is no second code path, bypass flag, or elevated-role override that can record an `ADMITTED` status while an unresolved objection or missing custodian is present.
7. **Sealed/ex-parte exclusion from the jury package is a candidate-query filter, not a UI hide** (added Phase 7, F13; amended Phase 7.1, F16) — `services/juryPackage.ts#computeJuryCandidates` excludes non-`TRIAL` exhibits (`CHAMBERS_EX_PARTE`, `SEALED`) at the source query, before `evaluateDiscrepancies` ever runs for jury-package purposes; the `JuryPackageExhibit.status = 'EXCLUDED'` remediation path exists only as an audit-retained backstop for rows that predate this filter.
8. **An exhibit can never exist with no custodian of record, from the moment it enters the admission lifecycle** (added Phase 7.1, F18) — `services/status.ts#recordStatusChange`'s first-ever call for an exhibit (`(none) → MARKED`) requires a `custodianUserId` and writes the `STATUS_CHANGE` event and the resulting `CUSTODY_TRANSFER_CONFIRMED` event **in the same database transaction**; there is no intermediate, even transient, state where an exhibit is `MARKED` with no `CustodyCurrentState` row. This closes the window F12's later admission-time check alone left open between intake and admission — F12's check is retained unchanged as an independent second backstop, not replaced.
9. **Every write action in the system is role-gated server-side by one shared mechanism, resolved from the database, never from a client claim** (added Phase 7.1, F20) — every write-handling function listed in `01-components.md` §2.2 begins by calling `services/authorization.ts#assertRole(actorUserId, allowedRoles, actionLabel)`, which looks up `actorUserId`'s `role` column directly from `User` and rejects with `403 ROLE_NOT_PERMITTED` **before** any other validation in that handler runs if the resolved role is not permitted. There is no action in the Permission Matrix (`04-security.md` §5.2.2a) with an implicit "ADMIN can always do anything" override beyond what the matrix explicitly lists, and there is no second, uncovered write path for any of the ten listed actions. Custody confirmation (matrix row 7) additionally requires F19's independent identity match (`actorUserId` must equal the pending transfer's named receiver) — the two checks are independent and both must pass; a role-permitted but non-named user is still rejected (`CUSTODY_CONFIRM_WRONG_USER`, not `ROLE_NOT_PERMITTED`).

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
    'CUSTODY_TRANSFER',  -- legacy unilateral transfer; retained ONLY for the
                          -- F18 intake-bootstrap path as of Phase 7.1 (F19) —
                          -- rejected for any non-first transfer
    'DISCREPANCY_ACKNOWLEDGED',
    'JURY_PACKAGE_EXHIBIT_EXCLUDED',  -- added Phase 7 (F13); existing deployments
                                      -- apply this via ALTER TYPE event_type
                                      -- ADD VALUE 'JURY_PACKAGE_EXHIBIT_EXCLUDED'
                                      -- (see §3.9 Phase 7 Schema Changes)
    'CUSTODY_TRANSFER_PROPOSED',     -- added Phase 7.1 (F19): two-phase handoff, phase 1
    'CUSTODY_TRANSFER_CONFIRMED',    -- added Phase 7.1 (F19): two-phase handoff, phase 2
                                      -- (also used directly, with no preceding
                                      -- PROPOSED event, for F18's intake-bootstrap link)
    'CUSTODY_TRANSFER_CANCELLED'     -- added Phase 7.1 (F19): reverts a pending
                                      -- proposal; current_custodian_user_id unaffected
                                      -- (see §3.10 Phase 7.1 Schema Changes)
);

-- Added Phase 7.1 (F16). Required at intake, immutable thereafter — no
-- reclassification endpoint exists in this version. Supersedes is_sealed as
-- the authoritative sensitivity input to jury-package exclusion (F13) and
-- role-based visibility; is_sealed is retained as a write-once mirror (see
-- exhibits.is_sealed below) rather than removed, so visibility.ts's existing
-- read paths require no change. See §3.10 Phase 7.1 Schema Changes.
CREATE TYPE exhibit_classification AS ENUM (
    'TRIAL', 'CHAMBERS_EX_PARTE', 'SEALED'
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

-- Added Phase 7 (F13). Tracks whether a jury_package_exhibits row is
-- currently part of the active/included package set, or has been excluded
-- (automatically, via the is_sealed candidate-query filter — the primary
-- mechanism — or manually, via the "Remove from Package" remediation
-- action). EXCLUDED rows are retained, never deleted, for audit.
CREATE TYPE jury_package_exhibit_status AS ENUM (
    'INCLUDED', 'EXCLUDED'
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
    classification     exhibit_classification NOT NULL,  -- added Phase 7.1 (F16): required at creation, immutable — no update path exists
    is_sealed          BOOLEAN NOT NULL DEFAULT false,    -- Phase 7.1 (F16): now WRITE-ONCE, derived at creation as (classification != 'TRIAL') — never independently set again; see §3.10
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
| `CUSTODY_TRANSFER` | `{ fromCustodianUserId: uuid \| null, toCustodianUserId: uuid, reason?: string }` — legacy unilateral shape; retained only for F18's intake-bootstrap link in historical/prior-version data |
| `DISCREPANCY_ACKNOWLEDGED` | `{ discrepancyFlagId: uuid, ruleCode: string, justification: string }` |
| `JURY_PACKAGE_EXHIBIT_EXCLUDED` *(added Phase 7, F13)* | `{ juryPackageId: uuid, exhibitId: uuid, reason: 'SEALED_EXPARTE' \| 'MANUAL_REMOVAL', note?: string }` |
| `CUSTODY_TRANSFER_PROPOSED` *(added Phase 7.1, F19)* | `{ fromCustodianUserId: uuid, toCustodianUserId: uuid, reason?: string }` — `fromCustodianUserId` must match the exhibit's current custodian; does not change `custody_current_state.current_custodian_user_id` |
| `CUSTODY_TRANSFER_CONFIRMED` *(added Phase 7.1, F19)* | `{ proposedEventId: uuid \| null, fromCustodianUserId: uuid \| null, toCustodianUserId: uuid }` — `proposedEventId` references the resolved `CUSTODY_TRANSFER_PROPOSED` event, or `null` for F18's intake-bootstrap case (where `fromCustodianUserId` is also `null`) |
| `CUSTODY_TRANSFER_CANCELLED` *(added Phase 7.1, F19)* | `{ proposedEventId: uuid, reason?: string }` — references the pending proposal being cancelled |

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
    last_event_id            UUID NOT NULL REFERENCES exhibit_events(id),

    -- Added Phase 7.1 (F19): two-phase custody handoff pending state.
    -- Populated by a CUSTODY_TRANSFER_PROPOSED event; cleared by the
    -- resolving CUSTODY_TRANSFER_CONFIRMED or CUSTODY_TRANSFER_CANCELLED
    -- event. current_custodian_user_id is NEVER modified while these are
    -- non-null — "who currently has it" always reflects the last CONFIRMED
    -- transfer, never a pending proposal. See §3.10.
    pending_transfer_to_user_id   UUID REFERENCES users(id),
    pending_transfer_event_id     UUID REFERENCES exhibit_events(id),
    pending_transfer_proposed_at  TIMESTAMPTZ
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
    finalized_by  UUID REFERENCES users(id),
    version       INTEGER,  -- added Phase 7.1 (F23): assigned ONLY at finalization
                             -- (MAX(version) WHERE case_id = :id AND status = 'FINALIZED') + 1,
                             -- or 1 if none exists; never reassigned afterward; NULL while DRAFT

    CONSTRAINT uq_jury_packages_case_version UNIQUE (case_id, version)
    -- Postgres treats NULL as distinct from NULL in a UNIQUE constraint, so
    -- any number of DRAFT (version IS NULL) rows coexist per case without
    -- violating this constraint — the sparse/partial uniqueness F23 requires
    -- falls out of standard Postgres NULL semantics, no partial index needed.
);

CREATE INDEX idx_jury_packages_case_status ON jury_packages (case_id, status);

-- discrepancy_status here is a point-in-time annotation captured at
-- computation time for display; F5's finalization gate ALWAYS re-queries
-- discrepancy_flags fresh rather than trusting this cached column — see
-- 03-api.md §Jury Package.
--
-- status / excluded_at / excluded_by / exclusion_reason added Phase 7
-- (F13) via a new Prisma migration. status defaults to 'INCLUDED' so
-- existing rows remain valid post-migration with no backfill required.
-- These four columns back the "Remove from Package" remediation/audit
-- path only — the PRIMARY defense against sealed exhibits is the
-- is_sealed = false filter now applied inside computeJuryCandidates's
-- query (see note below), which means a sealed exhibit never acquires
-- an INCLUDED row here in the first place going forward.
CREATE TABLE jury_package_exhibits (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jury_package_id    UUID NOT NULL REFERENCES jury_packages(id),
    exhibit_id         UUID NOT NULL REFERENCES exhibits(id),
    discrepancy_status jury_exhibit_discrepancy_status NOT NULL,
    added_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    status             jury_package_exhibit_status NOT NULL DEFAULT 'INCLUDED',  -- added Phase 7 (F13)
    excluded_at        TIMESTAMPTZ,                                              -- added Phase 7 (F13)
    excluded_by        UUID REFERENCES users(id),                                -- added Phase 7 (F13)
    exclusion_reason   TEXT,                                                     -- added Phase 7 (F13): 'SEALED_EXPARTE' | 'MANUAL_REMOVAL'

    CONSTRAINT uq_jury_package_exhibit UNIQUE (jury_package_id, exhibit_id)
);

-- Added Phase 7 (F13): GET /api/cases/:id/jury-package's default read
-- returns only status = 'INCLUDED' rows; this index serves that filter
-- plus the inverse audit-history query.
CREATE INDEX idx_jury_package_exhibits_package_status
    ON jury_package_exhibits (jury_package_id, status);
```

**Jury Package Exclusion note (Phase 7, F13; amended Phase 7.1, F16):** `computeJuryCandidates`'s candidate query (`services/juryPackage.ts`, see `01-components.md` §2.2) originally filtered `exhibits.is_sealed = false` in the *same* query as `exhibit_current_state.current_status = 'ADMITTED'`. **As of Phase 7.1, this filter reads `exhibits.classification = 'TRIAL'` instead** — both `CHAMBERS_EX_PARTE` and `SEALED` are hard-excluded identically, driven by the three-value taxonomy rather than the boolean, so a chambers-ex-parte or sealed exhibit's row is never created as `INCLUDED` via the normal computation path, and is never passed into `evaluateDiscrepancies` for jury-package purposes (so it can never acquire `CLEAN`/`FLAGGED`). The `status`/`excluded_*` columns above exist solely for the remediation/audit path (legacy or regression rows, or any future manual removal) — they are a safety net, not the primary mechanism. `EXCLUDED` rows are retained (never deleted) and are omitted from `GET /api/cases/:id/jury-package`'s default response but remain queryable for audit.

**Jury Package Versioning note (Phase 7.1, F23):** `version` is assigned only at finalization (see column comment above) and never reassigned afterward. No separate snapshot table is introduced — the existing `jury_package_exhibits` rows, already immutable once their parent package is `FINALIZED` (§3.6, enforced at the service layer), serve directly as each version's permanent record. "Most-recent version" (`isMostRecent` in `GET /api/cases/:id/jury-package/versions`'s response) is computed at read time as `MAX(version)` per case — never stored as an independent flag, consistent with this project's existing principle that derived facts are computed, not independently maintained state that could drift.

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

### 3.9 Phase 7 Schema Changes (Migration Required)

F12–F15 (Phase 7) are predominantly service-layer validation and client-rendering work, not schema work. Exactly one feature — F13 — requires a schema change, and it requires a new Prisma migration:

| Change | Table/Enum | Required by | Migration? |
|---|---|---|---|
| New enum value `JURY_PACKAGE_EXHIBIT_EXCLUDED` | `event_type` | F13 (exclusion audit event) | **Yes** — `ALTER TYPE event_type ADD VALUE` |
| New enum | `jury_package_exhibit_status` (`INCLUDED` \| `EXCLUDED`) | F13 | **Yes** — `CREATE TYPE` |
| New columns `status`, `excluded_at`, `excluded_by`, `exclusion_reason` | `jury_package_exhibits` | F13 | **Yes** — `ALTER TABLE ... ADD COLUMN`, `status` backfilled to `'INCLUDED'` by its `DEFAULT` for existing rows |
| New index `idx_jury_package_exhibits_package_status` | `jury_package_exhibits` | F13 (default-read filter) | **Yes** — part of the same migration |
| *(no schema change)* | — | F12 (admission gate) | **No** — reads existing `objection_current_state`/`custody_current_state` projections only; writes nothing beyond the standard `STATUS_CHANGE` event already defined for F1 |
| *(no schema change)* | — | F14 (acknowledgment justification surfacing) | **No** — the justification text already exists in the `DISCREPANCY_ACKNOWLEDGED` event's `payload`; F14 is a read-time join at the service layer (`services/discrepancies.ts#getDiscrepancies`), not a new column |
| *(no schema change)* | — | F15 (usability fixes) | **No** — client-rendering only; no table, column, or enum is touched |

All four F13 schema changes land in a single Prisma migration (e.g. `add_jury_package_exhibit_exclusion`). No other table in this document is touched by Phase 7.

### 3.10 Phase 7.1 Schema Changes (Migration Required)

F16–F23 (Phase 7.1) are predominantly service-layer, state-machine, and API-surface work. Four features — F16, F18 (indirectly, via F19's event types), F19, and F23 — require schema changes; F17, F21, and F22 require **none**, and each is listed explicitly below so that absence is a confirmed fact, not an omission:

| Change | Table/Enum | Required by | Migration? |
|---|---|---|---|
| New enum `exhibit_classification` (`TRIAL` \| `CHAMBERS_EX_PARTE` \| `SEALED`) | — | F16 | **Yes** — `CREATE TYPE` |
| New column `classification` (`NOT NULL`) | `exhibits` | F16 | **Yes** — `ALTER TABLE ... ADD COLUMN`; existing demo rows are backfilled from their current `is_sealed` value (`'SEALED'` if `is_sealed = true`, else `'TRIAL'`) **before** the `NOT NULL` constraint is applied, in the same migration |
| `is_sealed` semantics change (now write-once, derived from `classification` at creation) | `exhibits` | F16 | **No new column** — `is_sealed` itself is untouched at the schema level; this is a write-path/documentation amendment only (see `services/exhibits.ts`, `01-components.md` §2.2) |
| Three new enum values: `CUSTODY_TRANSFER_PROPOSED`, `CUSTODY_TRANSFER_CONFIRMED`, `CUSTODY_TRANSFER_CANCELLED` | `event_type` | F19 (and F18, which writes `CUSTODY_TRANSFER_CONFIRMED` for its intake-bootstrap link) | **Yes** — three separate `ALTER TYPE event_type ADD VALUE` statements (Postgres requires one value per statement; each runs outside the transaction that first uses the new value, per standard Postgres `ADD VALUE` semantics) |
| Three new nullable columns `pending_transfer_to_user_id`, `pending_transfer_event_id`, `pending_transfer_proposed_at` | `custody_current_state` | F19 | **Yes** — `ALTER TABLE ... ADD COLUMN` ×3, all nullable, no backfill needed (existing rows correctly have no pending transfer) |
| New nullable column `version` (`INTEGER`) + `UNIQUE (case_id, version)` constraint | `jury_packages` | F23 | **Yes** — `ALTER TABLE ... ADD COLUMN`, `ADD CONSTRAINT`; no backfill needed (existing `FINALIZED` rows remain `version = NULL` — this is a known, accepted gap: only packages finalized **after** this migration receive a version number; see Rollout Note below) |
| *(no schema change)* | — | F17 (admission state-machine hardening) | **No** — F17 adds zero new runtime mechanism; F12's existing gate, reading only the pre-existing `objection_current_state` projection, already and unconditionally provides the guarantee F17 formalizes. This row is deliberately listed, not omitted, to make that "no mechanism" determination auditable rather than silent. |
| *(no schema change)* | — | F21 (pending-ruling queue) | **No** — `raised_at` already exists on `objection_current_state`; the only backend change is an additive read-time join of `exhibits.exhibit_label` inside `getUnresolvedObjections`, not a schema change. Sorting and live elapsed-time recomputation are entirely client-side. |
| *(no schema change)* | — | F22 (multi-case support) | **No** — `case_id` foreign keys already exist on every table requiring case-scoping (`cases`, `users`, `exhibits`, `jury_packages`, `assistant_conversations`); this feature adds explicit `WHERE case_id = :selectedCaseId` plumbing to service functions that previously scoped implicitly via a `DEMO_CASE_NUMBER` constant, and a second seeded `Case` row with its own exhibits — no table, column, index, or constraint is added |

**Rollout note (F23 sparse versioning):** because `version` is only assigned going forward, any `jury_packages` row already `FINALIZED` before this migration lands retains `version = NULL` permanently — it was never assigned one and this feature does not retroactively backfill version numbers for pre-existing finalized packages (doing so would require an arbitrary ordering decision for history that predates the feature). `GET /api/cases/:id/jury-package/versions` lists such a row with `version: null` and `isMostRecent: false` (since `isMostRecent` is computed only over non-null versions) — this is accepted, documented behavior, not a defect, given the project's single-case-then-newly-multi-case demo data is seeded fresh rather than migrated from real pre-existing production history.

**Combined migration:** all eight schema changes above (one enum, one new column + backfill + `NOT NULL` on `exhibits`; three enum values + three new nullable columns on `custody_current_state`; one new column + one constraint on `jury_packages`) land in a single Prisma migration for Phase 7.1 (e.g. `phase_7_1_classification_custody_handoff_jury_versioning`). No table outside this list is touched by Phase 7.1 — `objection_current_state`, `discrepancy_flags`, `assistant_conversations`/`assistant_messages`/`assistant_citations`, and `jury_package_exhibits` (Phase 7's F13 columns) are all unchanged.

## 4. API Design

All endpoints are thin REST wrappers around the service layer (`01-components.md` §2.2) — route handlers parse the request, extract `requestingUserRole`/`actorUserId` from the session/role-switcher context, call exactly one service function, and shape the response. No route contains business logic beyond this. The Pivota Assistant's tools call the identical underlying service functions as **in-process function calls**, not HTTP round-trips to these routes — but the request/response shapes below describe the same contract both consumers rely on.

Every endpoint applies role-based visibility (`00-header.md` §Role-Based Visibility in the FRD) uniformly: sealed exhibits are excluded from results, and direct reads of a sealed exhibit by an unauthorized role return a **404** (not 403) so existence is never leaked.

### 4.1 Shared TypeScript Types

```typescript
// Shared enums — mirror the Postgres enum types 1:1
type Role = 'JUDGE' | 'CHAMBERS_STAFF' | 'DEPUTY' | 'CLERK' | 'ATTORNEY' | 'ADMIN';
type OfferingParty = 'PLAINTIFF' | 'PROSECUTION' | 'DEFENSE';
type ExhibitStatus = 'MARKED' | 'OFFERED' | 'OBJECTED' | 'ADMITTED' | 'EXCLUDED' | 'WITHDRAWN';
type ExhibitClassification = 'TRIAL' | 'CHAMBERS_EX_PARTE' | 'SEALED'; // added Phase 7.1 (F16)
type ObjectionStatus = 'UNRESOLVED' | 'SUSTAINED' | 'OVERRULED';
type RulingDisposition = 'SUSTAINED' | 'OVERRULED' | 'RESERVED';
type EventType =
  | 'STATUS_CHANGE'
  | 'OBJECTION_RAISED'
  | 'RULING_RECORDED'
  | 'CUSTODY_TRANSFER' // legacy unilateral transfer; retained only for the F18 intake-bootstrap path as of Phase 7.1 (F19)
  | 'DISCREPANCY_ACKNOWLEDGED'
  | 'JURY_PACKAGE_EXHIBIT_EXCLUDED' // added Phase 7 (F13)
  | 'CUSTODY_TRANSFER_PROPOSED'   // added Phase 7.1 (F19)
  | 'CUSTODY_TRANSFER_CONFIRMED'  // added Phase 7.1 (F19)
  | 'CUSTODY_TRANSFER_CANCELLED'; // added Phase 7.1 (F19)
type DiscrepancyStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
type JuryPackageStatus = 'DRAFT' | 'FINALIZED';
type JuryExhibitDiscrepancyStatus = 'CLEAN' | 'FLAGGED';
type JuryPackageExhibitStatus = 'INCLUDED' | 'EXCLUDED'; // added Phase 7 (F13)

interface Case {
  // Added Phase 7.1 (F22)
  id: string;
  caseNumber: string;
  title: string;
  court: string;
  createdAt: string;
}

interface Exhibit {
  id: string;
  caseId: string;
  exhibitLabel: string;
  description: string;
  source: string | null;
  offeringParty: OfferingParty;
  associatedWitness: string | null;
  // Added Phase 7.1 (F16): required at creation, immutable thereafter — no
  // update endpoint exists. isSealed is retained below for backward
  // compatibility with every existing read path but is now a write-once
  // mirror set exactly once at creation as (classification !== 'TRIAL');
  // a client-supplied isSealed value in POST /api/exhibits is ignored.
  classification: ExhibitClassification;
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
  // Added Phase 7.1 (F19): non-null only while a CUSTODY_TRANSFER_PROPOSED
  // event is awaiting its resolving CONFIRMED/CANCELLED event.
  // currentCustodianUserId is never modified while this is non-null.
  pendingTransfer: { toUserId: string; proposedAt: string; eventId: string } | null;
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
  // Added Phase 7 (F14): additive read-time join from acknowledgedEventId
  // to the backing DISCREPANCY_ACKNOWLEDGED event's payload.justification —
  // present only when status === 'ACKNOWLEDGED'; no schema/write change.
  justification?: string;
  resolvedAt?: string;
}

interface JuryPackage {
  id: string;
  caseId: string;
  status: JuryPackageStatus;
  createdAt: string;
  finalizedAt?: string;
  finalizedBy?: string;
  // Added Phase 7.1 (F23): assigned ONLY at finalization
  // (MAX(version) for this case's FINALIZED packages, + 1, or 1 if none
  // exist); never reassigned afterward; null while DRAFT.
  version: number | null;
}

// Added Phase 7.1 (F23).
interface JuryPackageVersionSummary {
  id: string;
  version: number | null;
  status: JuryPackageStatus;
  finalizedAt?: string;
  finalizedBy?: string;
  exhibitCount: number;
  isMostRecent: boolean; // computed at read time (MAX(version) per case), never stored
}

interface JuryPackageExhibit {
  exhibitId: string;
  exhibitLabel: string;
  currentStatus: ExhibitStatus;
  discrepancyStatus: JuryExhibitDiscrepancyStatus;
  addedAt: string;
  // Added Phase 7 (F13) — defaults to INCLUDED for rows predating this
  // migration; see 02-data-model.md §3.9. GET /api/cases/:id/jury-package's
  // default response includes only status === 'INCLUDED' rows.
  status: JuryPackageExhibitStatus;
  excludedAt?: string;
  excludedBy?: string;
  exclusionReason?: 'SEALED_EXPARTE' | 'MANUAL_REMOVAL';
}

interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

// Added Phase 7 (F12) — the ADMISSION_BLOCKED error shape, returned only
// when a status-transition request attempts toStatus = ADMITTED and at
// least one blocking condition applies. See 04-security.md and
// 06-integrations.md §Admission Gate.
interface AdmissionBlockedError {
  error: {
    code: 'ADMISSION_BLOCKED';
    message: string;
    reasons: Array<{
      code: 'UNRESOLVED_OBJECTION' | 'NO_CUSTODIAN';
      message: string;
    }>;
  };
}

// Added Phase 7.1 (F18) — returned only when a status-transition request is
// the exhibit's first-ever STATUS_CHANGE event (toStatus = MARKED) with a
// missing or invalid custodianUserId. See 04-security.md §5.2.2a and
// 06-integrations.md §Intake Custody Gate.
interface CustodianRequiredAtIntakeError {
  error: {
    code: 'CUSTODIAN_REQUIRED_AT_INTAKE';
    message: string;
  };
}

// Added Phase 7.1 (F20) — the uniform shape for every write action's
// server-side role rejection. Message varies per action per the Permission
// Matrix (04-security.md §5.2.2a); the code is always ROLE_NOT_PERMITTED.
interface RoleNotPermittedError {
  error: {
    code: 'ROLE_NOT_PERMITTED';
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

### 4.1a Cases (F0, F22 — added Phase 7.1)

| Method & Path | Description | Request Body / Query | Response | Errors |
|---|---|---|---|---|
| `GET /api/cases` *(added Phase 7.1, F22)* | Lists every case available to the current user | — | `200 Case[]` | — (no role restriction; case existence is not the sensitive boundary) |
| `GET /api/cases/:id` *(amended Phase 7.1, F22: replaces the prior no-argument `GET /api/case`)* | Fetches a specific case plus its user roster (app bootstrap) | — | `200 { case: Case, users: User[] }` (identical shape to the prior `GET /api/case` response) | `CASE_NOT_FOUND` 404 |

**Active-case model (F22):** the "active case" is a per-request, client-selected `caseId` — never a server-side session value — carried on every subsequent case-scoped request exactly as `requestingUserRole` already is. `services/cases.ts#getActiveCaseWithUsers` evolves from a no-argument, implicit-`DEMO_CASE_NUMBER` form to an explicit `getActiveCaseWithUsers(caseId)` (see `01-components.md` §2.2). On first load with no previously-selected `caseId`, the client defaults to the first case by `createdAt` ascending — preserving the prior single-case demo script's zero-interaction behavior.

### 4.2 Exhibits & History (F0, F9, F10)

| Method & Path | Description | Request Body / Query | Response | Errors |
|---|---|---|---|---|
| `POST /api/exhibits` | Create exhibit identity record | `{ caseId, exhibitLabel, description, source?, offeringParty, associatedWitness?, classification }` *(amended Phase 7.1, F16: `classification` is now required — `TRIAL` \| `CHAMBERS_EX_PARTE` \| `SEALED`; a client-supplied `isSealed` value, if present, is ignored — the server always derives it from `classification`)* | `201 Exhibit` (now includes `classification` and a classification-derived `isSealed`) | `EXHIBIT_LABEL_CONFLICT` 409, `VALIDATION_ERROR` 422, `CLASSIFICATION_REQUIRED` 422 *(added Phase 7.1, F16)*, `INVALID_CLASSIFICATION` 422 *(added Phase 7.1, F16)*, `ROLE_NOT_PERMITTED` 403 *(added Phase 7.1, F20: only `DEPUTY`, `CLERK`, `ADMIN`)* |
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
| `POST /api/exhibits/:id/events/status` | Record a status transition | `{ toStatus: ExhibitStatus, actorUserId, notes?, custodianUserId? }` *(amended Phase 7.1, F18: `custodianUserId` is required when, and only when, this is the exhibit's first-ever `STATUS_CHANGE` event, i.e. `toStatus = MARKED` with zero prior events — the status write and the resulting intake custody write are atomic, same transaction)* | `201 { event: ExhibitEvent, currentState: ExhibitCurrentState, custodyState?: CustodyCurrentState }` *(amended Phase 7.1, F18: `custodyState` is additionally returned when this call was the exhibit's first-ever transition)* | `INVALID_STATUS_TRANSITION` 422, `STATUS_FINALIZED` 409, `STATUS_CONFLICT` 409, `EXHIBIT_NOT_FOUND` 404, `ADMISSION_BLOCKED` 422 *(added Phase 7, F12 — returned as `AdmissionBlockedError` above; evaluated only when `toStatus = ADMITTED`, before any ledger write; hardened without new mechanism by Phase 7.1's F17 — see `06-integrations.md` §Admission Gate)*, `CUSTODIAN_REQUIRED_AT_INTAKE` 422 *(added Phase 7.1, F18 — returned as `CustodianRequiredAtIntakeError` above)*, `ROLE_NOT_PERMITTED` 403 *(added Phase 7.1, F20: `DEPUTY`, `CLERK`, `ADMIN` for every transition)* |
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
| `POST /api/exhibits/:id/events/objection` | Raise an objection | `{ objectingParty, grounds, actorUserId }` | `201 { event: ExhibitEvent, objectionState: ObjectionCurrentState }` | `INVALID_OBJECTION_TARGET` 422, `EXHIBIT_NOT_FOUND` 404, `ROLE_NOT_PERMITTED` 403 *(added Phase 7.1, F20: `ATTORNEY`, `DEPUTY`, `CLERK`, `ADMIN` — the one write action an `ATTORNEY` role is permitted to perform)* |
| `POST /api/objections/:id/ruling` | Record a ruling against an objection thread | `{ disposition: RulingDisposition, actorUserId }` | `201 { event: ExhibitEvent, objectionState: ObjectionCurrentState }` | `OBJECTION_NOT_FOUND` 404, `OBJECTION_ALREADY_RESOLVED` 409, `ROLE_NOT_PERMITTED` 403 (SUSTAINED/OVERRULED requires `JUDGE` role — unchanged by F20, now enforced via the shared `assertRole` helper) |
| `GET /api/cases/:id/objections?status=unresolved` | List objection threads, filterable | Query: `status?` | `200 Array<ObjectionCurrentState & { exhibitLabel: string }>` *(amended Phase 7.1, F21: additive read-time join of `exhibitLabel` — no schema change; powers the new judge-facing Pending-Ruling Queue screen's client-side sort by elapsed `raisedAt`, no new endpoint)* | `CASE_NOT_FOUND` 404 |

### 4.5 Custody (F3; significantly amended Phase 7.1, F19 — two-phase propose/confirm model)

| Method & Path | Description | Request Body | Response | Errors |
|---|---|---|---|---|
| `POST /api/exhibits/:id/events/custody` | Record a custody transfer. *(Amended Phase 7.1, F19: retained ONLY for the F18 intake-bootstrap case — `fromCustodianUserId: null`. Any call with a non-null `fromCustodianUserId` is rejected; use the propose/confirm endpoints below for every transfer after the first.)* | `{ fromCustodianUserId?, toCustodianUserId, reason?, actorUserId }` | `201 { event: ExhibitEvent, custodyState: CustodyCurrentState }` | `CUSTODY_CHAIN_BROKEN` 409, `INVALID_CUSTODIAN` 422, `NO_OP_TRANSFER` 422, `EXHIBIT_NOT_FOUND` 404, `CUSTODY_TRANSFER_REQUIRES_CONFIRMATION` 409 *(added Phase 7.1, F19: non-first transfer attempted via this unilateral path)* |
| `POST /api/exhibits/:id/events/custody/propose` *(added Phase 7.1, F19)* | Initiates a two-phase custody transfer — does **not** change current custody | `{ fromCustodianUserId, toCustodianUserId, reason?, actorUserId }` | `201 { event: ExhibitEvent, custodyState: CustodyCurrentState }` (`custodyState.pendingTransfer` now set; `currentCustodianUserId` unchanged) | `CUSTODY_CHAIN_BROKEN` 409, `INVALID_CUSTODIAN` 422, `NO_OP_TRANSFER` 422, `CUSTODY_TRANSFER_ALREADY_PENDING` 409, `ROLE_NOT_PERMITTED` 403 (`DEPUTY`, `CLERK`, `ADMIN`), `EXHIBIT_NOT_FOUND` 404 |
| `POST /api/exhibits/:id/events/custody/confirm` *(added Phase 7.1, F19)* | Completes a pending custody transfer — callable **only** by the named receiving custodian | `{ proposedEventId, actorUserId }` | `200 { event: ExhibitEvent, custodyState: CustodyCurrentState }` (`currentCustodianUserId` updated; `pendingTransfer` cleared to `null`) | `CUSTODY_CONFIRMATION_NOT_PENDING` 404, `CUSTODY_CONFIRM_WRONG_USER` 403 (identity match — independent of, and in addition to, the role check below), `ROLE_NOT_PERMITTED` 403 (`DEPUTY`, `CLERK`, `ADMIN`), `EXHIBIT_NOT_FOUND` 404 |
| `POST /api/exhibits/:id/events/custody/cancel` *(added Phase 7.1, F19)* | Cancels a pending custody transfer — current custody is unaffected (it never changed) | `{ proposedEventId, reason?, actorUserId }` | `200 { event: ExhibitEvent, custodyState: CustodyCurrentState }` (`pendingTransfer` cleared) | `CUSTODY_CONFIRMATION_NOT_PENDING` 404, `ROLE_NOT_PERMITTED` 403 (original proposer, or `DEPUTY`/`CLERK`/`ADMIN`), `EXHIBIT_NOT_FOUND` 404 |
| `GET /api/exhibits/:id/custodian` | Current custodian only | — | `200 CustodyCurrentState` *(amended Phase 7.1, F19: now additionally includes `pendingTransfer: { toUserId, proposedAt, eventId } \| null`, see §4.1)* | `EXHIBIT_NOT_FOUND` 404 |
| `GET /api/exhibits/:id/custody-history` | Full ordered chain-of-custody | — | `200 CustodyHistoryEntry[]` *(amended Phase 7.1, F19: now includes `CUSTODY_TRANSFER_PROPOSED`/`CONFIRMED`/`CANCELLED` events, distinguished by `eventType`, so a cancelled/superseded proposal remains visible in history)* | `EXHIBIT_NOT_FOUND` 404 |

```typescript
interface CustodyHistoryEntry {
  fromCustodian: string | null;
  toCustodian: string;
  timestamp: string;
  reason: string | null;
  eventId: string;
  eventType: EventType; // added Phase 7.1 (F19) — distinguishes PROPOSED/CONFIRMED/CANCELLED/legacy entries
}
```

**Two-phase model summary (F19):** a proposal (`propose`) never changes `currentCustodianUserId` — only the named receiver's own `confirm` call does. A `cancel` reverts a pending state with no effect on current custody, since it was never changed in the first place. There is no time-based auto-expiry of a pending transfer (consistent with this architecture's queue-free, synchronous-only write model, `06-integrations.md`) — an indefinitely-pending transfer is resolved only by an explicit `confirm` or `cancel` call.

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
| `GET /api/cases/:id/jury-package` | Fetch current package with live discrepancy status | — | `200 { juryPackage: JuryPackage, exhibits: JuryPackageExhibit[] }` — `exhibits[]` includes only `status: 'INCLUDED'` rows by default *(amended Phase 7, F13: `EXCLUDED` rows are retained for audit but omitted from this default read)*. `juryPackage.version` is `null` while `DRAFT` *(added Phase 7.1, F23)* | `CASE_NOT_FOUND` 404 |
| `POST /api/jury-package/:id/finalize` | Attempt finalization — hard-gated, re-evaluated fresh | `{ actorUserId, acknowledgedDiscrepancyIds? }` | `200 { juryPackage: JuryPackage }` (status: `FINALIZED`, `version: number`) *(amended Phase 7.1, F23: `version` is now assigned atomically at finalization — never client-supplied)* | `JURY_PACKAGE_DISCREPANCIES_OPEN` 409 (includes blocking list), `JURY_PACKAGE_ALREADY_FINALIZED` 409, `ROLE_NOT_PERMITTED` 403 |

`actorUserId` must resolve to role `DEPUTY`, `CLERK`, or `ADMIN` to initiate or finalize. Finalization re-runs `evaluateDiscrepancies` fresh for every included exhibit — never trusting the cached `discrepancyStatus` captured at draft-computation time. Only `status: 'INCLUDED'` rows participate in finalization *(amended Phase 7, F13)* — an `EXCLUDED` row can never block or be counted toward it.

**Amended Phase 7 (F13); amended again Phase 7.1 (F16):** the candidate computation behind `POST /api/cases/:id/jury-package` originally filtered `exhibit.isSealed = false` at the query level, in addition to `currentStatus = 'ADMITTED'`. **As of Phase 7.1, this filter reads `exhibit.classification = 'TRIAL'` instead** — see `01-components.md` §2.2 and `02-data-model.md` §3.6/§3.10. This remains a behavior amendment to the existing endpoint, not a new route.

### 4.7b Jury Package Versions & Export (F23, added Phase 7.1)

| Method & Path | Description | Request / Response | Errors |
|---|---|---|---|
| `GET /api/cases/:id/jury-package/versions` | Lists every `JuryPackage` for the case — every `FINALIZED` version plus the current `DRAFT`, if one exists | `200 JuryPackageVersionSummary[]` (see §4.1) | `CASE_NOT_FOUND` 404 |
| `GET /api/jury-package/:id/export` | Generates and streams a PDF (via `@react-pdf/renderer`) of a specific `FINALIZED` package version's included exhibit set | Response: binary `application/pdf` stream, not JSON | `JURY_PACKAGE_EXPORT_NOT_FINALIZED` 422 (a `DRAFT` has no version to export — finalize first), `JURY_PACKAGE_VERSION_NOT_FOUND` 404, `PDF_GENERATION_FAILED` 500 |

Because a `FINALIZED` package's `JuryPackageExhibit` rows are immutable, re-exporting the same version at any later date always produces an identical PDF (same exhibit set, same classification/status snapshot) — the export is deterministic per version, not re-computed against the exhibits' *current* live state. `EXCLUDED` rows are never rendered into the export, exactly as they are never rendered into the live `INCLUDED` list (F13). See `01-components.md` §2.2 (`services/juryPackage.ts#exportJuryPackagePdf`) and `05-tech-stack.md` §6.4 for the new `@react-pdf/renderer` dependency.

### 4.7a Jury Package Exclusion (F13, added Phase 7)

| Method & Path | Description | Request Body | Response | Errors |
|---|---|---|---|---|
| `POST /api/jury-package/:id/exhibits/:exhibitId/exclude` | Explicitly excludes an `INCLUDED` exhibit row from a `DRAFT` jury package (remediation action for sealed/ex-parte material predating the F13 filter, or any other manual-removal need); recorded as an auditable `JURY_PACKAGE_EXHIBIT_EXCLUDED` ledger event | `{ actorUserId, reason: 'SEALED_EXPARTE' \| 'MANUAL_REMOVAL', note? }` | `200 { event: ExhibitEvent, juryPackageExhibit: JuryPackageExhibit }` (status: `EXCLUDED`) | `JURY_PACKAGE_EXHIBIT_NOT_FOUND` 404, `JURY_PACKAGE_ALREADY_FINALIZED` 409, `ROLE_NOT_PERMITTED` 403 |

`actorUserId` must resolve to role `DEPUTY`, `CLERK`, or `ADMIN` — identical to the finalize role gate (`04-security.md` §5.2.2). Available only against a row currently `status: 'INCLUDED'` on a `DRAFT` package — a `FINALIZED` package's rows are immutable and cannot be excluded via this action.

### 4.8 Discrepancies (F6)

| Method & Path | Description | Request Body | Response | Errors |
|---|---|---|---|---|
| `GET /api/cases/:id/discrepancies` | All open/acknowledged flags case-wide | — | `200 DiscrepancyFlag[]` — flags with `status: 'ACKNOWLEDGED'` additionally include `justification` *(added Phase 7, F14 — see §4.1)* | `CASE_NOT_FOUND` 404 |
| `GET /api/exhibits/:id/discrepancies` | Flags for a single exhibit | — | `200 DiscrepancyFlag[]` — same `justification` addition as above *(F14)* | `EXHIBIT_NOT_FOUND` 404 |
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
| `POST /api/assistant/chat` | Streaming tool-calling chat (Vercel AI SDK `streamText`) | `{ caseId, userId, message, conversationId? }` *(`caseId` as of Phase 7.1, F22, is sourced from the client's explicit Case Selector state, not an implicit single-case constant — the field itself is unchanged, only its origin)* | Streamed text (SSE/chunked) + final structured payload incl. `citations[]` | `TOOL_ARGS_INVALID` (tool-level, surfaced to model), `ASSISTANT_UNAVAILABLE` 503 |
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

Each tool in `AssistantToolSet` is implemented against the exact same service-layer function backing the corresponding REST route above — e.g., `getExhibitStatus` the tool and `GET /api/exhibits/:id/status` the route both call `services/status.ts#getExhibitStatus(exhibitId)`. This 1:1 mapping is what structurally guarantees cross-screen/assistant consistency rather than relying on manual testing alone. Because of this mapping, the Phase 7 amendments above propagate automatically: `getJuryPackageStatus` never returns an `EXCLUDED` row as included/eligible (F13), and `getDiscrepancies` surfaces `justification` on `ACKNOWLEDGED` flags identically to the UI (F14) — no tool definition changed.

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
  // Amended Phase 7.1 (F22): caseId is now an explicit, client-selected
  // value carried per-request (Case Selector state) — no longer an
  // effectively-constant single-case assumption. The server remains
  // stateless with respect to "which case is active."
  caseId: string;
  requestingUserRole: Role;  // from the client-side role switcher (zustand store)
  actorUserId?: string;      // required only on write endpoints; the acting user's seeded User.id
}
```

`requestingUserRole` governs **read visibility** (sealed/classification-based exclusion, F16); `actorUserId`'s resolved `Role` governs **write authorization**. **As of Phase 7.1 (F20), write authorization is no longer limited to the three actions historically gated ad hoc (ruling disposition, jury finalization, discrepancy acknowledgment)** — every write action in the system (exhibit creation, every status transition, raising an objection, proposing/confirming custody transfer, excluding a jury-package exhibit) is now gated by the single shared `assertRole` helper against the full Permission Matrix. Both the visibility check and every authorization check are enforced in `services/visibility.ts` / `services/authorization.ts` and the relevant domain service module — never re-implemented per route. **See `04-security.md` §5.2.2a for the full, current authorization model — this supersedes the narrower write-authorization table this section previously implied.**

## 5. Security Architecture

JudicialSync's security model is explicitly scoped for a **sales/demo environment**, not a production court system. Per PROJECT.md, production-grade authentication/authorization hardening was originally scoped entirely out — but role-based *visibility* and *write-authorization* were always first-class, enforced requirements because they are core to the demo's credibility with a legal audience (a judge seeing sealed sidebar material leaked to an attorney's screen would be a trust-ending failure during a sales demo, even without real cryptographic stakes).

> **SUPERSEDED, in part, by Phase 7.1 (F20):** the blanket "authentication/authorization hardening is out of scope" framing above is now narrowed to **authentication only**. Proving who a user is (OAuth/OIDC, session hardening, MFA) remains explicitly out of scope — see §5.1 and §5.5, unchanged. **Authorization — what a known, seeded role may do — is as of Phase 7.1 a fully enforced, in-scope capability covering every write action in the system**, not merely the three actions (ruling disposition, jury finalization, discrepancy acknowledgment) gated ad hoc prior to this phase. This history is preserved here, not deleted, because it documents *why* the earlier partial gating existed before being generalized. See §5.2.2a below for the current, canonical authorization model.

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

**Amended Phase 7.1 (F16):** `isSealed` — the boolean this table's enforcement reads — is now a **write-once mirror** of the new three-value `classification` enum (`TRIAL` / `CHAMBERS_EX_PARTE` / `SEALED`), set exactly once at exhibit creation as `isSealed = (classification !== 'TRIAL')` and never independently set thereafter. Because `isSealed` is classification-consistent by construction, this table and every enforcement call site below are **unaffected in behavior** — a `CHAMBERS_EX_PARTE` exhibit is already treated with the same visibility rigor as a `SEALED` one everywhere this boolean governs. No second visibility pass keyed on `classification` directly was required. See `01-components.md` §2.2 (`services/exhibits.ts`, `services/visibility.ts`) and `02-data-model.md` §3.10.

**Enforcement mechanics:**
- Sealed-exhibit exclusion is applied as a `WHERE` predicate inside every service-layer read function that returns exhibit rows (`getExhibits`, `searchExhibits`, `getExhibitHistory`, and transitively every assistant tool that wraps them) — never as a post-query filter in the API route or UI component.
- A direct-ID read of a sealed exhibit by an unauthorized role (`GET /api/exhibits/:id`, `GET /api/exhibits/:id/history`, or the assistant's equivalent tool call) returns **404 `EXHIBIT_NOT_FOUND`** — byte-identical in shape, message, and (as far as practical) timing to the genuine not-found case. This is a deliberate anti-enumeration measure: an unauthorized role must never be able to distinguish "doesn't exist" from "exists but you can't see it."
- The assistant's Decline Response ("I don't have that information") is the natural-language equivalent of this same 404-masking behavior — the system prompt instructs the model to never reveal that a sealed record exists, even indirectly (e.g., never say "I can't show you Exhibit 9 because it's sealed"; the correct response is identical to the no-such-exhibit case).

#### 5.2.2 Write Authorization (Action Gating) — Pre-Phase-7.1 Partial Table (SUPERSEDED, kept for history)

> **This table is superseded by the full Permission Matrix in §5.2.2a below.** It is retained, not deleted, because it accurately documents the system's authorization coverage *before* Phase 7.1 (F20): only three actions were role-gated server-side, each implemented as its own ad hoc check; every other write action (exhibit creation, every status transition, raising an objection, custody transfer) had no server-side role restriction at all beyond "any valid seeded user."

| Action | Required Role(s) | Enforcement Point |
|---|---|---|
| Record `SUSTAINED`/`OVERRULED` ruling | `JUDGE` | `services/objections.ts#recordRuling` |
| Finalize jury package | `DEPUTY`, `CLERK`, `ADMIN` | `services/juryPackage.ts#finalizeJuryPackage` |
| Initiate/compute jury package draft | `DEPUTY`, `CLERK`, `ADMIN` | `services/juryPackage.ts#computeJuryCandidates` |
| Acknowledge a discrepancy flag | `DEPUTY`, `CLERK`, `JUDGE`, `ADMIN` | `services/discrepancies.ts#acknowledgeDiscrepancy` |
| Exclude an exhibit from a jury package (remediation action) *(added Phase 7, F13)* | `DEPUTY`, `CLERK`, `ADMIN` — identical gate to finalize | `services/juryPackage.ts#excludeJuryPackageExhibit` |
| Record status change, objection, custody transfer | Any authenticated (seeded) user via `actorUserId` | **No role restriction** beyond being a valid active `users` row — this gap is exactly what §5.2.2a closes |

**Rule (unchanged, still authoritative):** `403 ROLE_NOT_PERMITTED` is reserved exclusively for write/action gating. It is **never** used to signal "this record exists but you can't see it" — that is always the 404-masking pattern above. Conflating the two would leak existence information through the HTTP status code itself.

#### 5.2.2a Full Server-Side Permission Matrix (Phase 7.1, F20) — Current, Canonical Authorization Model

**This is the single source of truth for which `Role` may perform which write action, system-wide, as of Phase 7.1.** It replaces the partial coverage in §5.2.2 above by extending server-side role enforcement — previously applied only to ruling disposition, jury finalization, and discrepancy acknowledgment — to **every** write action in the system.

**Role Resolution (the only trusted source of a user's role for authorization):** every gated action resolves `actorUserId`'s `role` column via a direct, server-side `User` table lookup — **never** from a client-supplied role claim in a request body, header, or client-side store. A request asserting a role the database does not confirm is simply ignored; the resolved database role is authoritative.

**`assertRole(actorUserId, allowedRoles, actionLabel)`** — the single shared service-layer helper (new module `services/authorization.ts`, see `01-components.md` §2.2) generalizing the pattern already used, prior to this phase, only by `recordRuling`'s ad hoc judge-check and jury-package's `assertJuryWriteRole`. Every action below calls this helper, or an action-specific wrapper around it, as the **first statement** in its handler — before any field-level validation, state-machine check, or ledger write — so a disallowed-role request is rejected before it can leak any information about the request's validity.

**Permission Matrix:**

| # | Action | JUDGE | CHAMBERS_STAFF | DEPUTY | CLERK | ATTORNEY | ADMIN | Status Before F20 |
|---|---|---|---|---|---|---|---|---|
| 1 | Create exhibit | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ | **New gate** |
| 2 | Mark / Offer / Withdraw status transition | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ | **New gate** |
| 3 | Admit / Exclude status transition | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ | **New gate** |
| 4 | Raise objection | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | **New gate** |
| 5 | Record ruling (SUSTAINED/OVERRULED/RESERVED) | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | Unchanged (F02) |
| 6 | Propose custody transfer | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ | **New gate** |
| 7 | Confirm custody transfer receipt | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ *(plus identity match — see §5.2.2b)* | **New gate** |
| 8 | Acknowledge discrepancy | ✓ | ✗ | ✓ | ✓ | ✗ | ✓ | Unchanged (F06) |
| 9 | Initiate / finalize jury package | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ | Unchanged (F05) |
| 10 | Exclude jury package exhibit | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ | Unchanged (F13) |

**Reading the matrix:**
- Rows 5, 8, 9, 10 are included for completeness — the matrix must be the complete, single documented reference — but their enforcement is **unchanged** by F20; they are retrofitted onto the shared `assertRole` helper for consistency, not newly gated.
- Rows 1–4, 6, and 7 are the **new** server-side gates this phase adds.
- `CHAMBERS_STAFF` has full read/visibility (§5.2.1) but **no write permission for any action in this matrix** — it is a strictly read-only role in this version.
- `ATTORNEY` is permitted exactly **one** write action (raise objection) and is otherwise read-only, matching the PRD's explicit "Attorneys: raise objections, read/view only — no write access outside objections."
- There is **no implicit "ADMIN can always do anything" override** beyond what this table explicitly lists — `ADMIN` is in fact excluded from row 5 (ruling disposition), which remains strictly `JUDGE`-only with no exception.
- A malformed request from a disallowed role is still rejected with `403 ROLE_NOT_PERMITTED` before field-level validation runs — no information about the request's validity is leaked to an unauthorized actor.

**New `ROLE_NOT_PERMITTED` message variants (rows 1–4, 6, 7 — net-new as of this phase):**

| Action | Message |
|---|---|
| Create exhibit | "Only a courtroom deputy, clerk, or admin may create an exhibit" |
| Mark/offer/withdraw/admit/exclude status transition | "Only a courtroom deputy, clerk, or admin may record this status transition" |
| Raise objection | "Only an attorney, courtroom deputy, clerk, or admin may raise an objection" |
| Propose custody transfer | "Only a courtroom deputy, clerk, or admin may propose a custody transfer" |
| Confirm custody transfer | "Only a courtroom deputy, clerk, or admin may confirm custody receipt" |

Rows 5, 8, 9, 10 retain their pre-existing, unchanged messages (see §5.2.2 above).

**UI consistency (non-binding recommendation, not a security control):** screens are updated so a control for an action the current role cannot perform is not rendered as an enabled, silently-failing control — consistent with F14's existing disclosure principle. **This is a UX recommendation only; the server-side gate above is authoritative regardless of what the UI renders**, since a client is never a trust boundary in this architecture.

**Assistant tools are unaffected:** none of the 8 assistant tools (`01-components.md` §2.3) perform a write in this version, so F20's matrix does not apply to any of them today. If a future write-capable tool is ever added, it must call the identical `assertRole` helper with the requesting user's resolved role — per the existing "no assistant admin override" principle (§5.4) — there is no separate, elevated authorization path for the assistant.

#### 5.2.2b Custody Confirmation — Role AND Identity, Two Independent Checks (Phase 7.1, F19 + F20)

Custody transfer confirmation (matrix row 7) is the one action in the system gated by **two independent checks that must both pass**, not one:

1. **Role check (F20):** `assertRole(actorUserId, ['DEPUTY','CLERK','ADMIN'], 'confirm custody receipt')` — is this actor's role generally permitted to confirm custody transfers at all?
2. **Identity check (F19, unchanged by F20):** does `actorUserId` exactly equal `CustodyCurrentState.pendingTransferToUserId` — i.e., is this actor the *specific, named* receiver of *this particular* pending proposal?

A `DEPUTY` who is role-permitted in general but is **not** the named receiver of the pending transfer is correctly rejected — but with `403 CUSTODY_CONFIRM_WRONG_USER` (F19's identity-match error), **not** `403 ROLE_NOT_PERMITTED` (F20's role error). The two error codes are deliberately distinct so a caller (or a test) can tell *which* of the two independent checks failed. Neither check can substitute for the other: a role-permitted, non-named user is rejected by check 2; a named-receiver user whose role is not in the allowed set (a hypothetical — in practice the named receiver of a custody transfer is always a `DEPUTY`/`CLERK`/`ADMIN` per who is eligible to hold custody) would be rejected by check 1.

#### 5.2.3 Admission Integrity Gate — Data Invariant, Not Role-Based (Added Phase 7, F12)

Unlike every control in §5.2.2, the Admission Gate inside `services/status.ts#recordStatusChange` is **not** a role/authorization check — it is a data-integrity precondition that applies identically regardless of the acting user's role. When `toStatus = ADMITTED`, the service layer rejects the request with `422 ADMISSION_BLOCKED` if an unresolved objection or a missing/null custodian is present for the exhibit, evaluated against the existing `ObjectionCurrentState`/`CustodyCurrentState` projections in the same transaction as the write.

| Property | Value |
|---|---|
| Who it applies to | Every caller — UI action, direct API client, seed loader. There is no "force admit" parameter, admin override, or elevated-role bypass. |
| What it returns | `422 ADMISSION_BLOCKED` with a `reasons[]` array (`UNRESOLVED_OBJECTION`, `NO_CUSTODIAN`) — never `403 ROLE_NOT_PERMITTED`, since this is not an authorization failure |
| Why it is not modeled as a role check | The condition being guarded against (an exhibit improperly admitted) is a fact about the exhibit's state, not a fact about who is acting — a `JUDGE` attempting the same transition is blocked exactly as a `DEPUTY` would be |
| Relationship to F6 | F6's `ADMITTED_NO_CUSTODIAN` / `UNRESOLVED_OBJECTION_JURY_ELIGIBLE` discrepancy rules remain unchanged and continue to cover conditions that arise *after* a valid admission (e.g., a custody transfer later breaking the chain) — they are no longer the sole backstop for the admission transition itself |

**Hardening note (Phase 7.1, F17 — documentation/test-only, no new mechanism):** F17 formally closed the theoretical question of whether an `OBJECTED → ADMITTED` transition could ever succeed without every objection thread having been ruled on. Having re-examined the gate above in full, **the answer is that this was already structurally impossible** — `ObjectionCurrentState.status` can leave `UNRESOLVED` only via a `RULING_RECORDED` ledger event (F02), and there is no non-ledger write path to that projection anywhere in the service layer. F17 therefore adds **zero new runtime code** to this gate: its entire contribution is (1) naming this as a formal, traceable invariant in the FRD/TechArch rather than leaving it an emergent property of two unrelated features, and (2) dedicated regression test coverage exercising the bypass attempt directly (rejected, unchanged `ADMISSION_BLOCKED`/`UNRESOLVED_OBJECTION` response) and confirming the legal direct `OFFERED → ADMITTED` path (zero objection threads) remains unaffected. If a future code change ever introduced a direct current-state mutation bypassing `recordEvent`, this regression suite — not this gate's current logic — is what would catch it.

**Interaction with F18 (Phase 7.1):** F18 moves the *custodian* requirement to intake (`services/status.ts#recordStatusChange`'s first-ever call, `(none) → MARKED`), established atomically in the same transaction as the status write. This is a distinct, earlier-lifecycle gate, documented in full at `06-integrations.md` §Intake Custody Gate — F12's admission-time custodian check above is **retained unchanged** as an independent, later backstop (a custody chain established at intake could in principle still break before admission via a future event), not replaced or weakened by F18.

See `01-components.md` §2.2 (`services/status.ts`) and `06-integrations.md` §Admission Gate / §Intake Custody Gate for the full process sequence.

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

> **Narrowed by Phase 7.1 (F20):** this list governed both authentication *and* authorization prior to Phase 7.1. **As of F20, it governs authentication only** — every item below that concerned *authorization* (what a known role may do) has been superseded by the full Permission Matrix in §5.2.2a and is retained here crossed through for history, not as current scope. Items concerning *authentication* (proving who a user is) remain fully out of scope, unchanged.

- Full OAuth/OIDC or SSO integration
- Password-based authentication, MFA, session hijacking protections
- Rate limiting / abuse prevention (acceptable for a controlled demo audience)
- ~~Server-side write-action authorization~~ — **SUPERSEDED by Phase 7.1 (F20):** see §5.2.2a. Every write action is now role-gated server-side against the full Permission Matrix.
- Multi-tenant data isolation across *cases* for a single deployment (as of Phase 7.1, F22, case-scoped query isolation — `WHERE caseId = :selectedCaseId` on every amended query — is implemented and enforced; this item now refers only to isolation across separate *deployments/tenants*, not across cases within one deployment)
- Formal penetration testing / security audit
- Encryption key management beyond provider defaults (Neon, Vercel, Anthropic)

Any future productionization of JudicialSync beyond its demo scope would require revisiting every remaining item in this section — this document deliberately does not pretend otherwise.

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
| Client state | zustand | 4.x/5.x | Lightweight client state for the role switcher, case selector (added Phase 7.1, F22), and chat-panel UI state |
| PDF generation | `@react-pdf/renderer` *(added Phase 7.1, F23)* | current | Server-side, pure-JS jury-package PDF export — no headless-browser binary; see §6.4 for the full fit rationale |
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
| `@react-pdf/renderer` *(added Phase 7.1, F23 — first new runtime dependency since initial stack lock-in)* | Server-side PDF generation for finalized jury package export (`services/juryPackage.ts#exportJuryPackagePdf`, `lib/pdf/JuryPackageDocument.tsx`). Selected because it generates PDFs from JSX/React-component definitions (`<Document>`/`<Page>`/`<View>`/`<Text>`) in pure JavaScript, with **no headless-browser binary** required — unlike a Puppeteer/Playwright-based HTML-to-PDF approach, which would require bundling and cold-starting a full Chromium binary per Vercel serverless invocation. Its component-based API also fits this React/Next.js codebase's idioms natively, rather than introducing an unrelated templating system. **Every other Phase 7.1 feature (F16–F22) introduces no new dependency** — this is flagged explicitly because it is the sole exception. |

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
| Jury package exhibit excluded *(added Phase 7)* | `recordEvent(JURY_PACKAGE_EXHIBIT_EXCLUDED)` | Updates `jury_package_exhibits.status` to `'EXCLUDED'`, setting `excluded_at`/`excluded_by`/`exclusion_reason` | F13 |
| Custody transfer proposed *(added Phase 7.1)* | `recordEvent(CUSTODY_TRANSFER_PROPOSED)` | Sets `custody_current_state.pending_transfer_to_user_id`/`pending_transfer_event_id`/`pending_transfer_proposed_at`; `current_custodian_user_id` is **NOT** modified | F19 |
| Custody transfer confirmed *(added Phase 7.1)* | `recordEvent(CUSTODY_TRANSFER_CONFIRMED)` | Updates `custody_current_state.current_custodian_user_id`/`since`/`last_event_id`; clears all three pending-transfer fields to null; re-evaluates `ADMITTED_NO_CUSTODIAN` | F19 → F6 |
| Custody transfer cancelled *(added Phase 7.1)* | `recordEvent(CUSTODY_TRANSFER_CANCELLED)` | Clears all three pending-transfer fields to null only; `current_custodian_user_id` unaffected | F19 |

All triggers execute **synchronously within the same service-layer call** that appends the ledger event — there is no async job queue or eventual-consistency window between a ledger write and its projection/discrepancy update. This is a hard architectural requirement, not a performance optimization: F5 §Process step 5 (re-evaluating discrepancies "fresh" at finalization time) is only trustworthy if the projection is guaranteed never to lag behind the ledger.

### 7.2a Admission Gate (F12, Added Phase 7 — Pre-Write Check, Not a Post-Write Trigger)

Unlike every trigger in §7.2, which runs *after* a ledger event is appended, F12's two admission-integrity checks (unresolved objection present; no custodian of record) run **before** the `STATUS_CHANGE` event for a `toStatus = ADMITTED` transition is ever appended. If either check fails, `services/status.ts#recordStatusChange` rejects the request with `422 ADMISSION_BLOCKED` and **no `ExhibitEvent` row is created** — this is a hard precondition gate inside the same service function used by every caller (UI, API, seed loader), not a downstream reaction to a write that already happened. It reads the existing `objection_current_state`/`custody_current_state` projections only; it introduces no new table and no new trigger wiring. See `01-components.md` §2.2 and `04-security.md` §5.2.3 for the full treatment.

**Phase 7.1's F17 adds no new gate here** — it formalizes, and adds regression test coverage for, the already-sufficient guarantee this gate provides (`04-security.md` §5.2.3 Hardening note).

### 7.2b Intake Custody Gate (F18, Added Phase 7.1 — Pre-Write Check, Same Transaction as MARKED)

Analogous in spirit to §7.2a's Admission Gate but earlier in the lifecycle. The exhibit's first-ever `STATUS_CHANGE` event (`(none) → MARKED`) now requires a non-null `custodianUserId`, validated and appended **in the same database transaction** as the status event itself — not a downstream trigger reacting to the status write, and not a separate manual step a caller could skip or forget.

| Property | Value |
|---|---|
| When it runs | Only when the `STATUS_CHANGE` event being recorded is the exhibit's first-ever one (`toStatus = MARKED`, zero prior events) — every subsequent transition is unaffected |
| What it validates | `custodianUserId` is present and references an existing, active `User` (reuses F03's existing `INVALID_CUSTODIAN` check) |
| What it writes, atomically | (a) the `STATUS_CHANGE` event (`fromStatus: null, toStatus: 'MARKED'`), (b) a `CUSTODY_TRANSFER_CONFIRMED` event (`fromCustodianUserId: null`) establishing the first custody link directly — **no preceding `CUSTODY_TRANSFER_PROPOSED` event**, per F19's documented single-phase bootstrap exception — and (c) both `ExhibitCurrentState` and `CustodyCurrentState` together |
| What happens on failure | The entire transaction rolls back — there is no intermediate, even transient, state where an exhibit is `MARKED` with no `CustodyCurrentState` row |
| Relationship to F12's Admission Gate | Independent and additive, not a replacement — F12's later admission-time custodian check (§7.2a) is retained unchanged as a second backstop, since a custody chain established at intake could in principle still break before admission |

See `F18-custodian-required-at-intake.md` and `01-components.md` §2.2 (`services/status.ts#recordStatusChange`) for the full process sequence.

### 7.2c Server-Side Role Resolution (F20, Added Phase 7.1 — Pre-Write Check on Every Gated Action)

Every write action listed in `04-security.md` §5.2.2a's Permission Matrix now runs a role-resolution check (`services/authorization.ts#assertRole(actorUserId, allowedRoles, actionLabel)`) before any other validation or write — resolving the acting user's role from the `User.role` database column via `actorUserId`, never from a client-supplied role claim. This generalizes the pattern already used, prior to Phase 7.1, only by `recordRuling`'s judge-check and `assertJuryWriteRole`. If the resolved role is not permitted, the request is rejected with `403 ROLE_NOT_PERMITTED` before any field-level validation, state-machine check, or ledger write occurs. See `04-security.md` §5.2.2a for the full matrix.

### 7.2d Case Scoping (F22, Added Phase 7.1 — Explicit, Stateless, Per-Request)

Prior to this feature, every service-layer query implicitly scoped to a single case via a `DEMO_CASE_NUMBER` constant. As of F22, `caseId` is carried explicitly on every request — identically to how `requestingUserRole` is already carried per-request rather than server-side-session-stored. The server remains stateless with respect to "which case is active": there is no server-side "current case" session value, only a client-selected `caseId` passed with each call. This requires no new integration mechanism — it is the same per-request-parameter pattern already in use for role, now extended to case. See `01-components.md` §2.2 (`services/cases.ts`) and `03-api.md` §4.1a.

### 7.3 Live Multi-Screen Sync

| Mechanism | Pattern | Applies To |
|---|---|---|
| Polling (`@tanstack/react-query`) | Client refetch every 3–5 seconds, plus refetch-on-window-focus | Command Center (F8), Case Workspace (F9), Exhibit Detail (F10), Jury Package Workspace (F11, while `DRAFT` — polling stops once `FINALIZED` since content becomes immutable), Pending-Ruling Queue (F21, added Phase 7.1 — reuses the existing `useUnresolvedObjections` hook unchanged; no new hook, no new polling interval) |
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
| `@react-pdf/renderer` *(added Phase 7.1, F23 — new dependency)* | Server-side PDF generation for finalized jury package export | Pure-JS, component-based (`<Document>`/`<Page>`/`<View>`/`<Text>`) PDF generation with no headless-Chromium binary required — selected specifically because this system runs on Vercel serverless functions, where a Puppeteer/Playwright-style HTML-to-PDF approach would require bundling and cold-starting a full browser binary per invocation. This is the **first new runtime dependency** added since the original tech-stack lock-in; F16–F22 introduce no new dependencies. See `05-tech-stack.md` §6.1/§6.4. |

No message queues, caches, or background job runners are part of this architecture — all writes are synchronous request/response cycles, which is appropriate and sufficient for single-case demo scale (`.planning/research/ARCHITECTURE.md` §Scaling Considerations). **As of Phase 7.1 (F22), "single-case" no longer describes the data model** (see §7.2d above) — but the synchronous, queue-free write model itself is unaffected: multi-case support adds a query-scoping dimension, not a new write pathway or async mechanism. F19's custody-handoff "no-confirm" path (indefinite pending, no auto-expiry) is deliberately consistent with this same queue-free constraint — an explicit, synchronous cancel is the only resolution path, not a background expiry job. Should JudicialSync ever move beyond a demo (out of current scope), this is the first section to revisit: real CMS/DEMS integration points and async discrepancy re-evaluation at larger scale would need fresh design work, not incremental extension of the patterns documented here.
