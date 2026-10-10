---
phase: 09-ui-tickets-and-typography-standard
plan: 17
subsystem: ui
tags: [typography, carbon, scss, type-style, tabular-nums, ibm-plex, playwright]

requires:
  - phase: 09-12
    provides: "src/lib/fonts.ts self-hosted IBM Plex Sans/Mono via next/font + --font-ibm-plex-mono CSS variable on <html>"
  - phase: 09-16
    provides: "spacing/button-sizing standard (last CSS-sweep ticket before this one)"
provides:
  - "ExhibitTag chip on Carbon code-01 type token + the self-hosted mono font variable (var(--font-ibm-plex-mono))"
  - "Zero raw font-size declarations outside Carbon type-style mixins across every component .module.scss"
  - "Tabular figures (font-variant-numeric: tabular-nums) on tables/counts/timestamps"
  - "One capitalization rule (sentence case) applied to section-title outliers"
  - "End-to-end proof (Playwright) that the ExhibitTag chip actually renders using the self-hosted IBM Plex Mono font — load -> variable -> consumption"
affects: [any future typography/UI phase, jury-package, command-center, exhibit-detail, case-workspace]

tech-stack:
  added: []
  patterns:
    - "Every custom text node routes its font-size/line-height through a Carbon type-style() mixin; single-property emphasis (font-weight/color) may override on top"
    - "Numeric-content surfaces use font-variant-numeric: tabular-nums applied to specific existing rules, never a broad global selector"
    - "Section titles follow sentence case; product/screen proper nouns are exempt"

key-files:
  created: []
  modified:
    - src/components/shared/ExhibitTag.module.scss
    - src/components/shared/SeverityPill.module.scss
    - src/components/shared/TwoColorProgressBar.module.scss
    - src/components/assistant/ExampleChips.module.scss
    - src/components/assistant/CitationPill.module.scss
    - src/components/assistant/AssistantThread.module.scss
    - src/components/assistant/MessageBubble.module.scss
    - src/components/case/QuickFilterChips.module.scss
    - src/components/case/DiscrepancyBadge.module.scss
    - src/components/case/ExhibitTable.module.scss
    - src/components/StatusBadge.module.scss
    - src/components/command-center/RecentActivityPanel.module.scss
    - src/components/command-center/RecentActivityPanel.tsx
    - src/components/command-center/StatCardRow.module.scss
    - src/components/command-center/ObjectionsPanel.tsx
    - src/components/command-center/CustodyAtAGlancePanel.tsx
    - src/components/exhibit/Timeline.module.scss
    - src/components/exhibit/CustodyCard.tsx
    - src/components/jury/JuryPackageDraft.module.scss
    - src/app/activity/page.tsx
    - e2e/typography-fonts.spec.ts
    - e2e/command-center.spec.ts

key-decisions:
  - "The 28px/30.8px off-scale page title the ticket names was ALREADY corrected to a Carbon token by earlier phase plans — no raw 1.75rem/28px declaration exists anywhere in src/; all page titles use heading-03. Documented rather than inventing a change."
  - "ExhibitTag keeps its deliberate bold weight (600) on top of code-01's regular weight — the one intentional design override, so the chip still reads as a distinct bold label token."
  - "Tabular figures applied to SPECIFIC existing numeric rules (not a broad `table,[data-testid*=count]` global) per the plan's own fragility warning."
  - "'Jury Package' (Draft/Finalized/nav/feature name), 'Trial Command Center', 'Case Workspace', 'Pivota Assistant' treated as established proper nouns and left in title case; only common-noun section-heading outliers were sentence-cased."

patterns-established:
  - "Carbon type-style() mixin is the single source of font-size/line-height for every custom text node"
  - "font-variant-numeric: tabular-nums on numeric-content rules"
  - "Sentence case for section titles, proper nouns exempt"

duration: 18 min
completed: 2026-10-10
---

# Phase 9 Plan 17: UI Tickets & Typography Standard (T-16 second half) Summary

**Finished the Carbon typography standard: ExhibitTag's mono chip moved onto the `code-01` token + the self-hosted `--font-ibm-plex-mono` variable, every remaining raw font-size swept onto Carbon type-style mixins, tabular figures on numeric content, sentence-case section titles, and an end-to-end Playwright proof the font pipeline is connected (load -> variable -> consumption), not merely loaded.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-10-10T19:28:06Z
- **Completed:** 2026-10-10
- **Tasks:** 2
- **Files modified:** 22

## Accomplishments
- ExhibitTag `.tag` now uses `@include type-style('code-01')` (12px/16px, removing the glyph-clipping risk of the former `line-height:1`) and points its `font-family` at `var(--font-ibm-plex-mono)`, so the chip renders the correctly self-hosted mono font from 09-12 instead of relying on a system-installed "IBM Plex Mono".
- Swept every remaining raw `font-size` out of component `.module.scss` onto the nearest Carbon type-style token — zero raw font-size declarations remain outside a type-style mixin (verified by the plan's own grep).
- Applied `font-variant-numeric: tabular-nums` to the specific numeric-content rules (ExhibitTable table, Recent Activity time, StatCard value, Jury Package summary/clean/freshness counts, Timeline meta).
- Standardized section titles to one capitalization rule (sentence case), fixing five Title-Case outliers.
- Extended `e2e/typography-fonts.spec.ts` with an assertion that a rendered ExhibitTag chip's **computed** font-family resolves to the self-hosted IBM Plex Mono family and is a matched FontFace — proving the whole pipeline is connected end to end.

## Task Commits

1. **Task 1: Correct off-scale styles + sweep raw font declarations** - `a6b2d8e` (fix)
2. **Task 2: Tabular figures + sentence-case titles + end-to-end font proof** - `305664a` (feat)

**Plan metadata:** (docs commit for SUMMARY + STATE below)

## Files Created/Modified

**Task 1 (type-token sweep):**
- `src/components/shared/ExhibitTag.module.scss` - code-01 token + self-hosted mono var, keeps bold weight
- `src/components/shared/SeverityPill.module.scss` - label-01 (was raw 0.75rem/line-height:1)
- `src/components/shared/TwoColorProgressBar.module.scss` - label-01 caption
- `src/components/assistant/ExampleChips.module.scss` - label-01 heading
- `src/components/assistant/CitationPill.module.scss` - code-01 pill content
- `src/components/assistant/AssistantThread.module.scss` - body-compact-01 title
- `src/components/assistant/MessageBubble.module.scss` - body-compact-01 user/answer text
- `src/components/case/QuickFilterChips.module.scss` - body-compact-01 chip
- `src/components/case/DiscrepancyBadge.module.scss` - label-01 detail sentence
- `src/components/case/ExhibitTable.module.scss` - heading-compact-01 chevron glyph (Task 1); tabular-nums table (Task 2)
- `src/components/StatusBadge.module.scss` - body-compact-01 nullBadge

**Task 2 (tabular figures, capitalization, e2e):**
- `src/components/command-center/RecentActivityPanel.module.scss` - tabular-nums on `.time`
- `src/components/command-center/RecentActivityPanel.tsx` - "Recent Activity" -> "Recent activity"
- `src/components/command-center/StatCardRow.module.scss` - tabular-nums on `.value`
- `src/components/command-center/ObjectionsPanel.tsx` - "Unresolved Objections" -> "Unresolved objections"
- `src/components/command-center/CustodyAtAGlancePanel.tsx` - "Custody at a Glance" -> "Custody at a glance"
- `src/components/exhibit/Timeline.module.scss` - tabular-nums on `.meta`
- `src/components/exhibit/CustodyCard.tsx` - "Chain of Custody" -> "Chain of custody"
- `src/components/jury/JuryPackageDraft.module.scss` - tabular-nums on `.summary`/`.clean`/`.freshness`
- `src/app/activity/page.tsx` - "Activity History" -> "Activity history"
- `e2e/typography-fonts.spec.ts` - new end-to-end ExhibitTag computed-font assertion
- `e2e/command-center.spec.ts` - heading-name assertion updated to "Activity history"

## Decisions Made
- **The 28px/30.8px off-scale page title named by the ticket was already corrected by earlier phase plans.** Read every candidate (`command-center/page.module.scss`, `case/page.module.scss`, `ExhibitHeader.module.scss`, all `src/app/*/page.module.scss`) — all page titles already use `heading-03`; a repo-wide grep for `1.75rem`/`28px`/`30.8` found zero matches. Documented rather than fabricating a regression to "fix".
- **ExhibitTag keeps `font-weight: 600`** on top of code-01's regular weight — the bold chip is a deliberate design choice stated in the component's own doc comment ("a small, bold, monospace-ish token"). A single-property weight override on top of a type-style mixin is a standard Carbon idiom.
- **Tabular figures applied to specific rules, not a broad global selector** — the plan explicitly flagged `table,[data-testid*=count]` as too fragile; followed its guidance to annotate each existing numeric rule instead.
- **Proper-noun screen/feature names left in title case** (`Jury Package`, `Trial Command Center`, `Case Workspace`, `Pivota Assistant`); only common-noun section headings were sentence-cased.

## Deviations from Plan

None - plan executed exactly as written.

The plan's Task 1 anticipated the 28px/30.8px offender might be a specific page title and instructed reading each file before assuming; reading confirmed it had already been corrected upstream, which is the plan's own documented contingency ("sizes/line-heights mostly already match Carbon's scale... this ticket is a targeted correction of the two genuine outliers plus a mechanical sweep"). That is not a deviation — it is the plan's stated expectation.

The sweep surfaced raw declarations in more files than the frontmatter's `files_modified` list (as the plan's Task 1 explicitly anticipated: "if the sweep surfaces more raw declarations than the files explicitly listed... fix them in place and add those files to files_modified in the SUMMARY"). The additional files are: SeverityPill, TwoColorProgressBar, ExampleChips, CitationPill, AssistantThread, MessageBubble, QuickFilterChips, DiscrepancyBadge, StatusBadge, ExhibitTable, StatCardRow, Timeline, CustodyAtAGlancePanel, ObjectionsPanel, CustodyCard, activity/page.tsx — all recorded in `key-files.modified` above.

**Total deviations:** 0.
**Impact on plan:** None — plan executed as specified, with the sweep correctly extended to every file carrying a raw font-size per the plan's own instruction.

## Known Stubs

None found. Scanned every changed file for TODO/FIXME/placeholder/not-implemented/hardcoded-data markers — none present. All changes are presentational CSS/text/test additions with no data-flow or stubbed logic.

## Issues Encountered
None.

## Authentication Gates
None - no external service authentication required.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 9's typography standard (T-16) is now complete end to end: infrastructure (09-12) + this correction/sweep plan (09-17).
- This is the last plan of Phase 9 (plan 76 of 76). Phase complete — ready for phase verification/transition.
- No blockers.

## Self-Check: PASSED

- SUMMARY.md exists on disk.
- Both task commits present: `a6b2d8e` (Task 1), `305664a` (Task 2).
- Key edits verified on disk: ExhibitTag `type-style('code-01')`, StatCardRow `tabular-nums`.
- Plan-level build ran and passed: `npm run build` EXIT 0 (after last task).
- Playwright: `typography-fonts.spec.ts` 5/5 (incl. new end-to-end ExhibitTag font test), `command-center.spec.ts` 41/41.
- Zero raw font-size declarations outside Carbon type-style mixins (grep returns 0).
- Known Stubs: none (no blocking stubs).

---
*Phase: 09-ui-tickets-and-typography-standard*
*Completed: 2026-10-10*
