## F01: Exhibit Status Display

**Description:** Provides the at-a-glance current lifecycle status of any exhibit, derived entirely from the event ledger's `STATUS_CHANGE` events rather than any mutable field. Status is guaranteed identical across every screen and the assistant because all consumers read the same `ExhibitCurrentState` projection.

**Terminology:**
- **Admission Lifecycle:** The ordered set of statuses an exhibit moves through: `MARKED` → `OFFERED` → `OBJECTED` → (`ADMITTED` | `EXCLUDED` | `WITHDRAWN`).
- **Status Transition:** A single `STATUS_CHANGE` event moving an exhibit from one lifecycle status to the next (or to a terminal status).

**Sub-features:**
- Recording a status transition (append-only)
- Deriving and serving current status from the projection
- Consistent visual status indicator shared across Command Center (F8), Case Workspace (F9), Exhibit Detail (F10), and Jury Package (F11)

**Process:**
1. A courtroom deputy or clerk records a status transition via the UI (or, in the demo, the seed loader does so programmatically).
2. The API route validates the request and calls `recordEvent({ exhibitId, eventType: 'STATUS_CHANGE', payload: { fromStatus, toStatus }, actorUserId })`.
3. The service layer validates that `fromStatus` matches the exhibit's current derived status before accepting the transition (prevents out-of-order writes from two simultaneous clients).
4. The service layer appends the `ExhibitEvent` row (immutable, with `sequence_no` and `recorded_at`).
5. The service layer synchronously updates `ExhibitCurrentState.currentStatus`, `lastStatusEventId`, and `lastStatusAt` for that exhibit.
6. Any open UI screen polling the exhibit (or case) endpoint receives the updated status on its next poll cycle (3–5s interval, see `Y3-integrations.md` §Live Sync).
7. The Pivota Assistant, when asked about this exhibit's status, calls the identical `getExhibitStatus(exhibitId)` service function and so returns the same value with a citation to `lastStatusEventId`.

**Inputs:**
- `exhibitId` (string/UUID, required)
- `toStatus` (enum: `MARKED` | `OFFERED` | `OBJECTED` | `ADMITTED` | `EXCLUDED` | `WITHDRAWN`, required)
- `actorUserId` (string/UUID, required): the user recording the transition
- `notes` (string, optional): free-text context stored in the event payload

**Outputs:**
- Updated `ExhibitCurrentState` row: `{ exhibitId, currentStatus, lastStatusEventId, lastStatusAt }`
- The newly created `ExhibitEvent` row (returned to the caller for immediate UI feedback, including its `id` for citation use)

**Validation:**
- `toStatus` must be a valid forward transition from the exhibit's current status per the admission-lifecycle state machine (see table below) — invalid/backward transitions are rejected, not silently coerced
- An exhibit with zero prior `STATUS_CHANGE` events only accepts `toStatus = MARKED` as its first transition
- `OBJECTED` is a valid status only while at least one `ObjectionCurrentState` row for the exhibit is `UNRESOLVED` (cross-checked against F2's projection)
- Terminal statuses (`ADMITTED`, `EXCLUDED`, `WITHDRAWN`) reject any further `STATUS_CHANGE` event — once terminal, status is final for the demo's scope (re-opening an admitted exhibit is out of scope)

**Allowed Transitions:**
| From | To |
|---|---|
| (none) | MARKED |
| MARKED | OFFERED |
| OFFERED | OBJECTED, ADMITTED, WITHDRAWN |
| OBJECTED | ADMITTED, EXCLUDED, WITHDRAWN |

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| Invalid transition (e.g., MARKED → ADMITTED) | 422 | INVALID_STATUS_TRANSITION | "Cannot transition from {fromStatus} to {toStatus}" |
| Transition attempted on terminal status | 409 | STATUS_FINALIZED | "Exhibit status is final and cannot be changed" |
| Concurrent write conflict (stale fromStatus) | 409 | STATUS_CONFLICT | "Exhibit status has changed since this view was loaded — refresh and retry" |
| Exhibit not found | 404 | EXHIBIT_NOT_FOUND | "No exhibit found with the given ID" |

**API Surface (this feature):** see `Y1-api.md` §Status for `POST /api/exhibits/:id/events/status`, `GET /api/exhibits/:id/status`.

**Schema Surface (this feature):** writes `ExhibitEvent` (type `STATUS_CHANGE`); maintains `ExhibitCurrentState` — see `Y0-schema.md` §Event Ledger, §Current-State Projections.
