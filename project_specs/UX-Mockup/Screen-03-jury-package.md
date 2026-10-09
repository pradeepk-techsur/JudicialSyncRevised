### Screen: Jury Package Workspace

**Purpose:** The authoritative, discrepancy-gated handoff view for the jury-eligible exhibit list — the screen where "build a jury package" plays out end-to-end.
**User Stories:** US-5.1, US-5.2, US-6.1, US-6.2, US-6.3, US-11.1, US-11.2, US-13.1, US-13.2, US-13.3, US-14.1, US-14.2, US-14.3, US-16.2, US-23.1, US-23.2, US-23.3
**Journeys:** JRN-02.1 (Assemble), JRN-01.2 (Present/Accept), JRN-03.1 (Verify Integrity)
**Route:** `/jury-package` · **Nav:** Sidebar "Jury Package"

#### Layout — Draft State

```
┌──────────────────────────────────────────────────────────────────┐
│ JudicialSync  [Case: 2026-CR-0142 ▾] [⚠ 1] [Role: Deputy ▾][Ask ✦]│
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

**Version history affordance, Draft state (F23):** whenever at least one `FINALIZED` version already exists for the case, the Draft header additionally shows "(prior: Version N finalized · View version history ▾)" — a secondary, collapsed-by-default link, so a deputy mid-build can still locate and export an earlier version without abandoning the current draft. If no version has ever been finalized, this line is omitted entirely (first-ever package for the case).

**Sealed/ex-parte blocker row (US-13.1, US-13.3):** a row whose underlying exhibit is `isSealed = true` (e.g., `S-2`, a chambers sidebar note) never renders `✓ Clean` or `⚠ Flagged: ...` — it renders in a distinct, higher-severity "⛔ CRITICAL" treatment with explicit copy ("ex parte material — must be removed") and no `[Fix →]`/`[Acknowledge]` actions, only `[Remove from Package]`. This evaluation is independent of and takes precedence over F6's `discrepancyStatus` for that row. The Finalize control stays disabled while any such row is present, same as for an open discrepancy. In the normal case (computation already excludes sealed exhibits at the query level per F13), this row never appears at all — it is shown here only to specify the required remediation treatment for the regression/legacy-data case where one is nonetheless present.

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
| Primary | Package status badge (`DRAFT`/`FINALIZED`) + discrepancy summary banner | Top of screen, largest visual weight |
| Primary | Sealed/ex-parte critical blocker row (if present) — highest-severity signal on this screen, never rendered as clean | Same table, visually distinct from and more severe than an ordinary `⚠ Flagged` row (US-13.1, US-13.3) |
| Primary | Finalize/Export action and its enabled/disabled state with reason | Persistent, bottom or top of exhibit list — never scrolled out of view |
| Primary | Current version number + "most recent" indicator once finalized (F23) | Directly beside the `FINALIZED` status badge |
| Secondary | Per-row discrepancy flag and resolution actions | Inline within each flagged row |
| Secondary | Acknowledgment role-eligibility and permanent-record disclosure, and the full acknowledgment audit record (actor, role, timestamp, justification) once acknowledged | Inline, always visible — never hover/tooltip-only (US-14.1, US-14.2, US-14.3) |
| Secondary | Version History (prior finalized versions + their independent export actions) (F23) | Collapsed by default, one click away from both Draft and Finalized states |
| Tertiary | Exhibit status badges (all rows are `ADMITTED` by construction, so this is confirmatory, not discriminating) | Row-level, de-emphasized relative to the discrepancy column |

#### States

| State | Appearance | User Feedback |
|-------|------------|----------------|
| Draft, zero discrepancies | All rows "✓ Clean"; Finalize button enabled (solid, primary color) | "All exhibits clean — ready to finalize" caption |
| Draft, open discrepancies | Flagged rows amber with rule explanation + actions; Finalize button visibly disabled (greyed, non-clickable) with caption "{n} exhibit(s) have unresolved discrepancies" | Disabled state is a true HTML-disabled control, not a styled-but-clickable button that errors on click (US-11.2) |
| Draft, discrepancy acknowledged | Row badge changes to a muted "Acknowledged by C. Chen (Clerk) · Oct 8, 2026, 3:10 PM: [full justification text]" state — actor, role, timestamp, and justification all shown in full, never truncated/summarized/hidden behind a secondary click (still visible, not cleared); counts toward "clean enough to finalize" per the gate's ACK/RESOLVED rule | Finalize button re-enables once all flags are ACK'd or RESOLVED (US-6.3, US-14.3) |
| Acknowledge control — non-eligible role | No "Acknowledge" control rendered at all for roles outside `DEPUTY`/`CLERK`/`JUDGE`/`ADMIN` | Absent, not disabled or greyed-out — never an affordance the system won't honor (US-14.1) |
| Acknowledge control — eligible role, before action | "Acknowledge" button visible with inline, always-on copy: "Acknowledging will be recorded as a permanent action under your name and role." Justification field labeled "Justification (recorded permanently)." | Disclosure is visible before the action is confirmed, not only after (US-14.1, US-14.2) |
| Sealed/ex-parte exhibit present | Row rendered as a distinct "⛔ CRITICAL · ex parte material" blocker — never `✓ Clean`, never `⚠ Flagged` — independent of and taking precedence over the row's own `discrepancyStatus`; Finalize stays disabled while the row is present | Structurally impossible to mistake for an ordinary discrepancy or a clean row (US-13.1, US-13.3) |
| Sealed/ex-parte exhibit — "Remove from Package" (eligible role) | `DEPUTY`/`CLERK`/`ADMIN` see an enabled "Remove from Package" action on the blocker row; `JUDGE`/`CHAMBERS_STAFF`/`ATTORNEY` see the identical blocker row with no action control | Role gate is absence-based, matching the Acknowledge-control pattern (US-13.2, US-13.3) |
| Sealed exhibit removed via remediation action | Row disappears from the active/included list immediately; an auditable "Removed by D. Reyes (Deputy) · Oct 8, 2026, 3:12 PM · reason: sealed/ex parte material" record is retained and visible (e.g., on Exhibit Detail's history) — the row is never silently deleted | Deliberate, auditable remediation, never a silent fix with no trace (US-13.2) |
| Finalizing (in-flight) | Finalize button shows a brief inline spinner/"Finalizing..." label | Prevents double-submit |
| Finalize rejected (stale client state) | Inline error banner lists the specific blocking exhibits; button re-disables; affected rows re-flag | Never a generic "error occurred" — always names the blocking exhibit(s) (US-5.2) |
| Finalized | Status badge turns to a calm green "FINALIZED · Version N (most recent) ✓ Zero discrepancies" banner; all acknowledge/resolve/remove controls disappear; "Export as PDF," "Start New Draft," and "View Version History" appear | This is the explicit, now-versioned "zero discrepancies" confirmation stamped for the record, satisfying JRN-01.2's acceptance moment; the version number makes clear this is a permanent, independently-retrievable snapshot, not a one-shot replaceable state (US-23.1) |
| Exporting (in-flight) | "Export as PDF" shows a brief inline spinner/"Generating PDF..." label | A real server-generated file download begins on completion — never a browser print dialog (US-23.2) |
| Export attempted on a draft (`JURY_PACKAGE_EXPORT_NOT_FINALIZED`) | Export control is hard-disabled on any `DRAFT` package shown in the Version History list, never merely hidden | Matches F5's existing hard-gate pattern rather than erroring only after a click (US-23.2) |
| Export/generation failure (`PDF_GENERATION_FAILED`) | Inline error: "Unable to generate the jury package PDF — please retry" with a retry button | Never a silently-failed download — an explicit, retryable error (US-23.2) |
| New draft started after a finalized version (F23) | "Start New Draft" creates a fresh `DRAFT` package (version `null` until its own future finalization); the just-finalized version remains independently visible and exportable from Version History, untouched | Finalizing is no longer a one-shot, draft-replacing action — each version is permanent and a new draft can begin independently (US-23.1) |
| Viewing a prior (non-most-recent) version from Version History | Opens that specific version in the same read-only Finalized-state layout, labeled "Version N" without "(most recent)"; its own "Export as PDF" works independently of the current draft or most-recent version's state | Confirms every historical version remains fully, independently retrievable (US-23.3) |
| No admitted exhibits yet | "No admitted exhibits are available to form a jury package yet" | Non-error, informative empty state |
| Load failure | Inline error with retry | — |
| Viewed by non-finalizing role (Judge/Attorney/Chambers Staff) | Identical layout, but Finalize/Acknowledge/Remove-from-Package/Start-New-Draft controls render as view-only (absent, not disabled-with-explanation) — "Export as PDF" and "View Version History" remain available to every role; a sealed/ex-parte blocker row is still visible in its full critical-severity treatment, just without the removal action | Supports JRN-01.2 (judge review) and JRN-03.1 (attorney verification) from the same screen, no separate "audit view" needed (US-13.3) |

#### Interactive Elements

| Element | Type | Behavior |
|---------|------|----------|
| "Finalize Jury Package" | Primary action button | Disabled whenever any row is `FLAGGED` + `OPEN`; on click, triggers fresh server-side re-validation before committing (US-5.2, US-11.2) |
| "Fix →" link on a flagged row | Contextual link | Navigates to that exhibit's Exhibit Detail View to resolve the underlying condition |
| "Acknowledge" button on a flagged row | Action, opens inline justification field | Same acknowledgment flow as Exhibit Detail View (US-6.3); rendered only for `DEPUTY`/`CLERK`/`JUDGE`/`ADMIN` — absent, not disabled, for other roles; accompanied by always-visible copy disclosing the action is permanently recorded under the acting user's name and role before it is confirmed; justification field labeled "Justification (recorded permanently)" (US-14.1, US-14.2) |
| "Remove from Package" button on a sealed/ex-parte blocker row | Action, confirmation step | Rendered only for `DEPUTY`/`CLERK`/`ADMIN` — absent for other roles; appends an immutable, auditable exclusion event and removes the row from the active list, retaining it for audit (never deletes it); unavailable once the package is `FINALIZED` (US-13.2) |
| "Export as PDF ⬇" (any `FINALIZED` version) | Action | Calls `GET /api/jury-package/:id/export`, streams back a real `application/pdf` file and triggers a browser download — replaces the prior `window.print()`-based "Export / Print" control entirely; available to every viewing role; hard-disabled (never merely hidden) for a `DRAFT` package (US-23.2) |
| "Start New Draft" (finalized state only) | Action | Creates a new `DRAFT` `JuryPackage` for the case, independent of and without altering the just-finalized version; rendered only for `DEPUTY`/`CLERK`/`ADMIN` (same role set as Finalize, unchanged by F20) — absent otherwise (US-23.1) |
| "View Version History ▾" | Disclosure toggle | Expands the per-case list of every `FINALIZED` version plus the current `DRAFT` (if any), each with its own independent "Export as PDF" action and an `isMostRecent` indicator on exactly one row; available to every viewing role from both Draft and Finalized states (US-23.3) |
| Exhibit row (any state) | Click target | Navigates to Exhibit Detail View for full context |

**Design intent note:** This screen is a pure presentation + action-trigger layer per FRD F11 — it never computes eligibility or discrepancy status client-side, eliminating any possibility of showing a "clean" state the server wouldn't also enforce. The sealed/ex-parte exclusion (F13/F16) is structural at the candidate-query level, not a client-side filter — this screen's "Remove from Package" action exists purely as an auditable remediation path for the regression/legacy-data case, never as the primary mechanism keeping sealed material out of the package. As of Phase 7.1 (F23), finalization is no longer a one-shot action that replaces the draft in place — it mints a new, immutable, numbered version and leaves every prior version independently retrievable and exportable; "Start New Draft" is the explicit action that begins the next version's lifecycle, never an automatic side effect of finalizing.
