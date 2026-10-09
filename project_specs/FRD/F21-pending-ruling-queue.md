## F21: Pending-Ruling Queue

**Description:** A new judge-facing read view listing every currently-`UNRESOLVED` objection thread case-wide, sorted longest-waiting-first by elapsed time since `raisedAt`, so a judge can immediately see which objections have been waiting longest rather than discovering them exhibit-by-exhibit. Having checked `Y1-api.md`'s existing `GET /api/cases/:id/objections?status=unresolved` endpoint and `Y0-schema.md`'s `ObjectionCurrentState` shape, **`raisedAt` is already present on every row** — this feature therefore requires **no new endpoint and no new service function**. It reuses F02's existing `getUnresolvedObjections(caseId)` unchanged at the data layer, with exactly one additive read-time amendment (an `exhibitLabel` join, to avoid a client-side N+1 lookup) and a new client-side screen that sorts and live-updates the existing response.

**Terminology:**
- **Elapsed Wait Time:** `now() - ObjectionCurrentState.raisedAt`, computed client-side at render time and recomputed on each live-sync tick, exactly matching the Command Center's existing freshness-indicator recomputation pattern (F08, `Y3-integrations.md` §Live Multi-Screen Sync) — not a stored or server-computed value, since "now" is only meaningful at render time.

**Sub-features:**
- Judge-facing screen listing every case-wide `UNRESOLVED` objection thread
- Default sort: elapsed wait time descending (longest-waiting first) — computed and applied client-side against the existing endpoint's response
- Each row: exhibit label, objecting party, grounds, elapsed time (live-updating)
- Entries link directly into the existing ruling-recording action (F02) and into the Exhibit Detail View (F10)
- One additive backend amendment: `getUnresolvedObjections` now includes `exhibitLabel` in its response (read-time join), avoiding a second round-trip per row

**Process:**
1. A judge opens the new Pending-Ruling Queue screen (route restricted to `JUDGE` role per F20's permission matrix — other roles do not get a navigation entry point to this screen; the underlying `GET /api/cases/:id/objections?status=unresolved` endpoint itself remains readable by any role with case visibility, consistent with every other read endpoint in the system, since this is a read-only view and F20's matrix governs writes).
2. The client calls the existing `GET /api/cases/:id/objections?status=unresolved` endpoint (F02) — no new route.
3. The service layer's `getUnresolvedObjections(caseId)` function is amended to join `Exhibit.exhibitLabel` into each returned row (read-time join, same pattern as F14's existing `justification` read-time join from `acknowledgedEventId` — no schema change, see F14 §Outputs for the precedent).
4. The client receives the array of `ObjectionCurrentState` rows (each now including `exhibitLabel`, `objectingParty`, `grounds`, `raisedAt`) and sorts it client-side by `raisedAt` ascending (oldest `raisedAt` = longest elapsed = displayed first).
5. The client recomputes each row's elapsed-time display on every live-sync poll tick (reusing the existing `useUnresolvedObjections` polling hook, F08/`Y3-integrations.md` §Live Multi-Screen Sync — no new hook, no new polling interval), so the queue's ordering and displayed wait times stay current without a manual refresh, matching the Command Center's established freshness pattern.
6. Each row renders a link into the existing ruling-recording action (`POST /api/objections/:id/ruling`, F02) and a link into the Exhibit Detail View (`GET /api/exhibits/:id/history`, F10) for full context — both existing endpoints, unchanged.
7. When a ruling is recorded against a thread (via this screen's link, or from any other screen), the thread's `ObjectionCurrentState.status` leaves `UNRESOLVED` (F02 §Process step 6); on the queue's next poll, that row no longer appears in `getUnresolvedObjections`'s result set and disappears from the queue — no special-case removal logic is needed, since the queue is a live, unfiltered-further view of the same case-wide unresolved set every other screen reads.

**Inputs:**
- `caseId` (string/UUID, required): identical input to the existing F02 endpoint — no new inputs

**Outputs:**
- `Array<ObjectionCurrentState & { exhibitLabel: string }>` — the existing F02 response shape, additively widened with `exhibitLabel`. No other field changes.

**Validation:**
- No new validation rules — this feature performs no write of its own; it reuses F02's existing read path and validation unchanged
- The `exhibitLabel` join must never fail silently if an `ObjectionCurrentState` row's `exhibitId` does not resolve to an exhibit the requesting role may view — in that case the row is omitted entirely (same 404-style masking principle as every other sealed/role-restricted read, `00-header.md` §Role-Based Visibility), not rendered with a blank or placeholder label

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| (No new error states — reuses F02's existing `GET /api/cases/:id/objections` error handling unchanged) | — | — | See `F02-objection-ruling-tracking.md` §Error States |

**API Surface (this feature):** amends the response shape of the existing `GET /api/cases/:id/objections?status=unresolved` endpoint (F2) to additively include `exhibitLabel` per row — see `Y1-api.md` §Objections (amended). No new endpoint.

**Schema Surface (this feature):** none. Reads existing `ObjectionCurrentState` and `Exhibit.exhibitLabel` via an additive read-time join — see `Y0-schema.md` §Current-State Projections (unchanged).
