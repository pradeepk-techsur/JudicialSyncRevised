# Personas
## JudicialSync

| Field | Value |
|-------|-------|
| **Product Name** | JudicialSync |
| **Date** | 2026-10-06 |
| **Related PRD** | PRD-JudicialSync.md |

---

## Persona Summary

| ID | Name | Role | Primary Goal |
|----|------|------|-------------|
| PER-01 | Judge Elena Marsh (with Chambers Staff) | Presiding Judge / Chambers Staff | Get an instant, trustworthy answer to any live exhibit question without pausing proceedings or delegating a manual lookup |
| PER-02 | Courtroom Deputy Dana Reyes (with Clerk of Court) | Courtroom Deputy / Clerk of Court | Maintain one real-time, trustworthy exhibit record and assemble a jury package that's provably free of discrepancies |
| PER-03 | Attorney Marcus Webb | Trial Attorney (Counsel) | Confirm exhibit status, objection history, and custody instantly enough to act on it mid-argument |
| PER-04 | Administrator Priya Nair | Court Administrator | Validate that the system is auditable, never fabricates answers, and reduces operational risk before recommending adoption |

---

## PER-01: Judge Elena Marsh (with Chambers Staff)

**Role & Context:**
Elena presides over multi-day trials involving dozens of exhibits, often with several evidentiary disputes active at once. During live proceedings she has seconds, not minutes, to resolve a question — "has this exhibit been ruled on," "is this the same exhibit counsel referenced yesterday" — before the courtroom's attention shifts back to her. Her chambers staff support her between sessions and during recesses, researching procedural history and prepping materials for upcoming rulings. Together they represent the bench's need for ambient, always-current awareness rather than active data management: neither the judge nor her staff enters exhibit data themselves, but both depend entirely on the accuracy of what others have recorded.

**Goals:**
- Get an immediate, cited answer to a live question ("what exhibits were admitted yesterday," "what's the status of Exhibit 14") without delegating to staff mid-proceeding (F7, F1)
- Glance at an ambient, passive view of trial activity and outstanding discrepancies without configuring or drilling into anything (F8)
- Be confident that objection/ruling conflicts and custody gaps are caught automatically before they affect a ruling or the jury package (F6)
- Reconstruct the full history of an exhibit instantly when a prior ruling is challenged or revisited (F10, F2)

**Pain Points:**
- Currently must pause proceedings or delegate lookups to staff while the courtroom waits — no instant answer exists today under time pressure
- Cannot be fully certain that what a deputy or clerk reports from memory or a sticky note is complete or current — no single source of truth to rely on
- Risk of an exhibit entering the jury package despite an unresolved objection going unnoticed until it becomes a problem
- Reconstructing the full history behind a prior ruling means assembling fragments from multiple people and documents after the fact

**Technical Expertise:** Novice-to-Intermediate — comfortable with basic web interfaces and tablets on the bench, but has zero patience for configuration or multi-step workflows; expects conversational simplicity, not "another system to learn."

**Top Tasks:**
1. Ask the Pivota Assistant a live question during proceedings (continuous, critical)
2. Glance at the Trial Command Center for ambient status without drilling in (frequent, critical)
3. Review an exhibit's full event history before ruling on a renewed objection or motion (occasional, high)
4. Confirm no outstanding discrepancies remain before accepting a finalized jury package (per trial, critical)

**Success Criteria:**
- Receives a cited, accurate answer to a live question within seconds, with no staff delegation required
- Zero instances of ruling on stale, incomplete, or conflicting exhibit information

---

## PER-02: Courtroom Deputy Dana Reyes (with Clerk of Court)

**Role & Context:**
Dana works the floor of the courtroom throughout every trial day — physically handling exhibits, logging status changes as they're marked, offered, and admitted, and tracking who currently holds each one. The Clerk of Court works alongside her maintaining the official record of objections and rulings and ensuring procedural accuracy. Together they are the operational stewards of the exhibit record: the people who, today, juggle a patchwork of spreadsheets, paper exhibit logs, and handwritten notes to keep everything straight, and who are the first point of contact when a judge or attorney needs an answer right now. They are also the ones who assemble the jury package at the close of evidence — the single highest-stakes task in the trial, where a missed discrepancy becomes a reversible error.

**Goals:**
- Maintain one trustworthy, real-time record of every exhibit's status, custody, and ruling history so they never have to answer from memory or a sticky note (F0, F1, F3)
- Know instantly who currently holds custody of any exhibit without checking a paper log (F3)
- Assemble a jury package that is provably clean — no discrepant exhibits — without manual cross-referencing against three different sources (F5, F6, F11)
- Locate any exhibit in seconds during fast-moving testimony via structured search (F4, F9)

**Pain Points:**
- Today's exhibit tracking is spread across spreadsheets, paper exhibit logs, and sticky notes with no single system either of them — or anyone else — can trust simultaneously
- Assembling a jury package currently requires slow, manual cross-referencing to catch discrepancies, with no guarantee nothing was missed
- No structured, timestamped way to prove chain-of-custody with confidence if a transfer is challenged
- Reconstructing "what happened to Exhibit 14" today means manually assembling fragments from multiple people and documents

**Technical Expertise:** Intermediate — comfortable with structured software and routine data entry, accustomed to case-management or exhibit-logging tools, and values operational efficiency over visual polish.

**Top Tasks:**
1. Log status changes, objections/rulings, and custody transfers as they happen in real time (continuous, critical)
2. Search and filter exhibits during live testimony to answer fast requests from the bench or counsel (frequent, critical)
3. Review discrepancy flags and resolve or acknowledge them before finalizing the jury package (per trial, critical)
4. Generate and export the jury-ready exhibit list (per trial, critical)
5. Pull a full exhibit history timeline on request from the judge or an attorney (occasional, high)

**Success Criteria:**
- Zero manual cross-referencing required to confirm a jury package is free of discrepancies
- Can answer "who currently has custody of Exhibit X" instantly, with no paper-log lookup
- 100% of the system's flagged discrepancies are caught before jury package finalization, not after

---

## PER-03: Attorney Marcus Webb

**Role & Context:**
Marcus represents a party at trial from counsel table, where his ability to act on exhibit information in real time directly shapes his advocacy — deciding whether to press a still-unresolved objection, challenge an exhibit's chain of custody, or object to something improperly reaching the jury. Unlike the deputy or clerk, he has no ownership over the exhibit record and no guaranteed fast path to an answer; during fast-moving testimony, flagging down courtroom staff for a status check can cost him the moment he needs to act in. He relies on his own notes and recall far more than he'd like, especially across multi-day proceedings with dozens of exhibits in play.

**Goals:**
- Confirm an exhibit's current status before referencing it in argument or cross-examination (F1, F7)
- Know whether an objection is still unresolved so he can press the point or move on with confidence (F2)
- Pull the full chain-of-custody history to challenge an exhibit's admissibility when warranted (F3, F10)
- Verify exactly which exhibits made the jury package to ensure nothing improperly admitted slipped through (F5, F6, F11)

**Pain Points:**
- Cannot always get a fast answer from courtroom staff during fast-moving testimony — today's lookups are too slow for the pace of live argument
- Relies on his own handwritten notes to track objection and ruling history across a multi-day trial, which is fragmented and error-prone
- Has no visibility into an exhibit's custody chain unless he formally requests it as evidence, leaving him unable to confidently challenge gaps in the moment
- Risk that a flawed or improperly-admitted exhibit reaches the jury package unnoticed, undermining his case after the fact

**Technical Expertise:** Intermediate — regularly uses legal research tools and trial-presentation software (e.g., TrialPad, ExhibitView), comfortable with tablets and laptops in the courtroom, and expects tools to be fast and dependable under pressure.

**Top Tasks:**
1. Ask the assistant for an exhibit's or objection's current status mid-proceeding (frequent, critical)
2. Review an exhibit's full history to prepare for cross-examination or argument (occasional, high)
3. Verify the custody chain when challenging an exhibit's admissibility (occasional, high)
4. Confirm the jury package's contents reflect only properly admitted, undisputed exhibits (per trial, critical)

**Success Criteria:**
- Can get an accurate, cited answer about any exhibit within seconds during live proceedings, without relying on courtroom staff
- Zero surprises in jury package contents relative to the exhibits actually admitted and ruled upon

---

## PER-04: Administrator Priya Nair

**Role & Context:**
Priya oversees court operations and technology evaluation across multiple courtrooms. She is rarely present moment-to-moment during a trial; instead, her role is to assess whether a system like Pivota is trustworthy, auditable, and operationally sound enough to justify rollout. She evaluates the product through a compliance and risk lens — informed by real-world precedent of attorneys and courts sanctioned over fabricated AI-generated legal citations — and through an adoption lens, asking whether courtroom staff can use it without retraining or disruption to existing workflows.

**Goals:**
- Confirm the system produces an auditable, immutable record of every exhibit event — status, objection, ruling, custody — suitable for compliance review and appeals (F0, and the auditability non-functional requirement)
- See direct evidence that discrepancies are caught automatically, reducing the institutional risk of procedural errors reaching a jury (F6)
- Validate that the assistant never fabricates an answer and clearly declines when it lacks supporting data, given the legal sector's low tolerance for ungrounded AI claims (F7)
- Assess whether adoption meaningfully reduces staff time spent reconciling spreadsheets, paper logs, and notes across courtrooms (F4, F9)

**Pain Points:**
- Has no current way to audit how courtroom staff reconstruct an exhibit's history after the fact — the record lives in people's memory and informal notes, not a system
- Cannot verify from outside whether a given courtroom's exhibit and custody records are currently accurate, since no single source of truth exists today
- Is wary of AI tools producing plausible-sounding but incorrect answers, a risk with direct legal-sector precedent for sanctions
- Needs a clear, demonstrable story that this is an assistant augmenting existing courtroom workflows, not a disruptive new system requiring retraining

**Technical Expertise:** Intermediate — evaluates software from a procurement and operations lens rather than daily hands-on use; prioritizes reliability, audit trails, and staff adoption ease over technical sophistication.

**Top Tasks:**
1. Review a recorded or live demo walkthrough of the full end-to-end scenario (per evaluation cycle, critical)
2. Spot-check cross-screen consistency and discrepancy-detection accuracy against seed data (per evaluation, critical)
3. Assess the auditability of the event ledger for compliance and appeals reporting (per evaluation, high)
4. Evaluate the training and adoption burden across the five screens for courtroom staff (per evaluation, medium)

**Success Criteria:**
- Can confirm 100% of the assistant's answers during review are cited and traceable to a ledger record
- Can confirm discrepancy detection catches 100% of seeded edge cases without manual intervention
- Concludes the system is credibly positioned as an assistant augmenting, not replacing, existing courtroom workflows

---

## Persona Relationships

| Persona | Interacts With | Nature of Interaction |
|---------|---------------|----------------------|
| PER-01 | PER-02 | The bench depends on Courtroom Operations' real-time logging for every status, custody, and ruling fact it later asks the assistant to recall; the judge also relies on the deputy/clerk to resolve discrepancies before accepting a jury package |
| PER-01 | PER-03 | The judge rules on objections that attorneys raise in real time; both parties need the same current exhibit/objection state to avoid acting on stale information |
| PER-02 | PER-03 | Attorneys challenge or question the status, custody, and objection records that Courtroom Operations maintains — e.g., disputing a custody gap or confirming an objection is still unresolved |
| PER-04 | PER-01, PER-02, PER-03 | The administrator does not interact live during proceedings but reviews the recorded outputs, audit trail, and usage patterns of the bench, operations, and attorney personas to evaluate system trustworthiness and adoption readiness |

---

## Feature-Persona Matrix

| Feature | PER-01 (Bench) | PER-02 (Courtroom Ops) | PER-03 (Attorney) | PER-04 (Administrator) |
|---------|--------|--------|--------|--------|
| F0: Exhibit Workspace (Data Model) | Secondary | Primary | Secondary | Secondary |
| F1: Exhibit Status Display | Primary | Primary | Primary | Secondary |
| F2: Objection and Ruling Tracking | Primary | Primary | Primary | Secondary |
| F3: Custody Tracking | Secondary | Primary | Primary | Secondary |
| F4: Exhibit Search | Secondary | Primary | Secondary | Secondary |
| F5: Jury-Ready Exhibit List Generation | Primary | Primary | Primary | Secondary |
| F6: Discrepancy Identification | Primary | Primary | Primary | Primary |
| F7: Pivota Assistant (Natural-Language Q&A) | Primary | Primary | Primary | Primary |
| F8: Trial Command Center Screen | Primary | Secondary | — | Secondary |
| F9: Case Workspace Screen | Secondary | Primary | Secondary | Secondary |
| F10: Exhibit Detail View Screen | Primary | Primary | Primary | Secondary |
| F11: Jury Package Workspace Screen | Primary | Primary | Primary | Secondary |

---

*Document generated by Pivota Spec Framework*
*Last updated: 2026-10-06*
