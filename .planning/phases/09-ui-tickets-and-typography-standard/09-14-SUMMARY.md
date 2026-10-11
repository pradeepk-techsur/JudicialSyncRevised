---
phase: 09-ui-tickets-and-typography-standard
plan: 14
subsystem: ui
tags: [accessibility, wcag, contrast, carbon, typography, playwright, scss]

# Dependency graph
requires:
  - phase: 09-02
    provides: "local dependency-free WCAG relative-luminance + contrast-ratio pure function (SeverityPill.test.ts), reused here"
  - phase: 09-07
    provides: "SearchFilterBar visible labels (audited Case Workspace page)"
  - phase: 09-01..09-13
    provides: "the final rendered state of all 4 main screens this phase touched — audited last by design"
provides:
  - "e2e/accessibility-audit.spec.ts: locally-computed WCAG contrast sweep asserting >=4.5:1 on every visible text node across the 4 main pages (zero new dependency)"
  - "src/lib/contrastRatio.ts: shared first-party WCAG luminance/contrast helpers (parses hex OR rgb()/rgba())"
  - "token-pure / AA-compliant text colors across Command Center, Case Workspace, Exhibit Detail, Jury Package"
affects: [future UI tickets, any phase adding text to the 4 main screens]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Rendered-DOM contrast audit: getComputedStyle fg color + alpha-composited ancestor background, asserted Node-side via the shared contrastRatio()"
    - "Success-as-TEXT uses green-60 (#198038, AA); success-as-DOT/glyph may stay green-50 (non-text, WCAG-exempt)"

key-files:
  created:
    - src/lib/contrastRatio.ts
    - e2e/accessibility-audit.spec.ts
  modified:
    - src/components/StatusBadge.module.scss
    - src/components/command-center/LiveIndicator.module.scss
    - src/components/command-center/ObjectionsPanel.module.scss
    - src/components/exhibit/CustodyCard.module.scss

key-decisions:
  - "Zero new dependency: lifted 09-02's inline WCAG formula into a shared src/lib/contrastRatio.ts instead of adding @axe-core/playwright (phase constraint: no npm dep beyond next/font)"
  - "Enforce the stricter 4.5:1 on EVERY text node regardless of size (superset-safe over WCAG's 3:1 large-text allowance), matching the ticket's verbatim threshold"
  - "Success green as TEXT -> green-60 for AA; keep green-50 on the decorative LiveIndicator dot (non-text indicator, exempt)"
  - "Audit composites translucent ancestor backgrounds (source-over) so white sidebar text on navy is scored on navy, not on the 0.08 overlay; disabled controls skipped (WCAG 1.4.3 exempt)"

patterns-established:
  - "Rendered-DOM AA contrast sweep as a dependency-free Playwright spec"
  - "One contrast formula in the codebase (src/lib/contrastRatio.ts), shared by unit guard and e2e audit"

# Metrics
duration: ~25 min
completed: 2026-10-10
---

# Phase 9 Plan 14: Contrast & Text-Size Standard (T-12) Summary

**A dependency-free, rendered-DOM WCAG contrast sweep proving >=4.5:1 AA on every visible text node across all 4 main pages, plus the three real `$support-success`-as-text failures it surfaced fixed to green-60.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-10-10T19:10:16Z
- **Tasks:** 2
- **Files created:** 2
- **Files modified:** 4

## Accomplishments
- New `e2e/accessibility-audit.spec.ts` — a locally-computed WCAG contrast sweep over Command Center, Case Workspace, Exhibit Detail and Jury Package, reading each text node's rendered foreground color and its alpha-composited effective background and asserting AA (>=4.5:1). All 4 pages pass (6.9s, workers=1).
- Zero new npm dependency: the ~15-line WCAG relative-luminance + contrast-ratio arithmetic 09-02 first wrote inline for SeverityPill was lifted into a shared, first-party `src/lib/contrastRatio.ts` (accepts hex OR `rgb()/rgba()`), imported by the new spec. Confirmed no `axe` in package.json.
- Audited the FINAL rendered state (why T-12 runs last): every timestamp/helper/sub-label across the 4 screens already used Carbon's `$text-secondary`/`$text-helper` via `@include type-style(...)` (migrated by prior Phase 8/9 plans). The only remaining free-flowing text node on a raw palette value was `StatusBadge.nullBadge` ("not yet entered"), routed to `$text-secondary` (identical pixels, 7.2:1).
- [Rule 1] The sweep caught three genuine AA failures using `$support-success` (green-50 #24a148) as readable TEXT — fixed to green-60 (#198038).

## Task Commits

1. **Task 1: Audit + token-swap** — `4d5aeda` (fix)
2. **Task 2: Contrast sweep + shared lib + Rule-1 fixes** — `32d0668` (test)

**Plan metadata:** (this commit) (docs)

## Files Created/Modified
- `src/lib/contrastRatio.ts` — shared dependency-free WCAG luminance/contrast helpers (hex + rgb/rgba parsing)
- `e2e/accessibility-audit.spec.ts` — the 4-page AA contrast sweep
- `src/components/StatusBadge.module.scss` — `.nullBadge` muted sub-label → `$text-secondary` token
- `src/components/command-center/LiveIndicator.module.scss` — `.liveLabel` text → green-60 (dot stays green-50)
- `src/components/command-center/ObjectionsPanel.module.scss` — empty-state `.check` ✓ glyph → green-60
- `src/components/exhibit/CustodyCard.module.scss` — `.noGaps` "✓ No gaps in the chain" → green-60

## Decisions Made
- Lifted 09-02's formula into a shared module rather than duplicating it a third time or adding an audit package (phase's no-new-dependency constraint).
- Enforce 4.5:1 on all text sizes (stricter than WCAG's 3:1 large-text allowance) — matches the ticket's verbatim threshold and is superset-safe.
- Success-as-text → green-60 for AA; decorative success dot/glyph may remain green-50 (non-text, WCAG-exempt), though the aria-hidden ✓ glyph was darkened too at no cost.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Three `$support-success`-as-text WCAG AA contrast failures**
- **Found during:** Task 2 (running the new contrast sweep)
- **Issue:** `$support-success` (green-50 #24a148) used as readable TEXT fell below AA — LiveIndicator "Live" 3.35:1 on white, CustodyCard "✓ No gaps in the chain" 3.05:1 on gray-10, ObjectionsPanel empty-state ✓ 3.05:1 on gray-10.
- **Fix:** Darkened each text/glyph color to `colors.$green-60` (#198038 — 5.02:1 on white, 4.56:1 on the gray-10 card surface), leaving the decorative pulsing LiveIndicator dot at green-50 (a non-text indicator, exempt).
- **Files modified:** LiveIndicator.module.scss, CustodyCard.module.scss, ObjectionsPanel.module.scss
- **Verification:** All 4 pages pass the sweep; tsc 0, build exit 0.
- **Committed in:** 32d0668

**2. [Rule 1 - Bug] Audit measurement correctness (translucent bg + disabled controls)**
- **Found during:** Task 2 (first sweep run produced two false-positive patterns)
- **Issue:** (a) A translucent ancestor background (sidebar active item's `rgba(255,255,255,0.08)` over dark navy) was treated as opaque, mis-scoring white nav text as white-on-near-white (1:1). (b) Carbon's disabled Send button (grey, inactive while the assistant input is empty) was scored, though WCAG 1.4.3 exempts disabled components.
- **Fix:** The background resolver now alpha-composites every ancestor layer over opaque white (source-over); the collector skips `disabled`/`aria-disabled` elements (and their descendants).
- **Files modified:** e2e/accessibility-audit.spec.ts
- **Verification:** Sweep passes on all 4 pages with the real (non-false-positive) contrasts.
- **Committed in:** 32d0668

---

**Total deviations:** 2 auto-fixed (both Rule 1). The first is a genuine courtroom-readability correctness fix (the whole point of T-12); the second is making the audit measure true rendered contrast rather than false positives. No scope creep — no new dependency, no runtime behavior change beyond text color darkening.

## Known Stubs
None found.

## Issues Encountered
None beyond the two Rule-1 auto-fixes above (which were the audit doing its job).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 9 Wave 4 (this plan) delivers T-12. Remaining phase-9 plans: 09-15, 09-16, 09-17 (and 09-03 already summarized).
- The shared `src/lib/contrastRatio.ts` and the rendered-DOM sweep are available for any future UI work that adds text to the 4 main screens.

---
*Phase: 09-ui-tickets-and-typography-standard*
*Completed: 2026-10-10*

## Self-Check: PASSED
- Created files exist: src/lib/contrastRatio.ts, e2e/accessibility-audit.spec.ts, 09-14-SUMMARY.md
- Task commits present: 4d5aeda (Task 1), 32d0668 (Task 2)
- Plan-level build ran: `npm run build` → exit 0 (no Sass errors)
- `npx tsc --noEmit` → exit 0; SeverityPill unit test 6/6; accessibility sweep 4/4 pages pass
- No `axe` dependency in package.json (phase constraint honored)
- Known Stubs: none (no blocking stubs)
