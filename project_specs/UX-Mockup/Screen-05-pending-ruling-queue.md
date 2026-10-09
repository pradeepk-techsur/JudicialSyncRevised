### Screen: Pending-Ruling Queue

**Purpose:** A judge-only, read-mostly queue of every currently-`UNRESOLVED` objection thread case-wide, sorted longest-waiting-first, so a judge can triage by elapsed wait time instead of discovering unresolved objections exhibit-by-exhibit. New 6th screen added in Phase 7.1 — see `00-overview.md` §Scope Note for the decision record on why this is a dedicated screen rather than an extension of the Command Center's existing Unresolved Objections panel.
**User Stories:** US-21.1, US-21.2
**Journey:** JRN-01.2 (Check the Pending-Ruling Queue)
**Route:** `/pending-rulings` · **Nav:** Sidebar "Pending Rulings" — **rendered only when the active role is `JUDGE`**; the sidebar entry does not exist for any other role (absent, not disabled — see `Y0-patterns.md` §Pattern: Role-Gated Control Visibility). The underlying read endpoint (`GET /api/cases/:id/objections?status=unresolved`) remains readable by any role with case visibility, consistent with every other read endpoint in the system — the UI simply never gives a non-judge role a path to this screen.

#### Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ JudicialSync  [Case: 2026-CR-0142 ▾] [⚠ 1] [Role: Judge ▾] [Ask ✦]│
├───────────────┬──────────────────────────────────────────────────┤
│ Command Ctr   │  Pending-Ruling Queue          🕐 updated 2s ago  │
│ Case          │  Sorted: longest-waiting first                   │
│ Jury Pkg      │  ┌────────────────────────────────────────────┐  │
│ ▸ Pending Rul.│  │ Exhibit 12 — relevance        waiting 3h 20m│  │
│ Assistant     │  │   raised by M. Webb (Attorney) · 11:40 AM   │  │
│               │  │   [ Sustained ] [ Overruled ] [ Reserved ]  │  │
│               │  │   [ View exhibit history → ]                │  │
│               │  │ ──────────────────────────────────────────  │  │
│               │  │ Exhibit 9 — hearsay             waiting 48m │  │
│               │  │   raised by M. Webb (Attorney) · 2:15 PM    │  │
│               │  │   [ Sustained ] [ Overruled ] [ Reserved ]  │  │
│               │  │   [ View exhibit history → ]                │  │
│               │  │ ──────────────────────────────────────────  │  │
│               │  │ Exhibit 3 — lack of foundation  waiting 6m  │  │
│               │  │   raised by M. Webb (Attorney) · 2:57 PM    │  │
│               │  │   [ Sustained ] [ Overruled ] [ Reserved ]  │  │
│               │  │   [ View exhibit history → ]                │  │
│               │  │ ... (live-updating, 3–5s poll)               │  │
│               │  └────────────────────────────────────────────┘  │
└───────────────┴──────────────────────────────────────────────────┘
```

#### Information Hierarchy

| Priority | Content | Placement |
|----------|---------|-----------|
| Primary | Elapsed wait time per row, driving sort order (longest first) | Right-aligned per row, largest visual weight after the exhibit label |
| Primary | Exhibit label + objecting party + grounds | Leftmost, same row — identical "never unattributed" rule as the Command Center's Activity Feed Row Format pattern |
| Primary | Ruling action (Sustained / Overruled / Reserved) | Directly on the row — no drill-in required to act |
| Secondary | "View exhibit history →" link-through | Beneath the ruling actions, same row |
| Tertiary | "Updated Xs ago" freshness indicator | Top-right corner, matching the Command Center's existing convention |

#### States

| State | Appearance | User Feedback |
|-------|------------|----------------|
| Default (objections pending) | Rows sorted oldest-`raisedAt`-first (longest elapsed wait at top), each with a live-recomputing elapsed-time value | Recomputed on every live-sync poll tick (3–5s) — no manual refresh needed (US-21.1) |
| Loading (initial load) | Skeleton rows, matching Command Center's loading treatment | Subtle shimmer, no spinner text |
| Empty — no unresolved objections | "No unresolved objections — the queue is clear" with a quiet checkmark | Calm, confidence-reinforcing — identical tone to the Command Center's equivalent empty state |
| Ruling recorded from this screen | Row fades out and is removed from the queue on the next poll tick — no special-case removal animation, the row is simply absent from the next `getUnresolvedObjections` response | Confirms the thread left the unresolved set; no stale row lingers (US-21.2) |
| Ruling recorded elsewhere (e.g., Exhibit Detail) while this screen is open | Row disappears identically on the next poll tick | Same live-sync guarantee as every other polling screen in the product |
| Row whose exhibit is not visible to the requesting role | Omitted entirely from the queue — never rendered with a blank or placeholder label | Matches the Sealed-Exhibit Invisibility pattern; in practice rare on this screen since it is judge-only and judges see sealed/chambers-ex-parte material, but enforced identically as a defense-in-depth measure (US-21.2) |
| Non-judge role / direct URL access | The route is not reachable via navigation for any non-judge role; if accessed directly, renders the same access-denied treatment used elsewhere for role-inappropriate direct navigation — never a silent blank page | Consistent with "absent, not disabled" extending to the nav entry point itself |
| Load failure | Inline error: "Unable to load the pending-ruling queue — please retry" with a retry button | — |

#### Interactive Elements

| Element | Type | Behavior |
|---------|------|----------|
| Ruling action (Sustained / Overruled / Reserved) | Inline action, 1 of 3 options per row | Calls the existing `POST /api/objections/:id/ruling` (F02) for that specific objection thread; `SUSTAINED`/`OVERRULED` closes the thread (row disappears next poll), `RESERVED` keeps it unresolved (row remains, elapsed time keeps counting) — identical behavior and role gate (`JUDGE`-only, unchanged by F20) to the ruling action already specified on Exhibit Detail View (US-21.2, US-2.2) |
| "View exhibit history →" | Link-through | Navigates to the Exhibit Detail View (F10) for full context before ruling — same destination as every other drill-through path in the product |
| "Ask ✦" header button | Global | Opens Pivota Assistant slide-over without leaving this screen |

**Explicitly scoped as judge-only, not merely judge-emphasized (F21):** unlike every other screen in this document, this screen has no "viewed by a non-finalizing/non-acting role" state to specify, because no other role is ever given a navigation path to it at all — there is no judge-only *content* with a read-only fallback for other roles, as there is on the Jury Package Workspace; the entire screen is judge-exclusive by design.

**No new backend surface:** this screen introduces no new endpoint, no new schema, and no new validation — it is a new client-side screen (sort + live-recomputed elapsed time + role-gated nav entry) over F02's existing, unchanged `getUnresolvedObjections(caseId)` response, additively widened with `exhibitLabel` via a read-time join (F21).
