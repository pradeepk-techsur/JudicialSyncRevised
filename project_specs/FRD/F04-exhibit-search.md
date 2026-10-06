## F04: Exhibit Search

**Description:** Enables fast, combinable lookup of exhibits by ID, description/keyword, status, witness, or date, surfaced both in the Case Workspace UI (F9) and as an assistant tool (F7), so any authorized user can locate relevant evidence without scanning the full case exhibit list.

**Terminology:**
- **Search Criteria:** The combinable filter set — `exhibitId`, `keyword`, `status`, `witness`, `dateFrom`/`dateTo` (filtering against the exhibit's most recent relevant event timestamp).

**Sub-features:**
- Keyword search across exhibit label, description, and source
- Filter by current status (reads `ExhibitCurrentState`)
- Filter by associated witness
- Filter by date range (filters on `ExhibitEvent.recordedAt` for the relevant event type, e.g., "admitted yesterday" filters `STATUS_CHANGE` events where `toStatus = ADMITTED`)
- Filters are combinable (AND semantics) in a single query

**Process:**
1. A user enters search criteria in the Case Workspace search bar (F9), or the assistant resolves a natural-language question (e.g., "admitted exhibits from witness Smith") into equivalent structured criteria for its `searchExhibits` tool call.
2. The client (or assistant tool wrapper) calls `searchExhibits({ caseId, keyword?, status?, witness?, dateFrom?, dateTo? })`.
3. The service layer applies role-based visibility filtering first (excluding sealed exhibits per `00-header.md` §Role-Based Visibility for the requesting user's role), then applies the supplied criteria as an AND-combined query across `Exhibit` and `ExhibitCurrentState`.
4. Results are returned ordered by `exhibitLabel` ascending by default (configurable sort is out of scope for the demo).
5. If `dateFrom`/`dateTo` is supplied without a specific event-type hint, the search defaults to filtering on the most recent `STATUS_CHANGE` event per exhibit (i.e., "changed within this range"), matching the named demo question "admitted yesterday" when combined with `status = ADMITTED`.

**Inputs:**
- `caseId` (string/UUID, required)
- `keyword` (string, optional): matched against `exhibitLabel`, `description`, `source` (case-insensitive substring match)
- `status` (enum, optional): one of the F1 status values
- `witness` (string, optional): exact or substring match against `associatedWitness`
- `dateFrom` (ISO 8601 datetime, optional)
- `dateTo` (ISO 8601 datetime, optional)
- `requestingUserRole` (enum, required, derived from session): used for visibility filtering, not a user-supplied filter

**Outputs:**
- Array of matching exhibits, each including identity fields plus the current-state summary (`currentStatus`, `currentCustodian`, open discrepancy flags) needed for Case Workspace row rendering without a second round-trip

**Validation:**
- At least one search criterion must be supplied (an empty search request returns a 422 rather than silently returning the full case list — the full list is a separate `getExhibits(caseId)` call used by F9's default view)
- `dateFrom` must be ≤ `dateTo` when both are supplied
- `status`, if supplied, must be a valid F1 status enum value

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| No search criteria supplied | 422 | EMPTY_SEARCH_CRITERIA | "At least one search criterion is required" |
| dateFrom after dateTo | 422 | INVALID_DATE_RANGE | "dateFrom must not be after dateTo" |
| Invalid status filter value | 422 | VALIDATION_ERROR | "status must be a valid exhibit status value" |

**API Surface (this feature):** see `Y1-api.md` §Search for `GET /api/cases/:id/exhibits/search`.

**Schema Surface (this feature):** read-only against `Exhibit`, `ExhibitCurrentState`, `ExhibitEvent` — see `Y0-schema.md` §Core Entities, §Current-State Projections. Introduces no new tables.
