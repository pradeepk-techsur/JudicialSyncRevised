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
│ Assistant     │  ┌──────────────────────────────────────────────────┐│
│               │  │ Search [🔍 Search exhibits...]  Status ▾  Witness ▾││
│               │  │                                 (searchable)       ││
│               │  │ From [__________]  To [__________]                 ││
│               │  │ Showing 7 of 10            [ Clear filters ]       ││
│               │  └──────────────────────────────────────────────────┘│
│               │  ┌────────────────────────────────────────────────────────────┐│
│               │  │ Label  Description (wraps, full width)  Party Witness Status  Custodian  Flags  Jury Pkg││
│               │  │ Ex. 14 Blood sample, lab-sealed, chain   PROS  Smith  ●ADMITTED –        No      Blocked ││
│               │  │         of custody intact through intake                              custodian       ││
│               │  │ Ex. 7  Phone records, provider subpoena  DEF   —      ●OFFERED  D.Reyes  —       (blank)││
│               │  │ Ex. 9  Email thread, three messages       PROS  Lee    ●OBJECTED C.Chen   Open    (blank)││
│               │  │                                                          objection               ││
│               │  │ Ex. 3  Contract, signed copy               PLAIN —      ●MARKED   D.Reyes  Ruling  (blank)││
│               │  │                                                       → pending:    pending      ││
│               │  │                                                          C.Chen                      ││
│               │  │ Ex. 5  Inspection report, 4 pages          PROS  Lee    ●ADMITTED D.Reyes  —       Included││
│               │  │ ... (polling live, 3–5s; no zebra stripes — rows plain, attention rows tinted)         ││
│               │  └────────────────────────────────────────────────────────────┘│
└───────────────┴──────────────────────────────────────────────────┘
   entire row (hover: highlight + cursor:pointer) ──▶ Exhibit Detail View (/exhibit/:id)
   "+ New Exhibit" is absent entirely for JUDGE/CHAMBERS_STAFF/ATTORNEY roles (F20) — see Pattern: Role-Gated Control Visibility
```

**Quick-filter chips (added Phase 8, US-9.3):** a row of one-click chips — **All N / Needs attention N / In my custody N / Awaiting ruling N** — directly above the search bar, each with a live count badge. Selecting a chip narrows the visible row set immediately, without requiring the search bar or any dropdown — "All" is selected by default and shows the full visible (role-filtered) exhibit count. Matching rules: "Needs attention" matches at least one `OPEN` discrepancy flag OR at least one `UNRESOLVED` objection thread; "In my custody" matches `CustodyCurrentState.currentCustodianUserId` equal to the signed-in user; "Awaiting ruling" matches at least one `UNRESOLVED` objection thread (a narrower, ruling-specific lens on the same underlying condition "Needs attention" also surfaces more broadly). Chips are mutually exclusive (single-select, like a tab strip, not independently combinable toggles) and compose with an active search/filter query exactly as a dropdown filter would — selecting a chip while a search is active narrows the *search results* by the chip's condition, not a separate, parallel list. Chips re-evaluate on every live-sync poll tick so counts and membership stay current without a manual refresh.

**⚠ New `data-testid` needed:** chip row `data-testid="quick-filter-chips"`; each chip `data-testid="quick-filter-chip-{key}"` (`all` / `needs-attention` / `in-my-custody` / `awaiting-ruling`), each carrying `aria-pressed` to reflect single-select state for assistive technology.

**Jury Package column — four values, non-admitted rows blank (reworked Phase 9, T-06, F09 §Process steps 3–4):** **Supersedes the Phase 8 three-value description above**, which folded "never assessed yet" and "structurally excluded" into one `Not eligible` value and showed `Not eligible` even on exhibits that had never been offered. The rightmost table column now renders one of **four** color-coded tag values per row, in this precedence: **Included** (green) — package member, clean; **Blocked** (amber) — package member, open discrepancy; **Not eligible** (neutral/grey) — a *permanent, structural* exclusion (sealed/ex-parte classification, or explicitly `EXCLUDED` from a package); **Not yet evaluated** (neutral, visually distinct from `Not eligible`) — admitted, but never run through package computation (no `JuryPackage` ever computed for the case, or computed before this exhibit was admitted). Computed identically to, and never diverging from, the Jury Package Workspace's own per-exhibit status and the Exhibit Detail checklist (F9 §Process step 3 = F11's row-level grouping = F10's checklist card). **For any exhibit whose `currentStatus` is not `ADMITTED`, the column renders no tag at all (blank cell)** — an eligibility tag on an exhibit that hasn't even been offered is noise, not signal; the service still computes and returns a value for these rows, the UI simply suppresses rendering it. `data-testid="exhibit-row-jury-package-badge"` with `aria-label="Jury package status: Blocked"` (etc. per value) — selector unchanged from Phase 8, value set extended.

**No zebra striping; attention-row tint retained (reworked Phase 9, T-06):** the table no longer alternates row background colors. The only row-level background emphasis is the existing attention/discrepancy tint (a subtle highlight on a row carrying an `OPEN` discrepancy flag or `UNRESOLVED` objection) — unaffected by this change and still the sole visual differentiator between rows beyond hover/focus state.

**Description column — full remaining width, wraps (reworked Phase 9, T-06):** the description cell no longer truncates with an ellipsis. It takes whatever width remains after every other column has its content-driven width, and wraps onto multiple lines rather than clipping — the full description is always visible in the row itself, with no separate "hover or detail view to read it" step required.

**Flags column — readable text pills, not icon-only (amended Phase 8, Design Principle 7):** the existing discrepancy/objection/custody indicator column is relabeled "Flags" and now renders a short readable text pill per condition rather than a bare icon requiring a hover to understand — "Ruling pending" (unresolved objection), "No custodian" (`ADMITTED_NO_CUSTODIAN` discrepancy), "Open objection" (unresolved thread on a not-yet-admitted exhibit), "Ex parte · restricted" (chambers-ex-parte/sealed classification visible to an authorized role). A row with zero applicable flags shows an em-dash ("—"), not a blank cell. Multiple simultaneous flags stack as multiple pills in the same cell, never collapsed into a single generic "⚠" glyph. This does not change the underlying discrepancy/objection data — it is a presentation-only amendment to the same column Phase 7 already shipped (`Y0-patterns.md` §Pattern: Discrepancy Flag Treatment, unchanged in substance). `data-testid="exhibit-row-flag-pill"` per pill (new as of Phase 8) — the pre-existing `data-testid="exhibit-row"` and the row's discrepancy-icon hover/click behavior are otherwise unchanged (US-24.3).

**"+ New Exhibit" intake flow (US-16.1, US-18.1, US-18.2, F16, F18):** opens a compact inline panel at the top of the table — not a full-screen modal, consistent with this screen's existing "assistant, not data-entry system" positioning, just a larger instance of the same Inline Row Actions pattern. The panel asks for identity fields (label, description, source, offering party, witness) plus two fields new as of Phase 7.1:
- **Classification** (required, one of `TRIAL` / `CHAMBERS_EX_PARTE` / `SEALED`, presented as a 3-option radio group) — accompanied by always-visible inline copy: "Classification cannot be changed after the exhibit is created." No edit/reclassify action exists anywhere in the UI for any role, by design (US-16.1).
- **Custodian** (required to complete the intake action) — presented as the final field in the same panel, labeled "Custodian (required to mark this exhibit into evidence)." From the user's point of view this is one seamless submission; underneath, it fires `POST /api/exhibits` immediately followed by the exhibit's first `POST /api/exhibits/:id/events/status` (`toStatus: MARKED`) call carrying the supplied custodian — presented as a single atomic step with a single "Create & Mark into Evidence" submit button, matching F18's "no separate manual step a user could skip" guarantee. If either call fails, the panel reports the specific error and the exhibit does not appear in the list in a half-created state.
- The "+ New Exhibit" action itself is absent (not disabled) for any role outside `DEPUTY`/`CLERK`/`ADMIN` (F20 row 1) — see `Y0-patterns.md` §Pattern: Role-Gated Control Visibility.

**Custody status in the table (F19):** the custodian column renders one of three states per row — a plain name (settled), "No custodian of record" (triggers the `ADMITTED_NO_CUSTODIAN` discrepancy if the exhibit is also `ADMITTED`), or a compact "{current custodian} → pending: {named receiver}" indicator when a transfer has been proposed but not yet confirmed. The pending indicator is a summary only — Confirm/Cancel actions live on the Exhibit Detail View (see `Screen-02-exhibit-detail.md` §Custody section); clicking the indicator (or the row) navigates there. See `Y0-patterns.md` §Pattern: Two-Phase Custody Handoff.

**Row clickability fix (US-15.1):** the full row container — not a nested link, icon, or label span — is the click target, across its entire width, for every row regardless of discrepancy-flag state. A visible hover affordance (row background highlight, `cursor: pointer`) confirms this before the click. The row is keyboard-focusable; `Enter`/`Space` navigates identically to a click. Inline row-level actions (Record Status, Propose Custody Transfer, Raise Objection, the ⚠ discrepancy icon) stop click-propagation so operating them never also triggers row navigation — see `Y0-patterns.md` §Pattern: Fully Clickable List Row.

**Filter bar — labeled fields, searchable Witness select, result-count readout (reworked Phase 9, T-07, F09 Phase 9 addendum):** **Supersedes the unlabeled filter bar implied by the Layout diagram's prior wording.** Every filter — Search, Status, Witness, From, To — now carries a visible Carbon field label (not just a placeholder string standing in for a label); From and To are explicitly labeled as date-range bounds (not a single ambiguous "Date" control), so it is never unclear which end of a range a date picker sets. The prior helper line ("Active filters: witness=Smith [× clear]") is replaced by a plain, always-current **"Showing X of Y"** result-count readout plus a single **"Clear filters"** action — never a sentence a user has to parse to learn how many rows are currently hidden.
- **Witness filter** is a searchable Carbon `ComboBox` (not a free-text field and not a fixed hardcoded list) built from the distinct `associatedWitness` values already present in the currently-loaded exhibit list — typing narrows the option list, selecting one adds it as a combinable filter exactly as the Status dropdown does.
- **Query selection**: `getExhibits` (no filters active) and `searchExhibits` (>=1 filter set) are each called only when appropriate, so a state with zero active filters never accidentally calls `searchExhibits` with empty criteria and trips `EMPTY_SEARCH_CRITERIA` (F4).
- AND semantics across combined filters are unchanged — adding a second filter narrows further, it never widens or replaces the first.
- `data-testid` additions: `data-testid="filter-result-count"` (the "Showing X of Y" readout), `data-testid="filter-clear-button"` ("Clear filters"), `data-testid="witness-filter-combobox"` (new, replaces a prior plain dropdown selector if one existed).

#### Information Hierarchy

| Priority | Content | Placement |
|----------|---------|-----------|
| Primary | Exhibit label + current status badge | Leftmost columns, largest visual weight |
| Primary | Quick-filter chips (added Phase 8) | Directly above the search bar — first interactive element encountered after the screen title |
| Primary | Flags column (readable text pills, amended Phase 8) | Same row as before, now labeled text instead of icon-only — visible without drill-in (US-9.2) |
| Secondary | Jury Package eligibility column (four values, reworked Phase 9) | Rightmost table column, blank for non-admitted rows |
| Secondary | Current custodian name | Mid-row column |
| Secondary | Offering party, associated witness | Mid-row columns |
| Secondary | Labeled filter bar + "Showing X of Y" result count (reworked Phase 9) | Directly above the table, every field visibly labeled |
| Tertiary | Description (full width, wraps — reworked Phase 9) | Takes the table's remaining width; no truncation, no ellipsis, no hover-to-read |

#### States

| State | Appearance | User Feedback |
|-------|------------|----------------|
| Default list | Full case exhibit list, role-filtered, sorted by `exhibitLabel` | None |
| Search/filter active (reworked Phase 9) | List replaced by filtered results; each active filter's labeled field shows its current value; "Showing X of Y" readout updates to the filtered count | The result-count readout makes "what's currently applied, and how much it narrowed" obvious at a glance — replaces the prior ambiguous helper sentence (T-07) |
| Empty search result | "No exhibits match these filters" + a one-click "Clear filters" action ("Showing 0 of Y") | Non-blaming copy; never implies user error |
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
| Jury Package column — admitted, never evaluated (reworked Phase 9) | Row reads "Not yet evaluated," distinct from "Not eligible" | Corrects Phase 8's regression where every never-computed exhibit incorrectly read "Not eligible" regardless of admission state (T-06, F09 §Process step 4) |
| Jury Package column — not yet admitted (reworked Phase 9) | Column renders blank (no tag) | An eligibility tag on a not-yet-offered exhibit is noise, not signal — the service still computes a value, the UI suppresses it (T-06) |
| Jury Package column value (reworked Phase 9, four values) | "Included" (green), "Blocked" (amber), "Not eligible" (neutral/grey, structural exclusion), or "Not yet evaluated" (neutral, never assessed) — color-coded, text always present alongside the color (never color alone), blank for non-admitted rows | Matches the Jury Package Workspace's own per-exhibit status and the Exhibit Detail checklist for the same exhibit, always (US-9.3, T-06) |
| Table row background (reworked Phase 9) | No zebra striping — every row shares the same base background; the existing attention/discrepancy tint is the only row-level background emphasis | Prevents the alternating-row color from competing with or diluting the attention tint's signal (T-06) |
| Flags column, multiple simultaneous conditions (amended Phase 8) | Multiple readable pills stack in the same cell (e.g., "Ruling pending" + "No custodian") | Never collapsed into one generic icon when more than one condition applies |
| Load failure | Full-table inline error with retry button | — |

#### Interactive Elements

| Element | Type | Behavior |
|---------|------|----------|
| "+ New Exhibit" (toolbar, top-right) | Primary action, opens inline intake panel | Captures identity fields + required immutable classification + required intake custodian in one seamless submit (US-16.1, US-18.1, US-18.2); rendered only for `DEPUTY`/`CLERK`/`ADMIN` (F20 row 1) — absent for `JUDGE`/`CHAMBERS_STAFF`/`ATTORNEY` |
| Search bar (labeled, reworked Phase 9) | Text input, visible Carbon label "Search" | Keyword match against label/description/source; combines with other filters (AND semantics, US-4.1) |
| Status filter (labeled, reworked Phase 9) | Dropdown, visible Carbon label "Status" | Combinable filter; `getExhibits`/`searchExhibits` selected appropriately to avoid `EMPTY_SEARCH_CRITERIA` (T-07) |
| Witness filter (reworked Phase 9) | Searchable `ComboBox`, visible Carbon label "Witness" | Built from distinct `associatedWitness` values in the loaded list — not free text, not a hardcoded list; `data-testid="witness-filter-combobox"` (T-07) |
| From / To date filters (labeled, reworked Phase 9) | Two explicitly labeled date inputs, "From" and "To" | Combinable range filter; never a single ambiguous "Date" control (T-07) |
| "Clear filters" (reworked Phase 9, replaces the prior per-chip `×`) | Action | Resets every active filter field at once; `data-testid="filter-clear-button"` (T-07) |
| Exhibit row | Click target (entire row, not a nested element) | Navigates to Exhibit Detail View (`/exhibit/:id`); visible hover highlight; Enter/Space activates on keyboard focus (US-9.2, US-15.1) |
| Inline "Record Status" action (row-level) | Compact action, not a modal form | Offers only valid next-transition options (US-1.1); an attempted `ADMITTED` transition is rejected with every blocking reason named if an unresolved objection or missing custodian applies (US-12.1, US-12.2); rendered only for `DEPUTY`/`CLERK`/`ADMIN` (F20 row 2/3) — absent otherwise (US-20.2) |
| Inline "Propose Custody Transfer" action | Compact action | Requires selecting an active user as the intended receiver; does not change current custodian — see `Y0-patterns.md` §Pattern: Two-Phase Custody Handoff (US-19.1); rendered only for `DEPUTY`/`CLERK`/`ADMIN` (F20 row 6) — absent otherwise (US-20.4); unavailable (control absent) while a transfer is already pending for that exhibit |
| Inline "Raise Objection" action | Compact action, two fields | Party + grounds only (US-2.1); rendered only for `ATTORNEY`/`DEPUTY`/`CLERK`/`ADMIN` (F20 row 4) — absent for `JUDGE`/`CHAMBERS_STAFF` (US-20.3) |
| Discrepancy icon / Flags pill (amended Phase 8) | Tooltip + link (icon); always-visible label (pill) | Pill text itself conveys the condition without a hover; click/hover still navigates to / expands Exhibit Detail View discrepancy section exactly as before |
| Quick-filter chip (All / Needs attention / In my custody / Awaiting ruling) (added Phase 8) | Toggle group, single-select | Narrows the visible row set client-side against already-role-filtered data; composes with an active search query; `data-testid="quick-filter-chip-{key}"` (US-9.3) |
| Jury Package eligibility badge (four values, reworked Phase 9) | Static, per-row, blank for non-admitted rows | Computed identically to F11's own per-exhibit status and F10's checklist card; `data-testid="exhibit-row-jury-package-badge"` (US-9.3, T-06) |

**⚠ `data-testid`/`aria-label` contract (amended Phase 9, US-24.3):** `quick-filter-chips`, `quick-filter-chip-all`, `quick-filter-chip-needs-attention`, `quick-filter-chip-in-my-custody`, `quick-filter-chip-awaiting-ruling`, `exhibit-row-jury-package-badge`, `exhibit-row-flag-pill` — unchanged from Phase 8; new as of Phase 9: `filter-result-count`, `filter-clear-button`, `witness-filter-combobox` (T-07). The pre-existing `exhibit-row` selector and its row-level action selectors (Record Status, Propose Custody Transfer, Raise Objection) are unchanged.

**Positioning note:** row-level action affordances are deliberately understated (icon buttons, not prominent colored CTAs) — the search/browse experience is the visual star of this screen, with data-entry kept minimal and secondary per the "assistant, not data-entry system" constraint (FRD F09 §Validation). These understated inline actions coexist with full-row clickability without conflict: each inline action stops click-propagation, so clicking a status/custody/objection control never also fires row navigation, while every other point on the row — including empty space and the description/party/witness cells — still navigates (US-15.1, fixes a regression against this screen's originally-specified behavior).
