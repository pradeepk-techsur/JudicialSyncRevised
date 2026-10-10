## F01: Exhibit Status Display

**Description:** Provides the at-a-glance current lifecycle status of any exhibit, derived entirely from the event ledger's `STATUS_CHANGE` events rather than any mutable field. Status is guaranteed identical across every screen and the assistant because all consumers read the same `ExhibitCurrentState` projection.

**Terminology:**
- **Admission Lifecycle:** The ordered set of statuses an exhibit moves through: `MARKED` → `OFFERED` → `OBJECTED` → (`ADMITTED` | `EXCLUDED` | `WITHDRAWN`).
- **Status Transition:** A single `STATUS_CHANGE` event moving an exhibit from one lifecycle status to the next (or to a terminal status).
- **StatusBadge Component** *(Phase 9)*: The single component (`components/StatusBadge.tsx`) that owns the status→Carbon-Tag-type/icon color mapping for all six admission-lifecycle statuses — the sole source of truth every status-rendering surface must import from rather than re-implement.
- **AttentionFeedTier** *(Phase 9, cross-referenced from F08)*: One of `CRITICAL`/`HIGH`/`PENDING`/`MEDIUM`, a severity scale distinct from exhibit status. Phase 9 gives this scale its own centralized color-token mapping, defined here to keep both token standards traceable from one feature.

**Sub-features:**
- Recording a status transition (append-only)
- Deriving and serving current status from the projection
- Consistent visual status indicator shared across Command Center (F8), Case Workspace (F9), Exhibit Detail (F10), and Jury Package (F11)
- *(Phase 9)* Single `StatusBadge` component owns the status-color/icon token mapping — consumed, not re-implemented, by the Command Center legend, Case Workspace pills/filters, Exhibit Detail header/timeline, and any status-distribution chart segment
- *(Phase 9)* A separate, equally centralized color-token mapping for the four `AttentionFeedTier` severities (F08), using Carbon's support-error/support-warning/support-info tokens, independently verified for AA contrast (4.5:1) via automated axe checks — never conflated with the six-status mapping above

**Process:**
1. A courtroom deputy or clerk records a status transition via the UI (or, in the demo, the seed loader does so programmatically).
2. The API route validates the request and calls `recordEvent({ exhibitId, eventType: 'STATUS_CHANGE', payload: { fromStatus, toStatus }, actorUserId })`.
3. The service layer validates that `fromStatus` matches the exhibit's current derived status before accepting the transition (prevents out-of-order writes from two simultaneous clients).
4. The service layer appends the `ExhibitEvent` row (immutable, with `sequence_no` and `recorded_at`).
5. The service layer synchronously updates `ExhibitCurrentState.currentStatus`, `lastStatusEventId`, and `lastStatusAt` for that exhibit.
6. Any open UI screen polling the exhibit (or case) endpoint receives the updated status on its next poll cycle (3–5s interval, see `Y3-integrations.md` §Live Sync).
7. The Pivota Assistant, when asked about this exhibit's status, calls the identical `getExhibitStatus(exhibitId)` service function and so returns the same value with a citation to `lastStatusEventId`.
8. **(Phase 9) Design-token single source of truth:** `StatusBadge` (`components/StatusBadge.tsx`) is the only place a status→Carbon-Tag-type/icon mapping may be defined. Every consumer — the Command Center legend, Case Workspace status pills, Case Workspace status filter options, any status-distribution chart segment coloring, and the Exhibit Detail header/timeline status rendering — imports and renders through this one component/map; none may define its own color/icon logic or a parallel lookup table. A second, independently defined mapping (in the same file or an adjacent `AttentionTierBadge` component) covers the four `AttentionFeedTier` severities (`CRITICAL`/`HIGH`/`PENDING`/`MEDIUM`, F08) using Carbon's support-error/support-warning/support-info tokens; this mapping is verified for AA contrast (4.5:1) via automated axe checks and must never share a color/hue family with the six-status mapping, since status and attention-tier are deliberately distinct scales that must never be visually conflated.

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
- *(Phase 9)* No screen or component may render a status badge, pill, filter option, or chart segment using a locally-defined color/icon mapping — every such rendering must resolve through `StatusBadge`'s shared map; a status appearing with two different colors/icons across screens is a defect, not a styling preference
- *(Phase 9)* The attention-tier color mapping (`CRITICAL`/`HIGH`/`PENDING`/`MEDIUM`) must be visually and token-wise distinct from the six-status mapping — no shared hue reused across both scales
- *(Phase 9)* Service-reported tier/status ordering is authoritative; no consumer may re-sort status or attention-tier entries independently of the order the service returns — this applies to both F01's own status transitions and the attention feed (F08) this status-display convention feeds into

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

**API Surface (this feature):** see `Y1-api.md` §Status for `POST /api/exhibits/:id/events/status`, `GET /api/exhibits/:id/status`. The Phase 9 design-token standard introduces no API changes — it is a client-side component/token consolidation only.

**Schema Surface (this feature):** writes `ExhibitEvent` (type `STATUS_CHANGE`); maintains `ExhibitCurrentState` — see `Y0-schema.md` §Event Ledger, §Current-State Projections. The Phase 9 design-token standard introduces no schema changes.
