
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
