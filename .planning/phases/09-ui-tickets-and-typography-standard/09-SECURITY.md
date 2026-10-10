# Security Report — Phase 9: UI tickets and typography standard

**Mode:** verify
**Audited:** 2026-10-10
**Verdict:** OPEN_THREATS
**Confirmed HIGH/CRITICAL:** 1

## Summary

This phase's 17 plans are overwhelmingly presentational (CSS token sweeps, typography, severity-color scale, surface flattening, spacing/button sizing) and their `accept`/`mitigate` threat dispositions check out against the implemented code: every `mitigate` claim that cites a server-side guard (JUDGE-only `recordRuling`, `acknowledgeDiscrepancy`'s justification re-validation, `canViewSealed`-gated WHERE predicates in `attentionFeed.ts`/`juryPackage.ts`/`exhibits.ts`/`discrepancies.ts`/`objections.ts`) was traced to a real, reachable guard in the cited file — not just asserted in plan prose. React's default JSX escaping was confirmed the sole rendering path for every free-text field (`objectionGrounds`, discrepancy `summary`, ruling/custody `reason`, assistant `content`) across all 87 changed files; a repo-wide grep found **zero** `dangerouslySetInnerHTML`/`innerHTML`/`eval` call sites. The new no-role-gate `GET /api/cases/:id/jury-package/preview` route was independently probed live: it is genuinely read-only (only a `GET` export, zero write/`.create`/`.update` calls in `getJuryPackageReadinessPreview`), and its sealed-exclusion predicate is a real query-level `WHERE isSealed:false` (not a post-filter), matching the plan's anti-enumeration claim (T-09-14/T-09-15 both CONFIRMED SAFE). `NEXT_PUBLIC_DEMO_MODE` is confirmed used in exactly one place (`Header.tsx`), purely to toggle client-side rendering of the role-switcher `<Select>` — no server-side logic anywhere keys off this flag, so T-09-13's "cosmetic only" claim holds.

However, one threat's `accept` rationale is **demonstrably false against the live system**: T-09-09 ("Add exhibit" button, disposition `accept`) asserts "there is no `POST /api/exhibits` UI path or form exists" and "no write endpoint exists for exhibit creation at all today, so there is no server action to bypass." This is incorrect — `POST /api/exhibits` has existed since Phase 1 (`src/app/api/exhibits/route.ts` → `createExhibit` in `src/services/exhibits.ts`) and remains **completely unauthenticated and unauthorized** at HEAD. Live exploit testing against the running container confirmed an `ATTORNEY`-role request (and even a request with **no** `X-User-Role` header at all) successfully creates a real exhibit row (`201 Created`) in the seeded case. The FRD's own `F20-server-side-role-enforcement-matrix.md` explicitly lists "Create exhibit" as restricted to DEPUTY/CLERK/ADMIN only — this permission check was never built (F20 is openly deferred to the unplanned "Phase 7.1" per `09-CONTEXT.md`), and the Phase-9 plan's safety reasoning incorrectly treats the UI-disabled button as proof there's no reachable write path, when in fact the backend route it would call was always live and ungated. The disabled client button is real (no bypass needed — the route is already open to anyone), but the plan's underlying "no residual risk" conclusion is false. This is a pre-existing gap (not introduced by Phase 9), but Phase 9's own threat register affirmatively mis-documents it as safe, which is exactly what verify-mode audits exist to catch.

No other HIGH/CRITICAL candidates survived adversarial refutation. Recommendation: do not ship T-09-09's `accept` disposition as written; either gate `POST /api/exhibits` server-side (DEPUTY/CLERK/ADMIN, mirroring the existing `recordCustodyTransfer`/`recordRuling` pattern) or explicitly re-classify this as a known, tracked `accept`-with-residual-risk referencing the real exposed route — not "no server action to bypass."

## Attack surface audited

| Area | STRIDE | Verdict | Evidence (file:line) |
|------|--------|---------|----------------------|
| T-09-01: `status`/`filter` URL params → `searchExhibits`/`QuickFilterChips` | T | SAFE | `src/services/exhibits.ts:392-395` `exhibitStatusEnum.safeParse` rejects invalid status; `src/components/case/QuickFilterChips.tsx` falls through to `'all'` on unknown value |
| T-09-02: `objectionGrounds`/`summary` render in AttentionFeedPanel | I | SAFE | `src/components/command-center/AttentionFeedPanel.tsx:136-138` — JSX text-node interpolation only, no `dangerouslySetInnerHTML` anywhere in repo (grep confirmed 0 real call sites) |
| T-09-03: SeverityPill 4-color scale | I | SAFE (accept, verified) | Presentational-only; `SeverityPill.tsx` public API unchanged; `SeverityPill.test.ts` asserts 4 pairwise-distinct AA-compliant tones |
| T-09-04: status/icon mapping refactor | T | SAFE (accept, verified) | Static color/icon map, no user input |
| T-09-05: `/activity` `since` param | T | SAFE | `src/app/activity/page.tsx:37,50` — `SINCE_EPOCH` is a hardcoded constant, never derived from request input |
| T-09-06: `/activity` page visibility | I | SAFE (accept, verified) | Reuses existing `getRecentActivity` (role-scoped, sealed-filtered); no new query path |
| T-09-07: Record-ruling trigger in `DiscrepancyBanner` | E | SAFE | UI gate: `RecordRulingForm.tsx:17,34` `RULING_ROLES=['JUDGE']` null-render; authoritative server gate: `src/services/objections.ts:183-189` resolves `User.role` from DB, rejects non-JUDGE for ALL dispositions incl. RESERVED |
| T-09-08: Acknowledge justification | T | SAFE | `src/services/discrepancies.ts:236-242` re-validates `justification.trim().length>0` server-side (422), independent of client `canConfirm` |
| T-09-09: "Add exhibit" button visibility | E | **FINDING — see below** | `src/app/case/page.tsx:113-119` button is `disabled` with no handler (true), but `src/app/api/exhibits/route.ts` (`POST`) + `src/services/exhibits.ts:40-95` `createExhibit` have **zero role check** — live-exploited, see Confirmed findings |
| T-09-10: `loadJuryEligibilityByExhibit`'s `isSealed` batch query | I | SAFE | `src/services/exhibits.ts:329-336,345-350` — `exhibitIds` list is derived strictly from the already sealed-filtered `exhibits` query before being passed in; `history.ts:226` call site is downstream of `getExhibit`'s own canViewSealed gate |
| T-09-11: Witness ComboBox → `searchExhibits` | T | SAFE | `src/components/case/SearchFilterBar.tsx:88-103` sources `items` from role-visibility-filtered loaded list; even if bypassed, `src/services/exhibits.ts:414` uses Prisma's parameterized `contains` filter — no SQL injection vector regardless |
| T-09-12: Jury Package nav badge data source | I | SAFE (accept, verified) | `useJuryPackage()` unchanged, already role-filtered/sealed-excluded |
| T-09-13: `X-User-Role` trust model / `NEXT_PUBLIC_DEMO_MODE` | S | SAFE (accept, verified) | `src/services/visibility.ts:36-42` `parseRequestingRole` fails closed to ATTORNEY on missing/invalid header, unchanged; `NEXT_PUBLIC_DEMO_MODE` used in exactly one place (`Header.tsx:65`), purely client-side `<Select>` visibility — grep confirms no server-side logic reads this flag |
| T-09-14: `getJuryPackageReadinessPreview` sealed anti-enumeration | I | SAFE | `src/services/juryPackage.ts:175-187` — sealed exhibit excluded via query-level `isSealed:false` predicate (never a masked placeholder row) when `!canViewSealed(role)` |
| T-09-15: No role gate on `GET /jury-package/preview` | E | SAFE (accept, verified) | `src/app/api/cases/[id]/jury-package/preview/route.ts:27-48` — only a `GET` export exists (grep confirmed), zero write/`.create`/`.update`/`.upsert` calls anywhere in `getJuryPackageReadinessPreview`; live-probed, returns identical 200 shape for every role as designed |
| T-09-16: Assistant API-key control | I | SAFE (mitigate, verified) | Grep across `src/components/assistant/*`, `useAssistantChat.ts`, `assistantStore.ts` for `apiKey`/`API_KEY`/`localStorage`/`sessionStorage` → 0 matches; `src/lib/assistantConfig.ts:22-26` is the sole, server-side-only key source |
| T-09-17: `scopedExhibitId` / example-prompt text | E | SAFE | `src/stores/assistantStore.ts:35,62-63` — purely client UI pre-fill state, never transmitted as an authorization claim; `src/lib/assistant/tools.ts:36,83,224` confirms the pre-existing Phase-4 tool layer re-applies `canViewSealed`/`requestingUserRole` per call regardless of prompt text |
| T-09-18: next/font build-time fetch | D | SAFE (accept, verified) | `src/lib/fonts.ts:1-24` uses `next/font/google` exclusively at build time; `npm run build` confirmed EXIT 0 in STATE.md, proving network access was available and no runtime fetch exists |
| T-09-19: `onRefetch` / LiveIndicator | D | SAFE (accept, verified) | Calls existing read-only `activity.refetch()`, no new write path |
| T-09-20: Contrast audit tooling | — | SAFE (accept, verified) | Zero new runtime code path/dependency; reuses 09-02's pure function |
| T-09-21: Surface-stack flattening | — | SAFE (accept, verified) | Zero code change (plan's sanctioned outcome); presentational only |
| T-09-22: Spacing/button-size sweep | — | SAFE (accept, verified) | Presentational CSS token-only change, no new data flow |
| T-09-23: Typography correction sweep | — | SAFE (accept, verified) | Presentational CSS/type-style token-only change, no new data flow |
| Cross-cutting: `dangerouslySetInnerHTML`/`innerHTML`/`eval` across all 87 changed files | T/I | SAFE | Repo-wide grep: 0 real call sites (1 comment mention only, `MessageBubble.tsx:32`) |
| Cross-cutting: free-text → `href`/`src` attribute injection | T | SAFE | Grep for `href={...summary/grounds/justification}` patterns across `src/`: 0 matches |
| Cross-cutting: IDOR on new/changed service reads (`attentionFeed.ts`, `juryPackage.ts` preview, `history.ts`, `exhibits.ts`) | I/E | SAFE | All four apply their `canViewSealed`/`isSealed` WHERE predicate BEFORE data leaves the function — confirmed by direct code read, not just plan assertion |

## Confirmed findings

### F-09-01: `POST /api/exhibits` has no role enforcement, contradicting T-09-09's "accept" rationale — HIGH
- **Category:** authz_bypass (missing role gate on a write endpoint)
- **Location:** `src/app/api/exhibits/route.ts:9-23` (route, no auth/role check at all) → `src/services/exhibits.ts:40-95` (`createExhibit`, no `actorUserId`/role parameter in its signature, no `User.role` lookup anywhere in the function)
- **Description:** The FRD's `F20-server-side-role-enforcement-matrix.md` (row 1) requires "Create exhibit" to be restricted to DEPUTY/CLERK/ADMIN, with a documented `ROLE_NOT_PERMITTED` 403 for any other role. No such check exists anywhere in the call chain: the route takes no `X-User-Role`/`actorUserId` at all, and `createExhibit`'s `CreateExhibitInput` has no role-bearing field. T-09-09 (Phase 9, disposition `accept`) claims "no write endpoint exists for exhibit creation at all today, so there is no server action to bypass" — this is factually false; the endpoint has existed since Phase 1 and is fully reachable.
- **Exploit:** Live-tested against the running container (`c95f6208-a5c8-4f29-bd48-4917c24fde40` seeded case):
  ```
  curl -X POST http://localhost:3000/api/exhibits \
    -H "Content-Type: application/json" \
    -H "X-User-Role: ATTORNEY" \
    -d '{"caseId":"<real case id>","exhibitLabel":"X","description":"y","offeringParty":"PLAINTIFF"}'
  → HTTP 201, exhibit created
  ```
  Also succeeds with **no** `X-User-Role` header at all. An ATTORNEY (FRD: read-only except raising objections) or an unauthenticated script can silently inject arbitrary exhibit identity records into a live case — polluting the evidentiary record a courtroom system is specifically built to make tamper-evident. The Case Workspace UI's disabled "Add exhibit" button provides zero actual protection since the backend was never gated; a curl command or any direct API call bypasses it trivially.
- **Fix:** Add a server-side role gate to `createExhibit` mirroring the existing pattern in `recordCustodyTransfer` (`src/services/custody.ts:94-110`) — resolve `actorUserId`'s `User.role` from the DB and reject with `RoleNotPermittedError` unless role is DEPUTY/CLERK/ADMIN, per FRD F20 row 1. This requires `createExhibit`'s signature to accept `actorUserId` and the route to pass it through (currently absent entirely — this is a real code change, not a no-op). Until fixed, this threat's disposition in `09-09-PLAN.md`/future audits must read `accept` **with the documented residual risk that `POST /api/exhibits` is reachable and ungated**, not "no server action to bypass."

## Resolved findings
Not applicable — this is the first security audit of Phase 9's threat register. No prior findings exist to confirm closed.

## Accepted risks

| ID | Risk | Why accepted | Owner |
|----|------|--------------|-------|
| T-09-13 | `X-User-Role` is a client-supplied header with no session/auth layer; `actorUserId` is a client claim | Pre-existing, documented architectural limitation since Phase 1 (no auth infra in scope); the per-write-path role checks that DO exist (`recordRuling`, `recordCustodyTransfer`, `acknowledgeDiscrepancy`) correctly resolve role server-side from `User.role`, not from the header/claim — the identity-assurance gap is upstream of these checks and is a future auth-phase concern, not a Phase 9 lapse | Product / future auth-phase planner |
| T-09-15 | `GET /jury-package/preview` has no role gate by design | F25 explicitly specifies identical 200 response for every role on this read-only route; no mutation capability exists in the handler (verified) | Product (FRD F25 §Validation) |
| T-09-18 | `next/font/google` requires build-time network access | Known constraint of next/font; build confirmed to succeed in this environment | Project maintainer |

## Audit trail
- Diff scoped via: the complete changed-file set compiled from all 17 `09-0N-SUMMARY.md` `key-files` sections (87 files), git history squashed to 3 commits so audited at HEAD directly rather than via `git diff`.
- Register: loaded from the `<threat_model>` block in all 17 `09-0N-PLAN.md` files — 23 named threats (T-09-01 through T-09-23).
- Refutation: 23 named threats + 3 cross-cutting adversarial checks (dangerouslySetInnerHTML sweep, href/src injection sweep, IDOR sweep on 4 new/changed service functions) examined = 26 candidates. 25 confirmed SAFE via direct code inspection (every `mitigate` claim traced to a real, reachable server-side guard; every `accept` claim's "why safe" rationale independently verified true of the code) — several additionally confirmed via live exploit-style probing of the running Docker container (`POST /api/exhibits`, `GET /jury-package/preview`, `GET /activity`). 1 confirmed as an OPEN finding (F-09-01 / T-09-09): the `accept` disposition's rationale ("no write endpoint exists... no server action to bypass") was tested against the live system and found false — `POST /api/exhibits` is real, reachable, and completely unauthorized, independently of this phase's UI-only "disabled button" change. This is a pre-existing gap from Phase 1 that Phase 9's own threat register affirmatively mis-documents as safe.
