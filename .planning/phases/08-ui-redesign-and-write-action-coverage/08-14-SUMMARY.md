---
phase: 08-ui-redesign-and-write-action-coverage
plan: 14
subsystem: ui
tags: [react, jury-package, carbon, playwright, write-actions, role-gate]

requires:
  - phase: 08-01
    provides: request-finalization endpoint + finalizationRequestedAt/By schema fields + inverted role gate
  - phase: 08-03
    provides: TwoColorProgressBar, Card, ActionButtonRow, ExhibitTag, SeverityPill shared primitives
  - phase: 08-09
    provides: RecordRulingForm + TransferCustodyForm shared write-action forms
  - phase: 08-05
    provides: P-6 (MEDIUM, no custodian) + P-7 (HIGH, unresolved objection) seed fixtures
provides:
  - Jury Package DRAFT redesigned into Blockers/Clean card sections with a two-color progress bar
  - Inline condition-specific remediation on each Blockers card (Record ruling / Assign custodian / Remove from package)
  - "Request finalization from Clerk" control for non-finalize roles + a requester banner for finalize-authorized viewers
  - ExhibitTag standardization extended to the Finalized view's label cells
affects: []

tech-stack:
  added: []
  patterns:
    - "Inline trigger/expand helper components (InlineRulingTrigger/InlineCustodyTrigger) mounting shared action forms, mirroring the existing Acknowledge expander"
    - "Acknowledged-but-flagged rows remain in Blockers (resolved card) to keep the F14 audit record visible; Clean = zero-flag rows only"

key-files:
  created: []
  modified:
    - src/components/jury/JuryPackageDraft.tsx
    - src/components/jury/JuryPackageDraft.module.scss
    - src/components/jury/JuryPackageFinalized.tsx
    - src/hooks/useJuryPackage.ts
    - src/app/jury-package/page.tsx
    - e2e/jury-package.spec.ts

key-decisions:
  - "Blockers section shows CRITICAL first, then OPEN-blocking, then acknowledged (resolved) rows; the heading counts only active (CRITICAL+OPEN) blockers"
  - "Clean rows omit a custodian name — the jury-row data contract carries none and the plan forbids a new query; ✓ Admitted is the reliable signal"
  - "objectionId for a HIGH blocker resolved from the already-live useUnresolvedObjections react-query cache (no new network query)"

patterns-established:
  - "Pattern: inline remediation expander — a trigger Button swaps itself for a shared 08-09 form, collapsing on onDone (no optimistic update; the form self-invalidates ['jury-package'])"

duration: 14min
completed: 2026-10-09
---

# Phase 8 Plan 14: Jury Package Workspace Redesign + Write-Action Coverage Summary

**Redesigned the Jury Package DRAFT view into Blockers/Clean card sections with a two-color progress bar, wired inline Record-ruling (HIGH) / Assign-custodian (MEDIUM) remediation into each blocker card, and added the server-enforced "Request finalization from Clerk" control + requester banner — F24's fourth and final consuming surface.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-10-09T12:32:04Z
- **Completed:** 2026-10-09T12:45:57Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- DRAFT view restructured from a flat Carbon `<Table>` into a `TwoColorProgressBar` + `Blockers`/`Clean` card sections (Screenshot 4), preserving every existing gate/audit computation (OPEN-flag gate, `criticalRows`, `disableFinalize`, `staleBlockers` 409 banner, F14 acknowledgment record).
- Each Blockers card renders a condition-correct primary/secondary pair: CRITICAL keeps the unchanged Remove-from-package + View-exhibit; HIGH (unresolved objection) offers an inline `RecordRulingForm`; MEDIUM (no custodian) offers an inline `TransferCustodyForm`; both mirror the existing Acknowledge trigger/expand pattern and collapse on `onDone`, re-reading live server truth on the next poll.
- `requestFinalization` mutation added to `useJuryPackage` (POST `/api/jury-package/:id/request-finalization`), threaded through `page.tsx`; a non-finalize role sees the restricted copy + a live "Request finalization from Clerk" button in place of a dead disabled control, while a finalize-authorized viewer sees a banner naming the requester and time above the Finalize button.
- `ExhibitTag` standardization extended to the Finalized view's label cells (the one remaining plain-label consumer on this screen).
- Full Playwright coverage: 11/11 green, 0 skipped — including the direct-API 403 proof that the server (not the UI) is the authority on who may request finalization.

## Task Commits

1. **Task 1: Blockers/Clean card restructure + progress bar** — `5dc1976` (feat)
2. **Task 2: Request-finalization control + banner + Finalized ExhibitTag + Playwright** — `be7d6d7` (feat)

## Files Created/Modified
- `src/components/jury/JuryPackageDraft.tsx` — Blockers/Clean card layout, progress bar, inline Record-ruling/Assign-custodian remediation, Request-finalization control + requester banner, inline trigger helpers
- `src/components/jury/JuryPackageDraft.module.scss` — section/card/clean-row styles for the restructured layout
- `src/components/jury/JuryPackageFinalized.tsx` — label cell now uses shared `ExhibitTag`
- `src/hooks/useJuryPackage.ts` — new `requestFinalization` mutation; `JuryPackageDto.finalizationRequestedAt` relaxed to `string | null` (serialized over the wire)
- `src/app/jury-package/page.tsx` — threads `onRequestFinalization`/`requestFinalizationPending` down to the Draft view
- `e2e/jury-package.spec.ts` — new remediation + request-finalization + 403-bypass tests; existing F13/full-flow selectors updated to the card structure

## Decisions Made
- **Acknowledged rows stay in Blockers:** a row whose flags are all ACKNOWLEDGED (no OPEN) is no longer *blocking* finalize, but its F14 audit record must stay visible — so it renders as a resolved card in Blockers (pill "Resolved · acknowledged", no remediation action), rather than collapsing into a bare Clean row. Clean = rows with zero flags. This is what kept the pre-existing F14 transparency test green after the restructure.
- **Clean-row custodian omitted:** Screenshot 4 shows "✓ Admitted · custodian {name}" on Clean rows, but `JuryPackageExhibitView` carries no custodian and `CaseDiscrepancyFlag` exposes no custodian id for a clean (unflagged) row. Resolving it would need a new query the plan explicitly forbids ("do not add a new network query for this"), so the Clean row shows "✓ Admitted" only. Documented in-code and here.
- **objectionId resolution:** the HIGH blocker's `objectionId` (needed so `RecordRulingForm` never gets an ambiguous target) is read from the already-live `useUnresolvedObjections` react-query cache keyed by exhibitId — no new network query, per the plan's constraint.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Acknowledged rows lost their F14 audit record after the restructure**
- **Found during:** Task 2 (Playwright — the pre-existing F14 transparency test)
- **Issue:** The initial restructure defined Clean = "no OPEN flags", so a row whose single flag had just been ACKNOWLEDGED moved into the Clean section, which renders no acknowledgment record — silently dropping the F14-required audit line that the flat table always showed.
- **Fix:** Introduced an explicit `acknowledgedRows` set (flagged, none open, non-sealed) that stays in the Blockers section as a resolved card showing the full record; redefined Clean as zero-flag rows only. The finalize gate still reads only OPEN flags, so behavior for the gate is unchanged.
- **Files modified:** src/components/jury/JuryPackageDraft.tsx
- **Verification:** The pre-existing F14 test (`discrepancy-ack-record` visible after acknowledge) passes again; full suite 11/11 green.
- **Committed in:** be7d6d7 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug).
**Impact on plan:** The fix is necessary for correctness — F14 transparency is a hard requirement the plan told us to preserve ("the F14 full-audit-record rendering ... unchanged"). No scope creep.

## Known Stubs
None found — grep for TODO/FIXME/placeholder/not-implemented across all changed files returned nothing; both write actions and the request-finalization flow are proven end-to-end (including the direct-API 403).

## Issues Encountered
- **Carbon control selectors in Playwright:** the Carbon `RadioButton` native input is covered by its `__appearance` span (click the label text instead of `check()`), and the `Dropdown` option list collides with the header role-switcher's `<select>` options (scope `getByRole('option')` to the form). Both resolved with scoped locators; tests deterministic.
- **Shared-DB / shared-working-tree flakiness (recurring, documented since Phase 6):** a full-suite run showed transient failures in pre-existing mock-driven tests (ATTORNEY/F14/F13) that pass in isolation and converged to 11/11 green on the next full run; sibling Phase-8 plans continuously re-seed the shared `2026-CR-0142` case and hot-edit shared files. A sibling-owned tsc error (command-center/useRecentActivity `statusCounts`, deferred to 08-10 per STATE.md) and a transient sibling sass build glitch (exhibit `page.module.scss`) were observed mid-run; both are out of this plan's `files_modified` scope and the tree converged to `tsc EXIT=0` / `build EXIT=0`.

## Next Phase Readiness
- F11 Jury Package Workspace redesign + F24 write-action coverage are complete on this screen — F24 now has a UI on all four intended consuming surfaces.
- Remaining Phase 8 plans (08-12/08-13 Exhibit Detail, 08-15 Command Center write actions) are independent; no blockers introduced here.

---
*Phase: 08-ui-redesign-and-write-action-coverage*
*Completed: 2026-10-09*

## Self-Check: PASSED
- All key-files exist on disk (verified with `[ -f ]`).
- Both task commits present in `git log` (5dc1976, be7d6d7).
- Build gate: `npm run build` → exit 0; `npx tsc --noEmit` → exit 0.
- `## Known Stubs` present with no blocking entries.
