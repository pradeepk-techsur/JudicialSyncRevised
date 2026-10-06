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
