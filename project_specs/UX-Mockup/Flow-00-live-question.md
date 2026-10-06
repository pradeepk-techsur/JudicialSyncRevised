## User Flows

### Flow 1: Live Question Mid-Proceeding

**Trigger:** A judge, attorney, or chambers staff member needs an immediate, cited answer to a natural-language question during live proceedings — without pausing the courtroom or delegating a manual lookup.
**User Stories:** US-7.1, US-7.2, US-7.3, US-7.4
**Journeys:** JRN-01.1, JRN-02.2 (Confirm via Assistant), JRN-03.1 (Confirm Status Before Referencing)

```
[Any screen — question arises mid-proceeding]
    │
    ▼
[Tap "Ask ✦" header button → slide-over chat panel opens]
    │
    ▼
[Type or speak natural-language question]
    │
    ▼
[Submit] ──▶ [Streaming response begins within ~1s]
    │
    ├── Tool call finds supporting record(s)
    │        │
    │        ▼
    │   [Answer streams in with inline citation(s)]
    │        │
    │        ▼
    │   [User taps citation ──▶ Exhibit Detail View opens with
    │    the exact cited event highlighted]
    │        │
    │        ▼
    │   [User closes panel, resumes proceedings — elapsed: seconds]
    │
    └── No tool call returns a relevant/visible record
             │
             ▼
        [Explicit decline: "I don't have that information about
         Exhibit 14's custody record."]
             │
             ▼
        [No citation rendered — decline is visually distinct from
         an answered response, never styled as an error]
```

**Steps:**
1. **Question arises.** No system touch yet — the user notices a discrepancy or needs a fact to act on (US-7.1).
2. **Open the assistant.** One tap/click on the ever-visible "Ask ✦" header button opens a slide-over chat panel over whatever screen is currently active — no navigation away, no lost context.
3. **Ask in plain language.** A single text input, placeholder text rotating through example questions ("Who has custody of Exhibit 7?", "What was admitted yesterday?"). No required syntax, no filter menus (reinforces PRD §Strategic Goals — natural-language-first).
4. **Response streams token-by-token** via the chat panel (US-7.1 — Vercel AI SDK `useChat`), so the user sees progress within ~1 second rather than a blank wait.
5. **Citation renders inline** with every factual sentence — format: `[Exhibit 14 · Status Change · 2026-10-05 14:32]` as a clickable pill immediately following the claim it supports (US-7.2).
6. **Tap a citation to jump to source.** Clicking a citation pill navigates to the Exhibit Detail View for that exhibit with the specific ledger event visually highlighted/scrolled-to — the "one-tap view supporting record" moment from JRN-01.1.
7. **Decline path (US-7.3):** If no tool call surfaces a supporting record — including when the only match is a sealed exhibit the user's role cannot see (US-7.4) — the assistant responds with an explicit, confidently-worded decline. This state is visually calm (not red/error-styled) since it is correct, expected behavior, not a failure.
8. **Close and resume.** The panel can be dismissed with no save/discard decision — it's a conversation, not a form; history persists for later audit review (US-7.2) but nothing requires the user to "finish" anything.

**Key UX Risk Guarded Against:** If opening or using the assistant ever requires more than typing a question (menus, required fields, login friction), the user reverts to delegating lookups to staff — this is the #1 abandonment risk identified in JRN-01.1. The design keeps the panel to a single input + send action at every state.
