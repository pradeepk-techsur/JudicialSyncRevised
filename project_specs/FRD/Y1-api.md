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
