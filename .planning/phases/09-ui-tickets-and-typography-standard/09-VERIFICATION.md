---
phase: 09-ui-tickets-and-typography-standard
verified: 2026-10-11T00:01:10Z
status: passed
score: 1/1 must-have verified (surgical gap-closure round; 7/7 original success criteria + prior 4 gap-closure items stand per prior 09-VERIFICATION.md, unaffected by this 2-file diff)
re_verification:
  previous_status: passed (prior round, 2026-10-10T22:40:19Z) — but 09-UAT.md's test 6 was subsequently RE-OPENED when the user re-reported the same defect against 09-19's own fix, which this round closes
  previous_score: 4/4 gap-closure items verified in prior round (F-09-01, UAT-6 1st pass, UAT-9, UAT-16)
  gaps_closed:
    - "UAT-6 (re-test): 09-19's chevron/description column-width fix used a dead descendant-combinator CSS selector (`.table :global(.cds--data-table) th:last-of-type.colChevron`, with a space) that could never match because Carbon's <Table> places both classes on the SAME <table> element, not nested — so Carbon's own `th:last-of-type { inline-size: auto }` kept winning, squeezing Description to the same ~152px as the chevron column and forcing visible 2-line wrapping that read as 'columns not in one row'. 09-21 converts it to a compound selector (no space), restoring the correct 2rem/272px split."
  gaps_remaining: []
  regressions: []
---

# Phase 9: UI Tickets and Typography Standard — Gap-Closure Verification Report (09-21, UAT-6 re-test)

**Phase Goal:** The 16 tickets from the external UI/UX review of the develop build are each resolved as their own small, acceptance-criteria-verifiable change — the Command Center's ranked attention list is visible without scrolling and fed by a real 4-tier severity scale; every screen reads status/severity color from one shared token source; Recent Activity and the Case Workspace table read correctly and are properly labeled; discrepancy actions (Record ruling, Acknowledge) are safe, singular, and accountable; navigation and the demo role switcher are unambiguous; the Jury Package empty state guides the user and offers a read-only readiness preview to every role; the Assistant page is context-aware and removes the stray API-key control; and IBM Plex Sans/Mono actually load (verified via `document.fonts`) with every text element on a real Carbon type token — all without introducing a second styling system, a new dependency, or any data-model/API/role-permission change the tickets didn't explicitly call for.

**Verified:** 2026-10-11T00:01:10Z
**Status:** passed
**Re-verification:** Yes — this is a `--gaps-only` verification run of plan 09-21, a single surgical gap-closure plan for 09-UAT.md's one remaining open gap (test 6). Plans 01-20 (including the prior 3 gap-closure plans 18/19/20) were already executed, reviewed, and verified in prior sessions; the prior 09-VERIFICATION.md (2026-10-10T22:40:19Z) is not re-litigated here except where this round's own evidence intersects it.

## Context: What This Round Verifies

09-19 (prior gap-closure round) attempted to fix UAT-6 (Case Workspace exhibit table columns rendering broken/not-in-one-row at 1440px) with a CSS selector intended to pin the trailing chevron column to a fixed 2rem width so Description could absorb the table's true remainder width. The user re-tested and re-reported the identical symptom ("columns should show up in one row"), reopening UAT-6 in 09-UAT.md's `## Gaps` section.

09-21 root-caused the reopened defect independently (not by trusting 09-19's narrative): 09-19's selector used a **descendant combinator** (`.table :global(.cds--data-table) th:last-of-type.colChevron`, with a space), which can only match a `.cds--data-table` element *nested inside* a `.table` element. But Carbon's `<Table>` component places both classes on the exact same `<table>` DOM node (confirmed via `classnames` composition in `@carbon/react`'s own source and via live `element.className`/`element.matches()` checks), so the selector was dead code from the moment it was written — Carbon's own competing `.cds--data-table th:last-of-type { inline-size: auto }` rule kept winning unopposed. 09-21's fix is a one-character change: removing the space to form a **compound selector** (`.table:global(.cds--data-table) th:last-of-type.colChevron`), which targets both classes on the one real element and wins the specificity fight.

This verification round independently re-confirms that fix against the actual codebase and a live running instance, and confirms the fix did not regress the phase's broader goal (per gate evidence, since this was a strictly 2-file diff).

## Gate Evidence (cited, not re-litigated)

Per `09-GATE.md` (final entries, this session) and `09-REVIEW.md` (`iteration: 1`, `reviewed_at: 2026-10-10T23:55:00Z`):

- `gate_status: passed` (frontmatter, line 3).
- `boot_smoke: pass` (frontmatter, line 10) — all 4 gates: port bound, HTTP 200/307 non-5xx, no fatal log markers, schema populated (14 relations / 11 non-empty tables), data-backed endpoints `/api/case`, `/api/cases/:id/exhibits`, `/api/cases/:id/attention-feed` all returned 200.
- `review_blockers_open: 0` (frontmatter, line 9) — 09-REVIEW.md iteration 1: `blockers: 0`, `warnings: 0`, 2 files reviewed (`ExhibitTable.module.scss`, `e2e/case-workspace.spec.ts`).
- Backend pre-push gate (final window, this session): `__GATE__ build_exit=0 test_exit=0 ... test_files=52 skip_marks=5 shadow_files=0`; `293 passed | 3 skipped (296)`.
- Wave-level build/test gates across the whole phase session: consistently `build: pass`, `test: pass`, `0/3 fix attempts` — no regression introduced at any point.

These gate verdicts are cited as authoritative for build/boot/test/review. This report adds independent re-derivation of the specific claim (the CSS fix actually works) on top — not a re-read of the gate's own claims.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | On the Case Workspace exhibit table at 1440px, the trailing chevron column is pinned to its intended 2rem (32px) width and the Description column absorbs its true remainder (>200px), so all columns render in one row with zero cell-to-cell visual overlap — closing UAT-6's re-opened "columns not in one row" defect | ✓ VERIFIED | **Source read directly** (not trusted from SUMMARY/UAT.md): `src/components/case/ExhibitTable.module.scss` lines 184-188 contain the compound selector `.table:global(.cds--data-table) th:last-of-type.colChevron, .table:global(.cds--data-table) td:last-of-type.chevronCell { inline-size: 2rem; width: 2rem; }` — confirmed **no space** between `.table` and `:global(...)`, i.e. a genuine compound selector, not the prior dead descendant-combinator form. **Independently re-run live by this verifier** (not copied from SUMMARY/REVIEW output): `npx playwright test e2e/case-workspace.spec.ts -g "UAT-6" --workers=1` against the running Docker app (`project-app-1`, up) → **1 passed** (587ms). **Independently measured live by this verifier** via a standalone Playwright script against `http://localhost:3000/case` at 1440×900 (not copied from any prior report): chevron header boundingBox width = **32px** exactly; Description header boundingBox width = **272px** — both match 09-21-SUMMARY.md's claimed values exactly, confirming this is a live-reproducible fact, not a report-only claim. `git status --short` on the two touched files shows no uncommitted drift from the reviewed/gated commits (778901f, 6cdc489), confirmed present in `git log`. |

**Score:** 1/1 truth verified (the sole truth in scope for this `--gaps-only` run).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/case/ExhibitTable.module.scss` | Compound (non-descendant) selector compounding `.table` with `:global(.cds--data-table)` to pin chevron/chevronCell to 2rem | ✓ VERIFIED | Read in full (196 lines). Lines 184-188 contain the exact compound selector with an explanatory comment (lines 159-183) documenting the root cause and live-verification evidence. No stray second styling system introduced — still pure Carbon/CSS-Modules/Sass, consistent with the rest of the file. |
| `e2e/case-workspace.spec.ts` | Extended UAT-6 test with explicit chevron (<=33px) and Description (>200px) width assertions | ✓ VERIFIED | `grep` confirms both assertions present at lines 233-234 (`expect(chevronHeaderWidth).toBeLessThanOrEqual(33)`, `expect(descCellWidth).toBeGreaterThan(200)`), inside the same test block previously used for the overlap check (09-19's test, extended rather than duplicated per the plan's stated decision). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `ExhibitTable.tsx` rendered `<table>` | `ExhibitTable.module.scss`'s `.colChevron`/`.chevronCell` compound-selector rule | CSS Modules class application + Carbon's `className` composition on the single `<table>` node | ✓ WIRED | Confirmed by live measurement (32px/272px) — the rule is not merely present in source, it is actually taking effect in the rendered DOM against the live running app. |
| `e2e/case-workspace.spec.ts` UAT-6 test | The live `/case` page's rendered table | Playwright `page.goto` + `boundingBox()` assertions | ✓ WIRED | Independently re-run by this verifier (not just cited from REVIEW.md) with the same 1/1 pass result as reported. |

### Requirements Coverage

Not applicable at the single-gap-closure granularity — REQUIREMENTS.md does not map UAT.md's individual gap entries to requirement IDs. The phase's mapped requirements (F1, F7, F8, F9, F10, F11, F15, F20, F24, F25) were covered in the prior full-phase 09-VERIFICATION.md round (7/7 success criteria) and are unaffected by this 2-file CSS/test diff — no data-model, API, or role-permission surface was touched.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None found | — | 09-21-SUMMARY.md's own self-check and this verifier's independent read of both changed files found no TODO/FIXME/placeholder/stub markers introduced by this diff. The only "placeholder" string match in the codebase is a pre-existing, unrelated disabled "Add exhibit" button from an earlier phase — not part of this diff. |

### Broader Phase Sanity Check (not a full re-verification)

Per the task's explicit scope, this is a surgical 2-file gap-closure, not a from-scratch re-verification of all 21 plans. Sanity-checked via gate evidence rather than re-deriving each of the 7 original success criteria:

- Full test suite (42 files, 293 tests passed / 3 skipped) green in the final gate window of this session — no regression signature in any unrelated test file.
- `npm run build` exit 0, all 11 app routes compiled, in the final gate window.
- `npx tsc --noEmit` re-run independently by this verifier: exit 0.
- `git status --short`: clean working tree — no stray uncommitted changes beyond what's captured in commits 778901f/6cdc489.
- Code review (09-REVIEW.md) independently traced the only 2 touched files' cross-file seams (`ExhibitTable.tsx` ↔ `.module.scss`, the SCSS ↔ Carbon's actual compiled `<Table>` output, the e2e test ↔ rendered page structure) and found 0 blockers, 0 warnings.
- No new dependency, no data-model/API/role-permission change — confirmed by the diff's own file list (1 SCSS file, 1 e2e test file) and 09-REVIEW.md's explicit note: "No new exports, no new API routes, no new types in this diff."

### Human Verification Required

None. The specific claim in scope (chevron pinned to 2rem, Description absorbing >200px remainder, one-row rendering) was independently re-derived via live browser measurement and live Playwright re-run by this verifier, not merely cited from prior reports.

### Gaps Summary

09-UAT.md's `## Gaps` section contains exactly one entry (test 6), and its `status:` field reads `closed` with `confidence: proven` and a `redrive:` field documenting live re-measurement matching the plan's predicted post-fix values exactly. This verifier independently reproduced that same live re-measurement (32px / 272px) and the same live Playwright pass (1/1), confirming the UAT.md closure claim is accurate rather than merely asserted. No other gaps are open in 09-UAT.md, 09-GATE.md, or 09-REVIEW.md for this phase. One known, explicitly out-of-scope, pre-existing flake remains in `e2e/case-workspace.spec.ts` (the "Showing N of M" witness-filter test, unrelated to UAT-6, reproduced as already-failing on the un-fixed file via `git stash` per 09-21-SUMMARY.md) — this is documented, not hidden, and does not block phase completion per the plan's own `<done>` criteria.

**Phase status: all 16 original UI/UX review tickets plus the typography standard, plus all 4 post-implementation gap-closure items (1 security finding + 3 UAT issues, including this round's UAT-6 re-test), are now closed with 0 remaining open gaps across UAT, GATE, and REVIEW evidence.**

---

_Verified: 2026-10-11T00:01:10Z_
_Verifier: Claude (pivota_spec-verifier)_
