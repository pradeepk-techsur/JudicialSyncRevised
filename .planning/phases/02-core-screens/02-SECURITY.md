# Security Report — Phase 02: Core Screens (Case Workspace + Exhibit Detail View)

**Mode:** verify
**Audited:** 2026-10-07
**Verdict:** SECURED
**Confirmed HIGH/CRITICAL:** 0

## Summary
All 18 threats declared across the phase's 7 PLAN.md `<threat_model>` blocks were verified against the actual implemented code (not comments/intent) and, where testable, against the live dev server. Every `mitigate` disposition has a real, reachable, correctly-ordered guard: sealed-exhibit exclusion is applied as a Prisma `WHERE` predicate inside `getExhibit`/`getExhibits`/`searchExhibits` (never a post-query filter), `parseRequestingRole` fails closed to `ATTORNEY` on any missing/invalid/empty `X-User-Role` header, and both single-exhibit routes return byte-identical 404 bodies for "sealed+unauthorized" vs. "genuinely missing" — confirmed by direct `curl` probes against the running app, not just unit tests. Every `accept` disposition is genuinely scoped (documented, bounded blast radius, consistent with the project's no-production-auth demo posture) rather than a silently-unmitigated risk mislabeled as accepted. A full scan of the changed-file set for additional high-signal classes (XSS beyond the declared T-02-14/16, IDOR, secret/token leakage, path traversal, unsafe deserialization, command injection) found nothing new. Ship.

## Attack surface audited

| Area | STRIDE | Verdict | Evidence (file:line) |
|------|--------|---------|----------------------|
| T-02-01: npm lockfile integrity | T | SAFE (accepted, scoped) | `package-lock.json` present and committed; no floating `latest` deps; consistent with `04-security.md` §5.5 |
| T-02-02: Playwright version pin | D | SAFE | `package.json:35` `"@playwright/test": "^1.63.0"` — exact pin, not `latest`; `package-lock.json:2027` resolves to `1.63.0.tgz` |
| T-02-03: sealed-exhibit WHERE predicate | I | SAFE | `src/services/exhibits.ts:109-114` `getExhibit` applies `isSealed: false` inside `findFirst` WHERE when `!canViewSealed(role)`; `src/services/history.ts:129-132` inherits via early-return before ledger query runs. Live-probed: JUDGE sees S-1 (200 w/ full body), ATTORNEY gets 404 on the same id |
| T-02-04: unauthenticated X-User-Role spoofing | S | SAFE (accepted, scoped) | `src/services/visibility.ts:36-42` — no crypto verification exists or is claimed; read-only visibility gate only, never a write-authz boundary (confirmed: no route in the changed set uses role for POST/write gating) |
| T-02-05: anti-enumeration byte-identical 404 | I | SAFE | `src/app/api/exhibits/[id]/route.ts:20-22` and `.../history/route.ts:23-25` both throw identical `NotFoundError('EXHIBIT_NOT_FOUND', 'No exhibit found with the given ID')`. **Live-probed:** sealed+ATTORNEY and nonexistent-id requests to both endpoints returned textually identical JSON bodies and status 404. Route tests additionally assert `toEqual` deep-equality (`route.test.ts:85`, `history/route.test.ts:98`) |
| T-02-06: fail-closed role parsing | E | SAFE | `src/services/visibility.ts:36-41` — unrecognized/missing/empty header → `'ATTORNEY'` (least-privileged). **Live-probed:** no-header and `X-User-Role: SUPERADMIN` requests for the sealed exhibit both returned 404, not the exhibit |
| T-02-07: full roster exposure via GET /api/case | I | SAFE (accepted, scoped) | `src/services/cases.ts:27-31` returns all 6 active users unfiltered; `src/app/api/case/route.ts`. Live-probed: returns exactly 6 synthetic personas (names/roles only, no PII, no credentials) |
| T-02-08: seed loader write-path integrity | T | SAFE | `src/data/seed.ts` — grep confirms zero direct `prisma.exhibitEvent.create`/`prisma.*CurrentState.create` calls; sealed exhibit built exclusively via `makeExhibit`→`createExhibit`/`recordStatusChange`/`recordCustodyTransfer` (`seed.ts:127-145,338-363`) |
| T-02-09: searchExhibits query-param → Prisma WHERE | T | SAFE | `src/services/exhibits.ts:213-258` — every filter uses Prisma's object-based query builder (`contains`/`gte`/`lte`), never string interpolation; `status` validated via `exhibitStatusEnum.safeParse` before reaching the query (`exhibits.ts:204-209`). Live-probed: `status=NOTASTATUS` → 422 `VALIDATION_ERROR`, never reaches the DB |
| T-02-10: sealed predicate in same WHERE as search filters | I | SAFE | `src/services/exhibits.ts:213-219` — `isSealed: false` spread into the SAME `where` object as keyword/status/witness filters. Live-probed: `keyword=Chambers` (matches S-1's description) returns `[]` for ATTORNEY, `['S-1']` for JUDGE |
| T-02-11: unbounded keyword length DoS | D | SAFE (accepted, scoped) | No length cap exists in `searchExhibits`; scoped to single-case/<10-concurrent-user demo per `04-security.md` §5.5 — not a credible DoS vector at this data volume |
| T-02-12: disabled nav as span not Link | T | SAFE | `src/components/shell/Sidebar.tsx:26-33` — `COMING_SOON` items render as `<span aria-disabled="true">`, never `<Link href>`; only `Case Workspace` (line 20) uses `<Link>` |
| T-02-13: unauthenticated bootstrap endpoint | I | SAFE (accepted, scoped) | `src/app/api/case/route.ts` — no auth; inherits T-02-07's disposition; no sensitive data in the response (synthetic case/persona identifiers only) |
| T-02-14: React auto-escaping in ExhibitTable | I/T(XSS) | SAFE | `src/components/case/ExhibitTable.tsx:44-51` — `{row.description}`, `{row.associatedWitness}` etc. are plain JSX text interpolation; no `dangerouslySetInnerHTML` anywhere in the changed file set (grep confirmed zero hits) |
| T-02-15: react-query role-keyed cache | I | SAFE | `src/hooks/useExhibitList.ts:32` `queryKey: ['exhibits', caseId, role, ...]` — role switch is a cache-key change, forcing a fresh server-enforced query, never a stale/cached sealed row |
| T-02-16: React auto-escaping in ExhibitHeader/Timeline | I/T(XSS) | SAFE | `src/components/exhibit/ExhibitHeader.tsx:9,13-15` and `src/components/exhibit/Timeline.tsx:14,16` — all free-text (`description`, `summary`, `actorName`) rendered via plain JSX interpolation; zero `dangerouslySetInnerHTML` in either file |
| T-02-17: anti-enumeration timing/content side-channel | I | SAFE | `src/components/exhibit/ExhibitNotFound.tsx` — single shared render, zero conditional branches by cause; `src/hooks/useExhibitHistory.ts:25` explicitly disables retry for `NotFoundError` (`!(error instanceof NotFoundError) && failureCount < 2`), closing the retry-backoff timing side-channel |
| T-02-18: route param `id` inherits 02-02 hardening | T | SAFE (accepted, correctly inherited) | `src/app/exhibit/[id]/page.tsx:11-12` passes `id` straight to `useExhibitHistory`, which calls the already-hardened `GET /api/exhibits/:id/history` (02-02) — opaque string, Prisma-parameterized, no new validation surface introduced client-side |

## Confirmed findings
> None. No HIGH/CRITICAL finding survived — or even arose during — adversarial review of the full changed-file set (routes, services, hooks, components, seed loader).

## Resolved findings
> N/A — first security audit of this phase; no prior findings to re-verify as closed.

## Accepted risks

| ID | Risk | Why accepted | Owner |
|----|------|--------------|-------|
| T-02-01 | No lockfile-integrity enforcement beyond npm's default `package-lock.json` behavior | Demo-scoped project; `package-lock.json` is present and committed, no floating `latest` tags found in `package.json`; consistent with Phase 1's own accepted npm-audit posture (`04-security.md` §5.5) | Project maintainer |
| T-02-04 | `X-User-Role` header is client-supplied and unauthenticated — any client can claim any role | No session/auth layer exists in this project's scope (`04-security.md` §5.1 "Authentication (Demo-Scoped)"); the header governs READ visibility only, never write authorization — confirmed no write route in this phase's diff gates on role | Product (TechArch §5.1) |
| T-02-07 | `GET /api/case` exposes all 6 seeded users' names + roles unfiltered | Synthetic demo personas, no real PII (mirrors Phase 1's T-01-19); the role-switcher UX requires the full roster to function; live-probed response contains no credentials/secrets | Project maintainer |
| T-02-11 | No length cap on the `keyword` search query param | Demo scale: single case, dozens of exhibits, <10 concurrent users per `04-security.md` §5.5 — not a credible DoS vector at this volume | Project maintainer |
| T-02-13 | `GET /api/case` bootstrap call is fully unauthenticated | Inherits T-02-07's disposition; every page load triggers it by design (app-shell bootstrap), no new exposure beyond the roster already accepted | Project maintainer |
| T-02-18 | Route param `id` from `/exhibit/:id` passed to the history fetch with no new client-side validation | Correctly inherits 02-02's hardened, Prisma-parameterized `GET /api/exhibits/:id/history` — verified the route treats `id` as an opaque string, no raw-SQL/template injection surface exists | Inherited from 02-02 |

## Audit trail
- Diff scoped via: SUMMARY.md-derived file list (02-01 through 02-07), repo is a shallow single-squash-commit clone with no phase-1-only ancestor to diff against
- Register: loaded from PLAN.md `<threat_model>` blocks (verify mode) — 18 threats across 7 plans
- Refutation: 18 declared threats examined (all SAFE, 6 as accepted/scoped), plus an independent scan of the full changed-file set for command injection, IDOR, secret leakage, path traversal, unsafe deserialization, and XSS beyond the declared register — 0 new candidates found, 0 confirmed
- Live-server verification performed for the 7 highest-value, empirically-testable claims: role-based list visibility (9 vs 8 rows), byte-identical 404 anti-enumeration (both `/exhibits/:id` and `/exhibits/:id/history`, sealed-unauthorized vs. genuinely-missing), fail-closed role parsing (no header + invalid header), sealed-exclusion inside search (keyword matching sealed content), EMPTY_SEARCH_CRITERIA / VALIDATION_ERROR enforcement, and GET /api/case roster exposure scope — all matched the declared mitigations exactly
