---
phase: 04-pivota-assistant
plan: 05
subsystem: ui
tags: [assistant, citations, deep-link, slide-over, zustand, playwright, nextjs, react, ai-sdk]

# Dependency graph
requires:
  - phase: 04-pivota-assistant
    provides: "04-04 — useAssistantChat hook (messages/input/outcome/citationsOf/sendExample/retry/newConversation) + useAssistantStore (isPanelOpen/togglePanel/activeConversationId)"
  - phase: 04-pivota-assistant
    provides: "04-03 — the chat wire contract + the CAPTURED ai@6 UI-message stream frame (data-citations part) the E2E mock reproduces byte-shape-for-byte"
  - phase: 02-core-screens
    provides: "AppShell/Header/Sidebar; StatusBadge shared status words; /exhibit/[id] + Timeline deep-link target; Playwright role-injection pattern"
  - phase: 03-jury-package-discrepancy-detection
    provides: "Sidebar JuryPackageNavItem (must not regress)"
provides:
  - "The two assistant UI surfaces over ONE shared conversation: a global slide-over panel (Ask ✦ on every screen) + the full-page /assistant route"
  - "CitationPill — monospace bordered pill reading citation.exhibitId/eventId directly, deep-linking /exhibit/:exhibitId?event=:eventId (or top-of-timeline when eventId is null)"
  - "The three visually-unambiguous outcomes (grounded pills / neutral decline / distinct unavailable system-notice with Try-again)"
  - "Timeline ?event= deep-link: scroll-into-view + brief highlight, graceful top-of-timeline fallback"
  - "Header Ask ✦ activation + Sidebar Assistant link; e2e/assistant.spec.ts (7 deterministic, key-free tests)"
affects: [05-command-center]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AssistantThread is the single surface-agnostic renderer (variant panel|page) both surfaces mount — one hook, one store, one continuous thread"
    - "AssistantPanel mounted once in AppShell, always-mounted + translated off-screen when closed so the hook's message state survives close→reopen and route navigation"
    - "Citation link target travels WITH the citation object (exhibitId/eventId) — the pill never re-derives it from recordId/recordType"
    - "E2E determinism via page.route fulfilling the captured ai@6 UI-message SSE frame + x-vercel-ai-ui-message-stream:v1 header; citation payloads bound to REAL seed ids so #event-<id> exists"

key-files:
  created:
    - "src/components/assistant/CitationPill.tsx"
    - "src/components/assistant/MessageBubble.tsx"
    - "src/components/assistant/ExampleChips.tsx"
    - "src/components/assistant/AssistantThread.tsx"
    - "src/components/assistant/AssistantPanel.tsx"
    - "src/app/assistant/page.tsx"
    - "e2e/assistant.spec.ts"
  modified:
    - "src/components/shell/Header.tsx (Ask ✦ enabled → togglePanel)"
    - "src/components/shell/Sidebar.tsx (Assistant → /assistant live link)"
    - "src/components/shell/AppShell.tsx (mounts AssistantPanel globally)"
    - "src/app/exhibit/[id]/page.tsx (?event= scroll+highlight, Suspense for useSearchParams)"
    - "src/components/exhibit/Timeline.tsx (highlightEventId prop)"
    - "e2e/app-shell.spec.ts (updated stale Ask-disabled / Assistant-placeholder assertions)"

key-decisions:
  - "AssistantPanel mounted in AppShell (not per-route) so it opens over any screen and persists across navigation without unmounting the page underneath"
  - "Panel is always-mounted + translated off-screen when closed (not conditionally rendered) so the thread/hook state survives close→reopen"
  - "E2E chat mock uses path (a): the captured ai@6 UI-message stream frame with the SDK's own stream header, citations adapted to real seed ids — NOT the hook-state fallback"
  - "CitationPill reads exhibitId/eventId directly off the citation object; null eventId → /exhibit/:id (top-of-timeline), non-null → ?event=<id> (scroll+highlight)"

patterns-established:
  - "One shared AssistantThread for both surfaces keeps the two UIs purely presentational over the 04-04 hook"

# Metrics
duration: 10min
completed: 2026-10-07
---

# Phase 4 Plan 05: Assistant UI Surfaces, Citations & Deep-Link Summary

**Two assistant surfaces over one shared conversation — a global AppShell-mounted slide-over panel (Ask ✦ on every screen) and a full-page /assistant — with monospace citation pills that deep-link to the exact cited Timeline event (scroll + highlight), five auto-submitting example chips, and three visually-unambiguous outcomes (grounded / neutral decline / distinct unavailable notice), all proven by 7 deterministic key-free Playwright tests.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-10-07T16:45:48Z
- **Completed:** 2026-10-07T16:55:56Z
- **Tasks:** 3
- **Files modified:** 13 (7 created, 6 modified)

## Accomplishments
- **Two surfaces, one thread:** `AssistantThread` is a single surface-agnostic renderer (`variant="panel"|"page"`) that both the slide-over `AssistantPanel` and the full-page `/assistant` mount over the SAME `useAssistantChat` hook + `useAssistantStore` — switching surfaces keeps one continuous conversation.
- **Panel mounted globally in AppShell** (after `<main>`, inside the shell), always-mounted and translated off-screen when closed, so it opens OVER any screen and the conversation + scroll survive close→reopen and route navigation. A citation click inside the panel routes the screen underneath to `/exhibit/:id` while the panel STAYS OPEN.
- **CitationPill** renders the monospace bordered `[label · type · timestamp]` pill, reading `citation.exhibitId`/`citation.eventId` DIRECTLY off the object — never re-derived. Deep-links `/exhibit/:exhibitId?event=:eventId` for a non-null eventId, or `/exhibit/:exhibitId` (top-of-timeline) when null.
- **Three unambiguous outcomes:** grounded (answer + pills), decline (neutral bubble, `data-outcome="decline"`, NO pill, NOT an error), and unavailable (a distinct `role="alert"` warning system-notice with a Try-again that re-submits the preserved question).
- **Timeline `?event=` deep-link:** the exhibit page reads the param, scrolls `#event-<id>` into view and applies a ~400ms highlight, falling back to top-of-timeline (no error) when the event is absent for the role.
- **Nav activated without regression:** Header Ask ✦ enabled (`togglePanel`); Sidebar Assistant is now a live `/assistant` link; Phase 3's Jury Package link (`JuryPackageNavItem`) untouched; Command Center remains the sole placeholder.
- **7 deterministic, key-free E2E tests**, all green, plus the full existing suite (29 total E2E pass from a clean seed; 175 unit pass).

## Where the panel is mounted
`src/components/shell/AppShell.tsx` renders `<AssistantPanel />` once inside the shell `<div>` (after `<main>`). Because the root `layout.tsx` wraps every route in `AppShell`, the panel is global on `/case`, `/exhibit/:id`, `/jury-package`, and `/assistant`. The panel is always mounted (translated off-screen via a `translate-x-full` + `pointer-events-none` class when `isPanelOpen` is false) so `AssistantThread` — and therefore the hook's message state — stays alive across close/reopen and navigation.

## Deep-link highlight mechanism
`src/app/exhibit/[id]/page.tsx` reads `useSearchParams().get('event')` (inside a `Suspense` boundary, required by Next 16). A `useEffect` keyed on `[data, eventParam]` runs once history loads: it `getElementById('event-'+eventParam)`, `scrollIntoView({ behavior:'smooth', block:'center' })`, sets `highlightEventId`, and clears it after 400ms. `Timeline` accepts `highlightEventId?: string | null` and applies `border-amber-500 bg-amber-100` + `data-highlighted="true"` (with a `transition-colors duration-500` fade-out) to the matching `<li>`. If the element is absent (null-eventId citation, or sealed-masked for the role), no highlight is set — the page simply lands at top-of-timeline, never an error. The `event` param is only ever used to look up an element id + scroll; it is never interpolated into HTML or a navigation target (T-04-15/T-04-16).

## How CitationPill reads the link target
`CitationPill` takes a single `citation: Citation` prop and computes `href` as:
`citation.eventId ? /exhibit/${exhibitId}?event=${eventId} : /exhibit/${exhibitId}`.
It reads both fields straight off the citation object (surfaced identically on the fresh-stream and GET-replay paths by the 04-04 hook), never re-deriving from `recordId`/`recordType`. The null-eventId top-of-timeline fallback covers `DiscrepancyFlag` and `JuryPackageExhibit` citations (which have no single timeline anchor). `MessageBubble` passes each citation object straight through — one `<CitationPill>` per item, in order.

## Playwright chat-mock approach — and why
**Path (a): the CAPTURED stream frame.** `e2e/assistant.spec.ts` intercepts `POST /api/assistant/chat` with `page.route` and fulfills it with the exact ai@6 UI-message SSE frame shape 04-03 captured live (`start` → `text-delta` → `finish` → the custom `data-citations` part → `[DONE]`), set with the SDK's own `content-type: text/event-stream` + `x-vercel-ai-ui-message-stream: v1` headers so `useChat`'s `DefaultChatTransport` parses it exactly like the real route's output. This exercises the REAL UI stack (hook → store → thread → pills) end-to-end, deterministically, with no Anthropic key.

The documented hook-state fallback (path b) proved unnecessary — the raw-SSE mock parsed cleanly on the first integration run (the AI SDK transport does not strictly validate the stream header before parsing). Citation payloads are adapted to REAL seed `exhibitId`/`eventId` values resolved from the live API at runtime, so the grounded pill's `#event-<id>` scroll target genuinely exists; a `JuryPackageExhibit` citation with `eventId: null` exercises the top-of-timeline fallback. The UNAVAILABLE case fulfills with a real HTTP 503 so it rides the SDK error channel — never a decline.

## The three outcomes are visually distinct in the E2E assertions
- **Grounded:** asserts `citation-pill` visible, clicks the `ExhibitEvent` pill → URL `/exhibit/:id?event=:eventId`, `#event-<id>` `toBeInViewport()` + `data-highlighted="true"`, panel still open; then the null-eventId pill → `/exhibit/:id` with NO `?event=`, panel still open.
- **Decline:** asserts the bubble carries `data-outcome="decline"`, has ZERO `citation-pill`, and the `assistant-unavailable` notice is absent (count 0).
- **Unavailable:** asserts the `assistant-unavailable` `role="alert"` notice is visible with "temporarily unavailable", that NO `message-assistant` bubble rendered (it is not a decline), and that Try-again re-fires the POST with the SAME preserved question body.

## Task Commits

1. **Task 1: pill + bubble + chips + shared thread** - `7d23084` (feat)
2. **Task 2: panel + /assistant + shell activation + Timeline deep-link** - `4c470f1` (feat)
3. **Task 3: Playwright E2E + app-shell spec update** - `0a31022` (test)

**Plan metadata:** docs commit (this SUMMARY + STATE.md)

## Files Created/Modified
- `src/components/assistant/CitationPill.tsx` — monospace bordered deep-link pill (reads exhibitId/eventId from the citation).
- `src/components/assistant/MessageBubble.tsx` — user/assistant bubbles; grounded (pills) vs decline (neutral, no pill, not error).
- `src/components/assistant/ExampleChips.tsx` — the five named demo questions; onPick → auto-submit.
- `src/components/assistant/AssistantThread.tsx` — shared renderer: chips-when-empty, streaming indicator, distinct unavailable notice, input/send.
- `src/components/assistant/AssistantPanel.tsx` — global slide-over, always-mounted, stays open on pill click.
- `src/app/assistant/page.tsx` — full-page surface over the same thread.
- `src/components/shell/Header.tsx` — Ask ✦ enabled → togglePanel.
- `src/components/shell/Sidebar.tsx` — Assistant live link; Command Center sole placeholder.
- `src/components/shell/AppShell.tsx` — mounts AssistantPanel globally.
- `src/app/exhibit/[id]/page.tsx` — ?event= scroll+highlight; Suspense boundary.
- `src/components/exhibit/Timeline.tsx` — highlightEventId prop + transient highlight.
- `e2e/assistant.spec.ts` — 7 deterministic key-free tests.
- `e2e/app-shell.spec.ts` — updated stale assertions for the now-activated Ask ✦ + Assistant nav.

## Decisions Made
- Panel mounted in AppShell, always-mounted + translated off-screen (vs conditional render) so thread state survives — the only way to satisfy "panel persists across navigation + close/reopen".
- E2E mock path (a) chosen and confirmed stable; path (b) fallback not needed.
- CitationPill reads the link target from the citation object, never re-derives.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated stale e2e/app-shell.spec.ts assertions**
- **Found during:** Task 3 (full E2E regression)
- **Issue:** `e2e/app-shell.spec.ts` asserted the PRE-04-05 placeholder state — "Ask button disabled" and "Assistant as a disabled placeholder". Plan 04-05 intentionally activates both, so those two assertions failed against the correctly-changed behavior.
- **Fix:** Updated the two tests to assert the now-live behavior — Ask ✦ enabled + opens the panel (via `data-testid`, since the button's accessible name is now its aria-label), and Assistant as a live `/assistant` link with Command Center the sole remaining placeholder.
- **Files modified:** e2e/app-shell.spec.ts
- **Verification:** `npx playwright test e2e/app-shell.spec.ts` → 6 passed.
- **Committed in:** 0a31022 (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — stale test for intentionally-changed behavior). **Impact on plan:** None on scope; the update keeps the existing shell spec accurate to the activated nav. No new behavior added beyond the plan.

## Known Stubs
None found. (The only `grep` hit across the changed files — `placeholder="Ask about an exhibit…"` in AssistantThread — is a legitimate HTML input placeholder attribute, not a stub.)

## Deferred Issues
None.

## Issues Encountered
- **Shared-DB E2E ordering (pre-existing, not introduced here):** running the FULL suite immediately after a prior run left the jury-package finalize test and the two discrepancy-badge tests failing, because the finalize/acknowledge E2E mutates the shared Postgres and is not self-reseeding. Re-seeding (`npm run seed`) and re-running makes all 29 tests pass. This is the known shared-Postgres characteristic noted in STATE.md (01-07 / vitest `fileParallelism:false`), unrelated to this plan's changes — my changes pass cleanly from a clean seed.

## User Setup Required
None new (04-01 already documented `ANTHROPIC_API_KEY`). With a placeholder/unset key the chat route returns 503 and the UI renders the distinct "temporarily unavailable" notice; every other screen stays usable. The E2E suite needs NO key (chat is mocked).

## Next Phase Readiness
- **F7 fully delivered:** both surfaces, five chips, three unambiguous outcomes, clickable citations landing on the cited event, nav activated without regression — all demo-ready.
- **Phase 5 (Command Center)** can proceed; it may read assistant-adjacent data but has no blocker from this plan. Phase 4 is complete.

## Self-Check: PASSED
- Created files exist: CitationPill.tsx, MessageBubble.tsx, ExampleChips.tsx, AssistantThread.tsx, AssistantPanel.tsx, src/app/assistant/page.tsx, e2e/assistant.spec.ts — all FOUND.
- Commits exist: `7d23084`, `4c470f1`, `0a31022` — all in `git log`.
- Build check: `npx next build` → exit 0; `npx tsc --noEmit` → exit 0.
- Tests: `e2e/assistant.spec.ts` 7 passed; full E2E 29 passed (clean seed); `npx vitest run` 175 passed | 3 skipped.
- `## Known Stubs` present, no blocking entries.

---
*Phase: 04-pivota-assistant*
*Completed: 2026-10-07*
