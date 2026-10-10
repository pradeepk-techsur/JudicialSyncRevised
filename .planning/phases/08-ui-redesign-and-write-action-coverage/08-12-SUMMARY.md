---
phase: 08-ui-redesign-and-write-action-coverage
plan: 12
subsystem: ui
tags: [react, carbon, exhibit-detail, write-actions, role-gating, playwright, F10, F24]

# Dependency graph
requires:
  - phase: 08-03
    provides: shared ExhibitTag chip component
  - phase: 08-08
    provides: getExhibitHistory with objections[] + custodyCard
  - phase: 08-09
    provides: shared TransferCustodyForm + RecordRulingForm
  - phase: 08-02
    provides: recordCustodyTransfer server-side role gate (DEPUTY/CLERK/ADMIN)
provides:
  - Redesigned Exhibit Detail header (ExhibitTag chip + title + StatusBadge pill inline, subtitle, Transfer-custody + Ask-Pivota header actions)
  - DiscrepancyBanner alert-banner treatment for UNRESOLVED_OBJECTION_JURY_ELIGIBLE with inline role-gated Record-ruling action (targets the specific objectionId)
  - Playwright coverage for the header layout, role-gated controls, alert-banner presence/absence, and live P-7 ruling-resolution
affects: [08-13 (shares exhibit/[id]/page.tsx + e2e/exhibit-detail.spec.ts), F10 full-screen completion]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Header write-action delegation: the header's Transfer-custody trigger expands 08-09's shared TransferCustodyForm inline (absent-not-disabled via the form's own CUSTODY_ROLES gate), never re-implementing authorization"
    - "Alert-banner escalation for exactly one rule code (UNRESOLVED_OBJECTION_JURY_ELIGIBLE while OPEN) layered on top of the unchanged F14 acknowledge/audit treatment for every other flag"
    - "Record-ruling action resolves the SPECIFIC objectionId from history.objections[0] (never a bare exhibitId)"

key-files:
  created: []
  modified:
    - src/components/exhibit/ExhibitHeader.tsx
    - src/components/exhibit/ExhibitHeader.module.scss
    - src/components/exhibit/DiscrepancyBanner.tsx
    - src/components/exhibit/DiscrepancyBanner.module.scss
    - e2e/exhibit-detail.spec.ts

key-decisions:
  - "Ask Pivota about {label} opens the assistant panel with NO pre-scoping — assistantStore exposes no per-exhibit scoping API, so panel-open is the plan-sanctioned minimal implementation; the button label names the exhibit"
  - "DiscrepancyBanner's new `objections` prop is optional/defaulted [] so the existing F14 e2e mock (which omits it) stays compatible, and the alert banner only escalates ONE rule code while every other flag's F14 treatment is byte-for-byte preserved"
  - "Alert-banner resolves objections[0] only (T-08-21 accept) — P-7 has exactly one unresolved thread; multi-thread disambiguation is out of this phase's scope"

patterns-established:
  - "Header-level write actions expand the shared 08-09 forms inline via a trigger button, matching the existing Acknowledge-trigger pattern"

# Metrics
duration: 19 min
completed: 2026-10-09
---

# Phase 8 Plan 12: Exhibit Detail Header + Discrepancy Banner Redesign Summary

**Redesigned Exhibit Detail header (shared ExhibitTag chip + title + StatusBadge pill inline, party/witness/custodian subtitle, role-gated "Transfer custody" + "Ask Pivota about {label}" actions) and a red alert-banner treatment for the one unresolved-objection-while-admitted condition wiring 08-09's Record-ruling form to the specific objectionId — F10 header half + F24's second consuming surface.**

## Performance

- **Duration:** 19 min
- **Started:** 2026-10-09T12:30:00Z (approx)
- **Completed:** 2026-10-09T12:49:34Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- **ExhibitHeader redesign:** the shared `ExhibitTag` chip + exhibit title + `StatusBadge` pill render inline on one title row; a subtitle line names Party · Witness · Custodian; two right-aligned header actions — "Transfer custody" (absent-not-disabled per CUSTODY_ROLES, expanding 08-09's shared `TransferCustodyForm` inline) and "Ask Pivota about {label}" (opens the F7 assistant panel).
- **DiscrepancyBanner alert-banner treatment:** for `UNRESOLVED_OBJECTION_JURY_ELIGIBLE` while OPEN, the banner escalates to a red-outline / light-red alert card (Screenshot 2) with the exact title "Admitted while an objection is unresolved", a "Record ruling" trigger that expands 08-09's JUDGE-gated `RecordRulingForm` targeting the specific `objections[0].objectionId`, and the existing "Acknowledge" action. Every other rule code keeps its F14 plain flag-row + acknowledge/audit treatment byte-for-byte.
- **Playwright coverage:** 5 new tests — header chip/status/subtitle/Ask-Pivota; Transfer-custody absent-for-JUDGE / present-for-DEPUTY / expands-on-click; alert banner absent for a clean exhibit; alert banner present for the blocking condition with Record-ruling JUDGE-visible/DEPUTY-absent; and a live P-7 test where a JUDGE ruling resolves the thread and the banner disappears on the next poll.

## Task Commits

1. **Task 1: ExhibitHeader redesign** — `3d2f7da` (feat) — my own clean `feat(08-12)` commit (ExhibitHeader.tsx/.scss + DiscrepancyBanner `objections` prop widening).
2. **Task 2: DiscrepancyBanner alert-banner + Record-ruling + Playwright** — the alert-banner code (`DiscrepancyBanner.tsx` + `.module.scss`) and the e2e additions were authored by this plan but, due to the shared-working-tree, were swept into concurrent sibling commits during branch convergence (see Deviations): the DiscrepancyBanner alert-banner + scss landed in `be7d6d7` (sibling 08-14's `git add`) and the e2e header-redesign block landed in `fabf3d2` (sibling 08-13's `git add`). All content is intact and verified in HEAD.

_Note: no task-content was lost; attribution is split across commits because sibling plans' `git add` operations on the shared tree absorbed this plan's uncommitted Task-2 files before this plan committed them._

## Files Created/Modified
- `src/components/exhibit/ExhibitHeader.tsx` — redesigned header: ExhibitTag chip + title + StatusBadge inline, subtitle, role-gated Transfer-custody + Ask-Pivota actions; renders the DiscrepancyBanner with `objections`.
- `src/components/exhibit/ExhibitHeader.module.scss` — titleRow / subtitle / actions layout via Carbon tokens.
- `src/components/exhibit/DiscrepancyBanner.tsx` — optional `objections` prop; alert-banner branch for UNRESOLVED_OBJECTION_JURY_ELIGIBLE + OPEN with inline Record-ruling (RecordRulingForm) + Acknowledge; unchanged F14 treatment for every other flag.
- `src/components/exhibit/DiscrepancyBanner.module.scss` — `.alertBanner` / `.alertTitle` / `.alertDetail` / `.alertTrigger` red treatment.
- `e2e/exhibit-detail.spec.ts` — a new `Exhibit Detail header redesign (F10/F24)` describe block (5 tests) + `mockHistory`/`switchRole` helpers.

## Decisions Made
- **Assistant pre-scoping:** "Ask Pivota about {label}" opens the panel with no pre-scoping — `assistantStore` has no per-exhibit scoping API and adding one would touch files outside this plan's scope; the plan explicitly sanctions panel-open as the minimal implementation.
- **Optional `objections` prop:** defaulted to `[]` so the existing F14 e2e mock (which omits `objections`/`custodyCard`) keeps passing and the header never crashes on a sparse history response.
- **Single-objection resolution:** the alert banner resolves `objections[0]` (T-08-21 accept) — this phase's one qualifying fixture (P-7) has exactly one unresolved thread.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Carbon RadioButton `.check()` intercepted by its visual overlay span**
- **Found during:** Task 2 (live P-7 ruling e2e)
- **Issue:** `page.getByLabel('Overruled').check()` timed out — Carbon's `RadioButton` overlays a `.cds--radio-button__appearance` span on the native input, which intercepts the pointer event.
- **Fix:** switched the interaction to `page.getByText('Overruled', { exact: true }).click()` (the reliable Carbon-radio interaction, same control the label drives).
- **Files modified:** e2e/exhibit-detail.spec.ts
- **Verification:** the live P-7 test passes on a stable seed.
- **Committed in:** `fabf3d2` (e2e block)

### Shared-working-tree events (not code defects)

**2. [Shared tree] Task-2 files absorbed into sibling commits during branch convergence**
- Sibling plans 08-10/08-11/08-13/08-14 committed concurrently on the shared `phase-8` branch. Their `git add` of the two shared files (`DiscrepancyBanner.*`, `e2e/exhibit-detail.spec.ts`) picked up this plan's uncommitted Task-2 work, committing it under `be7d6d7`/`fabf3d2`. All of this plan's authored content is present and verified in HEAD; nothing was reverted or clobbered, and this plan likewise preserved every sibling's uncommitted content (staged only its own files individually throughout, per the shared-tree discipline).

---

**Total deviations:** 1 auto-fixed (1 blocking test-interaction fix) + 1 shared-tree attribution event.
**Impact on plan:** No scope creep. The plan's four must-haves are all satisfied in HEAD; attribution is split across commits but all content is intact and verified.

## Known Stubs
None found — `grep -nEi "TODO|FIXME|placeholder|not.?implemented|coming soon"` over all five modified files returned nothing.

## Deferred Issues
None of this plan's own. Logged to `deferred-items.md`: the pre-existing `src/app/command-center/page.tsx` tsc error (08-10 scope) that was present at HEAD during Task 1/2 — it was converged to EXIT 0 by the time the sibling plans committed (HEAD now: `tsc --noEmit` 0 errors, `npm run build` EXIT 0).

## Issues Encountered
- **Recurring shared-DB re-seed race (environmental, not a code defect):** throughout execution, sibling Phase-8 plans ran `npm run seed` + their own Playwright suites against the shared demo case (2026-CR-0142) near-continuously. A `resetSeedCase` leaves a window where `/api/case` returns empty and P-4/P-7 are briefly absent, failing ANY live-fixture test (this plan's live P-7 test AND sibling 08-13's Objection/Custody/Checklist/Timeline tests alike) whose setup lands in that window. Proven environmental: this plan's 5 tests pass 5/5 every time they run against a stable seed (confirmed in three isolated runs); only concurrent-sibling re-seed windows cause failures. This is the exact hazard documented repeatedly in STATE.md (06-03, 06-07, 07-05, 08-04, 08-05, 08-07).

## Verification
- `npx tsc --noEmit` → **0 errors** on HEAD (this plan's five files tsc-clean in isolation throughout).
- `npm run build` → **EXIT 0** on HEAD (full build, `/exhibit/[id]` route compiled).
- `npx playwright test e2e/exhibit-detail.spec.ts -g "header redesign" --workers=1` → **5/5 pass** on a stable seed (the 5 tests this plan authored).

## Next Phase Readiness
- The Exhibit Detail header half of F10 is complete; combined with 08-13's right-rail cards + Timeline + two-column `page.tsx` layout, F10's full screen is delivered.
- F24's second consuming surface (header Transfer-custody + banner Record-ruling) is wired to the shared 08-09 forms.
- No blockers introduced.

## Self-Check: PASSED
- All 5 modified files exist on disk ✓
- Commits carrying this plan's work exist in history: `3d2f7da` (Task 1), `be7d6d7` (DiscrepancyBanner alert-banner), `fabf3d2` (e2e block) ✓
- This plan's content verified present in HEAD (alert-banner, header, and e2e markers all present) ✓
- Plan-level build ran: `npm run build` EXIT 0; `npx tsc --noEmit` 0 errors ✓
- No blocking stubs (stub scan returned nothing) ✓

---
*Phase: 08-ui-redesign-and-write-action-coverage*
*Completed: 2026-10-09*
