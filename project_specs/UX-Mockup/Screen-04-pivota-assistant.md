### Screen: Pivota Assistant (Conversational UI)

**Purpose:** The universal, natural-language entry point to every fact in the system — the single feature the entire demo's success depends on (PRD F7). Available two ways: as a slide-over panel from any screen, and as a dedicated full-page view for sustained, longer review sessions (e.g., the administrator's evaluation walkthrough, JRN-04.1).
**User Stories:** US-7.1, US-7.2, US-7.3, US-7.4, US-15.2
**Journeys:** JRN-01.1, JRN-02.1, JRN-02.2, JRN-03.1, JRN-04.1 — the Assistant is the one touchpoint common to every journey in the product.
**Route:** `/assistant` (full-page) + global slide-over panel · **Nav:** Sidebar "Assistant" (full page) · Header "Ask Pivota" button (slide-over, present on every screen)

#### Layout — Slide-Over Panel (default, lightweight entry point)

```
┌──────────────────────────────────────────────────────┐
│ [any screen content, dimmed]  ┌─────────────────────┐│
│                                │ Pivota Assistant  ✕ ││
│                                ├─────────────────────┤│
│                                │                      ││
│                                │  You: Is P-3 in the  ││
│                                │  jury package?        ││
│                                │                      ││
│                                │  Pivota: Yes — P-3   ││
│                                │  is ADMITTED and     ││
│                                │  flagged as part of  ││
│                                │  the DRAFT jury       ││
│                                │  package.             ││
│                                │  [P-3·JuryPkgRow·     ││
│                                │   2:41 PM]  ⚠ also has││
│                                │  an open discrepancy: ││
│                                │  no custodian of      ││
│                                │  record.              ││
│                                │  [P-3·DiscFlag·       ││
│                                │   2:41 PM]            ││
│                                │                      ││
│                                ├─────────────────────┤│
│                                │ Ask a question...  ➤ ││
│                                └─────────────────────┘│
└────────────────────────────────────────────────────────┘
```

#### Layout — Full-Page View (reworked Phase 9, T-11: fills viewport height, input fixed at bottom)

**Supersedes the prior implied layout, where the conversation thread and input could float in an otherwise-empty page on a tall viewport.** As of Phase 9, the chat surface fills the full available viewport height — header at top, the conversation thread occupying all remaining vertical space (scrolling internally once it exceeds the viewport, never the page itself), and the text input **fixed at the bottom edge** of the viewport, always visible without scrolling down to find it (F07 PRD capability: "Chat surface fills the available viewport height with the input fixed at the bottom"):

```
┌──────────────────────────────────────────────────────────────────┐
│ JudicialSync   [Case: 2026-CR-0142]      [Role: Admin ▾]  [Ask Pivota]│
├───────────────┬──────────────────────────────────────────────────┤
│ Command Ctr   │  Pivota Assistant                                │
│ Case          │  ┌────────────────────────────────────────────┐  │
│ Jury Pkg      │  │ Try asking:                                 │  │
│ ▸ Assistant   │  │ "Why is P-7 flagged?"  "What happened to P-7?"│  │
│               │  │ (context-aware — shown when opened from an   │  │
│               │  │  exhibit page; otherwise the case-wide set)  │  │
│               │  └────────────────────────────────────────────┘  │
│               │  ┌────────────────────────────────────────────┐  │
│               │  │  [conversation thread — fills all remaining │  │
│               │  │   vertical space; scrolls internally, the   │↕ │
│               │  │   page itself never scrolls]                │  │
│               │  │                                              │  │
│               │  │  You: Who has custody of the sealed exhibit? │  │
│               │  │  Pivota: I don't have that information.      │  │
│               │  │   (no citation rendered — decline is correct)│  │
│               │  └────────────────────────────────────────────┘  │
│               │  ┌────────────────────────────────────────────┐  │
│               │  │ Ask a question...                        ➤ │  │ ← fixed to viewport bottom
│               │  └────────────────────────────────────────────┘  │
└───────────────┴──────────────────────────────────────────────────┘
```

**No API-key configuration control anywhere on this screen (new, Phase 9, T-11, F07):** this screen never renders a client-facing API-key input, link, or settings control of any kind in a production build — the Anthropic key remains server-side only, per the existing security architecture. If a developer-only API-key control is retained for non-production debugging, it is hidden outside non-production environments by an environment flag (the same gating pattern `Y0-patterns.md` §Pattern: RoleSwitcher Demo-Control Gating applies to the role switcher) and, even then, never stores a user-supplied key client-side (no `localStorage`/cookie/client state ever holds it). This is a hard requirement, not a UI preference — a judge-facing control implying they must supply or manage an API key would directly contradict the server-side-only key architecture the rest of the product relies on.

#### Information Hierarchy

| Priority | Content | Placement |
|----------|---------|-----------|
| Primary | The answer text itself | Largest, highest-contrast text in each assistant turn |
| Primary | Inline citation pills attached to each factual sentence | Immediately following the claim, visually distinct (bordered pill, monospace record ID) but not louder than the answer |
| Secondary | Example questions (empty-state only) | Shown only before the first message is sent — disappears once a conversation starts |
| Secondary | Conversation history (prior turns, same session) | Scrollable above the current turn |
| Tertiary | Timestamp of each message | Small, muted, right-aligned |

#### States

| State | Appearance | User Feedback |
|-------|------------|----------------|
| Empty (no conversation yet), case-wide context | Example-question prompts shown as tappable suggestion chips, generated against the case's actual seeded `exhibitLabel` values (e.g., "P-3," "P-5" — offering-party-prefixed, matching this case's real labeling scheme) rather than a hardcoded placeholder scheme | Lowers the barrier for a first-time or non-technical user — tap instead of type; tapping a chip is guaranteed to produce a grounded answer, never a decline about a nonexistent exhibit (US-15.2) |
| Empty (no conversation yet), exhibit context (new, Phase 9, T-11) | Example-question prompts reference the specific exhibit the assistant was opened from (e.g., "Why is P-7 flagged?" when that exhibit has an open discrepancy, "What happened to P-7?" generically) rather than the case-wide generic set | Opening the assistant from an exhibit page skips the "which exhibit do you mean" step entirely — the first thing offered is already about the exhibit the user was just looking at (F07 §Process step 1a) |
| User message sent | Right-aligned message bubble, immediately visible | Instant local echo, no round-trip wait to see your own question |
| Assistant thinking/streaming | Left-aligned bubble with a typing indicator, then tokens appear incrementally as they stream | Feels "alive" within ~1s of submit — critical for the "live, on-the-bench" use case (US-7.1) |
| Grounded answer complete | Full answer text with one or more citation pills rendered inline, in the same color treatment used for status badges elsewhere in the app | Visual consistency with Case Workspace/Exhibit Detail reinforces "one source of truth" |
| Decline response | Calm, neutral-toned bubble: "I don't have that information about [subject]." No citation pill rendered. | Deliberately NOT styled as an error (no red, no warning icon) — this is correct, expected behavior per US-7.3, never minimized or apologized-for excessively |
| Role-scoped decline (sealed match exists but hidden) | Visually identical to a true "no such record" decline | Never hints that a hidden/sealed record exists (US-7.4) |
| Citation clicked | Panel/page navigates to Exhibit Detail View, scrolled to the cited event | Closes the trust loop in one tap |
| Assistant unavailable (`503 ASSISTANT_UNAVAILABLE`) (reworked Phase 9, T-11) | A plain, calm inline message — "The assistant is temporarily unavailable — please try again." — paired with an explicit **"Retry"** button; the question the user had typed but not yet sent remains in the text input, untouched, rather than being cleared | Distinct styling from a decline — this IS an error state, recoverable and non-alarming; preserving the typed question means a user never has to retype a question they already composed just because the service blipped (F07 PRD capability) |
| Same question asked twice | Each ask triggers a fresh tool re-query (not reused from history) — if the underlying record changed, the new answer reflects it | No visible "cache" indicator needed; answer is simply always current |

#### Interactive Elements

| Element | Type | Behavior |
|---------|------|----------|
| Text input | Single-line (expands for longer questions) | Natural language only — no required syntax, no command prefixes, no filter UI (core positioning requirement) |
| Send button / Enter key | Submit | Triggers `useChat` streaming request tagged with current role/session |
| Example-question chip (empty state) | Tappable suggestion | Pre-fills and can auto-submit the chip's question — zero-typing path for a first-time demo viewer |
| Citation pill | Link | Navigates to the cited record's home screen (Exhibit Detail View), event highlighted |
| "Ask Pivota" header button (global) | Toggle | Opens/closes the slide-over panel from any of the other four screens without losing that screen's state underneath |
| "Ask Pivota about {exhibitLabel}" entry point (Exhibit Detail header, F10) | Deep-link | Opens the assistant with `contextExhibitId` carried as client-side route/URL state (never sent to or persisted by the chat request itself); drives the context-aware example chips above (T-11, F07 §Inputs) |
| "Retry" button (unavailable state, reworked Phase 9) | Action | Re-submits the same request; the previously-typed, not-yet-sent question in the input is untouched throughout (T-11) |
| Conversation history scrollback | Passive | Full session history persists and is reviewable (supports PER-04's audit use case, US-7.2) |

**Tone and copy guidelines (reinforces conversational positioning):**
- Answers are written as a confident colleague would state them — "Exhibit 14 is currently Admitted" — never hedged ("it appears that...", "it looks like...") when grounded (FRD F07 §System Prompt Requirements).
- Declines are equally confident and equally brief — "I don't have that information about Exhibit 22's custody record" — never apologetic padding that could read as uncertainty about *everything else* the assistant says.
- No emoji, no exclamation points, no "Great question!" filler — the tone is that of a courtroom clerk, not a consumer chatbot, consistent with the legal/compliance audience (PER-04 evaluation lens).

**Example-chip label-source rule (US-15.2, fixes F15 regression):** example/suggested-question chips must reference exhibit labels that actually exist in the active case, sourced from (or validated at render time against) the same `getExhibits` service function the Case Workspace uses — never a hardcoded placeholder scheme (e.g., "Exhibit 14," "Exhibit 7") that doesn't correspond to any seeded exhibit. If the assistant is temporarily unavailable, chips still render from the last-known exhibit list rather than disappearing or reverting to placeholder text.

**Context-aware example prompts (reworked Phase 9, T-11, F07 §Process step 1a):** **extends, rather than replaces, the rule above.** When the assistant panel is opened carrying a `contextExhibitId` (e.g., via F10's "Ask Pivota about {exhibitLabel}" header action), the chip set is generated referencing that specific exhibit's label and known state — "Why is P-7 flagged?" when the exhibit has an open discrepancy, "What happened to P-7?" generically otherwise — in place of the standard case-wide example set. This selection happens entirely client-side against already-loaded exhibit data (the same `getExhibits` result the case-wide rule already relies on); `contextExhibitId` is carried only as client-side route/URL state and is never sent to or persisted by `POST /api/assistant/chat`. If the supplied exhibit is sealed/ex-parte and the active role is unauthorized to see it, the panel silently falls back to the standard case-wide example set rather than generating a chip that would reveal the existence of a masked exhibit (F07 §Validation).
