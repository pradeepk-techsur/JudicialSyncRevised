# UX Mockup

**Project:** JudicialSync
**Generated:** 2026-10-06
**Last Updated:** 2026-10-09 (Phase 8: dark-dashboard visual foundation replacing the Carbon-light theme; Command Center stat-card row, status-distribution bar, "Needs your attention" severity feed with inline write actions, "Custody at a glance" panel, Jury Package summary widget, and date-grouped/filterable Recent Activity — superseding Phase 5's strictly-read-only Command Center constraint for the attention feed's inline actions only; Case Workspace quick-filter chips and Jury Package eligibility column, with Flags rendered as readable text pills; Exhibit Detail header write actions ("Transfer custody," "Ask Pivota about {label}") and a three-card right rail (Objection / Chain of Custody / Jury Package checklist); Jury Package Workspace card-per-exhibit Blockers/Clean layout with a progress banner and "Request finalization from Clerk" — US-8.3, US-8.4, US-9.3, US-10.3, US-11.3, US-24.1, US-24.2, US-24.3. Prior note retained: Phase 7.1 INSERTED: exhibit classification at intake, custodian required at MARKED, two-phase custody propose/confirm, server-side role enforcement surfaced as absent-not-disabled controls system-wide, judge-only Pending-Ruling Queue [new 6th screen], header case selector, jury-package versioning + real PDF export — US-16.1–US-16.2, US-18.1–US-18.2, US-19.1–US-19.4, US-20.1–US-20.6, US-21.1–US-21.2, US-22.1–US-22.3, US-23.1–US-23.3. Earlier note retained: Phase 7 admission-rejection error, sealed/ex-parte jury package blocker, discrepancy-acknowledgment role/audit visibility, Case Workspace row clickability, assistant example labels, header indicator, activity-feed date+label fixes — US-12.1–US-12.2, US-13.1–US-13.3, US-14.1–US-14.3, US-15.1–US-15.5)
**Based on:** UserStories-JudicialSync.md, JOURNEYS-JudicialSync.md, PRD-JudicialSync.md, FRD-JudicialSync.md, PROJECT.md

---

## Overview

JudicialSync's UX exists to prove one thing: **Pivota is an assistant layered over how courtroom staff already work, not a new system to learn.** Every design decision below is tested against that positioning constraint from PROJECT.md: *"favor conversational/assistive UX over heavy data-entry forms on every screen."*

### Visual Foundation (Phase 8: Dark-Dashboard Theme)

As of Phase 8, the component layer is still IBM Carbon Design System (unchanged since Phase 6 — same components, same accessibility-conformant behavior, same `data-testid`/`aria-label` contracts per US-24.3), but the **token/visual theme layered on top of Carbon changes from the original Carbon-light theme to a reviewed dark-dashboard theme**, carried consistently across Command Center, Case Workspace, Exhibit Detail, and Jury Package Workspace:

- **Sidebar:** a dark navy, full-height panel (not Carbon's default light `SideNav`) — the sidebar is now the single most visually distinct region of the shell, anchoring the "operational dashboard" framing.
- **Content area:** remains light, so body text, tables, and timeline entries retain the high-contrast legibility Y2-accessibility.md already requires — only the sidebar and card chrome shift to the dark palette, not the reading surface.
- **Dashboard panels:** rendered as rounded-corner cards (Carbon `Tile` with the dark-dashboard corner-radius/elevation tokens) rather than Carbon's default flat/square tile edges — this is the visual language the stat-card row, attention feed, custody panel, and Blockers/Clean cards (below) all share.
- **Severity badges:** a fixed color mapping used identically everywhere a severity tier renders — `CRITICAL` = dark red, `HIGH` = amber, `PENDING` = amber-light (a lighter/desaturated amber, visually distinct from `HIGH`'s amber at a glance per Y2-accessibility.md's "never color alone" rule — each also carries the tier word as text), `MEDIUM` = yellow. See `Y0-patterns.md` §Pattern: Severity Tier Badge.
- **Header button rename:** the header's "Ask ✦" button is relabeled **"Ask Pivota"** (sparkle glyph dropped in favor of the explicit product name) — same position, same behavior, still opens the Assistant slide-over from any screen.
- **No functional/behavioral change:** this is a token/styling migration only, identical in spirit to the Phase 6 Carbon migration — every interaction pattern, role gate, polling behavior, and `data-testid`/`aria-label` contract already specified in this document is preserved unchanged (US-24.3). Where this document's existing ASCII wireframes show light-theme framing, read the sidebar as dark navy and panels as rounded dark-dashboard cards; the structural layout and content hierarchy they depict is unchanged.

### Design Principles

1. **Ask, don't fill out forms.** Wherever a user might reach for a search bar, a filter panel, or a multi-field form, the Pivota Assistant is presented as the faster, equally-authoritative alternative. Structured controls (search bar, status badges, buttons) still exist — they are not removed — but the assistant is never visually subordinate to them. It is reachable from every screen in one motion (US-7.1, JRN-01.1).
2. **Citations are load-bearing UI, not a tooltip.** Because the entire demo's credibility rests on zero ungrounded claims (US-7.2, PRD §6 NFR "Trustworthiness over fluency"), every factual statement — on-screen or in chat — renders its supporting citation inline and visibly, never as hidden metadata requiring a hover or click to discover.
3. **Discrepancies are gates, not warnings to dismiss.** The jury package discrepancy gate (US-5.2, US-11.2) is the single highest-trust-building mechanic in the product (JOURNEYS §Shared Opportunities). It is designed as a hard, visually undeniable block — a disabled button with an explicit reason — never a dismissible toast.
4. **Glanceable over configurable — amended Phase 8.** The Trial Command Center (F8) still has zero filters, zero settings, and no browse/search controls of its own (US-8.1) — every panel except one remains strictly read-only ambient awareness. **Deliberate exception (Phase 8, F24):** the "Needs your attention" feed's inline actions ("Record ruling," "Transfer custody"/"Assign custodian") are a traceable, intentional reversal of Phase 5's "strictly passive/read-only monitoring" success criterion — see Screen-00's "Design decision supersedes a prior constraint" note. This does not reopen the rest of the screen to configuration; it adds exactly two write actions at the exact point the system has already identified they are needed, each still gated by an explicit confirm step (never auto-submit) and by F20's role matrix.
5. **Plain language over raw data.** Every ledger event (`STATUS_CHANGE`, `OBJECTION_RAISED`, etc.) is rendered as a human sentence ("Status changed from Offered to Admitted") — never as an exposed enum or JSON blob (US-10.1, FRD §PITFALLS.md UX Pitfalls).
6. **One record, five consistent views.** Status badges, discrepancy icons, and custodian names use identical visual conventions across all five screens (US-1.2) — a judge should never wonder if two screens disagree.
7. **Readable flags over iconography alone (Phase 8).** Where a prior design relied on an icon-only indicator to convey an exhibit's flagged state (e.g., Case Workspace's ⚠ discrepancy icon), Phase 8 pairs every such indicator with a short, readable text pill ("Ruling pending," "No custodian," "Open objection," "Ex parte · restricted") so the specific condition is legible without a hover or click — consistent with Design Principle 5's "plain language over raw data," now extended to flag/status iconography generally.

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

All six screens live inside one persistent shell:

```
┌──────────────────────────────────────────────────────────────────┐
│ JudicialSync  [Case: 2026-CR-0142 ▾] [⚠ 1] [Role: Judge ▾] [Ask Pivota]│ ← global header (light)
████████████████┬──────────────────────────────────────────────────┤
█ ▸ Command Ctr █│                                                  │
█   Case        █│          [ Active Screen Content — light ]      │
█   Jury Pkg    █│                                                  │
█   Pending Rul.█│ ← JUDGE role only; absent from the sidebar       │
█   Assistant   █│    entirely for every other role (F20/F21)       │
█ (dark navy)   █│                                                  │
████████████████┴──────────────────────────────────────────────────┘
```

*(The `█` fill above stands in for the Phase 8 dark-navy sidebar background — a full-height dark panel, not Carbon's default light `SideNav`; the content area to its right remains light, per §Visual Foundation above.)*

- **Sidebar** (persistent, 4 items for most roles; 5 for `JUDGE`; dark-navy full-height background as of Phase 8): Command Center, Case Workspace, Jury Package, Pivota Assistant, plus **Pending Rulings** (judge-only, see below). This is the entire navigable surface — intentionally small, reinforcing low adoption burden (JTBD-04.4).
- **"Ask Pivota" header button** *(relabeled Phase 8 — was "Ask ✦")*: opens the Pivota Assistant as a slide-over panel from *any* screen without navigating away — the single most important affordance in the product, since F7 is the universal touchpoint across every journey (JOURNEYS §Convergence Points). Same header position and behavior as before the rename; only the label text changed.
- **Case selector ("`[Case: 2026-CR-0142 ▾]`", Phase 7.1, F22)**: the previously-static case-identifier text in the header's leftmost slot becomes an interactive dropdown — same position, same width budget (one caret glyph added), so the header's element ordering (Case → Discrepancy count → Role → Ask) and overall width are unchanged. Opening it lists every case in the system (`GET /api/cases`, no role restriction — case existence is not sensitive); selecting a different case updates client-side active-case state and triggers every open screen and the assistant to refetch against the newly-selected `caseId`, using the identical refetch mechanism already used on a role switch. On first load with no prior selection, it defaults to the first case by `createdAt` ascending — the original seeded demo case — so the existing single-case demo script requires zero interaction with this control. See `Y0-patterns.md` §Pattern: Case Selector (Header Scope Switch).
- **Header discrepancy-count indicator ("`[⚠ 1]`")**: resolves a Phase 7 usability defect (US-15.3) in which a numeric element rendered near the role selector carried no label or explanation of any kind. It now shows the count of `OPEN` discrepancy flags scoped to the currently-selected case, paired with a visible `aria-label="N open discrepancies"` (readable without a hover/tooltip) and, when tapped, navigates to the Command Center's Discrepancies panel. If the count is zero, the element is omitted entirely rather than showing a bare, unexplained "0." This treatment is identical on every screen since it lives in the one shared header component — see `Y0-patterns.md` §Pattern: Labeled Header Indicator. "Present and unexplained" is not an acceptable end state for any header element.
- **Role switcher**: demo-only affordance (no production auth per PROJECT.md scope) letting the presenter switch personas live to show role-scoped visibility (US-7.4, US-10.2). As of Phase 7.1, the seed data's one-user-per-role model (F0) means the role switcher also doubles as an *identity* switch for the handful of actions that require an exact-identity match rather than a role match (custody transfer confirmation, F19/F20) — see `Y0-patterns.md` §Pattern: Two-Phase Custody Handoff.
- **"Pending Rulings" sidebar entry (Phase 7.1, F21)**: present in the sidebar only when the active switched role is `JUDGE`; for every other role it is not rendered at all — not disabled, not hidden-but-reachable-by-URL, simply absent, per the same reasoning as every other role-gated control in this document (`Y0-patterns.md` §Pattern: Role-Gated Control Visibility). This is a judge-only navigation entry point into a new 6th screen — see `Screen-05-pending-ruling-queue.md`.
- **Exhibit Detail View has no sidebar entry** — it is only reached by drilling into a specific exhibit (row click, activity item, citation link), never browsed to directly, consistent with it being a "zoom-in," not a top-level destination.

---

## Navigation Map

| Screen | Route | Reached from | Nav element |
|--------|-------|--------------|-------------|
| Trial Command Center | `/command-center` | App shell (default landing after role selection) | Sidebar: "Command Center" |
| Case Workspace | `/case` | App shell | Sidebar: "Case Workspace" |
| Exhibit Detail View | `/exhibit/:id` | Case Workspace (row click); Command Center (Recent Activity / Discrepancy item click); Jury Package Workspace (row click); Pivota Assistant (citation link click) | Row click / citation link |
| Jury Package Workspace | `/jury-package` | App shell | Sidebar: "Jury Package" |
| Pending-Ruling Queue | `/pending-rulings` | App shell — **`JUDGE` role only**; no sidebar entry exists for any other role | Sidebar: "Pending Rulings" (judge-only, F21) |
| Pivota Assistant | `/assistant` (full-page view) + global slide-over panel on every screen | App shell (persistent) | Sidebar: "Assistant" (full page) · Header: "Ask Pivota" button (slide-over, available everywhere) |

**Invariant check — no orphan screens:** Command Center, Case Workspace, Jury Package, and Assistant all have direct sidebar entries from the app shell, visible to every role. The Pending-Ruling Queue (added Phase 7.1) also has a direct sidebar entry, but — unlike the other four — that entry is conditionally rendered: present only when the active role is `JUDGE`, absent for every other role (not merely disabled). This is a deliberate exception to "every screen reachable from the shell for every user," matching F21's explicit judge-only navigation requirement; the underlying read endpoint remains accessible to any role with case visibility (defense-in-depth is enforced server-side, not relied upon from the UI), but no non-judge role is ever given a path to the screen. Exhibit Detail View has no sidebar entry by design, but is reachable from three parent screens (Case Workspace, Command Center, Jury Package) plus the Assistant's citation links — all of which themselves trace to the shell. No screen requires typing a URL.

---

## Scope Note on This Document

This mockup covers the 6 screens now in scope: the 5 demo screens originally named in PROJECT.md — **Trial Command Center (F8), Case Workspace (F9), Exhibit Detail View (F10), Jury Package Workspace (F11), and Pivota Assistant (F7)** — plus the **Pending-Ruling Queue (F21)**, added in Phase 7.1 as a judge-only 6th screen (see `Screen-05-pending-ruling-queue.md` and the Decision Note below). Discrepancy acknowledgment (F6) and status/objection/custody recording (F1–F3) continue to be presented as *in-context actions within* screens rather than as separate screens, consistent with the FRD's screen inventory. Phase 7.1's remaining features are cross-cutting amendments to these six screens rather than new screens of their own: exhibit classification (F16) and the custodian-at-intake requirement (F18) extend Case Workspace's exhibit-creation flow; custody handoff confirmation (F19) extends Exhibit Detail View's custody section; server-side role enforcement (F20) is a system-wide UI-visibility pattern applied across all six screens (`Y0-patterns.md` §Pattern: Role-Gated Control Visibility); multi-case support (F22) is a header-level control (the Case Selector) rather than a screen; and jury-package versioning/PDF export (F23) extends the Jury Package Workspace.

**Decision note — F21 (new screen vs. extended Command Center panel):** The Pending-Ruling Queue is specified as a **dedicated 6th screen**, not an extension of the Command Center's existing "Unresolved Objections" panel. Three reasons, all from the FRD/user-story source of truth rather than a UX preference: (1) F21 explicitly requires "a `JUDGE`-role navigation entry point; other roles do not get a navigation entry point to this screen" — the Command Center itself is visible to every role (it is the universal ambient-awareness screen per US-8.1), so the judge-only gating this feature requires cannot be satisfied by extending a panel every role already sees; (2) the journey source (`JOURNEYS-JudicialSync.md` JRN-01.2) lists "Check the Pending-Ruling Queue" as its own distinct stage — "Opens the judge-only Pending-Ruling Queue" — separate from and following the ambient "Glance During Recess"/"Spot a Flag" stages that the Command Center panel already serves, indicating a deliberate destination, not a glance; (3) the Command Center's Unresolved Objections panel is intentionally minimal (exhibit + grounds + timestamp, link-through only, per US-8.1's "no data-entry controls" constraint) while F21 additionally requires inline ruling-recording actions and live-recomputed elapsed-wait sorting as the screen's primary (not secondary) purpose — functionality a read-only ambient panel is explicitly scoped not to carry.
## User Flows

### Flow 1: Live Question Mid-Proceeding

**Trigger:** A judge, attorney, or chambers staff member needs an immediate, cited answer to a natural-language question during live proceedings — without pausing the courtroom or delegating a manual lookup.
**User Stories:** US-7.1, US-7.2, US-7.3, US-7.4
**Journeys:** JRN-01.1, JRN-02.2 (Confirm via Assistant), JRN-03.1 (Confirm Status Before Referencing)

```
[Any screen — question arises mid-proceeding]
    │
    ▼
[Tap "Ask Pivota" header button → slide-over chat panel opens]
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
2. **Open the assistant.** One tap/click on the ever-visible "Ask Pivota" header button opens a slide-over chat panel over whatever screen is currently active — no navigation away, no lost context.
3. **Ask in plain language.** A single text input, placeholder text rotating through example questions sourced from the case's actual seeded exhibit labels ("Who currently has custody of P-5?", "What was admitted yesterday?") — never a hardcoded placeholder scheme that doesn't match a real exhibit (US-15.2). No required syntax, no filter menus (reinforces PRD §Strategic Goals — natural-language-first).
4. **Response streams token-by-token** via the chat panel (US-7.1 — Vercel AI SDK `useChat`), so the user sees progress within ~1 second rather than a blank wait.
5. **Citation renders inline** with every factual sentence — format: `[Exhibit 14 · Status Change · 2026-10-05 14:32]` as a clickable pill immediately following the claim it supports (US-7.2).
6. **Tap a citation to jump to source.** Clicking a citation pill navigates to the Exhibit Detail View for that exhibit with the specific ledger event visually highlighted/scrolled-to — the "one-tap view supporting record" moment from JRN-01.1.
7. **Decline path (US-7.3):** If no tool call surfaces a supporting record — including when the only match is a sealed exhibit the user's role cannot see (US-7.4) — the assistant responds with an explicit, confidently-worded decline. This state is visually calm (not red/error-styled) since it is correct, expected behavior, not a failure.
8. **Close and resume.** The panel can be dismissed with no save/discard decision — it's a conversation, not a form; history persists for later audit review (US-7.2) but nothing requires the user to "finish" anything.

**Key UX Risk Guarded Against:** If opening or using the assistant ever requires more than typing a question (menus, required fields, login friction), the user reverts to delegating lookups to staff — this is the #1 abandonment risk identified in JRN-01.1. The design keeps the panel to a single input + send action at every state.
### Flow 2: Core Demo Scenario — A Trial Day of Logging, Live Questions, and Search

**Trigger:** A courtroom deputy runs the floor of a live, multi-exhibit trial, logging events as they happen while fielding live questions from the bench and attorneys.
**User Stories:** US-1.1, US-2.1, US-2.2, US-3.1, US-3.2, US-4.1, US-4.2, US-16.1, US-18.1, US-18.2, US-19.1, US-19.2, US-20.1–US-20.4
**Journey:** JRN-02.1 (Core Demo Scenario — see JOURNEYS-JudicialSync.md for full stage table)

```
[Case Workspace — deputy's home screen during proceedings]
    │
    ▼
[New exhibit arrives on the floor → "+ New Exhibit"]
    │
    ▼
[Classification (TRIAL/CHAMBERS_EX_PARTE/SEALED, immutable)
 + identity fields + intake custodian, one seamless submit]
    │
    ├── Missing classification/custodian ──▶ [Inline field error,
    │                                          no exhibit created]
    │
    └── Valid ──▶ [Exhibit created AND marked into evidence
                   atomically — custody chain starts on row one]
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
    └── Invalid/terminal/stale/ADMISSION_BLOCKED ──▶ [Inline error
                                    naming every reason, action not
                                    applied, current status re-shown]
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
[Deputy proposes handing Exhibit 7 to the Clerk for safekeeping]
    │
    ▼
[Case Workspace: "Propose Custody Transfer" — does NOT change
 current custodian; row shows "D. Reyes → pending: C. Chen"]
    │
    ▼
[Clerk later opens the same exhibit, confirms receipt — ONLY she
 can; current custodian updates to C. Chen at that moment, not before]
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
1. **Classify and establish custody at intake, atomically.** "+ New Exhibit" on the Case Workspace captures identity fields, a mandatory, immutable `classification` (`TRIAL`/`CHAMBERS_EX_PARTE`/`SEALED`), and a required intake custodian — presented as one seamless submission that, underneath, creates the exhibit and records its first `MARKED` transition with custody established in the same step, so no exhibit can ever exist mid-lifecycle with no classification or no custodian of record (US-16.1, US-18.1, US-18.2). This action is absent for any role outside `DEPUTY`/`CLERK`/`ADMIN` (US-20.1).
2. **Log a status transition in place.** From the Case Workspace exhibit row (or Exhibit Detail View), the deputy opens a lightweight inline action — not a modal form — offering only the statuses that are valid next transitions per the admission-lifecycle state machine (US-1.1). Invalid states are never shown as selectable options. An attempted `ADMITTED` transition over an unresolved objection or missing custodian is rejected pre-write with every blocking reason named at once (US-12.1, US-12.2); this and every other status-transition action is absent for any role outside `DEPUTY`/`CLERK`/`ADMIN` (US-20.2).
3. **One log updates everywhere.** The moment a transition is recorded, `ExhibitCurrentState` updates and every open screen (Command Center, Case Workspace, Exhibit Detail, Jury Package, Pending-Ruling Queue, Assistant) reflects it on its next poll cycle (3–5s) — this is the "single log action updates every screen" promise from JRN-02.1, and it is the antidote to the spreadsheet/sticky-note habit the product replaces.
4. **Log an objection.** Similarly inline: a compact "Raise Objection" action captures `objectingParty` (defaulted from role context where possible) and `grounds` (free text) — two fields, not a form wizard; absent for `JUDGE`/`CHAMBERS_STAFF` (US-2.1, US-20.3).
5. **Record a ruling.** The judge's ruling (Sustained/Overruled/Reserved) is recorded against the specific open objection thread — if an exhibit has multiple concurrent objections, each is listed as its own resolvable row, never collapsed; recordable from Exhibit Detail View, the judge-only Pending-Ruling Queue, or — as of Phase 8 — inline from the Command Center's "Needs your attention" feed or a Jury Package Blockers card, all four entry points invoking the identical `POST /api/objections/:id/ruling` endpoint with no divergent validation (US-2.2, US-24.1).
6. **Custody questions answered inline.** "Current Custodian" (or a "pending transfer" indicator, F19) is a persistent field on both the Case Workspace row and the Exhibit Detail header — no separate custody screen to navigate to for a quick lookup (US-3.2).
7. **Propose, then confirm, a custody transfer — two separate steps, two separate people.** A compact "Propose Custody Transfer" action (absent outside `DEPUTY`/`CLERK`/`ADMIN`, US-20.4) names an intended receiver without changing who the system considers the current custodian. Only that exact named receiver can subsequently see and use "Confirm Receipt" — not the proposer, not any other authorized role — and only their confirmation updates the custody-of-record (US-19.1, US-19.2). A pending transfer can be cancelled by the proposer or any propose-authorized role without ever having changed current custody (US-19.3). As of Phase 8, the same first-assignment/propose action is additionally reachable directly from the Command Center's "Assign custodian" attention-feed entry or Custody-at-a-Glance panel, invoking the identical endpoint F24 wires up — no second custody-write code path is introduced (US-24.2).
8. **Search mid-testimony.** The Case Workspace search bar accepts combinable criteria (keyword, status, witness, date) in one row of controls — chip-style active filters so the deputy can see and clear exactly what's applied without re-opening a filter panel (US-4.1).
9. **Same question, assistant or search bar — same answer.** Asking the assistant "admitted exhibits from witness Smith" (US-4.2) returns the identical result set, in the identical order, as typing the equivalent filters into the search bar — reinforcing single-source-of-truth trust.

**Key UX Risk Guarded Against:** If logging a status change, objection, or custody transfer ever requires more clicks than the paper process it replaces, the deputy reverts to sticky notes under time pressure (JRN-02.1 Risk of Abandonment). Every logging action here is designed as a 2-click maximum: open row → select outcome — including the new intake flow, which is one submit despite covering two underlying API calls, and the custody propose/confirm split, which trades one extra click for the trust guarantee that custody can never be recorded as transferred to someone who never acknowledged receiving it.
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
[Optional: cross-check via "Ask Pivota" — "What happened to Exhibit 14?"]
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
4a. **Right-rail cards summarize without replacing the timeline (Phase 8).** The Objection, Chain of Custody, and Jury Package checklist cards beside the timeline (US-10.3) are a faster at-a-glance summary of facts already in the timeline/header — they read the same `getExhibitHistory` payload, never a separate query, so "what happened" (timeline) and "what does that mean for action" (right rail) can never diverge.
5. **Independent cross-check available.** The user can open the assistant and ask the same question as a trust-verification step — the screen and the assistant are guaranteed to agree because both read the identical service-layer function (JRN-02.2 Delight Opportunity).
6. **Sealed exhibit behavior.** If the exhibit is sealed and the viewing role is unauthorized, this entire flow dead-ends at a plain "exhibit not found" — visually and textually identical to a truly nonexistent exhibit ID, never revealing that sealed material exists (US-10.2).

**Key UX Risk Guarded Against:** If the timeline were ever incomplete or required cross-referencing a second screen, the deputy/judge would revert to manually reconstructing fragments — undermining the entire value proposition (JRN-02.2 Risk of Abandonment). Completeness and single-screen sufficiency are non-negotiable design constraints here.
### Flow 4: Assembling, Verifying, and Accepting the Jury Package

**Trigger:** At the close of evidence, the deputy/clerk must assemble a jury package that is provably free of discrepancies; the judge must accept it with confidence; an attorney may independently verify it first.
**User Stories:** US-5.1, US-5.2, US-6.1, US-6.2, US-6.3, US-11.1, US-11.2, US-11.3, US-16.2, US-23.1, US-23.2, US-23.3
**Journeys:** JRN-02.1 (Assemble the Jury Package), JRN-01.2 (Jury Package Presented → Accept), JRN-03.1 (Verify Jury Package Integrity)

**Phase 8 presentation note:** the "Draft package renders — each row: CLEAN or FLAGGED" step below is, as of Phase 8, a per-exhibit **card** (grouped into Blockers/Clean sections with a progress banner), not a flat table row — see `Screen-03-jury-package.md` §Layout — Draft State (Phase 8: Card-Per-Exhibit, Blockers/Clean). The flow's logic (compute → flag → fix-or-acknowledge → gate → finalize) is unchanged; only the visual grouping changed. Additionally, a role outside the finalize-authorized set now has an explicit "Request finalization from Clerk" step available in place of a disabled Finalize button — see step 12 below (US-11.3).

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
    └── Zero open discrepancies ──▶ [Package → FINALIZED as a new,
          immutable, numbered Version N; screen becomes read-only;
          prior versions (if any) remain independently retrievable]
    │
    ▼
[Judge reviews finalized package — "zero discrepancies" confirmation
 stamped prominently, with its version number] ──▶ [Accepts with confidence]
    │
    ▼
[Deputy exports Version N as a real PDF (⬇) — not window.print()]
    │
    ▼
[Deputy optionally "Starts New Draft" for the next version, without
 touching Version N, which stays exportable from Version History]
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
6. **Finalized state is visually and functionally different.** Once `FINALIZED`, the screen switches to a read-only, export-ready presentation — all acknowledge/resolve/remove controls disappear entirely, not just disable (US-11.2).
7. **The judge's acceptance moment is explicit.** The finalized view carries an unmissable "FINALIZED · Version N (most recent) · Zero discrepancies" confirmation banner, so accepting the package is a fast, confident action rather than requiring independent re-verification (JRN-01.2).
8. **The attorney's verification path is identical, not separate.** Marcus doesn't need a special "audit view" — the same Jury Package Workspace (view-only for his role) and the same assistant answer serve his independent-verification need (JRN-03.1).
9. **Finalizing mints a version, it does not replace anything (F23).** Each successful finalization is assigned the case's next sequential version number and becomes a permanent, independently-retrievable snapshot — a "Start New Draft" action (role-gated identically to Finalize) begins the next package's lifecycle without touching the version that was just created. Every prior version remains independently viewable and exportable from "View Version History," never superseded or hidden by a later one (US-23.1, US-23.3).
10. **Export is a real file, not a print dialog (F23).** "Export as PDF" streams a server-generated `application/pdf` file via `@react-pdf/renderer` and triggers an actual download — replacing the prior `window.print()` control, which behaved inconsistently printer-to-printer and device-to-device. Re-exporting the same version at any later date reproduces an identical file, since a `FINALIZED` package's exhibit rows are immutable (US-23.2).
11. **Chambers-ex-parte material is excluded identically to sealed material (F16).** The candidate-query exclusion that keeps sealed exhibits out of a jury package now runs against the full three-value `classification` field, not just the `isSealed` boolean — a `CHAMBERS_EX_PARTE` exhibit is hard-excluded exactly as a `SEALED` one always was, with the same "Remove from Package" remediation path available for any legacy/regression case (US-16.2).
12. **A non-finalizing role requests finalization instead of hitting a dead end (Phase 8, F11, US-11.3).** When the judge (or chambers staff/attorney) reviews a clean draft but cannot finalize it directly, "Request finalization from Clerk" replaces the Finalize control in the same position — clicking it records a lightweight, auditable notification (`finalizationRequestedAt`/`finalizationRequestedBy`) and surfaces a banner to the next `DEPUTY`/`CLERK`/`ADMIN` who opens the same draft. This confers no finalize authority and bypasses no gate — it is purely a "please take this action" signal routed to someone who can.
13. **Blockers carry their fix inline, not just a link-through (Phase 8, F24).** Where the pre-Phase-8 flow's only remediation path was "navigate to Exhibit Detail, fix there," a Blockers card now also offers the fix directly on the card — "Record ruling" for an unresolved objection, "Assign custodian" for a custody gap — invoking the same F24 actions available on Exhibit Detail and the Command Center, so a deputy assembling the package doesn't need to leave this screen for the two most common blocking conditions (US-24.1, US-24.2).

**Key UX Risk Guarded Against:** This flow is identified in JOURNEYS as the single highest-stakes moment in the entire product — a discrepancy surfaced incorrectly here breaks trust for three personas simultaneously (deputy, judge, attorney). The hard-disabled button plus mandatory server re-validation is a deliberate belt-and-suspenders design, not redundant engineering.
## Screen Designs

### Screen: Trial Command Center

**Purpose:** A near-zero-configuration ambient view of trial activity, per-status exhibit counts, a prioritized attention feed, custody-by-custodian, and jury-package progress — designed for a glance during a recess, now also the fastest path to resolve the two most time-sensitive write actions (record a ruling, transfer/assign custody) at the exact point the system has already flagged they're needed.
**User Stories:** US-8.1, US-8.2, US-8.3, US-8.4, US-15.4, US-15.5, US-24.1, US-24.2
**Journey:** JRN-01.2 (Glance During Recess, Spot a Flag)
**Route:** `/command-center` · **Nav:** Sidebar "Command Center" (default landing screen)

> **Design decision supersedes a prior constraint (Phase 8, F24):** Phase 5 locked in "the Command Center exposes no path to record, edit, or acknowledge anything from that screen — it is strictly passive/read-only monitoring" as a success criterion. Phase 8 **deliberately reverses this for exactly two inline actions** on the "Needs your attention" feed below — "Record ruling" and "Transfer custody"/"Assign custodian" — because `recordRuling` and `recordCustodyTransfer` had no UI surface anywhere in the product until this phase, and the attention feed is the screen that has already identified precisely which objection or custody gap needs resolving. This is a traceable product decision, not a regression: **every other panel on this screen remains strictly read-only**, exactly as Phase 5 specified — Recent Activity, the stat cards, the status-distribution bar, the Jury Package summary widget, and the Custody-at-a-Glance panel's exhibit listings are all link-through-only, with zero data-entry controls of their own. Both inline actions require an explicit confirm step and are gated by F20's role matrix (absent, not disabled, for an unauthorized role) — see `Y0-patterns.md` §Pattern: Attention Feed Inline Action.

#### Layout — Phase 5/7 Baseline (Recent Activity, Unresolved Objections, Discrepancies)

*(Retained below for continuity with the pre-Phase-8 panel set; see **Layout — Phase 8 (Full Screen)** further down for the complete current screen, which wraps these panels alongside the new stat row, attention feed, jury package widget, and custody panel.)*

```
┌──────────────────────────────────────────────────────────────────┐
│ JudicialSync   [Case: 2026-CR-0142]      [Role: Judge ▾] [Ask Pivota] │
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

#### Layout — Phase 8 (Full Screen, Pre-Phase-9 — Retained for Traceability)

*The diagram below is the exact pre-Phase-9 presentation this screen replaced — full-height stat cards, a card-per-entry attention feed, and a bare "updated Xs ago" timestamp. It is kept here only so the Phase 9 layout's changes (below) are auditable against their predecessor; the live screen renders the Phase 9 layout, not this one, as of this phase.*

```
┌──────────────────────────────────────────────────────────────────┐
│ JudicialSync  [Case: 2026-CR-0142 ▾] [⚠ 1] [Role: Judge ▾][Ask Pivota]│
████████████████┬──────────────────────────────────────────────────┤
█ ▸ Command Ctr █│  Trial Command Center            🕐 updated 3s ago│
█   Case        █│  ┌──────────┬──────────┬──────────┬───────────┐  │
█   Jury Pkg    █│  │ Open     │ Custody  │ Jury pkg │ Admitted  │  │
█   Assistant   █│  │ objections│ gaps    │ blockers │  7 of 10  │  │
█               █│  │    2     │    1     │    1     │           │  │
█               █│  └──────────┴──────────┴──────────┴───────────┘  │
█               █│  Where the 10 exhibits stand                     │
█               █│  ┌────────────────────────────────────────────┐  │
█               █│  │[MARKED 1][OFFERED 2][OBJECTED 2][ADMITTED 7]│  │
█               █│  │███░░░░░██████░░░░░░░░██████░░░░░░███████████│  │
█               █│  │ ■Marked ■Offered ■Objected ■Admitted ■Excl. │  │
█               █│  │                              ■Withdrawn     │  │
█               █│  └────────────────────────────────────────────┘  │
█               █│  Needs your attention                             │
█               █│  ┌────────────────────────────────────────────┐  │
█               █│  │ ⛔CRITICAL S-2 — ex parte in jury package   │  │
█               █│  │   [Review and remove →]                     │  │
█               █│  │ 🔴HIGH  Ex.9 — admitted, objection open     │  │
█               █│  │   raised 2:15 PM    [Record ruling]         │  │
█               █│  │ 🟠PENDING Ex.12 — objection unresolved      │  │
█               █│  │   raised 11:40 AM   [Record ruling]         │  │
█               █│  │ 🟡MEDIUM Ex.14 — admitted, no custodian     │  │
█               █│  │   detected 9:23 AM  [Assign custodian]      │  │
█               █│  └────────────────────────────────────────────┘  │
█               █│  ┌───────────────────────┬──────────────────────┐│
█               █│  │ Jury package          │ Custody at a glance  ││
█               █│  │ ──────────────────────│──────────────────────││
█               █│  │ 6 of 8 clean           │ D. Reyes: Ex.3, Ex.7 ││
█               █│  │ ███████████░░░░        │ C. Chen: Ex.9        ││
█               █│  │ [ Open jury package → ]│ ⚠ No custodian: Ex.14││
█               █│  └───────────────────────┴──────────────────────┘│
█               █│  ┌────────────────────────────────────────────┐  │
█               █│  │ RECENT ACTIVITY  [All][Status][Custody]      │  │
█               █│  │                  [Objections][Rulings]       │  │
█               █│  │ TODAY · OCT 8, 2026                          │  │
█               █│  │ ● Exhibit 14 — Admitted                      │  │
█               █│  │   Oct 8, 2026, 2:41 PM                       │  │
█               █│  │ ● Exhibit 7  — Custody transferred           │  │
█               █│  │   Oct 8, 2026, 2:38 PM                       │  │
█               █│  │ YESTERDAY · OCT 7, 2026                      │  │
█               █│  │ ● Exhibit 3  — MARKED → OFFERED              │  │
█               █│  │   Oct 7, 2026, 4:12 PM                       │  │
█               █│  │ ... (newest first, scrollable)               │  │
█               █│  └────────────────────────────────────────────┘  │
████████████████┴──────────────────────────────────────────────────┘
```

#### Layout — Phase 9 (Full Screen, Current)

Replaces the Phase 8 layout above with a compact first viewport: a single-row KPI tile strip (<=80px tall, each tile clickable), a `LiveIndicator` in place of the bare timestamp, and a dense DataTable for "Needs your attention" so at least 6 ranked rows are visible without scrolling at 1440×900 (T-01, T-02, T-15).

```
┌──────────────────────────────────────────────────────────────────┐
│ JudicialSync  [Case: 2026-CR-0142 ▾] [⚠ 1] [Role: Judge ▾][Ask Pivota]│
████████████████┬──────────────────────────────────────────────────┤
█ ▸ Command Ctr █│  Trial Command Center              ● Live        │
█   Case        █│  ┌─────────────┬────────────┬───────────┬─────────────┐│
█   Jury Pkg    █│  │Open objectns│Custody gaps│Jury pkg blk│Admitted 7/10││
█               █│  │     2    →  │    1    →  │    1    →  │          →  ││
█   Assistant   █│  └─────────────┴────────────┴───────────┴─────────────┘│
█               █│  Where the 10 exhibits stand                     │
█               █│  ┌────────────────────────────────────────────┐  │
█               █│  │[MARKED 1][OFFERED 2][OBJECTED 2][ADMITTED 7]│  │
█               █│  │███░░░░░██████░░░░░░░░██████░░░░░░███████████│  │
█               █│  └────────────────────────────────────────────┘  │
█               █│  Needs your attention                             │
█               █│  ┌─────────┬──────────────────┬──────────┬─────┬──────────┐│
█               █│  │ Exhibit │ Issue            │ Severity │ Age │ Action   ││
█               █│  ├─────────┼──────────────────┼──────────┼─────┼──────────┤│
█               █│  │ S-2     │ ex parte in pkg  │⛔CRITICAL│ 1h  │Review →  ││
█               █│  │ Ex. 9   │ open obj: hearsay│🔴HIGH    │26m  │Rec.ruling││
█               █│  │ Ex. 12  │ obj: relevance   │🟠PENDING │3h20m│Rec.ruling││
█               █│  │ Ex. 14  │ no custodian     │🟡MEDIUM  │5h   │Assign    ││
█               █│  │ ...     │ (>=6 rows visible at 1440×900)    │          ││
█               █│  └─────────┴──────────────────┴──────────┴─────┴──────────┘│
█               █│  ┌───────────────────────┬──────────────────────┐│
█               █│  │ Jury package          │ Custody at a glance  ││
█               █│  │ [ Open jury package → ]│ D. Reyes · C. Chen   ││
█               █│  └───────────────────────┴──────────────────────┘│
█               █│  RECENT ACTIVITY (latest 10)  [All][Status][...]  │
█               █│  TODAY · OCT 8, 2026                              │
█               █│  ● Exhibit 14 — Admitted · Oct 8, 2026, 2:41:07 PM│
█               █│  ● Exhibit 3 — 3 status changes ▾ (collapsed)     │
█               █│  ... (page scrolls normally, no nested scrollbox) │
█               █│  [ View all → ]                                   │
████████████████┴──────────────────────────────────────────────────┘
```

#### KPI Tile Row (reworked Phase 9, T-01, US-8.4 / F08 §Process step 2)

**Supersedes the Phase 8 Stat Card Row:** Phase 8 shipped four full-height, non-clickable cards with no drill-in path — purely informational numbers that cost viewport space without earning it, since every one of the four values has one obvious filtered destination. Phase 9 compresses the row into a single compact strip, **<=80px tall**, and makes each tile a Carbon `ClickableTile` linking straight to its destination — freeing the vertical space the "Needs your attention" table below needs to show >=6 rows without scrolling at 1440×900 (`Y1-responsive.md`).

Four tiles, left-to-right, each a bold number plus a short label, the whole tile clickable (visible hover/focus affordance, `cursor: pointer`, keyboard-focusable, Enter/Space activates):

| Tile | Value shown | Source | Links to |
|---|---|---|---|
| "Open objections" | count of all `ObjectionCurrentState` rows with `status = 'UNRESOLVED'`, case-wide | `getUnresolvedObjections(caseId)` (F2), unchanged query | The objections list — `/pending-rulings` (Pending-Ruling Queue) for a `JUDGE`; `/case?filter=awaiting-ruling` (Case Workspace, "Awaiting ruling" quick-filter chip) for every other role, since the Pending-Ruling Queue itself is judge-only (F21) |
| "Custody gaps" | count of `OPEN` `DiscrepancyFlag` rows with `ruleCode = 'ADMITTED_NO_CUSTODIAN'` | `getDiscrepancies(caseId)` (F6), unchanged query | `/case?filter=no-custodian` — Case Workspace filtered to exhibits with no custodian of record |
| "Jury package blockers" | count of current `JuryPackageExhibit` rows with `discrepancyStatus = 'FLAGGED'` (plus any CRITICAL sealed/ex-parte row) | current `JuryPackage` (F5), unchanged query | `/jury-package` — Jury Package Workspace, landing on the Blockers section |
| "Admitted X of Y" | `statusCounts.ADMITTED` over the case's total visible exhibit count | `statusCounts` field on `GET /api/cases/:id/activity` (F08 §Process step 2), unchanged | `/case?filter=admitted` — Case Workspace filtered to `ADMITTED` exhibits |

Each tile is still a pure link-through — no tile performs a write. `data-testid="command-center-kpi-tile-{key}"` (`open-objections` / `custody-gaps` / `jury-package-blockers` / `admitted`); `aria-label` states the full value and destination, e.g. `aria-label="2 open objections — view objections list"`.

#### Status-Distribution Bar (added Phase 8, F08 §Process step 2)

A single horizontal segmented bar beneath the KPI tile row, titled "Where the N exhibits stand," visualizing the same `statusCounts` breakdown proportionally (segment width ∝ count), with a color-keyed legend beneath matching the Status Badge Visual Convention pattern's existing per-status colors (`Y0-patterns.md` §Pattern: Status Badge Visual Convention) — no new color mapping is introduced for this bar, it reuses the status badge colors exactly. Hovering (or, on touch, tapping) a segment shows the exact count and status name as a tooltip; the bar itself does not navigate anywhere on click, consistent with the KPI tile row above.

#### "Needs Your Attention" Table (reworked Phase 9, T-02, US-8.4, F08 §Process steps 4–5, 9)

**Supersedes the Phase 8 card-feed description above.** Phase 8 rendered each attention entry as a full-width card (badge + label + summary + elapsed time + action button stacked vertically), which meant only 3–4 entries fit above the fold at 1440×900 — exactly the viewport this glance-screen is designed for. Phase 9 replaces the card feed with a dense Carbon `DataTable`, one row per entry, five columns — **Exhibit · Issue · Severity · Age · Action** — guaranteeing at least 6 ranked rows render without scrolling at 1440×900 (`Y1-responsive.md` §Desktop viewport contract):

| Column | Content |
|---|---|
| Exhibit | Exhibit label, rendered as a link (clicking the label navigates to Exhibit Detail View); the row itself is not a full click target — the Action column's button is the row's primary interaction |
| Issue | A one-line plain-language summary of the flagged condition. For `HIGH`/`PENDING` rows (both objection-scoped), the objection's grounds render inline in this same cell (e.g., "Admitted with unresolved objection — hearsay"), sourced from `getAttentionFeed`'s `objectionGrounds` field (F08 §Process step 9) — no extra click needed to see why the row is flagged. `objectionGrounds` is `null` for `CRITICAL`/`MEDIUM` rows, which are not tied to a single objection thread, and the Issue cell for those rows carries only the plain-language condition summary |
| Severity | The tier's Carbon `Tag` — four visually and iconographically **distinct** color+icon pairings per `Y0-patterns.md` §Pattern: Severity Tier Badge: `CRITICAL` dark red + a distinct icon, `HIGH` amber + a distinct icon, `PENDING` amber-light + a *different* icon from `HIGH` (not just a lighter version of the same amber — see `Y2-accessibility.md` §Color Contrast for the fix to the prior two-near-identical-ambers problem), `MEDIUM` yellow + a distinct icon. Color is never the only signal — the tier word and the icon both render alongside the color |
| Age | Elapsed time since `detectedAt` (`CRITICAL`/`HIGH`/`MEDIUM`) or `raisedAt` (`PENDING`), live-recomputed on each poll tick, rendered with tabular figures so values don't visually jitter as digits change (`Y2-accessibility.md` §Typography) |
| Action | Exactly one primary Carbon `Button` per row — **"Record ruling"** (`HIGH`/`PENDING`), **"Assign custodian"** (`MEDIUM`), **"Review and remove →"** link-through to the Jury Package Workspace's existing "Remove from Package" remediation (`CRITICAL`, F13 — not a new control) — rendered only for an F20-authorized role for that action (`JUDGE` for "Record ruling"; `DEPUTY`/`CLERK`/`ADMIN` for "Assign custodian"), absent (not disabled) otherwise, per `Y0-patterns.md` §Pattern: Role-Gated Control Visibility |

**Row order is server-authoritative, never re-sorted in the UI (F08 §Process steps 5, 9; T-02):** the table renders rows in exactly the order `getAttentionFeed` returns — `CRITICAL` → `HIGH` → `PENDING` → `MEDIUM`, never interleaved, newest-first within a tier. Column headers in this table are static labels, **not** interactive Carbon `DataTable` sort toggles — this table specifically does not offer click-to-sort on any column, since any client-side reorder (including an innocuous "sort by Age") would risk contradicting the service's tier precedence, which this screen must never do.

Clicking a row's Action button expands an inline confirm form directly beneath that row (not a modal, not a navigation) — same "inline, explicit confirm required, no optimistic update" contract Phase 8 established; see `Y0-patterns.md` §Pattern: Attention Feed Inline Action, which is unchanged in behavior by this card→table presentation swap.

**`data-testid`/`aria-label` contract (amended Phase 9 — supersedes the Phase 8 card selectors):**
- Table container: `data-testid="attention-feed-table"` (was `attention-feed`)
- Each row: `data-testid="attention-feed-row"` (was `attention-feed-entry`) with `aria-label` stating tier + exhibit + condition, e.g. `aria-label="High priority: Exhibit 9, admitted with unresolved objection"`
- Each action button: `data-testid="attention-feed-action-record-ruling"` / `data-testid="attention-feed-action-assign-custodian"` / `data-testid="attention-feed-action-review-remove"` (scoped per row via a `data-exhibit-id` attribute, since multiple rows can carry the same action type) — selectors unchanged from Phase 8
- Severity tag (per row): `data-testid="severity-badge"` with `aria-label="Severity: Critical"` (etc. per tier) — see `Y0-patterns.md` §Pattern: Severity Tier Badge

#### Jury Package Summary Widget (added Phase 8, US-8.4 context / F08 §Process step 6)

Compact card: "{clean} of {total} clean" progress bar (same clean/blocked counting as the Jury Package Workspace's own progress indicator, F11 — never computed independently) plus a single **"Open jury package →"** button navigating to `/jury-package`. Read-only — no finalize/acknowledge/remove action lives here, only the link-through.

**⚠ New `data-testid` needed:** `data-testid="command-center-jury-package-widget"`; button `data-testid="open-jury-package-button"`.

#### "Custody at a Glance" Panel (added Phase 8, US-8.3, F08 §Process step 3)

Groups exhibits by current custodian name, each group showing the custodian's name as a header followed by that custodian's exhibit labels (+ status); a exhibits with a pending (unconfirmed) transfer appear in a separate "Pending transfer to {name}" grouping, never folded into the destination custodian's bucket before confirmation. A distinct **"No custodian"** callout row lists every exhibit with no `CustodyCurrentState` row at all (the `ADMITTED_NO_CUSTODIAN` discrepancy condition), visually separated from the named-custodian groupings. Each custodian group exposes a "Transfer custody" entry point (F24) for F20-authorized roles only — absent for any other role.

**⚠ New `data-testid`/`aria-label` contract needed:**
- Panel container: `data-testid="custody-at-a-glance"`
- Each custodian group: `data-testid="custody-group"` with `aria-label="Custody group: {custodian name}, N exhibits"`
- No-custodian callout row: `data-testid="custody-group-no-custodian"` with `aria-label="N exhibits with no custodian of record"`
- Pending-transfer grouping: `data-testid="custody-group-pending"` with `aria-label="Pending transfer to {receiver name}"`
- Inline "Transfer custody" entry point per exhibit row within a group: `data-testid="custody-glance-transfer-action"`

#### Recent Activity — Page Scroll, Collapsed Rows, "View All" (reworked Phase 9, T-04, F15 Phase 9 addendum)

**Supersedes the Phase 8 presentation above.** Phase 8's Recent Activity panel scrolled inside its own fixed-height nested box — a container-within-a-container that made the panel feel cramped and hid most of the day's events behind an internal scrollbar most users never noticed. Phase 9 removes the nested scroll box entirely: the panel renders only its **latest 10 entries** (same `getRecentActivity` query, no backend change) inline in the page's normal flow, with a **"View all →"** link beneath the list navigating to a full, paginated activity page (`/command-center/activity`) for the complete history.

- **Filter pills** — `All` / `Status` / `Custody` / `Objections` / `Rulings` — unchanged from Phase 8: a client-side narrowing of the loaded 10-entry window, no new query parameter, not a "configuration control" in the Design Principle 4 sense.
- **Collapsed consecutive-transition rows (new, T-04):** consecutive `STATUS_CHANGE` events on the *same exhibit* within a 60-second window collapse into one expandable summary row (e.g., "Exhibit 3 — MARKED → OFFERED → ADMITTED (3 changes) ▾") instead of three separate rows — a pure UI-helper presentation grouping over the already-loaded response, duplicating no status logic from the service layer. Expanding the disclosure reveals each individual transition with its own full timestamp.
- **Timestamps always include seconds (new, T-04):** every Recent Activity timestamp — collapsed-row summary and expanded individual entries alike — renders through one shared formatter that always includes seconds (e.g., "Oct 8, 2026, 2:41:07 PM"), replacing the prior minute-precision format, so two events seconds apart are never visually identical.
- **Date-grouped headers, boundary definition reconciled (amended, T-04):** rows remain grouped under a bold date header ("TODAY · OCT 8, 2026", "YESTERDAY · OCT 7, 2026") whenever the window spans more than one day. The "TODAY"/"YESTERDAY" label now uses the exact same day-boundary definition the server applies to `since` (start-of-current-trial-day, `Y1-api.md` §4.9) instead of a separately-computed client-side local-midnight boundary — Phase 8's two independent definitions could disagree near a day crossing; Phase 9 removes the second definition so the heading label and the set of rows it groups can never disagree.

**`data-testid` contract (amended Phase 9):** filter pill row `data-testid="activity-filter-pills"`, each pill `data-testid="activity-filter-pill-{type}"` (unchanged from Phase 8); date group header `data-testid="activity-date-group-header"` (unchanged); collapsed-row disclosure `data-testid="activity-collapsed-row"` with `aria-expanded` reflecting state (new); "View all" link `data-testid="activity-view-all-link"` (new).

#### Live Indicator (new, Phase 9, T-15, F08 Phase 9 addendum)

**Replaces the bare "🕐 updated Xs ago" freshness text (Phase 5–8) with a labeled, stateful indicator.** A `LiveIndicator` component renders in the page header, beside the screen title, driven by the same TanStack Query polling state (`dataUpdatedAt`, `isError`) already backing every Command Center query — no new endpoint, no change to the existing 3–5s polling interval (`Y0-patterns.md` §Pattern: Polling-Based Live Sync Indicator remains the underlying mechanism; `LiveIndicator` is its Phase 9 visual upgrade):
- **Fresh** (`dataUpdatedAt` less than 60s old): a small green dot plus the word **"Live"** — `data-testid="live-indicator"`, `aria-label="Data is live, updated less than a minute ago"`.
- **Stale** (`dataUpdatedAt` 60s or older, or `isError`): the dot turns amber and the label changes to **"Connection lost"**, paired with a **"Refresh"** button that triggers an immediate manual refetch of every Command Center query — `data-testid="live-indicator-refresh-button"`.

This fixes the prior "present and unexplained" freshness text — a raw "updated 3s ago" string gave no cue about what "stale" would even look like — with a state that is unambiguous in both its good and bad states (`Y0-patterns.md` §Pattern: Labeled Header Indicator shares the same "never present and unexplained" spirit, applied here to freshness rather than a count).

#### Information Hierarchy

| Priority | Content | Placement |
|----------|---------|-----------|
| Primary | "Needs your attention" DataTable, severity-ranked, >=6 rows visible without scrolling at 1440×900 (reworked Phase 9) | Below the status-distribution bar, above the two-column Jury Package/Custody row |
| Primary | Discrepancies panel (count + list) — the highest-risk signal (retained) | Right column of the baseline two-column row, visually distinct (warning color), never below the fold |
| Primary | KPI tile row (Open objections / Custody gaps / Jury package blockers / Admitted X of Y), compact <=80px, each tile clickable through to its filtered view (reworked Phase 9) | Top of screen, directly beneath the screen title — first thing seen |
| Primary | Recent Activity feed — the ambient pulse of the trial | Lower panel, newest-first, page-scrolled (no nested scrollbox), latest 10 + "View all" (reworked Phase 9) |
| Primary | Exhibit label + full date-and-time (with seconds) on every Recent Activity row (incl. raw status-transition rows) | Same row, never summarized away (US-15.4, US-15.5) |
| Secondary | Status-distribution bar (added Phase 8) | Directly beneath the KPI tile row |
| Secondary | Jury Package summary widget + Custody-at-a-Glance panel (added Phase 8) | Two-column row beneath the attention table |
| Secondary | Unresolved Objections panel (retained) | Left of the baseline two-column lower row |
| Tertiary | `LiveIndicator` ("Live" / "Connection lost" + Refresh) (reworked Phase 9) | Page header, beside the screen title |

#### States

| State | Appearance | User Feedback |
|-------|------------|----------------|
| Default (activity exists) | All seven panels/widgets populated as above | None needed — ambient |
| Loading (initial load) | Skeleton rows in every panel, including the KPI tile row, attention table, jury package widget, and custody panel | Subtle shimmer, no spinner text |
| Empty — no activity yet | Recent Activity panel shows "No activity recorded yet today" | Calm, non-alarming copy |
| Empty — no unresolved objections | "No unresolved objections — all clear" with a quiet checkmark | Reinforces confidence, not silence-as-ambiguity |
| Empty — attention table has zero rows | "Nothing needs your attention right now" with a quiet checkmark, same calm-empty-state treatment as the Unresolved Objections panel, rendered in place of the table | Confirms "empty" is a positive, not an error/loading state (parallels US-8.1's "no unresolved objections" precedent) |
| Discrepancy present | Discrepancies panel header turns warning-amber, count badge visible from across the room | Visually "impossible to scroll past unnoticed" per US-8.1 |
| Attention table row present (any tier) | Severity tag renders in its fixed, tier-distinct color+icon pairing (`CRITICAL` dark red / `HIGH` amber / `PENDING` amber-light with a different icon than `HIGH` / `MEDIUM` yellow) per `Y0-patterns.md` §Pattern: Severity Tier Badge | Tier is never conveyed by color alone — the tier word and icon both render alongside the color (T-02, `Y2-accessibility.md`) |
| Attention table inline action — form open, awaiting confirm | Inline form expands directly beneath the row (disposition selector or custodian picker); the row's other cells remain visible above the form | Explicit "Submit"/"Confirm" control distinct from the button that opened the form — no auto-submit (US-24.1, US-24.2) |
| Attention table inline action — in flight | Submit control shows a brief inline spinner; form remains open, non-interactive | Prevents double-submit |
| Attention table inline action — success | Row fades out (ruling resolved) or re-ranks (reserved ruling; custody re-evaluated) on the next poll tick | No screen-local optimistic removal — the row only changes once the poll confirms the new ledger state (F24 §Process step 5/6) |
| Attention table inline action — rejected (e.g., `403 ROLE_NOT_PERMITTED`, `409 OBJECTION_ALREADY_RESOLVED`, `409 CUSTODY_CHAIN_BROKEN`) | Inline error message within the still-open form, naming the specific rejection reason; row remains in the table unchanged | Never a silent failure or generic toast — matches the reject-with-reason pattern (US-24.1, US-24.2) |
| Attention table action unavailable for current role (F20) | Row renders with its context (exhibit, issue, severity, age) but no action button in the Action column | Absent, not disabled — `Y0-patterns.md` §Pattern: Role-Gated Control Visibility |
| KPI tile clicked (new, Phase 9) | Navigates immediately to the tile's filtered destination (see §KPI Tile Row table above) | Standard link-through hover/focus affordance; no confirm step, since no write occurs |
| Custody-at-a-glance — exhibit with no custodian | Rendered in the distinct "No custodian" callout row, never silently grouped under a blank/empty custodian heading | Confirms a custody gap is visible at the panel level, not only via the discrepancy count (US-8.3) |
| Custody-at-a-glance — pending transfer | Exhibit appears under a "Pending transfer to {name}" grouping, not the sending or receiving custodian's regular bucket | Never silently implies the transfer has already completed (US-8.3, consistent with F19's pending-state treatment on Exhibit Detail) |
| Jury package widget — no package computed yet | "No jury package started yet" in place of the progress bar, with the same "Open jury package →" link-through | Matches the Jury Package Workspace's own "no package started yet" empty state (F11) rather than showing a misleading 0-of-0 bar |
| Live update arrives | New row fades in at top of Recent Activity (no jarring re-sort/flash); KPI tile counts and the distribution bar update in place with the same ~400ms highlight fade used elsewhere; `LiveIndicator` stays "Live" as long as the poll keeps landing within 60s | No toast needed — ambient by design |
| `LiveIndicator` goes stale (new, Phase 9) | Dot turns amber, label changes to "Connection lost," Refresh button appears beside it | Unambiguous, labeled degradation — never a silently-stale "updated Xs ago" string growing larger (T-15) |
| `LiveIndicator` Refresh clicked (new, Phase 9) | Triggers an immediate manual refetch of every Command Center query; indicator returns to "Live" once the refetch lands within 60s | Gives the user an explicit recovery action instead of waiting for the next poll tick |
| Recent Activity row rendering (any event type) | Every row shows both date and time of `recordedAt`, always including seconds ("Oct 8, 2026, 2:41:07 PM," never time-only or minute-only) and the exhibit's label, including rows describing a raw `STATUS_CHANGE` transition ("Exhibit 3 — MARKED → OFFERED") | Two events seconds apart are never visually indistinguishable; no row is ever unattributed to an exhibit (US-15.4, US-15.5, T-04) — see `Y0-patterns.md` §Pattern: Activity Feed Row Format |
| Recent Activity — consecutive same-exhibit transitions (new, Phase 9) | Collapses into one expandable row ("Exhibit 3 — 3 status changes ▾"); expanding reveals each individual transition with its own full timestamp | Reduces noise from rapid logging without hiding any event — nothing is dropped, only grouped (T-04) |
| Recent Activity filter pill selected (Phase 8) | Selected pill shows an active/pressed visual state; list narrows to matching event types only, date-group headers retained | Client-side only — no reload, no change to the underlying `getRecentActivity` response |
| Recent Activity — "View all" clicked (new, Phase 9) | Navigates to the full, paginated activity page (`/command-center/activity`) | Confirms the 10-entry panel is a summary, not the entire record (T-04) |
| Load failure (any panel) | Full-panel inline error: "Unable to load trial activity — please retry" (baseline panels) or "Unable to load the attention feed — please retry" (`ATTENTION_FEED_LOAD_FAILED`, attention table specifically) with a retry button | Non-blocking — every panel attempts to load independently; one panel's failure never blocks another's render |

#### Interactive Elements

| Element | Type | Behavior |
|---------|------|----------|
| Recent Activity row | Link-through | Navigates to that exhibit's Exhibit Detail View (US-8.2), landing scrolled to the relevant event |
| Unresolved Objection row | Link-through | Navigates to Exhibit Detail View, objection section highlighted |
| Discrepancy row | Link-through | Navigates to Exhibit Detail View (or directly to the flagged row in Jury Package Workspace if already drafted) |
| "Ask Pivota" header button | Global | Opens Pivota Assistant slide-over without leaving this screen |
| KPI tile (×4, reworked Phase 9) | `ClickableTile`, link-through | Navigates to the tile's named filtered destination (see §KPI Tile Row table); no write, no confirm step; `data-testid="command-center-kpi-tile-{key}"` (T-01) |
| `LiveIndicator` "Refresh" button (new, Phase 9) | Action | Triggers an immediate manual refetch of every Command Center query; rendered only while the indicator is in its stale/"Connection lost" state; `data-testid="live-indicator-refresh-button"` (T-15) |
| Attention table "Record ruling" button (reworked Phase 9) | Inline write action | Expands the disposition selector (Sustained/Overruled/Reserved) directly beneath the row; explicit confirm required; rendered only for `JUDGE` role (F24, US-24.1); `data-testid="attention-feed-action-record-ruling"` |
| Attention table "Assign custodian" button (reworked Phase 9) | Inline write action | Expands a custodian picker (first-time assignment path) directly beneath the row; explicit confirm required; rendered only for `DEPUTY`/`CLERK`/`ADMIN` (F24, US-24.2); `data-testid="attention-feed-action-assign-custodian"` |
| Attention table "Review and remove →" link (`CRITICAL` tier, reworked Phase 9) | Link-through | Navigates to the Jury Package Workspace's existing "Remove from Package" remediation (F13) — not a new write action; `data-testid="attention-feed-action-review-remove"` |
| Jury package widget "Open jury package →" button (added Phase 8) | Link-through | Navigates to `/jury-package`; `data-testid="open-jury-package-button"` |
| Custody-at-a-glance "Transfer custody" entry point (added Phase 8) | Link-through / inline write action | Opens the same custody assignment/propose form as the Exhibit Detail header (F24); rendered only for `DEPUTY`/`CLERK`/`ADMIN`; `data-testid="custody-glance-transfer-action"` |
| Recent Activity filter pills (added Phase 8) | Toggle group | Client-side narrowing of the already-loaded activity list by event-type category; `data-testid="activity-filter-pill-{type}"` |
| Recent Activity collapsed-row disclosure (new, Phase 9) | Disclosure toggle | Expands/collapses a grouped set of consecutive same-exhibit status changes in place; `data-testid="activity-collapsed-row"` (T-04) |
| Recent Activity "View all →" link (new, Phase 9) | Link-through | Navigates to the full, paginated activity page (`/command-center/activity`); `data-testid="activity-view-all-link"` (T-04) |

**Explicitly absent by design (US-8.1), amended Phase 9:** no filters, no date pickers, no "configure this view" settings on any panel **except** the two F24 write actions on the "Needs your attention" table ("Record ruling," "Transfer custody"/"Assign custodian") and the purely-client-side Recent Activity filter pills (which narrow already-loaded data, writing nothing). Every other element on this screen — KPI tiles, status-distribution bar, Jury Package widget, Custody-at-a-Glance exhibit listings, Recent Activity, Unresolved Objections, Discrepancies — remains link-through-only; it never writes to the ledger. The KPI tiles (Phase 9) are clickable, but clicking one navigates — it never configures or filters this screen itself.

**Full timestamp + label rule (F15, seconds added Phase 9):** every Recent Activity row renders both the date and the time of `recordedAt`, always including seconds — never time-only, never minute-only — and always includes the event's exhibit label as part of the rendered summary, with no exception for raw `STATUS_CHANGE` rows (US-15.4, US-15.5, T-04). This uses the `exhibitLabel` field already present in the activity API response — a rendering fix, not a data-contract change.
### Screen: Case Workspace

**Purpose:** The primary browsing and searching surface for the full exhibit set — one trustworthy list instead of a spreadsheet — now also the primary one-click triage surface for attention/custody/ruling status and jury-package readiness.
**User Stories:** US-9.1, US-9.2, US-9.3, US-4.1, US-1.1, US-1.2, US-3.1, US-3.2, US-2.1, US-15.1, US-12.1, US-12.2, US-16.1, US-18.1, US-18.2, US-19.1, US-20.1, US-20.2, US-20.3, US-20.4
**Journey:** JRN-02.1 (Log Exhibit Activity, Answer a Custody Question, Search Mid-Testimony)
**Route:** `/case` · **Nav:** Sidebar "Case Workspace"

#### Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ JudicialSync  [Case: 2026-CR-0142 ▾] [⚠ 1] [Role: Deputy ▾][Ask Pivota]│
├───────────────┬──────────────────────────────────────────────────┤
│ Command Ctr   │  Case Workspace                  [+ New Exhibit] │
│ ▸ Case        │  [All 10] [Needs attention 3] [In my custody 2]  │
│ Jury Pkg      │  [Awaiting ruling 2]                              │
│ Assistant     │  ┌──────────────────────────────────────────────────┐│
│               │  │ Search [🔍 Search exhibits...]  Status ▾  Witness ▾││
│               │  │                                 (searchable)       ││
│               │  │ From [__________]  To [__________]                 ││
│               │  │ Showing 7 of 10            [ Clear filters ]       ││
│               │  └──────────────────────────────────────────────────┘│
│               │  ┌────────────────────────────────────────────────────────────┐│
│               │  │ Label  Description (wraps, full width)  Party Witness Status  Custodian  Flags  Jury Pkg││
│               │  │ Ex. 14 Blood sample, lab-sealed, chain   PROS  Smith  ●ADMITTED –        No      Blocked ││
│               │  │         of custody intact through intake                              custodian       ││
│               │  │ Ex. 7  Phone records, provider subpoena  DEF   —      ●OFFERED  D.Reyes  —       (blank)││
│               │  │ Ex. 9  Email thread, three messages       PROS  Lee    ●OBJECTED C.Chen   Open    (blank)││
│               │  │                                                          objection               ││
│               │  │ Ex. 3  Contract, signed copy               PLAIN —      ●MARKED   D.Reyes  Ruling  (blank)││
│               │  │                                                       → pending:    pending      ││
│               │  │                                                          C.Chen                      ││
│               │  │ Ex. 5  Inspection report, 4 pages          PROS  Lee    ●ADMITTED D.Reyes  —       Included││
│               │  │ ... (polling live, 3–5s; no zebra stripes — rows plain, attention rows tinted)         ││
│               │  └────────────────────────────────────────────────────────────┘│
└───────────────┴──────────────────────────────────────────────────┘
   entire row (hover: highlight + cursor:pointer) ──▶ Exhibit Detail View (/exhibit/:id)
   "+ New Exhibit" is absent entirely for JUDGE/CHAMBERS_STAFF/ATTORNEY roles (F20) — see Pattern: Role-Gated Control Visibility
```

**Quick-filter chips (added Phase 8, US-9.3):** a row of one-click chips — **All N / Needs attention N / In my custody N / Awaiting ruling N** — directly above the search bar, each with a live count badge. Selecting a chip narrows the visible row set immediately, without requiring the search bar or any dropdown — "All" is selected by default and shows the full visible (role-filtered) exhibit count. Matching rules: "Needs attention" matches at least one `OPEN` discrepancy flag OR at least one `UNRESOLVED` objection thread; "In my custody" matches `CustodyCurrentState.currentCustodianUserId` equal to the signed-in user; "Awaiting ruling" matches at least one `UNRESOLVED` objection thread (a narrower, ruling-specific lens on the same underlying condition "Needs attention" also surfaces more broadly). Chips are mutually exclusive (single-select, like a tab strip, not independently combinable toggles) and compose with an active search/filter query exactly as a dropdown filter would — selecting a chip while a search is active narrows the *search results* by the chip's condition, not a separate, parallel list. Chips re-evaluate on every live-sync poll tick so counts and membership stay current without a manual refresh.

**⚠ New `data-testid` needed:** chip row `data-testid="quick-filter-chips"`; each chip `data-testid="quick-filter-chip-{key}"` (`all` / `needs-attention` / `in-my-custody` / `awaiting-ruling`), each carrying `aria-pressed` to reflect single-select state for assistive technology.

**Jury Package column — four values, non-admitted rows blank (reworked Phase 9, T-06, F09 §Process steps 3–4):** **Supersedes the Phase 8 three-value description above**, which folded "never assessed yet" and "structurally excluded" into one `Not eligible` value and showed `Not eligible` even on exhibits that had never been offered. The rightmost table column now renders one of **four** color-coded tag values per row, in this precedence: **Included** (green) — package member, clean; **Blocked** (amber) — package member, open discrepancy; **Not eligible** (neutral/grey) — a *permanent, structural* exclusion (sealed/ex-parte classification, or explicitly `EXCLUDED` from a package); **Not yet evaluated** (neutral, visually distinct from `Not eligible`) — admitted, but never run through package computation (no `JuryPackage` ever computed for the case, or computed before this exhibit was admitted). Computed identically to, and never diverging from, the Jury Package Workspace's own per-exhibit status and the Exhibit Detail checklist (F9 §Process step 3 = F11's row-level grouping = F10's checklist card). **For any exhibit whose `currentStatus` is not `ADMITTED`, the column renders no tag at all (blank cell)** — an eligibility tag on an exhibit that hasn't even been offered is noise, not signal; the service still computes and returns a value for these rows, the UI simply suppresses rendering it. `data-testid="exhibit-row-jury-package-badge"` with `aria-label="Jury package status: Blocked"` (etc. per value) — selector unchanged from Phase 8, value set extended.

**No zebra striping; attention-row tint retained (reworked Phase 9, T-06):** the table no longer alternates row background colors. The only row-level background emphasis is the existing attention/discrepancy tint (a subtle highlight on a row carrying an `OPEN` discrepancy flag or `UNRESOLVED` objection) — unaffected by this change and still the sole visual differentiator between rows beyond hover/focus state.

**Description column — full remaining width, wraps (reworked Phase 9, T-06):** the description cell no longer truncates with an ellipsis. It takes whatever width remains after every other column has its content-driven width, and wraps onto multiple lines rather than clipping — the full description is always visible in the row itself, with no separate "hover or detail view to read it" step required.

**Flags column — readable text pills, not icon-only (amended Phase 8, Design Principle 7):** the existing discrepancy/objection/custody indicator column is relabeled "Flags" and now renders a short readable text pill per condition rather than a bare icon requiring a hover to understand — "Ruling pending" (unresolved objection), "No custodian" (`ADMITTED_NO_CUSTODIAN` discrepancy), "Open objection" (unresolved thread on a not-yet-admitted exhibit), "Ex parte · restricted" (chambers-ex-parte/sealed classification visible to an authorized role). A row with zero applicable flags shows an em-dash ("—"), not a blank cell. Multiple simultaneous flags stack as multiple pills in the same cell, never collapsed into a single generic "⚠" glyph. This does not change the underlying discrepancy/objection data — it is a presentation-only amendment to the same column Phase 7 already shipped (`Y0-patterns.md` §Pattern: Discrepancy Flag Treatment, unchanged in substance). `data-testid="exhibit-row-flag-pill"` per pill (new as of Phase 8) — the pre-existing `data-testid="exhibit-row"` and the row's discrepancy-icon hover/click behavior are otherwise unchanged (US-24.3).

**"+ New Exhibit" intake flow (US-16.1, US-18.1, US-18.2, F16, F18):** opens a compact inline panel at the top of the table — not a full-screen modal, consistent with this screen's existing "assistant, not data-entry system" positioning, just a larger instance of the same Inline Row Actions pattern. The panel asks for identity fields (label, description, source, offering party, witness) plus two fields new as of Phase 7.1:
- **Classification** (required, one of `TRIAL` / `CHAMBERS_EX_PARTE` / `SEALED`, presented as a 3-option radio group) — accompanied by always-visible inline copy: "Classification cannot be changed after the exhibit is created." No edit/reclassify action exists anywhere in the UI for any role, by design (US-16.1).
- **Custodian** (required to complete the intake action) — presented as the final field in the same panel, labeled "Custodian (required to mark this exhibit into evidence)." From the user's point of view this is one seamless submission; underneath, it fires `POST /api/exhibits` immediately followed by the exhibit's first `POST /api/exhibits/:id/events/status` (`toStatus: MARKED`) call carrying the supplied custodian — presented as a single atomic step with a single "Create & Mark into Evidence" submit button, matching F18's "no separate manual step a user could skip" guarantee. If either call fails, the panel reports the specific error and the exhibit does not appear in the list in a half-created state.
- The "+ New Exhibit" action itself is absent (not disabled) for any role outside `DEPUTY`/`CLERK`/`ADMIN` (F20 row 1) — see `Y0-patterns.md` §Pattern: Role-Gated Control Visibility.

**Custody status in the table (F19):** the custodian column renders one of three states per row — a plain name (settled), "No custodian of record" (triggers the `ADMITTED_NO_CUSTODIAN` discrepancy if the exhibit is also `ADMITTED`), or a compact "{current custodian} → pending: {named receiver}" indicator when a transfer has been proposed but not yet confirmed. The pending indicator is a summary only — Confirm/Cancel actions live on the Exhibit Detail View (see `Screen-02-exhibit-detail.md` §Custody section); clicking the indicator (or the row) navigates there. See `Y0-patterns.md` §Pattern: Two-Phase Custody Handoff.

**Row clickability fix (US-15.1):** the full row container — not a nested link, icon, or label span — is the click target, across its entire width, for every row regardless of discrepancy-flag state. A visible hover affordance (row background highlight, `cursor: pointer`) confirms this before the click. The row is keyboard-focusable; `Enter`/`Space` navigates identically to a click. Inline row-level actions (Record Status, Propose Custody Transfer, Raise Objection, the ⚠ discrepancy icon) stop click-propagation so operating them never also triggers row navigation — see `Y0-patterns.md` §Pattern: Fully Clickable List Row.

**Filter bar — labeled fields, searchable Witness select, result-count readout (reworked Phase 9, T-07, F09 Phase 9 addendum):** **Supersedes the unlabeled filter bar implied by the Layout diagram's prior wording.** Every filter — Search, Status, Witness, From, To — now carries a visible Carbon field label (not just a placeholder string standing in for a label); From and To are explicitly labeled as date-range bounds (not a single ambiguous "Date" control), so it is never unclear which end of a range a date picker sets. The prior helper line ("Active filters: witness=Smith [× clear]") is replaced by a plain, always-current **"Showing X of Y"** result-count readout plus a single **"Clear filters"** action — never a sentence a user has to parse to learn how many rows are currently hidden.
- **Witness filter** is a searchable Carbon `ComboBox` (not a free-text field and not a fixed hardcoded list) built from the distinct `associatedWitness` values already present in the currently-loaded exhibit list — typing narrows the option list, selecting one adds it as a combinable filter exactly as the Status dropdown does.
- **Query selection**: `getExhibits` (no filters active) and `searchExhibits` (>=1 filter set) are each called only when appropriate, so a state with zero active filters never accidentally calls `searchExhibits` with empty criteria and trips `EMPTY_SEARCH_CRITERIA` (F4).
- AND semantics across combined filters are unchanged — adding a second filter narrows further, it never widens or replaces the first.
- `data-testid` additions: `data-testid="filter-result-count"` (the "Showing X of Y" readout), `data-testid="filter-clear-button"` ("Clear filters"), `data-testid="witness-filter-combobox"` (new, replaces a prior plain dropdown selector if one existed).

#### Information Hierarchy

| Priority | Content | Placement |
|----------|---------|-----------|
| Primary | Exhibit label + current status badge | Leftmost columns, largest visual weight |
| Primary | Quick-filter chips (added Phase 8) | Directly above the search bar — first interactive element encountered after the screen title |
| Primary | Flags column (readable text pills, amended Phase 8) | Same row as before, now labeled text instead of icon-only — visible without drill-in (US-9.2) |
| Secondary | Jury Package eligibility column (four values, reworked Phase 9) | Rightmost table column, blank for non-admitted rows |
| Secondary | Current custodian name | Mid-row column |
| Secondary | Offering party, associated witness | Mid-row columns |
| Secondary | Labeled filter bar + "Showing X of Y" result count (reworked Phase 9) | Directly above the table, every field visibly labeled |
| Tertiary | Description (full width, wraps — reworked Phase 9) | Takes the table's remaining width; no truncation, no ellipsis, no hover-to-read |

#### States

| State | Appearance | User Feedback |
|-------|------------|----------------|
| Default list | Full case exhibit list, role-filtered, sorted by `exhibitLabel` | None |
| Search/filter active (reworked Phase 9) | List replaced by filtered results; each active filter's labeled field shows its current value; "Showing X of Y" readout updates to the filtered count | The result-count readout makes "what's currently applied, and how much it narrowed" obvious at a glance — replaces the prior ambiguous helper sentence (T-07) |
| Empty search result | "No exhibits match these filters" + a one-click "Clear filters" action ("Showing 0 of Y") | Non-blaming copy; never implies user error |
| Empty case (no exhibits yet) | "No exhibits recorded yet" | Rare in demo (seed data guarantees content) but designed for completeness |
| Sealed exhibit, unauthorized role | Row simply absent — no redacted placeholder row | Confirms US-9.1: sealed exhibits are invisible, not indicated |
| Live update arrives | Status badge or custodian cell updates in place, subtle highlight flash (~400ms) then settles | No full-table re-render/flicker |
| Row hover / keyboard focus | Full row background highlights and shows `cursor: pointer`; focus ring outlines the entire row, not just a sub-element | Confirms the whole row — not a hidden nested link — is the click/activation target (US-15.1) |
| Row action in progress (status/custody/objection write) | Inline row shows a small spinner on the affected cell only | Rest of table remains interactive |
| Write error (e.g., `STATUS_CONFLICT`) | Inline red text beneath the affected row: "Status has changed since this loaded — refresh and retry" | Row reverts to server-confirmed value, no stuck optimistic state |
| Admission attempt blocked (`ADMISSION_BLOCKED`) | Inline "Record Status" action re-opens with a specific error listing every blocking reason at once — e.g., "Cannot admit: 2 blocking condition(s) present — Unresolved objection on this exhibit; No custodian of record." | No partial/generic failure message; no event recorded; status/badge remain exactly as they were before the attempt (US-12.1, US-12.2) — see `Y0-patterns.md` §Pattern: Multi-Reason Blocking Error |
| Custody transfer pending (F19) | Custodian cell shows "{current custodian} → pending: {named receiver}" instead of a plain name; row's "Propose Custody Transfer" action is unavailable while pending | Confirms a handoff is mid-flight without implying it's already complete — full Confirm/Cancel actions available on Exhibit Detail (US-19.1) |
| Intake blocked — missing/invalid classification (`CLASSIFICATION_REQUIRED` / `INVALID_CLASSIFICATION`) | "+ New Exhibit" panel stays open with inline field-level error on the classification group; no exhibit created | Forces an explicit choice before any record exists — no silent default (US-16.1) |
| Intake blocked — no custodian at first MARKED (`CUSTODIAN_REQUIRED_AT_INTAKE`) | "+ New Exhibit" panel stays open with inline field-level error on the custodian field; if the identity-only `POST /api/exhibits` call already succeeded, the panel keeps the exhibit in an explicit "created, not yet marked" sub-state and retries only the MARKED step on resubmit, never silently duplicating the exhibit | No exhibit is ever shown in the main list without a custodian (US-18.1, US-18.2) |
| Action unavailable for current role (F20) | Control is not rendered at all — "+ New Exhibit," "Record Status," "Propose Custody Transfer," "Raise Objection" are each independently absent per F20's matrix for the active role | Absent, not disabled — see `Y0-patterns.md` §Pattern: Role-Gated Control Visibility (US-20.1–US-20.4) |
| Quick-filter chip selected (added Phase 8) | Selected chip shows a pressed/active visual state (`aria-pressed="true"`); table narrows to matching rows only; search bar and dropdown filters remain usable and compose with the active chip | Single-select, like a tab strip — selecting a different chip replaces, not adds to, the active narrowing (US-9.3) |
| Quick-filter chip, zero matches (e.g., "Awaiting ruling 0") | Chip renders with a "0" count and remains selectable; selecting it shows the same "No exhibits match these filters" empty state used for a zero-result search | Consistent empty-state language across both filtering mechanisms (US-9.3) |
| Jury Package column — admitted, never evaluated (reworked Phase 9) | Row reads "Not yet evaluated," distinct from "Not eligible" | Corrects Phase 8's regression where every never-computed exhibit incorrectly read "Not eligible" regardless of admission state (T-06, F09 §Process step 4) |
| Jury Package column — not yet admitted (reworked Phase 9) | Column renders blank (no tag) | An eligibility tag on a not-yet-offered exhibit is noise, not signal — the service still computes a value, the UI suppresses it (T-06) |
| Jury Package column value (reworked Phase 9, four values) | "Included" (green), "Blocked" (amber), "Not eligible" (neutral/grey, structural exclusion), or "Not yet evaluated" (neutral, never assessed) — color-coded, text always present alongside the color (never color alone), blank for non-admitted rows | Matches the Jury Package Workspace's own per-exhibit status and the Exhibit Detail checklist for the same exhibit, always (US-9.3, T-06) |
| Table row background (reworked Phase 9) | No zebra striping — every row shares the same base background; the existing attention/discrepancy tint is the only row-level background emphasis | Prevents the alternating-row color from competing with or diluting the attention tint's signal (T-06) |
| Flags column, multiple simultaneous conditions (amended Phase 8) | Multiple readable pills stack in the same cell (e.g., "Ruling pending" + "No custodian") | Never collapsed into one generic icon when more than one condition applies |
| Load failure | Full-table inline error with retry button | — |

#### Interactive Elements

| Element | Type | Behavior |
|---------|------|----------|
| "+ New Exhibit" (toolbar, top-right) | Primary action, opens inline intake panel | Captures identity fields + required immutable classification + required intake custodian in one seamless submit (US-16.1, US-18.1, US-18.2); rendered only for `DEPUTY`/`CLERK`/`ADMIN` (F20 row 1) — absent for `JUDGE`/`CHAMBERS_STAFF`/`ATTORNEY` |
| Search bar (labeled, reworked Phase 9) | Text input, visible Carbon label "Search" | Keyword match against label/description/source; combines with other filters (AND semantics, US-4.1) |
| Status filter (labeled, reworked Phase 9) | Dropdown, visible Carbon label "Status" | Combinable filter; `getExhibits`/`searchExhibits` selected appropriately to avoid `EMPTY_SEARCH_CRITERIA` (T-07) |
| Witness filter (reworked Phase 9) | Searchable `ComboBox`, visible Carbon label "Witness" | Built from distinct `associatedWitness` values in the loaded list — not free text, not a hardcoded list; `data-testid="witness-filter-combobox"` (T-07) |
| From / To date filters (labeled, reworked Phase 9) | Two explicitly labeled date inputs, "From" and "To" | Combinable range filter; never a single ambiguous "Date" control (T-07) |
| "Clear filters" (reworked Phase 9, replaces the prior per-chip `×`) | Action | Resets every active filter field at once; `data-testid="filter-clear-button"` (T-07) |
| Exhibit row | Click target (entire row, not a nested element) | Navigates to Exhibit Detail View (`/exhibit/:id`); visible hover highlight; Enter/Space activates on keyboard focus (US-9.2, US-15.1) |
| Inline "Record Status" action (row-level) | Compact action, not a modal form | Offers only valid next-transition options (US-1.1); an attempted `ADMITTED` transition is rejected with every blocking reason named if an unresolved objection or missing custodian applies (US-12.1, US-12.2); rendered only for `DEPUTY`/`CLERK`/`ADMIN` (F20 row 2/3) — absent otherwise (US-20.2) |
| Inline "Propose Custody Transfer" action | Compact action | Requires selecting an active user as the intended receiver; does not change current custodian — see `Y0-patterns.md` §Pattern: Two-Phase Custody Handoff (US-19.1); rendered only for `DEPUTY`/`CLERK`/`ADMIN` (F20 row 6) — absent otherwise (US-20.4); unavailable (control absent) while a transfer is already pending for that exhibit |
| Inline "Raise Objection" action | Compact action, two fields | Party + grounds only (US-2.1); rendered only for `ATTORNEY`/`DEPUTY`/`CLERK`/`ADMIN` (F20 row 4) — absent for `JUDGE`/`CHAMBERS_STAFF` (US-20.3) |
| Discrepancy icon / Flags pill (amended Phase 8) | Tooltip + link (icon); always-visible label (pill) | Pill text itself conveys the condition without a hover; click/hover still navigates to / expands Exhibit Detail View discrepancy section exactly as before |
| Quick-filter chip (All / Needs attention / In my custody / Awaiting ruling) (added Phase 8) | Toggle group, single-select | Narrows the visible row set client-side against already-role-filtered data; composes with an active search query; `data-testid="quick-filter-chip-{key}"` (US-9.3) |
| Jury Package eligibility badge (four values, reworked Phase 9) | Static, per-row, blank for non-admitted rows | Computed identically to F11's own per-exhibit status and F10's checklist card; `data-testid="exhibit-row-jury-package-badge"` (US-9.3, T-06) |

**⚠ `data-testid`/`aria-label` contract (amended Phase 9, US-24.3):** `quick-filter-chips`, `quick-filter-chip-all`, `quick-filter-chip-needs-attention`, `quick-filter-chip-in-my-custody`, `quick-filter-chip-awaiting-ruling`, `exhibit-row-jury-package-badge`, `exhibit-row-flag-pill` — unchanged from Phase 8; new as of Phase 9: `filter-result-count`, `filter-clear-button`, `witness-filter-combobox` (T-07). The pre-existing `exhibit-row` selector and its row-level action selectors (Record Status, Propose Custody Transfer, Raise Objection) are unchanged.

**Positioning note:** row-level action affordances are deliberately understated (icon buttons, not prominent colored CTAs) — the search/browse experience is the visual star of this screen, with data-entry kept minimal and secondary per the "assistant, not data-entry system" constraint (FRD F09 §Validation). These understated inline actions coexist with full-row clickability without conflict: each inline action stops click-propagation, so clicking a status/custody/objection control never also fires row navigation, while every other point on the row — including empty space and the description/party/witness cells — still navigates (US-15.1, fixes a regression against this screen's originally-specified behavior).
### Screen: Exhibit Detail View

**Purpose:** The complete, single-screen chronological story of one exhibit — answers "what happened to this exhibit" without assembling fragments — paired, as of Phase 8, with a three-card right rail (Objection / Chain of Custody / Jury Package checklist) and header-level write actions so a user can both understand and act on an exhibit's state from one screen.
**User Stories:** US-10.1, US-10.2, US-10.3, US-3.3, US-2.2, US-6.3, US-12.1, US-12.2, US-16.1, US-18.1, US-19.1, US-19.2, US-19.3, US-19.4, US-20.2, US-20.4, US-20.5, US-24.1, US-24.2
**Journey:** JRN-02.2 (full journey), JRN-01.2 (Request History), JRN-03.1 (Challenge a Custody Gap), JRN-02.1 (Confirm Custody Receipt)
**Route:** `/exhibit/:id` · **Nav:** Row click from Case Workspace, Command Center, Jury Package Workspace, or Pending-Ruling Queue; citation link from Assistant. No sidebar entry (drill-in only).

#### Layout — Phase 8, Two-Column (Left: History/Timeline · Right: Action Rail)

As of Phase 8, the single-column timeline-only layout below is restructured into two columns: the left column retains the header and full chronological History/Timeline exactly as before; the right column is a new three-card rail (Objection, Chain of Custody, Jury Package checklist), each card reading a distinct slice of the same `getExhibitHistory` payload the timeline renders from — no card issues an independent query (F10 §Process steps 4–6).

```
┌──────────────────────────────────────────────────────────────────┐
│ JudicialSync  [Case: 2026-CR-0142 ▾] [⚠ 1] [Role: Judge ▾] [Ask Pivota]│
├───────────────┬──────────────────────────────────────────────────┤
│ Command Ctr   │  ← Back to Case Workspace                        │
│ Case          │  Exhibit 14 — "Blood sample, lab-sealed"         │
│ Jury Pkg      │  [ Transfer custody ]  [ Ask Pivota about Ex.14 ]│
│ Assistant     │  ┌────────────────────────┐ ┌───────────────────┐│
│               │  │ Status: ●ADMITTED       │ │ OBJECTION         ││
│               │  │ Custodian: ⚠ None on   │ │ No open objections││
│               │  │ Party: PROSECUTION      │ ├───────────────────┤│
│               │  │ Witness: Dr. Smith      │ │ CHAIN OF CUSTODY  ││
│               │  │ Classification: TRIAL   │ │ ⚠ No custodian of ││
│               │  │ ⚠ DISCREPANCY: Admitted │ │   record          ││
│               │  │   with unresolved       │ │ [ Assign → ]      ││
│               │  │   objection — hearsay   │ ├───────────────────┤│
│               │  │  ┌───────────────────┐  │ │ JURY PACKAGE      ││
│               │  │  │ [ Record ruling ]  │  │ │ ✓ Admitted        ││
│               │  │  │ [ Acknowledge ]     │  │ │ ✗ No open         ││
│               │  │  └───────────────────┘  │ │   objections      ││
│               │  │                         │ │ ✗ Custodian on    ││
│               │  │ History                 │ │   record          ││
│               │  │ ● Marked (custodian      │ │ ✓ Classification  ││
│               │  │   established: D. Reyes)│ │   = TRIAL         ││
│               │  │   Oct 5, 9:02 AM         │ │ ⛔ BLOCKED        ││
│               │  │ ● Offered  Oct 5, 9:15 AM│ │                   ││
│               │  │ ● Objection raised —     │ └───────────────────┘│
│               │  │   hearsay  Oct 5, 9:17 AM│                     │
│               │  │   (no further custody    │                     │
│               │  │    events — gap begins)  │                     │
│               │  └────────────────────────┘                      │
└───────────────┴──────────────────────────────────────────────────┘
```

*(The discrepancy banner above shows the Phase 9 primary-button treatment for an objection-type discrepancy — see §Discrepancy Banner below. A custody-type discrepancy, e.g. "Admitted, no custodian of record," renders the same full-size-button treatment with "Resolve →"/"Assign custodian" in place of "Record ruling," and is otherwise unaffected by this phase.)*

**Header write actions (added Phase 8, F24, US-10.3):**
- **"Transfer custody"** — opens the same first-assignment / propose / pending-transfer form described in `F24-write-action-ui-coverage.md`; rendered only for `DEPUTY`/`CLERK`/`ADMIN`, or — while a transfer is pending — additionally and separately for the exact named receiver (identity-gated "Confirm receipt," per the existing Two-Phase Custody Handoff pattern below). `data-testid="exhibit-header-transfer-custody-button"` (new, Phase 8 — the control itself invokes F24's existing propose/assign endpoints).
- **"Ask Pivota about {exhibitLabel}"** — opens the Pivota Assistant slide-over pre-scoped to this exhibit's label (e.g., the input pre-fills or the assistant's working context is pinned to Exhibit 14), so a follow-up question doesn't require re-stating which exhibit it concerns. `data-testid="ask-pivota-about-exhibit-button"` (new, Phase 8). As of Phase 9 this remains the product's single path into a pre-scoped conversation — no second, divergent assistant entry point exists on this screen (F10 Phase 9 addendum).

#### Discrepancy Banner — Single "Record Ruling" Entry Point + Acknowledge Dialog (reworked Phase 9, T-05, F10/F24 Phase 9 addenda)

**Supersedes the small-text-link treatment implied by the prior "[Resolve →][Acknowledge]" rendering.** The discrepancy banner's actions now render as full-size Carbon `Button` components — not small inline text links — matching the primary-button styling used elsewhere in the product:
- **"Record ruling"** — rendered only when the active discrepancy is the `UNRESOLVED_OBJECTION_JURY_ELIGIBLE` condition (admitted with an open objection); a single primary Carbon `Button`, visible only to `JUDGE`, scoped to that specific `objectionId`. Clicking it opens the exact same ruling-disposition form (Sustained/Overruled/Reserved) F24 already defines — this is **the one entry point** for recording a ruling on that discrepancy; there is no second, independently-rendered "Record ruling" control anywhere else on the page (see the Objection card below, now details-only). `data-testid="discrepancy-banner-record-ruling-button"`.
- **"Acknowledge"** — opens a modal **dialog** (not an inline-expanding field) requiring a non-empty justification (≤500 chars) before the "Confirm" control in the dialog is enabled; submitting calls the existing `POST /api/discrepancies/:id/acknowledge` endpoint unchanged (F6/F14 — no new acknowledgment semantics). The result (actor, role, timestamp, justification) appears in the History timeline below exactly as before, never summarized away. `data-testid="discrepancy-banner-acknowledge-button"`, dialog `data-testid="discrepancy-acknowledge-dialog"`.
- **Typography/contrast:** the banner's rule-explanation text renders at >=14px (Carbon `body-01` or larger — never a smaller caption-scale size) and meets WCAG AA contrast (4.5:1 minimum) against the banner's amber background (`Y2-accessibility.md` §Color Contrast).
- **Open product decision, explicitly not defaulted (F24 Phase 9 addendum):** whether "Acknowledge" should be hidden on a `HIGH`-severity discrepancy while a ruling is still pending is left as an open question for product review — this document does not silently hide or silently keep the control pending that decision; both buttons render together as shown above until a decision is recorded.

#### Right-Rail Cards (added Phase 8, F10 §Process steps 4–6, US-10.3; Objection card narrowed to details-only, Phase 9, T-05)

**Objection card (details-only as of Phase 9):** renders every `ObjectionCurrentState` row for this exhibit with `status = 'UNRESOLVED'` (zero, one, or several — never collapsed to "most recent only"), each showing objecting party, grounds, and elapsed time since `raisedAt`. **Supersedes the Phase 8 description, which gave this card its own independent "Record ruling" action button per row** — that button is removed as of Phase 9; the card is now details-only (context, never action), since the discrepancy banner above is the single "Record ruling" entry point for the exhibit's admitted-with-objection condition (§Discrepancy Banner above). For an unresolved objection on an exhibit that is *not yet* admitted (no discrepancy banner rendered for it), this card still shows the thread with no action control — a judge records that ruling from the Command Center attention table or the Pending-Ruling Queue instead, never from a second button on this card. If zero unresolved threads exist, the card shows an explicit "No open objections" state, never an empty card. `data-testid="exhibit-objection-card"`; each unresolved row `data-testid="exhibit-objection-row"` (the Phase 8 `exhibit-objection-record-ruling-button` selector is retired along with the button it identified).

**Chain of Custody card:** renders the current custodian (or "No custodian of record"), the pending-transfer banner when applicable (same visual treatment as the existing §Custody Section below — this card does not introduce a second, different pending-transfer presentation), and the full ordered custody history at a glance. Shows "No gaps in the chain" when custody has been continuously recorded since intake, or a visible gap indicator ("⚠ No custodian of record" / "Gap: {N} days with no custodian") otherwise. `data-testid="exhibit-custody-card"`.

**Jury Package checklist card:** four per-condition checks — (a) Admitted, (b) No open objections, (c) Custodian on record, (d) Classification = TRIAL — each rendered with a ✓ (met) or ✗ (outstanding) marker, plus the exhibit's overall eligibility badge (`Included`/`Blocked`/`Not eligible`/`Not yet evaluated` — four-value set as of Phase 9) computed by the identical precedence rule Case Workspace's eligibility column uses (F9 §Process step 3 = F10 §Process step 6 — never independently derived). `data-testid="exhibit-jury-checklist-card"`; eligibility badge `data-testid="exhibit-jury-eligibility-badge"` with `aria-label="Jury package eligibility: Blocked"` (etc. per value).

**`data-testid`/`aria-label` contract:** Phase 8 identifiers in this section are unchanged except `exhibit-objection-record-ruling-button`, retired as of Phase 9 (§Right-Rail Cards above); new as of Phase 9: `discrepancy-banner-record-ruling-button`, `discrepancy-banner-acknowledge-button`, `discrepancy-acknowledge-dialog` — see US-24.3's additive-only requirement for any identifier that is genuinely new rather than a retirement.

#### Custody Section — Pending Transfer State (F19)

When a custody transfer has been proposed but not yet confirmed, the header's custodian line is replaced by an always-visible informational banner — distinct in color from the amber Discrepancy Flag Treatment, since a pending transfer is an in-progress state, not a problem:

```
┌────────────────────────────────────────────┐
│ Status: ●ADMITTED                           │
│ Custodian: D. Reyes                         │
│  ⏳ Pending transfer to C. Chen — awaiting   │
│     her confirmation                        │
│     [ Cancel Transfer ]  [ Confirm Receipt ]│
└────────────────────────────────────────────┘
```

- **"Cancel Transfer"** is visible to the original proposer or any `DEPUTY`/`CLERK`/`ADMIN` role (F19/F20 row 6) — role-gated, not identity-gated.
- **"Confirm Receipt"** is visible **only** when the currently active user is the exact named receiver (`C. Chen`, in this example) — not the proposer, not any other `DEPUTY`/`CLERK`/`ADMIN`, not even `ADMIN` acting generally. Since the demo seeds exactly one `User` per `Role` (F0), this resolves in practice to "only when the active switched role is the receiver's role" — see `Y0-patterns.md` §Pattern: Two-Phase Custody Handoff for the identity-vs-role note.
- A role lacking any custody-write permission (`JUDGE`, `ATTORNEY`, `CHAMBERS_STAFF`) sees the pending banner with **no action controls at all** — informational only, consistent with the absent-not-disabled rule applied everywhere else in this document.
- While pending, the header's "Propose Custody Transfer" action (below) is unavailable — only one outstanding proposal is allowed per exhibit at a time (`CUSTODY_TRANSFER_ALREADY_PENDING`).

#### Information Hierarchy

| Priority | Content | Placement |
|----------|---------|-----------|
| Primary | Current status, current custodian (or pending-transfer banner), active discrepancy flag(s) | Header block, above the fold, before any history |
| Primary | Discrepancy banner's primary "Record ruling" (or "Resolve →"/"Assign custodian" for non-ruling discrepancies) and "Acknowledge" buttons (reworked Phase 9, full-size Carbon Buttons, >=14px text) | Directly beneath the flag it belongs to — never a separate screen, and the one entry point for that discrepancy's action (T-05) |
| Primary | Pending custody transfer banner + Confirm/Cancel actions (F19) | Directly beneath the custodian line, replacing it while a transfer is pending |
| Primary | Right-rail Objection / Chain of Custody / Jury Package checklist cards (added Phase 8) | Right column, same vertical extent as the header + top of the timeline — visible without scrolling on a desktop viewport |
| Primary | Header "Transfer custody" and "Ask Pivota about {label}" actions (added Phase 8) | Directly beneath the exhibit title, above the status/custodian block |
| Secondary | Chronological timeline (complete, oldest-first) | Left column, main scrollable body |
| Tertiary | Exhibit identity metadata (description, party, witness, source, classification) | Compact header row, de-emphasized once status/custodian are visible |

#### States

| State | Appearance | User Feedback |
|-------|------------|----------------|
| Default — clean exhibit | Header shows status + custodian, no discrepancy banner; full timeline below | None needed |
| Default — flagged exhibit | Amber discrepancy banner in header with plain-language rule explanation (>=14px, AA contrast) and full-size Carbon Button action(s) — "Record ruling" for an objection-type discrepancy, "Resolve →"/"Assign custodian" for a custody-type discrepancy (reworked Phase 9) | Impossible to miss; same visual treatment as Case Workspace's ⚠ icon, reinforcing consistency |
| Acknowledge dialog open, awaiting justification (reworked Phase 9) | Modal dialog overlays the page; "Confirm" control disabled until a non-empty justification (≤500 chars) is entered | Forces the justification before the irreversible action can be confirmed — never a silent/empty acknowledge (T-05, US-14.1, US-14.2) |
| Discrepancy acknowledged | Banner changes from amber "OPEN" to a muted but still-visible "Acknowledged by C. Chen (Clerk) · Oct 8, 2026, 3:10 PM: [full justification text]" badge — actor, role, timestamp, and justification all shown in full, never truncated or hidden behind a secondary click | Never disappears — remains a permanent, visible risk-acceptance record (US-6.3, US-14.3) |
| Loading | Header + timeline skeletons | Brief, since this is a single-exhibit query |
| Sealed, unauthorized role | Entire route renders the same "Exhibit not found" page as a nonexistent ID — no distinguishing copy, icon, or status code visible to the user | Confirms US-10.2: existence of sealed material is never revealed |
| Live update arrives (e.g., custody transfer logged elsewhere) | New timeline entry fades in at the appropriate chronological position; header updates in place | No manual refresh required |
| Citation deep-link arrival (from Assistant) | Page loads with the specific cited timeline entry highlighted and auto-scrolled into view | Closes the loop promised in Flow 1 ("one-tap view supporting record") |
| Admission attempt blocked (`ADMISSION_BLOCKED`) | The header's inline "Record Status" action re-opens with a specific error listing every applicable blocking reason at once (e.g., "Cannot admit: 2 blocking condition(s) present — Unresolved objection on this exhibit; No custodian of record.") — never a generic "failed to update status" message | No `ExhibitEvent` is recorded; status/custodian in the header remain exactly as they were before the attempt (US-12.1, US-12.2) — see `Y0-patterns.md` §Pattern: Multi-Reason Blocking Error |
| Custody transfer pending (F19) | Custodian line replaced by the "⏳ Pending transfer to {receiver} — awaiting their confirmation" banner, per §Custody Section above | Never silently indistinguishable from "no activity" or from a completed transfer (US-19.1) |
| Custody transfer confirmed | Banner disappears; custodian line updates to the new custodian; a `CUSTODY_TRANSFER_CONFIRMED` entry appears in the timeline | Confirms the handoff is now official — "who has it" reflects only the confirmed transfer, never the proposal (US-19.2) |
| Custody confirm attempted by the wrong user (`CUSTODY_CONFIRM_WRONG_USER`) | Inline error on the "Confirm Receipt" action: "Only the named receiving custodian may confirm this transfer" | Control itself is only ever shown to the actual named receiver (per Role-Gated Control Visibility + identity check), so this error path is a defense-in-depth backstop, not the primary guard (US-19.2, US-20.5) |
| Custody transfer cancelled | Banner disappears; custodian line reverts to the pre-proposal custodian (unchanged, since a pending transfer never altered it); a `CUSTODY_TRANSFER_CANCELLED` entry appears in the timeline, never erased | Confirms cancellation is a recorded event, not a silent reset (US-19.3) |
| Action unavailable for current role (F20) | "Record Status," "Propose Custody Transfer," "Confirm Receipt," and "Cancel Transfer" are each independently absent per F20's matrix (and, for Confirm, the additional identity check) | Absent, not disabled — see `Y0-patterns.md` §Pattern: Role-Gated Control Visibility (US-20.2, US-20.4, US-20.5) |
| Objection card — no open objections | Card renders explicit "No open objections" text, never an empty/blank card | Confirms "zero" is a deliberate, positive state, not a loading failure (US-10.3) |
| Objection card — one or more open objections (reworked Phase 9, details-only) | Each unresolved thread renders as its own row (objecting party, grounds, elapsed time) with **no action button** — recording a ruling happens from the discrepancy banner above, not from this card | Prevents the row from ever offering a second, independent "Record ruling" control that could drift out of sync with the banner's (T-05, US-10.3) |
| Chain of Custody card — no gaps | "No gaps in the chain" confirmation text, plus the full transfer history below it | Positive confirmation, not merely the absence of a warning (US-10.3) |
| Chain of Custody card — gap present | Visible gap indicator ("⚠ No custodian of record") consistent with the header's own discrepancy banner treatment for the same condition | Never a second, differently-worded warning for the same underlying fact (US-10.3) |
| Jury Package checklist card — any condition outstanding | The specific unmet condition(s) show a ✗ marker with its plain-language label; overall badge reads `Blocked`, `Not eligible`, or `Not yet evaluated` per the same four-value precedence Case Workspace uses (Phase 9) | Never a bare "not eligible" with no breakdown of why — this card is explicitly the itemized "why" F9's single badge doesn't spell out (US-10.3) |
| Jury Package checklist card — all conditions met | All four rows show ✓; overall badge reads `Included` | Matches the Case Workspace row for the same exhibit exactly — no divergence between the two surfaces (US-10.3) |
| Header "Transfer custody" / "Ask Pivota about {label}" — role-gated absence | "Transfer custody" is independently absent for a role with no custody-write permission and no pending-transfer identity match; "Ask Pivota about {label}" always renders for every role (opening the assistant is never role-restricted) | Absent, not disabled — `Y0-patterns.md` §Pattern: Role-Gated Control Visibility (US-10.3) |
| Load failure | Inline error: "Unable to load exhibit history — please retry" | Retry button, no partial/broken render; right-rail cards do not render independently of the header/timeline load, since they share the same `getExhibitHistory` call |

#### Interactive Elements

| Element | Type | Behavior |
|---------|------|----------|
| "Resolve →" / "Assign custodian" button (on a discrepancy banner, custody-type condition) | Full-size Carbon Button (reworked Phase 9 — was a small text link) | Opens the relevant inline action (e.g., "Propose Custody Transfer") directly on this screen; >=14px text, AA contrast (T-05) |
| "Record ruling" button (on a discrepancy banner, objection-type condition, reworked Phase 9) | Full-size Carbon `Button`, primary | Opens the ruling disposition form scoped to that specific `objectionId`; `JUDGE`-only; the single entry point for this action — no duplicate button exists on the Objection card (T-05); `data-testid="discrepancy-banner-record-ruling-button"` |
| Inline "Record Status" action (header) | Compact action, not a modal form | Offers only valid next-transition options (US-1.1); an attempted `ADMITTED` transition is rejected pre-write with every blocking reason named if an unresolved objection or missing custodian applies — status remains unchanged on rejection (US-12.1, US-12.2); the exhibit's first-ever transition (`MARKED`) additionally requires a custodian in the same step (US-18.1, US-18.2); rendered only for `DEPUTY`/`CLERK`/`ADMIN` (F20 row 2/3) — absent otherwise (US-20.2) |
| "Propose Custody Transfer" action (header, settled state only) | Compact action | Current custodian auto-filled as "from"; requires selecting an active user as the intended receiver; does not change `currentCustodianUserId` (US-19.1); rendered only for `DEPUTY`/`CLERK`/`ADMIN` (F20 row 6) — absent otherwise (US-20.4); unavailable while a transfer is already pending |
| "Cancel Transfer" action (pending state only) | Action | Clears the pending transfer with no change to current custodian; available to the original proposer or any `DEPUTY`/`CLERK`/`ADMIN` role (US-19.3) |
| "Confirm Receipt" action (pending state only) | Action | Completes the transfer, setting the named receiver as current custodian; visible **only** to the exact named receiver — identity-gated, not merely role-gated (US-19.2, US-20.5) — see `Y0-patterns.md` §Pattern: Two-Phase Custody Handoff |
| "Acknowledge" button (reworked Phase 9) | Action, opens a modal dialog (was an inline justification field) | Requires non-empty justification (≤500 chars) before the dialog's "Confirm" control is enabled; idempotent if already acknowledged (US-6.3); only rendered for `DEPUTY`/`CLERK`/`JUDGE`/`ADMIN` roles — absent, not disabled, otherwise; the dialog always shows the copy disclosing the action is permanently recorded under the acting user's name and role before it is confirmed (US-14.1, US-14.2, T-05); `data-testid="discrepancy-banner-acknowledge-button"`, dialog `data-testid="discrepancy-acknowledge-dialog"` |
| Timeline entry | Static, citable | Each entry carries a stable anchor so Assistant citations and direct links can scroll to it precisely; now includes `CUSTODY_TRANSFER_PROPOSED`/`CONFIRMED`/`CANCELLED` entries (F19) in addition to the original event types |
| "← Back to Case Workspace" | Navigation | Returns to the referring list screen (preserves prior scroll/filter state where feasible) |
| "Transfer custody" (header, added Phase 8) | Action, opens inline form | Settled state → propose form; no-custodian state → immediate first-assignment form; pending state → renders Cancel/Confirm instead (identical underlying behavior to the existing §Custody Section forms, now also reachable from a single header button rather than only inline); `data-testid="exhibit-header-transfer-custody-button"` (US-24.2) |
| "Ask Pivota about {exhibitLabel}" (header, added Phase 8) | Action | Opens the Assistant slide-over pre-scoped to this exhibit — the single assistant entry point on this screen, confirmed unchanged as of Phase 9 (F10 Phase 9 addendum); available to every role (asking a question is never restricted); `data-testid="ask-pivota-about-exhibit-button"` (US-10.3) |
| Chain of Custody card "Assign →" / propose entry point (added Phase 8) | Inline write action | Same underlying form as the header's "Transfer custody" action, offered a second time at the point of the gap itself for discoverability; rendered only for `DEPUTY`/`CLERK`/`ADMIN`; `data-testid="exhibit-custody-card-assign-button"` (F24, US-24.2) |

**`data-testid`/`aria-label` contract (amended Phase 9, US-24.3):** `exhibit-header-transfer-custody-button`, `ask-pivota-about-exhibit-button`, `exhibit-objection-card`, `exhibit-objection-row`, `exhibit-custody-card`, `exhibit-custody-card-assign-button`, `exhibit-jury-checklist-card`, `exhibit-jury-eligibility-badge` — unchanged from Phase 8. Retired as of Phase 9: `exhibit-objection-record-ruling-button` (the Objection card's per-row action button no longer renders — §Right-Rail Cards). New as of Phase 9: `discrepancy-banner-record-ruling-button`, `discrepancy-banner-acknowledge-button`, `discrepancy-acknowledge-dialog` — none repurpose or collide with a pre-existing Phase 1–7 selector (the existing inline "Record Status"/"Propose Custody Transfer" selectors on this screen are unchanged).

**Plain-language translation rule:** every timeline entry is composed as a complete sentence ("Status changed from Offered to Admitted," "Custody transfer proposed to C. Chen," "C. Chen confirmed receipt of custody," "Custody transfer to C. Chen cancelled — reason: wrong recipient named") — raw `eventType`/`payload` values are never exposed to the user (US-10.1).
### Screen: Jury Package Workspace

**Purpose:** The authoritative, discrepancy-gated handoff view for the jury-eligible exhibit list — the screen where "build a jury package" plays out end-to-end — now presented as a per-exhibit card layout (Blockers/Clean), with a visible progress indicator and a path for non-finalizing roles to request finalization rather than hit a disabled control with no way forward.
**User Stories:** US-5.1, US-5.2, US-6.1, US-6.2, US-6.3, US-11.1, US-11.2, US-11.3, US-13.1, US-13.2, US-13.3, US-14.1, US-14.2, US-14.3, US-16.2, US-23.1, US-23.2, US-23.3
**Journeys:** JRN-02.1 (Assemble), JRN-01.2 (Present/Accept), JRN-03.1 (Verify Integrity)
**Route:** `/jury-package` · **Nav:** Sidebar "Jury Package"

#### Layout — No Package Yet (new, Phase 9, T-10, F11/F25 Phase 9 addenda)

**Supersedes the implicit pre-Phase-9 assumption that a `DRAFT` package already exists whenever this screen loads.** Prior to Phase 9, `GET /api/cases/:id/jury-package` auto-created a `DRAFT` package as a side effect of simply viewing the screen — so this "no package yet" state was never actually reachable in the UI. Phase 9 removes that auto-create behavior (F11 §Process step 10); the screen must now explicitly render a full-content-width empty state before any package exists, visible to every role, including a `JUDGE` who can never start one directly:

```
┌──────────────────────────────────────────────────────────────────┐
│ JudicialSync  [Case: 2026-CR-0142 ▾] [⚠ 1] [Role: Judge ▾][Ask Pivota]│
├───────────────┬──────────────────────────────────────────────────┤
│ Command Ctr   │  Jury Package Workspace                            │
│ Case          │  ┌────────────────────────────────────────────────┐│
│ ▸ Jury Pkg    │  │  No jury package has been started for this case.││
│ Assistant     │  │  A Deputy, Clerk, or Admin can start one.        ││
│               │  │                                                  ││
│               │  │        [ Start package ]  ← Deputy/Clerk/Admin   ││
│               │  │          only; absent for Judge/Chambers/Attorney││
│               │  └────────────────────────────────────────────────┘│
│               │  Jury Package Readiness Preview (read-only)        │
│               │  ┌────────────────────────────────────────────────┐│
│               │  │ 7 admitted · 4 ready · 3 blocked                 ││
│               │  │ Ex. 14  ✗ No custodian                           ││
│               │  │ Ex. 9   ✗ Unresolved objection                   ││
│               │  │ S-2     ✗ Sealed / ex parte                      ││
│               │  │ Ex. 3   ✓ Ready                                  ││
│               │  │ ... (same panel shown identically to every role) ││
│               │  └────────────────────────────────────────────────┘│
└───────────────┴──────────────────────────────────────────────────┘
```

- **Empty-state copy spans the full content width** (not a small centered card) and explicitly names which roles can act: "A Deputy, Clerk, or Admin can start one."
- **"Start package"** renders only for `DEPUTY`/`CLERK`/`ADMIN` (F20) — absent, not disabled, for `JUDGE`/`CHAMBERS_STAFF`/`ATTORNEY`. Clicking it calls `POST /api/cases/:id/jury-package` (F5, unchanged) **only on this explicit click** — viewing the page performs no write under any circumstance, closing the gap where a `JUDGE` merely opening this screen could previously trigger a `DRAFT` package to spring into existence with no action of their own. `data-testid="start-jury-package-button"`.
- **Jury Package Readiness Preview panel (new, F25):** rendered beneath the empty-state message for **every** role, including `JUDGE` — the identical read-only panel described in full below (§Readiness Preview Panel). This is the only way a non-starting role can see what is blocking jury-package readiness before anyone has started a package.

#### Layout — Draft State (Phase 8: Card-Per-Exhibit, Blockers/Clean)

As of Phase 8, the prior flat table (shown immediately below for traceability) is replaced by a per-exhibit card layout: a top progress banner, a **Blockers** section (one card per blocking exhibit, each carrying its specific remediation action), and a **Clean** section (lightweight cards for exhibits already ready). No underlying computation changes — every card reads the same `JuryPackageExhibit.discrepancyStatus`/`status` fields the prior table rendered.

```
┌──────────────────────────────────────────────────────────────────┐
│ JudicialSync  [Case: 2026-CR-0142 ▾] [⚠ 1] [Role: Deputy ▾][Ask Pivota]│
├───────────────┬──────────────────────────────────────────────────┤
│ Command Ctr   │  Jury Package Workspace          ● DRAFT          │
│ Case          │  (prior: Version 2 finalized · View version      │
│ ▸ Jury Pkg    │   history ▾)                                     │
│ Assistant     │  ┌────────────────────────────────────────────┐  │
│               │  │ ⚠ Not ready to finalize: 3 blockers         │  │
│               │  │ ██████░░░░░░░░░░  2 of 5 clean               │  │
│               │  └────────────────────────────────────────────┘  │
│               │  Blockers (3)                                     │
│               │  ┌────────────────────────────────────────────┐  │
│               │  │ ⛔ CRITICAL  S-2 — ex parte material         │  │
│               │  │   must be removed before finalization        │  │
│               │  │   [ Remove from package ]                     │  │
│               │  ├────────────────────────────────────────────┤  │
│               │  │ ⚠ HIGH  Ex. 9 — unresolved objection         │  │
│               │  │   raised 2:15 PM · hearsay                    │  │
│               │  │   [ Record ruling ]  [ Acknowledge ▾ ]        │  │
│               │  │   ▾ Acknowledge reason: [________________]    │  │
│               │  ├────────────────────────────────────────────┤  │
│               │  │ ⚠ MEDIUM  Ex. 14 — no custodian of record    │  │
│               │  │   detected 9:23 AM                            │  │
│               │  │   [ Assign custodian ]  [ Acknowledge ▾ ]     │  │
│               │  └────────────────────────────────────────────┘  │
│               │  Clean (2)                                        │
│               │  ┌────────────────────────────────────────────┐  │
│               │  │ ✓ Ex. 3   ●ADMITTED                          │  │
│               │  │ ✓ Ex. 7   ●ADMITTED                          │  │
│               │  └────────────────────────────────────────────┘  │
│               │  [ Finalize Jury Package ]  ← disabled, greyed    │
│               │  (non-finalizing role sees instead:)              │
│               │  [ Request finalization from Clerk ]              │
└───────────────┴──────────────────────────────────────────────────┘
```

**Progress banner (added Phase 8):** always rendered at the top of the Draft view — "Not ready to finalize: N blockers" (amber, when `blockedCount > 0`) or "All N exhibits clean — ready to finalize" (calm/green, when zero blockers) — paired with a mini progress bar showing `{cleanCount} of {total} clean`. This is the same `{ total, cleanCount, blockedCount }` summary the pre-Phase-8 caption line already computed (F11 §Outputs) — purely a more prominent, bannered presentation of an existing value, not a new computation. `data-testid="jury-package-progress-banner"`.

**Blockers section (added Phase 8):** one card per `JuryPackageExhibit` row with `discrepancyStatus = 'FLAGGED'` or the sealed/ex-parte CRITICAL condition, each card showing exhibit label, severity treatment, the specific blocking detail inline on the card face (never behind a secondary click), and **the action specific to that blocker type**:
- **Sealed/ex-parte (CRITICAL):** `[Remove from Package]` only — no Acknowledge option, since this is a structural exclusion, not a tolerable risk (F13, unchanged from the pre-Phase-8 treatment).
- **Open/unresolved objection:** `[Record ruling]` (F24, judge-only — navigates to or inline-opens the same ruling form as the Objection card on Exhibit Detail) plus `[Acknowledge ▾]`, which expands an inline, in-card textarea for the required justification (≤500 chars) rather than navigating away — "inline expandable acknowledge-reason" per the card's own disclosure copy (`Y0-patterns.md` §Pattern: Permanent-Record Disclosure).
- **No custodian of record:** `[Assign custodian]` (F24 — opens the same first-assignment/propose form as the Exhibit Detail header) plus `[Acknowledge ▾]`, identical inline-textarea behavior to the objection case above.

Each Blockers card's `[Acknowledge ▾]` disclosure triangle expands/collapses the justification textarea in place — the card height grows, nothing navigates away, and the always-visible permanent-record disclosure copy (per `Y0-patterns.md` §Pattern: Permanent-Record Disclosure) renders above the textarea the moment it expands, not only after a first attempt to submit with it empty.

**⚠ New `data-testid`/`aria-label` contract needed (flagged for UX-researcher/planner, US-24.3):**
- Blockers section container: `data-testid="jury-package-blockers-section"`
- Each blocker card: `data-testid="jury-package-blocker-card"` with `aria-label` naming exhibit + blocker type, e.g. `aria-label="Blocker: Exhibit 9, unresolved objection"`
- Inline acknowledge-reason textarea (per card): `data-testid="jury-package-blocker-acknowledge-textarea"`
- "Record ruling" / "Assign custodian" action buttons on a blocker card: `data-testid="jury-package-blocker-record-ruling-button"` / `data-testid="jury-package-blocker-assign-custodian-button"`
- Clean section container: `data-testid="jury-package-clean-section"`; each clean card `data-testid="jury-package-clean-card"`

**Clean section (added Phase 8):** lightweight cards (or compact rows within a single bordered group) for every `discrepancyStatus = 'CLEAN'` exhibit — label + status badge only, no action controls, since there is nothing to resolve. Visually de-emphasized relative to the Blockers section (smaller card chrome, no severity color), reinforcing that this list exists for completeness/confidence ("these N are already ready"), not for action.

#### Layout — Draft State (Pre-Phase-8 Flat Table, Retained for Traceability)

*The table below is the exact pre-Phase-8 presentation this screen replaced. It is kept here only so the Phase 8 card layout's per-row data mapping (above) is auditable against its predecessor — the live screen renders the card layout, not this table, as of this phase.*

```
┌──────────────────────────────────────────────────────────────────┐
│ JudicialSync  [Case: 2026-CR-0142 ▾] [⚠ 1] [Role: Deputy ▾][Ask Pivota]│
├───────────────┬──────────────────────────────────────────────────┤
│ Command Ctr   │  Jury Package Workspace          ● DRAFT          │
│ Case          │  (prior: Version 2 finalized · View version      │
│ ▸ Jury Pkg    │   history ▾)                                     │
│ Assistant     │  ┌────────────────────────────────────────────┐  │
│               │  │ Label   Status      Discrepancy             │  │
│               │  │ Ex. 3   ●ADMITTED   ✓ Clean                 │  │
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

**Version history affordance, Draft state (F23):** whenever at least one `FINALIZED` version already exists for the case, the Draft header additionally shows "(prior: Version N finalized · View version history ▾)" — a secondary, collapsed-by-default link, so a deputy mid-build can still locate and export an earlier version without abandoning the current draft. If no version has ever been finalized, this line is omitted entirely (first-ever package for the case). Unchanged in the Phase 8 card layout — this header line sits directly above the new progress banner.

**Sealed/ex-parte blocker row (US-13.1, US-13.3):** a row whose underlying exhibit is `isSealed = true` (e.g., `S-2`, a chambers sidebar note) never renders `✓ Clean` or `⚠ Flagged: ...` — it renders in a distinct, higher-severity "⛔ CRITICAL" treatment with explicit copy ("ex parte material — must be removed") and no `[Fix →]`/`[Acknowledge]` actions, only `[Remove from Package]`. This evaluation is independent of and takes precedence over F6's `discrepancyStatus` for that row. The Finalize control stays disabled while any such row is present, same as for an open discrepancy. In the normal case (computation already excludes sealed exhibits at the query level per F13), this row never appears at all — it is shown here only to specify the required remediation treatment for the regression/legacy-data case where one is nonetheless present. As of Phase 8, this treatment renders as the CRITICAL Blockers card described above rather than a table row, with no change to its underlying precedence/remediation rules.

#### Request Finalization From Clerk (added Phase 8, US-11.3)

A role permitted to view this screen but **not** in F20's finalize-authorized set (`DEPUTY`/`CLERK`/`ADMIN`) — i.e., `JUDGE`, `CHAMBERS_STAFF`, or `ATTORNEY` — sees **"Request finalization from Clerk"** rendered in the exact position the (for them, never-actionable) "Finalize Jury Package" control would otherwise occupy, rather than a disabled button with no path forward. Clicking it calls `POST /api/jury-package/:id/request-finalization`, setting `finalizationRequestedAt`/`finalizationRequestedBy` on the package (overwriting any prior unresolved request — at most one outstanding request is tracked, never stacked). This action never finalizes the package, never bypasses the discrepancy gate, and confers no finalize authority to the requester.

A finalize-authorized role (`DEPUTY`/`CLERK`/`ADMIN`) viewing the same `DRAFT` package while a request is outstanding sees a visible banner — **"Finalization requested by {requesterName} at {time}"** — directly above the Finalize control, so the request surfaces exactly where the action it asks for would be taken. A successful finalize clears the outstanding request fields automatically (the request is resolved by the finalization it led to).

**⚠ New `data-testid`/`aria-label` contract needed:** `data-testid="request-finalization-button"` (rendered only for non-finalizing roles, in place of the Finalize button); `data-testid="finalization-requested-banner"` (rendered only for finalize-authorized roles when a request is outstanding) with `aria-label="Finalization requested by {requesterName} at {time}"`.

#### Readiness Preview Panel (new, Phase 9, T-10, F25)

A read-only panel listing every currently `ADMITTED` exhibit visible to the requesting role and, for each, whether it is ready or — if not — which specific blocker(s) apply (`UNRESOLVED_OBJECTION`, `NO_CUSTODIAN`, `SEALED_EXPARTE`; an exhibit can carry more than one simultaneously). Backed by the new, dedicated `GET /api/cases/:id/jury-package/preview` route (F25) — **this call never creates or mutates a `JuryPackage` row**, under any circumstance, no matter how many times it is invoked.

- **Rendered for every role, identically, including `JUDGE`** — there is no "preview with actions" variant and no role-gating on this read path (F25 is the one jury-package-adjacent endpoint with no `ROLE_NOT_PERMITTED` gate); a sealed/ex-parte exhibit the requesting role cannot see at all is simply omitted from the list, never shown as a masked or blocked row (consistent with `Y0-patterns.md` §Pattern: Sealed-Exhibit Invisibility).
- **Available before, during, and after a package exists** — on the "No Package Yet" empty state (§Layout — No Package Yet above), and as a collapsible panel alongside the normal Draft/Finalized views, so a user never has to start a package just to see what's blocking readiness.
- **Summary line:** "{totalAdmitted} admitted · {readyCount} ready · {blockedCount} blocked," followed by one row per admitted exhibit — label, a ✓/✗ ready indicator, and (if blocked) each applicable blocker's plain-language detail.
- **Polls on the standard live-sync interval** while visible, so a ruling, custody fix, or reclassification recorded elsewhere updates the ready/blocked breakdown without manual refresh — identical polling behavior to every other read surface in the product.
- **Never reflects any existing `JuryPackage`'s membership** — it is computed fresh from the exhibit/objection/custody/classification data every time, so it remains accurate even when no package has ever been started, and never drifts out of sync with a package that does exist.
- `data-testid="jury-package-readiness-preview"`; each row `data-testid="readiness-preview-row"` with `aria-label` stating exhibit + ready/blocked state, e.g. `aria-label="Exhibit 14: blocked — no custodian of record"`; summary `data-testid="readiness-preview-summary"`.

#### Layout — Finalized State

```
┌──────────────────────────────────────────────────────────────────┐
│ Jury Package Workspace   ● FINALIZED · Version 3 (most recent)    │
│                            ✓ Zero discrepancies                   │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ Finalized by D. Reyes · Oct 5, 4:02 PM                        │ │
│ │ Label   Status                                                │ │
│ │ Ex. 3   ●ADMITTED                                             │ │
│ │ Ex. 7   ●ADMITTED                                             │ │
│ │ Ex. 14  ●ADMITTED                                             │ │
│ │ Ex. 9   ●ADMITTED                                             │ │
│ └──────────────────────────────────────────────────────────────┘ │
│ [ Export as PDF ⬇ ]  [ Start New Draft ]  [ View Version History ▾]│
│          (read-only — no acknowledge/resolve controls)            │
└────────────────────────────────────────────────────────────────── ┘
```

#### Version History (secondary view, F23)

Expanding "View Version History" (available from both Draft and Finalized states) reveals every `JuryPackage` ever created for the case — every `FINALIZED` version plus the current `DRAFT`, if one exists:

```
│ VERSION HISTORY                                                    │
│ ──────────────────────────────────────────────────────────────── │
│ Version 3 (most recent)  · Finalized Oct 5, 4:02 PM · 4 exhibits  │
│   [ Export as PDF ⬇ ]                                              │
│ Version 2                · Finalized Oct 4, 2:10 PM · 3 exhibits  │
│   [ Export as PDF ⬇ ]                                              │
│ Version 1                · Finalized Oct 3, 11:45 AM · 2 exhibits │
│   [ Export as PDF ⬇ ]                                              │
│ DRAFT (in progress)      · 5 exhibits, 1 flagged                  │
│   [ Go to Draft → ]                                                │
```

Each historical row exports independently via its own `JuryPackage` id — exporting Version 1 never depends on Version 3 or the current draft still existing, and re-exporting any version at a later date always produces an identical PDF, since a `FINALIZED` package's exhibit rows are immutable (US-23.3). "Export as PDF" is available to every viewing role (no role restriction on export itself, consistent with every other read action in the system) — only *finalizing* and *removing* remain restricted to `DEPUTY`/`CLERK`/`ADMIN`.

#### Information Hierarchy

| Priority | Content | Placement |
|----------|---------|-----------|
| Primary | Progress banner ("Not ready to finalize: N blockers" + mini progress bar) (added Phase 8) | Top of screen, directly beneath the status badge/version line — largest visual weight |
| Primary | Package status badge (`DRAFT`/`FINALIZED`) + discrepancy summary banner | Top of screen |
| Primary | Blockers section — one card per blocking exhibit, each with its specific remediation action (added Phase 8, replaces the flat-table flagged rows) | Directly beneath the progress banner, above the Clean section |
| Primary | Sealed/ex-parte critical blocker card (if present) — highest-severity signal on this screen, never rendered as clean | Top of the Blockers section, visually distinct from and more severe than an ordinary blocker card (US-13.1, US-13.3) |
| Primary | Finalize / Request-finalization action and its enabled/disabled state with reason | Persistent, bottom of screen — never scrolled out of view |
| Primary | Current version number + "most recent" indicator once finalized (F23) | Directly beside the `FINALIZED` status badge |
| Secondary | Clean section — lightweight cards for ready exhibits (added Phase 8, replaces the flat-table clean rows) | Beneath the Blockers section |
| Secondary | Per-card discrepancy detail and resolution actions (Record ruling / Assign custodian / Remove from package) | Inline on each Blockers card face |
| Secondary | Inline expandable acknowledge-reason textarea (added Phase 8) | Expands in place within the Blockers card it belongs to |
| Secondary | Acknowledgment role-eligibility and permanent-record disclosure, and the full acknowledgment audit record (actor, role, timestamp, justification) once acknowledged | Inline, always visible — never hover/tooltip-only (US-14.1, US-14.2, US-14.3) |
| Secondary | "Request finalization from Clerk" action / "Finalization requested by..." banner (added Phase 8, US-11.3) | Same position the Finalize control occupies, for non-finalizing roles; banner directly above Finalize for finalize-authorized roles |
| Secondary | Version History (prior finalized versions + their independent export actions) (F23) | Collapsed by default, one click away from both Draft and Finalized states |
| Secondary | "No Package Yet" empty state — full-content-width copy + role-gated "Start package" button (new, Phase 9, T-10) | Replaces the Draft/Finalized layout entirely until a package is explicitly started |
| Secondary | Readiness Preview Panel — read-only, every role including Judge (new, Phase 9, T-10, F25) | Beneath the empty state; also available as a collapsible panel alongside the normal Draft/Finalized views |
| Tertiary | Exhibit status badges (all rows are `ADMITTED` by construction, so this is confirmatory, not discriminating) | Card-level, de-emphasized relative to the blocker detail |

#### States

| State | Appearance | User Feedback |
|-------|------------|----------------|
| Draft, zero discrepancies | Blockers section omitted entirely (or shows "Blockers (0)" collapsed); Clean section shows every included exhibit; progress banner reads calm green; Finalize button enabled (solid, primary color) | "All N exhibits clean — ready to finalize" caption on the progress banner |
| Draft, open discrepancies | Blockers section populated with one card per blocking exhibit, each showing its rule explanation + specific action inline; progress banner reads amber "Not ready to finalize: N blockers"; Finalize button visibly disabled (greyed, non-clickable) | Disabled state is a true HTML-disabled control, not a styled-but-clickable button that errors on click (US-11.2) |
| Draft, discrepancy acknowledged | Blocker card's badge changes to a muted "Acknowledged by C. Chen (Clerk) · Oct 8, 2026, 3:10 PM: [full justification text]" state — actor, role, timestamp, and justification all shown in full, never truncated/summarized/hidden behind a secondary click; card moves from Blockers to Clean on the next poll tick once counted as "clean enough to finalize" per the gate's ACK/RESOLVED rule | Finalize button re-enables once all flags are ACK'd or RESOLVED (US-6.3, US-14.3) |
| Blockers card "Acknowledge ▾" expanded (added Phase 8) | Inline textarea grows within the card; always-on disclosure copy ("Acknowledging will be recorded as a permanent action under your name and role") renders above the textarea the instant it expands | Disclosure is visible before the action is confirmed, not only after an empty-submit attempt (US-14.1, US-14.2) |
| Acknowledge control — non-eligible role | No "Acknowledge ▾" control rendered at all on a card for roles outside `DEPUTY`/`CLERK`/`JUDGE`/`ADMIN` | Absent, not disabled or greyed-out — never an affordance the system won't honor (US-14.1) |
| Blockers card "Record ruling" / "Assign custodian" in-flight (added Phase 8) | Button shows a brief inline spinner; card's other controls remain visible but non-interactive | Prevents double-submit (US-24.1, US-24.2) |
| Blockers card action rejected (e.g., `409 OBJECTION_ALREADY_RESOLVED`, `409 CUSTODY_CHAIN_BROKEN`) | Inline error within the card naming the specific rejection reason; card remains in the Blockers section unchanged | Never a silent failure — matches the reject-with-reason pattern (US-24.1, US-24.2) |
| Sealed/ex-parte exhibit present | Rendered as a distinct "⛔ CRITICAL · ex parte material" card at the top of the Blockers section — never in the Clean section, never an ordinary amber blocker card — independent of and taking precedence over the exhibit's own `discrepancyStatus`; Finalize stays disabled while the card is present | Structurally impossible to mistake for an ordinary discrepancy or a clean exhibit (US-13.1, US-13.3) |
| Sealed/ex-parte exhibit — "Remove from Package" (eligible role) | `DEPUTY`/`CLERK`/`ADMIN` see an enabled "Remove from Package" action on the CRITICAL card; `JUDGE`/`CHAMBERS_STAFF`/`ATTORNEY` see the identical card with no action control | Role gate is absence-based, matching the Acknowledge-control pattern (US-13.2, US-13.3) |
| Sealed exhibit removed via remediation action | Card disappears from the Blockers section immediately; an auditable "Removed by D. Reyes (Deputy) · Oct 8, 2026, 3:12 PM · reason: sealed/ex parte material" record is retained and visible (e.g., on Exhibit Detail's history) — the record is never silently deleted | Deliberate, auditable remediation, never a silent fix with no trace (US-13.2) |
| Finalizing (in-flight) | Finalize button shows a brief inline spinner/"Finalizing..." label | Prevents double-submit |
| Finalize rejected (stale client state) | Inline error banner lists the specific blocking exhibits; button re-disables; affected exhibits reappear as Blockers cards | Never a generic "error occurred" — always names the blocking exhibit(s) (US-5.2) |
| Non-finalizing role views Draft (added Phase 8, US-11.3) | "Request finalization from Clerk" renders in the position Finalize would otherwise occupy | Never a disabled control with no path forward for this role (US-11.3) |
| Request finalization — in flight | Button shows a brief inline spinner/"Requesting..." label | Prevents double-submit |
| Request finalization — success | Button becomes "Finalization requested" (disabled, confirmatory) until the request is cleared by a subsequent finalize | Confirms the request was recorded, not merely attempted (US-11.3) |
| Request finalization — outstanding, viewed by finalize-authorized role (added Phase 8) | "Finalization requested by {requesterName} at {time}" banner renders directly above the Finalize control | Surfaced exactly where the requested action would be taken, not on a separate notifications page (US-11.3) |
| A finalize-authorized role attempts to call request-finalization directly (`403 ROLE_NOT_PERMITTED`) | Control is never rendered for this role in the first place (they see Finalize, not Request); a direct API attempt is independently rejected | "This role can finalize directly and does not need to request it" (US-11.3) — defense-in-depth backstop, not the primary guard |
| Finalized | Status badge turns to a calm green "FINALIZED · Version N (most recent) ✓ Zero discrepancies" banner; all acknowledge/resolve/remove controls disappear; "Export as PDF," "Start New Draft," and "View Version History" appear | This is the explicit, now-versioned "zero discrepancies" confirmation stamped for the record, satisfying JRN-01.2's acceptance moment; the version number makes clear this is a permanent, independently-retrievable snapshot, not a one-shot replaceable state (US-23.1) |
| Exporting (in-flight) | "Export as PDF" shows a brief inline spinner/"Generating PDF..." label | A real server-generated file download begins on completion — never a browser print dialog (US-23.2) |
| Export attempted on a draft (`JURY_PACKAGE_EXPORT_NOT_FINALIZED`) | Export control is hard-disabled on any `DRAFT` package shown in the Version History list, never merely hidden | Matches F5's existing hard-gate pattern rather than erroring only after a click (US-23.2) |
| Export/generation failure (`PDF_GENERATION_FAILED`) | Inline error: "Unable to generate the jury package PDF — please retry" with a retry button | Never a silently-failed download — an explicit, retryable error (US-23.2) |
| New draft started after a finalized version (F23) | "Start New Draft" creates a fresh `DRAFT` package (version `null` until its own future finalization); the just-finalized version remains independently visible and exportable from Version History, untouched | Finalizing is no longer a one-shot, draft-replacing action — each version is permanent and a new draft can begin independently (US-23.1) |
| Viewing a prior (non-most-recent) version from Version History | Opens that specific version in the same read-only Finalized-state layout, labeled "Version N" without "(most recent)"; its own "Export as PDF" works independently of the current draft or most-recent version's state | Confirms every historical version remains fully, independently retrievable (US-23.3) |
| No admitted exhibits yet (package already exists) | "No admitted exhibits are available to form a jury package yet" | Non-error, informative empty state |
| No package has ever been started (reworked Phase 9, T-10) | Full-content-width empty state naming which roles (`DEPUTY`/`CLERK`/`ADMIN`) can start one; "Start package" button rendered only for those roles; Readiness Preview panel rendered beneath for every role | Replaces the pre-Phase-9 auto-create-on-view behavior — viewing this screen now never creates a `JuryPackage` row under any circumstance (F11 §Process step 10) |
| "Start package" clicked (new, Phase 9) | Button shows a brief inline spinner; on success the screen transitions to the normal Draft card layout | Explicit click is now the only path to package creation — never a side effect of navigation (T-10) |
| Readiness Preview — viewed by any role, including Judge (new, Phase 9) | Identical read-only panel for every role; summary line + per-exhibit ready/blocked rows; no action controls of any kind | Confirms a `JUDGE` can see exactly what's blocking readiness without ever starting or finalizing a package (T-10, F25) |
| Readiness Preview — a sealed/ex-parte exhibit, unauthorized role (new, Phase 9) | Row simply absent from the preview list | Confirms existence is never revealed, consistent with `Y0-patterns.md` §Pattern: Sealed-Exhibit Invisibility |
| Readiness Preview load failure | Inline error: "Unable to load the jury package readiness preview — please retry" (`JURY_PACKAGE_PREVIEW_LOAD_FAILED`) with a retry button | Independent of the main package load — a preview failure never blocks the empty state or Draft/Finalized views from rendering |
| Load failure | Inline error with retry | — |
| Viewed by non-finalizing role (Judge/Attorney/Chambers Staff) | Identical layout, but Finalize/Acknowledge/Remove-from-Package/Start-New-Draft controls render as view-only (absent, not disabled-with-explanation) — "Export as PDF" and "View Version History" remain available to every role; a sealed/ex-parte blocker row is still visible in its full critical-severity treatment, just without the removal action | Supports JRN-01.2 (judge review) and JRN-03.1 (attorney verification) from the same screen, no separate "audit view" needed (US-13.3) |

#### Interactive Elements

| Element | Type | Behavior |
|---------|------|----------|
| "Finalize Jury Package" | Primary action button | Disabled whenever any Blockers card exists; on click, triggers fresh server-side re-validation before committing (US-5.2, US-11.2); rendered only for `DEPUTY`/`CLERK`/`ADMIN` — see "Request finalization from Clerk" below for other roles |
| "Record ruling" on a Blockers card (added Phase 8, F24) | Inline write action | Opens the ruling disposition form for that card's specific `objectionId`; rendered only for `JUDGE`; `data-testid="jury-package-blocker-record-ruling-button"` (US-24.1) |
| "Assign custodian" on a Blockers card (added Phase 8, F24) | Inline write action | Opens the first-assignment/propose form for that card's exhibit; rendered only for `DEPUTY`/`CLERK`/`ADMIN`; `data-testid="jury-package-blocker-assign-custodian-button"` (US-24.2) |
| "Acknowledge ▾" button on a Blockers card | Action, expands inline justification textarea in place | Same acknowledgment flow as Exhibit Detail View (US-6.3); rendered only for `DEPUTY`/`CLERK`/`JUDGE`/`ADMIN` — absent, not disabled, for other roles; accompanied by always-visible copy disclosing the action is permanently recorded under the acting user's name and role before it is confirmed; justification field labeled "Justification (recorded permanently)"; `data-testid="jury-package-blocker-acknowledge-textarea"` (US-14.1, US-14.2) |
| "Remove from Package" button on the sealed/ex-parte CRITICAL card | Action, confirmation step | Rendered only for `DEPUTY`/`CLERK`/`ADMIN` — absent for other roles; appends an immutable, auditable exclusion event and removes the card from the Blockers section, retaining the record for audit (never deletes it); unavailable once the package is `FINALIZED` (US-13.2) |
| "Request finalization from Clerk" (added Phase 8, F11, US-11.3) | Primary action button (in place of Finalize) | Rendered only for roles outside F20's finalize-authorized set (`JUDGE`/`CHAMBERS_STAFF`/`ATTORNEY`); calls `POST /api/jury-package/:id/request-finalization`; never finalizes, never bypasses the discrepancy gate; `data-testid="request-finalization-button"` |
| "Export as PDF ⬇" (any `FINALIZED` version) | Action | Calls `GET /api/jury-package/:id/export`, streams back a real `application/pdf` file and triggers a browser download — replaces the prior `window.print()`-based "Export / Print" control entirely; available to every viewing role; hard-disabled (never merely hidden) for a `DRAFT` package (US-23.2) |
| "Start New Draft" (finalized state only) | Action | Creates a new `DRAFT` `JuryPackage` for the case, independent of and without altering the just-finalized version; rendered only for `DEPUTY`/`CLERK`/`ADMIN` (same role set as Finalize, unchanged by F20) — absent otherwise (US-23.1) |
| "View Version History ▾" | Disclosure toggle | Expands the per-case list of every `FINALIZED` version plus the current `DRAFT` (if any), each with its own independent "Export as PDF" action and an `isMostRecent` indicator on exactly one row; available to every viewing role from both Draft and Finalized states (US-23.3) |
| Blockers / Clean card (any state) | Click target | Navigates to Exhibit Detail View for full context — same click-through behavior the prior table's row offered |
| "Start package" (new, Phase 9, T-10) | Primary action button, empty state only | Calls `POST /api/cases/:id/jury-package` only on this explicit click — never as a side effect of viewing the page; rendered only for `DEPUTY`/`CLERK`/`ADMIN`; `data-testid="start-jury-package-button"` |
| Readiness Preview Panel (new, Phase 9, T-10, F25) | Read-only display, no write controls | Lists every admitted exhibit's ready/blocked state; identical for every role including `JUDGE`; polls on the standard live-sync interval; `data-testid="jury-package-readiness-preview"` |

**`data-testid`/`aria-label` contract (amended Phase 9, US-24.3):** `jury-package-progress-banner`, `jury-package-blockers-section`, `jury-package-blocker-card`, `jury-package-blocker-acknowledge-textarea`, `jury-package-blocker-record-ruling-button`, `jury-package-blocker-assign-custodian-button`, `jury-package-clean-section`, `jury-package-clean-card`, `request-finalization-button`, `finalization-requested-banner` — unchanged from Phase 8; the pre-existing `jury-exhibit-row` selector family referenced by the Phase 1–7 Playwright suite (per US-24.3's named example) continues to resolve against whatever element the card layout uses for its equivalent row/card. New as of Phase 9 (T-10): `start-jury-package-button`, `jury-package-readiness-preview`, `readiness-preview-row`, `readiness-preview-summary`.

**Design intent note:** This screen is a pure presentation + action-trigger layer per FRD F11 — it never computes eligibility or discrepancy status client-side, eliminating any possibility of showing a "clean" state the server wouldn't also enforce. The sealed/ex-parte exclusion (F13/F16) is structural at the candidate-query level, not a client-side filter — this screen's "Remove from Package" action exists purely as an auditable remediation path for the regression/legacy-data case, never as the primary mechanism keeping sealed material out of the package. As of Phase 7.1 (F23), finalization is no longer a one-shot action that replaces the draft in place — it mints a new, immutable, numbered version and leaves every prior version independently retrievable and exportable; "Start New Draft" is the explicit action that begins the next version's lifecycle, never an automatic side effect of finalizing. As of Phase 8, the Blockers/Clean card layout and the "Request finalization from Clerk" path are presentation- and workflow-additive only — F5's discrepancy gate, F13's structural exclusion, and F20's role matrix are unchanged and remain the sole source of what is actually enforced server-side. As of Phase 9, package *creation* itself becomes explicit-click-only (T-10) and the read-only Readiness Preview (F25) gives every role, including non-starting roles, visibility into readiness without that click.
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
### Screen: Pending-Ruling Queue

**Purpose:** A judge-only, read-mostly queue of every currently-`UNRESOLVED` objection thread case-wide, sorted longest-waiting-first, so a judge can triage by elapsed wait time instead of discovering unresolved objections exhibit-by-exhibit. New 6th screen added in Phase 7.1 — see `00-overview.md` §Scope Note for the decision record on why this is a dedicated screen rather than an extension of the Command Center's existing Unresolved Objections panel.
**User Stories:** US-21.1, US-21.2
**Journey:** JRN-01.2 (Check the Pending-Ruling Queue)
**Route:** `/pending-rulings` · **Nav:** Sidebar "Pending Rulings" — **rendered only when the active role is `JUDGE`**; the sidebar entry does not exist for any other role (absent, not disabled — see `Y0-patterns.md` §Pattern: Role-Gated Control Visibility). The underlying read endpoint (`GET /api/cases/:id/objections?status=unresolved`) remains readable by any role with case visibility, consistent with every other read endpoint in the system — the UI simply never gives a non-judge role a path to this screen.

#### Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ JudicialSync  [Case: 2026-CR-0142 ▾] [⚠ 1] [Role: Judge ▾] [Ask Pivota]│
├───────────────┬──────────────────────────────────────────────────┤
│ Command Ctr   │  Pending-Ruling Queue          🕐 updated 2s ago  │
│ Case          │  Sorted: longest-waiting first                   │
│ Jury Pkg      │  ┌────────────────────────────────────────────┐  │
│ ▸ Pending Rul.│  │ Exhibit 12 — relevance        waiting 3h 20m│  │
│ Assistant     │  │   raised by M. Webb (Attorney) · 11:40 AM   │  │
│               │  │   [ Sustained ] [ Overruled ] [ Reserved ]  │  │
│               │  │   [ View exhibit history → ]                │  │
│               │  │ ──────────────────────────────────────────  │  │
│               │  │ Exhibit 9 — hearsay             waiting 48m │  │
│               │  │   raised by M. Webb (Attorney) · 2:15 PM    │  │
│               │  │   [ Sustained ] [ Overruled ] [ Reserved ]  │  │
│               │  │   [ View exhibit history → ]                │  │
│               │  │ ──────────────────────────────────────────  │  │
│               │  │ Exhibit 3 — lack of foundation  waiting 6m  │  │
│               │  │   raised by M. Webb (Attorney) · 2:57 PM    │  │
│               │  │   [ Sustained ] [ Overruled ] [ Reserved ]  │  │
│               │  │   [ View exhibit history → ]                │  │
│               │  │ ... (live-updating, 3–5s poll)               │  │
│               │  └────────────────────────────────────────────┘  │
└───────────────┴──────────────────────────────────────────────────┘
```

#### Information Hierarchy

| Priority | Content | Placement |
|----------|---------|-----------|
| Primary | Elapsed wait time per row, driving sort order (longest first) | Right-aligned per row, largest visual weight after the exhibit label |
| Primary | Exhibit label + objecting party + grounds | Leftmost, same row — identical "never unattributed" rule as the Command Center's Activity Feed Row Format pattern |
| Primary | Ruling action (Sustained / Overruled / Reserved) | Directly on the row — no drill-in required to act |
| Secondary | "View exhibit history →" link-through | Beneath the ruling actions, same row |
| Tertiary | "Updated Xs ago" freshness indicator | Top-right corner, matching the Command Center's existing convention |

#### States

| State | Appearance | User Feedback |
|-------|------------|----------------|
| Default (objections pending) | Rows sorted oldest-`raisedAt`-first (longest elapsed wait at top), each with a live-recomputing elapsed-time value | Recomputed on every live-sync poll tick (3–5s) — no manual refresh needed (US-21.1) |
| Loading (initial load) | Skeleton rows, matching Command Center's loading treatment | Subtle shimmer, no spinner text |
| Empty — no unresolved objections | "No unresolved objections — the queue is clear" with a quiet checkmark | Calm, confidence-reinforcing — identical tone to the Command Center's equivalent empty state |
| Ruling recorded from this screen | Row fades out and is removed from the queue on the next poll tick — no special-case removal animation, the row is simply absent from the next `getUnresolvedObjections` response | Confirms the thread left the unresolved set; no stale row lingers (US-21.2) |
| Ruling recorded elsewhere (e.g., Exhibit Detail) while this screen is open | Row disappears identically on the next poll tick | Same live-sync guarantee as every other polling screen in the product |
| Row whose exhibit is not visible to the requesting role | Omitted entirely from the queue — never rendered with a blank or placeholder label | Matches the Sealed-Exhibit Invisibility pattern; in practice rare on this screen since it is judge-only and judges see sealed/chambers-ex-parte material, but enforced identically as a defense-in-depth measure (US-21.2) |
| Non-judge role / direct URL access | The route is not reachable via navigation for any non-judge role; if accessed directly, renders the same access-denied treatment used elsewhere for role-inappropriate direct navigation — never a silent blank page | Consistent with "absent, not disabled" extending to the nav entry point itself |
| Load failure | Inline error: "Unable to load the pending-ruling queue — please retry" with a retry button | — |

#### Interactive Elements

| Element | Type | Behavior |
|---------|------|----------|
| Ruling action (Sustained / Overruled / Reserved) | Inline action, 1 of 3 options per row | Calls the existing `POST /api/objections/:id/ruling` (F02) for that specific objection thread; `SUSTAINED`/`OVERRULED` closes the thread (row disappears next poll), `RESERVED` keeps it unresolved (row remains, elapsed time keeps counting) — identical behavior and role gate (`JUDGE`-only, unchanged by F20) to the ruling action already specified on Exhibit Detail View (US-21.2, US-2.2) |
| "View exhibit history →" | Link-through | Navigates to the Exhibit Detail View (F10) for full context before ruling — same destination as every other drill-through path in the product |
| "Ask Pivota" header button | Global | Opens Pivota Assistant slide-over without leaving this screen |

**Explicitly scoped as judge-only, not merely judge-emphasized (F21):** unlike every other screen in this document, this screen has no "viewed by a non-finalizing/non-acting role" state to specify, because no other role is ever given a navigation path to it at all — there is no judge-only *content* with a read-only fallback for other roles, as there is on the Jury Package Workspace; the entire screen is judge-exclusive by design.

**No new backend surface:** this screen introduces no new endpoint, no new schema, and no new validation — it is a new client-side screen (sort + live-recomputed elapsed time + role-gated nav entry) over F02's existing, unchanged `getUnresolvedObjections(caseId)` response, additively widened with `exhibitLabel` via a read-time join (F21).
## Interaction Patterns

**Design System (as of Phase 6, re-themed Phase 8):** All patterns below are implemented using IBM Carbon Design System (carbondesignsystem.com) components. The component layer and every interaction guarantee described in each pattern is unchanged since Phase 6. **Phase 8 amendment:** the visual *theme* layered on top of Carbon changes from the original Carbon-light theme to a reviewed dark-dashboard theme (dark-navy sidebar, light content area, rounded-corner card panels) — see `00-overview.md` §Visual Foundation. This is a token/styling migration only, exactly like the Phase 6 Carbon migration before it: no pattern's behavior, role-gating, or `data-testid`/`aria-label` contract changes as a result (US-24.3).

### Pattern: Inline Row Actions (not modal forms)

**When to use:** Any time a user needs to log a status change, objection, ruling, or custody transfer from the Case Workspace or Exhibit Detail View.
**Behavior:** A compact, inline expansion directly within the row/header — never a full-screen modal dialog or a separate "add record" page. Only valid next actions are offered as options (e.g., only valid forward status transitions appear in the dropdown); invalid options are never shown as disabled list items requiring explanation, they are simply absent.
**Examples:** "Record Status," "Propose Custody Transfer," "Raise Objection" actions on Case Workspace rows and the Exhibit Detail header (US-1.1, US-2.1, US-3.1).
**Rationale:** Reinforces "assistant augmenting an existing workflow," not "new case management system to learn" (PROJECT.md positioning constraint). A deputy who already knows the paper-log motions should find this faster, not slower, than what it replaces.
**Phase 7.1 amendment (F20):** every one of these inline actions is now additionally gated by server-side role per the Permission Matrix — see §Pattern: Role-Gated Control Visibility below for the rendering rule, and §Pattern: Two-Phase Custody Handoff for "Transfer Custody"'s renamed, split propose/confirm/cancel behavior.

---

### Pattern: Status Badge Visual Convention (single source of truth, reworked Phase 9, T-03)

**When to use:** Anywhere an exhibit's current lifecycle status is displayed — Command Center (status-distribution bar + its legend, KPI tiles), Case Workspace (status pills + the Status filter dropdown), Exhibit Detail (header + timeline history), Jury Package Workspace, and the Assistant's text answers.
**Behavior:** A single consistent dot-plus-label convention (`●ADMITTED`, `●OFFERED`, etc.) with a fixed color mapping per status value, used identically everywhere status renders (implemented as a Carbon `Tag` using Carbon's status-color tokens as of Phase 6). **Supersedes any per-screen or per-consumer re-implementation of this mapping:** a single `StatusBadge` component is the **sole** source of the status→Carbon-`Tag`-type/icon mapping for all six statuses (`MARKED`/`OFFERED`/`OBJECTED`/`ADMITTED`/`EXCLUDED`/`WITHDRAWN`); every consumer — the Command Center's status-distribution-bar legend, Case Workspace's row pills and Status filter dropdown's option swatches, Exhibit Detail's header badge and timeline entries, and the Jury Package card's status badge — imports and reads from this one map, never hand-rolling its own color/icon pairing. No two statuses may share a hue family closely enough to be confused at a glance (T-03, `Y2-accessibility.md` §Color Contrast) — this is verified, not merely intended: all six statuses are independently checked for pairwise visual distinctness, not just individual AA contrast. The severity-tier scale (`CRITICAL`/`HIGH`/`PENDING`/`MEDIUM`, §Pattern: Severity Tier Badge below) is a **separate, independently-colored scale** and must never be conflated with or reuse a status color — a status badge and a severity badge appearing side-by-side (e.g., on the Command Center attention table) must never accidentally share a color that implies a relationship between the two scales that doesn't exist. The Assistant renders the same status word in its prose (never a paraphrase like "fully accepted" for `ADMITTED`). Service-reported tier/status ordering is authoritative wherever either scale drives a sort — the UI never independently re-sorts by either.
**Examples:** Every screen wireframe in this document.
**Rationale:** US-1.2 requires that status "never" appears to differ across screens — a shared component (not N independent implementations) is the only way to structurally guarantee this; Phase 9's UX review found that as more consumers were added (filters, legends, charts), the discipline of "one map, many readers" needed to be stated explicitly and verified, not just assumed from the original Phase 6 migration.

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

### Pattern: Role-Gated Control Visibility (F20, Phase 7.1)

**When to use:** Any control that triggers a write action now covered by F20's system-wide Permission Matrix — creating an exhibit, a mark/offer/withdraw or admit/exclude status transition, raising an objection, proposing a custody transfer, or confirming a custody transfer — in addition to the acknowledge/remove actions already covered by the Permanent-Record Disclosure pattern above.
**Behavior:** The exact same absence rule first established for discrepancy acknowledgment (F14) and sealed-exhibit removal (F13), now generalized and applied system-wide: if the currently active role is not in the action's permitted set (per F20's matrix), the control is not rendered at all — never disabled, greyed-out, or present-with-a-tooltip-explaining-why. If the role is permitted, the control renders and behaves exactly as already specified by the feature that defines it (F0/F1/F2/F19). **This pattern does not, by itself, add the pre-action disclosure copy** required by Permanent-Record Disclosure — that additional requirement remains specific to acknowledge/remove, which F14/F13 single out for carrying an explicit "this will be permanently recorded under your name" warning; routine write actions (creating an exhibit, transitioning status, raising an objection, proposing a transfer) are simply absent-or-present, with no extra disclosure text, since every write in this system is already ledger-recorded as a matter of course and F14/F13's disclosure requirement was never generalized to every action by the FRD.
**Special case — identity, not just role (confirm custody):** confirming a custody transfer (F19/F20 row 7) requires passing *both* this pattern's role check (`DEPUTY`/`CLERK`/`ADMIN`) *and* an independent exact-identity check (the active user must be the pending transfer's named receiver) — a role-permitted user who is not the named receiver still does not see the "Confirm" control, exactly as if they lacked the role entirely. See §Pattern: Two-Phase Custody Handoff below.
**Examples:** Case Workspace's "+ New Exhibit" toolbar action (absent outside `DEPUTY`/`CLERK`/`ADMIN`); "Record Status" and "Propose Custody Transfer" on Case Workspace rows and the Exhibit Detail header (absent outside `DEPUTY`/`CLERK`/`ADMIN`); "Raise Objection" (absent outside `ATTORNEY`/`DEPUTY`/`CLERK`/`ADMIN`); "Confirm Receipt" on a pending custody transfer (absent for anyone but the exact named receiver).
**Rationale:** F20 formally extends server-side authorization to every write action in the system; a UI that still rendered an enabled-looking control for an action the server will reject would reintroduce exactly the "client-side affordance the server silently rejects anyway" risk F20 exists to close (JOURNEYS §Cross-Journey Patterns, "Unilateral assertion standing in for acknowledged fact"). A single named pattern — rather than one-off per-screen judgment calls — is what keeps all six screens consistent as new F20-gated actions are added.

---

### Pattern: Two-Phase Custody Handoff (Propose / Confirm / Cancel) (F19, Phase 7.1)

**When to use:** Any screen displaying an exhibit's custody section — Exhibit Detail View's header (primary surface for this pattern) and Case Workspace's custodian column (summary indicator only, full actions live on Exhibit Detail).
**Behavior:** Custody transfer renders in three distinct states, never collapsed into one: (1) **Settled** — a plain custodian name, with a "Propose Custody Transfer" control available per the Role-Gated Control Visibility pattern (`DEPUTY`/`CLERK`/`ADMIN`); (2) **Pending** — an always-visible informational banner (not amber/warning-colored — this is an in-progress state, not a problem — e.g., a neutral blue/grey treatment distinct from the Discrepancy Flag Treatment pattern) reading "Pending transfer to {receiver} — awaiting their confirmation," alongside a "Cancel Transfer" control visible to the original proposer or any `DEPUTY`/`CLERK`/`ADMIN` role, and a "Confirm Receipt" control visible **only** when the active user is the exact named receiver — a role-permitted user who is not that specific person sees the banner and the Cancel control but never Confirm; (3) **Settled (post-confirm)** — reverts to state (1) with the new custodian's name, the pending banner removed, and the transfer now appearing as a `CUSTODY_TRANSFER_CONFIRMED` entry in the timeline. No control ever lets a second transfer be proposed while one is already pending (the "Propose" control itself is absent/unavailable during the Pending state, matching `CUSTODY_TRANSFER_ALREADY_PENDING`).
**Identity vs. role:** because the demo seeds exactly one `User` per `Role` (F0), the active role switcher selection doubles as identity for this pattern's purposes — "Confirm Receipt" is rendered precisely when the currently switched role/user matches the pending transfer's named receiver, which in this demo is equivalent to checking identity directly. This is called out explicitly because it is a demo-specific simplification of F19's general exact-identity requirement, not a weakening of it: in a system with multiple users per role, the check would need to compare `actorUserId`, not role, but the two coincide here.
**Examples:** Exhibit Detail View custody section (primary); Case Workspace custodian column shows a compact "→ pending: {receiver}" indicator with a link through to Exhibit Detail for the actual Confirm/Cancel actions, rather than duplicating the full pattern inline in a table cell.
**Rationale:** F19 exists specifically to close the gap where a custody record could assert a handoff the receiving party never acknowledged — collapsing propose/pending/confirm into a single "Transfer Custody" button (the pre-Phase-7.1 design) would silently reintroduce that exact gap in the UI even though the backend now requires two phases. Separating "who can end this pending state" (Cancel — role-gated) from "who can complete it" (Confirm — identity-gated) is the single most load-bearing distinction in this pattern and must never be blurred.

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

---

### Pattern: Case Selector (Header Scope Switch) (F22, Phase 7.1)

**When to use:** The app header's case-identifier slot, present identically on all six screens.
**Behavior:** The case identifier (`[Case: 2026-CR-0142]`) becomes an interactive dropdown (`[Case: 2026-CR-0142 ▾]`) in the exact same header slot — no change to header width or the ordering of the other header elements (Case → Discrepancy count → Role → Ask). Opening it lists every case in the system with no role restriction (case existence is not sensitive — only exhibit-level classification/sealed visibility is, and that is unaffected by case selection). Selecting a different case triggers an immediate refetch on every currently-open screen and the assistant's working context, using the same refetch mechanism already wired to role switches — no screen is allowed to continue silently displaying data scoped to the previously-selected case, even for a single frame. On first load with no prior selection, defaults to the first case by `createdAt` ascending, so the original single-case demo script requires zero interaction with this control.
**Examples:** App header case selector (US-22.1, US-22.2, US-22.3).
**Rationale:** JOURNEYS' administrator persona (JRN-04.1 "Switch Cases and Confirm Isolation") treats any observed stale-data carryover during a case switch as a disqualifying finding for the entire product, not a minor bug — the refetch-everything-immediately behavior is therefore a hard requirement of this pattern, not an optimization.

---

### Pattern: Severity Tier Badge (F08, Phase 8)

**When to use:** Any entry in the Command Center's "Needs your attention" feed, and anywhere else a severity tier (`CRITICAL`/`HIGH`/`PENDING`/`MEDIUM`) is rendered.
**Behavior:** A fixed color mapping, applied identically everywhere a tier renders, never introduced ad hoc per-screen: `CRITICAL` = dark red, `HIGH` = amber, `PENDING` = amber-light (a lighter/desaturated amber, deliberately distinct from `HIGH`'s amber at a glance), `MEDIUM` = yellow. As with the Status Badge Visual Convention pattern, color is never the sole signal — the tier word itself ("Critical," "High," "Pending," "Medium") always renders as visible text alongside the badge, and an `aria-label` (e.g., `aria-label="Severity: Critical"`) carries the same information to assistive technology. Tiers are never interleaved in a ranked list: every `CRITICAL` entry renders before any `HIGH` entry, every `HIGH` before any `PENDING`, and so on — this pattern governs the badge's *appearance*, not the list's sort order (see F08 §Process step 5 for the sort rule itself).
**Examples:** Command Center "Needs your attention" feed entries (US-8.4).
**Rationale:** A judge scanning the feed under time pressure needs the highest-severity item to be visually unmistakable without reading every row's text first — a single shared badge component (not a per-tier bespoke treatment) is what guarantees `CRITICAL` always reads as more urgent than `MEDIUM` at a glance, consistently, everywhere it appears.

---

### Pattern: Attention Feed Inline Action (F24, Phase 8)

**When to use:** The "Record ruling" and "Transfer custody"/"Assign custodian" controls on a Command Center attention-feed entry — the two write actions that supersede Phase 5's strictly-read-only Command Center constraint (see `00-overview.md` Design Principle 4 and `Screen-00-trial-command-center.md`'s "Design decision supersedes a prior constraint" note).
**Behavior:** Clicking the action button expands an inline form directly within the feed entry — never a modal, never a navigation away from the Command Center — following the same "inline, not modal" spirit as the Inline Row Actions pattern. The form always requires an explicit, distinct confirm step before the underlying write request is sent; no selection (e.g., picking a disposition or a custodian) auto-submits by itself. The button itself renders only for an F20-authorized role for that specific action (`JUDGE` for "Record ruling"; `DEPUTY`/`CLERK`/`ADMIN` for "Assign custodian"/"Transfer custody") — absent, not disabled, for any other role, per the Role-Gated Control Visibility pattern. On success, the entry does not optimistically disappear or update — it waits for the next live-sync poll tick to confirm the new ledger state, then either fades out (ruling resolved) or re-ranks (reserved ruling; custody re-evaluated under a new condition). On failure, the specific rejection reason (e.g., `409 OBJECTION_ALREADY_RESOLVED`, `409 CUSTODY_CHAIN_BROKEN`) renders inline within the still-open form, matching the Multi-Reason Blocking Error pattern's "name the specific reason" spirit, and the entry remains in the feed unchanged.
**Examples:** Command Center "Needs your attention" feed — "Record ruling" (`HIGH`/`PENDING` tiers), "Assign custodian" (`MEDIUM` tier) (US-24.1, US-24.2).
**Rationale:** The PRD's own risk register (§8) names "Command Center's new inline write actions triggered accidentally from what was designed as a passive glance screen" as a medium-impact risk; the explicit-confirm-required rule and the no-optimistic-update rule are this pattern's two direct mitigations, and both must hold even though this is the one part of the Command Center no longer strictly read-only.

---

### Pattern: Readable Flag Pill (Design Principle 7, Phase 8)

**When to use:** Any indicator that previously relied on an icon alone to convey an exhibit's flagged/blocked condition — currently Case Workspace's "Flags" column (renamed from a bare discrepancy icon) and the Jury Package eligibility badge.
**Behavior:** Every such indicator pairs a short, specific, readable text label with its color treatment — "Ruling pending," "No custodian," "Open objection," "Ex parte · restricted," "Included," "Blocked," "Not eligible," "Not yet evaluated" *(fourth eligibility value added Phase 9 — see `Screen-01-case-workspace.md` §Jury Package column)* — rather than an icon or color swatch requiring a hover/click to interpret. Multiple simultaneous conditions on the same row render as multiple stacked pills, never collapsed into one generic warning glyph. This does not change any underlying discrepancy/eligibility computation — it is a rendering-layer requirement layered on top of the existing Discrepancy Flag Treatment pattern, not a replacement for it (the amber/color semantics of that pattern are unchanged; this pattern adds the mandatory label).
**Examples:** Case Workspace Flags column (amended Phase 8), Case Workspace and Exhibit Detail Jury Package eligibility badges (added Phase 8; four-value set as of Phase 9).
**Rationale:** Design Principle 5 ("plain language over raw data") already governs ledger-event rendering; Phase 8's UX review found the same principle was not yet applied to flag/status iconography — a judge or deputy glancing at a row with an unfamiliar icon has to stop and hover, which is exactly the "glance, don't drill in" friction the rest of this document works to eliminate.

---

### Pattern: RoleSwitcher Demo-Control Gating (F20, Phase 9, T-09)

**When to use:** The header's role switcher, present identically on every screen — the one control in this product that exists purely to demonstrate role-scoped behavior and has no production equivalent.
**Behavior:** Two guarantees, both required: (1) the role switcher is **visibly labeled as a demo/test control** (e.g., a distinct visual treatment and a label such as "Demo role switch" rather than presenting as an ordinary account/profile menu), and/or is rendered only behind a non-production environment flag — it must never appear to be, or be mistaken for, a production authentication mechanism; (2) **after switching roles, a persistent banner names the newly active role and offers a "switch back" action** — e.g., "Active role: Deputy — switch back" — so the acting role is never ambiguous mid-session, especially after a presenter has switched several times in a row. The banner persists across navigation (it is part of the app shell, not a per-screen toast that disappears) until the role is switched again or back to its original value. The acting role is included in every TanStack Query cache key, so switching invalidates and refetches affected data automatically, and every permission-matrix-gated control (Add exhibit, Record ruling, Transfer custody, etc.) updates its visible availability immediately on switch, without a page reload.
**Examples:** App header role switcher (every screen); the "Active role: X — switch back" banner (new, Phase 9).
**Rationale:** F20's Phase 9 addendum is explicit that this is a client-side usability/legibility layer only — `assertRole` and the server-side permission matrix remain the sole authority on whether an action actually succeeds. But a demo presenter switching roles live, with no visual confirmation of which role is currently active, risks narrating a scenario against the wrong role entirely (e.g., demonstrating "Judge can't add an exhibit" while actually still switched to Deputy) — the persistent banner closes that gap without granting the switcher any new authority.

---

### Pattern: Layer-Model Surface (No Triple-Nested Card-in-Panel-in-Page, Phase 9, T-13)

**When to use:** Any screen composing more than one Carbon surface element (`Tile`, card, panel) within another — currently relevant to the Command Center's KPI tiles within the page body, the Jury Package Workspace's Blockers/Clean cards within their sections, and the Exhibit Detail right rail's three cards within the page's two-column layout.
**Behavior:** Surface depth is governed by Carbon's `Layer` token system, not by ad hoc nested `background`/`border`/`box-shadow` styling. A page body sits at layer 1; a card or tile placed directly on it sits at layer 2; **a card is never placed inside a panel that is itself inside another bordered/shadowed container** — i.e., no "card-in-panel-in-page" triple nesting, where three visually-distinct bordered boxes stack inside one another for no structural reason. Where a grouping is needed (e.g., the Jury Package Workspace's "Blockers" section containing several blocker cards), the *section* is a plain layout grouping (heading + spacing), not itself a bordered/shadowed surface — only the cards within it carry surface styling (Carbon `Layer` level 2), so the visual depth never exceeds two levels on any screen in this product.
**Examples:** Command Center KPI tile row (tiles sit directly on the page body, not inside an intermediate "stat panel" container); Jury Package Blockers/Clean sections (plain heading groupings, not bordered containers, holding Layer-2 cards); Exhibit Detail right rail (three Layer-2 cards in a plain-grouped column, not a bordered rail container holding bordered cards).
**Rationale:** Phase 9's UI review found that an earlier implementation pattern of wrapping a card-holding section in its own panel chrome (effectively nesting Carbon surfaces three deep) produced visually muddy, hard-to-scan screens where it was unclear which border belonged to which piece of content — exactly the opposite of the "glance, don't drill in" goal this product is built around. Using Carbon's `Layer` tokens as the sole source of surface depth makes "how many levels deep is this" a structural property of the component tree, not a per-screen styling judgment call that can silently drift.

---

### Pattern: Standardized Spacing & Button Sizing (Phase 9, T-14)

**When to use:** Every interactive control and layout gap in the product — buttons, tile/card padding, section margins, and the spacing between stacked elements on all six screens.
**Behavior:** Two guarantees, both required: (1) **all spacing uses Carbon's spacing token scale exclusively** (`$spacing-01` through `$spacing-13`) — no hardcoded pixel margins/paddings/gaps anywhere in the component layer, so a 12px gap in one place and an 11px gap in a visually-equivalent place elsewhere (a symptom of ad hoc styling) cannot occur; (2) **exactly one Carbon `Button` size is used across the entire app — `md`** — never a mix of `sm`/`lg`/custom-sized buttons on different screens for equivalent actions. Visual emphasis is expressed through Carbon's `kind` prop (`primary` for the one highest-emphasis action in a given context, `tertiary` for a secondary action, `ghost` for a low-emphasis/link-like action) rather than through size variation. No button anywhere specifies a custom/fixed width — every button sizes to its label (plus Carbon's standard internal padding) or, where appropriate, stretches to its container's full width via a layout property, never a hardcoded `width: NNNpx`.
**Examples:** Command Center's "Record ruling"/"Assign custodian" attention-table actions, Exhibit Detail's discrepancy-banner buttons, Jury Package's "Finalize"/"Start package" buttons, Case Workspace's "+ New Exhibit" and "Clear filters" — all `md`-sized, `kind` varying by emphasis, no custom widths, consistent spacing tokens throughout.
**Rationale:** Phase 9's UI review found an accumulation of one-off button sizes and hand-tuned pixel gaps across screens built in different phases — individually minor, but collectively producing a product that reads as stitched-together rather than designed as one system. Standardizing on Carbon's token scale and a single button size removes the judgment call ("should this button be slightly bigger?") entirely, which is the only way to guarantee consistency holds as new screens are added in future phases.
## Responsive Considerations

Per PROJECT.md §Out of Scope, JudicialSync targets **web/desktop screens only** — no mobile-native app is in scope. However, a judge's bench tablet (JRN-01.2: "Opens the Trial Command Center on the bench tablet during a two-minute recess") is an explicitly named real-world touchpoint, so tablet-width responsiveness is a first-class concern even though mobile phone layouts are not.

### Desktop (>1024px) — Primary Design Target

- Full sidebar (labeled icons + text, dark-navy background as of Phase 8) always visible, pinned left.
- Case Workspace and Jury Package Workspace render full multi-column tables with all fields visible without horizontal scroll.
- The Pivota Assistant slide-over panel occupies roughly 30% of viewport width, docked right, with the underlying screen dimmed but still visible for context.
- Exhibit Detail View (amended Phase 8): renders as **two columns** — the left column keeps the header block and timeline at generous width (timelines are inherently vertical; no benefit to splitting this further); the right column is the fixed-width, three-card rail (Objection / Chain of Custody / Jury Package checklist), stacked vertically and visible without scrolling at this breakpoint; the pending-custody banner (F19) spans the left column's full width, replacing the status/custodian line it temporarily substitutes, never bleeding into the right rail.
- Trial Command Center (amended Phase 8; viewport contract added Phase 9, T-01): the KPI tile row renders as a single compact strip, <=80px tall, across the full content width; the status-distribution bar spans the full content width beneath it; the "Needs your attention" DataTable, Jury Package summary widget, and Custody-at-a-Glance panel each render at full readable width with no truncation of severity tags or custodian names. **Concrete contract (T-01):** at a **1440×900** viewport, the "Needs your attention" table must render **at least 6 ranked rows visible without scrolling** — this is the specific, testable budget the KPI tile row's <=80px cap and the LiveIndicator's compact header placement exist to protect; if a future addition to this screen's first viewport (a new tile, a taller header) would push visible row count below 6 at 1440×900, that addition must be reconsidered or placed lower on the page instead.
- Jury Package Workspace (amended Phase 8): Blockers and Clean cards render in a single-column stack (not a grid) at this breakpoint, matching the inline-expandable-textarea interaction's need for full card width when a card's Acknowledge disclosure is open.
- The Pending-Ruling Queue (F21, judge-only) renders as a single generous-width column of rows, each row's three ruling-action buttons laid out horizontally inline — no drill-in required to act, consistent with it being a triage screen, not a browse screen.
- The header's Case Selector (F22) opens as a simple dropdown anchored to its header slot — it does not reflow or widen the header bar at any desktop width.

### Tablet (768px–1024px) — Judge's Bench Device, High Priority

- Sidebar collapses to icon-only (labels on tap/hover) to preserve content width — this is the primary device for JRN-01.2's "glance during recess" moment, so Command Center legibility at this width is tested explicitly.
- Case Workspace and Jury Package Workspace tables drop lower-priority columns first (description, source) while keeping status badge, custodian, and discrepancy indicator — the three fields a judge glancing mid-recess needs most (US-9.1 information hierarchy). **Amended Phase 8:** the Jury Package eligibility column and the Flags text pills are treated as equal-priority to status/custodian and are also retained at this breakpoint — a judge glancing at the bench needs "is this blocked" as much as "what's its status."
- Trial Command Center (amended Phase 8; KPI tile row reworked Phase 9): the KPI tile row wraps to a 2×2 grid rather than scrolling horizontally (the <=80px single-row cap is a desktop-only budget; tablet width prioritizes legible tap targets over vertical compactness); the status-distribution bar's legend wraps beneath the bar instead of staying single-line; the "Needs your attention" table's Issue column narrows first (truncating objection-grounds text with a tap-to-expand, never dropping the Severity/Age/Action columns); the Jury Package summary widget and Custody-at-a-Glance panel stack vertically (one above the other) rather than side-by-side, preserving full-width legibility for each over a cramped two-column squeeze.
- Exhibit Detail View (amended Phase 8): the two-column desktop layout collapses to a single column — the right-rail cards (Objection, Chain of Custody, Jury Package checklist) render stacked beneath the timeline, each at full width, rather than beside it, since a judge's tablet-width viewport cannot comfortably support two full-width columns simultaneously.
- Jury Package Workspace (amended Phase 8): Blockers cards retain their full inline-expandable-textarea width (never truncated), since the Acknowledge action is a judge-reachable control (per F6's role set including `JUDGE`) and must remain fully usable on the bench device.
- The Pivota Assistant slide-over expands to ~60% of viewport width at this breakpoint (text legibility matters more than preserving background-screen visibility on a smaller canvas) — reinforces that on the bench, asking a question is the primary action, not a secondary overlay.
- Touch targets (row actions, citation pills, Finalize button, and — added Phase 8 — attention-feed inline action buttons and Blockers-card action buttons) sized to a minimum 44×44px tap area, since a judge on a tablet may be using touch rather than a trackpad.
- The Pending-Ruling Queue's three ruling-action buttons (Sustained/Overruled/Reserved) retain the same 44×44px minimum tap target at this breakpoint, since this screen exists specifically for the judge's bench-tablet use case (JRN-01.2 "Check the Pending-Ruling Queue") and is never expected to be used at desktop-only precision.

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
- **Severity Tier Badges (added Phase 8):** `CRITICAL` (dark red), `HIGH` (amber), `PENDING` (amber-light), `MEDIUM` (yellow) each meet WCAG AA contrast against the card background they render on, and — critically, since `HIGH` and `PENDING` are both amber-family — the tier word itself always renders as visible text alongside the badge, so the two tiers remain distinguishable for colorblind users even where the color difference alone might not be, per `Y0-patterns.md` §Pattern: Severity Tier Badge.
- **Dark-dashboard sidebar contrast (added Phase 8):** the dark-navy sidebar's text/icon labels meet WCAG AA contrast (4.5:1 minimum) against the navy background; the content area to the right of the sidebar remains light, so no body text, table cell, or timeline entry inherits reduced contrast from the sidebar's dark theme — only the sidebar and card chrome use the dark palette (`00-overview.md` §Visual Foundation).
- **Jury Package eligibility / Flags text pills (added Phase 8; four-value eligibility set as of Phase 9):** `Included`/`Blocked`/`Not eligible`/`Not yet evaluated` and the Flags column's readable labels ("Ruling pending," "No custodian," etc.) pair their color coding with the label text itself, meeting the same "never color alone" requirement already applied to status badges and discrepancy treatment (`Y0-patterns.md` §Pattern: Readable Flag Pill).
- **Color is never the only signal, restated as a general rule (reworked Phase 9, T-02, T-03):** every color-coded indicator in the product — status badge, severity tag, Jury Package eligibility tag, Flags pill, `LiveIndicator` dot — pairs its color with either a distinct icon shape or restates the condition as visible text (never color alone, and for the severity scale specifically, both an icon **and** the tier word together, since `HIGH`/`PENDING` share an amber family). This is the single governing rule the per-indicator bullets above and `Y0-patterns.md` §Pattern: Severity Tier Badge / §Pattern: Status Badge Visual Convention both implement — stated here once so no future indicator is added without it.
- **Automated contrast gate — hard requirement, not a target (reworked Phase 9, T-16):** the 4.5:1 minimum contrast ratio above is not merely a design aspiration — it is verified by an automated `axe-core` accessibility scan run against all four of the product's main pages (Trial Command Center, Case Workspace, Exhibit Detail View, Jury Package Workspace) as a release gate. **Zero contrast violations are allowed** on any of these four pages in any role-switched state; a scan finding even one violation blocks release, the same way a failing test blocks a merge. (Pivota Assistant and the Pending-Ruling Queue remain subject to every contrast rule in this document; they are simply outside this specific four-page automated-gate's current enumerated scope.)

### Typography (Phase 9, T-16)

- **Carbon type tokens used exclusively** — no screen specifies a custom font-size/line-height pairing outside Carbon's defined type scale; every text style in the product traces to a named Carbon type token.
- **Two previously off-scale styles corrected:** the page title (e.g., "Trial Command Center," "Case Workspace") now uses Carbon's `heading-04` token (28px/36px), replacing an ad hoc larger size that didn't match any Carbon type step; mono-rendered exhibit labels (e.g., "Ex. 14," "P-7," "S-2") now use Carbon's `code-01` token (12px/16px), replacing an inconsistent custom monospace size that varied slightly between screens.
- **Tabular figures (`tabular-nums`)** applied to every numeric value that updates live or is scanned top-to-bottom in a column — the attention table's Age column, DataTable row counts, KPI tile numbers, and every timestamp — so digits never visually jitter or misalign as values change on a poll tick.
- **One capitalization rule for section titles — sentence case:** every panel/section heading across all six screens ("Needs your attention," "Custody at a glance," "Where the exhibits stand") uses sentence case consistently — never Title Case or ALL CAPS for the same class of heading on different screens.
- **Font loading verified, not merely declared:** IBM Plex Sans (body text) and IBM Plex Mono (`code-01`/mono contexts) are loaded via Next.js `next/font`, and their actual application at runtime is verified in testing via a `document.fonts.check(...)` assertion — not merely a CSS `font-family` declaration that could silently fall back to a system font if the font file failed to load without anyone noticing.

### Keyboard Navigation

- All inline row actions (Record Status, Propose Custody Transfer, Confirm Receipt, Cancel Transfer, Raise Objection, Acknowledge) are reachable and operable via keyboard alone (Tab to focus, Enter/Space to activate, Escape to collapse the inline action without committing).
- The Pending-Ruling Queue's ruling buttons and "View exhibit history →" link are each independently Tab-reachable per row, in a consistent left-to-right tab order matching the visual row layout.
- The header Case Selector is a standard keyboard-operable dropdown (Enter/Space to open, arrow keys to move between cases, Enter to select, Escape to close without changing selection).
- The Pivota Assistant input is keyboard-first by design: Enter submits, Shift+Enter inserts a newline for longer questions, and the example-question chips are Tab-reachable and Enter-activatable.
- The "Finalize Jury Package" disabled state is exposed via the native `disabled` attribute (not just a CSS class), so assistive technology correctly announces it as unavailable rather than silently skipping it or announcing it as clickable.
- Citation pills are real `<a>`/button elements in the DOM tab order, never a styled `<span>` requiring a mouse click.
- **Added Phase 8:** the Command Center attention feed's inline action buttons ("Record ruling," "Assign custodian"/"Transfer custody"), the Custody-at-a-Glance panel's per-exhibit "Transfer custody" entry points, the Jury Package widget's "Open jury package →" link, every Blockers-card action ("Record ruling," "Assign custodian," "Remove from Package," "Acknowledge ▾"), the inline acknowledge-reason textarea, the "Request finalization from Clerk" button, the Exhibit Detail header's "Transfer custody" and "Ask Pivota about {label}" buttons, and the Case Workspace quick-filter chip row are all independently Tab-reachable and Enter/Space-activatable, in a tab order matching each surface's visual top-to-bottom, left-to-right layout.
- **Added Phase 8:** the Recent Activity filter pills behave as a standard keyboard-operable toggle group — arrow keys move between pills, Enter/Space selects, matching native ARIA `tablist`/`radiogroup` conventions for a mutually-exclusive selection.

### Screen Reader Considerations

- Live-updating panels (Command Center's Recent Activity, Case Workspace's polling rows) use a polite `aria-live` region for new items — announced without interrupting whatever the user is currently focused on, avoiding the "jarring interruption" risk that would undermine the "ambient, not alarming" design intent.
- The Assistant's streaming response uses an `aria-live="polite"` region on the response container so screen-reader users hear the answer as it completes, not token-by-token (which would be unintelligible).
- Discrepancy banners include a visually-hidden (`sr-only`) prefix such as "Warning: " before the rule explanation, so the semantic meaning of the amber color is conveyed audibly even though the visible text itself ("Admitted, no custodian of record") doesn't restate the word "discrepancy."
- The sealed-exhibit "not found" page uses identical markup/ARIA structure to a genuine 404, so assistive technology cannot be used to infer a difference that sighted UI also doesn't reveal (preserving US-10.2's non-disclosure guarantee across modalities).
- The pending-custody-transfer banner (F19) uses a `role="status"` region (informational, not an error) distinct from the `role="alert"` used by discrepancy banners, so screen-reader users do not perceive an in-progress handoff as a problem requiring urgent attention.
- The Pending-Ruling Queue's elapsed-wait-time values update their text content on each live-sync tick inside a polite `aria-live` region scoped to the row, not the whole list, so a screen-reader user isn't re-announced the entire queue every 3–5 seconds — only the row(s) whose wait time or presence actually changed.
- **Added Phase 8:** the Command Center "Needs your attention" feed uses the same scoped-`aria-live` pattern as the Pending-Ruling Queue — an entry appearing, re-ranking, or clearing announces only that entry, not the whole feed, on each poll tick.
- **Added Phase 8:** a Jury Package Blockers card moving to the Clean section (after a fix or acknowledgment) is announced via a polite `aria-live` region scoped to the Blockers/Clean section boundary, so a screen-reader user hears "exhibit moved to Clean" without the entire card list being re-announced.
- **Added Phase 8:** an attention-feed or Blockers-card inline action's success/failure outcome is announced via a polite `aria-live` region local to that entry/card — a rejection reason is read aloud the same way a sighted user sees the inline error text, never silently left for visual-only discovery.

### ARIA Labels Needed

- `aria-label` on each status badge stating the full status in words (e.g., `aria-label="Current status: Admitted"`) rather than relying on the dot glyph alone.
- `aria-describedby` linking each citation pill to its full record reference (record type, ID, timestamp) so screen readers announce complete citation context, not just a truncated visible label like "Ex.14·2:41 PM".
- `role="status"` on the Assistant's decline-response bubble, distinct from `role="alert"` reserved for true error states (e.g., "assistant temporarily unavailable") — ensuring screen-reader users perceive the same calm/non-error framing that sighted users get from the neutral visual styling.
- `aria-disabled` plus a programmatically associated caption (`aria-describedby`) on the Finalize button explaining *why* it's disabled, so the reason is announced, not just the disabled state itself.
- Landmark roles (`nav` for the sidebar, `main` for screen content, `complementary` for the Assistant slide-over panel) so keyboard and screen-reader users can jump directly between the app shell's regions.
- `aria-label` on the header Case Selector stating the full current case identifier (e.g., `aria-label="Active case: 2026-CR-0142, click to switch cases"`), not just the visible truncated text.
- The sidebar's "Pending Rulings" entry, when rendered (judge role only), carries no special ARIA distinction from any other sidebar item — its role-gated absence for other roles is itself the accessibility-relevant behavior (a screen reader for a non-judge role simply never encounters it in the nav list, consistent with the "absent, not disabled" principle applied visually).
- **Added Phase 8:** `aria-label` on each severity badge stating the full tier in words (e.g., `aria-label="Severity: Critical"`), per `Y0-patterns.md` §Pattern: Severity Tier Badge — mirrors the existing status-badge `aria-label` convention above.
- **Added Phase 8:** `aria-label` on each Jury Package eligibility badge and Flags pill stating the full condition in words (e.g., `aria-label="Jury package eligibility: Blocked"`, `aria-label="Flag: No custodian of record"`) — per `Y0-patterns.md` §Pattern: Readable Flag Pill.
- **Added Phase 8:** `aria-pressed` on each Case Workspace quick-filter chip and each Recent Activity filter pill, reflecting single-select toggle-group state for assistive technology.
- **Added Phase 8:** `aria-expanded` on each Blockers card's "Acknowledge ▾" disclosure control, reflecting whether the inline justification textarea is currently expanded.
- **Added Phase 8:** `aria-describedby` linking the Command Center attention feed's inline action buttons to the entry's underlying condition text (e.g., the "Record ruling" button is described by the objection's grounds/elapsed-time text), so a screen-reader user activating the control understands which specific objection it will act on without needing to have just read the preceding row.
