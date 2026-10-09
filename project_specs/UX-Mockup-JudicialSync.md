# UX Mockup

**Project:** JudicialSync
**Generated:** 2026-10-06
**Last Updated:** 2026-10-08 (Phase 7: admission-rejection error, sealed/ex-parte jury package blocker, discrepancy-acknowledgment role/audit visibility, Case Workspace row clickability, assistant example labels, header indicator, activity-feed date+label fixes — US-12.1–US-12.2, US-13.1–US-13.3, US-14.1–US-14.3, US-15.1–US-15.5)
**Based on:** UserStories-JudicialSync.md, JOURNEYS-JudicialSync.md, PRD-JudicialSync.md, FRD-JudicialSync.md, PROJECT.md

---

## Overview

JudicialSync's UX exists to prove one thing: **Pivota is an assistant layered over how courtroom staff already work, not a new system to learn.** Every design decision below is tested against that positioning constraint from PROJECT.md: *"favor conversational/assistive UX over heavy data-entry forms on every screen."*

### Design Principles

1. **Ask, don't fill out forms.** Wherever a user might reach for a search bar, a filter panel, or a multi-field form, the Pivota Assistant is presented as the faster, equally-authoritative alternative. Structured controls (search bar, status badges, buttons) still exist — they are not removed — but the assistant is never visually subordinate to them. It is reachable from every screen in one motion (US-7.1, JRN-01.1).
2. **Citations are load-bearing UI, not a tooltip.** Because the entire demo's credibility rests on zero ungrounded claims (US-7.2, PRD §6 NFR "Trustworthiness over fluency"), every factual statement — on-screen or in chat — renders its supporting citation inline and visibly, never as hidden metadata requiring a hover or click to discover.
3. **Discrepancies are gates, not warnings to dismiss.** The jury package discrepancy gate (US-5.2, US-11.2) is the single highest-trust-building mechanic in the product (JOURNEYS §Shared Opportunities). It is designed as a hard, visually undeniable block — a disabled button with an explicit reason — never a dismissible toast.
4. **Glanceable over configurable.** The Trial Command Center (F8) has zero filters, zero settings, and zero data-entry controls by design (US-8.1) — it is read-only ambient awareness, reinforcing "assistant," not "dashboard to tune."
5. **Plain language over raw data.** Every ledger event (`STATUS_CHANGE`, `OBJECTION_RAISED`, etc.) is rendered as a human sentence ("Status changed from Offered to Admitted") — never as an exposed enum or JSON blob (US-10.1, FRD §PITFALLS.md UX Pitfalls).
6. **One record, five consistent views.** Status badges, discrepancy icons, and custodian names use identical visual conventions across all five screens (US-1.2) — a judge should never wonder if two screens disagree.

### Primary Personas Driving Design Decisions

| Persona | Role | Primary Need Shaping UX |
|---|---|---|
| Judge Elena Marsh | `JUDGE` | Zero-friction live answers; ambient awareness; one-tap verification before ruling |
| Courtroom Deputy Dana Reyes | `DEPUTY` | Fast logging that doesn't slow the floor; instant lookups; confident jury package finalization |
| Attorney Marcus Webb | `ATTORNEY` | Independent, staff-free verification of status, objections, custody, and jury package integrity |
| Administrator Priya Nair | `ADMIN` | Cross-screen consistency, auditable citations, visible discrepancy-catching, low adoption burden |
| Clerk of Court | `CLERK` | Shares Dana's jury-package and discrepancy-acknowledgment responsibilities |
| Chambers Staff | `CHAMBERS_STAFF` | Drill-through research support for the judge |

### App Shell

All five screens live inside one persistent shell:

```
┌──────────────────────────────────────────────────────────────────┐
│ JudicialSync   [Case: 2026-CR-0142]  [⚠ 1]  [Role: Judge ▾] [Ask ✦]│ ← global header
├───────────────┬──────────────────────────────────────────────────┤
│ ▸ Command Ctr │                                                  │
│   Case        │              [ Active Screen Content ]          │
│   Jury Pkg    │                                                  │
│   Assistant   │                                                  │
│               │                                                  │
└───────────────┴──────────────────────────────────────────────────┘
```

- **Sidebar** (persistent, 4 items): Command Center, Case Workspace, Jury Package, Pivota Assistant. This is the entire navigable surface — intentionally small, reinforcing low adoption burden (JTBD-04.4).
- **"Ask ✦" header button**: opens the Pivota Assistant as a slide-over panel from *any* screen without navigating away — the single most important affordance in the product, since F7 is the universal touchpoint across every journey (JOURNEYS §Convergence Points).
- **Header discrepancy-count indicator ("`[⚠ 1]`")**: resolves a Phase 7 usability defect (US-15.3) in which a numeric element rendered near the role selector carried no label or explanation of any kind. It now shows the case-wide count of `OPEN` discrepancy flags, paired with a visible `aria-label="N open discrepancies"` (readable without a hover/tooltip) and, when tapped, navigates to the Command Center's Discrepancies panel. If the count is zero, the element is omitted entirely rather than showing a bare, unexplained "0." This treatment is identical on every screen (Command Center, Case Workspace, Exhibit Detail, Jury Package Workspace) since it lives in the one shared header component — see `Y0-patterns.md` §Pattern: Labeled Header Indicator. "Present and unexplained" is not an acceptable end state for any header element.
- **Role switcher**: demo-only affordance (no production auth per PROJECT.md scope) letting the presenter switch personas live to show role-scoped visibility (US-7.4, US-10.2).
- **Exhibit Detail View has no sidebar entry** — it is only reached by drilling into a specific exhibit (row click, activity item, citation link), never browsed to directly, consistent with it being a "zoom-in," not a top-level destination.

---

## Navigation Map

| Screen | Route | Reached from | Nav element |
|--------|-------|--------------|-------------|
| Trial Command Center | `/command-center` | App shell (default landing after role selection) | Sidebar: "Command Center" |
| Case Workspace | `/case` | App shell | Sidebar: "Case Workspace" |
| Exhibit Detail View | `/exhibit/:id` | Case Workspace (row click); Command Center (Recent Activity / Discrepancy item click); Jury Package Workspace (row click); Pivota Assistant (citation link click) | Row click / citation link |
| Jury Package Workspace | `/jury-package` | App shell | Sidebar: "Jury Package" |
| Pivota Assistant | `/assistant` (full-page view) + global slide-over panel on every screen | App shell (persistent) | Sidebar: "Assistant" (full page) · Header: "Ask ✦" button (slide-over, available everywhere) |

**Invariant check — no orphan screens:** Command Center, Case Workspace, Jury Package, and Assistant all have direct sidebar entries from the app shell. Exhibit Detail View has no sidebar entry by design, but is reachable from three parent screens (Case Workspace, Command Center, Jury Package) plus the Assistant's citation links — all of which themselves trace to the shell. No screen requires typing a URL.

---

## Scope Note on This Document

This mockup covers the 5 demo screens named in PROJECT.md: **Trial Command Center (F8), Case Workspace (F9), Exhibit Detail View (F10), Jury Package Workspace (F11), and Pivota Assistant (F7)**. Discrepancy acknowledgment (F6) and status/objection/custody recording (F1–F3) are presented as *in-context actions within* these five screens rather than as separate screens, consistent with the FRD's screen inventory (F0–F6 are data/logic layers, F7–F11 are the only UI screens).
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
3. **Ask in plain language.** A single text input, placeholder text rotating through example questions sourced from the case's actual seeded exhibit labels ("Who currently has custody of P-5?", "What was admitted yesterday?") — never a hardcoded placeholder scheme that doesn't match a real exhibit (US-15.2). No required syntax, no filter menus (reinforces PRD §Strategic Goals — natural-language-first).
4. **Response streams token-by-token** via the chat panel (US-7.1 — Vercel AI SDK `useChat`), so the user sees progress within ~1 second rather than a blank wait.
5. **Citation renders inline** with every factual sentence — format: `[Exhibit 14 · Status Change · 2026-10-05 14:32]` as a clickable pill immediately following the claim it supports (US-7.2).
6. **Tap a citation to jump to source.** Clicking a citation pill navigates to the Exhibit Detail View for that exhibit with the specific ledger event visually highlighted/scrolled-to — the "one-tap view supporting record" moment from JRN-01.1.
7. **Decline path (US-7.3):** If no tool call surfaces a supporting record — including when the only match is a sealed exhibit the user's role cannot see (US-7.4) — the assistant responds with an explicit, confidently-worded decline. This state is visually calm (not red/error-styled) since it is correct, expected behavior, not a failure.
8. **Close and resume.** The panel can be dismissed with no save/discard decision — it's a conversation, not a form; history persists for later audit review (US-7.2) but nothing requires the user to "finish" anything.

**Key UX Risk Guarded Against:** If opening or using the assistant ever requires more than typing a question (menus, required fields, login friction), the user reverts to delegating lookups to staff — this is the #1 abandonment risk identified in JRN-01.1. The design keeps the panel to a single input + send action at every state.
### Flow 2: Core Demo Scenario — A Trial Day of Logging, Live Questions, and Search

**Trigger:** A courtroom deputy runs the floor of a live, multi-exhibit trial, logging events as they happen while fielding live questions from the bench and attorneys.
**User Stories:** US-1.1, US-2.1, US-2.2, US-3.1, US-3.2, US-4.1, US-4.2
**Journey:** JRN-02.1 (Core Demo Scenario — see JOURNEYS-JudicialSync.md for full stage table)

```
[Case Workspace — deputy's home screen during proceedings]
    │
    ▼
[Exhibit marked on the floor]
    │
    ▼
[Deputy opens exhibit row → inline "Record Status" action]
    │
    ▼
[Select next status from allowed-transitions list only —
 e.g., from OFFERED: Objected / Admitted / Withdrawn]
    │
    ├── Valid transition ──▶ [Row updates instantly; status badge
    │                         changes across all open screens within
    │                         3–5s poll interval]
    │
    └── Invalid/terminal/stale ──▶ [Inline error, action not applied,
                                    current true status re-displayed]
    │
    ▼
[Bench asks live question — handled via Flow 1 (Pivota Assistant),
 NOT by interrupting the deputy]
    │
    ▼
[Attorney asks "who has custody of Exhibit 7?"]
    │
    ▼
[Deputy clicks exhibit row → "Current Custodian" shown inline,
 no drill-in required] ──▶ [Answer given in seconds]
    │
    ▼
[Bench requests exhibit "the one Smith testified about"]
    │
    ▼
[Deputy types into Case Workspace search bar: witness=Smith]
 (or asks the assistant the same question — Flow 1)
    │
    ▼
[Combinable filters narrow list instantly] ──▶ [Exhibit found,
 referenced in seconds, no stumble]
```

**Steps:**
1. **Log a status transition in place.** From the Case Workspace exhibit row (or Exhibit Detail View), the deputy opens a lightweight inline action — not a modal form — offering only the statuses that are valid next transitions per the admission-lifecycle state machine (US-1.1). Invalid states are never shown as selectable options, removing the need for client-side error-message design for most cases.
2. **One log updates everywhere.** The moment a transition is recorded, `ExhibitCurrentState` updates and every open screen (Command Center, Case Workspace, Exhibit Detail, Jury Package, Assistant) reflects it on its next poll cycle (3–5s) — this is the "single log action updates every screen" promise from JRN-02.1, and it is the antidote to the spreadsheet/sticky-note habit the product replaces.
3. **Log an objection.** Similarly inline: a compact "Raise Objection" action captures `objectingParty` (defaulted from role context where possible) and `grounds` (free text) — two fields, not a form wizard (US-2.1).
4. **Record a ruling.** The judge's ruling (Sustained/Overruled/Reserved) is recorded against the specific open objection thread — if an exhibit has multiple concurrent objections, each is listed as its own resolvable row, never collapsed (US-2.2).
5. **Custody questions answered inline.** "Current Custodian" is a persistent field on both the Case Workspace row and the Exhibit Detail header — no separate custody screen to navigate to for a quick lookup (US-3.2).
6. **Log a custody transfer.** A compact "Transfer Custody" action requires selecting the receiving user from an active-user list; the system auto-validates the `from` side against current state so the deputy cannot accidentally break the chain (US-3.1).
7. **Search mid-testimony.** The Case Workspace search bar accepts combinable criteria (keyword, status, witness, date) in one row of controls — chip-style active filters so the deputy can see and clear exactly what's applied without re-opening a filter panel (US-4.1).
8. **Same question, assistant or search bar — same answer.** Asking the assistant "admitted exhibits from witness Smith" (US-4.2) returns the identical result set, in the identical order, as typing the equivalent filters into the search bar — reinforcing single-source-of-truth trust.

**Key UX Risk Guarded Against:** If logging a status change, objection, or custody transfer ever requires more clicks than the paper process it replaces, the deputy reverts to sticky notes under time pressure (JRN-02.1 Risk of Abandonment). Every logging action here is designed as a 2-click maximum: open row → select outcome.
### Flow 3: Reconstructing an Exhibit's Full History

**Trigger:** A prior ruling or event on an exhibit is challenged or questioned days later; someone needs the complete, trustworthy story assembled instantly.
**User Stories:** US-10.1, US-3.3, US-7.1
**Journey:** JRN-02.2

```
[Request arrives — "What happened to Exhibit 14?"]
    │
    ▼
[Navigate to Exhibit Detail View]
   (via Case Workspace row click, Command Center activity item,
    Jury Package row click, or Assistant citation)
    │
    ▼
[Header loads instantly: current status, current custodian,
 active discrepancy flags — the answer's headline, above the fold]
    │
    ▼
[Scroll full chronological timeline — every ledger event,
 oldest-first, in plain language]
    │
    ▼
[Optional: cross-check via "Ask ✦" — "What happened to Exhibit 14?"]
    │
    ▼
[Assistant's answer and the timeline agree exactly —
 same events, same citations]
    │
    ▼
[Report back verbally with full confidence]
```

**Steps:**
1. **Arrive at the exhibit.** Whether from a Case Workspace row click, a Command Center flagged item, a Jury Package row, or an assistant citation pill, the destination is always the same Exhibit Detail View — one canonical "full story" surface (US-9.2, US-10.1).
2. **Headline facts load above the fold.** Current status, current custodian, and any active discrepancy flags render in a prominent header block before the timeline even renders — answering the most common question ("where does this stand right now") without scrolling.
3. **Timeline renders complete, in order.** Every `ExhibitEvent` — status changes, objections raised, rulings recorded, custody transfers — appears as one chronological entry, translated to plain language ("Status changed from Offered to Admitted," not raw enum values) (US-10.1). No "show more" pagination — FRD explicitly requires complete history, not "recent N events."
4. **Each entry is self-contained.** Actor name, timestamp, and a one-line summary — scannable in seconds, matching exactly what the assistant's `getExhibitHistory` tool would state (US-10.1, US-3.3).
5. **Independent cross-check available.** The user can open the assistant and ask the same question as a trust-verification step — the screen and the assistant are guaranteed to agree because both read the identical service-layer function (JRN-02.2 Delight Opportunity).
6. **Sealed exhibit behavior.** If the exhibit is sealed and the viewing role is unauthorized, this entire flow dead-ends at a plain "exhibit not found" — visually and textually identical to a truly nonexistent exhibit ID, never revealing that sealed material exists (US-10.2).

**Key UX Risk Guarded Against:** If the timeline were ever incomplete or required cross-referencing a second screen, the deputy/judge would revert to manually reconstructing fragments — undermining the entire value proposition (JRN-02.2 Risk of Abandonment). Completeness and single-screen sufficiency are non-negotiable design constraints here.
### Flow 4: Assembling, Verifying, and Accepting the Jury Package

**Trigger:** At the close of evidence, the deputy/clerk must assemble a jury package that is provably free of discrepancies; the judge must accept it with confidence; an attorney may independently verify it first.
**User Stories:** US-5.1, US-5.2, US-6.1, US-6.2, US-6.3, US-11.1, US-11.2
**Journeys:** JRN-02.1 (Assemble the Jury Package), JRN-01.2 (Jury Package Presented → Accept), JRN-03.1 (Verify Jury Package Integrity)

```
[Deputy/Clerk navigates to Jury Package Workspace]
    │
    ▼
[System auto-computes candidate set: ADMITTED exhibits only,
 discrepancy-evaluated before the draft is even shown]
    │
    ▼
[Draft package renders — each row: CLEAN or FLAGGED]
    │
    ├── FLAGGED rows show the specific rule that fired
    │   (e.g., "Admitted, no custodian of record")
    │        │
    │        ├── Fix at source ──▶ [Navigate to Exhibit Detail,
    │        │                      record the missing custody
    │        │                      transfer] ──▶ [Flag auto-clears
    │        │                      on next poll, row becomes CLEAN]
    │        │
    │        └── Acknowledge ──▶ [Enter justification, ≤500 chars]
    │                              ──▶ [Flag badge changes to
    │                              "Acknowledged" — remains visible,
    │                              never hidden]
    │
    ▼
["Finalize Jury Package" button —
 DISABLED while any row is FLAGGED + OPEN]
    │
    ▼
[All rows CLEAN or ACKNOWLEDGED] ──▶ [Button becomes enabled]
    │
    ▼
[Deputy clicks Finalize] ──▶ [Server re-validates fresh —
 not from cached draft state]
    │
    ├── Still has an OPEN discrepancy (stale client) ──▶
    │     [Rejected, specific blocking exhibits listed inline,
    │      button re-disables]
    │
    └── Zero open discrepancies ──▶ [Package → FINALIZED,
          screen becomes read-only, export-ready]
    │
    ▼
[Judge reviews finalized package — "zero discrepancies" confirmation
 stamped prominently] ──▶ [Accepts with confidence]
    │
    ▼
[Attorney independently reviews same finalized screen, or asks
 assistant "Is Exhibit 14 in the jury package?" — same answer either way]
```

**Steps:**
1. **No manual assembly step.** The deputy does not build a list — the system computes jury-eligible candidates automatically from `ExhibitCurrentState` (`ADMITTED` only) and runs discrepancy detection *before* the draft is ever displayed (US-5.1). This eliminates the "slow, manual cross-referencing against three sources" pain point named in every relevant journey.
2. **Flags are specific, not generic.** Each flagged row states the exact rule that fired in plain language — "Admitted, no custodian of record" or "Unresolved objection on this exhibit" — never a bare "⚠ issue" requiring a click to understand (US-6.1, US-6.2).
3. **Two resolution paths, both visible from the row.** (a) Navigate to the exhibit to fix the underlying condition (e.g., log the missing custody transfer), after which the flag auto-resolves on the next poll with zero extra action; or (b) acknowledge the risk directly with a required justification field, which is recorded as an immutable ledger event and remains permanently visible as "Acknowledged" — never silently cleared (US-6.3).
4. **The Finalize control is physically disabled, not just error-prone.** While ANY included exhibit has an `OPEN` + `FLAGGED` discrepancy, the "Finalize Jury Package" button renders disabled with a tooltip/caption explaining why ("2 exhibits have unresolved discrepancies") — this is the literal "cannot ship a discrepant package by mistake" requirement (US-11.2).
5. **Server re-validates at the moment of truth.** Even if the button were somehow enabled against stale client state, the finalize action re-runs discrepancy evaluation fresh server-side and blocks with a specific list of blocking exhibits if anything reopened (US-5.2).
6. **Finalized state is visually and functionally different.** Once `FINALIZED`, the screen switches to a read-only, print/export-friendly presentation — all acknowledge/resolve/remove controls disappear entirely, not just disable (US-11.2).
7. **The judge's acceptance moment is explicit.** The finalized view carries an unmissable "Zero discrepancies — package clean" confirmation banner, so accepting the package is a fast, confident action rather than requiring independent re-verification (JRN-01.2).
8. **The attorney's verification path is identical, not separate.** Marcus doesn't need a special "audit view" — the same Jury Package Workspace (view-only for his role) and the same assistant answer serve his independent-verification need (JRN-03.1).

**Key UX Risk Guarded Against:** This flow is identified in JOURNEYS as the single highest-stakes moment in the entire product — a discrepancy surfaced incorrectly here breaks trust for three personas simultaneously (deputy, judge, attorney). The hard-disabled button plus mandatory server re-validation is a deliberate belt-and-suspenders design, not redundant engineering.
## Screen Designs

### Screen: Trial Command Center

**Purpose:** A zero-configuration, read-only ambient view of trial activity, unresolved objections, and discrepancies — designed for a glance during a recess, not a dashboard to tune.
**User Stories:** US-8.1, US-8.2, US-15.4, US-15.5
**Journey:** JRN-01.2 (Glance During Recess, Spot a Flag)
**Route:** `/command-center` · **Nav:** Sidebar "Command Center" (default landing screen)

#### Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ JudicialSync   [Case: 2026-CR-0142]      [Role: Judge ▾] [Ask ✦] │
├───────────────┬──────────────────────────────────────────────────┤
│ ▸ Command Ctr │  Trial Command Center            🕐 updated 3s ago│
│   Case        │  ┌────────────────────────────────────────────┐  │
│   Jury Pkg    │  │ RECENT ACTIVITY (12 today)                  │  │
│   Assistant   │  │ ──────────────────────────────────────────  │  │
│               │  │ ● Exhibit 14 — Admitted                     │  │
│               │  │   Oct 8, 2026, 2:41 PM                      │  │
│               │  │ ● Exhibit 7  — Custody transferred          │  │
│               │  │   Oct 8, 2026, 2:38 PM                      │  │
│               │  │ ● Exhibit 9  — Objection raised              │  │
│               │  │   Oct 8, 2026, 2:15 PM                      │  │
│               │  │ ● Exhibit 3  — MARKED → OFFERED              │  │
│               │  │   Oct 8, 2026, 1:58 PM                      │  │
│               │  │ ... (newest first, scrollable)              │  │
│               │  └────────────────────────────────────────────┘  │
│               │  ┌───────────────────────┬──────────────────────┐│
│               │  │ UNRESOLVED OBJECTIONS │ DISCREPANCIES        ││
│               │  │ (2)                   │ (1) ⚠                ││
│               │  │ ──────────────────────│──────────────────────││
│               │  │ Exhibit 9 — hearsay   │ ⚠ Exhibit 14         ││
│               │  │   raised 2:15 PM      │   Admitted, no       ││
│               │  │ Exhibit 12 — relevance│   custodian on record││
│               │  │   raised 11:40 AM     │                      ││
│               │  └───────────────────────┴──────────────────────┘│
└───────────────┴──────────────────────────────────────────────────┘
```

#### Information Hierarchy

| Priority | Content | Placement |
|----------|---------|-----------|
| Primary | Discrepancies panel (count + list) — the highest-risk signal | Right column, visually distinct (warning color), never below the fold |
| Primary | Recent Activity feed — the ambient pulse of the trial | Full-width top panel, newest-first |
| Primary | Exhibit label + full date-and-time on every Recent Activity row (incl. raw status-transition rows) | Same row, never summarized away (US-15.4, US-15.5) |
| Secondary | Unresolved Objections panel | Left of the two-column lower row |
| Tertiary | "Updated Xs ago" freshness indicator | Top-right corner, small type |

#### States

| State | Appearance | User Feedback |
|-------|------------|----------------|
| Default (activity exists) | Three populated panels as above | None needed — ambient |
| Loading (initial load) | Skeleton rows in all three panels | Subtle shimmer, no spinner text |
| Empty — no activity yet | Recent Activity panel shows "No activity recorded yet today" | Calm, non-alarming copy |
| Empty — no unresolved objections | "No unresolved objections — all clear" with a quiet checkmark | Reinforces confidence, not silence-as-ambiguity |
| Discrepancy present | Discrepancies panel header turns warning-amber, count badge visible from across the room | Visually "impossible to scroll past unnoticed" per US-8.1 |
| Live update arrives | New row fades in at top of Recent Activity (no jarring re-sort/flash) | No toast needed — ambient by design |
| Recent Activity row rendering (any event type) | Every row shows both date and time of `recordedAt` ("Oct 8, 2026, 2:41 PM," never time-only) and the exhibit's label, including rows describing a raw `STATUS_CHANGE` transition ("Exhibit 3 — MARKED → OFFERED") | Two events on different days are never visually indistinguishable; no row is ever unattributed to an exhibit (US-15.4, US-15.5) — see `Y0-patterns.md` §Pattern: Activity Feed Row Format |
| Load failure | Full-panel inline error: "Unable to load trial activity — please retry" with a retry button | Non-blocking — other panels still attempt to load independently |

#### Interactive Elements

| Element | Type | Behavior |
|---------|------|----------|
| Recent Activity row | Link-through | Navigates to that exhibit's Exhibit Detail View (US-8.2), landing scrolled to the relevant event |
| Unresolved Objection row | Link-through | Navigates to Exhibit Detail View, objection section highlighted |
| Discrepancy row | Link-through | Navigates to Exhibit Detail View (or directly to the flagged row in Jury Package Workspace if already drafted) |
| "Ask ✦" header button | Global | Opens Pivota Assistant slide-over without leaving this screen |

**Explicitly absent by design (US-8.1):** no filters, no date pickers, no "configure this view" settings, no data-entry controls of any kind. This screen only links through — it never writes to the ledger.

**Full timestamp + label rule (F15):** every Recent Activity row renders both the date and the time of `recordedAt` — never time-only — and always includes the event's exhibit label as part of the rendered summary, with no exception for raw `STATUS_CHANGE` rows (US-15.4, US-15.5). This uses the `exhibitLabel` field already present in the activity API response — a rendering fix, not a data-contract change.
### Screen: Case Workspace

**Purpose:** The primary browsing and searching surface for the full exhibit set — one trustworthy list instead of a spreadsheet.
**User Stories:** US-9.1, US-9.2, US-4.1, US-1.1, US-1.2, US-3.1, US-3.2, US-2.1, US-15.1, US-12.1, US-12.2
**Journey:** JRN-02.1 (Log Exhibit Activity, Answer a Custody Question, Search Mid-Testimony)
**Route:** `/case` · **Nav:** Sidebar "Case Workspace"

#### Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ JudicialSync   [Case: 2026-CR-0142]      [Role: Deputy ▾] [Ask ✦]│
├───────────────┬──────────────────────────────────────────────────┤
│ Command Ctr   │  Case Workspace                                  │
│ ▸ Case        │  ┌────────────────────────────────────────────┐  │
│ Jury Pkg      │  │ 🔍 Search exhibits...   [Status ▾][Witness ▾]│  │
│ Assistant     │  │     Active filters: witness=Smith  [× clear]│  │
│               │  └────────────────────────────────────────────┘  │
│               │  ┌────────────────────────────────────────────┐  │
│               │  │ Label  Desc        Party  Witness Status  Custodian  ⚑│
│               │  │ Ex. 14 Blood sample PROS  Smith  ●ADMITTED –        ⚠│
│               │  │ Ex. 7  Phone record DEF   —      ●OFFERED  D.Reyes   │
│               │  │ Ex. 9  Email thread PROS  Lee     ●OBJECTED C.Chen   │
│               │  │ Ex. 3  Contract     PLAIN —      ●MARKED  –        │
│               │  │ ... (polling live, 3–5s)                     │  │
│               │  └────────────────────────────────────────────┘  │
└───────────────┴──────────────────────────────────────────────────┘
   entire row (hover: highlight + cursor:pointer) ──▶ Exhibit Detail View (/exhibit/:id)
```

**Row clickability fix (US-15.1):** the full row container — not a nested link, icon, or label span — is the click target, across its entire width, for every row regardless of discrepancy-flag state. A visible hover affordance (row background highlight, `cursor: pointer`) confirms this before the click. The row is keyboard-focusable; `Enter`/`Space` navigates identically to a click. Inline row-level actions (Record Status, Transfer Custody, Raise Objection, the ⚠ discrepancy icon) stop click-propagation so operating them never also triggers row navigation — see `Y0-patterns.md` §Pattern: Fully Clickable List Row.

#### Information Hierarchy

| Priority | Content | Placement |
|----------|---------|-----------|
| Primary | Exhibit label + current status badge | Leftmost columns, largest visual weight |
| Primary | Discrepancy indicator (⚠) | Rightmost column, same row — visible without drill-in (US-9.2) |
| Secondary | Current custodian name | Mid-row column |
| Secondary | Offering party, associated witness | Mid-row columns |
| Tertiary | Description (truncated) | Collapsible/truncated text, full text on hover or in detail view |

#### States

| State | Appearance | User Feedback |
|-------|------------|----------------|
| Default list | Full case exhibit list, role-filtered, sorted by `exhibitLabel` | None |
| Search/filter active | List replaced by filtered results; active filter chips shown above the table with individual `×` removal | Chip UI makes "what's currently applied" obvious at a glance |
| Empty search result | "No exhibits match these filters" + a one-click "Clear filters" action | Non-blaming copy; never implies user error |
| Empty case (no exhibits yet) | "No exhibits recorded yet" | Rare in demo (seed data guarantees content) but designed for completeness |
| Sealed exhibit, unauthorized role | Row simply absent — no redacted placeholder row | Confirms US-9.1: sealed exhibits are invisible, not indicated |
| Live update arrives | Status badge or custodian cell updates in place, subtle highlight flash (~400ms) then settles | No full-table re-render/flicker |
| Row hover / keyboard focus | Full row background highlights and shows `cursor: pointer`; focus ring outlines the entire row, not just a sub-element | Confirms the whole row — not a hidden nested link — is the click/activation target (US-15.1) |
| Row action in progress (status/custody/objection write) | Inline row shows a small spinner on the affected cell only | Rest of table remains interactive |
| Write error (e.g., `STATUS_CONFLICT`) | Inline red text beneath the affected row: "Status has changed since this loaded — refresh and retry" | Row reverts to server-confirmed value, no stuck optimistic state |
| Admission attempt blocked (`ADMISSION_BLOCKED`) | Inline "Record Status" action re-opens with a specific error listing every blocking reason at once — e.g., "Cannot admit: 2 blocking condition(s) present — Unresolved objection on this exhibit; No custodian of record." | No partial/generic failure message; no event recorded; status/badge remain exactly as they were before the attempt (US-12.1, US-12.2) — see `Y0-patterns.md` §Pattern: Multi-Reason Blocking Error |
| Load failure | Full-table inline error with retry button | — |

#### Interactive Elements

| Element | Type | Behavior |
|---------|------|----------|
| Search bar | Text input | Keyword match against label/description/source; combines with dropdown filters (AND semantics, US-4.1) |
| Status / Witness / Date filter dropdowns | Combinable filters | Each adds a removable chip; empty search blocked with inline hint, not a hard error page (US-4.1) |
| Exhibit row | Click target (entire row, not a nested element) | Navigates to Exhibit Detail View (`/exhibit/:id`); visible hover highlight; Enter/Space activates on keyboard focus (US-9.2, US-15.1) |
| Inline "Record Status" action (row-level, authorized roles only) | Compact action, not a modal form | Offers only valid next-transition options (US-1.1); an attempted `ADMITTED` transition is rejected with every blocking reason named if an unresolved objection or missing custodian applies (US-12.1, US-12.2) |
| Inline "Transfer Custody" action | Compact action | Requires selecting an active user as new custodian (US-3.1) |
| Inline "Raise Objection" action | Compact action, two fields | Party + grounds only (US-2.1) |
| Discrepancy icon (⚠) | Tooltip + link | Hover shows the specific rule fired; click navigates to Exhibit Detail View discrepancy section |

**Positioning note:** row-level action affordances are deliberately understated (icon buttons, not prominent colored CTAs) — the search/browse experience is the visual star of this screen, with data-entry kept minimal and secondary per the "assistant, not data-entry system" constraint (FRD F09 §Validation). These understated inline actions coexist with full-row clickability without conflict: each inline action stops click-propagation, so clicking a status/custody/objection control never also fires row navigation, while every other point on the row — including empty space and the description/party/witness cells — still navigates (US-15.1, fixes a regression against this screen's originally-specified behavior).
### Screen: Exhibit Detail View

**Purpose:** The complete, single-screen chronological story of one exhibit — answers "what happened to this exhibit" without assembling fragments.
**User Stories:** US-10.1, US-10.2, US-3.3, US-2.2, US-6.3, US-12.1, US-12.2
**Journey:** JRN-02.2 (full journey), JRN-01.2 (Request History), JRN-03.1 (Challenge a Custody Gap)
**Route:** `/exhibit/:id` · **Nav:** Row click from Case Workspace, Command Center, or Jury Package Workspace; citation link from Assistant. No sidebar entry (drill-in only).

#### Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ JudicialSync   [Case: 2026-CR-0142]      [Role: Judge ▾] [Ask ✦] │
├───────────────┬──────────────────────────────────────────────────┤
│ Command Ctr   │  ← Back to Case Workspace                        │
│ Case          │  Exhibit 14 — "Blood sample, lab-sealed"         │
│ Jury Pkg      │  ┌────────────────────────────────────────────┐  │
│ Assistant     │  │ Status: ●ADMITTED   Custodian: ⚠ None on   │  │
│               │  │ Party: PROSECUTION   Witness: Dr. Smith     │  │
│               │  │ ⚠ DISCREPANCY: Admitted, no custodian of    │  │
│               │  │   record   [Resolve →] [Acknowledge]        │  │
│               │  └────────────────────────────────────────────┘  │
│               │  History                                         │
│               │  ┌────────────────────────────────────────────┐  │
│               │  │ ● Marked                    Oct 5, 9:02 AM  │  │
│               │  │   by D. Reyes (Deputy)                      │  │
│               │  │ ● Offered                    Oct 5, 9:15 AM │  │
│               │  │   by D. Reyes (Deputy)                      │  │
│               │  │ ● Objection raised — hearsay  Oct 5, 9:17 AM│  │
│               │  │   by M. Webb (Attorney)                     │  │
│               │  │ ● Ruling: Overruled           Oct 5, 9:22 AM│  │
│               │  │   by Judge Marsh                            │  │
│               │  │ ● Status changed: Offered → Admitted         │  │
│               │  │   Oct 5, 9:23 AM · by Judge Marsh            │  │
│               │  │   (no further custody events — gap begins)  │  │
│               │  └────────────────────────────────────────────┘  │
└───────────────┴──────────────────────────────────────────────────┘
```

#### Information Hierarchy

| Priority | Content | Placement |
|----------|---------|-----------|
| Primary | Current status, current custodian, active discrepancy flag(s) | Header block, above the fold, before any history |
| Primary | Discrepancy action (Resolve / Acknowledge) | Directly beneath the flag it belongs to — never a separate screen |
| Secondary | Chronological timeline (complete, oldest-first) | Main scrollable body |
| Tertiary | Exhibit identity metadata (description, party, witness, source) | Compact header row, de-emphasized once status/custodian are visible |

#### States

| State | Appearance | User Feedback |
|-------|------------|----------------|
| Default — clean exhibit | Header shows status + custodian, no discrepancy banner; full timeline below | None needed |
| Default — flagged exhibit | Amber discrepancy banner in header with plain-language rule explanation and action buttons | Impossible to miss; same visual treatment as Case Workspace's ⚠ icon, reinforcing consistency |
| Discrepancy acknowledged | Banner changes from amber "OPEN" to a muted but still-visible "Acknowledged by C. Chen (Clerk) · Oct 8, 2026, 3:10 PM: [full justification text]" badge — actor, role, timestamp, and justification all shown in full, never truncated or hidden behind a secondary click | Never disappears — remains a permanent, visible risk-acceptance record (US-6.3, US-14.3) |
| Loading | Header + timeline skeletons | Brief, since this is a single-exhibit query |
| Sealed, unauthorized role | Entire route renders the same "Exhibit not found" page as a nonexistent ID — no distinguishing copy, icon, or status code visible to the user | Confirms US-10.2: existence of sealed material is never revealed |
| Live update arrives (e.g., custody transfer logged elsewhere) | New timeline entry fades in at the appropriate chronological position; header updates in place | No manual refresh required |
| Citation deep-link arrival (from Assistant) | Page loads with the specific cited timeline entry highlighted and auto-scrolled into view | Closes the loop promised in Flow 1 ("one-tap view supporting record") |
| Admission attempt blocked (`ADMISSION_BLOCKED`) | The header's inline "Record Status" action re-opens with a specific error listing every applicable blocking reason at once (e.g., "Cannot admit: 2 blocking condition(s) present — Unresolved objection on this exhibit; No custodian of record.") — never a generic "failed to update status" message | No `ExhibitEvent` is recorded; status/custodian in the header remain exactly as they were before the attempt (US-12.1, US-12.2) — see `Y0-patterns.md` §Pattern: Multi-Reason Blocking Error |
| Load failure | Inline error: "Unable to load exhibit history — please retry" | Retry button, no partial/broken render |

#### Interactive Elements

| Element | Type | Behavior |
|---------|------|----------|
| "Resolve →" link (on a discrepancy banner) | Contextual link | Scrolls to / opens the relevant inline action (e.g., "Transfer Custody") directly on this screen |
| Inline "Record Status" action (header, authorized roles only) | Compact action, not a modal form | Offers only valid next-transition options (US-1.1); an attempted `ADMITTED` transition is rejected pre-write with every blocking reason named if an unresolved objection or missing custodian applies — status remains unchanged on rejection (US-12.1, US-12.2) |
| "Acknowledge" button | Action, opens inline justification field | Requires non-empty justification (≤500 chars) before submit; idempotent if already acknowledged (US-6.3); only rendered for `DEPUTY`/`CLERK`/`JUDGE`/`ADMIN` roles — absent, not disabled, otherwise; accompanied by always-visible copy disclosing the action is permanently recorded under the acting user's name and role before it is confirmed (US-14.1, US-14.2) |
| Timeline entry | Static, citable | Each entry carries a stable anchor so Assistant citations and direct links can scroll to it precisely |
| "← Back to Case Workspace" | Navigation | Returns to the referring list screen (preserves prior scroll/filter state where feasible) |
| Ruling action (judge role, on an open objection) | Inline action, 1 of 3 options | Sustained / Overruled / Reserved — role-gated (US-2.2) |

**Plain-language translation rule:** every timeline entry is composed as a complete sentence ("Status changed from Offered to Admitted," "Custody transferred from D. Reyes to C. Chen — reason: jury package prep") — raw `eventType`/`payload` values are never exposed to the user (US-10.1).
### Screen: Jury Package Workspace

**Purpose:** The authoritative, discrepancy-gated handoff view for the jury-eligible exhibit list — the screen where "build a jury package" plays out end-to-end.
**User Stories:** US-5.1, US-5.2, US-6.1, US-6.2, US-6.3, US-11.1, US-11.2, US-13.1, US-13.2, US-13.3, US-14.1, US-14.2, US-14.3
**Journeys:** JRN-02.1 (Assemble), JRN-01.2 (Present/Accept), JRN-03.1 (Verify Integrity)
**Route:** `/jury-package` · **Nav:** Sidebar "Jury Package"

#### Layout — Draft State

```
┌──────────────────────────────────────────────────────────────────┐
│ JudicialSync   [Case: 2026-CR-0142]      [Role: Deputy ▾] [Ask ✦]│
├───────────────┬──────────────────────────────────────────────────┤
│ Command Ctr   │  Jury Package Workspace          ● DRAFT          │
│ Case          │  ┌────────────────────────────────────────────┐  │
│ ▸ Jury Pkg    │  │ Label   Status      Discrepancy             │  │
│ Assistant     │  │ Ex. 3   ●ADMITTED   ✓ Clean                 │  │
│               │  │ Ex. 7   ●ADMITTED   ✓ Clean                 │  │
│               │  │ Ex. 14  ●ADMITTED   ⚠ Flagged: no custodian │  │
│               │  │                        [Fix →] [Acknowledge]│  │
│               │  │ Ex. 9   ●ADMITTED   ⚠ Flagged: unresolved   │  │
│               │  │                        objection [Fix →]    │  │
│               │  │ S-2     ●ADMITTED   ⛔ CRITICAL · ex parte   │  │
│               │  │                        material — must be   │  │
│               │  │                        removed               │  │
│               │  │                        [Remove from package]│  │
│               │  └────────────────────────────────────────────┘  │
│               │  2 of 4 included exhibits have open discrepancies.│
│               │  1 sealed/ex parte exhibit present — blocked.    │
│               │  [ Finalize Jury Package ]  ← disabled, greyed   │
└───────────────┴──────────────────────────────────────────────────┘
```

**Sealed/ex-parte blocker row (US-13.1, US-13.3):** a row whose underlying exhibit is `isSealed = true` (e.g., `S-2`, a chambers sidebar note) never renders `✓ Clean` or `⚠ Flagged: ...` — it renders in a distinct, higher-severity "⛔ CRITICAL" treatment with explicit copy ("ex parte material — must be removed") and no `[Fix →]`/`[Acknowledge]` actions, only `[Remove from Package]`. This evaluation is independent of and takes precedence over F6's `discrepancyStatus` for that row. The Finalize control stays disabled while any such row is present, same as for an open discrepancy. In the normal case (computation already excludes sealed exhibits at the query level per F13), this row never appears at all — it is shown here only to specify the required remediation treatment for the regression/legacy-data case where one is nonetheless present.

#### Layout — Finalized State

```
┌──────────────────────────────────────────────────────────────────┐
│ Jury Package Workspace          ● FINALIZED  ✓ Zero discrepancies│
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ Finalized by D. Reyes · Oct 5, 4:02 PM                        │ │
│ │ Label   Status                                                │ │
│ │ Ex. 3   ●ADMITTED                                             │ │
│ │ Ex. 7   ●ADMITTED                                             │ │
│ │ Ex. 14  ●ADMITTED                                             │ │
│ │ Ex. 9   ●ADMITTED                                             │ │
│ └──────────────────────────────────────────────────────────────┘ │
│ [ Export / Print ]   (read-only — no acknowledge/resolve controls)│
└────────────────────────────────────────────────────────────────── ┘
```

#### Information Hierarchy

| Priority | Content | Placement |
|----------|---------|-----------|
| Primary | Package status badge (`DRAFT`/`FINALIZED`) + discrepancy summary banner | Top of screen, largest visual weight |
| Primary | Sealed/ex-parte critical blocker row (if present) — highest-severity signal on this screen, never rendered as clean | Same table, visually distinct from and more severe than an ordinary `⚠ Flagged` row (US-13.1, US-13.3) |
| Primary | Finalize/Export action and its enabled/disabled state with reason | Persistent, bottom or top of exhibit list — never scrolled out of view |
| Secondary | Per-row discrepancy flag and resolution actions | Inline within each flagged row |
| Secondary | Acknowledgment role-eligibility and permanent-record disclosure, and the full acknowledgment audit record (actor, role, timestamp, justification) once acknowledged | Inline, always visible — never hover/tooltip-only (US-14.1, US-14.2, US-14.3) |
| Tertiary | Exhibit status badges (all rows are `ADMITTED` by construction, so this is confirmatory, not discriminating) | Row-level, de-emphasized relative to the discrepancy column |

#### States

| State | Appearance | User Feedback |
|-------|------------|----------------|
| Draft, zero discrepancies | All rows "✓ Clean"; Finalize button enabled (solid, primary color) | "All exhibits clean — ready to finalize" caption |
| Draft, open discrepancies | Flagged rows amber with rule explanation + actions; Finalize button visibly disabled (greyed, non-clickable) with caption "{n} exhibit(s) have unresolved discrepancies" | Disabled state is a true HTML-disabled control, not a styled-but-clickable button that errors on click (US-11.2) |
| Draft, discrepancy acknowledged | Row badge changes to a muted "Acknowledged by C. Chen (Clerk) · Oct 8, 2026, 3:10 PM: [full justification text]" state — actor, role, timestamp, and justification all shown in full, never truncated/summarized/hidden behind a secondary click (still visible, not cleared); counts toward "clean enough to finalize" per the gate's ACK/RESOLVED rule | Finalize button re-enables once all flags are ACK'd or RESOLVED (US-6.3, US-14.3) |
| Acknowledge control — non-eligible role | No "Acknowledge" control rendered at all for roles outside `DEPUTY`/`CLERK`/`JUDGE`/`ADMIN` | Absent, not disabled or greyed-out — never an affordance the system won't honor (US-14.1) |
| Acknowledge control — eligible role, before action | "Acknowledge" button visible with inline, always-on copy: "Acknowledging will be recorded as a permanent action under your name and role." Justification field labeled "Justification (recorded permanently)." | Disclosure is visible before the action is confirmed, not only after (US-14.1, US-14.2) |
| Sealed/ex-parte exhibit present | Row rendered as a distinct "⛔ CRITICAL · ex parte material" blocker — never `✓ Clean`, never `⚠ Flagged` — independent of and taking precedence over the row's own `discrepancyStatus`; Finalize stays disabled while the row is present | Structurally impossible to mistake for an ordinary discrepancy or a clean row (US-13.1, US-13.3) |
| Sealed/ex-parte exhibit — "Remove from Package" (eligible role) | `DEPUTY`/`CLERK`/`ADMIN` see an enabled "Remove from Package" action on the blocker row; `JUDGE`/`CHAMBERS_STAFF`/`ATTORNEY` see the identical blocker row with no action control | Role gate is absence-based, matching the Acknowledge-control pattern (US-13.2, US-13.3) |
| Sealed exhibit removed via remediation action | Row disappears from the active/included list immediately; an auditable "Removed by D. Reyes (Deputy) · Oct 8, 2026, 3:12 PM · reason: sealed/ex parte material" record is retained and visible (e.g., on Exhibit Detail's history) — the row is never silently deleted | Deliberate, auditable remediation, never a silent fix with no trace (US-13.2) |
| Finalizing (in-flight) | Finalize button shows a brief inline spinner/"Finalizing..." label | Prevents double-submit |
| Finalize rejected (stale client state) | Inline error banner lists the specific blocking exhibits; button re-disables; affected rows re-flag | Never a generic "error occurred" — always names the blocking exhibit(s) (US-5.2) |
| Finalized | Status badge turns to a calm green "FINALIZED ✓ Zero discrepancies" banner; all action controls disappear; export/print button appears | This is the explicit "zero discrepancies" confirmation stamped for the record, satisfying JRN-01.2's acceptance moment |
| No admitted exhibits yet | "No admitted exhibits are available to form a jury package yet" | Non-error, informative empty state |
| Load failure | Inline error with retry | — |
| Viewed by non-finalizing role (Judge/Attorney/Chambers Staff) | Identical layout, but Finalize/Acknowledge/Remove-from-Package controls render as view-only (absent, not disabled-with-explanation) — a sealed/ex-parte blocker row is still visible in its full critical-severity treatment, just without the removal action | Supports JRN-01.2 (judge review) and JRN-03.1 (attorney verification) from the same screen, no separate "audit view" needed (US-13.3) |

#### Interactive Elements

| Element | Type | Behavior |
|---------|------|----------|
| "Finalize Jury Package" | Primary action button | Disabled whenever any row is `FLAGGED` + `OPEN`; on click, triggers fresh server-side re-validation before committing (US-5.2, US-11.2) |
| "Fix →" link on a flagged row | Contextual link | Navigates to that exhibit's Exhibit Detail View to resolve the underlying condition |
| "Acknowledge" button on a flagged row | Action, opens inline justification field | Same acknowledgment flow as Exhibit Detail View (US-6.3); rendered only for `DEPUTY`/`CLERK`/`JUDGE`/`ADMIN` — absent, not disabled, for other roles; accompanied by always-visible copy disclosing the action is permanently recorded under the acting user's name and role before it is confirmed; justification field labeled "Justification (recorded permanently)" (US-14.1, US-14.2) |
| "Remove from Package" button on a sealed/ex-parte blocker row | Action, confirmation step | Rendered only for `DEPUTY`/`CLERK`/`ADMIN` — absent for other roles; appends an immutable, auditable exclusion event and removes the row from the active list, retaining it for audit (never deletes it); unavailable once the package is `FINALIZED` (US-13.2) |
| "Export / Print" (finalized state only) | Action | Produces a print-friendly/exportable static view; no further edits possible |
| Exhibit row (any state) | Click target | Navigates to Exhibit Detail View for full context |

**Design intent note:** This screen is a pure presentation + action-trigger layer per FRD F11 — it never computes eligibility or discrepancy status client-side, eliminating any possibility of showing a "clean" state the server wouldn't also enforce. The sealed/ex-parte exclusion (F13) is structural at the candidate-query level, not a client-side filter — this screen's "Remove from Package" action exists purely as an auditable remediation path for the regression/legacy-data case, never as the primary mechanism keeping sealed material out of the package.
### Screen: Pivota Assistant (Conversational UI)

**Purpose:** The universal, natural-language entry point to every fact in the system — the single feature the entire demo's success depends on (PRD F7). Available two ways: as a slide-over panel from any screen, and as a dedicated full-page view for sustained, longer review sessions (e.g., the administrator's evaluation walkthrough, JRN-04.1).
**User Stories:** US-7.1, US-7.2, US-7.3, US-7.4, US-15.2
**Journeys:** JRN-01.1, JRN-02.1, JRN-02.2, JRN-03.1, JRN-04.1 — the Assistant is the one touchpoint common to every journey in the product.
**Route:** `/assistant` (full-page) + global slide-over panel · **Nav:** Sidebar "Assistant" (full page) · Header "Ask ✦" button (slide-over, present on every screen)

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
│ JudicialSync   [Case: 2026-CR-0142]      [Role: Admin ▾]  [Ask ✦]│
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
| "Ask ✦" header button (global) | Toggle | Opens/closes the slide-over panel from any of the other four screens without losing that screen's state underneath |
| Conversation history scrollback | Passive | Full session history persists and is reviewable (supports PER-04's audit use case, US-7.2) |

**Tone and copy guidelines (reinforces conversational positioning):**
- Answers are written as a confident colleague would state them — "Exhibit 14 is currently Admitted" — never hedged ("it appears that...", "it looks like...") when grounded (FRD F07 §System Prompt Requirements).
- Declines are equally confident and equally brief — "I don't have that information about Exhibit 22's custody record" — never apologetic padding that could read as uncertainty about *everything else* the assistant says.
- No emoji, no exclamation points, no "Great question!" filler — the tone is that of a courtroom clerk, not a consumer chatbot, consistent with the legal/compliance audience (PER-04 evaluation lens).

**Example-chip label-source rule (US-15.2, fixes F15 regression):** example/suggested-question chips must reference exhibit labels that actually exist in the active case, sourced from (or validated at render time against) the same `getExhibits` service function the Case Workspace uses — never a hardcoded placeholder scheme (e.g., "Exhibit 14," "Exhibit 7") that doesn't correspond to any seeded exhibit. If the assistant is temporarily unavailable, chips still render from the last-known exhibit list rather than disappearing or reverting to placeholder text.
## Interaction Patterns

**Design System (as of Phase 6):** All patterns below are implemented using IBM Carbon Design System (carbondesignsystem.com) components and design tokens, replacing the prior Tailwind/shadcn visual foundation. The interaction guarantees described in each pattern are unchanged from that prior implementation — only the underlying component/styling layer changed, not the behavior.

### Pattern: Inline Row Actions (not modal forms)

**When to use:** Any time a user needs to log a status change, objection, ruling, or custody transfer from the Case Workspace or Exhibit Detail View.
**Behavior:** A compact, inline expansion directly within the row/header — never a full-screen modal dialog or a separate "add record" page. Only valid next actions are offered as options (e.g., only valid forward status transitions appear in the dropdown); invalid options are never shown as disabled list items requiring explanation, they are simply absent.
**Examples:** "Record Status," "Transfer Custody," "Raise Objection" actions on Case Workspace rows and the Exhibit Detail header (US-1.1, US-2.1, US-3.1).
**Rationale:** Reinforces "assistant augmenting an existing workflow," not "new case management system to learn" (PROJECT.md positioning constraint). A deputy who already knows the paper-log motions should find this faster, not slower, than what it replaces.

---

### Pattern: Status Badge Visual Convention

**When to use:** Anywhere an exhibit's current lifecycle status is displayed — Command Center, Case Workspace, Exhibit Detail, Jury Package, and the Assistant's text answers.
**Behavior:** A single consistent dot-plus-label convention (`●ADMITTED`, `●OFFERED`, etc.) with a fixed color mapping per status value, used identically across all five screens (implemented as a Carbon `Tag` using Carbon's status-color tokens as of Phase 6). The Assistant renders the same status word in its prose (never a paraphrase like "fully accepted" for `ADMITTED`).
**Examples:** Every screen wireframe in this document.
**Rationale:** US-1.2 requires that status "never" appears to differ across screens — a shared component (not five independent implementations) is the only way to structurally guarantee this.

---

### Pattern: Citation Pill

**When to use:** Any factual claim made by the Pivota Assistant.
**Behavior:** A small, bordered, monospace-text pill immediately following the sentence it supports, formatted `[RecordLabel · EventType · Timestamp]`. Clicking navigates to the source record's screen with the specific event highlighted. Never rendered as a footnote, tooltip-only, or hidden metadata — it is always visibly inline (implemented as a clickable Carbon `Tag` as of Phase 6; `Tooltip` is not used, since the citation must remain visible without a hover).
**Examples:** Pivota Assistant screen (every grounded answer).
**Rationale:** US-7.2 treats a missing citation as a release blocker, not a style preference — the pattern must be impossible to omit accidentally, so it is a required part of the answer-rendering component, not an optional enhancement.

---

### Pattern: Discrepancy Flag Treatment

**When to use:** Any screen displaying an exhibit with an `OPEN` or `ACKNOWLEDGED` discrepancy flag.
**Behavior:** Amber/warning-colored badge with the specific rule's plain-language explanation always visible alongside the icon (never an icon alone requiring a hover to understand). `ACKNOWLEDGED` flags use a visually related but distinguishable muted-amber treatment — related enough to signal "still a known risk," distinct enough to signal "already reviewed by a human."
**Examples:** Case Workspace row icon, Exhibit Detail header banner, Jury Package row badge.
**Rationale:** US-6.3 requires acknowledged flags to remain visibly surfaced forever — this pattern prevents any future screen from accidentally treating "acknowledged" as equivalent to "hidden."

---

### Pattern: Hard-Disabled Gate Controls

**When to use:** Any action whose server-side rejection would be confusing or too late to discover only after clicking (specifically: jury package finalization).
**Behavior:** The control itself is rendered in a disabled visual state (greyed, non-interactive, `disabled` attribute set) with an adjacent caption explaining exactly what must change for it to become actionable — never a normal-looking button that returns an error toast on click (implemented as a Carbon `Button` with its native `disabled` prop as of Phase 6, not a styled-but-clickable element).
**Examples:** "Finalize Jury Package" button while open discrepancies remain (US-11.2).
**Rationale:** The PRD explicitly distinguishes "physically cannot ship a discrepant package by mistake" from "gets an error message after trying" — these are different UX guarantees, and only the disabled-control pattern satisfies the stronger one.

---

### Pattern: Decline-as-Valid-Response Styling

**When to use:** Any Pivota Assistant response where no tool call returned a supporting record.
**Behavior:** Rendered with the same neutral conversational styling as a grounded answer — no red color, no warning icon, no "Error" label. The only visible difference is the absence of a citation pill.
**Examples:** Pivota Assistant screen, decline-response state.
**Rationale:** US-7.3 explicitly treats this as "valid, expected behavior in testing, not a failure mode" — styling it as an error would train users to distrust declines, which is the opposite of the intended effect (a decline should be exactly as trustworthy-feeling as an answer).

---

### Pattern: Polling-Based Live Sync Indicator

**When to use:** Command Center, Case Workspace, and Jury Package Workspace (in `DRAFT` state) — all three poll underlying data every 3–5 seconds.
**Behavior:** Updates apply in place with a brief (~400ms) highlight fade on the changed cell/row — never a full list re-sort or jarring re-render, and never an intrusive "new data available, click to refresh" banner. A small, unobtrusive "updated Xs ago" indicator in a corner provides freshness confidence without demanding attention.
**Examples:** All three polling screens.
**Rationale:** PRD §6 NFR requires changes to "propagate across open screens without manual refresh" while feeling "immediate" — an indicator that's too quiet undermines confidence, one that's too loud undermines the "ambient" positioning of F8 specifically.

---

### Pattern: Sealed-Exhibit Invisibility

**When to use:** Any query, list, search result, or assistant answer touching an exhibit marked `isSealed = true`, viewed by a role outside the visibility set.
**Behavior:** The sealed exhibit is simply absent — not shown as a redacted row, not referenced in a count, not hinted at via a "1 hidden result" message. An unauthorized direct navigation to its detail URL returns an identical "not found" experience to a genuinely nonexistent ID.
**Examples:** Case Workspace list (US-9.1), Exhibit Detail View (US-10.2), Assistant decline (US-7.4), search results (US-4.1).
**Rationale:** The FRD is explicit that revealing *existence* of sealed material to an unauthorized role is itself the harm to prevent — a redacted placeholder row would violate this even though no content leaks.

---

### Pattern: Fully Clickable List Row

**When to use:** Any list row that drills into a detail screen — Case Workspace's exhibit table and Command Center's Recent Activity/Unresolved Objections/Discrepancies rows.
**Behavior:** The entire row container is the click target and carries a visible hover affordance (background highlight + `cursor: pointer`), not just a nested link, icon, or label span. The row is keyboard-focusable and Enter/Space activates it identically to a click. Nested inline action controls (e.g., "Record Status," "Acknowledge") call `stopPropagation()` so operating them never triggers row navigation, while every other point on the row does.
**Examples:** Case Workspace exhibit row (fixes a regression against this same guarantee — US-15.1); Command Center's Recent Activity/Unresolved Objections/Discrepancies rows (already correct, used here as the reference implementation).
**Rationale:** US-15.1 requires a row with zero discrepancy flags and a row with one or more flags to be "both fully, identically clickable across their entire row area" — a shared pattern definition is what keeps Case Workspace from silently drifting out of sync with the Command Center behavior it is meant to match.

---

### Pattern: Multi-Reason Blocking Error (Admission Gate)

**When to use:** Any inline "Record Status" action attempting to transition an exhibit to `ADMITTED` — available on both the Case Workspace row and the Exhibit Detail header.
**Behavior:** If the attempt is rejected (`422 ADMISSION_BLOCKED`), the inline action renders a specific inline error naming every applicable blocking reason at once — never a generic "failed to update status" message and never only the first reason found. Each reason renders as its own line (e.g., "Unresolved objection on this exhibit," "No custodian of record"), preceded by a count ("Cannot admit: 2 blocking condition(s) present"). No `ExhibitEvent` is recorded and the exhibit's displayed status does not change — the inline action simply re-collapses to its prior, unmodified state once the error is dismissed.
**Examples:** Case Workspace's inline "Record Status" action; Exhibit Detail View's header "Record Status" action (US-12.1, US-12.2).
**Rationale:** F12 moves this check to a hard pre-write gate specifically so a deputy never discovers a blocking condition one at a time through repeated failed attempts — the UI's job is to surface every reason the first time, matching the service layer's `reasons[]` array 1:1.

---

### Pattern: Critical Blocker Row (Sealed / Ex Parte)

**When to use:** Any Jury Package Workspace row whose underlying exhibit is `isSealed = true`.
**Behavior:** Rendered in a distinct, higher-severity treatment than the Discrepancy Flag Treatment pattern above — explicit label ("Critical · ex parte material — must be removed"), a stronger/non-amber critical color, and never the `✓ Clean` or `⚠ Flagged` wording used by ordinary discrepancies. This evaluation runs independently of, and takes precedence over, the row's underlying `discrepancyStatus` — a sealed exhibit's row is structurally incapable of ever reading `Clean`, regardless of what F6's discrepancy engine separately reports for it. Only `DEPUTY`, `CLERK`, or `ADMIN` roles see the row's "Remove from Package" action; `JUDGE`, `CHAMBERS_STAFF`, and `ATTORNEY` see the identical critical-severity row with no action control.
**Examples:** Jury Package Workspace sealed/ex-parte blocker row (US-13.1, US-13.2, US-13.3).
**Rationale:** F13 names sealed material reaching a jury package as "the single most damaging failure mode in this domain" — a row that could ever be mistaken for an ordinary flagged-but-tolerable discrepancy would undermine the entire guarantee, so this pattern is deliberately visually incompatible with the Discrepancy Flag Treatment pattern.

---

### Pattern: Permanent-Record Disclosure (Role-Gated Action)

**When to use:** Any control that triggers an auditable, identity-attributed ledger event the user is about to commit to — currently the discrepancy "Acknowledge" action (F6/F14) and the jury package "Remove from Package" action (F13).
**Behavior:** Two guarantees, both required: (1) if the requesting role is not in the action's permitted set, the control is simply absent — never rendered disabled or greyed-out; (2) if the role is permitted, the control is shown alongside inline, always-visible (not tooltip/hover-only) copy stating the action will be permanently recorded under the acting user's name and role before the action is confirmed — e.g., "Acknowledging will be recorded as a permanent action under your name." Any accompanying free-text input (e.g., acknowledgment justification) is labeled to make clear it becomes part of the permanent record, not an optional comment. Once the action is taken, every screen rendering that record displays the full audit trail (actor, role, timestamp, justification) — never summarized away or hidden behind a secondary click.
**Examples:** Discrepancy "Acknowledge" button on Case Workspace, Exhibit Detail, and Jury Package Workspace (US-14.1, US-14.2, US-14.3); Jury Package "Remove from Package" button (US-13.2).
**Rationale:** F14 is explicit that the underlying audit data already exists in full — the gap is purely that a user could take an irreversible, identity-attributed action without being shown, before committing, that it is irreversible and identity-attributed. This pattern closes that gap identically everywhere the action appears, rather than per-screen.

---

### Pattern: Activity Feed Row Format (Full Timestamp + Label)

**When to use:** Command Center's Recent Activity feed (F8) — any row rendering an `ExhibitEvent` as a one-line summary.
**Behavior:** Every row renders both the date and the time of `recordedAt` (e.g., "Oct 8, 2026, 2:41 PM") — never a time-only stamp — and always includes the event's exhibit label as part of the rendered summary, including rows describing a raw `STATUS_CHANGE` transition (e.g., "Exhibit 3 — MARKED → OFFERED, Oct 8, 2026, 1:58 PM" rather than a summary with no exhibit identified).
**Examples:** Command Center Recent Activity panel, every `eventType` value (US-15.4, US-15.5).
**Rationale:** A judge scanning the feed across a day boundary or a multi-day recess cannot tell two events on different days apart from a time-only stamp, and an unattributed raw-transition row forces a drill-in just to learn which exhibit it concerned — both defeat the "glance, don't drill in" promise of US-8.1.

---

### Pattern: Labeled Header Indicator

**When to use:** Any numeric or iconographic element rendered in the shared app header (near the role selector), present identically on all five screens.
**Behavior:** An element is never shown "present and unexplained." Every header indicator either (a) carries a visible label or an accessible `aria-label`/tooltip explaining what it represents, or (b) is not rendered at all when it has no current user-facing function. The resolved discrepancy-count indicator (see `00-overview.md` §App Shell) is the current example: a small `[⚠ N]` badge showing the case-wide count of `OPEN` discrepancy flags, labeled via `aria-label="N open discrepancies"`, omitted entirely when the count is zero.
**Examples:** App header discrepancy-count badge, replacing a previously unlabeled numeric element (US-15.3).
**Rationale:** "Present and unexplained" is explicitly called out as unacceptable for any header element, verified across Command Center, Case Workspace, Exhibit Detail, and Jury Package Workspace — a single shared header component (not per-screen reimplementation) is what guarantees the fix can't regress on only some screens.
## Responsive Considerations

Per PROJECT.md §Out of Scope, JudicialSync targets **web/desktop screens only** — no mobile-native app is in scope. However, a judge's bench tablet (JRN-01.2: "Opens the Trial Command Center on the bench tablet during a two-minute recess") is an explicitly named real-world touchpoint, so tablet-width responsiveness is a first-class concern even though mobile phone layouts are not.

### Desktop (>1024px) — Primary Design Target

- Full sidebar (labeled icons + text) always visible, pinned left.
- Case Workspace and Jury Package Workspace render full multi-column tables with all fields visible without horizontal scroll.
- The Pivota Assistant slide-over panel occupies roughly 30% of viewport width, docked right, with the underlying screen dimmed but still visible for context.
- Exhibit Detail View renders the header block and timeline in a single generous-width column (timelines are inherently vertical; no benefit to a two-column layout here).

### Tablet (768px–1024px) — Judge's Bench Device, High Priority

- Sidebar collapses to icon-only (labels on tap/hover) to preserve content width — this is the primary device for JRN-01.2's "glance during recess" moment, so Command Center legibility at this width is tested explicitly.
- Case Workspace and Jury Package Workspace tables drop lower-priority columns first (description, source) while keeping status badge, custodian, and discrepancy indicator — the three fields a judge glancing mid-recess needs most (US-9.1 information hierarchy).
- The Pivota Assistant slide-over expands to ~60% of viewport width at this breakpoint (text legibility matters more than preserving background-screen visibility on a smaller canvas) — reinforces that on the bench, asking a question is the primary action, not a secondary overlay.
- Touch targets (row actions, citation pills, Finalize button) sized to a minimum 44×44px tap area, since a judge on a tablet may be using touch rather than a trackpad.

### Mobile (<768px) — Out of Scope, Graceful Degradation Only

- No phone-optimized layout is designed or required per PROJECT.md scope.
- If accessed on a narrow viewport, the app shell collapses the sidebar into a hamburger menu and all tables fall back to a stacked card-per-exhibit layout (status badge, label, and discrepancy icon only, full detail via tap-through) — this is a baseline degradation to avoid a broken layout, not a tested or demo-relevant experience.
- The Pivota Assistant becomes full-screen (not a slide-over) at this width, since a 30–60% panel would be unusably narrow — but this is a fallback behavior, not a design target for the demo walkthrough.
## Accessibility Notes

Accessibility is directly tied to this product's core claim — a judge ruling live from the bench cannot afford a status badge or citation that's ambiguous to perceive quickly, and PRD §6 explicitly prioritizes "clarity and trustworthiness of answers" for a non-technical audience over visual sophistication.

### Color Contrast

- Status badges (`MARKED`/`OFFERED`/`OBJECTED`/`ADMITTED`/`EXCLUDED`/`WITHDRAWN`) never rely on color alone — each pairs a distinct color with a filled/outlined dot shape AND the status word as text, so the distinction holds for colorblind users and in grayscale print/export (relevant to the Jury Package Workspace's export feature).
- Discrepancy amber and the "finalized/clean" green meet WCAG AA contrast ratios (4.5:1 minimum for text) against their panel backgrounds.
- The decline-response styling in the Assistant is distinguished from a grounded answer by the *presence/absence of a citation pill*, not by color alone — ensuring the distinction is legible to screen-reader users and colorblind users alike.

### Keyboard Navigation

- All inline row actions (Record Status, Transfer Custody, Raise Objection, Acknowledge) are reachable and operable via keyboard alone (Tab to focus, Enter/Space to activate, Escape to collapse the inline action without committing).
- The Pivota Assistant input is keyboard-first by design: Enter submits, Shift+Enter inserts a newline for longer questions, and the example-question chips are Tab-reachable and Enter-activatable.
- The "Finalize Jury Package" disabled state is exposed via the native `disabled` attribute (not just a CSS class), so assistive technology correctly announces it as unavailable rather than silently skipping it or announcing it as clickable.
- Citation pills are real `<a>`/button elements in the DOM tab order, never a styled `<span>` requiring a mouse click.

### Screen Reader Considerations

- Live-updating panels (Command Center's Recent Activity, Case Workspace's polling rows) use a polite `aria-live` region for new items — announced without interrupting whatever the user is currently focused on, avoiding the "jarring interruption" risk that would undermine the "ambient, not alarming" design intent.
- The Assistant's streaming response uses an `aria-live="polite"` region on the response container so screen-reader users hear the answer as it completes, not token-by-token (which would be unintelligible).
- Discrepancy banners include a visually-hidden (`sr-only`) prefix such as "Warning: " before the rule explanation, so the semantic meaning of the amber color is conveyed audibly even though the visible text itself ("Admitted, no custodian of record") doesn't restate the word "discrepancy."
- The sealed-exhibit "not found" page uses identical markup/ARIA structure to a genuine 404, so assistive technology cannot be used to infer a difference that sighted UI also doesn't reveal (preserving US-10.2's non-disclosure guarantee across modalities).

### ARIA Labels Needed

- `aria-label` on each status badge stating the full status in words (e.g., `aria-label="Current status: Admitted"`) rather than relying on the dot glyph alone.
- `aria-describedby` linking each citation pill to its full record reference (record type, ID, timestamp) so screen readers announce complete citation context, not just a truncated visible label like "Ex.14·2:41 PM".
- `role="status"` on the Assistant's decline-response bubble, distinct from `role="alert"` reserved for true error states (e.g., "assistant temporarily unavailable") — ensuring screen-reader users perceive the same calm/non-error framing that sighted users get from the neutral visual styling.
- `aria-disabled` plus a programmatically associated caption (`aria-describedby`) on the Finalize button explaining *why* it's disabled, so the reason is announced, not just the disabled state itself.
- Landmark roles (`nav` for the sidebar, `main` for screen content, `complementary` for the Assistant slide-over panel) so keyboard and screen-reader users can jump directly between the app shell's regions.
