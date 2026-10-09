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
