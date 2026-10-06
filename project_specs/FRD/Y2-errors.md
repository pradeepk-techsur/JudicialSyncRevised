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
