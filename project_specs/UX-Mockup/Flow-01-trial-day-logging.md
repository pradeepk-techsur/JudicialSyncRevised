### Flow 2: Core Demo Scenario — A Trial Day of Logging, Live Questions, and Search

**Trigger:** A courtroom deputy runs the floor of a live, multi-exhibit trial, logging events as they happen while fielding live questions from the bench and attorneys.
**User Stories:** US-1.1, US-2.1, US-2.2, US-3.1, US-3.2, US-4.1, US-4.2
**Journey:** JRN-02.1 (Core Demo Scenario — see JOURNEYS-JudicialSync.md for full stage table)

```
[Case Workspace — deputy's home screen during proceedings]
    │
    ▼
[Exhibit marked on the floor]
    │
    ▼
[Deputy opens exhibit row → inline "Record Status" action]
    │
    ▼
[Select next status from allowed-transitions list only —
 e.g., from OFFERED: Objected / Admitted / Withdrawn]
    │
    ├── Valid transition ──▶ [Row updates instantly; status badge
    │                         changes across all open screens within
    │                         3–5s poll interval]
    │
    └── Invalid/terminal/stale ──▶ [Inline error, action not applied,
                                    current true status re-displayed]
    │
    ▼
[Bench asks live question — handled via Flow 1 (Pivota Assistant),
 NOT by interrupting the deputy]
    │
    ▼
[Attorney asks "who has custody of Exhibit 7?"]
    │
    ▼
[Deputy clicks exhibit row → "Current Custodian" shown inline,
 no drill-in required] ──▶ [Answer given in seconds]
    │
    ▼
[Bench requests exhibit "the one Smith testified about"]
    │
    ▼
[Deputy types into Case Workspace search bar: witness=Smith]
 (or asks the assistant the same question — Flow 1)
    │
    ▼
[Combinable filters narrow list instantly] ──▶ [Exhibit found,
 referenced in seconds, no stumble]
```

**Steps:**
1. **Log a status transition in place.** From the Case Workspace exhibit row (or Exhibit Detail View), the deputy opens a lightweight inline action — not a modal form — offering only the statuses that are valid next transitions per the admission-lifecycle state machine (US-1.1). Invalid states are never shown as selectable options, removing the need for client-side error-message design for most cases.
2. **One log updates everywhere.** The moment a transition is recorded, `ExhibitCurrentState` updates and every open screen (Command Center, Case Workspace, Exhibit Detail, Jury Package, Assistant) reflects it on its next poll cycle (3–5s) — this is the "single log action updates every screen" promise from JRN-02.1, and it is the antidote to the spreadsheet/sticky-note habit the product replaces.
3. **Log an objection.** Similarly inline: a compact "Raise Objection" action captures `objectingParty` (defaulted from role context where possible) and `grounds` (free text) — two fields, not a form wizard (US-2.1).
4. **Record a ruling.** The judge's ruling (Sustained/Overruled/Reserved) is recorded against the specific open objection thread — if an exhibit has multiple concurrent objections, each is listed as its own resolvable row, never collapsed (US-2.2).
5. **Custody questions answered inline.** "Current Custodian" is a persistent field on both the Case Workspace row and the Exhibit Detail header — no separate custody screen to navigate to for a quick lookup (US-3.2).
6. **Log a custody transfer.** A compact "Transfer Custody" action requires selecting the receiving user from an active-user list; the system auto-validates the `from` side against current state so the deputy cannot accidentally break the chain (US-3.1).
7. **Search mid-testimony.** The Case Workspace search bar accepts combinable criteria (keyword, status, witness, date) in one row of controls — chip-style active filters so the deputy can see and clear exactly what's applied without re-opening a filter panel (US-4.1).
8. **Same question, assistant or search bar — same answer.** Asking the assistant "admitted exhibits from witness Smith" (US-4.2) returns the identical result set, in the identical order, as typing the equivalent filters into the search bar — reinforcing single-source-of-truth trust.

**Key UX Risk Guarded Against:** If logging a status change, objection, or custody transfer ever requires more clicks than the paper process it replaces, the deputy reverts to sticky notes under time pressure (JRN-02.1 Risk of Abandonment). Every logging action here is designed as a 2-click maximum: open row → select outcome.
