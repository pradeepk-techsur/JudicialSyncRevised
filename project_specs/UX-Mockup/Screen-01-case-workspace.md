### Screen: Case Workspace

**Purpose:** The primary browsing and searching surface for the full exhibit set — one trustworthy list instead of a spreadsheet.
**User Stories:** US-9.1, US-9.2, US-4.1, US-1.1, US-1.2, US-3.1, US-3.2, US-2.1
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
        row click ──▶ Exhibit Detail View (/exhibit/:id)
```

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
| Row action in progress (status/custody/objection write) | Inline row shows a small spinner on the affected cell only | Rest of table remains interactive |
| Write error (e.g., `STATUS_CONFLICT`) | Inline red text beneath the affected row: "Status has changed since this loaded — refresh and retry" | Row reverts to server-confirmed value, no stuck optimistic state |
| Load failure | Full-table inline error with retry button | — |

#### Interactive Elements

| Element | Type | Behavior |
|---------|------|----------|
| Search bar | Text input | Keyword match against label/description/source; combines with dropdown filters (AND semantics, US-4.1) |
| Status / Witness / Date filter dropdowns | Combinable filters | Each adds a removable chip; empty search blocked with inline hint, not a hard error page (US-4.1) |
| Exhibit row | Click target | Navigates to Exhibit Detail View (`/exhibit/:id`) (US-9.2) |
| Inline "Record Status" action (row-level, authorized roles only) | Compact action, not a modal form | Offers only valid next-transition options (US-1.1) |
| Inline "Transfer Custody" action | Compact action | Requires selecting an active user as new custodian (US-3.1) |
| Inline "Raise Objection" action | Compact action, two fields | Party + grounds only (US-2.1) |
| Discrepancy icon (⚠) | Tooltip + link | Hover shows the specific rule fired; click navigates to Exhibit Detail View discrepancy section |

**Positioning note:** row-level action affordances are deliberately understated (icon buttons, not prominent colored CTAs) — the search/browse experience is the visual star of this screen, with data-entry kept minimal and secondary per the "assistant, not data-entry system" constraint (FRD F09 §Validation).
