---
phase: 03-jury-package-discrepancy-detection
plan: 04
subsystem: ui
tags: [jury-package, react-query, zustand, playwright, nextjs, discrepancy, finalize-gate, print]

# Dependency graph
requires:
  - phase: 03-02
    provides: GET/POST jury-package + finalize + acknowledge routes, JuryPackageExhibitView with per-row flags[]
  - phase: 03-03
    provides: DiscrepancyBadge + ruleLabel, populated history.discrepancyFlags, case-wide discrepancies route
  - phase: 02-05
    provides: app shell (Header/Sidebar), useRoleStore, apiFetch, StatusBadge
provides:
  - "/jury-package route rendering empty | draft | finalized states"
  - "useJuryPackage hook (query + initiate/finalize/acknowledge mutations)"
  - "useDiscrepancyCount hook (ambient count badge + flag-id resolution)"
  - "hard-disabled finalize gate reading live per-row OPEN flags"
  - "inline acknowledge (shared AcknowledgeInline) on jury draft + exhibit banner"
  - "activated sidebar Jury Package nav with open-discrepancy count pill"
  - "Exhibit Detail discrepancy banner with inline role-gated acknowledge"
  - "@media print CSS for a clean FINALIZED handoff export"
affects: [04-assistant, 05-trial-command-center]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "one-hook + presentational-components screen pattern extended to the jury workspace"
    - "role-keyed react-query keys; refetchInterval that stops on FINALIZED"
    - "client-side flag-id resolution from case-wide discrepancies (jury rows carry no flag id)"
    - "isolated freshness-tick component so live polling never detaches interactive subtrees"

key-files:
  created:
    - src/hooks/useJuryPackage.ts
    - src/hooks/useDiscrepancyCount.ts
    - src/app/jury-package/page.tsx
    - src/components/jury/JuryPackageDraft.tsx
    - src/components/jury/JuryPackageFinalized.tsx
    - src/components/jury/JuryPackageEmpty.tsx
    - src/components/jury/AcknowledgeInline.tsx
    - src/components/shell/JuryPackageNavItem.tsx
    - src/components/exhibit/DiscrepancyBanner.tsx
    - e2e/jury-package.spec.ts
  modified:
    - src/components/shell/Sidebar.tsx
    - src/components/shell/Header.tsx
    - src/components/exhibit/ExhibitHeader.tsx
    - src/app/globals.css
    - e2e/app-shell.spec.ts
    - e2e/exhibit-detail.spec.ts

key-decisions:
  - "Jury rows carry no DiscrepancyFlag.id, so the acknowledge flag-id is resolved client-side from the case-wide /api/cases/:id/discrepancies list (via useDiscrepancyCount) rather than changing the 03-02 server view"
  - "The draft 'updated Xs ago' 1s tick is isolated in its own FreshnessIndicator so live polling never re-renders the table rows (keeps inline acknowledge controls stable)"
  - "Finalize gate reads ONLY per-row flags.some(OPEN); FINALIZE_ROLES = DEPUTY/CLERK/ADMIN, ACK_ROLES = DEPUTY/CLERK/JUDGE/ADMIN (JUDGE may acknowledge but not finalize)"
  - "E2E empty-state + view-only tests use page.route mocks for determinism against the shared seed DB; the full flow drives real mutations and converges (idempotent initiate, tolerates a prior finalize)"

patterns-established:
  - "Shared AcknowledgeInline (textarea + 500-char counter + empty-disabled Confirm, no optimistic state) reused by the jury draft AND the exhibit-detail banner"
  - "Role-scoped sidebar count badge is treated as ambient chrome, not part of anti-enumeration surfaces (compare <main> content, not <body>)"

# Metrics
duration: 17min
completed: 2026-10-07
---

# Phase 3 Plan 04: Jury Package Workspace Screen Summary

**The /jury-package workspace (F11): an empty/draft/finalized screen whose Finalize button is hard-disabled via a real `disabled` attribute while any included exhibit has an OPEN discrepancy, with inline acknowledge, a stale-client 409 banner, browser-print export, an activated sidebar nav with a live open-discrepancy count badge, and an Exhibit Detail acknowledge banner.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-10-07T14:18:56Z
- **Completed:** 2026-10-07T14:35:54Z
- **Tasks:** 3
- **Files modified:** 16 (10 created, 6 modified)

## Accomplishments

- `/jury-package` renders three live states from server truth: explicit "no package started yet" empty (no side-effect draft on view), DRAFT (gated table), and read-only FINALIZED (green stamp + print export).
- Hard-disabled finalize gate computed from the LIVE per-row `flags.some(status==='OPEN')` (never `discrepancyStatus`), with an explanatory caption; view-only roles see no finalize/acknowledge controls at all.
- Inline acknowledge (shared `AcknowledgeInline`) with a live N/500 counter and empty-disabled Confirm, on both the jury draft rows and the Exhibit Detail header banner; on success the row/banner restyles to muted "Ack'd" from refetched state and the gate re-enables when the last OPEN clears.
- Stale-client 409 (`JURY_PACKAGE_DISCREPANCIES_OPEN`) surfaces an inline banner naming the blocking exhibit labels and refetches — never a generic toast.
- Activated the sidebar Jury Package link with an ambient open-discrepancy count pill (role-scoped, 4s polling); Command Center/Assistant remain `(soon)` placeholders.
- `@media print` CSS hides app chrome (`.no-print` on Header/Sidebar/actions) for a clean finalized handoff; a print-only handoff header carries the case number.
- Playwright E2E (3 tests) covering empty/no-side-effect, view-only gating, and the full initiate → gate → acknowledge → finalize → export flow.

## Task Commits

1. **Task 1: hooks + page + three state components** — `7f1fbc1` (feat)
2. **Task 2: sidebar nav + count badge, exhibit banner, print CSS** — `680b338` (feat)
3. **Task 3: Playwright E2E + re-render fix + test updates** — `1889f0e` (test)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/hooks/useJuryPackage.ts` — role-keyed query + initiate/finalize/acknowledge mutations; polling stops on FINALIZED; typed `JuryPackageError` surfacing 409 blockingExhibits.
- `src/hooks/useDiscrepancyCount.ts` — shared case-wide flag query (count pill + `resolveFlagId` for acknowledge).
- `src/app/jury-package/page.tsx` — the route; renders empty | draft | finalized.
- `src/components/jury/JuryPackageDraft.tsx` — gated table, inline acknowledge, stale-409 banner, summary line, isolated freshness indicator.
- `src/components/jury/JuryPackageFinalized.tsx` — green stamp, finalized-by+timestamp, `window.print()` export, Start New Draft.
- `src/components/jury/JuryPackageEmpty.tsx` — role-aware initiate / NO_ELIGIBLE_EXHIBITS informational copy.
- `src/components/jury/AcknowledgeInline.tsx` — shared inline textarea (500-char counter, empty-disabled Confirm).
- `src/components/shell/JuryPackageNavItem.tsx` — live nav link + count pill.
- `src/components/exhibit/DiscrepancyBanner.tsx` — Exhibit Detail per-flag banner with inline role-gated acknowledge.
- `src/components/shell/Sidebar.tsx` / `Header.tsx` — activated jury nav; `.no-print` on chrome.
- `src/components/exhibit/ExhibitHeader.tsx` — wires the DiscrepancyBanner.
- `src/app/globals.css` — `@media print` + `.no-print` utility.
- `e2e/jury-package.spec.ts` (new); `e2e/app-shell.spec.ts`, `e2e/exhibit-detail.spec.ts` (updated for the new nav model).

## Decisions Made

See frontmatter `key-decisions`. The load-bearing one: the 03-02 jury view rows carry per-flag `{ ruleCode, status, label }` but no `DiscrepancyFlag.id`, and the acknowledge endpoint keys off that id. Rather than touch the server view (the plan forbids it), the concrete flag id is resolved client-side from the case-wide `/api/cases/:id/discrepancies` list — one shared query (`useDiscrepancyCount`) serving both the sidebar count pill and flag-id lookup.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Isolated the draft freshness tick to stop it detaching interactive controls**
- **Found during:** Task 3 (E2E of the acknowledge flow)
- **Issue:** The draft's "updated Xs ago" indicator used a 1s `setInterval` that called `setNow` on the whole `JuryPackageDraft`, re-rendering the entire table every second. Combined with the 4s live polling this churned the inline acknowledge controls enough that Playwright repeatedly saw the Acknowledge trigger "detached from the DOM" — a genuine usability bug (a user's click could miss), not only a test artifact.
- **Fix:** Extracted a `FreshnessIndicator` child that owns its own 1s tick, so only that small label re-renders each second; the table rows (and their acknowledge controls) stay mounted. A node-identity probe confirmed the trigger is now stable across the polling cadence.
- **Files modified:** src/components/jury/JuryPackageDraft.tsx
- **Verification:** diagnostic showed `sameNode=true` for the trigger across 8s; full E2E then passes.
- **Committed in:** 1889f0e (Task 3 commit)

**2. [Rule 3 - Blocking] Updated two pre-existing E2E specs for the intentionally-changed nav model**
- **Found during:** Task 3 (full E2E suite run)
- **Issue:** Task 2 intentionally activates the Jury Package sidebar link and adds a role-scoped count badge. Two older specs asserted the OLD behavior: `app-shell` expected "three disabled placeholders" (Jury Package was one), and `exhibit-detail`'s sealed-vs-missing anti-enumeration test compared full `<body>` innerText, which now differs only by the ambient role-scoped count badge.
- **Fix:** `app-shell` now asserts Case Workspace + Jury Package as live links and two remaining placeholders. `exhibit-detail` scopes the byte-identical comparison to `<main>` (the actual anti-enumeration surface), since the sidebar badge is ambient chrome, not exhibit content. The anti-enumeration guarantee is preserved and still asserted.
- **Files modified:** e2e/app-shell.spec.ts, e2e/exhibit-detail.spec.ts
- **Verification:** full suite 22/22 pass.
- **Committed in:** 1889f0e (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking). **Impact:** The re-render fix improves real UX and testability; the spec updates align tests with Task 2's deliberate nav activation. No scope creep, no server-contract changes.

## Known Stubs

None found. The only `placeholder`/`soon` matches in changed files are a legitimate `<textarea placeholder>` attribute and the intentional Command Center/Assistant `(soon)` nav placeholders reserved for Phases 4-5.

## Issues Encountered

- The full-flow E2E initially timed out on the acknowledge loop: the loop's stale trigger-count check could enter one iteration too many after all flags were acknowledged. Restructured the loop to drive acknowledges inside a `toPass` block that terminates as soon as the Finalize button is enabled (the gate-cleared signal). Deterministic across repeated fresh-seed runs.
- The Playwright suite runs against the docker-compose app (production `next start`); each full-flow run mutates/finalizes the shared seeded package, so the DB is re-seeded (`docker compose exec app npm run seed`) before verification runs. The empty-state and view-only tests use `page.route` mocks and are independent of shared state.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 3 (Jury Package & Discrepancy Detection) is complete after this plan: F5 (jury-ready list), F6 (discrepancy identification + acknowledge), and F11 (Jury Package Workspace screen) are all shipped and demonstrable end-to-end.
- The seeded demo case boots with both discrepancy rules firing, so the finalize gate → acknowledge → finalize flow is demonstrable out of the box.
- Phases 4 (Assistant) and 5 (Trial Command Center) read the same discrepancy/jury rows this screen operates on; the shared `useDiscrepancyCount` and per-flag `DiscrepancyFlagSummary` sources are in place for them to consume.

---
*Phase: 03-jury-package-discrepancy-detection*
*Completed: 2026-10-07*

## Self-Check: PASSED

- All 10 created key-files present on disk.
- All 3 task commits present (7f1fbc1, 680b338, 1889f0e).
- Plan-level build: `npm run build` → exit 0 (route `/jury-package` registered).
- `npx tsc --noEmit` clean; 152/152 vitest; 22/22 Playwright.
- `## Known Stubs`: None found (no blocking stubs).
