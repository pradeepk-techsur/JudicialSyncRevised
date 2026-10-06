## F06: Discrepancy Identification

**Description:** Automatically evaluates each exhibit against a rule set that cross-checks status, objection/ruling, and custody state simultaneously, surfacing mismatches before they become problems. This is the concrete expression of the "operational awareness" differentiator and is the hard gate in front of jury package finalization (F5).

**Terminology:**
- **Discrepancy Rule:** A named, deterministic function `(exhibit, currentState) → DiscrepancyFlag | null`, evaluated against current-state projections (never re-deriving from the raw ledger on every call, for performance — see `Y0-schema.md` §Performance Notes).
- **Discrepancy Flag Status:** `OPEN` (newly detected, unresolved), `ACKNOWLEDGED` (a human has explicitly accepted the risk, recorded as a ledger event), `RESOLVED` (the underlying condition no longer holds, e.g., a custody transfer was subsequently recorded).

**Sub-features:**
- Rule: admitted exhibit with missing/incomplete custody record
- Rule: exhibit eligible for (or included in) jury package despite an unresolved objection
- Extensible rule registry for additional patterns identified during implementation
- Visible surfacing on Case Workspace (F9) and Jury Package Workspace (F11); answerable via the assistant (F7)
- Explicit acknowledgment flow, itself recorded as an immutable ledger event

**Process:**
1. On every write to `ExhibitEvent` affecting status, objections, or custody for a given exhibit (per F1 §Process step 5, F2 §Process steps 2/6/7, F3 §Process step 7), the service layer calls `evaluateDiscrepancies(exhibitId)`.
2. `evaluateDiscrepancies` runs the full rule registry against the exhibit's current-state projections:
   - **Rule `ADMITTED_NO_CUSTODIAN`:** fires when `ExhibitCurrentState.currentStatus = 'ADMITTED'` AND `CustodyCurrentState` has no row (or its `currentCustodianUserId` is null) for that exhibit.
   - **Rule `UNRESOLVED_OBJECTION_JURY_ELIGIBLE`:** fires when `ExhibitCurrentState.currentStatus = 'ADMITTED'` AND at least one `ObjectionCurrentState` row for that exhibit has `status = 'UNRESOLVED'`.
3. For each rule that fires and has no existing `OPEN` or `ACKNOWLEDGED` `DiscrepancyFlag` row for that exhibit+rule pair, the service layer creates a new `DiscrepancyFlag` row with `status = 'OPEN'`, `detectedAt = now()`, and a `details` payload describing the specific mismatch (e.g., which objection is unresolved).
4. For each previously `OPEN` or `ACKNOWLEDGED` flag whose rule condition no longer holds (e.g., a custody transfer was just recorded), the service layer sets `status = 'RESOLVED'`, `resolvedAt = now()`, `resolvedByEventId` referencing the event that resolved it.
5. `getDiscrepancies(caseId)` — the shared service function — returns all `OPEN`/`ACKNOWLEDGED` flags case-wide, consumed identically by Case Workspace (F9), Jury Package Workspace (F11), and the assistant's `getDiscrepancies` tool (F7).
6. A deputy/clerk may explicitly acknowledge an `OPEN` flag (e.g., "custody gap noted, exhibit is a digital-only record with no physical chain required") via `acknowledgeDiscrepancy({ discrepancyFlagId, actorUserId, justification })`, which appends a `DISCREPANCY_ACKNOWLEDGED` ledger event and updates the flag's `status` to `ACKNOWLEDGED`.
7. Acknowledgment does **not** clear the flag from F5's finalization gate by itself in the sense of hiding it — F5 still requires `status != 'OPEN'` (i.e., `ACKNOWLEDGED` or `RESOLVED` both satisfy the gate), but an `ACKNOWLEDGED` flag remains visibly surfaced on every screen as a recorded risk acceptance, never silently dropped.

**Inputs — Evaluation (system-triggered, no user input):**
- `exhibitId` (string/UUID): triggered internally after relevant ledger writes

**Inputs — Acknowledgment (user-triggered):**
- `discrepancyFlagId` (string/UUID, required)
- `actorUserId` (string/UUID, required): must be role `DEPUTY`, `CLERK`, `JUDGE`, or `ADMIN`
- `justification` (string, required, max 500 chars): free-text reason, stored in the ledger event payload for audit

**Outputs:**
- `DiscrepancyFlag[]` for a case or exhibit: `{ id, exhibitId, ruleCode, status, detectedAt, acknowledgedAt?, acknowledgedBy?, resolvedAt?, details }`
- Confirmation of acknowledgment, including the created ledger event id

**Validation:**
- A `DiscrepancyFlag` is never manually created by a user — only the rule engine creates flags; the only user-initiated mutation is acknowledgment
- `justification` is required and non-empty for acknowledgment — an empty-reason acknowledgment is rejected (ensures the audit trail is meaningful for F6's NFR of auditability)
- Acknowledging an already-`RESOLVED` or already-`ACKNOWLEDGED` flag is a no-op that returns the existing state with a 200, not an error (idempotent)
- The rule registry must be checked after every ledger write that could affect its inputs — a missed re-evaluation (e.g., only checking on exhibit-detail page load) is explicitly disallowed; see `Y3-integrations.md` §Internal Triggers

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| Acknowledgment with empty justification | 422 | JUSTIFICATION_REQUIRED | "A justification is required to acknowledge a discrepancy" |
| discrepancyFlagId not found | 404 | DISCREPANCY_NOT_FOUND | "No discrepancy flag found with the given ID" |
| Non-authorized role attempts acknowledgment | 403 | ROLE_NOT_PERMITTED | "This role is not permitted to acknowledge discrepancies" |

**API Surface (this feature):** see `Y1-api.md` §Discrepancies for `GET /api/cases/:id/discrepancies`, `GET /api/exhibits/:id/discrepancies`, `POST /api/discrepancies/:id/acknowledge`.

**Schema Surface (this feature):** owns `DiscrepancyFlag`; writes `ExhibitEvent` (type `DISCREPANCY_ACKNOWLEDGED`); reads `ExhibitCurrentState`, `ObjectionCurrentState`, `CustodyCurrentState` — see `Y0-schema.md` §Discrepancy Detection.
