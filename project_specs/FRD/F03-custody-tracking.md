## F03: Custody Tracking

**Description:** Records every custody transfer of a physical or digital exhibit as a discrete, immutable ledger event, and derives both the current custodian and the full chain-of-custody history from that sequence — never from a single mutable "current holder" field, per the chain-of-custody doctrine requiring unbroken, documented, timestamped transfers.

**Terminology:**
- **Custody Transfer:** A single `CUSTODY_TRANSFER` event recording `fromCustodian`, `toCustodian`, timestamp, and reason.
- **Custody Gap:** A period where an exhibit's current status implies it should have a custodian of record but no `CUSTODY_TRANSFER` event exists (or the chain has a logical break) — feeds directly into F6 discrepancy detection.

**Sub-features:**
- Record a custody transfer (who → who, when, why) as a ledger event
- Instant "who currently has this exhibit" lookup via projection
- Full chronological chain-of-custody retrieval for any exhibit
- Feed custody completeness into F6 discrepancy rules

**Process:**
1. A courtroom deputy physically receives or hands off an exhibit and records `recordEvent({ exhibitId, eventType: 'CUSTODY_TRANSFER', payload: { fromCustodianUserId, toCustodianUserId, reason }, actorUserId })`.
2. The service layer validates that `fromCustodianUserId` matches the exhibit's current derived custodian (per `CustodyCurrentState`) — or is `null` if this is the exhibit's first-ever custody event (e.g., initial intake).
3. The service layer appends the immutable `ExhibitEvent` row.
4. The service layer updates `CustodyCurrentState`: `{ exhibitId, currentCustodianUserId: toCustodianUserId, since: recordedAt, lastEventId }`.
5. `getCustodian(exhibitId)` — the shared service function — reads only `CustodyCurrentState`, used identically by Case Workspace (F9), Exhibit Detail (F10), and the assistant's `getCustodian` tool (F7).
6. `getCustodyHistory(exhibitId)` reads the full ordered set of `CUSTODY_TRANSFER` events from the ledger for Exhibit Detail's timeline (F10) and the assistant's "what happened to Exhibit X" answers.
7. On every `recordEvent` write of type `CUSTODY_TRANSFER` or `STATUS_CHANGE`, the service layer re-evaluates the admitted-no-custodian discrepancy rule (F6) for that exhibit.

**Inputs:**
- `exhibitId` (string/UUID, required)
- `fromCustodianUserId` (string/UUID, nullable): required to match current projection unless this is the first transfer
- `toCustodianUserId` (string/UUID, required)
- `reason` (string, optional, max 300 chars): e.g., "transferred to clerk for jury package prep"
- `actorUserId` (string/UUID, required): the user recording the transfer (may differ from either custodian, e.g., a clerk logging on behalf of a deputy)

**Outputs:**
- Updated `CustodyCurrentState` row
- The created `ExhibitEvent` row, with `id` for citation
- Full custody chain array (on `getCustodyHistory`): ordered list of `{ fromCustodian, toCustodian, timestamp, reason, eventId }`

**Validation:**
- `fromCustodianUserId` must exactly match the exhibit's current `CustodyCurrentState.currentCustodianUserId` (or both must be `null`/absent for the first-ever transfer) — prevents recording a transfer from someone who doesn't currently have it
- `toCustodianUserId` must reference an existing, active `User`
- `fromCustodianUserId` and `toCustodianUserId` must not be identical (no-op transfers are rejected)
- An exhibit may have zero custody events even after reaching `ADMITTED` status — this is valid at the schema level but is exactly the condition F6 flags as a discrepancy (by design, to demonstrate detection)

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| fromCustodian mismatch with current projection | 409 | CUSTODY_CHAIN_BROKEN | "Recorded custodian does not match the exhibit's current custodian" |
| toCustodian references invalid/inactive user | 422 | INVALID_CUSTODIAN | "toCustodianUserId does not reference a valid active user" |
| from and to custodian identical | 422 | NO_OP_TRANSFER | "fromCustodianUserId and toCustodianUserId must differ" |
| Exhibit not found | 404 | EXHIBIT_NOT_FOUND | "No exhibit found with the given ID" |

**API Surface (this feature):** see `Y1-api.md` §Custody for `POST /api/exhibits/:id/events/custody`, `GET /api/exhibits/:id/custodian`, `GET /api/exhibits/:id/custody-history`.

**Schema Surface (this feature):** writes `ExhibitEvent` (type `CUSTODY_TRANSFER`); maintains `CustodyCurrentState` — see `Y0-schema.md` §Event Ledger, §Current-State Projections.
