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
