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
