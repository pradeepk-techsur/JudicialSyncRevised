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

#### Layout — Full-Page View

```
┌──────────────────────────────────────────────────────────────────┐
│ JudicialSync   [Case: 2026-CR-0142]      [Role: Admin ▾]  [Ask Pivota]│
├───────────────┬──────────────────────────────────────────────────┤
│ Command Ctr   │  Pivota Assistant                                │
│ Case          │  ┌────────────────────────────────────────────┐  │
│ Jury Pkg      │  │ Try asking:                                 │  │
│ ▸ Assistant   │  │ "What exhibits were admitted yesterday?"    │  │
│               │  │ "What objections remain unresolved?"        │  │
│               │  │ "Is P-3 in the jury package?"                │  │
│               │  │ "Who currently has custody of P-5?"          │  │
│               │  └────────────────────────────────────────────┘  │
│               │  ┌────────────────────────────────────────────┐  │
│               │  │  [conversation thread — same rendering as   │  │
│               │  │   the slide-over, full width, full height]  │  │
│               │  │                                              │  │
│               │  │  You: Who has custody of the sealed exhibit? │  │
│               │  │  Pivota: I don't have that information.      │  │
│               │  │   (no citation rendered — decline is correct)│  │
│               │  └────────────────────────────────────────────┘  │
│               │  Ask a question...                            ➤ │
└───────────────┴──────────────────────────────────────────────────┘
```

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
| Empty (no conversation yet) | Example-question prompts shown as tappable suggestion chips, generated against the case's actual seeded `exhibitLabel` values (e.g., "P-3," "P-5" — offering-party-prefixed, matching this case's real labeling scheme) rather than a hardcoded placeholder scheme | Lowers the barrier for a first-time or non-technical user — tap instead of type; tapping a chip is guaranteed to produce a grounded answer, never a decline about a nonexistent exhibit (US-15.2) |
| User message sent | Right-aligned message bubble, immediately visible | Instant local echo, no round-trip wait to see your own question |
| Assistant thinking/streaming | Left-aligned bubble with a typing indicator, then tokens appear incrementally as they stream | Feels "alive" within ~1s of submit — critical for the "live, on-the-bench" use case (US-7.1) |
| Grounded answer complete | Full answer text with one or more citation pills rendered inline, in the same color treatment used for status badges elsewhere in the app | Visual consistency with Case Workspace/Exhibit Detail reinforces "one source of truth" |
| Decline response | Calm, neutral-toned bubble: "I don't have that information about [subject]." No citation pill rendered. | Deliberately NOT styled as an error (no red, no warning icon) — this is correct, expected behavior per US-7.3, never minimized or apologized-for excessively |
| Role-scoped decline (sealed match exists but hidden) | Visually identical to a true "no such record" decline | Never hints that a hidden/sealed record exists (US-7.4) |
| Citation clicked | Panel/page navigates to Exhibit Detail View, scrolled to the cited event | Closes the trust loop in one tap |
| Assistant unavailable (LLM timeout) | Inline system message: "The assistant is temporarily unavailable — please try again." with a retry affordance | Distinct styling from a decline — this IS an error state, but recoverable and non-alarming |
| Same question asked twice | Each ask triggers a fresh tool re-query (not reused from history) — if the underlying record changed, the new answer reflects it | No visible "cache" indicator needed; answer is simply always current |

#### Interactive Elements

| Element | Type | Behavior |
|---------|------|----------|
| Text input | Single-line (expands for longer questions) | Natural language only — no required syntax, no command prefixes, no filter UI (core positioning requirement) |
| Send button / Enter key | Submit | Triggers `useChat` streaming request tagged with current role/session |
| Example-question chip (empty state) | Tappable suggestion | Pre-fills and can auto-submit the chip's question — zero-typing path for a first-time demo viewer |
| Citation pill | Link | Navigates to the cited record's home screen (Exhibit Detail View), event highlighted |
| "Ask Pivota" header button (global) | Toggle | Opens/closes the slide-over panel from any of the other four screens without losing that screen's state underneath |
| Conversation history scrollback | Passive | Full session history persists and is reviewable (supports PER-04's audit use case, US-7.2) |

**Tone and copy guidelines (reinforces conversational positioning):**
- Answers are written as a confident colleague would state them — "Exhibit 14 is currently Admitted" — never hedged ("it appears that...", "it looks like...") when grounded (FRD F07 §System Prompt Requirements).
- Declines are equally confident and equally brief — "I don't have that information about Exhibit 22's custody record" — never apologetic padding that could read as uncertainty about *everything else* the assistant says.
- No emoji, no exclamation points, no "Great question!" filler — the tone is that of a courtroom clerk, not a consumer chatbot, consistent with the legal/compliance audience (PER-04 evaluation lens).

**Example-chip label-source rule (US-15.2, fixes F15 regression):** example/suggested-question chips must reference exhibit labels that actually exist in the active case, sourced from (or validated at render time against) the same `getExhibits` service function the Case Workspace uses — never a hardcoded placeholder scheme (e.g., "Exhibit 14," "Exhibit 7") that doesn't correspond to any seeded exhibit. If the assistant is temporarily unavailable, chips still render from the last-known exhibit list rather than disappearing or reverting to placeholder text.
