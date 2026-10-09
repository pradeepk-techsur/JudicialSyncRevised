
## 7. Integration Points

JudicialSync is a self-contained demo with exactly **one external network dependency**. This section documents that dependency plus the internal synchronization and trigger mechanisms that stand in for "integrations" at this scale — these internal triggers are the system's most important integration points, even though they never cross a network boundary.

### 7.1 External Services

| Service | Integration Pattern | Notes |
|---|---|---|
| LLM Provider — Anthropic (via `@ai-sdk/anthropic`), or OpenAI (via `@ai-sdk/openai`) as an alternative | Server-side tool-calling API (`streamText` + `tool()`), never called client-side | The only external network dependency in the entire system. Swappable via the AI SDK's provider abstraction with no architecture change. Low/near-zero temperature configured for deterministic repeated-question behavior during a live or recorded demo. API key stored server-side only (Vercel environment variable), never exposed to the client bundle. |

**Explicitly no other external integrations exist or are planned for this demo**, per PROJECT.md scope:

- **No real court case-management system (CMS) integration.** JudicialSync is positioned as an assistant augmenting existing CMS workflows, not replacing or integrating with one.
- **No real evidence-locker / DEMS integration.** All custody data is seeded/representative.
- **No external auth provider (no OAuth/SSO).** Auth is scoped to a seeded-users + role-switcher pattern.
- **No vector database or embeddings provider.** Deliberately avoided per research findings — the assistant's only "external" call is the LLM tool-calling round-trip itself.

### 7.2 Internal Triggers (Ledger → Projection → Discrepancy)

These synchronous, in-process triggers are the system's actual integration fabric between subsystems. They must fire reliably and **synchronously** — not via an eventually-consistent queue — because F5's jury-package finalization gate depends on discrepancy re-evaluation never being stale.

| Trigger | Source Event | Downstream Effect | Feature Chain |
|---|---|---|---|
| Status write | `recordEvent(STATUS_CHANGE)` | Updates `exhibit_current_state`; re-evaluates `ADMITTED_NO_CUSTODIAN` and `UNRESOLVED_OBJECTION_JURY_ELIGIBLE` discrepancy rules for the exhibit | F1 → F6 |
| Objection raised | `recordEvent(OBJECTION_RAISED)` | Creates `objection_current_state` row (`UNRESOLVED`) | F2 |
| Ruling recorded | `recordEvent(RULING_RECORDED)` | Updates `objection_current_state`; if the exhibit is `ADMITTED`, re-evaluates `UNRESOLVED_OBJECTION_JURY_ELIGIBLE` | F2 → F6 |
| Custody transfer | `recordEvent(CUSTODY_TRANSFER)` | Updates `custody_current_state`; re-evaluates `ADMITTED_NO_CUSTODIAN` | F3 → F6 |
| Discrepancy acknowledged | `recordEvent(DISCREPANCY_ACKNOWLEDGED)` | Updates `discrepancy_flags.status` to `ACKNOWLEDGED` | F6 |
| Jury package exhibit excluded *(added Phase 7)* | `recordEvent(JURY_PACKAGE_EXHIBIT_EXCLUDED)` | Updates `jury_package_exhibits.status` to `'EXCLUDED'`, setting `excluded_at`/`excluded_by`/`exclusion_reason` | F13 |
| Custody transfer proposed *(added Phase 7.1)* | `recordEvent(CUSTODY_TRANSFER_PROPOSED)` | Sets `custody_current_state.pending_transfer_to_user_id`/`pending_transfer_event_id`/`pending_transfer_proposed_at`; `current_custodian_user_id` is **NOT** modified | F19 |
| Custody transfer confirmed *(added Phase 7.1)* | `recordEvent(CUSTODY_TRANSFER_CONFIRMED)` | Updates `custody_current_state.current_custodian_user_id`/`since`/`last_event_id`; clears all three pending-transfer fields to null; re-evaluates `ADMITTED_NO_CUSTODIAN` | F19 → F6 |
| Custody transfer cancelled *(added Phase 7.1)* | `recordEvent(CUSTODY_TRANSFER_CANCELLED)` | Clears all three pending-transfer fields to null only; `current_custodian_user_id` unaffected | F19 |

All triggers execute **synchronously within the same service-layer call** that appends the ledger event — there is no async job queue or eventual-consistency window between a ledger write and its projection/discrepancy update. This is a hard architectural requirement, not a performance optimization: F5 §Process step 5 (re-evaluating discrepancies "fresh" at finalization time) is only trustworthy if the projection is guaranteed never to lag behind the ledger.

### 7.2a Admission Gate (F12, Added Phase 7 — Pre-Write Check, Not a Post-Write Trigger)

Unlike every trigger in §7.2, which runs *after* a ledger event is appended, F12's two admission-integrity checks (unresolved objection present; no custodian of record) run **before** the `STATUS_CHANGE` event for a `toStatus = ADMITTED` transition is ever appended. If either check fails, `services/status.ts#recordStatusChange` rejects the request with `422 ADMISSION_BLOCKED` and **no `ExhibitEvent` row is created** — this is a hard precondition gate inside the same service function used by every caller (UI, API, seed loader), not a downstream reaction to a write that already happened. It reads the existing `objection_current_state`/`custody_current_state` projections only; it introduces no new table and no new trigger wiring. See `01-components.md` §2.2 and `04-security.md` §5.2.3 for the full treatment.

**Phase 7.1's F17 adds no new gate here** — it formalizes, and adds regression test coverage for, the already-sufficient guarantee this gate provides (`04-security.md` §5.2.3 Hardening note).

### 7.2b Intake Custody Gate (F18, Added Phase 7.1 — Pre-Write Check, Same Transaction as MARKED)

Analogous in spirit to §7.2a's Admission Gate but earlier in the lifecycle. The exhibit's first-ever `STATUS_CHANGE` event (`(none) → MARKED`) now requires a non-null `custodianUserId`, validated and appended **in the same database transaction** as the status event itself — not a downstream trigger reacting to the status write, and not a separate manual step a caller could skip or forget.

| Property | Value |
|---|---|
| When it runs | Only when the `STATUS_CHANGE` event being recorded is the exhibit's first-ever one (`toStatus = MARKED`, zero prior events) — every subsequent transition is unaffected |
| What it validates | `custodianUserId` is present and references an existing, active `User` (reuses F03's existing `INVALID_CUSTODIAN` check) |
| What it writes, atomically | (a) the `STATUS_CHANGE` event (`fromStatus: null, toStatus: 'MARKED'`), (b) a `CUSTODY_TRANSFER_CONFIRMED` event (`fromCustodianUserId: null`) establishing the first custody link directly — **no preceding `CUSTODY_TRANSFER_PROPOSED` event**, per F19's documented single-phase bootstrap exception — and (c) both `ExhibitCurrentState` and `CustodyCurrentState` together |
| What happens on failure | The entire transaction rolls back — there is no intermediate, even transient, state where an exhibit is `MARKED` with no `CustodyCurrentState` row |
| Relationship to F12's Admission Gate | Independent and additive, not a replacement — F12's later admission-time custodian check (§7.2a) is retained unchanged as a second backstop, since a custody chain established at intake could in principle still break before admission |

See `F18-custodian-required-at-intake.md` and `01-components.md` §2.2 (`services/status.ts#recordStatusChange`) for the full process sequence.

### 7.2c Server-Side Role Resolution (F20, Added Phase 7.1 — Pre-Write Check on Every Gated Action)

Every write action listed in `04-security.md` §5.2.2a's Permission Matrix now runs a role-resolution check (`services/authorization.ts#assertRole(actorUserId, allowedRoles, actionLabel)`) before any other validation or write — resolving the acting user's role from the `User.role` database column via `actorUserId`, never from a client-supplied role claim. This generalizes the pattern already used, prior to Phase 7.1, only by `recordRuling`'s judge-check and `assertJuryWriteRole`. If the resolved role is not permitted, the request is rejected with `403 ROLE_NOT_PERMITTED` before any field-level validation, state-machine check, or ledger write occurs. See `04-security.md` §5.2.2a for the full matrix.

### 7.2d Case Scoping (F22, Added Phase 7.1 — Explicit, Stateless, Per-Request)

Prior to this feature, every service-layer query implicitly scoped to a single case via a `DEMO_CASE_NUMBER` constant. As of F22, `caseId` is carried explicitly on every request — identically to how `requestingUserRole` is already carried per-request rather than server-side-session-stored. The server remains stateless with respect to "which case is active": there is no server-side "current case" session value, only a client-selected `caseId` passed with each call. This requires no new integration mechanism — it is the same per-request-parameter pattern already in use for role, now extended to case. See `01-components.md` §2.2 (`services/cases.ts`) and `03-api.md` §4.1a.

### 7.2e Attention Feed & Custody Aggregation — Read-Only, Not Triggers (F08, Added Phase 8)

Unlike every item in §7.2–§7.2d, `services/activity.ts#getCustodyByCustodian(caseId)` and `#getAttentionFeed(caseId)` are **not** triggers at all — they fire on no write, they are invoked only on read (Command Center page load / poll tick), and they write nothing back to any table. They are pure aggregation queries composed entirely from projections other triggers already maintain:

| Function | Reads | Writes |
|---|---|---|
| `getCustodyByCustodian(caseId)` | `custody_current_state` (joined to `users`/`exhibits`) | None |
| `getAttentionFeed(caseId)` | `jury_package_exhibits`, `discrepancy_flags`, `objection_current_state` (joined to `exhibits`) | None |

Both are listed here, not omitted, specifically to make explicit that Phase 8 adds **zero new trigger wiring** to the system — every condition either function surfaces (a sealed exhibit improperly included, an open discrepancy, an unresolved objection) was already being computed and persisted by the existing F6/F13/F19 triggers in §7.2 above; F08 only adds a new way of reading and ranking that already-current data. This is also why both functions are safe to call on every 3–5s poll tick (`§7.3` below) with no staleness risk: they read current-state projections, which the architecture already guarantees are never stale relative to the ledger (§7.2 opening paragraph).

**Finalization-request notification (F11) is similarly not a trigger:** `requestFinalization` (`services/juryPackage.ts`) writes directly to `jury_packages.finalization_requested_at`/`finalization_requested_by` — it is the one Phase 8 write that does **not** go through `recordEvent()` and does **not** append an `ExhibitEvent` row, because it is explicitly scoped as non-ledger, non-authoritative metadata (`02-data-model.md`'s Finalization Request note, §3.6). This is a deliberate, singular exception: every other write in this system's history goes through the ledger; this one piece of UI-notification metadata is the first and only write that intentionally does not, precisely because it confers no authority and nothing downstream (the discrepancy gate, the Permission Matrix) needs to react to it.

### 7.3 Live Multi-Screen Sync

| Mechanism | Pattern | Applies To |
|---|---|---|
| Polling (`@tanstack/react-query`) | Client refetch every 3–5 seconds, plus refetch-on-window-focus | Command Center (F8 — now five widgets on the same interval, including the Phase 8 additions `getCustodyByCustodian`/`getAttentionFeed`; no new hook pattern, each new widget follows the existing per-query polling hook convention), Case Workspace (F9, `juryPackageEligibility` refreshes on the same poll as the rest of the row), Exhibit Detail (F10, right-rail cards refresh on the same `getExhibitHistory` poll as the timeline — no separate polling for the cards), Jury Package Workspace (F11, while `DRAFT` — polling stops once `FINALIZED` since content becomes immutable; the Blockers/Clean grouping and finalization-request banner refresh on this same interval), Pending-Ruling Queue (F21, added Phase 7.1 — reuses the existing `useUnresolvedObjections` hook unchanged; no new hook, no new polling interval) |
| SSE/WebSocket | **Not implemented in v1** | Explicitly deferred — revisit only if a live demo script requires sub-second visible sync between two screens displayed side-by-side; flagged as a phase-specific decision, not a v1 requirement |

This is sufficient at demo scale (single case, <10 concurrent users) per `.planning/research/ARCHITECTURE.md` §Scaling Considerations, and avoids introducing websocket infrastructure for a one-time or occasionally-repeated live demo. **F24's inline write actions (Phase 8) require no new sync mechanism either:** a successful submission triggers a scoped refetch of only the originating card/feed/panel's query (an immediate, targeted invalidation, not a new polling path), and every other open screen still catches up to the resulting state change on its own existing 3–5s poll — exactly as any other write in the system already propagates.

### 7.4 Seed Data Loader (Pseudo-Integration)

The seed data loader (F0) is the system's sole "data import" path. It is documented here, not as an external integration, but because it behaves like one architecturally: it calls the **identical** `recordEvent()` and `createExhibit()`/`getExhibits()`-family service functions a live user or UI action would, rather than inserting rows directly into current-state projection tables.

This guarantees seeded demo data exercises the exact same write path (ledger-first, projection-derived, discrepancy-triggering) that the live UI uses — there is no risk of the seed data representing a state the live system could never actually produce. The loader deliberately plants:

- At least one exhibit with an unresolved objection (no `RULING_RECORDED` event closes the thread)
- At least one exhibit admitted with no `CUSTODY_TRANSFER` event ever recorded
- At least one exhibit with an unresolved objection that is otherwise eligible for the jury package (triggers both named F6 discrepancy rules)

A post-seed assertion fails the entire seed transaction fast if fewer than these required edge cases are present (`SEED_INTEGRITY_FAILURE`, 500) — enforced programmatically, not by manual review, per FRD F0 §Validation.

### 7.5 Deployment/Runtime Dependencies

| Dependency | Purpose | Notes |
|---|---|---|
| Neon Postgres | Primary datastore | Serverless Postgres, zero-ops, pairs natively with Vercel hosting |
| Vercel (or equivalent Next.js hosting) | Hosting for the full-stack Next.js 16 app | Single deployable artifact — UI, API routes, and the assistant route all ship together; no separate deployment for the assistant |
| Anthropic API | LLM tool-calling + streaming | Server-side only; the only outbound network call beyond the Vercel↔Neon connection |
| `@react-pdf/renderer` *(added Phase 7.1, F23 — new dependency)* | Server-side PDF generation for finalized jury package export | Pure-JS, component-based (`<Document>`/`<Page>`/`<View>`/`<Text>`) PDF generation with no headless-Chromium binary required — selected specifically because this system runs on Vercel serverless functions, where a Puppeteer/Playwright-style HTML-to-PDF approach would require bundling and cold-starting a full browser binary per invocation. This is the **first new runtime dependency** added since the original tech-stack lock-in; F16–F22 introduce no new dependencies. See `05-tech-stack.md` §6.1/§6.4. |

No message queues, caches, or background job runners are part of this architecture — all writes are synchronous request/response cycles, which is appropriate and sufficient for single-case demo scale (`.planning/research/ARCHITECTURE.md` §Scaling Considerations). **As of Phase 7.1 (F22), "single-case" no longer describes the data model** (see §7.2d above) — but the synchronous, queue-free write model itself is unaffected: multi-case support adds a query-scoping dimension, not a new write pathway or async mechanism. F19's custody-handoff "no-confirm" path (indefinite pending, no auto-expiry) is deliberately consistent with this same queue-free constraint — an explicit, synchronous cancel is the only resolution path, not a background expiry job. **Phase 8 introduces no new deployment or runtime dependency** (§7.5 is unchanged by this phase — `@react-pdf/renderer`, added Phase 7.1, remains the only new runtime dependency since initial stack lock-in; see `05-tech-stack.md` §6.1a for the dark-dashboard theming's confirmation that it required no new package). Should JudicialSync ever move beyond a demo (out of current scope), this is the first section to revisit: real CMS/DEMS integration points and async discrepancy re-evaluation at larger scale would need fresh design work, not incremental extension of the patterns documented here.
