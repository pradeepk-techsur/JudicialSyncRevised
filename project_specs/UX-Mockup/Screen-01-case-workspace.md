### Screen: Case Workspace

**Purpose:** The primary browsing and searching surface for the full exhibit set — one trustworthy list instead of a spreadsheet.
**User Stories:** US-9.1, US-9.2, US-4.1, US-1.1, US-1.2, US-3.1, US-3.2, US-2.1, US-15.1, US-12.1, US-12.2, US-16.1, US-18.1, US-18.2, US-19.1, US-20.1, US-20.2, US-20.3, US-20.4
**Journey:** JRN-02.1 (Log Exhibit Activity, Answer a Custody Question, Search Mid-Testimony)
**Route:** `/case` · **Nav:** Sidebar "Case Workspace"

#### Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ JudicialSync  [Case: 2026-CR-0142 ▾] [⚠ 1] [Role: Deputy ▾][Ask ✦]│
├───────────────┬──────────────────────────────────────────────────┤
│ Command Ctr   │  Case Workspace                  [+ New Exhibit] │
│ ▸ Case        │  ┌────────────────────────────────────────────┐  │
│ Jury Pkg      │  │ 🔍 Search exhibits...   [Status ▾][Witness ▾]│  │
│ Assistant     │  │     Active filters: witness=Smith  [× clear]│  │
│               │  └────────────────────────────────────────────┘  │
│               │  ┌────────────────────────────────────────────┐  │
│               │  │ Label  Desc        Party  Witness Status  Custodian       ⚑│
│               │  │ Ex. 14 Blood sample PROS  Smith  ●ADMITTED –             ⚠│
│               │  │ Ex. 7  Phone record DEF   —      ●OFFERED  D.Reyes       │
│               │  │ Ex. 9  Email thread PROS  Lee     ●OBJECTED C.Chen        │
│               │  │ Ex. 3  Contract     PLAIN —      ●MARKED  D.Reyes → pending: C.Chen │
│               │  │ ... (polling live, 3–5s)                     │  │
│               │  └────────────────────────────────────────────┘  │
└───────────────┴──────────────────────────────────────────────────┘
   entire row (hover: highlight + cursor:pointer) ──▶ Exhibit Detail View (/exhibit/:id)
   "+ New Exhibit" is absent entirely for JUDGE/CHAMBERS_STAFF/ATTORNEY roles (F20) — see Pattern: Role-Gated Control Visibility
```

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
| Custody transfer pending (F19) | Custodian cell shows "{current custodian} → pending: {named receiver}" instead of a plain name; row's "Propose Custody Transfer" action is unavailable while pending | Confirms a handoff is mid-flight without implying it's already complete — full Confirm/Cancel actions available on Exhibit Detail (US-19.1) |
| Intake blocked — missing/invalid classification (`CLASSIFICATION_REQUIRED` / `INVALID_CLASSIFICATION`) | "+ New Exhibit" panel stays open with inline field-level error on the classification group; no exhibit created | Forces an explicit choice before any record exists — no silent default (US-16.1) |
| Intake blocked — no custodian at first MARKED (`CUSTODIAN_REQUIRED_AT_INTAKE`) | "+ New Exhibit" panel stays open with inline field-level error on the custodian field; if the identity-only `POST /api/exhibits` call already succeeded, the panel keeps the exhibit in an explicit "created, not yet marked" sub-state and retries only the MARKED step on resubmit, never silently duplicating the exhibit | No exhibit is ever shown in the main list without a custodian (US-18.1, US-18.2) |
| Action unavailable for current role (F20) | Control is not rendered at all — "+ New Exhibit," "Record Status," "Propose Custody Transfer," "Raise Objection" are each independently absent per F20's matrix for the active role | Absent, not disabled — see `Y0-patterns.md` §Pattern: Role-Gated Control Visibility (US-20.1–US-20.4) |
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
| Discrepancy icon (⚠) | Tooltip + link | Hover shows the specific rule fired; click navigates to Exhibit Detail View discrepancy section |

**Positioning note:** row-level action affordances are deliberately understated (icon buttons, not prominent colored CTAs) — the search/browse experience is the visual star of this screen, with data-entry kept minimal and secondary per the "assistant, not data-entry system" constraint (FRD F09 §Validation). These understated inline actions coexist with full-row clickability without conflict: each inline action stops click-propagation, so clicking a status/custody/objection control never also fires row navigation, while every other point on the row — including empty space and the description/party/witness cells — still navigates (US-15.1, fixes a regression against this screen's originally-specified behavior).
