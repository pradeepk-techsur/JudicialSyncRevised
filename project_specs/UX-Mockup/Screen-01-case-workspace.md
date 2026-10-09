### Screen: Case Workspace

**Purpose:** The primary browsing and searching surface for the full exhibit set — one trustworthy list instead of a spreadsheet.
**User Stories:** US-9.1, US-9.2, US-4.1, US-1.1, US-1.2, US-3.1, US-3.2, US-2.1, US-15.1, US-12.1, US-12.2
**Journey:** JRN-02.1 (Log Exhibit Activity, Answer a Custody Question, Search Mid-Testimony)
**Route:** `/case` · **Nav:** Sidebar "Case Workspace"

#### Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ JudicialSync   [Case: 2026-CR-0142]      [Role: Deputy ▾] [Ask ✦]│
├───────────────┬──────────────────────────────────────────────────┤
│ Command Ctr   │  Case Workspace                                  │
│ ▸ Case        │  ┌────────────────────────────────────────────┐  │
│ Jury Pkg      │  │ 🔍 Search exhibits...   [Status ▾][Witness ▾]│  │
│ Assistant     │  │     Active filters: witness=Smith  [× clear]│  │
│               │  └────────────────────────────────────────────┘  │
│               │  ┌────────────────────────────────────────────┐  │
│               │  │ Label  Desc        Party  Witness Status  Custodian  ⚑│
│               │  │ Ex. 14 Blood sample PROS  Smith  ●ADMITTED –        ⚠│
│               │  │ Ex. 7  Phone record DEF   —      ●OFFERED  D.Reyes   │
│               │  │ Ex. 9  Email thread PROS  Lee     ●OBJECTED C.Chen   │
│               │  │ Ex. 3  Contract     PLAIN —      ●MARKED  –        │
│               │  │ ... (polling live, 3–5s)                     │  │
│               │  └────────────────────────────────────────────┘  │
└───────────────┴──────────────────────────────────────────────────┘
   entire row (hover: highlight + cursor:pointer) ──▶ Exhibit Detail View (/exhibit/:id)
```

**Row clickability fix (US-15.1):** the full row container — not a nested link, icon, or label span — is the click target, across its entire width, for every row regardless of discrepancy-flag state. A visible hover affordance (row background highlight, `cursor: pointer`) confirms this before the click. The row is keyboard-focusable; `Enter`/`Space` navigates identically to a click. Inline row-level actions (Record Status, Transfer Custody, Raise Objection, the ⚠ discrepancy icon) stop click-propagation so operating them never also triggers row navigation — see `Y0-patterns.md` §Pattern: Fully Clickable List Row.

#### Information Hierarchy

| Priority | Content | Placement |
|----------|---------|-----------|
| Primary | Exhibit label + current status badge | Leftmost columns, largest visual weight |
| Primary | Discrepancy indicator (⚠) | Rightmost column, same row — visible without drill-in (US-9.2) |
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
| Load failure | Full-table inline error with retry button | — |

#### Interactive Elements

| Element | Type | Behavior |
|---------|------|----------|
| Search bar | Text input | Keyword match against label/description/source; combines with dropdown filters (AND semantics, US-4.1) |
| Status / Witness / Date filter dropdowns | Combinable filters | Each adds a removable chip; empty search blocked with inline hint, not a hard error page (US-4.1) |
| Exhibit row | Click target (entire row, not a nested element) | Navigates to Exhibit Detail View (`/exhibit/:id`); visible hover highlight; Enter/Space activates on keyboard focus (US-9.2, US-15.1) |
| Inline "Record Status" action (row-level, authorized roles only) | Compact action, not a modal form | Offers only valid next-transition options (US-1.1); an attempted `ADMITTED` transition is rejected with every blocking reason named if an unresolved objection or missing custodian applies (US-12.1, US-12.2) |
| Inline "Transfer Custody" action | Compact action | Requires selecting an active user as new custodian (US-3.1) |
| Inline "Raise Objection" action | Compact action, two fields | Party + grounds only (US-2.1) |
| Discrepancy icon (⚠) | Tooltip + link | Hover shows the specific rule fired; click navigates to Exhibit Detail View discrepancy section |

**Positioning note:** row-level action affordances are deliberately understated (icon buttons, not prominent colored CTAs) — the search/browse experience is the visual star of this screen, with data-entry kept minimal and secondary per the "assistant, not data-entry system" constraint (FRD F09 §Validation). These understated inline actions coexist with full-row clickability without conflict: each inline action stops click-propagation, so clicking a status/custody/objection control never also fires row navigation, while every other point on the row — including empty space and the description/party/witness cells — still navigates (US-15.1, fixes a regression against this screen's originally-specified behavior).
