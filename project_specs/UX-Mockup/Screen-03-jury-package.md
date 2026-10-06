### Screen: Jury Package Workspace

**Purpose:** The authoritative, discrepancy-gated handoff view for the jury-eligible exhibit list — the screen where "build a jury package" plays out end-to-end.
**User Stories:** US-5.1, US-5.2, US-6.1, US-6.2, US-6.3, US-11.1, US-11.2
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
│               │  └────────────────────────────────────────────┘  │
│               │  2 of 4 exhibits have open discrepancies.        │
│               │  [ Finalize Jury Package ]  ← disabled, greyed   │
└───────────────┴──────────────────────────────────────────────────┘
```

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
| Primary | Finalize/Export action and its enabled/disabled state with reason | Persistent, bottom or top of exhibit list — never scrolled out of view |
| Secondary | Per-row discrepancy flag and resolution actions | Inline within each flagged row |
| Tertiary | Exhibit status badges (all rows are `ADMITTED` by construction, so this is confirmatory, not discriminating) | Row-level, de-emphasized relative to the discrepancy column |

#### States

| State | Appearance | User Feedback |
|-------|------------|----------------|
| Draft, zero discrepancies | All rows "✓ Clean"; Finalize button enabled (solid, primary color) | "All exhibits clean — ready to finalize" caption |
| Draft, open discrepancies | Flagged rows amber with rule explanation + actions; Finalize button visibly disabled (greyed, non-clickable) with caption "{n} exhibit(s) have unresolved discrepancies" | Disabled state is a true HTML-disabled control, not a styled-but-clickable button that errors on click (US-11.2) |
| Draft, discrepancy acknowledged | Row badge changes to a muted "Acknowledged" state (still visible, not cleared); counts toward "clean enough to finalize" per the gate's ACK/RESOLVED rule | Finalize button re-enables once all flags are ACK'd or RESOLVED |
| Finalizing (in-flight) | Finalize button shows a brief inline spinner/"Finalizing..." label | Prevents double-submit |
| Finalize rejected (stale client state) | Inline error banner lists the specific blocking exhibits; button re-disables; affected rows re-flag | Never a generic "error occurred" — always names the blocking exhibit(s) (US-5.2) |
| Finalized | Status badge turns to a calm green "FINALIZED ✓ Zero discrepancies" banner; all action controls disappear; export/print button appears | This is the explicit "zero discrepancies" confirmation stamped for the record, satisfying JRN-01.2's acceptance moment |
| No admitted exhibits yet | "No admitted exhibits are available to form a jury package yet" | Non-error, informative empty state |
| Load failure | Inline error with retry | — |
| Viewed by non-finalizing role (Judge/Attorney/Chambers Staff) | Identical layout, but Finalize/Acknowledge controls render as view-only (absent or disabled with role explanation) | Supports JRN-01.2 (judge review) and JRN-03.1 (attorney verification) from the same screen, no separate "audit view" needed |

#### Interactive Elements

| Element | Type | Behavior |
|---------|------|----------|
| "Finalize Jury Package" | Primary action button | Disabled whenever any row is `FLAGGED` + `OPEN`; on click, triggers fresh server-side re-validation before committing (US-5.2, US-11.2) |
| "Fix →" link on a flagged row | Contextual link | Navigates to that exhibit's Exhibit Detail View to resolve the underlying condition |
| "Acknowledge" button on a flagged row | Action, opens inline justification field | Same acknowledgment flow as Exhibit Detail View (US-6.3); role-gated to Deputy/Clerk/Judge/Admin |
| "Export / Print" (finalized state only) | Action | Produces a print-friendly/exportable static view; no further edits possible |
| Exhibit row (any state) | Click target | Navigates to Exhibit Detail View for full context |

**Design intent note:** This screen is a pure presentation + action-trigger layer per FRD F11 — it never computes eligibility or discrepancy status client-side, eliminating any possibility of showing a "clean" state the server wouldn't also enforce.
