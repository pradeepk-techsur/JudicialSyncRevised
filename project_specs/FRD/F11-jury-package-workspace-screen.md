## F11: Jury Package Workspace Screen

**Description:** A curated, exportable workspace presenting the computed jury-eligible exhibit list (F5) alongside any discrepancy warnings, serving as the authoritative handoff view for jury package preparation. This screen is where the demo's "build a jury package" scenario plays out end-to-end, including the discrepancy gate blocking finalization. As of Phase 8, the draft view is restructured from a single flat table into a per-exhibit card layout grouped into Blockers/Clean sections with a visible progress indicator, and a role unable to finalize directly can request finalization from one who can, rather than hitting a disabled control with no path forward.

**Terminology:**
- **Blockers Section / Clean Section:** The two groupings the draft card layout organizes included exhibits into — `Blockers` for any `JuryPackageExhibit` with `discrepancyStatus = 'FLAGGED'`, `Clean` for `discrepancyStatus = 'CLEAN'`. Equivalent in substance to the prior single-table's discrepancy-warning-badge presentation, restructured for at-a-glance legibility.
- **Finalization Request:** A lightweight, auditable notification — not a write to any exhibit or ledger domain — recorded when a role without finalize authority (per F20) asks a role that has it to finalize the current draft. Carries only a timestamp and the requesting user; it confers no authority of its own and does not bypass F5's discrepancy gate.

**Sub-features:**
- Displays the current `JuryPackage` (draft or finalized) and its `JuryPackageExhibit` list
- Draft view presents each included exhibit as an individual card, grouped into **Blockers** and **Clean** sections, rather than a single flat table
- Progress indicator summarizing included-exhibit counts: total, Clean, Blocked
- Prominently surfaces discrepancy warnings per included exhibit (unchanged in substance, restructured in layout)
- Blocks the finalize action (disabled control, not just a rejected request) while open discrepancies remain among included exhibits
- **"Request finalization from Clerk"** action (new): available to a role permitted to view but not finalize (per F20 — e.g., `JUDGE`, `CHAMBERS_STAFF`, `ATTORNEY`), routing a notification to finalize-authorized roles rather than presenting a disabled control with no path forward
- Export/curated presentation view suitable for handoff once finalized

**Process:**
1. On load, the client calls `GET /api/cases/:id/jury-package` (F5), which returns the current `JuryPackage` (creating a fresh `DRAFT` via `computeJuryCandidates` if none exists yet for the case) along with each `JuryPackageExhibit`'s live discrepancy status, and — as of Phase 8 — the package's current `finalizationRequestedAt`/`finalizationRequestedBy`, if any (see §Process step 7).
2. **Card layout (added Phase 8):** the screen renders the package status (`DRAFT`/`FINALIZED`) and the progress indicator (`{clean} of {total} exhibits clean`) prominently at the top, then two sections below: **Blockers** (cards for every `discrepancyStatus = 'FLAGGED'` row) and **Clean** (cards for every `discrepancyStatus = 'CLEAN'` row). Each card shows exhibit label, status badge, and — for a Blockers card — the specific discrepancy detail (`ruleCode`, `details`) inline on the card face, not behind a secondary click. This replaces the prior single flat table; no underlying data or computation changes.
3. For any Blockers card, the user can navigate to that exhibit's F10 detail view to resolve the underlying issue (e.g., record a missing custody transfer, via F24's inline action) or, if authorized, acknowledge the discrepancy directly from this screen via the F6 acknowledgment action.
4. The "Finalize Jury Package" action control is disabled (not merely error-returning) whenever the Blockers section is non-empty (equivalent to the prior "count of `FLAGGED AND OPEN`" rule, restated for the card layout) — this is a UX affordance layered on top of, not a replacement for, the server-side gate in F5.
5. When finalization is attempted (control enabled, zero Blockers at render time), the client calls `POST /api/jury-package/:id/finalize` (F5), which re-validates server-side before committing. A successful finalize clears any outstanding `finalizationRequestedAt`/`finalizationRequestedBy` on the package (step 7) — the request is resolved by the finalization it led to.
6. On successful finalization, the screen switches to a read-only "Finalized" presentation suitable for export/handoff (print-friendly, downloadable view, or F23's generated PDF) and the exhibit list becomes immutable; the Blockers/Clean grouping is dropped in favor of a single final list (there can be no Blockers in a finalized package, by construction of F5's gate).
7. **Request finalization from Clerk (added Phase 8):** a user whose role is permitted to view this screen but is **not** in F20's finalize-authorized set (`DEPUTY`/`CLERK`/`ADMIN`) — i.e., `JUDGE`, `CHAMBERS_STAFF`, or `ATTORNEY` — sees "Request finalization from Clerk" in place of the (for them, never-actionable) "Finalize" control. On click, the client calls `POST /api/jury-package/:id/request-finalization` (`{ actorUserId }`, new), which sets `JuryPackage.finalizationRequestedAt = now()` and `finalizationRequestedBy = actorUserId` — overwriting any prior unresolved request for the same package (at most one outstanding request is tracked; no stacking/queueing). This does **not** finalize the package, bypass the discrepancy gate, or grant the requester any new authority — it is a notification only.
8. A finalize-authorized role (`DEPUTY`/`CLERK`/`ADMIN`) viewing the same `DRAFT` package while `finalizationRequestedAt` is non-null sees a visible banner — e.g., "Finalization requested by {requesterName} at {time}" — above the Finalize control, so the request is surfaced exactly where the action it asks for would be taken, not on a separate notifications page.
9. The screen polls the jury-package endpoint on the standard live-sync interval while in `DRAFT` state so that a concurrent custody fix, acknowledgment, or finalization request by another user updates the Blockers/Clean grouping and the request banner without manual refresh; polling stops once `FINALIZED` (immutable content needs no further refresh).

**Inputs:**
- `caseId` (string/UUID, required, from session)
- `requestingUserRole` (enum, required, from session): gates whether the "Finalize"/"Acknowledge" controls render as actionable (per F5 §Validation, F6 §Validation role checks) versus the new "Request finalization from Clerk" control renders instead (step 7)
- `actorUserId` (string/UUID, required, from session, for the request-finalization action only)

**Outputs:**
- Package header: `{ juryPackageId, status, createdAt, finalizedAt?, finalizedBy?, finalizationRequestedAt?, finalizationRequestedBy? }` *(amended Phase 8: `finalizationRequestedAt`/`finalizationRequestedBy` added)*
- Exhibit rows/cards: `{ exhibitId, exhibitLabel, currentStatus, discrepancyStatus, discrepancyDetails? }` — unchanged in shape; now additionally grouped client-side into `blockers[]`/`clean[]` for card rendering
- Progress summary: `{ total, cleanCount, blockedCount }`
- On blocked finalization attempt (if somehow triggered despite the disabled control, e.g., stale client state): the specific blocking discrepancies returned by F5, rendered as an inline error list
- On successful finalization request: `{ finalizationRequestedAt, finalizationRequestedBy }`

**Validation:**
- This screen never computes jury eligibility or discrepancy status itself — all computation happens server-side via F5/F6; the screen is a pure presentation + action-trigger layer, preventing any possibility of the screen showing a different "clean" state than the server would enforce
- A `FINALIZED` package's exhibit list is rendered as fully read-only — no acknowledge/resolve/remove controls are shown, consistent with F5's immutability rule
- "Request finalization from Clerk" is rendered only for a role **outside** F20's finalize-authorized set for this action; a `DEPUTY`/`CLERK`/`ADMIN` user — who can already finalize directly — never sees this control, and attempting the request endpoint as one of these roles is rejected server-side (§Error States)
- A finalization request is purely additive metadata on the `JuryPackage` row — it never blocks, gates, or substitutes for the server-side discrepancy check in F5; a package with zero Blockers can still be finalized by an authorized role whether or not a request is currently outstanding, and a package with open Blockers remains unfinalizable regardless of how many requests have been made

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| Finalize attempted with stale client state (server re-check fails) | 409 | JURY_PACKAGE_DISCREPANCIES_OPEN | "Cannot finalize: {n} exhibit(s) have unresolved discrepancies" *(per F5)* |
| Jury package load failure | 500 | JURY_PACKAGE_LOAD_FAILED | "Unable to load jury package — please retry" |
| Non-authorized role attempts finalize | 403 | ROLE_NOT_PERMITTED | "Only courtroom deputy, clerk, or admin roles may finalize a jury package" *(per F5)* |
| A finalize-authorized role (`DEPUTY`/`CLERK`/`ADMIN`) attempts to request finalization | 403 | ROLE_NOT_PERMITTED | "This role can finalize directly and does not need to request it" *(new, F11)* |
| Finalization requested on an already-`FINALIZED` package | 409 | JURY_PACKAGE_ALREADY_FINALIZED | "This jury package has already been finalized" *(per F5, unchanged)* |

**API Surface (this feature):** see `Y1-api.md` §Jury Package for `GET /api/cases/:id/jury-package` (amended: `finalizationRequestedAt`/`finalizationRequestedBy` added), `POST /api/jury-package/:id/finalize` (both defined in F5), `POST /api/jury-package/:id/request-finalization` (new), and §Discrepancies for `POST /api/discrepancies/:id/acknowledge` (F6).

**Schema Surface (this feature):** read-only against `JuryPackageExhibit`, `DiscrepancyFlag`; adds `finalizationRequestedAt` (nullable `DateTime`), `finalizationRequestedBy` (nullable `String`) to `JuryPackage` — see `Y0-schema.md` §Jury Package (amended).
