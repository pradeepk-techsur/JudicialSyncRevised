---
phase: 9
status: clean
blockers: 0
warnings: 0
files_reviewed: 2
files_reviewed_list:
  - src/components/case/ExhibitTable.module.scss
  - e2e/case-workspace.spec.ts
reviewed_at: 2026-10-10T23:55:00Z
iteration: 1
---

# Phase 9 Code Review (09-21 gap-closure diff)

## Scope

This review covers only plan 09-21's diff (commits 778901f, 6cdc489, c607b8c), executed in this session against a codebase where plans 01-20 were already reviewed. Two source files touched:
- `src/components/case/ExhibitTable.module.scss` (CSS selector fix)
- `e2e/case-workspace.spec.ts` (regression test extension)

## BLOCKERs

None.

## WARNINGs

None.

## Verification performed

- **Root-cause claim verified against Carbon's actual source**: Read `node_modules/@carbon/react/es/components/DataTable/Table.js` line 42 — `cx(\`${prefix}--data-table\`, className, {...})` confirms Carbon's `<Table>` places the caller's `className` (here, the local `.table` module class) and `.cds--data-table` on the exact same `<table>` DOM node via `classnames`. This independently confirms the commit's stated root cause: a descendant-combinator selector (`.table :global(.cds--data-table)`) can never match two classes that coexist on one element, while the new compound selector (`.table:global(.cds--data-table)`, no space) does.
- **Compiled CSS inspected**: Built the app (`npm run build`, EXIT 0) and located the compiled rule in `.next/static/chunks/00vnjuyhrxhaj.css`: `:is(._1e50fq_table.cds--data-table th:last-of-type._1e50fq_colChevron, ._1e50fq_table.cds--data-table td:last-of-type._1e50fq_chevronCell){inline-size:2rem;width:2rem}` — confirms Sass compiled the compound selector exactly as intended (table class + global class on one element, no combinator), and this selector's specificity (3 classes + pseudo-class) correctly outranks Carbon's own `.cds--data-table th:last-of-type` (1 class + pseudo-class) from `node_modules/@carbon/styles/scss/components/data-table/_data-table.scss:245`.
- **Single table on the page confirmed**: `ExhibitTable.tsx` renders the only `<table>` on `/case`; `.colChevron`/`.chevronCell` are each used exactly once (header + cell). No risk of the compound selector cross-matching an unintended nested table.
- **Live Playwright run against the running Docker app** (already rebuilt with this fix per 09-21-SUMMARY.md): `npx playwright test e2e/case-workspace.spec.ts -g "UAT-6"` → 1/1 pass. Full file run → 19/20 pass; the one failure (`"Showing N of M" with N <= M`, line 412, `visible`/`total` both measured as 11) is a pre-existing, unrelated seed-data/witness-filter flake outside this plan's two files — reproduced independently in this review (not merely trusted from the SUMMARY), matching the exact failure mode the SUMMARY discloses as out-of-scope.
- **`tsc --noEmit`**: EXIT 0 (no output).
- **`npm run build`**: EXIT 0, all 11 app routes compiled successfully.
- **No cross-file class leakage**: `styles.table`, `styles.colChevron`, `styles.chevronCell` from `ExhibitTable.module.scss` are consumed only by `ExhibitTable.tsx`. Other components (`AttentionFeedPanel.tsx`, `JuryPackageFinalized.tsx`) reference a same-named `styles.table` from their own distinct CSS Modules files — scoped independently by CSS Modules hashing, no collision.
- **Test assertion correctness**: `page.locator('table thead th').last()` correctly resolves to the chevron header (8th/last `<th>`, confirmed against `ExhibitTable.tsx`'s column order) since there is only one `<table>` on the page.

## Cross-file seams checked

- `ExhibitTable.tsx` ↔ `ExhibitTable.module.scss` (`.colChevron`/`.chevronCell` class usage) — OK, single consumer, verified live-compiled selector matches.
- `ExhibitTable.module.scss`'s `:global(.cds--data-table)` ↔ Carbon's actual `<Table>` DOM output (`node_modules/@carbon/react`) — OK, verified both the classnames composition and the vendored competing rule's specificity.
- `e2e/case-workspace.spec.ts` UAT-6 test ↔ rendered `/case` page structure (`table thead th`, `td` ordering) — OK, column order and table cardinality confirmed to match test assumptions.
- No new exports, no new API routes, no new types in this diff — no further seams to trace.
