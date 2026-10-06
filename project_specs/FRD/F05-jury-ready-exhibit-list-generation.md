## F05: Jury-Ready Exhibit List Generation

**Description:** Computes the authoritative set of exhibits eligible for the jury package directly from the current-state projections, with discrepancy detection (F6) acting as a hard gate before any package can be finalized — detection runs before and blocks generation of a finalized package, it never follows it as a post-hoc check.

**Terminology:**
- **Jury-Eligible Exhibit:** An exhibit whose `currentStatus = ADMITTED`, with zero `OPEN` discrepancy flags.
- **Jury Package:** A named, stateful collection (`DRAFT` or `FINALIZED`) of exhibits assembled for jury handoff.

**Sub-features:**
- Compute the candidate jury-eligible exhibit set from current state
- Run discrepancy detection against the candidate set before allowing finalization
- Support package finalization only when zero open discrepancies remain among included exhibits
- Exportable/curated view for the Jury Package Workspace screen (F11)

**Process:**
1. A deputy/clerk initiates jury package preparation for the case; the service layer calls `computeJuryCandidates(caseId)`, which queries `ExhibitCurrentState WHERE currentStatus = 'ADMITTED'`.
2. For each candidate, the service layer calls `evaluateDiscrepancies(exhibitId)` (F6) — this is not optional and cannot be bypassed by any code path that creates or finalizes a `JuryPackage`.
3. The service layer creates (or updates) a `JuryPackage` row with `status = 'DRAFT'` and a `JuryPackageExhibit` row per candidate, each annotated with its current discrepancy status (`CLEAN` or `FLAGGED`) at computation time.
4. The deputy/clerk reviews flagged exhibits in the Jury Package Workspace (F11) and either resolves the underlying issue (e.g., records the missing custody transfer) or explicitly acknowledges the discrepancy via the F6 acknowledgment flow.
5. When the deputy/clerk requests finalization, the service layer re-runs `evaluateDiscrepancies` fresh (not from the cached `DRAFT`-time annotation) for every exhibit currently in the package.
6. If any included exhibit has a discrepancy with status `OPEN` (not `ACKNOWLEDGED` or `RESOLVED`), finalization is rejected outright — the package remains `DRAFT` and the blocking exhibits are returned to the caller.
7. If zero `OPEN` discrepancies remain among included exhibits, the service layer sets `JuryPackage.status = 'FINALIZED'`, `finalizedAt`, `finalizedBy`, and the package becomes read-only/exportable.
8. The assistant's `getJuryPackageStatus` tool (F7) queries the same `JuryPackage`/`JuryPackageExhibit` rows, so "is Exhibit 14 in the jury package" is answered identically to what F11 displays.

**Inputs:**
- `caseId` (string/UUID, required)
- `actorUserId` (string/UUID, required): must be role `DEPUTY`, `CLERK`, or `ADMIN` to initiate or finalize
- `acknowledgedDiscrepancyIds` (array of string/UUID, optional, used only at finalization): discrepancies the actor has explicitly acknowledged (see F6 §Process) prior to this finalization attempt

**Outputs:**
- `JuryPackage` record: `{ id, caseId, status, createdAt, finalizedAt?, finalizedBy? }`
- `JuryPackageExhibit[]`: each with `{ exhibitId, exhibitLabel, discrepancyStatus, addedAt }`
- On a blocked finalization attempt: the list of blocking `DiscrepancyFlag` records (id, exhibitId, ruleCode, details) so the UI can surface exactly what must be resolved

**Validation:**
- Only `ADMITTED` exhibits may ever appear in `JuryPackageExhibit` — the computation never includes `MARKED`, `OFFERED`, `OBJECTED`, `EXCLUDED`, or `WITHDRAWN` exhibits, with no manual override path
- Finalization is rejected if any included exhibit has a discrepancy with status `OPEN` at finalization time, even if it was `CLEAN` when the package was computed in step 3 (re-evaluation is mandatory, not cached)
- A `FINALIZED` package is immutable — no further `JuryPackageExhibit` rows may be added or removed; a new `DRAFT` package must be created for subsequent changes
- `actorUserId` role must be `DEPUTY`, `CLERK`, or `ADMIN` — a `JUDGE`, `CHAMBERS_STAFF`, or `ATTORNEY` role may view but not finalize (demo-level role enforcement)

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| Finalization attempted with open discrepancies | 409 | JURY_PACKAGE_DISCREPANCIES_OPEN | "Cannot finalize: {n} exhibit(s) have unresolved discrepancies" |
| Finalization attempted on already-FINALIZED package | 409 | JURY_PACKAGE_ALREADY_FINALIZED | "This jury package has already been finalized" |
| Non-authorized role attempts finalize | 403 | ROLE_NOT_PERMITTED | "Only courtroom deputy, clerk, or admin roles may finalize a jury package" |
| No admitted exhibits exist in the case | 422 | NO_ELIGIBLE_EXHIBITS | "No admitted exhibits are available to form a jury package" |

**API Surface (this feature):** see `Y1-api.md` §Jury Package for `POST /api/cases/:id/jury-package`, `GET /api/cases/:id/jury-package`, `POST /api/jury-package/:id/finalize`.

**Schema Surface (this feature):** owns `JuryPackage`, `JuryPackageExhibit`; reads `ExhibitCurrentState`, `DiscrepancyFlag` — see `Y0-schema.md` §Jury Package.
