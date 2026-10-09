## F20: Server-Side Role Enforcement Matrix (Full RBAC)

**Description:** Extends server-side role checking — today applied only to ruling disposition (F02), jury-package finalization (F05), and discrepancy acknowledgment (F06) — to every write action in the system, under one explicit, single permission matrix. Every write handler resolves the acting user's role from the `User.role` database column via `actorUserId`, exactly as `recordRuling`'s existing judge-check and `assertJuryWriteRole` already do — never from a client-supplied role claim. This feature formally and explicitly supersedes the PRD's and TechArch's prior "full OAuth/production-grade auth hardening out of scope" note, narrowing it to *authentication* only: proving who a user is (OAuth/OIDC/session hardening) remains out of scope; *authorization* — what a known, seeded role may do — is now fully enforced server-side for every write path.

**Terminology:**
- **Permission Matrix:** The single table below, the canonical and only definition of which `Role` may perform which write action — see `00-header.md` §Cross-Cutting Terminology.
- **Role Resolution:** The act of looking up `actorUserId`'s `role` column from the `User` table at request time, inside the service layer, before the requested write is permitted to proceed. This is the only trusted source of a user's role for authorization purposes — a request body or header asserting a role is never trusted.
- **`assertRole`:** A new shared service-layer helper, `assertRole(actorUserId, allowedRoles: Role[], actionLabel: string)`, generalizing the pattern already used ad hoc by `recordRuling`'s judge-check and `assertJuryWriteRole`. Every write action listed in the matrix below calls this helper (or an action-specific wrapper around it) rather than re-implementing its own role check.

**Sub-features:**
- A single, explicit permission matrix covering every write action in the system (table below)
- `assertRole` shared helper, replacing ad hoc per-feature role checks with one reusable, consistently-tested mechanism
- New `ROLE_NOT_PERMITTED` message variants for each action not already role-gated prior to this feature
- No change to authentication — seeded users + role switcher remain the identity model; this feature hardens what a known role may do, not how identity is established

**Permission Matrix:**

| # | Action | JUDGE | CHAMBERS_STAFF | DEPUTY | CLERK | ATTORNEY | ADMIN | Status Before F20 |
|---|---|---|---|---|---|---|---|---|
| 1 | Create exhibit | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ | **New gate** |
| 2 | Mark / Offer / Withdraw status transition | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ | **New gate** |
| 3 | Admit / Exclude status transition | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ | **New gate** |
| 4 | Raise objection | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | **New gate** |
| 5 | Record ruling (SUSTAINED/OVERRULED/RESERVED) | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | Unchanged (F02) |
| 6 | Propose custody transfer | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ | **New gate** |
| 7 | Confirm custody transfer receipt | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ *(plus identity match — see F19)* | **New gate** |
| 8 | Acknowledge discrepancy | ✓ | ✗ | ✓ | ✓ | ✗ | ✓ | Unchanged (F06) |
| 9 | Initiate / finalize jury package | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ | Unchanged (F05) |
| 10 | Exclude jury package exhibit | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ | Unchanged (F13) |

Rows 5, 8, 9, 10 are included for completeness (the PRD requires the *complete* matrix to be documented in one place) but their enforcement is unchanged by this feature — they are retrofitted onto the same `assertRole` helper for consistency, not newly gated. Rows 1–4, 6, and 7 are the new server-side gates this feature adds. `CHAMBERS_STAFF` has full read/visibility (per `00-header.md` §Role-Based Visibility) but no write permission for any action in this matrix — it is a read-only role in this version. `ATTORNEY` is permitted exactly one write action (raise objection) and is otherwise read-only, matching the PRD's explicit "Attorneys: raise objections, read/view only — no write access outside objections."

**Process:**
1. Every write-handling service function listed in the matrix now begins by calling `assertRole(actorUserId, <allowed roles for this action>, <action label>)` before performing any other validation or write.
2. `assertRole` resolves `actorUserId` to its `User.role` column via a direct database lookup — never trusting a role value passed in the request body or a client-side store.
3. If the resolved role is not in the action's allowed set, `assertRole` throws, and the route handler surfaces `403 ROLE_NOT_PERMITTED` with the action-specific message (see table below) **before** any other validation in that handler runs — a disallowed-role request never reaches field-level validation, state-machine checks, or ledger writes.
4. If the resolved role is permitted, the handler proceeds exactly as already specified in F0–F19 — this feature adds a precondition, it does not alter any downstream logic.
5. For custody confirmation specifically (row 7), `assertRole` is necessary but not sufficient: after the role check passes, F19's separate identity check (`actorUserId` must equal the pending transfer's named receiver) still applies — a `DEPUTY` who is not the named receiver is correctly role-permitted in general but still rejected with `CUSTODY_CONFIRM_WRONG_USER` (F19), not `ROLE_NOT_PERMITTED`. The two checks are independent and both must pass.
6. UI screens are updated so that a control for an action the current role cannot perform is not rendered as an enabled, silently-failing control (consistent with F14's existing disclosure principle) — this is a UI-consistency recommendation, not a server-side requirement; the server-side gate in steps 1–4 is authoritative regardless of what the UI renders.
7. The assistant's tool wrappers (F7) are read-only in this version (none of the 8 tools perform a write) and are therefore unaffected by this matrix — if a future write-capable tool is added, it must call the identical `assertRole` helper with the requesting user's resolved role, per the existing "no assistant admin override" principle (`00-header.md` §Role-Based Visibility).

**Inputs:**
- `actorUserId` (string/UUID, required): already required on every write action listed above (F0–F19) — no new input is introduced; this feature changes only how `actorUserId` is validated (role resolution + enforcement), not what callers must supply
- No new client-supplied role input is introduced by this feature — a client-supplied role claim, if one is ever present in a request, continues to be ignored, exactly as the pre-existing judge-check and `assertJuryWriteRole` already ignore it

**Outputs:**
- No change to the success-path output shape of any existing action — `assertRole` either permits the request to proceed unchanged or rejects it before any processing occurs
- Rejection output: `{ error: { code: 'ROLE_NOT_PERMITTED', message } }`, message varying per action per the table below

**Validation:**
- Role resolution is always via a server-side `User.role` lookup keyed on `actorUserId` — never via a request body field, header, or any other client-supplied value
- Each action's allowed-role set is exactly as listed in the Permission Matrix above — no action has an implicit "ADMIN can always do anything regardless of the table" override beyond what the table explicitly lists (in this matrix, ADMIN is in fact permitted for every action except ruling disposition, which remains strictly JUDGE-only with no exception)
- `assertRole` is called before any other validation in every gated handler — a malformed request from a disallowed role is still rejected with `ROLE_NOT_PERMITTED`, not a field-validation error, so no information about the request's validity is leaked to an unauthorized actor

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| Non-DEPUTY/CLERK/ADMIN attempts to create an exhibit | 403 | ROLE_NOT_PERMITTED | "Only a courtroom deputy, clerk, or admin may create an exhibit" |
| Non-DEPUTY/CLERK/ADMIN attempts a mark/offer/withdraw status transition | 403 | ROLE_NOT_PERMITTED | "Only a courtroom deputy, clerk, or admin may record this status transition" |
| Non-DEPUTY/CLERK/ADMIN attempts an admit/exclude status transition | 403 | ROLE_NOT_PERMITTED | "Only a courtroom deputy, clerk, or admin may record this status transition" |
| Non-ATTORNEY/DEPUTY/CLERK/ADMIN attempts to raise an objection | 403 | ROLE_NOT_PERMITTED | "Only an attorney, courtroom deputy, clerk, or admin may raise an objection" |
| Non-DEPUTY/CLERK/ADMIN attempts to propose a custody transfer | 403 | ROLE_NOT_PERMITTED | "Only a courtroom deputy, clerk, or admin may propose a custody transfer" |
| Non-DEPUTY/CLERK/ADMIN attempts to confirm a custody transfer | 403 | ROLE_NOT_PERMITTED | "Only a courtroom deputy, clerk, or admin may confirm custody receipt" |
| Non-JUDGE attempts SUSTAINED/OVERRULED ruling | 403 | ROLE_NOT_PERMITTED | "Only a judge may record a sustained or overruled ruling" *(unchanged, F02)* |
| Non-DEPUTY/CLERK/JUDGE/ADMIN attempts discrepancy acknowledgment | 403 | ROLE_NOT_PERMITTED | "This role is not permitted to acknowledge discrepancies" *(unchanged, F06)* |
| Non-DEPUTY/CLERK/ADMIN attempts jury package initiate/finalize | 403 | ROLE_NOT_PERMITTED | "Only courtroom deputy, clerk, or admin roles may finalize a jury package" *(unchanged, F05)* |
| Non-DEPUTY/CLERK/ADMIN attempts jury package exhibit exclusion | 403 | ROLE_NOT_PERMITTED | "Only courtroom deputy, clerk, or admin roles may remove an exhibit from a jury package" *(unchanged, F13)* |

**API Surface (this feature):** amends every write endpoint listed in the Permission Matrix to add a `ROLE_NOT_PERMITTED` (403) error response where one did not already exist (rows 1–4, 6, 7) — see `Y1-api.md` §Exhibits, §Status, §Objections, §Custody (all amended). No new endpoints.

**Schema Surface (this feature):** introduces no new tables, fields, or enums. Reads the existing `User.role` column (`Y0-schema.md` §Core Entities, `Role` enum, unchanged) as the sole source of role-resolution truth for every gated action.
