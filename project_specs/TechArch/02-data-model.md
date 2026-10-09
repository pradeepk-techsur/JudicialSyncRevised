
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

    -- added Phase 8 (F11): lightweight finalization-request notification.
    -- Set by POST /api/jury-package/:id/request-finalization (a role
    -- outside F20's finalize-authorized set asking one that is to
    -- finalize). Purely additive metadata — confers no authority, bypasses
    -- no gate, writes no ledger event. At most one outstanding request is
    -- tracked per package; a new request overwrites the prior one. Cleared
    -- automatically (set back to NULL) in the same transaction as a
    -- successful finalize. See §3.11 Phase 8 Schema Changes.
    finalization_requested_at  TIMESTAMPTZ,
    finalization_requested_by  UUID REFERENCES users(id),

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

**Finalization Request note (Phase 8, F11):** `finalization_requested_at`/`finalization_requested_by` model a single outstanding "please finalize this" notification per package — not a queue, not a new ledger event type, and not a new table. This is a deliberate scope choice: unlike every other write domain in this schema (status, objections, custody), a finalization request carries no authority of its own — F5's discrepancy gate and F20's role matrix are completely unaffected by its presence or absence — so it does not warrant append-only/immutable ledger treatment. A new request simply overwrites the previous one (`UPDATE`, not `INSERT`); a successful `finalizeJuryPackage` clears both columns to `NULL` in the same transaction as the write that sets `status = 'FINALIZED'`. See `01-components.md` §2.2 (`services/juryPackage.ts#requestFinalization`) and `03-api.md` §4.7.

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

### 3.11 Phase 8 Schema Changes (Migration Required)

Phase 8 (F08, F09, F10, F11, F24, and the dark-dashboard visual redesign) is overwhelmingly a UI-layer and read-time-derivation phase. Exactly **one** feature — F11 — requires a schema change, and every other feature is listed explicitly below so that "no schema change" is a confirmed, auditable fact for each, not a silent omission:

| Change | Table/Enum | Required by | Migration? |
|---|---|---|---|
| Two new nullable columns `finalization_requested_at` (`TIMESTAMPTZ`), `finalization_requested_by` (`UUID REFERENCES users(id)`) | `jury_packages` | F11 ("Request finalization from Clerk") | **Yes** — `ALTER TABLE ... ADD COLUMN` ×2, both nullable, no backfill needed (every existing row correctly has no outstanding request) |
| *(no schema change)* | — | F08 (per-status counts, custody-by-custodian, attention feed) | **No** — `statusCounts` is computed from `exhibit_current_state` data the activity endpoint already fetches; `getCustodyByCustodian`/`getAttentionFeed` are new read-only aggregation functions over `custody_current_state`, `discrepancy_flags`, `objection_current_state`, `jury_package_exhibits` — all already indexed (§3.8) — no new table, column, or index |
| *(no schema change)* | — | F09 (jury-package eligibility column) | **No** — `juryPackageEligibility` is derived at read time from existing `jury_package_exhibits` rows via a left-join already described in `01-components.md` §2.2; no new column on `exhibits` or anywhere else |
| *(no schema change)* | — | F10 (right-rail cards, header actions) | **No** — `objections[]`, `custodyCard`, `juryPackageChecklist` are read-time re-shapings of data `getExhibitHistory` (or the functions it already composes) already returns; the header's "Transfer custody" action invokes F03/F19's existing endpoints unchanged |
| *(no schema change)* | — | F24 (Record Ruling UI, Transfer/Assign Custody UI) | **No** — confirmed, by design, in both the FRD and this document: F24 is a pure UI surface over `recordRuling` (F02) and the custody propose/confirm/cancel/legacy-assign functions (F03/F19); it writes through existing `ExhibitEvent` types only, introduces no new event type, column, or table |
| *(no schema change)* | — | Dark-dashboard visual theming | **No** — a Carbon (`@carbon/react`) theme-token set plus component-level style overrides; a purely presentational change with no data-model surface whatsoever — see `05-tech-stack.md` §6.1a |

**Single-column migration:** the two `jury_packages` columns above land in one small Prisma migration for Phase 8 (e.g. `add_jury_package_finalization_request`). No other table in this document is touched by Phase 8 — in particular, `exhibits`, `exhibit_events`, every current-state projection table, `discrepancy_flags`, and `jury_package_exhibits` are all unchanged, since every other Phase 8 surface (F08, F09, F10, F24) is read-time derivation or UI-only wiring over data that already exists.
