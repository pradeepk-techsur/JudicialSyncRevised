---
phase: 03-jury-package-discrepancy-detection
plan: 02
subsystem: api
tags: [jury-package, discrepancies, next-route-handlers, prisma, vitest, sealed-visibility]

# Dependency graph
requires:
  - phase: 03-01
    provides: "evaluateDiscrepancies/getDiscrepancies/getExhibitDiscrepancies/acknowledgeDiscrepancy, DiscrepancyFlag/JuryPackage/JuryPackageExhibit models, RoleNotPermittedError + AppError.details, DiscrepancyFlagSummary, ruleLabel"
  - phase: 02-02
    provides: "canViewSealed + parseRequestingRole (sealed-visibility), getExhibit anti-enumeration 404 pattern"
provides:
  - "src/services/juryPackage.ts: computeJuryCandidates, initiateJuryPackage, getJuryPackage (read-only+reconcile), finalizeJuryPackage, JuryPackageExhibitView (additive flags[])"
  - "GET/POST /api/cases/:id/jury-package (read-only GET, 201 initiate)"
  - "POST /api/jury-package/:id/finalize (fresh OPEN-flag gate over membership, 409 names blockers)"
  - "GET /api/cases/:id/discrepancies, GET /api/exhibits/:id/discrepancies, POST /api/discrepancies/:id/acknowledge"
affects: [03-03, 03-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Jury-package membership is CASE TRUTH (full-visibility, viewer-independent); sealed filtering is applied ONLY in the returned view/export via canViewSealed"
    - "Finalize gate re-evaluates discrepancies FRESH over membership (incl. sealed) inside the finalize transaction, never the cached discrepancy_status column"
    - "Read-only GET returns null (creates nothing) when no package exists; reconcile-only on an existing DRAFT"
    - "Shared toDiscrepancyFlagDto ISO-date mapper so case/exhibit discrepancy routes never drift"

key-files:
  created:
    - src/services/juryPackage.ts
    - src/services/juryPackage.test.ts
    - src/app/api/cases/[id]/jury-package/route.ts
    - src/app/api/cases/[id]/jury-package/route.test.ts
    - src/app/api/jury-package/[id]/finalize/route.ts
    - src/app/api/jury-package/[id]/finalize/route.test.ts
    - src/app/api/cases/[id]/discrepancies/route.ts
    - src/app/api/cases/[id]/discrepancies/route.test.ts
    - src/app/api/exhibits/[id]/discrepancies/route.ts
    - src/app/api/discrepancies/[id]/acknowledge/route.ts
    - src/app/api/discrepancies/[id]/acknowledge/route.test.ts
  modified: []

key-decisions:
  - "ROADMAP criterion 5 (GET never creates a draft) SUPERSEDES CONTEXT line 23 ('returns the existing DRAFT or creates one') and Y1-api's non-nullable GET type: GET returns juryPackage:null when none exists, reconcile-only on an existing DRAFT"
  - "JuryPackageExhibitView diverges from TechArch 03-api.md with ONE additive field, flags: DiscrepancyFlagSummary[], so 03-04's finalize gate can block on OPEN only and re-enable on ACKNOWLEDGED (discrepancyStatus CLEAN|FLAGGED collapses the two)"
  - "Jury-package membership is full-visibility/viewer-independent; a sealed OPEN discrepancy still blocks finalize for a deputy who cannot see that exhibit (WARNING-3 gate honesty)"
  - "finalize is a per-package state change, not a per-exhibit ledger event — it updates JuryPackage directly (no recordEvent); the per-exhibit DISCREPANCY ledger events are written by acknowledge in 03-01"

patterns-established:
  - "Membership vs view separation: compute candidates full-visibility, filter sealed only when shaping the returned list"
  - "Fresh-gate pattern: re-run evaluateDiscrepancies(tx) per member then read OPEN flags inside the finalize transaction"

# Metrics
duration: 8 min
completed: 2026-10-07
---

# Phase 3 Plan 02: Jury-Package & Discrepancy HTTP Surface Summary

**Discrepancy-gated jury-package service + 5 thin Next route handlers: a read-only reconciling GET (never a side-effect draft), a fresh OPEN-flag finalize gate over full membership (sealed included) that names blockers in a 409, and the three F6 discrepancy routes.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-10-07T13:57:00Z
- **Completed:** 2026-10-07T14:05:22Z
- **Tasks:** 3
- **Files created:** 11

## Accomplishments
- `src/services/juryPackage.ts`: `computeJuryCandidates` (full-visibility membership over ALL admitted exhibits), `initiateJuryPackage` (one-living-DRAFT, idempotent, role-gated DEPUTY/CLERK/ADMIN), `getJuryPackage` (strictly read-only; null when none, reconcile-only on DRAFT), `finalizeJuryPackage` (fresh OPEN-flag gate over membership, 409 names blocking exhibits).
- Exported `JuryPackageExhibitView` carrying the additive `flags: DiscrepancyFlagSummary[]` per row (OPEN/ACKNOWLEDGED) so 03-04 can drive the hard-disabled finalize gate from `flags.some(f => f.status === 'OPEN')`.
- Three F6 discrepancy routes (case-wide, per-exhibit with anti-enumeration 404, acknowledge with idempotent 200) and the two jury-package routes (read-only GET/initiate POST, finalize POST surfacing `error.details.blockingExhibits`).
- 27 new integration tests; full suite 150/150, `tsc --noEmit` clean, `npm run build` succeeds.

## Task Commits

1. **Task 1: jury-package service + tests** - `9edce20` (feat)
2. **Task 2: three discrepancy routes + tests** - `12de072` (feat)
3. **Task 3: two jury-package routes + tests** - `58a0b09` (feat)

## Files Created/Modified
- `src/services/juryPackage.ts` - F5 service: candidates, initiate, read-only GET, finalize; membership full-visibility, view role-filtered
- `src/services/juryPackage.test.ts` - 9 tests incl. sealed-membership + per-flag + gate-honesty cases
- `src/app/api/cases/[id]/jury-package/route.ts` - read-only GET + initiate POST
- `src/app/api/jury-package/[id]/finalize/route.ts` - finalize POST (409 names blockers)
- `src/app/api/cases/[id]/discrepancies/route.ts` - case-wide flags + shared toDiscrepancyFlagDto mapper
- `src/app/api/exhibits/[id]/discrepancies/route.ts` - per-exhibit flags, getExhibit-gated anti-enumeration 404
- `src/app/api/discrepancies/[id]/acknowledge/route.ts` - acknowledge delegation (idempotent 200)
- 4 corresponding `*.test.ts` route suites (18 tests)

## Decisions Made
- **GET read-only supersession:** ROADMAP criterion 5 wins over CONTEXT line 23 and Y1-api's non-nullable GET type. GET returns `juryPackage: null` when none exists (asserted zero-row), reconcile-only on a DRAFT.
- **Additive `flags[]` field:** `JuryPackageExhibitView` extends TechArch 03-api.md with `flags: DiscrepancyFlagSummary[]` because `discrepancyStatus: CLEAN|FLAGGED` collapses OPEN and ACKNOWLEDGED, which the client's OPEN-only gate must distinguish.
- **Sealed-membership policy:** membership is full-visibility/viewer-independent; sealed filtering is view/export-only. A sealed OPEN discrepancy blocks finalize even for a deputy who never saw the exhibit.
- **No ledger event for finalize:** finalize is a JuryPackage state change (per-package), not a per-exhibit ExhibitEvent; updated directly. The `details` plumbing (AppError.details → errorResponse) is CONSUMED from 03-01 — errors.ts/apiError.ts untouched.
- **Test strategy:** self-contained unique-caseNumber fixtures via live write paths (established convention) instead of `runSeed()`, keeping suites independent under `fileParallelism:false` and avoiding seed contention.

## Deviations from Plan

None - plan executed exactly as written.

The plan suggested route tests could `await runSeed()` in `beforeAll`; self-contained fixtures were used instead (the established repo convention, equally valid per the plan's "self-contained fixture OR seeded case" allowance) — not a deviation, a permitted choice.

## Known Stubs

None found — grep for TODO/FIXME/placeholder/not-implemented across all 11 files returned nothing; every handler delegates to a fully-implemented service path.

## Issues Encountered
None.

## Authentication Gates
None - no external service authentication required.

## Next Phase Readiness
- The exact endpoints 03-04 (Jury Package Workspace Screen) consumes are live: read-only GET with per-row `flags[]`, initiate POST, finalize POST with named blockers in `error.details.blockingExhibits`.
- F6 discrepancy routes (case-wide, per-exhibit, acknowledge) are ready for 03-03's DiscrepancyBadge / exhibit-list integration.
- Ready for 03-03.

---
*Phase: 03-jury-package-discrepancy-detection*
*Completed: 2026-10-07*

## Self-Check: PASSED
- All 11 created files present on disk (6 impl + SUMMARY verified; 4 test files committed).
- All 3 task commits present: `9edce20`, `12de072`, `58a0b09`.
- Build check: `npm run build` → exit 0 (Compiled successfully); `npx tsc --noEmit` clean.
- Full test suite: 150/150 passing (123 prior + 27 new).
- Known Stubs: none (grep clean across all new files).
