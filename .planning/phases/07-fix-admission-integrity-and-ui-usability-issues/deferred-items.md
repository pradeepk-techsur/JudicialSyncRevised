# Phase 07 — Deferred / Out-of-Scope Items

Items discovered during plan execution that are OUT OF SCOPE for the executing
plan (not directly caused by that plan's changes) and therefore not fixed by it.

## From 07-01 (admission integrity gate)

- **`src/services/status.test.ts` fallout is owned by 07-02, not fixed here.**
  The new F12 gate (this plan) correctly blocks the two existing status.test.ts
  tests that admit an exhibit with no custody established:
  - `'records a valid MARKED -> OFFERED -> ADMITTED sequence...'` (line ~48) — no
    custody transfer before ADMIT, now throws ADMISSION_BLOCKED.
  - `'rejects any further transition once terminal (ADMITTED) with STATUS_FINALIZED'`
    (line ~82) — same: reaches ADMITTED with no custody.
  07-01's verification step 2 and 07-02-PLAN.md (frontmatter `files_modified`
  lists `src/services/status.test.ts`; Task at line 273/278 names the exact test
  to fix) BOTH assign this fixture repair to plan 07-02 (the F12 "regression/
  compliance half"). Deliberately NOT fixed in 07-01 — fixing it would overwrite
  a file 07-01 does not own and pre-empt 07-02's scope. 07-01's own two test
  files (admissionGate.test.ts, status/route.test.ts) are fully green.

- **Pre-existing out-of-scope tsc state in the shared tree.** The working tree
  carried uncommitted sibling-plan changes when 07-01 began (ExhibitTable.tsx,
  schema.prisma, custody.ts, objections.ts, events.ts, seed.ts, Header.tsx,
  etc.). `npx tsc --noEmit` on the whole tree was EXIT=0 at 07-01's commit points;
  07-01's own changed files (errors.ts, status.ts, + 2 test files) are tsc-clean
  in isolation. The RECURRING HAZARD (STATE.md Blockers) remains active in phase 7.

## From 07-05 (header indicator + activity feed)

- **Transient concurrent-plan tsc errors in files 07-05 did not touch.** During
  07-05's acceptance gate, `npx tsc --noEmit` reported errors in files owned by
  sibling wave-1 plans executing concurrently against the shared working tree:
  - `src/components/case/ExhibitTable.tsx(90,10): error TS1005: ';' expected` (07-03 "clickable rows" mid-edit)
  - `src/data/seed.ts(194,11): error TS2304: Cannot find name 'sleep'` (07-02 seed rewrite mid-edit)
  These appeared/disappeared between consecutive tsc runs — classic shared-working-tree
  interleaving (the RECURRING HAZARD logged in STATE.md Blockers, now also in phase 07).
  07-05's own changed files (`Header.tsx`, `DiscrepanciesPanel.tsx`,
  `RecentActivityPanel.tsx`) are tsc-clean in isolation (grep of tsc output for those
  paths returns zero matches). Left to the owning plans / merged-HEAD acceptance.

## From 07-04 (row clickability + assistant example prompts)

- **Transient concurrent-plan tsc errors in files 07-04 did not touch.** During
  07-04's verification, `npx tsc --noEmit` reported errors that appeared and shifted
  between consecutive runs, all in files owned by sibling wave-1 plans editing the
  shared working tree mid-flight:
  - `src/data/seed.ts(194,11): error TS2304: Cannot find name 'sleep'` (07-02 seed
    rewrite mid-edit — `sleep` is actually declared at line 168 and used at 202/277;
    the error vanished on the next run).
  - `src/services/events.ts(35,18): error TS7053 … Property 'JURY_PACKAGE_EXHIBIT_EXCLUDED'
    does not exist` (07-01/07-03 event-type extension mid-edit; a new migration
    `20261009010505_add_jury_package_exhibit_exclusion` and a modified `prisma/schema.prisma`
    are present in the tree from that work).
  07-04's OWN changed files (`ExhibitTable.tsx`, `ExhibitTable.module.scss`,
  `ExampleChips.tsx`, `chat/route.test.ts`, `e2e/case-workspace.spec.ts`,
  `e2e/assistant.spec.ts`) are tsc-clean in isolation. Verified by filtering tsc
  output: zero errors reference any 07-04-owned path. Left to the owning plans /
  merged-HEAD acceptance (the RECURRING HAZARD in STATE.md Blockers).

- **`chat/route.test.ts` `beforeAll` hook exceeds vitest's 10s default because a
  sibling plan's seed rewrite added `sleep(1200)` calls.** `runSeed()` now takes
  ~11s (measured), so the test's `beforeAll` times out at the default 10s
  hookTimeout — NOT a defect in 07-04's change (which only swapped DEMO_QUESTIONS
  from the retired "Exhibit 14"/"Exhibit 7" to real labels P-4/P-3). Proven: run
  with `--hookTimeout=30000` and the suite passes 16/16 (3 no-key paths skip since
  an ANTHROPIC key is present) — including every DEMO_QUESTIONS probe resolving
  grounded-or-decline against the real seed, and the "who currently has custody of
  P-4" grounded guard carrying >=1 citation. The 10s-vs-11s timing collision is
  owned by the sibling seed rewrite (07-02); the merged-HEAD acceptance gate should
  either raise the hookTimeout for this suite or the seed should drop the added
  sleeps. 07-04's test content is correct as written.

- **The docker-compose `app` service runs from a BAKED image (COPY source, no bind
  mount), so the running container never reflects live working-tree edits.** All
  plans' host-side edits (and sibling edits) are invisible to `project-app-1` until
  the image is rebuilt. 07-04 verified its e2e against a HOST `next dev` process
  (serving the live source) pointed at an ISOLATED `verify0704` database — created
  specifically because concurrent sibling plans were continuously re-running their
  (mid-edit, sometimes crashing) seed against the shared `judicialsync` DB,
  repeatedly corrupting the demo case (observed: demo case reduced to a lone P-1
  after a sibling seed crashed mid reset-rebuild on an FK violation). The isolated
  DB gave a stable P-1..P-5/D-1..D-3/S-1 seed for the duration of verification. The
  merged-HEAD acceptance gate should rebuild the app image (or add a dev bind mount)
  so the preview/container reflects the merged source.
