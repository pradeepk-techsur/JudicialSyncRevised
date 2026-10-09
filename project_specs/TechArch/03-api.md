
## 4. API Design

All endpoints are thin REST wrappers around the service layer (`01-components.md` §2.2) — route handlers parse the request, extract `requestingUserRole`/`actorUserId` from the session/role-switcher context, call exactly one service function, and shape the response. No route contains business logic beyond this. The Pivota Assistant's tools call the identical underlying service functions as **in-process function calls**, not HTTP round-trips to these routes — but the request/response shapes below describe the same contract both consumers rely on.

Every endpoint applies role-based visibility (`00-header.md` §Role-Based Visibility in the FRD) uniformly: sealed exhibits are excluded from results, and direct reads of a sealed exhibit by an unauthorized role return a **404** (not 403) so existence is never leaked.

### 4.1 Shared TypeScript Types

```typescript
// Shared enums — mirror the Postgres enum types 1:1
type Role = 'JUDGE' | 'CHAMBERS_STAFF' | 'DEPUTY' | 'CLERK' | 'ATTORNEY' | 'ADMIN';
type OfferingParty = 'PLAINTIFF' | 'PROSECUTION' | 'DEFENSE';
type ExhibitStatus = 'MARKED' | 'OFFERED' | 'OBJECTED' | 'ADMITTED' | 'EXCLUDED' | 'WITHDRAWN';
type ExhibitClassification = 'TRIAL' | 'CHAMBERS_EX_PARTE' | 'SEALED'; // added Phase 7.1 (F16)
type ObjectionStatus = 'UNRESOLVED' | 'SUSTAINED' | 'OVERRULED';
type RulingDisposition = 'SUSTAINED' | 'OVERRULED' | 'RESERVED';
type EventType =
  | 'STATUS_CHANGE'
  | 'OBJECTION_RAISED'
  | 'RULING_RECORDED'
  | 'CUSTODY_TRANSFER' // legacy unilateral transfer; retained only for the F18 intake-bootstrap path as of Phase 7.1 (F19)
  | 'DISCREPANCY_ACKNOWLEDGED'
  | 'JURY_PACKAGE_EXHIBIT_EXCLUDED' // added Phase 7 (F13)
  | 'CUSTODY_TRANSFER_PROPOSED'   // added Phase 7.1 (F19)
  | 'CUSTODY_TRANSFER_CONFIRMED'  // added Phase 7.1 (F19)
  | 'CUSTODY_TRANSFER_CANCELLED'; // added Phase 7.1 (F19)
type DiscrepancyStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
type JuryPackageStatus = 'DRAFT' | 'FINALIZED';
type JuryExhibitDiscrepancyStatus = 'CLEAN' | 'FLAGGED';
type JuryPackageExhibitStatus = 'INCLUDED' | 'EXCLUDED'; // added Phase 7 (F13)
type JuryPackageEligibility = 'INCLUDED' | 'NOT_ELIGIBLE' | 'BLOCKED'; // added Phase 8 (F09/F10) — derived, never stored
type AttentionFeedTier = 'CRITICAL' | 'HIGH' | 'PENDING' | 'MEDIUM'; // added Phase 8 (F08)
type AttentionFeedAction = 'RECORD_RULING' | 'REMOVE_FROM_PACKAGE' | 'TRANSFER_CUSTODY' | null; // added Phase 8 (F08)

interface Case {
  // Added Phase 7.1 (F22)
  id: string;
  caseNumber: string;
  title: string;
  court: string;
  createdAt: string;
}

interface Exhibit {
  id: string;
  caseId: string;
  exhibitLabel: string;
  description: string;
  source: string | null;
  offeringParty: OfferingParty;
  associatedWitness: string | null;
  // Added Phase 7.1 (F16): required at creation, immutable thereafter — no
  // update endpoint exists. isSealed is retained below for backward
  // compatibility with every existing read path but is now a write-once
  // mirror set exactly once at creation as (classification !== 'TRIAL');
  // a client-supplied isSealed value in POST /api/exhibits is ignored.
  classification: ExhibitClassification;
  isSealed: boolean;
  createdAt: string; // ISO 8601
}

interface ExhibitEvent {
  id: string;
  exhibitId: string;
  caseId: string;
  eventType: EventType;
  payload: Record<string, unknown>; // discriminated by eventType, see 02-data-model.md §3.3
  actorUserId: string;
  sequenceNo: number;
  recordedAt: string;
}

interface ExhibitCurrentState {
  exhibitId: string;
  currentStatus: ExhibitStatus;
  lastStatusEventId: string;
  lastStatusAt: string;
}

interface ObjectionCurrentState {
  objectionId: string;
  exhibitId: string;
  status: ObjectionStatus;
  objectingParty: OfferingParty;
  grounds: string;
  raisedEventId: string;
  raisedAt: string;
  rulingEventId: string | null;
  ruledAt: string | null;
}

interface CustodyCurrentState {
  exhibitId: string;
  currentCustodianUserId: string;
  since: string;
  lastEventId: string;
  // Added Phase 7.1 (F19): non-null only while a CUSTODY_TRANSFER_PROPOSED
  // event is awaiting its resolving CONFIRMED/CANCELLED event.
  // currentCustodianUserId is never modified while this is non-null.
  pendingTransfer: { toUserId: string; proposedAt: string; eventId: string } | null;
}

interface DiscrepancyFlag {
  id: string;
  caseId: string;
  exhibitId: string;
  ruleCode: string;
  status: DiscrepancyStatus;
  detectedAt: string;
  details: Record<string, unknown>;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  // Added Phase 7 (F14): additive read-time join from acknowledgedEventId
  // to the backing DISCREPANCY_ACKNOWLEDGED event's payload.justification —
  // present only when status === 'ACKNOWLEDGED'; no schema/write change.
  justification?: string;
  resolvedAt?: string;
}

interface JuryPackage {
  id: string;
  caseId: string;
  status: JuryPackageStatus;
  createdAt: string;
  finalizedAt?: string;
  finalizedBy?: string;
  // Added Phase 7.1 (F23): assigned ONLY at finalization
  // (MAX(version) for this case's FINALIZED packages, + 1, or 1 if none
  // exist); never reassigned afterward; null while DRAFT.
  version: number | null;
  // Added Phase 8 (F11): purely additive notification metadata — set by
  // POST /api/jury-package/:id/request-finalization, cleared to undefined
  // (null at the DB level) by a successful finalize. Confers no authority
  // and does not gate finalization; see 02-data-model.md's Finalization
  // Request note (§3.6) and 04-security.md §5.2.2a (unaffected by this).
  finalizationRequestedAt?: string;
  finalizationRequestedBy?: string;
}

// Added Phase 7.1 (F23).
interface JuryPackageVersionSummary {
  id: string;
  version: number | null;
  status: JuryPackageStatus;
  finalizedAt?: string;
  finalizedBy?: string;
  exhibitCount: number;
  isMostRecent: boolean; // computed at read time (MAX(version) per case), never stored
}

interface JuryPackageExhibit {
  exhibitId: string;
  exhibitLabel: string;
  currentStatus: ExhibitStatus;
  discrepancyStatus: JuryExhibitDiscrepancyStatus;
  addedAt: string;
  // Added Phase 7 (F13) — defaults to INCLUDED for rows predating this
  // migration; see 02-data-model.md §3.9. GET /api/cases/:id/jury-package's
  // default response includes only status === 'INCLUDED' rows.
  status: JuryPackageExhibitStatus;
  excludedAt?: string;
  excludedBy?: string;
  exclusionReason?: 'SEALED_EXPARTE' | 'MANUAL_REMOVAL';
}

interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

// Added Phase 7 (F12) — the ADMISSION_BLOCKED error shape, returned only
// when a status-transition request attempts toStatus = ADMITTED and at
// least one blocking condition applies. See 04-security.md and
// 06-integrations.md §Admission Gate.
interface AdmissionBlockedError {
  error: {
    code: 'ADMISSION_BLOCKED';
    message: string;
    reasons: Array<{
      code: 'UNRESOLVED_OBJECTION' | 'NO_CUSTODIAN';
      message: string;
    }>;
  };
}

// Added Phase 7.1 (F18) — returned only when a status-transition request is
// the exhibit's first-ever STATUS_CHANGE event (toStatus = MARKED) with a
// missing or invalid custodianUserId. See 04-security.md §5.2.2a and
// 06-integrations.md §Intake Custody Gate.
interface CustodianRequiredAtIntakeError {
  error: {
    code: 'CUSTODIAN_REQUIRED_AT_INTAKE';
    message: string;
  };
}

// Added Phase 7.1 (F20) — the uniform shape for every write action's
// server-side role rejection. Message varies per action per the Permission
// Matrix (04-security.md §5.2.2a); the code is always ROLE_NOT_PERMITTED.
interface RoleNotPermittedError {
  error: {
    code: 'ROLE_NOT_PERMITTED';
    message: string;
  };
}

// Composite row shape returned by GET /api/cases/:id/exhibits and
// GET /api/cases/:id/exhibits/search — avoids a second round-trip per row.
interface ExhibitListRow {
  exhibitId: string;
  exhibitLabel: string;
  description: string;
  offeringParty: OfferingParty;
  associatedWitness: string | null;
  currentStatus: ExhibitStatus | null; // null = no STATUS_CHANGE event yet
  currentCustodianName: string | null;
  discrepancyFlags: DiscrepancyFlag[];
  // Added Phase 8 (F09): derived at read time from the case's most-recently-
  // computed JuryPackage's JuryPackageExhibit rows — precedence: INCLUDED
  // row + CLEAN -> INCLUDED; INCLUDED row + FLAGGED -> BLOCKED; no row, or
  // an EXCLUDED row -> NOT_ELIGIBLE. Never independently re-derived; must
  // always match what GET /api/cases/:id/jury-package itself shows for the
  // same exhibit (F09 §Validation).
  juryPackageEligibility: JuryPackageEligibility;
}

// Added Phase 8 (F10) — the Jury Package checklist card's per-condition
// breakdown for a single exhibit; eligibility uses the identical precedence
// rule ExhibitListRow.juryPackageEligibility applies at list-row scale.
interface JuryPackageChecklist {
  admitted: boolean;
  objectionsResolved: boolean;
  custodianOnRecord: boolean;
  classificationTrial: boolean;
  eligibility: JuryPackageEligibility;
}

// Added Phase 8 (F10) — the Chain of Custody card's data shape; re-shapes
// the same CustodyCurrentState/CustodyHistoryEntry data F03/F19 already
// serve elsewhere, no new query.
interface CustodyCard {
  current: CustodyCurrentState | null;
  pendingTransfer: { toUserId: string; toName: string; proposedAt: string } | null;
  history: CustodyHistoryEntry[];
}

// Added Phase 8 (F08) — one entry in the Command Center's severity-ranked
// "Needs your attention" feed. `availableAction` is null only for the
// CRITICAL tier's link-through case (F13's existing exclusion remediation);
// it is never null for HIGH/PENDING/MEDIUM.
interface AttentionFeedEntry {
  id: string;
  tier: AttentionFeedTier;
  ruleCode: string;
  exhibitId: string;
  exhibitLabel: string;
  objectionId?: string;
  detectedAt: string;
  summary: string;
  availableAction: AttentionFeedAction;
}

// Added Phase 8 (F08) — one grouping in the Command Center's "Custody at a
// Glance" panel. pendingTransfersIn surfaces exhibits with a currently-
// pending (unconfirmed, F19) transfer TO this custodian as a distinct
// grouping, rather than folding them into the current-custodian bucket.
interface CustodyByCustodianEntry {
  custodianUserId: string;
  custodianName: string;
  exhibits: Array<{ exhibitId: string; exhibitLabel: string; currentStatus: ExhibitStatus }>;
  pendingTransfersIn: Array<{ exhibitId: string; exhibitLabel: string; proposedAt: string }>;
}
```

### 4.1a Cases (F0, F22 — added Phase 7.1)

| Method & Path | Description | Request Body / Query | Response | Errors |
|---|---|---|---|---|
| `GET /api/cases` *(added Phase 7.1, F22)* | Lists every case available to the current user | — | `200 Case[]` | — (no role restriction; case existence is not the sensitive boundary) |
| `GET /api/cases/:id` *(amended Phase 7.1, F22: replaces the prior no-argument `GET /api/case`)* | Fetches a specific case plus its user roster (app bootstrap) | — | `200 { case: Case, users: User[] }` (identical shape to the prior `GET /api/case` response) | `CASE_NOT_FOUND` 404 |

**Active-case model (F22):** the "active case" is a per-request, client-selected `caseId` — never a server-side session value — carried on every subsequent case-scoped request exactly as `requestingUserRole` already is. `services/cases.ts#getActiveCaseWithUsers` evolves from a no-argument, implicit-`DEMO_CASE_NUMBER` form to an explicit `getActiveCaseWithUsers(caseId)` (see `01-components.md` §2.2). On first load with no previously-selected `caseId`, the client defaults to the first case by `createdAt` ascending — preserving the prior single-case demo script's zero-interaction behavior.

### 4.2 Exhibits & History (F0, F9, F10)

| Method & Path | Description | Request Body / Query | Response | Errors |
|---|---|---|---|---|
| `POST /api/exhibits` | Create exhibit identity record | `{ caseId, exhibitLabel, description, source?, offeringParty, associatedWitness?, classification }` *(amended Phase 7.1, F16: `classification` is now required — `TRIAL` \| `CHAMBERS_EX_PARTE` \| `SEALED`; a client-supplied `isSealed` value, if present, is ignored — the server always derives it from `classification`)* | `201 Exhibit` (now includes `classification` and a classification-derived `isSealed`) | `EXHIBIT_LABEL_CONFLICT` 409, `VALIDATION_ERROR` 422, `CLASSIFICATION_REQUIRED` 422 *(added Phase 7.1, F16)*, `INVALID_CLASSIFICATION` 422 *(added Phase 7.1, F16)*, `ROLE_NOT_PERMITTED` 403 *(added Phase 7.1, F20: only `DEPUTY`, `CLERK`, `ADMIN`)* |
| `GET /api/exhibits/:id` | Fetch single exhibit identity | — | `200 Exhibit` | `EXHIBIT_NOT_FOUND` 404 |
| `GET /api/cases/:id/exhibits` | List all visible exhibits for a case | — (unfiltered; use search for filters) | `200 ExhibitListRow[]` *(amended Phase 8, F09: `juryPackageEligibility` added — see §4.1)* | `CASE_NOT_FOUND` 404 |
| `GET /api/exhibits/:id/history` | Full chronological event timeline | — | `200 ExhibitHistoryResponse` (below) *(amended Phase 8, F10: `objections[]`, `custodyCard`, `juryPackageChecklist` added — all three are read-time projections of data already returned elsewhere in this response, no new query)* | `EXHIBIT_NOT_FOUND` 404 (also returned for sealed/unauthorized) |

```typescript
interface ExhibitHistoryResponse {
  exhibit: Exhibit;
  currentStatus: ExhibitStatus | null;
  currentCustodianName: string | null;
  discrepancyFlags: DiscrepancyFlag[];
  timeline: Array<{
    eventId: string;
    eventType: EventType;
    summary: string; // plain-language, e.g. "Status changed from Offered to Admitted"
    actorName: string;
    recordedAt: string;
  }>;
  // Added Phase 8 (F10) — this exhibit's UNRESOLVED ObjectionCurrentState
  // rows only (zero, one, or several concurrently — F02 permits N threads);
  // the full set, resolved and unresolved, remains visible via `timeline`
  // above, unchanged. Powers the Objection right-rail card's inline
  // "Record ruling" action (F24), each row carrying its own `objectionId`.
  objections: ObjectionCurrentState[];
  // Added Phase 8 (F10) — powers the Chain of Custody right-rail card.
  custodyCard: CustodyCard;
  // Added Phase 8 (F10) — powers the Jury Package checklist right-rail
  // card; `eligibility` uses the identical precedence rule F09's
  // ExhibitListRow.juryPackageEligibility applies at list-row scale.
  juryPackageChecklist: JuryPackageChecklist;
}
```

### 4.3 Status (F1)

| Method & Path | Description | Request Body | Response | Errors |
|---|---|---|---|---|
| `POST /api/exhibits/:id/events/status` | Record a status transition | `{ toStatus: ExhibitStatus, actorUserId, notes?, custodianUserId? }` *(amended Phase 7.1, F18: `custodianUserId` is required when, and only when, this is the exhibit's first-ever `STATUS_CHANGE` event, i.e. `toStatus = MARKED` with zero prior events — the status write and the resulting intake custody write are atomic, same transaction)* | `201 { event: ExhibitEvent, currentState: ExhibitCurrentState, custodyState?: CustodyCurrentState }` *(amended Phase 7.1, F18: `custodyState` is additionally returned when this call was the exhibit's first-ever transition)* | `INVALID_STATUS_TRANSITION` 422, `STATUS_FINALIZED` 409, `STATUS_CONFLICT` 409, `EXHIBIT_NOT_FOUND` 404, `ADMISSION_BLOCKED` 422 *(added Phase 7, F12 — returned as `AdmissionBlockedError` above; evaluated only when `toStatus = ADMITTED`, before any ledger write; hardened without new mechanism by Phase 7.1's F17 — see `06-integrations.md` §Admission Gate)*, `CUSTODIAN_REQUIRED_AT_INTAKE` 422 *(added Phase 7.1, F18 — returned as `CustodianRequiredAtIntakeError` above)*, `ROLE_NOT_PERMITTED` 403 *(added Phase 7.1, F20: `DEPUTY`, `CLERK`, `ADMIN` for every transition)* |
| `GET /api/exhibits/:id/status` | Current derived status | — | `200 ExhibitCurrentState` | `EXHIBIT_NOT_FOUND` 404 |

**Allowed transitions (state machine, enforced server-side):**

| From | To |
|---|---|
| *(none)* | `MARKED` |
| `MARKED` | `OFFERED` |
| `OFFERED` | `OBJECTED`, `ADMITTED`, `WITHDRAWN` |
| `OBJECTED` | `ADMITTED`, `EXCLUDED`, `WITHDRAWN` |

### 4.4 Objections & Rulings (F2)

| Method & Path | Description | Request Body | Response | Errors |
|---|---|---|---|---|
| `POST /api/exhibits/:id/events/objection` | Raise an objection | `{ objectingParty, grounds, actorUserId }` | `201 { event: ExhibitEvent, objectionState: ObjectionCurrentState }` | `INVALID_OBJECTION_TARGET` 422, `EXHIBIT_NOT_FOUND` 404, `ROLE_NOT_PERMITTED` 403 *(added Phase 7.1, F20: `ATTORNEY`, `DEPUTY`, `CLERK`, `ADMIN` — the one write action an `ATTORNEY` role is permitted to perform)* |
| `POST /api/objections/:id/ruling` | Record a ruling against an objection thread | `{ disposition: RulingDisposition, actorUserId }` | `201 { event: ExhibitEvent, objectionState: ObjectionCurrentState }` | `OBJECTION_NOT_FOUND` 404, `OBJECTION_ALREADY_RESOLVED` 409, `ROLE_NOT_PERMITTED` 403 (SUSTAINED/OVERRULED requires `JUDGE` role — unchanged by F20, now enforced via the shared `assertRole` helper) |
| `GET /api/cases/:id/objections?status=unresolved` | List objection threads, filterable | Query: `status?` | `200 Array<ObjectionCurrentState & { exhibitLabel: string }>` *(amended Phase 7.1, F21: additive read-time join of `exhibitLabel` — no schema change; powers the new judge-facing Pending-Ruling Queue screen's client-side sort by elapsed `raisedAt`, no new endpoint)* | `CASE_NOT_FOUND` 404 |

### 4.5 Custody (F3; significantly amended Phase 7.1, F19 — two-phase propose/confirm model)

| Method & Path | Description | Request Body | Response | Errors |
|---|---|---|---|---|
| `POST /api/exhibits/:id/events/custody` | Record a custody transfer. *(Amended Phase 7.1, F19: retained ONLY for the F18 intake-bootstrap case — `fromCustodianUserId: null`. Any call with a non-null `fromCustodianUserId` is rejected; use the propose/confirm endpoints below for every transfer after the first.)* | `{ fromCustodianUserId?, toCustodianUserId, reason?, actorUserId }` | `201 { event: ExhibitEvent, custodyState: CustodyCurrentState }` | `CUSTODY_CHAIN_BROKEN` 409, `INVALID_CUSTODIAN` 422, `NO_OP_TRANSFER` 422, `EXHIBIT_NOT_FOUND` 404, `CUSTODY_TRANSFER_REQUIRES_CONFIRMATION` 409 *(added Phase 7.1, F19: non-first transfer attempted via this unilateral path)* |
| `POST /api/exhibits/:id/events/custody/propose` *(added Phase 7.1, F19)* | Initiates a two-phase custody transfer — does **not** change current custody | `{ fromCustodianUserId, toCustodianUserId, reason?, actorUserId }` | `201 { event: ExhibitEvent, custodyState: CustodyCurrentState }` (`custodyState.pendingTransfer` now set; `currentCustodianUserId` unchanged) | `CUSTODY_CHAIN_BROKEN` 409, `INVALID_CUSTODIAN` 422, `NO_OP_TRANSFER` 422, `CUSTODY_TRANSFER_ALREADY_PENDING` 409, `ROLE_NOT_PERMITTED` 403 (`DEPUTY`, `CLERK`, `ADMIN`), `EXHIBIT_NOT_FOUND` 404 |
| `POST /api/exhibits/:id/events/custody/confirm` *(added Phase 7.1, F19)* | Completes a pending custody transfer — callable **only** by the named receiving custodian | `{ proposedEventId, actorUserId }` | `200 { event: ExhibitEvent, custodyState: CustodyCurrentState }` (`currentCustodianUserId` updated; `pendingTransfer` cleared to `null`) | `CUSTODY_CONFIRMATION_NOT_PENDING` 404, `CUSTODY_CONFIRM_WRONG_USER` 403 (identity match — independent of, and in addition to, the role check below), `ROLE_NOT_PERMITTED` 403 (`DEPUTY`, `CLERK`, `ADMIN`), `EXHIBIT_NOT_FOUND` 404 |
| `POST /api/exhibits/:id/events/custody/cancel` *(added Phase 7.1, F19)* | Cancels a pending custody transfer — current custody is unaffected (it never changed) | `{ proposedEventId, reason?, actorUserId }` | `200 { event: ExhibitEvent, custodyState: CustodyCurrentState }` (`pendingTransfer` cleared) | `CUSTODY_CONFIRMATION_NOT_PENDING` 404, `ROLE_NOT_PERMITTED` 403 (original proposer, or `DEPUTY`/`CLERK`/`ADMIN`), `EXHIBIT_NOT_FOUND` 404 |
| `GET /api/exhibits/:id/custodian` | Current custodian only | — | `200 CustodyCurrentState` *(amended Phase 7.1, F19: now additionally includes `pendingTransfer: { toUserId, proposedAt, eventId } \| null`, see §4.1)* | `EXHIBIT_NOT_FOUND` 404 |
| `GET /api/exhibits/:id/custody-history` | Full ordered chain-of-custody | — | `200 CustodyHistoryEntry[]` *(amended Phase 7.1, F19: now includes `CUSTODY_TRANSFER_PROPOSED`/`CONFIRMED`/`CANCELLED` events, distinguished by `eventType`, so a cancelled/superseded proposal remains visible in history)* | `EXHIBIT_NOT_FOUND` 404 |

```typescript
interface CustodyHistoryEntry {
  fromCustodian: string | null;
  toCustodian: string;
  timestamp: string;
  reason: string | null;
  eventId: string;
  eventType: EventType; // added Phase 7.1 (F19) — distinguishes PROPOSED/CONFIRMED/CANCELLED/legacy entries
}
```

**Two-phase model summary (F19):** a proposal (`propose`) never changes `currentCustodianUserId` — only the named receiver's own `confirm` call does. A `cancel` reverts a pending state with no effect on current custody, since it was never changed in the first place. There is no time-based auto-expiry of a pending transfer (consistent with this architecture's queue-free, synchronous-only write model, `06-integrations.md`) — an indefinitely-pending transfer is resolved only by an explicit `confirm` or `cancel` call.

### 4.5a Write-Action UI Coverage (F24, added Phase 8)

**Introduces no new endpoints.** F24 (Record Ruling UI, Transfer/Assign Custody UI) is the first UI surface for two endpoints already fully defined above: `POST /api/objections/:id/ruling` (§4.4, F02) and `POST /api/exhibits/:id/events/custody` / `/propose` / `/confirm` / `/cancel` (§4.5, F03/F19). F24 adds no new request field, no new response field, and no new error code — every response shape and every error in §4.4/§4.5 is unchanged; the only thing that changes is that a real UI now calls them, from two originating screens:

- **Command Center attention feed (F08):** tiers `HIGH`/`PENDING` entries carry a "Record ruling" inline action (passing that entry's specific `objectionId`); a `MEDIUM` entry carries a "Transfer custody"/"Assign custodian" inline action.
- **Exhibit Detail right rail (F10):** the Objection card's inline "Record ruling" per unresolved thread; the header's "Transfer custody" action, plus "Confirm receipt"/"Cancel pending transfer" controls shown only when a pending transfer exists for that exhibit.

Both actions require an explicit confirmation step before submission (no inline action auto-submits on selection alone) and render only for a role the F20 Permission Matrix (`04-security.md` §5.2.2a) permits for that specific action — an unauthorized role does not see a disabled control, it sees no control at all. A successful submission triggers a scoped refetch of only the originating screen's affected query (never a full-page reload); a failed submission surfaces the specific rejection reason inline, matching the reject-with-reason pattern established by F12/F17/F18. See `01-components.md` §2.1 (`RecordRulingAction`, `TransferCustodyAction`) and §2.5 rule 10.

### 4.6 Search (F4)

| Method & Path | Description | Query Params | Response | Errors |
|---|---|---|---|---|
| `GET /api/cases/:id/exhibits/search` | Multi-criteria combinable (AND) search | `keyword?, status?, witness?, dateFrom?, dateTo?` | `200 ExhibitListRow[]` *(amended Phase 8, F09: includes `juryPackageEligibility`, identical to the unfiltered list — same row shape, same derivation)* | `EMPTY_SEARCH_CRITERIA` 422, `INVALID_DATE_RANGE` 422, `VALIDATION_ERROR` 422 |

```typescript
interface SearchExhibitsCriteria {
  caseId: string;
  keyword?: string;        // substring match: exhibitLabel, description, source
  status?: ExhibitStatus;
  witness?: string;
  dateFrom?: string;       // ISO 8601
  dateTo?: string;         // ISO 8601
  requestingUserRole: Role; // derived from session, not user-supplied
}
```

### 4.7 Jury Package (F5)

| Method & Path | Description | Request Body | Response | Errors |
|---|---|---|---|---|
| `POST /api/cases/:id/jury-package` | Compute/refresh draft jury-eligible set | `{ actorUserId }` | `201 { juryPackage: JuryPackage, exhibits: JuryPackageExhibit[] }` | `NO_ELIGIBLE_EXHIBITS` 422, `ROLE_NOT_PERMITTED` 403 |
| `GET /api/cases/:id/jury-package` | Fetch current package with live discrepancy status | — | `200 { juryPackage: JuryPackage, exhibits: JuryPackageExhibit[] }` — `exhibits[]` includes only `status: 'INCLUDED'` rows by default *(amended Phase 7, F13: `EXCLUDED` rows are retained for audit but omitted from this default read)*. `juryPackage.version` is `null` while `DRAFT` *(added Phase 7.1, F23)*. `juryPackage` additionally includes `finalizationRequestedAt`/`finalizationRequestedBy` *(added Phase 8, F11)*, both `undefined`/`null` if no request is currently outstanding | `CASE_NOT_FOUND` 404 |
| `POST /api/jury-package/:id/finalize` | Attempt finalization — hard-gated, re-evaluated fresh | `{ actorUserId, acknowledgedDiscrepancyIds? }` | `200 { juryPackage: JuryPackage }` (status: `FINALIZED`, `version: number`) *(amended Phase 7.1, F23: `version` is now assigned atomically at finalization — never client-supplied)*. `finalizationRequestedAt`/`finalizationRequestedBy`, if previously set, are cleared in the same transaction *(added Phase 8, F11)* | `JURY_PACKAGE_DISCREPANCIES_OPEN` 409 (includes blocking list), `JURY_PACKAGE_ALREADY_FINALIZED` 409, `ROLE_NOT_PERMITTED` 403 |
| `POST /api/jury-package/:id/request-finalization` *(added Phase 8, F11)* | Records a lightweight notification asking a finalize-authorized role to finalize the current draft — confers no authority and bypasses no gate | `{ actorUserId }` | `200 { juryPackage: JuryPackage }` (`finalizationRequestedAt`, `finalizationRequestedBy` set) | `ROLE_NOT_PERMITTED` 403 (a finalize-authorized role — `DEPUTY`/`CLERK`/`ADMIN` — attempting to request rather than finalize directly), `JURY_PACKAGE_ALREADY_FINALIZED` 409 |

`actorUserId` must resolve to role `DEPUTY`, `CLERK`, or `ADMIN` to initiate or finalize. Finalization re-runs `evaluateDiscrepancies` fresh for every included exhibit — never trusting the cached `discrepancyStatus` captured at draft-computation time. Only `status: 'INCLUDED'` rows participate in finalization *(amended Phase 7, F13)* — an `EXCLUDED` row can never block or be counted toward it. The request-finalization action (F11) is purely additive metadata: it never blocks, gates, or substitutes for the discrepancy check above — a zero-Blockers package can still be finalized directly whether or not a request is outstanding, and a package with open Blockers remains unfinalizable regardless of how many requests have been made.

**Amended Phase 7 (F13); amended again Phase 7.1 (F16):** the candidate computation behind `POST /api/cases/:id/jury-package` originally filtered `exhibit.isSealed = false` at the query level, in addition to `currentStatus = 'ADMITTED'`. **As of Phase 7.1, this filter reads `exhibit.classification = 'TRIAL'` instead** — see `01-components.md` §2.2 and `02-data-model.md` §3.6/§3.10. This remains a behavior amendment to the existing endpoint, not a new route.

### 4.7b Jury Package Versions & Export (F23, added Phase 7.1)

| Method & Path | Description | Request / Response | Errors |
|---|---|---|---|
| `GET /api/cases/:id/jury-package/versions` | Lists every `JuryPackage` for the case — every `FINALIZED` version plus the current `DRAFT`, if one exists | `200 JuryPackageVersionSummary[]` (see §4.1) | `CASE_NOT_FOUND` 404 |
| `GET /api/jury-package/:id/export` | Generates and streams a PDF (via `@react-pdf/renderer`) of a specific `FINALIZED` package version's included exhibit set | Response: binary `application/pdf` stream, not JSON | `JURY_PACKAGE_EXPORT_NOT_FINALIZED` 422 (a `DRAFT` has no version to export — finalize first), `JURY_PACKAGE_VERSION_NOT_FOUND` 404, `PDF_GENERATION_FAILED` 500 |

Because a `FINALIZED` package's `JuryPackageExhibit` rows are immutable, re-exporting the same version at any later date always produces an identical PDF (same exhibit set, same classification/status snapshot) — the export is deterministic per version, not re-computed against the exhibits' *current* live state. `EXCLUDED` rows are never rendered into the export, exactly as they are never rendered into the live `INCLUDED` list (F13). See `01-components.md` §2.2 (`services/juryPackage.ts#exportJuryPackagePdf`) and `05-tech-stack.md` §6.4 for the new `@react-pdf/renderer` dependency.

### 4.7a Jury Package Exclusion (F13, added Phase 7)

| Method & Path | Description | Request Body | Response | Errors |
|---|---|---|---|---|
| `POST /api/jury-package/:id/exhibits/:exhibitId/exclude` | Explicitly excludes an `INCLUDED` exhibit row from a `DRAFT` jury package (remediation action for sealed/ex-parte material predating the F13 filter, or any other manual-removal need); recorded as an auditable `JURY_PACKAGE_EXHIBIT_EXCLUDED` ledger event | `{ actorUserId, reason: 'SEALED_EXPARTE' \| 'MANUAL_REMOVAL', note? }` | `200 { event: ExhibitEvent, juryPackageExhibit: JuryPackageExhibit }` (status: `EXCLUDED`) | `JURY_PACKAGE_EXHIBIT_NOT_FOUND` 404, `JURY_PACKAGE_ALREADY_FINALIZED` 409, `ROLE_NOT_PERMITTED` 403 |

`actorUserId` must resolve to role `DEPUTY`, `CLERK`, or `ADMIN` — identical to the finalize role gate (`04-security.md` §5.2.2). Available only against a row currently `status: 'INCLUDED'` on a `DRAFT` package — a `FINALIZED` package's rows are immutable and cannot be excluded via this action.

### 4.8 Discrepancies (F6)

| Method & Path | Description | Request Body | Response | Errors |
|---|---|---|---|---|
| `GET /api/cases/:id/discrepancies` | All open/acknowledged flags case-wide | — | `200 DiscrepancyFlag[]` — flags with `status: 'ACKNOWLEDGED'` additionally include `justification` *(added Phase 7, F14 — see §4.1)* | `CASE_NOT_FOUND` 404 |
| `GET /api/exhibits/:id/discrepancies` | Flags for a single exhibit | — | `200 DiscrepancyFlag[]` — same `justification` addition as above *(F14)* | `EXHIBIT_NOT_FOUND` 404 |
| `POST /api/discrepancies/:id/acknowledge` | Explicitly acknowledge an open flag | `{ actorUserId, justification }` | `200 { event: ExhibitEvent, discrepancyFlag: DiscrepancyFlag }` (idempotent) | `JUSTIFICATION_REQUIRED` 422, `DISCREPANCY_NOT_FOUND` 404, `ROLE_NOT_PERMITTED` 403 |

### 4.9 Command Center (F8; significantly expanded Phase 8 — per-status counts, custody-by-custodian, attention feed)

| Method & Path | Description | Query Params | Response | Errors |
|---|---|---|---|---|
| `GET /api/cases/:id/activity` | Recent-activity feed | `since?` (ISO 8601, default: start of current trial day) | `200 { recentActivity: RecentActivityEntry[], statusCounts: Record<ExhibitStatus, number> }` *(amended Phase 8, F08: `statusCounts` added — per-status exhibit count breakdown, computed from existing `ExhibitCurrentState` data the function already has access to; no new query path, no new endpoint)* | `VALIDATION_ERROR` 422, `COMMAND_CENTER_LOAD_FAILED` 500 |
| `GET /api/cases/:id/custody-by-custodian` *(added Phase 8, F08)* | Exhibits grouped by current custodian, for the "Custody at a Glance" panel. Did not exist as a service or endpoint prior to this phase | — | `200 CustodyByCustodianEntry[]` (see §4.1) | `COMMAND_CENTER_LOAD_FAILED` 500 *(reuses the existing generic code — no new code introduced for this endpoint)* |
| `GET /api/cases/:id/attention-feed` *(added Phase 8, F08)* | Severity-ranked "Needs your attention" feed combining four discrepancy/objection rule sources into one prioritized list. Did not exist prior to this phase | — | `200 AttentionFeedEntry[]` (see §4.1) — ordered `CRITICAL` > `HIGH` > `PENDING` > `MEDIUM`, newest-first within each tier; see `01-components.md` §2.2 (`services/activity.ts#getAttentionFeed`) for the exact rule-to-tier mapping | `ATTENTION_FEED_LOAD_FAILED` 500 |

```typescript
interface RecentActivityEntry {
  eventId: string;
  eventType: EventType;
  exhibitId: string;
  exhibitLabel: string;
  summary: string;
  recordedAt: string;
}
```

Command Center also composes `GET /api/cases/:id/objections?status=unresolved` (§4.4) and `GET /api/cases/:id/discrepancies` (§4.8) client-side — no server-side aggregation endpoint beyond the three above is required. Inline actions on attention-feed entries invoke F24's unchanged endpoints (§4.5a) — this screen introduces no parallel or abbreviated validation path of its own; every inline action resolves to the exact same server-side endpoint and validation F24/F02/F03/F19/F20 specify.

**Severity Tier precedence (F08):** `CRITICAL` (sealed/ex-parte blocker in jury package — a legacy/regression state per F13; links through to F13's existing exclusion remediation, no new inline action) > `HIGH` (admitted exhibit with an open `UNRESOLVED_OBJECTION_JURY_ELIGIBLE` discrepancy — inline "Record ruling") > `PENDING` (unresolved objection on a not-yet-`ADMITTED` exhibit — inline "Record ruling") > `MEDIUM` (admitted exhibit with an open `ADMITTED_NO_CUSTODIAN` discrepancy — inline "Transfer custody"/"Assign custodian"). An objection thread is never counted in both `HIGH` and `PENDING` simultaneously — the exhibit's `currentStatus` at evaluation time is the sole disambiguator (`01-components.md` §2.5 rule 11).

### 4.10 Pivota Assistant (F7)

| Method & Path | Description | Request Body | Response | Errors |
|---|---|---|---|---|
| `POST /api/assistant/chat` | Streaming tool-calling chat (Vercel AI SDK `streamText`) | `{ caseId, userId, message, conversationId? }` *(`caseId` as of Phase 7.1, F22, is sourced from the client's explicit Case Selector state, not an implicit single-case constant — the field itself is unchanged, only its origin)* | Streamed text (SSE/chunked) + final structured payload incl. `citations[]` | `TOOL_ARGS_INVALID` (tool-level, surfaced to model), `ASSISTANT_UNAVAILABLE` 503 |
| `GET /api/assistant/conversations/:id` | Retrieve persisted conversation + citations (audit/replay) | — | `200 ConversationDetail` | `CONVERSATION_NOT_FOUND` 404 |

```typescript
interface AssistantChatRequest {
  caseId: string;
  userId: string;
  message: string;
  conversationId?: string;
}

interface Citation {
  recordType: 'ExhibitEvent' | 'DiscrepancyFlag' | 'JuryPackageExhibit';
  recordId: string;
  timestamp: string;
  label: string; // human-readable, e.g. "Status change recorded Oct 6, 2026 2:14pm"
}

interface ConversationDetail {
  conversation: { id: string; caseId: string; userId: string; startedAt: string };
  messages: Array<{
    id: string;
    role: 'USER' | 'ASSISTANT';
    content: string;
    createdAt: string;
    citations: Citation[];
  }>;
}

// Tool definitions (server-side only; AI SDK `tool()` + zod schemas).
// Each tool is a 1:1 pass-through to the identically-named service
// function — see 01-components.md §2.3.
interface AssistantToolSet {
  getExhibitStatus(args: { exhibitId: string }): Promise<ExhibitCurrentState | null>;
  getUnresolvedObjections(args: { caseId: string }): Promise<ObjectionCurrentState[]>;
  getCustodian(args: { exhibitId: string }): Promise<CustodyCurrentState | null>;
  getCustodyHistory(args: { exhibitId: string }): Promise<CustodyHistoryEntry[]>;
  getExhibitHistory(args: { exhibitId: string }): Promise<ExhibitHistoryResponse | null>;
  searchExhibits(args: SearchExhibitsCriteria): Promise<ExhibitListRow[]>;
  getJuryPackageStatus(args: { caseId: string; exhibitId?: string }): Promise<{
    juryPackage: JuryPackage;
    exhibits: JuryPackageExhibit[];
  }>;
  getDiscrepancies(args: { caseId: string; exhibitId?: string }): Promise<DiscrepancyFlag[]>;
}
```

Each tool in `AssistantToolSet` is implemented against the exact same service-layer function backing the corresponding REST route above — e.g., `getExhibitStatus` the tool and `GET /api/exhibits/:id/status` the route both call `services/status.ts#getExhibitStatus(exhibitId)`. This 1:1 mapping is what structurally guarantees cross-screen/assistant consistency rather than relying on manual testing alone. Because of this mapping, the Phase 7 amendments above propagate automatically: `getJuryPackageStatus` never returns an `EXCLUDED` row as included/eligible (F13), and `getDiscrepancies` surfaces `justification` on `ACKNOWLEDGED` flags identically to the UI (F14) — no tool definition changed. **Phase 8 propagates the same way:** `searchExhibits` now returns `juryPackageEligibility` per row (F09) and `getExhibitHistory` now returns `objections[]`/`custodyCard`/`juryPackageChecklist` (F10) without any tool definition changing, since both tools wrap the identical `services/exhibits.ts` functions the amended UI routes call. **F08's new `getCustodyByCustodian`/`getAttentionFeed` and F24's two write actions are not exposed as assistant tools** — the fixed ≤8-tool set (`01-components.md` §2.3) is unchanged by this phase; Command Center's new aggregates and write actions are UI-surface-only.

### 4.11 Common Response Envelope

All non-streaming endpoints return errors in a consistent shape:

```typescript
interface ApiErrorResponse {
  error: {
    code: string;    // e.g. "EXHIBIT_NOT_FOUND"
    message: string; // e.g. "No exhibit found with the given ID"
  };
}
```

See `05-tech-stack.md` and the FRD's `Y2-errors.md` for the complete cross-feature error code catalog (reproduced in full there; not duplicated here to keep this document the single canonical reference per the FRD's own "don't duplicate, reference" convention).

### 4.12 Authentication & Request Context

No endpoint performs cryptographic authentication (PROJECT.md explicitly scopes production auth out). Every request carries:

```typescript
interface RequestContext {
  // Amended Phase 7.1 (F22): caseId is now an explicit, client-selected
  // value carried per-request (Case Selector state) — no longer an
  // effectively-constant single-case assumption. The server remains
  // stateless with respect to "which case is active."
  caseId: string;
  requestingUserRole: Role;  // from the client-side role switcher (zustand store)
  actorUserId?: string;      // required only on write endpoints; the acting user's seeded User.id
}
```

`requestingUserRole` governs **read visibility** (sealed/classification-based exclusion, F16); `actorUserId`'s resolved `Role` governs **write authorization**. **As of Phase 7.1 (F20), write authorization is no longer limited to the three actions historically gated ad hoc (ruling disposition, jury finalization, discrepancy acknowledgment)** — every write action in the system (exhibit creation, every status transition, raising an objection, proposing/confirming custody transfer, excluding a jury-package exhibit) is now gated by the single shared `assertRole` helper against the full Permission Matrix. Both the visibility check and every authorization check are enforced in `services/visibility.ts` / `services/authorization.ts` and the relevant domain service module — never re-implemented per route. **See `04-security.md` §5.2.2a for the full, current authorization model — this supersedes the narrower write-authorization table this section previously implied.**
