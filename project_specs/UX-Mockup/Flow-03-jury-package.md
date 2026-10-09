### Flow 4: Assembling, Verifying, and Accepting the Jury Package

**Trigger:** At the close of evidence, the deputy/clerk must assemble a jury package that is provably free of discrepancies; the judge must accept it with confidence; an attorney may independently verify it first.
**User Stories:** US-5.1, US-5.2, US-6.1, US-6.2, US-6.3, US-11.1, US-11.2, US-11.3, US-16.2, US-23.1, US-23.2, US-23.3
**Journeys:** JRN-02.1 (Assemble the Jury Package), JRN-01.2 (Jury Package Presented → Accept), JRN-03.1 (Verify Jury Package Integrity)

**Phase 8 presentation note:** the "Draft package renders — each row: CLEAN or FLAGGED" step below is, as of Phase 8, a per-exhibit **card** (grouped into Blockers/Clean sections with a progress banner), not a flat table row — see `Screen-03-jury-package.md` §Layout — Draft State (Phase 8: Card-Per-Exhibit, Blockers/Clean). The flow's logic (compute → flag → fix-or-acknowledge → gate → finalize) is unchanged; only the visual grouping changed. Additionally, a role outside the finalize-authorized set now has an explicit "Request finalization from Clerk" step available in place of a disabled Finalize button — see step 12 below (US-11.3).

```
[Deputy/Clerk navigates to Jury Package Workspace]
    │
    ▼
[System auto-computes candidate set: ADMITTED exhibits only,
 discrepancy-evaluated before the draft is even shown]
    │
    ▼
[Draft package renders — each row: CLEAN or FLAGGED]
    │
    ├── FLAGGED rows show the specific rule that fired
    │   (e.g., "Admitted, no custodian of record")
    │        │
    │        ├── Fix at source ──▶ [Navigate to Exhibit Detail,
    │        │                      record the missing custody
    │        │                      transfer] ──▶ [Flag auto-clears
    │        │                      on next poll, row becomes CLEAN]
    │        │
    │        └── Acknowledge ──▶ [Enter justification, ≤500 chars]
    │                              ──▶ [Flag badge changes to
    │                              "Acknowledged" — remains visible,
    │                              never hidden]
    │
    ▼
["Finalize Jury Package" button —
 DISABLED while any row is FLAGGED + OPEN]
    │
    ▼
[All rows CLEAN or ACKNOWLEDGED] ──▶ [Button becomes enabled]
    │
    ▼
[Deputy clicks Finalize] ──▶ [Server re-validates fresh —
 not from cached draft state]
    │
    ├── Still has an OPEN discrepancy (stale client) ──▶
    │     [Rejected, specific blocking exhibits listed inline,
    │      button re-disables]
    │
    └── Zero open discrepancies ──▶ [Package → FINALIZED as a new,
          immutable, numbered Version N; screen becomes read-only;
          prior versions (if any) remain independently retrievable]
    │
    ▼
[Judge reviews finalized package — "zero discrepancies" confirmation
 stamped prominently, with its version number] ──▶ [Accepts with confidence]
    │
    ▼
[Deputy exports Version N as a real PDF (⬇) — not window.print()]
    │
    ▼
[Deputy optionally "Starts New Draft" for the next version, without
 touching Version N, which stays exportable from Version History]
    │
    ▼
[Attorney independently reviews same finalized screen, or asks
 assistant "Is Exhibit 14 in the jury package?" — same answer either way]
```

**Steps:**
1. **No manual assembly step.** The deputy does not build a list — the system computes jury-eligible candidates automatically from `ExhibitCurrentState` (`ADMITTED` only) and runs discrepancy detection *before* the draft is ever displayed (US-5.1). This eliminates the "slow, manual cross-referencing against three sources" pain point named in every relevant journey.
2. **Flags are specific, not generic.** Each flagged row states the exact rule that fired in plain language — "Admitted, no custodian of record" or "Unresolved objection on this exhibit" — never a bare "⚠ issue" requiring a click to understand (US-6.1, US-6.2).
3. **Two resolution paths, both visible from the row.** (a) Navigate to the exhibit to fix the underlying condition (e.g., log the missing custody transfer), after which the flag auto-resolves on the next poll with zero extra action; or (b) acknowledge the risk directly with a required justification field, which is recorded as an immutable ledger event and remains permanently visible as "Acknowledged" — never silently cleared (US-6.3).
4. **The Finalize control is physically disabled, not just error-prone.** While ANY included exhibit has an `OPEN` + `FLAGGED` discrepancy, the "Finalize Jury Package" button renders disabled with a tooltip/caption explaining why ("2 exhibits have unresolved discrepancies") — this is the literal "cannot ship a discrepant package by mistake" requirement (US-11.2).
5. **Server re-validates at the moment of truth.** Even if the button were somehow enabled against stale client state, the finalize action re-runs discrepancy evaluation fresh server-side and blocks with a specific list of blocking exhibits if anything reopened (US-5.2).
6. **Finalized state is visually and functionally different.** Once `FINALIZED`, the screen switches to a read-only, export-ready presentation — all acknowledge/resolve/remove controls disappear entirely, not just disable (US-11.2).
7. **The judge's acceptance moment is explicit.** The finalized view carries an unmissable "FINALIZED · Version N (most recent) · Zero discrepancies" confirmation banner, so accepting the package is a fast, confident action rather than requiring independent re-verification (JRN-01.2).
8. **The attorney's verification path is identical, not separate.** Marcus doesn't need a special "audit view" — the same Jury Package Workspace (view-only for his role) and the same assistant answer serve his independent-verification need (JRN-03.1).
9. **Finalizing mints a version, it does not replace anything (F23).** Each successful finalization is assigned the case's next sequential version number and becomes a permanent, independently-retrievable snapshot — a "Start New Draft" action (role-gated identically to Finalize) begins the next package's lifecycle without touching the version that was just created. Every prior version remains independently viewable and exportable from "View Version History," never superseded or hidden by a later one (US-23.1, US-23.3).
10. **Export is a real file, not a print dialog (F23).** "Export as PDF" streams a server-generated `application/pdf` file via `@react-pdf/renderer` and triggers an actual download — replacing the prior `window.print()` control, which behaved inconsistently printer-to-printer and device-to-device. Re-exporting the same version at any later date reproduces an identical file, since a `FINALIZED` package's exhibit rows are immutable (US-23.2).
11. **Chambers-ex-parte material is excluded identically to sealed material (F16).** The candidate-query exclusion that keeps sealed exhibits out of a jury package now runs against the full three-value `classification` field, not just the `isSealed` boolean — a `CHAMBERS_EX_PARTE` exhibit is hard-excluded exactly as a `SEALED` one always was, with the same "Remove from Package" remediation path available for any legacy/regression case (US-16.2).
12. **A non-finalizing role requests finalization instead of hitting a dead end (Phase 8, F11, US-11.3).** When the judge (or chambers staff/attorney) reviews a clean draft but cannot finalize it directly, "Request finalization from Clerk" replaces the Finalize control in the same position — clicking it records a lightweight, auditable notification (`finalizationRequestedAt`/`finalizationRequestedBy`) and surfaces a banner to the next `DEPUTY`/`CLERK`/`ADMIN` who opens the same draft. This confers no finalize authority and bypasses no gate — it is purely a "please take this action" signal routed to someone who can.
13. **Blockers carry their fix inline, not just a link-through (Phase 8, F24).** Where the pre-Phase-8 flow's only remediation path was "navigate to Exhibit Detail, fix there," a Blockers card now also offers the fix directly on the card — "Record ruling" for an unresolved objection, "Assign custodian" for a custody gap — invoking the same F24 actions available on Exhibit Detail and the Command Center, so a deputy assembling the package doesn't need to leave this screen for the two most common blocking conditions (US-24.1, US-24.2).

**Key UX Risk Guarded Against:** This flow is identified in JOURNEYS as the single highest-stakes moment in the entire product — a discrepancy surfaced incorrectly here breaks trust for three personas simultaneously (deputy, judge, attorney). The hard-disabled button plus mandatory server re-validation is a deliberate belt-and-suspenders design, not redundant engineering.
