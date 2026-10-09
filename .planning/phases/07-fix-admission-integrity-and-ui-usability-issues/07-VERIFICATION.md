---
phase: 07-fix-admission-integrity-and-ui-usability-issues
verified: 2026-10-09T02:25:23Z
status: passed
score: 7/7 must-haves verified
human_verification:
  - test: "W1 (advisory, non-blocking) — open a DRAFT jury package that contains a retained legacy sealed INCLUDED member as a DEPUTY or CLERK (roles that can finalize but cannot see sealed rows) and click Finalize."
    expected: "Server correctly returns JURY_PACKAGE_SEALED_EXHIBIT_PRESENT 409 and finalizes nothing (integrity holds). UX gap: the JuryPackageDraft UI shows no explanatory banner for this specific role+state — the button just re-enables. This is the one advisory WARNING from 07-REVIEW.md, not a data-integrity gap."
    why_human: "Degraded-UX edge path (DEPUTY/CLERK + retained legacy sealed row); requires an actual legacy/regression row and a live session to observe the missing banner. Server authority is proven by tests; only the feedback is cosmetic."
---

# Phase 7: Fix Admission Integrity and UI Usability Issues — Verification Report

**Phase Goal:** An exhibit can never be recorded as ADMITTED while it still has an unresolved objection or no custodian of record (hard pre-write gate); a sealed/ex-parte exhibit can never appear in or be exported as part of a jury package, with explicit auditable remediation of legacy rows; every discrepancy acknowledgment's permanent audit record (actor, role, timestamp, justification) is fully visible wherever the flag is shown; and five Case Workspace / Assistant / Header / Activity-Feed usability defects are fixed — all while preserving the append-only ledger, the derived-projection invariant, and the service-layer-is-sole-entry-point architecture.
**Verified:** 2026-10-09T02:25:23Z
**Status:** passed
**Re-verification:** No — initial verification

## Gate Evidence (cited, not re-litigated)

- `07-GATE.md`: **gate_status: passed**, **boot_smoke: pass**, 4/4 waves build+tests green, **review_blockers_open: 0**, shadowed_sources: 0, tests_disabled_during_fixes: none. Final wave: build pass, `vitest run` → **215 passed / 3 skipped / 0 failed** (34 test files). Build (`next build`) emits all new routes including `/api/jury-package/[id]/exhibits/[exhibitId]/exclude`.
- `07-REVIEW.md` (iteration 2): **0 BLOCKERs**, 1 WARNING. B1 (server-authority sealed-finalize hole) confirmed FIXED by line-level reads, not merely claimed. The one WARNING (W1) is advisory UX for a DEPUTY/CLERK edge state; the server gate holds (no ex parte material is ever finalized) — carried as a human-verification item, not a gap.
- Per instructions: build/tests/boot are cited from the green gates rather than re-run.

## Goal Achievement

### Observable Truths

| #   | Truth (ROADMAP Success Criterion)                                                                                                   | Status     | Evidence                                                                                                                                                                                                                                                                                 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | ADMITTED transition rejected (422 ADMISSION_BLOCKED, every applicable reason) before any ledger write, for every caller incl. seed | ✓ VERIFIED | `status.ts:96-117` gate runs inside `$transaction` BEFORE `recordEvent()` (line 122); two reads (`objectionCurrentState.count UNRESOLVED`, `custodyCurrentState.findUnique`) build a `reasons[]` collecting BOTH conditions. `errors.ts:88-97` AdmissionBlockedError → 422, `details.reasons`. Seed routes through services (37 `recordStatusChange/recordCustodyTransfer` calls). admissionGate.test.ts (7) + seed demo-blocking test pass. |
| 2   | Sealed exhibit can never be a jury-package member via normal path; legacy sealed row → CRITICAL warning + explicit EXCLUDED removal | ✓ VERIFIED | `juryPackage.ts:102` computeJuryCandidates `where: { …, exhibit:{ isSealed:false } }`; reconcile uses actual `currentStatus` (line 221) so legacy rows are retained, not deleted; finalize hard gate `JURY_PACKAGE_SEALED_EXHIBIT_PRESENT` (480-489, before discrepancy loop); `excludeJuryPackageExhibit` (546-599) role-gated (`assertJuryWriteRole`), UPDATE status→EXCLUDED (never delete) + paired `JURY_PACKAGE_EXHIBIT_EXCLUDED` event; `JuryPackageDraft.tsx:205` "⛔ CRITICAL · ex parte" + role-gated Remove (258). juryPackage.test.ts 12 + exclude route.test.ts 6 pass. |
| 3   | OPEN flag: always-visible "recorded under your name & role" disclosure before confirm; ACKNOWLEDGED → full record inline, no 2nd click | ✓ VERIFIED | `AcknowledgeInline.tsx:43-44` always-visible disclosure; label "Justification (recorded permanently)" (51). `DiscrepancyBanner.tsx:93-97` and `JuryPackageDraft.tsx:235-237` render "Acknowledged by {name} ({role}) · {timestamp}: {justification}" inline. `discrepancies.ts:152-197` read-time justification join (no new column); assistant `tools.ts:286-299` getDiscrepancies returns the enriched service result. |
| 4   | Every Case Workspace exhibit row clickable across full area, visible hover, keyboard (Enter/Space)                                  | ✓ VERIFIED | `ExhibitTable.tsx:45-62` whole `<tr>` onClick, `tabIndex={0}`, onKeyDown handling Enter + ' ' (preventDefault + navigate). `ExhibitTable.module.scss:19-25` `cursor:pointer` + `&:hover` background. e2e/case-workspace.spec.ts covers multi-point + keyboard. |
| 5   | Assistant example prompts always reference a real seeded exhibitLabel, verified by an automated test                               | ✓ VERIFIED | `ExampleChips.tsx:4,39-47` sources labels from `useExhibitList({})` real data (fallbacks only). `e2e/assistant.spec.ts:343-371` dedicated test fetches real seeded list, builds `realLabels` set, asserts `realLabels.has(label)` for every rendered chip — not a count-only or grep-only check. |
| 6   | Header shows labeled discrepancy-count indicator (aria-label="N open discrepancies") or nothing — never a bare numeral, every screen | ✓ VERIFIED | `Header.tsx:61-72` renders indicator only when `openCount > 0`, with `aria-label={`${openCount} open discrepancies`}`; completely absent from DOM when 0 (56-57). Sourced from shared `useDiscrepancyCount` (22) in the single shared Header → identical on every screen. |
| 7   | Every Recent Activity row shows date AND time (never time-only) and the exhibit label                                              | ✓ VERIFIED | `RecentActivityPanel.tsx:24-35` formatTime uses `toLocaleString` with year/month/day/hour/minute (date+time). Line 164 renders `{e.exhibitLabel} — {e.summary}` on every row. `exhibitLabel` already present on every `RecentActivityEntry` (activity.ts). activity tests pass. |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact                                                        | Expected                                             | Status     | Details                                                                        |
| -------------------------------------------------------------- | --------------------------------------------------- | ---------- | ----------------------------------------------------------------------------- |
| `src/lib/errors.ts`                                            | AdmissionBlockedError (ADMISSION_BLOCKED/422/reasons) | ✓ VERIFIED | 139 lines; class at 88-97, imported+thrown in status.ts                        |
| `src/services/status.ts`                                       | Pre-write gate in same txn before recordEvent        | ✓ VERIFIED | 186 lines; gate 96-117, recordEvent 122                                        |
| `src/services/admissionGate.test.ts`                          | Gate integration suite (single/dual/unaffected)      | ✓ VERIFIED | 257 lines; 7 tests pass (gate output)                                          |
| `src/data/seed.ts`                                            | Gate-compliant seed, staggered timestamps            | ✓ VERIFIED | 545 lines; 37 service calls; seed.test.ts 6 pass incl. demo-blocking          |
| `src/services/events.ts`                                      | Optional recordedAt (seed-only, default new Date())  | ✓ VERIFIED | 92 lines; sole ledger writer — no stray exhibitEvent.create elsewhere          |
| `prisma/schema.prisma`                                        | New enum value/enum/columns/index                    | ✓ VERIFIED | 368 lines; migration 20261009010505 applied, build+tsc clean in gate          |
| `src/services/juryPackage.ts`                                 | isSealed filter, EXCLUDED semantics, sealed finalize gate, exclude | ✓ VERIFIED | 599 lines; see truth 2 evidence                                               |
| `src/services/juryPackage.test.ts`                            | Sealed-never-candidate + legacy-row-survives regression | ✓ VERIFIED | 415 lines; 12 tests pass                                                       |
| `src/components/case/ExhibitTable.tsx`                        | Full-row clickable + keyboard                        | ✓ VERIFIED | 95 lines; see truth 4                                                          |
| `src/components/assistant/ExampleChips.tsx`                   | Real-label-sourced prompts                           | ✓ VERIFIED | 78 lines; useExhibitList                                                       |
| `src/components/shell/Header.tsx`                             | Labeled/omitted discrepancy indicator                | ✓ VERIFIED | 111 lines; see truth 6                                                         |
| `src/components/command-center/RecentActivityPanel.tsx`      | date+time + exhibitLabel per row                     | ✓ VERIFIED | 174 lines; see truth 7                                                         |
| `src/services/discrepancies.ts`                              | Read-time justification join for ACKNOWLEDGED        | ✓ VERIFIED | 307 lines; withJustification 152-197                                          |
| `src/components/jury/AcknowledgeInline.tsx`                  | Always-visible disclosure + permanent label          | ✓ VERIFIED | 97 lines; 43-44, 51                                                            |
| `src/components/exhibit/DiscrepancyBanner.tsx`              | Full ack record inline                               | ✓ VERIFIED | 117 lines; 93-97                                                               |
| `src/components/jury/JuryPackageDraft.tsx`                  | CRITICAL sealed row + role-gated Remove + ack record | ✓ VERIFIED | 352 lines; 205/258/235-237                                                     |
| `src/app/api/jury-package/[id]/exhibits/[exhibitId]/exclude/route.ts` | Thin POST delegating to service            | ✓ VERIFIED | 54 lines; validates body, delegates to excludeJuryPackageExhibit; route in build output |

All 17 primary artifacts: exist (Level 1), substantive (Level 2), and wired (Level 3) — verified by import/usage checks and consuming tests.

### Key Link Verification

| From                                   | To                                        | Via                                          | Status  | Details                                                                 |
| -------------------------------------- | ----------------------------------------- | -------------------------------------------- | ------- | ---------------------------------------------------------------------- |
| status.ts#recordStatusChange           | errors.ts#AdmissionBlockedError           | thrown in $transaction before recordEvent    | ✓ WIRED | Gate 96-117 precedes recordEvent 122; import line 4                    |
| status/route.ts                        | errorResponse                             | AppError subclass → generic mapper → 422     | ✓ WIRED | AdmissionBlockedError extends AppError; 422 default surfaced           |
| seed.ts                                | status.ts#recordStatusChange              | every ADMIT preceded by custody, no open obj | ✓ WIRED | 37 service calls; seed demo-blocking test passes under gate            |
| juryPackage.ts#computeJuryCandidates   | prisma.exhibitCurrentState.findMany       | `isSealed:false` in same query as ADMITTED   | ✓ WIRED | Line 102                                                               |
| juryPackage.ts#reconcileDraftMembership| prisma.exhibitCurrentState.findMany       | staleness from actual currentStatus          | ✓ WIRED | Line 221 (retains legacy sealed rows)                                  |
| exclude/route.ts                       | juryPackage.ts#excludeJuryPackageExhibit  | thin route delegates validation/role-gating  | ✓ WIRED | Import line 2, call line 43                                            |
| JuryPackageDraft.tsx                   | useJuryPackage.ts                         | new exclude mutation mirrors finalize        | ✓ WIRED | Remove action wired through hook                                       |
| ExampleChips.tsx                       | useExhibitList.ts                         | real exhibitLabel values                     | ✓ WIRED | Line 39                                                                |
| e2e/assistant.spec.ts                  | GET /api/cases/:id/exhibits               | realLabels cross-check                        | ✓ WIRED | Line 354/371                                                           |
| Header.tsx                             | useDiscrepancyCount.ts                     | same shared hook, no second query            | ✓ WIRED | Line 22                                                                |
| RecentActivityPanel.tsx                | activity.ts RecentActivityEntry.exhibitLabel | rendering-only fix                         | ✓ WIRED | Line 164                                                               |
| discrepancies.ts#getDiscrepancies      | ExhibitEvent.payload.justification        | read-time lookup via acknowledgedEventId     | ✓ WIRED | 170-175                                                                |
| DiscrepancyBanner / JuryPackageDraft   | roleStore.ts#users                        | resolve acknowledgedBy → name+role client    | ✓ WIRED | users.find 70 / 227                                                    |

All 13 key links WIRED.

### Architecture Invariants (Phases 1-6)

| Invariant                                   | Status     | Evidence                                                                                  |
| ------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------- |
| Append-only ledger (recordEvent sole writer)| ✓ PRESERVED | No `exhibitEvent.create` anywhere outside events.ts; all new writes (gate, exclude) route through recordEvent |
| Derived-projection invariant                | ✓ PRESERVED | Gate reads projections inside the same txn; exclude updates row + emits event; rebuild.test.ts (3) green |
| Service layer = sole entry point            | ✓ PRESERVED | exclude route is a thin delegate; seed and assistant tools call services, not the ledger directly |

### Requirements Coverage

Per instructions, this phase's requirements (F12–F15) are tracked in project_specs/FRD/PRD, not REQUIREMENTS.md. Mapped via Success Criteria:

| Requirement | Status      | Notes                                                        |
| ----------- | ----------- | ----------------------------------------------------------- |
| F12 (Admission Integrity Gating) | ✓ SATISFIED | Truth 1 verified                                 |
| F13 (Sealed exhibit / jury-package exclusion + remediation) | ✓ SATISFIED | Truth 2 verified |
| F14 (Acknowledgment permanence disclosure + full audit record) | ✓ SATISFIED | Truth 3 verified |
| F15 (UI usability defects) | ✓ SATISFIED | Truths 4–7 verified                              |

### Anti-Patterns Found

None blocking. All SUMMARY `## Known Stubs` sections report none; stub-scan hits were false positives (the word "placeholder" only in test descriptions/comments). `deferred-items.md` contains only transient shared-working-tree concurrency artifacts (interleaved mid-edit tsc errors during parallel plan execution) — all resolved by the final green gate (34 files, 215 tests, build clean). One documentation item (docker image is baked, not bind-mounted) is an environment note for merged-HEAD preview, not a goal gap.

### Human Verification Required

1. **W1 (advisory UX, non-blocking)** — As DEPUTY/CLERK, open a DRAFT jury package containing a retained legacy sealed INCLUDED member and click Finalize.
   - Expected: server returns `JURY_PACKAGE_SEALED_EXHIBIT_PRESENT` 409, nothing is finalized (integrity holds); UI currently shows no explanatory banner for this role+state (button just re-enables).
   - Why human: degraded-UX edge path requiring a live session and an actual legacy sealed row; server authority is already proven by tests. This is the single WARNING from code review — cosmetic, not a data-integrity defect.

### Gaps Summary

No gaps. All 7 ROADMAP success criteria are verified at all three levels (exists, substantive, wired). The hard pre-write admission gate, structural sealed-exhibit exclusion with auditable legacy remediation, full acknowledgment-audit visibility, and all five UI usability fixes are present and connected. The three Phase 1-6 architecture invariants are preserved. Gate evidence is fully green (build/tests/boot pass, 0 blockers). The one advisory UX WARNING (W1) is carried as a human-verification item because the server integrity outcome is correct and only the feedback is missing for one role+edge-state combination.

---

_Verified: 2026-10-09T02:25:23Z_
_Verifier: Claude (pivota_spec-verifier)_
