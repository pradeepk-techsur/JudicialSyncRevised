
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

All triggers execute **synchronously within the same service-layer call** that appends the ledger event — there is no async job queue or eventual-consistency window between a ledger write and its projection/discrepancy update. This is a hard architectural requirement, not a performance optimization: F5 §Process step 5 (re-evaluating discrepancies "fresh" at finalization time) is only trustworthy if the projection is guaranteed never to lag behind the ledger.

### 7.2a Admission Gate (F12, Added Phase 7 — Pre-Write Check, Not a Post-Write Trigger)

Unlike every trigger in §7.2, which runs *after* a ledger event is appended, F12's two admission-integrity checks (unresolved objection present; no custodian of record) run **before** the `STATUS_CHANGE` event for a `toStatus = ADMITTED` transition is ever appended. If either check fails, `services/status.ts#recordStatusChange` rejects the request with `422 ADMISSION_BLOCKED` and **no `ExhibitEvent` row is created** — this is a hard precondition gate inside the same service function used by every caller (UI, API, seed loader), not a downstream reaction to a write that already happened. It reads the existing `objection_current_state`/`custody_current_state` projections only; it introduces no new table and no new trigger wiring. See `01-components.md` §2.2 and `04-security.md` §5.2.3 for the full treatment.

### 7.3 Live Multi-Screen Sync

| Mechanism | Pattern | Applies To |
|---|---|---|
| Polling (`@tanstack/react-query`) | Client refetch every 3–5 seconds, plus refetch-on-window-focus | Command Center (F8), Case Workspace (F9), Exhibit Detail (F10), Jury Package Workspace (F11, while `DRAFT` — polling stops once `FINALIZED` since content becomes immutable) |
| SSE/WebSocket | **Not implemented in v1** | Explicitly deferred — revisit only if a live demo script requires sub-second visible sync between two screens displayed side-by-side; flagged as a phase-specific decision, not a v1 requirement |

This is sufficient at demo scale (single case, <10 concurrent users) per `.planning/research/ARCHITECTURE.md` §Scaling Considerations, and avoids introducing websocket infrastructure for a one-time or occasionally-repeated live demo.

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

No message queues, caches, or background job runners are part of this architecture — all writes are synchronous request/response cycles, which is appropriate and sufficient for single-case demo scale (`.planning/research/ARCHITECTURE.md` §Scaling Considerations). Should JudicialSync ever move beyond a demo (out of current scope), this is the first section to revisit: multi-case partitioning, real CMS/DEMS integration points, and async discrepancy re-evaluation at larger scale would all need fresh design work, not incremental extension of the patterns documented here.
