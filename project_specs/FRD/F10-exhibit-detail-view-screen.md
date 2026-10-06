## F10: Exhibit Detail View Screen

**Description:** The full history for a single exhibit — every status change, objection, ruling, and custody transfer — presented as a chronological timeline reconstructed directly from the event ledger. This screen answers "what happened to this exhibit" without assembling fragments from multiple sources, directly supporting the named demo scenario of the same description.

**Terminology:**
- **Timeline Entry:** One rendered row corresponding to exactly one `ExhibitEvent` row, in `sequence_no` order.

**Sub-features:**
- Chronological timeline of all ledger events for the exhibit
- Current status, current custodian, and active discrepancy flags shown prominently above the timeline
- Each timeline entry displays actor, timestamp, and plain-language summary (no raw enum/JSON exposure, per PITFALLS.md §UX Pitfalls)

**Process:**
1. On load, the client calls `getExhibitHistory(exhibitId)`, which checks role-based visibility first (403/404 per §Validation below if the exhibit is sealed and the role is unauthorized), then returns the exhibit's identity fields, its full ordered `ExhibitEvent` list, current `ExhibitCurrentState`, current `CustodyCurrentState`, and any `DiscrepancyFlag` rows.
2. The header area renders: exhibit label, description, offering party, associated witness, current status badge, current custodian name, and discrepancy indicators (if any) with a link-through to the acknowledgment flow (F6) if the viewing role is authorized to acknowledge.
3. The timeline area renders one entry per `ExhibitEvent`, oldest-first (or newest-first, implementation's choice, but consistently applied), each translated from its `eventType` + `payload` into a plain-language sentence (e.g., "Status changed from Offered to Admitted" rather than exposing `STATUS_CHANGE` / `fromStatus` / `toStatus` raw).
4. Every timeline entry is independently citable — this is the same `getExhibitHistory` function the assistant's `getExhibitHistory` tool (F7) calls, so an assistant answer to "what happened to Exhibit 14" and this screen's rendered timeline are guaranteed to show identical events.
5. The screen polls `getExhibitHistory` on the standard live-sync interval so a custody transfer recorded elsewhere appears in the open timeline without manual refresh.

**Inputs:**
- `exhibitId` (string/UUID, required, from route param)
- `requestingUserRole` (enum, required, from session)

**Outputs:**
- Exhibit header: identity fields + `currentStatus` + `currentCustodianName` + `discrepancyFlags[]`
- `timeline[]`: `{ eventId, eventType, summary, actorName, recordedAt }`, one entry per ledger event, each carrying its own `eventId` for citation-parity verification with the assistant

**Validation:**
- If the exhibit is sealed and the requesting role is outside the visibility set, the screen must behave as if the exhibit does not exist (404), not as a 403 revealing its existence, consistent with F7's decline behavior
- The timeline must render every `ExhibitEvent` row for the exhibit with no filtering/truncation — "full history" means complete, not "recent N events"

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| Exhibit not found | 404 | EXHIBIT_NOT_FOUND | "No exhibit found with the given ID" |
| Sealed exhibit, unauthorized role | 404 | EXHIBIT_NOT_FOUND | "No exhibit found with the given ID" *(identical message — existence is not revealed)* |
| Timeline query failure | 500 | EXHIBIT_DETAIL_LOAD_FAILED | "Unable to load exhibit history — please retry" |

**API Surface (this feature):** see `Y1-api.md` §Exhibits for `GET /api/exhibits/:id/history`.

**Schema Surface (this feature):** read-only against `Exhibit`, `ExhibitEvent`, `ExhibitCurrentState`, `CustodyCurrentState`, `ObjectionCurrentState`, `DiscrepancyFlag` — see `Y0-schema.md`. Introduces no new tables.
