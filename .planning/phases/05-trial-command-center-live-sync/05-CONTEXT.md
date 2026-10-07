# Phase 5: Trial Command Center + Live Sync - Context

**Gathered:** 2026-10-07
**Status:** Ready for planning

<domain>
## Phase Boundary

A zero-configuration, read-only **ambient Trial Command Center** screen (F8) at `/command-center`, plus final tuning of **polling-based live multi-screen sync** across every screen.

- **Command Center:** three ambient panels — **Recent Activity** (full-width, newest-first), **Unresolved Objections** (count + list), **Discrepancies** (count + list, highest-risk, warning-colored) — composing existing service queries plus one new read-only service `getRecentActivity`. Link-through only; this screen **never writes to the ledger** and renders no business logic of its own.
- **Live sync:** confirm/finish the 3–5s polling model (freshness indicator, in-place fade-in updates, refetch-on-focus, pause-when-hidden) consistently across Command Center (F8), Case Workspace (F9), Exhibit Detail (F10), and Jury Package Workspace (F11, while DRAFT).

**Explicitly absent by design (US-8.1):** no filters, no date pickers, no "configure view" settings, no data-entry controls.

**Out of scope / deferred:** SSE/WebSocket sub-second sync (explicitly deferred unless a side-by-side demo proves polling insufficient); any write/edit/acknowledge affordance on this screen.

**Dependencies:** Phase 3 (`getDiscrepancies` service + DiscrepancyFlag) and Phase 4 (global "Ask ✦" assistant panel, sidebar nav activation) — neither built yet. Per the roadmap's sequential order (1→2→3→4→5) both must be merged before Phase 5 executes.

</domain>

<decisions>
## Implementation Decisions

### Recent Activity window & feed
- **Window anchored to the latest seeded event, not wall-clock "today".** Default `since` = start of the day of the most recent ledger event in the case (a rolling "latest trial day" window), so the demo always shows a populated feed regardless of run date, while live events recorded during the demo still appear at the top. (Avoids an empty Command Center on a fixed-timestamp seed.) The `since` query param remains overridable per the FRD.
- **Show all in-window events, newest-first, in a fixed-height scrollable panel.** Panel header shows the total count ("RECENT ACTIVITY (12 today)"). No hard row cap at demo scale; scroll, don't truncate/paginate.
- **Include all ledger event types** — STATUS_CHANGE, OBJECTION_RAISED, RULING_RECORDED, CUSTODY_TRANSFER, and DISCREPANCY_ACKNOWLEDGED — each as a concise one-liner ("Exhibit 14 — Admitted", "Exhibit 7 — Custody transferred"), with a status dot / shared `StatusBadge` where relevant.
- **Row wording reuses the `getExhibitHistory` summarization logic** so Command Center phrasing matches Exhibit Detail verbatim (one source of truth).
- **New service `getRecentActivity(caseId, { since, role })`:** read-only, queries `ExhibitEvent` (indexed on `caseId, eventType, recordedAt`), joins exhibit labels, reuses the history summary formatter, and applies the **same sealed-exhibit visibility predicate** as every other screen so sealed events never leak into the ambient feed. Zero writes, zero screen-local derivation.

### Live-sync polling tuning
- **Uniform 4s `refetchInterval` across all live screens** (Command Center, Case, Exhibit Detail, Jury Package DRAFT) — one consistent live-sync window within the specced 3–5s band, already proven in Phases 2–3.
- **`refetchOnWindowFocus` enabled** on all live screens so a just-focused tab shows current data immediately (multi-tab demo: record in tab A, glance in tab B).
- **Command Center = three independent queries**, each its own react-query hook polling at 4s. One panel erroring or refetching never blocks the others; each panel fades in its own updates (matches the mockup's independent-panel resilience).
- **Pause polling while the tab is hidden** (react-query default), with refetch-on-focus catching up on return — avoids needless background requests while guaranteeing freshness the moment a screen is viewed.

### Freshness indicator & update animation (Claude's Discretion defaults — see below)
- **"🕐 updated Xs ago"** (top-right): live-counting from the last **successful** fetch, resetting on each successful refetch; a failed poll keeps counting up (honestly shows staleness). Optional subtle "updating…" affordance while a poll is in flight.
- **New-row fade-in** at the top of Recent Activity (~400ms highlight, no jarring re-sort/flash), reusing the Y0-patterns live-sync highlight convention. Applied **Command-Center-only** for now — not retrofitted to the other screens in this phase.

### Panel link-through & empty/error states (Claude's Discretion defaults — see below)
- **Every row links through to Exhibit Detail** via the Phase 4 `?event=<eventId>` deep-link (scroll-to + highlight the relevant event). **Discrepancy rows** route to the **Jury Package Workspace** flagged row if a draft exists, otherwise to Exhibit Detail.
- **Per-panel independent empty + error states:** one panel failing shows its own inline error + retry and never blanks the others (each query is independent). "No unresolved objections — all clear" with a quiet checkmark; "No activity recorded yet today" calm copy; discrepancies panel header turns warning-amber with a from-across-the-room count badge when any exist.

### Default landing & role scoping
- **Command Center becomes the default landing screen:** `/` redirects to `/command-center`; sidebar is activated with Command Center as the first item (replacing the Phase 2 "coming soon" placeholder). (Depends on Phase 3/4 also activating their sidebar entries.)
- **Role-visibility applies to all three panels identically** to every other screen — role in each query key so a role switch forces an immediate refetch (never reuse a cached response that could contain sealed rows); sealed exhibits/events absent from all three panels.

### Claude's Discretion
- Exact freshness-indicator micro-copy, tick cadence, and whether to show an inline "updating…" state.
- Precise fade-in/highlight timing and easing; skeleton-loading shimmer styling.
- Two-column responsive behavior of the lower Objections/Discrepancies row.
- Whether discrepancy-row routing checks for an existing draft client-side or via the jury-package endpoint.
- The `/` → `/command-center` redirect mechanism (route config vs redirect component).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Feature requirements (FRD)
- `project_specs/FRD/F08-trial-command-center-screen.md` — the screen contract: three composed endpoints (`getRecentActivity`, `getUnresolvedObjections`, `getDiscrepancies`), the recent-window definition, read-only/no-write rule, role-visibility applied to all three queries, output shapes, error states (VALIDATION_ERROR on bad `since`, COMMAND_CENTER_LOAD_FAILED 500).
- `project_specs/FRD/F02-objection-ruling-tracking.md` — `getUnresolvedObjections` output shape (reused by the Objections panel).
- `project_specs/FRD/F06-discrepancy-identification.md` — `getDiscrepancies` output shape (reused by the Discrepancies panel). **Phase 3 dependency.**
- `project_specs/FRD/Y1-api.md` §Command Center — `GET /api/cases/:id/activity`; also composes `GET /api/cases/:id/objections?status=unresolved` and `GET /api/cases/:id/discrepancies`.
- `project_specs/FRD/Y2-errors.md` — error envelope conventions (existing `src/lib/errors.ts` + `src/lib/apiError.ts`).
- `project_specs/FRD/Y0-schema.md` — read-only against `ExhibitEvent`, `ObjectionCurrentState`, `DiscrepancyFlag`; introduces NO new tables.
- `project_specs/FRD/Y3-integrations.md` §Live Multi-Screen Sync — the polling (3–5s + refetch-on-focus) vs SSE/WebSocket (deferred) decision this phase finalizes.

### UX / interaction contracts
- `project_specs/UX-Mockup/Screen-00-trial-command-center.md` — layout, information hierarchy (Discrepancies highest priority, never below the fold), the full States table (loading/empty/discrepancy-present/live-update/load-failure), interactive link-through elements, and the "explicitly absent by design" control list.
- `project_specs/UX-Mockup/Y0-patterns.md` — Polling-Based Live Sync Indicator (updated-Xs-ago + ~400ms highlight fade, no intrusive banner), Discrepancy Flag Treatment, Status Badge Convention, Sealed-Exhibit Invisibility.
- `project_specs/UX-Mockup/Flow-01-trial-day-logging.md` / `project_specs/UX-Mockup/00-overview.md` — the 4-item nav model and Command Center as default landing (JRN-01.2 glance-during-recess).

### Technical architecture
- `project_specs/TechArch/06-integrations.md` §7.3 — polling mechanism + scale justification; SSE/WebSocket explicitly not implemented in v1.
- `project_specs/TechArch/01-components.md` / `03-api.md` — component composition + thin-route-over-service conventions.
- `project_specs/TechArch/04-security.md` — role enforcement the panels inherit.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/services/objections.ts` → `getUnresolvedObjections(caseId)` — already exists; backs the Objections panel and `GET /api/cases/:id/objections?status=unresolved`.
- `src/services/history.ts` → `getExhibitHistory` + its summary formatter — extract/reuse the per-event plain-language summarizer so `getRecentActivity` rows read identically to Exhibit Detail. `TimelineEntry` shape is a good model for activity rows.
- `src/services/visibility.ts` → `canViewSealed` / `parseRequestingRole` (fail-closed to ATTORNEY) — apply the same sealed predicate inside `getRecentActivity` and to every panel query.
- Phase 3: `getDiscrepancies(caseId, exhibitId?)` — backs the Discrepancies panel (must exist first).
- `src/components/StatusBadge.tsx` — reuse for status rows in the activity feed (consistent status representation).
- `src/hooks/useExhibitList.ts` / `src/hooks/useExhibitHistory.ts` — the established react-query hook pattern: `refetchInterval: 4_000`, role + caseId in the query key, `apiFetch`. The three Command Center hooks follow this shape exactly.
- `src/app/providers.tsx` — QueryClient config; set `refetchOnWindowFocus` here (comment already notes per-query refetchInterval).
- `src/lib/apiClient.ts` (`apiFetch`) + `src/stores/roleStore.ts` (`useRoleStore`, holds `caseId` + `role`) — session plumbing for role-scoped, role-keyed queries.
- `src/components/shell/Sidebar.tsx` — currently renders Command Center / Jury Package / Assistant as disabled "(soon)" placeholders; this phase activates the Command Center entry (and makes it first/default). Jury Package + Assistant entries activated by their own phases.
- `src/app/exhibit/[id]/` + `src/components/exhibit/Timeline.tsx` — link-through target; reuse the Phase 4 `?event=<id>` deep-link (scroll-to + highlight).
- `src/lib/errors.ts` + `src/lib/apiError.ts` — add `COMMAND_CENTER_LOAD_FAILED` (500); `VALIDATION_ERROR` already exists for bad `since`.

### Established Patterns
- **Service layer is the sole data path** — Command Center composes existing/new service functions through thin routes; no screen-local derivation (02-06/02-07).
- **Polling live-sync** (Y0-patterns): 4s `refetchInterval`, in-place update without unmount/flicker as long as rows are keyed by stable id; "updated Xs ago" indicator + ~400ms highlight on change.
- **Role-keyed queries + role-switch refetch** (threat T-02-15): role in the query key so a switch can't reuse a cached response containing sealed rows.
- **Fail-closed role scoping + anti-enumeration** (02-02): sealed records excluded as a WHERE predicate; the ambient feed must never hint a sealed event exists.
- **vitest `fileParallelism:false`** (01-07): integration suites share one Postgres + fixed-caseNumber seed.
- **Playwright role injection via `page.route` X-User-Role** (02-07): for E2E role-scoped panel tests and the multi-tab live-update scenario.

### Integration Points
- **New service:** `src/services/activity.ts` → `getRecentActivity(caseId, { since, role })`.
- **New API route:** `src/app/api/cases/[id]/activity/route.ts` (GET, validates `since`).
- **New screen/route:** `src/app/command-center/page.tsx` + three panel components; `/` → `/command-center` redirect; sidebar activation.
- **New hooks:** `useRecentActivity`, `useUnresolvedObjections`, `useDiscrepancies` (3 independent polling queries).
- **Depends on Phase 3** (discrepancies service/route) and **Phase 4** (global Ask ✦ panel present on this screen too; sidebar nav model).
- **Testing focus:** read-only guarantee (no write affordances), role-scoped sealed-event invisibility across all three panels, per-panel independent error isolation, and the multi-tab live-update-within-one-interval scenario (F8 success criterion 2).

</code_context>

<specifics>
## Specific Ideas

- The Command Center must be "impossible to scroll past unnoticed" for discrepancies — amber header + a count badge visible from across the room (US-8.1). It is a glance screen, not a dashboard to tune.
- Live-update feel without alarm: new rows fade in at the top, no re-sort/flash, no toast — ambient by design.
- The demo must never open to an empty Command Center — hence the latest-seeded-event window anchor rather than wall-clock "today".
- Wording parity with Exhibit Detail is a trust property, not a nicety — reuse the same summarizer.

</specifics>

<deferred>
## Deferred Ideas

- SSE/WebSocket sub-second live sync — explicitly deferred; revisit only if a side-by-side two-screen demo proves 4s polling visibly insufficient.
- Retrofitting the new-row fade-in highlight to Case Workspace / Jury Package — Command-Center-only this phase; could be generalized later.
- Any configuration/filtering on the Command Center (date pickers, view settings) — permanently out of scope per US-8.1's ambient positioning.
- A paginated "view all activity" screen — not needed at demo scale (scroll suffices).

</deferred>

---

*Phase: 05-trial-command-center-live-sync*
*Context gathered: 2026-10-07*
