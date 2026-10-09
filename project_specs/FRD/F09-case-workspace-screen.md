## F09: Case Workspace Screen

**Description:** The case-level screen listing all exhibits, parties, and current statuses in one place — the primary browsing and searching surface for the full exhibit set, now also the primary surface for triaging exhibits by jury-package eligibility at a glance, and the entry point into an individual Exhibit Detail View (F10).

**Terminology:**
- **Jury Package Eligibility:** A per-exhibit derived state — `Included` / `Not eligible` / `Blocked` — computed from the exhibit's membership (or absence) in the case's most-recently-computed `JuryPackage`, per §Process step 3 below. This is a read-time projection of F5/F6/F13's existing data, not a new computation or new business rule.

**Sub-features:**
- Full exhibit list for the case with current status, offering party, and witness association
- Integrated search/filter bar (F4)
- Jury Package eligibility column per row (`Included` / `Not eligible` / `Blocked`)
- Inline discrepancy flag indicators per exhibit row (F6)
- Row-level drill-through to Exhibit Detail View (F10)

**Process:**
1. On load (no search criteria active), the client calls `getExhibits(caseId)`, which internally applies role-based visibility (excluding sealed/ex-parte exhibits per role) and returns every visible exhibit joined with its `ExhibitCurrentState` and any `OPEN`/`ACKNOWLEDGED` `DiscrepancyFlag` rows.
2. Each row renders: exhibit label, description (truncated), offering party, associated witness, current status badge (F1 visual convention), current custodian name (F3), a discrepancy indicator icon if any flag exists for that exhibit, and the new Jury Package eligibility badge (step 3).
3. **Jury Package eligibility column (added Phase 8):** `getExhibits` is amended to additionally left-join each exhibit against the case's most-recently-computed `JuryPackage`'s `JuryPackageExhibit` rows (F5/F13) and derive one of three values per exhibit, in this precedence:
   - **`Included`** — a `JuryPackageExhibit` row exists with `status = 'INCLUDED'` AND `discrepancyStatus = 'CLEAN'`.
   - **`Blocked`** — a `JuryPackageExhibit` row exists with `status = 'INCLUDED'` AND `discrepancyStatus = 'FLAGGED'` (i.e., the exhibit is a package member but has an open discrepancy preventing finalization, per F5 §Process step 6).
   - **`Not eligible`** — every other case: no `JuryPackageExhibit` row exists for this exhibit at all (not yet admitted, not yet computed into any package, or structurally excluded — `classification != 'TRIAL'`), **or** a row exists with `status = 'EXCLUDED'` (F13's sealed/ex-parte or manual-removal remediation). This column does not distinguish *why* an exhibit is not eligible — it answers only "is it in the current package, and is it clean" — a user who needs the reason drills into Exhibit Detail (F10)'s Jury Package checklist card for the itemized breakdown.
4. If no `JuryPackage` has ever been computed for the case (Phase 3's "no package started yet" empty state, F11), every exhibit's eligibility column reads `Not eligible` — this is expected behavior, not a defect; initiating package computation (F5 §Process step 1) from the Jury Package Workspace populates this column for every subsequently-admitted-and-clean exhibit.
5. When the user enters search criteria, the client calls `searchExhibits` (F4) instead of `getExhibits`, replacing the rendered list with filtered results while preserving the same row rendering, including the eligibility column.
6. Clicking any exhibit row navigates to `/exhibit/:id`, the Exhibit Detail View (F10), passing the `exhibitId`.
7. The screen polls `getExhibits`/`searchExhibits` on the same live-sync interval as F8 (3–5s) so status/custody/discrepancy/eligibility changes recorded by another user — including via a jury-package computation, finalization, or exclusion action — appear without manual refresh.

**Inputs:**
- `caseId` (string/UUID, required, from session)
- `requestingUserRole` (enum, required, from session)
- Search criteria (optional, per F4 §Inputs) when the search bar is active

**Outputs:**
- Exhibit row list: `{ exhibitId, exhibitLabel, description, offeringParty, associatedWitness, currentStatus, currentCustodianName, discrepancyFlags[], juryPackageEligibility: 'INCLUDED' | 'NOT_ELIGIBLE' | 'BLOCKED' }` *(amended Phase 8: `juryPackageEligibility` added)*

**Validation:**
- No write operations originate from this screen directly — all mutations (status change, objection, ruling, custody transfer) happen via dedicated action flows that call F1/F2/F3 endpoints, kept outside this screen's core list-rendering responsibility per the PRD's "assistant, not data-entry system" positioning
- Sealed/ex-parte exhibits never appear in this screen's list for a role outside the visibility set (`00-header.md` §Role-Based Visibility) — not shown as redacted rows, simply absent
- `juryPackageEligibility` must always be computed from the case's single most-recently-computed `JuryPackage` — never from a stale or cached package reference, and never independently re-derived by this screen outside the precedence rule in §Process step 3 (which mirrors, and must never diverge from, what the Jury Package Workspace itself shows for the same exhibit, F11)

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| Case not found / no access | 404 | CASE_NOT_FOUND | "No case found with the given ID" |
| Underlying exhibit list query failure | 500 | CASE_WORKSPACE_LOAD_FAILED | "Unable to load case exhibits — please retry" |

**API Surface (this feature):** see `Y1-api.md` §Exhibits for `GET /api/cases/:id/exhibits` (amended: `juryPackageEligibility` added) and §Search for `GET /api/cases/:id/exhibits/search` (F4, same amendment).

**Schema Surface (this feature):** read-only against `Exhibit`, `ExhibitCurrentState`, `CustodyCurrentState`, `DiscrepancyFlag`, `JuryPackage`, `JuryPackageExhibit` *(amended Phase 8: now also reads `JuryPackage`/`JuryPackageExhibit`)* — see `Y0-schema.md`. Introduces no new tables or fields.
