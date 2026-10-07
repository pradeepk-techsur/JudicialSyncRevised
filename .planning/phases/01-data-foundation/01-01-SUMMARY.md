---
phase: 01-data-foundation
plan: 01
subsystem: database
tags: [nextjs, typescript, prisma, postgres, docker-compose, event-sourcing, vitest, zod]

# Dependency graph
requires: []
provides:
  - "Next.js 16 + TypeScript project scaffold (App Router, data-layer deps only)"
  - "Locked append-only event-ledger Prisma schema (7 Phase-1 models) with snake_case Postgres mapping"
  - "Committed initial migration applying cleanly to a fresh Postgres 16"
  - "src/lib/prisma.ts singleton PrismaClient export"
  - "docker-compose.yml dev stack (Postgres 16 healthcheck + app) and Dockerfile"
affects: [F0a-seed-demo-data, F1-status-display, F2-objection-ruling, F3-custody-tracking, phase-02, phase-03, phase-04]

# Tech tracking
tech-stack:
  added: [next@16.4.0, react@19.3.0, typescript@5.x, prisma@6.x, "@prisma/client@6.x", zod@3.x, vitest@3.x, tsx@4.x, postgres:16]
  patterns:
    - "Append-only event ledger (ExhibitEvent) as ground truth; current-state tables are derived, rebuildable projections"
    - "Identity tables carry no mutable status/custody fields"
    - "Prisma PascalCase/camelCase models mapped to snake_case Postgres via @map/@@map (TechArch §3.8)"
    - "PrismaClient singleton cached on globalThis to survive dev hot-reload"
    - "DB-backed app self-provides Postgres via its own docker-compose.yml (healthcheck + depends_on service_healthy + migrate->serve)"

key-files:
  created:
    - prisma/schema.prisma
    - prisma/migrations/20261007022934_init/migration.sql
    - src/lib/prisma.ts
    - docker-compose.yml
    - Dockerfile
    - .env.example
    - package.json
    - tsconfig.json
    - next.config.ts
    - vitest.config.ts
  modified:
    - .gitignore

key-decisions:
  - "Scoped Phase 1 dependencies to the data layer only (prisma, @prisma/client, zod); deferred ai/@ai-sdk/*, react-query, zustand, shadcn/ui to the phases that build their consuming screens"
  - "Pinned next@16.4.0 / react@19.3.0 (current latest, matching TechArch); kept prisma/vitest at current versions rather than npm-audit's downgrade suggestions (dev-tooling advisories only)"
  - "Dockerfile CMD runs migrate deploy -> next start, with the seed step explicitly deferred to Plan 6 per the plan"

patterns-established:
  - "Event-sourced data model: ExhibitEvent ledger is the sole writable history; *CurrentState projections are derived"
  - "Compose-provisioned Postgres is the single infrastructure spec for local/sandbox dev"

# Metrics
duration: 4min
completed: 2026-10-07
---

# Phase 1 Plan 01: Data Foundation Summary

**Next.js 16 + TypeScript app on a locked append-only Prisma event-ledger schema (Case/User/Exhibit/ExhibitEvent + three derived current-state projections), with an initial migration and a Docker Compose Postgres 16 dev stack that builds, migrates, and serves on :3000.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-10-07T02:27:00Z
- **Completed:** 2026-10-07T02:31:37Z
- **Tasks:** 3
- **Files modified:** 15 (14 created, 1 modified)

## Accomplishments
- Scaffolded a buildable Next.js 16 App Router + TypeScript project with vitest (node env) and tsx tooling; `npm run build` and `npx tsc --noEmit` both pass clean.
- Locked the append-only event-ledger Prisma schema exactly per FRD Y0-schema.md / TechArch §3 — 7 Phase-1-scoped models with snake_case Postgres mapping and zero mutable status/custody fields on identity tables.
- Generated and committed the initial migration; it applies cleanly to a fresh Postgres 16, and `prisma validate`/`generate` succeed.
- Stood up the `docker compose up` dev stack: Postgres 16 (healthcheck) + app that runs `migrate deploy -> next start`, verified reaching Up/healthy and responding 200 on :3000, with clean teardown.

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold Next.js 16 + TypeScript project with test tooling** - `7ff0da2` (feat)
2. **Task 2: Lock in Prisma event-ledger schema and generate initial migration** - `9cbc930` (feat)
3. **Task 3: Docker Compose dev stack (Postgres + app) and env scaffolding** - `dc8df0e` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `package.json` - Project manifest; data-layer deps + dev/build/start/lint/test/prisma scripts
- `tsconfig.json` - TypeScript strict config (Next.js-managed jsx/include adjustments applied at build)
- `next.config.ts` - Minimal Next.js config
- `vitest.config.ts` - Node-environment test runner config (no jsdom; no UI tests this phase)
- `.gitignore` - Project-specific entries (.env, build caches) outside the Pivota-managed block
- `.dockerignore` - Excludes node_modules/.next/.git/.env/planning from build context
- `src/app/layout.tsx`, `src/app/page.tsx` - Minimal default App Router shell (no custom UI — deferred to Phase 2)
- `prisma/schema.prisma` - The locked 7-model event-ledger schema
- `prisma/migrations/20261007022934_init/migration.sql` - Initial migration (7 snake_case tables, enums, indexes, FKs)
- `prisma/migrations/migration_lock.toml` - Prisma migration provider lock
- `src/lib/prisma.ts` - Singleton PrismaClient export
- `docker-compose.yml` - Postgres 16 (healthcheck) + app (depends_on service_healthy) dev stack
- `Dockerfile` - node:20-alpine, prisma generate + next build, CMD migrate deploy -> next start
- `.env.example` - Dev-only DATABASE_URL placeholder (copy to .env locally)

## Decisions Made
- **Phase-scoped dependencies:** installed only the data-layer stack (prisma, @prisma/client, zod) plus runtime (next/react) and test tooling (vitest, tsx). AI SDK, react-query, zustand, and shadcn/ui are deferred to the phases that build their consuming screens, per the plan's explicit instruction.
- **Version pinning:** next@16.4.0 and react@19.3.0 are the current latest and match TechArch's 16.x/19.x. Kept prisma@6.x and vitest@3.x at current releases rather than applying `npm audit fix --force`, which proposes *downgrades*/breaking changes to older versions to clear dev-tooling-only advisories (see Issues Encountered).
- **Seed deferral:** the Dockerfile CMD intentionally omits a seed step; Plan 6 (seed loader) will extend it to `migrate deploy && seed && next start` once the seed script exists.

## Deviations from Plan

None - plan executed exactly as written.

The plan noted Task 2's migration depends on Task 3's compose DB; the compose file and Postgres service were created ahead of running the migration (as the plan permits) and the compose/Dockerfile/.env.example artifacts were committed under Task 3. This is the plan's own sequencing guidance, not a deviation.

## Known Stubs

None found. (The one `grep` hit for "placeholder" is in a `prisma/schema.prisma` doc comment describing intended runtime behavior — "absence is meaningful and must never be backfilled with a placeholder row" — not an incomplete implementation.)

## Issues Encountered
- **npm audit reports 6 vulnerabilities (dev tooling only).** The advisories are in `@vitest/mocker`/`tinypool` (vitest's worker pool) and `deepmerge-ts` (pulled by `@prisma/config`) — all build/test-time tooling, not production runtime code, and not exposed to untrusted input in this app. `npm audit fix --force` resolves them only by installing *older*/breaking versions (e.g. prisma 6.12.0, vitest 4.1.11) against the plan's current-version requirement, so it was not applied. Revisit when the upstream tools ship forward fixes.

## Next Phase Readiness
- **Ready for Plan 02** of Phase 1. The schema, generated Prisma client, singleton, and running Postgres dev stack are all in place for the service layer (`recordEvent`, projection writers) and seed/demo data to build against a real database from day one.
- No blockers.

## Self-Check: PASSED

- All 10 key files verified present on disk.
- All 3 task commits (`7ff0da2`, `9cbc930`, `dc8df0e`) verified in git history.
- Plan-level build check: `npm run build` → exit 0.
- `## Known Stubs` section present; no blocking stubs.

---
*Phase: 01-data-foundation*
*Completed: 2026-10-07*
