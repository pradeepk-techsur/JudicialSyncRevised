## F11: Jury Package Workspace Screen

**Description:** A curated, exportable workspace presenting the computed jury-eligible exhibit list (F5) alongside any discrepancy warnings, serving as the authoritative handoff view for jury package preparation. This screen is where the demo's "build a jury package" scenario plays out end-to-end, including the discrepancy gate blocking finalization.

**Terminology:**
- (none beyond `00-header.md` and F5/F6 shared terminology)

**Sub-features:**
- Displays the current `JuryPackage` (draft or finalized) and its `JuryPackageExhibit` list
- Prominently surfaces discrepancy warnings per included exhibit
- Blocks the finalize action (disabled control, not just a rejected request) while open discrepancies remain among included exhibits
- Export/curated presentation view suitable for handoff once finalized

**Process:**
1. On load, the client calls `GET /api/cases/:id/jury-package` (F5), which returns the current `JuryPackage` (creating a fresh `DRAFT` via `computeJuryCandidates` if none exists yet for the case) along with each `JuryPackageExhibit`'s live discrepancy status.
2. The screen renders the package status (`DRAFT`/`FINALIZED`) prominently at the top, with the exhibit list below — each row showing exhibit label, status badge, and a discrepancy warning badge if `discrepancyStatus = 'FLAGGED'`.
3. For any flagged row, the user can navigate to that exhibit's F10 detail view to resolve the underlying issue (e.g., record a missing custody transfer) or, if authorized, acknowledge the discrepancy directly from this screen via the F6 acknowledgment action.
4. The "Finalize Jury Package" action control is disabled (not merely error-returning) whenever the client-side computed count of exhibits with `discrepancyStatus = 'FLAGGED' AND status = 'OPEN'` is greater than zero — this is a UX affordance layered on top of, not a replacement for, the server-side gate in F5.
5. When finalization is attempted (control enabled, zero open discrepancies at render time), the client calls `POST /api/jury-package/:id/finalize` (F5), which re-validates server-side before committing.
6. On successful finalization, the screen switches to a read-only "Finalized" presentation suitable for export/handoff (e.g., print-friendly or downloadable view) and the exhibit list becomes immutable.
7. The screen polls the jury-package endpoint on the standard live-sync interval while in `DRAFT` state so that a concurrent custody fix or acknowledgment by another user updates the flagged-row count without manual refresh; polling stops once `FINALIZED` (immutable content needs no further refresh).

**Inputs:**
- `caseId` (string/UUID, required, from session)
- `requestingUserRole` (enum, required, from session): gates whether the "Finalize" and "Acknowledge" controls render as actionable (per F5 §Validation, F6 §Validation role checks) versus view-only

**Outputs:**
- Package header: `{ juryPackageId, status, createdAt, finalizedAt?, finalizedBy? }`
- Exhibit rows: `{ exhibitId, exhibitLabel, currentStatus, discrepancyStatus, discrepancyDetails? }`
- On blocked finalization attempt (if somehow triggered despite the disabled control, e.g., stale client state): the specific blocking discrepancies returned by F5, rendered as an inline error list

**Validation:**
- This screen never computes jury eligibility or discrepancy status itself — all computation happens server-side via F5/F6; the screen is a pure presentation + action-trigger layer, preventing any possibility of the screen showing a different "clean" state than the server would enforce
- A `FINALIZED` package's exhibit list is rendered as fully read-only — no acknowledge/resolve/remove controls are shown, consistent with F5's immutability rule

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| Finalize attempted with stale client state (server re-check fails) | 409 | JURY_PACKAGE_DISCREPANCIES_OPEN | "Cannot finalize: {n} exhibit(s) have unresolved discrepancies" *(per F5)* |
| Jury package load failure | 500 | JURY_PACKAGE_LOAD_FAILED | "Unable to load jury package — please retry" |
| Non-authorized role attempts finalize | 403 | ROLE_NOT_PERMITTED | "Only courtroom deputy, clerk, or admin roles may finalize a jury package" *(per F5)* |

**API Surface (this feature):** see `Y1-api.md` §Jury Package for `GET /api/cases/:id/jury-package`, `POST /api/jury-package/:id/finalize` (both defined in F5), and §Discrepancies for `POST /api/discrepancies/:id/acknowledge` (F6).

**Schema Surface (this feature):** read-only against `JuryPackage`, `JuryPackageExhibit`, `DiscrepancyFlag` — see `Y0-schema.md` §Jury Package, §Discrepancy Detection. Introduces no new tables.
