## F24: Write-Action UI Coverage — Record Ruling & Transfer Custody

**Description:** Surfaces two write actions that have existed as backend services since early phases — `recordRuling` (F02, `objections.ts`) and `recordCustodyTransfer` (F03/F19, `custody.ts`) — but have never had a UI entry point anywhere in this product. This feature gives both actions their first real, role-gated UI surface, reachable from the Trial Command Center's "Needs your attention" feed (F08) and the Exhibit Detail right rail (F10). It introduces **no new ruling or custody logic, no new endpoint, and no new schema** — every validation rule, state-machine check, and role gate already specified in F02, F03, F19, and F20 applies completely unchanged. F24's entire scope is the client-side form/modal, the wiring to the existing endpoints, and the inline-refresh behavior on success.

**Terminology:**
- **Inline Action:** A write action triggered directly from within a card or feed entry (Command Center attention feed, Exhibit Detail right-rail card) without navigating to a separate page — but never auto-submitting; an explicit confirm step is always required (see §Validation).
- **Originating Screen:** The screen/card the action was launched from (Command Center attention feed entry, or an Exhibit Detail right-rail card) — the screen whose data must refresh on success so the completed action is immediately visible without a manual reload.

**Sub-features:**
- "Record ruling" inline action: judge selects a disposition (SUSTAINED / OVERRULED / RESERVED) against one specific `UNRESOLVED` objection thread, available from an attention-feed entry (F08) or the Exhibit Detail Objection card (F10)
- "Transfer custody" / "Assign custodian" inline action: select a new custodian from the case's user roster, available from the Exhibit Detail header (F10) and, where applicable, a Command Center custody-by-custodian panel entry (F08) — handles both first-time assignment (no prior custodian) and a subsequent transfer (existing custodian) via the correct existing endpoint for each case
- A minimal "Confirm receipt" / "Cancel pending transfer" surface on Exhibit Detail, shown only when a pending transfer (F19) exists for that exhibit, since the propose endpoint this feature wires up is otherwise unusable without a way to resolve the pending state it creates
- Both actions are gated by the F20 permission matrix — a role without permission for an action does not see the control at all, not a disabled or silently-failing one
- Successful submission refreshes the originating screen through the existing live-sync polling mechanism (or an immediate scoped refetch of just the affected query) — no screen-local optimistic state that could diverge from the ledger
- Failed submission surfaces the specific rejection reason inline, matching the reject-with-reason pattern established by F12/F17/F18

**Process — Record Ruling:**
1. An authorized user opens "Record ruling" from an attention-feed entry (F08, tiers `HIGH`/`PENDING` — see F08 §Process) or from the Objection card on Exhibit Detail (F10). Both entry points pass the specific `objectionId` of one `UNRESOLVED` thread as context — never a bare `exhibitId` with ambiguous thread selection, since F02 permits N concurrent open threads per exhibit.
2. The UI renders the three-way disposition selector (`SUSTAINED` / `OVERRULED` / `RESERVED`) — identical to F02's existing enum; no new disposition value is introduced.
3. On explicit submit (see §Validation — no auto-submit), the client calls the existing `POST /api/objections/:id/ruling` endpoint (F02) unchanged: `{ disposition, actorUserId }`.
4. The service layer applies F02's existing validation (objection exists and is currently `UNRESOLVED`) and F20's existing judge-only role gate (§Permission Matrix row 5) exactly as already specified — F24 adds no new validation step; it is simply this endpoint's first caller.
5. On success, the Command Center attention-feed entry for that objection re-evaluates on the next poll tick: a `SUSTAINED`/`OVERRULED` disposition closes the thread and the entry disappears; a `RESERVED` disposition leaves the thread `UNRESOLVED` (F02 §Terminology) and the entry remains, re-ranked by its unchanged `raisedAt`. The Exhibit Detail Objection card (F10) reflects the updated `ObjectionCurrentState` on its next poll identically.
6. On failure (e.g., `403 ROLE_NOT_PERMITTED`, `409 OBJECTION_ALREADY_RESOLVED` from a stale UI state), the form surfaces the specific rejection reason inline and remains open for correction or cancellation — never a silent failure or a generic toast with no actionable detail.

**Process — Transfer / Assign Custody:**
1. An authorized user opens "Transfer custody" / "Assign custodian" from the Exhibit Detail header (F10) or, where applicable, an entry in the Command Center custody-by-custodian panel (F08).
2. The UI reads the exhibit's current custody state via the already-loaded `getCustodian(exhibitId)` result (F03, amended by F19) to determine: (a) whether a custodian of record currently exists at all, and (b) whether a transfer is already pending for this exhibit.
3. **No current custodian (first-time assignment):** if `CustodyCurrentState` has no row for this exhibit — a state possible for exhibits predating Phase 7.1's F18 intake gate — the UI calls the existing legacy endpoint `POST /api/exhibits/:id/events/custody` (F03/F19) with `fromCustodianUserId: null`. This assignment takes effect immediately; no propose/confirm step applies, identical to F19's documented intake-bootstrap exception (`F19-custody-handoff-confirmation.md` §Design Decisions).
4. **Existing custodian, no pending transfer:** the UI instead calls `POST /api/exhibits/:id/events/custody/propose` (F19), pre-filling `fromCustodianUserId` with the current custodian (read-only in the form — the UI never lets the user type a different "from" value) and presenting a custodian picker, populated from the case's active user roster (`GET /api/cases/:id`, F0/F22), for `toCustodianUserId`. The picker excludes the current custodian (since `fromCustodianUserId`/`toCustodianUserId` must differ — F03's existing `NO_OP_TRANSFER` rule, unchanged).
5. **Existing custodian, transfer already pending:** the UI does not offer a new proposal (F19 permits only one outstanding proposal per exhibit). Instead it renders the pending transfer's state — named receiver, proposed-at timestamp — with exactly two controls: "Cancel pending transfer" (`POST /api/exhibits/:id/events/custody/cancel`, F19), available to the original proposer or any F20-authorized propose role; and, visible **only** to the user who exactly matches `pendingTransferToUserId` (an identity match, not a role match — see F19 §Validation), "Confirm receipt" (`POST /api/exhibits/:id/events/custody/confirm`, F19).
6. On success of any of the three calls above, the Exhibit Detail custody display refreshes on the next poll tick to reflect the new state (assigned / proposed-pending / confirmed / cancelled), and a Command Center custody-by-custodian panel entry (F08) regroups the exhibit under its new or still-current custodian accordingly.
7. On failure (`403 ROLE_NOT_PERMITTED`, `409 CUSTODY_CHAIN_BROKEN`, `409 CUSTODY_TRANSFER_ALREADY_PENDING`, `403 CUSTODY_CONFIRM_WRONG_USER`, `422 INVALID_CUSTODIAN`/`NO_OP_TRANSFER`), the form surfaces the specific rejection reason inline, matching the reject-with-reason pattern.

**Inputs — Record Ruling:**
- `objectionId` (string/UUID, required): supplied by the originating card/feed entry, never user-typed
- `disposition` (enum: `SUSTAINED` | `OVERRULED` | `RESERVED`, required): user-selected
- `actorUserId` (string/UUID, required, from session): must resolve server-side to role `JUDGE` (F20 §Permission Matrix row 5)

**Inputs — Transfer / Assign Custody:**
- `exhibitId` (string/UUID, required): from the originating screen's context
- `toCustodianUserId` (string/UUID, required for assign/propose): user-selected from the case's active user roster, excluding the current custodian
- `fromCustodianUserId` (string/UUID, nullable): auto-populated from `getCustodian(exhibitId)`; `null` only for first-time assignment; read-only in the UI otherwise
- `reason` (string, optional, max 300 chars): free-text, user-entered
- `proposedEventId` (string/UUID, required for confirm/cancel): auto-populated from the exhibit's current `pendingTransferEventId`, never user-typed
- `actorUserId` (string/UUID, required, from session): must resolve server-side to an F20-authorized role (`DEPUTY`/`CLERK`/`ADMIN`) for assign/propose/cancel; for confirm, must exactly equal `pendingTransferToUserId` (identity match per F19, independent of and in addition to the F20 role gate)

**Outputs:**
- Record ruling: `{ event: ExhibitEvent, objectionState: ObjectionCurrentState }` — identical to F02's existing response shape; F24 adds no new field
- Assign / propose / confirm / cancel custody: `{ event: ExhibitEvent, custodyState: CustodyCurrentState }` — identical to F03/F19's existing response shapes
- Each action's success response triggers a scoped refetch of only the query feeding the originating card/feed/panel — never a full-page reload

**Validation:**
- F24 introduces no new field-level or state-machine validation of its own — every rule enforced on submission belongs to F02 (ruling), F03/F19 (custody), and F20 (role), completely unchanged. F24's own responsibility is limited to the two rules below.
- The UI must not render an action control for a role the F20 matrix does not permit for that action — e.g., an `ATTORNEY` viewing the Objection card sees the open objection but no "Record ruling" control; a `JUDGE` viewing Exhibit Detail sees the Chain of Custody card but no "Transfer custody" control. This mirrors F20 §Process step 6's UI-consistency recommendation, elevated here to a requirement since this feature is the primary UI surface for these two actions. The server-side gate remains authoritative regardless of what renders.
- Every inline action requires an explicit confirmation step (a confirmation dialog, or a distinct "Submit"/"Confirm" click separate from the control that opened the form) before the underlying write request is sent — no inline action may auto-submit on selection alone. This directly satisfies the PRD risk mitigation for inline actions on what was previously a strictly passive glance screen (Command Center, F08).

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| Non-judge attempts to record a ruling from this UI | 403 | ROLE_NOT_PERMITTED | "Only a judge may record a sustained or overruled ruling" *(F02/F20, unchanged)* |
| Ruling submitted against an already-resolved objection (stale UI state) | 409 | OBJECTION_ALREADY_RESOLVED | "This objection has already been ruled on" *(F02, unchanged)* |
| Non-authorized role attempts to assign/propose custody from this UI | 403 | ROLE_NOT_PERMITTED | "Only a courtroom deputy, clerk, or admin may propose a custody transfer" *(F19/F20, unchanged)* |
| Custody transfer attempted from the wrong current holder (stale UI state) | 409 | CUSTODY_CHAIN_BROKEN | "Recorded custodian does not match the exhibit's current custodian" *(F03, unchanged)* |
| Custody proposed while one is already pending (stale UI state) | 409 | CUSTODY_TRANSFER_ALREADY_PENDING | "A custody transfer is already pending for this exhibit" *(F19, unchanged)* |
| Confirm attempted by anyone other than the named receiver | 403 | CUSTODY_CONFIRM_WRONG_USER | "Only the named receiving custodian may confirm this transfer" *(F19, unchanged)* |
| Invalid/no-op custodian selection (stale UI state) | 422 | INVALID_CUSTODIAN / NO_OP_TRANSFER | *(F03, unchanged — see F03 §Error States)* |

**API Surface (this feature):** introduces **no new endpoints**. Invokes, unchanged: `POST /api/objections/:id/ruling` (F02); `POST /api/exhibits/:id/events/custody` (F03/F19, first-assignment path only); `POST /api/exhibits/:id/events/custody/propose`, `/confirm`, `/cancel` (F19). See `Y1-api.md` §Objections, §Custody.

**Schema Surface (this feature):** none. F24 writes only through the existing F02/F03/F19 service functions and their existing ledger event types — no new table, field, or enum value is introduced.
