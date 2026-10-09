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

**Journey:** JRN-02.2 — Reconstructing What Happened to an Exhibit

| Activity | Persona | Epic | Stories | NaC | Release |
|----------|---------|------|---------|-----|---------|
| Open Exhibit Detail: pull up the full picture in one place | PER-02 | Epic 10 (F10) | US-10.1 | JTBD-01.4: A single screen holds the complete story, with nothing missing, reconstructed directly from the ledger | R1 |
| Walk Through the Timeline: scan marked → objected → ruling → admitted → custody transfer in order | PER-02 | Epic 10 (F10), Epic 2 (F2), Epic 3 (F3) | US-10.1, US-2.2, US-3.3 | JTBD-02.1: Status, objection, ruling, and custody events are all visible as one trustworthy, chronologically ordered record | R1 |
| Confirm via Assistant: double-check a detail with a citation-backed answer before relaying it | PER-02 | Epic 7 (F7) | US-7.1, US-7.2 | JTBD-01.4: History is accessible via both direct screen view and a natural-language assistant query, and the two agree exactly | R1 |

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
| JTBD-01.3 | Jury package acceptance, zero undetected discrepancies | JRN-01.2:Jury Package Presented | Discrepancy gate is visible on the same screen as the jury package; a flagged exhibit cannot silently reach the final list | US-11.1, US-11.2 |
| JTBD-01.3 | Jury package acceptance, zero undetected discrepancies | JRN-01.2:Accept with Confidence | Zero discrepant exhibits appear in a package presented for judicial acceptance | US-11.2, US-6.3 |
| JTBD-01.4 | Instant full exhibit history reconstruction | JRN-01.2:Request History | Full ledger-derived timeline renders instantly, already assembled, with zero manual document assembly | US-10.1 |
| JTBD-01.4 | Instant full exhibit history reconstruction | JRN-02.2:Open Exhibit Detail | A single screen holds the complete story reconstructed directly from the ledger, nothing missing | US-10.1 |
| JTBD-01.4 | Instant full exhibit history reconstruction | JRN-02.2:Confirm via Assistant | History accessible via both direct screen view and natural-language assistant query, and the two agree exactly | US-7.1, US-7.2 |
| JTBD-02.1 | One trustworthy real-time record | JRN-02.1:Log Exhibit Activity | Every status/objection/custody event is an immutable, timestamped ledger entry visible identically on every screen and the assistant | US-0.1, US-1.1, US-2.1, US-3.1, US-9.1 |
| JTBD-02.1 | One trustworthy real-time record | JRN-02.1:Log Exhibit Activity (admission gate) | No invalid `ADMITTED` transition is ever recorded against an exhibit with an unresolved objection or missing custodian; every blocking reason is returned together, and no caller can bypass the gate | US-12.1, US-12.2, US-12.3 |
| JTBD-02.1 | One trustworthy real-time record | JRN-02.1:Field "What Objections Remain Unresolved?" | Objection status is answered directly from the live record, never fragile running notes | US-7.1, US-2.3 |
| JTBD-02.1 | One trustworthy real-time record | JRN-02.2:Walk Through the Timeline | Status, objection, ruling, and custody events are all visible as one trustworthy, ordered record | US-10.1, US-2.2, US-3.3 |
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

## Coverage Analysis

### Persona Coverage

| Persona | R1 | R2 | R3 |
|---------|----|----|----|
| PER-01 (Judge Elena Marsh) | US-7.1, US-7.2, US-1.2, US-10.1, US-11.1, US-11.2, US-6.3 | US-8.1, US-8.2, US-6.1, US-6.2 | US-14.3, US-15.2, US-15.4, US-15.5 |
| PER-02 (Courtroom Deputy Dana Reyes) | US-0.1, US-1.1, US-2.1, US-2.2, US-2.3, US-3.1, US-3.2, US-3.3, US-4.1, US-4.2, US-5.1, US-5.2, US-6.2, US-6.3, US-7.1, US-7.2, US-9.1, US-9.2, US-10.1, US-11.2 | — | US-12.1, US-12.2, US-13.1, US-13.2, US-13.3, US-14.1*, US-14.2 |
| PER-03 (Attorney Marcus Webb) | US-1.2, US-7.1, US-2.3, US-3.3, US-10.1, US-11.1, US-6.2, US-5.1 | — | US-15.1 |
| PER-04 (Administrator Priya Nair) | US-0.2, US-0.3, US-9.1, US-10.1, US-10.2, US-11.1, US-6.1, US-6.2, US-7.2, US-7.3, US-7.4, US-4.1 | US-8.1 (full walkthrough + adoption-burden stages) | US-12.3, US-15.3 |

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

### Gap Analysis

- **JTBD-04.1 spans both releases:** ledger immutability and cross-screen consistency are fully verifiable in R1 (US-0.3, US-9.1, US-10.1, US-10.2, US-11.1), but the administrator's *complete* walkthrough narrative (JRN-04.1:Review the Walkthrough) only closes once the Command Center ships in R2 — flagged as a partial-coverage item, not a missing one.
- **JTBD-04.4 fully deferred to R2:** the adoption-burden assessment is explicitly scoped against "all five screens" in JRN-04.1; with only four screens live in R1, this JTBD cannot be fully satisfied until US-8.1 ships. R1 supports only a four-screen partial read.
- **No orphan stories:** all 45 UserStories (US-0.1 through US-15.5) are placed in at least one lane above. Cross-check against the UserStories summary table (45 total: 30 P0, 13 P1, 2 P2) confirms full placement — including the 14 Phase 7 stories (US-12.1 through US-15.5) placed in Release R3.
- **No uncovered journey stages:** every stage in every journey (JRN-01.1, JRN-01.2, JRN-02.1, JRN-02.2, JRN-03.1, JRN-04.1) maps to at least one story, with the sole exception of stages explicitly outside system scope — "Question Arises" (JRN-01.1, pre-system bench awareness), "Request Arrives" and "Report Back" (JRN-02.2, verbal courtroom exchange), and "Make a Recommendation" (JRN-04.1, the administrator's own written output) — none of these represent a gap, as the journeys themselves mark them as non-system touchpoints.
- **No JTBD without a derived NaC:** all 16 JTBD IDs (JTBD-01.1 through JTBD-04.4) appear in the NaC Derivation Table with at least one testable criterion and at least one story.
- **Phase 7 / Release R3 introduces no new epics, journeys, or JTBD IDs:** all 14 new stories (Epics 12–15) are hardening/clarity fixes placed against existing backbone activities — "Log Exhibit Activity" (admission gate), "Assemble the Jury Package" (sealed exclusion + acknowledgment transparency), "Search Mid-Testimony" (clickable rows), "Query the Assistant" (grounded example prompts), and "Glance During Recess" (header/activity-feed legibility). No journey stage required a new row category to accommodate them, confirming the existing backbone was structurally sufficient for this phase.

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

**Note on partial alignments:** two rows above are marked "Yes" with a caveat rather than a direct 1:1 AC match — this is expected, since NaC are derived from *stage-level* JTBD outcomes that sometimes span more than one story's acceptance criteria (e.g., custody-gap visibility is jointly produced by US-3.3's complete history and US-6.1's discrepancy flag). No NaC in this document is unsupported by at least one cited AC.

---

*Document generated by Pivota Spec Framework*
*Last updated: 2026-10-08 (added Release R3 for Phase 7: US-12.1–US-15.5 placed under existing "Log Exhibit Activity," "Assemble the Jury Package," "Search Mid-Testimony," "Query the Assistant," and "Glance During Recess" backbone activities — no new epics, journeys, or JTBD IDs introduced)*
