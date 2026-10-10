---
phase: 9
status: clean
blockers: 0
warnings: 0
files_reviewed: 1
files_reviewed_list:
  - src/app/case/page.tsx
reviewed_at: 2026-10-10T20:12:00Z
iteration: 2
---

# Phase 9 Code Review

Re-review after the fixer applied the W1 fix (commit `53df8d1`). Per re-review scope, this iteration covers only the fixer-touched file against iteration 1's finding plus a regression sweep. `git diff --name-only 53df8d1^..HEAD` (excluding `.planning`/lockfiles) shows exactly one touched source file — `src/app/case/page.tsx` — so the scope reduces to that file and its two direct seams (`SearchFilterBar`'s `visibleCount` contract, `applyQuickFilter`/`visibleRows`). `tsc --noEmit` clean (EXIT 0).

## BLOCKERs

None.

## WARNINGs

None.

## Previous-finding verification

### W1 (iteration 1) — RESOLVED
- **Finding:** The "Showing X of Y" readout was fed `visibleCount={data?.length ?? 0}` (pre-quick-filter length), contradicting `SearchFilterBar`'s `visibleCount` contract whenever a quick filter was active — directly reachable via the Command Center `/case?filter=no-custodian` deep-link.
- **Fix applied (53df8d1):** `visibleCount={data?.length ?? 0}` → `visibleCount={visibleRows.length}` (page.tsx:135). Read the actual diff: the only functional change is the single prop value; the surrounding comment was rewritten to document the post-quick-filter semantics. `visibleRows` is computed at page.tsx:93 (`data ? applyQuickFilter(data, quickFilter, activeUserName) : []`), well before the `SearchFilterBar` render at :122, so no use-before-init. Critically, `visibleRows` is the *exact same variable* passed to `<ExhibitTable rows={visibleRows} />` at :153, so the readout count is now provably equal to the rendered row count by construction — they cannot diverge. `totalCount` was correctly left untouched. Fix is confirmed correct, not merely plausible.

## Fix-introduced regression sweep (state-by-state)
- **No search, no quick filter** — `applyQuickFilter(data,'all',…)` returns `data` unchanged, so `visibleRows.length === data.length`; `totalCount = data?.length`. Readout "N of N". Identical to pre-fix behavior. OK.
- **Quick filter active (the fixed path)** — `visibleRows.length` = narrowed count; `totalCount = data?.length` (unfiltered, since `hasSearch` is false). "3 of 14". Correct. OK.
- **Search active, no quick filter** — `visibleRows.length === data.length` (server-narrowed); `totalCount = unfilteredData?.length ?? data?.length`. Behavior unchanged from iteration 1 for this path. OK.
- **Search AND quick filter both active** — `visibleRows.length` = quick-filtered subset of the already-search-narrowed `data`; `totalCount = unfilteredData?.length`. Reads rendered-rows-over-grand-total; consistent and matches the ExhibitTable render. No regression (previously this path mis-read the search-narrowed, not quick-narrowed, count). OK.
- **`data` undefined (loading)** — `visibleRows = []` ⇒ `visibleCount = 0`, `totalCount = 0`; readout "0 of 0" transiently, superseded on resolve. No null deref (the `data ? … : []` guard at :93 holds). OK.
- **`visibleCount` type contract** — `visibleRows.length` is `number`, matching `SearchFilterBar`'s `visibleCount: number` prop; `tsc --noEmit` EXIT 0 confirms. OK.

## Cross-file seams checked
- `case/page.tsx` readout ↔ `SearchFilterBar.visibleCount` contract ("Rows currently rendered") — now satisfied; `visibleRows.length` is the rendered count. OK.
- `visibleRows` (page.tsx:93) ↔ `applyQuickFilter` (QuickFilterChips.tsx:89) ↔ `ExhibitTable rows` (page.tsx:153) — same value feeds both the count and the table; chip counts derive from the identical predicate, so count/table/readout cannot disagree. OK.
- No other phase-9 files touched by the fix; iteration-1 seam verdicts stand unchanged.
