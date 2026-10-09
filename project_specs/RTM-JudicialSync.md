# Requirements Traceability Matrix: JudicialSync

**Project Acronym:** JudicialSync
**Document Type:** RTM (Requirements Traceability Matrix)
**Version:** 1.1
**Status:** Draft
**Generated:** 2026-10-06
**Last Updated:** 2026-10-08 (Phase 7 — Admission Integrity and Courtroom Usability Hardening — F12–F15 added)
**Source Documents:** `PRD-JudicialSync.md`, `FRD-JudicialSync.md` (+ `FRD/F12`–`F15`, `FRD/Y0`–`Y3`), `TechArch-JudicialSync.md` (+ `TechArch/01`–`06` chunks), `UserStories-JudicialSync.md`, `JOURNEYS-JudicialSync.md` (JRN-02.1), `STORY-MAP-JudicialSync.md` (Release R3), `UX-Mockup-JudicialSync.md` (+ `UX-Mockup/Screen-00`–`Screen-04`), `.planning/PROJECT.md`, `.planning/ROADMAP.md` (Phase 7)

---

## 1. Overview

This Requirements Traceability Matrix (RTM) provides bidirectional traceability across every layer of the JudicialSync specification set — from the 16 PRD features (F0–F15, following the Phase 7 addition of F12–F15), through their corresponding FRD functional chunks (F00–F15), into the TechArch components, data model, and API surface that implement them, and finally into the UserStories epics and acceptance criteria that define how each requirement will be verified. Its purpose is to make certain that every product requirement has a documented implementation path and that every implementation artifact traces back to an approved requirement — nothing is built that wasn't specified, and nothing specified is left unimplemented or untested.

JudicialSync is architecturally simple by design: a single append-only event ledger (`exhibit_events`), a small set of derived current-state projections, one shared service layer, and a fixed (≤8-tool) assistant tool set that wraps that same service layer 1:1. Because of this architecture, traceability in this project is unusually tight — each PRD feature maps to exactly one FRD chunk, which maps to a small, enumerable set of TechArch tables/services/endpoints, which in turn maps to one or two UserStories epics. There are no orphaned requirements and no parallel implementation paths to reconcile. This RTM documents that 1:1 structure explicitly so it can be validated during implementation and QA rather than assumed.

JudicialSync does not yet have a dedicated FIPS (Feature Implementation Plan/Spec), BusinessCase, or CostBenefitAnalysis document generated in `project_specs/` at the time of this RTM's creation; this matrix covers the documents that exist (PRD, FRD, TechArch, UserStories, and — as of this Phase 7 update — JOURNEYS, STORY-MAP, and UX-Mockup) and should be regenerated or extended if FIPS/BusinessCase/CostBenefitAnalysis are produced later.

**Phase 7 update (2026-10-08):** This RTM has been extended to cover Phase 7 — "Fix admission integrity and UI usability issues" (`.planning/ROADMAP.md`) — which adds four PRD features (F12–F15), their FRD chunks, their TechArch amendments, and 14 new UserStories (US-12.1–US-15.5, Epics 12–15). Unlike F0–F11, Phase 7's requirements were also explicitly traced into the experience-design layer: JRN-02.1 (the core demo journey) was updated with two new stage-level touchpoints (Log Exhibit Activity → F12; Assemble the Jury Package → F13, F14), STORY-MAP-JudicialSync.md's Release R3 places all 14 new stories against existing backbone activities with no new epics/journeys/JTBD IDs introduced, and UX-Mockup-JudicialSync.md's five screen documents (Screen-00–Screen-04) were amended in place to specify the new UI behavior. §3 below adds a dedicated Phase 7 sub-table (§3a) to carry this additional Journey/UX-Mockup traceability layer, which did not exist for F0–F11's original scope.

Traceability levels covered in this document:
- **Level 1 — PRD → FRD:** Every PRD feature (F0–F15) maps to exactly one FRD functional chunk of the same number (F00–F15), confirming no feature was dropped or silently re-scoped during functional elaboration.
- **Level 2 — FRD → TechArch:** Every FRD chunk's data model, service-layer functions, and API surface are traced to the specific TechArch section (data model §3, component §2, API §4, security §5) that implements it.
- **Level 3 — TechArch → UserStories:** Every TechArch component/table/endpoint is traced to the UserStories epic(s) whose acceptance criteria exercise it, confirming test coverage exists for every implemented capability.
- **Level 4 — Test Coverage:** Acceptance criteria within each UserStories epic are treated as the atomic, countable test-case units for this project (no separate TEST-XXX catalog exists yet), and are tallied per feature in §5 below.
- **Level 5 — UserStories → Journey/UX-Mockup (Phase 7 only):** Each of the 14 new UserStories is additionally traced to its JRN-02.1 journey-stage touchpoint (or, where the UX-Mockup places it outside JRN-02.1, its actual source journey) and its UX-Mockup screen, in §3a below.

---

## 2. Requirements Summary

- **16 PRD features (F0–F15)** span five categories: Data Foundation (1), Status Tracking (4, with Phase 7's F12 added), Differentiator (4, with Phase 7's F13/F14 added), UI Screen (5), and Usability (2, with Phase 7's F15 added) — see PRD §9 Feature Index.
- **12 P0 (Critical/MVP) features:** F0, F1, F2, F3, F5, F6, F7, F9, F10, F11, F12, F13 — these collectively form the minimum viable demo plus the Phase 7 integrity gates (F12, F13); none can be cut without breaking the core "judge asks a live question" scenario or reopening the admission/sealed-exhibit integrity gaps Phase 7 closes.
- **4 P1 (High) features:** F4 (Exhibit Search), F8 (Trial Command Center Screen), F14 (Discrepancy Acknowledgment Transparency), F15 (Courtroom Usability Fixes) — materially improve usability/trust/ambient awareness but are not blocking for the Q&A/status core scenario.
- **16 FRD functional chunks (F00–F15)** map 1:1 to PRD features, plus **5 cross-cutting FRD chunks (Y0–Y4)** covering schema, API, error catalog, integrations, and the Phase 6 design-system migration that are referenced (not duplicated) by every feature chunk.
- **9 core domain tables + 3 assistant-audit tables** defined in TechArch §3 Data Model: `cases`, `users`, `exhibits`, `exhibit_events` (the ledger), `exhibit_current_state`, `objection_current_state`, `custody_current_state`, `discrepancy_flags`, `jury_packages`, `jury_package_exhibits`, `assistant_conversations`, `assistant_messages`, `assistant_citations`. **Phase 7 (F13) amends** `jury_package_exhibits` with `status`/`excluded_at`/`excluded_by`/`exclusion_reason` and adds the `JURY_PACKAGE_EXHIBIT_EXCLUDED` event type — the only schema change in Phase 7; F12, F14, and F15 introduce no new tables, columns, or enums.
- **1 non-negotiable architectural constraint** underlies every requirement: status, objections/rulings, and custody are modeled exclusively as append-only ledger events, never mutable fields — enforced from PRD §4 through FRD's cross-cutting terminology through TechArch §1.3/§3 and verified by UserStories US-0.3.
- **~18 REST/streaming API endpoints** documented in TechArch §4 (Phase 7 adds one new route, `POST /api/jury-package/:id/exhibits/:exhibitId/exclude` (F13), and amends two existing ones — `POST /api/exhibits/:id/events/status` (F12, `ADMISSION_BLOCKED`) and `GET /api/cases/:id/jury-package` (F13, `EXCLUDED`-row omission)), each traced to its originating FRD feature chunk and consumed by exactly one UI screen and/or one assistant tool — never a parallel, divergent access path.
- **8 assistant tools** (`getExhibitStatus`, `getUnresolvedObjections`, `getCustodian`, `getCustodyHistory`, `getExhibitHistory`, `searchExhibits`, `getJuryPackageStatus`, `getDiscrepancies`) are each a 1:1 pass-through to an identically-named service-layer function — the structural guarantee that the assistant can never state something a UI screen doesn't also show. Phase 7's F13/F14 amendments propagate to `getJuryPackageStatus`/`getDiscrepancies` automatically via this same mapping, with no tool definition changed.
- **16 UserStories epics, 45 user stories total** (30 P0, 13 P1, 2 P2) — see UserStories Summary Table — collectively carrying **162 acceptance criteria**, the atomic test-case units tracked in §5 below. Phase 7 adds **4 epics (12–15), 14 stories (7 P0, 7 P1, 0 P2 at the epic-list level above the story grain — see §5 for the exact per-story priority breakdown), 55 acceptance criteria**.
- **8 Non-Functional Requirements** (PRD §6) — Trustworthiness over fluency, Single source of truth, Auditability, Role-appropriate visibility, Responsiveness for live use, Demo reliability, Non-technical usability, Realistic seed data complexity, plus the Phase 6-added Design-system foundation NFR — each traced to a specific TechArch enforcement mechanism in §4 below.
- **2 discrepancy rules required at launch** (`ADMITTED_NO_CUSTODIAN`, `UNRESOLVED_OBJECTION_JURY_ELIGIBLE`), extensible per FRD F06, each independently traced from PRD F6 through TechArch §3.5 to UserStories US-6.1/US-6.2. **Phase 7's F12 closes the gap these two rules left open** by converting both conditions from a post-hoc discrepancy flag into a hard pre-write admission gate — F6's rules remain in force for conditions arising *after* a valid admission.
- **Phase 7 adds a new Journey/UX-Mockup traceability layer (§3a)** not present for F0–F11: all 14 new stories are traced to their JRN-02.1 (or, where applicable, JRN-01.1/JRN-01.2) journey-stage touchpoint and their UX-Mockup screen (Screen-00 through Screen-04).

---

## 3. Traceability Matrix (PRD → FRD → TechArch → User Stories)

| PRD Feature | Priority | FRD Chunk | TechArch Spec Reference | User Stories |
|---|---|---|---|---|
| F0: Exhibit Workspace (Data Model) | P0 | F00-exhibit-workspace-data-model | §2.2 `services/exhibits.ts`, `services/events.ts`; §2.4 Seed data loader; §3.2 Core Identity Entities (`cases`, `users`, `exhibits`); §3.3 Event Ledger (`exhibit_events`); API §4.2 `POST /api/exhibits`, `GET /api/exhibits/:id` | US-0.1, US-0.2, US-0.3 |
| F1: Exhibit Status Display | P0 | F01-exhibit-status-display | §2.2 `services/status.ts`; §3.4 `exhibit_current_state`; §4.3 `POST /api/exhibits/:id/events/status`, `GET /api/exhibits/:id/status`; §2.1 `StatusBadge` shared component | US-1.1, US-1.2 |
| F2: Objection and Ruling Tracking | P0 | F02-objection-ruling-tracking | §2.2 `services/objections.ts`; §3.4 `objection_current_state`; §4.4 `POST /api/exhibits/:id/events/objection`, `POST /api/objections/:id/ruling`, `GET /api/cases/:id/objections`; §5.2.2 judge-role write gate | US-2.1, US-2.2, US-2.3 |
| F3: Custody Tracking | P0 | F03-custody-tracking | §2.2 `services/custody.ts`; §3.4 `custody_current_state`; §4.5 `POST /api/exhibits/:id/events/custody`, `GET /api/exhibits/:id/custodian`, `GET /api/exhibits/:id/custody-history` | US-3.1, US-3.2, US-3.3 |
| F4: Exhibit Search | P1 | F04-exhibit-search | §2.2 `services/exhibits.ts#searchExhibits`; §4.6 `GET /api/cases/:id/exhibits/search`; §2.3 `searchExhibits` assistant tool | US-4.1, US-4.2 |
| F5: Jury-Ready Exhibit List Generation | P0 | F05-jury-ready-exhibit-list-generation | §2.2 `services/juryPackage.ts`; §3.6 `jury_packages`, `jury_package_exhibits`; §4.7 `POST/GET /api/cases/:id/jury-package`, `POST /api/jury-package/:id/finalize`; §5.2.2 DEPUTY/CLERK/ADMIN write gate | US-5.1, US-5.2 |
| F6: Discrepancy Identification | P0 | F06-discrepancy-identification | §2.2 `services/discrepancies.ts`; §3.5 `discrepancy_flags` + rule registry; §4.8 `GET /api/cases/:id/discrepancies`, `GET /api/exhibits/:id/discrepancies`, `POST /api/discrepancies/:id/acknowledge`; §7.2 Internal Triggers | US-6.1, US-6.2, US-6.3 |
| F7: Pivota Assistant (Natural-Language Q&A) | P0 | F07-pivota-assistant | §2.3 Assistant Layer (`assistant/tools.ts`, `assistant/system-prompt.ts`, `assistant/route.ts`, `assistant/citations.ts`); §3.7 `assistant_conversations/messages/citations`; §4.10 `POST /api/assistant/chat`, `GET /api/assistant/conversations/:id`; §5.4 Assistant Trust & Safety Controls | US-7.1, US-7.2, US-7.3, US-7.4, US-7.5 |
| F8: Trial Command Center Screen | P1 | F08-trial-command-center-screen | §2.1 `CommandCenterPage`; §2.2 `services/activity.ts#getRecentActivity`; §4.9 `GET /api/cases/:id/activity`; §7.3 Polling live-sync | US-8.1, US-8.2 |
| F9: Case Workspace Screen | P0 | F09-case-workspace-screen | §2.1 `CaseWorkspacePage`; §4.2 `GET /api/cases/:id/exhibits`; §4.6 search integration; §7.3 Polling live-sync | US-9.1, US-9.2 |
| F10: Exhibit Detail View Screen | P0 | F10-exhibit-detail-view-screen | §2.1 `ExhibitDetailPage`; §4.2 `GET /api/exhibits/:id/history`; §5.2.1 sealed-exhibit 404-masking | US-10.1, US-10.2 |
| F11: Jury Package Workspace Screen | P0 | F11-jury-package-workspace-screen | §2.1 `JuryPackageWorkspacePage`; §4.7 `GET /api/cases/:id/jury-package`, `POST /api/jury-package/:id/finalize`; §4.8 acknowledgment action | US-11.1, US-11.2 |
| F12: Admission Integrity Gating *(Phase 7)* | P0 | F12-admission-integrity-gating | §2.2 `services/status.ts#recordStatusChange` (Admission Gate, amended — two precondition queries against `objection_current_state`/`custody_current_state` run inside the same transaction as F1's `fromStatus` check, before any ledger write); §4.3 `POST /api/exhibits/:id/events/status` (amended — adds `ADMISSION_BLOCKED` 422 with `reasons[]`); §5.2.3 Admission Integrity Gate (data-invariant enforcement, not role-based — no override/bypass for any caller) | US-12.1, US-12.2, US-12.3 |
| F13: Jury Package Ex Parte / Sealed Exclusion *(Phase 7)* | P0 | F13-jury-package-ex-parte-sealed-exclusion | §2.2 `services/juryPackage.ts#computeJuryCandidates` (amended — `isSealed = false` filter applied in the same query as `currentStatus = 'ADMITTED'`) + new `excludeJuryPackageExhibit(...)`; §3.6 `jury_package_exhibits` (amended: `status`, `excluded_at`, `excluded_by`, `exclusion_reason`) + new `JURY_PACKAGE_EXHIBIT_EXCLUDED` event type; §4.7 `GET /api/cases/:id/jury-package` (amended — `EXCLUDED` rows omitted from default read), §4.7a new `POST /api/jury-package/:id/exhibits/:exhibitId/exclude`; §5.2.2 DEPUTY/CLERK/ADMIN exclusion role gate (identical to finalize gate) | US-13.1, US-13.2, US-13.3 |
| F14: Discrepancy Acknowledgment Transparency *(Phase 7)* | P1 | F14-discrepancy-acknowledgment-transparency | §2.2 `services/discrepancies.ts#getDiscrepancies` (amended — additive read-time join surfacing `justification` for `ACKNOWLEDGED` flags); §4.1/§4.8 `GET /api/cases/:id/discrepancies`, `GET /api/exhibits/:id/discrepancies` (amended response shape only); no schema change — justification text already exists in the `DISCREPANCY_ACKNOWLEDGED` event's payload | US-14.1, US-14.2, US-14.3 |
| F15: Courtroom Usability Fixes *(Phase 7)* | P1 | F15-courtroom-usability-fixes | §2.1 `ExhibitTable.tsx` (full-row click-through, amended), `ExampleChips.tsx` (real seeded `exhibitLabel` sourcing, amended), `Header.tsx` (unlabeled numeric element labeled or removed, amended), `RecentActivityPanel.tsx` (date-qualified timestamp + exhibit label on every row, amended) — all five fixes are client-rendering corrections only; no API, service-layer, or schema change | US-15.1, US-15.2, US-15.3, US-15.4, US-15.5 |

**Cross-cutting FRD/TechArch chunks referenced by all rows above (not duplicated per-feature):**

| FRD Cross-Cutting Chunk | TechArch Coverage |
|---|---|
| Y0: Database Schema | TechArch §3 Data Model (full DDL, §3.2–§3.7) |
| Y1: Consolidated REST API Catalog | TechArch §4 API Design (§4.1–§4.12) |
| Y2: Cross-Feature Error Catalog | TechArch §4.11 Common Response Envelope; per-feature error tables throughout §4 |
| Y3: Integrations | TechArch §7 Integration Points (External Services, Internal Triggers, Live Sync, Seed Loader) |
| Y4: Design System Migration (Phase 6) | TechArch §5 Tech Stack (UI components → IBM Carbon Design System); UX-Mockup Interaction Patterns (Carbon component attribution, Phase 6 design-system note) |

### 3a. Phase 7 Extended Traceability — Journey & UX-Mockup Touchpoints

This sub-table exists only for Phase 7 (F12–F15): it traces each of the 14 new UserStories into the experience-design layer — the specific JRN-02.1 journey stage it was placed against (or, where the UX-Mockup source places it on a different judge-persona journey, that journey instead) and the UX-Mockup screen document that specifies its UI behavior. No equivalent layer exists for F0–F11 in this RTM's original scope.

| PRD Feature | User Story | Journey Touchpoint | UX-Mockup Screen |
|---|---|---|---|
| F12: Admission Integrity Gating | US-12.1 | JRN-02.1 — "Log Exhibit Activity" stage | Screen-01 (Case Workspace), Screen-02 (Exhibit Detail) |
| F12: Admission Integrity Gating | US-12.2 | JRN-02.1 — "Log Exhibit Activity" stage | Screen-01 (Case Workspace), Screen-02 (Exhibit Detail) |
| F12: Admission Integrity Gating | US-12.3 | JRN-02.1 — "Log Exhibit Activity" stage (no-bypass guarantee; same Record Status action surface as US-12.1/US-12.2) | Screen-01, Screen-02 (no distinct UI — structural service-layer guarantee verified via the same status-transition action) |
| F13: Jury Package Ex Parte / Sealed Exclusion | US-13.1 | JRN-02.1 — "Assemble the Jury Package" stage | Screen-03 (Jury Package Workspace) |
| F13: Jury Package Ex Parte / Sealed Exclusion | US-13.2 | JRN-02.1 — "Assemble the Jury Package" stage | Screen-03 (Jury Package Workspace) |
| F13: Jury Package Ex Parte / Sealed Exclusion | US-13.3 | JRN-02.1 — "Assemble the Jury Package" stage | Screen-03 (Jury Package Workspace) |
| F14: Discrepancy Acknowledgment Transparency | US-14.1 | JRN-02.1 — "Assemble the Jury Package" stage | Screen-02 (Exhibit Detail), Screen-03 (Jury Package Workspace) |
| F14: Discrepancy Acknowledgment Transparency | US-14.2 | JRN-02.1 — "Assemble the Jury Package" stage | Screen-02 (Exhibit Detail), Screen-03 (Jury Package Workspace) |
| F14: Discrepancy Acknowledgment Transparency | US-14.3 | JRN-02.1 — "Assemble the Jury Package" stage | Screen-02 (Exhibit Detail), Screen-03 (Jury Package Workspace) |
| F15: Courtroom Usability Fixes | US-15.1 | JRN-02.1 — "Search Mid-Testimony" stage (existing stage, reused; not a Phase 7 stage addition) | Screen-01 (Case Workspace) |
| F15: Courtroom Usability Fixes | US-15.2 | JRN-01.1 — "Query the Assistant" stage *(judge persona journey, not JRN-02.1 — per UX-Mockup/JOURNEYS source)* | Screen-04 (Pivota Assistant) |
| F15: Courtroom Usability Fixes | US-15.3 | JRN-01.2 — "Glance During Recess" stage *(judge persona journey, not JRN-02.1 — per UX-Mockup/JOURNEYS source)* | All screens (Screen-00–Screen-03; shared `Header.tsx` component) — see UX-Mockup `00-overview.md` §Header and `Y0-patterns.md` §Pattern: Labeled Header Indicator |
| F15: Courtroom Usability Fixes | US-15.4 | JRN-01.2 — "Glance During Recess" stage *(judge persona journey, not JRN-02.1 — per UX-Mockup/JOURNEYS source)* | Screen-00 (Trial Command Center) |
| F15: Courtroom Usability Fixes | US-15.5 | JRN-01.2 — "Glance During Recess" stage *(judge persona journey, not JRN-02.1 — per UX-Mockup/JOURNEYS source)* | Screen-00 (Trial Command Center) |

**Note on journey scope:** Per JOURNEYS-JudicialSync.md's own Phase 7 changelog note, only JRN-02.1 was actually amended for Phase 7 (two new stage-level feature references: "Log Exhibit Activity" → +F12, "Assemble the Jury Package" → +F13, +F14). F15's usability fixes land on pre-existing stages of JRN-02.1 (US-15.1) and JRN-01.1/JRN-01.2 (US-15.2–US-15.5) that were not themselves modified — this RTM records the accurate touchpoint in each case rather than attributing all 14 stories to JRN-02.1 uniformly. STORY-MAP-JudicialSync.md's Release R3 independently confirms all 14 stories are placed against existing backbone activities with no new epics, journeys, or JTBD IDs introduced for Phase 7.

---

## 4. Requirements Detail

### P0 (Critical — MVP) Features

- **F0 — Exhibit Workspace (Data Model):** Foundational exhibit identity + append-only event ledger that every other feature depends on. FRD F00 locks this in as the sole source of truth (no mutable status/custody fields ever exist on `Exhibit`). Includes the deterministic seed-data loader with deliberately planted edge cases (unresolved objection, custody gap, jury-package discrepancy).
- **F1 — Exhibit Status Display:** At-a-glance lifecycle status (`MARKED`→`OFFERED`→`OBJECTED`→`ADMITTED`/`EXCLUDED`/`WITHDRAWN`), derived from `exhibit_current_state`, consistent across all four screens and the assistant.
- **F2 — Objection and Ruling Tracking:** Independent, concurrently-open objection threads per exhibit; `SUSTAINED`/`OVERRULED`/`RESERVED` rulings restricted to `JUDGE` role; feeds F1 status gating and F6 discrepancy detection.
- **F3 — Custody Tracking:** Custody transfers recorded as discrete immutable events (never a mutable "current holder" field); instant custodian lookup and full chain-of-custody retrieval; feeds F6's `ADMITTED_NO_CUSTODIAN` rule.
- **F5 — Jury-Ready Exhibit List Generation:** Computes jury-eligible candidates (`ADMITTED` status only) with F6 discrepancy detection as a hard, non-bypassable gate before finalization; finalization re-evaluates discrepancies fresh, never from a cached draft-time annotation.
- **F6 — Discrepancy Identification:** Two required rules at launch (`ADMITTED_NO_CUSTODIAN`, `UNRESOLVED_OBJECTION_JURY_ELIGIBLE`), auto-detected after every relevant ledger write, with an explicit, justified, ledger-recorded acknowledgment flow — never silently created or dropped by a user.
- **F7 — Pivota Assistant (Natural-Language Q&A):** The feature the entire demo depends on. Tool-calling only (no RAG/embeddings); cite-or-decline system prompt; role-scoped identically to UI; explicit, visually-distinct outage fallback (`ASSISTANT_UNAVAILABLE`, 503) separate from a Decline Response.
- **F9 — Case Workspace Screen:** Primary browsing/search surface; render-only (no embedded business logic); inline discrepancy indicators; sealed exhibits simply absent (never shown redacted) for unauthorized roles.
- **F10 — Exhibit Detail View Screen:** Complete chronological timeline reconstructed from the ledger, one entry per `ExhibitEvent`, no truncation; sealed exhibit for an unauthorized role returns 404 (not 403), identical to a genuinely nonexistent exhibit.
- **F11 — Jury Package Workspace Screen:** Authoritative handoff view; "Finalize" control is disabled (not just error-returning) while any open discrepancy remains; becomes fully read-only/export-ready once `FINALIZED`.
- **F12 — Admission Integrity Gating *(Phase 7)*:** Converts F6's two post-hoc discrepancy rules into a hard pre-write gate — an `ADMITTED` transition is rejected (422 `ADMISSION_BLOCKED`, all applicable reasons listed at once) rather than silently recorded, when an unresolved objection or missing custodian is present; enforced once inside the shared status-transition service with no override, bypass flag, or elevated-role exception for any caller (UI, API, or seed loader).
- **F13 — Jury Package Ex Parte / Sealed Exclusion *(Phase 7)*:** The highest-severity fix in this release — a hard, query-level exclusion ensuring a sealed/ex-parte exhibit can never acquire an `INCLUDED` jury-package row or a `CLEAN` discrepancy status, regardless of its admission status; includes an auditable "Remove from Package" remediation path (`JURY_PACKAGE_EXHIBIT_EXCLUDED` event) for any legacy/regression row found already present.

### P1 (High) Features

- **F4 — Exhibit Search:** Combinable (AND-semantics) filters by ID, keyword, status, witness, date range; surfaced identically in Case Workspace UI and via the assistant's `searchExhibits` tool.
- **F8 — Trial Command Center Screen:** Ambient, read-only, passive-monitoring view (Recent Activity / Unresolved Objections / Discrepancies panels); composes existing F2/F3/F6 service functions with zero new business logic; link-through only, no data entry.
- **F14 — Discrepancy Acknowledgment Transparency *(Phase 7)*:** A pure UI-visibility requirement layered on F6's unchanged acknowledgment data model — makes role-eligibility, the permanent-record framing of the justification field, and the full acknowledgment audit record (actor/role/timestamp/justification) visible at the point of action on every screen that renders a discrepancy flag, with no new data capability, API contract, or schema change.
- **F15 — Courtroom Usability Fixes *(Phase 7)*:** Five client-rendering corrections against data the service layer already returns correctly — fully clickable Case Workspace rows, assistant example prompts sourced from real seeded exhibit labels, a labeled-or-removed header element, and date-qualified, exhibit-labeled activity-feed rows; none requires an API contract, service-layer, or schema change.

### Non-Functional Requirements (PRD §6) — Traced to Enforcement Mechanism

- **Trustworthiness over fluency** → TechArch §5.4 (cite-or-decline system prompt, zero-citation claims treated as release-blocking defect); verified by US-7.2.
- **Single source of truth** → TechArch §1.1/§2.2 (one shared service layer, no parallel Prisma access from UI or assistant); verified by US-1.2, US-3.2, US-4.2.
- **Auditability** → TechArch §3.3 (immutable `exhibit_events`), §2.4 `services/rebuild.ts#rebuildProjections`; verified by US-0.3.
- **Role-appropriate visibility** → TechArch §5.2.1 (sealed-exhibit 404-masking enforced once in `services/visibility.ts`); verified by US-7.4, US-10.2.
- **Responsiveness for live use** → TechArch §7.3 (3–5s polling via `@tanstack/react-query`); verified by US-1.2, US-8.1, US-9.1, US-11.1.
- **Demo reliability** → TechArch §7.4 (seed loader uses identical `recordEvent()` write path; post-seed assertion fails fast); verified by US-0.2.
- **Non-technical usability** → TechArch §2.1 (render-only UI, conversational action-flow components over heavy data-entry forms); verified across all UI-screen epics (8–11).
- **Realistic seed data complexity** → TechArch §7.4 (deliberately planted edge cases: unresolved objection, custody gap, jury-package discrepancy); verified by US-0.2.

---

## 5. Test Case Coverage

No separate `TEST-XXX` catalog exists yet for JudicialSync. In its absence, each acceptance criterion defined in `UserStories-JudicialSync.md` is treated as one atomic, verifiable test case — this is the current, grounded unit of test coverage until a dedicated test-case document is generated. Counts below are tallied directly from the acceptance-criteria bullets under each epic's stories.

| Feature | Epic (UserStories) | Stories | Acceptance Criteria (Test Cases) | Coverage |
|---|---|---|---|---|
| F0: Exhibit Workspace | Epic 0 | 3 (US-0.1–0.3) | 13 | 100% |
| F1: Exhibit Status Display | Epic 1 | 2 (US-1.1–1.2) | 8 | 100% |
| F2: Objection and Ruling Tracking | Epic 2 | 3 (US-2.1–2.3) | 11 | 100% |
| F3: Custody Tracking | Epic 3 | 3 (US-3.1–3.3) | 10 | 100% |
| F4: Exhibit Search | Epic 4 | 2 (US-4.1–4.2) | 7 | 100% |
| F5: Jury-Ready Exhibit List Generation | Epic 5 | 2 (US-5.1–5.2) | 7 | 100% |
| F6: Discrepancy Identification | Epic 6 | 3 (US-6.1–6.3) | 11 | 100% |
| F7: Pivota Assistant (NL Q&A) | Epic 7 | 5 (US-7.1–7.5) | 17 | 100% |
| F8: Trial Command Center Screen | Epic 8 | 2 (US-8.1–8.2) | 6 | 100% |
| F9: Case Workspace Screen | Epic 9 | 2 (US-9.1–9.2) | 5 | 100% |
| F10: Exhibit Detail View Screen | Epic 10 | 2 (US-10.1–10.2) | 6 | 100% |
| F11: Jury Package Workspace Screen | Epic 11 | 2 (US-11.1–11.2) | 6 | 100% |
| F12: Admission Integrity Gating *(Phase 7)* | Epic 12 | 3 (US-12.1–12.3) | 14 | 100% |
| F13: Jury Package Ex Parte / Sealed Exclusion *(Phase 7)* | Epic 13 | 3 (US-13.1–13.3) | 12 | 100% |
| F14: Discrepancy Acknowledgment Transparency *(Phase 7)* | Epic 14 | 3 (US-14.1–14.3) | 11 | 100% |
| F15: Courtroom Usability Fixes *(Phase 7)* | Epic 15 | 5 (US-15.1–15.5) | 18 | 100% |
| **Total** | **16 Epics** | **45** | **162** | **100%** |

**Phase 7 priority breakdown (per UserStories Summary Table):** Epic 12 — 3 stories, all P0; Epic 13 — 3 stories, all P0; Epic 14 — 3 stories, all P1; Epic 15 — 5 stories (1 P0: US-15.1, 2 P1: US-15.2/US-15.5, 2 P2: US-15.3/US-15.4). Combined with the pre-Phase-7 total (23 P0, 8 P1, 0 P2/P3 across 31 stories), the full 45-story set is 30 P0, 13 P1, 2 P2.

**Coverage basis:** "Coverage" above reflects that every acceptance criterion is traceable to a specific FRD process step, validation rule, or error state (§3 above) — i.e., no acceptance criterion exists without a corresponding functional/technical specification behind it. It does **not** yet reflect actual automated-test pass/fail status, since implementation has not started as of this RTM's generation date. This table should be re-validated against a real test-execution report once implementation and QA begin.

**Success-metric cross-reference (PRD §7):** The five PRD-named example assistant questions ("admitted yesterday," "unresolved objections," "Exhibit 14 jury package," "custodian of Exhibit 7," "what happened to Exhibit 14") are specifically covered by US-7.1's first acceptance criterion and FRD F07 §Validation's explicit requirement that all five resolve via the existing ≤8-tool set with no gaps.

**Phase 7 success-metric cross-reference (PRD §7, amended):** "Jury package integrity: 0 discrepant exhibits appear in a finalized jury package" is now additionally backed by F12's admission gate (an exhibit can no longer even reach `ADMITTED` with an unresolved objection or missing custodian) and F13's hard sealed/ex-parte exclusion (US-13.1's acceptance criteria assert a seeded sealed-and-admitted exhibit never appears in `computeJuryCandidates`, is never rendered `CLEAN`, and is never returned by `getJuryPackageStatus` as eligible) — covering the specific originating regression this release exists to prevent. "Cross-screen consistency" is additionally verified for Phase 7 by US-14.3's requirement that the UI and the assistant's `getDiscrepancies` answer show an identical acknowledgment record (actor, role, timestamp, justification) for the same flag.

---

## 6. Change Management

| Version | Date | Change Description | Changed By | Affected Documents |
|---|---|---|---|---|
| 1.0 | 2026-10-06 | Initial RTM generated from PRD, FRD, TechArch, and UserStories (all v1.0/Draft) for JudicialSync | Pivota Spec RTM Generator | PRD-JudicialSync.md, FRD-JudicialSync.md, TechArch-JudicialSync.md, UserStories-JudicialSync.md |
| 1.1 | 2026-10-08 | Added Phase 7 ("Fix admission integrity and UI usability issues") traceability: 4 new PRD features (F12–F15), 4 new FRD chunks, TechArch amendments (`services/status.ts`, `services/juryPackage.ts`, `services/discrepancies.ts`, 4 client components, 1 new endpoint, 1 schema migration), 4 new UserStories epics (12–15, 14 stories, 55 acceptance criteria), and a new §3a sub-table tracing all 14 stories to their JRN-02.1 (or JRN-01.1/JRN-01.2) journey touchpoint and UX-Mockup screen (Screen-00–Screen-04). All F0–F11 rows left unmodified. | Pivota Spec RTM Generator | PRD-JudicialSync.md, FRD/F12–F15, TechArch/01–06, UserStories-JudicialSync.md, JOURNEYS-JudicialSync.md, STORY-MAP-JudicialSync.md, UX-Mockup/Screen-00–Screen-04, .planning/ROADMAP.md |

**Change control note:** Because every PRD feature maps 1:1 to a single FRD chunk and a small, enumerable TechArch surface, any future change to a feature's scope (e.g., adding a third discrepancy rule, or re-prioritizing F4/F8 to P0) must be reflected in this RTM's §3 Traceability Matrix and §5 Coverage table in the same change cycle, not deferred to a later audit pass.

---

## 7. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Product Owner | | | |
| Engineering Lead | | | |
| QA Lead | | | |
| Project Sponsor | | | |

---

*This RTM serves as the authoritative cross-reference for implementation planning, QA test-plan derivation, and change-impact analysis for JudicialSync. It should be regenerated whenever any of PRD, FRD, TechArch, or UserStories is materially revised, and extended once a dedicated FIPS, BusinessCase, CostBenefitAnalysis, or TEST-XXX test-case catalog is produced for this project.*
