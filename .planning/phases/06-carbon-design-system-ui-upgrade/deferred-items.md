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
