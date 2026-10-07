# Phase 3: Jury Package + Discrepancy Detection - Context

**Gathered:** 2026-10-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Automatic cross-domain discrepancy detection (F6) plus a discrepancy-gated Jury Package Workspace (F5 + F11).

- **F6 Discrepancy Identification:** A rule engine (`evaluateDiscrepancies(exhibitId)`) runs on every ledger write affecting status, objections, or custody. Two rules in scope: `ADMITTED_NO_CUSTODIAN` (ADMITTED exhibit with no `CustodyCurrentState` row) and `UNRESOLVED_OBJECTION_JURY_ELIGIBLE` (ADMITTED exhibit with an `ObjectionCurrentState` still `UNRESOLVED`). Flags move OPEN → ACKNOWLEDGED (human accepts the risk, recorded as a `DISCREPANCY_ACKNOWLEDGED` ledger event + justification) or OPEN/ACKNOWLEDGED → RESOLVED (condition no longer holds). Surfaced on Case Workspace (F9), Exhibit Detail (F10), and Jury Package Workspace (F11).
- **F5 Jury-Ready List Generation:** `computeJuryCandidates(caseId)` = `ExhibitCurrentState WHERE currentStatus = ADMITTED`. A `JuryPackage` (DRAFT/FINALIZED) with `JuryPackageExhibit` rows. Finalization re-evaluates discrepancies fresh server-side and is rejected (409) if any included exhibit has an OPEN flag. Role-gated to DEPUTY/CLERK/ADMIN.
- **F11 Jury Package Workspace screen:** `/jury-package` — pure presentation + action-trigger layer over F5/F6. Hard-disabled finalize gate, per-row discrepancy badges + acknowledge/fix actions, read-only finalized export view.

**Out of scope (later phases):** the Pivota Assistant's discrepancy/jury tools (Phase 4), the Trial Command Center aggregate view and live-sync tuning (Phase 5).

</domain>

<decisions>
## Implementation Decisions

### Draft lifecycle & staleness
- **One living DRAFT per case.** At most one DRAFT at a time. `GET /api/cases/:id/jury-package` returns the existing DRAFT or creates one; `POST` is effectively idempotent — it returns the existing DRAFT rather than spawning duplicates. A new DRAFT only becomes possible after the current package is FINALIZED.
- **Auto-reconcile the DRAFT to live candidates.** On every load and poll, the DRAFT's `JuryPackageExhibit` rows are reconciled to the current ADMITTED set: newly-admitted exhibits are added, exhibits that have left ADMITTED are removed. The draft always mirrors live eligibility — no stale snapshot that omits a just-admitted exhibit.
- **Stored `discrepancyStatus` (CLEAN/FLAGGED) is a hint only.** Both the displayed badge AND the finalize gate always re-evaluate discrepancies live (fresh `evaluateDiscrepancies` / live `DiscrepancyFlag` reads). The stored column is refreshed on reconcile so it never silently diverges. Guarantees screen == server truth.
- **Finalized package is shown, with a path to re-run.** On load, the most recent package is shown. If FINALIZED, render the read-only finalized view with an explicit **"Start New Draft"** action (DEPUTY/CLERK/ADMIN only) that computes a fresh DRAFT from current candidates. This preserves the finalized artifact as a demo payoff while allowing the scenario to be re-run live.

### Discrepancy surfacing on Case Workspace (F9)
- The existing (currently empty) per-row discrepancy column (`⚑` in `ExhibitTable.tsx`) is populated this phase.
- **OPEN flag:** amber badge with the concise rule label inline, e.g. `⚠ No custodian`, `⚠ Unresolved objection`. Multiple flags stack or collapse to `⚠ 2 issues` expanding to both labels. Full details live on Exhibit Detail. (Satisfies Y0-patterns "explanation always visible, never icon-only".)
- **ACKNOWLEDGED flag:** same rule text in a muted/desaturated amber with a small `Ack'd` marker. Still clearly a flag, visibly softened — never hidden (US-6.3: acknowledged flags remain surfaced forever).
- **Ambient count:** a small count badge on the **"Jury Package" sidebar nav item** showing case-wide open discrepancies (e.g. `Jury Package · 2`). No banner on the Case Workspace itself; the fuller ambient view is deferred to the Trial Command Center (Phase 5).
- **Acknowledge is NOT inline on the Case Workspace.** The browse screen shows the flag (open/ack'd) and row click-through only. Acknowledge actions live on Exhibit Detail and the Jury Package Workspace.

### Acknowledge interaction (F6)
- **Inline expansion** within the flagged row (Jury Package) / header banner (Exhibit Detail) — a textarea + Confirm/Cancel, not a modal. Consistent with Y0-patterns "Inline Row Actions (not modal forms)".
- **Client-side validation:** live `N/500` char counter, hard-cap at 500 chars, Confirm button disabled while the field is empty/whitespace. Server `422 JUSTIFICATION_REQUIRED` remains the defense-in-depth backstop.
- **Post-success update:** invalidate/refetch the discrepancy + jury-package queries so the row restyles to muted-amber `Ack'd` from live server state; on the Jury Package screen the finalize gate re-enables if that was the last OPEN flag. No optimistic client-derived state (strict server-truth stance).
- **Timeline visibility:** the `DISCREPANCY_ACKNOWLEDGED` ledger event appears in the exhibit's chronological Timeline (via Phase 1 `getExhibitHistory` summarization) as a plain-language entry with actor + justification, e.g. `D. Reyes acknowledged discrepancy: no custodian — "digital-only record" · <timestamp>`.

### Export / print output (F11 finalized state)
- **Mechanism:** browser print view — `Export / Print` triggers `window.print()` against a print-optimized layout (`@media print` hides nav/chrome, renders a clean document). User saves-as-PDF through the browser. No new dependencies.
- **Contents:** full handoff header — case number + title + court, "Jury Package — FINALIZED", finalized-by name + timestamp, a "✓ Zero discrepancies" stamp, then the exhibit list (label, description, status).
- **Sealed handling:** the export honors the viewer's role exactly as on-screen — a role without sealed visibility never gets sealed exhibits in the print (Sealed-Exhibit Invisibility pattern applies to the export too).
- **Availability:** finalized state only. A DRAFT is not an exportable handoff artifact.

### Finalize UX (F11)
- **In-flight:** on click, the Finalize button swaps to a `Finalizing…` label with an inline spinner and becomes non-interactive until the server responds (prevents double-submit). No full-screen overlay.
- **Stale-client 409 rejection:** inline error banner listing the specific blocking exhibit labels from the `409 JURY_PACKAGE_DISCREPANCIES_OPEN` response; re-flag those rows, re-disable the finalize button, refetch to reconcile. Never a generic toast (US-5.2: always name the blocker).
- **Success transition:** flips in place on the same `/jury-package` route into the read-only finalized layout (green "FINALIZED ✓ Zero discrepancies" banner, action controls gone, Export/Print appears, polling stops). No navigation — one screen, two states.
- **View-only roles (JUDGE / ATTORNEY / CHAMBERS_STAFF):** Finalize and per-row Acknowledge controls are simply not rendered; a brief caption explains why (e.g. "Finalization is limited to deputy, clerk, or admin"). Server role gate (`403 ROLE_NOT_PERMITTED`) remains the backstop.

### Claude's Discretion
- Exact shape/wording of rule-label text and badge micro-copy (within the "plain-language, always visible" constraint).
- Reconcile implementation details (diff strategy, transaction boundaries) — follow the existing `recordEvent`/projection transaction patterns from Phase 1.
- Polling interval reuse (existing screens use 4s `refetchInterval`; match that for the DRAFT jury-package query) and the "updated Xs ago" freshness indicator styling.
- Print CSS specifics (page breaks, typography).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Feature requirements (FRD)
- `project_specs/FRD/F05-jury-ready-exhibit-list-generation.md` — jury candidate computation, DRAFT/FINALIZED lifecycle, mandatory fresh re-evaluation at finalize, role gate, error codes (JURY_PACKAGE_DISCREPANCIES_OPEN, JURY_PACKAGE_ALREADY_FINALIZED, ROLE_NOT_PERMITTED, NO_ELIGIBLE_EXHIBITS).
- `project_specs/FRD/F06-discrepancy-identification.md` — the two rules (`ADMITTED_NO_CUSTODIAN`, `UNRESOLVED_OBJECTION_JURY_ELIGIBLE`), OPEN/ACKNOWLEDGED/RESOLVED transitions, evaluate-on-every-relevant-write trigger, acknowledgment flow + justification, error codes (JUSTIFICATION_REQUIRED, DISCREPANCY_NOT_FOUND, ROLE_NOT_PERMITTED).
- `project_specs/FRD/F11-jury-package-workspace-screen.md` — screen as pure presentation layer, hard-disabled gate, per-row discrepancy/acknowledge, finalized read-only/export, stale-client 409 handling.

### Schema, API, errors, triggers
- `project_specs/FRD/Y0-schema.md` §Discrepancy Detection, §Jury Package — `DiscrepancyFlag`, `JuryPackage`, `JuryPackageExhibit` Prisma models, enums (DiscrepancyStatus, JuryPackageStatus, JuryExhibitDiscrepancyStatus), `DISCREPANCY_ACKNOWLEDGED` payload shape. (NOTE: these models are NOT yet in `prisma/schema.prisma` — the live schema's header comment explicitly defers them to Phase 3. A migration is required.)
- `project_specs/FRD/Y1-api.md` §Jury Package, §Discrepancies — endpoint contracts: `POST`/`GET /api/cases/:id/jury-package`, `POST /api/jury-package/:id/finalize`, `GET /api/cases/:id/discrepancies`, `GET /api/exhibits/:id/discrepancies`, `POST /api/discrepancies/:id/acknowledge`.
- `project_specs/FRD/Y2-errors.md` — error envelope conventions (existing `src/lib/errors.ts` + `src/lib/apiError.ts` implement this).
- `project_specs/FRD/Y3-integrations.md` §Internal Triggers — the requirement that `evaluateDiscrepancies` runs after every relevant ledger write (missed re-evaluation explicitly disallowed).

### UX / interaction contracts
- `project_specs/UX-Mockup/Screen-03-jury-package.md` — draft & finalized wireframes, state table, interactive elements.
- `project_specs/UX-Mockup/Y0-patterns.md` — Discrepancy Flag Treatment, Hard-Disabled Gate Controls, Inline Row Actions, Status Badge Convention, Polling-Based Live Sync Indicator, Sealed-Exhibit Invisibility.
- `project_specs/UX-Mockup/Flow-03-jury-package.md` — the end-to-end assemble/finalize flow.

### Technical architecture
- `project_specs/TechArch/02-data-model.md` — data model rationale, projection/ledger relationship.
- `project_specs/TechArch/03-api.md` — API layering conventions (thin routes, service layer).
- `project_specs/TechArch/04-security.md` — role enforcement model.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/services/events.ts` — `recordEvent(args, tx?)` is the SOLE ledger writer (grep-enforced). The `DISCREPANCY_ACKNOWLEDGED` event MUST be written through it. `evaluateDiscrepancies` hooks must be invoked by the services that call `recordEvent` for status/objection/custody writes (`status.ts`, `objections.ts`, `custody.ts`).
- `src/services/status.ts`, `objections.ts`, `custody.ts` — the three write paths that must trigger `evaluateDiscrepancies` after their ledger write (established `validate → recordEvent(tx) → upsert projection` transaction template to follow).
- `src/services/objections.ts` — `getUnresolvedObjections` already exists and is the input for the `UNRESOLVED_OBJECTION_JURY_ELIGIBLE` rule.
- `src/services/cases.ts` — `getExhibits` returns `ExhibitListRow`; the DRAFT reconcile and candidate computation read `ExhibitCurrentState WHERE currentStatus = ADMITTED`.
- `src/services/history.ts` — `getExhibitHistory` replays the ledger into plain-language summaries; extend it to summarize `DISCREPANCY_ACKNOWLEDGED` events for the Timeline.
- `src/services/visibility.ts` — `canViewSealed` / `parseRequestingRole` must be applied to jury-package reads and the export so sealed exhibits stay invisible to unauthorized roles (same predicate pattern as `getExhibit`).
- `src/lib/errors.ts` + `src/lib/apiError.ts` — typed, code-bearing error layer; add the new F5/F6 error codes here (409/403/422/404).
- `src/lib/types.ts` — `ExhibitListRow.discrepancyFlags` is currently typed `[]` (honest placeholder); widen it to carry real flag data this phase.
- `src/components/case/ExhibitTable.tsx` — the per-row `⚑` column cell is already present and intentionally empty, waiting for Phase 3 to populate it.
- `src/components/StatusBadge.tsx` — the single shared status representation; reuse for all status badges on the jury-package rows.
- `src/components/shell/Sidebar.tsx` — where the ambient open-discrepancy count badge attaches to the "Jury Package" nav item.
- `src/hooks/useExhibitList.ts`, `src/hooks/useExhibitHistory.ts` — react-query hook pattern with `refetchInterval: 4_000` and role in the query key; the new `useJuryPackage` / discrepancy hooks follow the same shape.
- `src/lib/apiClient.ts` (`apiFetch`) + `useRoleStore` (zustand) — attach `X-User-Role` to every request; reuse for all new endpoints.
- `src/lib/constants.ts` — `DEMO_CASE_NUMBER` single source of truth; seed and new endpoints import it.

### Established Patterns
- **Append-only ledger + derived projection:** `DiscrepancyFlag` is derived/materialized by the rule engine, not user-created; acknowledgment is recorded BOTH in the flag (fast-read status) AND as a `DISCREPANCY_ACKNOWLEDGED` ledger event (audit ground truth). Mirrors the status/objection/custody projection pattern.
- **Transaction-atomic write + projection:** follow the `recordEvent(args, tx)` → projection upsert-in-one-transaction pattern (01-03/01-05) so the ledger event, flag status change, and any resolution never diverge.
- **Fail-closed role parsing:** `parseRequestingRole` defaults to least-privileged ATTORNEY on missing/invalid header; role gates return `403 ROLE_NOT_PERMITTED` at the service layer.
- **Server-truth-only screens:** no screen computes eligibility or discrepancy status client-side (02-06/02-07 "one-hook + presentational-components"). The Jury Package Workspace is a presentation + action-trigger layer only.
- **vitest `fileParallelism:false`:** integration suites share one Postgres + the fixed-caseNumber seed; new integration tests follow suit.

### Integration Points
- **Schema migration required:** `prisma/schema.prisma` currently excludes `DiscrepancyFlag`, `JuryPackage`, `JuryPackageExhibit` (header comment defers them to Phase 3). A new migration adds them plus the `Case.juryPackages` and `Exhibit.discrepancyFlags`/`juryPackageRows` relations.
- **Seed data:** the Phase 1 seed (`F0a`) already plants an unresolved objection, a custody gap, and a jury-package-eligible discrepancy — so both discrepancy rules fire on load without manual setup. Verify the seeded case produces at least one OPEN flag of each rule for the demo.
- **New route:** `src/app/jury-package/page.tsx` (sidebar "Jury Package" nav target already exists).
- **New API routes:** under `src/app/api/cases/[id]/jury-package`, `src/app/api/jury-package/[id]/finalize`, `src/app/api/cases/[id]/discrepancies`, `src/app/api/exhibits/[id]/discrepancies`, `src/app/api/discrepancies/[id]/acknowledge`.
- **Playwright:** new E2E for the finalize gate (disabled → acknowledge/fix → enabled → finalize → read-only), role-injection via `page.route` X-User-Role header (02-07 established this because the zustand session resets on full navigation).

</code_context>

<specifics>
## Specific Ideas

- The finalized package is treated as a demo payoff — the "FINALIZED ✓ Zero discrepancies" stamp is the acceptance moment, and "Start New Draft" exists specifically so the finalize scenario can be re-run live during a demo without a re-seed.
- The seeded case must make both discrepancy rules fire out of the box (custody gap + unresolved-objection-on-admitted), so the gate visibly blocks finalization before any manual action — this is the scenario that proves the differentiator.

</specifics>

<deferred>
## Deferred Ideas

- Proactive/unprompted discrepancy alerts (ASST-V2-01) — v2.
- Assistant answering "is Exhibit 14 in the jury package" / discrepancy queries (F7) — Phase 4; reads the same `JuryPackage`/`DiscrepancyFlag` rows this phase creates.
- Trial Command Center aggregate discrepancy/activity view and live-sync tuning (F8) — Phase 5.
- Server-generated PDF export (vs browser print) — out of scope; revisit only if print fidelity proves insufficient.
- Multiple named drafts per case — out of scope; one living DRAFT per case for the demo.

</deferred>

---

*Phase: 03-jury-package-discrepancy-detection*
*Context gathered: 2026-10-07*
