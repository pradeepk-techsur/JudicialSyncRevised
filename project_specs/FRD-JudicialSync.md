# Functional Requirements Document: JudicialSync

**Project Acronym:** JudicialSync
**Document Type:** FRD (Functional Requirements Document)
**Version:** 1.3
**Status:** Draft
**Generated:** 2026-10-06
**Last Updated:** 2026-10-09 (added F24 for Phase 8; amended F8, F9, F10, F11 for Phase 8's new data surfaces and write-action UI coverage)
**Source PRD:** `PRD-JudicialSync.md`

---

## Scope

This FRD translates JudicialSync's 25 PRD features (F0–F24) into implementation-ready specifications: data model, process flows, inputs/outputs, validation rules, error states, API surface, and schema surface. It is grounded in one non-negotiable architectural constraint established by project research (`SUMMARY.md`, `ARCHITECTURE.md`, `PITFALLS.md`): **status, objections/rulings, and custody are modeled exclusively as an append-only event ledger**, never as mutable "current state" fields. Every UI screen and every Pivota Assistant answer reads through one shared service layer over this ledger and its derived current-state projections — there is no parallel retrieval path, which is what makes assistant citations trustworthy.

F12–F15 (added for Phase 7: "Fix admission integrity and UI usability issues") extend this foundation with a hard pre-write admission gate (F12), a structural sealed/ex-parte exclusion from jury packages (F13), a UI-visibility-only requirement over F6's existing acknowledgment audit trail (F14), and a cluster of client-rendering usability fixes with no backend contract changes (F15). None of F12–F15 alters the behavior specified for F0–F11 in this document; they add new validation points, one new ledger event type, and new fields strictly additive to the schema described in `Y0-schema.md`.

F16–F23 (added for Phase 7.1, an urgent INSERTED phase between Phase 7 and the next planned milestone phase: "Exhibit classification, state-machine hardening, custody handoff, server-side RBAC, and jury-package versioning/export") harden the admission/custody state machine and formally reverse two recorded v1 scope exclusions. F16 replaces the `isSealed` boolean's governing role with a formal three-value `ExhibitClassification` taxonomy. F17 is a documentation/test-only hardening of F12's existing admission gate — it introduces no new runtime mechanism. F18 moves the custodian requirement to intake (the `MARKED` transition). F19 converts unilateral custody transfer into a two-phase propose/confirm ledger model. F20 extends server-side role enforcement (already applied to rulings, jury finalization, and discrepancy acknowledgment) to every write action in the system via a single permission matrix, formally superseding the PRD's prior "production-grade auth hardening out of scope" note for *authorization* (authentication remains out of scope). F21 adds a judge-facing pending-ruling queue, reusing F2's existing service function with one additive read-time join. F22 reverses the single-case v1 scope assumption, adding a case selector with no schema change (case-scoping foreign keys already existed). F23 adds immutable version numbering and real PDF export to jury packages, introducing the project's first new runtime dependency since the original tech-stack lock-in. None of F16–F23 alters the behavior specified for F0–F15 in this document; all changes are additive to the schema, API surface, and error catalog described in `Y0`–`Y3`.

**F24 (added for Phase 8: "UI Redesign and Write-Action Coverage") adds functional detail for one new feature and amends four existing screen features.** F24 itself is new: the first UI surface for two backend write actions (`recordRuling`, `recordCustodyTransfer`) that existed only as service functions since early phases, introducing no new endpoint and no new schema. Alongside F24, this phase amends: F8 (Trial Command Center) with per-status exhibit counts, a new custody-by-custodian aggregate, and a severity-ranked "Needs your attention" feed combining four existing discrepancy/objection rule sources — this deliberately and traceably supersedes Phase 5's "strictly passive/read-only monitoring" success criterion for the feed's inline actions only, every other Command Center panel remains read-only; F9 (Case Workspace) with a derived Jury Package eligibility column (`Included`/`Not eligible`/`Blocked`) computed from existing jury-package membership/exclusion data; F10 (Exhibit Detail) with a three-card right rail (Objection, Chain of Custody, Jury Package checklist) and header-level write actions, all reading the exhibit's existing `getExhibitHistory` payload; and F11 (Jury Package Workspace) with a Blockers/Clean card layout replacing the prior flat table, a progress indicator, and a new lightweight "Request finalization from Clerk" notification action (two new nullable fields on `JuryPackage`, no new ledger event type). None of F8–F11's amendments alter the server-side validation, state-machine, or role-enforcement behavior already specified for F1–F7, F12–F23 in this document — every write F24 surfaces, and every read F8–F11 add, resolves to an existing or minimally-extended service-layer function.

This document is written for developers implementing JudicialSync and assumes familiarity with the PRD's feature priorities and the project's demo-first context (seeded data, no production auth, single-case scope as of Phase 7 — multi-case as of Phase 7.1's F22).

---

## How to Read This Document

- **Feature chunks (`F00`–`F24`)** map 1:1 to PRD features F0–F24. Each chunk is self-contained (description, process, inputs/outputs, validation, errors) but defers full DDL to `Y0-schema.md` and full endpoint contracts to `Y1-api.md`. F12–F15 (Phase 7), F16–F23 (Phase 7.1), and F24 (Phase 8) additionally cross-reference the earlier chunks whose behavior they extend or gate, rather than restating or altering that behavior in place. F8–F11 (Phase 8 amendments) are edited in place with `added Phase 8`/`amended Phase 8` annotations marking exactly what changed, so the pre-Phase-8 behavior remains traceable within the same chunk rather than requiring a diff against a prior version.
- **Cross-feature chunks (`Y0`–`Y3`)** consolidate schema, API, error catalog, and integrations so there is one canonical definition of each, referenced (not duplicated) by every feature chunk.
- **IDs:** Feature IDs (`F0`–`F24`) match the PRD exactly. Database entity names use `PascalCase` (Prisma model convention). API paths use `kebab-case`. Event types use `SCREAMING_SNAKE_CASE`.
- **Cross-references** appear as `see F03 §Process step 2` or `see Y0-schema.md §Event Ledger`.
- **"Derived"** means a value is computed/projected from the event ledger at write-time or read-time and must never be treated as independently editable ground truth.

---

## Cross-Cutting Terminology

These terms recur across multiple feature chunks and are defined once here to avoid drift.

- **Event Ledger (`ExhibitEvent`):** The single append-only table recording every status change, objection, ruling, and custody transfer for every exhibit. Rows are immutable once written — never updated, never deleted. This is the system's ground truth (see `Y0-schema.md` §Event Ledger).
- **Current-State Projection:** A denormalized, derived table (`ExhibitCurrentState`, `ObjectionCurrentState`, `CustodyCurrentState`, `DiscrepancyFlag`) recomputed from the event ledger on every relevant write. Projections exist purely for fast reads; if a projection table were dropped and rebuilt by replaying the ledger in order, the result must be identical. UI screens and assistant tools read projections for "current" questions and the ledger directly for "history" questions.
- **Service Layer:** The single set of typed TypeScript functions (e.g., `getExhibits`, `getCustodian`, `getUnresolvedObjections`, `recordEvent`, `computeJuryPackage`) that is the *sole* entry point for both UI screens (via API routes) and the Pivota Assistant (via tool wrappers). No screen and no assistant tool queries Prisma directly — all access funnels through this layer so that a UI screen and an assistant answer can never diverge.
- **Objection Thread:** The logical lifecycle of a single objection, beginning with an `OBJECTION_RAISED` event and optionally closed by a `RULING_RECORDED` event referencing the same `objection_id`. A single exhibit may have multiple independent, concurrently-open objection threads.
- **Discrepancy:** A system-detected mismatch between what the current-state projection shows and what it logically should show (e.g., admitted exhibit with no custodian of record). Discrepancies are computed by rule, not manually flagged, and persist as `DiscrepancyFlag` rows until resolved or explicitly acknowledged (acknowledgment itself is a ledger event — see F6).
- **Citation:** A reference embedded in every Pivota Assistant factual claim, pointing to a specific `ExhibitEvent.id` (or current-state projection row id) and its timestamp. An answer with no citation is only valid when it is an explicit "I don't have that information" response.
- **Role:** One of `JUDGE`, `CHAMBERS_STAFF`, `DEPUTY`, `CLERK`, `ATTORNEY`, `ADMIN` — see §Role-Based Visibility below. Assigned per seeded `User` row; the demo uses a role switcher (no production auth) per PROJECT.md scope.
- **Sealed Exhibit:** An exhibit flagged `is_sealed = true` at creation (e.g., sidebar/in-camera material). Sealed exhibits are excluded from both UI queries and assistant tool results for roles outside the visibility set defined below, with no indication to the excluded role that a sealed record even exists (not just redacted content). **As of Phase 7.1 (F16):** `isSealed` is retained as a field but is now a write-once mirror derived from the new `ExhibitClassification` taxonomy at exhibit-creation time (`isSealed = classification !== 'TRIAL'`) — it is never independently set after this phase. The role-visibility gate below continues to read `isSealed` and is therefore unaffected in its outputs; see `F16-exhibit-classification-taxonomy.md` for the full rationale.
- **Tool-Calling (Assistant):** The Pivota Assistant answers exclusively via LLM tool-calls that are thin 1:1 wrappers around service-layer functions (see F7, `Y1-api.md` §Assistant). No retrieval-augmented generation, no embeddings, no vector search — the data is small, structured, and exact-citation-critical.
- **Exhibit Classification (`ExhibitClassification`):** The three-value intake-time taxonomy (`TRIAL`, `CHAMBERS_EX_PARTE`, `SEALED`) introduced by Phase 7.1's F16, superseding the `isSealed` boolean as the authoritative sensitivity classification. Immutable after intake in this version — no reclassification flow is specified. See `F16-exhibit-classification-taxonomy.md`.
- **Custody Proposal / Confirmation:** The two-phase custody handoff model introduced by Phase 7.1's F19 — a `CUSTODY_TRANSFER_PROPOSED` event naming an intended receiver, followed by that same receiver's own `CUSTODY_TRANSFER_CONFIRMED` event. `CustodyCurrentState.currentCustodianUserId` changes only on confirmation, never on proposal. See `F19-custody-handoff-confirmation.md`.
- **Permission Matrix:** The single, explicit table (Phase 7.1's F20) governing which `Role` may perform which write action system-wide, enforced server-side by resolving the acting user's role from the `User.role` DB column via `actorUserId` — never a client-supplied role claim. See `F20-server-side-role-enforcement-matrix.md`.
- **Severity Tier (Phase 8, F08):** One of `CRITICAL`/`HIGH`/`PENDING`/`MEDIUM`, assigned to each Command Center "Needs your attention" entry by a fixed precedence rule combining four existing discrepancy/objection rule sources. See `F08-trial-command-center-screen.md` §Process step 4.
- **Jury Package Eligibility (Phase 8, F9/F10):** A per-exhibit derived state — `Included`/`Not eligible`/`Blocked` — computed from an exhibit's membership (or absence) in the case's most-recently-computed `JuryPackage`. Surfaced as a Case Workspace column (F9) and an Exhibit Detail checklist card (F10); both compute it identically. See `F09-case-workspace-screen.md` §Process step 3.
- **Finalization Request (Phase 8, F11):** A lightweight, auditable notification — timestamp plus requesting user, stored on `JuryPackage` — recorded when a role without finalize authority (per F20) asks a finalize-authorized role to finalize the current draft. Confers no authority and bypasses no gate. See `F11-jury-package-workspace-screen.md` §Process steps 7–8.

### Role-Based Visibility

| Role | Sees Sealed Exhibits? | Notes |
|---|---|---|
| `JUDGE` | Yes | Full visibility, including chambers-only annotations |
| `CHAMBERS_STAFF` | Yes | Mirrors judge visibility |
| `ADMIN` | Yes | Compliance/audit review requires full visibility |
| `DEPUTY` | No | Operational role; sealed material is chambers-restricted |
| `CLERK` | No | Maintains official record but not sealed/in-camera content |
| `ATTORNEY` | No | Unless individually granted access via a future ACL (out of scope for demo — default deny) |

This table is the single source of truth for role scoping and is applied identically by every API route and every assistant tool (see F7 §Validation, `Y2-errors.md` §Authorization).

---

## Master Table of Contents

| Chunk | Contents |
|---|---|
| `00-header.md` | This file — scope, conventions, shared terminology |
| `F00-exhibit-workspace-data-model.md` | Exhibit identity + event ledger foundation |
| `F01-exhibit-status-display.md` | Admission-lifecycle status projection + display |
| `F02-objection-ruling-tracking.md` | Objection logging + ruling recording |
| `F03-custody-tracking.md` | Chain-of-custody transfer ledger + current custodian |
| `F04-exhibit-search.md` | Multi-criteria exhibit search/filter |
| `F05-jury-ready-exhibit-list-generation.md` | Jury-eligible exhibit computation, gated |
| `F06-discrepancy-identification.md` | Automated cross-domain discrepancy rules |
| `F07-pivota-assistant.md` | Tool-calling NL assistant with citations |
| `F08-trial-command-center-screen.md` | Ambient live trial-activity view |
| `F09-case-workspace-screen.md` | Case-level exhibit browsing screen |
| `F10-exhibit-detail-view-screen.md` | Single-exhibit chronological timeline screen |
| `F11-jury-package-workspace-screen.md` | Curated jury package handoff screen |
| `F12-admission-integrity-gating.md` | Pre-write admission gate (unresolved objection / no custodian) |
| `F13-jury-package-ex-parte-sealed-exclusion.md` | Hard structural exclusion of sealed/ex-parte exhibits from jury packages |
| `F14-discrepancy-acknowledgment-transparency.md` | UI visibility of acknowledgment role gating + audit trail (no new data) |
| `F15-courtroom-usability-fixes.md` | Case Workspace/assistant/header/activity-feed client-rendering fixes |
| `F16-exhibit-classification-taxonomy.md` | Intake-time TRIAL/CHAMBERS_EX_PARTE/SEALED taxonomy, supersedes `isSealed` boolean |
| `F17-objection-admission-state-machine-hardening.md` | F12 hardening/clarification — no new runtime mechanism |
| `F18-custodian-required-at-intake.md` | Custodian required atomically at the MARKED transition |
| `F19-custody-handoff-confirmation.md` | Two-phase custody propose/confirm ledger model |
| `F20-server-side-role-enforcement-matrix.md` | Full server-side permission matrix for every write action |
| `F21-pending-ruling-queue.md` | Judge-facing oldest-first unresolved-objection queue |
| `F22-multi-case-support-case-selector.md` | Case list/selector, enforced case-scoped isolation |
| `F23-versioned-jury-packages-pdf-export.md` | Immutable version numbering + real PDF export for jury packages |
| `F24-write-action-ui-coverage.md` | First UI surface for existing recordRuling/recordCustodyTransfer services — no new endpoint or schema |
| `Y0-schema.md` | Full database DDL (Prisma schema) |
| `Y1-api.md` | Consolidated REST API endpoint catalog |
| `Y2-errors.md` | Cross-feature error catalog |
| `Y3-integrations.md` | External integration points |

---
## F00: Exhibit Workspace (Data Model)

**Description:** The foundational data model for JudicialSync: exhibit identity records plus the append-only event ledger that is the sole source of truth for every status change, objection, ruling, and custody transfer. Every other feature (F1–F11) reads through this model via the service layer — nothing else in the system works without it. This feature also owns seed-data generation for the demo scenario.

**Terminology:**
- **Exhibit:** The root identity record — ID, description, source, offering party, associated witness. Holds *no* status, custody, or ruling fields; those are entirely derived from the ledger (see `00-header.md` §Current-State Projection).
- **Case:** The single trial/proceeding scoping all exhibits, events, and users for this demo (single-case scope per PROJECT.md).
- **ExhibitEvent:** One immutable row per status change, objection, ruling, or custody transfer. See `Y0-schema.md` §Event Ledger for full DDL.
- **Sequence Number:** A per-exhibit monotonically increasing integer (`sequence_no`) stamped on every event at write time, guaranteeing a deterministic replay order independent of clock skew.

**Sub-features:**
- Exhibit identity record creation and retrieval
- Append-only event ledger (single table, discriminated by `event_type`)
- Current-state projection tables, recomputed on every ledger write
- Deterministic seed-data loader with deliberately planted edge cases

**Process:**
1. At seed/demo-load time, the system creates one `Case` row and a seeded `User` row per role (`JUDGE`, `CHAMBERS_STAFF`, `DEPUTY`, `CLERK`, `ATTORNEY`, `ADMIN`).
2. The seed loader creates `Exhibit` rows for a realistic multi-exhibit trial (identity fields only — no status fields exist to set).
3. For each exhibit, the seed loader calls the same `recordEvent()` service function the live UI uses, appending its full plausible history (e.g., `STATUS_CHANGE` → marked, offered, admitted) as ordered `ExhibitEvent` rows with realistic timestamps.
4. After each `recordEvent()` call, the service layer synchronously recomputes the relevant current-state projection row(s) (`ExhibitCurrentState`, `ObjectionCurrentState`, `CustodyCurrentState`) for that exhibit — projections are never stale between writes.
5. The seed loader deliberately includes at least: one exhibit with an unresolved objection (no `RULING_RECORDED` event closes the thread), one exhibit admitted with no `CUSTODY_TRANSFER` event ever recorded, and one exhibit with an unresolved objection that is otherwise eligible for the jury package (triggers F6 discrepancy rules).
6. At any later write (live demo interaction), `recordEvent()` is the only path that creates `ExhibitEvent` rows — there is no direct update path to current-state tables from the UI or assistant.
7. On service-layer startup (or on demand via an admin utility), projections can be fully rebuilt by replaying `ExhibitEvent` rows in `sequence_no` order per exhibit — used to verify projection/ledger consistency (see Non-Functional Requirements §Auditability in PRD).

**Inputs:**
- `caseNumber` (string, required, seed-time only): Human-readable case identifier (e.g., "2026-CR-0142")
- `exhibitLabel` (string, required): Exhibit marking label (e.g., "Exhibit 14", "Gov't Ex. 7")
- `description` (string, required): Plain-language description of the exhibit
- `source` (string, optional): Where/whom the exhibit originated from
- `offeringParty` (enum: `PLAINTIFF` | `PROSECUTION` | `DEFENSE`, required)
- `associatedWitness` (string, optional): Witness name tied to the exhibit's offering
- `isSealed` (boolean, default `false`): Governs role-based visibility (see `00-header.md` §Role-Based Visibility)

**Outputs:**
- `Exhibit` record with generated `id`, all identity fields, `caseId`, `createdAt`
- Confirmation that initial `ExhibitCurrentState` row exists (status defaults to `MARKED` only once an initial `STATUS_CHANGE` event is recorded — an exhibit with zero events has no current-state row and is reported as "not yet entered into evidence")

**Validation:**
- `exhibitLabel` must be unique within a `caseId`
- `offeringParty` must be one of the three enum values — reject with 422 otherwise
- `description` must be non-empty, max 1000 characters
- An `Exhibit` cannot be created with any status/custody field directly — the API surface for exhibit creation accepts only identity fields; status is set exclusively via a subsequent `recordEvent()` call (F1)
- Seed loader must fail fast (abort entire seed transaction) if fewer than 1 unresolved objection, 1 custody gap, and 1 jury-package discrepancy are present in the generated data — enforced via a post-seed assertion, not manual review

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| Duplicate `exhibitLabel` within case | 409 | EXHIBIT_LABEL_CONFLICT | "An exhibit with this label already exists in this case" |
| Invalid `offeringParty` value | 422 | VALIDATION_ERROR | "offeringParty must be one of: PLAINTIFF, PROSECUTION, DEFENSE" |
| Seed assertion failure (too-clean data) | 500 | SEED_INTEGRITY_FAILURE | "Seed data failed required edge-case assertions" |
| Exhibit not found | 404 | EXHIBIT_NOT_FOUND | "No exhibit found with the given ID" |

**API Surface (this feature):** see `Y1-api.md` §Exhibits for `POST /api/exhibits`, `GET /api/exhibits/:id`.

**Schema Surface (this feature):** owns tables `Case`, `User`, `Exhibit`, `ExhibitEvent` (the ledger) — see `Y0-schema.md` §Core Entities and §Event Ledger.
## F01: Exhibit Status Display

**Description:** Provides the at-a-glance current lifecycle status of any exhibit, derived entirely from the event ledger's `STATUS_CHANGE` events rather than any mutable field. Status is guaranteed identical across every screen and the assistant because all consumers read the same `ExhibitCurrentState` projection.

**Terminology:**
- **Admission Lifecycle:** The ordered set of statuses an exhibit moves through: `MARKED` → `OFFERED` → `OBJECTED` → (`ADMITTED` | `EXCLUDED` | `WITHDRAWN`).
- **Status Transition:** A single `STATUS_CHANGE` event moving an exhibit from one lifecycle status to the next (or to a terminal status).

**Sub-features:**
- Recording a status transition (append-only)
- Deriving and serving current status from the projection
- Consistent visual status indicator shared across Command Center (F8), Case Workspace (F9), Exhibit Detail (F10), and Jury Package (F11)

**Process:**
1. A courtroom deputy or clerk records a status transition via the UI (or, in the demo, the seed loader does so programmatically).
2. The API route validates the request and calls `recordEvent({ exhibitId, eventType: 'STATUS_CHANGE', payload: { fromStatus, toStatus }, actorUserId })`.
3. The service layer validates that `fromStatus` matches the exhibit's current derived status before accepting the transition (prevents out-of-order writes from two simultaneous clients).
4. The service layer appends the `ExhibitEvent` row (immutable, with `sequence_no` and `recorded_at`).
5. The service layer synchronously updates `ExhibitCurrentState.currentStatus`, `lastStatusEventId`, and `lastStatusAt` for that exhibit.
6. Any open UI screen polling the exhibit (or case) endpoint receives the updated status on its next poll cycle (3–5s interval, see `Y3-integrations.md` §Live Sync).
7. The Pivota Assistant, when asked about this exhibit's status, calls the identical `getExhibitStatus(exhibitId)` service function and so returns the same value with a citation to `lastStatusEventId`.

**Inputs:**
- `exhibitId` (string/UUID, required)
- `toStatus` (enum: `MARKED` | `OFFERED` | `OBJECTED` | `ADMITTED` | `EXCLUDED` | `WITHDRAWN`, required)
- `actorUserId` (string/UUID, required): the user recording the transition
- `notes` (string, optional): free-text context stored in the event payload

**Outputs:**
- Updated `ExhibitCurrentState` row: `{ exhibitId, currentStatus, lastStatusEventId, lastStatusAt }`
- The newly created `ExhibitEvent` row (returned to the caller for immediate UI feedback, including its `id` for citation use)

**Validation:**
- `toStatus` must be a valid forward transition from the exhibit's current status per the admission-lifecycle state machine (see table below) — invalid/backward transitions are rejected, not silently coerced
- An exhibit with zero prior `STATUS_CHANGE` events only accepts `toStatus = MARKED` as its first transition
- `OBJECTED` is a valid status only while at least one `ObjectionCurrentState` row for the exhibit is `UNRESOLVED` (cross-checked against F2's projection)
- Terminal statuses (`ADMITTED`, `EXCLUDED`, `WITHDRAWN`) reject any further `STATUS_CHANGE` event — once terminal, status is final for the demo's scope (re-opening an admitted exhibit is out of scope)

**Allowed Transitions:**
| From | To |
|---|---|
| (none) | MARKED |
| MARKED | OFFERED |
| OFFERED | OBJECTED, ADMITTED, WITHDRAWN |
| OBJECTED | ADMITTED, EXCLUDED, WITHDRAWN |

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| Invalid transition (e.g., MARKED → ADMITTED) | 422 | INVALID_STATUS_TRANSITION | "Cannot transition from {fromStatus} to {toStatus}" |
| Transition attempted on terminal status | 409 | STATUS_FINALIZED | "Exhibit status is final and cannot be changed" |
| Concurrent write conflict (stale fromStatus) | 409 | STATUS_CONFLICT | "Exhibit status has changed since this view was loaded — refresh and retry" |
| Exhibit not found | 404 | EXHIBIT_NOT_FOUND | "No exhibit found with the given ID" |

**API Surface (this feature):** see `Y1-api.md` §Status for `POST /api/exhibits/:id/events/status`, `GET /api/exhibits/:id/status`.

**Schema Surface (this feature):** writes `ExhibitEvent` (type `STATUS_CHANGE`); maintains `ExhibitCurrentState` — see `Y0-schema.md` §Event Ledger, §Current-State Projections.
## F02: Objection and Ruling Tracking

**Description:** Logs objections raised against specific exhibits and the judicial rulings that resolve them, each as independent, immutable ledger events. Multiple objections against the same exhibit are tracked as separate, independently-resolvable threads — never collapsed into a single "last ruling" field.

**Terminology:**
- **Objection Thread:** The lifecycle from an `OBJECTION_RAISED` event to its resolving `RULING_RECORDED` event, linked by a shared `objectionId` (generated at raise-time, stored in both events' payloads).
- **Ruling Disposition:** One of `SUSTAINED`, `OVERRULED`, `RESERVED`. A `RESERVED` ruling does not close the objection thread — it remains `UNRESOLVED` until a subsequent `RULING_RECORDED` event supersedes it with `SUSTAINED` or `OVERRULED`.

**Sub-features:**
- Log an objection (party, grounds, timestamp) against a specific exhibit
- Record a ruling against a specific objection thread
- Query all unresolved objections case-wide
- Feed objection resolution state into F1 (status gating) and F6 (discrepancy detection)

**Process:**
1. An attorney objects during proceedings; the deputy/clerk records it via `recordEvent({ exhibitId, eventType: 'OBJECTION_RAISED', payload: { objectionId: <new UUID>, objectingParty, grounds }, actorUserId })`.
2. The service layer appends the `ExhibitEvent` row and creates a new `ObjectionCurrentState` row: `{ objectionId, exhibitId, status: 'UNRESOLVED', objectingParty, grounds, raisedEventId, raisedAt }`.
3. The service layer checks F1's state machine — if the exhibit's current status is `OFFERED`, it is eligible to transition to `OBJECTED` (a separate explicit `STATUS_CHANGE` event, not automatic, per F1 §Process step 1 — the deputy records both).
4. When the judge rules, the deputy/clerk records `recordEvent({ exhibitId, eventType: 'RULING_RECORDED', payload: { objectionId, disposition }, actorUserId })`.
5. The service layer validates the referenced `objectionId` exists and is currently `UNRESOLVED` on this exhibit.
6. If `disposition` is `SUSTAINED` or `OVERRULED`, the service layer updates `ObjectionCurrentState.status` to that disposition and sets `rulingEventId`, `ruledAt` — the thread is now resolved and excluded from "unresolved objections" queries.
7. If `disposition` is `RESERVED`, the thread's `status` remains `UNRESOLVED` but `ObjectionCurrentState` records the reservation event for history/timeline display (F10); it still counts as unresolved for discrepancy purposes (F6).
8. `getUnresolvedObjections(caseId)` — the shared service function — queries `ObjectionCurrentState WHERE status = 'UNRESOLVED'` and is called identically by the Case Workspace (F9), Command Center (F8), and the assistant tool `getUnresolvedObjections` (F7).

**Inputs — Objection:**
- `exhibitId` (string/UUID, required)
- `objectingParty` (enum: `PLAINTIFF` | `PROSECUTION` | `DEFENSE`, required)
- `grounds` (string, required, max 500 chars): e.g., "hearsay", "lack of foundation"
- `actorUserId` (string/UUID, required)

**Inputs — Ruling:**
- `objectionId` (string/UUID, required): must reference an existing, currently-unresolved objection thread
- `disposition` (enum: `SUSTAINED` | `OVERRULED` | `RESERVED`, required)
- `actorUserId` (string/UUID, required): must be a `JUDGE`-role user for `SUSTAINED`/`OVERRULED` (demo-level role check, not cryptographic enforcement)

**Outputs:**
- `ObjectionCurrentState` row reflecting the new or updated thread status
- The created `ExhibitEvent` row(s), returned with `id` for citation

**Validation:**
- `grounds` must be non-empty
- An objection can only be raised against an exhibit whose current status (F1) is `OFFERED` or already `OBJECTED` (cannot object to an exhibit not yet offered, or after it has reached a terminal status)
- A ruling's `objectionId` must exist and currently be `UNRESOLVED` — rejects rulings against already-resolved or nonexistent threads
- `actorUserId` recording a `SUSTAINED`/`OVERRULED` ruling must have role `JUDGE` — reject otherwise (demo-level enforcement via seeded role, see `00-header.md` §Role)
- A single exhibit may have N concurrent `UNRESOLVED` objection threads — the schema and queries must never assume at most one

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| Objection raised on exhibit not yet offered | 422 | INVALID_OBJECTION_TARGET | "Cannot raise an objection before the exhibit is offered" |
| Ruling references nonexistent objectionId | 404 | OBJECTION_NOT_FOUND | "No objection found with the given ID" |
| Ruling references already-resolved objection | 409 | OBJECTION_ALREADY_RESOLVED | "This objection has already been ruled on" |
| Non-judge attempts SUSTAINED/OVERRULED ruling | 403 | ROLE_NOT_PERMITTED | "Only a judge may record a sustained or overruled ruling" |

**API Surface (this feature):** see `Y1-api.md` §Objections for `POST /api/exhibits/:id/events/objection`, `POST /api/objections/:id/ruling`, `GET /api/cases/:id/objections?status=unresolved`.

**Schema Surface (this feature):** writes `ExhibitEvent` (types `OBJECTION_RAISED`, `RULING_RECORDED`); maintains `ObjectionCurrentState` — see `Y0-schema.md` §Event Ledger, §Current-State Projections.
## F03: Custody Tracking

**Description:** Records every custody transfer of a physical or digital exhibit as a discrete, immutable ledger event, and derives both the current custodian and the full chain-of-custody history from that sequence — never from a single mutable "current holder" field, per the chain-of-custody doctrine requiring unbroken, documented, timestamped transfers.

**Terminology:**
- **Custody Transfer:** A single `CUSTODY_TRANSFER` event recording `fromCustodian`, `toCustodian`, timestamp, and reason.
- **Custody Gap:** A period where an exhibit's current status implies it should have a custodian of record but no `CUSTODY_TRANSFER` event exists (or the chain has a logical break) — feeds directly into F6 discrepancy detection.

**Sub-features:**
- Record a custody transfer (who → who, when, why) as a ledger event
- Instant "who currently has this exhibit" lookup via projection
- Full chronological chain-of-custody retrieval for any exhibit
- Feed custody completeness into F6 discrepancy rules

**Process:**
1. A courtroom deputy physically receives or hands off an exhibit and records `recordEvent({ exhibitId, eventType: 'CUSTODY_TRANSFER', payload: { fromCustodianUserId, toCustodianUserId, reason }, actorUserId })`.
2. The service layer validates that `fromCustodianUserId` matches the exhibit's current derived custodian (per `CustodyCurrentState`) — or is `null` if this is the exhibit's first-ever custody event (e.g., initial intake).
3. The service layer appends the immutable `ExhibitEvent` row.
4. The service layer updates `CustodyCurrentState`: `{ exhibitId, currentCustodianUserId: toCustodianUserId, since: recordedAt, lastEventId }`.
5. `getCustodian(exhibitId)` — the shared service function — reads only `CustodyCurrentState`, used identically by Case Workspace (F9), Exhibit Detail (F10), and the assistant's `getCustodian` tool (F7).
6. `getCustodyHistory(exhibitId)` reads the full ordered set of `CUSTODY_TRANSFER` events from the ledger for Exhibit Detail's timeline (F10) and the assistant's "what happened to Exhibit X" answers.
7. On every `recordEvent` write of type `CUSTODY_TRANSFER` or `STATUS_CHANGE`, the service layer re-evaluates the admitted-no-custodian discrepancy rule (F6) for that exhibit.

**Inputs:**
- `exhibitId` (string/UUID, required)
- `fromCustodianUserId` (string/UUID, nullable): required to match current projection unless this is the first transfer
- `toCustodianUserId` (string/UUID, required)
- `reason` (string, optional, max 300 chars): e.g., "transferred to clerk for jury package prep"
- `actorUserId` (string/UUID, required): the user recording the transfer (may differ from either custodian, e.g., a clerk logging on behalf of a deputy)

**Outputs:**
- Updated `CustodyCurrentState` row
- The created `ExhibitEvent` row, with `id` for citation
- Full custody chain array (on `getCustodyHistory`): ordered list of `{ fromCustodian, toCustodian, timestamp, reason, eventId }`

**Validation:**
- `fromCustodianUserId` must exactly match the exhibit's current `CustodyCurrentState.currentCustodianUserId` (or both must be `null`/absent for the first-ever transfer) — prevents recording a transfer from someone who doesn't currently have it
- `toCustodianUserId` must reference an existing, active `User`
- `fromCustodianUserId` and `toCustodianUserId` must not be identical (no-op transfers are rejected)
- An exhibit may have zero custody events even after reaching `ADMITTED` status — this is valid at the schema level but is exactly the condition F6 flags as a discrepancy (by design, to demonstrate detection)

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| fromCustodian mismatch with current projection | 409 | CUSTODY_CHAIN_BROKEN | "Recorded custodian does not match the exhibit's current custodian" |
| toCustodian references invalid/inactive user | 422 | INVALID_CUSTODIAN | "toCustodianUserId does not reference a valid active user" |
| from and to custodian identical | 422 | NO_OP_TRANSFER | "fromCustodianUserId and toCustodianUserId must differ" |
| Exhibit not found | 404 | EXHIBIT_NOT_FOUND | "No exhibit found with the given ID" |

**API Surface (this feature):** see `Y1-api.md` §Custody for `POST /api/exhibits/:id/events/custody`, `GET /api/exhibits/:id/custodian`, `GET /api/exhibits/:id/custody-history`.

**Schema Surface (this feature):** writes `ExhibitEvent` (type `CUSTODY_TRANSFER`); maintains `CustodyCurrentState` — see `Y0-schema.md` §Event Ledger, §Current-State Projections.
## F04: Exhibit Search

**Description:** Enables fast, combinable lookup of exhibits by ID, description/keyword, status, witness, or date, surfaced both in the Case Workspace UI (F9) and as an assistant tool (F7), so any authorized user can locate relevant evidence without scanning the full case exhibit list.

**Terminology:**
- **Search Criteria:** The combinable filter set — `exhibitId`, `keyword`, `status`, `witness`, `dateFrom`/`dateTo` (filtering against the exhibit's most recent relevant event timestamp).

**Sub-features:**
- Keyword search across exhibit label, description, and source
- Filter by current status (reads `ExhibitCurrentState`)
- Filter by associated witness
- Filter by date range (filters on `ExhibitEvent.recordedAt` for the relevant event type, e.g., "admitted yesterday" filters `STATUS_CHANGE` events where `toStatus = ADMITTED`)
- Filters are combinable (AND semantics) in a single query

**Process:**
1. A user enters search criteria in the Case Workspace search bar (F9), or the assistant resolves a natural-language question (e.g., "admitted exhibits from witness Smith") into equivalent structured criteria for its `searchExhibits` tool call.
2. The client (or assistant tool wrapper) calls `searchExhibits({ caseId, keyword?, status?, witness?, dateFrom?, dateTo? })`.
3. The service layer applies role-based visibility filtering first (excluding sealed exhibits per `00-header.md` §Role-Based Visibility for the requesting user's role), then applies the supplied criteria as an AND-combined query across `Exhibit` and `ExhibitCurrentState`.
4. Results are returned ordered by `exhibitLabel` ascending by default (configurable sort is out of scope for the demo).
5. If `dateFrom`/`dateTo` is supplied without a specific event-type hint, the search defaults to filtering on the most recent `STATUS_CHANGE` event per exhibit (i.e., "changed within this range"), matching the named demo question "admitted yesterday" when combined with `status = ADMITTED`.

**Inputs:**
- `caseId` (string/UUID, required)
- `keyword` (string, optional): matched against `exhibitLabel`, `description`, `source` (case-insensitive substring match)
- `status` (enum, optional): one of the F1 status values
- `witness` (string, optional): exact or substring match against `associatedWitness`
- `dateFrom` (ISO 8601 datetime, optional)
- `dateTo` (ISO 8601 datetime, optional)
- `requestingUserRole` (enum, required, derived from session): used for visibility filtering, not a user-supplied filter

**Outputs:**
- Array of matching exhibits, each including identity fields plus the current-state summary (`currentStatus`, `currentCustodian`, open discrepancy flags) needed for Case Workspace row rendering without a second round-trip

**Validation:**
- At least one search criterion must be supplied (an empty search request returns a 422 rather than silently returning the full case list — the full list is a separate `getExhibits(caseId)` call used by F9's default view)
- `dateFrom` must be ≤ `dateTo` when both are supplied
- `status`, if supplied, must be a valid F1 status enum value

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| No search criteria supplied | 422 | EMPTY_SEARCH_CRITERIA | "At least one search criterion is required" |
| dateFrom after dateTo | 422 | INVALID_DATE_RANGE | "dateFrom must not be after dateTo" |
| Invalid status filter value | 422 | VALIDATION_ERROR | "status must be a valid exhibit status value" |

**API Surface (this feature):** see `Y1-api.md` §Search for `GET /api/cases/:id/exhibits/search`.

**Schema Surface (this feature):** read-only against `Exhibit`, `ExhibitCurrentState`, `ExhibitEvent` — see `Y0-schema.md` §Core Entities, §Current-State Projections. Introduces no new tables.
## F05: Jury-Ready Exhibit List Generation

**Description:** Computes the authoritative set of exhibits eligible for the jury package directly from the current-state projections, with discrepancy detection (F6) acting as a hard gate before any package can be finalized — detection runs before and blocks generation of a finalized package, it never follows it as a post-hoc check.

**Terminology:**
- **Jury-Eligible Exhibit:** An exhibit whose `currentStatus = ADMITTED`, with zero `OPEN` discrepancy flags.
- **Jury Package:** A named, stateful collection (`DRAFT` or `FINALIZED`) of exhibits assembled for jury handoff.

**Sub-features:**
- Compute the candidate jury-eligible exhibit set from current state
- Run discrepancy detection against the candidate set before allowing finalization
- Support package finalization only when zero open discrepancies remain among included exhibits
- Exportable/curated view for the Jury Package Workspace screen (F11)

**Process:**
1. A deputy/clerk initiates jury package preparation for the case; the service layer calls `computeJuryCandidates(caseId)`, which queries `ExhibitCurrentState WHERE currentStatus = 'ADMITTED'`.
2. For each candidate, the service layer calls `evaluateDiscrepancies(exhibitId)` (F6) — this is not optional and cannot be bypassed by any code path that creates or finalizes a `JuryPackage`.
3. The service layer creates (or updates) a `JuryPackage` row with `status = 'DRAFT'` and a `JuryPackageExhibit` row per candidate, each annotated with its current discrepancy status (`CLEAN` or `FLAGGED`) at computation time.
4. The deputy/clerk reviews flagged exhibits in the Jury Package Workspace (F11) and either resolves the underlying issue (e.g., records the missing custody transfer) or explicitly acknowledges the discrepancy via the F6 acknowledgment flow.
5. When the deputy/clerk requests finalization, the service layer re-runs `evaluateDiscrepancies` fresh (not from the cached `DRAFT`-time annotation) for every exhibit currently in the package.
6. If any included exhibit has a discrepancy with status `OPEN` (not `ACKNOWLEDGED` or `RESOLVED`), finalization is rejected outright — the package remains `DRAFT` and the blocking exhibits are returned to the caller.
7. If zero `OPEN` discrepancies remain among included exhibits, the service layer sets `JuryPackage.status = 'FINALIZED'`, `finalizedAt`, `finalizedBy`, and the package becomes read-only/exportable.
8. The assistant's `getJuryPackageStatus` tool (F7) queries the same `JuryPackage`/`JuryPackageExhibit` rows, so "is Exhibit 14 in the jury package" is answered identically to what F11 displays.

**Inputs:**
- `caseId` (string/UUID, required)
- `actorUserId` (string/UUID, required): must be role `DEPUTY`, `CLERK`, or `ADMIN` to initiate or finalize
- `acknowledgedDiscrepancyIds` (array of string/UUID, optional, used only at finalization): discrepancies the actor has explicitly acknowledged (see F6 §Process) prior to this finalization attempt

**Outputs:**
- `JuryPackage` record: `{ id, caseId, status, createdAt, finalizedAt?, finalizedBy? }`
- `JuryPackageExhibit[]`: each with `{ exhibitId, exhibitLabel, discrepancyStatus, addedAt }`
- On a blocked finalization attempt: the list of blocking `DiscrepancyFlag` records (id, exhibitId, ruleCode, details) so the UI can surface exactly what must be resolved

**Validation:**
- Only `ADMITTED` exhibits may ever appear in `JuryPackageExhibit` — the computation never includes `MARKED`, `OFFERED`, `OBJECTED`, `EXCLUDED`, or `WITHDRAWN` exhibits, with no manual override path
- Finalization is rejected if any included exhibit has a discrepancy with status `OPEN` at finalization time, even if it was `CLEAN` when the package was computed in step 3 (re-evaluation is mandatory, not cached)
- A `FINALIZED` package is immutable — no further `JuryPackageExhibit` rows may be added or removed; a new `DRAFT` package must be created for subsequent changes
- `actorUserId` role must be `DEPUTY`, `CLERK`, or `ADMIN` — a `JUDGE`, `CHAMBERS_STAFF`, or `ATTORNEY` role may view but not finalize (demo-level role enforcement)

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| Finalization attempted with open discrepancies | 409 | JURY_PACKAGE_DISCREPANCIES_OPEN | "Cannot finalize: {n} exhibit(s) have unresolved discrepancies" |
| Finalization attempted on already-FINALIZED package | 409 | JURY_PACKAGE_ALREADY_FINALIZED | "This jury package has already been finalized" |
| Non-authorized role attempts finalize | 403 | ROLE_NOT_PERMITTED | "Only courtroom deputy, clerk, or admin roles may finalize a jury package" |
| No admitted exhibits exist in the case | 422 | NO_ELIGIBLE_EXHIBITS | "No admitted exhibits are available to form a jury package" |

**API Surface (this feature):** see `Y1-api.md` §Jury Package for `POST /api/cases/:id/jury-package`, `GET /api/cases/:id/jury-package`, `POST /api/jury-package/:id/finalize`.

**Schema Surface (this feature):** owns `JuryPackage`, `JuryPackageExhibit`; reads `ExhibitCurrentState`, `DiscrepancyFlag` — see `Y0-schema.md` §Jury Package.
## F06: Discrepancy Identification

**Description:** Automatically evaluates each exhibit against a rule set that cross-checks status, objection/ruling, and custody state simultaneously, surfacing mismatches before they become problems. This is the concrete expression of the "operational awareness" differentiator and is the hard gate in front of jury package finalization (F5).

**Terminology:**
- **Discrepancy Rule:** A named, deterministic function `(exhibit, currentState) → DiscrepancyFlag | null`, evaluated against current-state projections (never re-deriving from the raw ledger on every call, for performance — see `Y0-schema.md` §Performance Notes).
- **Discrepancy Flag Status:** `OPEN` (newly detected, unresolved), `ACKNOWLEDGED` (a human has explicitly accepted the risk, recorded as a ledger event), `RESOLVED` (the underlying condition no longer holds, e.g., a custody transfer was subsequently recorded).

**Sub-features:**
- Rule: admitted exhibit with missing/incomplete custody record
- Rule: exhibit eligible for (or included in) jury package despite an unresolved objection
- Extensible rule registry for additional patterns identified during implementation
- Visible surfacing on Case Workspace (F9) and Jury Package Workspace (F11); answerable via the assistant (F7)
- Explicit acknowledgment flow, itself recorded as an immutable ledger event

**Process:**
1. On every write to `ExhibitEvent` affecting status, objections, or custody for a given exhibit (per F1 §Process step 5, F2 §Process steps 2/6/7, F3 §Process step 7), the service layer calls `evaluateDiscrepancies(exhibitId)`.
2. `evaluateDiscrepancies` runs the full rule registry against the exhibit's current-state projections:
   - **Rule `ADMITTED_NO_CUSTODIAN`:** fires when `ExhibitCurrentState.currentStatus = 'ADMITTED'` AND `CustodyCurrentState` has no row (or its `currentCustodianUserId` is null) for that exhibit.
   - **Rule `UNRESOLVED_OBJECTION_JURY_ELIGIBLE`:** fires when `ExhibitCurrentState.currentStatus = 'ADMITTED'` AND at least one `ObjectionCurrentState` row for that exhibit has `status = 'UNRESOLVED'`.
3. For each rule that fires and has no existing `OPEN` or `ACKNOWLEDGED` `DiscrepancyFlag` row for that exhibit+rule pair, the service layer creates a new `DiscrepancyFlag` row with `status = 'OPEN'`, `detectedAt = now()`, and a `details` payload describing the specific mismatch (e.g., which objection is unresolved).
4. For each previously `OPEN` or `ACKNOWLEDGED` flag whose rule condition no longer holds (e.g., a custody transfer was just recorded), the service layer sets `status = 'RESOLVED'`, `resolvedAt = now()`, `resolvedByEventId` referencing the event that resolved it.
5. `getDiscrepancies(caseId)` — the shared service function — returns all `OPEN`/`ACKNOWLEDGED` flags case-wide, consumed identically by Case Workspace (F9), Jury Package Workspace (F11), and the assistant's `getDiscrepancies` tool (F7).
6. A deputy/clerk may explicitly acknowledge an `OPEN` flag (e.g., "custody gap noted, exhibit is a digital-only record with no physical chain required") via `acknowledgeDiscrepancy({ discrepancyFlagId, actorUserId, justification })`, which appends a `DISCREPANCY_ACKNOWLEDGED` ledger event and updates the flag's `status` to `ACKNOWLEDGED`.
7. Acknowledgment does **not** clear the flag from F5's finalization gate by itself in the sense of hiding it — F5 still requires `status != 'OPEN'` (i.e., `ACKNOWLEDGED` or `RESOLVED` both satisfy the gate), but an `ACKNOWLEDGED` flag remains visibly surfaced on every screen as a recorded risk acceptance, never silently dropped.

**Inputs — Evaluation (system-triggered, no user input):**
- `exhibitId` (string/UUID): triggered internally after relevant ledger writes

**Inputs — Acknowledgment (user-triggered):**
- `discrepancyFlagId` (string/UUID, required)
- `actorUserId` (string/UUID, required): must be role `DEPUTY`, `CLERK`, `JUDGE`, or `ADMIN`
- `justification` (string, required, max 500 chars): free-text reason, stored in the ledger event payload for audit

**Outputs:**
- `DiscrepancyFlag[]` for a case or exhibit: `{ id, exhibitId, ruleCode, status, detectedAt, acknowledgedAt?, acknowledgedBy?, resolvedAt?, details }`
- Confirmation of acknowledgment, including the created ledger event id

**Validation:**
- A `DiscrepancyFlag` is never manually created by a user — only the rule engine creates flags; the only user-initiated mutation is acknowledgment
- `justification` is required and non-empty for acknowledgment — an empty-reason acknowledgment is rejected (ensures the audit trail is meaningful for F6's NFR of auditability)
- Acknowledging an already-`RESOLVED` or already-`ACKNOWLEDGED` flag is a no-op that returns the existing state with a 200, not an error (idempotent)
- The rule registry must be checked after every ledger write that could affect its inputs — a missed re-evaluation (e.g., only checking on exhibit-detail page load) is explicitly disallowed; see `Y3-integrations.md` §Internal Triggers

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| Acknowledgment with empty justification | 422 | JUSTIFICATION_REQUIRED | "A justification is required to acknowledge a discrepancy" |
| discrepancyFlagId not found | 404 | DISCREPANCY_NOT_FOUND | "No discrepancy flag found with the given ID" |
| Non-authorized role attempts acknowledgment | 403 | ROLE_NOT_PERMITTED | "This role is not permitted to acknowledge discrepancies" |

**API Surface (this feature):** see `Y1-api.md` §Discrepancies for `GET /api/cases/:id/discrepancies`, `GET /api/exhibits/:id/discrepancies`, `POST /api/discrepancies/:id/acknowledge`.

**Schema Surface (this feature):** owns `DiscrepancyFlag`; writes `ExhibitEvent` (type `DISCREPANCY_ACKNOWLEDGED`); reads `ExhibitCurrentState`, `ObjectionCurrentState`, `CustodyCurrentState` — see `Y0-schema.md` §Discrepancy Detection.
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

**Outputs:**
- Streamed assistant message text
- `citations[]`: array of `{ recordType: 'ExhibitEvent' | 'DiscrepancyFlag' | 'JuryPackageExhibit', recordId, timestamp, label }` attached to the persisted `AssistantMessage`
- Persisted `AssistantConversation`/`AssistantMessage`/`AssistantCitation` rows

**Validation:**
- Every tool call's arguments are validated via zod before reaching the service layer — malformed tool-call arguments (e.g., non-UUID `exhibitId`) are rejected back to the model as a tool error, not passed through to Prisma
- Tool execution must apply the requesting user's role to any visibility-sensitive query exactly as the equivalent UI endpoint would (sealed exhibits excluded identically — see `00-header.md` §Role-Based Visibility); there is no "assistant admin override"
- A response containing a factual claim with zero associated citation is a defect to be caught in testing (see Success Metrics: "0 instances of ungrounded answers") — not merely discouraged but treated as a release blocker
- The five named example questions (admitted-yesterday, unresolved-objections, jury-package-membership, current-custodian, exhibit-history) must each resolve via the tool set above with no gaps requiring a new tool at demo time

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| Tool-call arguments fail zod validation | 400 (tool-level, surfaced to model) | TOOL_ARGS_INVALID | "Invalid arguments for tool {toolName}" |
| Referenced exhibit/case not found inside a tool call | — (tool returns empty/null, model must decline) | — | Model responds: "I don't have that information" |
| LLM provider unavailable/timeout | 503 | ASSISTANT_UNAVAILABLE | "The assistant is temporarily unavailable — please try again" |
| User role lacks visibility into the only matching (sealed) record | — (tool returns empty result set, model must decline) | — | Model responds: "I don't have that information" (never reveals the record's existence) |

**API Surface (this feature):** see `Y1-api.md` §Assistant for `POST /api/assistant/chat` (streaming), `GET /api/assistant/conversations/:id`.

**Schema Surface (this feature):** owns `AssistantConversation`, `AssistantMessage`, `AssistantCitation`; reads (via tools) every projection and ledger table defined across F0–F6 — see `Y0-schema.md` §Assistant.
## F08: Trial Command Center Screen

**Description:** A high-level, ambient live view of trial/exhibit activity designed for a judge or deputy to glance at during proceedings, extended in Phase 8 from a strictly passive monitoring surface into a screen that also surfaces per-status exhibit counts, a custody-by-custodian breakdown, and a severity-ranked "Needs your attention" feed with inline write actions (F24) at the exact point the system has already identified they are needed. **Note — supersedes a prior constraint:** Phase 5 locked in "the Command Center exposes no path to record, edit, or acknowledge anything from that screen — it is strictly passive/read-only monitoring" as a success criterion. Phase 8 deliberately reverses this for the two actions described below (§Sub-features, "Inline write actions"); this is a traceable product decision, not a regression, and every other panel on this screen remains read-only exactly as before.

**Terminology:**
- **Ambient View:** A passive-monitoring screen intentionally free of configuration controls or filters-as-default-state — glance-and-go, not a dashboard to be tuned. Still true of every panel on this screen except the attention feed's inline actions.
- **Severity Tier:** One of `CRITICAL` / `HIGH` / `PENDING` / `MEDIUM`, assigned to each "Needs your attention" entry per the fixed precedence rule in §Process step 5 below.
- **Attention Feed Entry:** One ranked item in the "Needs your attention" feed, sourced from exactly one of the four rule conditions in §Process step 5, each carrying enough context to render its applicable inline action (F24) directly.

**Sub-features:**
- Live-updating summary of recent exhibit activity (recent status changes, pending objections, recent rulings) — unchanged from Phase 5/7
- Per-status exhibit count stat cards: an immediate numeric breakdown of the case's exhibit set by lifecycle status (`MARKED`/`OFFERED`/`OBJECTED`/`ADMITTED`/`EXCLUDED`/`WITHDRAWN`)
- Status-distribution bar visualizing the same breakdown proportionally
- "Custody at a glance" panel: exhibits grouped by current custodian, so a deputy can see who holds what without visiting individual Exhibit Detail pages, including a distinct grouping for exhibits with a currently-pending (unconfirmed) custody transfer (F19)
- Prioritized "Needs your attention" feed, ranked `CRITICAL`/`HIGH`/`PENDING`/`MEDIUM`, newest-first within each tier
- Inline write actions directly on attention-feed entries — "Record ruling" and "Transfer custody"/"Assign custodian" (F24) — so a judge or deputy can resolve the flagged item without leaving the screen
- Jury package summary widget showing current draft/finalized package progress at a glance
- At-a-glance indicators of outstanding discrepancies

**Process:**
1. On load, the client calls the existing `getRecentActivity(caseId, { since })`, `getUnresolvedObjections(caseId)` (F2), and `getDiscrepancies(caseId)` (F6) endpoints, unchanged from Phase 5/7, plus two additions introduced this phase: `getCustodyByCustodian(caseId)` (new) and `getAttentionFeed(caseId)` (new).
2. **Per-status counts:** computed from the same case-wide exhibit/status data already available via `getExhibits(caseId)` (F9) — grouped by `ExhibitCurrentState.currentStatus` — and returned as an additive `statusCounts: Record<ExhibitStatus, number>` field on the existing `GET /api/cases/:id/activity` response (F8). No new endpoint is introduced for this surface, per the architectural preference to avoid redundant round-trips for data the service layer already computes elsewhere.
3. **Custody-by-custodian:** a new service function `getCustodyByCustodian(caseId)` queries `CustodyCurrentState` joined to `User` and `Exhibit`, grouped by `currentCustodianUserId`, and additionally surfaces exhibits with a non-null `pendingTransferToUserId` (F19) under a distinct "pending transfer to {name}" grouping rather than silently folding them into the current custodian's bucket. This did not exist as a service or endpoint before this phase.
4. **Needs-your-attention feed:** a new service function `getAttentionFeed(caseId)` evaluates four independent rule sources, each contributing zero or more entries:
   - **`CRITICAL` — Sealed/ex-parte blocker in jury package:** any `JuryPackageExhibit` row with `status = 'INCLUDED'` whose exhibit's `classification != 'TRIAL'` (a legacy/regression state — see `F13-jury-package-ex-parte-sealed-exclusion.md`). Action offered: link to the Jury Package Workspace's existing "Remove from Package" remediation (F13) — not a new inline action, since F13's exclusion action is itself already role-gated and this feed simply surfaces it sooner.
   - **`HIGH` — Admitted with open objection:** any exhibit with an `OPEN` `DiscrepancyFlag` of `ruleCode = 'UNRESOLVED_OBJECTION_JURY_ELIGIBLE'` (F6) — i.e., `currentStatus = 'ADMITTED'` with at least one `UNRESOLVED` objection thread, a state only reachable via legacy/pre-gate data per F12/F17. Action offered: inline "Record ruling" (F24) against the specific unresolved `objectionId`.
   - **`PENDING` — Pending ruling:** any objection thread with `ObjectionCurrentState.status = 'UNRESOLVED'` whose exhibit's `currentStatus` is `OFFERED` or `OBJECTED` (i.e., **not** already `ADMITTED` — that case is covered by the `HIGH` tier above, so no objection thread is ever counted in both tiers simultaneously). Action offered: inline "Record ruling" (F24).
   - **`MEDIUM` — Admitted, no custodian:** any exhibit with an `OPEN` `DiscrepancyFlag` of `ruleCode = 'ADMITTED_NO_CUSTODIAN'` (F6). Action offered: inline "Transfer custody"/"Assign custodian" (F24).
5. Within each tier, entries are sorted newest-first by the timestamp of the event that produced the underlying condition (`DiscrepancyFlag.detectedAt` for `HIGH`/`MEDIUM`/`CRITICAL`; `ObjectionCurrentState.raisedAt` for `PENDING`). Tiers themselves are never interleaved — every `CRITICAL` entry renders before any `HIGH` entry, and so on, exactly as named in the PRD's fixed precedence (`CRITICAL` > `HIGH` > `PENDING` > `MEDIUM`).
6. The client renders five ambient panels/widgets: "Recent Activity", per-status count cards + distribution bar, "Custody at a Glance", "Needs Your Attention" (with inline actions), and the Jury Package summary widget, plus the existing "Discrepancies" indicator.
7. The client polls all underlying endpoints on the existing fixed interval (3–5 seconds, `Y3-integrations.md` §Live Sync) so a status change, ruling, or custody transfer recorded anywhere — including via this screen's own inline actions (F24) — appears across every open screen without manual refresh.
8. Every panel on this screen except the attention feed's inline actions remains strictly read-only, exactly as Phase 5 established; a "view full details" link-through to F9/F10/F11 is the only other interaction any panel offers.

**Inputs:**
- `caseId` (string/UUID, required, from session)
- `requestingUserRole` (enum, required, from session): applies role-based visibility to all underlying queries identically to every other screen, and additionally governs which inline actions (F24) render on attention-feed entries
- `since` (ISO 8601 datetime, optional, default: start of current trial day): bounds the "recent activity" window, unchanged from Phase 5

**Outputs:**
- `recentActivity[]`: `{ eventId, eventType, exhibitId, exhibitLabel, summary, recordedAt }` — unchanged
- `statusCounts`: `Record<ExhibitStatus, number>` — new, additive field on the existing activity response
- `unresolvedObjections[]`, `discrepancies[]`: per F2/F6 output shapes, unchanged
- `custodyByCustodian[]`: `{ custodianUserId, custodianName, exhibits: Array<{ exhibitId, exhibitLabel, currentStatus }>, pendingTransfersIn: Array<{ exhibitId, exhibitLabel, proposedAt }> }` — new
- `attentionFeed[]`: `{ id, tier: 'CRITICAL'|'HIGH'|'PENDING'|'MEDIUM', ruleCode, exhibitId, exhibitLabel, objectionId?, detectedAt, summary, availableAction: 'RECORD_RULING'|'REMOVE_FROM_PACKAGE'|'TRANSFER_CUSTODY'|null }` — new; `availableAction` is `null` only for the `CRITICAL` tier's link-through case (§Process step 4), never for `HIGH`/`PENDING`/`MEDIUM`

**Validation:**
- This screen issues no write requests of its own beyond the two inline actions wired up by F24 — every other panel's validation rules live entirely in the underlying F1/F2/F3/F6/F13 service functions it calls
- `since`, if supplied, must be a valid ISO 8601 datetime not in the future (unchanged)
- An objection thread must never be counted in both the `HIGH` and `PENDING` attention-feed tiers simultaneously (§Process step 4) — the exhibit's `currentStatus` at evaluation time is the sole disambiguator
- An inline action rendered on an attention-feed entry must resolve to the exact same server-side endpoint and validation F24 specifies — this screen introduces no parallel or abbreviated validation path

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| Invalid `since` parameter | 422 | VALIDATION_ERROR | "since must be a valid past or present datetime" |
| Underlying service query failure (recent activity, objections, or discrepancies) | 500 | COMMAND_CENTER_LOAD_FAILED | "Unable to load trial activity — please retry" |
| `getCustodyByCustodian` query failure | 500 | COMMAND_CENTER_LOAD_FAILED | "Unable to load trial activity — please retry" *(same code — reuses the existing generic Command Center load failure; no new code introduced for this panel)* |
| `getAttentionFeed` query failure | 500 | ATTENTION_FEED_LOAD_FAILED | "Unable to load the attention feed — please retry" |
| Inline action (Record Ruling / Transfer Custody) failure | — | — | *(see `F24-write-action-ui-coverage.md` §Error States — unchanged from F02/F03/F19/F20)* |

**API Surface (this feature):** see `Y1-api.md` §Command Center for `GET /api/cases/:id/activity` (amended: `statusCounts` added), `GET /api/cases/:id/custody-by-custodian` (new), `GET /api/cases/:id/attention-feed` (new). Also composes `GET /api/cases/:id/objections?status=unresolved` (F2) and `GET /api/cases/:id/discrepancies` (F6). Inline actions invoke F24's unchanged endpoints.

**Schema Surface (this feature):** read-only against `ExhibitEvent`, `ExhibitCurrentState`, `ObjectionCurrentState`, `CustodyCurrentState`, `DiscrepancyFlag`, `JuryPackageExhibit` — see `Y0-schema.md`. Introduces no new tables or fields; `getCustodyByCustodian` and `getAttentionFeed` are new read-only aggregation functions over existing projections, not new schema.
## F09: Case Workspace Screen

**Description:** The case-level screen listing all exhibits, parties, and current statuses in one place — the primary browsing and searching surface for the full exhibit set, now also the primary surface for triaging exhibits by jury-package eligibility at a glance, and the entry point into an individual Exhibit Detail View (F10).

**Terminology:**
- **Jury Package Eligibility:** A per-exhibit derived state — `Included` / `Not eligible` / `Blocked` — computed from the exhibit's membership (or absence) in the case's most-recently-computed `JuryPackage`, per §Process step 3 below. This is a read-time projection of F5/F6/F13's existing data, not a new computation or new business rule.

**Sub-features:**
- Full exhibit list for the case with current status, offering party, and witness association
- Integrated search/filter bar (F4)
- Jury Package eligibility column per row (`Included` / `Not eligible` / `Blocked`)
- Inline discrepancy flag indicators per exhibit row (F6)
- Row-level drill-through to Exhibit Detail View (F10)

**Process:**
1. On load (no search criteria active), the client calls `getExhibits(caseId)`, which internally applies role-based visibility (excluding sealed/ex-parte exhibits per role) and returns every visible exhibit joined with its `ExhibitCurrentState` and any `OPEN`/`ACKNOWLEDGED` `DiscrepancyFlag` rows.
2. Each row renders: exhibit label, description (truncated), offering party, associated witness, current status badge (F1 visual convention), current custodian name (F3), a discrepancy indicator icon if any flag exists for that exhibit, and the new Jury Package eligibility badge (step 3).
3. **Jury Package eligibility column (added Phase 8):** `getExhibits` is amended to additionally left-join each exhibit against the case's most-recently-computed `JuryPackage`'s `JuryPackageExhibit` rows (F5/F13) and derive one of three values per exhibit, in this precedence:
   - **`Included`** — a `JuryPackageExhibit` row exists with `status = 'INCLUDED'` AND `discrepancyStatus = 'CLEAN'`.
   - **`Blocked`** — a `JuryPackageExhibit` row exists with `status = 'INCLUDED'` AND `discrepancyStatus = 'FLAGGED'` (i.e., the exhibit is a package member but has an open discrepancy preventing finalization, per F5 §Process step 6).
   - **`Not eligible`** — every other case: no `JuryPackageExhibit` row exists for this exhibit at all (not yet admitted, not yet computed into any package, or structurally excluded — `classification != 'TRIAL'`), **or** a row exists with `status = 'EXCLUDED'` (F13's sealed/ex-parte or manual-removal remediation). This column does not distinguish *why* an exhibit is not eligible — it answers only "is it in the current package, and is it clean" — a user who needs the reason drills into Exhibit Detail (F10)'s Jury Package checklist card for the itemized breakdown.
4. If no `JuryPackage` has ever been computed for the case (Phase 3's "no package started yet" empty state, F11), every exhibit's eligibility column reads `Not eligible` — this is expected behavior, not a defect; initiating package computation (F5 §Process step 1) from the Jury Package Workspace populates this column for every subsequently-admitted-and-clean exhibit.
5. When the user enters search criteria, the client calls `searchExhibits` (F4) instead of `getExhibits`, replacing the rendered list with filtered results while preserving the same row rendering, including the eligibility column.
6. Clicking any exhibit row navigates to `/exhibit/:id`, the Exhibit Detail View (F10), passing the `exhibitId`.
7. The screen polls `getExhibits`/`searchExhibits` on the same live-sync interval as F8 (3–5s) so status/custody/discrepancy/eligibility changes recorded by another user — including via a jury-package computation, finalization, or exclusion action — appear without manual refresh.

**Inputs:**
- `caseId` (string/UUID, required, from session)
- `requestingUserRole` (enum, required, from session)
- Search criteria (optional, per F4 §Inputs) when the search bar is active

**Outputs:**
- Exhibit row list: `{ exhibitId, exhibitLabel, description, offeringParty, associatedWitness, currentStatus, currentCustodianName, discrepancyFlags[], juryPackageEligibility: 'INCLUDED' | 'NOT_ELIGIBLE' | 'BLOCKED' }` *(amended Phase 8: `juryPackageEligibility` added)*

**Validation:**
- No write operations originate from this screen directly — all mutations (status change, objection, ruling, custody transfer) happen via dedicated action flows that call F1/F2/F3 endpoints, kept outside this screen's core list-rendering responsibility per the PRD's "assistant, not data-entry system" positioning
- Sealed/ex-parte exhibits never appear in this screen's list for a role outside the visibility set (`00-header.md` §Role-Based Visibility) — not shown as redacted rows, simply absent
- `juryPackageEligibility` must always be computed from the case's single most-recently-computed `JuryPackage` — never from a stale or cached package reference, and never independently re-derived by this screen outside the precedence rule in §Process step 3 (which mirrors, and must never diverge from, what the Jury Package Workspace itself shows for the same exhibit, F11)

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| Case not found / no access | 404 | CASE_NOT_FOUND | "No case found with the given ID" |
| Underlying exhibit list query failure | 500 | CASE_WORKSPACE_LOAD_FAILED | "Unable to load case exhibits — please retry" |

**API Surface (this feature):** see `Y1-api.md` §Exhibits for `GET /api/cases/:id/exhibits` (amended: `juryPackageEligibility` added) and §Search for `GET /api/cases/:id/exhibits/search` (F4, same amendment).

**Schema Surface (this feature):** read-only against `Exhibit`, `ExhibitCurrentState`, `CustodyCurrentState`, `DiscrepancyFlag`, `JuryPackage`, `JuryPackageExhibit` *(amended Phase 8: now also reads `JuryPackage`/`JuryPackageExhibit`)* — see `Y0-schema.md`. Introduces no new tables or fields.
## F10: Exhibit Detail View Screen

**Description:** The full history for a single exhibit — every status change, objection, ruling, and custody transfer — presented as a chronological timeline reconstructed directly from the event ledger. This screen answers "what happened to this exhibit" without assembling fragments from multiple sources, directly supporting the named demo scenario of the same description. As of Phase 8, the screen is paired with a right-rail of three actionable, at-a-glance cards (Objection, Chain of Custody, Jury Package checklist) and header-level write actions (F24), so a user can both understand and act on an exhibit's state from one screen.

**Terminology:**
- **Timeline Entry:** One rendered row corresponding to exactly one `ExhibitEvent` row, in `sequence_no` order.
- **Right Rail:** The three-card column (Objection / Chain of Custody / Jury Package checklist) rendered alongside the timeline, each reading a distinct slice of the same `getExhibitHistory` response — no card issues its own separate query.

**Sub-features:**
- Chronological timeline of all ledger events for the exhibit
- Current status, current custodian, and active discrepancy flags shown prominently above the timeline
- Each timeline entry displays actor, timestamp, and plain-language summary (no raw enum/JSON exposure, per PITFALLS.md §UX Pitfalls)
- Right-rail **Objection card**: the exhibit's unresolved objection thread(s), if any, each with an inline "Record ruling" action (F24, role-gated to `JUDGE`)
- Right-rail **Chain of Custody card**: current custodian (including a visibly distinct pending-transfer state per F19), plus the full transfer history at a glance
- Right-rail **Jury Package checklist card**: a per-condition breakdown of jury-package eligibility for this one exhibit (admission, objection resolution, custody completeness, classification) plus the exhibit's overall membership status (F9's `Included`/`Not eligible`/`Blocked`, computed identically here)
- Header-level "Transfer custody" action (F24, role-gated to `DEPUTY`/`CLERK`/`ADMIN`, or identity-gated to the named receiver when a transfer is pending)
- Header-level "Ask Pivota about {exhibitLabel}" action, opening the assistant (F7) pre-scoped to this exhibit

**Process:**
1. On load, the client calls `getExhibitHistory(exhibitId)`, which checks role-based visibility first (403/404 per §Validation below if the exhibit is sealed/ex-parte and the role is unauthorized), then returns the exhibit's identity fields, its full ordered `ExhibitEvent` list, current `ExhibitCurrentState`, current `CustodyCurrentState` (including F19's pending-transfer fields), any `DiscrepancyFlag` rows, every `ObjectionCurrentState` row for the exhibit (not only the most recent — F02 permits N concurrent threads), and the exhibit's jury-package checklist data (step 5 below).
2. The header area renders: exhibit label, description, offering party, associated witness, current status badge, current custodian name, discrepancy indicators (if any) with a link-through to the acknowledgment flow (F6) if the viewing role is authorized to acknowledge, and the two header-level actions ("Transfer custody", "Ask Pivota about {exhibitLabel}").
3. The timeline area renders one entry per `ExhibitEvent`, oldest-first (or newest-first, implementation's choice, but consistently applied), each translated from its `eventType` + `payload` into a plain-language sentence (e.g., "Status changed from Offered to Admitted" rather than exposing `STATUS_CHANGE` / `fromStatus` / `toStatus` raw).
4. **Objection card (added Phase 8):** renders every `ObjectionCurrentState` row for this exhibit with `status = 'UNRESOLVED'` — there may be zero, one, or several concurrently — each showing objecting party, grounds, and elapsed time since `raisedAt` (same live-recomputed pattern as F21's queue). Each row carries its own "Record ruling" inline action (F24), passing that row's specific `objectionId` as context — never ambiguous about which thread a ruling applies to. If zero unresolved threads exist, the card renders an explicit "No open objections" state, not an empty card.
5. **Chain of Custody card (added Phase 8):** renders the current custodian (or "No custodian of record" if `CustodyCurrentState` has no row — a pre-F18 legacy state), a visibly distinct "Pending transfer to {name} since {time}" banner when `pendingTransferToUserId` is non-null (F19), and the full ordered custody history (`getCustodyHistory`, F03/F19, including `PROPOSED`/`CONFIRMED`/`CANCELLED` events distinguished by type). This is the same underlying data F03's `getCustodian`/`getCustodyHistory` already serve — no new query, no new business logic, purely a dedicated card presentation of existing data.
6. **Jury Package checklist card (added Phase 8):** renders four per-exhibit condition checks — (a) `currentStatus = 'ADMITTED'`, (b) zero `UNRESOLVED` objection threads, (c) a custodian of record exists (`CustodyCurrentState` row present), (d) `classification = 'TRIAL'` — each shown as met/outstanding, plus the exhibit's overall eligibility badge computed by the identical precedence rule F9 §Process step 3 applies (`Included`/`Not eligible`/`Blocked`). This card is the itemized "why" that F9's single eligibility badge deliberately does not spell out at list-row scale.
7. Every timeline entry, and every right-rail card's underlying record, is independently citable — this is the same `getExhibitHistory` function the assistant's `getExhibitHistory` tool (F7) calls, so an assistant answer to "what happened to Exhibit 14" and this screen's rendered timeline/cards are guaranteed to show identical events and state.
8. The screen polls `getExhibitHistory` on the standard live-sync interval so a custody transfer, ruling, or status change recorded elsewhere — including via this screen's own F24 inline actions — appears in the open timeline and right rail without manual refresh.

**Inputs:**
- `exhibitId` (string/UUID, required, from route param)
- `requestingUserRole` (enum, required, from session): governs both sealed-visibility masking (unchanged) and which right-rail/header actions render (F24, F20)

**Outputs:**
- Exhibit header: identity fields + `currentStatus` + `currentCustodianName` + `discrepancyFlags[]`
- `timeline[]`: `{ eventId, eventType, summary, actorName, recordedAt }`, one entry per ledger event, each carrying its own `eventId` for citation-parity verification with the assistant
- `objections[]` *(added Phase 8)*: `Array<ObjectionCurrentState>` filtered to `status = 'UNRESOLVED'` for card rendering (the full set, resolved and unresolved, remains visible via the timeline, unchanged)
- `custodyCard` *(added Phase 8)*: `{ current: CustodyCurrentState | null, pendingTransfer: { toUserId, toName, proposedAt } | null, history: Array<{ fromCustodian, toCustodian, timestamp, reason, eventId, eventType }> }`
- `juryPackageChecklist` *(added Phase 8)*: `{ admitted: boolean, objectionsResolved: boolean, custodianOnRecord: boolean, classificationTrial: boolean, eligibility: 'INCLUDED' | 'NOT_ELIGIBLE' | 'BLOCKED' }`

**Validation:**
- If the exhibit is sealed/ex-parte and the requesting role is outside the visibility set, the screen must behave as if the exhibit does not exist (404), not as a 403 revealing its existence, consistent with F7's decline behavior — this applies identically to the right-rail cards, which never render for a masked exhibit
- The timeline must render every `ExhibitEvent` row for the exhibit with no filtering/truncation — "full history" means complete, not "recent N events"
- The Objection, Custody, and Jury Package checklist cards must derive their state from the same `getExhibitHistory` payload the timeline renders from — no card may issue an independent query that could diverge from the timeline's version of the same facts
- Header/card action controls (Record Ruling, Transfer Custody) must not render for a role the F20 matrix does not permit for that action (see `F24-write-action-ui-coverage.md` §Validation) — the server-side gate remains authoritative regardless

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| Exhibit not found | 404 | EXHIBIT_NOT_FOUND | "No exhibit found with the given ID" |
| Sealed/ex-parte exhibit, unauthorized role | 404 | EXHIBIT_NOT_FOUND | "No exhibit found with the given ID" *(identical message — existence is not revealed)* |
| Timeline/right-rail query failure | 500 | EXHIBIT_DETAIL_LOAD_FAILED | "Unable to load exhibit history — please retry" |
| Header/card inline action failure (Record Ruling / Transfer Custody) | — | — | *(see `F24-write-action-ui-coverage.md` §Error States — unchanged from F02/F03/F19/F20)* |

**API Surface (this feature):** see `Y1-api.md` §Exhibits for `GET /api/exhibits/:id/history` (amended: `objections[]`, `custodyCard`, `juryPackageChecklist` added). Right-rail actions invoke F24's unchanged endpoints.

**Schema Surface (this feature):** read-only against `Exhibit`, `ExhibitEvent`, `ExhibitCurrentState`, `CustodyCurrentState`, `ObjectionCurrentState`, `DiscrepancyFlag`, `JuryPackageExhibit` *(amended Phase 8: now also reads `JuryPackageExhibit` for the checklist card's eligibility badge)* — see `Y0-schema.md`. Introduces no new tables or fields.
## F11: Jury Package Workspace Screen

**Description:** A curated, exportable workspace presenting the computed jury-eligible exhibit list (F5) alongside any discrepancy warnings, serving as the authoritative handoff view for jury package preparation. This screen is where the demo's "build a jury package" scenario plays out end-to-end, including the discrepancy gate blocking finalization. As of Phase 8, the draft view is restructured from a single flat table into a per-exhibit card layout grouped into Blockers/Clean sections with a visible progress indicator, and a role unable to finalize directly can request finalization from one who can, rather than hitting a disabled control with no path forward.

**Terminology:**
- **Blockers Section / Clean Section:** The two groupings the draft card layout organizes included exhibits into — `Blockers` for any `JuryPackageExhibit` with `discrepancyStatus = 'FLAGGED'`, `Clean` for `discrepancyStatus = 'CLEAN'`. Equivalent in substance to the prior single-table's discrepancy-warning-badge presentation, restructured for at-a-glance legibility.
- **Finalization Request:** A lightweight, auditable notification — not a write to any exhibit or ledger domain — recorded when a role without finalize authority (per F20) asks a role that has it to finalize the current draft. Carries only a timestamp and the requesting user; it confers no authority of its own and does not bypass F5's discrepancy gate.

**Sub-features:**
- Displays the current `JuryPackage` (draft or finalized) and its `JuryPackageExhibit` list
- Draft view presents each included exhibit as an individual card, grouped into **Blockers** and **Clean** sections, rather than a single flat table
- Progress indicator summarizing included-exhibit counts: total, Clean, Blocked
- Prominently surfaces discrepancy warnings per included exhibit (unchanged in substance, restructured in layout)
- Blocks the finalize action (disabled control, not just a rejected request) while open discrepancies remain among included exhibits
- **"Request finalization from Clerk"** action (new): available to a role permitted to view but not finalize (per F20 — e.g., `JUDGE`, `CHAMBERS_STAFF`, `ATTORNEY`), routing a notification to finalize-authorized roles rather than presenting a disabled control with no path forward
- Export/curated presentation view suitable for handoff once finalized

**Process:**
1. On load, the client calls `GET /api/cases/:id/jury-package` (F5), which returns the current `JuryPackage` (creating a fresh `DRAFT` via `computeJuryCandidates` if none exists yet for the case) along with each `JuryPackageExhibit`'s live discrepancy status, and — as of Phase 8 — the package's current `finalizationRequestedAt`/`finalizationRequestedBy`, if any (see §Process step 7).
2. **Card layout (added Phase 8):** the screen renders the package status (`DRAFT`/`FINALIZED`) and the progress indicator (`{clean} of {total} exhibits clean`) prominently at the top, then two sections below: **Blockers** (cards for every `discrepancyStatus = 'FLAGGED'` row) and **Clean** (cards for every `discrepancyStatus = 'CLEAN'` row). Each card shows exhibit label, status badge, and — for a Blockers card — the specific discrepancy detail (`ruleCode`, `details`) inline on the card face, not behind a secondary click. This replaces the prior single flat table; no underlying data or computation changes.
3. For any Blockers card, the user can navigate to that exhibit's F10 detail view to resolve the underlying issue (e.g., record a missing custody transfer, via F24's inline action) or, if authorized, acknowledge the discrepancy directly from this screen via the F6 acknowledgment action.
4. The "Finalize Jury Package" action control is disabled (not merely error-returning) whenever the Blockers section is non-empty (equivalent to the prior "count of `FLAGGED AND OPEN`" rule, restated for the card layout) — this is a UX affordance layered on top of, not a replacement for, the server-side gate in F5.
5. When finalization is attempted (control enabled, zero Blockers at render time), the client calls `POST /api/jury-package/:id/finalize` (F5), which re-validates server-side before committing. A successful finalize clears any outstanding `finalizationRequestedAt`/`finalizationRequestedBy` on the package (step 7) — the request is resolved by the finalization it led to.
6. On successful finalization, the screen switches to a read-only "Finalized" presentation suitable for export/handoff (print-friendly, downloadable view, or F23's generated PDF) and the exhibit list becomes immutable; the Blockers/Clean grouping is dropped in favor of a single final list (there can be no Blockers in a finalized package, by construction of F5's gate).
7. **Request finalization from Clerk (added Phase 8):** a user whose role is permitted to view this screen but is **not** in F20's finalize-authorized set (`DEPUTY`/`CLERK`/`ADMIN`) — i.e., `JUDGE`, `CHAMBERS_STAFF`, or `ATTORNEY` — sees "Request finalization from Clerk" in place of the (for them, never-actionable) "Finalize" control. On click, the client calls `POST /api/jury-package/:id/request-finalization` (`{ actorUserId }`, new), which sets `JuryPackage.finalizationRequestedAt = now()` and `finalizationRequestedBy = actorUserId` — overwriting any prior unresolved request for the same package (at most one outstanding request is tracked; no stacking/queueing). This does **not** finalize the package, bypass the discrepancy gate, or grant the requester any new authority — it is a notification only.
8. A finalize-authorized role (`DEPUTY`/`CLERK`/`ADMIN`) viewing the same `DRAFT` package while `finalizationRequestedAt` is non-null sees a visible banner — e.g., "Finalization requested by {requesterName} at {time}" — above the Finalize control, so the request is surfaced exactly where the action it asks for would be taken, not on a separate notifications page.
9. The screen polls the jury-package endpoint on the standard live-sync interval while in `DRAFT` state so that a concurrent custody fix, acknowledgment, or finalization request by another user updates the Blockers/Clean grouping and the request banner without manual refresh; polling stops once `FINALIZED` (immutable content needs no further refresh).

**Inputs:**
- `caseId` (string/UUID, required, from session)
- `requestingUserRole` (enum, required, from session): gates whether the "Finalize"/"Acknowledge" controls render as actionable (per F5 §Validation, F6 §Validation role checks) versus the new "Request finalization from Clerk" control renders instead (step 7)
- `actorUserId` (string/UUID, required, from session, for the request-finalization action only)

**Outputs:**
- Package header: `{ juryPackageId, status, createdAt, finalizedAt?, finalizedBy?, finalizationRequestedAt?, finalizationRequestedBy? }` *(amended Phase 8: `finalizationRequestedAt`/`finalizationRequestedBy` added)*
- Exhibit rows/cards: `{ exhibitId, exhibitLabel, currentStatus, discrepancyStatus, discrepancyDetails? }` — unchanged in shape; now additionally grouped client-side into `blockers[]`/`clean[]` for card rendering
- Progress summary: `{ total, cleanCount, blockedCount }`
- On blocked finalization attempt (if somehow triggered despite the disabled control, e.g., stale client state): the specific blocking discrepancies returned by F5, rendered as an inline error list
- On successful finalization request: `{ finalizationRequestedAt, finalizationRequestedBy }`

**Validation:**
- This screen never computes jury eligibility or discrepancy status itself — all computation happens server-side via F5/F6; the screen is a pure presentation + action-trigger layer, preventing any possibility of the screen showing a different "clean" state than the server would enforce
- A `FINALIZED` package's exhibit list is rendered as fully read-only — no acknowledge/resolve/remove controls are shown, consistent with F5's immutability rule
- "Request finalization from Clerk" is rendered only for a role **outside** F20's finalize-authorized set for this action; a `DEPUTY`/`CLERK`/`ADMIN` user — who can already finalize directly — never sees this control, and attempting the request endpoint as one of these roles is rejected server-side (§Error States)
- A finalization request is purely additive metadata on the `JuryPackage` row — it never blocks, gates, or substitutes for the server-side discrepancy check in F5; a package with zero Blockers can still be finalized by an authorized role whether or not a request is currently outstanding, and a package with open Blockers remains unfinalizable regardless of how many requests have been made

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| Finalize attempted with stale client state (server re-check fails) | 409 | JURY_PACKAGE_DISCREPANCIES_OPEN | "Cannot finalize: {n} exhibit(s) have unresolved discrepancies" *(per F5)* |
| Jury package load failure | 500 | JURY_PACKAGE_LOAD_FAILED | "Unable to load jury package — please retry" |
| Non-authorized role attempts finalize | 403 | ROLE_NOT_PERMITTED | "Only courtroom deputy, clerk, or admin roles may finalize a jury package" *(per F5)* |
| A finalize-authorized role (`DEPUTY`/`CLERK`/`ADMIN`) attempts to request finalization | 403 | ROLE_NOT_PERMITTED | "This role can finalize directly and does not need to request it" *(new, F11)* |
| Finalization requested on an already-`FINALIZED` package | 409 | JURY_PACKAGE_ALREADY_FINALIZED | "This jury package has already been finalized" *(per F5, unchanged)* |

**API Surface (this feature):** see `Y1-api.md` §Jury Package for `GET /api/cases/:id/jury-package` (amended: `finalizationRequestedAt`/`finalizationRequestedBy` added), `POST /api/jury-package/:id/finalize` (both defined in F5), `POST /api/jury-package/:id/request-finalization` (new), and §Discrepancies for `POST /api/discrepancies/:id/acknowledge` (F6).

**Schema Surface (this feature):** read-only against `JuryPackageExhibit`, `DiscrepancyFlag`; adds `finalizationRequestedAt` (nullable `DateTime`), `finalizationRequestedBy` (nullable `String`) to `JuryPackage` — see `Y0-schema.md` §Jury Package (amended).
## F12: Admission Integrity Gating

**Description:** State-machine enforcement that rejects — rather than permits-then-flags — the transition of an exhibit to `ADMITTED` status when the exhibit still has an unresolved objection thread or has no custodian currently on record. This closes a state-model gap: prior to this feature, both conditions were only detected *after* an invalid admission had already been recorded, via F6's `ADMITTED_NO_CUSTODIAN` and `UNRESOLVED_OBJECTION_JURY_ELIGIBLE` discrepancy rules. This feature moves both checks to a hard pre-write gate inside the shared status-transition service so an invalid admission can never be recorded in the first place, by any caller.

**Terminology:**
- **Admission Gate:** The two new precondition checks inserted into the shared status-transition service function (the same function backing F1's `recordEvent({ eventType: 'STATUS_CHANGE', ... })` path), evaluated specifically — and only — when `toStatus = ADMITTED`, before the `STATUS_CHANGE` event is appended to the ledger.
- **Blocking Reason:** One of `UNRESOLVED_OBJECTION` or `NO_CUSTODIAN` — either or both may apply simultaneously to a single rejected admission attempt.

**Sub-features:**
- Reject admission when ≥1 `ObjectionCurrentState` row for the exhibit has `status = 'UNRESOLVED'`
- Reject admission when no `CustodyCurrentState` row exists for the exhibit (or its `currentCustodianUserId` is null)
- Enforced exclusively inside the shared status-transition service function — not in a screen, not in a single API route handler — so it applies identically regardless of entry point (UI action, direct API call, seed loader, or any future automation)
- Clear, specific, multi-reason rejection response (not a generic validation error)

**Process:**
1. A caller (UI action, API client, or any other path) requests a status transition to `toStatus = ADMITTED` via the same endpoint and service function used by F1 (`POST /api/exhibits/:id/events/status`).
2. The service layer first runs F1's existing `fromStatus`-match check (see F01 §Process step 3) — this is unchanged by this feature.
3. If that check passes and `toStatus = ADMITTED`, the service layer runs the Admission Gate as two independent queries against current-state projections, in the same transaction as the eventual ledger write:
   a. Query `ObjectionCurrentState WHERE exhibitId = :id AND status = 'UNRESOLVED'`. If any row is returned, the `UNRESOLVED_OBJECTION` blocking reason applies.
   b. Query `CustodyCurrentState WHERE exhibitId = :id`. If no row exists, or `currentCustodianUserId` is null, the `NO_CUSTODIAN` blocking reason applies.
4. If either blocking reason applies, the service layer rejects the request with HTTP 422 `ADMISSION_BLOCKED` **before** any `ExhibitEvent` row is appended and **before** `ExhibitCurrentState` is updated — the exhibit's status remains exactly what it was prior to the attempt. The response body lists every applicable blocking reason (both, if both apply), not just the first one encountered.
5. If neither blocking reason applies, F1's normal process continues unchanged (step 4 onward in F01 §Process): the event is appended and `ExhibitCurrentState` is updated.
6. This check runs inside the same service function for every caller — there is no "force admit" parameter, admin override, or alternate code path that bypasses it in this version.
7. **Behavior change from prior releases:** previously, an exhibit could be admitted with an open objection or missing custodian, and the condition was only surfaced afterward via F6's `ADMITTED_NO_CUSTODIAN` / `UNRESOLVED_OBJECTION_JURY_ELIGIBLE` discrepancy flags (see F06 §Process step 2). F6's rules remain in the system and continue to cover conditions that arise *after* a valid admission (e.g., a custody transfer later breaking the chain) — but they are no longer the sole backstop for the admission transition itself, which this feature now blocks outright at the moment it is attempted.
8. An exhibit that is not attempting the `ADMITTED` transition (e.g., one that remains `OBJECTED`) is unaffected by this gate and continues to be covered only by F6's discrepancy rules — a custody gap on a still-open, non-admitted exhibit remains visible as a discrepancy flag (not a rejected transition) exactly as before, so the risk is surfaced before it ever reaches an admission decision.

**Inputs:**
- `exhibitId` (string/UUID, required) — same as F1
- `toStatus` (enum, required) — Admission Gate activates only when this value is `ADMITTED`; all other values are unaffected and follow F1's existing rules unchanged
- `actorUserId` (string/UUID, required) — same as F1
- `notes` (string, optional) — same as F1

**Outputs:**
- On success: identical to F1 §Outputs (updated `ExhibitCurrentState`, the new `ExhibitEvent` row)
- On rejection: `{ error: { code: 'ADMISSION_BLOCKED', message, reasons: Array<{ code: 'UNRESOLVED_OBJECTION' | 'NO_CUSTODIAN', message }> } }` — the `reasons` array contains one entry per applicable blocking condition

**Validation:**
- `toStatus = ADMITTED` is accepted only if zero `ObjectionCurrentState` rows for the exhibit have `status = 'UNRESOLVED'` at check time
- `toStatus = ADMITTED` is accepted only if a `CustodyCurrentState` row exists for the exhibit with a non-null `currentCustodianUserId` at check time
- Both conditions are checked atomically within the same transaction as F1's `fromStatus` check, preventing a race where a concurrent objection or custody write could slip through between validation and ledger append
- This validation applies only to the `ADMITTED` transition — `EXCLUDED` and `WITHDRAWN` transitions are unaffected and may still be recorded with an open objection or custody gap present (an exhibit can be excluded or withdrawn regardless of these conditions)
- There is no override, bypass flag, or elevated-role exception to this gate in this version — every caller, including seed-data loading, is subject to it

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| Admission attempted with ≥1 unresolved objection and/or no custodian of record | 422 | ADMISSION_BLOCKED | "Cannot admit: {n} blocking condition(s) present" (body includes `reasons[]`, each `UNRESOLVED_OBJECTION` or `NO_CUSTODIAN`) |
| All other status-transition errors (invalid transition, finalized status, stale-state conflict, exhibit not found) | — | — | Unchanged — see F01 §Error States |

**API Surface (this feature):** reuses the existing `POST /api/exhibits/:id/events/status` endpoint (F1) — see `Y1-api.md` §Status (amended to list `ADMISSION_BLOCKED` alongside the existing error codes for this route).

**Schema Surface (this feature):** introduces no new tables or fields. Reads existing `ObjectionCurrentState` and `CustodyCurrentState` projections (see `Y0-schema.md` §Current-State Projections); writes nothing beyond the standard `STATUS_CHANGE` event already defined for F1 when the gate passes.
## F13: Jury Package Ex Parte / Sealed Exclusion

**Description:** A hard structural exclusion ensuring that any exhibit flagged sealed/ex-parte (`Exhibit.isSealed = true`, see F00 §Terminology) can never be eligible for, included as, or displayed as "clean" within a jury package — regardless of its admission status. This exclusion is evaluated independently of, and prior to, F6's discrepancy-flag engine: a sealed exhibit is never passed into discrepancy evaluation for jury-package purposes at all, so it can never acquire a `CLEAN` discrepancy status. This is the highest-severity gap this product closes — sealed/ex-parte material reaching a jury package is the single most damaging failure mode in this domain, and this feature exists specifically to prevent its recurrence.

**Terminology:**
- **Hard Exclusion:** A filter applied at the jury-candidate query itself (not a later UI hide, not a discrepancy flag) — a sealed exhibit's row is never created as an `INCLUDED` `JuryPackageExhibit` via the normal computation path.
- **Exclusion Event:** An auditable ledger event (`JURY_PACKAGE_EXHIBIT_EXCLUDED`) recording the removal of an exhibit from a jury package, whether triggered automatically by the sealed-filter or manually by an authorized user via the remediation action described below.
- **Remediation Action:** The UI-visible "Remove from Package" control available on any jury-package row where `exhibit.isSealed = true` happens to be present (e.g., legacy/regression data computed before this fix, or any future edge case), allowing an authorized user to explicitly excise it.

**Sub-features:**
- `computeJuryCandidates` (F5) excludes `isSealed = true` exhibits at the query level, before the `ADMITTED`-status filter and before F6's discrepancy evaluation ever run
- Any jury-package row where the underlying exhibit is sealed is rendered with a distinct high-visibility warning state, never as `CLEAN` or `FLAGGED`
- An authorized user (`DEPUTY`, `CLERK`, or `ADMIN`) can explicitly exclude such a row from the package, recorded as an immutable, auditable ledger event
- Excluded rows are retained (not deleted) for audit history, never again surfaced as included/eligible
- Regression test coverage specifically exercising the originating defect (a sealed chambers sidebar note marked `ADMITTED` appearing jury-eligible)

**Process:**
1. `computeJuryCandidates(caseId)` (F5 §Process step 1) is amended so its candidate query reads `ExhibitCurrentState WHERE currentStatus = 'ADMITTED' AND exhibit.isSealed = false` — the sealed filter is applied in the *same* query as the admitted-status filter, not as a subsequent filtering pass, guaranteeing a sealed exhibit's row is never created in `JuryPackageExhibit` by the normal computation path.
2. This filter runs before F6's `evaluateDiscrepancies` is ever called for a candidate (F5 §Process step 2) — a sealed exhibit is never passed into the discrepancy engine for jury-package purposes, so it can never be assigned `CLEAN` or `FLAGGED`; it is simply absent from the candidate set entirely.
3. For any `JuryPackageExhibit` row that is nonetheless present for a sealed exhibit (e.g., computed before this fix shipped, or any other future edge case), the Jury Package Workspace (F11) renders a distinct, high-visibility warning state for that row — explicitly labeled (e.g., "Sealed material — must be removed") — instead of either `CLEAN` or `FLAGGED`, so it is never mistaken for a normal discrepancy-free row.
4. An authorized user (role `DEPUTY`, `CLERK`, or `ADMIN` — identical role gate to F5's finalize action, see F05 §Validation) triggers the "Remove from Package" remediation action on that row.
5. The service layer appends a `JURY_PACKAGE_EXHIBIT_EXCLUDED` ledger event (`payload: { juryPackageId, exhibitId, reason: 'SEALED_EXPARTE', note? }`, `actorUserId`) and updates the corresponding `JuryPackageExhibit` row's `status` to `EXCLUDED`, setting `excludedAt`, `excludedBy`, and `exclusionReason` — the row is retained, never deleted, preserving a complete audit trail of what was in the package and when/why it was removed.
6. An `EXCLUDED` row is never rendered as part of the active/included exhibit list on F11, never counted toward finalization eligibility, and never returned by the assistant's `getJuryPackageStatus` tool (F7) as an included exhibit.
7. Finalization (F05 §Process steps 5–7) is unaffected by `EXCLUDED` rows — only rows with `status = 'INCLUDED'` are evaluated against the discrepancy gate at finalization time; an `EXCLUDED` row cannot block or participate in finalization either way.
8. Regression coverage: the seed loader's existing sealed-exhibit edge case (per F00 §Process step 5 and Phase 2's sealed-visibility work) is extended to include at least one sealed exhibit marked `ADMITTED`, and an automated test asserts this exhibit never appears in `computeJuryCandidates`'s result set, is never rendered as `CLEAN` on F11, and is never returned by `getJuryPackageStatus` as an eligible/included exhibit.

**Inputs — Exclusion action:**
- `juryPackageId` (string/UUID, required)
- `exhibitId` (string/UUID, required): must correspond to a currently `INCLUDED` `JuryPackageExhibit` row in the given package
- `actorUserId` (string/UUID, required): must be role `DEPUTY`, `CLERK`, or `ADMIN`
- `reason` (enum: `SEALED_EXPARTE` | `MANUAL_REMOVAL`, required): `SEALED_EXPARTE` is the reason this feature exercises; `MANUAL_REMOVAL` is reserved for any other future manual-removal need and is not otherwise triggered by this feature
- `note` (string, optional, max 300 chars): free-text context stored in the event payload

**Outputs:**
- Updated `JuryPackageExhibit` row: `{ exhibitId, status: 'EXCLUDED', excludedAt, excludedBy, exclusionReason }`
- The created `ExhibitEvent` row (`JURY_PACKAGE_EXHIBIT_EXCLUDED`), with `id` for citation/audit
- `GET /api/cases/:id/jury-package` (F5) responses: only `INCLUDED` rows appear in the active exhibit list; `EXCLUDED` rows are omitted from that list (retained in the database for audit, not surfaced as a default read)

**Validation:**
- `isSealed = true` exhibits are excluded at the candidate-query level — this is not a post-hoc filter and not a UI-only hide; a sealed admitted exhibit must never acquire an `INCLUDED` `JuryPackageExhibit` row via the normal computation path
- The exclusion remediation action is available only for a `JuryPackageExhibit` row currently `status = 'INCLUDED'` belonging to a `DRAFT` package — a `FINALIZED` package's rows are immutable (per F05 §Validation) and cannot be excluded via this action after finalization
- `actorUserId` role must be `DEPUTY`, `CLERK`, or `ADMIN` — identical to F5's finalize role gate (`JUDGE`, `CHAMBERS_STAFF`, `ATTORNEY` may view the warning state but not perform the removal)
- This exclusion takes precedence over and is evaluated independently of F6's `discrepancyStatus` — a sealed exhibit's row, if present due to legacy/regression data, never shows `CLEAN` regardless of what its discrepancy flags' state is
- Re-running `computeJuryCandidates` for the same case never re-adds a previously `EXCLUDED` sealed exhibit as a new `INCLUDED` row — the sealed filter is permanent at the source query, not a one-time cleanup pass

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| Exclusion attempted on a row not currently `INCLUDED` (or no such row exists) | 404 | JURY_PACKAGE_EXHIBIT_NOT_FOUND | "No included exhibit found in this jury package with the given ID" |
| Exclusion attempted on a `FINALIZED` package | 409 | JURY_PACKAGE_ALREADY_FINALIZED | "This jury package has already been finalized" *(per F5)* |
| Non-authorized role attempts exclusion | 403 | ROLE_NOT_PERMITTED | "Only courtroom deputy, clerk, or admin roles may remove an exhibit from a jury package" |

**API Surface (this feature):** new endpoint `POST /api/jury-package/:id/exhibits/:exhibitId/exclude` — see `Y1-api.md` §Jury Package Exclusion. Also amends the candidate computation behind `POST /api/cases/:id/jury-package` (F5) to apply the `isSealed` filter at the query level.

**Schema Surface (this feature):** extends `JuryPackageExhibit` with `status` (new enum `JuryPackageExhibitStatus`: `INCLUDED` | `EXCLUDED`), `excludedAt`, `excludedBy`, `exclusionReason`; adds `JURY_PACKAGE_EXHIBIT_EXCLUDED` to the `EventType` enum — see `Y0-schema.md` §Jury Package (amended).
## F14: Discrepancy Acknowledgment Transparency

**Description:** Makes the existing semantics of acknowledging a discrepancy visible to the user at the point of action. This is strictly a UI visibility requirement — the underlying acknowledgment data model and audit trail already exist in full per F6 (role-gated acknowledgment, required justification, immutable `DISCREPANCY_ACKNOWLEDGED` ledger event). This feature adds **no new data capability**; it requires every screen to surface, legibly and without a hover-only interaction, who may acknowledge a discrepancy and that doing so is recorded as a permanent, auditable event tied to an actor, role, timestamp, and justification.

**Terminology:**
- **Acknowledgment Affordance:** The UI control (button/action) that triggers F6's `acknowledgeDiscrepancy` flow — the element this feature specifies the required labeling and disclosure for.
- **Permanent-Record Framing:** The requirement that any copy accompanying the acknowledgment action makes clear, before the action is taken, that it will be recorded permanently under the acknowledging user's identity.

**Sub-features:**
- Role-eligibility disclosure before the action is taken (which roles may acknowledge)
- Non-eligible roles see no acknowledge control at all — absent, not a disabled/misleading one
- Inline, always-visible audit-trail disclosure at the point of acknowledgment (what will be recorded, under whose name, and when)
- Visible acknowledgment history on already-`ACKNOWLEDGED` flags (actor, role, timestamp, justification) on every screen that renders that flag

**Process:**
1. Wherever a `DiscrepancyFlag` with `status = 'OPEN'` is rendered — Case Workspace (F9) inline indicator, Jury Package Workspace (F11) flagged row, Exhibit Detail (F10) discrepancy banner — the client checks `requestingUserRole` against F6's existing role set (`DEPUTY`, `CLERK`, `JUDGE`, `ADMIN`; see F06 §Validation).
2. If the requesting role is **not** in that set, no "Acknowledge" control is rendered for that flag at all — not a disabled or greyed-out control, an absent one. This mirrors the existing pattern already used for the Jury Package Workspace's finalize control (F11 §Process step 4): the system does not show an affordance it will not honor.
3. If the requesting role **is** in that set, the rendered "Acknowledge" control is accompanied by inline, always-visible copy (not tooltip-only, not hover-only) stating that acknowledging will permanently record the action under the acknowledging user's name and role, with a timestamp — e.g., "Acknowledging will be recorded as a permanent action under your name." This copy must be visible before the action is confirmed, not only after.
4. When the acknowledgment action is opened (confirmation step or inline form), the required justification input — F6's existing, unchanged, required, max-500-character field (F06 §Inputs — Acknowledgment) — is labeled to make clear it becomes part of the permanent record (e.g., "Justification (recorded permanently)") rather than appearing as an optional or throwaway comment field. No change is made to the field's validation rules.
5. Once a flag's status is `ACKNOWLEDGED` (per F06 §Process step 6), every screen that renders that flag displays the full acknowledgment record: the acknowledging user's name, their role, the timestamp, and the justification text — never summarized away, truncated without expansion, or hidden behind a secondary click. This data is sourced from the existing `DiscrepancyFlag.acknowledgedBy` / `acknowledgedAt` fields plus the justification already captured in the `DISCREPANCY_ACKNOWLEDGED` ledger event's payload (F06 §Schema Surface), joined via `acknowledgedEventId`.
6. The assistant's `getDiscrepancies` tool (F7) already has access to this same underlying data; this feature requires the service-layer read used by the UI (and, where relevant, the assistant's response composition) to include the justification text in its response for `ACKNOWLEDGED` flags — an additive field on an existing read, not a new tool or a changed tool contract.

**Inputs:** None new — this feature consumes the existing `requestingUserRole` (session, unchanged) and the existing `DiscrepancyFlag` fields already defined in F06 §Outputs.

**Outputs:** No new data is created. The following existing-data field is additively surfaced on reads that did not previously expose it:
- `justification` (string): the free-text justification originally captured at acknowledgment time, sourced via a read-time join from `DiscrepancyFlag.acknowledgedEventId` to the referenced `ExhibitEvent.payload.justification` (already stored per F06 §Schema Surface) — included in the `GET /api/cases/:id/discrepancies` and `GET /api/exhibits/:id/discrepancies` response shapes for any flag with `status = 'ACKNOWLEDGED'`.

**Validation:**
- An "Acknowledge" control must never be rendered for a role outside `DEPUTY`/`CLERK`/`JUDGE`/`ADMIN` — absence, not disablement, is the required behavior, identical in spirit to F11's existing finalize-control pattern
- The pre-action disclosure copy and the permanent-record framing on the justification field must both be visible without any hover or tooltip-only interaction — readable at a glance, consistent with the PRD's non-technical-usability NFR for a non-technical judge/court-staff audience
- Rendering an already-`ACKNOWLEDGED` flag's actor, role, timestamp, and justification must use identical data on every screen it appears on (F9, F10, F11) and in the assistant's answers — no screen may show a partial version that omits actor, timestamp, or justification while another shows the full set
- No change is made to who may acknowledge, what justification is required, or how an acknowledgment is recorded — F6's existing validation rules (F06 §Validation) govern the action itself unchanged; this feature governs only what is made visible around it

**Error States:**
No new error codes are introduced by this feature. All underlying actions continue to use F6's existing, unchanged error codes: `JUSTIFICATION_REQUIRED` (422), `DISCREPANCY_NOT_FOUND` (404), `ROLE_NOT_PERMITTED` (403) — see F06 §Error States and `Y2-errors.md` §Discrepancy Errors. This feature is a rendering/visibility requirement layered on top of F6's unchanged service behavior and introduces no new failure modes.

**API Surface (this feature):** no new endpoints. Consumes F6's existing `GET /api/cases/:id/discrepancies`, `GET /api/exhibits/:id/discrepancies`, and `POST /api/discrepancies/:id/acknowledge` unchanged in behavior — see `Y1-api.md` §Discrepancies (amended to note the additive `justification` field on `ACKNOWLEDGED` flags in the two `GET` responses).

**Schema Surface (this feature):** no new tables or columns. The justification text already exists as ledger ground truth in the `DISCREPANCY_ACKNOWLEDGED` event's payload (`Y0-schema.md` §Event Ledger, §Discrepancy Detection) — this feature requires only a read-time join at the service layer, not a schema change.
## F15: Courtroom Usability Fixes

**Description:** A cluster of interface clarity and consistency fixes identified during review of the shipped milestone, covering the Case Workspace, Pivota Assistant, app header, and activity feed. Each fix is a client-rendering correction against data the service layer already returns correctly — none requires a change to an API contract or the database schema — making the product behave the way a courtroom user would expect without additional explanation, per the PRD's "assistant, not system to learn" positioning.

**Terminology:**
- (none beyond `00-header.md` shared terminology and terms already defined in F07, F08, F09)

**Sub-features:**
- Case Workspace exhibit rows fully clickable through to Exhibit Detail View (fixes a regression against the already-specified F09 §Process step 4 behavior)
- Assistant example/suggested-question prompts reference the case's actual exhibit-label scheme
- The header's unlabeled numeric element is either clearly labeled or removed
- Activity feed entries display full date-and-time, not time-only
- Activity feed entries display the exhibit's label on every row, including raw state-transition rows

**Process:**
1. **Case Workspace row clickability (fixes F09 §Process step 4):** the entire row rendered by the Case Workspace exhibit table (F9) — the full row container, not only a nested link, icon, or label span — is clickable and navigates to `/exhibit/:id` (Exhibit Detail View, F10). The clickable hit area covers the complete row, includes a visible hover affordance, and supports keyboard/focus activation (Enter or Space navigates when the row has focus), matching the click-to-navigate pattern already used by the Command Center's activity feed (F8).
2. **Assistant example prompts (amends F7's example-chip rendering):** the example/suggested-question chips shown in the Pivota Assistant panel are generated using the case's actual exhibit-label scheme as produced by seed data (offering-party-prefixed labels, e.g., `P-1` for a `PLAINTIFF` exhibit, `D-4` for a `DEFENSE` exhibit, and the sealed/other convention in use for sealed exhibits, e.g., `S-2`) — for example, "Is P-1 in the jury package?" — rather than a mismatched placeholder numeric scheme (e.g., "Exhibit 14," "Exhibit 7") that does not correspond to any exhibit actually present in the seeded case.
3. Example prompts are sourced from (or validated at render time against) the active case's actual seeded `exhibitLabel` values via the existing `getExhibits` service function (F0/F9) — not hardcoded independently of seed data — so that if the seed data's labeling convention changes in the future, the example prompts cannot silently drift out of sync with it again.
4. **Header unlabeled element:** the numeric element currently rendered near the role selector in the shared app header (used across F8, F9, F10, F11) is evaluated for user-facing purpose. If it serves a real function (e.g., a discrepancy or notification count), it is given a visible label or an accessible tooltip/`aria-label` explaining what the number represents. If it serves no current user-facing function, it is removed entirely from the header rendering. "Present and unexplained" is not an acceptable end state for either case.
5. **Activity feed date+time (amends F8's recentActivity rendering):** every activity-feed entry — Command Center's `recentActivity` rows (F8) and any other screen rendering `ExhibitEvent`-derived rows in a similar feed format (e.g., F10's timeline) — renders both the date and the time of `recordedAt` (e.g., "Oct 8, 2026, 2:14:03 PM"), never time-only, so that two events recorded on different days, or events spanning a day boundary, are never visually indistinguishable to a reader scanning the feed.
6. **Activity feed exhibit label (amends F8's recentActivity rendering):** every activity-feed row — including rows describing a raw state transition (`STATUS_CHANGE` events) — displays the exhibit's label as part of the row's rendered summary (e.g., "P-1: MARKED → OFFERED" rather than a summary with no exhibit identified). This uses the `exhibitLabel` field that is already present in F8's `GET /api/cases/:id/activity` response shape (`Y1-api.md` §Command Center, unchanged) — the fix is entirely in the row-rendering/summary-formatting logic, since the field was already being returned by the API but was not being consistently rendered for every event-type row.

**Inputs:** No new user-supplied inputs. Existing session-derived inputs (`caseId`, `requestingUserRole`) are unchanged across all five fixes.

**Outputs:**
- Items 1, 4, 5, 6: no new data outputs — existing API/service responses are unchanged; only client-side rendering changes.
- Items 2–3: a client-rendered list of example-question strings composed from the active case's currently seeded `exhibitLabel` values (via the existing `getExhibits` call) rather than static hardcoded text.

**Validation:**
- No exhibit row anywhere in the Case Workspace table may be non-clickable — a row with zero discrepancy flags and a row with one or more flags must both be fully, identically clickable across their entire row area
- No activity-feed row (Command Center or Exhibit Detail timeline) may render a summary string without that event's associated `exhibitLabel`, for any `eventType` value, including `STATUS_CHANGE`
- No activity-feed row may render a time-only timestamp — the date must always be present in the same rendered string
- Example assistant prompts must never reference an `exhibitLabel` value that does not exist among the current case's seeded `Exhibit` rows — verified at minimum by an automated test comparing rendered chip text against seeded labels
- The header's numeric element must either carry a visible label/accessible tooltip or not be rendered at all

**Error States:**
No new error codes are introduced by this feature. All five sub-fixes are client-rendering/UX corrections layered on top of existing, already-passing service-layer responses (F7, F8, F9). Any underlying data-fetch failure continues to surface the existing load-failure codes unchanged:

| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| Case Workspace data fetch fails (row-click fix has no data to act on) | 500 | CASE_WORKSPACE_LOAD_FAILED | "Unable to load case exhibits — please retry" *(per F9, unchanged)* |
| Activity feed data fetch fails (date/label fixes have no data to act on) | 500 | COMMAND_CENTER_LOAD_FAILED | "Unable to load trial activity — please retry" *(per F8, unchanged)* |
| Assistant unreachable (example prompts still render from last-known exhibit list) | 503 | ASSISTANT_UNAVAILABLE | "The assistant is temporarily unavailable — please try again" *(per F7, unchanged)* |

**API Surface (this feature):** no new endpoints and no response-shape changes. Reuses `GET /api/cases/:id/exhibits` (F9), `GET /api/cases/:id/activity` (F8 — `exhibitLabel` field already present and unchanged), and the assistant's existing example-prompt rendering path (F7). See `Y1-api.md` §Exhibits, §Command Center, §Assistant.

**Schema Surface (this feature):** no schema changes. This feature touches only client-side rendering logic against data the service layer already returns correctly per `Y0-schema.md`.
## F16: Exhibit Classification Taxonomy

**Description:** Introduces a formal, three-value `ExhibitClassification` enum (`TRIAL`, `CHAMBERS_EX_PARTE`, `SEALED`) captured at exhibit intake and immutable thereafter, replacing the `isSealed` boolean's role as the authoritative input to jury-package exclusion (F13) and role-based visibility (`00-header.md` §Role-Based Visibility). A boolean can distinguish only two states; this product needs three, since chambers-ex-parte material and sealed material are legally distinct categories that nonetheless both require the same hard exclusion from a jury package. Reclassification after intake is explicitly out of scope — if an exhibit's classification is ever wrong, that is a data-correction concern handled outside this feature, not a supported state transition.

**Terminology:**
- **Classification:** One of `TRIAL` (ordinary trial exhibit, fully eligible for jury inclusion), `CHAMBERS_EX_PARTE` (in-camera/sidebar submission visible only to chambers), or `SEALED` (sealed by court order). Set exactly once, at intake, never changed.
- **Derived `isSealed`:** The pre-existing `Exhibit.isSealed` boolean column, retained for backward compatibility with every existing read path (role-visibility gate, F13's pre-Phase-7.1 filter), but as of this feature it is written exactly once — at creation, synchronously, in the same write as `classification` — as `isSealed = (classification !== 'TRIAL')`. It is never set independently of `classification` again.

**Design decision (boolean vs. orthogonal dimension):** `isSealed` is retained as a derived, write-once mirror of `classification` rather than kept as an independently-settable, orthogonal field, because a single source of truth with one place where sensitivity is decided eliminates any possibility of the boolean and the taxonomy disagreeing with each other — a risk an orthogonal second dimension would otherwise require ongoing application-level synchronization to avoid.

**Sub-features:**
- `classification` required at exhibit creation (`POST /api/exhibits`, F0) — no exhibit can exist unclassified
- `classification` immutable after creation — no update endpoint, no reclassification flow, in this version
- `Exhibit.isSealed` computed once, at creation, directly from `classification` — removed as a direct client-settable input
- F13's jury-candidacy exclusion filter extended from a boolean check (`isSealed = false`) to a classification-set check (`classification = 'TRIAL'`)
- Role-based visibility (`00-header.md` §Role-Based Visibility) continues to read `isSealed`, which is now always classification-consistent by construction — no visibility-table changes required

**Process:**
1. At exhibit creation (`POST /api/exhibits`, F0 §Process), the caller supplies `classification` as a required field — not optional, not defaulted.
2. The service layer validates `classification` is one of the three enum values before any write occurs.
3. Within the same transaction that creates the `Exhibit` row, the service layer sets `isSealed = (classification !== 'TRIAL')` directly — this is the only write path for `isSealed` in this and all future versions; the creation API no longer accepts `isSealed` as a independent client input (a client-supplied `isSealed` value in the request body, if present, is ignored and overwritten by the derived value — see Validation).
4. `computeJuryCandidates` (F5 §Process step 1, amended by F13 §Process step 1) is further amended: its candidate query now filters `exhibit.classification = 'TRIAL'` in the same query as the `ADMITTED`-status filter, in place of the prior `exhibit.isSealed = false` filter. Both `CHAMBERS_EX_PARTE` and `SEALED` classifications are hard-excluded identically — neither can ever acquire an `INCLUDED` `JuryPackageExhibit` row via the normal computation path, matching F13's existing "never passed into discrepancy evaluation" guarantee (F13 §Process step 2), now driven by the three-value field instead of the boolean.
5. Role-based visibility checks (`visibility.ts`'s `canViewSealed`-style gate, used by F4/F7/F9/F10) continue to branch on `Exhibit.isSealed` exactly as before — because `isSealed` is now always classification-consistent by construction (step 3), no call site in `visibility.ts` requires modification; `CHAMBERS_EX_PARTE` material is therefore already treated with the same visibility rigor as `SEALED` material everywhere the boolean previously governed, satisfying the PRD's F16 capability without a second visibility pass keyed on `classification` directly.
6. No reclassification endpoint exists. If a future change to an exhibit's classification is ever required, it is handled as a separate, explicitly out-of-scope concern (e.g., a manual data correction outside the application, or a future audited reclassification feature not designed here).
7. Seed data (F0 §Process step 5) is extended so at least one seeded exhibit uses `CHAMBERS_EX_PARTE` and at least one uses `SEALED`, distinct from each other, so the demo can show both categories independently hard-excluded from a jury package — not merely a single sealed example as before.

**Inputs:**
- `classification` (enum: `TRIAL` | `CHAMBERS_EX_PARTE` | `SEALED`, required): supplied at `POST /api/exhibits` (F0) — no default value
- All other `POST /api/exhibits` inputs are unchanged from F0 §Inputs

**Outputs:**
- `Exhibit` record now includes `classification` and a classification-consistent `isSealed` (both present on every exhibit-read response — F0/F4/F9/F10 response shapes are additive, not altered)
- `computeJuryCandidates` / `JuryPackageExhibit` outputs are unaffected in shape — only the candidate-set membership rule changes (F13's exclusion behavior is preserved, now classification-driven)

**Validation:**
- `classification` must be supplied and must be one of the three enum values — reject with 422 otherwise; an exhibit can never exist in an unclassified state
- A client-supplied `isSealed` value in the `POST /api/exhibits` request body, if present, is ignored — the server always derives and overwrites it from `classification`, never trusting a client-asserted boolean for a security-relevant exclusion/visibility input
- `classification` cannot be changed by any existing or new endpoint in this version — no route accepts a `classification` update; this is enforced by omission (no such route exists), not by a runtime immutability check on an update path
- F13's exclusion validation (F13 §Validation: "exclusion takes precedence over and is evaluated independently of F6's `discrepancyStatus`") is unchanged in substance — it now reads `classification != 'TRIAL'` instead of `isSealed = true` to determine the same hard-exclusion outcome

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| `classification` missing at exhibit creation | 422 | CLASSIFICATION_REQUIRED | "classification is required and must be one of: TRIAL, CHAMBERS_EX_PARTE, SEALED" |
| `classification` supplied with an invalid value | 422 | INVALID_CLASSIFICATION | "classification must be one of: TRIAL, CHAMBERS_EX_PARTE, SEALED" |

**API Surface (this feature):** amends `POST /api/exhibits` (F0) to require `classification` in the request body; amends the candidate computation behind `POST /api/cases/:id/jury-package` (F5/F13) to filter on `classification` instead of `isSealed` — see `Y1-api.md` §Exhibits and §Jury Package (amended). No new endpoints.

**Schema Surface (this feature):** adds enum `ExhibitClassification` and column `Exhibit.classification` (required); `Exhibit.isSealed` is retained unchanged in type but is now documented as write-once/derived at creation time — see `Y0-schema.md` §Core Entities (amended).
## F17: Objection-to-Admission State-Machine Hardening

**Description:** Formally closes the theoretical bypass path Phase 7's F12 does not explicitly rule out: an `OBJECTED → ADMITTED` transition occurring without a ruling ever having been recorded on every currently-unresolved thread. Having re-read F12's specification in full (`F12-admission-integrity-gating.md`), **this feature adds no new runtime validation mechanism.** F12's existing Admission Gate — which rejects `toStatus = ADMITTED` whenever any `ObjectionCurrentState` row for the exhibit has `status = 'UNRESOLVED'` (F12 §Process step 3a) — already fully and unconditionally prevents this transition, because `ObjectionCurrentState.status` can leave `UNRESOLVED` only via a `RULING_RECORDED` ledger event (F02 §Process steps 5–6; see `00-header.md` §Current-State Projection: projections are derived exclusively from the ledger, with no independent update path). There is therefore no code path — UI, API, seed loader, or any future automation — by which an objection thread's status could change without a ruling event, and consequently no code path by which `OBJECTED → ADMITTED` could succeed without one.

**What this feature actually adds:** (1) an explicit, named statement of this guarantee as a formal invariant of the system (this document), so the guarantee is traceable and not merely an emergent property of two unrelated features; (2) dedicated regression test coverage exercising the bypass scenario directly — attempting to force an exhibit into `ADMITTED` immediately after an objection is raised but before any ruling is recorded, and confirming F12's existing gate rejects it with the existing `ADMISSION_BLOCKED` / `UNRESOLVED_OBJECTION` response, unchanged; and (3) an explicit confirmation, also now regression-tested, that `OFFERED → ADMITTED` (skipping `OBJECTED` entirely, when no objection was ever raised against the exhibit) remains a legal, unaffected transition — because F12's gate only fires when an `UNRESOLVED` row exists, and an exhibit with zero objection threads has none.

**Terminology:**
- No new terms. This feature reuses F12's **Admission Gate** and **Blocking Reason** terminology unchanged (see `F12-admission-integrity-gating.md` §Terminology).

**Sub-features:**
- None (no new capability). This entry exists to satisfy the PRD's F17 requirement with an honest "already covered" determination rather than inventing redundant mechanism.
- Regression test: objection raised → ruling not yet recorded → attempt `ADMITTED` → rejected (exercises F12's existing gate, not new code)
- Regression test: exhibit never objected to → `OFFERED → ADMITTED` directly → succeeds (confirms no regression in the legal direct-admission path)

**Process:**
1. A caller attempts `toStatus = ADMITTED` on an exhibit currently in `OBJECTED` status with at least one `UNRESOLVED` objection thread.
2. F12's existing Admission Gate (F12 §Process step 3a) runs unchanged: it queries `ObjectionCurrentState WHERE exhibitId = :id AND status = 'UNRESOLVED'`.
3. Because the objection thread has had no `RULING_RECORDED` event, its `ObjectionCurrentState.status` is still `UNRESOLVED` (it can be in no other state — see F02 §Process step 2, which sets `status: 'UNRESOLVED'` at raise-time, and steps 5–7, the only code path that ever changes it).
4. The gate's query returns the unresolved row; the `UNRESOLVED_OBJECTION` blocking reason applies; the request is rejected with `422 ADMISSION_BLOCKED`, identically to F12 §Process step 4 — no `ExhibitEvent` is appended, no projection is updated.
5. A ruling is subsequently recorded (`RULING_RECORDED`, F02 §Process step 4) with disposition `SUSTAINED` or `OVERRULED`. `ObjectionCurrentState.status` updates to that disposition (F02 §Process step 6) — the thread is now resolved.
6. A subsequent `toStatus = ADMITTED` attempt now finds zero `UNRESOLVED` rows for the exhibit; F12's gate passes (assuming the `NO_CUSTODIAN` condition also does not apply); the transition succeeds via F12's existing unchanged success path.
7. Separately: an exhibit that was never objected to (zero `ObjectionCurrentState` rows exist for it at all) attempts `OFFERED → ADMITTED` directly. F12's gate query returns zero rows (there is nothing to return — no thread exists); the `UNRESOLVED_OBJECTION` blocking reason does not apply; the transition proceeds exactly as it does today, unaffected by this feature.

**Inputs:** Identical to F12 §Inputs — no new inputs.

**Outputs:** Identical to F12 §Outputs — no new outputs.

**Validation:**
- No new validation rules. F12 §Validation already states the complete, sufficient condition: "`toStatus = ADMITTED` is accepted only if zero `ObjectionCurrentState` rows for the exhibit have `status = 'UNRESOLVED'` at check time" — this is unconditionally equivalent to "every objection thread has a recorded ruling," because `UNRESOLVED` is the only status a thread can hold before a ruling is recorded, and no non-ledger write path to `ObjectionCurrentState` exists anywhere in the service layer.
- This feature's only "validation" contribution is the regression test suite described above, confirming the invariant holds and will continue to hold (i.e., any future code change that introduced a direct current-state mutation bypassing `recordEvent` would be caught by this suite, not silently permitted).

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| (No new error states — F12's existing `ADMISSION_BLOCKED` / `UNRESOLVED_OBJECTION` response, exercised by new regression tests, is unchanged) | — | — | See `F12-admission-integrity-gating.md` §Error States |

**API Surface (this feature):** none — no endpoint is added, amended, or behaviorally changed. See `Y1-api.md` §Status (F1/F12 entry, unchanged).

**Schema Surface (this feature):** none — introduces no new tables, fields, or enum values. See `Y0-schema.md` (unchanged by this feature).
## F18: Custodian Required at Intake (MARKED)

**Description:** Moves the custodian requirement from F12's admission-time check to the very first status transition (`(none) → MARKED`), so no exhibit can ever exist in the system having entered the admission lifecycle with no custodian of record — closing the window, previously open from intake until admission, during which an exhibit's custody chain had no starting link. The custodian is supplied as a required parameter alongside the `MARKED` transition itself and validated/written in the same transaction, so there is no separate manual step a user could skip or forget.

**Terminology:**
- **Intake Custodian:** The `toCustodianUserId` established atomically with an exhibit's first-ever `STATUS_CHANGE` event (`(none) → MARKED`). Functionally identical to any other custody-chain link (F03 §Terminology) but created as part of the same transaction as the status transition rather than via a subsequent, separate call.

**Sub-features:**
- The `(none) → MARKED` transition now requires a non-null `custodianUserId` parameter
- Both the `STATUS_CHANGE` event and the exhibit's first `CUSTODY_TRANSFER`-family event (see F19 §Process for the first-assignment exception) are appended within the same database transaction
- `createExhibit` (F0, identity-only) is unchanged — it accepts no status or custody fields, exactly as before; the new requirement attaches exclusively to the first `recordStatusChange` call, not to exhibit creation
- F12's existing admission-time custodian check (F12 §Process step 3b) is retained unchanged as a second, later gate — this feature does not replace it, since a custody chain established at intake could in principle still break before admission (e.g., a future custody event with a null result), and F12's later check remains the final backstop

**Process:**
1. `createExhibit` (F0) creates the `Exhibit` identity row exactly as before — no status, no custodian. An exhibit with zero `ExhibitEvent` rows continues to report "not yet entered into evidence" (F0 §Outputs), unaffected by this feature.
2. A caller requests the exhibit's first status transition via the same endpoint as every other transition (`POST /api/exhibits/:id/events/status`, F1), with `toStatus = MARKED` and a new required body field `custodianUserId`.
3. The service layer runs F1's existing zero-prior-events check (F01 §Validation: "only accepts `toStatus = MARKED` as its first transition") — unchanged.
4. **New gate, evaluated only when this is the exhibit's first-ever `STATUS_CHANGE` event (i.e., `toStatus = MARKED` with no prior events):** the service layer validates that `custodianUserId` is present and references an existing, active `User` (reusing F03 §Validation's existing `INVALID_CUSTODIAN` check). If absent or invalid, the request is rejected before any write occurs.
5. If the gate passes, the service layer — within a single database transaction — (a) appends the `STATUS_CHANGE` event (`fromStatus: null, toStatus: 'MARKED'`), (b) appends a `CUSTODY_TRANSFER_CONFIRMED` event (`fromCustodianUserId: null, toCustodianUserId: custodianUserId`) establishing the exhibit's first-ever custody link directly, with no preceding `CUSTODY_TRANSFER_PROPOSED` event (see `F19-custody-handoff-confirmation.md` §Process step 1 and §Design Decisions for why this specific event is a documented single-phase bootstrap exception to F19's general two-phase model), and (c) updates both `ExhibitCurrentState` and `CustodyCurrentState` together.
6. If the transaction fails for any reason, neither the status event nor the custody event is persisted — there is no intermediate state where an exhibit is `MARKED` with no custodian, even transiently.
7. All subsequent transitions (`MARKED → OFFERED`, etc.) and all subsequent custody transfers are unaffected by this feature and follow F1/F19's existing rules unchanged.
8. The seed loader (F0 §Process step 3) is amended so every seeded exhibit's first `recordEvent` call for `STATUS_CHANGE` includes a `custodianUserId` — a seed assertion (F0 §Validation) now additionally fails fast if any seeded exhibit's `MARKED` transition was recorded without one, preventing the seed loader itself from producing a state the live system could no longer produce.

**Inputs:**
- `exhibitId` (string/UUID, required) — same as F1
- `toStatus` (enum, required) — same as F1
- `actorUserId` (string/UUID, required) — same as F1
- `notes` (string, optional) — same as F1
- `custodianUserId` (string/UUID, **required only when this is the exhibit's first-ever `STATUS_CHANGE` event, i.e. `toStatus = MARKED` with zero prior events**): the user established as the exhibit's intake custodian, atomically with the transition

**Outputs:**
- On success: identical to F1 §Outputs, plus the `CustodyCurrentState` row created in the same transaction (returned alongside the `STATUS_CHANGE` event's response so the caller sees both writes without a second round-trip)
- On rejection: `{ error: { code: 'CUSTODIAN_REQUIRED_AT_INTAKE', message } }`, or F03's existing `INVALID_CUSTODIAN` shape if a `custodianUserId` was supplied but does not reference a valid active user

**Validation:**
- `custodianUserId` must be present and non-null when, and only when, the transition being recorded is the exhibit's first-ever `STATUS_CHANGE` event with `toStatus = MARKED` — all other transitions (including any that are not the first event) do not require or accept this field
- `custodianUserId`, when supplied, must reference an existing, active `User` — reuses F03's existing `INVALID_CUSTODIAN` validation and error code, not a new one
- The status write and the custody write are atomic — both succeed or both fail; there is no code path producing a `MARKED` exhibit with no `CustodyCurrentState` row
- F12's admission-time custodian check (F12 §Validation) is unchanged and continues to run independently at the `ADMITTED` transition — this feature does not weaken, replace, or make redundant that later check

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| First-ever `MARKED` transition attempted with no `custodianUserId` | 422 | CUSTODIAN_REQUIRED_AT_INTAKE | "A custodian must be established when an exhibit is first marked into evidence" |
| `custodianUserId` supplied but does not reference a valid active user | 422 | INVALID_CUSTODIAN | "custodianUserId does not reference a valid active user" *(reused from F03)* |
| All other status-transition errors (invalid transition, finalized status, stale-state conflict, exhibit not found, admission-blocked) | — | — | Unchanged — see F01/F12 §Error States |

**API Surface (this feature):** amends `POST /api/exhibits/:id/events/status` (F1) — body gains conditionally-required `custodianUserId` when this is the exhibit's first transition. See `Y1-api.md` §Status (amended).

**Schema Surface (this feature):** introduces no new tables or fields. Writes the existing `ExhibitEvent`/`CustodyCurrentState` shapes (F03) one transaction earlier than before; reads existing `User` for validation — see `Y0-schema.md` §Event Ledger, §Current-State Projections (unchanged shapes, amended write-timing only).
## F19: Custody Handoff Confirmation

**Description:** Converts custody transfer from a single unilateral event (the current custodian unilaterally asserts a handoff occurred) into a two-phase ledger-event model: a `CUSTODY_TRANSFER_PROPOSED` event creates a pending transfer, and a `CUSTODY_TRANSFER_CONFIRMED` event — recorded only by the named receiving custodian, confirming their own receipt — completes it. This closes the gap where a custody record could previously assert a handoff the receiving party never actually acknowledged taking possession of. The exhibit's first-ever custody assignment (established atomically at intake per F18) is an explicit, documented exception to this two-phase model — see §Design Decisions below.

**Terminology:**
- **Pending Transfer:** The state of a `CustodyCurrentState` row between a `CUSTODY_TRANSFER_PROPOSED` event and its resolving `CUSTODY_TRANSFER_CONFIRMED` or `CUSTODY_TRANSFER_CANCELLED` event. During this window, `currentCustodianUserId` does **not** change — "who currently has custody" always reflects the last *confirmed* transfer, never a pending proposal.
- **Proposer:** The user recording a `CUSTODY_TRANSFER_PROPOSED` event. Must be the exhibit's current custodian of record (identical to F03's existing `fromCustodianUserId`-match requirement — unchanged, see §Validation).
- **Named Receiver:** The user identified as `toCustodianUserId` on a pending proposal. Only this specific user may record the resolving `CUSTODY_TRANSFER_CONFIRMED` event — not an authorized role acting generally, not the proposer, not any other user, even one with an otherwise-permitted role.

**Design decisions:**
- **Pending-state representation:** `CustodyCurrentState` gains three nullable fields — `pendingTransferToUserId`, `pendingTransferEventId`, `pendingTransferProposedAt` — populated when a proposal is recorded and cleared when it resolves (confirmed or cancelled). `currentCustodianUserId` is left untouched during the pending window. This is simpler than introducing a parallel "proposed state" table, keeps exactly one row per exhibit to read for "who has it / is anything pending," and requires no join for the common case.
- **No-confirm path:** a pending transfer stays pending indefinitely by default; there is no time-based auto-expiry. A time-based expiry would require a background job or scheduled task, which this architecture explicitly does not have (`Y3-integrations.md`: "No message queues, caches, or background job runners"). Instead, an explicit, synchronous `CUSTODY_TRANSFER_CANCELLED` action is provided, consistent with the system's request/response-only write model. This is the simpler option and is justified by architectural fit, not by any claim that indefinite pending is ideal operationally.
- **Interaction with F18 (first-ever assignment):** the exhibit's first-ever custody link, established atomically at the `MARKED` transition (F18 §Process step 5), does **not** go through the propose/confirm flow. At intake there is no existing custodian relationship to formalize a handoff *from* — the deputy establishing custody at intake is creating the record, not receiving a transfer from a predecessor. This bootstrap case is recorded as a single, immediately-effective event (see §Process step 1) with `fromCustodianUserId: null`; two-phase confirmation applies only to transfers **after** that first established custodian.

**Sub-features:**
- Propose a custody transfer (current custodian names an intended receiver) — does not change current custody
- Confirm a custody transfer (named receiver only) — completes the transfer, updates `CustodyCurrentState`
- Cancel a pending transfer (proposer, or any role authorized to propose) — reverts to no-pending-transfer state, current custody unaffected
- Visible distinction between a pending proposal and a confirmed transfer on Custody Tracking (F3), Exhibit Detail (F10), and the assistant's `getCustodian` tool (F7)
- The exhibit's intake custody link (F18) is a documented single-phase exception — not routed through propose/confirm

**Process:**
1. **Intake bootstrap (F18 interaction):** at the `(none) → MARKED` transition, the service layer appends a `CUSTODY_TRANSFER_CONFIRMED` event directly — `payload: { fromCustodianUserId: null, toCustodianUserId: <F18's custodianUserId>, reason?: 'intake' }` — with no preceding `CUSTODY_TRANSFER_PROPOSED` event, and immediately sets `CustodyCurrentState.currentCustodianUserId` accordingly. No pending-transfer fields are ever populated for this specific event.
2. **Proposing a subsequent transfer:** the current custodian (or an authorized role per F20's propose gate) calls `recordEvent({ exhibitId, eventType: 'CUSTODY_TRANSFER_PROPOSED', payload: { fromCustodianUserId, toCustodianUserId, reason? }, actorUserId })`.
3. The service layer validates `fromCustodianUserId` exactly matches `CustodyCurrentState.currentCustodianUserId` — identical, unchanged validation to F03 §Validation's existing wrong-holder rejection (`CUSTODY_CHAIN_BROKEN`).
4. The service layer validates no transfer is already pending for this exhibit (`pendingTransferToUserId` must currently be null) — a second proposal cannot be raised while one is outstanding.
5. The service layer appends the immutable `CUSTODY_TRANSFER_PROPOSED` `ExhibitEvent` row, then sets `CustodyCurrentState.pendingTransferToUserId = toCustodianUserId`, `pendingTransferEventId = <this event's id>`, `pendingTransferProposedAt = now()`. `currentCustodianUserId` is **not** modified.
6. **Confirming:** the named receiver (and only the named receiver — `actorUserId` must exactly equal `CustodyCurrentState.pendingTransferToUserId`) calls `recordEvent({ exhibitId, eventType: 'CUSTODY_TRANSFER_CONFIRMED', payload: { proposedEventId }, actorUserId })`.
7. The service layer validates a transfer is currently pending for this exhibit and that `actorUserId` matches `pendingTransferToUserId` exactly — any other user, including the original proposer, the exhibit's prior custodian, or a user with an otherwise custody-authorized role, is rejected.
8. The service layer appends the `CUSTODY_TRANSFER_CONFIRMED` event, then updates `CustodyCurrentState`: `currentCustodianUserId = pendingTransferToUserId`, `since = now()`, `lastEventId = <confirm event id>`, and clears all three pending fields to null.
9. **Cancelling:** the proposer, or any user holding a role authorized to propose custody transfers (F20 §Permission Matrix), calls `recordEvent({ exhibitId, eventType: 'CUSTODY_TRANSFER_CANCELLED', payload: { proposedEventId, reason? }, actorUserId })` while a transfer is pending.
10. The service layer appends the `CUSTODY_TRANSFER_CANCELLED` event and clears the three pending fields to null. `currentCustodianUserId` is unaffected — it was never changed by the proposal in the first place.
11. `getCustodian(exhibitId)` (F03 §Process step 5) is amended to additionally return whether a transfer is currently pending and, if so, to whom — so Custody Tracking (F3), Exhibit Detail (F10), and the assistant's `getCustodian` tool (F7) all render a pending proposal as visibly distinct from a confirmed custodian, never silently indistinguishable from "no activity."
12. `getCustodyHistory(exhibitId)` (F03 §Process step 6) is amended to include `CUSTODY_TRANSFER_PROPOSED`, `CUSTODY_TRANSFER_CONFIRMED`, and `CUSTODY_TRANSFER_CANCELLED` events in the ordered chain-of-custody timeline, so a cancelled/superseded proposal remains visible in history rather than disappearing.

**Inputs — Propose:**
- `exhibitId` (string/UUID, required)
- `fromCustodianUserId` (string/UUID, required): must match the exhibit's current custodian exactly
- `toCustodianUserId` (string/UUID, required): the intended receiver
- `reason` (string, optional, max 300 chars)
- `actorUserId` (string/UUID, required): must hold an F20-authorized propose role

**Inputs — Confirm:**
- `exhibitId` (string/UUID, required)
- `proposedEventId` (string/UUID, required): must reference the currently-pending `CUSTODY_TRANSFER_PROPOSED` event for this exhibit
- `actorUserId` (string/UUID, required): must exactly equal the pending transfer's named receiver

**Inputs — Cancel:**
- `exhibitId` (string/UUID, required)
- `proposedEventId` (string/UUID, required): must reference the currently-pending proposal
- `reason` (string, optional, max 300 chars)
- `actorUserId` (string/UUID, required): must be the original proposer or hold an F20-authorized propose role

**Outputs:**
- Propose: updated `CustodyCurrentState` (pending fields populated, `currentCustodianUserId` unchanged), the created `ExhibitEvent` row
- Confirm: updated `CustodyCurrentState` (`currentCustodianUserId` updated, pending fields cleared), the created `ExhibitEvent` row
- Cancel: updated `CustodyCurrentState` (pending fields cleared, `currentCustodianUserId` unchanged), the created `ExhibitEvent` row
- `getCustodian` output shape extended with `pendingTransfer: { toUserId, proposedAt, eventId } | null`

**Validation:**
- Propose: `fromCustodianUserId` must exactly match `CustodyCurrentState.currentCustodianUserId` (F03's existing rule, unchanged) — reuses `CUSTODY_CHAIN_BROKEN`
- Propose: rejected if a transfer is already pending for this exhibit — one outstanding proposal at a time, per exhibit
- Propose: `toCustodianUserId` must reference a valid active `User`; `fromCustodianUserId`/`toCustodianUserId` must differ (F03's existing `NO_OP_TRANSFER`, unchanged)
- Confirm: rejected if no transfer is currently pending for this exhibit, or if `proposedEventId` does not match the currently-pending proposal
- Confirm: rejected if `actorUserId` does not exactly equal the pending transfer's `toCustodianUserId` — this check is an identity match, not a role check; even a user whose role is generally authorized to confirm custody cannot confirm on behalf of a different named receiver
- Cancel: rejected if no transfer is currently pending, or if the actor is neither the original proposer nor holds an F20-authorized propose role
- The legacy unilateral `POST /api/exhibits/:id/events/custody` endpoint (F03) is retained **only** for the F18 intake-bootstrap case (`fromCustodianUserId: null`) — if called with a non-null `fromCustodianUserId` (i.e., for any transfer after the first), it is rejected, directing the caller to the propose/confirm endpoints instead

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| Propose attempted while a transfer is already pending | 409 | CUSTODY_TRANSFER_ALREADY_PENDING | "A custody transfer is already pending for this exhibit" |
| Confirm/cancel attempted with no transfer currently pending, or a mismatched `proposedEventId` | 404 | CUSTODY_CONFIRMATION_NOT_PENDING | "No pending custody transfer found matching this request" |
| Confirm attempted by anyone other than the named receiver | 403 | CUSTODY_CONFIRM_WRONG_USER | "Only the named receiving custodian may confirm this transfer" |
| Legacy unilateral custody endpoint called for a non-first transfer (`fromCustodianUserId` non-null) | 409 | CUSTODY_TRANSFER_REQUIRES_CONFIRMATION | "Transfers after the first must use the propose/confirm flow" |
| All other custody errors (chain-broken on propose, invalid custodian, no-op transfer, exhibit not found) | — | — | Unchanged — see F03 §Error States |

**API Surface (this feature):** amends `POST /api/exhibits/:id/events/custody` (F3) to reject non-first-transfer calls; adds `POST /api/exhibits/:id/events/custody/propose`, `POST /api/exhibits/:id/events/custody/confirm`, `POST /api/exhibits/:id/events/custody/cancel` — see `Y1-api.md` §Custody (amended).

**Schema Surface (this feature):** adds `CUSTODY_TRANSFER_PROPOSED`, `CUSTODY_TRANSFER_CONFIRMED`, `CUSTODY_TRANSFER_CANCELLED` to the `EventType` enum; adds `pendingTransferToUserId` (nullable), `pendingTransferEventId` (nullable), `pendingTransferProposedAt` (nullable) to `CustodyCurrentState` — see `Y0-schema.md` §Current-State Projections (amended). The legacy `CUSTODY_TRANSFER` event type is retained for the F18 intake-bootstrap path's historical/first-link semantics only where already written by prior-version seed data; new intake links use `CUSTODY_TRANSFER_CONFIRMED` per §Process step 1.
## F20: Server-Side Role Enforcement Matrix (Full RBAC)

**Description:** Extends server-side role checking — today applied only to ruling disposition (F02), jury-package finalization (F05), and discrepancy acknowledgment (F06) — to every write action in the system, under one explicit, single permission matrix. Every write handler resolves the acting user's role from the `User.role` database column via `actorUserId`, exactly as `recordRuling`'s existing judge-check and `assertJuryWriteRole` already do — never from a client-supplied role claim. This feature formally and explicitly supersedes the PRD's and TechArch's prior "full OAuth/production-grade auth hardening out of scope" note, narrowing it to *authentication* only: proving who a user is (OAuth/OIDC/session hardening) remains out of scope; *authorization* — what a known, seeded role may do — is now fully enforced server-side for every write path.

**Terminology:**
- **Permission Matrix:** The single table below, the canonical and only definition of which `Role` may perform which write action — see `00-header.md` §Cross-Cutting Terminology.
- **Role Resolution:** The act of looking up `actorUserId`'s `role` column from the `User` table at request time, inside the service layer, before the requested write is permitted to proceed. This is the only trusted source of a user's role for authorization purposes — a request body or header asserting a role is never trusted.
- **`assertRole`:** A new shared service-layer helper, `assertRole(actorUserId, allowedRoles: Role[], actionLabel: string)`, generalizing the pattern already used ad hoc by `recordRuling`'s judge-check and `assertJuryWriteRole`. Every write action listed in the matrix below calls this helper (or an action-specific wrapper around it) rather than re-implementing its own role check.

**Sub-features:**
- A single, explicit permission matrix covering every write action in the system (table below)
- `assertRole` shared helper, replacing ad hoc per-feature role checks with one reusable, consistently-tested mechanism
- New `ROLE_NOT_PERMITTED` message variants for each action not already role-gated prior to this feature
- No change to authentication — seeded users + role switcher remain the identity model; this feature hardens what a known role may do, not how identity is established

**Permission Matrix:**

| # | Action | JUDGE | CHAMBERS_STAFF | DEPUTY | CLERK | ATTORNEY | ADMIN | Status Before F20 |
|---|---|---|---|---|---|---|---|---|
| 1 | Create exhibit | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ | **New gate** |
| 2 | Mark / Offer / Withdraw status transition | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ | **New gate** |
| 3 | Admit / Exclude status transition | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ | **New gate** |
| 4 | Raise objection | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | **New gate** |
| 5 | Record ruling (SUSTAINED/OVERRULED/RESERVED) | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | Unchanged (F02) |
| 6 | Propose custody transfer | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ | **New gate** |
| 7 | Confirm custody transfer receipt | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ *(plus identity match — see F19)* | **New gate** |
| 8 | Acknowledge discrepancy | ✓ | ✗ | ✓ | ✓ | ✗ | ✓ | Unchanged (F06) |
| 9 | Initiate / finalize jury package | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ | Unchanged (F05) |
| 10 | Exclude jury package exhibit | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ | Unchanged (F13) |

Rows 5, 8, 9, 10 are included for completeness (the PRD requires the *complete* matrix to be documented in one place) but their enforcement is unchanged by this feature — they are retrofitted onto the same `assertRole` helper for consistency, not newly gated. Rows 1–4, 6, and 7 are the new server-side gates this feature adds. `CHAMBERS_STAFF` has full read/visibility (per `00-header.md` §Role-Based Visibility) but no write permission for any action in this matrix — it is a read-only role in this version. `ATTORNEY` is permitted exactly one write action (raise objection) and is otherwise read-only, matching the PRD's explicit "Attorneys: raise objections, read/view only — no write access outside objections."

**Process:**
1. Every write-handling service function listed in the matrix now begins by calling `assertRole(actorUserId, <allowed roles for this action>, <action label>)` before performing any other validation or write.
2. `assertRole` resolves `actorUserId` to its `User.role` column via a direct database lookup — never trusting a role value passed in the request body or a client-side store.
3. If the resolved role is not in the action's allowed set, `assertRole` throws, and the route handler surfaces `403 ROLE_NOT_PERMITTED` with the action-specific message (see table below) **before** any other validation in that handler runs — a disallowed-role request never reaches field-level validation, state-machine checks, or ledger writes.
4. If the resolved role is permitted, the handler proceeds exactly as already specified in F0–F19 — this feature adds a precondition, it does not alter any downstream logic.
5. For custody confirmation specifically (row 7), `assertRole` is necessary but not sufficient: after the role check passes, F19's separate identity check (`actorUserId` must equal the pending transfer's named receiver) still applies — a `DEPUTY` who is not the named receiver is correctly role-permitted in general but still rejected with `CUSTODY_CONFIRM_WRONG_USER` (F19), not `ROLE_NOT_PERMITTED`. The two checks are independent and both must pass.
6. UI screens are updated so that a control for an action the current role cannot perform is not rendered as an enabled, silently-failing control (consistent with F14's existing disclosure principle) — this is a UI-consistency recommendation, not a server-side requirement; the server-side gate in steps 1–4 is authoritative regardless of what the UI renders.
7. The assistant's tool wrappers (F7) are read-only in this version (none of the 8 tools perform a write) and are therefore unaffected by this matrix — if a future write-capable tool is added, it must call the identical `assertRole` helper with the requesting user's resolved role, per the existing "no assistant admin override" principle (`00-header.md` §Role-Based Visibility).

**Inputs:**
- `actorUserId` (string/UUID, required): already required on every write action listed above (F0–F19) — no new input is introduced; this feature changes only how `actorUserId` is validated (role resolution + enforcement), not what callers must supply
- No new client-supplied role input is introduced by this feature — a client-supplied role claim, if one is ever present in a request, continues to be ignored, exactly as the pre-existing judge-check and `assertJuryWriteRole` already ignore it

**Outputs:**
- No change to the success-path output shape of any existing action — `assertRole` either permits the request to proceed unchanged or rejects it before any processing occurs
- Rejection output: `{ error: { code: 'ROLE_NOT_PERMITTED', message } }`, message varying per action per the table below

**Validation:**
- Role resolution is always via a server-side `User.role` lookup keyed on `actorUserId` — never via a request body field, header, or any other client-supplied value
- Each action's allowed-role set is exactly as listed in the Permission Matrix above — no action has an implicit "ADMIN can always do anything regardless of the table" override beyond what the table explicitly lists (in this matrix, ADMIN is in fact permitted for every action except ruling disposition, which remains strictly JUDGE-only with no exception)
- `assertRole` is called before any other validation in every gated handler — a malformed request from a disallowed role is still rejected with `ROLE_NOT_PERMITTED`, not a field-validation error, so no information about the request's validity is leaked to an unauthorized actor

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| Non-DEPUTY/CLERK/ADMIN attempts to create an exhibit | 403 | ROLE_NOT_PERMITTED | "Only a courtroom deputy, clerk, or admin may create an exhibit" |
| Non-DEPUTY/CLERK/ADMIN attempts a mark/offer/withdraw status transition | 403 | ROLE_NOT_PERMITTED | "Only a courtroom deputy, clerk, or admin may record this status transition" |
| Non-DEPUTY/CLERK/ADMIN attempts an admit/exclude status transition | 403 | ROLE_NOT_PERMITTED | "Only a courtroom deputy, clerk, or admin may record this status transition" |
| Non-ATTORNEY/DEPUTY/CLERK/ADMIN attempts to raise an objection | 403 | ROLE_NOT_PERMITTED | "Only an attorney, courtroom deputy, clerk, or admin may raise an objection" |
| Non-DEPUTY/CLERK/ADMIN attempts to propose a custody transfer | 403 | ROLE_NOT_PERMITTED | "Only a courtroom deputy, clerk, or admin may propose a custody transfer" |
| Non-DEPUTY/CLERK/ADMIN attempts to confirm a custody transfer | 403 | ROLE_NOT_PERMITTED | "Only a courtroom deputy, clerk, or admin may confirm custody receipt" |
| Non-JUDGE attempts SUSTAINED/OVERRULED ruling | 403 | ROLE_NOT_PERMITTED | "Only a judge may record a sustained or overruled ruling" *(unchanged, F02)* |
| Non-DEPUTY/CLERK/JUDGE/ADMIN attempts discrepancy acknowledgment | 403 | ROLE_NOT_PERMITTED | "This role is not permitted to acknowledge discrepancies" *(unchanged, F06)* |
| Non-DEPUTY/CLERK/ADMIN attempts jury package initiate/finalize | 403 | ROLE_NOT_PERMITTED | "Only courtroom deputy, clerk, or admin roles may finalize a jury package" *(unchanged, F05)* |
| Non-DEPUTY/CLERK/ADMIN attempts jury package exhibit exclusion | 403 | ROLE_NOT_PERMITTED | "Only courtroom deputy, clerk, or admin roles may remove an exhibit from a jury package" *(unchanged, F13)* |

**API Surface (this feature):** amends every write endpoint listed in the Permission Matrix to add a `ROLE_NOT_PERMITTED` (403) error response where one did not already exist (rows 1–4, 6, 7) — see `Y1-api.md` §Exhibits, §Status, §Objections, §Custody (all amended). No new endpoints.

**Schema Surface (this feature):** introduces no new tables, fields, or enums. Reads the existing `User.role` column (`Y0-schema.md` §Core Entities, `Role` enum, unchanged) as the sole source of role-resolution truth for every gated action.
## F21: Pending-Ruling Queue

**Description:** A new judge-facing read view listing every currently-`UNRESOLVED` objection thread case-wide, sorted longest-waiting-first by elapsed time since `raisedAt`, so a judge can immediately see which objections have been waiting longest rather than discovering them exhibit-by-exhibit. Having checked `Y1-api.md`'s existing `GET /api/cases/:id/objections?status=unresolved` endpoint and `Y0-schema.md`'s `ObjectionCurrentState` shape, **`raisedAt` is already present on every row** — this feature therefore requires **no new endpoint and no new service function**. It reuses F02's existing `getUnresolvedObjections(caseId)` unchanged at the data layer, with exactly one additive read-time amendment (an `exhibitLabel` join, to avoid a client-side N+1 lookup) and a new client-side screen that sorts and live-updates the existing response.

**Terminology:**
- **Elapsed Wait Time:** `now() - ObjectionCurrentState.raisedAt`, computed client-side at render time and recomputed on each live-sync tick, exactly matching the Command Center's existing freshness-indicator recomputation pattern (F08, `Y3-integrations.md` §Live Multi-Screen Sync) — not a stored or server-computed value, since "now" is only meaningful at render time.

**Sub-features:**
- Judge-facing screen listing every case-wide `UNRESOLVED` objection thread
- Default sort: elapsed wait time descending (longest-waiting first) — computed and applied client-side against the existing endpoint's response
- Each row: exhibit label, objecting party, grounds, elapsed time (live-updating)
- Entries link directly into the existing ruling-recording action (F02) and into the Exhibit Detail View (F10)
- One additive backend amendment: `getUnresolvedObjections` now includes `exhibitLabel` in its response (read-time join), avoiding a second round-trip per row

**Process:**
1. A judge opens the new Pending-Ruling Queue screen (route restricted to `JUDGE` role per F20's permission matrix — other roles do not get a navigation entry point to this screen; the underlying `GET /api/cases/:id/objections?status=unresolved` endpoint itself remains readable by any role with case visibility, consistent with every other read endpoint in the system, since this is a read-only view and F20's matrix governs writes).
2. The client calls the existing `GET /api/cases/:id/objections?status=unresolved` endpoint (F02) — no new route.
3. The service layer's `getUnresolvedObjections(caseId)` function is amended to join `Exhibit.exhibitLabel` into each returned row (read-time join, same pattern as F14's existing `justification` read-time join from `acknowledgedEventId` — no schema change, see F14 §Outputs for the precedent).
4. The client receives the array of `ObjectionCurrentState` rows (each now including `exhibitLabel`, `objectingParty`, `grounds`, `raisedAt`) and sorts it client-side by `raisedAt` ascending (oldest `raisedAt` = longest elapsed = displayed first).
5. The client recomputes each row's elapsed-time display on every live-sync poll tick (reusing the existing `useUnresolvedObjections` polling hook, F08/`Y3-integrations.md` §Live Multi-Screen Sync — no new hook, no new polling interval), so the queue's ordering and displayed wait times stay current without a manual refresh, matching the Command Center's established freshness pattern.
6. Each row renders a link into the existing ruling-recording action (`POST /api/objections/:id/ruling`, F02) and a link into the Exhibit Detail View (`GET /api/exhibits/:id/history`, F10) for full context — both existing endpoints, unchanged.
7. When a ruling is recorded against a thread (via this screen's link, or from any other screen), the thread's `ObjectionCurrentState.status` leaves `UNRESOLVED` (F02 §Process step 6); on the queue's next poll, that row no longer appears in `getUnresolvedObjections`'s result set and disappears from the queue — no special-case removal logic is needed, since the queue is a live, unfiltered-further view of the same case-wide unresolved set every other screen reads.

**Inputs:**
- `caseId` (string/UUID, required): identical input to the existing F02 endpoint — no new inputs

**Outputs:**
- `Array<ObjectionCurrentState & { exhibitLabel: string }>` — the existing F02 response shape, additively widened with `exhibitLabel`. No other field changes.

**Validation:**
- No new validation rules — this feature performs no write of its own; it reuses F02's existing read path and validation unchanged
- The `exhibitLabel` join must never fail silently if an `ObjectionCurrentState` row's `exhibitId` does not resolve to an exhibit the requesting role may view — in that case the row is omitted entirely (same 404-style masking principle as every other sealed/role-restricted read, `00-header.md` §Role-Based Visibility), not rendered with a blank or placeholder label

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| (No new error states — reuses F02's existing `GET /api/cases/:id/objections` error handling unchanged) | — | — | See `F02-objection-ruling-tracking.md` §Error States |

**API Surface (this feature):** amends the response shape of the existing `GET /api/cases/:id/objections?status=unresolved` endpoint (F2) to additively include `exhibitLabel` per row — see `Y1-api.md` §Objections (amended). No new endpoint.

**Schema Surface (this feature):** none. Reads existing `ObjectionCurrentState` and `Exhibit.exhibitLabel` via an additive read-time join — see `Y0-schema.md` §Current-State Projections (unchanged).
## F22: Multi-Case Support with Case Selector

**Description:** Replaces the current hardcoded single-demo-case assumption (`DEMO_CASE_NUMBER`) with the ability to list active cases and explicitly select which one is active for every screen and the assistant. **This requires no database schema change** — `Case`, `User`, `Exhibit`, `JuryPackage`, and `AssistantConversation` are already properly `caseId`-scoped via foreign keys in the existing schema (`Y0-schema.md`), per the prior TechArch note that recorded case-partitioning as structurally present but not enforced. This feature is confirmed to be a service/API/UI change only.

**Terminology:**
- **Active Case:** The `caseId` the client currently has selected, carried on every request exactly as `requestingUserRole` already is today (a per-request parameter derived from client-side state, not a server-side session value) — the server remains stateless with respect to "which case is active," consistent with the existing architecture's treatment of role.
- **Case Selector:** The new UI control (app header, alongside the existing role switcher) allowing a user to list and switch the active case.

**Sub-features:**
- New `GET /api/cases` endpoint listing all cases available to the current user
- Case selector UI control in the app header, alongside the role switcher
- `GET /api/case` (singular, implicit `DEMO_CASE_NUMBER`) evolves into `GET /api/cases/:id` (explicit, parameterized)
- `getActiveCaseWithUsers()` (currently no-argument, implicit) becomes `getActiveCaseWithUsers(caseId)` (explicit parameter)
- Every existing query that today implicitly scopes to "the" case via `DEMO_CASE_NUMBER` is amended to scope explicitly to the client-selected `caseId`
- Seed data extended to include a second `Case` with its own exhibits, so multi-case switching is demonstrable, not just structurally possible

**Process:**
1. On initial app load, the client calls the new `GET /api/cases` endpoint, which lists every `Case` row (`{ id, caseNumber, title, court, createdAt }`) — no role restriction on this read (case existence is not sensitive; exhibit-level sealed/classification visibility, F16/`00-header.md` §Role-Based Visibility, remains the sensitive boundary and is unaffected).
2. If the client has no previously-selected `caseId` (first load, or a fresh session), it defaults to the first case in the list (by `createdAt` ascending, i.e., the original seeded demo case) — preserving the existing single-case demo script's zero-interaction behavior with no selector action required.
3. The user may open the Case Selector (header, alongside the role switcher) and choose a different case; this updates client-side state (a new `activeCaseStore`, modeled on the existing role-switcher's zustand store) and triggers every open screen (Command Center, Case Workspace, Exhibit Detail, Jury Package Workspace) and the assistant to refetch against the newly-selected `caseId` — the same refetch mechanism already used when the role switcher changes (`00-header.md`'s existing per-request role plumbing; `caseId` is now carried identically, alongside role, on every request).
4. `getActiveCaseWithUsers(caseId)` (amended from its current no-argument form) fetches the specified case plus its user roster — the bootstrap screen (`GET /api/cases/:id`, replacing `GET /api/case`) returns the identical shape as today's single-case bootstrap, just explicitly parameterized.
5. Every service function that currently queries "the" case implicitly via the `DEMO_CASE_NUMBER` constant (exhibit list, search, activity feed, discrepancies, jury package, assistant tool calls) is amended to accept and filter on the caller-supplied `caseId` — this is additive query-parameter plumbing on functions whose underlying tables already carry a `caseId` foreign key; no new join, no new index, no new table.
6. Role-based visibility (`00-header.md` §Role-Based Visibility) and every other existing per-request scoping rule continue to apply exactly as before, now additionally and simultaneously scoped by the selected `caseId` — a user's role visibility rules do not change per-case, but the exhibit set they're evaluated against is now explicitly the selected case's set, not an implicit single case's.
7. The assistant's tool wrappers (F7) receive `caseId` as part of the same per-turn context as `userId`/`role` (F07 §Inputs already lists `caseId` as a required input) — this feature changes only where that `caseId` value comes from (an explicit client selection, not an implicit constant), not the tool contract itself.
8. The seed loader (F0 §Process) is extended to create a second `Case` row with its own seeded exhibits and history, independent of the original demo case, so a reviewer can demonstrate switching between two populated cases without a redeploy or manual data entry.

**Inputs:**
- `GET /api/cases`: none (lists all cases unconditionally)
- `GET /api/cases/:id`: `id` (string/UUID, required, path parameter) — replaces the current no-argument `GET /api/case`
- Every amended existing endpoint (exhibits list/search, activity, discrepancies, jury package, assistant chat): `caseId` is now an explicit required parameter/path segment on each, carried from the client's Case Selector state — this is not a new conceptual input (every one of these endpoints already requires a case context today, just implicitly), only a change from implicit to explicit sourcing

**Outputs:**
- `GET /api/cases`: `Array<{ id, caseNumber, title, court, createdAt }>`
- `GET /api/cases/:id`: identical shape to today's `GET /api/case` response (case + user roster) — no shape change, only explicit parameterization

**Validation:**
- `GET /api/cases/:id` rejects a nonexistent `id` with the existing `CASE_NOT_FOUND` (404) — reused, not new
- Every amended endpoint's `caseId` must reference an existing `Case` — same `CASE_NOT_FOUND` reuse
- Switching the active case client-side must trigger a refetch on every open screen and the assistant's working context — no screen may silently continue displaying data scoped to a previously-selected case after a switch (stale single-case assumption is explicitly disallowed, per the PRD's F22 capability)
- Cross-case data leakage is explicitly disallowed: a query scoped to `caseId = A` must never return rows belonging to `caseId = B`, even transiently — since every relevant table already carries a `caseId` foreign key, this is enforced by adding an explicit `WHERE caseId = :selectedCaseId` clause (or equivalent Prisma filter) to every amended query, not by any new isolation mechanism

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| `GET /api/cases/:id` (or any amended endpoint) referencing a nonexistent case | 404 | CASE_NOT_FOUND | "No case found with the given ID" *(reused, unchanged)* |

**API Surface (this feature):** adds `GET /api/cases`; amends `GET /api/case` → `GET /api/cases/:id` (F0); amends every existing case-scoped endpoint (F4 search, F8 activity, F6 discrepancies, F5 jury package, F7 assistant chat) to take `caseId` explicitly rather than implicitly — see `Y1-api.md` §Cases (new section) and inline amendment notes on each affected existing section.

**Schema Surface (this feature):** **none.** `Case`, `User`, `Exhibit`, `JuryPackage`, and `AssistantConversation` already carry `caseId` foreign keys in the existing schema (`Y0-schema.md` §Core Entities, §Jury Package, §Assistant) — this feature adds no table, column, index, or constraint. Confirmed explicitly: this is a service/API/UI-only change.
## F23: Versioned Jury Packages with PDF Export

**Description:** Replaces the current `window.print()`-based export on the Jury Package Workspace (F11) with real, generated PDF export, and adds immutable version numbering so every finalization produces a permanent, independently-retrievable record of exactly what the jury received at that point in time. Finalizing a package creates an immutable numbered snapshot (version N); a new `DRAFT` package may then be started afterward for the same case, and each prior finalized version remains independently retrievable and exportable — multiple historical `FINALIZED` versions coexist per case, which is the natural reading of "a record of exactly what the jury received" together with the PRD's plural "versioned jury packages."

**Terminology:**
- **Version:** An integer, assigned to a `JuryPackage` only at the moment it is finalized (`null` while `DRAFT`), unique per case, monotonically increasing — `(caseId, version)` is unique. The first package ever finalized for a case is version `1`; the next is version `2`, regardless of how many `DRAFT` packages were created and abandoned in between (abandoned drafts never consume a version number, since they're never finalized).
- **Most-Recent Version:** The `FINALIZED` package for a case with the highest `version` value — computed at read time (`MAX(version) WHERE caseId = :id AND status = 'FINALIZED'`), not stored as an independent flag, consistent with the project's existing principle that derived facts are computed, not independently maintained state that could drift.

**Sub-features:**
- `JuryPackage.version` (nullable integer, set only at finalization) replaces the implicit "one package per case" assumption
- A new `DRAFT` package can be created after a prior version was finalized — F05's existing rule ("a new DRAFT package must be created for subsequent changes," F05 §Validation) already permits this; this feature adds the version number that makes each resulting `FINALIZED` package independently identifiable and retrievable
- Real PDF generation via `@react-pdf/renderer` (new dependency — see §PDF Generation Mechanism below), replacing the client-side `window.print()` CSS trick
- Full per-case version history retrieval: which exhibits were included, in what classification/status state, at each finalization timestamp
- Exported PDFs reflect the exact same discrepancy-gated (F6), classification-excluded (F13/F16) exhibit set the live workspace showed at finalization time — no divergence between what was displayed and what is exported

**PDF Generation Mechanism:** `@react-pdf/renderer` is selected as the new dependency. It generates PDFs from JSX/React-component definitions in pure JavaScript, with no headless-browser binary (unlike a Puppeteer/Playwright-based HTML-to-PDF approach) — this matters specifically because the system is hosted on Vercel serverless functions (`Y3-integrations.md` §Deployment/Runtime Dependencies), where bundling and cold-starting a full Chromium binary per invocation is both heavy and operationally fragile. `@react-pdf/renderer`'s component-based API (`<Document>`, `<Page>`, `<View>`, `<Text>`) also lets the PDF layout be authored in a style idiomatic to the rest of this React/Next.js codebase, rather than introducing an unrelated templating system. **This is a new runtime dependency, explicitly flagged as distinct from F16–F22, which introduce no new dependencies.**

**Process:**
1. Finalization (`POST /api/jury-package/:id/finalize`, F05 §Process steps 5–7) is amended: immediately before setting `status = 'FINALIZED'`, the service layer computes `version = (SELECT MAX(version) FROM JuryPackage WHERE caseId = :caseId AND status = 'FINALIZED') + 1` (or `1` if no prior finalized version exists for this case), and sets it atomically in the same transaction as the status/`finalizedAt`/`finalizedBy` write (F05 §Process step 7, unchanged otherwise).
2. Once `FINALIZED` with a `version` assigned, the package and its `JuryPackageExhibit` rows remain immutable exactly as F05 already specifies (F05 §Validation: "A `FINALIZED` package is immutable") — this feature adds no new mutability rule, it adds the version number to an already-immutable artifact.
3. A deputy/clerk/admin may subsequently create a new `DRAFT` `JuryPackage` for the same case (F05 §Process step 1, unchanged) — this new draft has `version = null` until it, too, is eventually finalized, at which point it receives the next sequential version number for that case.
4. `GET /api/cases/:id/jury-package/versions` (new endpoint) lists every `JuryPackage` for the case — every `FINALIZED` version plus the current `DRAFT`, if one exists — each annotated with `isMostRecent` (computed per §Terminology, `true` only for the highest-`version` `FINALIZED` row).
5. `GET /api/jury-package/:id/export` (new endpoint) accepts a specific `JuryPackage` id (which must be `FINALIZED`) and generates a PDF server-side via `@react-pdf/renderer`, rendering the package's immutable `INCLUDED` `JuryPackageExhibit` rows (F13's `EXCLUDED` rows are never rendered into the export, exactly as they're never rendered into the live `INCLUDED` list — F13 §Outputs) as a formatted document: case identification, finalization timestamp, finalizing user, and one entry per included exhibit (label, description, classification, status at finalization).
6. The generated PDF is streamed back as `application/pdf` — a real downloadable file, not a browser print dialog. The Jury Package Workspace (F11)'s existing export control is amended to call this endpoint and trigger a file download, in place of `window.print()`.
7. Because a `FINALIZED` package's `JuryPackageExhibit` rows are immutable (step 2), re-exporting the same version at a later date always produces an identical PDF (same exhibit set, same classification/status snapshot) — the export is deterministic per version, not re-computed against the exhibits' *current* live state.
8. The Jury Package Workspace (F11) is amended to show the most-recent version prominently (via `isMostRecent`) and to surface the full version history list (step 4's endpoint) as a secondary view, so a user can locate and export any prior finalized version, not only the latest.

**Inputs:**
- `GET /api/cases/:id/jury-package/versions`: `caseId` (string/UUID, required, path parameter)
- `GET /api/jury-package/:id/export`: `id` (string/UUID, required, path parameter) — the specific `JuryPackage` id to export; must currently be `FINALIZED`
- No new inputs to the existing finalize endpoint (`POST /api/jury-package/:id/finalize`, F05) — `version` is computed server-side, never client-supplied

**Outputs:**
- `GET /api/cases/:id/jury-package/versions`: `Array<{ id, version: number | null, status, finalizedAt?, finalizedBy?, exhibitCount, isMostRecent: boolean }>`
- `GET /api/jury-package/:id/export`: binary `application/pdf` stream (not JSON)
- `POST /api/jury-package/:id/finalize` (F05, amended): response now additionally includes `version` on the returned `JuryPackage`

**Validation:**
- `version` is assigned exactly once, at finalization, and is never reassigned or recomputed afterward — it is part of the immutable finalized snapshot, identical in spirit to `finalizedAt`/`finalizedBy`
- `(caseId, version)` must be unique — enforced at the database level; two packages for the same case can never share a version number
- Export is rejected for any package with `status = 'DRAFT'` (no version exists yet to export) — a draft must be finalized first
- A `DRAFT` package's export control (if ever exposed in a future UI iteration) must be hard-disabled, not merely hidden, consistent with F05's existing hard-gate pattern for finalization itself

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| Export attempted on a `DRAFT` (not yet finalized) package | 422 | JURY_PACKAGE_EXPORT_NOT_FINALIZED | "Only a finalized jury package version can be exported as a PDF" |
| `GET /api/jury-package/:id/export` or `/versions` referencing a nonexistent package/case | 404 | JURY_PACKAGE_VERSION_NOT_FOUND | "No jury package version found with the given ID" |
| PDF generation fails at render time (e.g., malformed exhibit data) | 500 | PDF_GENERATION_FAILED | "Unable to generate the jury package PDF — please retry" |

**API Surface (this feature):** adds `GET /api/cases/:id/jury-package/versions`, `GET /api/jury-package/:id/export`; amends `POST /api/jury-package/:id/finalize` (F05) response to include `version` — see `Y1-api.md` §Jury Package (amended) and §Jury Package Versions (new section).

**Schema Surface (this feature):** adds `version Int?` to `JuryPackage`, with `@@unique([caseId, version])` (partial/sparse uniqueness — only enforced where `version` is non-null); no new table — the existing `JuryPackageExhibit` rows, already immutable once their parent `JuryPackage` is `FINALIZED` (F05), serve directly as the versioned snapshot with no separate snapshot table required. See `Y0-schema.md` §Jury Package (amended). **New dependency:** `@react-pdf/renderer` (server-side PDF generation) — see `Y3-integrations.md` §Deployment/Runtime Dependencies (amended).
## F24: Write-Action UI Coverage — Record Ruling & Transfer Custody

**Description:** Surfaces two write actions that have existed as backend services since early phases — `recordRuling` (F02, `objections.ts`) and `recordCustodyTransfer` (F03/F19, `custody.ts`) — but have never had a UI entry point anywhere in this product. This feature gives both actions their first real, role-gated UI surface, reachable from the Trial Command Center's "Needs your attention" feed (F08) and the Exhibit Detail right rail (F10). It introduces **no new ruling or custody logic, no new endpoint, and no new schema** — every validation rule, state-machine check, and role gate already specified in F02, F03, F19, and F20 applies completely unchanged. F24's entire scope is the client-side form/modal, the wiring to the existing endpoints, and the inline-refresh behavior on success.

**Terminology:**
- **Inline Action:** A write action triggered directly from within a card or feed entry (Command Center attention feed, Exhibit Detail right-rail card) without navigating to a separate page — but never auto-submitting; an explicit confirm step is always required (see §Validation).
- **Originating Screen:** The screen/card the action was launched from (Command Center attention feed entry, or an Exhibit Detail right-rail card) — the screen whose data must refresh on success so the completed action is immediately visible without a manual reload.

**Sub-features:**
- "Record ruling" inline action: judge selects a disposition (SUSTAINED / OVERRULED / RESERVED) against one specific `UNRESOLVED` objection thread, available from an attention-feed entry (F08) or the Exhibit Detail Objection card (F10)
- "Transfer custody" / "Assign custodian" inline action: select a new custodian from the case's user roster, available from the Exhibit Detail header (F10) and, where applicable, a Command Center custody-by-custodian panel entry (F08) — handles both first-time assignment (no prior custodian) and a subsequent transfer (existing custodian) via the correct existing endpoint for each case
- A minimal "Confirm receipt" / "Cancel pending transfer" surface on Exhibit Detail, shown only when a pending transfer (F19) exists for that exhibit, since the propose endpoint this feature wires up is otherwise unusable without a way to resolve the pending state it creates
- Both actions are gated by the F20 permission matrix — a role without permission for an action does not see the control at all, not a disabled or silently-failing one
- Successful submission refreshes the originating screen through the existing live-sync polling mechanism (or an immediate scoped refetch of just the affected query) — no screen-local optimistic state that could diverge from the ledger
- Failed submission surfaces the specific rejection reason inline, matching the reject-with-reason pattern established by F12/F17/F18

**Process — Record Ruling:**
1. An authorized user opens "Record ruling" from an attention-feed entry (F08, tiers `HIGH`/`PENDING` — see F08 §Process) or from the Objection card on Exhibit Detail (F10). Both entry points pass the specific `objectionId` of one `UNRESOLVED` thread as context — never a bare `exhibitId` with ambiguous thread selection, since F02 permits N concurrent open threads per exhibit.
2. The UI renders the three-way disposition selector (`SUSTAINED` / `OVERRULED` / `RESERVED`) — identical to F02's existing enum; no new disposition value is introduced.
3. On explicit submit (see §Validation — no auto-submit), the client calls the existing `POST /api/objections/:id/ruling` endpoint (F02) unchanged: `{ disposition, actorUserId }`.
4. The service layer applies F02's existing validation (objection exists and is currently `UNRESOLVED`) and F20's existing judge-only role gate (§Permission Matrix row 5) exactly as already specified — F24 adds no new validation step; it is simply this endpoint's first caller.
5. On success, the Command Center attention-feed entry for that objection re-evaluates on the next poll tick: a `SUSTAINED`/`OVERRULED` disposition closes the thread and the entry disappears; a `RESERVED` disposition leaves the thread `UNRESOLVED` (F02 §Terminology) and the entry remains, re-ranked by its unchanged `raisedAt`. The Exhibit Detail Objection card (F10) reflects the updated `ObjectionCurrentState` on its next poll identically.
6. On failure (e.g., `403 ROLE_NOT_PERMITTED`, `409 OBJECTION_ALREADY_RESOLVED` from a stale UI state), the form surfaces the specific rejection reason inline and remains open for correction or cancellation — never a silent failure or a generic toast with no actionable detail.

**Process — Transfer / Assign Custody:**
1. An authorized user opens "Transfer custody" / "Assign custodian" from the Exhibit Detail header (F10) or, where applicable, an entry in the Command Center custody-by-custodian panel (F08).
2. The UI reads the exhibit's current custody state via the already-loaded `getCustodian(exhibitId)` result (F03, amended by F19) to determine: (a) whether a custodian of record currently exists at all, and (b) whether a transfer is already pending for this exhibit.
3. **No current custodian (first-time assignment):** if `CustodyCurrentState` has no row for this exhibit — a state possible for exhibits predating Phase 7.1's F18 intake gate — the UI calls the existing legacy endpoint `POST /api/exhibits/:id/events/custody` (F03/F19) with `fromCustodianUserId: null`. This assignment takes effect immediately; no propose/confirm step applies, identical to F19's documented intake-bootstrap exception (`F19-custody-handoff-confirmation.md` §Design Decisions).
4. **Existing custodian, no pending transfer:** the UI instead calls `POST /api/exhibits/:id/events/custody/propose` (F19), pre-filling `fromCustodianUserId` with the current custodian (read-only in the form — the UI never lets the user type a different "from" value) and presenting a custodian picker, populated from the case's active user roster (`GET /api/cases/:id`, F0/F22), for `toCustodianUserId`. The picker excludes the current custodian (since `fromCustodianUserId`/`toCustodianUserId` must differ — F03's existing `NO_OP_TRANSFER` rule, unchanged).
5. **Existing custodian, transfer already pending:** the UI does not offer a new proposal (F19 permits only one outstanding proposal per exhibit). Instead it renders the pending transfer's state — named receiver, proposed-at timestamp — with exactly two controls: "Cancel pending transfer" (`POST /api/exhibits/:id/events/custody/cancel`, F19), available to the original proposer or any F20-authorized propose role; and, visible **only** to the user who exactly matches `pendingTransferToUserId` (an identity match, not a role match — see F19 §Validation), "Confirm receipt" (`POST /api/exhibits/:id/events/custody/confirm`, F19).
6. On success of any of the three calls above, the Exhibit Detail custody display refreshes on the next poll tick to reflect the new state (assigned / proposed-pending / confirmed / cancelled), and a Command Center custody-by-custodian panel entry (F08) regroups the exhibit under its new or still-current custodian accordingly.
7. On failure (`403 ROLE_NOT_PERMITTED`, `409 CUSTODY_CHAIN_BROKEN`, `409 CUSTODY_TRANSFER_ALREADY_PENDING`, `403 CUSTODY_CONFIRM_WRONG_USER`, `422 INVALID_CUSTODIAN`/`NO_OP_TRANSFER`), the form surfaces the specific rejection reason inline, matching the reject-with-reason pattern.

**Inputs — Record Ruling:**
- `objectionId` (string/UUID, required): supplied by the originating card/feed entry, never user-typed
- `disposition` (enum: `SUSTAINED` | `OVERRULED` | `RESERVED`, required): user-selected
- `actorUserId` (string/UUID, required, from session): must resolve server-side to role `JUDGE` (F20 §Permission Matrix row 5)

**Inputs — Transfer / Assign Custody:**
- `exhibitId` (string/UUID, required): from the originating screen's context
- `toCustodianUserId` (string/UUID, required for assign/propose): user-selected from the case's active user roster, excluding the current custodian
- `fromCustodianUserId` (string/UUID, nullable): auto-populated from `getCustodian(exhibitId)`; `null` only for first-time assignment; read-only in the UI otherwise
- `reason` (string, optional, max 300 chars): free-text, user-entered
- `proposedEventId` (string/UUID, required for confirm/cancel): auto-populated from the exhibit's current `pendingTransferEventId`, never user-typed
- `actorUserId` (string/UUID, required, from session): must resolve server-side to an F20-authorized role (`DEPUTY`/`CLERK`/`ADMIN`) for assign/propose/cancel; for confirm, must exactly equal `pendingTransferToUserId` (identity match per F19, independent of and in addition to the F20 role gate)

**Outputs:**
- Record ruling: `{ event: ExhibitEvent, objectionState: ObjectionCurrentState }` — identical to F02's existing response shape; F24 adds no new field
- Assign / propose / confirm / cancel custody: `{ event: ExhibitEvent, custodyState: CustodyCurrentState }` — identical to F03/F19's existing response shapes
- Each action's success response triggers a scoped refetch of only the query feeding the originating card/feed/panel — never a full-page reload

**Validation:**
- F24 introduces no new field-level or state-machine validation of its own — every rule enforced on submission belongs to F02 (ruling), F03/F19 (custody), and F20 (role), completely unchanged. F24's own responsibility is limited to the two rules below.
- The UI must not render an action control for a role the F20 matrix does not permit for that action — e.g., an `ATTORNEY` viewing the Objection card sees the open objection but no "Record ruling" control; a `JUDGE` viewing Exhibit Detail sees the Chain of Custody card but no "Transfer custody" control. This mirrors F20 §Process step 6's UI-consistency recommendation, elevated here to a requirement since this feature is the primary UI surface for these two actions. The server-side gate remains authoritative regardless of what renders.
- Every inline action requires an explicit confirmation step (a confirmation dialog, or a distinct "Submit"/"Confirm" click separate from the control that opened the form) before the underlying write request is sent — no inline action may auto-submit on selection alone. This directly satisfies the PRD risk mitigation for inline actions on what was previously a strictly passive glance screen (Command Center, F08).

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| Non-judge attempts to record a ruling from this UI | 403 | ROLE_NOT_PERMITTED | "Only a judge may record a sustained or overruled ruling" *(F02/F20, unchanged)* |
| Ruling submitted against an already-resolved objection (stale UI state) | 409 | OBJECTION_ALREADY_RESOLVED | "This objection has already been ruled on" *(F02, unchanged)* |
| Non-authorized role attempts to assign/propose custody from this UI | 403 | ROLE_NOT_PERMITTED | "Only a courtroom deputy, clerk, or admin may propose a custody transfer" *(F19/F20, unchanged)* |
| Custody transfer attempted from the wrong current holder (stale UI state) | 409 | CUSTODY_CHAIN_BROKEN | "Recorded custodian does not match the exhibit's current custodian" *(F03, unchanged)* |
| Custody proposed while one is already pending (stale UI state) | 409 | CUSTODY_TRANSFER_ALREADY_PENDING | "A custody transfer is already pending for this exhibit" *(F19, unchanged)* |
| Confirm attempted by anyone other than the named receiver | 403 | CUSTODY_CONFIRM_WRONG_USER | "Only the named receiving custodian may confirm this transfer" *(F19, unchanged)* |
| Invalid/no-op custodian selection (stale UI state) | 422 | INVALID_CUSTODIAN / NO_OP_TRANSFER | *(F03, unchanged — see F03 §Error States)* |

**API Surface (this feature):** introduces **no new endpoints**. Invokes, unchanged: `POST /api/objections/:id/ruling` (F02); `POST /api/exhibits/:id/events/custody` (F03/F19, first-assignment path only); `POST /api/exhibits/:id/events/custody/propose`, `/confirm`, `/cancel` (F19). See `Y1-api.md` §Objections, §Custody.

**Schema Surface (this feature):** none. F24 writes only through the existing F02/F03/F19 service functions and their existing ledger event types — no new table, field, or enum value is introduced.
## Y0: Database Schema

Full Prisma DDL for JudicialSync, grounded in the research finding that status, objections/rulings, and custody must be modeled as an **append-only event ledger** with a **derived current-state projection** — never as mutable fields. Every table below is either (a) a ledger table (immutable, insert-only), (b) a current-state projection (derived, rebuildable by replaying the ledger), or (c) a supporting/identity entity.

### Core Entities

```prisma
model Case {
  id          String   @id @default(uuid())
  caseNumber  String   @unique
  title       String
  court       String
  createdAt   DateTime @default(now())

  users           User[]
  exhibits        Exhibit[]
  juryPackages    JuryPackage[]
  conversations   AssistantConversation[]
}

enum Role {
  JUDGE
  CHAMBERS_STAFF
  DEPUTY
  CLERK
  ATTORNEY
  ADMIN
}

model User {
  id        String   @id @default(uuid())
  caseId    String
  name      String
  role      Role
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())

  case Case @relation(fields: [caseId], references: [id])

  @@index([caseId, role])
}

enum OfferingParty {
  PLAINTIFF
  PROSECUTION
  DEFENSE
}

/// Added Phase 7.1 (F16). Required at intake, immutable thereafter — no
/// reclassification endpoint exists in this version. Supersedes `isSealed`
/// as the authoritative sensitivity input to jury-package exclusion (F13)
/// and role-based visibility; `isSealed` is retained as a write-once mirror
/// (see note on `Exhibit.isSealed` below) rather than removed, so every
/// existing read path (`visibility.ts`) requires no change.
enum ExhibitClassification {
  TRIAL
  CHAMBERS_EX_PARTE
  SEALED
}

model Exhibit {
  id                 String        @id @default(uuid())
  caseId             String
  exhibitLabel       String
  description        String
  source             String?
  offeringParty      OfferingParty
  associatedWitness  String?
  classification     ExhibitClassification               // added Phase 7.1 (F16): required at creation, immutable
  isSealed           Boolean       @default(false)        // Phase 7.1 (F16): now write-once, derived at creation as `classification !== 'TRIAL'` — never independently set thereafter
  createdAt          DateTime      @default(now())

  case              Case                @relation(fields: [caseId], references: [id])
  events            ExhibitEvent[]
  currentState      ExhibitCurrentState?
  custodyState      CustodyCurrentState?
  objections        ObjectionCurrentState[]
  discrepancyFlags  DiscrepancyFlag[]
  juryPackageRows   JuryPackageExhibit[]

  @@unique([caseId, exhibitLabel])
  @@index([caseId])
}
```

### Event Ledger (Ground Truth — Append-Only, Immutable)

```prisma
enum EventType {
  STATUS_CHANGE
  OBJECTION_RAISED
  RULING_RECORDED
  CUSTODY_TRANSFER                 // legacy unilateral transfer — retained only for the F18 intake-bootstrap path; rejected for any non-first transfer as of Phase 7.1 (F19)
  DISCREPANCY_ACKNOWLEDGED
  JURY_PACKAGE_EXHIBIT_EXCLUDED     // added Phase 7 (F13) — see §Jury Package
  CUSTODY_TRANSFER_PROPOSED        // added Phase 7.1 (F19) — two-phase custody handoff, phase 1
  CUSTODY_TRANSFER_CONFIRMED       // added Phase 7.1 (F19) — two-phase custody handoff, phase 2 (also used directly, with no preceding PROPOSED, for F18's intake-bootstrap link)
  CUSTODY_TRANSFER_CANCELLED       // added Phase 7.1 (F19) — reverts a pending proposal; currentCustodianUserId unaffected
}

/// The single append-only ledger table. Rows are NEVER updated or deleted
/// after creation. `payload` is a discriminated-union JSON shape validated
/// by a zod schema keyed on `eventType` before insert (see service layer).
/// `sequenceNo` guarantees deterministic per-exhibit replay order.
model ExhibitEvent {
  id           String    @id @default(uuid())
  exhibitId    String
  caseId       String
  eventType    EventType
  payload      Json
  actorUserId  String
  sequenceNo   Int
  recordedAt   DateTime  @default(now())

  exhibit Exhibit @relation(fields: [exhibitId], references: [id])

  @@unique([exhibitId, sequenceNo])
  @@index([exhibitId, recordedAt])
  @@index([caseId, eventType, recordedAt])
}
```

**Payload shapes by `eventType` (zod-validated, not enforced at the DB level):**
- `STATUS_CHANGE`: `{ fromStatus: ExhibitStatus | null, toStatus: ExhibitStatus, notes?: string }`
- `OBJECTION_RAISED`: `{ objectionId: string (uuid), objectingParty: OfferingParty, grounds: string }`
- `RULING_RECORDED`: `{ objectionId: string (uuid), disposition: 'SUSTAINED' | 'OVERRULED' | 'RESERVED' }`
- `CUSTODY_TRANSFER`: `{ fromCustodianUserId: string | null, toCustodianUserId: string, reason?: string }` — legacy unilateral shape, retained only for F18's intake-bootstrap link in historical/prior-version data
- `DISCREPANCY_ACKNOWLEDGED`: `{ discrepancyFlagId: string (uuid), ruleCode: string, justification: string }`
- `JURY_PACKAGE_EXHIBIT_EXCLUDED` *(added Phase 7, F13)*: `{ juryPackageId: string (uuid), exhibitId: string (uuid), reason: 'SEALED_EXPARTE' | 'MANUAL_REMOVAL', note?: string }`
- `CUSTODY_TRANSFER_PROPOSED` *(added Phase 7.1, F19)*: `{ fromCustodianUserId: string, toCustodianUserId: string, reason?: string }` — `fromCustodianUserId` must match the exhibit's current custodian; does not change `CustodyCurrentState.currentCustodianUserId`
- `CUSTODY_TRANSFER_CONFIRMED` *(added Phase 7.1, F19)*: `{ proposedEventId: string (uuid) | null, fromCustodianUserId: string | null, toCustodianUserId: string }` — `proposedEventId` references the resolved `CUSTODY_TRANSFER_PROPOSED` event, or is `null` for F18's intake-bootstrap case (where `fromCustodianUserId` is also `null`)
- `CUSTODY_TRANSFER_CANCELLED` *(added Phase 7.1, F19)*: `{ proposedEventId: string (uuid), reason?: string }` — references the pending proposal being cancelled

### Current-State Projections (Derived — Rebuildable, Never Independently Edited)

```prisma
enum ExhibitStatus {
  MARKED
  OFFERED
  OBJECTED
  ADMITTED
  EXCLUDED
  WITHDRAWN
}

/// One row per exhibit once it has at least one STATUS_CHANGE event.
/// Fully rebuildable by replaying ExhibitEvent WHERE eventType = STATUS_CHANGE
/// in sequenceNo order.
model ExhibitCurrentState {
  exhibitId        String        @id
  currentStatus    ExhibitStatus
  lastStatusEventId String
  lastStatusAt     DateTime

  exhibit Exhibit @relation(fields: [exhibitId], references: [id])
}

enum ObjectionStatus {
  UNRESOLVED
  SUSTAINED
  OVERRULED
}

/// One row per objection THREAD (not per exhibit — an exhibit may have many).
/// Rebuildable by replaying OBJECTION_RAISED / RULING_RECORDED events grouped
/// by payload.objectionId.
model ObjectionCurrentState {
  objectionId      String          @id
  exhibitId        String
  status           ObjectionStatus
  objectingParty   OfferingParty
  grounds          String
  raisedEventId    String
  raisedAt         DateTime
  rulingEventId    String?
  ruledAt          DateTime?

  exhibit Exhibit @relation(fields: [exhibitId], references: [id])

  @@index([exhibitId, status])
}

/// One row per exhibit once it has at least one CUSTODY_TRANSFER event.
/// An exhibit with NO row here (despite being ADMITTED) is exactly the
/// ADMITTED_NO_CUSTODIAN discrepancy condition (F6) — absence is meaningful.
model CustodyCurrentState {
  exhibitId              String   @id
  currentCustodianUserId String
  since                  DateTime
  lastEventId            String
  // --- added Phase 7.1 (F19): two-phase custody handoff pending state ---
  // Populated by a CUSTODY_TRANSFER_PROPOSED event; cleared by the resolving
  // CUSTODY_TRANSFER_CONFIRMED or CUSTODY_TRANSFER_CANCELLED event.
  // currentCustodianUserId is NEVER modified while these are non-null —
  // "who currently has it" always reflects the last CONFIRMED transfer.
  pendingTransferToUserId    String?
  pendingTransferEventId     String?
  pendingTransferProposedAt  DateTime?

  exhibit    Exhibit @relation(fields: [exhibitId], references: [id])
  custodian  User    @relation(fields: [currentCustodianUserId], references: [id])
}
```

### Discrepancy Detection

```prisma
enum DiscrepancyStatus {
  OPEN
  ACKNOWLEDGED
  RESOLVED
}

/// Derived/materialized by the rule engine (F6), recomputed on every
/// relevant ledger write — not user-created. Acknowledgment is recorded
/// BOTH here (fast-read status) and as a DISCREPANCY_ACKNOWLEDGED ledger
/// event (audit ground truth).
model DiscrepancyFlag {
  id                String            @id @default(uuid())
  caseId            String
  exhibitId         String
  ruleCode          String            // e.g. "ADMITTED_NO_CUSTODIAN"
  status            DiscrepancyStatus @default(OPEN)
  detectedAt        DateTime          @default(now())
  details           Json
  acknowledgedAt    DateTime?
  acknowledgedBy    String?
  acknowledgedEventId String?
  resolvedAt        DateTime?
  resolvedByEventId String?

  exhibit Exhibit @relation(fields: [exhibitId], references: [id])

  @@index([caseId, status])
  @@index([exhibitId, ruleCode])
}
```

### Jury Package

```prisma
enum JuryPackageStatus {
  DRAFT
  FINALIZED
}

model JuryPackage {
  id           String            @id @default(uuid())
  caseId       String
  status       JuryPackageStatus @default(DRAFT)
  createdAt    DateTime          @default(now())
  finalizedAt  DateTime?
  finalizedBy  String?
  version      Int?                                // added Phase 7.1 (F23): assigned ONLY at finalization, never reassigned; null while DRAFT
  // --- added Phase 8 (F11): lightweight finalization-request notification ---
  // Set by POST /api/jury-package/:id/request-finalization (a role outside
  // F20's finalize-authorized set asking one that is to finalize). Purely
  // additive metadata — confers no authority, bypasses no gate. At most one
  // outstanding request is tracked per package; a new request overwrites the
  // prior one. Cleared automatically when the package is finalized.
  finalizationRequestedAt  DateTime?
  finalizationRequestedBy  String?

  case Case @relation(fields: [caseId], references: [id])
  exhibitRows JuryPackageExhibit[]

  @@index([caseId, status])
  @@unique([caseId, version])                        // added Phase 7.1 (F23): sparse/partial uniqueness — only enforced where version is non-null
}

enum JuryExhibitDiscrepancyStatus {
  CLEAN
  FLAGGED
}

/// Added Phase 7 (F13): tracks whether an exhibit row is currently part of
/// the active/included package set, or has been excluded (automatically, via
/// the isSealed candidate-query filter — see §Jury Package Exclusion note
/// below — or manually, via the remediation action). EXCLUDED rows are
/// retained, never deleted, as an audit record; they are never rendered as
/// part of the included list and never participate in finalization.
enum JuryPackageExhibitStatus {
  INCLUDED
  EXCLUDED
}

model JuryPackageExhibit {
  id                String                       @id @default(uuid())
  juryPackageId     String
  exhibitId         String
  discrepancyStatus JuryExhibitDiscrepancyStatus
  addedAt           DateTime                     @default(now())
  status            JuryPackageExhibitStatus     @default(INCLUDED) // added Phase 7 (F13)
  excludedAt        DateTime?                                       // added Phase 7 (F13)
  excludedBy        String?                                         // added Phase 7 (F13)
  exclusionReason   String?                                         // added Phase 7 (F13): 'SEALED_EXPARTE' | 'MANUAL_REMOVAL'

  juryPackage JuryPackage @relation(fields: [juryPackageId], references: [id])
  exhibit     Exhibit     @relation(fields: [exhibitId], references: [id])

  @@unique([juryPackageId, exhibitId])
}
```

**Jury Package Exclusion note (Phase 7, F13; amended Phase 7.1, F16):** `computeJuryCandidates` (F5) originally filtered `exhibit.isSealed = false` in the same query as the `ADMITTED`-status filter (F13 §Process step 1). As of Phase 7.1, this filter reads `exhibit.classification = 'TRIAL'` instead — both `CHAMBERS_EX_PARTE` and `SEALED` are hard-excluded identically — so a chambers-ex-parte or sealed exhibit never acquires an `INCLUDED` row here in the first place. See `F16-exhibit-classification-taxonomy.md` §Process step 4. The `EXCLUDED` status and its three accompanying fields exist solely for the remediation/audit path (legacy rows, or any future manual removal), not as the primary exclusion mechanism.

**Jury Package Versioning note (Phase 7.1, F23):** `JuryPackage.version` is assigned only at finalization, computed as `(MAX(version) WHERE caseId = :id AND status = 'FINALIZED') + 1` (or `1` if none exists), and never reassigned afterward. No separate snapshot table is introduced — the existing `JuryPackageExhibit` rows, already immutable once their parent package is `FINALIZED` (F05 §Validation), serve directly as each version's permanent record. "Most-recent version" is computed at read time (`MAX(version)` per case), never stored. See `F23-versioned-jury-packages-pdf-export.md` §Process.

**Finalization Request note (Phase 8, F11):** `finalizationRequestedAt`/`finalizationRequestedBy` model a single outstanding "please finalize this" notification per package — not a queue, not a ledger event type, and not a new table. This is a deliberate scope choice: the request carries no authority of its own (F5's discrepancy gate and F20's role matrix are completely unaffected by its presence), so it does not need append-only/immutable treatment the way status/objection/custody domains do. A new request simply overwrites the previous one; a successful finalize clears both fields. See `F11-jury-package-workspace-screen.md` §Process steps 7–8.

### Assistant

```prisma
model AssistantConversation {
  id        String   @id @default(uuid())
  caseId    String
  userId    String
  startedAt DateTime @default(now())

  case     Case              @relation(fields: [caseId], references: [id])
  messages AssistantMessage[]
}

enum MessageRole {
  USER
  ASSISTANT
}

model AssistantMessage {
  id             String      @id @default(uuid())
  conversationId String
  role           MessageRole
  content        String
  createdAt      DateTime    @default(now())

  conversation AssistantConversation @relation(fields: [conversationId], references: [id])
  citations    AssistantCitation[]
}

/// Every factual claim in an ASSISTANT message must have at least one row
/// here pointing to the ledger/projection record that backs it. A message
/// with zero citations is only valid if its content is a Decline Response.
model AssistantCitation {
  id         String   @id @default(uuid())
  messageId  String
  recordType String   // e.g. "ExhibitEvent", "DiscrepancyFlag", "JuryPackageExhibit"
  recordId   String
  timestamp  DateTime
  label      String   // human-readable citation label shown in the UI

  message AssistantMessage @relation(fields: [messageId], references: [id])

  @@index([messageId])
}
```

### Performance Notes

- Discrepancy rules (F6) are evaluated against current-state projections (`ExhibitCurrentState`, `ObjectionCurrentState`, `CustodyCurrentState`), never by scanning the full `ExhibitEvent` ledger on every check — the ledger is read in full only for history views (F10) and assistant `getExhibitHistory` calls.
- `ExhibitEvent` is indexed on `(exhibitId, recordedAt)` for timeline reads and `(caseId, eventType, recordedAt)` for Command Center's recent-activity query.
- At demo scale (dozens–hundreds of exhibits, single case), no further indexing or caching is required — see `ARCHITECTURE.md` §Scaling Considerations.
- **Added Phase 8 (F08):** `getCustodyByCustodian(caseId)` and `getAttentionFeed(caseId)` are new read-only aggregation functions, not new tables. Both group/filter existing projection rows (`CustodyCurrentState`, `DiscrepancyFlag`, `ObjectionCurrentState`, `JuryPackageExhibit`) already indexed above — no new index is required at demo scale. Neither function writes anything; both are fully rebuildable from current projections at any time, consistent with the projection-integrity guarantee below.

### Projection Integrity

All current-state projection tables must be exactly reproducible by replaying `ExhibitEvent` rows per exhibit in `sequenceNo` order. This replay capability is the mechanism for auditing projection/ledger consistency (PRD §Non-Functional Requirements, Auditability) and should be exposed as an admin/dev utility (`rebuildProjections(caseId)`), not relied upon as the live write path.
## Y1: API Endpoints

Consolidated REST API surface for JudicialSync. Every route handler is a thin wrapper around the service layer (`00-header.md` §Service Layer) — no route contains business logic beyond request parsing, auth/role extraction, and response shaping. The Pivota Assistant's tools (F7) call the identical underlying service functions, not these HTTP routes directly (in-process function calls, not HTTP round-trips, for the assistant path) — but the request/response shapes below describe the same contract both consumers rely on.

All endpoints require a `requestingUserRole` derived from the session/role-switcher (PROJECT.md scope: no production auth) and apply role-based visibility per `00-header.md` §Role-Based Visibility uniformly. As of Phase 7.1 (F22), every case-scoped endpoint also requires an explicit `caseId` (carried from the client's Case Selector state, per-request, exactly as `requestingUserRole` already is) rather than an implicit single-case assumption. As of Phase 7.1 (F20), every write endpoint additionally resolves and enforces `actorUserId`'s server-side role against the permission matrix in `F20-server-side-role-enforcement-matrix.md` before any other processing.

---

### §Cases (F0, F22)

**`GET /api/cases`** *(added Phase 7.1, F22)*
Lists every case available to the current user — no role restriction (case existence is not sensitive; exhibit-level visibility remains the sensitive boundary, unaffected).
- 200: `Array<{ id, caseNumber, title, court, createdAt }>`

**`GET /api/cases/:id`** *(amended Phase 7.1, F22: replaces the prior no-argument `GET /api/case`)*
Fetches a specific case plus its user roster (app bootstrap).
- 200: identical shape to the prior `GET /api/case` response
- Errors: `CASE_NOT_FOUND` (404)

---

### §Exhibits (F0, F9, F10)

**`POST /api/exhibits`**
Creates a new exhibit identity record (F0).
- Body: `{ caseId, exhibitLabel, description, source?, offeringParty, associatedWitness?, classification }` *(amended Phase 7.1, F16: `classification` is now required — `TRIAL` | `CHAMBERS_EX_PARTE` | `SEALED`; a client-supplied `isSealed` value, if present, is ignored — the server always derives it from `classification`)*
- 201: `Exhibit` *(now includes `classification` and a classification-derived `isSealed`)*
- Errors: `EXHIBIT_LABEL_CONFLICT` (409), `VALIDATION_ERROR` (422), `CLASSIFICATION_REQUIRED` (422 — added Phase 7.1, F16), `INVALID_CLASSIFICATION` (422 — added Phase 7.1, F16), `ROLE_NOT_PERMITTED` (403 — added Phase 7.1, F20: only `DEPUTY`, `CLERK`, `ADMIN`)

**`GET /api/exhibits/:id`**
Fetches a single exhibit's identity fields (F0).
- 200: `Exhibit`
- Errors: `EXHIBIT_NOT_FOUND` (404)

**`GET /api/cases/:id/exhibits`**
Lists all visible exhibits for a case with current-state summary (F9).
- Query: none (full list; use §Search for filtered)
- 200: `Array<{ exhibitId, exhibitLabel, description, offeringParty, associatedWitness, currentStatus, currentCustodianName, discrepancyFlags[], juryPackageEligibility }>` *(amended Phase 8, F9: `juryPackageEligibility: 'INCLUDED' | 'NOT_ELIGIBLE' | 'BLOCKED'` added — derived from the case's most-recently-computed `JuryPackage`'s `JuryPackageExhibit` rows, see F09 §Process step 3)*
- Errors: `CASE_NOT_FOUND` (404)

**`GET /api/exhibits/:id/history`**
Full chronological event timeline for one exhibit (F10).
- 200: `{ exhibit: {...}, currentStatus, currentCustodianName, discrepancyFlags[], timeline: Array<{ eventId, eventType, summary, actorName, recordedAt }>, objections[], custodyCard, juryPackageChecklist }` *(amended Phase 8, F10: `objections[]` — `UNRESOLVED` `ObjectionCurrentState` rows for the right-rail Objection card; `custodyCard` — `{ current, pendingTransfer, history[] }` for the Chain of Custody card; `juryPackageChecklist` — `{ admitted, objectionsResolved, custodianOnRecord, classificationTrial, eligibility }` for the Jury Package checklist card. All three are read-time projections of data already returned elsewhere in this response — no new query.)*
- Errors: `EXHIBIT_NOT_FOUND` (404 — also returned for sealed/unauthorized, per F10 §Validation)

---

### §Status (F1)

**`POST /api/exhibits/:id/events/status`**
Records a status transition.
- Body: `{ toStatus, actorUserId, notes?, custodianUserId? }` *(amended Phase 7.1, F18: `custodianUserId` is required when, and only when, this is the exhibit's first-ever `STATUS_CHANGE` event, i.e. `toStatus = MARKED` with zero prior events — the status write and the resulting intake custody write are atomic, see F18 §Process)*
- 201: `{ event: ExhibitEvent, currentState: ExhibitCurrentState, custodyState?: CustodyCurrentState }` *(amended Phase 7.1, F18: `custodyState` is additionally returned when this call was the exhibit's first-ever transition)*
- Errors: `INVALID_STATUS_TRANSITION` (422), `STATUS_FINALIZED` (409), `STATUS_CONFLICT` (409), `EXHIBIT_NOT_FOUND` (404), `ADMISSION_BLOCKED` (422 — added Phase 7, F12: only evaluated when `toStatus = ADMITTED`; see F12 §Process; hardened without new mechanism by Phase 7.1's F17 — see `F17-objection-admission-state-machine-hardening.md`), `CUSTODIAN_REQUIRED_AT_INTAKE` (422 — added Phase 7.1, F18), `ROLE_NOT_PERMITTED` (403 — added Phase 7.1, F20: `DEPUTY`, `CLERK`, `ADMIN` for all transitions)

**`GET /api/exhibits/:id/status`**
Current derived status.
- 200: `ExhibitCurrentState`
- Errors: `EXHIBIT_NOT_FOUND` (404)

---

### §Objections (F2)

**`POST /api/exhibits/:id/events/objection`**
Raises an objection against an exhibit.
- Body: `{ objectingParty, grounds, actorUserId }`
- 201: `{ event: ExhibitEvent, objectionState: ObjectionCurrentState }`
- Errors: `INVALID_OBJECTION_TARGET` (422), `EXHIBIT_NOT_FOUND` (404), `ROLE_NOT_PERMITTED` (403 — added Phase 7.1, F20: `ATTORNEY`, `DEPUTY`, `CLERK`, `ADMIN`)

**`POST /api/objections/:id/ruling`**
Records a ruling against an objection thread.
- Body: `{ disposition, actorUserId }`
- 201: `{ event: ExhibitEvent, objectionState: ObjectionCurrentState }`
- Errors: `OBJECTION_NOT_FOUND` (404), `OBJECTION_ALREADY_RESOLVED` (409), `ROLE_NOT_PERMITTED` (403)

**`GET /api/cases/:id/objections?status=unresolved`**
Lists objection threads case-wide, filterable by status.
- 200: `Array<ObjectionCurrentState & { exhibitLabel: string }>` *(amended Phase 7.1, F21: additive read-time join of `exhibitLabel` — no schema change; powers the new Pending-Ruling Queue screen's client-side sort by elapsed `raisedAt`, no new endpoint)*
- Errors: `CASE_NOT_FOUND` (404)

---

### §Custody (F3; amended Phase 7.1, F19)

**`POST /api/exhibits/:id/events/custody`**
Records a custody transfer. *(Amended Phase 7.1, F19: as of this phase, this endpoint is retained ONLY for the F18 intake-bootstrap case — `fromCustodianUserId: null`. Any call with a non-null `fromCustodianUserId` is rejected; use the propose/confirm endpoints below for every transfer after the first.)*
- Body: `{ fromCustodianUserId?, toCustodianUserId, reason?, actorUserId }`
- 201: `{ event: ExhibitEvent, custodyState: CustodyCurrentState }`
- Errors: `CUSTODY_CHAIN_BROKEN` (409), `INVALID_CUSTODIAN` (422), `NO_OP_TRANSFER` (422), `EXHIBIT_NOT_FOUND` (404), `CUSTODY_TRANSFER_REQUIRES_CONFIRMATION` (409 — added Phase 7.1, F19: non-first transfer attempted via this unilateral path)

**`POST /api/exhibits/:id/events/custody/propose`** *(added Phase 7.1, F19)*
Initiates a two-phase custody transfer — does not change current custody.
- Body: `{ fromCustodianUserId, toCustodianUserId, reason?, actorUserId }`
- 201: `{ event: ExhibitEvent, custodyState: CustodyCurrentState }` (`custodyState.pendingTransferToUserId` now set; `currentCustodianUserId` unchanged)
- Errors: `CUSTODY_CHAIN_BROKEN` (409), `INVALID_CUSTODIAN` (422), `NO_OP_TRANSFER` (422), `CUSTODY_TRANSFER_ALREADY_PENDING` (409), `ROLE_NOT_PERMITTED` (403: `DEPUTY`, `CLERK`, `ADMIN`), `EXHIBIT_NOT_FOUND` (404)

**`POST /api/exhibits/:id/events/custody/confirm`** *(added Phase 7.1, F19)*
Completes a pending custody transfer — callable only by the named receiving custodian.
- Body: `{ proposedEventId, actorUserId }`
- 200: `{ event: ExhibitEvent, custodyState: CustodyCurrentState }` (`currentCustodianUserId` updated; pending fields cleared)
- Errors: `CUSTODY_CONFIRMATION_NOT_PENDING` (404), `CUSTODY_CONFIRM_WRONG_USER` (403), `ROLE_NOT_PERMITTED` (403: `DEPUTY`, `CLERK`, `ADMIN`), `EXHIBIT_NOT_FOUND` (404)

**`POST /api/exhibits/:id/events/custody/cancel`** *(added Phase 7.1, F19)*
Cancels a pending custody transfer — current custody is unaffected (it never changed).
- Body: `{ proposedEventId, reason?, actorUserId }`
- 200: `{ event: ExhibitEvent, custodyState: CustodyCurrentState }` (pending fields cleared)
- Errors: `CUSTODY_CONFIRMATION_NOT_PENDING` (404), `ROLE_NOT_PERMITTED` (403: original proposer, or `DEPUTY`/`CLERK`/`ADMIN`), `EXHIBIT_NOT_FOUND` (404)

**`GET /api/exhibits/:id/custodian`**
Current custodian only.
- 200: `CustodyCurrentState` *(amended Phase 7.1, F19: now additionally includes `pendingTransfer: { toUserId, proposedAt, eventId } | null`)*
- Errors: `EXHIBIT_NOT_FOUND` (404)

**`GET /api/exhibits/:id/custody-history`**
Full ordered chain-of-custody.
- 200: `Array<{ fromCustodian, toCustodian, timestamp, reason, eventId, eventType }>` *(amended Phase 7.1, F19: now includes `CUSTODY_TRANSFER_PROPOSED`/`CONFIRMED`/`CANCELLED` events, distinguished by `eventType`, so a cancelled/superseded proposal remains visible in history)*
- Errors: `EXHIBIT_NOT_FOUND` (404)

---

### §Search (F4)

**`GET /api/cases/:id/exhibits/search`**
Multi-criteria combinable exhibit search.
- Query: `keyword?, status?, witness?, dateFrom?, dateTo?`
- 200: same shape as `GET /api/cases/:id/exhibits` *(amended Phase 8, F9: includes `juryPackageEligibility`, same as the unfiltered list)*
- Errors: `EMPTY_SEARCH_CRITERIA` (422), `INVALID_DATE_RANGE` (422), `VALIDATION_ERROR` (422)

---

### §Jury Package (F5)

**`POST /api/cases/:id/jury-package`**
Computes/refreshes the draft jury-eligible exhibit set.
- Body: `{ actorUserId }`
- 201: `{ juryPackage: JuryPackage, exhibits: JuryPackageExhibit[] }`
- Errors: `NO_ELIGIBLE_EXHIBITS` (422), `ROLE_NOT_PERMITTED` (403: `DEPUTY`, `CLERK`, `ADMIN` — unchanged, now enforced via F20's shared `assertRole` helper)

**`GET /api/cases/:id/jury-package`**
Fetches the current (draft or finalized) jury package with live discrepancy status per exhibit.
- 200: `{ juryPackage: JuryPackage, exhibits: JuryPackageExhibit[] }` — `exhibits[]` includes only `status: INCLUDED` rows by default *(added Phase 7, F13: `EXCLUDED` rows are retained for audit but omitted from this default read)*. `juryPackage.version` is `null` while `DRAFT` *(added Phase 7.1, F23)*. `juryPackage` additionally includes `finalizationRequestedAt`/`finalizationRequestedBy` *(added Phase 8, F11)*, both `null` if no request is currently outstanding.
- Errors: `CASE_NOT_FOUND` (404)

**`POST /api/jury-package/:id/finalize`**
Attempts finalization — hard-gated by discrepancy re-check.
- Body: `{ actorUserId, acknowledgedDiscrepancyIds? }`
- 200: `{ juryPackage: JuryPackage (status: FINALIZED, version: number) }` *(amended Phase 7.1, F23: `version` is now assigned atomically at finalization — see F23 §Process step 1)*. `finalizationRequestedAt`/`finalizationRequestedBy`, if previously set, are cleared as part of this same write *(added Phase 8, F11)*.
- Errors: `JURY_PACKAGE_DISCREPANCIES_OPEN` (409, includes blocking list), `JURY_PACKAGE_ALREADY_FINALIZED` (409), `ROLE_NOT_PERMITTED` (403)

**`POST /api/jury-package/:id/request-finalization`** *(added Phase 8, F11)*
Records a lightweight notification asking a finalize-authorized role to finalize the current draft — confers no authority and bypasses no gate.
- Body: `{ actorUserId }`
- 200: `{ juryPackage: JuryPackage (finalizationRequestedAt, finalizationRequestedBy) }`
- Errors: `JURY_PACKAGE_ALREADY_FINALIZED` (409), `ROLE_NOT_PERMITTED` (403 — rejects a finalize-authorized role, i.e. `DEPUTY`/`CLERK`/`ADMIN`, attempting to request rather than finalize directly)

*(Added Phase 7, F13: the candidate computation behind `POST /api/cases/:id/jury-package` filtered `exhibit.isSealed = false` at the query level, in addition to the `currentStatus = ADMITTED` filter. As of Phase 7.1, F16, this filter reads `exhibit.classification = 'TRIAL'` instead — see F16 §Process step 4. This remains a behavior amendment to the existing endpoint, not a new route.)*

---

### §Jury Package Versions & Export (F23)

**`GET /api/cases/:id/jury-package/versions`** *(added Phase 7.1, F23)*
Lists every `JuryPackage` for the case — every `FINALIZED` version plus the current `DRAFT`, if one exists.
- 200: `Array<{ id, version: number | null, status, finalizedAt?, finalizedBy?, exhibitCount, isMostRecent: boolean }>`
- Errors: `CASE_NOT_FOUND` (404)

**`GET /api/jury-package/:id/export`** *(added Phase 7.1, F23)*
Generates and streams a PDF (via `@react-pdf/renderer`) of a specific `FINALIZED` package version's included exhibit set.
- Response: binary `application/pdf` stream
- Errors: `JURY_PACKAGE_EXPORT_NOT_FINALIZED` (422), `JURY_PACKAGE_VERSION_NOT_FOUND` (404), `PDF_GENERATION_FAILED` (500)

---

### §Jury Package Exclusion (F13)

**`POST /api/jury-package/:id/exhibits/:exhibitId/exclude`**
Explicitly excludes an `INCLUDED` exhibit row from a `DRAFT` jury package (remediation action for sealed/ex-parte material, or any other manual removal need), recorded as an auditable ledger event.
- Body: `{ actorUserId, reason: 'SEALED_EXPARTE' | 'MANUAL_REMOVAL', note? }`
- 200: `{ event: ExhibitEvent, juryPackageExhibit: JuryPackageExhibit (status: EXCLUDED) }`
- Errors: `JURY_PACKAGE_EXHIBIT_NOT_FOUND` (404), `JURY_PACKAGE_ALREADY_FINALIZED` (409), `ROLE_NOT_PERMITTED` (403)

---

### §Write-Action UI Coverage (F24)

**No new endpoints.** F24 (Record Ruling UI, Transfer/Assign Custody UI) is purely a client-side first UI surface over endpoints already defined above: `POST /api/objections/:id/ruling` (§Objections, F2), `POST /api/exhibits/:id/events/custody` and `/propose`, `/confirm`, `/cancel` (§Custody, F3/F19). See `F24-write-action-ui-coverage.md` for the UI-side process and the originating-screen entry points (Command Center attention feed, Exhibit Detail right rail).

---

### §Discrepancies (F6)

**`GET /api/cases/:id/discrepancies`**
All open/acknowledged discrepancy flags case-wide.
- 200: `Array<DiscrepancyFlag>` — for any flag with `status: ACKNOWLEDGED`, the response additionally includes `justification` (string, added Phase 7, F14: read-time join from `acknowledgedEventId` to the backing `DISCREPANCY_ACKNOWLEDGED` event's payload — no schema change, see F14 §Outputs)
- Errors: `CASE_NOT_FOUND` (404)

**`GET /api/exhibits/:id/discrepancies`**
Discrepancy flags for a single exhibit.
- 200: `Array<DiscrepancyFlag>` — same `justification` addition as above for `ACKNOWLEDGED` flags (F14)
- Errors: `EXHIBIT_NOT_FOUND` (404)

**`POST /api/discrepancies/:id/acknowledge`**
Explicitly acknowledges an open discrepancy.
- Body: `{ actorUserId, justification }`
- 200: `{ event: ExhibitEvent, discrepancyFlag: DiscrepancyFlag }` (idempotent if already acknowledged/resolved)
- Errors: `JUSTIFICATION_REQUIRED` (422), `DISCREPANCY_NOT_FOUND` (404), `ROLE_NOT_PERMITTED` (403)

---

### §Command Center (F8)

**`GET /api/cases/:id/activity`**
Recent-activity feed for the ambient Command Center view.
- Query: `since?` (ISO 8601 datetime, default: start of current trial day)
- 200: `{ recentActivity: Array<{ eventId, eventType, exhibitId, exhibitLabel, summary, recordedAt }>, statusCounts: Record<ExhibitStatus, number> }` *(amended Phase 8, F8: `statusCounts` added — per-status exhibit count breakdown, computed from existing `ExhibitCurrentState` data, no new query path)*
- Errors: `VALIDATION_ERROR` (422), `COMMAND_CENTER_LOAD_FAILED` (500)

**`GET /api/cases/:id/custody-by-custodian`** *(added Phase 8, F8)*
Exhibits grouped by current custodian, for the Command Center "Custody at a Glance" panel. Did not exist as a service or endpoint prior to this phase.
- 200: `Array<{ custodianUserId, custodianName, exhibits: Array<{ exhibitId, exhibitLabel, currentStatus }>, pendingTransfersIn: Array<{ exhibitId, exhibitLabel, proposedAt }> }>`
- Errors: `COMMAND_CENTER_LOAD_FAILED` (500 — reuses the existing generic code, no new code introduced for this endpoint)

**`GET /api/cases/:id/attention-feed`** *(added Phase 8, F8)*
Severity-ranked "Needs your attention" feed combining four discrepancy/objection rule sources into one prioritized list. Did not exist prior to this phase.
- 200: `Array<{ id, tier: 'CRITICAL'|'HIGH'|'PENDING'|'MEDIUM', ruleCode, exhibitId, exhibitLabel, objectionId?, detectedAt, summary, availableAction: 'RECORD_RULING'|'REMOVE_FROM_PACKAGE'|'TRANSFER_CUSTODY'|null }>` — ordered by tier (`CRITICAL` > `HIGH` > `PENDING` > `MEDIUM`), newest-first within each tier; see F08 §Process step 4 for the exact rule-to-tier mapping
- Errors: `ATTENTION_FEED_LOAD_FAILED` (500)

*(Command Center also composes `GET /api/cases/:id/objections?status=unresolved` and `GET /api/cases/:id/discrepancies`, defined above. Inline actions on attention-feed entries invoke F24's unchanged endpoints — see §Objections, §Custody.)*

---

### §Assistant (F7)

**`POST /api/assistant/chat`**
Streaming tool-calling chat endpoint (Vercel AI SDK `streamText`).
- Body: `{ caseId, userId, message, conversationId? }` *(`caseId` as of Phase 7.1, F22, is sourced from the client's explicit Case Selector state, not an implicit single-case constant — the field itself is unchanged, only its origin)*
- Response: streamed text (SSE/chunked), with a final structured payload including `citations[]`
- Tool calls made server-side during this request (not separately exposed as public routes): `getExhibitStatus`, `getUnresolvedObjections`, `getCustodian`, `getCustodyHistory`, `getExhibitHistory`, `searchExhibits`, `getJuryPackageStatus`, `getDiscrepancies` — each a 1:1 wrapper around the service functions backing the routes above
- Errors: `TOOL_ARGS_INVALID` (tool-level, surfaced to model, not HTTP), `ASSISTANT_UNAVAILABLE` (503)

**`GET /api/assistant/conversations/:id`**
Retrieves a persisted conversation with full citation trail (audit/replay, PER-04 use case).
- 200: `{ conversation: AssistantConversation, messages: Array<AssistantMessage & { citations: AssistantCitation[] }> }`
- Errors: `CONVERSATION_NOT_FOUND` (404)

---

### Common Response Envelope

All non-streaming endpoints return errors in a consistent shape:
```json
{ "error": { "code": "EXHIBIT_NOT_FOUND", "message": "No exhibit found with the given ID" } }
```
See `Y2-errors.md` for the complete cross-feature error code catalog.
## Y2: Error Catalog

Consolidated cross-feature error scenarios. Per-feature chunks list only the errors that originate in that feature; this catalog is the canonical reference for every error code in the system, including shared/cross-cutting ones not tied to a single feature.

### Data & Validation Errors

| HTTP Status | Error Code | Message | Origin | Retry Guidance |
|---|---|---|---|---|
| 422 | VALIDATION_ERROR | "{field} must be {constraint}" | Any input validation failure not covered by a more specific code | Fix the request payload and retry |
| 409 | EXHIBIT_LABEL_CONFLICT | "An exhibit with this label already exists in this case" | F0 | Use a different label or fetch the existing exhibit |
| 404 | EXHIBIT_NOT_FOUND | "No exhibit found with the given ID" | F0, F1, F2, F3, F9, F10 | Verify the exhibit ID; also returned for sealed/unauthorized exhibits (no distinction) |
| 404 | CASE_NOT_FOUND | "No case found with the given ID" | F8, F9, F22 | Verify the case ID / selected active case |
| 500 | SEED_INTEGRITY_FAILURE | "Seed data failed required edge-case assertions" | F0 (seed-time only) | Developer-facing; fix seed script, not user-retryable |
| 422 | CLASSIFICATION_REQUIRED | "classification is required and must be one of: TRIAL, CHAMBERS_EX_PARTE, SEALED" | F16 | Supply a valid classification at exhibit creation |
| 422 | INVALID_CLASSIFICATION | "classification must be one of: TRIAL, CHAMBERS_EX_PARTE, SEALED" | F16 | Correct the request payload and retry |

### Status Lifecycle Errors (F1)

| HTTP Status | Error Code | Message | Retry Guidance |
|---|---|---|---|
| 422 | INVALID_STATUS_TRANSITION | "Cannot transition from {fromStatus} to {toStatus}" | Correct the requested `toStatus` per the allowed-transitions table; not retryable as-is |
| 409 | STATUS_FINALIZED | "Exhibit status is final and cannot be changed" | Not retryable — terminal state is by design |
| 409 | STATUS_CONFLICT | "Exhibit status has changed since this view was loaded — refresh and retry" | Refetch current state, then retry the transition |

### Objection & Ruling Errors (F2)

| HTTP Status | Error Code | Message | Retry Guidance |
|---|---|---|---|
| 422 | INVALID_OBJECTION_TARGET | "Cannot raise an objection before the exhibit is offered" | Advance exhibit status first, then retry |
| 404 | OBJECTION_NOT_FOUND | "No objection found with the given ID" | Verify the objection ID |
| 409 | OBJECTION_ALREADY_RESOLVED | "This objection has already been ruled on" | Not retryable — check current objection state |
| 403 | ROLE_NOT_PERMITTED | "Only a judge may record a sustained or overruled ruling" (and feature-specific variants — see below) | Not retryable by this user; requires an authorized role |

### Custody Errors (F3)

| HTTP Status | Error Code | Message | Retry Guidance |
|---|---|---|---|
| 409 | CUSTODY_CHAIN_BROKEN | "Recorded custodian does not match the exhibit's current custodian" | Refetch current custodian, correct `fromCustodianUserId`, retry |
| 422 | INVALID_CUSTODIAN | "toCustodianUserId does not reference a valid active user" | Supply a valid active user ID |
| 422 | NO_OP_TRANSFER | "fromCustodianUserId and toCustodianUserId must differ" | Correct the request; a no-op transfer is never valid |

### Search Errors (F4)

| HTTP Status | Error Code | Message | Retry Guidance |
|---|---|---|---|
| 422 | EMPTY_SEARCH_CRITERIA | "At least one search criterion is required" | Supply at least one filter, or use the unfiltered list endpoint |
| 422 | INVALID_DATE_RANGE | "dateFrom must not be after dateTo" | Correct the date range |

### Jury Package Errors (F5)

| HTTP Status | Error Code | Message | Retry Guidance |
|---|---|---|---|
| 409 | JURY_PACKAGE_DISCREPANCIES_OPEN | "Cannot finalize: {n} exhibit(s) have unresolved discrepancies" | Resolve or acknowledge the listed discrepancies, then retry finalization |
| 409 | JURY_PACKAGE_ALREADY_FINALIZED | "This jury package has already been finalized" | Not retryable — create a new draft package if changes are needed |
| 422 | NO_ELIGIBLE_EXHIBITS | "No admitted exhibits are available to form a jury package" | Admit at least one exhibit first |
| 403 | ROLE_NOT_PERMITTED | "Only courtroom deputy, clerk, or admin roles may finalize a jury package" | Not retryable by this user |

### Discrepancy Errors (F6)

| HTTP Status | Error Code | Message | Retry Guidance |
|---|---|---|---|
| 422 | JUSTIFICATION_REQUIRED | "A justification is required to acknowledge a discrepancy" | Supply a non-empty justification |
| 404 | DISCREPANCY_NOT_FOUND | "No discrepancy flag found with the given ID" | Verify the discrepancy flag ID |
| 403 | ROLE_NOT_PERMITTED | "This role is not permitted to acknowledge discrepancies" | Not retryable by this user |

### Admission Integrity Errors (F12)

| HTTP Status | Error Code | Message | Retry Guidance |
|---|---|---|---|
| 422 | ADMISSION_BLOCKED | "Cannot admit: {n} blocking condition(s) present" (body includes `reasons[]`, each `UNRESOLVED_OBJECTION` or `NO_CUSTODIAN`) | Resolve the listed condition(s) — close the objection thread via a ruling (F2), and/or record a custody transfer (F3) — then retry the admission transition |

### Jury Package Exclusion Errors (F13)

| HTTP Status | Error Code | Message | Retry Guidance |
|---|---|---|---|
| 404 | JURY_PACKAGE_EXHIBIT_NOT_FOUND | "No included exhibit found in this jury package with the given ID" | Verify the juryPackageId/exhibitId pair and that the row is currently `INCLUDED` |
| 409 | JURY_PACKAGE_ALREADY_FINALIZED | "This jury package has already been finalized" | Not retryable — a `FINALIZED` package's rows are immutable; create a new draft if changes are needed |

**Note:** F14 (Discrepancy Acknowledgment Transparency) and F15 (Courtroom Usability Fixes) introduce no new error codes — both are UI-visibility/client-rendering requirements layered on existing, unchanged service behavior. See their respective FRD chunks' §Error States for the existing codes they continue to rely on.

### Exhibit Classification Errors (F16)

| HTTP Status | Error Code | Message | Retry Guidance |
|---|---|---|---|
| 422 | CLASSIFICATION_REQUIRED | "classification is required and must be one of: TRIAL, CHAMBERS_EX_PARTE, SEALED" | Supply a valid classification; no exhibit can be created unclassified |
| 422 | INVALID_CLASSIFICATION | "classification must be one of: TRIAL, CHAMBERS_EX_PARTE, SEALED" | Correct the request payload and retry |

**Note:** F17 (Objection-to-Admission State-Machine Hardening) introduces no new error codes — F12's existing `ADMISSION_BLOCKED` / `UNRESOLVED_OBJECTION` response already fully covers the scenario this feature hardens with regression tests; see `F17-objection-admission-state-machine-hardening.md` §Error States.

### Custodian-at-Intake Errors (F18)

| HTTP Status | Error Code | Message | Retry Guidance |
|---|---|---|---|
| 422 | CUSTODIAN_REQUIRED_AT_INTAKE | "A custodian must be established when an exhibit is first marked into evidence" | Supply a valid `custodianUserId` alongside the first MARKED transition |

### Custody Handoff Confirmation Errors (F19)

| HTTP Status | Error Code | Message | Retry Guidance |
|---|---|---|---|
| 409 | CUSTODY_TRANSFER_ALREADY_PENDING | "A custody transfer is already pending for this exhibit" | Wait for the pending transfer to be confirmed or cancelled before proposing a new one |
| 404 | CUSTODY_CONFIRMATION_NOT_PENDING | "No pending custody transfer found matching this request" | Verify a transfer is currently pending and the `proposedEventId` matches it |
| 403 | CUSTODY_CONFIRM_WRONG_USER | "Only the named receiving custodian may confirm this transfer" | Not retryable by this user — only the user named as `toCustodianUserId` on the proposal may confirm |
| 409 | CUSTODY_TRANSFER_REQUIRES_CONFIRMATION | "Transfers after the first must use the propose/confirm flow" | Use `POST /api/exhibits/:id/events/custody/propose` instead of the legacy unilateral endpoint |

### Server-Side Role Enforcement Errors (F20)

| HTTP Status | Error Code | Message | Applies To | Retry Guidance |
|---|---|---|---|---|
| 403 | ROLE_NOT_PERMITTED | "Only a courtroom deputy, clerk, or admin may create an exhibit" | Create exhibit | Not retryable by this user |
| 403 | ROLE_NOT_PERMITTED | "Only a courtroom deputy, clerk, or admin may record this status transition" | Mark/offer/withdraw/admit/exclude transitions | Not retryable by this user |
| 403 | ROLE_NOT_PERMITTED | "Only an attorney, courtroom deputy, clerk, or admin may raise an objection" | Raise objection | Not retryable by this user |
| 403 | ROLE_NOT_PERMITTED | "Only a courtroom deputy, clerk, or admin may propose a custody transfer" | Propose custody transfer | Not retryable by this user |
| 403 | ROLE_NOT_PERMITTED | "Only a courtroom deputy, clerk, or admin may confirm custody receipt" | Confirm custody transfer (role gate — distinct from F19's identity-match `CUSTODY_CONFIRM_WRONG_USER`) | Not retryable by this user |

**Note:** Rows for ruling disposition, discrepancy acknowledgment, jury-package finalize, and jury-package exclusion are unchanged by F20 — see their existing entries above (Objection & Ruling Errors, Discrepancy Errors, Jury Package Errors, Jury Package Exclusion Errors respectively). F20 retrofits all of them onto one shared `assertRole` enforcement mechanism without changing any existing message or code.

### Pending-Ruling Queue Errors (F21)

**Note:** F21 introduces no new error codes — it is a read-only client-side view reusing F2's existing `GET /api/cases/:id/objections` endpoint and error handling unchanged; see `F21-pending-ruling-queue.md` §Error States.

### Multi-Case Support Errors (F22)

**Note:** F22 introduces no new error codes — it reuses the existing `CASE_NOT_FOUND` (404) for every amended case-scoped endpoint; see `F22-multi-case-support-case-selector.md` §Error States.

### Jury Package Finalization Request Errors (F11, added Phase 8)

| HTTP Status | Error Code | Message | Retry Guidance |
|---|---|---|---|
| 403 | ROLE_NOT_PERMITTED | "This role can finalize directly and does not need to request it" | Not retryable by this user — a `DEPUTY`/`CLERK`/`ADMIN` role should use the Finalize action directly instead |
| 409 | JURY_PACKAGE_ALREADY_FINALIZED | "This jury package has already been finalized" | Not retryable — a finalized package has no pending request state to set *(reuses F5's existing code, unchanged)* |

### Command Center Attention Feed Errors (F8, added Phase 8)

| HTTP Status | Error Code | Message | Retry Guidance |
|---|---|---|---|
| 500 | ATTENTION_FEED_LOAD_FAILED | "Unable to load the attention feed — please retry" | Transient; retry |

**Note:** Phase 8's `GET /api/cases/:id/custody-by-custodian` (F8, new) introduces no new error code — it reuses the existing `COMMAND_CENTER_LOAD_FAILED` (500) for any underlying query failure. The `statusCounts` addition to `GET /api/cases/:id/activity` (F8) introduces no new error code either, since it is computed from data the endpoint already fetches.

**Note:** F24 (Write-Action UI Coverage — Record Ruling & Transfer Custody) introduces no new error codes. Every error it surfaces is an existing code from F02 (`OBJECTION_ALREADY_RESOLVED`, `OBJECTION_NOT_FOUND`), F03 (`CUSTODY_CHAIN_BROKEN`, `INVALID_CUSTODIAN`, `NO_OP_TRANSFER`), F19 (`CUSTODY_TRANSFER_ALREADY_PENDING`, `CUSTODY_CONFIRMATION_NOT_PENDING`, `CUSTODY_CONFIRM_WRONG_USER`, `CUSTODY_TRANSFER_REQUIRES_CONFIRMATION`), and F20 (`ROLE_NOT_PERMITTED`), all unchanged — see `F24-write-action-ui-coverage.md` §Error States for the consolidated list as surfaced through this feature's UI.

### Versioned Jury Package Export Errors (F23)

| HTTP Status | Error Code | Message | Retry Guidance |
|---|---|---|---|
| 422 | JURY_PACKAGE_EXPORT_NOT_FINALIZED | "Only a finalized jury package version can be exported as a PDF" | Finalize the package first, then retry export |
| 404 | JURY_PACKAGE_VERSION_NOT_FOUND | "No jury package version found with the given ID" | Verify the jury package ID |
| 500 | PDF_GENERATION_FAILED | "Unable to generate the jury package PDF — please retry" | Transient; retry. If persistent, check exhibit data integrity for the version being exported |

### Assistant Errors (F7)

| HTTP Status | Error Code | Message | Retry Guidance |
|---|---|---|---|
| — (tool-level) | TOOL_ARGS_INVALID | "Invalid arguments for tool {toolName}" | Surfaced to the LLM, not the end user; model should retry with corrected arguments within the same turn |
| 503 | ASSISTANT_UNAVAILABLE | "The assistant is temporarily unavailable — please try again" | Retry after a short delay; check LLM provider status |
| 404 | CONVERSATION_NOT_FOUND | "No conversation found with the given ID" | Verify the conversation ID |
| — (no HTTP error; model behavior) | — | "I don't have that information" (Decline Response) | Not an error — a required, valid response path when no tool result supports an answer. **Must never be treated as a bug to "fix" by relaxing citation requirements.** |

### Authorization / Visibility (Cross-Cutting)

| HTTP Status | Error Code | Message | Applies To | Notes |
|---|---|---|---|---|
| 404 | EXHIBIT_NOT_FOUND | "No exhibit found with the given ID" | Any read of a sealed exhibit by an unauthorized role | Deliberately identical to the genuine-not-found case — existence must never be revealed via a distinct 403 (see `00-header.md` §Role-Based Visibility, F10 §Validation) |
| 403 | ROLE_NOT_PERMITTED | varies by action (see feature-specific messages above) | Any write action gated by role (ruling disposition, jury finalization, discrepancy acknowledgment) | Used only for write/action gating, never for read-visibility (reads use the 404-masking pattern instead) |

### System / Infrastructure

| HTTP Status | Error Code | Message | Origin | Retry Guidance |
|---|---|---|---|---|
| 500 | COMMAND_CENTER_LOAD_FAILED | "Unable to load trial activity — please retry" | F8 | Transient; retry |
| 500 | CASE_WORKSPACE_LOAD_FAILED | "Unable to load case exhibits — please retry" | F9 | Transient; retry |
| 500 | EXHIBIT_DETAIL_LOAD_FAILED | "Unable to load exhibit history — please retry" | F10 | Transient; retry |
| 500 | JURY_PACKAGE_LOAD_FAILED | "Unable to load jury package — please retry" | F11 | Transient; retry |

### Error Handling Principles

- Every error response uses the common envelope defined in `Y1-api.md` §Common Response Envelope: `{ "error": { "code", "message" } }`.
- 404s used for visibility-masking (sealed exhibits) must be byte-identical in shape and message to genuine not-found errors — any observable difference (timing, response size, header presence) is a defect.
- 409 conflict errors (status/custody/objection concurrency, jury finalization gate) always include enough detail in the response body for the client to resolve and retry without a second round-trip to discover *why* (e.g., the blocking discrepancy list on `JURY_PACKAGE_DISCREPANCIES_OPEN`).
- 403 role errors are reserved for action/write gating; they are never used to signal "this record exists but you can't see it" (that is always a 404, per the masking principle above).
## Y3: Integration Points

JudicialSync is a self-contained demo with a single external dependency. This chunk documents that dependency plus the internal synchronization and trigger mechanisms that stand in for "integrations" at this scale.

### External Services

| Service | Integration Pattern | Notes |
|---|---|---|
| LLM Provider (Anthropic via `@ai-sdk/anthropic`, or OpenAI via `@ai-sdk/openai`) | Server-side tool-calling API (`streamText` + `tool()`), never called client-side | The only external network dependency in the system. Swappable via the AI SDK's provider abstraction with no architecture change (see `STACK.md` §Alternatives Considered). Low/near-zero temperature configured for deterministic repeated-question behavior during a live or recorded demo. |

**Explicitly no other external integrations exist or are planned for this demo:**
- No real court case-management system (CMS) integration — PROJECT.md scopes this out; JudicialSync is positioned as an assistant augmenting existing CMS workflows, not replacing or integrating with one.
- No real evidence-locker / DEMS integration — all custody data is seeded/representative.
- No external auth provider (no OAuth/SSO) — PROJECT.md scopes auth to a seeded-users + role-switcher pattern, not production identity integration.
- No vector database or embeddings provider — deliberately avoided per research findings; the assistant's only "external" call is the LLM tool-calling round-trip itself.

### Internal Triggers (Ledger → Projection → Discrepancy)

Though not external integrations, these internal event-driven triggers are documented here because they are the system's only "integration points" between subsystems and must fire reliably and synchronously (not via an eventually-consistent queue, at this scale):

| Trigger | Source Event | Downstream Effect | Feature |
|---|---|---|---|
| Status write | `recordEvent(STATUS_CHANGE)` | Updates `ExhibitCurrentState`; re-evaluates `ADMITTED_NO_CUSTODIAN` and `UNRESOLVED_OBJECTION_JURY_ELIGIBLE` discrepancy rules for the exhibit | F1 → F6 |
| Objection raised | `recordEvent(OBJECTION_RAISED)` | Creates `ObjectionCurrentState` row (`UNRESOLVED`) | F2 |
| Ruling recorded | `recordEvent(RULING_RECORDED)` | Updates `ObjectionCurrentState`; if the exhibit is `ADMITTED`, re-evaluates `UNRESOLVED_OBJECTION_JURY_ELIGIBLE` | F2 → F6 |
| Custody transfer (legacy/intake) | `recordEvent(CUSTODY_TRANSFER)` | Updates `CustodyCurrentState`; re-evaluates `ADMITTED_NO_CUSTODIAN` | F3 → F6 |
| Discrepancy acknowledged | `recordEvent(DISCREPANCY_ACKNOWLEDGED)` | Updates `DiscrepancyFlag.status` to `ACKNOWLEDGED` | F6 |
| Jury package exhibit excluded *(added Phase 7)* | `recordEvent(JURY_PACKAGE_EXHIBIT_EXCLUDED)` | Updates `JuryPackageExhibit.status` to `EXCLUDED`, setting `excludedAt`/`excludedBy`/`exclusionReason` | F13 |
| Custody transfer proposed *(added Phase 7.1)* | `recordEvent(CUSTODY_TRANSFER_PROPOSED)` | Sets `CustodyCurrentState.pendingTransferToUserId`/`pendingTransferEventId`/`pendingTransferProposedAt`; `currentCustodianUserId` is NOT modified | F19 |
| Custody transfer confirmed *(added Phase 7.1)* | `recordEvent(CUSTODY_TRANSFER_CONFIRMED)` | Updates `CustodyCurrentState.currentCustodianUserId`/`since`/`lastEventId`; clears all pending-transfer fields; re-evaluates `ADMITTED_NO_CUSTODIAN` | F19 → F6 |
| Custody transfer cancelled *(added Phase 7.1)* | `recordEvent(CUSTODY_TRANSFER_CANCELLED)` | Clears all pending-transfer fields only; `currentCustodianUserId` unaffected | F19 |

All triggers execute synchronously within the same service-layer call that appends the ledger event — there is no async job queue or eventual-consistency window between a ledger write and its projection/discrepancy update, which is required for F5's finalization gate to be trustworthy (re-evaluating discrepancies "fresh" per F5 §Process step 5 means the projection is never behind the ledger).

### Admission Gate (F12 — Pre-Write Check, Not a Post-Write Trigger)

Added Phase 7. Unlike the triggers above, which run *after* a ledger event is appended, F12's two admission-integrity checks (unresolved objection present; no custodian of record) run *before* the `STATUS_CHANGE` event for a `toStatus = ADMITTED` transition is ever appended. If either check fails, the service layer rejects the request with `ADMISSION_BLOCKED` (422) and **no `ExhibitEvent` row is created** — this is a hard precondition gate inside the same service function used by every caller (UI, API, seed loader), not a downstream reaction to a write that already happened. See F12 §Process for the full sequence. **Phase 7.1's F17 adds no new gate here** — it formalizes, and adds regression test coverage for, the already-sufficient guarantee that this gate provides (see `F17-objection-admission-state-machine-hardening.md`).

### Intake Custody Gate (F18 — Pre-Write Check, Same Transaction as MARKED)

Added Phase 7.1. Analogous in spirit to F12's admission gate but earlier in the lifecycle: the exhibit's first-ever `STATUS_CHANGE` event (`(none) → MARKED`) now requires a non-null `custodianUserId`, validated and written in the **same transaction** as the status event itself (not a downstream trigger reacting to the status write, and not a separate manual step a caller could skip). See `F18-custodian-required-at-intake.md` §Process.

### Server-Side Role Resolution (F20 — Pre-Write Check on Every Gated Action)

Added Phase 7.1. Every write action listed in `F20-server-side-role-enforcement-matrix.md`'s permission matrix now runs a role-resolution check (`assertRole(actorUserId, allowedRoles, actionLabel)`) before any other validation or write — resolving the acting user's role from the `User.role` database column via `actorUserId`, never from a client-supplied role claim. This generalizes the pattern already used, prior to Phase 7.1, only by `recordRuling`'s judge-check and `assertJuryWriteRole`. If the resolved role is not permitted, the request is rejected with `403 ROLE_NOT_PERMITTED` before any field-level validation, state-machine check, or ledger write occurs.

### Case Scoping (F22 — Explicit, Stateless, Per-Request)

Added Phase 7.1. Prior to this feature, every service-layer query implicitly scoped to a single case via the `DEMO_CASE_NUMBER` constant. As of F22, `caseId` is carried explicitly on every request — identically to how `requestingUserRole` is already carried per-request rather than server-side-session-stored (`Y1-api.md` §intro note). The server remains stateless with respect to "which case is active": there is no server-side "current case" session value, only a client-selected `caseId` passed with each call. This requires no new integration mechanism — it is the same per-request-parameter pattern already in use for role, now extended to case. See `F22-multi-case-support-case-selector.md` §Process.

### Live Multi-Screen Sync

| Mechanism | Pattern | Notes |
|---|---|---|
| Polling (`@tanstack/react-query`) | Client refetch every 3–5 seconds, plus refetch-on-window-focus | Sufficient at demo scale (single case, <10 concurrent users) per `ARCHITECTURE.md` §Live multi-screen updates. Applies to Command Center (F8), Case Workspace (F9), Exhibit Detail (F10), and Jury Package Workspace (F11, while `DRAFT`). |
| SSE/WebSocket | Not implemented in v1 | Explicitly deferred — only revisit if a live demo script requires sub-second visible sync between two screens displayed side-by-side (flagged as a phase-specific decision in `ARCHITECTURE.md`, not a v1 requirement). |

### Seed Data Loader (Pseudo-Integration)

The seed data loader (F0) is not an external integration but is documented here as the system's sole "data import" path: it calls the identical `recordEvent()` and `getExhibits()`-family service functions a live user would, rather than inserting rows directly into current-state tables. This guarantees seeded demo data exercises the exact same write path (ledger-first, projection-derived) that the live UI uses, so there is no risk of the seed data representing a state the live system could never actually produce.

### Deployment/Runtime Dependencies

| Dependency | Purpose | Notes |
|---|---|---|
| Neon Postgres | Primary datastore | Serverless Postgres, zero-ops, pairs natively with Vercel hosting (see `STACK.md`) |
| Vercel (or equivalent Next.js hosting) | Hosting for the full-stack Next.js 16 app | Single deployable artifact — UI, API routes, and assistant route all ship together |
| `@react-pdf/renderer` *(added Phase 7.1, F23 — new dependency)* | Server-side PDF generation for finalized jury package export | Pure-JS, component-based (`<Document>`/`<Page>`/`<View>`/`<Text>`) PDF generation with no headless-Chromium binary required — selected specifically because this system runs on Vercel serverless functions, where a Puppeteer/Playwright-style HTML-to-PDF approach would require bundling and cold-starting a full browser binary per invocation. This is the first new runtime dependency added since the original tech-stack lock-in; F16–F22 introduce no new dependencies. |

No message queues, caches, or background job runners are part of this architecture — all writes are synchronous request/response cycles, appropriate for single-case demo scale (see `ARCHITECTURE.md` §Scaling Considerations). **As of Phase 7.1 (F22), "single-case" no longer describes the data model** (see §Case Scoping above) but the synchronous, queue-free write model itself is unaffected — multi-case support adds a query-scoping dimension, not a new write pathway or async mechanism. F19's custody-handoff "no-confirm" path (indefinite pending, no auto-expiry) is deliberately consistent with this same queue-free constraint — see `F19-custody-handoff-confirmation.md` §Design Decisions.
