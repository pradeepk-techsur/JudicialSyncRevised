---
phase: 09-ui-tickets-and-typography-standard
plan: 11
subsystem: ui
tags: [assistant, zustand, carbon, react-query, playwright, f7]

# Dependency graph
requires:
  - phase: 04-pivota-assistant
    provides: "useAssistantChat hook, AssistantThread/MessageBubble, assistantStore, 503/ASSISTANT_UNAVAILABLE error channel"
  - phase: 08-ui-redesign
    provides: "ExhibitHeader 'Ask Pivota about {label}' button, P-7 legacy-admit seed fixture with custody chain"
provides:
  - "assistantStore.scopedExhibitId state + openPanelForExhibit(exhibitId) action (shared exhibit-scoping mechanism)"
  - "Context-aware example prompts biased toward the in-context exhibit"
  - "Viewport-filling assistant layout with bottom-pinned input (flex-shrink:0 + min-height:0)"
  - "503 failure preserves the user's typed question IN the input field (not just internally)"
affects: ["T-08 (Ask Pivota pre-selected), any future assistant entry points"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-opening scope: scopedExhibitId set on open, cleared on close/newConversation/toggle-to-closed"
    - "Clear input on SUCCESS (onData) not at submit, so an error leaves the typed question editable"

key-files:
  created: []
  modified:
    - src/stores/assistantStore.ts
    - src/components/assistant/ExampleChips.tsx
    - src/components/exhibit/ExhibitHeader.tsx
    - src/hooks/useAssistantChat.ts
    - src/components/assistant/AssistantThread.module.scss
    - e2e/assistant.spec.ts

key-decisions:
  - "API-key control: investigated per T-11; none exists in the current codebase — zero code change (expected outcome of investigate-first)"
  - "Clear the assistant input on the success path (onData) rather than at submit time, so a 503 preserves the typed question in the field"
  - "Custody example prompt only biases to the scoped exhibit when it actually has a custodian; otherwise falls back so the chip stays answerable"

patterns-established:
  - "openPanelForExhibit as the single shared exhibit-scoping entry point for the assistant (built once, consumed by ExhibitHeader + ExampleChips)"

# Metrics
duration: 14min
completed: 2026-10-10
---

# Phase 9 Plan 11: Pivota Assistant Rework (T-11) Summary

**Exhibit-scoped assistant prompts via `openPanelForExhibit`, a 503 that keeps the user's typed question in the input, a bottom-pinned viewport-filling layout, and a confirmed-absent API-key control — all proven by 3 new Playwright tests (11/11 green).**

## Performance

- **Duration:** 14 min
- **Started:** 2026-10-10T17:28:14Z
- **Completed:** 2026-10-10T17:42:00Z
- **Tasks:** 3 (one confirm-only, zero-change)
- **Files modified:** 6

## Accomplishments
- **Shared exhibit-scoping mechanism:** `assistantStore.scopedExhibitId` + `openPanelForExhibit(exhibitId)` — the single place both T-11's context-aware prompts and T-08's "Ask Pivota about P-7 opens assistant pre-selected" depend on. Scope is per-opening: cleared on `closePanel`, `newConversation`, and `togglePanel`-to-closed so it never leaks into an unrelated later conversation.
- **Context-aware prompts:** `ExhibitHeader`'s "Ask Pivota about {label}" now opens the panel scoped to that exhibit; `ExampleChips` biases the three exhibit-specific prompts toward the scoped exhibit where answerable (the custody prompt falls back when the scoped exhibit has no custodian). Generic (unscoped) open is unchanged.
- **503 preserves the typed question:** the input is now cleared on the SUCCESS path (`onData`, which only fires on a completed stream) instead of at submit time, so an `ASSISTANT_UNAVAILABLE` 503 leaves the question in the field ready to edit or re-send — not merely preserved internally for the Retry button.
- **Viewport-filling layout:** `flex-shrink:0` on the header and input rows + `min-height:0` on the message area guarantee the chat list scrolls internally and the input stays pinned to the bottom of the panel (geometry-asserted in Playwright).
- **API-key control investigated and confirmed absent** (Task 1, zero change — see Deviations/Decisions).

## Task Commits

1. **Task 1: Investigate and resolve the API-key link** — no commit (zero code change; confirmed-absent, see below)
2. **Task 2: Exhibit-scoped context + pre-selected open** - `5198ab8` (feat)
3. **Task 3: 503 input preservation + bottom-pinned layout + e2e** - `9f9b2ba` (feat)

**Plan metadata:** (docs commit, this summary + STATE.md)

## Files Created/Modified
- `src/stores/assistantStore.ts` - added `scopedExhibitId` + `openPanelForExhibit`; clear scope on close/new/toggle-to-closed
- `src/components/assistant/ExampleChips.tsx` - reads `scopedExhibitId`, biases the 3 exhibit-specific prompts toward it where answerable
- `src/components/exhibit/ExhibitHeader.tsx` - "Ask Pivota about {label}" → `openPanelForExhibit(exhibit.id)` (was `togglePanel`)
- `src/hooks/useAssistantChat.ts` - clear input on success (`onData`) not at submit, so a 503 preserves the typed question
- `src/components/assistant/AssistantThread.module.scss` - `flex-shrink:0` header/input + `min-height:0` messages (bottom-pinned, internal scroll)
- `e2e/assistant.spec.ts` - 3 new tests (exhibit-scoped chips, input pinned at bottom, 503 preserves input value)

## Decisions Made
- **Task 1 — API-key control is confirmed absent, zero code change.** Grepping the entire client-facing surface (`src/components/assistant/*`, `src/app/assistant/*`, `src/hooks/useAssistantChat.ts`, and all of `src/components`/`src/app` for `apiKey`/`API_KEY`/`localStorage`/`sessionStorage`/`NEXT_PUBLIC`) found NO client-facing API-key control anywhere. The only `ANTHROPIC_API_KEY` references are `src/lib/assistantConfig.ts` (server-side only, explicitly documented as never in the client bundle / never a `NEXT_PUBLIC_` var) and `src/app/api/assistant/chat/route.test.ts` (a server route test string). No key is ever stored or sent client-side. Per the plan's explicit "investigate first, then decide" instruction, the ticket's premise (a visible API-key input on a judge-facing screen) does not apply to the current shipped build — this sub-requirement is already satisfied with zero change. This is the expected, correct outcome of investigate-first, reported rather than fabricating a control to then "fix".
- **Clear input on success, not at submit.** Moving `setInput('')` from `handleSubmit`/`sendExample` into the `onData` success handler is what makes the 503 preserve the typed question. The Send button is disabled while streaming, so a still-populated input in the submit→finish window cannot cause a double-send.
- **Custody prompt fallback.** "Who has custody of {X}?" biases to the scoped exhibit only when it has a custodian; otherwise it falls back to the first exhibit that does, keeping every chip genuinely answerable.

## Deviations from Plan

None - plan executed exactly as written. (Task 1 was a confirm-only investigation with the plan-anticipated zero-change outcome; Tasks 2 and 3 implemented their specified changes. The layout sub-task of Task 3 was partly verification-only as the plan allowed — the existing flex column was correct, and the additions [`flex-shrink:0`, `min-height:0`] hardened the bottom-pinned contract rather than rewrote it.)

---

**Total deviations:** 0 auto-fixed.
**Impact on plan:** None — all three tasks met their success criteria.

## Known Stubs

None found. (Two "placeholder" grep hits in `ExampleChips.tsx` are comments documenting the historical F15 fix — not incomplete implementation.)

## Issues Encountered
- **Dev-server lifecycle flake during Playwright (environmental, not a code defect).** Overlapping `next dev` instances fighting over port 3000 and first-run cold-compile races (a recurring Phase 7/8 hazard documented in STATE.md) caused `net::ERR_CONNECTION_REFUSED` / `waiting until "load"` timeouts on a cold run. Resolved by killing all stale servers, starting one clean server, and warming `/case`, `/exhibit/:id`, `/assistant` before running — all 11 tests then passed cleanly (37s). The DB (`project-db-1`) stayed healthy throughout.
- **Exhibit-scoping test needed a poll.** The Exhibit Detail page does not consume `useExhibitList`, so the chips bias to the scoped exhibit only once that query resolves (the chips re-render on arrival). Changed the assertion to `expect.poll`, which both passes and accurately reflects the real async behavior.

## Working-Tree Note
The shared working tree carried uncommitted sibling-plan changes (`src/services/attentionFeed.ts`, `src/app/layout.tsx`, `src/components/exhibit/DiscrepancyBanner.tsx`, new `src/lib/fonts.ts`, `src/hooks/useJuryPackagePreview.ts`, `.planning/fragments/phase-9-roadmap.yaml`). Only this plan's 6 files were staged individually per-task; sibling files were left untouched. `npm run build` EXIT 0 and `tsc --noEmit` EXIT 0 on the merged tree.

## Next Phase Readiness
- `openPanelForExhibit` is now the shared, tested entry point for any future scoped-assistant surface; T-08's "opens pre-selected" criterion is satisfied by this plan's ExhibitHeader change.
- No blockers.

---
*Phase: 09-ui-tickets-and-typography-standard*
*Completed: 2026-10-10*

## Self-Check: PASSED
- All 6 modified files + SUMMARY.md present on disk.
- Both task commits (5198ab8, 9f9b2ba) present in git history.
- Plan-level build: `npm run build` → EXIT 0; `tsc --noEmit` → EXIT 0.
- Playwright `e2e/assistant.spec.ts` → 11/11 passed.
- `## Known Stubs` present; no blocking stubs.
