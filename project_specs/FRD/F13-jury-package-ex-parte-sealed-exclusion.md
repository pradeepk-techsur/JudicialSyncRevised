## F13: Jury Package Ex Parte / Sealed Exclusion

**Description:** A hard structural exclusion ensuring that any exhibit flagged sealed/ex-parte (`Exhibit.isSealed = true`, see F00 §Terminology) can never be eligible for, included as, or displayed as "clean" within a jury package — regardless of its admission status. This exclusion is evaluated independently of, and prior to, F6's discrepancy-flag engine: a sealed exhibit is never passed into discrepancy evaluation for jury-package purposes at all, so it can never acquire a `CLEAN` discrepancy status. This is the highest-severity gap this product closes — sealed/ex-parte material reaching a jury package is the single most damaging failure mode in this domain, and this feature exists specifically to prevent its recurrence.

**Terminology:**
- **Hard Exclusion:** A filter applied at the jury-candidate query itself (not a later UI hide, not a discrepancy flag) — a sealed exhibit's row is never created as an `INCLUDED` `JuryPackageExhibit` via the normal computation path.
- **Exclusion Event:** An auditable ledger event (`JURY_PACKAGE_EXHIBIT_EXCLUDED`) recording the removal of an exhibit from a jury package, whether triggered automatically by the sealed-filter or manually by an authorized user via the remediation action described below.
- **Remediation Action:** The UI-visible "Remove from Package" control available on any jury-package row where `exhibit.isSealed = true` happens to be present (e.g., legacy/regression data computed before this fix, or any future edge case), allowing an authorized user to explicitly excise it.

**Sub-features:**
- `computeJuryCandidates` (F5) excludes `isSealed = true` exhibits at the query level, before the `ADMITTED`-status filter and before F6's discrepancy evaluation ever run
- Any jury-package row where the underlying exhibit is sealed is rendered with a distinct high-visibility warning state, never as `CLEAN` or `FLAGGED`
- An authorized user (`DEPUTY`, `CLERK`, or `ADMIN`) can explicitly exclude such a row from the package, recorded as an immutable, auditable ledger event
- Excluded rows are retained (not deleted) for audit history, never again surfaced as included/eligible
- Regression test coverage specifically exercising the originating defect (a sealed chambers sidebar note marked `ADMITTED` appearing jury-eligible)

**Process:**
1. `computeJuryCandidates(caseId)` (F5 §Process step 1) is amended so its candidate query reads `ExhibitCurrentState WHERE currentStatus = 'ADMITTED' AND exhibit.isSealed = false` — the sealed filter is applied in the *same* query as the admitted-status filter, not as a subsequent filtering pass, guaranteeing a sealed exhibit's row is never created in `JuryPackageExhibit` by the normal computation path.
2. This filter runs before F6's `evaluateDiscrepancies` is ever called for a candidate (F5 §Process step 2) — a sealed exhibit is never passed into the discrepancy engine for jury-package purposes, so it can never be assigned `CLEAN` or `FLAGGED`; it is simply absent from the candidate set entirely.
3. For any `JuryPackageExhibit` row that is nonetheless present for a sealed exhibit (e.g., computed before this fix shipped, or any other future edge case), the Jury Package Workspace (F11) renders a distinct, high-visibility warning state for that row — explicitly labeled (e.g., "Sealed material — must be removed") — instead of either `CLEAN` or `FLAGGED`, so it is never mistaken for a normal discrepancy-free row.
4. An authorized user (role `DEPUTY`, `CLERK`, or `ADMIN` — identical role gate to F5's finalize action, see F05 §Validation) triggers the "Remove from Package" remediation action on that row.
5. The service layer appends a `JURY_PACKAGE_EXHIBIT_EXCLUDED` ledger event (`payload: { juryPackageId, exhibitId, reason: 'SEALED_EXPARTE', note? }`, `actorUserId`) and updates the corresponding `JuryPackageExhibit` row's `status` to `EXCLUDED`, setting `excludedAt`, `excludedBy`, and `exclusionReason` — the row is retained, never deleted, preserving a complete audit trail of what was in the package and when/why it was removed.
6. An `EXCLUDED` row is never rendered as part of the active/included exhibit list on F11, never counted toward finalization eligibility, and never returned by the assistant's `getJuryPackageStatus` tool (F7) as an included exhibit.
7. Finalization (F05 §Process steps 5–7) is unaffected by `EXCLUDED` rows — only rows with `status = 'INCLUDED'` are evaluated against the discrepancy gate at finalization time; an `EXCLUDED` row cannot block or participate in finalization either way.
8. Regression coverage: the seed loader's existing sealed-exhibit edge case (per F00 §Process step 5 and Phase 2's sealed-visibility work) is extended to include at least one sealed exhibit marked `ADMITTED`, and an automated test asserts this exhibit never appears in `computeJuryCandidates`'s result set, is never rendered as `CLEAN` on F11, and is never returned by `getJuryPackageStatus` as an eligible/included exhibit.

**Inputs — Exclusion action:**
- `juryPackageId` (string/UUID, required)
- `exhibitId` (string/UUID, required): must correspond to a currently `INCLUDED` `JuryPackageExhibit` row in the given package
- `actorUserId` (string/UUID, required): must be role `DEPUTY`, `CLERK`, or `ADMIN`
- `reason` (enum: `SEALED_EXPARTE` | `MANUAL_REMOVAL`, required): `SEALED_EXPARTE` is the reason this feature exercises; `MANUAL_REMOVAL` is reserved for any other future manual-removal need and is not otherwise triggered by this feature
- `note` (string, optional, max 300 chars): free-text context stored in the event payload

**Outputs:**
- Updated `JuryPackageExhibit` row: `{ exhibitId, status: 'EXCLUDED', excludedAt, excludedBy, exclusionReason }`
- The created `ExhibitEvent` row (`JURY_PACKAGE_EXHIBIT_EXCLUDED`), with `id` for citation/audit
- `GET /api/cases/:id/jury-package` (F5) responses: only `INCLUDED` rows appear in the active exhibit list; `EXCLUDED` rows are omitted from that list (retained in the database for audit, not surfaced as a default read)

**Validation:**
- `isSealed = true` exhibits are excluded at the candidate-query level — this is not a post-hoc filter and not a UI-only hide; a sealed admitted exhibit must never acquire an `INCLUDED` `JuryPackageExhibit` row via the normal computation path
- The exclusion remediation action is available only for a `JuryPackageExhibit` row currently `status = 'INCLUDED'` belonging to a `DRAFT` package — a `FINALIZED` package's rows are immutable (per F05 §Validation) and cannot be excluded via this action after finalization
- `actorUserId` role must be `DEPUTY`, `CLERK`, or `ADMIN` — identical to F5's finalize role gate (`JUDGE`, `CHAMBERS_STAFF`, `ATTORNEY` may view the warning state but not perform the removal)
- This exclusion takes precedence over and is evaluated independently of F6's `discrepancyStatus` — a sealed exhibit's row, if present due to legacy/regression data, never shows `CLEAN` regardless of what its discrepancy flags' state is
- Re-running `computeJuryCandidates` for the same case never re-adds a previously `EXCLUDED` sealed exhibit as a new `INCLUDED` row — the sealed filter is permanent at the source query, not a one-time cleanup pass

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| Exclusion attempted on a row not currently `INCLUDED` (or no such row exists) | 404 | JURY_PACKAGE_EXHIBIT_NOT_FOUND | "No included exhibit found in this jury package with the given ID" |
| Exclusion attempted on a `FINALIZED` package | 409 | JURY_PACKAGE_ALREADY_FINALIZED | "This jury package has already been finalized" *(per F5)* |
| Non-authorized role attempts exclusion | 403 | ROLE_NOT_PERMITTED | "Only courtroom deputy, clerk, or admin roles may remove an exhibit from a jury package" |

**API Surface (this feature):** new endpoint `POST /api/jury-package/:id/exhibits/:exhibitId/exclude` — see `Y1-api.md` §Jury Package Exclusion. Also amends the candidate computation behind `POST /api/cases/:id/jury-package` (F5) to apply the `isSealed` filter at the query level.

**Schema Surface (this feature):** extends `JuryPackageExhibit` with `status` (new enum `JuryPackageExhibitStatus`: `INCLUDED` | `EXCLUDED`), `excludedAt`, `excludedBy`, `exclusionReason`; adds `JURY_PACKAGE_EXHIBIT_EXCLUDED` to the `EventType` enum — see `Y0-schema.md` §Jury Package (amended).
