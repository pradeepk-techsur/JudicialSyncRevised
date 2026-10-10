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
- 200: `Array<{ exhibitId, exhibitLabel, description, offeringParty, associatedWitness, currentStatus, currentCustodianName, discrepancyFlags[], juryPackageEligibility }>` *(amended Phase 8, F9: `juryPackageEligibility: 'INCLUDED' | 'NOT_ELIGIBLE' | 'BLOCKED'` added — derived from the case's most-recently-computed `JuryPackage`'s `JuryPackageExhibit` rows, see F09 §Process step 3. Amended Phase 9, F9: value set extended to `'INCLUDED' | 'BLOCKED' | 'NOT_ELIGIBLE' | 'NOT_YET_EVALUATED'` — `NOT_YET_EVALUATED` distinguishes "never run through package computation" from `NOT_ELIGIBLE`'s now-narrower "structurally excluded" meaning; see F09 §Process steps 3–4. This value must be returned consistently by this endpoint, `searchExhibits` below, and `GET /api/exhibits/:id/history`'s `juryPackageChecklist.eligibility`.)*
- Errors: `CASE_NOT_FOUND` (404)

**`GET /api/exhibits/:id/history`**
Full chronological event timeline for one exhibit (F10).
- 200: `{ exhibit: {...}, currentStatus, currentCustodianName, discrepancyFlags[], timeline: Array<{ eventId, eventType, summary, actorName, recordedAt }>, objections[], custodyCard, juryPackageChecklist }` *(amended Phase 8, F10: `objections[]` — `UNRESOLVED` `ObjectionCurrentState` rows for the right-rail Objection card; `custodyCard` — `{ current, pendingTransfer, history[] }` for the Chain of Custody card; `juryPackageChecklist` — `{ admitted, objectionsResolved, custodianOnRecord, classificationTrial, eligibility }` for the Jury Package checklist card. All three are read-time projections of data already returned elsewhere in this response — no new query. Amended Phase 9, F9/F10: `juryPackageChecklist.eligibility` value set extended to `'INCLUDED' | 'BLOCKED' | 'NOT_ELIGIBLE' | 'NOT_YET_EVALUATED'`, computed via the identical precedence `GET /api/cases/:id/exhibits` uses — see F09 §Validation's three-surface consistency rule.)*
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
- 200: same shape as `GET /api/cases/:id/exhibits` *(amended Phase 8, F9: includes `juryPackageEligibility`, same as the unfiltered list. Amended Phase 9, F9: same `NOT_YET_EVALUATED` value-set extension as the unfiltered list above — identical precedence, identical consistency requirement.)*
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
- 200: `{ juryPackage: JuryPackage | null, exhibits: JuryPackageExhibit[] }` — `exhibits[]` includes only `status: INCLUDED` rows by default *(added Phase 7, F13: `EXCLUDED` rows are retained for audit but omitted from this default read)*. `juryPackage.version` is `null` while `DRAFT` *(added Phase 7.1, F23)*. `juryPackage` additionally includes `finalizationRequestedAt`/`finalizationRequestedBy` *(added Phase 8, F11)*, both `null` if no request is currently outstanding. **Amended Phase 9, F11:** this endpoint no longer auto-creates a `DRAFT` package as a side effect of being called — if no `JuryPackage` row exists yet for the case, it returns `{ juryPackage: null, exhibits: [] }` (a normal `200`, not an error); package creation now happens only via an explicit `POST /api/cases/:id/jury-package` call (below), triggered by a user clicking "Start package" (F11 §Process step 10).
- Errors: `CASE_NOT_FOUND` (404)

**`GET /api/cases/:id/jury-package/preview`** *(added Phase 9, F25)*
Read-only readiness preview — lists every currently admitted exhibit visible to the requesting role and whether it is ready for jury-package inclusion or blocked, without creating or modifying any `JuryPackage`/`JuryPackageExhibit` row. Reuses the identical eligibility logic `POST /api/cases/:id/jury-package` (F5/F6/F13) already applies; no role gate — every role, including `JUDGE`, receives a `200` for a valid `caseId`.
- 200: `{ preview: Array<{ exhibitId, exhibitLabel, ready: boolean, blockers: Array<{ code: 'UNRESOLVED_OBJECTION' | 'NO_CUSTODIAN' | 'SEALED_EXPARTE', detail: string }> }>, summary: { totalAdmitted, readyCount, blockedCount } }`
- Errors: `CASE_NOT_FOUND` (404), `JURY_PACKAGE_PREVIEW_LOAD_FAILED` (500)

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
- 200: `Array<{ id, tier: 'CRITICAL'|'HIGH'|'PENDING'|'MEDIUM', ruleCode, exhibitId, exhibitLabel, objectionId?, objectionGrounds: string | null, detectedAt, summary, availableAction: 'RECORD_RULING'|'REMOVE_FROM_PACKAGE'|'TRANSFER_CUSTODY'|null }>` — ordered by tier (`CRITICAL` > `HIGH` > `PENDING` > `MEDIUM`), newest-first within each tier; see F08 §Process step 4 for the exact rule-to-tier mapping. `objectionGrounds` *(added Phase 9, F8)* is non-null only for `HIGH`/`PENDING` tier entries (the two objection-scoped tiers), `null` for `CRITICAL`/`MEDIUM` — see F08 §Process step 9. This is an additive field; it does not affect tier precedence or sort order.
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
