# User Journeys
## JudicialSync

| Field | Value |
|-------|-------|
| **Product Name** | JudicialSync |
| **Date** | 2026-10-06 |
| **Related Personas** | PERSONAS-JudicialSync.md |
| **Related JTBD** | JTBD-JudicialSync.md |
| **Related PRD** | PRD-JudicialSync.md |

---

## Journey Index

| ID | Persona | Scenario | Key JTBD | Stages |
|----|---------|----------|----------|--------|
| JRN-01.1 | PER-01 | Judge gets an instant, cited answer to a live question mid-proceeding | JTBD-01.1 | 5 |
| JRN-01.2 | PER-01 | Judge glances at ambient trial status, triages the pending-ruling queue, then accepts a jury package with confidence | JTBD-01.2, JTBD-01.3, JTBD-01.4 | 6 |
| JRN-02.1 | PER-02 | **Core Demo Scenario** — deputy manages a live trial day while the judge asks rapid-fire questions and the jury package is built | JTBD-02.1, JTBD-02.2, JTBD-02.4, JTBD-02.3, JTBD-01.1 | 8 |
| JRN-02.2 | PER-02 | Deputy reconstructs an exhibit's full history on request | JTBD-02.1, JTBD-01.4 | 5 |
| JRN-03.1 | PER-03 | Attorney confirms status, objection resolution, and custody mid-argument, then verifies jury package integrity | JTBD-03.1, JTBD-03.2, JTBD-03.3, JTBD-03.4 | 5 |
| JRN-04.1 | PER-04 | Administrator evaluates Pivota's trustworthiness, multi-case isolation, and adoption readiness | JTBD-04.1, JTBD-04.2, JTBD-04.3, JTBD-04.4 | 7 |

---

## PER-01: Judge Elena Marsh (with Chambers Staff)

### JRN-01.1: Live Question Mid-Proceeding

**Persona:** PER-01 (Judge Elena Marsh)
**Scenario:** Mid-cross-examination, counsel references an exhibit in a way that doesn't match Elena's recollection of yesterday's rulings. She needs to resolve the discrepancy in seconds, on the bench, without pausing proceedings or quietly delegating the lookup to a deputy while the courtroom waits.
**Related Jobs:** JTBD-01.1, JTBD-01.4

#### Journey Stages

| Stage | Action | Touchpoint | Thinking | Feeling | Pain Point | Opportunity |
|-------|--------|------------|----------|---------|------------|-------------|
| Question Arises | Notices counsel's reference doesn't match her recollection; silently forms the question "was Exhibit 14 actually admitted yesterday?" | Bench awareness (no system touch yet) | "I need this answered now, not after a recess" | Alert, slightly tense | Today this means pausing proceedings or waving the deputy over while the room waits | Assistant reachable in one motion from the bench view, no hunting for it |
| Query the Assistant | Taps the Pivota Assistant and types/speaks the question in plain language | Pivota Assistant (F7) | "Will this actually know, or just dodge the question?" | Cautiously hopeful | Zero patience for a multi-step form; any friction here breaks confidence immediately | Natural-language input with no required syntax or filters |
| Receive Cited Answer | Reads the streamed reply: exhibit, admission timestamp, and a citation to the specific ledger event | Pivota Assistant response (F7, F1) | "Is this actually sourced, or is it just a confident guess?" | Relieved, reassured | If a citation were ever missing, trust in the tool collapses instantly and permanently | Inline citation stamped to the exact ledger record, visible without a tap |
| Rule with Confidence | States the confirmed fact aloud and rules on the matter without missing a beat | Courtroom (verbal), Assistant as backing record | "I can put this on the record right now" | Confident, in control | Still no independent way to double-check the assistant in the two seconds before speaking | One-tap "view supporting record" to visually confirm before ruling aloud |
| Resume Proceedings | Returns full attention to the courtroom; the exchange took seconds | Courtroom | "That was seconds, not minutes — nobody even noticed the pause" | Satisfied | None at this stage | Ambiently log that the question was resolved without staff delegation, visible later to chambers staff |

#### Key Moments
- **Decision Point:** Receive Cited Answer — Elena decides, in real time, whether the answer is trustworthy enough to rule on immediately.
- **Risk of Abandonment:** Query the Assistant — if the interface requires more than natural language (menus, filters, logins), she reverts to delegating to a deputy for the rest of the trial.
- **Delight Opportunity:** The combination of speed and visible citation turns a moment of courtroom tension into a non-event — exactly the "ambient operational memory" the product promises.

#### Success Outcome
Elena receives a cited, accurate answer within seconds and rules without pausing proceedings or delegating the lookup — directly satisfying the JTBD-01.1 success measure of zero staff delegation across 100% of live-question instances.

#### Feature Touchpoints

| Stage | Features |
|-------|----------|
| Question Arises | — |
| Query the Assistant | F7 |
| Receive Cited Answer | F7, F1 |
| Rule with Confidence | F7, F1 |
| Resume Proceedings | — |

---

### JRN-01.2: Ambient Awareness to Jury Package Acceptance

**Persona:** PER-01 (Judge Elena Marsh)
**Scenario:** During a brief recess, Elena wants a passive read on how the trial is tracking without configuring anything. Later, at the close of evidence, she must decide whether to accept the finalized jury package — a decision she cannot responsibly make without confidence that every objection/ruling conflict and custody gap was already caught.
**Related Jobs:** JTBD-01.2, JTBD-01.3, JTBD-01.4

#### Journey Stages

| Stage | Action | Touchpoint | Thinking | Feeling | Pain Point | Opportunity |
|-------|--------|------------|----------|---------|------------|-------------|
| Glance During Recess | Opens the Trial Command Center on the bench tablet during a two-minute recess | Trial Command Center (F8) | "What's changed since this morning?" | Calm, mildly curious | Today she has no passive view at all — awareness is reactive, triggered only when someone flags something | A single glanceable summary of recent status changes, pending objections, and rulings with zero setup |
| Spot a Flag | Notices a discrepancy indicator next to one exhibit | Trial Command Center (F8, F6) | "Is that something I need to deal with, or is staff already on it?" | Slightly concerned | Risk that a flagged issue could be missed if it weren't visually obvious | Discrepancy flags visually distinct and impossible to scroll past unnoticed |
| Check the Pending-Ruling Queue | Opens the judge-only Pending-Ruling Queue and scans every currently unresolved objection case-wide, sorted longest-waiting-first | Pending-Ruling Queue (F21, F2) | "Which of these has been sitting the longest — what have I let slip past without realizing it?" | Mildly uneasy, then oriented | Previously, an unresolved objection surfaced only when someone happened to raise it again or she stumbled onto it exhibit-by-exhibit — there was no single place showing what had been waiting, or for how long | A single judge-only queue, sorted by elapsed wait time and live-updating, lets her triage by age rather than by whoever speaks up loudest — and she can rule directly from the row without losing her place |
| Request History | Taps into the flagged exhibit to see the full chronological story behind the flag | Exhibit Detail View (F10) | "What actually happened here, and when?" | Focused | Reconstructing this today means assembling fragments from multiple people and documents after the fact | Full ledger-derived timeline renders instantly, already assembled |
| Jury Package Presented | At close of evidence, the deputy presents the finalized jury package for her acceptance | Jury Package Workspace (F11) | "Did anything slip through that shouldn't be in front of the jury?" | Watchful | Historically, she has had to trust the deputy's manual cross-referencing with no independent verification | Discrepancy gate visible on the same screen — package literally cannot finalize while flags remain open |
| Accept with Confidence | Reviews the zero-discrepancy confirmation and formally accepts the package | Jury Package Workspace (F11, F6) | "I don't need to re-check this myself — the gate already did" | Confident, relieved | None — the gate removes the need for independent re-verification | Explicit "zero discrepancies" confirmation stamped on the accepted package for the record |

#### Key Moments
- **Decision Point:** Jury Package Presented — Elena decides whether to accept or send the package back; the discrepancy gate is what makes this a fast "yes" rather than a manual audit.
- **Decision Point:** Check the Pending-Ruling Queue — Elena decides which objection to rule on next based on elapsed wait time, rather than whichever is raised loudest or happens to be in front of her.
- **Risk of Abandonment:** Glance During Recess — if the Command Center requires any configuration or drilling, she stops checking it and reverts to pure reactive awareness.
- **Delight Opportunity:** Spot a Flag — catching a discrepancy before it's raised by anyone else reinforces that the bench is never the last to know.

#### Success Outcome
Elena identifies trial status and any discrepancy within 10 seconds of glancing at the screen (JTBD-01.2), reconstructs an exhibit's full history instantly when a flag warrants it (JTBD-01.4), accepts a jury package with zero undetected discrepancies (JTBD-01.3), and triages every currently-unresolved objection by elapsed wait time from a single queue rather than discovering them ad hoc (JTBD-01.2).

#### Feature Touchpoints

| Stage | Features |
|-------|----------|
| Glance During Recess | F8 |
| Spot a Flag | F8, F6 |
| Check the Pending-Ruling Queue | F21, F2 |
| Request History | F10 |
| Jury Package Presented | F11 |
| Accept with Confidence | F11, F6 |

---

## PER-02: Courtroom Deputy Dana Reyes (with Clerk of Court)

### JRN-02.1: Core Demo Scenario — A Trial Day of Logging, Live Questions, and Jury Package Build

**Persona:** PER-02 (Courtroom Deputy Dana Reyes, with the Clerk of Court)
**Scenario:** This is the flagship end-to-end demo scenario. Dana runs the floor of a live, multi-exhibit trial — logging status changes as exhibits are marked, offered, and admitted, and tracking custody as items change hands. Over the course of the day, Judge Marsh fires off live questions ("what was admitted yesterday," "what objections are still unresolved," "is this exhibit in the jury package"), an attorney asks for custody confirmation, and at the close of evidence Dana must assemble a jury package that is provably free of discrepancies — all without pausing proceedings or reconciling spreadsheets after the fact.
**Related Jobs:** JTBD-02.1, JTBD-02.2, JTBD-02.4, JTBD-02.3, JTBD-01.1

#### Journey Stages

| Stage | Action | Touchpoint | Thinking | Feeling | Pain Point | Opportunity |
|-------|--------|------------|----------|---------|------------|-------------|
| Log Exhibit Activity | Classifies Exhibit 14 as TRIAL at intake (one of three choices, locked in forever), supplies a custodian in the same step as its first MARKED transition, marks it offered, then attempts to record it admitted the moment it happens on the floor; later proposes handing the exhibit to the clerk for safekeeping rather than just asserting the handoff happened | Exhibit Workspace / Case Workspace (F0, F1, F9, F12, F16, F18, F19) | "Classification, custodian, and status all have to be true from the first keystroke, not patched in later — and if something's still open on this exhibit, the system needs to stop me now, not flag it after the fact; and I shouldn't get to just declare the clerk has it — she has to say so too" | Focused, steady — briefly caught short on the rare attempt the system rejects | Previously, an exhibit could be created with no sensitivity classification, marked into evidence with no custodian of record, and handed off on Dana's unchallenged say-so alone — each gap was discoverable only after the fact, if at all | Classification is mandatory and immutable at creation, a custodian must be named in the same transaction as the first MARKED transition, and a custody handoff is only a *proposal* until the clerk confirms it; the admission gate still rejects an invalid `ADMITTED` transition outright, naming every blocking reason at once — and every one of these actions is now checked against Dana's own role server-side (F20), not just assumed from what the UI happens to show her |
| Confirm Custody Receipt | The Clerk of Court, named as the intended receiver, confirms taking custody of the exhibit Dana just proposed transferring — custody-of-record only changes at this moment, not when Dana proposed it | Custody Tracking (F3, F19, F20) | "I'm the one physically holding this now — my confirmation should be the only thing that makes that official, and no one else should be able to confirm this on my behalf" | Deliberate, accountable | Previously, a proposer could unilaterally record a transfer the receiving party never actually acknowledged, leaving "who really has it" resting on one person's word | Only the exact named receiver can confirm — not the proposer, not any other authorized role, not even an admin — so the chain-of-custody record reflects an acknowledged handoff, never an asserted one |
| Field "What Was Admitted Yesterday?" | Judge Marsh asks the question live from the bench; Dana isn't even the one who answers — the assistant does, directly | Pivota Assistant (F7, F1) | "I didn't have to drop what I'm doing to go find that" | Relieved | Normally this interrupts Dana mid-task to manually flip through yesterday's log | Assistant answers directly from the bench, removing Dana as a forced intermediary |
| Field "What Objections Remain Unresolved?" | Attorney presses the point; the judge asks the assistant case-wide instead of waiting on Dana to recall from notes | Pivota Assistant (F7, F2) | "That's one less interruption during a moment I can't afford to lose focus" | Confident | Previously, unresolved-objection status lived only in the clerk's running notes, fragile under time pressure | Case-wide "unresolved objections" query available to anyone authorized, not gated through Dana |
| Answer a Custody Question | Counsel asks "who currently has custody of Exhibit 7?" — Dana answers in seconds via a single lookup | Custody Tracking (F3) | "I know this instantly now — no more flipping the paper log" | Confident | Previously required checking a physical custody log or relying on memory of the last handoff | Instant custodian lookup, no cross-referencing required |
| Search Mid-Testimony | Bench requests a specific exhibit by description while testimony is moving fast; Dana filters by witness and keyword | Exhibit Search / Case Workspace (F4, F9) | "I need this in seconds, not after scrolling the whole list" | Slight urgency, then relief | Scanning a paper log or spreadsheet under this kind of time pressure risks a visible stumble in open court | Combinable filters (witness + keyword + status) surface the right exhibit almost immediately |
| Field "Is Exhibit 14 in the Jury Package?" | Judge asks directly; the assistant answers with the exhibit's current admission and objection status | Pivota Assistant (F7, F5, F6) | "This is exactly the kind of question that used to take minutes to run down" | Satisfied | Previously this required manually cross-referencing admission status against objection records | Assistant resolves jury-eligibility in real time from the same computed projection the screens use |
| Assemble the Jury Package | At close of evidence, Dana generates the jury-ready list; the system runs discrepancy detection before allowing finalization, any sealed/chambers-ex-parte exhibit is structurally barred from ever rendering as eligible, and finalizing locks in a new, permanently numbered version of the package rather than overwriting anything — exporting it downloads a real PDF instead of opening the browser's print dialog | Jury Package Workspace (F5, F6, F11, F13, F14, F16, F23) | "I need to know, not hope, that nothing discrepant — or sealed — is in here; and this isn't the only version there will ever be, so I need to know exactly what today's version contained, retrievable later, not just printed once and gone" | Determined, then briefly vigilant if a sealed row surfaces, then relieved and satisfied knowing this exact version is permanently retrievable | Previously, slow manual cross-referencing against three sources gave no guarantee nothing was missed, a sealed/chambers-only exhibit could still be mistaken for a clean, jury-eligible row if it had been marked admitted, finalizing felt like a one-shot action with no going back, and handing it off meant a browser print dialog that behaved differently printer to printer | Discrepancy check is a hard gate — finalization is blocked until every flag is resolved or acknowledged; a sealed or chambers-ex-parte exhibit can never render as clean, and if one is present Dana uses "Remove from Package" to exclude it with a recorded reason; each finalization is a new immutable version Dana or the clerk can return to and export as a real PDF at any later point — nothing is overwritten, and the exported file is identical every time it's re-downloaded |

#### Key Moments
- **Decision Point:** Assemble the Jury Package — Dana decides whether to resolve or formally acknowledge each flagged discrepancy before finalization can proceed; this is the single highest-stakes moment in the trial.
- **Decision Point:** Log Exhibit Activity — when the admission gate rejects a transition, Dana decides on the spot whether to resolve the unresolved objection or missing custodian herself before retrying, rather than letting an invalid admission stand and surface only as a later flag.
- **Decision Point:** Confirm Custody Receipt — the clerk decides, in the moment, whether she actually has the exhibit in hand before confirming; her confirmation (not Dana's proposal) is what the system of record treats as true.
- **Risk of Abandonment:** Log Exhibit Activity — if logging requires more steps than the paper process it replaces, Dana reverts to the sticky note and spreadsheet habit under time pressure.
- **Delight Opportunity:** Field "What Was Admitted Yesterday?" and the two questions that follow — Dana experiences the judge getting answers *without her having to be the bottleneck*, which is the core "assistant, not another system" promise made tangible.
- **Delight Opportunity:** Assemble the Jury Package — discovering that a sealed exhibit is structurally blocked (never just flagged) and removable in one clearly-audited action reinforces that the system protects against the single most damaging failure mode in this domain.
- **Delight Opportunity:** Assemble the Jury Package — learning that finalizing never destroys a prior version, and that any version can be re-exported as a real PDF later, removes the quiet anxiety of "is this the only copy."
- **Pain-Point Resolved:** Log Exhibit Activity and Confirm Custody Receipt — every write action (creating an exhibit, changing its status, proposing or confirming custody) is now checked against the acting user's actual role on the server, not merely hidden or disabled in the UI — Dana can no longer accidentally rely on a client-side affordance that the server would silently have rejected anyway.

#### Success Outcome
Dana answers 100% of status, objection, and custody queries directly from the live record with zero reliance on memory or notes (JTBD-02.1); answers a custody question in under 5 seconds with zero paper-log lookup (JTBD-02.2); locates a requested exhibit in under 10 seconds during live testimony (JTBD-02.4); and finalizes a jury package with zero manual cross-referencing, with 100% of seeded discrepancies caught before finalization and zero sealed/chambers-ex-parte exhibits ever reaching eligible/clean status (JTBD-02.3). No invalid `ADMITTED` transition is ever recorded against an exhibit with an unresolved objection or missing custodian (JTBD-02.1); no exhibit ever enters the evidence lifecycle without a custodian of record from its very first `MARKED` transition, and no custody transfer after that point is ever recorded as complete until the named receiver — and only the named receiver — confirms it (JTBD-02.1, JTBD-02.2). Every jury package finalization produces a new, permanently retrievable version, exportable as a real PDF rather than a browser print dialog (JTBD-02.3).

#### Feature Touchpoints

| Stage | Features |
|-------|----------|
| Log Exhibit Activity | F0, F1, F9, F12, F16, F18, F19, F20 |
| Confirm Custody Receipt | F3, F19, F20 |
| Field "What Was Admitted Yesterday?" | F7, F1 |
| Field "What Objections Remain Unresolved?" | F7, F2 |
| Answer a Custody Question | F3 |
| Search Mid-Testimony | F4, F9 |
| Field "Is Exhibit 14 in the Jury Package?" | F7, F5, F6 |
| Assemble the Jury Package | F5, F6, F11, F13, F14, F16, F23 |

---

### JRN-02.2: Reconstructing What Happened to an Exhibit

**Persona:** PER-02 (Courtroom Deputy Dana Reyes, with the Clerk of Court)
**Scenario:** A prior ruling on Exhibit 14 is challenged days later. The judge wants the full history reconstructed immediately, and Dana — who would previously have had to piece this together from logs, notes, and recollection — needs to produce a complete, trustworthy answer on the spot.
**Related Jobs:** JTBD-02.1, JTBD-01.4

#### Journey Stages

| Stage | Action | Touchpoint | Thinking | Feeling | Pain Point | Opportunity |
|-------|--------|------------|----------|---------|------------|-------------|
| Request Arrives | Judge asks, from the bench, "what happened to Exhibit 14?" | Courtroom (verbal request) | "This used to take me ten minutes of flipping through three different sources" | Mild pressure | Reconstructing history today means manually assembling fragments from multiple people and documents | A single place to pull the complete story on demand |
| Open Exhibit Detail | Pulls up the Exhibit Detail View for Exhibit 14 | Exhibit Detail View (F10) | "Everything should be right here, in order" | Focused | Previously, no single screen or document held the full picture | Chronological timeline auto-assembled from the ledger, nothing missing |
| Walk Through the Timeline | Scans the full sequence: marked, objected, ruling, admitted, custody transfer | Exhibit Detail View (F10, F2, F3) | "I can see exactly what happened and when, without guessing" | Confident | None — the timeline is complete and ordered | Highlight the specific event relevant to the current dispute automatically |
| Confirm via Assistant | Double-checks a specific detail by asking the assistant directly, for a citation-backed answer to relay aloud | Pivota Assistant (F7) | "I want to say this out loud with full confidence, not 'I think so'" | Assured | Previously had no independent way to confirm her own recollection of the record | Assistant citation matches exactly what the screen already shows — same source, same answer |
| Report Back | Relays the complete, accurate history to the judge without delay | Courtroom (verbal) | "That's done — accurately, and fast" | Relieved, proud | None at this stage | Log that the history request was resolved instantly, for later audit by the administrator |

#### Key Moments
- **Decision Point:** Walk Through the Timeline — Dana decides whether she has enough detail to answer confidently or needs to drill further before reporting back.
- **Risk of Abandonment:** Open Exhibit Detail — if the timeline is incomplete or requires cross-referencing a second source, Dana reverts to manually reconstructing fragments, undermining the entire value proposition.
- **Delight Opportunity:** Confirm via Assistant — the screen and the assistant agreeing exactly reinforces, in the moment, that there is truly one source of truth.

#### Success Outcome
Dana retrieves a complete exhibit history — every status, objection, ruling, and custody event — within seconds and with zero manual document assembly, satisfying JTBD-01.4 on behalf of the judge and reinforcing JTBD-02.1's "one trustworthy record" standard.

#### Feature Touchpoints

| Stage | Features |
|-------|----------|
| Request Arrives | — |
| Open Exhibit Detail | F10 |
| Walk Through the Timeline | F10, F2, F3 |
| Confirm via Assistant | F7 |
| Report Back | — |

---

## PER-03: Attorney Marcus Webb

### JRN-03.1: Mid-Argument Status Check to Jury Package Verification

**Persona:** PER-03 (Attorney Marcus Webb)
**Scenario:** Marcus is deep into cross-examination and needs to confirm an exhibit's status before referencing it, then decide whether to press a still-unresolved objection, then later challenge a gap in an exhibit's custody chain. At the close of evidence, he wants to independently verify that the finalized jury package contains nothing improperly admitted — all without ever being able to rely on courtroom staff as his lookup path.
**Related Jobs:** JTBD-03.1, JTBD-03.2, JTBD-03.3, JTBD-03.4

#### Journey Stages

| Stage | Action | Touchpoint | Thinking | Feeling | Pain Point | Opportunity |
|-------|--------|------------|----------|---------|------------|-------------|
| Confirm Status Before Referencing | Mid-cross, quietly queries the assistant for an exhibit's current status before citing it | Pivota Assistant (F1, F7) | "I can't afford to reference something stale in front of the jury" | Tense, focused | Flagging down courtroom staff for a status check costs him the exact moment he needs to act in | On-demand status answers with zero intermediary, fast enough to use live |
| Check Objection Resolution | Needs to decide whether to press a point; asks whether the objection on this exhibit is still unresolved, and separately raises a new objection of his own when testimony calls for it | Pivota Assistant (F2) | "My notes on this are three days old — I can't trust them for this — and I want to know raising a fresh objection is actually my call to make, not something that quietly fails if I'm not supposed to" | Uncertain, then decisive | His own handwritten notes across a multi-day trial are fragmented and error-prone | Case-wide unresolved-objection query, independent of which day the objection was raised — and raising a new objection is now an explicitly server-enforced permission attorneys hold (unlike ruling, which stays judge-only), so Marcus knows precisely which actions are his to take |
| Challenge a Custody Gap | Suspects a custody gap and wants to verify before formally raising it | Exhibit Detail View / Custody Tracking (F3, F10) | "If there's a real gap here, I need to see it clearly before I commit to raising it" | Alert, calculating | Previously had zero visibility into custody chain unless formally requesting it as evidence | Custody gaps are visually distinct from a complete chain, usable without a formal request |
| Verify Jury Package Integrity | At close of evidence, reviews the finalized jury package against his own understanding of what was admitted and ruled upon | Jury Package Workspace (F5, F6, F11) | "Did anything slip through that shouldn't be here?" | Watchful, slightly skeptical | Risk that a flawed or improperly-admitted exhibit reaches the jury unnoticed until after the fact | Discrepancy warnings visible directly on the jury package view, not a separate report |
| Confirm with the Assistant | Asks the assistant directly to confirm a specific exhibit's jury-eligibility status as a final check | Pivota Assistant (F7, F5) | "I want this confirmed independently, not just trusted" | Reassured | None — the assistant and the screen agree, closing the loop | Assistant answer cites the exact same computed eligibility the screen shows |

#### Key Moments
- **Decision Point:** Check Objection Resolution — Marcus decides in real time whether to press the point or let it go; this answer directly shapes his advocacy.
- **Risk of Abandonment:** Confirm Status Before Referencing — if the answer isn't fast enough to use live, he reverts to his own notes and risks acting on stale information.
- **Delight Opportunity:** Verify Jury Package Integrity — discovering zero surprises reinforces that he no longer needs his own shadow tracking system to protect his case.

#### Success Outcome
Marcus obtains a cited, accurate status answer within seconds without relying on courtroom staff (JTBD-03.1), confirms objection resolution in under 10 seconds (JTBD-03.2), retrieves a complete custody chain in under 10 seconds (JTBD-03.3), and confirms zero surprises in the finalized jury package (JTBD-03.4).

#### Feature Touchpoints

| Stage | Features |
|-------|----------|
| Confirm Status Before Referencing | F1, F7 |
| Check Objection Resolution | F2 |
| Challenge a Custody Gap | F3, F10 |
| Verify Jury Package Integrity | F5, F6, F11 |
| Confirm with the Assistant | F7, F5 |

---

## PER-04: Administrator Priya Nair

### JRN-04.1: Evaluating Pivota for Courtroom Adoption

**Persona:** PER-04 (Administrator Priya Nair)
**Scenario:** Priya is evaluating JudicialSync for rollout across multiple courtrooms. She isn't present during live proceedings; instead she reviews a recorded or live demo walkthrough through a compliance and risk lens, informed by real-world precedent of sanctions over fabricated AI citations, and must decide whether the system is auditable, accurate, honest about its limits, and adoptable without retraining.
**Related Jobs:** JTBD-04.1, JTBD-04.2, JTBD-04.3, JTBD-04.4

#### Journey Stages

| Stage | Action | Touchpoint | Thinking | Feeling | Pain Point | Opportunity |
|-------|--------|------------|----------|---------|------------|-------------|
| Review the Walkthrough | Watches a recorded demo of the deputy-manages-trial / judge-asks-questions scenario end to end | Full demo walkthrough (all screens) | "Is this a real operational tool, or a flashy chatbot demo?" | Skeptical, evaluative | Has no current way to audit how courtroom staff reconstruct exhibit history today — everything lives in memory and informal notes | A single coherent scenario that mirrors her courtrooms' actual daily friction, not a contrived feature tour |
| Spot-Check Cross-Screen Consistency | Picks an exhibit at random and compares what the Case Workspace, Exhibit Detail, and Jury Package screens say about it | Case Workspace, Exhibit Detail, Jury Package (F9, F10, F11) | "If these three screens ever disagree, I can't trust any of them" | Rigorous, probing | Cannot verify from outside whether a courtroom's records are currently accurate, since no single source of truth exists today | 100% agreement across every screen for the same exhibit, verifiable by spot-check |
| Switch Cases and Confirm Isolation | Opens the Case Selector, switches from the demo case to the second seeded case, and confirms every screen and the assistant refetch cleanly with zero carryover from the prior case | Case Selector / all screens (F22) | "If switching cases ever leaks one case's exhibit — or sealed material — into another's view, even for a second, that's a disqualifying finding, not a bug ticket" | Rigorous, probing | Has no way today to confirm a multi-courtroom rollout wouldn't let one case's material bleed into another's screen during a fast case switch | Every open screen and the assistant refetch against the newly-selected case with zero stale carryover, demonstrated live rather than merely asserted in documentation |
| Test Discrepancy Detection | Checks the seeded edge cases — an admitted exhibit missing a custodian, an unresolved objection in the jury package — against what the system flags | Discrepancy Identification (F6) | "Would this have actually caught the real failure mode, or just the easy cases?" | Attentive, testing | Has no mechanism today to confirm discrepancies would have been caught before reaching a jury | Both seeded edge cases flagged automatically, with zero manual intervention required to surface them |
| Probe the Assistant for Fabrication | Asks the assistant several of the named example questions, then deliberately asks something no record supports | Pivota Assistant (F7) | "This is exactly the kind of tool that gets a court sanctioned if it guesses" | Wary, then convinced | Is aware of real legal-sector precedent for sanctions over fabricated AI citations and has no way today to rule this risk out | Explicit "I don't have that information" decline on the unsupported question, and citations on every answered one |
| Assess Adoption Burden | Walks through all five screens once, imagining a non-technical judge or deputy using them without formal training | All five screens (F1-F11) | "Could my staff actually pick this up without a training session?" | Pragmatic | Assumes, without evidence, that any new system will require retraining and workflow disruption | Screens read as an assistant layered over existing workflow, not a new case-management system to learn |
| Make a Recommendation | Concludes whether the system is trustworthy and adoptable, and documents the recommendation | Evaluation notes (outside the system) | "I can defend this recommendation to the court if asked" | Confident, decisive | None at this stage, assuming prior stages held up under scrutiny | Exportable audit summary of the walkthrough findings to support her written recommendation |

#### Key Moments
- **Decision Point:** Probe the Assistant for Fabrication — a single ungrounded answer here would end the evaluation negatively regardless of how well every other feature performed.
- **Risk of Abandonment:** Spot-Check Cross-Screen Consistency — any discovered disagreement between screens would cause Priya to abandon the evaluation and recommend against adoption.
- **Risk of Abandonment:** Switch Cases and Confirm Isolation — any observed cross-case data leakage here would end the evaluation immediately, regardless of how well every single-case feature performed; a multi-courtroom rollout cannot be recommended on a system that leaks between cases even transiently.
- **Delight Opportunity:** Test Discrepancy Detection — watching both seeded edge cases get caught automatically, without her prompting the system toward them, is the moment that converts skepticism into confidence.

#### Success Outcome
Priya confirms 100% of reviewed exhibit events are traceable to an immutable ledger record (JTBD-04.1), confirms zero cross-case data leakage when switching the active case (JTBD-04.1), confirms 100% of seeded discrepancies are caught automatically (JTBD-04.2), confirms zero ungrounded assistant claims (JTBD-04.3), and concludes the adoption burden is low enough to recommend rollout across multiple courtrooms (JTBD-04.4).

#### Feature Touchpoints

| Stage | Features |
|-------|----------|
| Review the Walkthrough | F0, F1, F7, F8, F9, F10, F11 |
| Spot-Check Cross-Screen Consistency | F9, F10, F11 |
| Switch Cases and Confirm Isolation | F22 |
| Test Discrepancy Detection | F6 |
| Probe the Assistant for Fabrication | F7 |
| Assess Adoption Burden | F4, F9 |
| Make a Recommendation | — |

---

## Cross-Journey Patterns

- **Common Pain Points:**
  - *Fragmented record-keeping before Pivota* appears in nearly every journey's pain-point column (Elena's staff relaying from memory, Dana's spreadsheets/paper/sticky notes, Marcus's handwritten notes, Priya's untraceable institutional memory) — this is the single problem the entire product exists to solve, and it must visibly disappear in every journey's later stages.
  - *No independent way to verify an answer in the moment* recurs for both Elena (before ruling) and Marcus (before referencing an exhibit) — both personas need a fast, low-friction way to confirm trust in an answer without a second lookup path.
  - *Time pressure during live proceedings* is the dominant emotional driver across PER-01, PER-02, and PER-03 journeys — every friction point is amplified by the courtroom clock, and every opportunity is valuable in direct proportion to how many seconds it saves.
  - *Unilateral assertion standing in for acknowledged fact* recurs as a closed gap in Phase 7.1: a custody transfer previously needed only the proposer's say-so (now the named receiver must confirm, JRN-02.1), and a write action's legality previously rested on what the UI happened to render rather than a server-side check (now enforced identically for every role across JRN-02.1 and JRN-03.1).

- **Shared Opportunities:**
  - *One citation, reused everywhere:* the exact same ledger-backed citation that reassures the judge (JRN-01.1), confirms the deputy's own recollection (JRN-02.2), and closes the loop for the attorney (JRN-03.1) is also the evidence the administrator scrutinizes (JRN-04.1) — investing in citation clarity pays off across all four personas simultaneously.
  - *Discrepancy gating as a trust mechanism:* the hard gate before jury package finalization (JRN-02.1, JRN-01.2, JRN-03.1) is simultaneously an operational safeguard for the deputy, a confidence mechanism for the judge, a verification tool for the attorney, and the single most convincing proof point for the administrator (JRN-04.1) — this feature does more cross-persona trust-building work than any other.
  - *Zero-configuration ambient views* (Trial Command Center) and *zero-intermediary answers* (the assistant) both reinforce the "assistant, not a new system" positioning that Priya is specifically evaluating for — every friction-free moment in JRN-01.1, JRN-02.1, and JRN-03.1 is indirectly evidence for JRN-04.1's adoption-burden assessment.
  - *Server-side role enforcement as a silent trust mechanism (F20):* invisible in the common case, it surfaces only when something would otherwise have gone wrong — a wrong-user custody confirmation (JRN-02.1), an unauthorized write — and its presence across every gated action is itself part of what Priya evaluates when assessing adoption readiness (JRN-04.1).

- **Convergence Points:**
  - JRN-02.1 (the core demo scenario) is the convergence point for three personas at once: the deputy logging and searching, the judge asking live questions, and (implicitly) the attorney who later verifies the same jury package the deputy assembled — this single scenario is the one most worth protecting from any friction during implementation.
  - The Jury Package Workspace (F11) is a shared endpoint for PER-01 (accept), PER-02 (assemble), and PER-03 (verify) — a discrepancy surfaced incorrectly here would simultaneously break three different personas' trust in a single screen.
  - The Pivota Assistant (F7) is the universal touchpoint — it appears in every single journey across all four personas, confirming its status as the feature the entire demo's success depends on.
  - JRN-02.1's new Confirm Custody Receipt stage is the one moment in the entire journey set where the "deputy" and "clerk" halves of PER-02 act as two independent, identity-checked parties rather than an interchangeable pair — a distinction Phase 7.1's two-phase custody model makes structurally necessary for the first time.

---

## Journey-to-JTBD Traceability

| Journey Stage | JTBD ID | Expected Outcome |
|--------------|---------|-----------------|
| JRN-01.1:Query the Assistant | JTBD-01.1 | Judge gets a cited live answer in seconds with zero staff delegation |
| JRN-01.1:Receive Cited Answer | JTBD-01.1 | Every answer carries a citation to a specific ledger record |
| JRN-01.1:Rule with Confidence | JTBD-01.1 | Judge rules without pausing proceedings |
| JRN-01.2:Glance During Recess | JTBD-01.2 | Judge maintains ambient trial awareness with zero configuration |
| JRN-01.2:Spot a Flag | JTBD-01.2 | Outstanding discrepancies surfaced visually without manual filtering |
| JRN-01.2:Check the Pending-Ruling Queue | JTBD-01.2 | Judge triages every unresolved objection case-wide by elapsed wait time (F21) from a single queue, instead of discovering them ad hoc |
| JRN-01.2:Request History | JTBD-01.4 | Judge reconstructs full exhibit history instantly, with zero manual assembly |
| JRN-01.2:Jury Package Presented | JTBD-01.3 | Discrepancy gate visible on the same screen as the jury package |
| JRN-01.2:Accept with Confidence | JTBD-01.3 | Judge accepts jury packages with zero undetected discrepancies |
| JRN-02.1:Log Exhibit Activity | JTBD-02.1 | Deputy/clerk maintains one trustworthy record with zero reliance on memory or notes; every exhibit is classified at intake and immutable thereafter (F16), a custodian is required atomically at the first `MARKED` transition (F18), the admission gate (F12) rejects any `ADMITTED` transition with an unresolved objection or no custodian of record before it can be written, naming every blocking reason at once, and a custody handoff is only a proposal (F19) until the receiver confirms it — all gated server-side by the acting user's actual role (F20) |
| JRN-02.1:Confirm Custody Receipt | JTBD-02.1 | Custody-of-record changes only when the exact named receiver confirms (F19) — not when the proposer asserts a handoff — and only a role-permitted, identity-matched user can do so (F20), preserving the one-trustworthy-record standard |
| JRN-02.1:Field "What Was Admitted Yesterday?" | JTBD-01.1 | Judge gets a cited live answer in seconds, with the deputy freed from being the lookup path |
| JRN-02.1:Field "What Objections Remain Unresolved?" | JTBD-02.1 | Objection status answered directly from the live record, not fragile notes |
| JRN-02.1:Answer a Custody Question | JTBD-02.2 | Deputy/clerk answers custody questions instantly with zero paper-log lookups |
| JRN-02.1:Search Mid-Testimony | JTBD-02.4 | Deputy/clerk locates any exhibit in under 10 seconds during live testimony |
| JRN-02.1:Field "Is Exhibit 14 in the Jury Package?" | JTBD-02.3 | Jury-eligibility answered instantly from the current-state projection |
| JRN-02.1:Assemble the Jury Package | JTBD-02.3 | Deputy/clerk assembles a provably clean jury package with zero manual cross-referencing; a sealed or chambers-ex-parte exhibit can never render as eligible/clean (F13, F16) and, if present, is removable via an authorized, reason-recorded "Remove from Package" action; acknowledging any other discrepancy visibly surfaces who may act and that the action is audited (F14); finalizing produces a new immutable, numbered version (F23) exportable as a real PDF, and any prior version remains independently retrievable and exportable |
| JRN-02.2:Open Exhibit Detail | JTBD-01.4 | Full chronological exhibit history available on demand, reconstructed from the ledger |
| JRN-02.2:Walk Through the Timeline | JTBD-02.1 | Status, objection, ruling, and custody events all visible as one trustworthy record |
| JRN-02.2:Confirm via Assistant | JTBD-01.4 | History accessible via both direct screen view and natural-language assistant query |
| JRN-03.1:Confirm Status Before Referencing | JTBD-03.1 | Attorney confirms exhibit status in seconds without relying on courtroom staff |
| JRN-03.1:Check Objection Resolution | JTBD-03.2 | Attorney confirms objection resolution status in under 10 seconds, and his own ability to raise a new objection is an explicitly server-enforced permission (F20), not an assumed UI affordance |
| JRN-03.1:Challenge a Custody Gap | JTBD-03.3 | Attorney verifies custody chain in under 10 seconds without a formal evidentiary request |
| JRN-03.1:Verify Jury Package Integrity | JTBD-03.4 | Attorney confirms zero surprises in finalized jury package contents |
| JRN-03.1:Confirm with the Assistant | JTBD-03.4 | Attorney can query the assistant to confirm specific exhibits' jury-eligibility status directly |
| JRN-04.1:Spot-Check Cross-Screen Consistency | JTBD-04.1 | Administrator confirms 100% of reviewed exhibit events are traceable to an immutable ledger record |
| JRN-04.1:Switch Cases and Confirm Isolation | JTBD-04.1 | Administrator confirms zero cross-case data leakage when switching the active case (F22), with every screen and the assistant refetching cleanly against the newly-selected case |
| JRN-04.1:Test Discrepancy Detection | JTBD-04.2 | Administrator confirms discrepancy detection catches 100% of seeded edge cases automatically |
| JRN-04.1:Probe the Assistant for Fabrication | JTBD-04.3 | Administrator confirms zero ungrounded assistant claims during review |
| JRN-04.1:Assess Adoption Burden | JTBD-04.4 | Administrator concludes adoption burden is low enough to recommend rollout across multiple courtrooms |

---

*Document generated by Pivota Spec Framework*
*Last updated: 2026-10-09 (Phase 7.1 INSERTED: JRN-02.1's Log Exhibit Activity gained exhibit classification (F16), custodian-required-at-marking (F18), and the custody PROPOSE step (F19); added new JRN-02.1 stage "Confirm Custody Receipt" for the receiving custodian's CONFIRM step (F19) with server-side role enforcement (F20); JRN-02.1's Assemble the Jury Package gained immutable versioning + real PDF export (F23); added new JRN-01.2 stage "Check the Pending-Ruling Queue" for the judge-facing oldest-first objection queue (F21); added new JRN-04.1 stage "Switch Cases and Confirm Isolation" for multi-case support (F22); JRN-03.1's Check Objection Resolution annotated with F20's server-enforced objection-raising permission. Prior note retained: JRN-02.1 updated for Phase 7: admission gate at Log Exhibit Activity (F12), sealed-exclusion remediation + acknowledgment transparency at Assemble the Jury Package (F13, F14))*
