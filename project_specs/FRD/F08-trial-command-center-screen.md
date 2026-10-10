## F08: Trial Command Center Screen

**Description:** A high-level, ambient live view of trial/exhibit activity designed for a judge or deputy to glance at during proceedings, extended in Phase 8 from a strictly passive monitoring surface into a screen that also surfaces per-status exhibit counts, a custody-by-custodian breakdown, and a severity-ranked "Needs your attention" feed with inline write actions (F24) at the exact point the system has already identified they are needed. **Note — supersedes a prior constraint:** Phase 5 locked in "the Command Center exposes no path to record, edit, or acknowledge anything from that screen — it is strictly passive/read-only monitoring" as a success criterion. Phase 8 deliberately reverses this for the two actions described below (§Sub-features, "Inline write actions"); this is a traceable product decision, not a regression, and every other panel on this screen remains read-only exactly as before.

**Terminology:**
- **Ambient View:** A passive-monitoring screen intentionally free of configuration controls or filters-as-default-state — glance-and-go, not a dashboard to be tuned. Still true of every panel on this screen except the attention feed's inline actions.
- **Severity Tier:** One of `CRITICAL` / `HIGH` / `PENDING` / `MEDIUM`, assigned to each "Needs your attention" entry per the fixed precedence rule in §Process step 5 below.
- **Attention Feed Entry:** One ranked item in the "Needs your attention" feed, sourced from exactly one of the four rule conditions in §Process step 5, each carrying enough context to render its applicable inline action (F24) directly.

**Sub-features:**
- Live-updating summary of recent exhibit activity (recent status changes, pending objections, recent rulings) — unchanged from Phase 5/7
- Per-status exhibit count stat cards: an immediate numeric breakdown of the case's exhibit set by lifecycle status (`MARKED`/`OFFERED`/`OBJECTED`/`ADMITTED`/`EXCLUDED`/`WITHDRAWN`)
- Status-distribution bar visualizing the same breakdown proportionally
- "Custody at a glance" panel: exhibits grouped by current custodian, so a deputy can see who holds what without visiting individual Exhibit Detail pages, including a distinct grouping for exhibits with a currently-pending (unconfirmed) custody transfer (F19)
- Prioritized "Needs your attention" feed, ranked `CRITICAL`/`HIGH`/`PENDING`/`MEDIUM`, newest-first within each tier
- Inline write actions directly on attention-feed entries — "Record ruling" and "Transfer custody"/"Assign custodian" (F24) — so a judge or deputy can resolve the flagged item without leaving the screen
- Jury package summary widget showing current draft/finalized package progress at a glance
- At-a-glance indicators of outstanding discrepancies

**Process:**
1. On load, the client calls the existing `getRecentActivity(caseId, { since })`, `getUnresolvedObjections(caseId)` (F2), and `getDiscrepancies(caseId)` (F6) endpoints, unchanged from Phase 5/7, plus two additions introduced this phase: `getCustodyByCustodian(caseId)` (new) and `getAttentionFeed(caseId)` (new).
2. **Per-status counts:** computed from the same case-wide exhibit/status data already available via `getExhibits(caseId)` (F9) — grouped by `ExhibitCurrentState.currentStatus` — and returned as an additive `statusCounts: Record<ExhibitStatus, number>` field on the existing `GET /api/cases/:id/activity` response (F8). No new endpoint is introduced for this surface, per the architectural preference to avoid redundant round-trips for data the service layer already computes elsewhere.
3. **Custody-by-custodian:** a new service function `getCustodyByCustodian(caseId)` queries `CustodyCurrentState` joined to `User` and `Exhibit`, grouped by `currentCustodianUserId`, and additionally surfaces exhibits with a non-null `pendingTransferToUserId` (F19) under a distinct "pending transfer to {name}" grouping rather than silently folding them into the current custodian's bucket. This did not exist as a service or endpoint before this phase.
4. **Needs-your-attention feed:** a new service function `getAttentionFeed(caseId)` evaluates four independent rule sources, each contributing zero or more entries:
   - **`CRITICAL` — Sealed/ex-parte blocker in jury package:** any `JuryPackageExhibit` row with `status = 'INCLUDED'` whose exhibit's `classification != 'TRIAL'` (a legacy/regression state — see `F13-jury-package-ex-parte-sealed-exclusion.md`). Action offered: link to the Jury Package Workspace's existing "Remove from Package" remediation (F13) — not a new inline action, since F13's exclusion action is itself already role-gated and this feed simply surfaces it sooner.
   - **`HIGH` — Admitted with open objection:** any exhibit with an `OPEN` `DiscrepancyFlag` of `ruleCode = 'UNRESOLVED_OBJECTION_JURY_ELIGIBLE'` (F6) — i.e., `currentStatus = 'ADMITTED'` with at least one `UNRESOLVED` objection thread, a state only reachable via legacy/pre-gate data per F12/F17. Action offered: inline "Record ruling" (F24) against the specific unresolved `objectionId`.
   - **`PENDING` — Pending ruling:** any objection thread with `ObjectionCurrentState.status = 'UNRESOLVED'` whose exhibit's `currentStatus` is `OFFERED` or `OBJECTED` (i.e., **not** already `ADMITTED` — that case is covered by the `HIGH` tier above, so no objection thread is ever counted in both tiers simultaneously). Action offered: inline "Record ruling" (F24).
   - **`MEDIUM` — Admitted, no custodian:** any exhibit with an `OPEN` `DiscrepancyFlag` of `ruleCode = 'ADMITTED_NO_CUSTODIAN'` (F6). Action offered: inline "Transfer custody"/"Assign custodian" (F24).
5. Within each tier, entries are sorted newest-first by the timestamp of the event that produced the underlying condition (`DiscrepancyFlag.detectedAt` for `HIGH`/`MEDIUM`/`CRITICAL`; `ObjectionCurrentState.raisedAt` for `PENDING`). Tiers themselves are never interleaved — every `CRITICAL` entry renders before any `HIGH` entry, and so on, exactly as named in the PRD's fixed precedence (`CRITICAL` > `HIGH` > `PENDING` > `MEDIUM`).
6. The client renders five ambient panels/widgets: "Recent Activity", per-status count cards + distribution bar, "Custody at a Glance", "Needs Your Attention" (with inline actions), and the Jury Package summary widget, plus the existing "Discrepancies" indicator.
7. The client polls all underlying endpoints on the existing fixed interval (3–5 seconds, `Y3-integrations.md` §Live Sync) so a status change, ruling, or custody transfer recorded anywhere — including via this screen's own inline actions (F24) — appears across every open screen without manual refresh.
8. Every panel on this screen except the attention feed's inline actions remains strictly read-only, exactly as Phase 5 established; a "view full details" link-through to F9/F10/F11 is the only other interaction any panel offers.
9. **(Phase 9) Objection grounds inline:** `getAttentionFeed`'s `HIGH` and `PENDING` tier entries (§Process step 4, both objection-scoped) additionally populate `objectionGrounds` — the associated `ObjectionCurrentState.grounds` value for that entry's `objectionId` — so the dense attention-feed DataTable can render why the item is flagged directly on the row, with no extra click-through. `objectionGrounds` is `null` for `CRITICAL` and `MEDIUM` tier entries, which are not tied to any single objection thread. This is an additive, read-time field only — the grounds value is already available from the same `ObjectionCurrentState` row the tier/`objectionId` computation already reads, so no new query is introduced — and it does not alter tier precedence, sort order, or any of the four rule conditions in step 4. The service's tier ordering remains authoritative; the DataTable renders rows in the exact order returned, never re-sorting independently (including never sorting by `objectionGrounds` text).

**Inputs:**
- `caseId` (string/UUID, required, from session)
- `requestingUserRole` (enum, required, from session): applies role-based visibility to all underlying queries identically to every other screen, and additionally governs which inline actions (F24) render on attention-feed entries
- `since` (ISO 8601 datetime, optional, default: start of current trial day): bounds the "recent activity" window, unchanged from Phase 5

**Outputs:**
- `recentActivity[]`: `{ eventId, eventType, exhibitId, exhibitLabel, summary, recordedAt }` — unchanged
- `statusCounts`: `Record<ExhibitStatus, number>` — new, additive field on the existing activity response
- `unresolvedObjections[]`, `discrepancies[]`: per F2/F6 output shapes, unchanged
- `custodyByCustodian[]`: `{ custodianUserId, custodianName, exhibits: Array<{ exhibitId, exhibitLabel, currentStatus }>, pendingTransfersIn: Array<{ exhibitId, exhibitLabel, proposedAt }> }` — new
- `attentionFeed[]`: `{ id, tier: 'CRITICAL'|'HIGH'|'PENDING'|'MEDIUM', ruleCode, exhibitId, exhibitLabel, objectionId?, objectionGrounds: string | null, detectedAt, summary, availableAction: 'RECORD_RULING'|'REMOVE_FROM_PACKAGE'|'TRANSFER_CUSTODY'|null }` — new; `availableAction` is `null` only for the `CRITICAL` tier's link-through case (§Process step 4), never for `HIGH`/`PENDING`/`MEDIUM`. `objectionGrounds` *(added Phase 9)* is non-null only for `HIGH`/`PENDING` tier entries (§Process step 9); it is `null` for `CRITICAL`/`MEDIUM` entries, which have no associated `objectionId`.

**Validation:**
- This screen issues no write requests of its own beyond the two inline actions wired up by F24 — every other panel's validation rules live entirely in the underlying F1/F2/F3/F6/F13 service functions it calls
- `since`, if supplied, must be a valid ISO 8601 datetime not in the future (unchanged)
- An objection thread must never be counted in both the `HIGH` and `PENDING` attention-feed tiers simultaneously (§Process step 4) — the exhibit's `currentStatus` at evaluation time is the sole disambiguator
- An inline action rendered on an attention-feed entry must resolve to the exact same server-side endpoint and validation F24 specifies — this screen introduces no parallel or abbreviated validation path
- *(Phase 9)* `objectionGrounds` must be `null` for any entry whose tier is `CRITICAL` or `MEDIUM` (§Process step 9) — it is populated only when the entry carries a specific `objectionId` (`HIGH`/`PENDING` tiers). The dense attention-feed DataTable must render entries in the exact service-returned order (tier precedence, then newest-first within tier per step 5) regardless of whether `objectionGrounds` is present — no client-side re-sort keyed on grounds text or any other field

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| Invalid `since` parameter | 422 | VALIDATION_ERROR | "since must be a valid past or present datetime" |
| Underlying service query failure (recent activity, objections, or discrepancies) | 500 | COMMAND_CENTER_LOAD_FAILED | "Unable to load trial activity — please retry" |
| `getCustodyByCustodian` query failure | 500 | COMMAND_CENTER_LOAD_FAILED | "Unable to load trial activity — please retry" *(same code — reuses the existing generic Command Center load failure; no new code introduced for this panel)* |
| `getAttentionFeed` query failure | 500 | ATTENTION_FEED_LOAD_FAILED | "Unable to load the attention feed — please retry" |
| Inline action (Record Ruling / Transfer Custody) failure | — | — | *(see `F24-write-action-ui-coverage.md` §Error States — unchanged from F02/F03/F19/F20)* |

**API Surface (this feature):** see `Y1-api.md` §Command Center for `GET /api/cases/:id/activity` (amended: `statusCounts` added), `GET /api/cases/:id/custody-by-custodian` (new), `GET /api/cases/:id/attention-feed` (amended Phase 9: `objectionGrounds` added to each entry — see §Process step 9). Also composes `GET /api/cases/:id/objections?status=unresolved` (F2) and `GET /api/cases/:id/discrepancies` (F6). Inline actions invoke F24's unchanged endpoints. The Phase 9 `objectionGrounds` addition introduces no new error code — it is a purely additive read-time field with no new rejection path.

**Schema Surface (this feature):** read-only against `ExhibitEvent`, `ExhibitCurrentState`, `ObjectionCurrentState`, `CustodyCurrentState`, `DiscrepancyFlag`, `JuryPackageExhibit` — see `Y0-schema.md`. Introduces no new tables or fields; `getCustodyByCustodian` and `getAttentionFeed` are new read-only aggregation functions over existing projections, not new schema.
