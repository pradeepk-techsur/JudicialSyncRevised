---
pivota_spec_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 01-02-PLAN.md
last_updated: "2026-10-07T02:46:00.543Z"
last_activity: 2026-10-07 — Completed 01-03-PLAN.md (exhibit status state machine, status API routes, F1 integration tests)
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 7
  completed_plans: 4
  percent: 43
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-06)

**Core value:** During live proceedings, any authorized courtroom user can ask a natural-language question about an exhibit and get an immediate, accurate, well-supported answer.
**Current focus:** Phase 1 — Data Foundation

## Current Position

Phase: 1 of 5 (Data Foundation)
Plan: 3 of 7 complete in current phase
Status: In progress
Last activity: 2026-10-07 — Completed 01-03-PLAN.md (exhibit status state machine, status API routes, F1 integration tests)

Progress: [████░░░░░░] 43%

## Performance Metrics

**Velocity:**

- Total plans completed: 3
- Average duration: 4.7 min
- Total execution time: ~0.23 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01    | 3     | 7     | 4.7 min  |

**Recent Trend:**

- Last 5 plans: 01-01 (4 min), 01-02 (5 min), 01-03 (5 min)
- Trend: steady

*Updated after each plan completion*

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 4 min | 3 tasks | 15 files |
| Phase 01 P02 | 5 min | 3 tasks | 13 files |
| Phase 01 P03 | 5 min | 2 tasks | 6 files |
| Phase 01-data-foundation P05 | 3 min | 2 tasks | 7 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Event-sourced ledger (append-only `ExhibitEvent`) locked in as Phase 1 foundation — all status/objection/custody state is derived, never mutable fields.
- [Roadmap]: Assistant (F7) sequenced as Phase 4, after jury package/discrepancy detection (Phase 3) — nothing to cite until the full data model and cross-domain rules exist.
- [Roadmap]: Trial Command Center (F8) sequenced last (Phase 5) — ambient aggregation view and live-sync polling tuning are most meaningful against a working system.
- [01-01]: Phase 1 dependencies scoped to the data layer only (prisma, @prisma/client, zod); AI SDK / react-query / zustand / shadcn/ui deferred to the phases that build their consuming screens.
- [01-01]: Pinned next@16.4.0 / react@19.3.0 (current latest, matches TechArch); kept prisma@6.x / vitest@3.x at current versions rather than npm-audit's downgrade suggestions (dev-tooling-only advisories).
- [01-01]: Prisma models use @map/@@map to snake_case Postgres names (TechArch §3.8); schema holds zero mutable status/custody fields on identity tables — all such state is derived from the ExhibitEvent ledger.
- [01-01]: Dockerfile CMD runs migrate deploy -> next start; seed step deferred to Plan 6 once the seed loader exists.
- [01-02]: recordEvent() is the single ledger-write chokepoint — only call site of prisma.exhibitEvent.create (grep-enforced); all later status/objection/custody plans record history through it.
- [01-02]: Added a typed error layer (src/lib/errors.ts) + envelope helper (src/lib/apiError.ts) so services throw code-bearing errors and routes stay thin — satisfies the plan's own service/route contract.
- [01-02]: Sealed-exhibit role-based visibility filtering deferred to Phase 2 (first role-scoped consumer); GET /api/cases/:id/exhibits returns raw identity rows until projection reads land.
- [01-03]: Status state machine serializes concurrent writers with a transaction-scoped Postgres advisory lock (pg_advisory_xact_lock keyed by a hash of exhibitId) rather than SELECT ... FOR UPDATE — the latter can't lock the non-existent row on an exhibit's first transition. Serialization conflicts (P2034/P2028) surface as STATUS_CONFLICT 409.
- [01-03]: STATUS_CHANGE ledger write + ExhibitCurrentState upsert run in one transaction via recordEvent(args, tx) so ledger and projection never diverge. This validate→recordEvent(tx)→upsert pattern is the reusable template for objections (Plan 4) and custody (Plan 5).
- [01-03]: Added UnprocessableError (422 with a feature-specific code) to the typed error layer so INVALID_STATUS_TRANSITION keeps its own code instead of collapsing into generic VALIDATION_ERROR.
- [01-03]: GET /api/exhibits/:id/status returns 200 with a null currentStatus body for an existing exhibit that has no status yet; 404 EXHIBIT_NOT_FOUND only for a genuinely absent exhibit.

### Pending Todos

None yet.

### Blockers/Concerns

- npm audit reports 6 dev-tooling-only advisories (vitest/tinypool, @prisma/config/deepmerge-ts). `npm audit fix --force` only offers breaking downgrades to older versions — not applied. Revisit when upstream ships forward fixes. Not a runtime risk.

## Session Continuity

Last session: 2026-10-07T02:45:40.962Z
Stopped at: Completed 01-03-PLAN.md
Resume file: None
