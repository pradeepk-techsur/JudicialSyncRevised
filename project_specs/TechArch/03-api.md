
## 4. API Design

All endpoints are thin REST wrappers around the service layer (`01-components.md` §2.2) — route handlers parse the request, extract `requestingUserRole`/`actorUserId` from the session/role-switcher context, call exactly one service function, and shape the response. No route contains business logic beyond this. The Pivota Assistant's tools call the identical underlying service functions as **in-process function calls**, not HTTP round-trips to these routes — but the request/response shapes below describe the same contract both consumers rely on.

Every endpoint applies role-based visibility (`00-header.md` §Role-Based Visibility in the FRD) uniformly: sealed exhibits are excluded from results, and direct reads of a sealed exhibit by an unauthorized role return a **404** (not 403) so existence is never leaked.

### 4.1 Shared TypeScript Types

```typescript
// Shared enums — mirror the Postgres enum types 1:1
type Role = 'JUDGE' | 'CHAMBERS_STAFF' | 'DEPUTY' | 'CLERK' | 'ATTORNEY' | 'ADMIN';
type OfferingParty = 'PLAINTIFF' | 'PROSECUTION' | 'DEFENSE';
type ExhibitStatus = 'MARKED' | 'OFFERED' | 'OBJECTED' | 'ADMITTED' | 'EXCLUDED' | 'WITHDRAWN';
type ObjectionStatus = 'UNRESOLVED' | 'SUSTAINED' | 'OVERRULED';
type RulingDisposition = 'SUSTAINED' | 'OVERRULED' | 'RESERVED';
type EventType =
  | 'STATUS_CHANGE'
  | 'OBJECTION_RAISED'
  | 'RULING_RECORDED'
  | 'CUSTODY_TRANSFER'
  | 'DISCREPANCY_ACKNOWLEDGED';
type DiscrepancyStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
type JuryPackageStatus = 'DRAFT' | 'FINALIZED';
type JuryExhibitDiscrepancyStatus = 'CLEAN' | 'FLAGGED';

interface Exhibit {
  id: string;
  caseId: string;
  exhibitLabel: string;
  description: string;
  source: string | null;
  offeringParty: OfferingParty;
  associatedWitness: string | null;
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
  resolvedAt?: string;
}

interface JuryPackage {
  id: string;
  caseId: string;
  status: JuryPackageStatus;
  createdAt: string;
  finalizedAt?: string;
  finalizedBy?: string;
}

interface JuryPackageExhibit {
  exhibitId: string;
  exhibitLabel: string;
  currentStatus: ExhibitStatus;
  discrepancyStatus: JuryExhibitDiscrepancyStatus;
  addedAt: string;
}

interface ApiError {
  error: {
    code: string;
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
}
```

### 4.2 Exhibits & History (F0, F9, F10)

| Method & Path | Description | Request Body / Query | Response | Errors |
|---|---|---|---|---|
| `POST /api/exhibits` | Create exhibit identity record | `{ caseId, exhibitLabel, description, source?, offeringParty, associatedWitness?, isSealed? }` | `201 Exhibit` | `EXHIBIT_LABEL_CONFLICT` 409, `VALIDATION_ERROR` 422 |
| `GET /api/exhibits/:id` | Fetch single exhibit identity | — | `200 Exhibit` | `EXHIBIT_NOT_FOUND` 404 |
| `GET /api/cases/:id/exhibits` | List all visible exhibits for a case | — (unfiltered; use search for filters) | `200 ExhibitListRow[]` | `CASE_NOT_FOUND` 404 |
| `GET /api/exhibits/:id/history` | Full chronological event timeline | — | `200 ExhibitHistoryResponse` (below) | `EXHIBIT_NOT_FOUND` 404 (also returned for sealed/unauthorized) |

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
}
```

### 4.3 Status (F1)

| Method & Path | Description | Request Body | Response | Errors |
|---|---|---|---|---|
| `POST /api/exhibits/:id/events/status` | Record a status transition | `{ toStatus: ExhibitStatus, actorUserId, notes? }` | `201 { event: ExhibitEvent, currentState: ExhibitCurrentState }` | `INVALID_STATUS_TRANSITION` 422, `STATUS_FINALIZED` 409, `STATUS_CONFLICT` 409, `EXHIBIT_NOT_FOUND` 404 |
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
| `POST /api/exhibits/:id/events/objection` | Raise an objection | `{ objectingParty, grounds, actorUserId }` | `201 { event: ExhibitEvent, objectionState: ObjectionCurrentState }` | `INVALID_OBJECTION_TARGET` 422, `EXHIBIT_NOT_FOUND` 404 |
| `POST /api/objections/:id/ruling` | Record a ruling against an objection thread | `{ disposition: RulingDisposition, actorUserId }` | `201 { event: ExhibitEvent, objectionState: ObjectionCurrentState }` | `OBJECTION_NOT_FOUND` 404, `OBJECTION_ALREADY_RESOLVED` 409, `ROLE_NOT_PERMITTED` 403 (SUSTAINED/OVERRULED requires `JUDGE` role) |
| `GET /api/cases/:id/objections?status=unresolved` | List objection threads, filterable | Query: `status?` | `200 ObjectionCurrentState[]` | `CASE_NOT_FOUND` 404 |

### 4.5 Custody (F3)

| Method & Path | Description | Request Body | Response | Errors |
|---|---|---|---|---|
| `POST /api/exhibits/:id/events/custody` | Record a custody transfer | `{ fromCustodianUserId?, toCustodianUserId, reason?, actorUserId }` | `201 { event: ExhibitEvent, custodyState: CustodyCurrentState }` | `CUSTODY_CHAIN_BROKEN` 409, `INVALID_CUSTODIAN` 422, `NO_OP_TRANSFER` 422, `EXHIBIT_NOT_FOUND` 404 |
| `GET /api/exhibits/:id/custodian` | Current custodian only | — | `200 CustodyCurrentState` | `EXHIBIT_NOT_FOUND` 404 |
| `GET /api/exhibits/:id/custody-history` | Full ordered chain-of-custody | — | `200 CustodyHistoryEntry[]` | `EXHIBIT_NOT_FOUND` 404 |

```typescript
interface CustodyHistoryEntry {
  fromCustodian: string | null;
  toCustodian: string;
  timestamp: string;
  reason: string | null;
  eventId: string;
}
```

### 4.6 Search (F4)

| Method & Path | Description | Query Params | Response | Errors |
|---|---|---|---|---|
| `GET /api/cases/:id/exhibits/search` | Multi-criteria combinable (AND) search | `keyword?, status?, witness?, dateFrom?, dateTo?` | `200 ExhibitListRow[]` | `EMPTY_SEARCH_CRITERIA` 422, `INVALID_DATE_RANGE` 422, `VALIDATION_ERROR` 422 |

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
| `GET /api/cases/:id/jury-package` | Fetch current package with live discrepancy status | — | `200 { juryPackage: JuryPackage, exhibits: JuryPackageExhibit[] }` | `CASE_NOT_FOUND` 404 |
| `POST /api/jury-package/:id/finalize` | Attempt finalization — hard-gated, re-evaluated fresh | `{ actorUserId, acknowledgedDiscrepancyIds? }` | `200 { juryPackage: JuryPackage }` (status: `FINALIZED`) | `JURY_PACKAGE_DISCREPANCIES_OPEN` 409 (includes blocking list), `JURY_PACKAGE_ALREADY_FINALIZED` 409, `ROLE_NOT_PERMITTED` 403 |

`actorUserId` must resolve to role `DEPUTY`, `CLERK`, or `ADMIN` to initiate or finalize. Finalization re-runs `evaluateDiscrepancies` fresh for every included exhibit — never trusting the cached `discrepancyStatus` captured at draft-computation time.

### 4.8 Discrepancies (F6)

| Method & Path | Description | Request Body | Response | Errors |
|---|---|---|---|---|
| `GET /api/cases/:id/discrepancies` | All open/acknowledged flags case-wide | — | `200 DiscrepancyFlag[]` | `CASE_NOT_FOUND` 404 |
| `GET /api/exhibits/:id/discrepancies` | Flags for a single exhibit | — | `200 DiscrepancyFlag[]` | `EXHIBIT_NOT_FOUND` 404 |
| `POST /api/discrepancies/:id/acknowledge` | Explicitly acknowledge an open flag | `{ actorUserId, justification }` | `200 { event: ExhibitEvent, discrepancyFlag: DiscrepancyFlag }` (idempotent) | `JUSTIFICATION_REQUIRED` 422, `DISCREPANCY_NOT_FOUND` 404, `ROLE_NOT_PERMITTED` 403 |

### 4.9 Command Center (F8)

| Method & Path | Description | Query Params | Response | Errors |
|---|---|---|---|---|
| `GET /api/cases/:id/activity` | Recent-activity feed | `since?` (ISO 8601, default: start of current trial day) | `200 RecentActivityEntry[]` | `VALIDATION_ERROR` 422, `COMMAND_CENTER_LOAD_FAILED` 500 |

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

Command Center also composes `GET /api/cases/:id/objections?status=unresolved` (§4.4) and `GET /api/cases/:id/discrepancies` (§4.8) client-side — no server-side aggregation endpoint beyond `/activity` is required.

### 4.10 Pivota Assistant (F7)

| Method & Path | Description | Request Body | Response | Errors |
|---|---|---|---|---|
| `POST /api/assistant/chat` | Streaming tool-calling chat (Vercel AI SDK `streamText`) | `{ caseId, userId, message, conversationId? }` | Streamed text (SSE/chunked) + final structured payload incl. `citations[]` | `TOOL_ARGS_INVALID` (tool-level, surfaced to model), `ASSISTANT_UNAVAILABLE` 503 |
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

Each tool in `AssistantToolSet` is implemented against the exact same service-layer function backing the corresponding REST route above — e.g., `getExhibitStatus` the tool and `GET /api/exhibits/:id/status` the route both call `services/status.ts#getExhibitStatus(exhibitId)`. This 1:1 mapping is what structurally guarantees cross-screen/assistant consistency rather than relying on manual testing alone.

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
  caseId: string;            // single-case demo scope; effectively constant
  requestingUserRole: Role;  // from the client-side role switcher (zustand store)
  actorUserId?: string;      // required only on write endpoints; the acting user's seeded User.id
}
```

`requestingUserRole` governs **read visibility** (sealed-exhibit exclusion); `actorUserId`'s resolved `Role` governs **write authorization** (e.g., only `JUDGE` may record `SUSTAINED`/`OVERRULED`; only `DEPUTY`/`CLERK`/`ADMIN` may finalize a jury package). Both checks are enforced in `services/visibility.ts` and the relevant domain service module — never re-implemented per route. See `04-security.md` for the full authorization model.
