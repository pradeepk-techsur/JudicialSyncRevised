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

#### Layout — Phase 8 (Full Screen)

The complete current screen, stacking the four new widgets above the retained baseline panels. Sidebar is dark-navy per `00-overview.md` §Visual Foundation; panels render as rounded-corner dark-dashboard cards.

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

#### Stat Card Row (added Phase 8, US-8.4 / F08 §Process step 2)

Four small cards, left-to-right, each a single bold number plus a short label — no drill-in interaction of its own (the whole screen remains read-only at this point):

| Card | Value shown | Source |
|---|---|---|
| "Open objections" | count of all `ObjectionCurrentState` rows with `status = 'UNRESOLVED'`, case-wide | `getUnresolvedObjections(caseId)` (F2), unchanged query |
| "Custody gaps" | count of `OPEN` `DiscrepancyFlag` rows with `ruleCode = 'ADMITTED_NO_CUSTODIAN'` | `getDiscrepancies(caseId)` (F6), unchanged query |
| "Jury package blockers" | count of current `JuryPackageExhibit` rows with `discrepancyStatus = 'FLAGGED'` (plus any CRITICAL sealed/ex-parte row) | current `JuryPackage` (F5), unchanged query |
| "Admitted X of Y" | `statusCounts.ADMITTED` over the case's total visible exhibit count | new additive `statusCounts` field on `GET /api/cases/:id/activity` (F08 §Process step 2) |

This row is purely informational — no card is clickable in this version; a future phase could link each card to the Case Workspace pre-filtered to the matching condition, but that is explicitly not in this phase's scope.

#### Status-Distribution Bar (added Phase 8, F08 §Process step 2)

A single horizontal segmented bar beneath the stat row, titled "Where the N exhibits stand," visualizing the same `statusCounts` breakdown proportionally (segment width ∝ count), with a color-keyed legend beneath matching the Status Badge Visual Convention pattern's existing per-status colors (`Y0-patterns.md` §Pattern: Status Badge Visual Convention) — no new color mapping is introduced for this bar, it reuses the status badge colors exactly. Hovering (or, on touch, tapping) a segment shows the exact count and status name as a tooltip; the bar itself does not navigate anywhere on click, consistent with the stat row above.

#### "Needs Your Attention" Feed (added Phase 8, US-8.4, F08 §Process steps 4–5)

Ranked list, `CRITICAL` → `HIGH` → `PENDING` → `MEDIUM`, never interleaved; within a tier, newest-first. Each entry shows the severity badge, exhibit label, a one-line plain-language summary, the elapsed/detected time, and — for every tier except `CRITICAL` — an inline action button:

| Tier | Badge color | Example entry | Inline action |
|---|---|---|---|
| `CRITICAL` | Dark red | "S-2 — ex parte material improperly included in jury package" | **"Review and remove →"** — link-through to the Jury Package Workspace's existing "Remove from Package" remediation (F13); not a new control, this tier never gets an inline write action of its own per F08 §Process step 4 |
| `HIGH` | Amber | "Ex. 9 — admitted with an open, unresolved objection" | **"Record ruling"** — opens the inline ruling form for that specific `objectionId` (F24) |
| `PENDING` | Amber-light | "Ex. 12 — objection unresolved, not yet admitted" | **"Record ruling"** — identical form/endpoint as `HIGH`, same F24 action, different triggering condition |
| `MEDIUM` | Yellow | "Ex. 14 — admitted, no custodian of record" | **"Assign custodian"** — opens the inline custody-assignment form (first-time assignment path, F24 §Process — Transfer/Assign Custody step 3) |

Every inline action button renders only for an F20-authorized role for that specific action (`JUDGE` for "Record ruling"; `DEPUTY`/`CLERK`/`ADMIN` for "Assign custodian") — absent, not disabled, for any other role, per `Y0-patterns.md` §Pattern: Role-Gated Control Visibility. Clicking an action button expands an inline confirm form directly within the feed entry (not a modal, not a navigation) — see `Y0-patterns.md` §Pattern: Attention Feed Inline Action for the full interaction contract, including the mandatory explicit-confirm step.

**⚠ New `data-testid`/`aria-label` contract needed (flagged for UX-researcher/planner, US-24.3):**
- Feed container: `data-testid="attention-feed"`
- Each entry: `data-testid="attention-feed-entry"` with `aria-label` stating tier + exhibit + condition, e.g. `aria-label="High priority: Exhibit 9, admitted with unresolved objection"`
- Each inline action button: `data-testid="attention-feed-action-record-ruling"` / `data-testid="attention-feed-action-assign-custodian"` / `data-testid="attention-feed-action-review-remove"` (scoped per entry, e.g. via a `data-exhibit-id` attribute, since multiple entries can carry the same action type)
- Severity badge: `data-testid="severity-badge"` with `aria-label="Severity: Critical"` (etc. per tier) — see `Y0-patterns.md` §Pattern: Severity Tier Badge

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

#### Recent Activity — Filter Pills + Date Grouping (amended Phase 8, F08 §Process step 1 unchanged query, presentation only)

The Recent Activity panel is retained from Phase 5/7 (same `getRecentActivity` query, same full timestamp + exhibit-label rule per `Y0-patterns.md` §Pattern: Activity Feed Row Format) with two additive presentation changes:
- **Filter pills** — `All` / `Status` / `Custody` / `Objections` / `Rulings` — a one-click row above the feed narrowing the rendered event types client-side (no new query parameter; the full day's events are already in the loaded response). `All` is selected by default. This is a client-side display filter only — it does not change what `getRecentActivity` returns, and does not count as a "configuration control" in the sense Design Principle 4 guards against, since it only narrows what's already loaded, the same way a quick-filter chip does on Case Workspace.
- **Date-grouped headers** — rows are grouped under a bold date header ("TODAY · OCT 8, 2026", "YESTERDAY · OCT 7, 2026") whenever the activity window spans more than one day, making a day-boundary crossing visually unambiguous in addition to the existing full-timestamp-per-row rule (US-15.4, US-15.5 — unchanged, just reinforced by the grouping).

**⚠ New `data-testid` needed:** filter pill row `data-testid="activity-filter-pills"`, each pill `data-testid="activity-filter-pill-{type}"` (e.g. `activity-filter-pill-status`); date group header `data-testid="activity-date-group-header"`.

#### Information Hierarchy

| Priority | Content | Placement |
|----------|---------|-----------|
| Primary | "Needs your attention" feed, severity-ranked, with inline actions (added Phase 8) | Below the status-distribution bar, above the two-column Jury Package/Custody row |
| Primary | Discrepancies panel (count + list) — the highest-risk signal (retained) | Right column of the baseline two-column row, visually distinct (warning color), never below the fold |
| Primary | Stat card row (Open objections / Custody gaps / Jury package blockers / Admitted X of Y) (added Phase 8) | Top of screen, directly beneath the screen title — first thing seen |
| Primary | Recent Activity feed — the ambient pulse of the trial | Lower panel, newest-first, now filter-pilled and date-grouped |
| Primary | Exhibit label + full date-and-time on every Recent Activity row (incl. raw status-transition rows) | Same row, never summarized away (US-15.4, US-15.5) |
| Secondary | Status-distribution bar (added Phase 8) | Directly beneath the stat card row |
| Secondary | Jury Package summary widget + Custody-at-a-Glance panel (added Phase 8) | Two-column row beneath the attention feed |
| Secondary | Unresolved Objections panel (retained) | Left of the baseline two-column lower row |
| Tertiary | "Updated Xs ago" freshness indicator | Top-right corner, small type |

#### States

| State | Appearance | User Feedback |
|-------|------------|----------------|
| Default (activity exists) | All seven panels/widgets populated as above | None needed — ambient |
| Loading (initial load) | Skeleton rows/cards in every panel, including the new stat row, attention feed, jury package widget, and custody panel | Subtle shimmer, no spinner text |
| Empty — no activity yet | Recent Activity panel shows "No activity recorded yet today" | Calm, non-alarming copy |
| Empty — no unresolved objections | "No unresolved objections — all clear" with a quiet checkmark | Reinforces confidence, not silence-as-ambiguity |
| Empty — attention feed has zero entries | "Nothing needs your attention right now" with a quiet checkmark, same calm-empty-state treatment as the Unresolved Objections panel | Confirms "feed is empty" is a positive, not an error/loading state (parallels US-8.1's "no unresolved objections" precedent) |
| Discrepancy present | Discrepancies panel header turns warning-amber, count badge visible from across the room | Visually "impossible to scroll past unnoticed" per US-8.1 |
| Attention feed entry present (any tier) | Severity badge renders in its fixed tier color (`CRITICAL` dark red / `HIGH` amber / `PENDING` amber-light / `MEDIUM` yellow) per `Y0-patterns.md` §Pattern: Severity Tier Badge | Tier is never conveyed by color alone — the tier word renders as visible text alongside the badge |
| Attention feed inline action — form open, awaiting confirm | Inline form expands within the entry (disposition selector or custodian picker); entry's other content remains visible above the form | Explicit "Submit"/"Confirm" control distinct from the button that opened the form — no auto-submit (US-24.1, US-24.2) |
| Attention feed inline action — in flight | Submit control shows a brief inline spinner; form remains open, non-interactive | Prevents double-submit |
| Attention feed inline action — success | Entry fades out (ruling resolved) or re-ranks (reserved ruling; custody re-evaluated) on the next poll tick | No screen-local optimistic removal — the entry only changes once the poll confirms the new ledger state (F24 §Process step 5/6) |
| Attention feed inline action — rejected (e.g., `403 ROLE_NOT_PERMITTED`, `409 OBJECTION_ALREADY_RESOLVED`, `409 CUSTODY_CHAIN_BROKEN`) | Inline error message within the still-open form, naming the specific rejection reason; entry remains in the feed unchanged | Never a silent failure or generic toast — matches the reject-with-reason pattern (US-24.1, US-24.2) |
| Attention feed action unavailable for current role (F20) | Entry renders with its context (exhibit, condition, tier) but no action button at all | Absent, not disabled — `Y0-patterns.md` §Pattern: Role-Gated Control Visibility |
| Custody-at-a-glance — exhibit with no custodian | Rendered in the distinct "No custodian" callout row, never silently grouped under a blank/empty custodian heading | Confirms a custody gap is visible at the panel level, not only via the discrepancy count (US-8.3) |
| Custody-at-a-glance — pending transfer | Exhibit appears under a "Pending transfer to {name}" grouping, not the sending or receiving custodian's regular bucket | Never silently implies the transfer has already completed (US-8.3, consistent with F19's pending-state treatment on Exhibit Detail) |
| Jury package widget — no package computed yet | "No jury package started yet" in place of the progress bar, with the same "Open jury package →" link-through | Matches the Jury Package Workspace's own "no package started yet" empty state (F11) rather than showing a misleading 0-of-0 bar |
| Live update arrives | New row fades in at top of Recent Activity (no jarring re-sort/flash); stat counts and the distribution bar update in place with the same ~400ms highlight fade used elsewhere | No toast needed — ambient by design |
| Recent Activity row rendering (any event type) | Every row shows both date and time of `recordedAt` ("Oct 8, 2026, 2:41 PM," never time-only) and the exhibit's label, including rows describing a raw `STATUS_CHANGE` transition ("Exhibit 3 — MARKED → OFFERED") | Two events on different days are never visually indistinguishable; no row is ever unattributed to an exhibit (US-15.4, US-15.5) — see `Y0-patterns.md` §Pattern: Activity Feed Row Format |
| Recent Activity filter pill selected (Phase 8) | Selected pill shows an active/pressed visual state; list narrows to matching event types only, date-group headers retained | Client-side only — no reload, no change to the underlying `getRecentActivity` response |
| Load failure (any panel) | Full-panel inline error: "Unable to load trial activity — please retry" (baseline panels) or "Unable to load the attention feed — please retry" (`ATTENTION_FEED_LOAD_FAILED`, attention feed specifically) with a retry button | Non-blocking — every panel attempts to load independently; one panel's failure never blocks another's render |

#### Interactive Elements

| Element | Type | Behavior |
|---------|------|----------|
| Recent Activity row | Link-through | Navigates to that exhibit's Exhibit Detail View (US-8.2), landing scrolled to the relevant event |
| Unresolved Objection row | Link-through | Navigates to Exhibit Detail View, objection section highlighted |
| Discrepancy row | Link-through | Navigates to Exhibit Detail View (or directly to the flagged row in Jury Package Workspace if already drafted) |
| "Ask Pivota" header button | Global | Opens Pivota Assistant slide-over without leaving this screen |
| Attention feed "Record ruling" button (added Phase 8) | Inline write action | Expands the disposition selector (Sustained/Overruled/Reserved) within the entry; explicit confirm required; rendered only for `JUDGE` role (F24, US-24.1); `data-testid="attention-feed-action-record-ruling"` |
| Attention feed "Assign custodian" button (added Phase 8) | Inline write action | Expands a custodian picker (first-time assignment path) within the entry; explicit confirm required; rendered only for `DEPUTY`/`CLERK`/`ADMIN` (F24, US-24.2); `data-testid="attention-feed-action-assign-custodian"` |
| Attention feed "Review and remove →" link (`CRITICAL` tier, added Phase 8) | Link-through | Navigates to the Jury Package Workspace's existing "Remove from Package" remediation (F13) — not a new write action; `data-testid="attention-feed-action-review-remove"` |
| Jury package widget "Open jury package →" button (added Phase 8) | Link-through | Navigates to `/jury-package`; `data-testid="open-jury-package-button"` |
| Custody-at-a-glance "Transfer custody" entry point (added Phase 8) | Link-through / inline write action | Opens the same custody assignment/propose form as the Exhibit Detail header (F24); rendered only for `DEPUTY`/`CLERK`/`ADMIN`; `data-testid="custody-glance-transfer-action"` |
| Recent Activity filter pills (added Phase 8) | Toggle group | Client-side narrowing of the already-loaded activity list by event-type category; `data-testid="activity-filter-pill-{type}"` |

**Explicitly absent by design (US-8.1), amended Phase 8:** no filters, no date pickers, no "configure this view" settings on any panel **except** the two F24 write actions on the "Needs your attention" feed ("Record ruling," "Transfer custody"/"Assign custodian") and the purely-client-side Recent Activity filter pills (which narrow already-loaded data, writing nothing). Every other element on this screen — stat cards, status-distribution bar, Jury Package widget, Custody-at-a-Glance exhibit listings, Recent Activity, Unresolved Objections, Discrepancies — remains link-through-only; it never writes to the ledger.

**Full timestamp + label rule (F15):** every Recent Activity row renders both the date and the time of `recordedAt` — never time-only — and always includes the event's exhibit label as part of the rendered summary, with no exception for raw `STATUS_CHANGE` rows (US-15.4, US-15.5). This uses the `exhibitLabel` field already present in the activity API response — a rendering fix, not a data-contract change.
