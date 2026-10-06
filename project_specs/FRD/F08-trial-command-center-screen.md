## F08: Trial Command Center Screen

**Description:** A high-level, ambient live view of trial/exhibit activity designed for a judge or deputy to glance at during proceedings without configuring or drilling into anything. This screen is read-only, renders no business logic of its own, and composes multiple existing service-layer queries.

**Terminology:**
- **Ambient View:** A passive-monitoring screen intentionally free of configuration controls, filters-as-default-state, or data-entry affordances — glance-and-go, not a dashboard to be tuned.

**Sub-features:**
- Live-updating summary of recent exhibit activity (recent status changes, pending objections, recent rulings)
- At-a-glance count/list of outstanding discrepancies
- Polling-based live refresh so the screen reflects changes recorded elsewhere without manual reload

**Process:**
1. On load, the client calls three existing service-layer-backed endpoints: `getRecentActivity(caseId, { since })`, `getUnresolvedObjections(caseId)` (F2), and `getDiscrepancies(caseId)` (F6).
2. `getRecentActivity` queries the `ExhibitEvent` ledger for the case, filtered to events within a rolling recent window (default: current trial day), ordered by `recordedAt` descending, joined to exhibit labels for display.
3. The client renders three ambient panels: "Recent Activity" (status/objection/ruling/custody events), "Unresolved Objections" (count + list), "Discrepancies" (count + list, linking to F9/F11 for action).
4. The client polls all three endpoints on a fixed interval (3–5 seconds, see `Y3-integrations.md` §Live Sync) so that a status change recorded by a deputy on the Case Workspace screen (F9) appears on an open Command Center screen without manual refresh.
5. No panel on this screen accepts input beyond a "view full details" link-through to F9/F10/F11 — this screen never writes to the ledger.

**Inputs:**
- `caseId` (string/UUID, required, from session)
- `requestingUserRole` (enum, required, from session): applies role-based visibility to all three underlying queries identically to every other screen
- `since` (ISO 8601 datetime, optional, default: start of current trial day): bounds the "recent activity" window

**Outputs:**
- `recentActivity[]`: `{ eventId, eventType, exhibitId, exhibitLabel, summary, recordedAt }`
- `unresolvedObjections[]`: per F2 output shape
- `discrepancies[]`: per F6 output shape

**Validation:**
- This screen issues no write requests — any validation rules live entirely in the underlying F1/F2/F3/F6 service functions it calls
- `since`, if supplied, must be a valid ISO 8601 datetime not in the future

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| Invalid `since` parameter | 422 | VALIDATION_ERROR | "since must be a valid past or present datetime" |
| Underlying service query failure (any of the three) | 500 | COMMAND_CENTER_LOAD_FAILED | "Unable to load trial activity — please retry" |

**API Surface (this feature):** see `Y1-api.md` §Command Center for `GET /api/cases/:id/activity`. Also composes `GET /api/cases/:id/objections?status=unresolved` (F2) and `GET /api/cases/:id/discrepancies` (F6).

**Schema Surface (this feature):** read-only against `ExhibitEvent`, `ObjectionCurrentState`, `DiscrepancyFlag` — see `Y0-schema.md`. Introduces no new tables.
