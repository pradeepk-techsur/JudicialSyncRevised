## F12: Admission Integrity Gating

**Description:** State-machine enforcement that rejects — rather than permits-then-flags — the transition of an exhibit to `ADMITTED` status when the exhibit still has an unresolved objection thread or has no custodian currently on record. This closes a state-model gap: prior to this feature, both conditions were only detected *after* an invalid admission had already been recorded, via F6's `ADMITTED_NO_CUSTODIAN` and `UNRESOLVED_OBJECTION_JURY_ELIGIBLE` discrepancy rules. This feature moves both checks to a hard pre-write gate inside the shared status-transition service so an invalid admission can never be recorded in the first place, by any caller.

**Terminology:**
- **Admission Gate:** The two new precondition checks inserted into the shared status-transition service function (the same function backing F1's `recordEvent({ eventType: 'STATUS_CHANGE', ... })` path), evaluated specifically — and only — when `toStatus = ADMITTED`, before the `STATUS_CHANGE` event is appended to the ledger.
- **Blocking Reason:** One of `UNRESOLVED_OBJECTION` or `NO_CUSTODIAN` — either or both may apply simultaneously to a single rejected admission attempt.

**Sub-features:**
- Reject admission when ≥1 `ObjectionCurrentState` row for the exhibit has `status = 'UNRESOLVED'`
- Reject admission when no `CustodyCurrentState` row exists for the exhibit (or its `currentCustodianUserId` is null)
- Enforced exclusively inside the shared status-transition service function — not in a screen, not in a single API route handler — so it applies identically regardless of entry point (UI action, direct API call, seed loader, or any future automation)
- Clear, specific, multi-reason rejection response (not a generic validation error)

**Process:**
1. A caller (UI action, API client, or any other path) requests a status transition to `toStatus = ADMITTED` via the same endpoint and service function used by F1 (`POST /api/exhibits/:id/events/status`).
2. The service layer first runs F1's existing `fromStatus`-match check (see F01 §Process step 3) — this is unchanged by this feature.
3. If that check passes and `toStatus = ADMITTED`, the service layer runs the Admission Gate as two independent queries against current-state projections, in the same transaction as the eventual ledger write:
   a. Query `ObjectionCurrentState WHERE exhibitId = :id AND status = 'UNRESOLVED'`. If any row is returned, the `UNRESOLVED_OBJECTION` blocking reason applies.
   b. Query `CustodyCurrentState WHERE exhibitId = :id`. If no row exists, or `currentCustodianUserId` is null, the `NO_CUSTODIAN` blocking reason applies.
4. If either blocking reason applies, the service layer rejects the request with HTTP 422 `ADMISSION_BLOCKED` **before** any `ExhibitEvent` row is appended and **before** `ExhibitCurrentState` is updated — the exhibit's status remains exactly what it was prior to the attempt. The response body lists every applicable blocking reason (both, if both apply), not just the first one encountered.
5. If neither blocking reason applies, F1's normal process continues unchanged (step 4 onward in F01 §Process): the event is appended and `ExhibitCurrentState` is updated.
6. This check runs inside the same service function for every caller — there is no "force admit" parameter, admin override, or alternate code path that bypasses it in this version.
7. **Behavior change from prior releases:** previously, an exhibit could be admitted with an open objection or missing custodian, and the condition was only surfaced afterward via F6's `ADMITTED_NO_CUSTODIAN` / `UNRESOLVED_OBJECTION_JURY_ELIGIBLE` discrepancy flags (see F06 §Process step 2). F6's rules remain in the system and continue to cover conditions that arise *after* a valid admission (e.g., a custody transfer later breaking the chain) — but they are no longer the sole backstop for the admission transition itself, which this feature now blocks outright at the moment it is attempted.
8. An exhibit that is not attempting the `ADMITTED` transition (e.g., one that remains `OBJECTED`) is unaffected by this gate and continues to be covered only by F6's discrepancy rules — a custody gap on a still-open, non-admitted exhibit remains visible as a discrepancy flag (not a rejected transition) exactly as before, so the risk is surfaced before it ever reaches an admission decision.

**Inputs:**
- `exhibitId` (string/UUID, required) — same as F1
- `toStatus` (enum, required) — Admission Gate activates only when this value is `ADMITTED`; all other values are unaffected and follow F1's existing rules unchanged
- `actorUserId` (string/UUID, required) — same as F1
- `notes` (string, optional) — same as F1

**Outputs:**
- On success: identical to F1 §Outputs (updated `ExhibitCurrentState`, the new `ExhibitEvent` row)
- On rejection: `{ error: { code: 'ADMISSION_BLOCKED', message, reasons: Array<{ code: 'UNRESOLVED_OBJECTION' | 'NO_CUSTODIAN', message }> } }` — the `reasons` array contains one entry per applicable blocking condition

**Validation:**
- `toStatus = ADMITTED` is accepted only if zero `ObjectionCurrentState` rows for the exhibit have `status = 'UNRESOLVED'` at check time
- `toStatus = ADMITTED` is accepted only if a `CustodyCurrentState` row exists for the exhibit with a non-null `currentCustodianUserId` at check time
- Both conditions are checked atomically within the same transaction as F1's `fromStatus` check, preventing a race where a concurrent objection or custody write could slip through between validation and ledger append
- This validation applies only to the `ADMITTED` transition — `EXCLUDED` and `WITHDRAWN` transitions are unaffected and may still be recorded with an open objection or custody gap present (an exhibit can be excluded or withdrawn regardless of these conditions)
- There is no override, bypass flag, or elevated-role exception to this gate in this version — every caller, including seed-data loading, is subject to it

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| Admission attempted with ≥1 unresolved objection and/or no custodian of record | 422 | ADMISSION_BLOCKED | "Cannot admit: {n} blocking condition(s) present" (body includes `reasons[]`, each `UNRESOLVED_OBJECTION` or `NO_CUSTODIAN`) |
| All other status-transition errors (invalid transition, finalized status, stale-state conflict, exhibit not found) | — | — | Unchanged — see F01 §Error States |

**API Surface (this feature):** reuses the existing `POST /api/exhibits/:id/events/status` endpoint (F1) — see `Y1-api.md` §Status (amended to list `ADMISSION_BLOCKED` alongside the existing error codes for this route).

**Schema Surface (this feature):** introduces no new tables or fields. Reads existing `ObjectionCurrentState` and `CustodyCurrentState` projections (see `Y0-schema.md` §Current-State Projections); writes nothing beyond the standard `STATUS_CHANGE` event already defined for F1 when the gate passes.
