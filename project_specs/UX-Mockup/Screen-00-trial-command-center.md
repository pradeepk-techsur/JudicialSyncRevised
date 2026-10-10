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
