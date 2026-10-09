## F18: Custodian Required at Intake (MARKED)

**Description:** Moves the custodian requirement from F12's admission-time check to the very first status transition (`(none) → MARKED`), so no exhibit can ever exist in the system having entered the admission lifecycle with no custodian of record — closing the window, previously open from intake until admission, during which an exhibit's custody chain had no starting link. The custodian is supplied as a required parameter alongside the `MARKED` transition itself and validated/written in the same transaction, so there is no separate manual step a user could skip or forget.

**Terminology:**
- **Intake Custodian:** The `toCustodianUserId` established atomically with an exhibit's first-ever `STATUS_CHANGE` event (`(none) → MARKED`). Functionally identical to any other custody-chain link (F03 §Terminology) but created as part of the same transaction as the status transition rather than via a subsequent, separate call.

**Sub-features:**
- The `(none) → MARKED` transition now requires a non-null `custodianUserId` parameter
- Both the `STATUS_CHANGE` event and the exhibit's first `CUSTODY_TRANSFER`-family event (see F19 §Process for the first-assignment exception) are appended within the same database transaction
- `createExhibit` (F0, identity-only) is unchanged — it accepts no status or custody fields, exactly as before; the new requirement attaches exclusively to the first `recordStatusChange` call, not to exhibit creation
- F12's existing admission-time custodian check (F12 §Process step 3b) is retained unchanged as a second, later gate — this feature does not replace it, since a custody chain established at intake could in principle still break before admission (e.g., a future custody event with a null result), and F12's later check remains the final backstop

**Process:**
1. `createExhibit` (F0) creates the `Exhibit` identity row exactly as before — no status, no custodian. An exhibit with zero `ExhibitEvent` rows continues to report "not yet entered into evidence" (F0 §Outputs), unaffected by this feature.
2. A caller requests the exhibit's first status transition via the same endpoint as every other transition (`POST /api/exhibits/:id/events/status`, F1), with `toStatus = MARKED` and a new required body field `custodianUserId`.
3. The service layer runs F1's existing zero-prior-events check (F01 §Validation: "only accepts `toStatus = MARKED` as its first transition") — unchanged.
4. **New gate, evaluated only when this is the exhibit's first-ever `STATUS_CHANGE` event (i.e., `toStatus = MARKED` with no prior events):** the service layer validates that `custodianUserId` is present and references an existing, active `User` (reusing F03 §Validation's existing `INVALID_CUSTODIAN` check). If absent or invalid, the request is rejected before any write occurs.
5. If the gate passes, the service layer — within a single database transaction — (a) appends the `STATUS_CHANGE` event (`fromStatus: null, toStatus: 'MARKED'`), (b) appends a `CUSTODY_TRANSFER_CONFIRMED` event (`fromCustodianUserId: null, toCustodianUserId: custodianUserId`) establishing the exhibit's first-ever custody link directly, with no preceding `CUSTODY_TRANSFER_PROPOSED` event (see `F19-custody-handoff-confirmation.md` §Process step 1 and §Design Decisions for why this specific event is a documented single-phase bootstrap exception to F19's general two-phase model), and (c) updates both `ExhibitCurrentState` and `CustodyCurrentState` together.
6. If the transaction fails for any reason, neither the status event nor the custody event is persisted — there is no intermediate state where an exhibit is `MARKED` with no custodian, even transiently.
7. All subsequent transitions (`MARKED → OFFERED`, etc.) and all subsequent custody transfers are unaffected by this feature and follow F1/F19's existing rules unchanged.
8. The seed loader (F0 §Process step 3) is amended so every seeded exhibit's first `recordEvent` call for `STATUS_CHANGE` includes a `custodianUserId` — a seed assertion (F0 §Validation) now additionally fails fast if any seeded exhibit's `MARKED` transition was recorded without one, preventing the seed loader itself from producing a state the live system could no longer produce.

**Inputs:**
- `exhibitId` (string/UUID, required) — same as F1
- `toStatus` (enum, required) — same as F1
- `actorUserId` (string/UUID, required) — same as F1
- `notes` (string, optional) — same as F1
- `custodianUserId` (string/UUID, **required only when this is the exhibit's first-ever `STATUS_CHANGE` event, i.e. `toStatus = MARKED` with zero prior events**): the user established as the exhibit's intake custodian, atomically with the transition

**Outputs:**
- On success: identical to F1 §Outputs, plus the `CustodyCurrentState` row created in the same transaction (returned alongside the `STATUS_CHANGE` event's response so the caller sees both writes without a second round-trip)
- On rejection: `{ error: { code: 'CUSTODIAN_REQUIRED_AT_INTAKE', message } }`, or F03's existing `INVALID_CUSTODIAN` shape if a `custodianUserId` was supplied but does not reference a valid active user

**Validation:**
- `custodianUserId` must be present and non-null when, and only when, the transition being recorded is the exhibit's first-ever `STATUS_CHANGE` event with `toStatus = MARKED` — all other transitions (including any that are not the first event) do not require or accept this field
- `custodianUserId`, when supplied, must reference an existing, active `User` — reuses F03's existing `INVALID_CUSTODIAN` validation and error code, not a new one
- The status write and the custody write are atomic — both succeed or both fail; there is no code path producing a `MARKED` exhibit with no `CustodyCurrentState` row
- F12's admission-time custodian check (F12 §Validation) is unchanged and continues to run independently at the `ADMITTED` transition — this feature does not weaken, replace, or make redundant that later check

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| First-ever `MARKED` transition attempted with no `custodianUserId` | 422 | CUSTODIAN_REQUIRED_AT_INTAKE | "A custodian must be established when an exhibit is first marked into evidence" |
| `custodianUserId` supplied but does not reference a valid active user | 422 | INVALID_CUSTODIAN | "custodianUserId does not reference a valid active user" *(reused from F03)* |
| All other status-transition errors (invalid transition, finalized status, stale-state conflict, exhibit not found, admission-blocked) | — | — | Unchanged — see F01/F12 §Error States |

**API Surface (this feature):** amends `POST /api/exhibits/:id/events/status` (F1) — body gains conditionally-required `custodianUserId` when this is the exhibit's first transition. See `Y1-api.md` §Status (amended).

**Schema Surface (this feature):** introduces no new tables or fields. Writes the existing `ExhibitEvent`/`CustodyCurrentState` shapes (F03) one transaction earlier than before; reads existing `User` for validation — see `Y0-schema.md` §Event Ledger, §Current-State Projections (unchanged shapes, amended write-timing only).
