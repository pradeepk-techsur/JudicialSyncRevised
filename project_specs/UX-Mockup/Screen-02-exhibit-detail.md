### Screen: Exhibit Detail View

**Purpose:** The complete, single-screen chronological story of one exhibit — answers "what happened to this exhibit" without assembling fragments.
**User Stories:** US-10.1, US-10.2, US-3.3, US-2.2, US-6.3
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
| Discrepancy acknowledged | Banner changes from amber "OPEN" to a muted but still-visible "Acknowledged by C. Chen: [justification text]" badge | Never disappears — remains a permanent, visible risk-acceptance record (US-6.3) |
| Loading | Header + timeline skeletons | Brief, since this is a single-exhibit query |
| Sealed, unauthorized role | Entire route renders the same "Exhibit not found" page as a nonexistent ID — no distinguishing copy, icon, or status code visible to the user | Confirms US-10.2: existence of sealed material is never revealed |
| Live update arrives (e.g., custody transfer logged elsewhere) | New timeline entry fades in at the appropriate chronological position; header updates in place | No manual refresh required |
| Citation deep-link arrival (from Assistant) | Page loads with the specific cited timeline entry highlighted and auto-scrolled into view | Closes the loop promised in Flow 1 ("one-tap view supporting record") |
| Load failure | Inline error: "Unable to load exhibit history — please retry" | Retry button, no partial/broken render |

#### Interactive Elements

| Element | Type | Behavior |
|---------|------|----------|
| "Resolve →" link (on a discrepancy banner) | Contextual link | Scrolls to / opens the relevant inline action (e.g., "Transfer Custody") directly on this screen |
| "Acknowledge" button | Action, opens inline justification field | Requires non-empty justification (≤500 chars) before submit; idempotent if already acknowledged (US-6.3) |
| Timeline entry | Static, citable | Each entry carries a stable anchor so Assistant citations and direct links can scroll to it precisely |
| "← Back to Case Workspace" | Navigation | Returns to the referring list screen (preserves prior scroll/filter state where feasible) |
| Ruling action (judge role, on an open objection) | Inline action, 1 of 3 options | Sustained / Overruled / Reserved — role-gated (US-2.2) |

**Plain-language translation rule:** every timeline entry is composed as a complete sentence ("Status changed from Offered to Admitted," "Custody transferred from D. Reyes to C. Chen — reason: jury package prep") — raw `eventType`/`payload` values are never exposed to the user (US-10.1).
