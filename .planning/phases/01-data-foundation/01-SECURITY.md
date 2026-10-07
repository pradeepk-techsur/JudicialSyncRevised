# Security Report — Phase 01: data-foundation

**Mode:** verify
**Audited:** 2026-10-07
**Verdict:** SECURED
**Confirmed HIGH/CRITICAL:** 0

## Summary
Phase 1 builds the append-only event-ledger foundation (recordEvent + status/objection/custody services, the seed loader, and projection-rebuild verification) with no UI and no authentication layer yet, per explicit scope. All 21 threat-model entries (T-01-01 through T-01-21) across the seven plan files were walked against the implemented code at HEAD (a32e06a) and confirmed genuinely present — not merely claimed. Every `mitigate` disposition has a concrete, grep-verifiable code location, and the two highest-stakes checks (judge-only ruling enforcement for all three dispositions including RESERVED, and the custody chain-of-custody equality check) were further confirmed by actually running the integration test suites against the live Postgres database (23 service-layer tests + 20 HTTP-layer/seed tests, all green). `recordEvent()` is confirmed the sole `prisma.exhibitEvent.create` call site in non-test code; `rebuildProjections()` is confirmed to contain zero write calls; the seed loader is confirmed to contain zero direct `*CurrentState`/`exhibitEvent` create calls, writing exclusively through the same service functions a live UI action would call. No unflagged attack surface was found beyond what the threat model already documents as `accept`/`transfer` (sealed-exhibit visibility deferral, no-auth actorUserId trust, and free-text rendering ownership transfer to Phase 2) — all of which are legitimate, documented, in-scope deferrals rather than lapsed mitigations. Phase 1 ships with zero open HIGH/CRITICAL findings.

## Attack surface audited

| Area | STRIDE | Verdict | Evidence (file:line) |
|------|--------|---------|----------------------|
| T-01-01: `.env`/compose credential handling | I | SAFE | `.gitignore:84-86` ignores `.env`; `.env.example:1-4` + `docker-compose.yml:4-6` carry only the dev placeholder `judicialsync_dev`, documented as non-production in both files |
| T-01-02: Postgres port 5432 published to host | T | SAFE (accepted) | `docker-compose.yml:9-10` — accepted risk, local-dev-only, documented in 01-01-PLAN.md threat register |
| T-01-03: Unpinned Docker base image / build DoS | D | SAFE | `Dockerfile:1` uses pinned `node:20-alpine`, `npm install` against committed `package-lock.json` |
| T-01-04: `POST /api/exhibits` input validation | T | SAFE | `src/services/exhibits.ts:23-31,47-65` — zod schema (`createExhibitSchema`) parses every field before any Prisma call; `offeringParty` constrained to 3-enum, `description` capped at 1000 |
| T-01-05: `recordEvent` payload validation | T | SAFE | `src/services/events.ts:32-49` — `eventPayloadSchemas[eventType].parse()` runs BEFORE the transaction opens; malformed payload never reaches a Prisma call |
| T-01-06: `createExhibit` structural exclusion of status/custody fields | E | SAFE | `src/services/exhibits.ts:35-43` — function signature has no status/custody parameter at all; `createExhibitSchema` (23-31) has no such field either |
| T-01-07: Sealed-exhibit visibility (deferred to Phase 2) | I | SAFE (accepted, documented scope boundary) | `src/services/exhibits.ts:16-21` — explicit comment confirms deferral; no UI/multi-role consumer exists in Phase 1 to exploit it |
| T-01-08: `recordStatusChange` transition enforcement | T | SAFE | `src/services/status.ts:22-30,64-71` — `ALLOWED_TRANSITIONS` table enforced server-side, rejects illegal `toStatus` with 422 before any ledger write; confirmed by passing `status.test.ts` (4/4) |
| T-01-09: Concurrent status-change race | D/T | SAFE | `src/services/status.ts:48` `pg_advisory_xact_lock` held for transaction duration; `src/lib/advisoryLock.ts:12-19` derives a stable 32-bit hash from `exhibitId` (no injection vector — pure arithmetic over string chars, passed as a parameterized `$executeRaw` argument, not interpolated into SQL text) |
| T-01-10: `actorUserId` not role-checked for status changes | E | SAFE (accepted, documented product decision) | 01-03-PLAN.md:156 — explicitly accepted; no role check exists in `status.ts`, matching the plan's disposition exactly |
| T-01-11: `recordRuling` judge-only enforcement (incl. RESERVED) | E | SAFE | `src/services/objections.ts:164-173` — looks up `User.role` server-side via `prisma.user.findUnique`, rejects any non-JUDGE for ALL THREE dispositions; confirmed by running `objections.test.ts` (8/8 incl. explicit RESERVED-by-DEPUTY rejection test, line 114) and `ruling/route.test.ts` (10/10) against live DB |
| T-01-12: `recordRuling` objectionId existence/state check | T | SAFE | `src/services/objections.ts:153-162` — existence + `UNRESOLVED` status verified before any write, `OBJECTION_NOT_FOUND`/`OBJECTION_ALREADY_RESOLVED` thrown otherwise |
| T-01-13: Ruling actor attribution (repudiation) | R | SAFE | `src/services/objections.ts:182-190` — `actorUserId` stored immutably via `recordEvent` inside the same transaction as the projection update |
| T-01-14: `recordCustodyTransfer` chain-of-custody equality check | T | SAFE | `src/services/custody.ts:93-105` — strict `claimedFrom !== currentCustodianUserId` check inside the advisory-locked transaction, `CUSTODY_CHAIN_BROKEN` thrown before any ledger write; confirmed by running `custody.test.ts` (8/8, incl. explicit wrong-holder-leaves-projection-unchanged test) |
| T-01-15: `toCustodianUserId` existence/active check | T | SAFE | `src/services/custody.ts:72-78` — direct `prisma.user.findUnique` + `isActive` check, `INVALID_CUSTODIAN` thrown otherwise |
| T-01-16: Custody transfer actor attribution (repudiation) | R | SAFE | `src/services/custody.ts:110-118` — `actorUserId` recorded immutably via `recordEvent`, distinct from `fromCustodianUserId`/`toCustodianUserId` |
| T-01-17: Seed loader bypassing the service layer | T | SAFE | `src/data/seed.ts` — zero `prisma.exhibitEvent.create`/`prisma.*CurrentState.create` calls found by grep; every history-building call uses `createExhibit`/`recordStatusChange`/`recordObjection`/`recordRuling`/`recordCustodyTransfer` (lines 129-325); confirmed by running `seed.test.ts` (3/3) against live DB |
| T-01-18: Container boot seed re-run cost | D | SAFE (accepted) | `Dockerfile:13` — accepted, demo-scale, documented in 01-06-PLAN.md |
| T-01-19: Seeded user PII in a public image | I | SAFE (accepted) | `src/data/seed.ts:44-51` — all fictional persona names, no real PII |
| T-01-20: `rebuildProjections` must never write | T | SAFE | `src/services/rebuild.ts` — grep for `recordEvent`/`.create(`/`.update(`/`.upsert(`/`.delete` inside the function body returns zero matches (only comments reference the terms); confirmed empirically by `rebuild.test.ts`'s read-only test (lines 37-67: byte-identical before/after snapshot) passing against live DB |
| T-01-21: Free-text interpolation into `summary` strings | I | SAFE (accepted/transferred) | `src/services/history.ts:84-116` — constructs strings only, does not render; ownership of safe rendering explicitly transferred to Phase 2's React layer (auto-escaping) |
| recordEvent sole-writer invariant (cross-cutting, not a named threat but load-bearing) | T/E | SAFE | `grep -rn 'exhibitEvent\.create' src/` → exactly one production call site (`src/services/events.ts:74`); the only other matches are in `*.test.ts` fixture setup code, not production write paths |
| actorUserId spoofing (no auth layer, caller supplies arbitrary UUID) | S | NOTED — not a Phase-1 finding | No login/session exists anywhere in `src/app/` (confirmed: `layout.tsx`/`page.tsx` are static placeholders, no auth/session/JWT/cookie handling found in any non-test source file). This is a real latent risk once authentication lands, but within Phase 1's surface there is no user-enumeration endpoint (no `GET /users` route exists) to discover valid UUIDs to impersonate, and the two places where role actually gates an action (T-01-10, T-01-11) either explicitly accept this as a documented product decision or correctly resolve role server-side from the DB (not from a client claim) — the server-side lookup is itself sound; the gap is identity assurance upstream of it, squarely a Phase-2+ (auth) concern, not a lapsed Phase-1 mitigation |

## Confirmed findings
None. No candidate survived adversarial refutation at HIGH/CRITICAL severity.

## Resolved findings
Not applicable — this is a first audit of Phase 1, not a re-audit. No prior findings exist to confirm closed.

## Accepted risks

| ID | Risk | Why accepted | Owner |
|----|------|--------------|-------|
| T-01-02 | Postgres port 5432 published to host in `docker-compose.yml` | Local/sandbox dev convenience only; no production deployment via this compose file (production is Vercel+Neon per TechArch §1.4) | Project maintainer |
| T-01-10 | `actorUserId` not role-checked for status transitions (F1) | FRD F01 explicitly does not gate status changes by role (unlike F2's judge-only ruling); documented product decision, not an oversight | Product (encoded in FRD F01) |
| T-01-18 | Full seed re-run cost on every container boot | Demo-scale (~8-10 exhibits, seconds of work); intentional per idempotent-seed infra requirement | Project maintainer |
| T-01-19 | Seeded persona names/roles present in built image | All fictional/demo-representative data per PROJECT.md scope; no real PII | Project maintainer |
| T-01-07 | No sealed-exhibit visibility filtering in `getExhibit`/`getExhibits` | Deliberately deferred to Phase 2, where the first role-aware UI/API consumer actually needs `requestingUserRole` plumbed through; no exposure exists yet since no multi-role consumer exists in Phase 1 | Phase 2 planner |
| T-01-21 | Free-text fields (`grounds`/`reason`/`notes`) interpolated into `summary` strings | No injection risk at this layer (string construction only); safe-rendering ownership explicitly transferred to Phase 2's React UI (auto-escaping) | Phase 2 UI implementer |
| (unflagged, noted) | No authentication layer; `actorUserId` is a client-supplied claim with no identity verification | Phase 1 is explicitly backend/API-only per STATE.md with no login; the two role-sensitive checks in this phase (T-01-10, T-01-11) resolve role server-side from the DB rather than trusting a client role claim, which is the correct pattern once auth lands — the remaining gap (anyone can supply any UUID) is an authentication-layer concern for a future phase, not a Phase-1 lapsed mitigation, and no user-enumeration endpoint exists in this phase to make UUID discovery practical | Future auth-phase planner |

## Audit trail
- Diff scoped via: `git diff aca4917 (origin/main)...a32e06a (HEAD, phase-1 branch)`, restricted to `src/` and `prisma/`, cross-checked against the `files_modified` lists in all seven 01-0N-PLAN.md front-matter blocks.
- Register: loaded from the `<threat_model>` block in each of the seven PLAN.md files (01-01 through 01-07) — 21 named threats (T-01-01 through T-01-21) plus the cross-cutting `recordEvent` sole-writer invariant and the no-auth actorUserId-trust issue noted in the audit brief but not independently named in any plan's register.
- Refutation: 23 threat/surface candidates examined (21 named + 2 unnamed cross-cutting items), 0 confirmed as open HIGH/CRITICAL findings, 23 refuted as safe (18 via direct `mitigate`-disposition code inspection, 5 via `accept`/`transfer` disposition confirmed as genuinely documented+scoped rather than silently absent). Static code review was supplemented with live execution of 4 service-layer test files (23 tests) and 3 HTTP-layer/seed test files (20 tests) against the real Postgres database provisioned by `docker-compose.yml`, all passing — providing empirical (not just code-shape) confirmation of the two highest-stakes mitigations (T-01-11 judge-only ruling gate, T-01-14 custody chain-of-custody equality check) and the read-only guarantee of `rebuildProjections` (T-01-20).
