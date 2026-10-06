## F02: Objection and Ruling Tracking

**Description:** Logs objections raised against specific exhibits and the judicial rulings that resolve them, each as independent, immutable ledger events. Multiple objections against the same exhibit are tracked as separate, independently-resolvable threads — never collapsed into a single "last ruling" field.

**Terminology:**
- **Objection Thread:** The lifecycle from an `OBJECTION_RAISED` event to its resolving `RULING_RECORDED` event, linked by a shared `objectionId` (generated at raise-time, stored in both events' payloads).
- **Ruling Disposition:** One of `SUSTAINED`, `OVERRULED`, `RESERVED`. A `RESERVED` ruling does not close the objection thread — it remains `UNRESOLVED` until a subsequent `RULING_RECORDED` event supersedes it with `SUSTAINED` or `OVERRULED`.

**Sub-features:**
- Log an objection (party, grounds, timestamp) against a specific exhibit
- Record a ruling against a specific objection thread
- Query all unresolved objections case-wide
- Feed objection resolution state into F1 (status gating) and F6 (discrepancy detection)

**Process:**
1. An attorney objects during proceedings; the deputy/clerk records it via `recordEvent({ exhibitId, eventType: 'OBJECTION_RAISED', payload: { objectionId: <new UUID>, objectingParty, grounds }, actorUserId })`.
2. The service layer appends the `ExhibitEvent` row and creates a new `ObjectionCurrentState` row: `{ objectionId, exhibitId, status: 'UNRESOLVED', objectingParty, grounds, raisedEventId, raisedAt }`.
3. The service layer checks F1's state machine — if the exhibit's current status is `OFFERED`, it is eligible to transition to `OBJECTED` (a separate explicit `STATUS_CHANGE` event, not automatic, per F1 §Process step 1 — the deputy records both).
4. When the judge rules, the deputy/clerk records `recordEvent({ exhibitId, eventType: 'RULING_RECORDED', payload: { objectionId, disposition }, actorUserId })`.
5. The service layer validates the referenced `objectionId` exists and is currently `UNRESOLVED` on this exhibit.
6. If `disposition` is `SUSTAINED` or `OVERRULED`, the service layer updates `ObjectionCurrentState.status` to that disposition and sets `rulingEventId`, `ruledAt` — the thread is now resolved and excluded from "unresolved objections" queries.
7. If `disposition` is `RESERVED`, the thread's `status` remains `UNRESOLVED` but `ObjectionCurrentState` records the reservation event for history/timeline display (F10); it still counts as unresolved for discrepancy purposes (F6).
8. `getUnresolvedObjections(caseId)` — the shared service function — queries `ObjectionCurrentState WHERE status = 'UNRESOLVED'` and is called identically by the Case Workspace (F9), Command Center (F8), and the assistant tool `getUnresolvedObjections` (F7).

**Inputs — Objection:**
- `exhibitId` (string/UUID, required)
- `objectingParty` (enum: `PLAINTIFF` | `PROSECUTION` | `DEFENSE`, required)
- `grounds` (string, required, max 500 chars): e.g., "hearsay", "lack of foundation"
- `actorUserId` (string/UUID, required)

**Inputs — Ruling:**
- `objectionId` (string/UUID, required): must reference an existing, currently-unresolved objection thread
- `disposition` (enum: `SUSTAINED` | `OVERRULED` | `RESERVED`, required)
- `actorUserId` (string/UUID, required): must be a `JUDGE`-role user for `SUSTAINED`/`OVERRULED` (demo-level role check, not cryptographic enforcement)

**Outputs:**
- `ObjectionCurrentState` row reflecting the new or updated thread status
- The created `ExhibitEvent` row(s), returned with `id` for citation

**Validation:**
- `grounds` must be non-empty
- An objection can only be raised against an exhibit whose current status (F1) is `OFFERED` or already `OBJECTED` (cannot object to an exhibit not yet offered, or after it has reached a terminal status)
- A ruling's `objectionId` must exist and currently be `UNRESOLVED` — rejects rulings against already-resolved or nonexistent threads
- `actorUserId` recording a `SUSTAINED`/`OVERRULED` ruling must have role `JUDGE` — reject otherwise (demo-level enforcement via seeded role, see `00-header.md` §Role)
- A single exhibit may have N concurrent `UNRESOLVED` objection threads — the schema and queries must never assume at most one

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| Objection raised on exhibit not yet offered | 422 | INVALID_OBJECTION_TARGET | "Cannot raise an objection before the exhibit is offered" |
| Ruling references nonexistent objectionId | 404 | OBJECTION_NOT_FOUND | "No objection found with the given ID" |
| Ruling references already-resolved objection | 409 | OBJECTION_ALREADY_RESOLVED | "This objection has already been ruled on" |
| Non-judge attempts SUSTAINED/OVERRULED ruling | 403 | ROLE_NOT_PERMITTED | "Only a judge may record a sustained or overruled ruling" |

**API Surface (this feature):** see `Y1-api.md` §Objections for `POST /api/exhibits/:id/events/objection`, `POST /api/objections/:id/ruling`, `GET /api/cases/:id/objections?status=unresolved`.

**Schema Surface (this feature):** writes `ExhibitEvent` (types `OBJECTION_RAISED`, `RULING_RECORDED`); maintains `ObjectionCurrentState` — see `Y0-schema.md` §Event Ledger, §Current-State Projections.
