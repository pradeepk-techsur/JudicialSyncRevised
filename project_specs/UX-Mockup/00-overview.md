# UX Mockup

**Project:** JudicialSync
**Generated:** 2026-10-06
**Last Updated:** 2026-10-09 (Phase 7.1 INSERTED: exhibit classification at intake, custodian required at MARKED, two-phase custody propose/confirm, server-side role enforcement surfaced as absent-not-disabled controls system-wide, judge-only Pending-Ruling Queue [new 6th screen], header case selector, jury-package versioning + real PDF export — US-16.1–US-16.2, US-18.1–US-18.2, US-19.1–US-19.4, US-20.1–US-20.6, US-21.1–US-21.2, US-22.1–US-22.3, US-23.1–US-23.3. Prior note retained: Phase 7 admission-rejection error, sealed/ex-parte jury package blocker, discrepancy-acknowledgment role/audit visibility, Case Workspace row clickability, assistant example labels, header indicator, activity-feed date+label fixes — US-12.1–US-12.2, US-13.1–US-13.3, US-14.1–US-14.3, US-15.1–US-15.5)
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

All six screens live inside one persistent shell:

```
┌──────────────────────────────────────────────────────────────────┐
│ JudicialSync  [Case: 2026-CR-0142 ▾] [⚠ 1] [Role: Judge ▾] [Ask ✦]│ ← global header
├───────────────┬──────────────────────────────────────────────────┤
│ ▸ Command Ctr │                                                  │
│   Case        │              [ Active Screen Content ]          │
│   Jury Pkg    │                                                  │
│   Pending Rul.│ ← JUDGE role only; absent from the sidebar       │
│   Assistant   │    entirely for every other role (F20/F21)       │
│               │                                                  │
└───────────────┴──────────────────────────────────────────────────┘
```

- **Sidebar** (persistent, 4 items for most roles; 5 for `JUDGE`): Command Center, Case Workspace, Jury Package, Pivota Assistant, plus **Pending Rulings** (judge-only, see below). This is the entire navigable surface — intentionally small, reinforcing low adoption burden (JTBD-04.4).
- **"Ask ✦" header button**: opens the Pivota Assistant as a slide-over panel from *any* screen without navigating away — the single most important affordance in the product, since F7 is the universal touchpoint across every journey (JOURNEYS §Convergence Points).
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
| Pivota Assistant | `/assistant` (full-page view) + global slide-over panel on every screen | App shell (persistent) | Sidebar: "Assistant" (full page) · Header: "Ask ✦" button (slide-over, available everywhere) |

**Invariant check — no orphan screens:** Command Center, Case Workspace, Jury Package, and Assistant all have direct sidebar entries from the app shell, visible to every role. The Pending-Ruling Queue (added Phase 7.1) also has a direct sidebar entry, but — unlike the other four — that entry is conditionally rendered: present only when the active role is `JUDGE`, absent for every other role (not merely disabled). This is a deliberate exception to "every screen reachable from the shell for every user," matching F21's explicit judge-only navigation requirement; the underlying read endpoint remains accessible to any role with case visibility (defense-in-depth is enforced server-side, not relied upon from the UI), but no non-judge role is ever given a path to the screen. Exhibit Detail View has no sidebar entry by design, but is reachable from three parent screens (Case Workspace, Command Center, Jury Package) plus the Assistant's citation links — all of which themselves trace to the shell. No screen requires typing a URL.

---

## Scope Note on This Document

This mockup covers the 6 screens now in scope: the 5 demo screens originally named in PROJECT.md — **Trial Command Center (F8), Case Workspace (F9), Exhibit Detail View (F10), Jury Package Workspace (F11), and Pivota Assistant (F7)** — plus the **Pending-Ruling Queue (F21)**, added in Phase 7.1 as a judge-only 6th screen (see `Screen-05-pending-ruling-queue.md` and the Decision Note below). Discrepancy acknowledgment (F6) and status/objection/custody recording (F1–F3) continue to be presented as *in-context actions within* screens rather than as separate screens, consistent with the FRD's screen inventory. Phase 7.1's remaining features are cross-cutting amendments to these six screens rather than new screens of their own: exhibit classification (F16) and the custodian-at-intake requirement (F18) extend Case Workspace's exhibit-creation flow; custody handoff confirmation (F19) extends Exhibit Detail View's custody section; server-side role enforcement (F20) is a system-wide UI-visibility pattern applied across all six screens (`Y0-patterns.md` §Pattern: Role-Gated Control Visibility); multi-case support (F22) is a header-level control (the Case Selector) rather than a screen; and jury-package versioning/PDF export (F23) extends the Jury Package Workspace.

**Decision note — F21 (new screen vs. extended Command Center panel):** The Pending-Ruling Queue is specified as a **dedicated 6th screen**, not an extension of the Command Center's existing "Unresolved Objections" panel. Three reasons, all from the FRD/user-story source of truth rather than a UX preference: (1) F21 explicitly requires "a `JUDGE`-role navigation entry point; other roles do not get a navigation entry point to this screen" — the Command Center itself is visible to every role (it is the universal ambient-awareness screen per US-8.1), so the judge-only gating this feature requires cannot be satisfied by extending a panel every role already sees; (2) the journey source (`JOURNEYS-JudicialSync.md` JRN-01.2) lists "Check the Pending-Ruling Queue" as its own distinct stage — "Opens the judge-only Pending-Ruling Queue" — separate from and following the ambient "Glance During Recess"/"Spot a Flag" stages that the Command Center panel already serves, indicating a deliberate destination, not a glance; (3) the Command Center's Unresolved Objections panel is intentionally minimal (exhibit + grounds + timestamp, link-through only, per US-8.1's "no data-entry controls" constraint) while F21 additionally requires inline ruling-recording actions and live-recomputed elapsed-wait sorting as the screen's primary (not secondary) purpose — functionality a read-only ambient panel is explicitly scoped not to carry.
