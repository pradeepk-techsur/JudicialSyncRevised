# Roadmap: JudicialSync-Demo

## Overview

JudicialSync-Demo proves that Pivota can be the operational memory of a courtroom: any authorized user asks a natural-language question about an exhibit and gets an immediate, cited answer. Every other feature — dashboards, discrepancy detection, the assistant — reads through one event-sourced data model and one shared service layer, so the build proceeds foundation-first. Phase 1 locks in the append-only ledger (status, objections/rulings, custody) and loads deterministic seed data with deliberate edge cases. Phase 2 builds the browse/search/history screens that prove the service layer out visually. Phase 3 adds the two cross-domain differentiators that depend on all three data domains existing (jury package + discrepancy detection). Phase 4 layers the Pivota Assistant on top as a thin tool-calling client of the same service layer — deliberately last among functional phases despite being the headline feature, since there is nothing to cite until the data model is real. Phase 5 adds the ambient Trial Command Center and tunes live cross-screen sync last, against a working system.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Data Foundation** - Event-sourced ledger + status/objection/custody tracking, with deterministic seed data containing the required discrepancy edge cases (completed 2026-10-07)
- [x] **Phase 2: Core Screens** - Case Workspace (browse/search) and Exhibit Detail View (full history), reading the Phase 1 service layer (completed 2026-10-07)
- [x] **Phase 3: Jury Package + Discrepancy Detection** - Automated cross-domain discrepancy flags gating jury package finalization, surfaced on the Jury Package Workspace (completed 2026-10-07)
- [x] **Phase 4: Pivota Assistant** - Tool-calling NL assistant answering courtroom questions with citations, role-scoped, cite-or-decline (completed 2026-10-07)
- [ ] **Phase 5: Trial Command Center + Live Sync** - Ambient live-trial-glance screen and tuned polling-based sync across all screens

## Phase Details

### Phase 1: Data Foundation
**Goal**: The system records every exhibit's identity and every status/objection/ruling/custody change as immutable, replayable ledger events — with deterministic seed data loaded through that same path — producing a demo-ready case containing the specific discrepancy edge cases the later differentiator features depend on.
**Status**: Complete (2026-10-07)
**Depends on**: Nothing (first phase)
**Requirements**: F0, F0a, F1, F2, F3
**Success Criteria** (what must be TRUE):
  1. Every exhibit's current status, custody, and objection state can be retrieved and always reflects the most recently recorded event — recording a new event and re-querying immediately shows the update, with no stale or cached value.
  2. The full chronological history of status changes, objections, rulings, and custody transfers for any exhibit can be reconstructed by replaying its ledger events in order.
  3. An invalid action is rejected rather than silently applied: an out-of-order status transition, a ruling disposition recorded by a non-judge, and a custody transfer recorded from the wrong current holder are each refused.
  4. Running the seed loader — including re-running it from a clean state — deterministically produces the same complete demo case, containing at least one unresolved objection, one custody gap, and one jury-package-eligible discrepancy, with zero manual data entry.
  5. Rebuilding the current-state projections from scratch by replaying the ledger produces results identical to the live projections, confirming projections are purely derived, never independently-editable state.
**Plans**: 7 plans (5 waves)

Plans:
- [ ] 01-01-PLAN.md — Scaffold Next.js 16 project, lock in the Prisma event-ledger schema, stand up Docker Compose dev stack (Postgres + app)
- [ ] 01-02-PLAN.md — recordEvent (sole ledger writer) + exhibit identity service + API routes + context-boot test
- [ ] 01-03-PLAN.md — Status admission-lifecycle state machine (F1) + API routes
- [ ] 01-04-PLAN.md — Objection/ruling thread tracking with judge-only enforcement (F2) + API routes
- [ ] 01-05-PLAN.md — Chain-of-custody tracking with wrong-holder rejection (F3) + API routes
- [ ] 01-06-PLAN.md — Deterministic seed loader with planted edge cases (F0a), wired into Docker boot sequence
- [ ] 01-07-PLAN.md — Full history reconstruction + projection rebuild verification against seeded data

### Phase 2: Core Screens
**Goal**: Any courtroom user can browse the full case exhibit list, search/filter it by multiple combinable criteria, and drill into any single exhibit's complete chronological history — through two screens that read the exact same service layer validated in Phase 1, with no screen-local derivation that could diverge from it.
**Status**: Complete (2026-10-07)
**Depends on**: Phase 1
**Requirements**: F4, F9, F10
**Success Criteria** (what must be TRUE):
  1. A user can view the full case-level exhibit list on the Case Workspace, showing each exhibit's current status, offering party, and associated witness.
  2. A user can search/filter the exhibit list by ID, description, status, witness, or date, with multiple criteria combining (AND semantics) — non-matching exhibits are excluded from the results.
  3. A user can drill from the Case Workspace into any exhibit's Exhibit Detail View and see its complete chronological timeline (status changes, objections, rulings, custody transfers) reconstructed from the ledger.
  4. The status and custody values shown on the Case Workspace and Exhibit Detail View always match what Phase 1's service layer reports for the same exhibit, in spot-check comparison — no screen computes or caches its own version.
**Plans**: 7 plans (3 waves)

Plans:
- [ ] 02-01-PLAN.md — Tailwind CSS v4 + shadcn/ui, @tanstack/react-query + zustand, Playwright harness (pure tooling, no UI yet)
- [ ] 02-02-PLAN.md — Role-based sealed-exhibit visibility service (`visibility.ts`), wired into `getExhibit`/`getExhibitHistory` and their routes
- [ ] 02-03-PLAN.md — Seed loader sealed-exhibit edge case + `GET /api/case` active-case/persona-roster bootstrap endpoint
- [ ] 02-04-PLAN.md — `ExhibitListRow` shape, `getExhibits` upgrade, and new `searchExhibits` + `/search` route (F4)
- [ ] 02-05-PLAN.md — App shell (header/role-switcher/sidebar), shared `StatusBadge`, zustand role store + `apiFetch` wrapper
- [ ] 02-06-PLAN.md — Case Workspace screen: exhibit list table + combinable search/filter bar + live polling (F9/F4 UI)
- [ ] 02-07-PLAN.md — Exhibit Detail View screen: header + full chronological timeline + sealed/missing parity (F10 UI)

### Phase 3: Jury Package + Discrepancy Detection
**Goal**: The system automatically flags operational risks the moment they occur — an admitted exhibit with no recorded custodian, or an admitted exhibit with a still-unresolved objection — and a deputy/clerk/admin can build a jury package that structurally cannot be finalized while an open discrepancy remains on any included exhibit.
**Status**: Complete (2026-10-07)
**Depends on**: Phase 2
**Requirements**: F5, F6, F11
**Success Criteria** (what must be TRUE):
  1. When an exhibit's state changes into a condition a discrepancy rule covers (e.g., becomes admitted with no custodian on record, or is admitted while an objection thread is still unresolved), a corresponding discrepancy flag appears automatically — without anyone touching the jury package process to trigger that check.
  2. A deputy/clerk/admin can initiate a jury package draft and see the computed admitted-exhibit list on the Jury Package Workspace, each exhibit annotated with its live (freshly-evaluated, not stale) discrepancy status.
  3. Attempting to finalize a jury package while any included exhibit has an open discrepancy is rejected, with the blocking exhibit(s) named in the response — finalization only succeeds once every included exhibit's discrepancies are resolved or explicitly acknowledged.
  4. A deputy/clerk/judge/admin can explicitly acknowledge an open discrepancy with a required justification, and that acknowledgment is itself recorded as an auditable, visible event — never a silent dismissal.
  5. Opening the Jury Package Workspace before any deputy/clerk/admin has initiated a package shows an explicit "no package started yet" state — viewing it never silently creates a draft as a side effect.
**Plans**: 4 plans
- [ ] 03-01-PLAN.md — Schema (DiscrepancyFlag/JuryPackage/JuryPackageExhibit) + discrepancy rule engine wired synchronously into status/ruling/custody writes (F6 foundation)
- [ ] 03-02-PLAN.md — Discrepancy routes + jury-package service (read-only GET, fresh-gated finalize) + jury routes (F5)
- [ ] 03-03-PLAN.md — Widen ExhibitListRow, Case Workspace discrepancy badges, seed-fires-both-rules integrity assertion (F6 surfacing)
- [ ] 03-04-PLAN.md — Jury Package Workspace screen (empty/draft/finalized, hard-disabled gate, inline acknowledge, export/print) + sidebar count badge + Exhibit Detail ack banner (F11)

### Phase 4: Pivota Assistant
**Goal**: Any authorized courtroom user can ask a natural-language question about an exhibit's status, custody, rulings, or jury eligibility during live proceedings and receive an immediate, cited answer grounded in the same data the dashboards show — or an explicit decline — and is never given a fabricated claim.
**Status**: Complete (2026-10-07)
**Depends on**: Phase 3
**Requirements**: F7
**Success Criteria** (what must be TRUE):
  1. A user can ask each of the five named example questions ("what exhibits were admitted yesterday," "what objections remain unresolved," "is Exhibit 14 in the jury package," "who currently has custody of Exhibit 7," "what happened to Exhibit 14") and receive a correct, streamed answer.
  2. Every factual claim in an assistant answer carries a visible citation (record type + ID + timestamp) traceable to a specific ledger/projection record — the identical record the relevant dashboard would show for that fact.
  3. When asked about a question with no supporting record (a nonexistent exhibit, or a fact outside the user's role visibility), the assistant explicitly declines ("I don't have that information") rather than guessing or inferring.
  4. A user in a role without sealed-exhibit visibility (DEPUTY, CLERK, ATTORNEY) never receives an answer or citation referencing a sealed exhibit, even when asked about it by name or ID — the response is indistinguishable from "no such exhibit."
   5. If the LLM provider is unreachable or times out, the user sees an explicit, visually distinct "assistant temporarily unavailable" message (never rendered as a Decline Response) with their typed question preserved, while every other screen remains fully usable for manual lookup.
**Plans**: 6 plans
- [ ] 04-01-PLAN.md — Foundations: AI SDK + Anthropic deps, assistant schema (3 tables + MessageRole), config constant (temp 0, server-side key), ASSISTANT_UNAVAILABLE/TOOL_ARGS_INVALID error codes
- [ ] 04-02-PLAN.md — Tool layer: 8 1:1 service pass-through tools (role-scoped sealed seam) + cite-or-decline system prompt
- [ ] 04-03-PLAN.md — POST /api/assistant/chat (streamText temp 0, missing-key→503, error-vs-decline, citation persistence) + GET conversations/:id + release-blocker tests
- [ ] 04-04-PLAN.md — Client session: assistantStore (panel + active conversation), role-switch-new-conversation, useAssistantChat (useChat tagging + three-outcome classification)
- [ ] 04-05-PLAN.md — UI: slide-over panel + /assistant page, example chips, three outcomes, citation pills + Timeline ?event= deep-link, Ask ✦/sidebar activation, Playwright E2E
- [ ] 04-06-PLAN.md — Gap closure (UAT test 7, major): gate onFinish's citation extraction on whether the model's final text is a textual Decline, so a decline paired with a tool call that returned rows (e.g. searchExhibits) always persists/streams citations: []

### Phase 5: Trial Command Center + Live Sync
**Goal**: A judge or deputy can glance at one ambient screen at any point during live proceedings and immediately see the trial's current state — with zero configuration — and that screen, along with every other open screen, reflects new activity within the demo's live-sync window without a manual refresh.
**Status**: Passed
**Depends on**: Phase 4
**Requirements**: F8
**Success Criteria** (what must be TRUE):
  1. A user can open the Trial Command Center with no setup or configuration step and immediately see recent status changes, currently-unresolved objections, and outstanding discrepancies for the active trial.
  2. When a new event (status change, objection, ruling, custody transfer) is recorded from one browser tab, the Trial Command Center and any other open screen reflect it within one polling interval, with no manual page refresh required.
  3. The Trial Command Center exposes no path to record, edit, or acknowledge anything from that screen — it is strictly passive/read-only monitoring.
**Plans**: 3 plans (3 waves)

Plans:
- [ ] 05-01-PLAN.md — Recent Activity backend: export summarizeEvent, getRecentActivity service (role-scoped, latest-event-day window, since-validation) + GET /api/cases/:id/activity + COMMAND_CENTER_LOAD_FAILED + role-scoped getUnresolvedObjections (F8 backend)
- [ ] 05-02-PLAN.md — Live-sync tuning: refetchOnWindowFocus enabled globally + three independent 4s polling hooks (useRecentActivity/useUnresolvedObjections/useDiscrepancies) + useFreshness primitive
- [ ] 05-03-PLAN.md — Command Center screen: three ambient read-only panels + freshness indicator + fade-in, sidebar activation (first/default), / → /command-center redirect, sealed-safe panels, Playwright E2E (read-only, sealed absence, multi-tab live update, error isolation)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Data Foundation | 0/TBD | Complete | 2026-10-07 |
| 2. Core Screens | 0/TBD | Complete | 2026-10-07 |
| 3. Jury Package + Discrepancy Detection | 0/TBD | Complete | 2026-10-07 |
| 4. Pivota Assistant | 5/5 | Complete | 2026-10-07 |
| 5. Trial Command Center + Live Sync | 3/3 | Passed | - |