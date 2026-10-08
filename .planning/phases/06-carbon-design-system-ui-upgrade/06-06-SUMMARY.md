---
phase: 06-carbon-design-system-ui-upgrade
plan: 06
subsystem: ui
tags: [carbon, react, jury-package, table, inline-notification, print-css, design-system]

# Dependency graph
requires:
  - phase: 06-02
    provides: Carbon StatusBadge / DiscrepancyBadge / AcknowledgeInline shared components (consumed unchanged)
  - phase: 06-01
    provides: Preserved .jury-print-root / .no-print global print CSS in globals.scss
provides:
  - Jury Package Workspace (F11) rendered via Carbon Table/Button/InlineNotification/Tile-style container
  - Last screen-specific Wave 3 plan complete — Wave 4 cleanup (06-09) can now delete the Tailwind pipeline
affects: [06-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Carbon static Table primitives (Table/TableHead/TableRow/TableHeader/TableBody/TableCell from @carbon/react) carry data-* row attributes (data-testid/data-exhibit-label/data-blocking) onto the real <tr>"
    - "Carbon InlineNotification used for three distinct semantics on one screen: kind=error (hard initiate failure + 409 stale-blockers), kind=success (persistent finalized banner), all with hideCloseButton for non-dismissible notices"
    - "Tailwind print: variant reimplemented as a CSS Module .printOnly + @media print rule (decouples from Tailwind ahead of 06-09 removal) while global .jury-print-root/.no-print print hooks stay on the JSX"

key-files:
  created:
    - src/components/jury/JuryPackageEmpty.module.scss
    - src/components/jury/JuryPackageDraft.module.scss
    - src/components/jury/JuryPackageFinalized.module.scss
  modified:
    - src/components/jury/JuryPackageEmpty.tsx
    - src/components/jury/JuryPackageDraft.tsx
    - src/components/jury/JuryPackageFinalized.tsx

key-decisions:
  - "Finalize gate kept as literal disabled={hasOpen || finalizePending} on a Carbon Button (native <button disabled>) — US-11.2 physically-cannot-click guarantee preserved, not aria-disabled/CSS-only"
  - "'Finalizing…' spinner composed as a small CSS-animated span inside the Carbon Button children (InlineLoading-in-Button is awkward with @carbon/react 1.118) — the Button stays natively disabled"
  - "jury-package/page.tsx left byte-identical — its three-way conditional is routing/data logic, not presentation"

patterns-established:
  - "Pattern: data-testid on Carbon InlineNotification forwards to its root div, so getByTestId('jury-finalized-banner')/toContainText(title) works with title+subtitle"

# Metrics
duration: 4min
completed: 2026-10-08
---

# Phase 6 Plan 06: Jury Package Workspace Carbon Migration Summary

**Jury Package Workspace (F11) migrated Tailwind→Carbon — static Table primitives, native-disabled Finalize Button, error/success InlineNotifications — consuming all three Wave-2 shared components unchanged, with the hard-disabled gate and print-export feature verified intact by the full 3-test Playwright suite.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-10-08T02:14:54Z
- **Completed:** 2026-10-08T02:19:05Z
- **Tasks:** 3
- **Files modified:** 6 (3 .tsx rewritten, 3 .module.scss created)

## Accomplishments
- `JuryPackageEmpty` → Carbon-token dashed-border container + Carbon `Button`; hard-error → `InlineNotification kind="error"`; `NO_ELIGIBLE_EXHIBITS` kept as plain informational copy (not a red error).
- `JuryPackageDraft` → Carbon static `Table` primitives, `Button`, and `InlineNotification kind="error"` for the 409 stale-blockers banner; the three-attribute row contract (`data-testid`/`data-exhibit-label`/`data-blocking` on the same `TableRow`) and the native-disabled Finalize gate survive byte-for-byte; `StatusBadge`/`DiscrepancyBadge`/`AcknowledgeInline` consumed unchanged.
- `JuryPackageFinalized` → Carbon `InlineNotification kind="success"` banner + Carbon `Table` + Carbon `Button`s; `jury-print-root`/`no-print` global print classes and the `window.print()` handler preserved; the former Tailwind `hidden print:block` header reimplemented as a CSS Module `.printOnly` `@media print` rule.
- Full `e2e/jury-package.spec.ts` passes 3/3 (empty state, view-only role gating, and the full initiate→hard-disabled-gate→acknowledge→re-enable→finalize→export flow).

## Task Commits

1. **Task 1: Migrate JuryPackageEmpty** — `5e1ba6d` (feat)
2. **Task 2: Migrate JuryPackageDraft** — `9b5210a` (feat)
3. **Task 3: Migrate JuryPackageFinalized + page wiring + full suite** — `c1353d6` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/components/jury/JuryPackageEmpty.tsx` — Carbon container/Button/InlineNotification empty state
- `src/components/jury/JuryPackageEmpty.module.scss` — Carbon-token dashed-border empty-state styles
- `src/components/jury/JuryPackageDraft.tsx` — Carbon Table/Button/InlineNotification draft view, native-disabled gate
- `src/components/jury/JuryPackageDraft.module.scss` — header/freshness/action-cell/finalize/spinner styles
- `src/components/jury/JuryPackageFinalized.tsx` — Carbon success banner + Table + Buttons, print classes preserved
- `src/components/jury/JuryPackageFinalized.module.scss` — `.printOnly` @media print header + table/action styles

## Decisions Made
- Finalize gate stays a literal `disabled={hasOpen || finalizePending}` on a Carbon `Button` (renders a native `<button disabled>`) — the US-11.2 guarantee, not aria-disabled or CSS-only.
- "Finalizing…" spinner is a small CSS-animated span inside the Button children (cleaner than `InlineLoading`-in-Button with the installed Carbon version); the Button itself stays natively disabled.
- `jury-package/page.tsx` left unchanged — its three-way conditional is routing/data logic.

## Deviations from Plan

None - plan executed exactly as written.

---

**Total deviations:** 0 auto-fixed.
**Impact on plan:** None. The shared working tree compiled cleanly against sibling Wave-3 commits (06-04/06-05) at both the acceptance gate and the plan-level `next build` — no out-of-scope unblocks were needed this time (contrast earlier Wave-2 plans in STATE.md).

## Known Stubs

None found — no TODO/FIXME/placeholder/not-implemented markers, no hardcoded data, no swallowed errors in the four touched files.

## Issues Encountered
None. DB (compose `db`, postgres:16) was already up and healthy with the seeded demo case; a dev server was already serving :3000 and Playwright reused it (hot-reload picked up the new components).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Wave 3 screen migrations complete (06-04/05/06). Wave 4 cleanup plan (06-09) can safely remove the now-unused Tailwind/shadcn pipeline (globals.css, postcss.config.mjs, the `@/components/ui/*` shadcn wrappers) once it confirms no screen still imports them.
- Hard-disabled Finalize gate (US-11.2) and the print-export feature (F11) both re-verified intact by the full jury-package suite.

---
*Phase: 06-carbon-design-system-ui-upgrade*
*Completed: 2026-10-08*

## Self-Check: PASSED

- All 6 created files exist on disk (3 .tsx, 3 .module.scss).
- All 3 task commits present in git (5e1ba6d, 9b5210a, c1353d6).
- Plan-level `npm run build` → exit 0 (merged HEAD with sibling Wave-3 commits).
- `npx tsc --noEmit` → 0 errors across the project.
- Full `e2e/jury-package.spec.ts` → 3/3 passed.
- `## Known Stubs` section present; no blocking stubs.
