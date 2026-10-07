---
pivota_spec_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: verifying
stopped_at: Phase 3 context gathered
last_updated: "2026-10-07T12:17:55.206Z"
last_activity: "2026-10-07 — Completed 02-07-PLAN.md (Exhibit Detail View /exhibit/:id: useExhibitHistory hook with typed NotFoundError 404-distinction + retry-disabled + role-keyed + 4s polling; ExhibitHeader status/custodian/party/witness above the fold via shared StatusBadge; Timeline full ledger verbatim oldest-first; ExhibitNotFound single shared render for missing AND sealed-unauthorized; 4/4 Playwright pass incl. byte-identical not-found + cross-screen parity; build clean, 114 vitest pass). [Wave 3, ran in parallel with 02-06.]"
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 14
  completed_plans: 14
  percent: 40
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-06)

**Core value:** During live proceedings, any authorized courtroom user can ask a natural-language question about an exhibit and get an immediate, accurate, well-supported answer.
**Current focus:** Phase 2 — Core Screens

## Current Position

Phase: 2 of 5 (Core Screens)
Status: All 7 plans complete (wave 3 02-06 + 02-07 both done) — ready for phase transition / verify
Last activity: 2026-10-07 — Completed 02-07-PLAN.md (Exhibit Detail View /exhibit/:id: useExhibitHistory hook with typed NotFoundError 404-distinction + retry-disabled + role-keyed + 4s polling; ExhibitHeader status/custodian/party/witness above the fold via shared StatusBadge; Timeline full ledger verbatim oldest-first; ExhibitNotFound single shared render for missing AND sealed-unauthorized; 4/4 Playwright pass incl. byte-identical not-found + cross-screen parity; build clean, 114 vitest pass). [Wave 3, ran in parallel with 02-06.]

Progress: [████░░░░░░] 40%

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
| Phase 01 P04 | 3 min | 2 tasks | 6 files |
| Phase 01-data-foundation P06 | 5 min | 2 tasks | 4 files |
| Phase 01-data-foundation P7 | 4 min | 2 tasks | 6 files |
| Phase 02-core-screens P03 | 8 min | 2 tasks | 7 files |
| Phase 02-core-screens P02 | 9 min | 2 tasks | 12 files |
| Phase 02 P01 | 10 min | 3 tasks | 15 files |
| Phase 02-core-screens P04 | 8 min | 2 tasks | 7 files |
| Phase 02-core-screens P05 | 5 min | 3 tasks | 10 files |
| Phase 02-core-screens P06 | 12 min | 3 tasks | 5 files |
| Phase 02-core-screens P07 | 36 min | 3 tasks | 6 files |

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
- [Phase 01-05]: recordEvent() extended with an optional transaction client (non-breaking) so the custody CUSTODY_TRANSFER event and CustodyCurrentState upsert commit atomically in one transaction
- [Phase 01-05]: Custody gap modelled as a first-class valid state: getCustodian -> null, GET /custodian -> 200 {custodian:null}; 404 reserved for a genuinely missing exhibit, keeping the two unambiguous for F6/F9/F10
- [Phase 01-04]: Judge-gated ALL ruling dispositions including RESERVED (plan tightens the FRD's SUSTAINED/OVERRULED-only baseline per must_haves + threat T-01-11: reserving a ruling is itself a judicial act); 403 message 'Only a judge may record a ruling on an objection'
- [Phase 01-04]: Objection threads are per-thread (one ObjectionCurrentState per objectionId) so one exhibit holds N concurrent UNRESOLVED threads; getUnresolvedObjections is the single shared query reused identically by F8/F9/F7
- [Phase 01-06]: Seed loader (F0a) writes exclusively through the Plan 2–5 service functions — zero direct ledger/projection inserts (grep-enforced in done-criteria + seed.test.ts, threat T-01-17); proves seed data can only represent states the live system could produce
- [Phase 01-06]: Seed determinism via scoped reset-then-rebuild (resetSeedCase on fixed caseNumber 2026-CR-0142); rollback-on-missing-edge-case via try/catch cleanup rather than one outer $transaction (each recordEvent opens its own tx)
- [Phase 01-07]: getExhibitHistory replays the full ExhibitEvent ledger (all event types, sequenceNo order, no truncation) into plain-language summaries with resolved actor/custodian names; discrepancyFlags is [] until Phase 3's DiscrepancyFlag table exists
- [Phase 01-07]: rebuildProjections is a strictly read-only ledger-replay integrity check (zero recordEvent / zero *CurrentState writes, threat T-01-20); RESERVED rulings leave a thread UNRESOLVED in replay, mirroring recordRuling; proven by a negative control that detects a corrupted projection
- [Phase 01-07]: vitest fileParallelism:false — all integration suites share one Postgres and the same fixed-caseNumber seed, so parallel workers rebuilding it race into FK violations
- [Phase 02-03]: DEMO_CASE_NUMBER extracted to src/lib/constants.ts as the single source of truth; seed loader and cases.ts both import it instead of re-literalling 2026-CR-0142
- [Phase 02-03]: Sealed exhibit S-1 (isSealed:true, full status+custody history) planted via the live service path only (zero direct ledger/projection inserts, threat T-02-08); assertSeedIntegrity now requires >=1 sealed exhibit
- [Phase 02-03]: GET /api/case returns the full 6-persona roster unfiltered (accepted risk T-02-07: synthetic personas, no real PII; the role switcher needs the whole roster)
- [Phase 02-core-screens]: [02-02]: Sealed-exhibit visibility centralized in src/services/visibility.ts (canViewSealed + parseRequestingRole); applied as a findFirst WHERE predicate in getExhibit and inherited by getExhibitHistory — never a post-query filter, never duplicated per-route
- [Phase 02-core-screens]: [02-02]: parseRequestingRole fails CLOSED to ATTORNEY (least-privileged) on missing/invalid X-User-Role; both exhibit routes return byte-identical 404s for sealed-unauthorized vs genuinely-missing (anti-enumeration, deep-equal asserted at HTTP layer)
- [Phase 02-01]: Dropped shadcn's injected next/font/google (Geist) from layout.tsx to keep a minimal provider-only layout and avoid build-time font fetches; typography deferred to app-shell plan 02-05
- [Phase 02-01]: Phase 2 UI tooling (Tailwind v4 + shadcn/ui, @tanstack/react-query + QueryClientProvider, zustand, @playwright/test pinned to PIVOTA_PLAYWRIGHT_VERSION) installed once here so every later UI plan shares one config
- [Phase 02-core-screens]: [02-04]: ExhibitListRow (src/lib/types.ts) is the single shared composite row shape both getExhibits and searchExhibits return via one shared toListRow mapper — list and search can never drift; the Case Workspace (02-06) renders it with zero query logic
- [Phase 02-core-screens]: [02-04]: getExhibits sort key changed from createdAt to exhibitLabel ascending so F9 and F4 share one default order; assertCaseExists adds CASE_NOT_FOUND 404 (first consumer); searchExhibits enforces EMPTY_SEARCH_CRITERIA/INVALID_DATE_RANGE/VALIDATION_ERROR and nests date filters on currentState.lastStatusAt (auto-excludes never-statused exhibits)
- [Phase 02-05]: App shell role switcher uses a native <select> (keyboard/SR-accessible, simple to test) over the portal-rendering shadcn/Radix Select; richer shadcn primitives reserved for the two screens' filter controls
- [Phase 02-05]: useRoleStore is the demo's entire client-side session (zustand); apiFetch reads it via getState() to attach X-User-Role to every request — no cookie/session infra
- [Phase 02-05]: StatusBadge is the single shared status representation (dot+label+aria-label, all 6 statuses + null); both 02-06/02-07 import it identically (US-1.2 structural guarantee)
- [Phase 02-core-screens]: [02-06]: Case Workspace follows a one-hook + presentational-components pattern — useExhibitList is the screen's single query path (getExhibits vs searchExhibits on filter state), keyed on role so a switch forces a fresh server-enforced query (threat T-02-15); zero screen-local status/custody derivation
- [Phase 02-core-screens]: [02-06]: Empty-search guarded client-side (all-empty filters route to the unfiltered list, inline hint, never a hard error); the API's 422 EMPTY_SEARCH_CRITERIA remains defense-in-depth for other callers
- [Phase 02-07]: Exhibit Detail (/exhibit/:id): useExhibitHistory throws typed NotFoundError on 404 (retry disabled → no sealed-probe timing side-channel), role in query key for immediate re-fetch; ExhibitNotFound is the single shared render for missing AND sealed-unauthorized (byte-identical, anti-enumeration); Timeline renders getExhibitHistory summaries verbatim (F7 text-parity precondition)
- [Phase 02-07]: 02-07 Playwright drives the unauthorized sealed probe via page.route X-User-Role header injection (in-memory zustand session resets to JUDGE on full navigation, so a UI role switch can't survive page.goto); cross-screen parity asserted against the shared /api/cases/:id/exhibits service mapped through StatusBadge labels, decoupled from 02-06's DOM

### Pending Todos

None yet.

### Blockers/Concerns

- npm audit reports 6 dev-tooling-only advisories (vitest/tinypool, @prisma/config/deepmerge-ts). `npm audit fix --force` only offers breaking downgrades to older versions — not applied. Revisit when upstream ships forward fixes. Not a runtime risk.
- Concurrent execution (config parallelization:true) ran plans 02-01 and 02-02 against one shared working tree, causing a transient build break and an accidental revert of 02-02's uncommitted work (since recovered — 02-02 committed in full). Recommend per-plan git worktrees or serialized intra-phase execution.

## Session Continuity

Last session: 2026-10-07T12:17:55.205Z
Stopped at: Phase 3 context gathered
Resume file: .planning/phases/03-jury-package-discrepancy-detection/03-CONTEXT.md
