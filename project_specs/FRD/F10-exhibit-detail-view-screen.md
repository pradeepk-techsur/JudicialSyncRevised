## F10: Exhibit Detail View Screen

**Description:** The full history for a single exhibit — every status change, objection, ruling, and custody transfer — presented as a chronological timeline reconstructed directly from the event ledger. This screen answers "what happened to this exhibit" without assembling fragments from multiple sources, directly supporting the named demo scenario of the same description. As of Phase 8, the screen is paired with a right-rail of three actionable, at-a-glance cards (Objection, Chain of Custody, Jury Package checklist) and header-level write actions (F24), so a user can both understand and act on an exhibit's state from one screen.

**Terminology:**
- **Timeline Entry:** One rendered row corresponding to exactly one `ExhibitEvent` row, in `sequence_no` order.
- **Right Rail:** The three-card column (Objection / Chain of Custody / Jury Package checklist) rendered alongside the timeline, each reading a distinct slice of the same `getExhibitHistory` response — no card issues its own separate query.

**Sub-features:**
- Chronological timeline of all ledger events for the exhibit
- Current status, current custodian, and active discrepancy flags shown prominently above the timeline
- Each timeline entry displays actor, timestamp, and plain-language summary (no raw enum/JSON exposure, per PITFALLS.md §UX Pitfalls)
- Right-rail **Objection card**: the exhibit's unresolved objection thread(s), if any, each with an inline "Record ruling" action (F24, role-gated to `JUDGE`)
- Right-rail **Chain of Custody card**: current custodian (including a visibly distinct pending-transfer state per F19), plus the full transfer history at a glance
- Right-rail **Jury Package checklist card**: a per-condition breakdown of jury-package eligibility for this one exhibit (admission, objection resolution, custody completeness, classification) plus the exhibit's overall membership status (F9's `Included`/`Not eligible`/`Blocked`, computed identically here)
- Header-level "Transfer custody" action (F24, role-gated to `DEPUTY`/`CLERK`/`ADMIN`, or identity-gated to the named receiver when a transfer is pending)
- Header-level "Ask Pivota about {exhibitLabel}" action, opening the assistant (F7) pre-scoped to this exhibit

**Process:**
1. On load, the client calls `getExhibitHistory(exhibitId)`, which checks role-based visibility first (403/404 per §Validation below if the exhibit is sealed/ex-parte and the role is unauthorized), then returns the exhibit's identity fields, its full ordered `ExhibitEvent` list, current `ExhibitCurrentState`, current `CustodyCurrentState` (including F19's pending-transfer fields), any `DiscrepancyFlag` rows, every `ObjectionCurrentState` row for the exhibit (not only the most recent — F02 permits N concurrent threads), and the exhibit's jury-package checklist data (step 5 below).
2. The header area renders: exhibit label, description, offering party, associated witness, current status badge, current custodian name, discrepancy indicators (if any) with a link-through to the acknowledgment flow (F6) if the viewing role is authorized to acknowledge, and the two header-level actions ("Transfer custody", "Ask Pivota about {exhibitLabel}").
3. The timeline area renders one entry per `ExhibitEvent`, oldest-first (or newest-first, implementation's choice, but consistently applied), each translated from its `eventType` + `payload` into a plain-language sentence (e.g., "Status changed from Offered to Admitted" rather than exposing `STATUS_CHANGE` / `fromStatus` / `toStatus` raw).
4. **Objection card (added Phase 8):** renders every `ObjectionCurrentState` row for this exhibit with `status = 'UNRESOLVED'` — there may be zero, one, or several concurrently — each showing objecting party, grounds, and elapsed time since `raisedAt` (same live-recomputed pattern as F21's queue). Each row carries its own "Record ruling" inline action (F24), passing that row's specific `objectionId` as context — never ambiguous about which thread a ruling applies to. If zero unresolved threads exist, the card renders an explicit "No open objections" state, not an empty card.
5. **Chain of Custody card (added Phase 8):** renders the current custodian (or "No custodian of record" if `CustodyCurrentState` has no row — a pre-F18 legacy state), a visibly distinct "Pending transfer to {name} since {time}" banner when `pendingTransferToUserId` is non-null (F19), and the full ordered custody history (`getCustodyHistory`, F03/F19, including `PROPOSED`/`CONFIRMED`/`CANCELLED` events distinguished by type). This is the same underlying data F03's `getCustodian`/`getCustodyHistory` already serve — no new query, no new business logic, purely a dedicated card presentation of existing data.
6. **Jury Package checklist card (added Phase 8):** renders four per-exhibit condition checks — (a) `currentStatus = 'ADMITTED'`, (b) zero `UNRESOLVED` objection threads, (c) a custodian of record exists (`CustodyCurrentState` row present), (d) `classification = 'TRIAL'` — each shown as met/outstanding, plus the exhibit's overall eligibility badge computed by the identical precedence rule F9 §Process step 3 applies (`Included`/`Not eligible`/`Blocked`). This card is the itemized "why" that F9's single eligibility badge deliberately does not spell out at list-row scale.
7. Every timeline entry, and every right-rail card's underlying record, is independently citable — this is the same `getExhibitHistory` function the assistant's `getExhibitHistory` tool (F7) calls, so an assistant answer to "what happened to Exhibit 14" and this screen's rendered timeline/cards are guaranteed to show identical events and state.
8. The screen polls `getExhibitHistory` on the standard live-sync interval so a custody transfer, ruling, or status change recorded elsewhere — including via this screen's own F24 inline actions — appears in the open timeline and right rail without manual refresh.

**Inputs:**
- `exhibitId` (string/UUID, required, from route param)
- `requestingUserRole` (enum, required, from session): governs both sealed-visibility masking (unchanged) and which right-rail/header actions render (F24, F20)

**Outputs:**
- Exhibit header: identity fields + `currentStatus` + `currentCustodianName` + `discrepancyFlags[]`
- `timeline[]`: `{ eventId, eventType, summary, actorName, recordedAt }`, one entry per ledger event, each carrying its own `eventId` for citation-parity verification with the assistant
- `objections[]` *(added Phase 8)*: `Array<ObjectionCurrentState>` filtered to `status = 'UNRESOLVED'` for card rendering (the full set, resolved and unresolved, remains visible via the timeline, unchanged)
- `custodyCard` *(added Phase 8)*: `{ current: CustodyCurrentState | null, pendingTransfer: { toUserId, toName, proposedAt } | null, history: Array<{ fromCustodian, toCustodian, timestamp, reason, eventId, eventType }> }`
- `juryPackageChecklist` *(added Phase 8)*: `{ admitted: boolean, objectionsResolved: boolean, custodianOnRecord: boolean, classificationTrial: boolean, eligibility: 'INCLUDED' | 'NOT_ELIGIBLE' | 'BLOCKED' }`

**Validation:**
- If the exhibit is sealed/ex-parte and the requesting role is outside the visibility set, the screen must behave as if the exhibit does not exist (404), not as a 403 revealing its existence, consistent with F7's decline behavior — this applies identically to the right-rail cards, which never render for a masked exhibit
- The timeline must render every `ExhibitEvent` row for the exhibit with no filtering/truncation — "full history" means complete, not "recent N events"
- The Objection, Custody, and Jury Package checklist cards must derive their state from the same `getExhibitHistory` payload the timeline renders from — no card may issue an independent query that could diverge from the timeline's version of the same facts
- Header/card action controls (Record Ruling, Transfer Custody) must not render for a role the F20 matrix does not permit for that action (see `F24-write-action-ui-coverage.md` §Validation) — the server-side gate remains authoritative regardless

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| Exhibit not found | 404 | EXHIBIT_NOT_FOUND | "No exhibit found with the given ID" |
| Sealed/ex-parte exhibit, unauthorized role | 404 | EXHIBIT_NOT_FOUND | "No exhibit found with the given ID" *(identical message — existence is not revealed)* |
| Timeline/right-rail query failure | 500 | EXHIBIT_DETAIL_LOAD_FAILED | "Unable to load exhibit history — please retry" |
| Header/card inline action failure (Record Ruling / Transfer Custody) | — | — | *(see `F24-write-action-ui-coverage.md` §Error States — unchanged from F02/F03/F19/F20)* |

**API Surface (this feature):** see `Y1-api.md` §Exhibits for `GET /api/exhibits/:id/history` (amended: `objections[]`, `custodyCard`, `juryPackageChecklist` added). Right-rail actions invoke F24's unchanged endpoints.

**Schema Surface (this feature):** read-only against `Exhibit`, `ExhibitEvent`, `ExhibitCurrentState`, `CustodyCurrentState`, `ObjectionCurrentState`, `DiscrepancyFlag`, `JuryPackageExhibit` *(amended Phase 8: now also reads `JuryPackageExhibit` for the checklist card's eligibility badge)* — see `Y0-schema.md`. Introduces no new tables or fields.
