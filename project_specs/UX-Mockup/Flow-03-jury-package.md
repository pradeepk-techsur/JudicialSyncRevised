### Flow 4: Assembling, Verifying, and Accepting the Jury Package

**Trigger:** At the close of evidence, the deputy/clerk must assemble a jury package that is provably free of discrepancies; the judge must accept it with confidence; an attorney may independently verify it first.
**User Stories:** US-5.1, US-5.2, US-6.1, US-6.2, US-6.3, US-11.1, US-11.2
**Journeys:** JRN-02.1 (Assemble the Jury Package), JRN-01.2 (Jury Package Presented → Accept), JRN-03.1 (Verify Jury Package Integrity)

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
    └── Zero open discrepancies ──▶ [Package → FINALIZED,
          screen becomes read-only, export-ready]
    │
    ▼
[Judge reviews finalized package — "zero discrepancies" confirmation
 stamped prominently] ──▶ [Accepts with confidence]
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
6. **Finalized state is visually and functionally different.** Once `FINALIZED`, the screen switches to a read-only, print/export-friendly presentation — all acknowledge/resolve/remove controls disappear entirely, not just disable (US-11.2).
7. **The judge's acceptance moment is explicit.** The finalized view carries an unmissable "Zero discrepancies — package clean" confirmation banner, so accepting the package is a fast, confident action rather than requiring independent re-verification (JRN-01.2).
8. **The attorney's verification path is identical, not separate.** Marcus doesn't need a special "audit view" — the same Jury Package Workspace (view-only for his role) and the same assistant answer serve his independent-verification need (JRN-03.1).

**Key UX Risk Guarded Against:** This flow is identified in JOURNEYS as the single highest-stakes moment in the entire product — a discrepancy surfaced incorrectly here breaks trust for three personas simultaneously (deputy, judge, attorney). The hard-disabled button plus mandatory server re-validation is a deliberate belt-and-suspenders design, not redundant engineering.
