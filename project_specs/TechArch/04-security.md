
## 5. Security Architecture

JudicialSync's security model is explicitly scoped for a **sales/demo environment**, not a production court system. Per PROJECT.md, production-grade authentication/authorization hardening is out of scope — but role-based *visibility* and *write-authorization* are still first-class, enforced requirements because they are core to the demo's credibility with a legal audience (a judge seeing sealed sidebar material leaked to an attorney's screen would be a trust-ending failure during a sales demo, even without real cryptographic stakes).

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

**Enforcement mechanics:**
- Sealed-exhibit exclusion is applied as a `WHERE` predicate inside every service-layer read function that returns exhibit rows (`getExhibits`, `searchExhibits`, `getExhibitHistory`, and transitively every assistant tool that wraps them) — never as a post-query filter in the API route or UI component.
- A direct-ID read of a sealed exhibit by an unauthorized role (`GET /api/exhibits/:id`, `GET /api/exhibits/:id/history`, or the assistant's equivalent tool call) returns **404 `EXHIBIT_NOT_FOUND`** — byte-identical in shape, message, and (as far as practical) timing to the genuine not-found case. This is a deliberate anti-enumeration measure: an unauthorized role must never be able to distinguish "doesn't exist" from "exists but you can't see it."
- The assistant's Decline Response ("I don't have that information") is the natural-language equivalent of this same 404-masking behavior — the system prompt instructs the model to never reveal that a sealed record exists, even indirectly (e.g., never say "I can't show you Exhibit 9 because it's sealed"; the correct response is identical to the no-such-exhibit case).

#### 5.2.2 Write Authorization (Action Gating)

| Action | Required Role(s) | Enforcement Point |
|---|---|---|
| Record `SUSTAINED`/`OVERRULED` ruling | `JUDGE` | `services/objections.ts#recordRuling` |
| Finalize jury package | `DEPUTY`, `CLERK`, `ADMIN` | `services/juryPackage.ts#finalizeJuryPackage` |
| Initiate/compute jury package draft | `DEPUTY`, `CLERK`, `ADMIN` | `services/juryPackage.ts#computeJuryCandidates` |
| Acknowledge a discrepancy flag | `DEPUTY`, `CLERK`, `JUDGE`, `ADMIN` | `services/discrepancies.ts#acknowledgeDiscrepancy` |
| Exclude an exhibit from a jury package (remediation action) *(added Phase 7, F13)* | `DEPUTY`, `CLERK`, `ADMIN` — identical gate to finalize | `services/juryPackage.ts#excludeJuryPackageExhibit` |
| Record status change, objection, custody transfer | Any authenticated (seeded) user via `actorUserId` | No role restriction beyond being a valid active `users` row — the demo does not gate routine recording actions by role beyond the cases above |

**Rule:** `403 ROLE_NOT_PERMITTED` is reserved exclusively for write/action gating. It is **never** used to signal "this record exists but you can't see it" — that is always the 404-masking pattern above. Conflating the two would leak existence information through the HTTP status code itself.

#### 5.2.3 Admission Integrity Gate — Data Invariant, Not Role-Based (Added Phase 7, F12)

Unlike every control in §5.2.2, the Admission Gate inside `services/status.ts#recordStatusChange` is **not** a role/authorization check — it is a data-integrity precondition that applies identically regardless of the acting user's role. When `toStatus = ADMITTED`, the service layer rejects the request with `422 ADMISSION_BLOCKED` if an unresolved objection or a missing/null custodian is present for the exhibit, evaluated against the existing `ObjectionCurrentState`/`CustodyCurrentState` projections in the same transaction as the write.

| Property | Value |
|---|---|
| Who it applies to | Every caller — UI action, direct API client, seed loader. There is no "force admit" parameter, admin override, or elevated-role bypass. |
| What it returns | `422 ADMISSION_BLOCKED` with a `reasons[]` array (`UNRESOLVED_OBJECTION`, `NO_CUSTODIAN`) — never `403 ROLE_NOT_PERMITTED`, since this is not an authorization failure |
| Why it is not modeled as a role check | The condition being guarded against (an exhibit improperly admitted) is a fact about the exhibit's state, not a fact about who is acting — a `JUDGE` attempting the same transition is blocked exactly as a `DEPUTY` would be |
| Relationship to F6 | F6's `ADMITTED_NO_CUSTODIAN` / `UNRESOLVED_OBJECTION_JURY_ELIGIBLE` discrepancy rules remain unchanged and continue to cover conditions that arise *after* a valid admission (e.g., a custody transfer later breaking the chain) — they are no longer the sole backstop for the admission transition itself |

See `01-components.md` §2.2 (`services/status.ts`) and `06-integrations.md` §Admission Gate for the full process sequence.

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

- Full OAuth/OIDC or SSO integration
- Password-based authentication, MFA, session hijacking protections
- Rate limiting / abuse prevention (acceptable for a controlled demo audience)
- Multi-tenant data isolation (single-case scope — `case_id` exists in the schema for future partitioning but no tenant-isolation enforcement is implemented)
- Formal penetration testing / security audit
- Encryption key management beyond provider defaults (Neon, Vercel, Anthropic)

Any future productionization of JudicialSync beyond its demo scope would require revisiting every item in this section — this document deliberately does not pretend otherwise.
