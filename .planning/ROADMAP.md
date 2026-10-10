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
- [x] **Phase 5: Trial Command Center + Live Sync** - Ambient live-trial-glance screen and tuned polling-based sync across all screens (completed 2026-10-08)
- [x] **Phase 6: Carbon Design System UI Upgrade** - Replace the Tailwind/shadcn visual foundation and every screen's components with IBM Carbon Design System, across all 5 shipped phases (completed 2026-10-08)
- [x] **Phase 7: Fix admission integrity and UI usability issues** - Close the ex-parte-into-jury-package gap, block admission over open objections/missing custody, and fix Case Workspace/assistant/header/activity-feed usability issues (completed 2026-10-09)
- [ ] **Phase 7.1: Exhibit classification, state-machine hardening, custody handoff, server-side RBAC, and jury-package versioning/export** (INSERTED) - Chambers/sealed classification enforced at intake, full state-machine + server-side role enforcement, custody handoff confirmation, pending-ruling queue, multi-case support, and versioned jury packages with PDF export
- [x] **Phase 8: UI Redesign and Write-Action Coverage** - Replace the Carbon-light visual foundation with the reviewed dark-dashboard design across Command Center, Case Workspace, Exhibit Detail, and Jury Package, and build the two write actions (record ruling, transfer/assign custody) the product has never had a UI for (completed 2026-10-10)
- [ ] **Phase 9: UI tickets and typography standard** - 16 prioritized UI/UX tickets (Command Center redesign, severity/status color system, activity feed rework, discrepancy actions, filters, navigation, role-switcher safeguards, jury-package guidance, assistant rework) plus a typography/font-loading standardization pass

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
**Status**: Complete (2026-10-08)
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

### Phase 6: Carbon Design System UI Upgrade

**Goal:** Every screen across all 5 shipped phases (Command Center, Case Workspace, Exhibit Detail, Jury Package, Pivota Assistant) renders on IBM Carbon Design System components and tokens instead of Tailwind/shadcn, with zero change to underlying functionality, data behavior, API routes, or the existing 36-test Playwright suite's asserted behaviors.
**Status**: Complete (2026-10-08)
**Requirements**: Y4 (cross-cutting, tracked in RTM.md — no F-numbered requirement; this phase migrates rendering/styling only)
**Depends on:** Phase 5
**Plans:** 9 plans (4 waves)

Plans:
- [ ] 06-01-PLAN.md — Carbon dependencies + Sass build pipeline (globals.scss, preserved print CSS, next.config.ts) — wave 1 foundation
- [ ] 06-02-PLAN.md — Shared StatusBadge/DiscrepancyBadge/AcknowledgeInline → Carbon Tag/TextArea/Button — wave 2
- [ ] 06-03-PLAN.md — App shell (Header/Sidebar/JuryPackageNavItem) → Carbon UI Shell + native Select role switcher — wave 2
- [ ] 06-04-PLAN.md — Case Workspace (ExhibitTable/SearchFilterBar) → Carbon Table/Search/Dropdown/DismissibleTag — wave 3
- [ ] 06-05-PLAN.md — Exhibit Detail (Header/Timeline/DiscrepancyBanner/NotFound) → Carbon Tile + semantic timeline — wave 3
- [ ] 06-06-PLAN.md — Jury Package (Draft/Empty/Finalized) → Carbon Table/Button(native-disabled)/InlineNotification — wave 3
- [ ] 06-07-PLAN.md — Command Center (3 panels + freshness) → Carbon Tile/SkeletonText/InlineNotification/Tag — wave 2
- [ ] 06-08-PLAN.md — Pivota Assistant (panel/thread/bubbles/citations) → Carbon Tag/TextInput/InlineNotification/Loading — wave 2
- [ ] 06-09-PLAN.md — Cleanup: remove Tailwind/shadcn/lucide-react/cn/@base-ui/react, full build+test+Playwright regression gate — wave 4

### Phase 7: Fix admission integrity and UI usability issues

**Goal:** An exhibit can never be recorded as ADMITTED while it still has an unresolved objection or no custodian of record (checked as a hard pre-write gate, not a post-hoc flag); a sealed/ex-parte exhibit can never appear in or be exported as part of a jury package, and any legacy occurrence can be explicitly, auditably remediated; every discrepancy acknowledgment's already-existing permanent audit record (actor, role, timestamp, justification) is fully visible wherever the flag is shown; and five specific Case Workspace / Assistant / Header / Activity-Feed usability defects are fixed — all while preserving the append-only ledger, the derived-projection invariant, and the service-layer-is-the-sole-entry-point architecture Phases 1-6 established.
**Requirements**: F12, F13, F14, F15 (project_specs/FRD-JudicialSync.md and project_specs/PRD-JudicialSync.md are the source of truth for this phase — not yet reflected in REQUIREMENTS.md, a known gap in the add-phase tooling pass)
**Depends on:** Phase 6
**Success Criteria** (what must be TRUE):
  1. Attempting to transition any exhibit to ADMITTED while it has >=1 unresolved objection or no custodian of record is rejected with 422 ADMISSION_BLOCKED, listing every applicable reason, before any ledger write — for every caller, including the seed loader, with no bypass of any kind.
  2. A sealed (isSealed=true) exhibit can never become a member of a jury package via the normal computation path; any legacy/regression row found in that state renders a distinct CRITICAL warning on the Jury Package Workspace and can be explicitly removed (status EXCLUDED, row retained — never deleted) by an authorized role.
  3. Wherever an OPEN discrepancy flag is rendered to a role permitted to acknowledge it, an always-visible disclosure explains the action is permanently recorded under the user's name and role before it is confirmed; once ACKNOWLEDGED, every screen rendering that flag shows the full audit record (actor, role, timestamp, justification) without a secondary click.
  4. Every Case Workspace exhibit row is clickable across its full area (not just a nested element), with a visible hover affordance and keyboard (Enter/Space) activation.
  5. The assistant's example prompts always reference an exhibitLabel that actually exists in the seeded case, verified by an automated test.
  6. The app header shows a labeled discrepancy-count indicator (aria-label="N open discrepancies") or nothing at all — never an unexplained numeral — identically on every screen.
  7. Every Recent Activity row shows both date and time (never time-only) and the exhibit label it concerns, never a bare unattributed summary.
**Plans:** 7 plans (3 waves)

Plans:
- [ ] 07-01-PLAN.md — F12 Admission Integrity Gate: hard pre-write gate in recordStatusChange (status.ts, errors.ts) + dedicated test suite
- [ ] 07-02-PLAN.md — F12 regression compliance: seed loader rewrite (gate-compliant, redefined edge cases, staggered timestamps) + every pre-existing test fixture broken by the gate
- [ ] 07-03-PLAN.md — F13 schema migration (JuryPackageExhibitStatus, exclusion columns) + sealed-exhibit candidate-query exclusion + reconcile correction
- [ ] 07-04-PLAN.md — F15: Case Workspace row clickability fix + assistant example prompts sourced from real seeded exhibits
- [ ] 07-05-PLAN.md — F15: labeled header discrepancy-count indicator + activity feed date+time/exhibit-label fix
- [ ] 07-06-PLAN.md — F14 discrepancy acknowledgment transparency: read-time justification join + always-visible disclosure + full audit record rendering
- [ ] 07-07-PLAN.md — F13 exclude workflow: excludeJuryPackageExhibit service/route + Jury Package Workspace CRITICAL row + Remove-from-Package UI

**Status**: Complete (2026-10-09)
### Phase 7.1: Exhibit classification, state-machine hardening, custody handoff, server-side RBAC, and jury-package versioning/export (INSERTED)

**Goal:** [Urgent work - to be planned]
**Requirements**: TBD
**Depends on:** Phase 7
**Plans:** 0 plans

Plans:
- [ ] TBD (run /pivota_spec-plan-phase 7.1 to break down)

### Phase 8: UI Redesign and Write-Action Coverage

**Goal:** Command Center, Case Workspace, Exhibit Detail, and Jury Package render on the reviewed dark-dashboard visual language (replacing the current Carbon-light theme) and expose the information the reference screenshots depend on — per-status exhibit counts, a prioritized attention feed, a custody-by-custodian view, and per-exhibit jury-package eligibility — while two write actions that have never had a UI in this product (recording a ruling, transferring/assigning custody) become real, role-gated flows reachable from both Command Center and Exhibit Detail.
**Requirements**: TBD — derived from reference screenshots (Trial Command Center, Exhibit Detail, Jury Package Workspace, Case Workspace); not yet reflected in REQUIREMENTS.md pending `update_spec_docs`
**Depends on:** Phase 7.1 (the custody handoff, classification, and multi-case primitives 7.1 introduces are surfaced by this phase's new Command Center widgets and Exhibit Detail rail — this phase should not plan ahead of it)
**Context:** Filed as a phase-sized change assessment from a chat UI review against 4 reference screenshots (2026-10-09). Confirmed during investigation: `recordRuling` (objections.ts) and `recordCustodyTransfer` (custody.ts) are backend-only today — no UI component invokes either anywhere in the codebase. The Command Center redesign's inline action buttons ("Record ruling," "Assign custodian," "Review and remove") also reverse Phase 5's locked success criterion that the screen is "strictly passive/read-only monitoring" — this phase supersedes that constraint by design, not by accident.
**Plans:** 16 plans (5 waves)

Plans:
- [ ] 08-01-PLAN.md — F11 schema migration (finalizationRequestedAt/By) + requestFinalization service/route, finalize clears the request
- [ ] 08-02-PLAN.md — F24 custody role gate (recordCustodyTransfer DEPUTY/CLERK/ADMIN) + pre-existing fixture repairs
- [ ] 08-03-PLAN.md — Shared visual primitives: ExhibitTag, SeverityPill, TwoColorProgressBar, Card chrome, ActionButtonRow
- [ ] 08-04-PLAN.md — Dark-navy shell redesign: Sidebar + Header (remove case-number/discrepancy badge, "Ask Pivota")
- [ ] 08-05-PLAN.md — Seed fixtures P-6/P-7 + legacyAdmitForDemo seed-only helper + grep-confinement proof
- [ ] 08-06-PLAN.md — Command Center backend: getCustodyByCustodian, getAttentionFeed, getStatusCounts
- [ ] 08-07-PLAN.md — Case Workspace backend: juryPackageEligibility + hasUnresolvedObjection + isSealed
- [ ] 08-08-PLAN.md — Exhibit Detail backend: objections[]/custodyCard/juryPackageChecklist on getExhibitHistory
- [ ] 08-09-PLAN.md — Shared write-action UI: RecordRulingForm + TransferCustodyForm + mutation hooks
- [ ] 08-10-PLAN.md — Command Center Part A: statusCounts wiring, stat cards, distribution bar, custody-at-a-glance, activity filters, screen header
- [ ] 08-11-PLAN.md — Case Workspace redesign: ExhibitTag/SeverityPill, eligibility column, quick filters
- [ ] 08-12-PLAN.md — Exhibit Detail Part A: header redesign + alert banner + Transfer-custody action
- [ ] 08-13-PLAN.md — Exhibit Detail Part B: right rail (Objection/Custody/Jury-checklist cards) + Timeline filters
- [ ] 08-14-PLAN.md — Jury Package Workspace redesign: Blockers/Clean cards + progress bar + Request-finalization
- [ ] 08-15-PLAN.md — Command Center Part B: Needs-Your-Attention feed (inline write actions) + Jury Package summary widget
- [ ] 08-16-PLAN.md — Gap closure (UAT test 2): fix sidebar/header overlap + remove segmented status-distribution bar (keep count legend)

**Status**: Complete (2026-10-10)
### Phase 9: UI tickets and typography standard

**Goal:** The 16 tickets from the external UI/UX review of the develop build are each resolved as their own small, acceptance-criteria-verifiable change — the Command Center's ranked attention list is visible without scrolling and fed by a real 4-tier severity scale; every screen reads status/severity color from one shared token source; Recent Activity and the Case Workspace table read correctly and are properly labeled; discrepancy actions (Record ruling, Acknowledge) are safe, singular, and accountable; navigation and the demo role switcher are unambiguous; the Jury Package empty state guides the user and offers a read-only readiness preview to every role; the Assistant page is context-aware and removes the stray API-key control; and IBM Plex Sans/Mono actually load (verified via `document.fonts`) with every text element on a real Carbon type token — all without introducing a second styling system, a new dependency, or any data-model/API/role-permission change the tickets didn't explicitly call for.
**Requirements**: F1, F7, F8, F9, F10, F11, F15, F20, F24 (revised), F25 (new) — see project_specs/PRD-JudicialSync.md and project_specs/FRD/ for full detail; not yet reflected in REQUIREMENTS.md pending a future sync pass
**Depends on:** Phase 8
**Context:** Filed as a phase-sized change assessment from a 16-ticket external UI/UX review (T-01 through T-16) of the develop build, plus a typography/font-loading audit. The source document's own instruction is "one ticket at a time... one pull request per ticket" — plans should preserve that granularity rather than collapsing tickets together. Cross-cutting ground rules every plan must respect: reuse existing components/tokens (no second styling system); no data-model/API/role-permission change unless a ticket explicitly calls for one; derived values live in `services/*.ts` and the API response, never computed in a component; server-side `assertRole`/Permission Matrix remains the sole security boundary; no new dependency without explicit approval (`next/font` is built into Next.js, not a new dependency).
**Success Criteria** (what must be TRUE):
  1. The Command Center's ranked attention list (>=6 rows, exhibit/issue/severity/age/action columns, service-authoritative tier order, inline objection grounds) is visible without scrolling at 1440x900, with KPI tiles <=80px each linking to their filtered view.
  2. Every screen (Command Center legend, Case Workspace pills/filters, Exhibit Detail header/history) renders exhibit status and attention-tier severity from one shared, AA-contrast-verified color+icon token source — no two statuses or tiers share a hue family, and a visual-regression/snapshot check proves consistency.
  3. Recent Activity shows the latest 10 entries (+ "View all" link) with no nested scroll, consecutive same-exhibit transitions collapsed into one row, and one timestamp format (always including seconds) whose heading count and date-group label agree; the Case Workspace table's Jury Package column shows the correct one of four values (Included/Blocked/Not eligible/Not yet evaluated) for every row, with all filters visibly labeled and a "Showing X of Y" + Clear-filters readout replacing the old helper sentence.
  4. Each exhibit's discrepancy banner has exactly one primary "Record ruling" button (JUDGE-only, scoped to its objection) and an Acknowledge action that requires a written justification and appears in history with user+time — no duplicate Record-ruling control anywhere else on the page.
  5. The role switcher is labeled as a demo/test control (or environment-flag-gated out of production), shows a persistent "Active role: X — switch back" banner after switching, and every role-gated UI control refreshes immediately on switch without a page reload; navigation shows a clearly marked active item and the Pivota Assistant has exactly one entry point.
  6. Opening the Jury Package Workspace before a package exists shows full-width guidance naming which roles can start one plus a read-only readiness preview (admitted exhibits and their blockers) visible to every role including a read-only Judge view — computed by a new pure-read service function, never by duplicating eligibility rules client-side.
  7. `document.fonts` reports IBM Plex Sans (400/600) and IBM Plex Mono loaded exactly once on all 4 main pages; every text element's computed font-size/line-height matches a real Carbon type token (no off-scale values); tables/counts/timestamps use tabular figures; section titles follow one capitalization rule; and an automated accessibility check (axe) reports zero contrast failures on the 4 main pages.
**Plans:** 17 plans (7 waves)

Plans:
- [ ] 09-01-PLAN.md — T-01: Command Center first-viewport rebuild (KPI tiles <=80px + attention DataTable + objection grounds)
- [ ] 09-02-PLAN.md — T-02: Four distinct-hue severity tones (SeverityPill) with icons + AA contrast test
- [ ] 09-03-PLAN.md — T-03: Unified status palette — StatusBadge as the single exported source, icons, cross-screen parity test
- [ ] 09-04-PLAN.md — T-04: Recent Activity rework — no nested scroll, 10-row cap + View all, 60s grouping, one timestamp format
- [ ] 09-05-PLAN.md — T-05: Discrepancy actions — Carbon Buttons, single Record-ruling entry point (ObjectionCard de-duplicated)
- [ ] 09-06-PLAN.md — T-06: Case Workspace eligibility fix — 4-value NOT_YET_EVALUATED precedence in the service layer
- [ ] 09-07-PLAN.md — T-07: Filter labels, From/To clarity, witness ComboBox, Showing X of Y + Clear filters
- [ ] 09-08-PLAN.md — T-08: Active nav styling + icons; Jury Package badge count matches the page
- [ ] 09-09-PLAN.md — T-09: Demo-labeled/env-gated role switcher + persistent Active-role banner
- [ ] 09-10-PLAN.md — T-10/F25: Jury Package readiness preview (new pure-read service fn) + full-width empty state
- [ ] 09-11-PLAN.md — T-11: Assistant rework — API-key investigation, exhibit-scoped prompts, viewport layout, 503 retry
- [ ] 09-12-PLAN.md — T-16a: next/font IBM Plex Sans/Mono self-hosting + document.fonts verification
- [ ] 09-13-PLAN.md — T-15: LiveIndicator (Live / Connection lost at 60s) replacing FreshnessIndicator
- [ ] 09-14-PLAN.md — T-12: Contrast/text-size token audit + axe accessibility scan (4 main pages)
- [ ] 09-15-PLAN.md — T-13: Surface/layer flattening — one card/panel chrome, no triple-nesting
- [ ] 09-16-PLAN.md — T-14: Spacing/button-size standardization (Carbon spacing tokens, one button convention)
- [ ] 09-17-PLAN.md — T-16b: Type-token correction sweep (heading-04/code-01, tabular-nums, capitalization rule)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 7.1 → 8 → 9

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Data Foundation | 0/TBD | Complete | 2026-10-07 |
| 2. Core Screens | 0/TBD | Complete | 2026-10-07 |
| 3. Jury Package + Discrepancy Detection | 0/TBD | Complete | 2026-10-07 |
| 4. Pivota Assistant | 5/5 | Complete | 2026-10-07 |
| 5. Trial Command Center + Live Sync | 3/3 | Complete | 2026-10-08 |
| 6. Carbon Design System UI Upgrade | 9/9 | Complete | — |
| 7. Fix admission integrity and UI usability issues | 7/7 | Complete | — |
| 7.1. Exhibit classification, state-machine hardening, custody handoff, server-side RBAC, and jury-package versioning/export (INSERTED) | 0/TBD | Not planned | — |
| 8. UI Redesign and Write-Action Coverage | 15/15 | Complete | 2026-10-10 |
| 9. UI tickets and typography standard | 0/TBD | In progress | — |
**Status**: In progress