## Y2: Error Catalog

Consolidated cross-feature error scenarios. Per-feature chunks list only the errors that originate in that feature; this catalog is the canonical reference for every error code in the system, including shared/cross-cutting ones not tied to a single feature.

### Data & Validation Errors

| HTTP Status | Error Code | Message | Origin | Retry Guidance |
|---|---|---|---|---|
| 422 | VALIDATION_ERROR | "{field} must be {constraint}" | Any input validation failure not covered by a more specific code | Fix the request payload and retry |
| 409 | EXHIBIT_LABEL_CONFLICT | "An exhibit with this label already exists in this case" | F0 | Use a different label or fetch the existing exhibit |
| 404 | EXHIBIT_NOT_FOUND | "No exhibit found with the given ID" | F0, F1, F2, F3, F9, F10 | Verify the exhibit ID; also returned for sealed/unauthorized exhibits (no distinction) |
| 404 | CASE_NOT_FOUND | "No case found with the given ID" | F8, F9, F22 | Verify the case ID / selected active case |
| 500 | SEED_INTEGRITY_FAILURE | "Seed data failed required edge-case assertions" | F0 (seed-time only) | Developer-facing; fix seed script, not user-retryable |
| 422 | CLASSIFICATION_REQUIRED | "classification is required and must be one of: TRIAL, CHAMBERS_EX_PARTE, SEALED" | F16 | Supply a valid classification at exhibit creation |
| 422 | INVALID_CLASSIFICATION | "classification must be one of: TRIAL, CHAMBERS_EX_PARTE, SEALED" | F16 | Correct the request payload and retry |

### Status Lifecycle Errors (F1)

| HTTP Status | Error Code | Message | Retry Guidance |
|---|---|---|---|
| 422 | INVALID_STATUS_TRANSITION | "Cannot transition from {fromStatus} to {toStatus}" | Correct the requested `toStatus` per the allowed-transitions table; not retryable as-is |
| 409 | STATUS_FINALIZED | "Exhibit status is final and cannot be changed" | Not retryable — terminal state is by design |
| 409 | STATUS_CONFLICT | "Exhibit status has changed since this view was loaded — refresh and retry" | Refetch current state, then retry the transition |

**Note:** Phase 9's unified status-color and attention-tier design-token standard (`StatusBadge` component, F1) introduces no new error codes — it is a client-side component/token consolidation only; see `F01-exhibit-status-display.md` §Process step 8.

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

### Admission Integrity Errors (F12)

| HTTP Status | Error Code | Message | Retry Guidance |
|---|---|---|---|
| 422 | ADMISSION_BLOCKED | "Cannot admit: {n} blocking condition(s) present" (body includes `reasons[]`, each `UNRESOLVED_OBJECTION` or `NO_CUSTODIAN`) | Resolve the listed condition(s) — close the objection thread via a ruling (F2), and/or record a custody transfer (F3) — then retry the admission transition |

### Jury Package Exclusion Errors (F13)

| HTTP Status | Error Code | Message | Retry Guidance |
|---|---|---|---|
| 404 | JURY_PACKAGE_EXHIBIT_NOT_FOUND | "No included exhibit found in this jury package with the given ID" | Verify the juryPackageId/exhibitId pair and that the row is currently `INCLUDED` |
| 409 | JURY_PACKAGE_ALREADY_FINALIZED | "This jury package has already been finalized" | Not retryable — a `FINALIZED` package's rows are immutable; create a new draft if changes are needed |

**Note:** F14 (Discrepancy Acknowledgment Transparency) and F15 (Courtroom Usability Fixes) introduce no new error codes — both are UI-visibility/client-rendering requirements layered on existing, unchanged service behavior. See their respective FRD chunks' §Error States for the existing codes they continue to rely on.

### Exhibit Classification Errors (F16)

| HTTP Status | Error Code | Message | Retry Guidance |
|---|---|---|---|
| 422 | CLASSIFICATION_REQUIRED | "classification is required and must be one of: TRIAL, CHAMBERS_EX_PARTE, SEALED" | Supply a valid classification; no exhibit can be created unclassified |
| 422 | INVALID_CLASSIFICATION | "classification must be one of: TRIAL, CHAMBERS_EX_PARTE, SEALED" | Correct the request payload and retry |

**Note:** F17 (Objection-to-Admission State-Machine Hardening) introduces no new error codes — F12's existing `ADMISSION_BLOCKED` / `UNRESOLVED_OBJECTION` response already fully covers the scenario this feature hardens with regression tests; see `F17-objection-admission-state-machine-hardening.md` §Error States.

### Custodian-at-Intake Errors (F18)

| HTTP Status | Error Code | Message | Retry Guidance |
|---|---|---|---|
| 422 | CUSTODIAN_REQUIRED_AT_INTAKE | "A custodian must be established when an exhibit is first marked into evidence" | Supply a valid `custodianUserId` alongside the first MARKED transition |

### Custody Handoff Confirmation Errors (F19)

| HTTP Status | Error Code | Message | Retry Guidance |
|---|---|---|---|
| 409 | CUSTODY_TRANSFER_ALREADY_PENDING | "A custody transfer is already pending for this exhibit" | Wait for the pending transfer to be confirmed or cancelled before proposing a new one |
| 404 | CUSTODY_CONFIRMATION_NOT_PENDING | "No pending custody transfer found matching this request" | Verify a transfer is currently pending and the `proposedEventId` matches it |
| 403 | CUSTODY_CONFIRM_WRONG_USER | "Only the named receiving custodian may confirm this transfer" | Not retryable by this user — only the user named as `toCustodianUserId` on the proposal may confirm |
| 409 | CUSTODY_TRANSFER_REQUIRES_CONFIRMATION | "Transfers after the first must use the propose/confirm flow" | Use `POST /api/exhibits/:id/events/custody/propose` instead of the legacy unilateral endpoint |

### Server-Side Role Enforcement Errors (F20)

| HTTP Status | Error Code | Message | Applies To | Retry Guidance |
|---|---|---|---|---|
| 403 | ROLE_NOT_PERMITTED | "Only a courtroom deputy, clerk, or admin may create an exhibit" | Create exhibit | Not retryable by this user |
| 403 | ROLE_NOT_PERMITTED | "Only a courtroom deputy, clerk, or admin may record this status transition" | Mark/offer/withdraw/admit/exclude transitions | Not retryable by this user |
| 403 | ROLE_NOT_PERMITTED | "Only an attorney, courtroom deputy, clerk, or admin may raise an objection" | Raise objection | Not retryable by this user |
| 403 | ROLE_NOT_PERMITTED | "Only a courtroom deputy, clerk, or admin may propose a custody transfer" | Propose custody transfer | Not retryable by this user |
| 403 | ROLE_NOT_PERMITTED | "Only a courtroom deputy, clerk, or admin may confirm custody receipt" | Confirm custody transfer (role gate — distinct from F19's identity-match `CUSTODY_CONFIRM_WRONG_USER`) | Not retryable by this user |

**Note:** Rows for ruling disposition, discrepancy acknowledgment, jury-package finalize, and jury-package exclusion are unchanged by F20 — see their existing entries above (Objection & Ruling Errors, Discrepancy Errors, Jury Package Errors, Jury Package Exclusion Errors respectively). F20 retrofits all of them onto one shared `assertRole` enforcement mechanism without changing any existing message or code.

### Pending-Ruling Queue Errors (F21)

**Note:** F21 introduces no new error codes — it is a read-only client-side view reusing F2's existing `GET /api/cases/:id/objections` endpoint and error handling unchanged; see `F21-pending-ruling-queue.md` §Error States.

### Multi-Case Support Errors (F22)

**Note:** F22 introduces no new error codes — it reuses the existing `CASE_NOT_FOUND` (404) for every amended case-scoped endpoint; see `F22-multi-case-support-case-selector.md` §Error States.

### Jury Package Finalization Request Errors (F11, added Phase 8)

| HTTP Status | Error Code | Message | Retry Guidance |
|---|---|---|---|
| 403 | ROLE_NOT_PERMITTED | "This role can finalize directly and does not need to request it" | Not retryable by this user — a `DEPUTY`/`CLERK`/`ADMIN` role should use the Finalize action directly instead |
| 409 | JURY_PACKAGE_ALREADY_FINALIZED | "This jury package has already been finalized" | Not retryable — a finalized package has no pending request state to set *(reuses F5's existing code, unchanged)* |

### Command Center Attention Feed Errors (F8, added Phase 8)

| HTTP Status | Error Code | Message | Retry Guidance |
|---|---|---|---|
| 500 | ATTENTION_FEED_LOAD_FAILED | "Unable to load the attention feed — please retry" | Transient; retry |

**Note:** Phase 8's `GET /api/cases/:id/custody-by-custodian` (F8, new) introduces no new error code — it reuses the existing `COMMAND_CENTER_LOAD_FAILED` (500) for any underlying query failure. The `statusCounts` addition to `GET /api/cases/:id/activity` (F8) introduces no new error code either, since it is computed from data the endpoint already fetches.

**Note:** Phase 9's `objectionGrounds` addition to `GET /api/cases/:id/attention-feed` (F8) introduces no new error code — it is a purely additive, read-time field with no new rejection path; see `F08-trial-command-center-screen.md` §Process step 9.

### Jury Package Eligibility Value Addition (F9, added Phase 9)

**Note:** The `NOT_YET_EVALUATED` eligibility value added to `GET /api/cases/:id/exhibits`, `GET /api/cases/:id/exhibits/search`, and `GET /api/exhibits/:id/history`'s `juryPackageChecklist.eligibility` (F9/F10) introduces no new error code. It is a TypeScript union-type extension to an existing field, computed at read time — see `F09-case-workspace-screen.md` §Process steps 3–4 and §Validation for the three-surface consistency requirement.

### Jury Package Readiness Preview Errors (F25, added Phase 9)

| HTTP Status | Error Code | Message | Retry Guidance |
|---|---|---|---|
| 404 | CASE_NOT_FOUND | "No case found with the given ID" | Verify the case ID *(reuses the existing code, unchanged)* |
| 500 | JURY_PACKAGE_PREVIEW_LOAD_FAILED | "Unable to load the jury package readiness preview — please retry" | Transient; retry |

**Note:** This read-only route has no `ROLE_NOT_PERMITTED` gate by design — every role, including `JUDGE`, receives a `200` for a valid `caseId`; see `F25-jury-package-readiness-preview.md` §Validation.

**Note:** Phase 9's removal of the auto-create-on-view behavior from `GET /api/cases/:id/jury-package` (F11) introduces no new error code — the "no package yet" case is a normal `200` response with `juryPackage: null`, not an error; see `F11-jury-package-workspace-screen.md` §Process step 10.

**Note:** F24 (Write-Action UI Coverage — Record Ruling & Transfer Custody) introduces no new error codes. Every error it surfaces is an existing code from F02 (`OBJECTION_ALREADY_RESOLVED`, `OBJECTION_NOT_FOUND`), F03 (`CUSTODY_CHAIN_BROKEN`, `INVALID_CUSTODIAN`, `NO_OP_TRANSFER`), F06/F14 (`JUSTIFICATION_REQUIRED`), F19 (`CUSTODY_TRANSFER_ALREADY_PENDING`, `CUSTODY_CONFIRMATION_NOT_PENDING`, `CUSTODY_CONFIRM_WRONG_USER`, `CUSTODY_TRANSFER_REQUIRES_CONFIRMATION`), and F20 (`ROLE_NOT_PERMITTED`), all unchanged — see `F24-write-action-ui-coverage.md` §Error States for the consolidated list as surfaced through this feature's UI. **Phase 9 confirms this remains true:** the discrepancy-banner button consolidation (single "Record ruling" entry point; confirmed "Acknowledge"-requires-justification contract) is a UI-only change and introduces no new error code.

### Versioned Jury Package Export Errors (F23)

| HTTP Status | Error Code | Message | Retry Guidance |
|---|---|---|---|
| 422 | JURY_PACKAGE_EXPORT_NOT_FINALIZED | "Only a finalized jury package version can be exported as a PDF" | Finalize the package first, then retry export |
| 404 | JURY_PACKAGE_VERSION_NOT_FOUND | "No jury package version found with the given ID" | Verify the jury package ID |
| 500 | PDF_GENERATION_FAILED | "Unable to generate the jury package PDF — please retry" | Transient; retry. If persistent, check exhibit data integrity for the version being exported |

### Assistant Errors (F7)

| HTTP Status | Error Code | Message | Retry Guidance |
|---|---|---|---|
| — (tool-level) | TOOL_ARGS_INVALID | "Invalid arguments for tool {toolName}" | Surfaced to the LLM, not the end user; model should retry with corrected arguments within the same turn |
| 503 | ASSISTANT_UNAVAILABLE | "The assistant is temporarily unavailable — please try again" | Retry after a short delay; check LLM provider status |
| 404 | CONVERSATION_NOT_FOUND | "No conversation found with the given ID" | Verify the conversation ID |
| — (no HTTP error; model behavior) | — | "I don't have that information" (Decline Response) | Not an error — a required, valid response path when no tool result supports an answer. **Must never be treated as a bug to "fix" by relaxing citation requirements.** |

**Note:** Phase 9's context-aware example prompts (`contextExhibitId`, F7) introduce no new error code — an unresolvable or unauthorized context exhibit silently falls back to the standard example set; see `F07-pivota-assistant.md` §Validation.

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
