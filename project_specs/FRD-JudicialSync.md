# Functional Requirements Document: JudicialSync

**Project Acronym:** JudicialSync
**Document Type:** FRD (Functional Requirements Document)
**Version:** 1.1
**Status:** Draft
**Generated:** 2026-10-06
**Last Updated:** 2026-10-08 (added F12–F15 for Phase 7)
**Source PRD:** `PRD-JudicialSync.md`

---

## Scope

This FRD translates JudicialSync's 16 PRD features (F0–F15) into implementation-ready specifications: data model, process flows, inputs/outputs, validation rules, error states, API surface, and schema surface. It is grounded in one non-negotiable architectural constraint established by project research (`SUMMARY.md`, `ARCHITECTURE.md`, `PITFALLS.md`): **status, objections/rulings, and custody are modeled exclusively as an append-only event ledger**, never as mutable "current state" fields. Every UI screen and every Pivota Assistant answer reads through one shared service layer over this ledger and its derived current-state projections — there is no parallel retrieval path, which is what makes assistant citations trustworthy.

F12–F15 (added for Phase 7: "Fix admission integrity and UI usability issues") extend this foundation with a hard pre-write admission gate (F12), a structural sealed/ex-parte exclusion from jury packages (F13), a UI-visibility-only requirement over F6's existing acknowledgment audit trail (F14), and a cluster of client-rendering usability fixes with no backend contract changes (F15). None of F12–F15 alters the behavior specified for F0–F11 in this document; they add new validation points, one new ledger event type, and new fields strictly additive to the schema described in `Y0-schema.md`.

This document is written for developers implementing JudicialSync and assumes familiarity with the PRD's feature priorities and the project's demo-first context (seeded data, no production auth, single-case scope).

---

## How to Read This Document

- **Feature chunks (`F00`–`F15`)** map 1:1 to PRD features F0–F15. Each chunk is self-contained (description, process, inputs/outputs, validation, errors) but defers full DDL to `Y0-schema.md` and full endpoint contracts to `Y1-api.md`. F12–F15 (Phase 7) additionally cross-reference the F0–F11 chunks whose behavior they extend or gate, rather than restating or altering that behavior in place.
- **Cross-feature chunks (`Y0`–`Y3`)** consolidate schema, API, error catalog, and integrations so there is one canonical definition of each, referenced (not duplicated) by every feature chunk.
- **IDs:** Feature IDs (`F0`–`F11`) match the PRD exactly. Database entity names use `PascalCase` (Prisma model convention). API paths use `kebab-case`. Event types use `SCREAMING_SNAKE_CASE`.
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
- **Sealed Exhibit:** An exhibit flagged `is_sealed = true` at creation (e.g., sidebar/in-camera material). Sealed exhibits are excluded from both UI queries and assistant tool results for roles outside the visibility set defined below, with no indication to the excluded role that a sealed record even exists (not just redacted content).
- **Tool-Calling (Assistant):** The Pivota Assistant answers exclusively via LLM tool-calls that are thin 1:1 wrappers around service-layer functions (see F7, `Y1-api.md` §Assistant). No retrieval-augmented generation, no embeddings, no vector search — the data is small, structured, and exact-citation-critical.

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

**Description:** A high-level, ambient live view of trial/exhibit activity designed for a judge or deputy to glance at during proceedings without configuring or drilling into anything. This screen is read-only, renders no business logic of its own, and composes multiple existing service-layer queries.

**Terminology:**
- **Ambient View:** A passive-monitoring screen intentionally free of configuration controls, filters-as-default-state, or data-entry affordances — glance-and-go, not a dashboard to be tuned.

**Sub-features:**
- Live-updating summary of recent exhibit activity (recent status changes, pending objections, recent rulings)
- At-a-glance count/list of outstanding discrepancies
- Polling-based live refresh so the screen reflects changes recorded elsewhere without manual reload

**Process:**
1. On load, the client calls three existing service-layer-backed endpoints: `getRecentActivity(caseId, { since })`, `getUnresolvedObjections(caseId)` (F2), and `getDiscrepancies(caseId)` (F6).
2. `getRecentActivity` queries the `ExhibitEvent` ledger for the case, filtered to events within a rolling recent window (default: current trial day), ordered by `recordedAt` descending, joined to exhibit labels for display.
3. The client renders three ambient panels: "Recent Activity" (status/objection/ruling/custody events), "Unresolved Objections" (count + list), "Discrepancies" (count + list, linking to F9/F11 for action).
4. The client polls all three endpoints on a fixed interval (3–5 seconds, see `Y3-integrations.md` §Live Sync) so that a status change recorded by a deputy on the Case Workspace screen (F9) appears on an open Command Center screen without manual refresh.
5. No panel on this screen accepts input beyond a "view full details" link-through to F9/F10/F11 — this screen never writes to the ledger.

**Inputs:**
- `caseId` (string/UUID, required, from session)
- `requestingUserRole` (enum, required, from session): applies role-based visibility to all three underlying queries identically to every other screen
- `since` (ISO 8601 datetime, optional, default: start of current trial day): bounds the "recent activity" window

**Outputs:**
- `recentActivity[]`: `{ eventId, eventType, exhibitId, exhibitLabel, summary, recordedAt }`
- `unresolvedObjections[]`: per F2 output shape
- `discrepancies[]`: per F6 output shape

**Validation:**
- This screen issues no write requests — any validation rules live entirely in the underlying F1/F2/F3/F6 service functions it calls
- `since`, if supplied, must be a valid ISO 8601 datetime not in the future

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| Invalid `since` parameter | 422 | VALIDATION_ERROR | "since must be a valid past or present datetime" |
| Underlying service query failure (any of the three) | 500 | COMMAND_CENTER_LOAD_FAILED | "Unable to load trial activity — please retry" |

**API Surface (this feature):** see `Y1-api.md` §Command Center for `GET /api/cases/:id/activity`. Also composes `GET /api/cases/:id/objections?status=unresolved` (F2) and `GET /api/cases/:id/discrepancies` (F6).

**Schema Surface (this feature):** read-only against `ExhibitEvent`, `ObjectionCurrentState`, `DiscrepancyFlag` — see `Y0-schema.md`. Introduces no new tables.
## F09: Case Workspace Screen

**Description:** The case-level screen listing all exhibits, parties, and current statuses in one place — the primary browsing and searching surface for the full exhibit set, and the entry point into an individual Exhibit Detail View (F10).

**Terminology:**
- (none beyond `00-header.md` shared terminology)

**Sub-features:**
- Full exhibit list for the case with current status, offering party, and witness association
- Integrated search/filter bar (F4)
- Inline discrepancy flag indicators per exhibit row (F6)
- Row-level drill-through to Exhibit Detail View (F10)

**Process:**
1. On load (no search criteria active), the client calls `getExhibits(caseId)`, which internally applies role-based visibility (excluding sealed exhibits per role) and returns every visible exhibit joined with its `ExhibitCurrentState` and any `OPEN`/`ACKNOWLEDGED` `DiscrepancyFlag` rows.
2. Each row renders: exhibit label, description (truncated), offering party, associated witness, current status badge (F1 visual convention), current custodian name (F3), and a discrepancy indicator icon if any flag exists for that exhibit.
3. When the user enters search criteria, the client calls `searchExhibits` (F4) instead of `getExhibits`, replacing the rendered list with filtered results while preserving the same row rendering.
4. Clicking any exhibit row navigates to `/exhibit/:id`, the Exhibit Detail View (F10), passing the `exhibitId`.
5. The screen polls `getExhibits`/`searchExhibits` on the same live-sync interval as F8 (3–5s) so status/custody/discrepancy changes recorded by another user appear without manual refresh.

**Inputs:**
- `caseId` (string/UUID, required, from session)
- `requestingUserRole` (enum, required, from session)
- Search criteria (optional, per F4 §Inputs) when the search bar is active

**Outputs:**
- Exhibit row list: `{ exhibitId, exhibitLabel, description, offeringParty, associatedWitness, currentStatus, currentCustodianName, discrepancyFlags[] }`

**Validation:**
- No write operations originate from this screen directly — all mutations (status change, objection, ruling, custody transfer) happen via dedicated action flows that call F1/F2/F3 endpoints, kept outside this screen's core list-rendering responsibility per the PRD's "assistant, not data-entry system" positioning
- Sealed exhibits never appear in this screen's list for a role outside the visibility set (`00-header.md` §Role-Based Visibility) — not shown as redacted rows, simply absent

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| Case not found / no access | 404 | CASE_NOT_FOUND | "No case found with the given ID" |
| Underlying exhibit list query failure | 500 | CASE_WORKSPACE_LOAD_FAILED | "Unable to load case exhibits — please retry" |

**API Surface (this feature):** see `Y1-api.md` §Exhibits for `GET /api/cases/:id/exhibits` and §Search for `GET /api/cases/:id/exhibits/search` (F4).

**Schema Surface (this feature):** read-only against `Exhibit`, `ExhibitCurrentState`, `CustodyCurrentState`, `DiscrepancyFlag` — see `Y0-schema.md`. Introduces no new tables.
## F10: Exhibit Detail View Screen

**Description:** The full history for a single exhibit — every status change, objection, ruling, and custody transfer — presented as a chronological timeline reconstructed directly from the event ledger. This screen answers "what happened to this exhibit" without assembling fragments from multiple sources, directly supporting the named demo scenario of the same description.

**Terminology:**
- **Timeline Entry:** One rendered row corresponding to exactly one `ExhibitEvent` row, in `sequence_no` order.

**Sub-features:**
- Chronological timeline of all ledger events for the exhibit
- Current status, current custodian, and active discrepancy flags shown prominently above the timeline
- Each timeline entry displays actor, timestamp, and plain-language summary (no raw enum/JSON exposure, per PITFALLS.md §UX Pitfalls)

**Process:**
1. On load, the client calls `getExhibitHistory(exhibitId)`, which checks role-based visibility first (403/404 per §Validation below if the exhibit is sealed and the role is unauthorized), then returns the exhibit's identity fields, its full ordered `ExhibitEvent` list, current `ExhibitCurrentState`, current `CustodyCurrentState`, and any `DiscrepancyFlag` rows.
2. The header area renders: exhibit label, description, offering party, associated witness, current status badge, current custodian name, and discrepancy indicators (if any) with a link-through to the acknowledgment flow (F6) if the viewing role is authorized to acknowledge.
3. The timeline area renders one entry per `ExhibitEvent`, oldest-first (or newest-first, implementation's choice, but consistently applied), each translated from its `eventType` + `payload` into a plain-language sentence (e.g., "Status changed from Offered to Admitted" rather than exposing `STATUS_CHANGE` / `fromStatus` / `toStatus` raw).
4. Every timeline entry is independently citable — this is the same `getExhibitHistory` function the assistant's `getExhibitHistory` tool (F7) calls, so an assistant answer to "what happened to Exhibit 14" and this screen's rendered timeline are guaranteed to show identical events.
5. The screen polls `getExhibitHistory` on the standard live-sync interval so a custody transfer recorded elsewhere appears in the open timeline without manual refresh.

**Inputs:**
- `exhibitId` (string/UUID, required, from route param)
- `requestingUserRole` (enum, required, from session)

**Outputs:**
- Exhibit header: identity fields + `currentStatus` + `currentCustodianName` + `discrepancyFlags[]`
- `timeline[]`: `{ eventId, eventType, summary, actorName, recordedAt }`, one entry per ledger event, each carrying its own `eventId` for citation-parity verification with the assistant

**Validation:**
- If the exhibit is sealed and the requesting role is outside the visibility set, the screen must behave as if the exhibit does not exist (404), not as a 403 revealing its existence, consistent with F7's decline behavior
- The timeline must render every `ExhibitEvent` row for the exhibit with no filtering/truncation — "full history" means complete, not "recent N events"

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| Exhibit not found | 404 | EXHIBIT_NOT_FOUND | "No exhibit found with the given ID" |
| Sealed exhibit, unauthorized role | 404 | EXHIBIT_NOT_FOUND | "No exhibit found with the given ID" *(identical message — existence is not revealed)* |
| Timeline query failure | 500 | EXHIBIT_DETAIL_LOAD_FAILED | "Unable to load exhibit history — please retry" |

**API Surface (this feature):** see `Y1-api.md` §Exhibits for `GET /api/exhibits/:id/history`.

**Schema Surface (this feature):** read-only against `Exhibit`, `ExhibitEvent`, `ExhibitCurrentState`, `CustodyCurrentState`, `ObjectionCurrentState`, `DiscrepancyFlag` — see `Y0-schema.md`. Introduces no new tables.
## F11: Jury Package Workspace Screen

**Description:** A curated, exportable workspace presenting the computed jury-eligible exhibit list (F5) alongside any discrepancy warnings, serving as the authoritative handoff view for jury package preparation. This screen is where the demo's "build a jury package" scenario plays out end-to-end, including the discrepancy gate blocking finalization.

**Terminology:**
- (none beyond `00-header.md` and F5/F6 shared terminology)

**Sub-features:**
- Displays the current `JuryPackage` (draft or finalized) and its `JuryPackageExhibit` list
- Prominently surfaces discrepancy warnings per included exhibit
- Blocks the finalize action (disabled control, not just a rejected request) while open discrepancies remain among included exhibits
- Export/curated presentation view suitable for handoff once finalized

**Process:**
1. On load, the client calls `GET /api/cases/:id/jury-package` (F5), which returns the current `JuryPackage` (creating a fresh `DRAFT` via `computeJuryCandidates` if none exists yet for the case) along with each `JuryPackageExhibit`'s live discrepancy status.
2. The screen renders the package status (`DRAFT`/`FINALIZED`) prominently at the top, with the exhibit list below — each row showing exhibit label, status badge, and a discrepancy warning badge if `discrepancyStatus = 'FLAGGED'`.
3. For any flagged row, the user can navigate to that exhibit's F10 detail view to resolve the underlying issue (e.g., record a missing custody transfer) or, if authorized, acknowledge the discrepancy directly from this screen via the F6 acknowledgment action.
4. The "Finalize Jury Package" action control is disabled (not merely error-returning) whenever the client-side computed count of exhibits with `discrepancyStatus = 'FLAGGED' AND status = 'OPEN'` is greater than zero — this is a UX affordance layered on top of, not a replacement for, the server-side gate in F5.
5. When finalization is attempted (control enabled, zero open discrepancies at render time), the client calls `POST /api/jury-package/:id/finalize` (F5), which re-validates server-side before committing.
6. On successful finalization, the screen switches to a read-only "Finalized" presentation suitable for export/handoff (e.g., print-friendly or downloadable view) and the exhibit list becomes immutable.
7. The screen polls the jury-package endpoint on the standard live-sync interval while in `DRAFT` state so that a concurrent custody fix or acknowledgment by another user updates the flagged-row count without manual refresh; polling stops once `FINALIZED` (immutable content needs no further refresh).

**Inputs:**
- `caseId` (string/UUID, required, from session)
- `requestingUserRole` (enum, required, from session): gates whether the "Finalize" and "Acknowledge" controls render as actionable (per F5 §Validation, F6 §Validation role checks) versus view-only

**Outputs:**
- Package header: `{ juryPackageId, status, createdAt, finalizedAt?, finalizedBy? }`
- Exhibit rows: `{ exhibitId, exhibitLabel, currentStatus, discrepancyStatus, discrepancyDetails? }`
- On blocked finalization attempt (if somehow triggered despite the disabled control, e.g., stale client state): the specific blocking discrepancies returned by F5, rendered as an inline error list

**Validation:**
- This screen never computes jury eligibility or discrepancy status itself — all computation happens server-side via F5/F6; the screen is a pure presentation + action-trigger layer, preventing any possibility of the screen showing a different "clean" state than the server would enforce
- A `FINALIZED` package's exhibit list is rendered as fully read-only — no acknowledge/resolve/remove controls are shown, consistent with F5's immutability rule

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| Finalize attempted with stale client state (server re-check fails) | 409 | JURY_PACKAGE_DISCREPANCIES_OPEN | "Cannot finalize: {n} exhibit(s) have unresolved discrepancies" *(per F5)* |
| Jury package load failure | 500 | JURY_PACKAGE_LOAD_FAILED | "Unable to load jury package — please retry" |
| Non-authorized role attempts finalize | 403 | ROLE_NOT_PERMITTED | "Only courtroom deputy, clerk, or admin roles may finalize a jury package" *(per F5)* |

**API Surface (this feature):** see `Y1-api.md` §Jury Package for `GET /api/cases/:id/jury-package`, `POST /api/jury-package/:id/finalize` (both defined in F5), and §Discrepancies for `POST /api/discrepancies/:id/acknowledge` (F6).

**Schema Surface (this feature):** read-only against `JuryPackage`, `JuryPackageExhibit`, `DiscrepancyFlag` — see `Y0-schema.md` §Jury Package, §Discrepancy Detection. Introduces no new tables.
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

model Exhibit {
  id                 String        @id @default(uuid())
  caseId             String
  exhibitLabel       String
  description        String
  source             String?
  offeringParty      OfferingParty
  associatedWitness  String?
  isSealed           Boolean       @default(false)
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
  CUSTODY_TRANSFER
  DISCREPANCY_ACKNOWLEDGED
  JURY_PACKAGE_EXHIBIT_EXCLUDED  // added Phase 7 (F13) — see §Jury Package
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
- `CUSTODY_TRANSFER`: `{ fromCustodianUserId: string | null, toCustodianUserId: string, reason?: string }`
- `DISCREPANCY_ACKNOWLEDGED`: `{ discrepancyFlagId: string (uuid), ruleCode: string, justification: string }`
- `JURY_PACKAGE_EXHIBIT_EXCLUDED` *(added Phase 7, F13)*: `{ juryPackageId: string (uuid), exhibitId: string (uuid), reason: 'SEALED_EXPARTE' | 'MANUAL_REMOVAL', note?: string }`

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
  exhibitId             String   @id
  currentCustodianUserId String
  since                 DateTime
  lastEventId           String

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

  case Case @relation(fields: [caseId], references: [id])
  exhibitRows JuryPackageExhibit[]

  @@index([caseId, status])
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

**Jury Package Exclusion note (Phase 7, F13):** `computeJuryCandidates` (F5) is amended to filter `exhibit.isSealed = false` in the same query as the `ADMITTED`-status filter, so a sealed/ex-parte exhibit never acquires an `INCLUDED` row here in the first place — see F13 §Process step 1. The `EXCLUDED` status and its three accompanying fields exist solely for the remediation/audit path (legacy rows, or any future manual removal), not as the primary exclusion mechanism.

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

### Projection Integrity

All current-state projection tables must be exactly reproducible by replaying `ExhibitEvent` rows per exhibit in `sequenceNo` order. This replay capability is the mechanism for auditing projection/ledger consistency (PRD §Non-Functional Requirements, Auditability) and should be exposed as an admin/dev utility (`rebuildProjections(caseId)`), not relied upon as the live write path.
## Y1: API Endpoints

Consolidated REST API surface for JudicialSync. Every route handler is a thin wrapper around the service layer (`00-header.md` §Service Layer) — no route contains business logic beyond request parsing, auth/role extraction, and response shaping. The Pivota Assistant's tools (F7) call the identical underlying service functions, not these HTTP routes directly (in-process function calls, not HTTP round-trips, for the assistant path) — but the request/response shapes below describe the same contract both consumers rely on.

All endpoints require a `requestingUserRole` derived from the session/role-switcher (PROJECT.md scope: no production auth) and apply role-based visibility per `00-header.md` §Role-Based Visibility uniformly.

---

### §Exhibits (F0, F9, F10)

**`POST /api/exhibits`**
Creates a new exhibit identity record (F0).
- Body: `{ caseId, exhibitLabel, description, source?, offeringParty, associatedWitness?, isSealed? }`
- 201: `Exhibit`
- Errors: `EXHIBIT_LABEL_CONFLICT` (409), `VALIDATION_ERROR` (422)

**`GET /api/exhibits/:id`**
Fetches a single exhibit's identity fields (F0).
- 200: `Exhibit`
- Errors: `EXHIBIT_NOT_FOUND` (404)

**`GET /api/cases/:id/exhibits`**
Lists all visible exhibits for a case with current-state summary (F9).
- Query: none (full list; use §Search for filtered)
- 200: `Array<{ exhibitId, exhibitLabel, description, offeringParty, associatedWitness, currentStatus, currentCustodianName, discrepancyFlags[] }>`
- Errors: `CASE_NOT_FOUND` (404)

**`GET /api/exhibits/:id/history`**
Full chronological event timeline for one exhibit (F10).
- 200: `{ exhibit: {...}, currentStatus, currentCustodianName, discrepancyFlags[], timeline: Array<{ eventId, eventType, summary, actorName, recordedAt }> }`
- Errors: `EXHIBIT_NOT_FOUND` (404 — also returned for sealed/unauthorized, per F10 §Validation)

---

### §Status (F1)

**`POST /api/exhibits/:id/events/status`**
Records a status transition.
- Body: `{ toStatus, actorUserId, notes? }`
- 201: `{ event: ExhibitEvent, currentState: ExhibitCurrentState }`
- Errors: `INVALID_STATUS_TRANSITION` (422), `STATUS_FINALIZED` (409), `STATUS_CONFLICT` (409), `EXHIBIT_NOT_FOUND` (404), `ADMISSION_BLOCKED` (422 — added Phase 7, F12: only evaluated when `toStatus = ADMITTED`; see F12 §Process)

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
- Errors: `INVALID_OBJECTION_TARGET` (422), `EXHIBIT_NOT_FOUND` (404)

**`POST /api/objections/:id/ruling`**
Records a ruling against an objection thread.
- Body: `{ disposition, actorUserId }`
- 201: `{ event: ExhibitEvent, objectionState: ObjectionCurrentState }`
- Errors: `OBJECTION_NOT_FOUND` (404), `OBJECTION_ALREADY_RESOLVED` (409), `ROLE_NOT_PERMITTED` (403)

**`GET /api/cases/:id/objections?status=unresolved`**
Lists objection threads case-wide, filterable by status.
- 200: `Array<ObjectionCurrentState>`
- Errors: `CASE_NOT_FOUND` (404)

---

### §Custody (F3)

**`POST /api/exhibits/:id/events/custody`**
Records a custody transfer.
- Body: `{ fromCustodianUserId?, toCustodianUserId, reason?, actorUserId }`
- 201: `{ event: ExhibitEvent, custodyState: CustodyCurrentState }`
- Errors: `CUSTODY_CHAIN_BROKEN` (409), `INVALID_CUSTODIAN` (422), `NO_OP_TRANSFER` (422), `EXHIBIT_NOT_FOUND` (404)

**`GET /api/exhibits/:id/custodian`**
Current custodian only.
- 200: `CustodyCurrentState`
- Errors: `EXHIBIT_NOT_FOUND` (404)

**`GET /api/exhibits/:id/custody-history`**
Full ordered chain-of-custody.
- 200: `Array<{ fromCustodian, toCustodian, timestamp, reason, eventId }>`
- Errors: `EXHIBIT_NOT_FOUND` (404)

---

### §Search (F4)

**`GET /api/cases/:id/exhibits/search`**
Multi-criteria combinable exhibit search.
- Query: `keyword?, status?, witness?, dateFrom?, dateTo?`
- 200: same shape as `GET /api/cases/:id/exhibits`
- Errors: `EMPTY_SEARCH_CRITERIA` (422), `INVALID_DATE_RANGE` (422), `VALIDATION_ERROR` (422)

---

### §Jury Package (F5)

**`POST /api/cases/:id/jury-package`**
Computes/refreshes the draft jury-eligible exhibit set.
- Body: `{ actorUserId }`
- 201: `{ juryPackage: JuryPackage, exhibits: JuryPackageExhibit[] }`
- Errors: `NO_ELIGIBLE_EXHIBITS` (422), `ROLE_NOT_PERMITTED` (403)

**`GET /api/cases/:id/jury-package`**
Fetches the current (draft or finalized) jury package with live discrepancy status per exhibit.
- 200: `{ juryPackage: JuryPackage, exhibits: JuryPackageExhibit[] }` — `exhibits[]` includes only `status: INCLUDED` rows by default *(added Phase 7, F13: `EXCLUDED` rows are retained for audit but omitted from this default read)*
- Errors: `CASE_NOT_FOUND` (404)

**`POST /api/jury-package/:id/finalize`**
Attempts finalization — hard-gated by discrepancy re-check.
- Body: `{ actorUserId, acknowledgedDiscrepancyIds? }`
- 200: `{ juryPackage: JuryPackage (status: FINALIZED) }`
- Errors: `JURY_PACKAGE_DISCREPANCIES_OPEN` (409, includes blocking list), `JURY_PACKAGE_ALREADY_FINALIZED` (409), `ROLE_NOT_PERMITTED` (403)

*(Added Phase 7, F13: the candidate computation behind `POST /api/cases/:id/jury-package` now also filters `exhibit.isSealed = false` at the query level, in addition to the `currentStatus = ADMITTED` filter — see F13 §Process step 1. This is a behavior amendment to the existing endpoint, not a new route.)*

---

### §Jury Package Exclusion (F13)

**`POST /api/jury-package/:id/exhibits/:exhibitId/exclude`**
Explicitly excludes an `INCLUDED` exhibit row from a `DRAFT` jury package (remediation action for sealed/ex-parte material, or any other manual removal need), recorded as an auditable ledger event.
- Body: `{ actorUserId, reason: 'SEALED_EXPARTE' | 'MANUAL_REMOVAL', note? }`
- 200: `{ event: ExhibitEvent, juryPackageExhibit: JuryPackageExhibit (status: EXCLUDED) }`
- Errors: `JURY_PACKAGE_EXHIBIT_NOT_FOUND` (404), `JURY_PACKAGE_ALREADY_FINALIZED` (409), `ROLE_NOT_PERMITTED` (403)

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
- 200: `Array<{ eventId, eventType, exhibitId, exhibitLabel, summary, recordedAt }>`
- Errors: `VALIDATION_ERROR` (422), `COMMAND_CENTER_LOAD_FAILED` (500)

*(Command Center also composes `GET /api/cases/:id/objections?status=unresolved` and `GET /api/cases/:id/discrepancies`, defined above.)*

---

### §Assistant (F7)

**`POST /api/assistant/chat`**
Streaming tool-calling chat endpoint (Vercel AI SDK `streamText`).
- Body: `{ caseId, userId, message, conversationId? }`
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
| 404 | CASE_NOT_FOUND | "No case found with the given ID" | F8, F9 | Verify the case ID / session context |
| 500 | SEED_INTEGRITY_FAILURE | "Seed data failed required edge-case assertions" | F0 (seed-time only) | Developer-facing; fix seed script, not user-retryable |

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
| Custody transfer | `recordEvent(CUSTODY_TRANSFER)` | Updates `CustodyCurrentState`; re-evaluates `ADMITTED_NO_CUSTODIAN` | F3 → F6 |
| Discrepancy acknowledged | `recordEvent(DISCREPANCY_ACKNOWLEDGED)` | Updates `DiscrepancyFlag.status` to `ACKNOWLEDGED` | F6 |
| Jury package exhibit excluded *(added Phase 7)* | `recordEvent(JURY_PACKAGE_EXHIBIT_EXCLUDED)` | Updates `JuryPackageExhibit.status` to `EXCLUDED`, setting `excludedAt`/`excludedBy`/`exclusionReason` | F13 |

All triggers execute synchronously within the same service-layer call that appends the ledger event — there is no async job queue or eventual-consistency window between a ledger write and its projection/discrepancy update, which is required for F5's finalization gate to be trustworthy (re-evaluating discrepancies "fresh" per F5 §Process step 5 means the projection is never behind the ledger).

### Admission Gate (F12 — Pre-Write Check, Not a Post-Write Trigger)

Added Phase 7. Unlike the triggers above, which run *after* a ledger event is appended, F12's two admission-integrity checks (unresolved objection present; no custodian of record) run *before* the `STATUS_CHANGE` event for a `toStatus = ADMITTED` transition is ever appended. If either check fails, the service layer rejects the request with `ADMISSION_BLOCKED` (422) and **no `ExhibitEvent` row is created** — this is a hard precondition gate inside the same service function used by every caller (UI, API, seed loader), not a downstream reaction to a write that already happened. See F12 §Process for the full sequence.

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

No message queues, caches, or background job runners are part of this architecture — all writes are synchronous request/response cycles, appropriate for single-case demo scale (see `ARCHITECTURE.md` §Scaling Considerations).
