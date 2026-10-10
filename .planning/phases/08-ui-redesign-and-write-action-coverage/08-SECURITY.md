# Security Report — Phase 08: ui-redesign-and-write-action-coverage

**Mode:** verify (re-audit — zero-diff confirmation pass; all 30 prior findings carried forward by citation, independently re-confirmed against current disk state)
**Audited:** 2026-10-10 (re-audit; prior re-audit 2026-10-10 at HEAD `d05bfe7`, original audit 2026-10-09 at HEAD `0a54948`)
**HEAD:** `025346e` (confirmed via `git rev-parse HEAD`)
**Verdict:** SECURED
**Confirmed HIGH/CRITICAL:** 0

## Summary

This is a no-diff confirmation re-audit. Independently re-derived (not taken on faith) via `git log --oneline --all -- src/ e2e/ prisma/`: the most recent commit touching any implementation file is `7b97542` ("docs(phase-8): verify artifacts"), which is exactly the commit the prior SECURITY.md audited against. The two commits since then — `8abb989` (UAT completion) and `025346e` (execution-complete marker) — touch only `.planning/` planning docs, UAT sidecars, and attempt-log files; `git diff 7b97542 HEAD --stat` confirms this directly: 5 files changed, all under `.planning/phases/08-.../`, zero under `src/`, `e2e/`, or `prisma/`. There is therefore no new code attack surface to derive a register from — all 30 previously-confirmed threats (27 named T-08-01..T-08-27 + 2 unnamed adversarial probes from the original audit, plus T-08-28/T-08-29/T-08-30 from the 08-16 delta audit) are carried forward by citation.

Rather than accept the prior report's claims at face value, this re-audit spot-checked 5+ of its attack-surface rows directly against current file content: (1) `requestFinalization`'s inverted role gate in `src/services/juryPackage.ts:557-577` — confirmed present, unchanged, still resolves `actor.role` from the DB via `prisma.user.findUnique` rather than trusting any client claim; (2) `recordCustodyTransfer`'s server-side role gate in `src/services/custody.ts:57-97` — confirmed the function signature, the 404/no-op/invalid-custodian guards, and the "Server-side role gate (F24, Phase 8)... resolved from the ACTUAL User.role column, never a client claim" comment immediately preceding the gate are all present exactly as cited; (3) the sealed-visibility WHERE predicate underlying T-08-10/T-08-29 in `src/services/activity.ts:176-193`'s `getStatusCounts` — confirmed the `...(canViewSealed(role) ? {} : { isSealed: false })` spread is present in the Prisma `where` clause, meaning a non-privileged role's query is still server-side filtered to non-sealed exhibits before any count reaches the client; (4) `Sidebar.module.scss:29-30` — confirmed `inset-block-start: 3rem` / `block-size: calc(100% - 3rem)` are static literals with no `#{...}` SCSS interpolation and no `z-index` touched in the file, matching T-08-28's claim exactly; (5) `StatusDistributionBar.tsx` — confirmed the component's sole prop `statusCounts` is destructured and rendered verbatim with zero internal `fetch`/`useQuery`/`useEffect` calls, matching T-08-29's data-flow trace exactly. All 5 spot-checks matched the prior report's evidence cells verbatim — no drift, no stale citation, no file deleted/moved/renamed.

A quick independent sanity pass over this app's highest-risk categories (IDOR via client-supplied `caseId`/`exhibitId`, bypassable role gates on write actions, secret/credential leakage, sealed-exhibit leakage) found nothing beyond what the prior audit already covers: `grep` for `process.env`/`API_KEY`/`SECRET`/`password` across `src/app/api/**` surfaced no hits outside test/NODE_ENV noise; 26 API route files reference `caseId`, consistent with the prior audit's already-confirmed pattern of every read/write being scoped by a server-resolved `caseId` path param rather than a client body field. No genuinely new attack surface was found. Verdict remains SECURED, 0 confirmed HIGH/CRITICAL across the phase's full history (0 of 30).

## Attack surface audited

| Area | STRIDE | Verdict | Evidence (file:line) |
|------|--------|---------|----------------------|
| T-08-01: `requestFinalization` inverted role gate | E | SAFE | Re-confirmed live at `src/services/juryPackage.ts:557-577` — unchanged since prior audit; HEAD has zero diff to this file since `7b97542` |
| T-08-02: `finalizationRequestedBy` confers no authority | T | SAFE | Carried forward unchanged — `src/services/juryPackage.ts` untouched |
| T-08-03: no rate limit on repeated finalization requests | D | SAFE (accepted) | Carried forward unchanged |
| T-08-04: `recordCustodyTransfer` server-side role gate | E | SAFE | Re-confirmed live at `src/services/custody.ts:57-97` — role resolved from `User.role` column via DB lookup, never a client claim; unchanged |
| T-08-05: `actorUserId` still client-supplied (no auth layer) | T | SAFE (accepted) | Carried forward unchanged — pre-existing, phase-wide accepted risk |
| T-08-06: SeverityPill / ExhibitTag XSS | I | SAFE | Carried forward unchanged |
| T-08-07: Header.tsx case-number/badge removal | I | SAFE | Carried forward unchanged |
| T-08-08: `legacyAdmitForDemo` confinement | E | SAFE | Carried forward unchanged |
| T-08-09: `legacyAdmitForDemo` still writes through real ledger/engine | T | SAFE (accepted) | Carried forward unchanged |
| T-08-10: sealed-visibility WHERE predicate across Command Center reads | I | SAFE | Re-confirmed live at `src/services/activity.ts:186` — `where: { exhibit: { caseId, ...(canViewSealed(role) ? {} : { isSealed: false }) } }` present in `getStatusCounts`, unchanged |
| T-08-11: `getAttentionFeed` N+1-shaped DoS | D | SAFE (accepted) | Carried forward unchanged |
| T-08-12: `loadJuryEligibilityByExhibit`/`loadUnresolvedObjectionFlags` sealed inheritance | I | SAFE | Carried forward unchanged |
| T-08-13: `getExhibitHistory`'s 3 new sections inherit sealed-masking | I | SAFE | Carried forward unchanged |
| T-08-14: `RecordRulingForm`/`TransferCustodyForm` absent-not-disabled is UI-only | E | SAFE | Carried forward unchanged |
| T-08-15: both forms' writes are auditable ledger events | R | SAFE | Carried forward unchanged |
| T-08-16: `CustodyAtAGlancePanel`'s transfer trigger is UI-layer only | E | SAFE | Carried forward unchanged |
| T-08-17: `getCustodyByCustodian` consumption, no client re-filtering | I | SAFE | Carried forward unchanged |
| T-08-18: `ExhibitTable`'s sealed pill reveals nothing new | I | SAFE | Carried forward unchanged (ID-collision note from prior re-audit still applies — see 08-16 delta's T-08-29 for the unrelated same-numbered plan claim) |
| T-08-19: "Add exhibit" button structurally inert | E | SAFE | Carried forward unchanged |
| T-08-20: ExhibitHeader/DiscrepancyBanner delegate to 08-09's gated forms | E | SAFE | Carried forward unchanged |
| T-08-21: alert banner assumes ≤1 unresolved objection thread | I | SAFE (accepted) | Carried forward unchanged |
| T-08-22: `ObjectionCard`'s trigger has its OWN role check | E | SAFE | Carried forward unchanged |
| T-08-23: `CustodyCard`'s roster-lookup is already-visible data | I | SAFE (accepted) | Carried forward unchanged |
| T-08-24: Blockers cards' remediation triggers delegate to 08-09 forms | E | SAFE | Carried forward unchanged |
| T-08-25: "Request finalization" control's server authority | E | SAFE | Carried forward unchanged |
| T-08-26: `AttentionFeedPanel`'s inline action buttons are a 2nd redundant UI guard | E | SAFE | Carried forward unchanged |
| T-08-27: no-optimistic-update double-click DoS | D | SAFE (accepted) | Carried forward unchanged |
| (adversarial probe) Cross-case IDOR via client-supplied `caseId` | E/I | REFUTED | Carried forward unchanged; this re-audit's independent sanity pass additionally confirmed 26 API route files reference `caseId` consistent with server-side path-param scoping, no new route added |
| (adversarial probe) `exclude`/`request-finalization` free-text fields | T/I | REFUTED | Carried forward unchanged |
| T-08-28: `Sidebar.module.scss` CSS offset is presentation-only | T/E | SAFE | Re-confirmed live at `src/components/shell/Sidebar.module.scss:29-30` — static literals, no `#{...}` interpolation, no `z-index` change; file byte-identical to what prior audit cited (no diff since `7b97542`) |
| T-08-29: `StatusDistributionBar.tsx` legend-only refactor, same sealed-filtered prop | I | SAFE | Re-confirmed live at `src/components/command-center/StatusDistributionBar.tsx:40-48` — sole prop `statusCounts` destructured/rendered verbatim, zero internal fetch/query hooks; traced back through unchanged `getStatusCounts` sealed predicate (see T-08-10 above) |
| T-08-30: e2e test-file changes do not remove security-relevant assertions | R | SAFE | Carried forward unchanged — `e2e/app-shell.spec.ts`/`e2e/command-center.spec.ts` untouched since `7b97542` |
| (this re-audit) Secret/credential leakage sanity pass over `src/app/api/**` | I | SAFE | `grep -rn "process.env\|API_KEY\|SECRET\|password" src/app/api` surfaced no hits outside test/NODE_ENV noise — no new secret-handling route introduced |

## Confirmed findings

None. 0 of 30 total candidates across this phase's full history (27 original + 2 probes + 3 delta) are open HIGH/CRITICAL findings. This re-audit's independent spot-check of 5 attack-surface rows plus a fresh sanity pass over IDOR/secrets/role-gate categories found zero drift and zero new issues.

## Resolved findings

Not applicable — no prior OPEN findings existed to resolve. The phase's verdict has been SECURED with 0 confirmed findings across both the original audit and the prior re-audit; this pass's job was to confirm the zero-diff claim and spot-check evidence freshness, not to re-verify a fix.

## Accepted risks

| ID | Risk | Why accepted | Owner |
|----|------|--------------|-------|
| T-08-03 | No rate limit on repeated `request-finalization` calls | Each call overwrites the prior state (no accumulation); single-case demo with no adversarial traffic model | Product |
| T-08-05 | `actorUserId` remains client-supplied with no identity verification on any write endpoint | No auth/session layer exists anywhere in the project per documented scope; unchanged since Phase 1 | Product |
| T-08-09 | `legacyAdmitForDemo` is a seed-only narrative shortcut that skips F12's admission precondition reads | Still writes through the real ledger (`recordEvent`) and real discrepancy engine (`evaluateDiscrepancies`); grep-confinement proves it unreachable from any route/service/component | Product |
| T-08-11 | `getAttentionFeed` runs an N+1-shaped query for the HIGH tier | Acceptable at this demo's data scale; revisit only if a future phase scales case size materially | Product |
| T-08-21 | Alert banner assumes at most one UNRESOLVED objection thread per flagged exhibit | Matches the seeded P-7 scenario exactly; explicitly out of this phase's scope | Product |
| T-08-23 | `CustodyCard` resolves custodian names from the already-fully-hydrated client-side roster | No new disclosure — roster already client-visible via pre-existing `GET /api/case` bootstrap (T-02-07) | Product (pre-existing) |
| T-08-27 | No optimistic UI update means a rapid double-click could submit a ruling/transfer twice before the first poll confirms | Both underlying mutations are idempotent-SAFE at worst — the second call 409s, never double-applies or corrupts state | Product |
| T-08-05 / T-08-09 cross-cutting (unflagged, inherited) | No authentication layer exists; any `actorUserId`/`X-User-Role` value is a client-supplied, unverified claim | Pre-existing Phase-1 posture (see `01-SECURITY.md`), unchanged and not worsened by this phase | Future auth-phase planner |

## Audit trail

- Diff scoped via: independently re-derived (not taken on the task prompt's claim) via `git log --oneline --all -- src/ e2e/ prisma/`, whose most recent entry is `7b97542` — identical to the commit the prior SECURITY.md audited against. Cross-confirmed via `git diff 7b97542 HEAD --stat`, which returns exactly 5 changed files, all under `.planning/phases/08-.../` (one `08-UAT.md` doc update + its `.summary.json` sidecar + two `logs/attempt-10/*` files) — zero changes under `src/`, `e2e/`, or `prisma/`. Current `HEAD` is `025346e`. There is therefore no implementation-file diff to re-derive a register from in this pass.
- Register: loaded in full from the prior `08-SECURITY.md` (30 total candidates: 27 named T-08-01..T-08-27 + 2 unnamed adversarial probes from the original 2026-10-09 audit, + T-08-28/T-08-29/T-08-30 from the 2026-10-10 08-16 delta re-audit), re-confirmed via live file reads rather than accepted on the document's own prior assertion.
- Refutation: spot-checked 5 of the register's attack-surface rows against current on-disk content by direct file read: (1) `requestFinalization` inverted role gate (`src/services/juryPackage.ts:557-577`), (2) `recordCustodyTransfer` server-side role gate (`src/services/custody.ts:57-97`), (3) `getStatusCounts` sealed WHERE predicate (`src/services/activity.ts:176-193`), (4) `Sidebar.module.scss` static CSS offset (`:29-30`), (5) `StatusDistributionBar.tsx` prop-only data flow (`:40-48`). All 5 matched the prior report's evidence verbatim — no stale citation, no drift. Additionally performed an independent sanity pass (not a full re-derivation) over IDOR/role-gate/secret-leakage categories: `grep` for secret-handling patterns across `src/app/api/**` surfaced no hits outside test noise; confirmed 26 API route files reference `caseId` consistent with server-side path-param scoping (no client-body-supplied case/exhibit ID bypass introduced). 0 new candidates surfaced. Combined with the 30 prior candidates (confirmed unchanged via the zero-diff finding above), 0 of 30 total candidates in this phase's full history are open HIGH/CRITICAL findings.
