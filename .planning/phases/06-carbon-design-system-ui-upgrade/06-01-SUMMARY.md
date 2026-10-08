---
phase: 06-carbon-design-system-ui-upgrade
plan: 01
subsystem: ui
tags: [carbon, carbon-design-system, sass, dart-sass, nextjs, build-pipeline, ibm-plex]

# Dependency graph
requires: []
provides:
  - "@carbon/react ^1.118.0, @carbon/styles ^1.117.0, @carbon/icons-react ^11.90.0 installed and importable"
  - "sass ^1.105.1 (Dart Sass) devDependency enabling Next's built-in .scss pipeline"
  - "src/app/globals.scss — Carbon theme (White/light, default) + preserved F11 print CSS, replacing globals.css as the root stylesheet"
  - "next.config.ts sassOptions.quietDeps for Carbon's Dart-Sass compilation"
  - "Carbon build pipeline running in parallel with the still-active Tailwind/shadcn pipeline"
affects: [06-02, 06-03, 06-04, 06-05, 06-06, 06-07, 06-08, 06-09]

# Tech tracking
tech-stack:
  added: ["@carbon/react", "@carbon/styles", "@carbon/icons-react", "sass"]
  patterns:
    - "Single all-in-one Carbon Sass entry point (@use '@carbon/react') imported once from the root layout"
    - "Carbon config overrides via @use ... with ($css--font-face: false) to drop the unresolvable ~@ibm/plex font path"
    - "Dual-pipeline transition: Carbon added in parallel; Tailwind/shadcn left functional until 06-09 cleanup"

key-files:
  created: ["src/app/globals.scss"]
  modified: ["package.json", "next.config.ts", "src/app/layout.tsx"]

key-decisions:
  - "Disabled Carbon's $css--font-face emission — its @font-face rules reference IBM Plex via the legacy webpack `~@ibm/plex/...` path, which Turbopack (Next 16's bundler) cannot resolve and @ibm/plex is uninstalled; app keeps its existing system font stack"
  - "Used the all-in-one @use '@carbon/react' form (not hand-picked per-component imports) — correct for a single internal app doing a full-surface migration in one phase"
  - "No dark-theme switch added (no theme.theme(g100) call) — Carbon's default White theme matches the current light treatment; preserves visuals without a feature addition"
  - "globals.css left on disk unimported (removed only in 06-09 after every screen migrates off Tailwind)"

patterns-established:
  - "Carbon Sass entry: @use '@carbon/react' with ($css--font-face: false) imported from layout.tsx"
  - "F11 print CSS (.no-print / .jury-print-root / @media print) carried verbatim through the stylesheet swap"

# Metrics
duration: 2min
completed: 2026-10-08
---

# Phase 6 Plan 01: Carbon Design System Build Pipeline Summary

**IBM Carbon Design System's Sass build pipeline stood up alongside the existing Tailwind/shadcn pipeline — @carbon/react/styles/icons-react + Dart Sass installed, a Carbon-themed globals.scss (with the F11 print CSS preserved verbatim) wired into the root layout, and next build/tsc both green.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-10-08T01:49:01Z
- **Completed:** 2026-10-08T01:51:29Z
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified) + package-lock.json

## Accomplishments
- `@carbon/react ^1.118.0`, `@carbon/styles ^1.117.0`, `@carbon/icons-react ^11.90.0` installed cleanly at current-latest versions with no peer-dependency conflicts (React 19 compatible, no `--legacy-peer-deps`)
- `sass ^1.105.1` (Dart Sass) added so Next's built-in `.scss` pipeline compiles Carbon's styles
- `src/app/globals.scss` created: `@use '@carbon/react'` (White/light theme) + the verbatim four-rule F11 print block (`.no-print`, `html/body`, `main`, `.jury-print-root` under `@media print`)
- Root layout now imports `./globals.scss`; `globals.css` left on disk unimported for the not-yet-migrated screens
- `next build` and `npx tsc --noEmit` both exit 0 — the Carbon Sass pipeline compiles and the still-active Tailwind pipeline is untouched

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Carbon dependencies and Next.js/Sass build config** - `a198106` (chore)
2. **Task 2: Create Carbon globals.scss entry point and wire into root layout** - `f2e1473` (feat)

**Plan metadata:** (docs commit — see final commit)

## Files Created/Modified
- `src/app/globals.scss` - NEW. `@use '@carbon/react' with ($css--font-face: false)` (Carbon theme/tokens) + verbatim F11 print CSS block
- `package.json` - Added @carbon/react, @carbon/styles, @carbon/icons-react to dependencies; sass to devDependencies; no existing dep removed
- `next.config.ts` - Added `sassOptions: { quietDeps: true }` per Carbon's official Next.js example
- `src/app/layout.tsx` - Import changed from `./globals.css` to `./globals.scss`
- `package-lock.json` - Lockfile updated (515 packages added)

## Decisions Made
- **Disabled Carbon's `$css--font-face`**: Carbon's default `@font-face` block references IBM Plex via the legacy webpack `~@ibm/plex/...` path. Turbopack (Next 16's bundler) does not resolve the `~` prefix and `@ibm/plex` is not installed, so the build failed with 90 module-not-found errors. The app does not use IBM Plex (it keeps its existing system font stack), so `with ($css--font-face: false)` both fixes the build and preserves current typography — no visual feature change.
- **All-in-one `@use '@carbon/react'`**: Per the plan — correct for a single internal app undergoing a full-surface migration, rather than hand-picked per-component Sass imports (which suit a design-system library managing a bundle-size budget).
- **No dark-theme call**: Carbon's default is the White (light) theme, matching current treatment; no `theme.theme(g100)` added.
- **`postcss.config.mjs` unchanged** and `globals.css` kept on disk (unimported) — both removed only in 06-09 after all consumers migrate off Tailwind.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Disabled Carbon `$css--font-face` to resolve Turbopack module-not-found build failure**
- **Found during:** Task 2 (`npm run build` verification)
- **Issue:** `@use '@carbon/react'` emits `@font-face` rules that load IBM Plex via the legacy webpack `~@ibm/plex/IBM-Plex-*/...woff2` path. Next 16's Turbopack bundler cannot resolve the `~` prefix and `@ibm/plex` is not an installed dependency, so `next build` failed with 90 `Module not found` errors and exit 1. Carbon's official Next.js example predates Turbopack's default and does not surface this.
- **Fix:** Changed the entry to `@use '@carbon/react' with ($css--font-face: false);` (config forwarded through `@carbon/styles/scss/config`). This suppresses only the font-face emission; all Carbon theme tokens, reset, type, and component styles still compile. The app does not use IBM Plex, so no visual regression — the existing system font stack is preserved, consistent with the plan's "preserve current visual treatment without a feature addition" intent.
- **Files modified:** src/app/globals.scss
- **Verification:** `npm run build` now exits 0; all 10 routes build; `grep "@use '@carbon/react'"` and `grep jury-print-root` both succeed.
- **Committed in:** f2e1473 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The fix was essential to satisfy the plan's own `npm run build` success criterion under Next 16's Turbopack. It is minimal (a single config flag), introduces no scope creep, and preserves the plan's intent (current visual treatment, no dark/font feature additions). Every later Phase 6 plan now builds on a working Carbon Sass pipeline.

## Known Stubs
None found — both changed source files (globals.scss, layout.tsx) and next.config.ts contain no TODO/FIXME/placeholder/stub markers.

## Issues Encountered
- The Turbopack `~@ibm/plex` resolution failure (see Deviations, Rule 3) — resolved within the deviation rules. One `npm install` EBADENGINE warning (`@carbon/themes` prefers node>=22, sandbox runs node 20) is advisory only and did not affect install or build.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Carbon build pipeline is live: `@carbon/react` components are importable and Carbon's Sass compiles via Next's built-in `.scss` support. 06-02 through 06-09 can now render Carbon components.
- Tailwind/shadcn pipeline remains fully functional for not-yet-migrated screens; `globals.css` and `postcss.config.mjs` stay on disk until 06-09 cleanup.
- No blockers.

## Self-Check: PASSED
- Created file exists: src/app/globals.scss ✓
- Modified files exist: next.config.ts, package.json, src/app/layout.tsx ✓
- Commits exist: a198106 (Task 1), f2e1473 (Task 2) ✓
- Plan-level build: `npm run build` → exit 0 ✓
- Type check: `npx tsc --noEmit` → exit 0 ✓
- Known Stubs section present, no blocking stubs ✓

---
*Phase: 06-carbon-design-system-ui-upgrade*
*Completed: 2026-10-08*
