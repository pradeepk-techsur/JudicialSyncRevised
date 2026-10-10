## F09: Case Workspace Screen

**Description:** The case-level screen listing all exhibits, parties, and current statuses in one place — the primary browsing and searching surface for the full exhibit set, now also the primary surface for triaging exhibits by jury-package eligibility at a glance, and the entry point into an individual Exhibit Detail View (F10).

**Terminology:**
- **Jury Package Eligibility:** A per-exhibit derived state — `INCLUDED` / `BLOCKED` / `NOT_ELIGIBLE` / `NOT_YET_EVALUATED` *(fourth value added Phase 9 — see §Process step 3)* — computed from the exhibit's membership (or absence) in the case's most-recently-computed `JuryPackage`, per §Process step 3 below. This is a read-time projection of F5/F6/F13's existing data, not a new computation or new business rule.
- **NOT_YET_EVALUATED** *(Phase 9)*: The eligibility value for an exhibit that has never been run through jury-package candidate computation — distinct from `NOT_ELIGIBLE`, which Phase 9 narrows to mean a *permanent, structural* exclusion (sealed/ex-parte classification, or explicitly `EXCLUDED` from a package). Prior to Phase 9, both cases were folded into a single `NOT_ELIGIBLE` value; Phase 9 splits them because "not yet assessed" and "structurally excluded" are materially different facts a user needs distinguished.

**Sub-features:**
- Full exhibit list for the case with current status, offering party, and witness association
- Integrated search/filter bar (F4)
- Jury Package eligibility column per row (`Included` / `Not eligible` / `Blocked`)
- Inline discrepancy flag indicators per exhibit row (F6)
- Row-level drill-through to Exhibit Detail View (F10)

**Process:**
1. On load (no search criteria active), the client calls `getExhibits(caseId)`, which internally applies role-based visibility (excluding sealed/ex-parte exhibits per role) and returns every visible exhibit joined with its `ExhibitCurrentState` and any `OPEN`/`ACKNOWLEDGED` `DiscrepancyFlag` rows.
2. Each row renders: exhibit label, description (truncated), offering party, associated witness, current status badge (F1 visual convention), current custodian name (F3), a discrepancy indicator icon if any flag exists for that exhibit, and the new Jury Package eligibility badge (step 3).
3. **Jury Package eligibility column (added Phase 8; precedence amended Phase 9 to four values):** `getExhibits` is amended to additionally left-join each exhibit against the case's most-recently-computed `JuryPackage`'s `JuryPackageExhibit` rows (F5/F13) and derive one of four values per exhibit, in this precedence:
   - **`INCLUDED`** — a `JuryPackageExhibit` row exists with `status = 'INCLUDED'` AND `discrepancyStatus = 'CLEAN'`.
   - **`BLOCKED`** — a `JuryPackageExhibit` row exists with `status = 'INCLUDED'` AND `discrepancyStatus = 'FLAGGED'` (i.e., the exhibit is a package member but has an open discrepancy preventing finalization, per F5 §Process step 6).
   - **`NOT_ELIGIBLE`** *(narrowed Phase 9 — see below)* — a *structural, permanent* exclusion: a `JuryPackageExhibit` row exists with `status = 'EXCLUDED'` (F13's sealed/ex-parte or manual-removal remediation), **or** the exhibit's `classification != 'TRIAL'`. No future package computation changes this value for this exhibit.
   - **`NOT_YET_EVALUATED`** *(new Phase 9)* — every other case: no `JuryPackageExhibit` row exists for this exhibit at all. This covers (a) the exhibit's `currentStatus` is not yet `ADMITTED`, (b) the exhibit is `ADMITTED` but no `JuryPackage` has ever been computed for the case, and (c) the exhibit was admitted after the most-recently-computed package's computation timestamp and so has never itself been run through `computeJuryCandidates`. Prior to Phase 9 this entire bucket was folded into `NOT_ELIGIBLE`; Phase 9 splits it out specifically because a user triaging the workspace needs to distinguish "this will never be eligible" from "this just hasn't been assessed yet."
   - This column does not distinguish, beyond the four values above, *exactly which* condition produced `BLOCKED` or `NOT_ELIGIBLE` — a user who needs the itemized reason drills into Exhibit Detail (F10)'s Jury Package checklist card for the full breakdown.
4. **UI rendering of `NOT_YET_EVALUATED` (Phase 9):** for any exhibit whose `currentStatus` is not `ADMITTED`, the Case Workspace renders **no eligibility tag at all** — the service still computes and returns `NOT_YET_EVALUATED` for these rows (per the "derived values stay server-side" principle — the value is never withheld or recomputed client-side), but the UI suppresses rendering it specifically for not-yet-admitted exhibits, since an eligibility tag on an exhibit that hasn't even been offered is noise, not signal. For an `ADMITTED` exhibit that has simply never been run through package computation (no `JuryPackage` ever computed for the case, or computed before this exhibit was admitted), the Case Workspace **does** render a visible `NOT_YET_EVALUATED` tag — this is the corrected replacement for Phase 8's behavior, where every such exhibit incorrectly read `Not eligible` regardless of its actual admission state. Initiating package computation (F5 §Process step 1) from the Jury Package Workspace subsequently resolves every then-admitted-and-clean exhibit's tag to `INCLUDED` or `BLOCKED` as appropriate.
5. When the user enters search criteria, the client calls `searchExhibits` (F4) instead of `getExhibits`, replacing the rendered list with filtered results while preserving the same row rendering, including the eligibility column.
6. Clicking any exhibit row navigates to `/exhibit/:id`, the Exhibit Detail View (F10), passing the `exhibitId`.
7. The screen polls `getExhibits`/`searchExhibits` on the same live-sync interval as F8 (3–5s) so status/custody/discrepancy/eligibility changes recorded by another user — including via a jury-package computation, finalization, or exclusion action — appear without manual refresh.

**Inputs:**
- `caseId` (string/UUID, required, from session)
- `requestingUserRole` (enum, required, from session)
- Search criteria (optional, per F4 §Inputs) when the search bar is active

**Outputs:**
- Exhibit row list: `{ exhibitId, exhibitLabel, description, offeringParty, associatedWitness, currentStatus, currentCustodianName, discrepancyFlags[], juryPackageEligibility: 'INCLUDED' | 'BLOCKED' | 'NOT_ELIGIBLE' | 'NOT_YET_EVALUATED' }` *(added Phase 8; `NOT_YET_EVALUATED` value added Phase 9 — see §Process steps 3–4)*

**Validation:**
- No write operations originate from this screen directly — all mutations (status change, objection, ruling, custody transfer) happen via dedicated action flows that call F1/F2/F3 endpoints, kept outside this screen's core list-rendering responsibility per the PRD's "assistant, not data-entry system" positioning
- Sealed/ex-parte exhibits never appear in this screen's list for a role outside the visibility set (`00-header.md` §Role-Based Visibility) — not shown as redacted rows, simply absent
- `juryPackageEligibility` must always be computed from the case's single most-recently-computed `JuryPackage` — never from a stale or cached package reference, and never independently re-derived by this screen outside the precedence rule in §Process step 3 (which mirrors, and must never diverge from, what the Jury Package Workspace itself shows for the same exhibit, F11)
- *(Phase 9)* The four-value precedence (`INCLUDED` > `BLOCKED` > `NOT_ELIGIBLE` > `NOT_YET_EVALUATED`) must be computed identically, from the identical underlying query, across **every** surface that returns a per-exhibit eligibility value: `getExhibits` (this feature, unfiltered list), `searchExhibits` (F4, filtered list), and `getExhibitHistory`'s `juryPackageChecklist.eligibility` field (F10, single-exhibit checklist). No surface may diverge — e.g., F10's checklist showing `BLOCKED` while F9's list shows `NOT_YET_EVALUATED` for the same exhibit at the same moment is a defect, not an acceptable timing artifact
- *(Phase 9)* `NOT_ELIGIBLE` must never be returned for an exhibit solely because it has not yet been run through package computation — that case is always `NOT_YET_EVALUATED`. `NOT_ELIGIBLE` is reserved exclusively for a structural exclusion (`EXCLUDED` package-exhibit row, or `classification != 'TRIAL'`) that no future package computation will reverse for that exhibit

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| Case not found / no access | 404 | CASE_NOT_FOUND | "No case found with the given ID" |
| Underlying exhibit list query failure | 500 | CASE_WORKSPACE_LOAD_FAILED | "Unable to load case exhibits — please retry" |

**API Surface (this feature):** see `Y1-api.md` §Exhibits for `GET /api/cases/:id/exhibits` (amended Phase 8: `juryPackageEligibility` added; amended Phase 9: value set extended to include `NOT_YET_EVALUATED`) and §Search for `GET /api/cases/:id/exhibits/search` (F4, same amendment). The Phase 9 value addition is purely additive to an existing field's type and introduces no new error code.

**Schema Surface (this feature):** read-only against `Exhibit`, `ExhibitCurrentState`, `CustodyCurrentState`, `DiscrepancyFlag`, `JuryPackage`, `JuryPackageExhibit` *(amended Phase 8: now also reads `JuryPackage`/`JuryPackageExhibit`)* — see `Y0-schema.md`. Introduces no new tables or fields; Phase 9's `NOT_YET_EVALUATED` value is a TypeScript union addition computed at read time, not a database enum or column change.
