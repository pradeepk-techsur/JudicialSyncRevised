---
phase: 08-ui-redesign-and-write-action-coverage
plan: 09
subsystem: ui
tags: [react-query, carbon, zustand, write-actions, role-gating, F24]

# Dependency graph
requires:
  - phase: 08-02
    provides: recordCustodyTransfer DEPUTY/CLERK/ADMIN server-side role gate (RoleNotPermittedError) — makes the 403 failure path meaningfully testable through the TransferCustodyForm round-trip
  - phase: 08-03
    provides: ActionButtonRow shared primary/secondary button-pairing layout component
provides:
  - RecordRulingForm — reusable JUDGE-only inline disposition selector + explicit confirm, POSTs /api/objections/:id/ruling
  - TransferCustodyForm — reusable DEPUTY/CLERK/ADMIN-only inline custodian picker + explicit confirm, POSTs /api/exhibits/:id/events/custody
  - useRecordRuling — useMutation wrapper over the ruling endpoint, invalidate-on-success
  - useTransferCustody — useMutation wrapper over the custody endpoint, invalidate-on-success
affects: [08-10, 08-12, 08-13, 08-14, 08-15]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Write-action form pattern: absent-not-disabled role gate (useRoleStore().role + local ROLES array + .includes) + explicit confirm (no auto-submit on selection) + inline server-rejection surfacing via JuryPackageError + invalidate-on-success (zero optimistic state) — mirrors AcknowledgeInline/JuryPackageDraft exactly"
    - "Shared write-action mutation hook shape: apiFetch + parseError channel, 5-key scoped invalidation onSuccess, activeUserId from roleStore attached to the body"

key-files:
  created:
    - src/hooks/useRecordRuling.ts
    - src/components/actions/RecordRulingForm.tsx
    - src/components/actions/RecordRulingForm.module.scss
    - src/hooks/useTransferCustody.ts
    - src/components/actions/TransferCustodyForm.tsx
    - src/components/actions/TransferCustodyForm.module.scss
  modified: []

key-decisions:
  - "Carbon Dropdown typed explicitly as Dropdown<ActiveCaseUser> so selectedItem?.id type-checks (the plan's inline snippet relied on inference the generic doesn't provide at the call site) — behaviorally identical to the plan"
  - "eslint verify step is not runnable in this project (Next 16 dropped next lint, no eslint config/dep present — ESLint v10 errors 'couldn't find eslint.config.*'); tsc --noEmit + next build are the authoritative gates, matching established Phase 6/8 precedent"

patterns-established:
  - "F24 write-action forms share one visual language (Carbon-token .container/.error SCSS) and one interaction contract across all three wave-3/4 call sites, guaranteed by building them once here before any consumer"

# Metrics
duration: 2 min
completed: 2026-10-09
---

# Phase 8 Plan 09: Write-Action UI Components (Record Ruling & Transfer Custody) Summary

**Two reusable Carbon write-action forms (`RecordRulingForm`, `TransferCustodyForm`) + their react-query mutation hooks — the first-ever UI surface over the Phase-1/Phase-3 `recordRuling`/`recordCustodyTransfer` services, absent-not-disabled role-gated, explicit-confirm, inline-error, invalidate-on-success.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-10-09T12:20:43Z
- **Completed:** 2026-10-09T12:22:56Z
- **Tasks:** 2
- **Files created:** 6

## Accomplishments
- `RecordRulingForm` — JUDGE-only (absent for every other role), inline SUSTAINED/OVERRULED/RESERVED radio group, explicit "Confirm ruling" (selection never auto-submits), inline surfacing of the specific server rejection (e.g. 409 OBJECTION_ALREADY_RESOLVED, 403 ROLE_NOT_PERMITTED) within the still-open form, invalidates 5 affected query keys on success.
- `TransferCustodyForm` — DEPUTY/CLERK/ADMIN-only (absent otherwise), custodian picker populated from the already-hydrated client roster (no new fetch) with the current custodian excluded (F03 NO_OP_TRANSFER never offered), explicit "Confirm", inline error surfacing, single-endpoint (no propose/confirm/cancel per the locked 08-CONTEXT decision), invalidates 5 affected query keys on success.
- Both hooks follow the established `useJuryPackage` finalize-mutation shape exactly — `apiFetch` + shared `parseError`/`JuryPackageError` channel, zero optimistic client-derived state.

## Task Commits

Each task was committed atomically:

1. **Task 1: useRecordRuling hook + RecordRulingForm** - `666d206` (feat)
2. **Task 2: useTransferCustody hook + TransferCustodyForm** - `83ec1ac` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `src/hooks/useRecordRuling.ts` - useMutation over POST /api/objections/:id/ruling; invalidate-on-success (attention-feed, exhibit-history, objections, discrepancy-count, jury-package)
- `src/components/actions/RecordRulingForm.tsx` - JUDGE-only inline disposition selector + explicit confirm + inline error
- `src/components/actions/RecordRulingForm.module.scss` - Carbon-token inline-form chrome + error caption
- `src/hooks/useTransferCustody.ts` - useMutation over POST /api/exhibits/:id/events/custody; invalidate-on-success (attention-feed, custody-by-custodian, exhibit-history, discrepancy-count, jury-package)
- `src/components/actions/TransferCustodyForm.tsx` - DEPUTY/CLERK/ADMIN-only custodian picker + explicit confirm + inline error
- `src/components/actions/TransferCustodyForm.module.scss` - Carbon-token inline-form chrome + error caption (matches RecordRulingForm)

## Decisions Made
- **Typed Carbon `Dropdown<ActiveCaseUser>`** — the plan's inline snippet called `selectedItem?.id` without a generic argument; the explicit generic (sourced from the already-exported `ActiveCaseUser` type in `roleStore`) makes it type-check with no behavioral change.
- **eslint verify step not runnable** — this project has no eslint config or dependency (Next 16 dropped `next lint`); `npx eslint` errors out with "couldn't find eslint.config.*". `tsc --noEmit` (exit 0) + `next build` (exit 0) are the authoritative gates, exactly as every prior Phase 6/7/8 plan recorded.

## Deviations from Plan

None - plan executed exactly as written (modulo the `Dropdown` generic type annotation noted above, which is a faithful implementation of the plan's intent, not a scope change).

## Known Stubs

None found - grep for TODO/FIXME/placeholder/not-implemented across all 4 created `.ts`/`.tsx` files returned zero matches. Both forms fully implement the real behavior (role gate, explicit confirm, live mutation call, inline error, invalidation).

## Issues Encountered
None.

## Verification
- `npx tsc --noEmit` → exit 0 (clean), after both tasks.
- `npm run build` (plan-level build, after last task) → exit 0; both target endpoints (`/api/objections/[id]/ruling`, `/api/exhibits/[id]/events/custody`) registered in the route manifest.
- Integration contracts confirmed pre-execution: `grep RoleNotPermittedError src/services/custody.ts` → CONTRACT_OK (08-02); `grep 'export function ActionButtonRow'` → CONTRACT_OK (08-03).
- `npx eslint` → not runnable (no config in project); superseded by tsc+build per project precedent.
- Full behavioral verification (role-gated absence in situ, inline-expansion interaction, 403/409 error rendering against a real server) deliberately deferred to the wave-3/4 consuming screens' Playwright suites (08-12/08-13/08-14/08-15), mirroring Phase 3's `AcknowledgeInline` precedent — this shared component ships with no standalone e2e spec by design.

## Next Phase Readiness
- Both F24 write-action components are ready to be consumed by the three wave-3/4 screens: Command Center attention feed + Custody-at-a-Glance (08-10/08-15), Exhibit Detail header + Objection card (08-12/08-13), Jury Package (08-14).
- No blockers.

## Self-Check: PASSED
- Created files exist on disk: all 6 confirmed (git-tracked in commits 666d206 / 83ec1ac).
- Commits exist: 666d206, 83ec1ac present in git log.
- Build check: `npm run build` → exit 0.
- `## Known Stubs` section present, no blocking entries.

---
*Phase: 08-ui-redesign-and-write-action-coverage*
*Completed: 2026-10-09*
