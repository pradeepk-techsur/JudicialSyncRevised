### Screen: Case Workspace

**Purpose:** The primary browsing and searching surface for the full exhibit set — one trustworthy list instead of a spreadsheet — now also the primary one-click triage surface for attention/custody/ruling status and jury-package readiness.
**User Stories:** US-9.1, US-9.2, US-9.3, US-4.1, US-1.1, US-1.2, US-3.1, US-3.2, US-2.1, US-15.1, US-12.1, US-12.2, US-16.1, US-18.1, US-18.2, US-19.1, US-20.1, US-20.2, US-20.3, US-20.4
**Journey:** JRN-02.1 (Log Exhibit Activity, Answer a Custody Question, Search Mid-Testimony)
**Route:** `/case` · **Nav:** Sidebar "Case Workspace"

#### Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ JudicialSync  [Case: 2026-CR-0142 ▾] [⚠ 1] [Role: Deputy ▾][Ask Pivota]│
├───────────────┬──────────────────────────────────────────────────┤
│ Command Ctr   │  Case Workspace                  [+ New Exhibit] │
│ ▸ Case        │  [All 10] [Needs attention 3] [In my custody 2]  │
│ Jury Pkg      │  [Awaiting ruling 2]                              │
│ Assistant     │  ┌────────────────────────────────────────────┐  │
│               │  │ 🔍 Search exhibits...   [Status ▾][Witness ▾]│  │
│               │  │     Active filters: witness=Smith  [× clear]│  │
│               │  └────────────────────────────────────────────┘  │
│               │  ┌────────────────────────────────────────────────────────────┐│
│               │  │ Label  Desc   Party Witness Status  Custodian  Flags  Jury Pkg││
│               │  │ Ex. 14 Blood  PROS  Smith  ●ADMITTED –        No      Blocked ││
│               │  │                                               custodian       ││
│               │  │ Ex. 7  Phone  DEF   —      ●OFFERED  D.Reyes  —       Not     ││
│               │  │                                                       eligible││
│               │  │ Ex. 9  Email  PROS  Lee    ●OBJECTED C.Chen   Open    Not     ││
│               │  │                                       objection      eligible││
│               │  │ Ex. 3  Contr. PLAIN —      ●MARKED   D.Reyes  Ruling  Not     ││
│               │  │                                → pending:    pending eligible││
│               │  │                                   C.Chen                      ││
│               │  │ Ex. 5  Report PROS  Lee    ●ADMITTED D.Reyes  —       Included││
│               │  │ ... (polling live, 3–5s)                                      ││
│               │  └────────────────────────────────────────────────────────────┘│
└───────────────┴──────────────────────────────────────────────────┘
   entire row (hover: highlight + cursor:pointer) ──▶ Exhibit Detail View (/exhibit/:id)
   "+ New Exhibit" is absent entirely for JUDGE/CHAMBERS_STAFF/ATTORNEY roles (F20) — see Pattern: Role-Gated Control Visibility
```

**Quick-filter chips (added Phase 8, US-9.3):** a row of one-click chips — **All N / Needs attention N / In my custody N / Awaiting ruling N** — directly above the search bar, each with a live count badge. Selecting a chip narrows the visible row set immediately, without requiring the search bar or any dropdown — "All" is selected by default and shows the full visible (role-filtered) exhibit count. Matching rules: "Needs attention" matches at least one `OPEN` discrepancy flag OR at least one `UNRESOLVED` objection thread; "In my custody" matches `CustodyCurrentState.currentCustodianUserId` equal to the signed-in user; "Awaiting ruling" matches at least one `UNRESOLVED` objection thread (a narrower, ruling-specific lens on the same underlying condition "Needs attention" also surfaces more broadly). Chips are mutually exclusive (single-select, like a tab strip, not independently combinable toggles) and compose with an active search/filter query exactly as a dropdown filter would — selecting a chip while a search is active narrows the *search results* by the chip's condition, not a separate, parallel list. Chips re-evaluate on every live-sync poll tick so counts and membership stay current without a manual refresh.

**⚠ New `data-testid` needed:** chip row `data-testid="quick-filter-chips"`; each chip `data-testid="quick-filter-chip-{key}"` (`all` / `needs-attention` / `in-my-custody` / `awaiting-ruling`), each carrying `aria-pressed` to reflect single-select state for assistive technology.

**Jury Package column (added Phase 8, US-9.3):** a new rightmost table column rendering one of three color-coded values per row — **Included** (green), **Not eligible** (neutral/grey), **Blocked** (amber) — computed identically to, and never diverging from, the Jury Package Workspace's own per-exhibit discrepancy status (F9 §Process step 3 = F11's row-level grouping). If no `JuryPackage` has ever been computed for the case, every row reads `Not eligible` rather than erroring or omitting the column. `data-testid="exhibit-row-jury-package-badge"` with `aria-label="Jury package status: Blocked"` (etc. per value) — new as of Phase 8.

**Flags column — readable text pills, not icon-only (amended Phase 8, Design Principle 7):** the existing discrepancy/objection/custody indicator column is relabeled "Flags" and now renders a short readable text pill per condition rather than a bare icon requiring a hover to understand — "Ruling pending" (unresolved objection), "No custodian" (`ADMITTED_NO_CUSTODIAN` discrepancy), "Open objection" (unresolved thread on a not-yet-admitted exhibit), "Ex parte · restricted" (chambers-ex-parte/sealed classification visible to an authorized role). A row with zero applicable flags shows an em-dash ("—"), not a blank cell. Multiple simultaneous flags stack as multiple pills in the same cell, never collapsed into a single generic "⚠" glyph. This does not change the underlying discrepancy/objection data — it is a presentation-only amendment to the same column Phase 7 already shipped (`Y0-patterns.md` §Pattern: Discrepancy Flag Treatment, unchanged in substance). `data-testid="exhibit-row-flag-pill"` per pill (new as of Phase 8) — the pre-existing `data-testid="exhibit-row"` and the row's discrepancy-icon hover/click behavior are otherwise unchanged (US-24.3).

**"+ New Exhibit" intake flow (US-16.1, US-18.1, US-18.2, F16, F18):** opens a compact inline panel at the top of the table — not a full-screen modal, consistent with this screen's existing "assistant, not data-entry system" positioning, just a larger instance of the same Inline Row Actions pattern. The panel asks for identity fields (label, description, source, offering party, witness) plus two fields new as of Phase 7.1:
- **Classification** (required, one of `TRIAL` / `CHAMBERS_EX_PARTE` / `SEALED`, presented as a 3-option radio group) — accompanied by always-visible inline copy: "Classification cannot be changed after the exhibit is created." No edit/reclassify action exists anywhere in the UI for any role, by design (US-16.1).
- **Custodian** (required to complete the intake action) — presented as the final field in the same panel, labeled "Custodian (required to mark this exhibit into evidence)." From the user's point of view this is one seamless submission; underneath, it fires `POST /api/exhibits` immediately followed by the exhibit's first `POST /api/exhibits/:id/events/status` (`toStatus: MARKED`) call carrying the supplied custodian — presented as a single atomic step with a single "Create & Mark into Evidence" submit button, matching F18's "no separate manual step a user could skip" guarantee. If either call fails, the panel reports the specific error and the exhibit does not appear in the list in a half-created state.
- The "+ New Exhibit" action itself is absent (not disabled) for any role outside `DEPUTY`/`CLERK`/`ADMIN` (F20 row 1) — see `Y0-patterns.md` §Pattern: Role-Gated Control Visibility.

**Custody status in the table (F19):** the custodian column renders one of three states per row — a plain name (settled), "No custodian of record" (triggers the `ADMITTED_NO_CUSTODIAN` discrepancy if the exhibit is also `ADMITTED`), or a compact "{current custodian} → pending: {named receiver}" indicator when a transfer has been proposed but not yet confirmed. The pending indicator is a summary only — Confirm/Cancel actions live on the Exhibit Detail View (see `Screen-02-exhibit-detail.md` §Custody section); clicking the indicator (or the row) navigates there. See `Y0-patterns.md` §Pattern: Two-Phase Custody Handoff.

**Row clickability fix (US-15.1):** the full row container — not a nested link, icon, or label span — is the click target, across its entire width, for every row regardless of discrepancy-flag state. A visible hover affordance (row background highlight, `cursor: pointer`) confirms this before the click. The row is keyboard-focusable; `Enter`/`Space` navigates identically to a click. Inline row-level actions (Record Status, Propose Custody Transfer, Raise Objection, the ⚠ discrepancy icon) stop click-propagation so operating them never also triggers row navigation — see `Y0-patterns.md` §Pattern: Fully Clickable List Row.

#### Information Hierarchy

| Priority | Content | Placement |
|----------|---------|-----------|
| Primary | Exhibit label + current status badge | Leftmost columns, largest visual weight |
| Primary | Quick-filter chips (added Phase 8) | Directly above the search bar — first interactive element encountered after the screen title |
| Primary | Flags column (readable text pills, amended Phase 8) | Same row as before, now labeled text instead of icon-only — visible without drill-in (US-9.2) |
| Secondary | Jury Package eligibility column (added Phase 8) | Rightmost table column |
| Secondary | Current custodian name | Mid-row column |
| Secondary | Offering party, associated witness | Mid-row columns |
| Tertiary | Description (truncated) | Collapsible/truncated text, full text on hover or in detail view |

#### States

| State | Appearance | User Feedback |
|-------|------------|----------------|
| Default list | Full case exhibit list, role-filtered, sorted by `exhibitLabel` | None |
| Search/filter active | List replaced by filtered results; active filter chips shown above the table with individual `×` removal | Chip UI makes "what's currently applied" obvious at a glance |
| Empty search result | "No exhibits match these filters" + a one-click "Clear filters" action | Non-blaming copy; never implies user error |
| Empty case (no exhibits yet) | "No exhibits recorded yet" | Rare in demo (seed data guarantees content) but designed for completeness |
| Sealed exhibit, unauthorized role | Row simply absent — no redacted placeholder row | Confirms US-9.1: sealed exhibits are invisible, not indicated |
| Live update arrives | Status badge or custodian cell updates in place, subtle highlight flash (~400ms) then settles | No full-table re-render/flicker |
| Row hover / keyboard focus | Full row background highlights and shows `cursor: pointer`; focus ring outlines the entire row, not just a sub-element | Confirms the whole row — not a hidden nested link — is the click/activation target (US-15.1) |
| Row action in progress (status/custody/objection write) | Inline row shows a small spinner on the affected cell only | Rest of table remains interactive |
| Write error (e.g., `STATUS_CONFLICT`) | Inline red text beneath the affected row: "Status has changed since this loaded — refresh and retry" | Row reverts to server-confirmed value, no stuck optimistic state |
| Admission attempt blocked (`ADMISSION_BLOCKED`) | Inline "Record Status" action re-opens with a specific error listing every blocking reason at once — e.g., "Cannot admit: 2 blocking condition(s) present — Unresolved objection on this exhibit; No custodian of record." | No partial/generic failure message; no event recorded; status/badge remain exactly as they were before the attempt (US-12.1, US-12.2) — see `Y0-patterns.md` §Pattern: Multi-Reason Blocking Error |
| Custody transfer pending (F19) | Custodian cell shows "{current custodian} → pending: {named receiver}" instead of a plain name; row's "Propose Custody Transfer" action is unavailable while pending | Confirms a handoff is mid-flight without implying it's already complete — full Confirm/Cancel actions available on Exhibit Detail (US-19.1) |
| Intake blocked — missing/invalid classification (`CLASSIFICATION_REQUIRED` / `INVALID_CLASSIFICATION`) | "+ New Exhibit" panel stays open with inline field-level error on the classification group; no exhibit created | Forces an explicit choice before any record exists — no silent default (US-16.1) |
| Intake blocked — no custodian at first MARKED (`CUSTODIAN_REQUIRED_AT_INTAKE`) | "+ New Exhibit" panel stays open with inline field-level error on the custodian field; if the identity-only `POST /api/exhibits` call already succeeded, the panel keeps the exhibit in an explicit "created, not yet marked" sub-state and retries only the MARKED step on resubmit, never silently duplicating the exhibit | No exhibit is ever shown in the main list without a custodian (US-18.1, US-18.2) |
| Action unavailable for current role (F20) | Control is not rendered at all — "+ New Exhibit," "Record Status," "Propose Custody Transfer," "Raise Objection" are each independently absent per F20's matrix for the active role | Absent, not disabled — see `Y0-patterns.md` §Pattern: Role-Gated Control Visibility (US-20.1–US-20.4) |
| Quick-filter chip selected (added Phase 8) | Selected chip shows a pressed/active visual state (`aria-pressed="true"`); table narrows to matching rows only; search bar and dropdown filters remain usable and compose with the active chip | Single-select, like a tab strip — selecting a different chip replaces, not adds to, the active narrowing (US-9.3) |
| Quick-filter chip, zero matches (e.g., "Awaiting ruling 0") | Chip renders with a "0" count and remains selectable; selecting it shows the same "No exhibits match these filters" empty state used for a zero-result search | Consistent empty-state language across both filtering mechanisms (US-9.3) |
| Jury Package column — no package computed yet (added Phase 8) | Every row reads "Not eligible" | Expected behavior, not a defect — matches F11's "no package started yet" state (US-9.3) |
| Jury Package column value (added Phase 8) | "Included" (green), "Not eligible" (neutral/grey), or "Blocked" (amber) — color-coded, text always present alongside the color (never color alone) | Matches the Jury Package Workspace's own per-exhibit status for the same exhibit, always (US-9.3) |
| Flags column, multiple simultaneous conditions (amended Phase 8) | Multiple readable pills stack in the same cell (e.g., "Ruling pending" + "No custodian") | Never collapsed into one generic icon when more than one condition applies |
| Load failure | Full-table inline error with retry button | — |

#### Interactive Elements

| Element | Type | Behavior |
|---------|------|----------|
| "+ New Exhibit" (toolbar, top-right) | Primary action, opens inline intake panel | Captures identity fields + required immutable classification + required intake custodian in one seamless submit (US-16.1, US-18.1, US-18.2); rendered only for `DEPUTY`/`CLERK`/`ADMIN` (F20 row 1) — absent for `JUDGE`/`CHAMBERS_STAFF`/`ATTORNEY` |
| Search bar | Text input | Keyword match against label/description/source; combines with dropdown filters (AND semantics, US-4.1) |
| Status / Witness / Date filter dropdowns | Combinable filters | Each adds a removable chip; empty search blocked with inline hint, not a hard error page (US-4.1) |
| Exhibit row | Click target (entire row, not a nested element) | Navigates to Exhibit Detail View (`/exhibit/:id`); visible hover highlight; Enter/Space activates on keyboard focus (US-9.2, US-15.1) |
| Inline "Record Status" action (row-level) | Compact action, not a modal form | Offers only valid next-transition options (US-1.1); an attempted `ADMITTED` transition is rejected with every blocking reason named if an unresolved objection or missing custodian applies (US-12.1, US-12.2); rendered only for `DEPUTY`/`CLERK`/`ADMIN` (F20 row 2/3) — absent otherwise (US-20.2) |
| Inline "Propose Custody Transfer" action | Compact action | Requires selecting an active user as the intended receiver; does not change current custodian — see `Y0-patterns.md` §Pattern: Two-Phase Custody Handoff (US-19.1); rendered only for `DEPUTY`/`CLERK`/`ADMIN` (F20 row 6) — absent otherwise (US-20.4); unavailable (control absent) while a transfer is already pending for that exhibit |
| Inline "Raise Objection" action | Compact action, two fields | Party + grounds only (US-2.1); rendered only for `ATTORNEY`/`DEPUTY`/`CLERK`/`ADMIN` (F20 row 4) — absent for `JUDGE`/`CHAMBERS_STAFF` (US-20.3) |
| Discrepancy icon / Flags pill (amended Phase 8) | Tooltip + link (icon); always-visible label (pill) | Pill text itself conveys the condition without a hover; click/hover still navigates to / expands Exhibit Detail View discrepancy section exactly as before |
| Quick-filter chip (All / Needs attention / In my custody / Awaiting ruling) (added Phase 8) | Toggle group, single-select | Narrows the visible row set client-side against already-role-filtered data; composes with an active search query; `data-testid="quick-filter-chip-{key}"` (US-9.3) |
| Jury Package eligibility badge (added Phase 8) | Static, per-row | Computed identically to F11's own per-exhibit status; `data-testid="exhibit-row-jury-package-badge"` (US-9.3) |

**⚠ New `data-testid`/`aria-label` contract needed (flagged for UX-researcher/planner, US-24.3):** `quick-filter-chips`, `quick-filter-chip-all`, `quick-filter-chip-needs-attention`, `quick-filter-chip-in-my-custody`, `quick-filter-chip-awaiting-ruling`, `exhibit-row-jury-package-badge`, `exhibit-row-flag-pill` — all additive; the pre-existing `exhibit-row` selector and its row-level action selectors (Record Status, Propose Custody Transfer, Raise Objection) are unchanged.

**Positioning note:** row-level action affordances are deliberately understated (icon buttons, not prominent colored CTAs) — the search/browse experience is the visual star of this screen, with data-entry kept minimal and secondary per the "assistant, not data-entry system" constraint (FRD F09 §Validation). These understated inline actions coexist with full-row clickability without conflict: each inline action stops click-propagation, so clicking a status/custody/objection control never also fires row navigation, while every other point on the row — including empty space and the description/party/witness cells — still navigates (US-15.1, fixes a regression against this screen's originally-specified behavior).
