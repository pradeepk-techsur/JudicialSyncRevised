### Flow 2: Core Demo Scenario — A Trial Day of Logging, Live Questions, and Search

**Trigger:** A courtroom deputy runs the floor of a live, multi-exhibit trial, logging events as they happen while fielding live questions from the bench and attorneys.
**User Stories:** US-1.1, US-2.1, US-2.2, US-3.1, US-3.2, US-4.1, US-4.2, US-16.1, US-18.1, US-18.2, US-19.1, US-19.2, US-20.1–US-20.4
**Journey:** JRN-02.1 (Core Demo Scenario — see JOURNEYS-JudicialSync.md for full stage table)

```
[Case Workspace — deputy's home screen during proceedings]
    │
    ▼
[New exhibit arrives on the floor → "+ New Exhibit"]
    │
    ▼
[Classification (TRIAL/CHAMBERS_EX_PARTE/SEALED, immutable)
 + identity fields + intake custodian, one seamless submit]
    │
    ├── Missing classification/custodian ──▶ [Inline field error,
    │                                          no exhibit created]
    │
    └── Valid ──▶ [Exhibit created AND marked into evidence
                   atomically — custody chain starts on row one]
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
    └── Invalid/terminal/stale/ADMISSION_BLOCKED ──▶ [Inline error
                                    naming every reason, action not
                                    applied, current status re-shown]
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
[Deputy proposes handing Exhibit 7 to the Clerk for safekeeping]
    │
    ▼
[Case Workspace: "Propose Custody Transfer" — does NOT change
 current custodian; row shows "D. Reyes → pending: C. Chen"]
    │
    ▼
[Clerk later opens the same exhibit, confirms receipt — ONLY she
 can; current custodian updates to C. Chen at that moment, not before]
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
1. **Classify and establish custody at intake, atomically.** "+ New Exhibit" on the Case Workspace captures identity fields, a mandatory, immutable `classification` (`TRIAL`/`CHAMBERS_EX_PARTE`/`SEALED`), and a required intake custodian — presented as one seamless submission that, underneath, creates the exhibit and records its first `MARKED` transition with custody established in the same step, so no exhibit can ever exist mid-lifecycle with no classification or no custodian of record (US-16.1, US-18.1, US-18.2). This action is absent for any role outside `DEPUTY`/`CLERK`/`ADMIN` (US-20.1).
2. **Log a status transition in place.** From the Case Workspace exhibit row (or Exhibit Detail View), the deputy opens a lightweight inline action — not a modal form — offering only the statuses that are valid next transitions per the admission-lifecycle state machine (US-1.1). Invalid states are never shown as selectable options. An attempted `ADMITTED` transition over an unresolved objection or missing custodian is rejected pre-write with every blocking reason named at once (US-12.1, US-12.2); this and every other status-transition action is absent for any role outside `DEPUTY`/`CLERK`/`ADMIN` (US-20.2).
3. **One log updates everywhere.** The moment a transition is recorded, `ExhibitCurrentState` updates and every open screen (Command Center, Case Workspace, Exhibit Detail, Jury Package, Pending-Ruling Queue, Assistant) reflects it on its next poll cycle (3–5s) — this is the "single log action updates every screen" promise from JRN-02.1, and it is the antidote to the spreadsheet/sticky-note habit the product replaces.
4. **Log an objection.** Similarly inline: a compact "Raise Objection" action captures `objectingParty` (defaulted from role context where possible) and `grounds` (free text) — two fields, not a form wizard; absent for `JUDGE`/`CHAMBERS_STAFF` (US-2.1, US-20.3).
5. **Record a ruling.** The judge's ruling (Sustained/Overruled/Reserved) is recorded against the specific open objection thread — if an exhibit has multiple concurrent objections, each is listed as its own resolvable row, never collapsed; recordable from Exhibit Detail View, the judge-only Pending-Ruling Queue, or — as of Phase 8 — inline from the Command Center's "Needs your attention" feed or a Jury Package Blockers card, all four entry points invoking the identical `POST /api/objections/:id/ruling` endpoint with no divergent validation (US-2.2, US-24.1).
6. **Custody questions answered inline.** "Current Custodian" (or a "pending transfer" indicator, F19) is a persistent field on both the Case Workspace row and the Exhibit Detail header — no separate custody screen to navigate to for a quick lookup (US-3.2).
7. **Propose, then confirm, a custody transfer — two separate steps, two separate people.** A compact "Propose Custody Transfer" action (absent outside `DEPUTY`/`CLERK`/`ADMIN`, US-20.4) names an intended receiver without changing who the system considers the current custodian. Only that exact named receiver can subsequently see and use "Confirm Receipt" — not the proposer, not any other authorized role — and only their confirmation updates the custody-of-record (US-19.1, US-19.2). A pending transfer can be cancelled by the proposer or any propose-authorized role without ever having changed current custody (US-19.3). As of Phase 8, the same first-assignment/propose action is additionally reachable directly from the Command Center's "Assign custodian" attention-feed entry or Custody-at-a-Glance panel, invoking the identical endpoint F24 wires up — no second custody-write code path is introduced (US-24.2).
8. **Search mid-testimony.** The Case Workspace search bar accepts combinable criteria (keyword, status, witness, date) in one row of controls — chip-style active filters so the deputy can see and clear exactly what's applied without re-opening a filter panel (US-4.1).
9. **Same question, assistant or search bar — same answer.** Asking the assistant "admitted exhibits from witness Smith" (US-4.2) returns the identical result set, in the identical order, as typing the equivalent filters into the search bar — reinforcing single-source-of-truth trust.

**Key UX Risk Guarded Against:** If logging a status change, objection, or custody transfer ever requires more clicks than the paper process it replaces, the deputy reverts to sticky notes under time pressure (JRN-02.1 Risk of Abandonment). Every logging action here is designed as a 2-click maximum: open row → select outcome — including the new intake flow, which is one submit despite covering two underlying API calls, and the custody propose/confirm split, which trades one extra click for the trust guarantee that custody can never be recorded as transferred to someone who never acknowledged receiving it.
