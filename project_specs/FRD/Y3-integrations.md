## Y3: Integration Points

JudicialSync is a self-contained demo with a single external dependency. This chunk documents that dependency plus the internal synchronization and trigger mechanisms that stand in for "integrations" at this scale.

### External Services

| Service | Integration Pattern | Notes |
|---|---|---|
| LLM Provider (Anthropic via `@ai-sdk/anthropic`, or OpenAI via `@ai-sdk/openai`) | Server-side tool-calling API (`streamText` + `tool()`), never called client-side | The only external network dependency in the system. Swappable via the AI SDK's provider abstraction with no architecture change (see `STACK.md` §Alternatives Considered). Low/near-zero temperature configured for deterministic repeated-question behavior during a live or recorded demo. |

**Explicitly no other external integrations exist or are planned for this demo:**
- No real court case-management system (CMS) integration — PROJECT.md scopes this out; JudicialSync is positioned as an assistant augmenting existing CMS workflows, not replacing or integrating with one.
- No real evidence-locker / DEMS integration — all custody data is seeded/representative.
- No external auth provider (no OAuth/SSO) — PROJECT.md scopes auth to a seeded-users + role-switcher pattern, not production identity integration.
- No vector database or embeddings provider — deliberately avoided per research findings; the assistant's only "external" call is the LLM tool-calling round-trip itself.

### Internal Triggers (Ledger → Projection → Discrepancy)

Though not external integrations, these internal event-driven triggers are documented here because they are the system's only "integration points" between subsystems and must fire reliably and synchronously (not via an eventually-consistent queue, at this scale):

| Trigger | Source Event | Downstream Effect | Feature |
|---|---|---|---|
| Status write | `recordEvent(STATUS_CHANGE)` | Updates `ExhibitCurrentState`; re-evaluates `ADMITTED_NO_CUSTODIAN` and `UNRESOLVED_OBJECTION_JURY_ELIGIBLE` discrepancy rules for the exhibit | F1 → F6 |
| Objection raised | `recordEvent(OBJECTION_RAISED)` | Creates `ObjectionCurrentState` row (`UNRESOLVED`) | F2 |
| Ruling recorded | `recordEvent(RULING_RECORDED)` | Updates `ObjectionCurrentState`; if the exhibit is `ADMITTED`, re-evaluates `UNRESOLVED_OBJECTION_JURY_ELIGIBLE` | F2 → F6 |
| Custody transfer (legacy/intake) | `recordEvent(CUSTODY_TRANSFER)` | Updates `CustodyCurrentState`; re-evaluates `ADMITTED_NO_CUSTODIAN` | F3 → F6 |
| Discrepancy acknowledged | `recordEvent(DISCREPANCY_ACKNOWLEDGED)` | Updates `DiscrepancyFlag.status` to `ACKNOWLEDGED` | F6 |
| Jury package exhibit excluded *(added Phase 7)* | `recordEvent(JURY_PACKAGE_EXHIBIT_EXCLUDED)` | Updates `JuryPackageExhibit.status` to `EXCLUDED`, setting `excludedAt`/`excludedBy`/`exclusionReason` | F13 |
| Custody transfer proposed *(added Phase 7.1)* | `recordEvent(CUSTODY_TRANSFER_PROPOSED)` | Sets `CustodyCurrentState.pendingTransferToUserId`/`pendingTransferEventId`/`pendingTransferProposedAt`; `currentCustodianUserId` is NOT modified | F19 |
| Custody transfer confirmed *(added Phase 7.1)* | `recordEvent(CUSTODY_TRANSFER_CONFIRMED)` | Updates `CustodyCurrentState.currentCustodianUserId`/`since`/`lastEventId`; clears all pending-transfer fields; re-evaluates `ADMITTED_NO_CUSTODIAN` | F19 → F6 |
| Custody transfer cancelled *(added Phase 7.1)* | `recordEvent(CUSTODY_TRANSFER_CANCELLED)` | Clears all pending-transfer fields only; `currentCustodianUserId` unaffected | F19 |

All triggers execute synchronously within the same service-layer call that appends the ledger event — there is no async job queue or eventual-consistency window between a ledger write and its projection/discrepancy update, which is required for F5's finalization gate to be trustworthy (re-evaluating discrepancies "fresh" per F5 §Process step 5 means the projection is never behind the ledger).

### Admission Gate (F12 — Pre-Write Check, Not a Post-Write Trigger)

Added Phase 7. Unlike the triggers above, which run *after* a ledger event is appended, F12's two admission-integrity checks (unresolved objection present; no custodian of record) run *before* the `STATUS_CHANGE` event for a `toStatus = ADMITTED` transition is ever appended. If either check fails, the service layer rejects the request with `ADMISSION_BLOCKED` (422) and **no `ExhibitEvent` row is created** — this is a hard precondition gate inside the same service function used by every caller (UI, API, seed loader), not a downstream reaction to a write that already happened. See F12 §Process for the full sequence. **Phase 7.1's F17 adds no new gate here** — it formalizes, and adds regression test coverage for, the already-sufficient guarantee that this gate provides (see `F17-objection-admission-state-machine-hardening.md`).

### Intake Custody Gate (F18 — Pre-Write Check, Same Transaction as MARKED)

Added Phase 7.1. Analogous in spirit to F12's admission gate but earlier in the lifecycle: the exhibit's first-ever `STATUS_CHANGE` event (`(none) → MARKED`) now requires a non-null `custodianUserId`, validated and written in the **same transaction** as the status event itself (not a downstream trigger reacting to the status write, and not a separate manual step a caller could skip). See `F18-custodian-required-at-intake.md` §Process.

### Server-Side Role Resolution (F20 — Pre-Write Check on Every Gated Action)

Added Phase 7.1. Every write action listed in `F20-server-side-role-enforcement-matrix.md`'s permission matrix now runs a role-resolution check (`assertRole(actorUserId, allowedRoles, actionLabel)`) before any other validation or write — resolving the acting user's role from the `User.role` database column via `actorUserId`, never from a client-supplied role claim. This generalizes the pattern already used, prior to Phase 7.1, only by `recordRuling`'s judge-check and `assertJuryWriteRole`. If the resolved role is not permitted, the request is rejected with `403 ROLE_NOT_PERMITTED` before any field-level validation, state-machine check, or ledger write occurs.

### Case Scoping (F22 — Explicit, Stateless, Per-Request)

Added Phase 7.1. Prior to this feature, every service-layer query implicitly scoped to a single case via the `DEMO_CASE_NUMBER` constant. As of F22, `caseId` is carried explicitly on every request — identically to how `requestingUserRole` is already carried per-request rather than server-side-session-stored (`Y1-api.md` §intro note). The server remains stateless with respect to "which case is active": there is no server-side "current case" session value, only a client-selected `caseId` passed with each call. This requires no new integration mechanism — it is the same per-request-parameter pattern already in use for role, now extended to case. See `F22-multi-case-support-case-selector.md` §Process.

### Live Multi-Screen Sync

| Mechanism | Pattern | Notes |
|---|---|---|
| Polling (`@tanstack/react-query`) | Client refetch every 3–5 seconds, plus refetch-on-window-focus | Sufficient at demo scale (single case, <10 concurrent users) per `ARCHITECTURE.md` §Live multi-screen updates. Applies to Command Center (F8), Case Workspace (F9), Exhibit Detail (F10), and Jury Package Workspace (F11, while `DRAFT`). |
| SSE/WebSocket | Not implemented in v1 | Explicitly deferred — only revisit if a live demo script requires sub-second visible sync between two screens displayed side-by-side (flagged as a phase-specific decision in `ARCHITECTURE.md`, not a v1 requirement). |

### Seed Data Loader (Pseudo-Integration)

The seed data loader (F0) is not an external integration but is documented here as the system's sole "data import" path: it calls the identical `recordEvent()` and `getExhibits()`-family service functions a live user would, rather than inserting rows directly into current-state tables. This guarantees seeded demo data exercises the exact same write path (ledger-first, projection-derived) that the live UI uses, so there is no risk of the seed data representing a state the live system could never actually produce.

### Deployment/Runtime Dependencies

| Dependency | Purpose | Notes |
|---|---|---|
| Neon Postgres | Primary datastore | Serverless Postgres, zero-ops, pairs natively with Vercel hosting (see `STACK.md`) |
| Vercel (or equivalent Next.js hosting) | Hosting for the full-stack Next.js 16 app | Single deployable artifact — UI, API routes, and assistant route all ship together |
| `@react-pdf/renderer` *(added Phase 7.1, F23 — new dependency)* | Server-side PDF generation for finalized jury package export | Pure-JS, component-based (`<Document>`/`<Page>`/`<View>`/`<Text>`) PDF generation with no headless-Chromium binary required — selected specifically because this system runs on Vercel serverless functions, where a Puppeteer/Playwright-style HTML-to-PDF approach would require bundling and cold-starting a full browser binary per invocation. This is the first new runtime dependency added since the original tech-stack lock-in; F16–F22 introduce no new dependencies. |

No message queues, caches, or background job runners are part of this architecture — all writes are synchronous request/response cycles, appropriate for single-case demo scale (see `ARCHITECTURE.md` §Scaling Considerations). **As of Phase 7.1 (F22), "single-case" no longer describes the data model** (see §Case Scoping above) but the synchronous, queue-free write model itself is unaffected — multi-case support adds a query-scoping dimension, not a new write pathway or async mechanism. F19's custody-handoff "no-confirm" path (indefinite pending, no auto-expiry) is deliberately consistent with this same queue-free constraint — see `F19-custody-handoff-confirmation.md` §Design Decisions.
