### Screen: Exhibit Detail View

**Purpose:** The complete, single-screen chronological story of one exhibit — answers "what happened to this exhibit" without assembling fragments.
**User Stories:** US-10.1, US-10.2, US-3.3, US-2.2, US-6.3, US-12.1, US-12.2, US-16.1, US-18.1, US-19.1, US-19.2, US-19.3, US-19.4, US-20.2, US-20.4, US-20.5
**Journey:** JRN-02.2 (full journey), JRN-01.2 (Request History), JRN-03.1 (Challenge a Custody Gap), JRN-02.1 (Confirm Custody Receipt)
**Route:** `/exhibit/:id` · **Nav:** Row click from Case Workspace, Command Center, Jury Package Workspace, or Pending-Ruling Queue; citation link from Assistant. No sidebar entry (drill-in only).

#### Layout — Settled Custody

```
┌──────────────────────────────────────────────────────────────────┐
│ JudicialSync  [Case: 2026-CR-0142 ▾] [⚠ 1] [Role: Judge ▾] [Ask ✦]│
├───────────────┬──────────────────────────────────────────────────┤
│ Command Ctr   │  ← Back to Case Workspace                        │
│ Case          │  Exhibit 14 — "Blood sample, lab-sealed"         │
│ Jury Pkg      │  ┌────────────────────────────────────────────┐  │
│ Assistant     │  │ Status: ●ADMITTED   Custodian: ⚠ None on   │  │
│               │  │ Party: PROSECUTION   Witness: Dr. Smith     │  │
│               │  │ Classification: TRIAL (set at intake,       │  │
│               │  │   immutable)                                │  │
│               │  │ ⚠ DISCREPANCY: Admitted, no custodian of    │  │
│               │  │   record   [Resolve →] [Acknowledge]        │  │
│               │  └────────────────────────────────────────────┘  │
│               │  History                                         │
│               │  ┌────────────────────────────────────────────┐  │
│               │  │ ● Marked (custodian established: D. Reyes)  │  │
│               │  │   Oct 5, 9:02 AM · by D. Reyes (Deputy)      │  │
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
| Primary | Discrepancy action (Resolve / Acknowledge) | Directly beneath the flag it belongs to — never a separate screen |
| Primary | Pending custody transfer banner + Confirm/Cancel actions (F19) | Directly beneath the custodian line, replacing it while a transfer is pending |
| Secondary | Chronological timeline (complete, oldest-first) | Main scrollable body |
| Tertiary | Exhibit identity metadata (description, party, witness, source, classification) | Compact header row, de-emphasized once status/custodian are visible |

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
| Custody transfer pending (F19) | Custodian line replaced by the "⏳ Pending transfer to {receiver} — awaiting their confirmation" banner, per §Custody Section above | Never silently indistinguishable from "no activity" or from a completed transfer (US-19.1) |
| Custody transfer confirmed | Banner disappears; custodian line updates to the new custodian; a `CUSTODY_TRANSFER_CONFIRMED` entry appears in the timeline | Confirms the handoff is now official — "who has it" reflects only the confirmed transfer, never the proposal (US-19.2) |
| Custody confirm attempted by the wrong user (`CUSTODY_CONFIRM_WRONG_USER`) | Inline error on the "Confirm Receipt" action: "Only the named receiving custodian may confirm this transfer" | Control itself is only ever shown to the actual named receiver (per Role-Gated Control Visibility + identity check), so this error path is a defense-in-depth backstop, not the primary guard (US-19.2, US-20.5) |
| Custody transfer cancelled | Banner disappears; custodian line reverts to the pre-proposal custodian (unchanged, since a pending transfer never altered it); a `CUSTODY_TRANSFER_CANCELLED` entry appears in the timeline, never erased | Confirms cancellation is a recorded event, not a silent reset (US-19.3) |
| Action unavailable for current role (F20) | "Record Status," "Propose Custody Transfer," "Confirm Receipt," and "Cancel Transfer" are each independently absent per F20's matrix (and, for Confirm, the additional identity check) | Absent, not disabled — see `Y0-patterns.md` §Pattern: Role-Gated Control Visibility (US-20.2, US-20.4, US-20.5) |
| Load failure | Inline error: "Unable to load exhibit history — please retry" | Retry button, no partial/broken render |

#### Interactive Elements

| Element | Type | Behavior |
|---------|------|----------|
| "Resolve →" link (on a discrepancy banner) | Contextual link | Scrolls to / opens the relevant inline action (e.g., "Propose Custody Transfer") directly on this screen |
| Inline "Record Status" action (header) | Compact action, not a modal form | Offers only valid next-transition options (US-1.1); an attempted `ADMITTED` transition is rejected pre-write with every blocking reason named if an unresolved objection or missing custodian applies — status remains unchanged on rejection (US-12.1, US-12.2); the exhibit's first-ever transition (`MARKED`) additionally requires a custodian in the same step (US-18.1, US-18.2); rendered only for `DEPUTY`/`CLERK`/`ADMIN` (F20 row 2/3) — absent otherwise (US-20.2) |
| "Propose Custody Transfer" action (header, settled state only) | Compact action | Current custodian auto-filled as "from"; requires selecting an active user as the intended receiver; does not change `currentCustodianUserId` (US-19.1); rendered only for `DEPUTY`/`CLERK`/`ADMIN` (F20 row 6) — absent otherwise (US-20.4); unavailable while a transfer is already pending |
| "Cancel Transfer" action (pending state only) | Action | Clears the pending transfer with no change to current custodian; available to the original proposer or any `DEPUTY`/`CLERK`/`ADMIN` role (US-19.3) |
| "Confirm Receipt" action (pending state only) | Action | Completes the transfer, setting the named receiver as current custodian; visible **only** to the exact named receiver — identity-gated, not merely role-gated (US-19.2, US-20.5) — see `Y0-patterns.md` §Pattern: Two-Phase Custody Handoff |
| "Acknowledge" button | Action, opens inline justification field | Requires non-empty justification (≤500 chars) before submit; idempotent if already acknowledged (US-6.3); only rendered for `DEPUTY`/`CLERK`/`JUDGE`/`ADMIN` roles — absent, not disabled, otherwise; accompanied by always-visible copy disclosing the action is permanently recorded under the acting user's name and role before it is confirmed (US-14.1, US-14.2) |
| Timeline entry | Static, citable | Each entry carries a stable anchor so Assistant citations and direct links can scroll to it precisely; now includes `CUSTODY_TRANSFER_PROPOSED`/`CONFIRMED`/`CANCELLED` entries (F19) in addition to the original event types |
| "← Back to Case Workspace" | Navigation | Returns to the referring list screen (preserves prior scroll/filter state where feasible) |
| Ruling action (judge role, on an open objection) | Inline action, 1 of 3 options | Sustained / Overruled / Reserved — role-gated, unchanged by F20 (US-2.2) |

**Plain-language translation rule:** every timeline entry is composed as a complete sentence ("Status changed from Offered to Admitted," "Custody transfer proposed to C. Chen," "C. Chen confirmed receipt of custody," "Custody transfer to C. Chen cancelled — reason: wrong recipient named") — raw `eventType`/`payload` values are never exposed to the user (US-10.1).
