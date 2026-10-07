---
phase: 02-core-screens
plan: 07
subsystem: ui
tags: [react-query, next, timeline, anti-enumeration, exhibit-detail, F10]

# Dependency graph
requires:
  - phase: 02-02
    provides: "GET /api/exhibits/:id/history with role-masking (parseRequestingRole) — the sealed/missing 404 identity this screen surfaces"
  - phase: 02-05
    provides: "StatusBadge (shared status render), apiFetch (X-User-Role wrapper), useRoleStore (client session)"
provides:
  - "/exhibit/:id Exhibit Detail View: header (status/custodian/party/witness) above the fold + full chronological ledger timeline + back link"
  - "useExhibitHistory react-query hook with NotFoundError 404-vs-other-error distinction and 4s polling"
  - "ExhibitNotFound — the single shared not-found render used identically for missing and sealed-unauthorized cases"
affects: [phase-03-discrepancy, phase-04-assistant]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "react-query hook throws a typed NotFoundError on 404 so the page can branch to the shared not-found render without retry-induced timing side-channel"
    - "role in the query key so a role switch re-fetches immediately (sealed exhibit flips to not-found without waiting for the next poll)"
    - "timeline summaries rendered VERBATIM from getExhibitHistory — zero client-side re-derivation (future F7 Assistant text-parity precondition)"

key-files:
  created:
    - src/hooks/useExhibitHistory.ts
    - src/components/exhibit/ExhibitHeader.tsx
    - src/components/exhibit/Timeline.tsx
    - src/components/exhibit/ExhibitNotFound.tsx
    - src/app/exhibit/[id]/page.tsx
    - e2e/exhibit-detail.spec.ts
  modified: []

key-decisions:
  - "Playwright spec drives the unauthorized-role sealed probe via page.route header injection (X-User-Role=ATTORNEY) rather than a UI role switch — the app's in-memory zustand session resets to JUDGE on every full-page navigation, so a UI switch cannot survive a page.goto"
  - "Cross-screen parity asserted against the shared exhibits service (GET /api/cases/:id/exhibits → currentStatus) mapped through StatusBadge's label table, not against 02-06's /case DOM — proves parity with the service layer both screens read, decoupled from the peer plan's rendering"

patterns-established:
  - "Pattern: typed NotFoundError in a react-query hook drives a dedicated not-found render path with retry disabled, closing a timing side-channel the anti-enumeration guarantee must not reopen"
  - "Pattern: StatusBadge aria-label ('Current status: X') is the unambiguous E2E selector for status, avoiding strict-mode collisions with the same word inside timeline summary text"

# Metrics
duration: 36min
completed: 2026-10-07
---

# Phase 2 Plan 07: Exhibit Detail View Summary

**`/exhibit/:id` renders the complete chronological story of one exhibit — status/custodian/party/witness above the fold, the full ledger timeline (verbatim summaries, oldest-first) below — with missing and sealed-unauthorized reads rendering a byte-identical not-found page.**

## Performance

- **Duration:** 36 min
- **Started:** 2026-10-07T08:22:21Z
- **Completed:** 2026-10-07T08:58:14Z
- **Tasks:** 3
- **Files modified:** 6 (all created)

## Accomplishments
- `useExhibitHistory` hook: react-query wrapper over `GET /api/exhibits/:id/history` that throws a typed `NotFoundError` on 404 (vs. any other failure), disables retry for the 404 case (no timing side-channel on sealed probes), keys on `role` for immediate re-fetch on role switch, and polls every 4s for live-sync.
- Exhibit Detail screen: `ExhibitHeader` (shared `StatusBadge` + custodian/party/witness, Phase-3 discrepancy banner structurally reserved), `Timeline` (one `<li>` per ledger event, oldest-first, summary rendered verbatim with zero re-derivation), `ExhibitNotFound` (the single shared not-found render), wired in `/exhibit/[id]/page.tsx`.
- Playwright spec proving: header-above-timeline with correct 4-entry count/order; byte-identical not-found for missing vs. sealed-unauthorized (anti-enumeration); back-link navigation; cross-screen status parity with the shared exhibits service.

## Task Commits

Each task was committed atomically:

1. **Task 1: useExhibitHistory data hook** — `474d178` (feat)
2. **Task 2: ExhibitHeader + Timeline + ExhibitNotFound + /exhibit/:id page** — `3bea492` (feat)
3. **Task 3: Exhibit Detail Playwright spec** — `6483213` (test)

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified
- `src/hooks/useExhibitHistory.ts` — react-query hook; NotFoundError 404 distinction, retry-disabled-for-404, role in query key, 4s polling
- `src/components/exhibit/ExhibitHeader.tsx` — above-the-fold header via shared StatusBadge; Phase-3 discrepancy banner reserved (always [] here)
- `src/components/exhibit/Timeline.tsx` — full ordered ledger, verbatim summary strings, zero re-derivation
- `src/components/exhibit/ExhibitNotFound.tsx` — single shared render for missing AND sealed-unauthorized
- `src/app/exhibit/[id]/page.tsx` — client page: hook → header+timeline on success, shared not-found on 404, back link to /case
- `e2e/exhibit-detail.spec.ts` — four scenarios (header/timeline, not-found identity, back link, cross-screen parity)

## Decisions Made
- **Sealed-probe E2E via header injection, not UI role switch:** the app's session is pure in-memory zustand (02-05 decision) and resets to the default JUDGE on every full-page navigation, so a UI role switch cannot persist across a `page.goto`. The spec forces `X-User-Role=ATTORNEY` on the history request via `page.route` to deterministically drive the unauthorized-role path.
- **Parity asserted against the shared service, not 02-06's DOM:** the cross-screen parity scenario reads P-3's `currentStatus` from `GET /api/cases/:id/exhibits` (the same service layer the Case Workspace list renders) and asserts the detail screen's StatusBadge shows the identically-mapped label — proving parity with the shared data source while staying decoupled from the peer plan's (02-06) rendering.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected three Playwright selectors/strategies in the plan's spec**
- **Found during:** Task 3 (running the spec)
- **Issue:** The plan's spec text had three problems that failed against the real app: (a) `getByText('Objected')`/`getByText('Admitted')` hit Playwright strict-mode violations because the status word also appears inside timeline summary text ("Status changed ... to OBJECTED"); (b) the not-found scenario switched role via the `/case` UI then navigated to the exhibit page, but the in-memory zustand session resets to JUDGE on full navigation, so the sealed exhibit stayed visible and the not-found page never rendered; (c) the parity scenario read status from `data-testid="exhibit-row"` on `/case`, which is 02-06's (peer plan) rendering and couples this spec to unbuilt/parallel UI.
- **Fix:** (a) target status via the unambiguous `getByLabel('Current status: X')` StatusBadge aria-label; (b) force `X-User-Role=ATTORNEY` on the history request via `page.route` header injection to deterministically drive the unauthorized-role path across navigation; (c) assert parity against the shared exhibits service (`GET /api/cases/:id/exhibits` → `currentStatus`, mapped through StatusBadge's label table), decoupled from 02-06's DOM.
- **Files modified:** e2e/exhibit-detail.spec.ts
- **Verification:** `npx playwright test e2e/exhibit-detail.spec.ts --workers=1` → 4 passed
- **Committed in:** 6483213 (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug, confined to this plan's own test artifact)
**Impact on plan:** No change to the implementation (hook/components/page match the plan exactly). The deviation corrected the plan's spec selectors to match the app's actual architecture (in-memory session, shared StatusBadge aria-labels) and decoupled the parity check from the parallel peer plan. No scope creep.

## Issues Encountered
- **Dev-server launch for Playwright wedged the persistent shell repeatedly.** Hand-launching `npm run start`/`npm run dev` via nohup/setsid/background shells caused the bash tool to hang on the detached process group (the tool waits on descendant FDs). Resolution: let Playwright's own `webServer` config manage the server lifecycle and run `npx playwright test ...` in the foreground — it booted the server and ran all four scenarios cleanly. No app or config change was needed (`playwright.config.ts` left untouched).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- F10 Exhibit Detail View complete and the last plan of Phase 2's wave 3. The screen's verbatim-timeline and sealed-masking indistinguishability are the stated preconditions for Phase 3 (discrepancy banner slot reserved in `ExhibitHeader`) and Phase 4's F7 Assistant citation-parity guarantee.
- No blockers introduced. The `discrepancyFlags` block in `ExhibitHeader` is structurally reserved and always-empty until Phase 3's `DiscrepancyFlag` table exists.

---
*Phase: 02-core-screens*
*Completed: 2026-10-07*

## Known Stubs
None found. The only `placeholder`-matching string is an explanatory comment in `ExhibitHeader.tsx` documenting the intentionally-reserved (Phase 3) discrepancy banner, which the plan itself specifies — it is cosmetic/by-design, not a blocking stub.

## Self-Check: PASSED
- Created files exist on disk: `src/hooks/useExhibitHistory.ts`, `src/components/exhibit/ExhibitHeader.tsx`, `src/components/exhibit/Timeline.tsx`, `src/components/exhibit/ExhibitNotFound.tsx`, `src/app/exhibit/[id]/page.tsx`, `e2e/exhibit-detail.spec.ts` — all FOUND.
- Commits exist: `474d178` (Task 1), `3bea492` (Task 2), `6483213` (Task 3) — all FOUND in git log.
- Plan-level build: `npm run build` → exit 0, `/exhibit/[id]` route compiled.
- Unit/integration: `npm test` (vitest) → 20 files, 114 tests passed.
- E2E: `npx playwright test e2e/exhibit-detail.spec.ts --workers=1` → 4/4 passed.
- Known Stubs: no blocking stubs.
