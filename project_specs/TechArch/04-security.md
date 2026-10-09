
## 5. Security Architecture

JudicialSync's security model is explicitly scoped for a **sales/demo environment**, not a production court system. Per PROJECT.md, production-grade authentication/authorization hardening was originally scoped entirely out — but role-based *visibility* and *write-authorization* were always first-class, enforced requirements because they are core to the demo's credibility with a legal audience (a judge seeing sealed sidebar material leaked to an attorney's screen would be a trust-ending failure during a sales demo, even without real cryptographic stakes).

> **SUPERSEDED, in part, by Phase 7.1 (F20):** the blanket "authentication/authorization hardening is out of scope" framing above is now narrowed to **authentication only**. Proving who a user is (OAuth/OIDC, session hardening, MFA) remains explicitly out of scope — see §5.1 and §5.5, unchanged. **Authorization — what a known, seeded role may do — is as of Phase 7.1 a fully enforced, in-scope capability covering every write action in the system**, not merely the three actions (ruling disposition, jury finalization, discrepancy acknowledgment) gated ad hoc prior to this phase. This history is preserved here, not deleted, because it documents *why* the earlier partial gating existed before being generalized. See §5.2.2a below for the current, canonical authorization model.

### 5.1 Authentication (Demo-Scoped)

| Aspect | Approach |
|---|---|
| Identity mechanism | Seeded `users` rows (one per `role_type` minimum), selected via a client-side **role switcher** component — no password, OAuth, SSO, or JWT |
| Session | A lightweight client-side session (zustand store, optionally mirrored to a cookie) holds the active `userId`/`role`; sent with every request as part of `RequestContext` (`03-api.md` §4.12) |
| What's explicitly NOT implemented | OAuth/OIDC providers, password hashing, MFA, session-fixation protections, CSRF tokens on state-changing routes, rate limiting — all out of scope per PROJECT.md and justified by the single-case, <10-user, live-demo context |
| Why this is acceptable here | The demo runs in a controlled environment (live walkthrough or recording) with no real PII, no real case data, and no public internet exposure beyond the presenter's controlled session — explicitly called out as an "Explicitly avoided" architecture decision in the PRD |
| Upgrade path (if ever productionized) | Replace the role-switcher's `userId`/`role` resolution with a real identity provider (e.g., NextAuth + court-system SSO) feeding the *same* `RequestContext.requestingUserRole` shape — because authorization logic is centralized in `services/visibility.ts`, swapping authentication underneath requires no change to any authorization check |

### 5.2 Authorization Model

Authorization is **role-based**, enforced in exactly one place (`services/visibility.ts` plus per-domain service checks), and applied identically regardless of whether the caller is a UI API route or an assistant tool wrapper. There is no separate "assistant privilege level" — the assistant always presents the same role as the requesting user's active session.

#### 5.2.1 Role-Based Visibility (Read Authorization)

| Role | Sees Sealed Exhibits? | Notes |
|---|---|---|
| `JUDGE` | Yes | Full visibility, including chambers-only annotations |
| `CHAMBERS_STAFF` | Yes | Mirrors judge visibility |
| `ADMIN` | Yes | Compliance/audit review requires full visibility |
| `DEPUTY` | No | Operational role; sealed material is chambers-restricted |
| `CLERK` | No | Maintains official record but not sealed/in-camera content |
| `ATTORNEY` | No | Default deny; per-attorney ACL grants are explicitly out of scope for this demo |

**Amended Phase 7.1 (F16):** `isSealed` — the boolean this table's enforcement reads — is now a **write-once mirror** of the new three-value `classification` enum (`TRIAL` / `CHAMBERS_EX_PARTE` / `SEALED`), set exactly once at exhibit creation as `isSealed = (classification !== 'TRIAL')` and never independently set thereafter. Because `isSealed` is classification-consistent by construction, this table and every enforcement call site below are **unaffected in behavior** — a `CHAMBERS_EX_PARTE` exhibit is already treated with the same visibility rigor as a `SEALED` one everywhere this boolean governs. No second visibility pass keyed on `classification` directly was required. See `01-components.md` §2.2 (`services/exhibits.ts`, `services/visibility.ts`) and `02-data-model.md` §3.10.

**Enforcement mechanics:**
- Sealed-exhibit exclusion is applied as a `WHERE` predicate inside every service-layer read function that returns exhibit rows (`getExhibits`, `searchExhibits`, `getExhibitHistory`, and transitively every assistant tool that wraps them) — never as a post-query filter in the API route or UI component.
- A direct-ID read of a sealed exhibit by an unauthorized role (`GET /api/exhibits/:id`, `GET /api/exhibits/:id/history`, or the assistant's equivalent tool call) returns **404 `EXHIBIT_NOT_FOUND`** — byte-identical in shape, message, and (as far as practical) timing to the genuine not-found case. This is a deliberate anti-enumeration measure: an unauthorized role must never be able to distinguish "doesn't exist" from "exists but you can't see it."
- The assistant's Decline Response ("I don't have that information") is the natural-language equivalent of this same 404-masking behavior — the system prompt instructs the model to never reveal that a sealed record exists, even indirectly (e.g., never say "I can't show you Exhibit 9 because it's sealed"; the correct response is identical to the no-such-exhibit case).

#### 5.2.2 Write Authorization (Action Gating) — Pre-Phase-7.1 Partial Table (SUPERSEDED, kept for history)

> **This table is superseded by the full Permission Matrix in §5.2.2a below.** It is retained, not deleted, because it accurately documents the system's authorization coverage *before* Phase 7.1 (F20): only three actions were role-gated server-side, each implemented as its own ad hoc check; every other write action (exhibit creation, every status transition, raising an objection, custody transfer) had no server-side role restriction at all beyond "any valid seeded user."

| Action | Required Role(s) | Enforcement Point |
|---|---|---|
| Record `SUSTAINED`/`OVERRULED` ruling | `JUDGE` | `services/objections.ts#recordRuling` |
| Finalize jury package | `DEPUTY`, `CLERK`, `ADMIN` | `services/juryPackage.ts#finalizeJuryPackage` |
| Initiate/compute jury package draft | `DEPUTY`, `CLERK`, `ADMIN` | `services/juryPackage.ts#computeJuryCandidates` |
| Acknowledge a discrepancy flag | `DEPUTY`, `CLERK`, `JUDGE`, `ADMIN` | `services/discrepancies.ts#acknowledgeDiscrepancy` |
| Exclude an exhibit from a jury package (remediation action) *(added Phase 7, F13)* | `DEPUTY`, `CLERK`, `ADMIN` — identical gate to finalize | `services/juryPackage.ts#excludeJuryPackageExhibit` |
| Record status change, objection, custody transfer | Any authenticated (seeded) user via `actorUserId` | **No role restriction** beyond being a valid active `users` row — this gap is exactly what §5.2.2a closes |

**Rule (unchanged, still authoritative):** `403 ROLE_NOT_PERMITTED` is reserved exclusively for write/action gating. It is **never** used to signal "this record exists but you can't see it" — that is always the 404-masking pattern above. Conflating the two would leak existence information through the HTTP status code itself.

#### 5.2.2a Full Server-Side Permission Matrix (Phase 7.1, F20) — Current, Canonical Authorization Model

**This is the single source of truth for which `Role` may perform which write action, system-wide, as of Phase 7.1.** It replaces the partial coverage in §5.2.2 above by extending server-side role enforcement — previously applied only to ruling disposition, jury finalization, and discrepancy acknowledgment — to **every** write action in the system.

**Role Resolution (the only trusted source of a user's role for authorization):** every gated action resolves `actorUserId`'s `role` column via a direct, server-side `User` table lookup — **never** from a client-supplied role claim in a request body, header, or client-side store. A request asserting a role the database does not confirm is simply ignored; the resolved database role is authoritative.

**`assertRole(actorUserId, allowedRoles, actionLabel)`** — the single shared service-layer helper (new module `services/authorization.ts`, see `01-components.md` §2.2) generalizing the pattern already used, prior to this phase, only by `recordRuling`'s ad hoc judge-check and jury-package's `assertJuryWriteRole`. Every action below calls this helper, or an action-specific wrapper around it, as the **first statement** in its handler — before any field-level validation, state-machine check, or ledger write — so a disallowed-role request is rejected before it can leak any information about the request's validity.

**Permission Matrix:**

| # | Action | JUDGE | CHAMBERS_STAFF | DEPUTY | CLERK | ATTORNEY | ADMIN | Status Before F20 |
|---|---|---|---|---|---|---|---|---|
| 1 | Create exhibit | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ | **New gate** |
| 2 | Mark / Offer / Withdraw status transition | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ | **New gate** |
| 3 | Admit / Exclude status transition | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ | **New gate** |
| 4 | Raise objection | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | **New gate** |
| 5 | Record ruling (SUSTAINED/OVERRULED/RESERVED) | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | Unchanged (F02) |
| 6 | Propose custody transfer | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ | **New gate** |
| 7 | Confirm custody transfer receipt | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ *(plus identity match — see §5.2.2b)* | **New gate** |
| 8 | Acknowledge discrepancy | ✓ | ✗ | ✓ | ✓ | ✗ | ✓ | Unchanged (F06) |
| 9 | Initiate / finalize jury package | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ | Unchanged (F05) |
| 10 | Exclude jury package exhibit | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ | Unchanged (F13) |

**Reading the matrix:**
- Rows 5, 8, 9, 10 are included for completeness — the matrix must be the complete, single documented reference — but their enforcement is **unchanged** by F20; they are retrofitted onto the shared `assertRole` helper for consistency, not newly gated.
- Rows 1–4, 6, and 7 are the **new** server-side gates this phase adds.
- `CHAMBERS_STAFF` has full read/visibility (§5.2.1) but **no write permission for any action in this matrix** — it is a strictly read-only role in this version.
- `ATTORNEY` is permitted exactly **one** write action (raise objection) and is otherwise read-only, matching the PRD's explicit "Attorneys: raise objections, read/view only — no write access outside objections."
- There is **no implicit "ADMIN can always do anything" override** beyond what this table explicitly lists — `ADMIN` is in fact excluded from row 5 (ruling disposition), which remains strictly `JUDGE`-only with no exception.
- A malformed request from a disallowed role is still rejected with `403 ROLE_NOT_PERMITTED` before field-level validation runs — no information about the request's validity is leaked to an unauthorized actor.

**New `ROLE_NOT_PERMITTED` message variants (rows 1–4, 6, 7 — net-new as of this phase):**

| Action | Message |
|---|---|
| Create exhibit | "Only a courtroom deputy, clerk, or admin may create an exhibit" |
| Mark/offer/withdraw/admit/exclude status transition | "Only a courtroom deputy, clerk, or admin may record this status transition" |
| Raise objection | "Only an attorney, courtroom deputy, clerk, or admin may raise an objection" |
| Propose custody transfer | "Only a courtroom deputy, clerk, or admin may propose a custody transfer" |
| Confirm custody transfer | "Only a courtroom deputy, clerk, or admin may confirm custody receipt" |

Rows 5, 8, 9, 10 retain their pre-existing, unchanged messages (see §5.2.2 above).

**UI consistency (non-binding recommendation, not a security control):** screens are updated so a control for an action the current role cannot perform is not rendered as an enabled, silently-failing control — consistent with F14's existing disclosure principle. **This is a UX recommendation only; the server-side gate above is authoritative regardless of what the UI renders**, since a client is never a trust boundary in this architecture.

**Assistant tools are unaffected:** none of the 8 assistant tools (`01-components.md` §2.3) perform a write in this version, so F20's matrix does not apply to any of them today. If a future write-capable tool is ever added, it must call the identical `assertRole` helper with the requesting user's resolved role — per the existing "no assistant admin override" principle (§5.4) — there is no separate, elevated authorization path for the assistant.

**Phase 8 (F24) does not change this matrix.** Rows 5 (ruling disposition), 6 (propose custody), and 7 (confirm custody) already gated `recordRuling` and the custody propose/confirm/cancel functions server-side — F24 simply gives a UI control the ability to trigger those already-gated functions for the first time, from the Command Center attention feed (F08) and the Exhibit Detail right rail (F10). The matrix's role column values, enforcement point, and `ROLE_NOT_PERMITTED` messages are unchanged by this phase. The one new UI-visibility consequence: because F24 is the system's first surface where an unauthorized role would otherwise see an enabled-but-rejecting control, the "UI consistency" recommendation above (control not rendered for a disallowed role) is elevated, for F24 specifically, from a non-binding recommendation to a stated feature requirement (FRD `F24-write-action-ui-coverage.md` §Validation) — the server-side gate remains authoritative regardless of what renders, exactly as for every other screen.

#### 5.2.2b Custody Confirmation — Role AND Identity, Two Independent Checks (Phase 7.1, F19 + F20)

Custody transfer confirmation (matrix row 7) is the one action in the system gated by **two independent checks that must both pass**, not one:

1. **Role check (F20):** `assertRole(actorUserId, ['DEPUTY','CLERK','ADMIN'], 'confirm custody receipt')` — is this actor's role generally permitted to confirm custody transfers at all?
2. **Identity check (F19, unchanged by F20):** does `actorUserId` exactly equal `CustodyCurrentState.pendingTransferToUserId` — i.e., is this actor the *specific, named* receiver of *this particular* pending proposal?

A `DEPUTY` who is role-permitted in general but is **not** the named receiver of the pending transfer is correctly rejected — but with `403 CUSTODY_CONFIRM_WRONG_USER` (F19's identity-match error), **not** `403 ROLE_NOT_PERMITTED` (F20's role error). The two error codes are deliberately distinct so a caller (or a test) can tell *which* of the two independent checks failed. Neither check can substitute for the other: a role-permitted, non-named user is rejected by check 2; a named-receiver user whose role is not in the allowed set (a hypothetical — in practice the named receiver of a custody transfer is always a `DEPUTY`/`CLERK`/`ADMIN` per who is eligible to hold custody) would be rejected by check 1.

#### 5.2.2c Jury Package Finalization Request — Inverse Role Gate (Phase 8, F11)

`POST /api/jury-package/:id/request-finalization` is gated by the **inverse** of matrix row 9's finalize-authorized set: it rejects `403 ROLE_NOT_PERMITTED` ("This role can finalize directly and does not need to request it") if `actorUserId`'s resolved role **is** `DEPUTY`/`CLERK`/`ADMIN` — these roles already have a direct finalize path and have no use for a request-finalization action. Every other visible role (`JUDGE`, `CHAMBERS_STAFF`, `ATTORNEY`) is permitted. This is the one gate in the system defined as "not in the matrix-9 set" rather than "in an explicit allow-list," because the action exists specifically to serve roles the matrix excludes from finalizing. It is not a new row in the Permission Matrix (§5.2.2a) — it governs a different action (requesting, not finalizing) with its own new endpoint and its own error message; see `03-api.md` §4.7 and Y2-errors.md's "Jury Package Finalization Request Errors (F11)" in the FRD. Like every control in §5.2.2a, this is resolved from `actorUserId`'s database-stored role, never a client claim, and it confers no authority of its own — a successful request never bypasses or weakens F5's discrepancy gate.

#### 5.2.3 Admission Integrity Gate — Data Invariant, Not Role-Based (Added Phase 7, F12)

Unlike every control in §5.2.2, the Admission Gate inside `services/status.ts#recordStatusChange` is **not** a role/authorization check — it is a data-integrity precondition that applies identically regardless of the acting user's role. When `toStatus = ADMITTED`, the service layer rejects the request with `422 ADMISSION_BLOCKED` if an unresolved objection or a missing/null custodian is present for the exhibit, evaluated against the existing `ObjectionCurrentState`/`CustodyCurrentState` projections in the same transaction as the write.

| Property | Value |
|---|---|
| Who it applies to | Every caller — UI action, direct API client, seed loader. There is no "force admit" parameter, admin override, or elevated-role bypass. |
| What it returns | `422 ADMISSION_BLOCKED` with a `reasons[]` array (`UNRESOLVED_OBJECTION`, `NO_CUSTODIAN`) — never `403 ROLE_NOT_PERMITTED`, since this is not an authorization failure |
| Why it is not modeled as a role check | The condition being guarded against (an exhibit improperly admitted) is a fact about the exhibit's state, not a fact about who is acting — a `JUDGE` attempting the same transition is blocked exactly as a `DEPUTY` would be |
| Relationship to F6 | F6's `ADMITTED_NO_CUSTODIAN` / `UNRESOLVED_OBJECTION_JURY_ELIGIBLE` discrepancy rules remain unchanged and continue to cover conditions that arise *after* a valid admission (e.g., a custody transfer later breaking the chain) — they are no longer the sole backstop for the admission transition itself |

**Hardening note (Phase 7.1, F17 — documentation/test-only, no new mechanism):** F17 formally closed the theoretical question of whether an `OBJECTED → ADMITTED` transition could ever succeed without every objection thread having been ruled on. Having re-examined the gate above in full, **the answer is that this was already structurally impossible** — `ObjectionCurrentState.status` can leave `UNRESOLVED` only via a `RULING_RECORDED` ledger event (F02), and there is no non-ledger write path to that projection anywhere in the service layer. F17 therefore adds **zero new runtime code** to this gate: its entire contribution is (1) naming this as a formal, traceable invariant in the FRD/TechArch rather than leaving it an emergent property of two unrelated features, and (2) dedicated regression test coverage exercising the bypass attempt directly (rejected, unchanged `ADMISSION_BLOCKED`/`UNRESOLVED_OBJECTION` response) and confirming the legal direct `OFFERED → ADMITTED` path (zero objection threads) remains unaffected. If a future code change ever introduced a direct current-state mutation bypassing `recordEvent`, this regression suite — not this gate's current logic — is what would catch it.

**Interaction with F18 (Phase 7.1):** F18 moves the *custodian* requirement to intake (`services/status.ts#recordStatusChange`'s first-ever call, `(none) → MARKED`), established atomically in the same transaction as the status write. This is a distinct, earlier-lifecycle gate, documented in full at `06-integrations.md` §Intake Custody Gate — F12's admission-time custodian check above is **retained unchanged** as an independent, later backstop (a custody chain established at intake could in principle still break before admission via a future event), not replaced or weakened by F18.

See `01-components.md` §2.2 (`services/status.ts`) and `06-integrations.md` §Admission Gate / §Intake Custody Gate for the full process sequence.

### 5.3 Data Protection

| Concern | Approach |
|---|---|
| Data at rest | Neon Postgres managed encryption-at-rest (provider default); no additional application-level encryption of exhibit/ledger data — not warranted for seeded demo data |
| Data in transit | TLS for all client↔Vercel and Vercel↔Neon connections (provider default); TLS for the server↔Anthropic API call |
| Input validation | Every write endpoint's body and every assistant tool-call's arguments are validated via **zod schemas** before reaching Prisma — malformed input (e.g., non-UUID `exhibitId`, out-of-enum `offeringParty`) is rejected with `422 VALIDATION_ERROR` (API) or a tool-level `TOOL_ARGS_INVALID` error (assistant), never silently coerced or passed through |
| Ledger immutability | `exhibit_events` rows are never updated or deleted post-insert — enforced at the application layer (only `recordEvent()` writes) and recommended as a DB-role-level `REVOKE UPDATE, DELETE` safeguard if this schema is ever deployed beyond a single presenter's demo environment |
| Secrets management | Anthropic API key and Neon connection string stored as Vercel environment variables, never committed to source control or exposed to the client bundle (assistant route runs server-side only; the API key never reaches `@ai-sdk/react`'s client-side `useChat` hook) |
| PII / sensitive content | Seed data is synthetic/representative (PROJECT.md scope: no real case data) — no real PII protection regime is required, but the sealed-exhibit visibility model is implemented with production-equivalent rigor specifically because it is the feature most likely to be scrutinized by a legal audience evaluating trustworthiness |

### 5.4 Assistant-Specific Trust & Safety Controls

Because F7 is the feature the entire demo's success depends on, its trust controls are treated as security-equivalent requirements, not merely UX polish:

| Control | Mechanism |
|---|---|
| No ungrounded factual claims | System prompt requires every factual sentence to carry a citation from a tool result returned in the *current turn*; a factual claim with zero citation is treated as a release-blocking defect in testing, not a tunable preference |
| No stale-data reuse across turns | System prompt instructs the model to prefer a fresh tool call over reusing conversation history for status/custody/objection questions, since underlying data may have changed between turns (live proceedings) |
| No "assistant admin override" | Every tool call passes the requesting user's actual role through to the identical service-layer function a UI route would call — there is no elevated or unscoped retrieval path available only to the assistant |
| Deterministic repeated-question behavior | Low/near-zero model temperature configured for tool-selection and answer composition, minimizing answer variance across repeated identical questions during a live or recorded demo walkthrough |
| Full auditability of assistant claims | Every `AssistantMessage` and its `AssistantCitation` rows are persisted (never ephemeral), enabling post-demo spot-check verification that 100% of assistant answers trace to a real ledger/projection record (PRD Success Metrics: "0 instances of ungrounded answers") |
| Tool-argument injection resistance | zod schemas validate every tool-call argument's shape and type before it reaches Prisma — the model cannot pass an arbitrary SQL fragment or malformed filter through a tool call, because tool arguments are typed and parsed, never string-interpolated into a query |

### 5.5 Explicitly Out of Scope (Per PROJECT.md)

> **Narrowed by Phase 7.1 (F20):** this list governed both authentication *and* authorization prior to Phase 7.1. **As of F20, it governs authentication only** — every item below that concerned *authorization* (what a known role may do) has been superseded by the full Permission Matrix in §5.2.2a and is retained here crossed through for history, not as current scope. Items concerning *authentication* (proving who a user is) remain fully out of scope, unchanged.

- Full OAuth/OIDC or SSO integration
- Password-based authentication, MFA, session hijacking protections
- Rate limiting / abuse prevention (acceptable for a controlled demo audience)
- ~~Server-side write-action authorization~~ — **SUPERSEDED by Phase 7.1 (F20):** see §5.2.2a. Every write action is now role-gated server-side against the full Permission Matrix.
- Multi-tenant data isolation across *cases* for a single deployment (as of Phase 7.1, F22, case-scoped query isolation — `WHERE caseId = :selectedCaseId` on every amended query — is implemented and enforced; this item now refers only to isolation across separate *deployments/tenants*, not across cases within one deployment)
- Formal penetration testing / security audit
- Encryption key management beyond provider defaults (Neon, Vercel, Anthropic)

Any future productionization of JudicialSync beyond its demo scope would require revisiting every remaining item in this section — this document deliberately does not pretend otherwise.
