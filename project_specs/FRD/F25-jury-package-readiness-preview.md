## F25: Jury Package Readiness Preview (Read-Only)

**Description:** A new, read-only capability letting any authorized user — including a `JUDGE`, who cannot start or finalize a package (F5, F11, F20) — see which admitted exhibits are ready for the jury package and which are currently blocked, without creating or mutating any `JuryPackage` record. This closes the gap where readiness information was only visible by actually starting a draft package (F11), which a non-starting role cannot do. The preview reuses F5/F6/F13's existing candidate/discrepancy-eligibility computation logic exactly as-is — it introduces no new eligibility rule and no reimplementation of that logic in the route handler or client component.

**Terminology:**
- **Readiness Preview:** The read-only, non-mutating view this feature exposes — a point-in-time snapshot of which admitted exhibits would be ready if a jury package were computed right now, and which would be blocked and why. Distinct from a `JuryPackage`/`JuryPackageExhibit` row: viewing a preview creates nothing.
- **Blocker (preview context):** One specific reason an admitted exhibit is not currently ready — `UNRESOLVED_OBJECTION`, `NO_CUSTODIAN`, or `SEALED_EXPARTE` — each corresponding to an existing F5/F6/F13 eligibility rule, not a new rule invented for this feature.

**Sub-features:**
- New read-only preview function in `services/juryPackage.ts` that reuses the existing candidate/discrepancy-eligibility logic (F5, F6, F13) without performing any write — no `JuryPackage` row is created or modified by viewing the preview
- Exposed via a new, dedicated API route separate from the existing draft-start (`POST /api/cases/:id/jury-package`) and finalize (`POST /api/jury-package/:id/finalize`) endpoints
- Rendered for every role on the Jury Package Workspace (F11) prior to, or independent of, any package being started; `JUDGE` and other non-starting roles see the identical panel, presented identically read-only for every role (there is no "preview with actions" variant)
- Lists every currently `ADMITTED` exhibit visible to the requesting role and, for each, whether it is ready or — if not — which specific blocker(s) apply, using the same eligibility computation the draft/finalize path uses

**Process:**
1. The Jury Package Workspace (F11) links to this preview from its empty state (F11 §Process step 11) and remains available alongside the normal Draft/Finalized views regardless of package state.
2. On open, the client calls `GET /api/cases/:id/jury-package/preview` (new), which invokes a new service function `getJuryPackageReadinessPreview(caseId, requestingUserRole)`.
3. `getJuryPackageReadinessPreview` queries every exhibit with `currentStatus = 'ADMITTED'` that is visible to the requesting role under standard role-based visibility (`00-header.md` §Role-Based Visibility) — a sealed/ex-parte exhibit the role cannot see at all is omitted from the list entirely, never shown as a masked or blocked row, consistent with the 404-masking principle applied elsewhere in the product.
4. For each visible admitted exhibit, the function evaluates the identical checks `computeJuryCandidates` (F5) and the discrepancy rules (F6) and the classification exclusion (F13) already apply — it calls those existing functions/predicates directly rather than re-deriving the logic:
   - **Ready:** zero `UNRESOLVED` objection threads, a custodian of record exists, and `classification = 'TRIAL'`.
   - **Blocked — `UNRESOLVED_OBJECTION`:** at least one `UNRESOLVED` `ObjectionCurrentState` row exists for the exhibit (same condition F12/F6 already check).
   - **Blocked — `NO_CUSTODIAN`:** no `CustodyCurrentState` row exists for the exhibit (same condition F6/F12 already check).
   - **Blocked — `SEALED_EXPARTE`:** `classification != 'TRIAL'` (same hard structural exclusion F13 already enforces). An exhibit can carry more than one blocker simultaneously (e.g., both `UNRESOLVED_OBJECTION` and `NO_CUSTODIAN`) — all applicable blockers are returned, not just the first found.
5. The function returns the full list plus a summary count (`totalAdmitted`, `readyCount`, `blockedCount`) — no pagination; the demo's exhibit-set scale does not require it (consistent with every other list endpoint in this product).
6. This call performs **no write** under any circumstance — no `JuryPackage` or `JuryPackageExhibit` row is created, updated, or referenced for computation purposes (the preview computes directly from `Exhibit`/`ExhibitCurrentState`/`ObjectionCurrentState`/`CustodyCurrentState`, not from any existing package's membership). Calling this endpoint any number of times produces zero new rows anywhere in the schema.
7. The screen polls this endpoint on the standard live-sync interval while visible, so a ruling, custody transfer, or reclassification recorded elsewhere updates the ready/blocked breakdown without manual refresh — identical polling behavior to every other read surface in the product.
8. No role is excluded from calling or viewing this route — unlike F5's compute/finalize endpoints, there is no `ROLE_NOT_PERMITTED` gate on this read path; `JUDGE`, `CHAMBERS_STAFF`, `ATTORNEY`, `DEPUTY`, `CLERK`, and `ADMIN` all receive the identical response shape for the same case, modulo standard role-based visibility masking (step 3).

**Inputs:**
- `caseId` (string/UUID, required, from session)
- `requestingUserRole` (enum, required, from session): applies standard role-based visibility masking to the admitted-exhibit list (step 3) but gates no part of the read itself — every role may call this endpoint

**Outputs:**
- `preview[]`: `Array<{ exhibitId, exhibitLabel, ready: boolean, blockers: Array<{ code: 'UNRESOLVED_OBJECTION' | 'NO_CUSTODIAN' | 'SEALED_EXPARTE', detail: string }> }>` — `blockers` is an empty array when `ready = true`; an exhibit may carry more than one blocker simultaneously
- `summary`: `{ totalAdmitted: number, readyCount: number, blockedCount: number }`

**Validation:**
- This function must never create or modify a `JuryPackage`/`JuryPackageExhibit` row — verified by a test asserting zero new rows in either table after any number of calls to this endpoint
- Eligibility/blocker logic must call the identical service-layer predicates F5 (`computeJuryCandidates`'s admission/custody/objection checks), F6 (discrepancy rule evaluation), and F13 (classification exclusion) already use — no reimplementation of any eligibility rule in this feature's route handler, service function, or client component
- No role-gating error applies to this read-only route — every role receives a `200` response for a valid `caseId`; only standard role-based visibility masking (omitting exhibits the role cannot see at all) applies, never a `403`
- A sealed/ex-parte exhibit the requesting role is not authorized to see at all must be omitted from `preview[]` entirely (not shown as a `SEALED_EXPARTE`-blocked row) — existence must not be revealed to an unauthorized role, consistent with the 404-masking principle (`Y2-errors.md` §Authorization/Visibility); a role that *is* authorized to see classified material (e.g., `ADMIN`) sees it listed with the `SEALED_EXPARTE` blocker, since F13's exclusion is independent of who is viewing it
- The preview never reflects or depends on any existing `JuryPackage`'s current membership — it is computed fresh from `Exhibit`/`ExhibitCurrentState`/`ObjectionCurrentState`/`CustodyCurrentState` on every call, so it remains accurate even when no package has ever been started (F11's empty-state use case)

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| Case not found / no access | 404 | CASE_NOT_FOUND | "No case found with the given ID" |
| Underlying preview computation failure | 500 | JURY_PACKAGE_PREVIEW_LOAD_FAILED | "Unable to load the jury package readiness preview — please retry" |

No `ROLE_NOT_PERMITTED` applies to this route (§Validation) — it is the one jury-package-adjacent endpoint with no role gate by design.

**API Surface (this feature):** see `Y1-api.md` §Jury Package for `GET /api/cases/:id/jury-package/preview` (new). This is a dedicated route, separate from `GET /api/cases/:id/jury-package` (F11/F5) and introduces no change to that existing endpoint's contract beyond what F11 §Process step 10 already documents.

**Schema Surface (this feature):** read-only against `Exhibit`, `ExhibitCurrentState`, `ObjectionCurrentState`, `CustodyCurrentState` — see `Y0-schema.md`. Introduces no new tables, columns, or enum values, and writes nothing to any table.
