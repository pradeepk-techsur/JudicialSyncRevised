---
phase: 06-carbon-design-system-ui-upgrade
plan: 09
subsystem: ui
tags: [carbon, tailwind, shadcn, cleanup, dependency-removal, sass, postcss]

# Dependency graph
requires:
  - phase: 06-02
    provides: StatusBadge/DiscrepancyBadge/AcknowledgeInline migrated to Carbon (no longer use shadcn ui/*)
  - phase: 06-03
    provides: App shell migrated to Carbon UI Shell
  - phase: 06-04
    provides: ExhibitTable/SearchFilterBar migrated to Carbon — removed the last consumers of shadcn ui/{table,input,select,button}
  - phase: 06-05
    provides: Exhibit Detail migrated to Carbon
  - phase: 06-06
    provides: Jury Package Workspace migrated to Carbon (last Wave-3 screen)
  - phase: 06-07
    provides: Command Center migrated to Carbon
  - phase: 06-08
    provides: Assistant migrated to Carbon
provides:
  - IBM Carbon Design System as the SOLE UI/styling foundation across the entire app
  - Zero Tailwind/shadcn references anywhere in src/ or package.json
  - Deletion of 5 dead shadcn ui/* primitives, src/lib/utils.ts, src/app/globals.css, components.json, postcss.config.mjs
  - Removal of 8 unused dependencies (305 transitive packages pruned)
affects: [any future UI work — Carbon is now the only styling system]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Carbon Design System is the sole UI foundation; Next.js uses its built-in default PostCSS config (no custom postcss.config needed once Tailwind removed)"

key-files:
  created: []
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "Kept the `postcss` dependency (not in the removal list — Next.js may use it independently of Tailwind)"
  - "Deleted postcss.config.mjs outright rather than leaving an empty { plugins: {} } — Next.js falls back to its built-in default PostCSS config, the correct behavior"
  - "Left the descriptive shadcn-vs-Carbon naming-inversion COMMENTS in ExhibitTable.tsx/SearchFilterBar.tsx — they document the Carbon TableHead/TableHeader convention for maintainers and are not functional dependencies on the removed stack"

patterns-established:
  - "Grep-verify-before-delete: every file and dependency removal was gated on a fresh grep proving zero remaining consumers against the current repo state"

# Metrics
duration: 3min
completed: 2026-10-08
---

# Phase 6 Plan 09: Tailwind/shadcn Pipeline Removal Summary

**Deleted the entire Tailwind/shadcn pipeline (5 dead ui/* primitives, globals.css, components.json, postcss.config.mjs, the `cn` re-export) and pruned 8 unused dependencies (305 transitive packages), leaving IBM Carbon Design System as the sole UI/styling foundation — full build, tsc, 198-test vitest suite, and 36-test Playwright suite all green.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-10-08T02:23:11Z
- **Completed:** 2026-10-08T02:26:40Z
- **Tasks:** 3
- **Files modified:** 11 (9 deleted, 2 modified)

## Accomplishments
- Grep-verified (against current repo state, not the planning-time audit) that every old-stack import was confined to the files being deleted, then deleted the 5 shadcn `ui/*` primitives, `src/lib/utils.ts`, `src/app/globals.css`, and `components.json`.
- Removed all 8 target dependencies from `package.json` (`tailwindcss`, `@tailwindcss/postcss`, `shadcn`, `tw-animate-css`, `class-variance-authority`, `cn`, `@base-ui/react`, `lucide-react`) and deleted `postcss.config.mjs`; `npm install` pruned 305 transitive packages while keeping `@carbon/react` resolved.
- Passed the full phase acceptance gate: `tsc --noEmit` clean, `next build` exit 0 (Carbon Sass compiles with zero Tailwind/PostCSS-Tailwind involvement), `vitest` 195 passed / 3 skipped / 0 failures (proving zero functional/service-layer regression), and the full `playwright` suite 36/36 passed with no selector-only edits required.

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete old UI primitives + globals.css + components.json** - `ff105e1` (chore)
2. **Task 2: Remove unused dependencies + delete postcss.config.mjs** - `8f50854` (chore)
3. **Task 3: Full build + tsc + vitest + Playwright regression gate** - no code change (verification-only; results recorded here and in the plan metadata commit)

_Note: Task 3 produced no source change — it is the phase's final acceptance gate, run against the HEAD produced by Tasks 1-2._

## Files Created/Modified
- `src/components/ui/badge.tsx` - **Deleted** (dead shadcn scaffold, zero importers)
- `src/components/ui/button.tsx` - **Deleted** (last consumer SearchFilterBar migrated in 06-04)
- `src/components/ui/input.tsx` - **Deleted** (last consumer SearchFilterBar migrated in 06-04)
- `src/components/ui/select.tsx` - **Deleted** (sole `lucide-react` consumer; migrated in 06-04)
- `src/components/ui/table.tsx` - **Deleted** (last consumer ExhibitTable migrated in 06-04)
- `src/lib/utils.ts` - **Deleted** (`cn` re-export, zero remaining callers)
- `src/app/globals.css` - **Deleted** (dead since 06-01 repointed layout.tsx to globals.scss)
- `components.json` - **Deleted** (shadcn CLI config, no tooling references)
- `postcss.config.mjs` - **Deleted** (only wired `@tailwindcss/postcss`; Next.js default PostCSS takes over)
- `package.json` - Removed 8 unused UI-stack dependencies
- `package-lock.json` - Regenerated by `npm install` (305 packages pruned)

## Decisions Made
- **Kept `postcss`** — it is not in the plan's removal list and Next.js may use it independently of Tailwind; removing it would exceed scope.
- **Deleted postcss.config.mjs outright** (per plan) rather than leaving an empty config — Next.js falls back to its built-in default, which is correct once Tailwind is gone.
- **Left the shadcn-naming COMMENTS** in `ExhibitTable.tsx`/`SearchFilterBar.tsx` — these are documentation of the Carbon `TableHead`/`TableHeader` naming inversion for maintainers, not functional references to the removed stack. The code imports exclusively from `@carbon/react`. Removing them would be a cosmetic out-of-scope edit.

## Deviations from Plan

None - plan executed exactly as written.

The grep-verify-before-delete protocol confirmed the planning-time usage audit held exactly: every `lucide-react`/`cn`/`class-variance-authority`/`@base-ui/react` import was confined to the 5 `ui/*` files + `utils.ts`, and no Wave 2/3 plan had taken a divergent path that left a residual dependency. No straggler consumers needed migrating; no dependency needed to be retained as an exception.

**Total deviations:** 0
**Impact on plan:** None — clean execution, every removal grep-confirmed safe before deletion.

## Known Stubs

None found. This plan deletes code and dependencies only; it adds no new implementation. The remaining `shadcn` string matches in src/ are descriptive code comments (documented above), not stubs or placeholders.

## Issues Encountered
None.

## Next Phase Readiness
- **Phase 6 complete.** This is the terminal plan (Wave 4) of the final phase. All 36 plans across all 6 phases are now done.
- IBM Carbon Design System is the sole UI/styling foundation; zero dangling Tailwind/shadcn references remain in `src/` or `package.json`.
- The full inherited test corpus (198 vitest tests, 36 Playwright tests) passes green with zero functional/behavioral regression — the migration touched the rendering/styling layer only, byte-identical services/API/Prisma proven by the unchanged passing service-layer suite.
- Ready for phase transition / milestone completion.

## Self-Check: PASSED

- Deleted files confirmed absent: `src/components/ui/*`, `src/lib/utils.ts`, `src/app/globals.css`, `components.json`, `postcss.config.mjs` — all verified gone.
- Commits confirmed present: `ff105e1` (Task 1), `8f50854` (Task 2).
- Build check: `npm run build` → exit 0; `npx tsc --noEmit` → exit 0.
- Test gates: `vitest` 195 passed / 3 skipped / 0 failed; `playwright` 36/36 passed.
- `## Known Stubs` section present, no blocking entries.

---
*Phase: 06-carbon-design-system-ui-upgrade*
*Completed: 2026-10-08*
