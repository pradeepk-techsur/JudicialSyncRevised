### Screen: Jury Package Workspace

**Purpose:** The authoritative, discrepancy-gated handoff view for the jury-eligible exhibit list — the screen where "build a jury package" plays out end-to-end — now presented as a per-exhibit card layout (Blockers/Clean), with a visible progress indicator and a path for non-finalizing roles to request finalization rather than hit a disabled control with no way forward.
**User Stories:** US-5.1, US-5.2, US-6.1, US-6.2, US-6.3, US-11.1, US-11.2, US-11.3, US-13.1, US-13.2, US-13.3, US-14.1, US-14.2, US-14.3, US-16.2, US-23.1, US-23.2, US-23.3
**Journeys:** JRN-02.1 (Assemble), JRN-01.2 (Present/Accept), JRN-03.1 (Verify Integrity)
**Route:** `/jury-package` · **Nav:** Sidebar "Jury Package"

#### Layout — No Package Yet (new, Phase 9, T-10, F11/F25 Phase 9 addenda)

**Supersedes the implicit pre-Phase-9 assumption that a `DRAFT` package already exists whenever this screen loads.** Prior to Phase 9, `GET /api/cases/:id/jury-package` auto-created a `DRAFT` package as a side effect of simply viewing the screen — so this "no package yet" state was never actually reachable in the UI. Phase 9 removes that auto-create behavior (F11 §Process step 10); the screen must now explicitly render a full-content-width empty state before any package exists, visible to every role, including a `JUDGE` who can never start one directly:

```
┌──────────────────────────────────────────────────────────────────┐
│ JudicialSync  [Case: 2026-CR-0142 ▾] [⚠ 1] [Role: Judge ▾][Ask Pivota]│
├───────────────┬──────────────────────────────────────────────────┤
│ Command Ctr   │  Jury Package Workspace                            │
│ Case          │  ┌────────────────────────────────────────────────┐│
│ ▸ Jury Pkg    │  │  No jury package has been started for this case.││
│ Assistant     │  │  A Deputy, Clerk, or Admin can start one.        ││
│               │  │                                                  ││
│               │  │        [ Start package ]  ← Deputy/Clerk/Admin   ││
│               │  │          only; absent for Judge/Chambers/Attorney││
│               │  └────────────────────────────────────────────────┘│
│               │  Jury Package Readiness Preview (read-only)        │
│               │  ┌────────────────────────────────────────────────┐│
│               │  │ 7 admitted · 4 ready · 3 blocked                 ││
│               │  │ Ex. 14  ✗ No custodian                           ││
│               │  │ Ex. 9   ✗ Unresolved objection                   ││
│               │  │ S-2     ✗ Sealed / ex parte                      ││
│               │  │ Ex. 3   ✓ Ready                                  ││
│               │  │ ... (same panel shown identically to every role) ││
│               │  └────────────────────────────────────────────────┘│
└───────────────┴──────────────────────────────────────────────────┘
```

- **Empty-state copy spans the full content width** (not a small centered card) and explicitly names which roles can act: "A Deputy, Clerk, or Admin can start one."
- **"Start package"** renders only for `DEPUTY`/`CLERK`/`ADMIN` (F20) — absent, not disabled, for `JUDGE`/`CHAMBERS_STAFF`/`ATTORNEY`. Clicking it calls `POST /api/cases/:id/jury-package` (F5, unchanged) **only on this explicit click** — viewing the page performs no write under any circumstance, closing the gap where a `JUDGE` merely opening this screen could previously trigger a `DRAFT` package to spring into existence with no action of their own. `data-testid="start-jury-package-button"`.
- **Jury Package Readiness Preview panel (new, F25):** rendered beneath the empty-state message for **every** role, including `JUDGE` — the identical read-only panel described in full below (§Readiness Preview Panel). This is the only way a non-starting role can see what is blocking jury-package readiness before anyone has started a package.

#### Layout — Draft State (Phase 8: Card-Per-Exhibit, Blockers/Clean)

As of Phase 8, the prior flat table (shown immediately below for traceability) is replaced by a per-exhibit card layout: a top progress banner, a **Blockers** section (one card per blocking exhibit, each carrying its specific remediation action), and a **Clean** section (lightweight cards for exhibits already ready). No underlying computation changes — every card reads the same `JuryPackageExhibit.discrepancyStatus`/`status` fields the prior table rendered.

```
┌──────────────────────────────────────────────────────────────────┐
│ JudicialSync  [Case: 2026-CR-0142 ▾] [⚠ 1] [Role: Deputy ▾][Ask Pivota]│
├───────────────┬──────────────────────────────────────────────────┤
│ Command Ctr   │  Jury Package Workspace          ● DRAFT          │
│ Case          │  (prior: Version 2 finalized · View version      │
│ ▸ Jury Pkg    │   history ▾)                                     │
│ Assistant     │  ┌────────────────────────────────────────────┐  │
│               │  │ ⚠ Not ready to finalize: 3 blockers         │  │
│               │  │ ██████░░░░░░░░░░  2 of 5 clean               │  │
│               │  └────────────────────────────────────────────┘  │
│               │  Blockers (3)                                     │
│               │  ┌────────────────────────────────────────────┐  │
│               │  │ ⛔ CRITICAL  S-2 — ex parte material         │  │
│               │  │   must be removed before finalization        │  │
│               │  │   [ Remove from package ]                     │  │
│               │  ├────────────────────────────────────────────┤  │
│               │  │ ⚠ HIGH  Ex. 9 — unresolved objection         │  │
│               │  │   raised 2:15 PM · hearsay                    │  │
│               │  │   [ Record ruling ]  [ Acknowledge ▾ ]        │  │
│               │  │   ▾ Acknowledge reason: [________________]    │  │
│               │  ├────────────────────────────────────────────┤  │
│               │  │ ⚠ MEDIUM  Ex. 14 — no custodian of record    │  │
│               │  │   detected 9:23 AM                            │  │
│               │  │   [ Assign custodian ]  [ Acknowledge ▾ ]     │  │
│               │  └────────────────────────────────────────────┘  │
│               │  Clean (2)                                        │
│               │  ┌────────────────────────────────────────────┐  │
│               │  │ ✓ Ex. 3   ●ADMITTED                          │  │
│               │  │ ✓ Ex. 7   ●ADMITTED                          │  │
│               │  └────────────────────────────────────────────┘  │
│               │  [ Finalize Jury Package ]  ← disabled, greyed    │
│               │  (non-finalizing role sees instead:)              │
│               │  [ Request finalization from Clerk ]              │
└───────────────┴──────────────────────────────────────────────────┘
```

**Progress banner (added Phase 8):** always rendered at the top of the Draft view — "Not ready to finalize: N blockers" (amber, when `blockedCount > 0`) or "All N exhibits clean — ready to finalize" (calm/green, when zero blockers) — paired with a mini progress bar showing `{cleanCount} of {total} clean`. This is the same `{ total, cleanCount, blockedCount }` summary the pre-Phase-8 caption line already computed (F11 §Outputs) — purely a more prominent, bannered presentation of an existing value, not a new computation. `data-testid="jury-package-progress-banner"`.

**Blockers section (added Phase 8):** one card per `JuryPackageExhibit` row with `discrepancyStatus = 'FLAGGED'` or the sealed/ex-parte CRITICAL condition, each card showing exhibit label, severity treatment, the specific blocking detail inline on the card face (never behind a secondary click), and **the action specific to that blocker type**:
- **Sealed/ex-parte (CRITICAL):** `[Remove from Package]` only — no Acknowledge option, since this is a structural exclusion, not a tolerable risk (F13, unchanged from the pre-Phase-8 treatment).
- **Open/unresolved objection:** `[Record ruling]` (F24, judge-only — navigates to or inline-opens the same ruling form as the Objection card on Exhibit Detail) plus `[Acknowledge ▾]`, which expands an inline, in-card textarea for the required justification (≤500 chars) rather than navigating away — "inline expandable acknowledge-reason" per the card's own disclosure copy (`Y0-patterns.md` §Pattern: Permanent-Record Disclosure).
- **No custodian of record:** `[Assign custodian]` (F24 — opens the same first-assignment/propose form as the Exhibit Detail header) plus `[Acknowledge ▾]`, identical inline-textarea behavior to the objection case above.

Each Blockers card's `[Acknowledge ▾]` disclosure triangle expands/collapses the justification textarea in place — the card height grows, nothing navigates away, and the always-visible permanent-record disclosure copy (per `Y0-patterns.md` §Pattern: Permanent-Record Disclosure) renders above the textarea the moment it expands, not only after a first attempt to submit with it empty.

**⚠ New `data-testid`/`aria-label` contract needed (flagged for UX-researcher/planner, US-24.3):**
- Blockers section container: `data-testid="jury-package-blockers-section"`
- Each blocker card: `data-testid="jury-package-blocker-card"` with `aria-label` naming exhibit + blocker type, e.g. `aria-label="Blocker: Exhibit 9, unresolved objection"`
- Inline acknowledge-reason textarea (per card): `data-testid="jury-package-blocker-acknowledge-textarea"`
- "Record ruling" / "Assign custodian" action buttons on a blocker card: `data-testid="jury-package-blocker-record-ruling-button"` / `data-testid="jury-package-blocker-assign-custodian-button"`
- Clean section container: `data-testid="jury-package-clean-section"`; each clean card `data-testid="jury-package-clean-card"`

**Clean section (added Phase 8):** lightweight cards (or compact rows within a single bordered group) for every `discrepancyStatus = 'CLEAN'` exhibit — label + status badge only, no action controls, since there is nothing to resolve. Visually de-emphasized relative to the Blockers section (smaller card chrome, no severity color), reinforcing that this list exists for completeness/confidence ("these N are already ready"), not for action.

#### Layout — Draft State (Pre-Phase-8 Flat Table, Retained for Traceability)

*The table below is the exact pre-Phase-8 presentation this screen replaced. It is kept here only so the Phase 8 card layout's per-row data mapping (above) is auditable against its predecessor — the live screen renders the card layout, not this table, as of this phase.*

```
┌──────────────────────────────────────────────────────────────────┐
│ JudicialSync  [Case: 2026-CR-0142 ▾] [⚠ 1] [Role: Deputy ▾][Ask Pivota]│
├───────────────┬──────────────────────────────────────────────────┤
│ Command Ctr   │  Jury Package Workspace          ● DRAFT          │
│ Case          │  (prior: Version 2 finalized · View version      │
│ ▸ Jury Pkg    │   history ▾)                                     │
│ Assistant     │  ┌────────────────────────────────────────────┐  │
│               │  │ Label   Status      Discrepancy             │  │
│               │  │ Ex. 3   ●ADMITTED   ✓ Clean                 │  │
│               │  │ Ex. 7   ●ADMITTED   ✓ Clean                 │  │
│               │  │ Ex. 14  ●ADMITTED   ⚠ Flagged: no custodian │  │
│               │  │                        [Fix →] [Acknowledge]│  │
│               │  │ Ex. 9   ●ADMITTED   ⚠ Flagged: unresolved   │  │
│               │  │                        objection [Fix →]    │  │
│               │  │ S-2     ●ADMITTED   ⛔ CRITICAL · ex parte   │  │
│               │  │                        material — must be   │  │
│               │  │                        removed               │  │
│               │  │                        [Remove from package]│  │
│               │  └────────────────────────────────────────────┘  │
│               │  2 of 4 included exhibits have open discrepancies.│
│               │  1 sealed/ex parte exhibit present — blocked.    │
│               │  [ Finalize Jury Package ]  ← disabled, greyed   │
└───────────────┴──────────────────────────────────────────────────┘
```

**Version history affordance, Draft state (F23):** whenever at least one `FINALIZED` version already exists for the case, the Draft header additionally shows "(prior: Version N finalized · View version history ▾)" — a secondary, collapsed-by-default link, so a deputy mid-build can still locate and export an earlier version without abandoning the current draft. If no version has ever been finalized, this line is omitted entirely (first-ever package for the case). Unchanged in the Phase 8 card layout — this header line sits directly above the new progress banner.

**Sealed/ex-parte blocker row (US-13.1, US-13.3):** a row whose underlying exhibit is `isSealed = true` (e.g., `S-2`, a chambers sidebar note) never renders `✓ Clean` or `⚠ Flagged: ...` — it renders in a distinct, higher-severity "⛔ CRITICAL" treatment with explicit copy ("ex parte material — must be removed") and no `[Fix →]`/`[Acknowledge]` actions, only `[Remove from Package]`. This evaluation is independent of and takes precedence over F6's `discrepancyStatus` for that row. The Finalize control stays disabled while any such row is present, same as for an open discrepancy. In the normal case (computation already excludes sealed exhibits at the query level per F13), this row never appears at all — it is shown here only to specify the required remediation treatment for the regression/legacy-data case where one is nonetheless present. As of Phase 8, this treatment renders as the CRITICAL Blockers card described above rather than a table row, with no change to its underlying precedence/remediation rules.

#### Request Finalization From Clerk (added Phase 8, US-11.3)

A role permitted to view this screen but **not** in F20's finalize-authorized set (`DEPUTY`/`CLERK`/`ADMIN`) — i.e., `JUDGE`, `CHAMBERS_STAFF`, or `ATTORNEY` — sees **"Request finalization from Clerk"** rendered in the exact position the (for them, never-actionable) "Finalize Jury Package" control would otherwise occupy, rather than a disabled button with no path forward. Clicking it calls `POST /api/jury-package/:id/request-finalization`, setting `finalizationRequestedAt`/`finalizationRequestedBy` on the package (overwriting any prior unresolved request — at most one outstanding request is tracked, never stacked). This action never finalizes the package, never bypasses the discrepancy gate, and confers no finalize authority to the requester.

A finalize-authorized role (`DEPUTY`/`CLERK`/`ADMIN`) viewing the same `DRAFT` package while a request is outstanding sees a visible banner — **"Finalization requested by {requesterName} at {time}"** — directly above the Finalize control, so the request surfaces exactly where the action it asks for would be taken. A successful finalize clears the outstanding request fields automatically (the request is resolved by the finalization it led to).

**⚠ New `data-testid`/`aria-label` contract needed:** `data-testid="request-finalization-button"` (rendered only for non-finalizing roles, in place of the Finalize button); `data-testid="finalization-requested-banner"` (rendered only for finalize-authorized roles when a request is outstanding) with `aria-label="Finalization requested by {requesterName} at {time}"`.

#### Readiness Preview Panel (new, Phase 9, T-10, F25)

A read-only panel listing every currently `ADMITTED` exhibit visible to the requesting role and, for each, whether it is ready or — if not — which specific blocker(s) apply (`UNRESOLVED_OBJECTION`, `NO_CUSTODIAN`, `SEALED_EXPARTE`; an exhibit can carry more than one simultaneously). Backed by the new, dedicated `GET /api/cases/:id/jury-package/preview` route (F25) — **this call never creates or mutates a `JuryPackage` row**, under any circumstance, no matter how many times it is invoked.

- **Rendered for every role, identically, including `JUDGE`** — there is no "preview with actions" variant and no role-gating on this read path (F25 is the one jury-package-adjacent endpoint with no `ROLE_NOT_PERMITTED` gate); a sealed/ex-parte exhibit the requesting role cannot see at all is simply omitted from the list, never shown as a masked or blocked row (consistent with `Y0-patterns.md` §Pattern: Sealed-Exhibit Invisibility).
- **Available before, during, and after a package exists** — on the "No Package Yet" empty state (§Layout — No Package Yet above), and as a collapsible panel alongside the normal Draft/Finalized views, so a user never has to start a package just to see what's blocking readiness.
- **Summary line:** "{totalAdmitted} admitted · {readyCount} ready · {blockedCount} blocked," followed by one row per admitted exhibit — label, a ✓/✗ ready indicator, and (if blocked) each applicable blocker's plain-language detail.
- **Polls on the standard live-sync interval** while visible, so a ruling, custody fix, or reclassification recorded elsewhere updates the ready/blocked breakdown without manual refresh — identical polling behavior to every other read surface in the product.
- **Never reflects any existing `JuryPackage`'s membership** — it is computed fresh from the exhibit/objection/custody/classification data every time, so it remains accurate even when no package has ever been started, and never drifts out of sync with a package that does exist.
- `data-testid="jury-package-readiness-preview"`; each row `data-testid="readiness-preview-row"` with `aria-label` stating exhibit + ready/blocked state, e.g. `aria-label="Exhibit 14: blocked — no custodian of record"`; summary `data-testid="readiness-preview-summary"`.

#### Layout — Finalized State

```
┌──────────────────────────────────────────────────────────────────┐
│ Jury Package Workspace   ● FINALIZED · Version 3 (most recent)    │
│                            ✓ Zero discrepancies                   │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ Finalized by D. Reyes · Oct 5, 4:02 PM                        │ │
│ │ Label   Status                                                │ │
│ │ Ex. 3   ●ADMITTED                                             │ │
│ │ Ex. 7   ●ADMITTED                                             │ │
│ │ Ex. 14  ●ADMITTED                                             │ │
│ │ Ex. 9   ●ADMITTED                                             │ │
│ └──────────────────────────────────────────────────────────────┘ │
│ [ Export as PDF ⬇ ]  [ Start New Draft ]  [ View Version History ▾]│
│          (read-only — no acknowledge/resolve controls)            │
└────────────────────────────────────────────────────────────────── ┘
```

#### Version History (secondary view, F23)

Expanding "View Version History" (available from both Draft and Finalized states) reveals every `JuryPackage` ever created for the case — every `FINALIZED` version plus the current `DRAFT`, if one exists:

```
│ VERSION HISTORY                                                    │
│ ──────────────────────────────────────────────────────────────── │
│ Version 3 (most recent)  · Finalized Oct 5, 4:02 PM · 4 exhibits  │
│   [ Export as PDF ⬇ ]                                              │
│ Version 2                · Finalized Oct 4, 2:10 PM · 3 exhibits  │
│   [ Export as PDF ⬇ ]                                              │
│ Version 1                · Finalized Oct 3, 11:45 AM · 2 exhibits │
│   [ Export as PDF ⬇ ]                                              │
│ DRAFT (in progress)      · 5 exhibits, 1 flagged                  │
│   [ Go to Draft → ]                                                │
```

Each historical row exports independently via its own `JuryPackage` id — exporting Version 1 never depends on Version 3 or the current draft still existing, and re-exporting any version at a later date always produces an identical PDF, since a `FINALIZED` package's exhibit rows are immutable (US-23.3). "Export as PDF" is available to every viewing role (no role restriction on export itself, consistent with every other read action in the system) — only *finalizing* and *removing* remain restricted to `DEPUTY`/`CLERK`/`ADMIN`.

#### Information Hierarchy

| Priority | Content | Placement |
|----------|---------|-----------|
| Primary | Progress banner ("Not ready to finalize: N blockers" + mini progress bar) (added Phase 8) | Top of screen, directly beneath the status badge/version line — largest visual weight |
| Primary | Package status badge (`DRAFT`/`FINALIZED`) + discrepancy summary banner | Top of screen |
| Primary | Blockers section — one card per blocking exhibit, each with its specific remediation action (added Phase 8, replaces the flat-table flagged rows) | Directly beneath the progress banner, above the Clean section |
| Primary | Sealed/ex-parte critical blocker card (if present) — highest-severity signal on this screen, never rendered as clean | Top of the Blockers section, visually distinct from and more severe than an ordinary blocker card (US-13.1, US-13.3) |
| Primary | Finalize / Request-finalization action and its enabled/disabled state with reason | Persistent, bottom of screen — never scrolled out of view |
| Primary | Current version number + "most recent" indicator once finalized (F23) | Directly beside the `FINALIZED` status badge |
| Secondary | Clean section — lightweight cards for ready exhibits (added Phase 8, replaces the flat-table clean rows) | Beneath the Blockers section |
| Secondary | Per-card discrepancy detail and resolution actions (Record ruling / Assign custodian / Remove from package) | Inline on each Blockers card face |
| Secondary | Inline expandable acknowledge-reason textarea (added Phase 8) | Expands in place within the Blockers card it belongs to |
| Secondary | Acknowledgment role-eligibility and permanent-record disclosure, and the full acknowledgment audit record (actor, role, timestamp, justification) once acknowledged | Inline, always visible — never hover/tooltip-only (US-14.1, US-14.2, US-14.3) |
| Secondary | "Request finalization from Clerk" action / "Finalization requested by..." banner (added Phase 8, US-11.3) | Same position the Finalize control occupies, for non-finalizing roles; banner directly above Finalize for finalize-authorized roles |
| Secondary | Version History (prior finalized versions + their independent export actions) (F23) | Collapsed by default, one click away from both Draft and Finalized states |
| Secondary | "No Package Yet" empty state — full-content-width copy + role-gated "Start package" button (new, Phase 9, T-10) | Replaces the Draft/Finalized layout entirely until a package is explicitly started |
| Secondary | Readiness Preview Panel — read-only, every role including Judge (new, Phase 9, T-10, F25) | Beneath the empty state; also available as a collapsible panel alongside the normal Draft/Finalized views |
| Tertiary | Exhibit status badges (all rows are `ADMITTED` by construction, so this is confirmatory, not discriminating) | Card-level, de-emphasized relative to the blocker detail |

#### States

| State | Appearance | User Feedback |
|-------|------------|----------------|
| Draft, zero discrepancies | Blockers section omitted entirely (or shows "Blockers (0)" collapsed); Clean section shows every included exhibit; progress banner reads calm green; Finalize button enabled (solid, primary color) | "All N exhibits clean — ready to finalize" caption on the progress banner |
| Draft, open discrepancies | Blockers section populated with one card per blocking exhibit, each showing its rule explanation + specific action inline; progress banner reads amber "Not ready to finalize: N blockers"; Finalize button visibly disabled (greyed, non-clickable) | Disabled state is a true HTML-disabled control, not a styled-but-clickable button that errors on click (US-11.2) |
| Draft, discrepancy acknowledged | Blocker card's badge changes to a muted "Acknowledged by C. Chen (Clerk) · Oct 8, 2026, 3:10 PM: [full justification text]" state — actor, role, timestamp, and justification all shown in full, never truncated/summarized/hidden behind a secondary click; card moves from Blockers to Clean on the next poll tick once counted as "clean enough to finalize" per the gate's ACK/RESOLVED rule | Finalize button re-enables once all flags are ACK'd or RESOLVED (US-6.3, US-14.3) |
| Blockers card "Acknowledge ▾" expanded (added Phase 8) | Inline textarea grows within the card; always-on disclosure copy ("Acknowledging will be recorded as a permanent action under your name and role") renders above the textarea the instant it expands | Disclosure is visible before the action is confirmed, not only after an empty-submit attempt (US-14.1, US-14.2) |
| Acknowledge control — non-eligible role | No "Acknowledge ▾" control rendered at all on a card for roles outside `DEPUTY`/`CLERK`/`JUDGE`/`ADMIN` | Absent, not disabled or greyed-out — never an affordance the system won't honor (US-14.1) |
| Blockers card "Record ruling" / "Assign custodian" in-flight (added Phase 8) | Button shows a brief inline spinner; card's other controls remain visible but non-interactive | Prevents double-submit (US-24.1, US-24.2) |
| Blockers card action rejected (e.g., `409 OBJECTION_ALREADY_RESOLVED`, `409 CUSTODY_CHAIN_BROKEN`) | Inline error within the card naming the specific rejection reason; card remains in the Blockers section unchanged | Never a silent failure — matches the reject-with-reason pattern (US-24.1, US-24.2) |
| Sealed/ex-parte exhibit present | Rendered as a distinct "⛔ CRITICAL · ex parte material" card at the top of the Blockers section — never in the Clean section, never an ordinary amber blocker card — independent of and taking precedence over the exhibit's own `discrepancyStatus`; Finalize stays disabled while the card is present | Structurally impossible to mistake for an ordinary discrepancy or a clean exhibit (US-13.1, US-13.3) |
| Sealed/ex-parte exhibit — "Remove from Package" (eligible role) | `DEPUTY`/`CLERK`/`ADMIN` see an enabled "Remove from Package" action on the CRITICAL card; `JUDGE`/`CHAMBERS_STAFF`/`ATTORNEY` see the identical card with no action control | Role gate is absence-based, matching the Acknowledge-control pattern (US-13.2, US-13.3) |
| Sealed exhibit removed via remediation action | Card disappears from the Blockers section immediately; an auditable "Removed by D. Reyes (Deputy) · Oct 8, 2026, 3:12 PM · reason: sealed/ex parte material" record is retained and visible (e.g., on Exhibit Detail's history) — the record is never silently deleted | Deliberate, auditable remediation, never a silent fix with no trace (US-13.2) |
| Finalizing (in-flight) | Finalize button shows a brief inline spinner/"Finalizing..." label | Prevents double-submit |
| Finalize rejected (stale client state) | Inline error banner lists the specific blocking exhibits; button re-disables; affected exhibits reappear as Blockers cards | Never a generic "error occurred" — always names the blocking exhibit(s) (US-5.2) |
| Non-finalizing role views Draft (added Phase 8, US-11.3) | "Request finalization from Clerk" renders in the position Finalize would otherwise occupy | Never a disabled control with no path forward for this role (US-11.3) |
| Request finalization — in flight | Button shows a brief inline spinner/"Requesting..." label | Prevents double-submit |
| Request finalization — success | Button becomes "Finalization requested" (disabled, confirmatory) until the request is cleared by a subsequent finalize | Confirms the request was recorded, not merely attempted (US-11.3) |
| Request finalization — outstanding, viewed by finalize-authorized role (added Phase 8) | "Finalization requested by {requesterName} at {time}" banner renders directly above the Finalize control | Surfaced exactly where the requested action would be taken, not on a separate notifications page (US-11.3) |
| A finalize-authorized role attempts to call request-finalization directly (`403 ROLE_NOT_PERMITTED`) | Control is never rendered for this role in the first place (they see Finalize, not Request); a direct API attempt is independently rejected | "This role can finalize directly and does not need to request it" (US-11.3) — defense-in-depth backstop, not the primary guard |
| Finalized | Status badge turns to a calm green "FINALIZED · Version N (most recent) ✓ Zero discrepancies" banner; all acknowledge/resolve/remove controls disappear; "Export as PDF," "Start New Draft," and "View Version History" appear | This is the explicit, now-versioned "zero discrepancies" confirmation stamped for the record, satisfying JRN-01.2's acceptance moment; the version number makes clear this is a permanent, independently-retrievable snapshot, not a one-shot replaceable state (US-23.1) |
| Exporting (in-flight) | "Export as PDF" shows a brief inline spinner/"Generating PDF..." label | A real server-generated file download begins on completion — never a browser print dialog (US-23.2) |
| Export attempted on a draft (`JURY_PACKAGE_EXPORT_NOT_FINALIZED`) | Export control is hard-disabled on any `DRAFT` package shown in the Version History list, never merely hidden | Matches F5's existing hard-gate pattern rather than erroring only after a click (US-23.2) |
| Export/generation failure (`PDF_GENERATION_FAILED`) | Inline error: "Unable to generate the jury package PDF — please retry" with a retry button | Never a silently-failed download — an explicit, retryable error (US-23.2) |
| New draft started after a finalized version (F23) | "Start New Draft" creates a fresh `DRAFT` package (version `null` until its own future finalization); the just-finalized version remains independently visible and exportable from Version History, untouched | Finalizing is no longer a one-shot, draft-replacing action — each version is permanent and a new draft can begin independently (US-23.1) |
| Viewing a prior (non-most-recent) version from Version History | Opens that specific version in the same read-only Finalized-state layout, labeled "Version N" without "(most recent)"; its own "Export as PDF" works independently of the current draft or most-recent version's state | Confirms every historical version remains fully, independently retrievable (US-23.3) |
| No admitted exhibits yet (package already exists) | "No admitted exhibits are available to form a jury package yet" | Non-error, informative empty state |
| No package has ever been started (reworked Phase 9, T-10) | Full-content-width empty state naming which roles (`DEPUTY`/`CLERK`/`ADMIN`) can start one; "Start package" button rendered only for those roles; Readiness Preview panel rendered beneath for every role | Replaces the pre-Phase-9 auto-create-on-view behavior — viewing this screen now never creates a `JuryPackage` row under any circumstance (F11 §Process step 10) |
| "Start package" clicked (new, Phase 9) | Button shows a brief inline spinner; on success the screen transitions to the normal Draft card layout | Explicit click is now the only path to package creation — never a side effect of navigation (T-10) |
| Readiness Preview — viewed by any role, including Judge (new, Phase 9) | Identical read-only panel for every role; summary line + per-exhibit ready/blocked rows; no action controls of any kind | Confirms a `JUDGE` can see exactly what's blocking readiness without ever starting or finalizing a package (T-10, F25) |
| Readiness Preview — a sealed/ex-parte exhibit, unauthorized role (new, Phase 9) | Row simply absent from the preview list | Confirms existence is never revealed, consistent with `Y0-patterns.md` §Pattern: Sealed-Exhibit Invisibility |
| Readiness Preview load failure | Inline error: "Unable to load the jury package readiness preview — please retry" (`JURY_PACKAGE_PREVIEW_LOAD_FAILED`) with a retry button | Independent of the main package load — a preview failure never blocks the empty state or Draft/Finalized views from rendering |
| Load failure | Inline error with retry | — |
| Viewed by non-finalizing role (Judge/Attorney/Chambers Staff) | Identical layout, but Finalize/Acknowledge/Remove-from-Package/Start-New-Draft controls render as view-only (absent, not disabled-with-explanation) — "Export as PDF" and "View Version History" remain available to every role; a sealed/ex-parte blocker row is still visible in its full critical-severity treatment, just without the removal action | Supports JRN-01.2 (judge review) and JRN-03.1 (attorney verification) from the same screen, no separate "audit view" needed (US-13.3) |

#### Interactive Elements

| Element | Type | Behavior |
|---------|------|----------|
| "Finalize Jury Package" | Primary action button | Disabled whenever any Blockers card exists; on click, triggers fresh server-side re-validation before committing (US-5.2, US-11.2); rendered only for `DEPUTY`/`CLERK`/`ADMIN` — see "Request finalization from Clerk" below for other roles |
| "Record ruling" on a Blockers card (added Phase 8, F24) | Inline write action | Opens the ruling disposition form for that card's specific `objectionId`; rendered only for `JUDGE`; `data-testid="jury-package-blocker-record-ruling-button"` (US-24.1) |
| "Assign custodian" on a Blockers card (added Phase 8, F24) | Inline write action | Opens the first-assignment/propose form for that card's exhibit; rendered only for `DEPUTY`/`CLERK`/`ADMIN`; `data-testid="jury-package-blocker-assign-custodian-button"` (US-24.2) |
| "Acknowledge ▾" button on a Blockers card | Action, expands inline justification textarea in place | Same acknowledgment flow as Exhibit Detail View (US-6.3); rendered only for `DEPUTY`/`CLERK`/`JUDGE`/`ADMIN` — absent, not disabled, for other roles; accompanied by always-visible copy disclosing the action is permanently recorded under the acting user's name and role before it is confirmed; justification field labeled "Justification (recorded permanently)"; `data-testid="jury-package-blocker-acknowledge-textarea"` (US-14.1, US-14.2) |
| "Remove from Package" button on the sealed/ex-parte CRITICAL card | Action, confirmation step | Rendered only for `DEPUTY`/`CLERK`/`ADMIN` — absent for other roles; appends an immutable, auditable exclusion event and removes the card from the Blockers section, retaining the record for audit (never deletes it); unavailable once the package is `FINALIZED` (US-13.2) |
| "Request finalization from Clerk" (added Phase 8, F11, US-11.3) | Primary action button (in place of Finalize) | Rendered only for roles outside F20's finalize-authorized set (`JUDGE`/`CHAMBERS_STAFF`/`ATTORNEY`); calls `POST /api/jury-package/:id/request-finalization`; never finalizes, never bypasses the discrepancy gate; `data-testid="request-finalization-button"` |
| "Export as PDF ⬇" (any `FINALIZED` version) | Action | Calls `GET /api/jury-package/:id/export`, streams back a real `application/pdf` file and triggers a browser download — replaces the prior `window.print()`-based "Export / Print" control entirely; available to every viewing role; hard-disabled (never merely hidden) for a `DRAFT` package (US-23.2) |
| "Start New Draft" (finalized state only) | Action | Creates a new `DRAFT` `JuryPackage` for the case, independent of and without altering the just-finalized version; rendered only for `DEPUTY`/`CLERK`/`ADMIN` (same role set as Finalize, unchanged by F20) — absent otherwise (US-23.1) |
| "View Version History ▾" | Disclosure toggle | Expands the per-case list of every `FINALIZED` version plus the current `DRAFT` (if any), each with its own independent "Export as PDF" action and an `isMostRecent` indicator on exactly one row; available to every viewing role from both Draft and Finalized states (US-23.3) |
| Blockers / Clean card (any state) | Click target | Navigates to Exhibit Detail View for full context — same click-through behavior the prior table's row offered |
| "Start package" (new, Phase 9, T-10) | Primary action button, empty state only | Calls `POST /api/cases/:id/jury-package` only on this explicit click — never as a side effect of viewing the page; rendered only for `DEPUTY`/`CLERK`/`ADMIN`; `data-testid="start-jury-package-button"` |
| Readiness Preview Panel (new, Phase 9, T-10, F25) | Read-only display, no write controls | Lists every admitted exhibit's ready/blocked state; identical for every role including `JUDGE`; polls on the standard live-sync interval; `data-testid="jury-package-readiness-preview"` |

**`data-testid`/`aria-label` contract (amended Phase 9, US-24.3):** `jury-package-progress-banner`, `jury-package-blockers-section`, `jury-package-blocker-card`, `jury-package-blocker-acknowledge-textarea`, `jury-package-blocker-record-ruling-button`, `jury-package-blocker-assign-custodian-button`, `jury-package-clean-section`, `jury-package-clean-card`, `request-finalization-button`, `finalization-requested-banner` — unchanged from Phase 8; the pre-existing `jury-exhibit-row` selector family referenced by the Phase 1–7 Playwright suite (per US-24.3's named example) continues to resolve against whatever element the card layout uses for its equivalent row/card. New as of Phase 9 (T-10): `start-jury-package-button`, `jury-package-readiness-preview`, `readiness-preview-row`, `readiness-preview-summary`.

**Design intent note:** This screen is a pure presentation + action-trigger layer per FRD F11 — it never computes eligibility or discrepancy status client-side, eliminating any possibility of showing a "clean" state the server wouldn't also enforce. The sealed/ex-parte exclusion (F13/F16) is structural at the candidate-query level, not a client-side filter — this screen's "Remove from Package" action exists purely as an auditable remediation path for the regression/legacy-data case, never as the primary mechanism keeping sealed material out of the package. As of Phase 7.1 (F23), finalization is no longer a one-shot action that replaces the draft in place — it mints a new, immutable, numbered version and leaves every prior version independently retrievable and exportable; "Start New Draft" is the explicit action that begins the next version's lifecycle, never an automatic side effect of finalizing. As of Phase 8, the Blockers/Clean card layout and the "Request finalization from Clerk" path are presentation- and workflow-additive only — F5's discrepancy gate, F13's structural exclusion, and F20's role matrix are unchanged and remain the sole source of what is actually enforced server-side. As of Phase 9, package *creation* itself becomes explicit-click-only (T-10) and the read-only Readiness Preview (F25) gives every role, including non-starting roles, visibility into readiness without that click.
