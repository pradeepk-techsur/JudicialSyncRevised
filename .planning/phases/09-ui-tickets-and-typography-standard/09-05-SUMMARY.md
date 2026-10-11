---
phase: 09-ui-tickets-and-typography-standard
plan: 05
subsystem: ui
tags: [carbon, buttons, accessibility, wcag-aa, discrepancy, acknowledge, record-ruling, f24, playwright]

# Dependency graph
requires:
  - phase: 08-ui-redesign-and-write-action-coverage
    provides: "DiscrepancyBanner alert-banner treatment + RecordRulingForm/AcknowledgeInline shared forms (08-09/08-12/08-13), ObjectionCard right-rail card (08-13)"
provides:
  - "Exhibit Detail discrepancy banner with real Carbon Button triggers (primary Record-ruling, tertiary Acknowledge) — no plain text links"
  - "Exactly ONE Record-ruling entry point page-wide (banner only); ObjectionCard is details-only"
  - "WCAG AA-compliant banner text (acknowledged-flag muted text raised to 4.52:1)"
affects: [09-verify, exhibit-detail, f24-write-action-ui-coverage]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Judicial-action triggers are real Carbon Buttons (kind=primary/tertiary, size=sm), never plain text links — an accidental-click-safe standard matching every other primary button in the app"
    - "Single entry point per write action on a screen — de-duplicate competing controls that target the same resource id"
    - "Inline WCAG AA contrast audit of token pairs at execution time; failing tokens bumped to the next same-family shade"

key-files:
  created: []
  modified:
    - src/components/exhibit/DiscrepancyBanner.tsx
    - src/components/exhibit/DiscrepancyBanner.module.scss
    - src/components/exhibit/ObjectionCard.tsx
    - e2e/exhibit-detail.spec.ts

key-decisions:
  - "'Acknowledge requires a dialog with required justification field' is satisfied by the EXISTING inline-expansion justification form (AcknowledgeInline), not a new modal — this app deliberately avoids modals for this interaction pattern (Phase 4/6 AssistantPanel decision)"
  - "Acknowledged-flag muted text bumped from $yellow-50 (3.02:1, AA-fail) to $yellow-60 (4.52:1, AA-pass), the next-darker same-family shade"
  - "OPEN PRODUCT DECISION left deliberately unresolved: whether to hide Acknowledge for HIGH items pending a ruling (see dedicated section below)"

patterns-established:
  - "One Record-ruling entry point per Exhibit Detail page (the banner's single primary button)"

# Metrics
duration: 22 min
completed: 2026-10-10
---

# Phase 9 Plan 05: Discrepancy Action Buttons (T-05) Summary

**Exhibit Detail discrepancy banner's Record-ruling / Acknowledge triggers converted from accidental-click-prone plain text links into real Carbon Buttons (primary / tertiary), the duplicate Record-ruling control removed from the ObjectionCard so exactly one entry point remains page-wide, and an acknowledged-flag AA contrast failure fixed.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-10-10T17:30:00Z
- **Completed:** 2026-10-10T17:52:42Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Both banner triggers are now real Carbon `Button`s: Record-ruling `kind="primary" size="sm"` (visually identical to every other primary action button — AttentionFeedPanel's, etc.), Acknowledge `kind="tertiary" size="sm"` (the subdued secondary action in the `ActionButtonRow` / next to the inline justification form). The former plain `<button className={styles.trigger/alertTrigger}>` text links — an accidental-click risk for a judicial-ruling action — are gone, along with the now-unused `.trigger`/`.alertTrigger` SCSS classes.
- The ObjectionCard is now **details-only**: the per-thread "Record ruling" button + its inline ruling form (the genuine second, independent entry point targeting the same objectionId) were removed entirely, along with the `Button`/`RecordRulingForm`/`RULING_ROLES`/`useRoleStore`/`useState` imports that only existed to support it. The informative "Only the judge can rule." caption is kept as context. The card now shows objecting party, grounds, and elapsed-time only.
- There is now **exactly ONE Record-ruling entry point on the entire Exhibit Detail page** — the banner's single primary button — proven by a Playwright `count() === 1` assertion.
- **WCAG AA contrast fix** (deviation Rule 1): the acknowledged-flag muted text (`.flagAcked`/`.ackRecord`) used `$yellow-50` (#b28600) on the `$yellow-10` (#fcf4d6) banner background = **3.02:1, below AA 4.5:1**. Raised to the next-darker same-family shade `$yellow-60` (#8e6a00) = **4.52:1 (AA-pass)**, still visibly muted vs `.flagOpen`'s `$yellow-70` (7.11:1). The title and alert-banner red pairs were already compliant (7.11:1 / 7.09:1).
- Banner body copy confirmed at `body-compact-01` (14px); metadata caption lines (`.ackRecord`/`.alertDetail`) remain `label-01` (12px) per the established Carbon caption convention — no sub-14px body text.
- Playwright coverage added/updated in `e2e/exhibit-detail.spec.ts` (full file 19/19 green on a warm server).

## Task Commits

1. **Task 1: Carbon-ify banner triggers; remove ObjectionCard duplicate control** - `749d04d` (feat)
2. **Task 2: AA-contrast fix + Playwright coverage** - `2f3864a` (test)

## Files Created/Modified
- `src/components/exhibit/DiscrepancyBanner.tsx` - Record-ruling trigger → Carbon `Button kind="primary"`; Acknowledge trigger → `Button kind="tertiary"`; `Button` imported from `@carbon/react`
- `src/components/exhibit/DiscrepancyBanner.module.scss` - removed `.trigger`/`.alertTrigger`; `.flagAcked`/`.ackRecord` colour raised `$yellow-50` → `$yellow-60` for AA
- `src/components/exhibit/ObjectionCard.tsx` - duplicate Record-ruling button + inline form removed → details-only card; dead imports dropped
- `e2e/exhibit-detail.spec.ts` - new `T-05: discrepancy action buttons (F24)` describe block (single-entry-point count + Carbon-button-class + Acknowledge justification-gate + audit-record assertions); ObjectionCard test rewritten to assert details-only; obsolete card-ruling-resolves-thread test removed

## Decisions Made
- **Modal vs inline justification:** the ticket's "open a dialog with a required justification field" is satisfied by the EXISTING `AcknowledgeInline` inline-expansion form (Carbon `TextArea` + `Button`, with `canConfirm` trim-non-empty gate + the server's `JUSTIFICATION_REQUIRED` 422 backstop) — NOT a new modal. This app deliberately avoids modals for this interaction pattern (established in the Phase 4/6 AssistantPanel decision). No acknowledge-contract change was made.
- **AA shade choice:** `$yellow-60` (4.52:1) over `$yellow-70` (7.11:1) to preserve the visible muted distinction between acknowledged and open flags while clearing the AA floor.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Acknowledged-flag text failed WCAG AA contrast**
- **Found during:** Task 2 (contrast audit step)
- **Issue:** `.flagAcked`/`.ackRecord` rendered `$yellow-50` (#b28600) on the `$yellow-10` (#fcf4d6) banner background at only 3.02:1 — below the AA 4.5:1 floor the ticket's acceptance (and T-12/CONTEXT item 7) requires. This is a genuine accessibility defect, not a style preference.
- **Fix:** Raised both to `$yellow-60` (#8e6a00) = 4.52:1 (computed with the WCAG relative-luminance formula against the real `@carbon/colors` hex values), the next-darker same-family shade, keeping the muted appearance vs `.flagOpen`.
- **Files modified:** src/components/exhibit/DiscrepancyBanner.module.scss
- **Verification:** inline Node luminance computation (3.02→4.52), `next build` compiles the SCSS clean, e2e suite green
- **Committed in:** 2f3864a (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug/accessibility). **Impact on plan:** The plan explicitly instructed to audit contrast and "adjust any failing token to the next-darker/lighter Carbon shade" — this is that instruction executed on the one pair that failed. No scope creep.

## Open product decision (deliberately UNRESOLVED by this plan)

Per the T-05 source ticket's own framing and `09-CONTEXT.md`'s Deferred section, this plan deliberately does **not** decide the following question, surfacing it instead for a human product/design decision:

> **Whether Acknowledge should be hidden for HIGH-severity items with a ruling still pending.**

The ticket itself instructs that this be raised as a product decision in the PR, **not resolved unilaterally** in this change. Accordingly, this plan implements Acknowledge **exactly as it is available today** — visible for every OPEN flag a role is permitted to acknowledge, including the HIGH-tier `UNRESOLVED_OBJECTION_JURY_ELIGIBLE` alert-banner flag. **No hide-until-ruling logic was added.** A product/design decision is required before any such behaviour is introduced; until then, the current (always-available) behaviour stands.

## Issues Encountered
- **Shared working-tree hazard (recurring Phase 8/9):** the `phase-9` branch has many sibling plans committing concurrently to overlapping files. During execution a `git stash` to confirm pre-existing tsc errors collided with in-flight sibling edits (StatusBadge.tsx conflict); recovered by restoring only this plan's three source files from the stash and dropping it. Transient tree-wide tsc errors (sibling-owned StatusBadge.tsx / Sidebar.tsx overloads) self-resolved once siblings' `juryPackage.ts`/`errors.ts` edits converged — final `tsc --noEmit` is EXIT 0. Only this plan's files were ever staged/committed. Logged to `deferred-items.md`.
- **Playwright harness server race:** the full spec initially failed with `ECONNREFUSED ::1:3000` / 30s cold-compile timeouts (`localhost` resolves to IPv6 `::1` only; Playwright's managed `next dev` wasn't ready before the first API-context calls). Resolved by starting a stable background dev server first so `reuseExistingServer` reuses it — the full `e2e/exhibit-detail.spec.ts` then ran **19/19 green**. The F14 test that flaked once under cold-compile passes in isolation and on the warm re-run (the documented cold-compile-race pattern).

## Known Stubs
None found — the three source files were scanned (TODO/FIXME/placeholder/not-implemented) with zero hits; no blocking or cosmetic stubs introduced.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- T-05 complete end-to-end. This is the last of phase 09's wave-1 plan 05; other phase-09 ticket plans (01-04, 06-17) execute independently.
- Ready for `/pivota_spec-verify-work` on phase 09 once all ticket plans land.
- The open product decision above should be surfaced in the PR description for a human decision.

## Self-Check: PASSED
- `src/components/exhibit/DiscrepancyBanner.tsx` — Record-ruling + Acknowledge triggers are Carbon Buttons (verified at HEAD: 3 `kind=` matches)
- `src/components/exhibit/ObjectionCard.tsx` — zero `RecordRulingForm` references (CONTRACT_OK)
- `src/components/exhibit/DiscrepancyBanner.module.scss` — `.trigger`/`.alertTrigger` removed; `$yellow-60` AA fix applied (verified at HEAD: 3 `yellow-60` matches)
- Commits `749d04d` + `2f3864a` present in `git log`
- Build check: `npm run build` → "✓ Compiled successfully", static pages 10/10 — EXIT 0
- `npx tsc --noEmit` → 0 errors tree-wide
- `npx playwright test e2e/exhibit-detail.spec.ts --workers=1` → 19/19 passed
- `## Known Stubs` section present, no blocking entries

---
*Phase: 09-ui-tickets-and-typography-standard*
*Completed: 2026-10-10*
