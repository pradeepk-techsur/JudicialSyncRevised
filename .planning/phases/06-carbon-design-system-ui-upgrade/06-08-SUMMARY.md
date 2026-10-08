---
phase: 06-carbon-design-system-ui-upgrade
plan: 08
subsystem: ui
tags: [carbon, carbon-design-system, assistant, tag, inline-notification, inline-loading, text-input, css-modules, scss, playwright]

# Dependency graph
requires:
  - phase: 06-01
    provides: "Carbon Sass build pipeline (@use '@carbon/react' White theme) + @carbon/react components importable"
provides:
  - "Carbon-styled Pivota Assistant surfaces (slide-over panel + full-page /assistant) — the single highest-stakes demo screen (F7)"
  - "CitationPill as a clickable Carbon Tag wrapped in next/link (real <a> in tab order)"
  - "ExampleChips as clickable Carbon Tags (real <button>s)"
  - "AssistantThread input via Carbon TextInput + Button, typing via InlineLoading, unavailable via InlineNotification (role=alert) — structurally distinct error channel"
  - "MessageBubble restyled with Carbon theme tokens (custom bubble shape retained)"
affects: [06-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Carbon Tag wrapped in next/link to keep a real <a> in the DOM tab order (Y2-accessibility) — Tag alone renders a <div>"
    - "Clickable Carbon Tag (onClick) renders a real <button>; data-testid/onClick pass through to it"
    - "Custom chat-bubble shape kept as a CSS Module using Carbon THEME tokens (Carbon has no bubble primitive) — decline shares the grounded bubble class minus citations"
    - "Carbon InlineNotification (kind=warning, role=alert) as a structurally-distinct error channel vs the decline MessageBubble (T-06-09)"
    - "Per-component .module.scss importing @carbon/styles/scss/{theme,spacing,type} tokens; slide-over kept as a translate-on/off aside (NOT Carbon Modal — no focus trap)"

key-files:
  created:
    - "src/components/assistant/CitationPill.module.scss"
    - "src/components/assistant/ExampleChips.module.scss"
    - "src/components/assistant/MessageBubble.module.scss"
    - "src/components/assistant/AssistantThread.module.scss"
    - "src/components/assistant/AssistantPanel.module.scss"
    - "src/app/assistant/page.module.scss"
  modified:
    - "src/components/assistant/CitationPill.tsx"
    - "src/components/assistant/ExampleChips.tsx"
    - "src/components/assistant/MessageBubble.tsx"
    - "src/components/assistant/AssistantThread.tsx"
    - "src/components/assistant/AssistantPanel.tsx"
    - "src/app/assistant/page.tsx"

key-decisions:
  - "CitationPill = Carbon Tag INSIDE next/link (not Tag as={Link}): Tag renders a <div> by itself, so wrapping in <Link> is the composition that preserves both the Carbon pill visual AND keyboard reachability; all data-* attrs live on the <a>"
  - "ExampleChips = clickable Carbon Tag (outline/md) → real <button>, the closest Carbon visual match to the previous rounded chip"
  - "Unavailable state = Carbon InlineNotification with role='alert' override (Carbon default is role='status') — a different component from MessageBubble, preserving the error-never-a-decline guarantee structurally"
  - "Input kept single-line (Carbon TextInput) matching the pre-Carbon <input type='text'>: Enter submits via the form, Shift+Enter is a no-op as before — no multiline support existed and none was silently dropped"
  - "Slide-over kept as a CSS-Module translate aside, NOT Carbon Modal/ComposedModal (those trap focus + block background interaction, breaking 'citation click routes the screen underneath while panel stays open')"

patterns-established:
  - "Carbon Tag + next/link composition for keyboard-reachable, deep-linking pills"
  - "InlineNotification(role=alert) as the error channel, kept distinct from decline bubbles"

# Metrics
duration: 11min
completed: 2026-10-08
---

# Phase 6 Plan 08: Pivota Assistant Carbon Migration Summary

**The Pivota Assistant (F7) — the demo's single highest-stakes screen — migrated from Tailwind to Carbon: CitationPill as a keyboard-reachable Carbon Tag-in-Link, ExampleChips as clickable Carbon Tags, AssistantThread's input/typing/unavailable states via Carbon TextInput+Button / InlineLoading / InlineNotification, with all three outcome states (grounded / calm-decline / distinct-error) preserved structurally and the full 347-line assistant.spec.ts suite (7 tests) green.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-10-08T01:56:09Z
- **Completed:** 2026-10-08T02:07:38Z
- **Tasks:** 3
- **Files modified:** 12 (6 created .module.scss, 6 modified .tsx)

## Accomplishments
- Citation pills now render as clickable Carbon `Tag`s wrapped in `next/link` — a real `<a>` in the DOM tab order (Y2-accessibility), with `data-record-type`/`data-exhibit-id`/`data-event-id`, the `href` deep-link logic, and the `aria-label` format all preserved verbatim.
- The three valid assistant outcomes stay unambiguous after the migration: grounded (bubble + pills), calm decline (same bubble, zero pills, no red/warning), and "temporarily unavailable" as a **structurally separate** Carbon `InlineNotification` (role=alert) — never a restyled bubble (T-06-09 / criterion 5).
- Panel/page shared-thread continuity is unbroken: `AssistantPanel` keeps its exact Phase-4 architecture (translate-on/off aside, `/assistant` suppression, always-mounted-when-closed), restyled only via a Carbon-token CSS Module (not a Carbon Modal).
- The full `assistant.spec.ts` acceptance suite — 7 tests, the largest in the project — passes unchanged: panel toggle over a live screen, chip auto-submit, grounded pill deep-link into both ExhibitEvent (with `?event=` highlight) and JuryPackageExhibit (top-of-timeline fallback) while the panel stays open, neutral decline, unavailable≠decline + retry re-submit, sealed-role decline with no leak, and the full-page shared thread.

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate CitationPill and ExampleChips to Carbon Tag** - `c871bb6` (feat)
2. **Task 2: Migrate MessageBubble and AssistantThread to Carbon** - `7be9a64` (feat)
3. **Task 3: Migrate AssistantPanel slide-over and /assistant page to Carbon** - `9b78a78` (feat)

_Note: a sibling plan (06-03) committed a one-line fix `a57b9c2` to this plan's `MessageBubble.module.scss` — see Deviations._

## Files Created/Modified
- `src/components/assistant/CitationPill.tsx` + `.module.scss` - Carbon Tag (gray/sm) inside next/link; token-driven pill styling
- `src/components/assistant/ExampleChips.tsx` + `.module.scss` - five clickable Carbon Tags (outline/md); empty-state layout tokens
- `src/components/assistant/MessageBubble.tsx` + `.module.scss` - custom bubble shape kept; Carbon theme tokens; decline shares grounded class minus citations
- `src/components/assistant/AssistantThread.tsx` + `.module.scss` - Carbon TextInput+Button input, InlineLoading typing, InlineNotification(role=alert) unavailable; thread chrome tokens
- `src/components/assistant/AssistantPanel.tsx` + `.module.scss` - structural logic unchanged; backdrop + slide-over restyled with Carbon tokens (not a Modal)
- `src/app/assistant/page.tsx` + `.module.scss` - outer container moved to a Carbon-token CSS Module; same shared thread

## Decisions Made
See frontmatter `key-decisions`. In brief: Tag-in-Link for keyboard-reachable deep-linking pills; clickable Tag → `<button>` for chips; InlineNotification with an explicit `role='alert'` override (Carbon's default is `role='status'`) for the error channel; single-line TextInput preserving the exact Enter-submits contract; a translate-aside slide-over (never Carbon Modal) to keep the background screen interactive.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Undefined Carbon token `$button-primary` in MessageBubble.module.scss (fixed by sibling plan 06-03)**
- **Found during:** Task 3 verification (dev server failed to start) — the root cause was in Task 2's commit `7be9a64`.
- **Issue:** `MessageBubble.module.scss` used `background: $button-primary;` for the user bubble. `$button-primary` is a Carbon **component** token (`@carbon/styles/scss/components/button/tokens`), NOT exported by `@carbon/styles/scss/theme` (confirmed: a standalone `sass` compile of `@use '.../theme' as *; $button-primary` errors `Undefined variable`). The all-in-one `@use '@carbon/react'` global masked it in some compile contexts but it is a genuine latent bug.
- **Fix:** A concurrently-running sibling plan (06-03) hit the same broken HEAD and committed `a57b9c2 fix(06-03): replace undefined $button-primary token in MessageBubble SCSS` — it added `@use '@carbon/styles/scss/components/button/tokens' as *;` and switched the user-bubble background to `$interactive`. HEAD now compiles correctly.
- **Files modified:** src/components/assistant/MessageBubble.module.scss
- **Verification:** `npm run build` exits 0; the full `assistant.spec.ts` suite (7 tests) passes against the integrated HEAD; `npx tsc --noEmit` exits 0.
- **Committed in:** `a57b9c2` (by sibling plan 06-03, not by this plan's own task commits)

---

**Total deviations:** 1 auto-fixed (1 bug — a real undefined-token error introduced by this plan's Task 2 and repaired at HEAD by a sibling plan).
**Impact on plan:** The bug was latent (masked by the global Carbon import in some compile paths) but real; it is resolved at HEAD. All of this plan's intent — the six files migrated to Carbon with every preserved selector intact and the full suite green — is delivered. No scope creep.

## Known Stubs
None found. (The only `grep` hit — `placeholder="Ask about an exhibit…"` in AssistantThread.tsx — is the legitimate HTML input placeholder text, carried over verbatim from the pre-Carbon component, not a stub.)

## Issues Encountered
- **Concurrent-execution working-tree pollution (the STATE.md-recorded Phase 2 hazard, recurring).** This plan ran in parallel (Wave 2) with 06-02/06-03/06-07 on one shared working tree. During Task 3 verification the dev server initially failed with an RSC boundary error (`SideNavLink as={function LinkComponent}`) originating from 06-03's in-flight `src/components/shell/Sidebar.tsx` edit (a Server Component passing `Link` as the `as` prop) — entirely outside this plan's six files. It resolved once 06-03's `'use client'` fix landed in the tree. This plan staged ONLY its own six files on each commit; the out-of-scope shell/command-center changes were left for their owning plans. Recommend per-plan git worktrees or serialized intra-phase execution (already noted in STATE.md Blockers).
- `.planning/phases/06-carbon-design-system-ui-upgrade/deferred-items.md` already contained a 06-07 entry pointing at this plan's `7be9a64` as the broken commit — now resolved at HEAD per the Deviations section above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The Assistant screen (F7) is fully on Carbon and verified by its own 347-line suite. Together with the sibling Wave-2 plans it moves the phase toward 06-09 (final Tailwind/shadcn removal).
- 06-09 cleanup must still confirm no assistant file retains a Tailwind class before deleting `globals.css`/`postcss.config.mjs` — this plan's six files are already Tailwind-free (all styling via Carbon components + `.module.scss` token files).
- No blockers.

## Self-Check: PASSED
- Created files exist: CitationPill.module.scss, ExampleChips.module.scss, MessageBubble.module.scss, AssistantThread.module.scss, AssistantPanel.module.scss, src/app/assistant/page.module.scss ✓
- Modified files exist: all six .tsx files ✓
- Commits exist: c871bb6 (Task 1), 7be9a64 (Task 2), 9b78a78 (Task 3), plus sibling fix a57b9c2 ✓
- Plan-level build: `npm run build` → exit 0 ✓
- Type check: `npx tsc --noEmit` → exit 0 ✓
- Acceptance gate: `npx playwright test e2e/assistant.spec.ts --workers=1` → 7 passed ✓
- Known Stubs section present, no blocking stubs ✓

---
*Phase: 06-carbon-design-system-ui-upgrade*
*Completed: 2026-10-08*
