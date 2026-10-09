## F15: Courtroom Usability Fixes

**Description:** A cluster of interface clarity and consistency fixes identified during review of the shipped milestone, covering the Case Workspace, Pivota Assistant, app header, and activity feed. Each fix is a client-rendering correction against data the service layer already returns correctly — none requires a change to an API contract or the database schema — making the product behave the way a courtroom user would expect without additional explanation, per the PRD's "assistant, not system to learn" positioning.

**Terminology:**
- (none beyond `00-header.md` shared terminology and terms already defined in F07, F08, F09)

**Sub-features:**
- Case Workspace exhibit rows fully clickable through to Exhibit Detail View (fixes a regression against the already-specified F09 §Process step 4 behavior)
- Assistant example/suggested-question prompts reference the case's actual exhibit-label scheme
- The header's unlabeled numeric element is either clearly labeled or removed
- Activity feed entries display full date-and-time, not time-only
- Activity feed entries display the exhibit's label on every row, including raw state-transition rows

**Process:**
1. **Case Workspace row clickability (fixes F09 §Process step 4):** the entire row rendered by the Case Workspace exhibit table (F9) — the full row container, not only a nested link, icon, or label span — is clickable and navigates to `/exhibit/:id` (Exhibit Detail View, F10). The clickable hit area covers the complete row, includes a visible hover affordance, and supports keyboard/focus activation (Enter or Space navigates when the row has focus), matching the click-to-navigate pattern already used by the Command Center's activity feed (F8).
2. **Assistant example prompts (amends F7's example-chip rendering):** the example/suggested-question chips shown in the Pivota Assistant panel are generated using the case's actual exhibit-label scheme as produced by seed data (offering-party-prefixed labels, e.g., `P-1` for a `PLAINTIFF` exhibit, `D-4` for a `DEFENSE` exhibit, and the sealed/other convention in use for sealed exhibits, e.g., `S-2`) — for example, "Is P-1 in the jury package?" — rather than a mismatched placeholder numeric scheme (e.g., "Exhibit 14," "Exhibit 7") that does not correspond to any exhibit actually present in the seeded case.
3. Example prompts are sourced from (or validated at render time against) the active case's actual seeded `exhibitLabel` values via the existing `getExhibits` service function (F0/F9) — not hardcoded independently of seed data — so that if the seed data's labeling convention changes in the future, the example prompts cannot silently drift out of sync with it again.
4. **Header unlabeled element:** the numeric element currently rendered near the role selector in the shared app header (used across F8, F9, F10, F11) is evaluated for user-facing purpose. If it serves a real function (e.g., a discrepancy or notification count), it is given a visible label or an accessible tooltip/`aria-label` explaining what the number represents. If it serves no current user-facing function, it is removed entirely from the header rendering. "Present and unexplained" is not an acceptable end state for either case.
5. **Activity feed date+time (amends F8's recentActivity rendering):** every activity-feed entry — Command Center's `recentActivity` rows (F8) and any other screen rendering `ExhibitEvent`-derived rows in a similar feed format (e.g., F10's timeline) — renders both the date and the time of `recordedAt` (e.g., "Oct 8, 2026, 2:14:03 PM"), never time-only, so that two events recorded on different days, or events spanning a day boundary, are never visually indistinguishable to a reader scanning the feed.
6. **Activity feed exhibit label (amends F8's recentActivity rendering):** every activity-feed row — including rows describing a raw state transition (`STATUS_CHANGE` events) — displays the exhibit's label as part of the row's rendered summary (e.g., "P-1: MARKED → OFFERED" rather than a summary with no exhibit identified). This uses the `exhibitLabel` field that is already present in F8's `GET /api/cases/:id/activity` response shape (`Y1-api.md` §Command Center, unchanged) — the fix is entirely in the row-rendering/summary-formatting logic, since the field was already being returned by the API but was not being consistently rendered for every event-type row.

**Inputs:** No new user-supplied inputs. Existing session-derived inputs (`caseId`, `requestingUserRole`) are unchanged across all five fixes.

**Outputs:**
- Items 1, 4, 5, 6: no new data outputs — existing API/service responses are unchanged; only client-side rendering changes.
- Items 2–3: a client-rendered list of example-question strings composed from the active case's currently seeded `exhibitLabel` values (via the existing `getExhibits` call) rather than static hardcoded text.

**Validation:**
- No exhibit row anywhere in the Case Workspace table may be non-clickable — a row with zero discrepancy flags and a row with one or more flags must both be fully, identically clickable across their entire row area
- No activity-feed row (Command Center or Exhibit Detail timeline) may render a summary string without that event's associated `exhibitLabel`, for any `eventType` value, including `STATUS_CHANGE`
- No activity-feed row may render a time-only timestamp — the date must always be present in the same rendered string
- Example assistant prompts must never reference an `exhibitLabel` value that does not exist among the current case's seeded `Exhibit` rows — verified at minimum by an automated test comparing rendered chip text against seeded labels
- The header's numeric element must either carry a visible label/accessible tooltip or not be rendered at all

**Error States:**
No new error codes are introduced by this feature. All five sub-fixes are client-rendering/UX corrections layered on top of existing, already-passing service-layer responses (F7, F8, F9). Any underlying data-fetch failure continues to surface the existing load-failure codes unchanged:

| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| Case Workspace data fetch fails (row-click fix has no data to act on) | 500 | CASE_WORKSPACE_LOAD_FAILED | "Unable to load case exhibits — please retry" *(per F9, unchanged)* |
| Activity feed data fetch fails (date/label fixes have no data to act on) | 500 | COMMAND_CENTER_LOAD_FAILED | "Unable to load trial activity — please retry" *(per F8, unchanged)* |
| Assistant unreachable (example prompts still render from last-known exhibit list) | 503 | ASSISTANT_UNAVAILABLE | "The assistant is temporarily unavailable — please try again" *(per F7, unchanged)* |

**API Surface (this feature):** no new endpoints and no response-shape changes. Reuses `GET /api/cases/:id/exhibits` (F9), `GET /api/cases/:id/activity` (F8 — `exhibitLabel` field already present and unchanged), and the assistant's existing example-prompt rendering path (F7). See `Y1-api.md` §Exhibits, §Command Center, §Assistant.

**Schema Surface (this feature):** no schema changes. This feature touches only client-side rendering logic against data the service layer already returns correctly per `Y0-schema.md`.
