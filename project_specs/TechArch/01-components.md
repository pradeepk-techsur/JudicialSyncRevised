
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
