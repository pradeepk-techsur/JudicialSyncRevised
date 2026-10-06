## F09: Case Workspace Screen

**Description:** The case-level screen listing all exhibits, parties, and current statuses in one place — the primary browsing and searching surface for the full exhibit set, and the entry point into an individual Exhibit Detail View (F10).

**Terminology:**
- (none beyond `00-header.md` shared terminology)

**Sub-features:**
- Full exhibit list for the case with current status, offering party, and witness association
- Integrated search/filter bar (F4)
- Inline discrepancy flag indicators per exhibit row (F6)
- Row-level drill-through to Exhibit Detail View (F10)

**Process:**
1. On load (no search criteria active), the client calls `getExhibits(caseId)`, which internally applies role-based visibility (excluding sealed exhibits per role) and returns every visible exhibit joined with its `ExhibitCurrentState` and any `OPEN`/`ACKNOWLEDGED` `DiscrepancyFlag` rows.
2. Each row renders: exhibit label, description (truncated), offering party, associated witness, current status badge (F1 visual convention), current custodian name (F3), and a discrepancy indicator icon if any flag exists for that exhibit.
3. When the user enters search criteria, the client calls `searchExhibits` (F4) instead of `getExhibits`, replacing the rendered list with filtered results while preserving the same row rendering.
4. Clicking any exhibit row navigates to `/exhibit/:id`, the Exhibit Detail View (F10), passing the `exhibitId`.
5. The screen polls `getExhibits`/`searchExhibits` on the same live-sync interval as F8 (3–5s) so status/custody/discrepancy changes recorded by another user appear without manual refresh.

**Inputs:**
- `caseId` (string/UUID, required, from session)
- `requestingUserRole` (enum, required, from session)
- Search criteria (optional, per F4 §Inputs) when the search bar is active

**Outputs:**
- Exhibit row list: `{ exhibitId, exhibitLabel, description, offeringParty, associatedWitness, currentStatus, currentCustodianName, discrepancyFlags[] }`

**Validation:**
- No write operations originate from this screen directly — all mutations (status change, objection, ruling, custody transfer) happen via dedicated action flows that call F1/F2/F3 endpoints, kept outside this screen's core list-rendering responsibility per the PRD's "assistant, not data-entry system" positioning
- Sealed exhibits never appear in this screen's list for a role outside the visibility set (`00-header.md` §Role-Based Visibility) — not shown as redacted rows, simply absent

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| Case not found / no access | 404 | CASE_NOT_FOUND | "No case found with the given ID" |
| Underlying exhibit list query failure | 500 | CASE_WORKSPACE_LOAD_FAILED | "Unable to load case exhibits — please retry" |

**API Surface (this feature):** see `Y1-api.md` §Exhibits for `GET /api/cases/:id/exhibits` and §Search for `GET /api/cases/:id/exhibits/search` (F4).

**Schema Surface (this feature):** read-only against `Exhibit`, `ExhibitCurrentState`, `CustodyCurrentState`, `DiscrepancyFlag` — see `Y0-schema.md`. Introduces no new tables.
