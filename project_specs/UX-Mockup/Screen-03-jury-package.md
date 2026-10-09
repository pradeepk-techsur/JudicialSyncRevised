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
