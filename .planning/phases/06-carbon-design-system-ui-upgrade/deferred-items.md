# Phase 06 — Deferred / Out-of-Scope Items

Discoveries logged during plan execution that are OUTSIDE the executing plan's
scope. Per the deviation-rules SCOPE BOUNDARY, these are recorded here rather
than fixed by the unrelated plan that found them.

## Found during 06-07 (Command Center migration)

### Broken commit from parallel plan 06-08 left HEAD non-compiling (phase-wide)

- **Discovered:** executing 06-07 Task 3 (Playwright acceptance gate). The dev
  server returned HTTP 500 on every route because the app shell
  (`layout.tsx → AppShell → AssistantPanel`) failed to compile.
- **Root cause (commit `7be9a64` "feat(06-08): migrate MessageBubble and
  AssistantThread to Carbon"):**
  1. `src/components/assistant/MessageBubble.module.scss:24` references
     `$button-primary`, which is NOT exported by `@carbon/styles/scss/theme`.
     That token lives in `@carbon/styles/scss/components/button/_tokens.scss`.
     Sass aborts with `Undefined variable`.
  2. `src/components/assistant/AssistantPanel.tsx:6` imports
     `./AssistantPanel.module.scss`, a file that commit `7be9a64` never created
     (`Module not found`).
- **Scope:** These are 06-08's files (the Pivota Assistant migration), NOT in
  06-07's `files_modified`. They are the shared-working-tree / concurrent-plan
  hazard already recorded in STATE.md Blockers.
- **Impact on 06-07:** BLOCKING for 06-07's own acceptance gate — the Command
  Center screen cannot render (its layout wraps the broken AssistantPanel), so
  `command-center.spec.ts` cannot run until the shell compiles.
- **Disposition:** 06-07 does NOT own the fix. The owning plan (06-08) or the
  phase verify/gap-closure step must repair it. See 06-07-SUMMARY.md "Deferred
  Issues" for how 06-07 verified its own work around this.

## Found + fixed during 06-05 (Exhibit Detail migration)

### Carbon fixed SideNav overlaid `<main>`, intercepting top-left content clicks

- **Discovered:** executing 06-05 Task 3 (Playwright acceptance gate). The
  `back link returns to /case` test failed — the back-link resolved but
  `locator.click` timed out because `<a data-testid="nav-jury-package">` (the
  Carbon SideNav) "intercepts pointer events".
- **Root cause:** `src/components/shell/Sidebar.tsx` renders Carbon's `SideNav`
  with `isFixedNav`, which is `position: fixed` and takes ZERO flow width.
  `AppShell.module.scss` laid out `.body` as `Sidebar + main` flex siblings with
  no left offset, so `<main>` started at `x=0` *underneath* the 16rem rail.
  Probed bounding boxes confirmed: SideNav `{x:0,w:256,h:720}`, back-link
  `{x:24,y:72}` — entirely inside the rail's fixed overlay, which won the hit
  test.
- **Scope:** `src/components/shell/AppShell.module.scss` is owned by 06-03 (app
  shell), NOT in 06-05's `files_modified`. This is the recurring shared-working-
  tree hazard (STATE.md Blockers), but here it is a genuine app-wide layout bug,
  not a transient broken commit.
- **Fix (committed in 06-05 `3561037`):** added `padding-left: 16rem` to
  `.body` so main content clears the fixed rail. Minimal, app-wide-correct.
  Re-verified no regression: `app-shell.spec.ts` 6/6 and `command-center.spec.ts`
  7/7 still green after the change, plus `exhibit-detail.spec.ts` 4/4.
- **Impact:** This was BLOCKING 06-05's acceptance gate (the back-link click
  could not land). Fixed inline per the concurrency-note allowance to fix an
  out-of-scope file ONLY when it blocks the gate, keeping the fix minimal.
