---
phase: 07-fix-admission-integrity-and-ui-usability-issues
plan: 07
subsystem: jury-package
tags: [jury-package, discrepancy, sealed-exhibit, ex-parte, audit, carbon, playwright]

# Dependency graph
requires:
  - phase: 07-03
    provides: "JuryPackageExhibitStatus enum + status/excludedAt/excludedBy/exclusionReason columns; sealed-filtered computeJuryCandidates; retain-legacy-sealed reconcileDraftMembership"
  - phase: 07-06
    provides: "JuryPackageDraft.tsx with F14 full acknowledgment-record rendering already landed"
provides:
  - "excludeJuryPackageExhibit service function (role-gated, finalized-immutable, transactional event + row UPDATE never delete)"
  - "POST /api/jury-package/:id/exhibits/:exhibitId/exclude route"
  - "status-aware view filtering across every jury-package read path (toView drops EXCLUDED, surfaces retained sealed-ADMITTED rows)"
  - "finalizeJuryPackage gate evaluates only status=INCLUDED rows"
  - "Jury Package Workspace CRITICAL-row rendering + role-gated Remove-from-Package action"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Exclusion as an append-only audit act: JURY_PACKAGE_EXHIBIT_EXCLUDED ledger event + row status flip in one transaction, row never deleted (T-07-14)"
    - "View membership derived from persisted JuryPackageExhibit rows (not sealed-filtered candidates) so retained legacy sealed rows surface for remediation"

key-files:
  created:
    - "src/app/api/jury-package/[id]/exhibits/[exhibitId]/exclude/route.ts"
    - "src/app/api/jury-package/[id]/exhibits/[exhibitId]/exclude/route.test.ts"
  modified:
    - "src/lib/validation/eventPayloads.ts"
    - "src/services/juryPackage.ts"
    - "src/app/api/cases/[id]/jury-package/route.ts"
    - "src/app/api/cases/[id]/jury-package/route.test.ts"
    - "src/hooks/useJuryPackage.ts"
    - "src/app/jury-package/page.tsx"
    - "src/components/jury/JuryPackageDraft.tsx"
    - "src/components/jury/JuryPackageDraft.module.scss"
    - "e2e/jury-package.spec.ts"

key-decisions:
  - "Aligned the JURY_PACKAGE_EXHIBIT_EXCLUDED payload schema to enum reason + optional note (07-03 had landed a placeholder free-text reason schema); no existing caller, so safe to tighten"
  - "reconcileDraftMembership now builds members from the ACTUAL persisted JuryPackageExhibit rows, not from the sealed-filtered candidate set, so a retained legacy sealed-ADMITTED row is surfaced as a member for toView to render CRITICAL"
  - "Remove-from-Package uses FINALIZE_ROLES (DEPUTY/CLERK/ADMIN) not ACK_ROLES — a JUDGE sees the CRITICAL blocker with no action, per the UX-Mockup absence-based gate"
  - "Carbon error tokens ($support-error/$text-error/$text-on-color) only — avoided component button-danger tokens (not exported by scss/theme; the recurring $button-primary hazard)"

patterns-established:
  - "Pattern: a sealed/ex-parte row is a CRITICAL hard-block (data-blocking=true, disableFinalize=hasOpen||hasCritical), distinct higher-severity red treatment, no Fix/Acknowledge"

# Metrics
duration: 7 min
completed: 2026-10-09
---

# Phase 7 Plan 07: Jury Package Ex Parte / Sealed Exclusion (F13 exclude-workflow + UI) Summary

**Authorized users (DEPUTY/CLERK/ADMIN) can now permanently remove a legacy/regression sealed-exhibit row from a jury package via a CRITICAL-row "Remove from Package" action; the row is retained forever as EXCLUDED (never deleted) and never again counts as included, finalizable, or assistant-visible.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-10-09T01:54:25Z
- **Completed:** 2026-10-09T02:01:33Z
- **Tasks:** 3
- **Files modified:** 11 (2 created, 9 modified)

## Accomplishments
- `excludeJuryPackageExhibit` service function: existence → finalized-immutability (409) → role gate (403) → INCLUDED-row lookup (404) → transactional `JURY_PACKAGE_EXHIBIT_EXCLUDED` ledger event + row UPDATE (status EXCLUDED, excludedAt/excludedBy/exclusionReason), never a delete.
- New `POST /api/jury-package/:id/exhibits/:exhibitId/exclude` thin route mirroring the finalize handler.
- Status-aware view filtering: `toView` drops EXCLUDED rows and carries `isSealed`/`status`; `reconcileDraftMembership` now surfaces retained sealed-ADMITTED legacy rows as members; `finalizeJuryPackage`'s gate evaluates only `status='INCLUDED'` rows.
- Jury Package Workspace: sealed rows render the CRITICAL treatment (`⛔ CRITICAL · ex parte material — must be removed`), role-gated Remove-from-Package action, and the Finalize button hard-blocks while any CRITICAL row is present.

## Task Commits

1. **Task 1: excludeJuryPackageExhibit service + status-aware view filtering** - `2e39106` (feat)
2. **Task 2: exclude API route + GET filter confirmation + integration tests** - `685451c` (feat)
3. **Task 3: Jury Package Workspace CRITICAL row + Remove action + E2E** - `1518391` (feat)

## Files Created/Modified
- `src/lib/validation/eventPayloads.ts` - Tightened JURY_PACKAGE_EXHIBIT_EXCLUDED payload to enum reason + optional note
- `src/services/juryPackage.ts` - excludeJuryPackageExhibit; toView EXCLUDED filter + isSealed/status; reconcile surfaces retained sealed rows; finalize gate INCLUDED-only
- `src/app/api/jury-package/[id]/exhibits/[exhibitId]/exclude/route.ts` - New POST exclude route
- `src/app/api/jury-package/[id]/exhibits/[exhibitId]/exclude/route.test.ts` - 6 route scenarios
- `src/app/api/cases/[id]/jury-package/route.ts` - Comment-only F13 note (no code change needed)
- `src/app/api/cases/[id]/jury-package/route.test.ts` - +1 test: GET never returns an EXCLUDED row
- `src/hooks/useJuryPackage.ts` - exclude mutation mirroring finalize
- `src/app/jury-package/page.tsx` - onExclude threaded through
- `src/components/jury/JuryPackageDraft.tsx` - CRITICAL row + Remove action + hasCritical finalize block
- `src/components/jury/JuryPackageDraft.module.scss` - Carbon error-token critical/remove styles
- `e2e/jury-package.spec.ts` - 2 new F13 Playwright tests

## Decisions Made
See key-decisions in frontmatter. Most notable: `reconcileDraftMembership` derives `members` from persisted rows so a retained legacy sealed-ADMITTED row (absent from the sealed-filtered candidate set post-07-03) is still surfaced for the CRITICAL/Remove UX.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Member derivation changed so retained sealed rows surface in the view**
- **Found during:** Task 1
- **Issue:** The plan's `toView` statusByExhibit threading assumed the legacy sealed row would be present in `members`. But post-07-03 `members` = `candidates` from the sealed-filtered `computeJuryCandidates`, which excludes sealed exhibits entirely — so a retained legacy sealed-ADMITTED row would never appear in the view and could never be rendered as CRITICAL or removed. The F13 UX would be dead.
- **Fix:** `reconcileDraftMembership` now rebuilds `members` (and the addedAt/status maps) from the ACTUAL persisted JuryPackageExhibit rows (joined to exhibit.isSealed/label), not from the candidate set. This correctly includes both non-sealed candidates and any retained sealed-ADMITTED legacy row, each carrying its real `isSealed`.
- **Files modified:** src/services/juryPackage.ts
- **Verification:** exclude route test "GET never returns the excluded row" + the CRITICAL-render Playwright test both pass
- **Committed in:** 2e39106 (Task 1 commit)

**2. [Rule 1 - Bug] Aligned the pre-existing JURY_PACKAGE_EXHIBIT_EXCLUDED payload schema to the plan's enum+note shape**
- **Found during:** Task 1
- **Issue:** 07-03 had landed a placeholder `juryPackageExhibitExcludedPayload` with `reason: z.string().min(1).max(500)` and no `note`. The plan (and the service it specifies) emits `reason` as an enum `'SEALED_EXPARTE' | 'MANUAL_REMOVAL'` plus an optional `note` — recordEvent validates against this schema, so a mismatch would reject valid exclude calls.
- **Fix:** Updated the schema to `reason: z.enum([...])` + `note: z.string().max(500).optional()`. No other caller existed (the workflow is new this plan), so tightening is safe.
- **Files modified:** src/lib/validation/eventPayloads.ts
- **Verification:** All 6 exclude route scenarios (incl. happy-path event assertion) pass
- **Committed in:** 2e39106 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both were necessary for F13 to function end-to-end; no scope creep. The member-derivation change is the load-bearing fix that makes the entire exclude UX reachable.

## Known Stubs
None found — no TODO/FIXME/placeholder/unimplemented markers in any created or modified file.

## Issues Encountered
None.

## Authentication Gates
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- F13 is now closed end-to-end: 07-03 made new sealed membership structurally impossible; this plan gives humans the tool to remediate legacy rows.
- Phase 7 wave 3 complete. All phase plans (07-01..07-07) now have summaries → phase ready for verification/transition.

## Verification Results
- `npx tsc --noEmit` — clean (exit 0)
- `npx next build` — BUILD_EXIT=0 (new exclude route registered: `/api/jury-package/[id]/exhibits/[exhibitId]/exclude`)
- `npx vitest run` (juryPackage.test + finalize route + exclude route + case jury-package route + discrepancies) — 36/36 passed
- `npx playwright test e2e/jury-package.spec.ts --workers=1` — 6/6 passed (incl. 2 new F13 tests)
- `grep JURY_PACKAGE_EXHIBIT_EXCLUDED src/lib/validation/eventPayloads.ts` — registered

---
*Phase: 07-fix-admission-integrity-and-ui-usability-issues*
*Completed: 2026-10-09*

## Self-Check: PASSED

- All created files exist on disk (exclude route + test + SUMMARY)
- All 3 task commits present (2e39106, 685451c, 1518391)
- Build check: npx next build -> exit 0
- Known Stubs section present: None found (no blocking stubs)
