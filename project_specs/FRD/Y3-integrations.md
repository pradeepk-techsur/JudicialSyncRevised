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
| Custody transfer | `recordEvent(CUSTODY_TRANSFER)` | Updates `CustodyCurrentState`; re-evaluates `ADMITTED_NO_CUSTODIAN` | F3 → F6 |
| Discrepancy acknowledged | `recordEvent(DISCREPANCY_ACKNOWLEDGED)` | Updates `DiscrepancyFlag.status` to `ACKNOWLEDGED` | F6 |

All five triggers execute synchronously within the same service-layer call that appends the ledger event — there is no async job queue or eventual-consistency window between a ledger write and its projection/discrepancy update, which is required for F5's finalization gate to be trustworthy (re-evaluating discrepancies "fresh" per F5 §Process step 5 means the projection is never behind the ledger).

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

No message queues, caches, or background job runners are part of this architecture — all writes are synchronous request/response cycles, appropriate for single-case demo scale (see `ARCHITECTURE.md` §Scaling Considerations).
