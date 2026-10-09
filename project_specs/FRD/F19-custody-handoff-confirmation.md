## F19: Custody Handoff Confirmation

**Description:** Converts custody transfer from a single unilateral event (the current custodian unilaterally asserts a handoff occurred) into a two-phase ledger-event model: a `CUSTODY_TRANSFER_PROPOSED` event creates a pending transfer, and a `CUSTODY_TRANSFER_CONFIRMED` event — recorded only by the named receiving custodian, confirming their own receipt — completes it. This closes the gap where a custody record could previously assert a handoff the receiving party never actually acknowledged taking possession of. The exhibit's first-ever custody assignment (established atomically at intake per F18) is an explicit, documented exception to this two-phase model — see §Design Decisions below.

**Terminology:**
- **Pending Transfer:** The state of a `CustodyCurrentState` row between a `CUSTODY_TRANSFER_PROPOSED` event and its resolving `CUSTODY_TRANSFER_CONFIRMED` or `CUSTODY_TRANSFER_CANCELLED` event. During this window, `currentCustodianUserId` does **not** change — "who currently has custody" always reflects the last *confirmed* transfer, never a pending proposal.
- **Proposer:** The user recording a `CUSTODY_TRANSFER_PROPOSED` event. Must be the exhibit's current custodian of record (identical to F03's existing `fromCustodianUserId`-match requirement — unchanged, see §Validation).
- **Named Receiver:** The user identified as `toCustodianUserId` on a pending proposal. Only this specific user may record the resolving `CUSTODY_TRANSFER_CONFIRMED` event — not an authorized role acting generally, not the proposer, not any other user, even one with an otherwise-permitted role.

**Design decisions:**
- **Pending-state representation:** `CustodyCurrentState` gains three nullable fields — `pendingTransferToUserId`, `pendingTransferEventId`, `pendingTransferProposedAt` — populated when a proposal is recorded and cleared when it resolves (confirmed or cancelled). `currentCustodianUserId` is left untouched during the pending window. This is simpler than introducing a parallel "proposed state" table, keeps exactly one row per exhibit to read for "who has it / is anything pending," and requires no join for the common case.
- **No-confirm path:** a pending transfer stays pending indefinitely by default; there is no time-based auto-expiry. A time-based expiry would require a background job or scheduled task, which this architecture explicitly does not have (`Y3-integrations.md`: "No message queues, caches, or background job runners"). Instead, an explicit, synchronous `CUSTODY_TRANSFER_CANCELLED` action is provided, consistent with the system's request/response-only write model. This is the simpler option and is justified by architectural fit, not by any claim that indefinite pending is ideal operationally.
- **Interaction with F18 (first-ever assignment):** the exhibit's first-ever custody link, established atomically at the `MARKED` transition (F18 §Process step 5), does **not** go through the propose/confirm flow. At intake there is no existing custodian relationship to formalize a handoff *from* — the deputy establishing custody at intake is creating the record, not receiving a transfer from a predecessor. This bootstrap case is recorded as a single, immediately-effective event (see §Process step 1) with `fromCustodianUserId: null`; two-phase confirmation applies only to transfers **after** that first established custodian.

**Sub-features:**
- Propose a custody transfer (current custodian names an intended receiver) — does not change current custody
- Confirm a custody transfer (named receiver only) — completes the transfer, updates `CustodyCurrentState`
- Cancel a pending transfer (proposer, or any role authorized to propose) — reverts to no-pending-transfer state, current custody unaffected
- Visible distinction between a pending proposal and a confirmed transfer on Custody Tracking (F3), Exhibit Detail (F10), and the assistant's `getCustodian` tool (F7)
- The exhibit's intake custody link (F18) is a documented single-phase exception — not routed through propose/confirm

**Process:**
1. **Intake bootstrap (F18 interaction):** at the `(none) → MARKED` transition, the service layer appends a `CUSTODY_TRANSFER_CONFIRMED` event directly — `payload: { fromCustodianUserId: null, toCustodianUserId: <F18's custodianUserId>, reason?: 'intake' }` — with no preceding `CUSTODY_TRANSFER_PROPOSED` event, and immediately sets `CustodyCurrentState.currentCustodianUserId` accordingly. No pending-transfer fields are ever populated for this specific event.
2. **Proposing a subsequent transfer:** the current custodian (or an authorized role per F20's propose gate) calls `recordEvent({ exhibitId, eventType: 'CUSTODY_TRANSFER_PROPOSED', payload: { fromCustodianUserId, toCustodianUserId, reason? }, actorUserId })`.
3. The service layer validates `fromCustodianUserId` exactly matches `CustodyCurrentState.currentCustodianUserId` — identical, unchanged validation to F03 §Validation's existing wrong-holder rejection (`CUSTODY_CHAIN_BROKEN`).
4. The service layer validates no transfer is already pending for this exhibit (`pendingTransferToUserId` must currently be null) — a second proposal cannot be raised while one is outstanding.
5. The service layer appends the immutable `CUSTODY_TRANSFER_PROPOSED` `ExhibitEvent` row, then sets `CustodyCurrentState.pendingTransferToUserId = toCustodianUserId`, `pendingTransferEventId = <this event's id>`, `pendingTransferProposedAt = now()`. `currentCustodianUserId` is **not** modified.
6. **Confirming:** the named receiver (and only the named receiver — `actorUserId` must exactly equal `CustodyCurrentState.pendingTransferToUserId`) calls `recordEvent({ exhibitId, eventType: 'CUSTODY_TRANSFER_CONFIRMED', payload: { proposedEventId }, actorUserId })`.
7. The service layer validates a transfer is currently pending for this exhibit and that `actorUserId` matches `pendingTransferToUserId` exactly — any other user, including the original proposer, the exhibit's prior custodian, or a user with an otherwise custody-authorized role, is rejected.
8. The service layer appends the `CUSTODY_TRANSFER_CONFIRMED` event, then updates `CustodyCurrentState`: `currentCustodianUserId = pendingTransferToUserId`, `since = now()`, `lastEventId = <confirm event id>`, and clears all three pending fields to null.
9. **Cancelling:** the proposer, or any user holding a role authorized to propose custody transfers (F20 §Permission Matrix), calls `recordEvent({ exhibitId, eventType: 'CUSTODY_TRANSFER_CANCELLED', payload: { proposedEventId, reason? }, actorUserId })` while a transfer is pending.
10. The service layer appends the `CUSTODY_TRANSFER_CANCELLED` event and clears the three pending fields to null. `currentCustodianUserId` is unaffected — it was never changed by the proposal in the first place.
11. `getCustodian(exhibitId)` (F03 §Process step 5) is amended to additionally return whether a transfer is currently pending and, if so, to whom — so Custody Tracking (F3), Exhibit Detail (F10), and the assistant's `getCustodian` tool (F7) all render a pending proposal as visibly distinct from a confirmed custodian, never silently indistinguishable from "no activity."
12. `getCustodyHistory(exhibitId)` (F03 §Process step 6) is amended to include `CUSTODY_TRANSFER_PROPOSED`, `CUSTODY_TRANSFER_CONFIRMED`, and `CUSTODY_TRANSFER_CANCELLED` events in the ordered chain-of-custody timeline, so a cancelled/superseded proposal remains visible in history rather than disappearing.

**Inputs — Propose:**
- `exhibitId` (string/UUID, required)
- `fromCustodianUserId` (string/UUID, required): must match the exhibit's current custodian exactly
- `toCustodianUserId` (string/UUID, required): the intended receiver
- `reason` (string, optional, max 300 chars)
- `actorUserId` (string/UUID, required): must hold an F20-authorized propose role

**Inputs — Confirm:**
- `exhibitId` (string/UUID, required)
- `proposedEventId` (string/UUID, required): must reference the currently-pending `CUSTODY_TRANSFER_PROPOSED` event for this exhibit
- `actorUserId` (string/UUID, required): must exactly equal the pending transfer's named receiver

**Inputs — Cancel:**
- `exhibitId` (string/UUID, required)
- `proposedEventId` (string/UUID, required): must reference the currently-pending proposal
- `reason` (string, optional, max 300 chars)
- `actorUserId` (string/UUID, required): must be the original proposer or hold an F20-authorized propose role

**Outputs:**
- Propose: updated `CustodyCurrentState` (pending fields populated, `currentCustodianUserId` unchanged), the created `ExhibitEvent` row
- Confirm: updated `CustodyCurrentState` (`currentCustodianUserId` updated, pending fields cleared), the created `ExhibitEvent` row
- Cancel: updated `CustodyCurrentState` (pending fields cleared, `currentCustodianUserId` unchanged), the created `ExhibitEvent` row
- `getCustodian` output shape extended with `pendingTransfer: { toUserId, proposedAt, eventId } | null`

**Validation:**
- Propose: `fromCustodianUserId` must exactly match `CustodyCurrentState.currentCustodianUserId` (F03's existing rule, unchanged) — reuses `CUSTODY_CHAIN_BROKEN`
- Propose: rejected if a transfer is already pending for this exhibit — one outstanding proposal at a time, per exhibit
- Propose: `toCustodianUserId` must reference a valid active `User`; `fromCustodianUserId`/`toCustodianUserId` must differ (F03's existing `NO_OP_TRANSFER`, unchanged)
- Confirm: rejected if no transfer is currently pending for this exhibit, or if `proposedEventId` does not match the currently-pending proposal
- Confirm: rejected if `actorUserId` does not exactly equal the pending transfer's `toCustodianUserId` — this check is an identity match, not a role check; even a user whose role is generally authorized to confirm custody cannot confirm on behalf of a different named receiver
- Cancel: rejected if no transfer is currently pending, or if the actor is neither the original proposer nor holds an F20-authorized propose role
- The legacy unilateral `POST /api/exhibits/:id/events/custody` endpoint (F03) is retained **only** for the F18 intake-bootstrap case (`fromCustodianUserId: null`) — if called with a non-null `fromCustodianUserId` (i.e., for any transfer after the first), it is rejected, directing the caller to the propose/confirm endpoints instead

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| Propose attempted while a transfer is already pending | 409 | CUSTODY_TRANSFER_ALREADY_PENDING | "A custody transfer is already pending for this exhibit" |
| Confirm/cancel attempted with no transfer currently pending, or a mismatched `proposedEventId` | 404 | CUSTODY_CONFIRMATION_NOT_PENDING | "No pending custody transfer found matching this request" |
| Confirm attempted by anyone other than the named receiver | 403 | CUSTODY_CONFIRM_WRONG_USER | "Only the named receiving custodian may confirm this transfer" |
| Legacy unilateral custody endpoint called for a non-first transfer (`fromCustodianUserId` non-null) | 409 | CUSTODY_TRANSFER_REQUIRES_CONFIRMATION | "Transfers after the first must use the propose/confirm flow" |
| All other custody errors (chain-broken on propose, invalid custodian, no-op transfer, exhibit not found) | — | — | Unchanged — see F03 §Error States |

**API Surface (this feature):** amends `POST /api/exhibits/:id/events/custody` (F3) to reject non-first-transfer calls; adds `POST /api/exhibits/:id/events/custody/propose`, `POST /api/exhibits/:id/events/custody/confirm`, `POST /api/exhibits/:id/events/custody/cancel` — see `Y1-api.md` §Custody (amended).

**Schema Surface (this feature):** adds `CUSTODY_TRANSFER_PROPOSED`, `CUSTODY_TRANSFER_CONFIRMED`, `CUSTODY_TRANSFER_CANCELLED` to the `EventType` enum; adds `pendingTransferToUserId` (nullable), `pendingTransferEventId` (nullable), `pendingTransferProposedAt` (nullable) to `CustodyCurrentState` — see `Y0-schema.md` §Current-State Projections (amended). The legacy `CUSTODY_TRANSFER` event type is retained for the F18 intake-bootstrap path's historical/first-link semantics only where already written by prior-version seed data; new intake links use `CUSTODY_TRANSFER_CONFIRMED` per §Process step 1.
