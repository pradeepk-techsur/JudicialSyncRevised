---
phase: 06-carbon-design-system-ui-upgrade
plan: 05
subsystem: ui
tags: [carbon, react, tile, inline-loading, inline-notification, timeline, exhibit-detail, css-modules]

# Dependency graph
requires:
  - phase: 06-02
    provides: Carbon StatusBadge (Tag) and Carbon AcknowledgeInline (TextArea + Button) — consumed unchanged
  - phase: 06-03
    provides: Carbon UI Shell (Header/SideNav); this plan fixed a fixed-SideNav overlay bug in AppShell.module.scss
provides:
  - Carbon-styled Exhibit Detail View (ExhibitHeader as Tile, semantic Timeline with Carbon-token highlight, Carbon-token warning DiscrepancyBanner, Carbon InlineLoading/InlineNotification page states)
  - Preserved cross-plan anchor contract: aria-label="Exhibit history timeline" + id={event-${eventId}} byte-for-byte
  - App-wide shell layout fix: main content now clears the fixed SideNav rail
affects: [06-07 command-center, 06-08 assistant, 06-09 tailwind-removal]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Carbon Tile as the Exhibit Detail header container"
    - "Carbon-token CSS Modules (@use @carbon/styles/scss/{theme,spacing,type} + @carbon/colors) over semantic HTML for the no-Carbon-equivalent timeline + warning banner"
    - "Carbon InlineLoading / InlineNotification for page-level loading/error states"

key-files:
  created:
    - src/components/exhibit/ExhibitHeader.module.scss
    - src/components/exhibit/ExhibitNotFound.module.scss
    - src/components/exhibit/Timeline.module.scss
    - src/components/exhibit/DiscrepancyBanner.module.scss
    - src/app/exhibit/[id]/page.module.scss
  modified:
    - src/components/exhibit/ExhibitHeader.tsx
    - src/components/exhibit/ExhibitNotFound.tsx
    - src/components/exhibit/Timeline.tsx
    - src/components/exhibit/DiscrepancyBanner.tsx
    - src/app/exhibit/[id]/page.tsx
    - src/components/shell/AppShell.module.scss

key-decisions:
  - "Timeline + DiscrepancyBanner kept as semantic HTML with scoped Carbon-token CSS Modules (Carbon has no timeline/amber-container primitive) — an explicitly-expected 'Carbon doesn't dictate everything' case, not an under-migration"
  - "Page error state uses Carbon InlineNotification kind=error per the plan; loading uses InlineLoading — exact copy preserved. (Note: 06-07 panels use ActionableNotification; this page needs no retry action in the error branch)"
  - "[Rule 1] Fixed an app-wide shell bug: Carbon isFixedNav SideNav (position:fixed, 0 flow width) overlaid <main>, intercepting the top-left back-link click. Added padding-left:16rem to .body so main clears the rail"

patterns-established:
  - "Carbon-token warning surface via @carbon/colors yellow tokens (consistent with 06-02 DiscrepancyBadge) for the Exhibit Detail discrepancy banner"

# Metrics
duration: 9 min
completed: 2026-10-08
---

# Phase 6 Plan 05: Exhibit Detail View Carbon Migration Summary

**Exhibit Detail View migrated Tailwind→Carbon (Tile header, semantic Carbon-token timeline, yellow-token warning banner, InlineLoading/InlineNotification page states) consuming Wave 2's StatusBadge/AcknowledgeInline unchanged, with the cross-plan `aria-label`/`event-${id}` anchor contract preserved byte-for-byte and the full `exhibit-detail.spec.ts` suite green.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-10-08T02:10:30Z
- **Completed:** 2026-10-08T02:19:45Z
- **Tasks:** 3
- **Files modified:** 11 (6 created, 5 modified — plus 1 out-of-scope shell fix)

## Accomplishments
- `ExhibitHeader` now renders inside a Carbon `Tile`; heading + status/custodian/party/witness meta row restyled via a Carbon-token CSS Module. Consumes Wave 2's Carbon `StatusBadge` unchanged (aria-label contract intact).
- `Timeline` kept as a plain semantic `<ol aria-label="Exhibit history timeline">` with each `<li id={event-${eventId}}>` preserved byte-for-byte (a THREE-plan deep-link contract); Tailwind swapped for a Carbon-token CSS Module whose highlight uses `$support-warning` with the identical 500ms fade. `entry.summary` still rendered verbatim (F7 text-parity).
- `DiscrepancyBanner` kept all component logic, all three `data-testid`s, `data-rule-code`, and the "Acknowledge" text; amber surface reproduced via Carbon `@carbon/colors` yellow tokens; consumes Wave 2's Carbon `AcknowledgeInline` unchanged.
- `ExhibitNotFound` preserves `role="status"` (not `role="alert"`), exact heading/paragraph/back-link copy — anti-enumeration parity intact.
- `exhibit/[id]/page.tsx` loading→`InlineLoading`, error→`InlineNotification kind="error"` with exact copy; the `?event=` scroll/highlight `useEffect` and `Suspense` boundary left completely unchanged.

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate ExhibitHeader and ExhibitNotFound** - `2c747d3` (feat)
2. **Task 2: Migrate Timeline and DiscrepancyBanner** - `dcfcbd2` (feat)
3. **Task 3: Wire page.tsx + shell fix + full Playwright suite** - `3561037` (feat)

## Files Created/Modified
- `src/components/exhibit/ExhibitHeader.tsx` + `.module.scss` - Carbon Tile wrapper, token meta row
- `src/components/exhibit/ExhibitNotFound.tsx` + `.module.scss` - Carbon type tokens, contract copy preserved
- `src/components/exhibit/Timeline.tsx` + `.module.scss` - semantic list, warning-token highlight, anchor ids preserved
- `src/components/exhibit/DiscrepancyBanner.tsx` + `.module.scss` - Carbon yellow-token warning surface, testids preserved
- `src/app/exhibit/[id]/page.tsx` + `.module.scss` - InlineLoading/InlineNotification states, deep-link logic unchanged
- `src/components/shell/AppShell.module.scss` - [Rule 1] 16rem left offset so main clears the fixed SideNav

## Decisions Made
- Timeline and the discrepancy banner stay semantic HTML + scoped Carbon-token CSS Modules — Carbon ships no "timeline" or "amber container" primitive; this is the plan's explicitly-expected pattern, not an under-migration.
- Followed the plan's `InlineNotification kind="error"` for the page error state (no retry action needed there), distinct from 06-07's `ActionableNotification` panels.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Carbon fixed SideNav overlaid `<main>`, intercepting the back-link click**
- **Found during:** Task 3 (Playwright acceptance gate — `back link returns to /case` failed)
- **Issue:** Carbon's `SideNav` with `isFixedNav` (06-03) is `position: fixed` and takes zero flow width; `AppShell.module.scss` laid out `.body` with no left offset, so `<main>` started at `x=0` underneath the 16rem rail. Probed boxes: SideNav `{x:0,w:256,h:720}`, back-link `{x:24,y:72}` — fully inside the rail's overlay, which won the hit test and intercepted the click.
- **Fix:** Added `padding-left: 16rem` to `.body` in `src/components/shell/AppShell.module.scss` so main content clears the fixed rail.
- **Files modified:** src/components/shell/AppShell.module.scss (out-of-scope — owned by 06-03; fixed inline only because it blocked this plan's gate, per the concurrency-note allowance; logged to deferred-items.md)
- **Verification:** `exhibit-detail.spec.ts` 4/4 green; regression-checked `app-shell.spec.ts` 6/6 and `command-center.spec.ts` 7/7 still green after the change; `tsc --noEmit` + `next build` EXIT=0.
- **Committed in:** 3561037 (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — an app-wide shell layout fix uncovered by this screen's back-link test)
**Impact on plan:** The fix was necessary to pass the authoritative acceptance gate and is a strict app-wide improvement (no regression in sibling suites). No scope creep in the five plan-owned files.

## Known Stubs
None found — grep for TODO/FIXME/placeholder/not-implemented across all changed files returned nothing; no hardcoded/static-data handlers introduced.

## Issues Encountered
- The acceptance gate surfaced a pre-existing (06-03) app shell layout bug (fixed SideNav overlay) — see Deviations. Resolved inline; all suites green.

## Authentication Gates
None — no external services or credentials involved.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Exhibit Detail View fully on Carbon. The `aria-label="Exhibit history timeline"` and `id={event-${eventId}}` anchors are preserved, so 06-07 (Command Center) and 06-08 (Assistant) deep-links into this screen remain intact.
- 06-09 (Tailwind/shadcn removal) can now treat the five exhibit files + page as Tailwind-free (all utilities replaced by Carbon-token CSS Modules).

## Self-Check: PASSED
- All 5 created `.module.scss` + page module files exist on disk.
- Commits 2c747d3, dcfcbd2, 3561037 present in `git log`.
- Build gate: `npm run build` → EXIT=0; `npx tsc --noEmit` → EXIT=0.
- `## Known Stubs` present, no blocking stubs.
- Acceptance gate: `npx playwright test e2e/exhibit-detail.spec.ts` → 4/4 passed.

---
*Phase: 06-carbon-design-system-ui-upgrade*
*Completed: 2026-10-08*
