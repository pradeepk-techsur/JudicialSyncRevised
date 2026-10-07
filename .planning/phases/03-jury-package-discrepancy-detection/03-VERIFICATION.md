---
phase: 03-jury-package-discrepancy-detection
verified: 2026-10-07T14:54:54Z
status: passed
score: 5/5 must-haves verified
---

# Phase 3: Jury Package & Discrepancy Detection Verification Report

**Phase Goal:** The system automatically flags operational risks the moment they occur — an admitted exhibit with no recorded custodian, or an admitted exhibit with a still-unresolved objection — and a deputy/clerk/admin can build a jury package that structurally cannot be finalized while an open discrepancy remains on any included exhibit.

**Requirements:** F5, F6, F11
**Verified:** 2026-10-07T14:54:54Z
**Status:** passed
**Re-verification:** No — initial verification

## Gate Evidence (mandatory input)

Read `03-GATE.md` and `03-REVIEW.md` before any code inspection:

| Signal | Value | Source |
| ------ | ----- | ------ |
| `gate_status` | **passed** | 03-GATE.md frontmatter |
| `boot_smoke` | **pass** | 03-GATE.md frontmatter |
| `review_blockers_open` | **0** | 03-GATE.md + 03-REVIEW.md (status: clean, iteration 2) |
| `shadowed_sources` | 0 | 03-GATE.md |
| `tests_disabled_during_fixes` | none | 03-GATE.md |
| Waves 1–5 build/tests | all pass, 0 fix attempts | 03-GATE.md |
| Final regression | 153/153 green on final tree | 03-GATE.md Wave 5 |

All gate signals are present and green, so `passed` status is permitted. Build/test/boot
are cited from the gates, not re-litigated. Code review (2 iterations) verified the three
prior findings fixed by reading the fixes: B1 (sealed-exhibit leak on case-wide feed),
W1 (non-atomic flag creation on objection write paths — advisory-lock serialized),
W3 (Exhibit Detail banner mounting the jury-package poll — extracted standalone hook).

## Goal Achievement

### Observable Truths (mapped to Success Criteria)

| # | Truth (Success Criterion) | Status | Evidence |
| - | ------------------------- | ------ | -------- |
| 1 | Discrepancy flag appears automatically on state change (no jury-package trigger) | ✓ VERIFIED | `evaluateDiscrepancies` called SYNCHRONOUSLY inside write transactions: `status.ts:126`, `objections.ts:241`, `custody.ts:139` — each passes `tx` + triggering `event.id`. Engine reads derived projections only (discrepancies.ts:97-113), fires ADMITTED_NO_CUSTODIAN + UNRESOLVED_OBJECTION rules, creates OPEN flag in same write (idempotent find-first, discrepancies.ts:120-137). Live test: `discrepancies.test.ts` 10/10 pass. |
| 2 | Deputy/clerk/admin initiates draft; sees computed ADMITTED list with LIVE per-row discrepancy status | ✓ VERIFIED | `initiateJuryPackage` (juryPackage.ts:225) role-gated DEPUTY/CLERK/ADMIN, one-living-DRAFT. Each row carries `flags[]` (OPEN/ACKNOWLEDGED). GET reconciles DRAFT to live ADMITTED set (juryPackage.ts:327-332). `JuryPackageDraft.tsx` renders per-row `DiscrepancyBadge`. Test `each returned row carries flags[]: FLAGGED/CLEAN/ACKNOWLEDGED` passes. |
| 3 | Finalize rejected while any included exhibit has OPEN discrepancy; blocking exhibit(s) named | ✓ VERIFIED | `finalizeJuryPackage` (juryPackage.ts:342-408) re-evaluates FRESH over MEMBERSHIP (incl. sealed, juryPackage.ts:366), blocks on OPEN only, throws 409 `JURY_PACKAGE_DISCREPANCIES_OPEN` with `{ blockingExhibits }` details (juryPackage.ts:393-398). Frontend: real `disabled` attribute on finalize button (JuryPackageDraft.tsx:239) + caption. Test `sealed OPEN discrepancy blocks finalize for a DEPUTY who cannot see it` passes. |
| 4 | Explicit acknowledge with required justification; recorded as auditable visible event | ✓ VERIFIED | `acknowledgeDiscrepancy` (discrepancies.ts:193-273): 422 JUSTIFICATION_REQUIRED on empty/whitespace, role-gated against real User.role, writes DISCREPANCY_ACKNOWLEDGED ledger event + flips flag ACKNOWLEDGED in ONE `$transaction` (discrepancies.ts:250-272). Idempotent 200 no-op on re-ack. Route returns 200 (acknowledge/route.ts:47). Test suite 9/9 pass. Inline UI via `AcknowledgeInline.tsx`. |
| 5 | Opening Workspace before any package shows explicit "no package" state; viewing creates NO draft | ✓ VERIFIED | `getJuryPackage` returns `{ juryPackage: null, exhibits: [] }` when none exists, creating nothing (juryPackage.ts:300-303). GET route delegates read-only (route.ts:26). Page renders `JuryPackageEmpty` on `pkg === null` (page.tsx:33-41). Test `getJuryPackage before any initiate → { juryPackage: null } and creates NOTHING` passes. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `prisma/schema.prisma` | DiscrepancyFlag, JuryPackage, JuryPackageExhibit + enums | ✓ VERIFIED | All 3 models present (lines 236, 263, 281) with full relations to Case/Exhibit/User/ExhibitEvent |
| `src/services/discrepancies.ts` | eval/get/getExhibit/acknowledge + RULE_CODES | ✓ VERIFIED | 273 lines, all exports present, both rules implemented |
| `src/services/juryPackage.ts` | compute/initiate/getJuryPackage/finalize | ✓ VERIFIED | 408 lines, read-only GET + fresh finalize gate |
| `src/app/api/cases/[id]/jury-package/route.ts` | GET read-only + POST initiate | ✓ VERIFIED | GET (no create) + POST (role-gated) |
| `src/app/api/jury-package/[id]/finalize/route.ts` | POST finalize fresh gate | ✓ VERIFIED | 55 lines |
| `src/app/api/discrepancies/[id]/acknowledge/route.ts` | POST acknowledge, 200/422/404 | ✓ VERIFIED | Required-justification validation, 200 contract |
| `src/app/api/cases/[id]/discrepancies/route.ts` | case-wide feed, sealed-aware | ✓ VERIFIED | role-threaded, B1 sealed guard confirmed by review |
| `src/app/jury-package/page.tsx` | empty/draft/finalized states | ✓ VERIFIED | 70 lines, 3-state render from server truth |
| `src/hooks/useJuryPackage.ts` | query + initiate/finalize/acknowledge | ✓ VERIFIED | 107 lines, role-keyed, 4s poll |
| `src/hooks/useAcknowledgeDiscrepancy.ts` | standalone ack mutation (W3 fix) | ✓ VERIFIED | 43 lines, mutation-only, no useQuery |
| `src/components/jury/JuryPackageDraft.tsx` | hard-disabled gate + inline ack | ✓ VERIFIED | 268 lines, real `disabled` attribute |
| `src/components/jury/{Empty,Finalized,AcknowledgeInline}.tsx` | supporting views | ✓ VERIFIED | all present |
| `src/components/case/DiscrepancyBadge.tsx` | amber/muted labels | ✓ VERIFIED | 84 lines |
| `src/components/shell/JuryPackageNavItem.tsx` | live nav + count badge | ✓ VERIFIED | reads useDiscrepancyCount, links /jury-package |
| `src/data/seed.ts` | assertSeedIntegrity both rules fire | ✓ VERIFIED | asserts ≥1 of each rule (seed.ts:463-470) |

### Key Link Verification

| From | To | Status | Details |
| ---- | -- | ------ | ------- |
| status.ts / objections.ts / custody.ts | evaluateDiscrepancies | ✓ WIRED | Imported + called inside each write tx with tx + event.id |
| discrepancies.ts | prisma.discrepancyFlag | ✓ WIRED | create (fire) / updateMany (resolve) keyed by exhibitId+ruleCode |
| juryPackage.finalize | evaluateDiscrepancies + flag read | ✓ WIRED | fresh eval per member, reads OPEN flags, names blockers |
| jury-package GET route | getJuryPackage | ✓ WIRED | read-only, returns null on empty |
| acknowledge route | acknowledgeDiscrepancy | ✓ WIRED | delegates, maps idempotent to 200 |
| JuryPackageDraft | /api/jury-package/:id/finalize | ✓ WIRED | finalize mutation gated on live OPEN flags |
| AcknowledgeInline → JuryPackageDraft | /api/discrepancies/:id/acknowledge | ✓ WIRED | inline textarea → mutation → invalidate |
| Sidebar/JuryPackageNavItem | /api/cases/:id/discrepancies | ✓ WIRED | useDiscrepancyCount count badge |

### Requirements Coverage

| Requirement | Status | Note |
| ----------- | ------ | ---- |
| F6 (Discrepancy Identification) | ✓ SATISFIED | Truths 1, 4 verified |
| F5 (Jury Package build/finalize) | ✓ SATISFIED | Truths 2, 3, 5 verified |
| F11 (Jury Package Workspace) | ✓ SATISFIED | Truths 2, 5 verified |

### Behavioral Spot-Checks (execution evidence, not inference)

| Check | Command | Result |
| ----- | ------- | ------ |
| Phase-3 service + route suites | `npx vitest run juryPackage/discrepancies/acknowledge/finalize/jury-package` | **35/35 passed** (5 files) |
| Type soundness | `npx tsc --noEmit` | **clean** (TSC_CLEAN) |
| Test-name ↔ criterion mapping | grep test names | `getJuryPackage before any initiate → null and creates NOTHING` (SC5), `each row carries flags[]` (SC2), `sealed OPEN discrepancy blocks finalize for DEPUTY who cannot see it` (SC3) — all green |

### Anti-Patterns Found

None. Scanned discrepancies.ts, juryPackage.ts, page.tsx, jury components, hooks — no TODO/FIXME/PLACEHOLDER/"not implemented"/stub returns in Phase-3 source. (The only "coming soon" strings are the intentional disabled Command Center / Assistant nav placeholders for future phases — expected, not a stub.)

### Human Verification Required

Carried from code review as a single non-blocking UAT item (not a gap — serialization is in place and unit-verified; only the race window is not deterministically unit-reproducible):

1. **Concurrent ruling/finalize load test (W1 serialization)**
   - **Test:** Fire two concurrent objection rulings (or ruling + finalize) against the same exhibit under load.
   - **Expected:** Advisory lock (`pg_advisory_xact_lock`) serializes the find-then-create so no duplicate OPEN flag and no gate bypass occurs.
   - **Why human:** The race is not deterministically reproducible in unit tests; the serialization guarantee warrants confirmation under real concurrent load.

### Gaps Summary

No gaps. All five success criteria are verified at the code level, confirmed by live execution of the Phase-3 test suites (35/35) and a clean `tsc --noEmit`, and backed by green phase gates (build/test/boot-smoke pass, 153/153 regression, 0 open review blockers). Auto-detection is wired synchronously into all three write paths; the finalize gate re-evaluates fresh over full membership (including sealed exhibits the actor cannot see) and names blocking exhibits; acknowledgment is atomic with its ledger event and requires justification; and the Workspace GET is strictly read-only with an explicit empty state. The one carried UAT item is a load-test confirmation of an already-implemented serialization, not a missing deliverable.

---

_Verified: 2026-10-07T14:54:54Z_
_Verifier: Claude (pivota_spec-verifier)_
