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
