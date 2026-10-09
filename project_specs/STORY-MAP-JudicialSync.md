# User Story Map
## JudicialSync

| Field | Value |
|-------|-------|
| **Product Name** | JudicialSync |
| **Date** | 2026-10-06 |
| **Related Personas** | PERSONAS-JudicialSync.md |
| **Related Journeys** | JOURNEYS-JudicialSync.md |
| **Related JTBD** | JTBD-JudicialSync.md |
| **Related User Stories** | UserStories-JudicialSync.md |
| **Related PRD** | PRD-JudicialSync.md |

---

## Overview

This story map places every existing UserStory (US-X.Y) at the intersection of a persona's journey stage and a PRD epic, then annotates each placement with a **Natural Acceptance Criterion (NaC)** derived from the intersection of a JTBD outcome and that journey stage. No new stories are introduced here — this document is a map, not a backlog.

**How to read a lane:** each `###` lane corresponds to one journey (JRN-ID) for one persona. Its table's `Activity` column embeds the journey stage name so the stage context travels with the row. `Stories` lists every US-X.Y realized at that stage; `NaC` is the testable criterion that stage must satisfy, traced back to a specific JTBD outcome; `Release` indicates the increment (R1 or R2) in which that stage becomes fully functional.

**Release logic:** R1 delivers the complete, named core demo scenario (JRN-02.1) end-to-end across all four personas — every P0 story plus the P1 stories (Epic 2 case-wide objection query, Epic 3 full custody history, Epic 4 search, Epic 10 sealed-exhibit handling) that the core scenario and the other three journeys depend on to be *whole*, not half-built. R2 adds the Trial Command Center (Epic 8, F8) — the one feature explicitly sequenced after core data/assistant features in the PRD — which completes the ambient-glance stages of JRN-01.2 and rounds out the administrator's full five-screen adoption-burden assessment in JRN-04.1.

**Note on authority:** this R1/R2 split is an illustrative sequencing aid for implementation planning only — it is not a PRD-level phased-release commitment. The PRD treats all P0/P1 features, including F8, as part of one credible end-to-end demo with no formal phasing; if an actual phased rollout is ever adopted, the PRD should be updated explicitly rather than inferring phasing from this map.

---

## Story Map Matrix

### PER-01: Judge Elena Marsh (with Chambers Staff)
**Journey:** JRN-01.1 — Live Question Mid-Proceeding

| Activity | Persona | Epic | Stories | NaC | Release |
|----------|---------|------|---------|-----|---------|
| Query the Assistant: ask a live natural-language question from the bench | PER-01 | Epic 7 (F7) | US-7.1 | JTBD-01.1: Given a live natural-language question during proceedings, the assistant returns an answer within seconds, with no required menus/filters/login | R1 |
| Receive Cited Answer: read the streamed reply with its ledger citation | PER-01 | Epic 7 (F7), Epic 1 (F1) | US-7.2, US-1.2 | JTBD-01.1: Every answer carries a citation to a specific ledger record; status shown matches the identical record across every screen | R1 |
| Rule with Confidence: state the confirmed fact aloud and rule without missing a beat | PER-01 | Epic 1 (F1), Epic 7 (F7) | US-1.2, US-7.1 | JTBD-01.1: Judge rules on the matter without pausing proceedings or delegating the lookup, 100% of live-question instances | R1 |
| Query the Assistant: example prompts reference exhibit labels that actually exist in this case | PER-01 | Epic 15 (F15) | US-15.2 | JTBD-01.1: Example/suggested-question chips cite real seeded `exhibitLabel` values (e.g., "P-1," "S-2"), so trying an example never returns an unearned decline about a nonexistent placeholder exhibit | R3 |

**Journey:** JRN-01.2 — Ambient Awareness to Jury Package Acceptance

| Activity | Persona | Epic | Stories | NaC | Release |
|----------|---------|------|---------|-----|---------|
| Glance During Recess: open the Trial Command Center with zero setup | PER-01 | Epic 8 (F8) | US-8.1 | JTBD-01.2: Given the Command Center is open with no configuration performed, recent status changes, pending objections, and rulings are visible within 10 seconds | R2 |
| Spot a Flag: notice a discrepancy indicator and drill into it | PER-01 | Epic 8 (F8), Epic 6 (F6) | US-8.1, US-8.2, US-6.1, US-6.2 | JTBD-01.2: Outstanding discrepancies are surfaced visually without a manual filter, and drill-through preserves the flagged exhibit's context | R2 |
| Glance During Recess: header carries no unexplained elements, activity feed shows full date/time and the exhibit name on every row | PER-01 | Epic 8 (F8), Epic 15 (F15) | US-15.3, US-15.4, US-15.5 | JTBD-01.2: Every header element is either labeled or removed, and every activity-feed row (Recent Activity, Exhibit Detail timeline) shows both a full date/time and the exhibit label it concerns — a single glance is never left ambiguous | R3 |
| Request History: pull the full chronological story behind the flag | PER-01 | Epic 10 (F10) | US-10.1 | JTBD-01.4: Full chronological timeline of status, objection, ruling, and custody events renders instantly, with zero manual assembly | R1 |
| Jury Package Presented: deputy presents the finalized package for acceptance | PER-01 | Epic 11 (F11) | US-11.1, US-11.2 | JTBD-01.3: The discrepancy gate is visible on the same screen as the jury package — a flagged exhibit cannot silently reach the final list | R1 |
| Accept with Confidence: review the zero-discrepancy confirmation and accept | PER-01 | Epic 11 (F11), Epic 6 (F6) | US-11.2, US-6.3 | JTBD-01.3: Zero discrepant exhibits (unresolved objection or incomplete custody) appear in the finalized package the judge accepts | R1 |
| Check the Pending-Ruling Queue: triage every case-wide unresolved objection sorted by longest wait, then rule or drill into full history without losing context | PER-01 | Epic 21 (F21) | US-21.1, US-21.2 | JTBD-01.2: A judge-only queue lists every currently-unresolved objection sorted by elapsed wait time (longest-waiting first), live-recomputed on every poll tick, with each row linking directly into ruling and into the exhibit's full history with no lost context | R4 (inserted Phase 7.1) |
| Glance During Recess: scan the single severity-ranked "Needs Your Attention" feed instead of three separate panels | PER-01 | Epic 8 (F8) | US-8.4 | JTBD-01.6: Every Critical/High/Pending/Medium item across the case is visible in strict tier order, newest-first within each tier, with zero items from a lower tier appearing before a higher one | R5 (Phase 8) |
| Request Finalization: route a finalization request to the Clerk directly from the workspace instead of an out-of-band ask | PER-01 | Epic 11 (F11) | US-11.3 | JTBD-01.7: A non-finalize-authorized role's "Request finalization from Clerk" click produces a timestamped request visible as a banner to every finalize-authorized role on their next screen load | R5 (Phase 8) |

**Journey:** JRN-01.3 — Recording a Ruling Without Leaving the Screen

| Activity | Persona | Epic | Stories | NaC | Release |
|----------|---------|------|---------|-----|---------|
| Spot the Open Objection: see the same objection surfaced on the attention feed or on the exhibit's Objection card | PER-01 | Epic 8 (F8), Epic 10 (F10) | US-8.4, US-10.3 | JTBD-01.5: The same "Record ruling" control appears wherever an unresolved objection is visible, scoped to a single named objection thread, never an ambiguous exhibit-level action | R5 (Phase 8) |
| Open Record Ruling / Select Disposition: choose Sustained, Overruled, or Reserved for the specific objection thread | PER-01 | Epic 24 (F24) | US-24.1 | JTBD-01.5: The disposition selector offers exactly Sustained/Overruled/Reserved, scoped to one `objectionId`, with no new disposition value introduced | R5 (Phase 8) |
| Confirm and Submit: complete an explicit confirm step, with the server applying the existing judge-only ruling gate and no non-judge bypass | PER-01 | Epic 24 (F24), Epic 20 (F20) | US-24.1 | JTBD-01.5: Submission requires an explicit confirm step distinct from opening the form; a non-judge role sees no "Record ruling" control anywhere, and a direct API call as a non-judge is independently rejected with 403 `ROLE_NOT_PERMITTED` | R5 (Phase 8) |
| See It Resolved Everywhere: watch the objection close out (or re-rank, for Reserved) on both the feed and Exhibit Detail within one polling interval | PER-01 | Epic 24 (F24), Epic 8 (F8), Epic 10 (F10) | US-24.1 | JTBD-01.5: A Sustained/Overruled disposition clears the entry from the attention feed on the next poll tick; a Reserved disposition leaves the thread unresolved and the entry re-ranked, with zero deputy/clerk intermediary required to confirm it stuck | R5 (Phase 8) |

---

### PER-02: Courtroom Deputy Dana Reyes (with Clerk of Court)
**Journey:** JRN-02.1 — Core Demo Scenario (Trial Day of Logging, Live Questions, Jury Package Build)

| Activity | Persona | Epic | Stories | NaC | Release |
|----------|---------|------|---------|-----|---------|
| Log Exhibit Activity: mark status, objection, and custody events the instant they happen on the floor | PER-02 | Epic 0 (F0), Epic 1 (F1), Epic 2 (F2), Epic 3 (F3), Epic 9 (F9) | US-0.1, US-1.1, US-2.1, US-3.1, US-9.1 | JTBD-02.1: Every status, objection, and custody event is recorded as an immutable, timestamped ledger entry and appears identically across every screen and the assistant | R1 |
| Log Exhibit Activity: admission blocked until every unresolved objection and custody gap is cleared | PER-02 | Epic 12 (F12) | US-12.1, US-12.2, US-12.3 | JTBD-02.1: No invalid `ADMITTED` transition is ever recorded against an exhibit with an unresolved objection or missing custodian — the gate fires inside the shared service layer with no override, and every blocking reason is returned together in one response | R3 |
| Field "What Was Admitted Yesterday?": assistant answers directly, Dana is not the bottleneck | PER-02 | Epic 7 (F7), Epic 1 (F1) | US-7.1, US-1.2 | JTBD-01.1: Judge gets a cited live answer in seconds, with the deputy freed from being the forced lookup intermediary | R1 |
| Field "What Objections Remain Unresolved?": case-wide query answers the bench instantly | PER-02 | Epic 7 (F7), Epic 2 (F2) | US-7.1, US-2.3 | JTBD-02.1: Objection/ruling status is answered directly from the live record, not fragile running notes | R1 |
| Answer a Custody Question: single lookup, no paper log | PER-02 | Epic 3 (F3) | US-3.2 | JTBD-02.2: "Who currently has custody of Exhibit X" is answered in under 5 seconds, with zero paper-log lookup | R1 |
| Search Mid-Testimony: filter by witness/keyword/status and drill into the match | PER-02 | Epic 4 (F4), Epic 9 (F9) | US-4.1, US-4.2, US-9.2 | JTBD-02.4: Combinable filters return matching exhibits in under 10 seconds during live testimony | R1 |
| Search Mid-Testimony: click anywhere on a matched exhibit row — not just a nested link — to open its detail | PER-02 | Epic 15 (F15) | US-15.1 | JTBD-02.4: Every exhibit row, flagged or clean, is clickable across its entire row area and keyboard-activatable, so zero time is lost hunting for a specific link during live testimony | R3 |
| Field "Is Exhibit 14 in the Jury Package?": assistant resolves jury-eligibility live | PER-02 | Epic 7 (F7), Epic 5 (F5), Epic 6 (F6) | US-7.1, US-5.1, US-6.2 | JTBD-02.3: Jury-eligible status is answered instantly from the same current-state projection the screens use | R1 |
| Assemble the Jury Package: generate the list; discrepancy detection gates finalization | PER-02 | Epic 5 (F5), Epic 6 (F6), Epic 11 (F11) | US-5.2, US-6.3, US-11.2 | JTBD-02.3: Finalization is blocked with 409 until every flagged discrepancy is resolved or acknowledged — zero manual cross-referencing required | R1 |
| Assemble the Jury Package: sealed exhibits are structurally excluded, and acknowledgment actions are made transparent before they're taken | PER-02 | Epic 13 (F13), Epic 14 (F14) | US-13.1, US-13.2, US-13.3, US-14.1, US-14.2, US-14.3 | JTBD-02.3: A sealed/ex-parte exhibit can never render as eligible or clean and is removable only via an authorized, reason-recorded action; every discrepancy-acknowledgment control visibly states, before confirmation, who may act and that the action is permanently audited | R3 |
| Log Exhibit Activity: classify every exhibit as TRIAL, CHAMBERS_EX_PARTE, or SEALED at intake — mandatory and immutable for the life of the exhibit | PER-02 | Epic 16 (F16) | US-16.1, US-16.2 | JTBD-02.1: Every exhibit's classification is captured as a required, immutable field at creation, and `CHAMBERS_EX_PARTE`/`SEALED` exhibits are excluded from jury candidacy in the same query as the admitted-status filter, not a later pass | R4 (inserted Phase 7.1) |
| Log Exhibit Activity: regression-prove the admission gate still blocks `OBJECTED → ADMITTED` pre-ruling and still allows a never-objected `OFFERED → ADMITTED` straight through | PER-02 | Epic 17 (F17) | US-17.1, US-17.2 | JTBD-02.1: A dedicated regression suite confirms F12's existing gate rejects admission over any unruled objection and admits unchallenged exhibits directly, with no new validation mechanism introduced | R4 (inserted Phase 7.1) |
| Log Exhibit Activity: require and record a custodian atomically in the same transaction as the exhibit's first `MARKED` transition | PER-02 | Epic 18 (F18) | US-18.1, US-18.2 | JTBD-02.1: The first-ever `STATUS_CHANGE` event for an exhibit is rejected with 422 `CUSTODIAN_REQUIRED_AT_INTAKE` unless `custodianUserId` is supplied in the same request, appended atomically with no intermediate state | R4 (inserted Phase 7.1) |
| Log Exhibit Activity / Confirm Custody Receipt: propose a custody handoff, then only the exact named receiver may confirm it — the proposer may cancel, and the exhibit's very first custody link bypasses the round-trip entirely | PER-02 | Epic 19 (F19) | US-19.1, US-19.2, US-19.3, US-19.4 | JTBD-02.1: Custody-of-record changes only when the identity-matched named receiver confirms a pending proposal, never on the proposer's assertion alone; a cancelled proposal remains visible in history, never erased | R4 (inserted Phase 7.1) |
| Log Exhibit Activity: every write action — create exhibit, status transition, propose/confirm custody — is checked against the acting user's actual role via a server-side `User.role` lookup, never a client-supplied claim | PER-02 | Epic 20 (F20) | US-20.1, US-20.2, US-20.4, US-20.5, US-20.6 | JTBD-02.1: Each of the ten RBAC-matrix actions resolves the acting role from the database and rejects a disallowed role with 403 `ROLE_NOT_PERMITTED` before any field-level or state-machine validation runs, with zero client-claimed-role bypass | R4 (inserted Phase 7.1) |
| Assemble the Jury Package: lock in a new, permanently-numbered version on every finalization and export it as a real, deterministic PDF | PER-02 | Epic 23 (F23) | US-23.1, US-23.2, US-23.3 | JTBD-02.6: Every finalization assigns a permanent, sequentially-numbered version atomically with `status = FINALIZED`; the exported PDF is generated server-side and is byte-for-byte reproducible per version, with every prior version independently retrievable and exportable | R4 (inserted Phase 7.1) |
| Log Exhibit Activity: triage the full exhibit set with one-click quick-filter chips (Needs attention / In my custody / Awaiting ruling) and a per-row Jury Package eligibility badge | PER-02 | Epic 9 (F9) | US-9.3 | JTBD-02.4: Combinable triage (quick-filter chips plus an always-current eligibility badge sourced from the same computation the Jury Package Workspace uses) narrows the visible row set without constructing a manual search query | R5 (Phase 8) |

**Journey:** JRN-02.2 — Reconstructing What Happened to an Exhibit

| Activity | Persona | Epic | Stories | NaC | Release |
|----------|---------|------|---------|-----|---------|
| Open Exhibit Detail: pull up the full picture in one place | PER-02 | Epic 10 (F10) | US-10.1 | JTBD-01.4: A single screen holds the complete story, with nothing missing, reconstructed directly from the ledger | R1 |
| Walk Through the Timeline: scan marked → objected → ruling → admitted → custody transfer in order | PER-02 | Epic 10 (F10), Epic 2 (F2), Epic 3 (F3) | US-10.1, US-2.2, US-3.3 | JTBD-02.1: Status, objection, ruling, and custody events are all visible as one trustworthy, chronologically ordered record | R1 |
| Confirm via Assistant: double-check a detail with a citation-backed answer before relaying it | PER-02 | Epic 7 (F7) | US-7.1, US-7.2 | JTBD-01.4: History is accessible via both direct screen view and a natural-language assistant query, and the two agree exactly | R1 |
| Open Exhibit Detail: act directly from right-rail Objection / Chain-of-Custody / Jury-Eligibility cards and header "Transfer custody" / "Ask Pivota" actions, with no separate screen to find them on | PER-02 | Epic 10 (F10), Epic 24 (F24) | US-10.3 | JTBD-02.7: Every right-rail card derives its state from the same `getExhibitHistory` payload the timeline renders from, and the header's custody/ruling actions render only for an F20-authorized role or the named pending-transfer receiver — one screen for both understanding and acting on the exhibit | R5 (Phase 8) |

**Journey:** JRN-02.3 — Command Center Custody Glance and Inline Resolution

| Activity | Persona | Epic | Stories | NaC | Release |
|----------|---------|------|---------|-----|---------|
| Glance at Custody Panel: scan "Custody at a glance," grouped by current custodian, with a distinct pending-transfer grouping | PER-02 | Epic 8 (F8) | US-8.3 | JTBD-02.8: Exhibits are grouped by current custodian with pending transfers shown in a distinct grouping, requiring zero navigation into individual Exhibit Detail pages to answer "who holds what" case-wide | R5 (Phase 8) |
| Spot a Medium-Tier Flag / Assign Custodian Inline: act on an admitted-no-custodian entry directly from the attention feed, with the correct action (assign vs. propose/transfer) invoked automatically | PER-02 | Epic 8 (F8), Epic 24 (F24) | US-24.2 | JTBD-02.7: The correct underlying action is invoked automatically based on current custody state, with no manual endpoint selection and an explicit confirm step before anything submits | R5 (Phase 8) |
| Confirm Resolution: watch the feed entry clear on the next poll tick with no screen-local optimistic state | PER-02 | Epic 8 (F8), Epic 24 (F24) | US-24.2 | JTBD-02.9: A successful inline action clears or re-ranks its originating feed entry on the next poll tick, with zero navigation away from the Command Center | R5 (Phase 8) |
| Handle a Critical Item From the Feed: follow a sealed-exhibit Critical entry straight into the existing remove-from-package remediation | PER-02 | Epic 8 (F8), Epic 13 (F13) | US-8.3, US-24.2 | JTBD-02.9: Tier ordering surfaces the sealed-exhibit leak above the routine custody gap automatically, and the link removes the need to search for the offending exhibit from scratch | R5 (Phase 8) |

---

### PER-03: Attorney Marcus Webb
**Journey:** JRN-03.1 — Mid-Argument Status Check to Jury Package Verification

| Activity | Persona | Epic | Stories | NaC | Release |
|----------|---------|------|---------|-----|---------|
| Confirm Status Before Referencing: query the assistant before citing an exhibit in cross-examination | PER-03 | Epic 1 (F1), Epic 7 (F7) | US-1.2, US-7.1 | JTBD-03.1: Status answers are available on demand, fast enough to use live, with zero courtroom-staff intermediary | R1 |
| Check Objection Resolution: ask whether the objection is still unresolved before deciding to press the point | PER-03 | Epic 2 (F2) | US-2.3 | JTBD-03.2: Unresolved-objection status is queryable case-wide and returned in under 10 seconds, replacing personal notes | R1 |
| Challenge a Custody Gap: verify the chain-of-custody before formally raising a challenge | PER-03 | Epic 3 (F3), Epic 10 (F10) | US-3.3, US-10.1 | JTBD-03.3: Full timestamped custody history is retrievable without a formal evidentiary request, with gaps visually distinguishable | R1 |
| Verify Jury Package Integrity: review the finalized package against his own understanding of what was admitted | PER-03 | Epic 11 (F11), Epic 6 (F6) | US-11.1, US-6.2 | JTBD-03.4: Discrepancy warnings, if any, are visible directly on the jury package view itself, not a separate report | R1 |
| Confirm with the Assistant: independently verify a specific exhibit's jury-eligibility | PER-03 | Epic 7 (F7), Epic 5 (F5) | US-7.1, US-5.1 | JTBD-03.4: The assistant's jury-eligibility answer cites the exact same computed status the screen shows — zero surprises | R1 |
| Check Objection Resolution: raise a new objection as an explicitly server-enforced attorney permission, not an assumed UI affordance | PER-03 | Epic 20 (F20) | US-20.3 | JTBD-03.2: Raising a new objection is rejected with 403 `ROLE_NOT_PERMITTED` for `JUDGE`/`CHAMBERS_STAFF` and succeeds unchanged for `ATTORNEY`/`DEPUTY`/`CLERK`/`ADMIN` — Marcus's own ability to object is a server-enforced permission, distinct from the judge-only ruling gate | R4 (inserted Phase 7.1) |

---

### PER-04: Administrator Priya Nair
**Journey:** JRN-04.1 — Evaluating Pivota for Courtroom Adoption

| Activity | Persona | Epic | Stories | NaC | Release |
|----------|---------|------|---------|-----|---------|
| Review the Walkthrough: watch the full demo scenario end to end, including the ambient Command Center | PER-04 | Epic 0 (F0), Epic 7 (F7), Epic 8 (F8) | US-0.2, US-0.3, US-7.1, US-8.1 | JTBD-04.1: The seeded scenario runs start-to-finish with zero manual data entry, mirroring real courtroom friction rather than a contrived feature tour | R2 (demo is R1-complete; full five-screen walkthrough requires R2's Command Center) |
| Spot-Check Cross-Screen Consistency: compare one exhibit across Case Workspace, Exhibit Detail, and Jury Package | PER-04 | Epic 9 (F9), Epic 10 (F10), Epic 11 (F11) | US-9.1, US-10.1, US-10.2, US-11.1 | JTBD-04.1: 100% agreement across every screen for the same exhibit, including identical "not found" behavior for sealed exhibits across roles | R1 |
| Test Discrepancy Detection: check the seeded admitted-no-custodian and unresolved-objection-in-jury-package cases | PER-04 | Epic 6 (F6) | US-6.1, US-6.2 | JTBD-04.2: Both seeded edge cases are flagged automatically, with zero manual intervention required to surface them | R1 |
| Probe the Assistant for Fabrication: ask named questions, then one with no supporting record | PER-04 | Epic 7 (F7) | US-7.2, US-7.3, US-7.4 | JTBD-04.3: 100% of answers reviewed are cited and traceable to a ledger record, with an explicit decline (never a guess) when no record supports a claim, and no role-unauthorized disclosure | R1 |
| Assess Adoption Burden: walk through all five screens imagining non-technical staff use | PER-04 | Epic 4 (F4), Epic 9 (F9), Epic 8 (F8) | US-4.1, US-9.1, US-8.1 | JTBD-04.4: A non-technical reviewer can correctly describe system behavior after a single walkthrough of all five screens, without formal training | R2 (full five-screen burden assessment requires R2's Command Center; R1 supports a four-screen partial assessment) |
| Switch Cases and Confirm Isolation: switch the active case via the Case Selector and confirm every screen and the assistant refetch cleanly with zero cross-case carryover | PER-04 | Epic 22 (F22) | US-22.1, US-22.2, US-22.3 | JTBD-02.5: Selecting a different case updates every open screen and the assistant to refetch exclusively against the newly-selected `caseId`, with zero rows from any other case ever returned, even transiently; JTBD-04.1: Administrator confirms, by direct observation, zero cross-case data leakage on any screen or assistant answer | R4 (inserted Phase 7.1) |
| Assess Adoption Burden: confirm every pre-existing Playwright test contract (`data-testid`/`aria-label`) still resolves correctly after the dark-dashboard reskin, proving the redesign is styling-only | PER-04 | Epic 24 (F24) | US-24.3 | JTBD-04.1: The full pre-existing regression suite passes unmodified against the reskinned UI, with zero test-file edits required solely to chase a renamed selector — the redesign is provably additive, not a silent functional regression | R5 (Phase 8) |
| Make a Recommendation: document the adoption decision | PER-04 | — | — (outside system scope) | — | — |

---

## NaC Derivation Table

| JTBD ID | Outcome | Journey Stage | NaC | Story |
|---------|---------|---------------|-----|-------|
| JTBD-01.1 | Cited live answer in seconds, zero staff delegation | JRN-01.1:Query the Assistant | Assistant returns a cited answer within seconds for a live natural-language question, no menus/filters required | US-7.1 |
| JTBD-01.1 | Cited live answer in seconds, zero staff delegation | JRN-01.1:Receive Cited Answer | Every answer carries a citation to a specific ledger record; citation is visible without an extra tap | US-7.2, US-1.2 |
| JTBD-01.1 | Cited live answer in seconds, zero staff delegation | JRN-02.1:Field "What Was Admitted Yesterday?" | Judge gets a cited answer directly from the assistant; deputy is not a forced intermediary | US-7.1, US-1.2 |
| JTBD-01.1 | Cited live answer in seconds, zero staff delegation | JRN-01.1:Query the Assistant (example prompts) | Example/suggested-question chips reference real seeded `exhibitLabel` values, never a mismatched placeholder | US-15.2 |
| JTBD-01.2 | Ambient trial awareness, zero configuration | JRN-01.2:Glance During Recess | Recent status changes, pending objections, and rulings are visible within 10 seconds of opening the Command Center with no setup | US-8.1 |
| JTBD-01.2 | Ambient trial awareness, zero configuration | JRN-01.2:Spot a Flag | Discrepancy indicators are visually distinct and impossible to scroll past unnoticed; drill-through preserves context | US-8.1, US-8.2, US-6.1, US-6.2 |
| JTBD-01.2 | Ambient trial awareness, zero configuration | JRN-01.2:Glance During Recess (header/activity feed legibility) | No header element is present-and-unexplained; every activity-feed row shows a full date/time and the exhibit label it concerns | US-15.3, US-15.4, US-15.5 |
| JTBD-01.2 | Ambient trial awareness, zero configuration | JRN-01.2:Check the Pending-Ruling Queue | A judge-only queue lists every case-wide unresolved objection sorted by elapsed wait time (longest-waiting first), live-recomputed each poll tick, with direct links into ruling and into full exhibit history | US-21.1, US-21.2 |
| JTBD-01.3 | Jury package acceptance, zero undetected discrepancies | JRN-01.2:Jury Package Presented | Discrepancy gate is visible on the same screen as the jury package; a flagged exhibit cannot silently reach the final list | US-11.1, US-11.2 |
| JTBD-01.3 | Jury package acceptance, zero undetected discrepancies | JRN-01.2:Accept with Confidence | Zero discrepant exhibits appear in a package presented for judicial acceptance | US-11.2, US-6.3 |
| JTBD-01.4 | Instant full exhibit history reconstruction | JRN-01.2:Request History | Full ledger-derived timeline renders instantly, already assembled, with zero manual document assembly | US-10.1 |
| JTBD-01.4 | Instant full exhibit history reconstruction | JRN-02.2:Open Exhibit Detail | A single screen holds the complete story reconstructed directly from the ledger, nothing missing | US-10.1 |
| JTBD-01.4 | Instant full exhibit history reconstruction | JRN-02.2:Confirm via Assistant | History accessible via both direct screen view and natural-language assistant query, and the two agree exactly | US-7.1, US-7.2 |
| JTBD-02.1 | One trustworthy real-time record | JRN-02.1:Log Exhibit Activity | Every status/objection/custody event is an immutable, timestamped ledger entry visible identically on every screen and the assistant | US-0.1, US-1.1, US-2.1, US-3.1, US-9.1 |
| JTBD-02.1 | One trustworthy real-time record | JRN-02.1:Log Exhibit Activity (admission gate) | No invalid `ADMITTED` transition is ever recorded against an exhibit with an unresolved objection or missing custodian; every blocking reason is returned together, and no caller can bypass the gate | US-12.1, US-12.2, US-12.3 |
| JTBD-02.1 | One trustworthy real-time record | JRN-02.1:Field "What Objections Remain Unresolved?" | Objection status is answered directly from the live record, never fragile running notes | US-7.1, US-2.3 |
| JTBD-02.1 | One trustworthy real-time record | JRN-02.2:Walk Through the Timeline | Status, objection, ruling, and custody events are all visible as one trustworthy, ordered record | US-10.1, US-2.2, US-3.3 |
| JTBD-02.1 | One trustworthy real-time record | JRN-02.1:Log Exhibit Activity (classification at intake) | Every exhibit's classification (`TRIAL`/`CHAMBERS_EX_PARTE`/`SEALED`) is a required, immutable field at creation; `CHAMBERS_EX_PARTE`/`SEALED` exhibits are excluded from jury candidacy in the same query as the admitted-status filter | US-16.1, US-16.2 |
| JTBD-02.1 | One trustworthy real-time record | JRN-02.1:Log Exhibit Activity (state-machine regression proof) | A regression suite confirms F12's gate still rejects `OBJECTED → ADMITTED` pre-ruling and still allows a never-objected `OFFERED → ADMITTED` unchanged, with no new validation mechanism introduced | US-17.1, US-17.2 |
| JTBD-02.1 | One trustworthy real-time record | JRN-02.1:Log Exhibit Activity (custodian required at intake) | The first-ever `STATUS_CHANGE` event is rejected with 422 `CUSTODIAN_REQUIRED_AT_INTAKE` unless `custodianUserId` is supplied in the same request, appended atomically with the status event | US-18.1, US-18.2 |
| JTBD-02.1 | One trustworthy real-time record | JRN-02.1:Log Exhibit Activity / Confirm Custody Receipt | Custody-of-record changes only when the identity-matched named receiver confirms a pending transfer, never on the proposer's assertion alone; a cancelled proposal remains visible in history, never erased | US-19.1, US-19.2, US-19.3 |
| JTBD-02.2 | Instant custody answer | JRN-02.1:Log Exhibit Activity / Confirm Custody Receipt (first-assignment bypass) | The exhibit's very first custody link at intake is a single immediately-effective event with no propose/confirm round-trip, so `getCustodian`/`getCustodyHistory` reflect a custodian from the moment of `MARKED` | US-19.4 |
| JTBD-02.1 | One trustworthy real-time record | JRN-02.1:Log Exhibit Activity (server-side role enforcement) | Every one of the ten RBAC-matrix actions resolves the acting role from a server-side `User.role` database lookup and rejects a disallowed role with 403 `ROLE_NOT_PERMITTED` before any field-level or state-machine validation runs — no client-claimed-role bypass exists for any action | US-20.1, US-20.2, US-20.4, US-20.5, US-20.6 |
| JTBD-03.2 | Known objection resolution status | JRN-03.1:Check Objection Resolution (raise-objection permission) | Raising a new objection is rejected with 403 `ROLE_NOT_PERMITTED` for `JUDGE`/`CHAMBERS_STAFF` and succeeds unchanged for `ATTORNEY`/`DEPUTY`/`CLERK`/`ADMIN` — the attorney's own ability to object is a server-enforced permission, distinct from the judge-only ruling gate | US-20.3 |
| JTBD-02.6 | Defensible, versioned proof of exact jury-package contents | JRN-02.1:Assemble the Jury Package (versioning + export) | Every finalization assigns a permanent, sequentially-numbered version atomically with `status = FINALIZED`; the exported PDF is generated server-side and reproduced identically per version, with every prior version independently retrievable and exportable | US-23.1, US-23.2, US-23.3 |
| JTBD-02.5 | Switch between multiple active cases with zero cross-case leakage | JRN-04.1:Switch Cases and Confirm Isolation | Selecting a different case updates every open screen and the assistant to refetch exclusively against the newly-selected `caseId`, with zero rows from any other case ever returned, even transiently | US-22.1, US-22.2, US-22.3 |
| JTBD-04.1 | Immutable, auditable record confirmed (strengthened) | JRN-04.1:Switch Cases and Confirm Isolation | Administrator confirms, by direct observation, zero cross-case data leakage on any screen or assistant answer when switching the active case — the same trustworthy-record guarantee now additionally re-verified per case | US-22.3 |
| JTBD-02.2 | Instant custody answer | JRN-02.1:Answer a Custody Question | "Who currently has custody of Exhibit X" answered in under 5 seconds, zero paper-log lookup | US-3.2 |
| JTBD-02.3 | Provably clean jury package assembly | JRN-02.1:Field "Is Exhibit 14 in the Jury Package?" | Jury-eligible status answered instantly from the current-state projection the screens use | US-7.1, US-5.1, US-6.2 |
| JTBD-02.3 | Provably clean jury package assembly | JRN-02.1:Assemble the Jury Package | Finalization blocked with 409 until every discrepancy flag is resolved or acknowledged; zero manual cross-referencing | US-5.2, US-6.3, US-11.2 |
| JTBD-02.3 | Provably clean jury package assembly | JRN-02.1:Assemble the Jury Package (sealed exclusion + acknowledgment transparency) | A sealed/ex-parte exhibit can never render as eligible/clean and is removable only via an authorized, reason-recorded action; every acknowledgment control discloses who may act and that the action is permanently audited, before it's confirmed | US-13.1, US-13.2, US-13.3, US-14.1, US-14.2, US-14.3 |
| JTBD-02.4 | Fast exhibit location during live testimony | JRN-02.1:Search Mid-Testimony | Combinable filters (ID/keyword/status/witness/date) return matching exhibits in under 10 seconds | US-4.1, US-4.2, US-9.2 |
| JTBD-02.4 | Fast exhibit location during live testimony | JRN-02.1:Search Mid-Testimony (clickable rows) | Any matched exhibit row, flagged or clean, is clickable across its entire row area and keyboard-activatable | US-15.1 |
| JTBD-03.1 | Confirmed exhibit status before acting in argument | JRN-03.1:Confirm Status Before Referencing | Status answers available on demand, fast enough to use live, with zero courtroom-staff intermediary | US-1.2, US-7.1 |
| JTBD-03.2 | Known objection resolution status | JRN-03.1:Check Objection Resolution | Case-wide unresolved-objection query returned in under 10 seconds, replacing personal notes | US-2.3 |
| JTBD-03.3 | Verified custody chain for admissibility challenge | JRN-03.1:Challenge a Custody Gap | Full timestamped custody history retrievable without a formal evidentiary request; gaps visually distinguishable | US-3.3, US-10.1 |
| JTBD-03.4 | Verified jury package integrity | JRN-03.1:Verify Jury Package Integrity | Discrepancy warnings, if any, are visible directly on the jury package view itself | US-11.1, US-6.2 |
| JTBD-03.4 | Verified jury package integrity | JRN-03.1:Confirm with the Assistant | Assistant's jury-eligibility answer cites the exact same computed status the screen shows | US-7.1, US-5.1 |
| JTBD-04.1 | Immutable, auditable record confirmed | JRN-04.1:Review the Walkthrough | Seeded scenario runs start-to-finish with zero manual data entry; every event traceable to an append-only ledger record | US-0.2, US-0.3, US-7.1, US-8.1 |
| JTBD-04.1 | Immutable, auditable record confirmed | JRN-04.1:Spot-Check Cross-Screen Consistency | 100% agreement across every screen for the same exhibit, including identical sealed-exhibit "not found" behavior | US-9.1, US-10.1, US-10.2, US-11.1 |
| JTBD-04.2 | Automatic discrepancy detection confirmed | JRN-04.1:Test Discrepancy Detection | Both seeded edge cases (admitted-no-custodian, unresolved-objection-in-jury-package) flagged automatically, zero manual intervention | US-6.1, US-6.2 |
| JTBD-04.3 | Zero ungrounded assistant claims confirmed | JRN-04.1:Probe the Assistant for Fabrication | 100% of reviewed answers cited and traceable to a ledger record; explicit decline (never a guess) when unsupported; no role-unauthorized disclosure | US-7.2, US-7.3, US-7.4 |
| JTBD-04.4 | Low adoption burden confirmed | JRN-04.1:Assess Adoption Burden | Non-technical reviewer correctly describes system behavior after a single walkthrough of all five screens, without formal training | US-4.1, US-9.1, US-8.1 |
| JTBD-01.5 | Ruling recorded directly from the UI, zero deputy/clerk intermediary | JRN-01.3:Open Record Ruling / Select Disposition | Disposition selector offers exactly Sustained/Overruled/Reserved scoped to one `objectionId`; a non-judge sees no control anywhere and a direct API call is rejected with 403 | US-24.1 |
| JTBD-01.5 | Ruling recorded directly from the UI, zero deputy/clerk intermediary | JRN-01.3:See It Resolved Everywhere | Sustained/Overruled clears the attention-feed entry on the next poll tick; Reserved leaves it open and re-ranked, with zero deputy/clerk intermediary | US-24.1 |
| JTBD-01.6 | Severity-ranked feed replaces manual panel cross-referencing | JRN-01.2:Glance During Recess (attention feed) | Critical/High/Pending/Medium items render in strict tier order, newest-first within tier, with zero lower-tier item preceding a higher one | US-8.4 |
| JTBD-01.7 | Finalization requested with zero out-of-band communication | JRN-01.2:Request Finalization | "Request finalization from Clerk" produces a timestamped request visible as a banner to every finalize-authorized role on next screen load; a finalize-authorized role cannot call the request endpoint themselves (403) | US-11.3 |
| JTBD-02.7 | Custody assigned/transferred in one screen, zero API workaround | JRN-02.2:Open Exhibit Detail (right-rail + header actions) | Header "Transfer custody" renders only for an F20-authorized role or the named pending-transfer receiver; every right-rail card derives state from the same `getExhibitHistory` payload the timeline renders from | US-10.3 |
| JTBD-02.7 | Custody assigned/transferred in one screen, zero API workaround | JRN-02.3:Spot a Medium-Tier Flag / Assign Custodian Inline | The correct action (assign, propose, confirm, cancel) is invoked automatically based on current custody state, with an explicit confirm step and no manual endpoint selection | US-24.2 |
| JTBD-02.8 | Every custodian's holdings visible case-wide, zero per-exhibit visits | JRN-02.3:Glance at Custody Panel | Exhibits are grouped by current custodian with a distinct pending-transfer grouping, requiring zero navigation into individual Exhibit Detail pages | US-8.3 |
| JTBD-02.9 | Flagged attention-feed item resolved inline, zero navigation away | JRN-02.3:Confirm Resolution | A successful inline action clears or re-ranks its originating feed entry on the next poll tick, with no screen-local optimistic state that could diverge from the ledger | US-24.2 |
| JTBD-02.4 | Fast exhibit location during live testimony (strengthened) | JRN-02.1:Log Exhibit Activity (quick-filter triage) | One-click quick-filter chips (Needs attention/In my custody/Awaiting ruling) narrow the visible row set, and the Jury Package eligibility badge is never computed independently of what the Jury Package Workspace shows for the same exhibit | US-9.3 |
| JTBD-04.1 | Immutable, auditable record confirmed (strengthened — reskin regression-free) | JRN-04.1:Assess Adoption Burden (test-contract preservation) | The full pre-existing Playwright regression suite passes unmodified against the reskinned UI; new Phase 8 surfaces introduce additive `data-testid`/`aria-label` contracts without colliding with any existing identifier | US-24.3 |

---

## Release Planning

### Release R1: "Core Demo Scenario — Trustworthy Record, Assistant, and Jury Package Gate"

**Theme:** Everything required for the named core demo scenario (JRN-02.1) to run end-to-end, live or recorded, plus every other journey stage that scenario's own stories unlock for the other three personas.

**Stories:** US-0.1, US-0.2, US-0.3, US-1.1, US-1.2, US-2.1, US-2.2, US-2.3, US-3.1, US-3.2, US-3.3, US-4.1, US-4.2, US-5.1, US-5.2, US-6.1, US-6.2, US-6.3, US-7.1, US-7.2, US-7.3, US-7.4, US-9.1, US-9.2, US-10.1, US-10.2, US-11.1, US-11.2 (28 stories)

**Personas Served:** PER-01 (JRN-01.1 complete; JRN-01.2 partial — Request History/Jury Package stages complete, Glance/Spot-a-Flag deferred to R2), PER-02 (JRN-02.1 complete; JRN-02.2 complete), PER-03 (JRN-03.1 complete), PER-04 (JRN-04.1 partial — Spot-Check, Discrepancy Detection, and Fabrication-probe stages complete; full five-screen walkthrough and adoption-burden assessment deferred to R2)

**JTBD Addressed:** JTBD-01.1, JTBD-01.3, JTBD-01.4, JTBD-02.1, JTBD-02.2, JTBD-02.3, JTBD-02.4, JTBD-03.1, JTBD-03.2, JTBD-03.3, JTBD-03.4, JTBD-04.1, JTBD-04.2, JTBD-04.3

**Acceptance Gate:**
- [ ] All NaC for the 28 included stories pass against seeded data
- [ ] JRN-02.1 (core demo scenario) runs start-to-finish with zero manual data entry
- [ ] Zero discrepant exhibits can reach a finalized jury package (US-5.2, US-11.2 hard gate verified)
- [ ] 100% of the five named example questions are answered correctly and cited (US-7.1, US-7.2)
- [ ] PER-01, PER-02, PER-03 can each complete at least one full journey end-to-end without the Trial Command Center

---

### Release R2: "Ambient Awareness and Full Adoption Walkthrough"

**Theme:** Adds the Trial Command Center (F8) — explicitly sequenced after core data/assistant features in the PRD — completing the judge's passive-glance stages and the administrator's full five-screen evaluation.

**Stories:** US-8.1, US-8.2 (2 stories)

**Personas Served:** PER-01 (JRN-01.2 completed end-to-end), PER-04 (JRN-04.1 completed end-to-end — full five-screen walkthrough and adoption-burden assessment)

**JTBD Addressed:** JTBD-01.2, JTBD-04.4 (fully); strengthens evidence for JTBD-04.1 and JTBD-04.3 (full walkthrough context)

**Acceptance Gate:**
- [ ] All NaC for US-8.1 and US-8.2 pass against seeded data
- [ ] JRN-01.2 and JRN-04.1 each run end-to-end without reverting to any R1-only workaround
- [ ] Release extends journey depth without breaking any R1 flow (Command Center drill-through lands on the correct R1 detail screens)

---

### Release R3: "Admission Integrity and Courtroom Usability Hardening"

**Theme:** Closes the single most damaging failure mode in this domain — a sealed/ex-parte exhibit reaching the jury package — and its admission-side counterpart (an exhibit reaching `ADMITTED` status over an unresolved objection or missing custodian) with hard, structural gates. Then clears the courtroom usability friction (unclickable rows, placeholder assistant prompts, unexplained header elements, ambiguous activity-feed timestamps, unattributed activity-feed rows) that a live demo or real adoption review would otherwise surface. Maps to Phase 7 of the roadmap.

**Stories:** US-12.1, US-12.2, US-12.3, US-13.1, US-13.2, US-13.3, US-14.1, US-14.2, US-14.3, US-15.1, US-15.2, US-15.3, US-15.4, US-15.5 (14 stories)

**Personas Served:** PER-02 (admission gate hard-blocks an invalid `ADMITTED` transition during Log Exhibit Activity; jury package assembly now structurally excludes sealed exhibits and discloses acknowledgment transparency; Case Workspace rows fully clickable during Search Mid-Testimony), PER-01 (Command Center header and activity feed fully legible during Glance During Recess; assistant example prompts grounded in real exhibit labels during Query the Assistant), PER-04 (admission integrity and sealed-exclusion hardening directly strengthen the evidence reviewed during Probe the Assistant for Fabrication and Test Discrepancy Detection)

**JTBD Addressed:** JTBD-02.1 (strengthened — admission gate), JTBD-02.3 (strengthened — zero sealed exhibits in jury package, visible acknowledgment transparency), JTBD-02.4 (strengthened — fully clickable rows), JTBD-01.1 (strengthened — grounded assistant examples), JTBD-01.2 (strengthened — legible ambient header/activity feed). No new JTBD IDs are introduced in this release — all 14 stories harden or clarify outcomes already committed to in R1/R2.

**Acceptance Gate:**
- [ ] All NaC for the 14 included stories pass against seeded data
- [ ] No invalid `ADMITTED` transition can ever be recorded against an exhibit with an unresolved objection or missing custodian, via any caller — UI, direct API, or seed loader (US-12.1, US-12.3)
- [ ] A seeded sealed/ex-parte exhibit marked `ADMITTED` never appears as eligible/clean in `computeJuryCandidates`, the Jury Package Workspace, or the assistant's `getJuryPackageStatus` (US-13.1)
- [ ] Every Case Workspace exhibit row — flagged or clean — is clickable across its full row area and keyboard-activatable (US-15.1)
- [ ] Zero example assistant prompts reference an `exhibitLabel` absent from the active case's seed data (US-15.2)
- [ ] No header element renders unlabeled, and no activity-feed row renders without both a full date/time and its exhibit label (US-15.3, US-15.4, US-15.5)
- [ ] Release introduces zero regressions to any R1/R2 flow (admission gate, sealed exclusion, and row-click fixes are additive hardening, not behavior changes to existing valid paths)

---

### Release R4 (INSERTED): "Exhibit Classification, State-Machine Hardening, Custody Handoff, Server-Side RBAC, and Jury-Package Versioning/Export"

**Theme:** An urgent insertion — mirroring the Roadmap's decimal-phase convention (Phase 7.1, INSERTED, between Phase 7 and the next integer phase) — that closes four structural gaps Phase 7 did not reach: (1) exhibit sensitivity was discoverable only after the fact, not fixed at intake, (2) a custody handoff was recordable on the proposer's unilateral say-so with no acknowledgment from the receiving party, (3) every write action's legality rested on what the client UI happened to render rather than a server-side check, and (4) a jury package finalization destroyed its own history with no permanent, re-exportable record. It also adds two judge/administrator-facing capabilities the existing screens had no home for: a judge-only pending-ruling triage queue, and multi-case switching with provable isolation.

**Stories:** US-16.1, US-16.2, US-17.1, US-17.2, US-18.1, US-18.2, US-19.1, US-19.2, US-19.3, US-19.4, US-20.1, US-20.2, US-20.3, US-20.4, US-20.5, US-20.6, US-21.1, US-21.2, US-22.1, US-22.2, US-22.3, US-23.1, US-23.2, US-23.3 (24 stories)

**Personas Served:** PER-02 (every exhibit is classified immutably at intake and a custodian is required atomically at first `MARKED`; a custody handoff is only a proposal until the named receiver confirms it; every write action on Log Exhibit Activity is checked against the acting user's actual server-resolved role; jury package finalization now produces a permanent, versioned, exportable PDF), PER-03 (raising an objection is now an explicitly server-enforced attorney permission during Check Objection Resolution, not an assumed UI affordance), PER-01 (a new judge-only Pending-Ruling Queue lets Elena triage every unresolved objection case-wide by elapsed wait time, rather than discovering them ad hoc during Glance During Recess), PER-04 (a new Case Selector lets Priya switch the active case and directly confirm zero cross-case data leakage across every screen and the assistant)

**JTBD Addressed:** JTBD-02.1 (strengthened — exhibit classification at intake, state-machine regression-proofing, custodian-required-at-intake, custody handoff confirmation, server-side RBAC), JTBD-02.2 (strengthened — first-custody-assignment bypass keeps the instant-lookup guarantee intact), JTBD-03.2 (strengthened — objection-raising is now a server-enforced attorney permission), JTBD-01.2 (strengthened — pending-ruling queue adds case-wide triage to ambient awareness), JTBD-02.5 (new — switch between multiple active cases with zero cross-case leakage), JTBD-02.6 (new — defensible, versioned proof of exact jury-package contents), JTBD-04.1 (strengthened — administrator directly confirms cross-case isolation). Per JTBD-JudicialSync.md's own changelog, only JTBD-02.5 and JTBD-02.6 are new job entries; F16–F21 are documented as hardening of jobs already committed to in R1–R3.

**Acceptance Gate:**
- [ ] All NaC for the 24 included stories pass against seeded data
- [ ] `classification` is required and immutable on every exhibit, and `CHAMBERS_EX_PARTE`/`SEALED` exhibits are excluded from `computeJuryCandidates` in the same query as the admitted-status filter (US-16.1, US-16.2)
- [ ] A regression suite confirms F12's admission gate still rejects `OBJECTED → ADMITTED` pre-ruling and still allows a never-objected `OFFERED → ADMITTED` through unchanged (US-17.1, US-17.2)
- [ ] The first-ever `MARKED` transition is rejected with 422 `CUSTODIAN_REQUIRED_AT_INTAKE` with no `custodianUserId` supplied, for every caller including the seed loader (US-18.1, US-18.2)
- [ ] A custody transfer only becomes effective once the exact named receiver — identity-matched, not role-matched — confirms it; no proposer or other role can confirm on the receiver's behalf (US-19.1, US-19.2, US-19.4)
- [ ] Every one of the ten RBAC-matrix actions resolves the acting role from a server-side `User.role` lookup and rejects a disallowed role with 403 `ROLE_NOT_PERMITTED`, never trusting a client-supplied role claim (US-20.1–US-20.6)
- [ ] The Pending-Ruling Queue is reachable only by `JUDGE` role, sorted longest-wait-first, and live-recomputes elapsed time on every poll tick (US-21.1, US-21.2)
- [ ] Switching the active case via the Case Selector causes every open screen and the assistant to refetch exclusively against the newly-selected `caseId`, with zero rows from the prior case observable at any point, even transiently (US-22.1, US-22.2, US-22.3)
- [ ] Every jury package finalization assigns a unique, permanent version number, and `GET /api/jury-package/:id/export` produces a real, deterministic PDF for any version, past or present (US-23.1, US-23.2, US-23.3)
- [ ] Release introduces zero regressions to any R1/R2/R3 flow (classification, custody handoff, RBAC, queue, multi-case, and versioning are additive structural hardening, not behavior changes to existing valid paths)

---

### Release R5: "UI Redesign and Write-Action Coverage"

**Theme:** Maps to Phase 8 of the roadmap. Replaces the Carbon-light visual foundation across Command Center, Case Workspace, Exhibit Detail, and Jury Package with the reviewed dark-dashboard design, and — for the first time in this product — ships a UI for the two write actions (`recordRuling`, `recordCustodyTransfer`) that have existed only as backend-only service functions since Phase 1/Phase 7.1. This release also supersedes Phase 5's "strictly passive/read-only" constraint on the Command Center by design: the attention feed's inline actions are the explicit point of this phase, not an accidental scope creep.

**Stories:** US-8.3, US-8.4, US-9.3, US-10.3, US-11.3, US-24.1, US-24.2, US-24.3 (8 stories)

**Personas Served:** PER-01 (a new severity-ranked "Needs Your Attention" feed replaces three separate Command Center panels during Glance During Recess; a new "Request finalization from Clerk" action closes the out-of-band request gap during Jury Package review; a brand-new journey, JRN-01.3, lets Elena record a ruling directly from the feed or an exhibit's Objection card with zero deputy/clerk intermediary — the first ruling-recording UI this product has ever had), PER-02 (a new "Custody at a glance" panel and a brand-new journey, JRN-02.3, let Dana/the Clerk see every custodian's holdings case-wide and resolve a flagged custody gap inline without leaving the Command Center — the first custody-transfer UI this product has ever had; Case Workspace gains quick-filter triage chips and a per-row jury-eligibility badge; Exhibit Detail gains actionable right-rail cards and header actions), PER-04 (confirms, via US-24.3, that the full pre-existing Playwright regression suite and every `data-testid`/`aria-label` contract survive the dark-theme reskin unmodified — the redesign is provably additive, not a silent regression)

**JTBD Addressed:** JTBD-01.5 (new — ruling recorded directly from the UI), JTBD-01.6 (new — severity-ranked single-feed triage), JTBD-01.7 (new — finalization requested with zero out-of-band ask), JTBD-02.7 (new — custody assigned/transferred in one screen), JTBD-02.8 (new — custodian holdings visible case-wide), JTBD-02.9 (new — flagged item resolved inline); strengthens JTBD-02.4 (quick-filter triage) and JTBD-04.1 (regression-free reskin, test-contract preservation). Per JTBD-JudicialSync.md's own changelog, all six JTBD-01.5–01.7/02.7–02.9 entries are new jobs added specifically for Phase 8.

**Acceptance Gate:**
- [ ] All NaC for the 8 included stories pass against seeded data
- [ ] "Record ruling" is reachable only from a `JUDGE`-role view (attention feed and Objection card), is scoped to a single named `objectionId`, and a non-judge direct API call is independently rejected with 403 `ROLE_NOT_PERMITTED` (US-24.1)
- [ ] Assigning/transferring/confirming/cancelling custody from the UI invokes the correct underlying action automatically based on current custody state, with a 409 `CUSTODY_CHAIN_BROKEN` surfaced inline on a stale-state attempt, never a silent no-op (US-24.2)
- [ ] The full pre-existing Playwright regression suite (Command Center, Case Workspace, Exhibit Detail, Jury Package Workspace) passes unmodified against the reskinned UI, with zero test-file edits required solely to chase a renamed selector (US-24.3)
- [ ] The Command Center's "Needs Your Attention" feed renders every item in strict Critical > High > Pending > Medium tier order, newest-first within tier (US-8.4)
- [ ] The "Custody at a glance" panel groups every exhibit by current custodian, with pending transfers shown in a visually distinct grouping (US-8.3)
- [ ] A non-finalize-authorized role sees "Request finalization from Clerk" in place of a Finalize control, and a finalize-authorized role sees the resulting request as a banner on their own next screen load (US-11.3)
- [ ] Release introduces zero regressions to any R1/R2/R3/R4 flow — this is a styling and additive-write-action release, not a behavior change to any existing valid path

---

## Coverage Analysis

### Persona Coverage

| Persona | R1 | R2 | R3 | R4 | R5 |
|---------|----|----|----|----|----|
| PER-01 (Judge Elena Marsh) | US-7.1, US-7.2, US-1.2, US-10.1, US-11.1, US-11.2, US-6.3 | US-8.1, US-8.2, US-6.1, US-6.2 | US-14.3, US-15.2, US-15.4, US-15.5 | US-21.1, US-21.2 | US-8.4, US-11.3, US-24.1 |
| PER-02 (Courtroom Deputy Dana Reyes) | US-0.1, US-1.1, US-2.1, US-2.2, US-2.3, US-3.1, US-3.2, US-3.3, US-4.1, US-4.2, US-5.1, US-5.2, US-6.2, US-6.3, US-7.1, US-7.2, US-9.1, US-9.2, US-10.1, US-11.2 | — | US-12.1, US-12.2, US-13.1, US-13.2, US-13.3, US-14.1*, US-14.2 | US-16.1, US-16.2, US-17.1, US-17.2, US-18.1, US-18.2, US-19.1, US-19.2, US-19.3, US-19.4, US-20.1, US-20.2, US-20.4, US-20.5, US-20.6, US-23.1, US-23.2, US-23.3 | US-8.3, US-9.3, US-10.3, US-24.2 |
| PER-03 (Attorney Marcus Webb) | US-1.2, US-7.1, US-2.3, US-3.3, US-10.1, US-11.1, US-6.2, US-5.1 | — | US-15.1 | US-20.3 | — |
| PER-04 (Administrator Priya Nair) | US-0.2, US-0.3, US-9.1, US-10.1, US-10.2, US-11.1, US-6.1, US-6.2, US-7.2, US-7.3, US-7.4, US-4.1 | US-8.1 (full walkthrough + adoption-burden stages) | US-12.3, US-15.3 | US-22.1, US-22.2, US-22.3 | US-24.3 |

*US-14.1 ("any courtroom user") is cross-persona-visible — its acknowledge-control role gating renders identically for PER-01 and PER-03 as well; listed under PER-02 as the deputy is the primary actor on the Jury Package Workspace where it was authored.

### JTBD Coverage

| JTBD ID | Release | Stories | NaC Count |
|---------|---------|---------|-----------|
| JTBD-01.1 | R1 | US-7.1, US-7.2, US-1.2 | 3 |
| JTBD-01.2 | R2 | US-8.1, US-8.2, US-6.1, US-6.2 | 2 |
| JTBD-01.3 | R1 | US-11.1, US-11.2, US-6.3 | 2 |
| JTBD-01.4 | R1 | US-10.1, US-7.1, US-7.2 | 3 |
| JTBD-02.1 | R1 | US-0.1, US-1.1, US-2.1, US-3.1, US-9.1, US-2.3, US-10.1, US-2.2, US-3.3 | 3 |
| JTBD-02.2 | R1 | US-3.2 | 1 |
| JTBD-02.3 | R1 | US-7.1, US-5.1, US-6.2, US-5.2, US-6.3, US-11.2 | 2 |
| JTBD-02.4 | R1 | US-4.1, US-4.2, US-9.2 | 1 |
| JTBD-03.1 | R1 | US-1.2, US-7.1 | 1 |
| JTBD-03.2 | R1 | US-2.3 | 1 |
| JTBD-03.3 | R1 | US-3.3, US-10.1 | 1 |
| JTBD-03.4 | R1 | US-11.1, US-6.2, US-7.1, US-5.1 | 2 |
| JTBD-04.1 | R1 (partial) / R2 (full) | US-0.2, US-0.3, US-7.1, US-8.1, US-9.1, US-10.1, US-10.2, US-11.1 | 2 |
| JTBD-04.2 | R1 | US-6.1, US-6.2 | 1 |
| JTBD-04.3 | R1 | US-7.2, US-7.3, US-7.4 | 1 |
| JTBD-04.4 | R2 | US-4.1, US-9.1, US-8.1 | 1 |
| JTBD-01.1 | R3 (strengthened) | US-15.2 | +1 |
| JTBD-01.2 | R3 (strengthened) | US-15.3, US-15.4, US-15.5 | +1 |
| JTBD-02.1 | R3 (strengthened) | US-12.1, US-12.2, US-12.3 | +1 |
| JTBD-02.3 | R3 (strengthened) | US-13.1, US-13.2, US-13.3, US-14.1, US-14.2, US-14.3 | +1 |
| JTBD-02.4 | R3 (strengthened) | US-15.1 | +1 |
| JTBD-02.1 | R4 (strengthened) | US-16.1, US-16.2, US-17.1, US-17.2, US-18.1, US-18.2, US-19.1, US-19.2, US-19.3, US-20.1, US-20.2, US-20.4, US-20.5, US-20.6 | +5 |
| JTBD-02.2 | R4 (strengthened) | US-19.4 | +1 |
| JTBD-03.2 | R4 (strengthened) | US-20.3 | +1 |
| JTBD-01.2 | R4 (strengthened) | US-21.1, US-21.2 | +1 |
| JTBD-04.1 | R4 (strengthened) | US-22.3 | +1 |
| JTBD-02.5 | R4 (new) | US-22.1, US-22.2, US-22.3 | 1 |
| JTBD-02.6 | R4 (new) | US-23.1, US-23.2, US-23.3 | 1 |
| JTBD-01.5 | R5 (new) | US-24.1 | 1 |
| JTBD-01.6 | R5 (new) | US-8.4 | 1 |
| JTBD-01.7 | R5 (new) | US-11.3 | 1 |
| JTBD-02.7 | R5 (new) | US-10.3, US-24.2 | 2 |
| JTBD-02.8 | R5 (new) | US-8.3 | 1 |
| JTBD-02.9 | R5 (new) | US-24.2 | 1 |
| JTBD-02.4 | R5 (strengthened) | US-9.3 | +1 |
| JTBD-04.1 | R5 (strengthened) | US-24.3 | +1 |

### Gap Analysis

- **JTBD-04.1 spans both releases:** ledger immutability and cross-screen consistency are fully verifiable in R1 (US-0.3, US-9.1, US-10.1, US-10.2, US-11.1), but the administrator's *complete* walkthrough narrative (JRN-04.1:Review the Walkthrough) only closes once the Command Center ships in R2 — flagged as a partial-coverage item, not a missing one.
- **JTBD-04.4 fully deferred to R2:** the adoption-burden assessment is explicitly scoped against "all five screens" in JRN-04.1; with only four screens live in R1, this JTBD cannot be fully satisfied until US-8.1 ships. R1 supports only a four-screen partial read.
- **No orphan stories:** all 77 UserStories (US-0.1 through US-24.3) are placed in at least one lane above. Cross-check against the UserStories summary table confirms full placement — including the 14 Phase 7 stories (US-12.1 through US-15.5) placed in Release R3, the 24 Phase 7.1 stories (US-16.1 through US-23.3) placed in Release R4, and the 8 Phase 8 stories (US-8.3, US-8.4, US-9.3, US-10.3, US-11.3, US-24.1, US-24.2, US-24.3) placed in Release R5.
- **No uncovered journey stages:** every stage in every journey (JRN-01.1, JRN-01.2, JRN-01.3, JRN-02.1, JRN-02.2, JRN-02.3, JRN-03.1, JRN-04.1) maps to at least one story, with the sole exception of stages explicitly outside system scope — "Question Arises" (JRN-01.1, pre-system bench awareness), "Request Arrives" and "Report Back" (JRN-02.2, verbal courtroom exchange), and "Make a Recommendation" (JRN-04.1, the administrator's own written output) — none of these represent a gap, as the journeys themselves mark them as non-system touchpoints. This now includes Phase 7.1's three updated JRN-02.1 touchpoints ("Log Exhibit Activity," newly widened; "Confirm Custody Receipt," newly added), JRN-01.2's "Check the Pending-Ruling Queue" and JRN-04.1's "Switch Cases and Confirm Isolation" (Phase 7.1), and Phase 8's "Request Finalization" stage added to JRN-01.2 plus the two brand-new journeys JRN-01.3 (Recording a Ruling Without Leaving the Screen) and JRN-02.3 (Command Center Custody Glance and Inline Resolution).
- **No JTBD without a derived NaC:** all 24 JTBD IDs (JTBD-01.1 through JTBD-04.4, including the two Phase 7.1 additions JTBD-02.5/JTBD-02.6 and the six Phase 8 additions JTBD-01.5–01.7/JTBD-02.7–02.9) appear in the NaC Derivation Table with at least one testable criterion and at least one story.
- **Phase 7 / Release R3 introduces no new epics, journeys, or JTBD IDs:** all 14 new stories (Epics 12–15) are hardening/clarity fixes placed against existing backbone activities — "Log Exhibit Activity" (admission gate), "Assemble the Jury Package" (sealed exclusion + acknowledgment transparency), "Search Mid-Testimony" (clickable rows), "Query the Assistant" (grounded example prompts), and "Glance During Recess" (header/activity-feed legibility). No journey stage required a new row category to accommodate them, confirming the existing backbone was structurally sufficient for this phase.
- **Phase 7.1 / Release R4 introduces exactly two new backbone activities, both independently justified by JOURNEYS-JudicialSync.md adding a genuinely new journey stage with no existing-activity fit:** (1) **"Check the Pending-Ruling Queue"** under PER-01's JRN-01.2 — no existing activity covered a judge-only, case-wide, wait-time-sorted objection triage view (the closest existing row, "Spot a Flag," is a single-exhibit discrepancy indicator, not a queue); and (2) **"Switch Cases and Confirm Isolation"** under PER-04's JRN-04.1 — no existing activity covered multi-case selection or cross-case leakage verification, since every prior journey and screen assumed exactly one active case. All 20 of the remaining 24 Phase 7.1 stories were placed against existing backbone activities: classification (US-16.x), state-machine regression-proofing (US-17.x), custodian-at-intake (US-18.x), custody handoff (US-19.x), and the bulk of server-side RBAC (US-20.1, 20.2, 20.4, 20.5, 20.6) all landed on PER-02's existing "Log Exhibit Activity" row-family (extended with new rows, mirroring how Phase 7's admission-gate stories were added as new rows under the same activity rather than a new one); the objection-raising RBAC story (US-20.3) landed on PER-03's existing "Check Objection Resolution" row; and jury-package versioning/export (US-23.x) landed on PER-02's existing "Assemble the Jury Package" row. JTBD-02.5 and JTBD-02.6 are the only new JTBD IDs introduced for this phase (per JTBD-JudicialSync.md's own changelog); every other Phase 7.1 story strengthens a JTBD outcome already committed to in R1–R3.
- **Phase 8 / Release R5 introduces one new epic (Epic 24: Write-Action UI Coverage) and exactly two new journeys, both justified by JOURNEYS-JudicialSync.md as genuinely new scenarios with no existing-journey fit:** (1) **JRN-01.3 (Recording a Ruling Without Leaving the Screen)** — no existing PER-01 journey covered the judge recording a ruling herself; `recordRuling` has been a backend-only service function since Phase 1, with zero UI entry point until US-24.1; and (2) **JRN-02.3 (Command Center Custody Glance and Inline Resolution)** — no existing PER-02 journey covered a case-wide custody-by-custodian view or inline custody assignment from the Command Center; `recordCustodyTransfer` likewise had no UI entry point until US-24.2. The remaining four stories extend existing backbone activities as new rows (mirroring the Phase 7/7.1 pattern): US-8.4 (severity-ranked attention feed) and US-11.3 (request finalization) extend PER-01's existing JRN-01.2 lane; US-9.3 (quick-filter triage) extends PER-02's existing JRN-02.1 "Log Exhibit Activity" row-family; US-10.3 (right-rail cards + header actions) extends PER-02's existing JRN-02.2 "Open Exhibit Detail" stage; and US-24.3 (test-contract preservation) extends PER-04's existing JRN-04.1 lane. Six new JTBD IDs are introduced for this phase — JTBD-01.5, JTBD-01.6, JTBD-01.7, JTBD-02.7, JTBD-02.8, JTBD-02.9 (per JTBD-JudicialSync.md's own changelog) — while US-9.3 and US-24.3 strengthen JTBD-02.4 and JTBD-04.1 respectively, both already committed to in earlier releases. Phase 8 explicitly supersedes Phase 5's "Command Center is strictly passive/read-only" success criterion by design (per ROADMAP.md's Phase 8 Context note) — this is a deliberate, called-out scope change, not a silent regression.

---

## NaC-to-Acceptance Criteria Mapping

| NaC | Story | AC from UserStories | Aligned? |
|-----|-------|---------------------|----------|
| JTBD-01.1: Assistant returns a cited answer within seconds | US-7.1 | "The assistant answers the five named example questions... correctly against seed data"; "Responses stream to the chat panel via... `useChat`" | Yes |
| JTBD-01.1: Every answer carries a citation to a ledger record | US-7.2 | "Every factual sentence in an assistant response has at least one inline citation... visibly rendered"; "Zero instances exist of a factual claim with no associated citation" | Yes |
| JTBD-01.2: Discrepancies surfaced visually without manual filter | US-8.1 | "Screen displays three panels: Recent Activity, Unresolved Objections, and Discrepancies, each with counts and lists"; "no data-entry controls — read-only" | Yes |
| JTBD-01.3: Zero discrepant exhibits in the finalized package | US-11.2 | "Finalization re-validates server-side... rejecting with 409 if any open discrepancy remains"; "Once finalized... no acknowledge/resolve/remove controls" | Yes |
| JTBD-01.4: Full timeline renders instantly with zero manual assembly | US-10.1 | "The timeline renders one entry per ledger event in sequence order, with no filtering or truncation"; "matching the assistant's `getExhibitHistory` answer exactly" | Yes |
| JTBD-02.1: Every event is an immutable, timestamped ledger entry | US-0.3 | "`ExhibitEvent` rows are never updated or deleted after creation"; "Current-state projections... can be fully rebuilt by replaying ledger events" | Yes |
| JTBD-02.2: Custody answered in under 5 seconds, zero paper-log lookup | US-3.2 | "`getCustodian(exhibitId)` returns the current custodian... not a manual log"; "same lookup result... identically whether viewed on Case Workspace, Exhibit Detail, or asked via the assistant" | Yes |
| JTBD-02.3: Finalization blocked until discrepancies resolved | US-5.2 | "Finalization is rejected with 409 `JURY_PACKAGE_DISCREPANCIES_OPEN` if any included exhibit has an `OPEN` discrepancy" | Yes |
| JTBD-02.4: Exhibits located in under 10 seconds via combinable filters | US-4.1 | "Filters combine with AND semantics in a single query"; "At least one search criterion must be supplied" | Yes |
| JTBD-03.2: Case-wide unresolved-objection query under 10 seconds | US-2.3 | "`getUnresolvedObjections` returns identical results whether called from Case Workspace, Command Center, or the assistant"; "`RESERVED` rulings still count as unresolved" | Yes |
| JTBD-03.3: Full custody history with gaps visually distinguishable | US-3.3 | "`getCustodyHistory(exhibitId)` returns every `CUSTODY_TRANSFER` event in chronological order... History is complete — no filtering or truncation" | Yes (gap visibility verified via US-6.1's `ADMITTED_NO_CUSTODIAN` flag, not US-3.3 directly — see note) |
| JTBD-03.4: Discrepancy warnings visible directly on jury package view | US-11.1 | "Each row shows exhibit label, status badge, and a discrepancy warning badge when `discrepancyStatus` is `FLAGGED`" | Yes |
| JTBD-04.1: 100% of events traceable to an immutable ledger record | US-0.3 | "No UI or assistant code path writes directly to a current-state table — `recordEvent()` is the sole write path" | Yes |
| JTBD-04.2: Both seeded edge cases flagged automatically | US-6.1, US-6.2 | "Rule `ADMITTED_NO_CUSTODIAN` fires... automatically by the rule engine... never manually created by a user"; "Rule `UNRESOLVED_OBJECTION_JURY_ELIGIBLE` fires... updates to `RESOLVED` automatically" | Yes |
| JTBD-04.3: Explicit decline when no record supports a claim | US-7.3 | "If no tool call returns a relevant record, the assistant responds with an explicit 'I don't have that information' statement"; "treated as valid, expected behavior in testing, not a failure mode" | Yes |
| JTBD-04.3: No role-unauthorized disclosure via the assistant | US-7.4 | "A sealed exhibit is excluded from assistant tool results identically to... UI queries"; "the assistant declines without revealing that a matching record exists" | Yes |
| JTBD-04.4: Non-technical reviewer describes behavior without training | US-9.1 | "list includes every visible exhibit... with exhibit label, description, offering party, witness, status badge, current custodian, and discrepancy indicator" | Yes (screen clarity supports the claim; formal "no training required" measure is evaluator judgment, not a system AC) |
| JTBD-02.1: No invalid `ADMITTED` transition over an unresolved objection or missing custodian | US-12.1 | "A `toStatus = ADMITTED` request is rejected with 422 `ADMISSION_BLOCKED` when ≥1 `ObjectionCurrentState` row... has `status = 'UNRESOLVED'`"; "...when no `CustodyCurrentState` row exists... or its `currentCustodianUserId` is null" | Yes |
| JTBD-02.1: Every blocking reason surfaced at once, gate enforced with no override | US-12.2, US-12.3 | "the rejection response's `reasons[]` array contains both `UNRESOLVED_OBJECTION` and `NO_CUSTODIAN` entries, not just one"; "There is no 'force admit' parameter, admin-role override, or alternate code path that bypasses either check" | Yes |
| JTBD-02.3: Zero sealed/ex-parte exhibits ever reach eligible/clean status | US-13.1 | "`computeJuryCandidates(caseId)` queries... `AND exhibit.isSealed = false`"; "A seeded sealed exhibit marked `ADMITTED`... never appears in `computeJuryCandidates`'s result set" | Yes |
| JTBD-02.3: Sealed exhibit removable only via an authorized, reason-recorded action | US-13.2, US-13.3 | "Exclusion appends an immutable `JURY_PACKAGE_EXHIBIT_EXCLUDED` ledger event (`reason: 'SEALED_EXPARTE'`)"; "rendered with explicit labeling (e.g., 'Sealed material — must be removed') instead of either `CLEAN` or `FLAGGED`" | Yes |
| JTBD-02.3: Acknowledgment transparency disclosed before the action is taken | US-14.1, US-14.2, US-14.3 | "the 'Acknowledge' control is rendered and accompanied by inline, always-visible copy... stating the action will be permanently recorded"; "every screen that renders that flag displays the acknowledging user's name, role, timestamp, and justification text in full" | Yes |
| JTBD-02.4: Every exhibit row fully clickable, not just a nested link | US-15.1 | "The entire row rendered by the Case Workspace exhibit table... is clickable and navigates to `/exhibit/:id`"; "supports keyboard/focus activation — Enter or Space navigates" | Yes |
| JTBD-01.1: Assistant example prompts reference real exhibit labels | US-15.2 | "Example/suggested-question chips reference the case's actual exhibit-label scheme... not a mismatched placeholder numeric scheme"; "An automated test compares rendered chip text against seeded labels and fails if any example prompt references an `exhibitLabel` that does not exist" | Yes |
| JTBD-01.2: Ambient screen fully legible — no unexplained header elements, full date/time and exhibit name on every activity row | US-15.3, US-15.4, US-15.5 | "'Present and unexplained' is not an acceptable end state for any header element"; "No activity-feed row renders a time-only timestamp under any circumstance"; "No activity-feed row anywhere renders a summary string without that event's associated `exhibitLabel`" | Yes |
| JTBD-02.1: Classification required and immutable at creation; sealed/chambers exhibits excluded from jury candidacy | US-16.1, US-16.2 | "`classification` is required on `POST /api/exhibits`; a missing value is rejected with 422 `CLASSIFICATION_REQUIRED`"; "`computeJuryCandidates` filters `classification = 'TRIAL'` in the same query as the `ADMITTED`-status filter" | Yes |
| JTBD-02.1: Admission gate holds for unruled objections and permits never-objected exhibits unchanged | US-17.1, US-17.2 | "Regression test: objection raised, no ruling yet recorded, attempt `toStatus = ADMITTED` is rejected with the existing 422 `ADMISSION_BLOCKED`"; "exhibit with zero `ObjectionCurrentState` rows attempts `OFFERED → ADMITTED` directly and succeeds" | Yes |
| JTBD-02.1: Custodian required atomically at first `MARKED` transition | US-18.1, US-18.2 | "The `STATUS_CHANGE` event and a `CUSTODY_TRANSFER_CONFIRMED` event... are appended within a single database transaction"; "A first-ever `toStatus = MARKED` request with no `custodianUserId` is rejected with 422 `CUSTODIAN_REQUIRED_AT_INTAKE`" | Yes |
| JTBD-02.1: Custody changes only on named-receiver confirmation, never proposer assertion | US-19.1, US-19.2, US-19.3 | "`currentCustodianUserId` is not modified" (propose); "Confirm is rejected with 403 `CUSTODY_CONFIRM_WRONG_USER` unless `actorUserId` exactly equals the pending transfer's `toCustodianUserId`"; "cancelled proposal remains visible in `getCustodyHistory`'s ordered timeline" | Yes |
| JTBD-02.2: First-ever custody assignment bypasses propose/confirm round-trip | US-19.4 | "the service layer appends a `CUSTODY_TRANSFER_CONFIRMED` event directly... with no preceding `CUSTODY_TRANSFER_PROPOSED` event" | Yes |
| JTBD-02.1: Every RBAC-matrix action resolves role from the database, never a client claim | US-20.1, US-20.2, US-20.4, US-20.5, US-20.6 | "`POST /api/exhibits` resolves the acting user's role from the `User.role` database column via `actorUserId` — never from a client-supplied role claim"; "`assertRole(actorUserId, allowedRoles, actionLabel)` always performs a database lookup" | Yes |
| JTBD-03.2: Raising an objection is a server-enforced attorney permission | US-20.3 | "A raise-objection request from a `JUDGE` or `CHAMBERS_STAFF` role is rejected with 403 `ROLE_NOT_PERMITTED`"; "A request from `ATTORNEY`, `DEPUTY`, `CLERK`, or `ADMIN` proceeds through F02's existing validation... unchanged" | Yes |
| JTBD-01.2: Judge-only queue sorted by longest wait, live-recomputed, context-preserving links | US-21.1, US-21.2 | "Rows are sorted by elapsed wait time (`now() − raisedAt`) descending"; "Each row links into the existing ruling-recording action... and also links into the Exhibit Detail View" | Yes |
| JTBD-02.5: Case switch refetches every screen with zero cross-case leakage | US-22.1, US-22.2, US-22.3 | "Every open screen... and the assistant refetch against the newly-selected `caseId` using the same refetch mechanism already used on a role switch"; "a query scoped to `caseId = A` never returns rows belonging to `caseId = B`" | Yes |
| JTBD-02.6: Every finalization is a new permanent version, exportable as a deterministic PDF | US-23.1, US-23.2, US-23.3 | "Finalization computes `version` as the case's highest prior `FINALIZED` version + 1... assigned atomically"; "generates a PDF server-side... and streams it back as `application/pdf`"; "Re-exporting the same version at a later date always produces an identical PDF" | Yes |
| JTBD-01.5: Ruling recorded directly from the UI, zero deputy/clerk intermediary | US-24.1 | "On submit, the client calls the existing `POST /api/objections/:id/ruling` endpoint unchanged, applying F02's existing unresolved-thread validation and F20's judge-only role gate"; "A non-judge role sees no 'Record ruling' control anywhere in the UI — absent, not disabled" | Yes |
| JTBD-02.7: Custody assigned/transferred in a single screen, zero API workaround | US-24.2 | "If the exhibit has no custodian of record, the UI calls the legacy single-step endpoint... the assignment takes effect immediately with no propose/confirm step"; "A custody-chain mismatch... is rejected with 409 `CUSTODY_CHAIN_BROKEN` and surfaced as a specific inline error" | Yes |
| JTBD-02.8: Custodian holdings visible case-wide, zero per-exhibit visits | US-8.3 | "The panel groups exhibits by `currentCustodianUserId` via `getCustodyByCustodian(caseId)`... exhibits with a pending, unconfirmed custody transfer... appear in a visually distinct 'pending transfer to {name}' grouping" | Yes |
| JTBD-01.6: Severity-ranked single feed replaces manual panel cross-referencing | US-8.4 | "Entries are grouped into four tiers — `CRITICAL`... `HIGH`... `PENDING`... `MEDIUM`... every `CRITICAL` entry renders before any `HIGH` entry... with no interleaving across tiers" | Yes |
| JTBD-02.4: Fast exhibit triage without constructing a manual search query (strengthened) | US-9.3 | "Four quick-filter chips are available... selecting one narrows the visible row set without requiring the search bar"; "The eligibility badge is never computed independently of what the Jury Package Workspace (F11) shows for the same exhibit" | Yes |
| JTBD-02.7: Custody assigned/transferred in a single screen (right-rail + header) | US-10.3 | "The header's 'Transfer custody' action renders only for a `DEPUTY`/`CLERK`/`ADMIN` role, or additionally for the named pending-transfer receiver... 'Confirm receipt'"; "All three right-rail cards derive their state from the same `getExhibitHistory` payload the timeline renders from" | Yes |
| JTBD-01.7: Finalization requested with zero out-of-band communication | US-11.3 | "Clicking it calls `POST /api/jury-package/:id/request-finalization`... setting `finalizationRequestedAt`/`finalizationRequestedBy`"; "A finalize-authorized role... viewing the same `DRAFT` package while a request is outstanding sees a visible banner" | Yes |
| JTBD-04.1: Reskin is provably additive, not a silent functional regression (strengthened) | US-24.3 | "Every `data-testid` and `aria-label` selector referenced by the pre-Phase-8 Playwright suite resolves to the same element role and content after the reskin"; "The full pre-existing Playwright regression suite... passes unmodified against the reskinned UI" | Yes |

**Note on partial alignments:** two rows above are marked "Yes" with a caveat rather than a direct 1:1 AC match — this is expected, since NaC are derived from *stage-level* JTBD outcomes that sometimes span more than one story's acceptance criteria (e.g., custody-gap visibility is jointly produced by US-3.3's complete history and US-6.1's discrepancy flag). No NaC in this document is unsupported by at least one cited AC.

---

*Document generated by Pivota Spec Framework*
*Last updated: 2026-10-09 (added Release R5 for Phase 8: US-8.3, US-8.4, US-9.3, US-10.3, US-11.3, US-24.1, US-24.2, US-24.3 (8 stories) placed — US-8.4 and US-11.3 as new rows under PER-01's existing JRN-01.2 lane; US-9.3 as a new row under PER-02's existing JRN-02.1 "Log Exhibit Activity" row-family; US-10.3 as a new row under PER-02's existing JRN-02.2 "Open Exhibit Detail" stage; US-24.3 as a new row under PER-04's existing JRN-04.1 lane; plus two brand-new journeys with their own lanes — JRN-01.3 "Recording a Ruling Without Leaving the Screen" (US-24.1, US-8.4, US-10.3) and JRN-02.3 "Command Center Custody Glance and Inline Resolution" (US-8.3, US-24.2) — each corresponding to a genuinely new journey scenario with no existing-journey fit (recordRuling/recordCustodyTransfer were backend-only with zero prior UI entry point). New Epic 24 (Write-Action UI Coverage, F24) added. Six new JTBD IDs introduced (JTBD-01.5, JTBD-01.6, JTBD-01.7, JTBD-02.7, JTBD-02.8, JTBD-02.9, per JTBD-JudicialSync.md's own changelog); US-9.3 and US-24.3 strengthen JTBD-02.4 and JTBD-04.1 respectively. R1/R2/R3/R4 and all pre-existing rows left untouched.)*
*Prior: 2026-10-09 (added Release R4 (INSERTED) for Phase 7.1: US-16.1–US-23.3 (24 stories) placed under existing "Log Exhibit Activity" (classification, state-machine regression-proofing, custodian-at-intake, custody handoff, server-side RBAC), "Check Objection Resolution" (objection-raising RBAC), and "Assemble the Jury Package" (versioning/PDF export) backbone activities, plus exactly two newly-justified activities — "Check the Pending-Ruling Queue" (PER-01/JRN-01.2) and "Switch Cases and Confirm Isolation" (PER-04/JRN-04.1) — each corresponding to a genuinely new journey stage with no existing-activity fit. Two new JTBD IDs introduced (JTBD-02.5, JTBD-02.6, per JTBD-JudicialSync.md's own changelog); all other Phase 7.1 stories strengthen JTBD outcomes already committed to in R1–R3. R1/R2/R3 and all pre-existing rows left untouched.)*
*Prior: 2026-10-08 (added Release R3 for Phase 7: US-12.1–US-15.5 placed under existing "Log Exhibit Activity," "Assemble the Jury Package," "Search Mid-Testimony," "Query the Assistant," and "Glance During Recess" backbone activities — no new epics, journeys, or JTBD IDs introduced)*
