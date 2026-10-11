---
phase: 09-ui-tickets-and-typography-standard
plan: 09
subsystem: ui
tags: [role-switcher, demo-mode, zustand, tanstack-query, carbon, playwright, safety-affordance]

requires:
  - phase: 08-ui-redesign-and-write-action-coverage
    provides: the shared Carbon app shell (Header/AppShell), the attention-feed Record-ruling role-gated control, and the per-write-path ad hoc role gates this plan safeguards (never replaces)
provides:
  - "Demo-labeled, env-flag-gated (NEXT_PUBLIC_DEMO_MODE) role switcher — unmistakable as a test control, not a real login"
  - "ActiveRoleBanner: persistent shell-level 'Active role: X — switch back' safety strip"
  - "roleStore.previousUserId: the switch-back target, captured on every real switch"
  - "Confirmed + e2e-proven guarantee that a role switch refreshes every role-gated control with no page reload"
affects: []

tech-stack:
  added: []
  patterns:
    - "Public build-time client flag (NEXT_PUBLIC_DEMO_MODE) defaulting ENABLED unless literally 'false' — hides a demo-only affordance without a code change"
    - "Shell-level mount-once component self-hiding until a precondition (previousUserId !== null), same pattern as AssistantPanel"

key-files:
  created:
    - src/components/shell/ActiveRoleBanner.tsx
    - src/components/shell/ActiveRoleBanner.module.scss
  modified:
    - src/components/shell/Header.tsx
    - src/components/shell/AppShell.tsx
    - src/stores/roleStore.ts
    - .env.example
    - e2e/app-shell.spec.ts

key-decisions:
  - "Gate on a dedicated NEXT_PUBLIC_DEMO_MODE flag, NOT NODE_ENV — next start always runs production in this demo's Dockerfile, so NODE_ENV gating would hide the switcher in the shipped product"
  - "Banner self-hides until a real switch (previousUserId !== null) — no clutter on first load, nothing to switch back to yet"
  - "Task 3 made ZERO hook changes: every live-sync queryKey already includes role (confirmed by grep), so the refresh-without-reload guarantee is already satisfied; the plan only verifies + proves it"

patterns-established:
  - "Demo-only UI affordances are env-flag-gated with a client NEXT_PUBLIC_ flag defaulting enabled, so production can suppress them with a build var"

duration: 7min
completed: 2026-10-10
---

# Phase 9 Plan 09: Role switcher safeguards (T-09) Summary

**Demo-labeled, NEXT_PUBLIC_DEMO_MODE-gated role switcher plus a persistent shell-level "Active role: X — switch back" safety banner, with the already-correct role-in-every-query-key refresh guarantee verified and e2e-proven.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-10-10T18:13:06Z
- **Completed:** 2026-10-10T18:20:56Z
- **Tasks:** 3
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments
- Role switcher visible label changed `Role:` → `Demo role:` with an explanatory tooltip ("Demo/test control — switches the active persona, not a real login"), and gated behind `NEXT_PUBLIC_DEMO_MODE` (renders unless the literal string `'false'`; defaults enabled when unset — current behavior preserved exactly). `.env.example` documents the flag.
- New `ActiveRoleBanner`: a thin, dismiss-free Carbon-token-styled safety strip reading `Active role: {name} ({role})` with a working "Switch back" control; mounted once in `AppShell` between Header and body so it persists across routes; self-hides until a real switch has happened.
- `roleStore` gained `previousUserId`, captured in `setActiveUser` before overwrite (null on hydrate / no-op re-select) to power switch-back.
- Confirmed (grep, zero code change) every live-sync hook's queryKey already includes `role`, and added a Playwright test proving a mid-session role switch flips a JUDGE-gated control **without `page.reload()`**, shows the banner with the new role, and that Switch back restores both.

## Task Commits

1. **Task 1: Demo-label + env-flag-gate the role switcher** - `c60bb6c` (feat)
2. **Task 2: Persistent active-role banner with switch-back** - `320deec` (feat, component + scss) + `f2eb940` (fix, recovered store/AppShell edits reverted by a sibling plan's git op)
3. **Task 3: Confirm role-in-every-query-key + Playwright proof** - `edb9705` (test)

## Files Created/Modified
- `src/components/shell/ActiveRoleBanner.tsx` - Persistent active-role safety banner with switch-back
- `src/components/shell/ActiveRoleBanner.module.scss` - Compact Carbon-token styling ($layer-02/$border-subtle/body-compact-01)
- `src/components/shell/Header.tsx` - "Demo role:" label + tooltip + NEXT_PUBLIC_DEMO_MODE gate around the Select
- `src/components/shell/AppShell.tsx` - Mount ActiveRoleBanner once at shell level
- `src/stores/roleStore.ts` - previousUserId field + capture logic in setActiveUser/hydrate
- `.env.example` - Document NEXT_PUBLIC_DEMO_MODE (purpose + default)
- `e2e/app-shell.spec.ts` - New T-09 test (banner + gated-control-flips-without-reload + switch-back)

## Decisions Made
- **Dedicated NEXT_PUBLIC_DEMO_MODE flag, not NODE_ENV gating** — per 09-CONTEXT, `next start` always runs `NODE_ENV=production` in this demo's Dockerfile, so NODE_ENV gating would hide the switcher in the shipped product and break it.
- **Banner self-hides until a real switch** (`previousUserId !== null`) — avoids cluttering the default/first-load experience with a banner that has no useful switch-back action.
- **Task 3 is verification-only** — per 09-CONTEXT decision #1, every TanStack Query key already includes `role`; the plan safeguards the switcher, it does not audit/rebuild the data layer. Zero hook code changed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Recovered store + AppShell edits reverted by a concurrent sibling plan**
- **Found during:** Task 2
- **Issue:** After the two new `ActiveRoleBanner` files were committed (`320deec`), a concurrent sibling Phase-9 plan's git operation (the recurring shared-working-tree hazard documented throughout STATE.md) reverted the uncommitted modifications to `src/stores/roleStore.ts` (the `previousUserId` field) and `src/components/shell/AppShell.tsx` (the banner mount), leaving the banner component present but never rendered and its store field absent — a broken, incomplete feature.
- **Fix:** Re-applied both edits and committed them individually (`f2eb940`), staging ONLY my two files and never touching the siblings' in-flight changes.
- **Files modified:** src/stores/roleStore.ts, src/components/shell/AppShell.tsx
- **Verification:** grep confirmed both edits present; tsc --noEmit clean; full app-shell.spec.ts 12/12 green.
- **Committed in:** f2eb940

---

**Total deviations:** 1 auto-fixed (1 blocking — shared-tree recovery).
**Impact on plan:** No scope change — the recovery simply restored work a sibling's git op had wiped. The feature is complete and coherent.

## Issues Encountered
- **Transient dev-server churn from concurrent sibling plans.** During Task 2 verification, the shared `npm run dev` server briefly returned `000`/timed out and two unrelated 09-08 tests flaked, because sibling plans were mid-edit on `types.ts`/`exhibits.ts`/`history.ts`/`RecentActivityPanel` (uncommitted in the shared tree), forcing long Turbopack recompiles of broken intermediate states. Resolved by waiting for the server to finish recompiling (`/command-center` → 200) and re-running: the full suite then passed 12/12. Not a defect in this plan's code — my files type-check (`tsc --noEmit` exit 0) and build (`npm run build` exit 0) cleanly.

## Known Stubs
None found. (The only "placeholder" grep hits in changed files are a pre-existing comment in app-shell.spec.ts and the dev-password doc comment in .env.example — not code stubs.)

## User Setup Required
`NEXT_PUBLIC_DEMO_MODE` is a Claude-set default (`"true"` in `.env.example`), enabled, matching current shipped demo behavior — **no manual action required for the demo.** Only a genuine production deployment with real auth in front of it would set it to `'false'` to hide the switcher. See `09-09-PLAN.md` frontmatter `user_setup` for the rationale.

## Next Phase Readiness
- T-09 fully delivered: labeled + env-gated switcher, persistent active-role banner, confirmed/proven refresh-without-reload guarantee.
- No new server-side authorization code introduced (per 09-CONTEXT decision #1); the centralized `assertRole`/Permission Matrix remains deferred Phase-7.1 scope.
- Ready for the next Phase 9 plan.

## Self-Check: PASSED
- Created files exist: ActiveRoleBanner.tsx, ActiveRoleBanner.module.scss — FOUND
- Commits exist: c60bb6c, 320deec, f2eb940, edb9705 — FOUND
- Build gate: `npx tsc --noEmit` exit 0; `npm run build` exit 0
- Integration contract: `grep 'export function ActiveRoleBanner'` → CONTRACT_OK
- Known Stubs section present, no blocking stubs

---
*Phase: 09-ui-tickets-and-typography-standard*
*Completed: 2026-10-10*
