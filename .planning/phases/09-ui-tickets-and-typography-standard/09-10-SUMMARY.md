---
phase: 09-ui-tickets-and-typography-standard
plan: 10
subsystem: ui
tags: [jury-package, readiness-preview, react-query, carbon, read-only, anti-enumeration, F25, F11]

# Dependency graph
requires:
  - phase: 08-ui-redesign-and-write-action-coverage
    provides: shared SeverityPill/ExhibitTag/Card primitives, useAttentionFeed hook pattern, AttentionFeedLoadError shape, jury-package page three-state structure
  - phase: 07-defect-remediation
    provides: F13 sealed-exclusion policy + isSealed-as-classification substitute, canViewSealed visibility predicate
provides:
  - "getJuryPackageReadinessPreview(caseId, role) — read-only, zero-write readiness computation reusing F5/F6/F13 conditions"
  - "GET /api/cases/:id/jury-package/preview — no-role-gate read route (200 for every role)"
  - "useJuryPackagePreview — 4s-polling live-sync hook"
  - "JuryPackageReadinessPreview — full-width read-only panel rendered identically for every role on all three jury-package states"
  - "Full-width Jury Package empty state"
affects: [jury-package, command-center]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Read-only, no-role-gate aggregate endpoint with sealed-exhibit omission (anti-enumeration) rather than a 403"
    - "Readiness computed fresh from projections (never from any JuryPackage membership) — zero-write guarantee"

key-files:
  created:
    - src/app/api/cases/[id]/jury-package/preview/route.ts
    - src/hooks/useJuryPackagePreview.ts
    - src/components/jury/JuryPackageReadinessPreview.tsx
    - src/components/jury/JuryPackageReadinessPreview.module.scss
  modified:
    - src/services/juryPackage.ts
    - src/lib/errors.ts
    - src/app/jury-package/page.tsx
    - src/components/jury/JuryPackageEmpty.module.scss
    - src/services/juryPackage.test.ts
    - e2e/jury-package.spec.ts

key-decisions:
  - "SEALED_EXPARTE blocker uses exhibit.isSealed (F16 classification column deferred to Phase 7.1), matching attentionFeed.ts + loadJuryEligibilityByExhibit's existing substitution"
  - "Sealed exhibits a role cannot view are omitted entirely from preview[], never shown as a masked/blocked row (anti-enumeration, T-09-14)"
  - "Readiness preview panel is deliberately inert (zero buttons/links) and renders identically for every role — no role branching"
  - "API index docs (Y1-api §Jury Package, 03-api §4.7c) already documented the new route at planning time — doc step was a confirmed no-op"

patterns-established:
  - "No-role-gate read route: parse role for visibility masking only, never a 403 path"
  - "Preview panel above Draft/Finalized sections, below Empty guidance — 'case-wide readiness' before 'this package's contents'"

# Metrics
duration: 23 min
completed: 2026-10-10
---

# Phase 9 Plan 10: Jury Package Readiness Preview (Read-Only) Summary

**A new zero-write `getJuryPackageReadinessPreview` service + no-role-gate route + 4s-polling hook + always-visible full-width read-only panel that lets every role — including a JUDGE who cannot start or finalize a package — see which admitted exhibits are ready for the jury package and which are blocked (SEALED_EXPARTE / NO_CUSTODIAN / UNRESOLVED_OBJECTION), plus a rebuilt full-width empty state.**

## Performance

- **Duration:** 23 min
- **Started:** 2026-10-10T17:18:00Z
- **Completed:** 2026-10-10T17:41:10Z
- **Tasks:** 3
- **Files modified:** 10 (4 created, 6 modified)

## Accomplishments
- New `getJuryPackageReadinessPreview(caseId, role)` computing, for every role-visible ADMITTED exhibit, `ready` + every applicable blocker — reusing the IDENTICAL custody/objection conditions `evaluateDiscrepancies` checks and the `isSealed` classification substitute, never a reimplemented rule; performs zero writes under any circumstance.
- New `GET /api/cases/:id/jury-package/preview` with no role gate (200 for every role, no 403 path by design), a `CASE_NOT_FOUND` 404 guard, and `JuryPackagePreviewLoadError` (`JURY_PACKAGE_PREVIEW_LOAD_FAILED` 500) — mirroring the attention-feed route's error-handling shape.
- New `useJuryPackagePreview` 4s live-sync hook and `JuryPackageReadinessPreview` full-width Carbon Tile — rendered identically, read-only (zero buttons/links), for every role on all three jury-package page states (empty / draft / finalized).
- Rebuilt the Jury Package empty state to span the full content width (no narrow centered card), a wide confident guidance panel naming which roles can start a package (copy already present).
- Anti-enumeration: a sealed exhibit a role cannot view is omitted entirely from `preview[]`, never surfaced as a masked/blocked row (T-09-14).

## Task Commits

1. **Task 1: service function + route** - `0df30d7` (feat)
2. **Task 2: hook + panel wired on all three states** - `44020e1` (feat)
3. **Task 3: full-width empty state + unit & e2e coverage** - `b2d08cd` (feat)

## Files Created/Modified
- `src/app/api/cases/[id]/jury-package/preview/route.ts` - New no-role-gate GET route, 404 case guard, 500 preview-load error
- `src/hooks/useJuryPackagePreview.ts` - 4s-polling live-sync hook (role+caseId key, retry:false)
- `src/components/jury/JuryPackageReadinessPreview.tsx` - Full-width read-only panel, no role branching, zero write affordances
- `src/components/jury/JuryPackageReadinessPreview.module.scss` - Full-width panel styles
- `src/services/juryPackage.ts` - Added `getJuryPackageReadinessPreview` + its result types
- `src/lib/errors.ts` - Added `JuryPackagePreviewLoadError`
- `src/app/jury-package/page.tsx` - Renders the preview panel in all three states (below Empty, above Draft/Finalized)
- `src/components/jury/JuryPackageEmpty.module.scss` - Full-width container (removed centered-narrow constraint)
- `src/services/juryPackage.test.ts` - 8 new F25 unit tests (ready, each blocker, sealed-visible-to-ADMIN, sealed-omitted-for-ATTORNEY, multiple blockers, zero-write contract, summary counts)
- `e2e/jury-package.spec.ts` - New Playwright test: JUDGE full-width empty state + live-seeded readiness preview; DEPUTY identical inert preview alongside Start button

## Decisions Made
- **SEALED_EXPARTE via `isSealed`**: F25's FRD phrases this blocker as `classification != 'TRIAL'`, but that column does not exist (F16 deferred to Phase 7.1 per 09-CONTEXT). Used `exhibit.isSealed`, the exact substitution `attentionFeed.ts`'s CRITICAL tier and `loadJuryEligibilityByExhibit` already make.
- **Omission over masking**: a sealed exhibit an unauthorized role cannot see is excluded at the query level (same `canViewSealed`-gated predicate as every other role-scoped read), never shown as a blocked placeholder — the 404-masking principle.
- **Inert, role-agnostic panel**: no action buttons/links, no `role` branching — F25's "there is no preview-with-actions variant"; the existing Draft view owns remediation.
- **Doc index no-op**: Y1-api.md §Jury Package and 03-api.md §4.7c already documented `GET /api/cases/:id/jury-package/preview` at planning time; confirmed and left as-is.

## Deviations from Plan

None - plan executed exactly as written.

The only two in-flight friction points were operational, not plan deviations: (1) the Edit tool's first write to `src/lib/errors.ts` did not persist (the recurring shared-working-tree hazard noted in STATE.md — a parallel plan's concurrent write); re-applied and verified. (2) The first e2e run failed on a 5s `jury-readiness-summary` timeout that was purely dev-server cold-compile of the new `/preview` route; reordered the assertion to wait for a row first (15s) — no code change, the endpoint returned correct data throughout (curl-verified: 5 admitted exhibits, correct blockers, `summary:{totalAdmitted:5,readyCount:2,blockedCount:3}`).

**Total deviations:** 0.
**Impact on plan:** None — plan implemented as specified.

## Known Stubs

None found. (One `grep` hit for "placeholder" is in a code comment describing behavior the code deliberately does NOT produce — "never shown as a masked/blocked placeholder row" — not a stub.)

## Issues Encountered
None requiring problem-solving beyond the two operational notes above (re-applied a lost edit; adjusted an e2e assertion order for dev cold-compile timing).

## Verification
- `npx tsc --noEmit` — EXIT 0
- `npx vitest run src/services/juryPackage.test.ts` — 22/22 passed (14 existing + 8 new F25)
- `npx playwright test e2e/jury-package.spec.ts --workers=1` — 12/12 passed (11 existing + 1 new F25)
- `npm run build` — EXIT 0 (new `/api/cases/[id]/jury-package/preview` route registered)
- Live endpoint probe (curl): returns correct `preview[]` + `summary` for JUDGE; SEALED_EXPARTE row present for JUDGE, correct blockers for P-6/P-7

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- F25 delivered end-to-end; F11's empty state is now full-width and the readiness preview is available on every jury-package state for every role.
- Phase 9 continues (sibling plans 09-02/09-03/09-08 committing in parallel on the same branch). This plan is a leaf consumer — no later plan depends on it.
- Shared-working-tree hazard remains active (parallel plans): staged only this plan's own files individually; sibling-owned uncommitted changes (DiscrepancyBanner, attentionFeed.ts, StatusBadge, etc.) left untouched.

---
*Phase: 09-ui-tickets-and-typography-standard*
*Completed: 2026-10-10*

## Self-Check: PASSED

- All 4 created files exist on disk.
- All 3 task commits (0df30d7, 44020e1, b2d08cd) present in git history.
- Plan-level build `npm run build` → EXIT 0 (new `/api/cases/[id]/jury-package/preview` route registered).
- `## Known Stubs` section present; no blocking stubs.
