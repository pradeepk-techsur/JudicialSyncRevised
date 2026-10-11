---
phase: 09-ui-tickets-and-typography-standard
plan: 12
subsystem: ui
tags: [next-font, ibm-plex, carbon, typography, self-hosted-fonts, playwright]

# Dependency graph
requires:
  - phase: 06-ui-carbon-migration
    provides: "Carbon as sole UI foundation with $css--font-face:false suppressing its broken ~@ibm/plex @font-face emission"
provides:
  - "IBM Plex Sans (400/600) + IBM Plex Mono self-hosted via next/font/google, zero new npm dependency"
  - "Carbon body/code type styles routed to the self-hosted fonts via CSS variables, system-font fallback preserved"
  - "e2e/typography-fonts.spec.ts proving both fonts load exactly once across all 4 main pages"
affects: [09-17]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "next/font/google self-hosting with .variable CSS custom properties applied to <html>"
    - "CSS-layer font-family override (not @carbon/react with() config) since $font-families is not forwarded"
    - "document.fonts.load()/check() + CSSOM @font-face inspection as the font-loading verification technique"

key-files:
  created:
    - src/lib/fonts.ts
    - e2e/typography-fonts.spec.ts
  modified:
    - src/app/layout.tsx
    - src/app/globals.scss

key-decisions:
  - "Applied the font-family override at the CSS layer in globals.scss, not via @carbon/react's with() map, because $font-families is only a !default inside @carbon/type and is not forwarded by @carbon/styles/@carbon/react's config surface"
  - "Kept $css--font-face: false (did NOT re-enable Carbon's @font-face) — re-enabling reintroduces the broken ~@ibm/plex Turbopack path (09-CONTEXT decision #3); next/font registers @font-face under the literal 'IBM Plex Sans'/'IBM Plex Mono' names so Carbon's existing declarations resolve to the self-hosted files"
  - "'Loaded once, not twice' is verified via CSSOM @font-face tuples keyed on (family, weight, unicode-range), NOT raw FontFaceSet counts — next/font legitimately splits a weight into per-subset faces and reuses identical subset files, which dev-mode FontFaceSet counts cannot distinguish from real duplication"

patterns-established:
  - "Font verification: force lazy @font-face resolution with document.fonts.load(), confirm with document.fonts.check(), and detect genuine duplication via CSSOM (family,weight,unicode-range) tuples"

# Metrics
duration: 15 min
completed: 2026-10-10
---

# Phase 9 Plan 12: IBM Plex Typography Infrastructure (T-16) Summary

**Self-hosted IBM Plex Sans (400/600) + IBM Plex Mono via next/font/google with zero new npm dependency, Carbon's sans/mono type styles routed to them while keeping the system-font fallback, verified loaded exactly once across all 4 main pages.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-10-10T17:29:37Z
- **Completed:** 2026-10-10T17:44:41Z
- **Tasks:** 3
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `src/lib/fonts.ts` loads IBM Plex Sans (400/600) and IBM Plex Mono (400) through `next/font/google` — Next ships this, so no new dependency; fonts are downloaded at build time and self-hosted into `.next/static/media` (11 woff2 files emitted, verified), zero runtime network fetch.
- `layout.tsx` applies both `.variable` classes to `<html>`, exposing `--font-ibm-plex-sans`/`--font-ibm-plex-mono` to every descendant including Carbon's root SCSS, and registering the `@font-face` rules under the literal family names Carbon already references.
- `globals.scss` routes Carbon's `body` (sans) and `code`/snippet/`pre` (mono) `font-family` to the next/font CSS variables, keeping Carbon's exact system-font fallback stack, while retaining `$css--font-face: false` so Carbon's broken `~@ibm/plex` emission stays suppressed.
- `e2e/typography-fonts.spec.ts` proves on all 4 main pages (Command Center, Case Workspace, Exhibit Detail with a real seeded id, Jury Package) that IBM Plex Sans 400/600 and IBM Plex Mono load and match (`document.fonts.load()`/`check()`), are self-hosted (never `~@ibm/plex` or remote), and carry no duplicate `(family, weight, unicode-range)` @font-face — the correct "loaded once, not twice" check.

## Task Commits

1. **Task 1: next/font self-hosted IBM Plex Sans + Mono** - `62007f6` (feat)
2. **Task 2: Point Carbon's font-family tokens at the self-hosted fonts** - `235c3a2` (feat)
3. **Task 3: document.fonts verification across all 4 main pages** - `919b734` (test)

## Files Created/Modified
- `src/lib/fonts.ts` - next/font/google IBM Plex Sans (400/600) + Mono (400) loaders exporting `.variable` CSS custom properties
- `src/app/layout.tsx` - applies both font `.variable` classes to `<html>`
- `src/app/globals.scss` - routes Carbon sans/mono `font-family` to the next/font CSS variables with system-font fallback
- `e2e/typography-fonts.spec.ts` - 4-page document.fonts + CSSOM @font-face verification

## Decisions Made
- **CSS-layer override, not Carbon config:** `$font-families` is a `!default` inside `@carbon/type` and is not forwarded by `@carbon/styles`/`@carbon/react`'s config surface (confirmed by reading `_config.scss`), so it cannot be set through the `@use '@carbon/react' with (...)` map. The override is applied in `globals.scss` after the `@use`, where it reliably wins — this is the plan's documented fallback path.
- **Family-name match is automatic:** next/font keeps Google's real `@font-face` CSS (family literally `'IBM Plex Sans'`/`'IBM Plex Mono'`), only rewriting `src` to self-hosted files — so Carbon's existing `font-family: 'IBM Plex Sans', ...` declarations resolve to the self-hosted faces by construction; the globals override makes the variable pipeline explicit and keeps the fallback.
- **Verification technique:** FontFaceSet is loaded lazily and Next's dev runtime inflates it with per-subset duplicate FontFace objects, so raw counts/status snapshots are unreliable. The spec instead forces resolution with `document.fonts.load()`, confirms with `document.fonts.check()`, and detects genuine duplication via CSSOM `@font-face` `(family, weight, unicode-range)` tuples (next/font's legitimate per-subset split and shared-subset file reuse are expected and excluded).

## Deviations from Plan

None - plan executed exactly as written.

The plan's Task 3 offered `document.fonts.check()` as the preferred primary assertion over a width-diff heuristic (used), and explicitly anticipated resolving the duplication guard against FontFace realities (the per-subset/tuple handling is the correct realization of the plan's "no duplicate (family, weight) pairs" intent, not a deviation from it — the plan left the exact upper-bound/mechanism to executor discretion). All work stayed within the four `files_modified` the plan declares.

## Issues Encountered
- **Font status read as "unloaded":** First spec run asserted every FontFaceSet entry was `"loaded"`; faces are loaded lazily, so this failed. Resolved by forcing resolution with `document.fonts.load()` + confirming with `document.fonts.check()` — the standard approach.
- **Apparent duplicate @font-face (6 src per weight):** next/font splits a weight into per-unicode-range subsets (6 for Sans latin+ext etc.), each a distinct file — legitimate, not duplication. Resolved by keying the "once" check on `(family, weight, unicode-range)` tuples.
- **Shared-working-tree hazard (recurring):** sibling Phase-9 plans had in-flight uncommitted code (an untracked `jury-package/preview/route.ts` importing a not-yet-exported `JuryPackagePreviewLoadError`) that briefly made full `tsc --noEmit` exit 2; logged to `deferred-items.md` as out-of-scope. It converged to a clean `tsc`/`build` (exit 0) once the sibling committed its export. This plan's own files were clean in isolation throughout.
- **Stale preview server on :3000:** a prior `next-server` (built, not live source) was serving :3000; stopped it so Playwright's `webServer` ran `next dev` from live source (DB container left healthy).

## Known Stubs
None found.

## User Setup Required
None - no external service configuration required. (next/font fetches fonts at build time only; build-time network access to Google Fonts was confirmed available in this environment.)

## Next Phase Readiness
- Font pipeline is live and verified; **09-17** (the type-token correction sweep) can now build on IBM Plex being self-hosted and loaded.
- No blockers.

---
*Phase: 09-ui-tickets-and-typography-standard*
*Completed: 2026-10-10*

## Self-Check: PASSED

- Created files exist: src/lib/fonts.ts, e2e/typography-fonts.spec.ts, 09-12-SUMMARY.md
- Commits exist: 62007f6, 235c3a2, 919b734
- Plan-level build: `npm run build` exit 0 (compiled successfully)
- e2e/typography-fonts.spec.ts: 4/4 green across two runs
- Known Stubs: none found
