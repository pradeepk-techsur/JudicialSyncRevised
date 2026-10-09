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
