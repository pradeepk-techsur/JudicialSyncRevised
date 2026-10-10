---
phase: 09-ui-tickets-and-typography-standard
verified: 2026-10-10T22:40:19Z
status: passed
score: 4/4 must-haves verified (gap-closure round; 7/7 original success criteria stand per prior 09-VERIFICATION.md)
re_verification:
  previous_status: passed (initial), with 1 CONFIRMED HIGH security finding (F-09-01) and 3 UAT issues surfaced by a LATER UAT/security pass against the same codebase
  previous_score: 7/7 success criteria (initial VERIFICATION.md) — gaps found afterward by 09-SECURITY.md (1 HIGH) and 09-UAT.md (3 issues: UAT-6, UAT-9, UAT-16)
  gaps_closed:
    - "F-09-01: POST /api/exhibits had zero server-side role enforcement — any role, or no role header, could create an exhibit"
    - "UAT-6: Case Workspace exhibit table rows visually broken (Description column collapsed, Flags pill overflow into Jury Package column)"
    - "UAT-9: ActiveRoleBanner's 'Active role: X' text hidden behind the fixed sidebar after a role switch"
    - "UAT-16: Visible 'Demo role:' label not dropped and role-switcher dropdown not left-aligned with the page title"
  gaps_remaining: []
  regressions: []
---

# Phase 9: UI Tickets and Typography Standard — Gap-Closure Verification Report

**Phase Goal:** The 16 tickets from the external UI/UX review of the develop build are each resolved as their own small, acceptance-criteria-verifiable change — the Command Center's ranked attention list is visible without scrolling and fed by a real 4-tier severity scale; every screen reads status/severity color from one shared token source; Recent Activity and the Case Workspace table read correctly and are properly labeled; discrepancy actions (Record ruling, Acknowledge) are safe, singular, and accountable; navigation and the demo role switcher are unambiguous; the Jury Package empty state guides the user and offers a read-only readiness preview to every role; the Assistant page is context-aware and removes the stray API-key control; and IBM Plex Sans/Mono actually load (verified via `document.fonts`) with every text element on a real Carbon type token — all without introducing a second styling system, a new dependency, or any data-model/API/role-permission change the tickets didn't explicitly call for.

**Verified:** 2026-10-10T22:40:19Z
**Status:** passed
**Re-verification:** Yes — gap-closure round covering 3 new plans (09-18, 09-19, 09-20) that close the 1 security finding + 3 UAT issues surfaced after the original 17-plan (09-01..09-17) implementation was initially verified 7/7 on 2026-10-10T20:06:50Z.

## Context: What This Round Verifies

The original 09-VERIFICATION.md (2026-10-10T20:06:50Z) confirmed all 7 success criteria 7/7 against plans 09-01 through 09-17. A subsequent UAT pass (09-UAT.md) and security audit (09-SECURITY.md) — run against that same implementation — surfaced 4 concrete gaps:

1. **F-09-01 (HIGH, security)** — `POST /api/exhibits` → `createExhibit` had zero role enforcement; any role (or none) could create an exhibit, contradicting FRD F20 row 1 and the Phase-9 threat register's own (disproven) `accept` rationale.
2. **UAT-6 (major)** — Case Workspace exhibit table rows rendered broken at 1440px (Description column collapsed to Label's width; Flags pills overflowed into the Jury Package column).
3. **UAT-9 (major)** — After a role switch, the "Active role: X — switch back" banner's label text was hidden under the fixed sidebar.
4. **UAT-16 (minor)** — User asked to drop the visible "Demo role:" label and left-align the role-switcher dropdown with the page title.

Three new gap-closure plans (09-18, 09-19, 09-20) were executed to close exactly these 4 items. This report verifies those 3 plans' must-haves against the actual codebase, re-drives the exact failure conditions live, and confirms no regression in the 17 previously-verified plans.

## Gate Evidence (cited, not re-litigated)

Per `09-GATE.md` (`last_updated: 2026-10-10T22:31:40Z`) and `09-REVIEW.md` (`iteration: 1`, `reviewed_at: 2026-10-10T22:23:48Z`):

- `gate_status: passed` — line 981: `build_exit=0 test_exit=0 ... test_files=52 skip_marks=5 shadow_files=0`.
- `boot_smoke: pass`.
- `review_blockers_open: 0`, `warnings: 0` — code review iteration 1 clean across all 16 files touched by 09-18/09-19/09-20.
- `shadowed_sources: 0`.
- Build: `npm run build` exit 0.
- Tests: final gate run `293 passed | 3 skipped (296)` / `290 passed | 3 skipped (293)` across repeated windows — consistent with the 42-test-file / 293-test figure cited in the task prompt.

These gate verdicts are cited as authoritative for build/boot/test/review. This report adds independent goal-backward artifact + wiring + **live behavioral re-drive** on top — not a re-read of the gate's own claims.

## Goal Achievement

### Observable Truths (the 4 gap-closure must-haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `POST /api/exhibits` rejects any non-DEPUTY/CLERK/ADMIN actor (or missing actor) with 403/422; DEPUTY/CLERK/ADMIN still succeeds | ✓ VERIFIED | **Independently re-driven live** (not just cited): ATTORNEY actorUserId → `403 {"error":{"code":"ROLE_NOT_PERMITTED",...}}`; missing actorUserId → `422 {"error":{"code":"VALIDATION_ERROR","message":"actorUserId Required"}}`; DEPUTY actorUserId → `201 Created`, real exhibit row returned. Code read confirms `EXHIBIT_CREATE_ROLES = new Set(['DEPUTY','CLERK','ADMIN'])` check sits strictly after zod validation and strictly before `prisma.exhibit.create` (exhibits.ts:47-100). `exhibits.test.ts` run live: 33/33 passing. |
| 2 | Case Workspace exhibit table rows render with zero cell-to-cell visual overlap at 1440px (Description absorbs remainder; Flags pill never overflows into Jury Package column) | ✓ VERIFIED | Code read confirms the exact two fixes from 09-19-PLAN.md present in `ExhibitTable.module.scss`: compound selector `.table :global(.cds--data-table) th:last-of-type.colChevron, .table :global(.cds--data-table) td:last-of-type.chevronCell { inline-size: 2rem; width: 2rem; }` (lines 169-172) and `.colFlags { width: 13rem; }`. **Independently re-run live**: `npx playwright test e2e/case-workspace.spec.ts` → the new UAT-6 overlap-regression test (`exhibit table rows render with zero cell-to-cell visual overlap...`) **PASSED**; 19/20 total, the 1 failure is the pre-existing 09-07 witness-filter flake (`Showing N of M`), independently confirmed unrelated: reproduced-as-already-failing before 09-19's changes, documented in `deferred-items.md` lines 55-62 and both 09-19-SUMMARY.md and 09-REVIEW.md. |
| 3 | After a role switch, the "Active role: X" banner text is fully visible, not obscured by the sidebar; "Switch back" remains clickable | ✓ VERIFIED | Code read confirms `ActiveRoleBanner.module.scss`'s `.banner` now has `padding-inline-start: 16rem` matching the documented sidebar rail-width constant. **Independently re-run live**: `npx playwright test e2e/app-shell.spec.ts` → `the active-role banner text is NOT obscured by the sidebar after a role switch (UAT-9 gap closure)` **PASSED**; full suite 14/14 passing, 0 regressions. |
| 4 | The visible "Demo role:" label is removed (control remains accessible via unchanged aria-label); the role-switcher's left edge aligns with the page title's left edge | ✓ VERIFIED | Code read confirms `Header.tsx`'s `<Select>` now has `hideLabel` + `className={styles.roleSwitcherWrap}` while `aria-label="Switch active role"` and `id="role-switcher"` are unchanged; `Header.module.scss` pins `.roleSwitcherWrap { inset-inline-start: 17.5rem; }`. **Independently re-run live**: `npx playwright test e2e/app-shell.spec.ts` → `the role switcher has no visible "Demo role" label and left-aligns with the page title (UAT-16 gap closure)` **PASSED** (part of the same 14/14 run). |

**Score:** 4/4 gap-closure truths verified. Combined with the prior round's 7/7 original success criteria (unaffected — these plans are additive/corrective, no success-criterion artifact was reverted), the phase's full 7 success criteria remain satisfied.

### Required Artifacts (gap-closure plans)

| Artifact | Expected (per plan) | Status | Details |
|----------|---------------------|--------|---------|
| `src/services/exhibits.ts` | `RoleNotPermittedError` import + `EXHIBIT_CREATE_ROLES` gate before `prisma.exhibit.create` | ✓ VERIFIED | Exact code match to plan prescription; `RoleNotPermittedError` imported (line 8), gate at lines 88-97, placed strictly between zod validation and the write |
| `src/app/api/exhibits/route.ts` | No manual change needed (generic pass-through already forwards `actorUserId`) | ✓ VERIFIED | Unchanged thin wrapper confirmed — `createExhibit(body as Parameters<typeof createExhibit>[0])` already forwards the full body, as the plan predicted no route change was needed |
| `src/components/case/ExhibitTable.module.scss` | Compound `th:last-of-type.colChevron`/`td:last-of-type.chevronCell` selector + `.colFlags: 13rem` | ✓ VERIFIED | Both present verbatim at lines 43 (`.colFlags`), 169-172 (compound selector) |
| `src/components/shell/ActiveRoleBanner.module.scss` | `.banner { padding-inline-start: 16rem; }` | ✓ VERIFIED | Present exactly as specified, with the sidebar-rail-width-matching comment block intact |
| `src/components/shell/Header.tsx` + new `Header.module.scss` | `hideLabel` + `className={styles.roleSwitcherWrap}` on Select; `.roleSwitcherWrap { inset-inline-start: 17.5rem; }` | ✓ VERIFIED | Both present; `aria-label`, `id="role-switcher"`, `value`/`onChange` all unchanged per plan's "do NOT touch" constraint |
| `src/data/seed.ts` + 8 test files | Every pre-existing `createExhibit(` call site supplies a DEPUTY/CLERK/ADMIN `actorUserId` | ✓ VERIFIED | `exhibits.test.ts` (33 tests) run live, all passing — confirms no caller broke; 09-REVIEW.md independently grepped all 31 call sites and confirmed role-appropriate actors |
| `e2e/case-workspace.spec.ts` new test | Zero cell-to-cell overlap regression test | ✓ VERIFIED | Present at line 171 of the spec file, passing live |
| `e2e/app-shell.spec.ts` new tests (×2) | UAT-9 obscured-banner + UAT-16 label/alignment regression tests | ✓ VERIFIED | Present at lines 240 and 271 of the spec file, both passing live |

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| `exhibits.ts#createExhibit` | `lib/errors.ts` | `import { RoleNotPermittedError }` | ✓ WIRED (confirmed in import block, line 8) |
| `app/api/exhibits/route.ts` | `exhibits.ts#createExhibit` | generic body pass-through including `actorUserId` | ✓ WIRED (live 403/422/201 probes confirm end-to-end) |
| `ExhibitTable.module.scss .colChevron/.colFlags` | Carbon's `th:last-of-type` override | compound selector specificity win | ✓ WIRED (live Playwright overlap test passes) |
| `ActiveRoleBanner.module.scss .banner` | `AppShell.module.scss`/`Sidebar.module.scss` 16rem rail constant | matching `padding-inline-start: 16rem` | ✓ WIRED (live Playwright hit-test confirms sidebar is not topmost element at banner text location) |
| `Header.tsx` role-switcher `Select` | page title `<h1>` left edge | `className={styles.roleSwitcherWrap}` → `inset-inline-start: 17.5rem` | ✓ WIRED (live Playwright pixel-alignment assertion `<=2px` passes) |

### Independent Live Re-Drive (not cited from gate — executed fresh during this verification)

| Check | Command | Result |
|-------|---------|--------|
| F-09-01 ATTORNEY actor | `curl -X POST /api/exhibits -d '{...,"actorUserId":"<ATTORNEY id>"}'` | `403 ROLE_NOT_PERMITTED` ✓ |
| F-09-01 missing actor | `curl -X POST /api/exhibits -d '{...no actorUserId}'` | `422 VALIDATION_ERROR` ✓ |
| F-09-01 DEPUTY actor (legitimate path unaffected) | `curl -X POST /api/exhibits -d '{...,"actorUserId":"<DEPUTY id>"}'` | `201 Created`, real exhibit row returned ✓ |
| `exhibits.test.ts` | `npx vitest run src/services/exhibits.test.ts` | 33/33 passed ✓ |
| `e2e/app-shell.spec.ts` full suite | `npx playwright test e2e/app-shell.spec.ts --workers=1` | **14/14 passed**, 0 regressions (includes both new UAT-9/UAT-16 tests) ✓ |
| `e2e/case-workspace.spec.ts` full suite | `npx playwright test e2e/case-workspace.spec.ts --workers=1` | **19/20 passed** — 1 pre-existing documented flake (`Showing N of M`), unrelated to 09-19's file scope, reproduced-as-already-failing per `deferred-items.md` lines 55-62 ✓ |
| `tsc --noEmit` | `npx tsc --noEmit` | exit 0, clean tree-wide ✓ |

All live re-drives independently reproduce the exact evidence the task prompt described — not merely re-reading claims.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `exhibits.ts` | 163 | comment: `"...rather than the old [] placeholder"` | ℹ️ Info | Historical comment describing a *prior* defect now fixed — not live stub code |
| `exhibits.ts` | 363 | comment: `"...never a redacted placeholder row"` | ℹ️ Info | Comment describing the correct negative-case behavior (sealed exhibits are absent, never a placeholder) — not a stub |

No TODO/FIXME/HACK/"coming soon"/empty-handler patterns found in any of the 6 gap-closure source/scss files. Both `return null`-style conditional guards elsewhere in the shell (ActiveRoleBanner) were already assessed as legitimate in the prior verification round and are untouched by this wave.

### Requirements / Ground-Rule Coverage (gap-closure specific)

- No new npm dependency introduced by 09-18/09-19/09-20: ✓ (role gate is a Prisma query + existing error class; CSS-only fixes; Carbon's own `hideLabel` prop).
- No second styling system: ✓ (SCSS modules + Carbon tokens only, consistent with the rest of the phase).
- No data-model/API/role-permission change beyond what the gaps explicitly called for: ✓ — 09-18 adds exactly the one FRD F20 row-1 gate the security finding demanded (no new centralized `assertRole`, no other write path touched, per locked 09-CONTEXT decision #1, independently confirmed in 09-REVIEW.md's cross-file seam check). 09-19/09-20 are pure CSS/markup-attribute fixes with zero data-flow change.
- Scope discipline: each of the 3 plans closes exactly one (or two tightly related) named gap(s) — no scope creep into untouched tickets.

### Regression Check (prior 17 plans, quick pass)

Per the orchestrator's framing, the 17 original plans (09-01..09-17) were already fully verified 7/7 in the prior round. This round's own live re-drives (`app-shell.spec.ts` 14/14, `case-workspace.spec.ts` 19/20 with the 1 failure being a *pre-existing, already-documented* flake unrelated to any of the 3 gap-closure plans' file scope, `exhibits.test.ts` 33/33, `tsc --noEmit` clean, `npm run build` exit 0 per gate) confirm **zero regressions** were introduced into the previously-verified surface. The 09-REVIEW.md's own cross-file seam check independently corroborates this (all 5 seams checked, all OK).

### Gaps Summary

None remaining. All 4 originally-identified gaps (1 CONFIRMED HIGH security finding + 3 UAT issues) are closed:

1. **F-09-01** — closed by a real server-side role gate in `createExhibit`, independently live-tested with all three required scenarios (reject non-authorized, reject missing actor, accept authorized) producing the exact expected status codes and payloads.
2. **UAT-6** — closed by a verified CSS specificity fix, independently confirmed via a passing live Playwright zero-overlap regression test.
3. **UAT-9** — closed by a verified padding fix matching the shared sidebar rail-width constant, independently confirmed via a passing live Playwright hit-test regression test.
4. **UAT-16** — closed by `hideLabel` + absolute positioning at the page title's left-edge offset, independently confirmed via a passing live Playwright label-removal + pixel-alignment regression test.

Gate evidence (build/test/boot/review all green) and this verifier's own independent live re-drive are in full agreement — no discrepancy found between what the gate/SUMMARYs claimed and what the running system actually does.

---

_Verified: 2026-10-10T22:40:19Z_
_Verifier: Claude (pivota_spec-verifier)_
