# Jobs to Be Done
## JudicialSync

| Field | Value |
|-------|-------|
| **Product Name** | JudicialSync |
| **Date** | 2026-10-06 |
| **Last Updated** | 2026-10-09 (added JTBD-01.5–01.7, JTBD-02.7–02.9 for Phase 8 F8/F9/F10/F11/F24 — new jobs covering write-action UI coverage, custody/attention-feed glance views, and finalization-request path; Phase 7.1's JTBD-02.5/02.6 entries unchanged) |
| **Related Personas** | PERSONAS-JudicialSync.md |
| **Related PRD** | PRD-JudicialSync.md |

---

## JTBD Summary

| ID | Persona | Job Statement | Priority |
|----|---------|--------------|----------|
| JTBD-01.1 | PER-01 | When a live question arises mid-proceeding, I want a cited answer in seconds, so I can rule without pausing the courtroom or delegating a lookup. | P0 |
| JTBD-01.2 | PER-01 | When proceedings are underway, I want an ambient glance at trial status and discrepancies, so I can stay aware without configuring or drilling into anything. | P1 |
| JTBD-01.3 | PER-01 | When a jury package is presented for acceptance, I want assurance that every conflict was caught automatically, so I can accept it without re-checking the work myself. | P0 |
| JTBD-01.4 | PER-01 | When a prior ruling is challenged or revisited, I want the exhibit's full history instantly, so I can reconstruct context without assembling fragments after the fact. | P0 |
| JTBD-02.1 | PER-02 | When logging exhibit activity throughout the day, I want one real-time record of status, custody, and rulings, so I never have to answer from memory or a sticky note. | P0 |
| JTBD-02.2 | PER-02 | When the bench or counsel asks who holds an exhibit, I want an instant custody answer, so I can respond without checking a paper log. | P0 |
| JTBD-02.3 | PER-02 | When assembling the jury package, I want proof that no discrepant exhibit slipped through, so I can finalize it without manual cross-referencing against multiple sources. | P0 |
| JTBD-02.4 | PER-02 | When testimony is moving fast, I want to locate any exhibit in seconds via structured search, so I can respond to requests from the bench or counsel without delay. | P1 |
| JTBD-02.5 | PER-02 | When handling more than one active trial in the same session, I want to switch between cases from a single workspace, so I can move between cases without restarting or losing my place in either one. | P1 |
| JTBD-02.6 | PER-02 | When a jury package is finalized (and possibly re-finalized later), I want a permanent, versioned, exportable record of exactly what was included at each finalization, so I can produce defensible proof of what the jury actually received if it's ever challenged. | P1 |
| JTBD-01.5 | PER-01 | When an objection surfaces on the attention feed or an exhibit's Objection card, I want to record my ruling right there, so I can resolve it the moment I see it instead of routing it through a deputy or clerk because no UI exists for it. | P0 |
| JTBD-01.6 | PER-01 | When I open the Command Center during a live trial, I want a single severity-ranked feed of what needs attention, so I can triage by actual priority instead of cross-referencing separate panels myself. | P0 |
| JTBD-01.7 | PER-01 | When I'm reviewing a jury package I can't finalize myself, I want to request finalization from a clerk or deputy directly from the workspace, so I can move the package forward without an out-of-band ask. | P1 |
| JTBD-02.7 | PER-02 | When an exhibit needs a custodian assigned or transferred, I want to do it directly from the Exhibit Detail screen or attention feed, so I can complete the action the moment I identify the need instead of relying on a backend-only workflow. | P0 |
| JTBD-02.8 | PER-02 | When I need a case-wide picture of who's holding which exhibits, I want a single custody-by-custodian view on the Command Center, so I can see the whole custody picture at a glance instead of opening each exhibit's detail page one at a time. | P1 |
| JTBD-02.9 | PER-02 | When a flagged item appears on the attention feed, I want to act on it inline right from the entry, so I can resolve it the moment I see it instead of navigating away and losing my place. | P0 |
| JTBD-03.1 | PER-03 | When I'm about to reference an exhibit in argument or cross-examination, I want its current status confirmed instantly, so I can act with confidence mid-argument. | P0 |
| JTBD-03.2 | PER-03 | When deciding whether to press or drop a point, I want to know if an objection is still unresolved, so I can act without relying on fragmented personal notes. | P0 |
| JTBD-03.3 | PER-03 | When challenging an exhibit's admissibility, I want the full chain-of-custody history on demand, so I can identify gaps without formally requesting it as evidence first. | P1 |
| JTBD-03.4 | PER-03 | When the jury package is finalized, I want to verify its exact contents against admitted/ruled exhibits, so I can be confident nothing improperly admitted reached the jury. | P0 |
| JTBD-04.1 | PER-04 | When evaluating the system for adoption, I want proof every exhibit event produces an immutable, auditable record, so I can clear it for compliance and appeals review. | P0 |
| JTBD-04.2 | PER-04 | When spot-checking system accuracy, I want direct evidence that discrepancies are caught automatically, so I can validate the reduction in procedural risk before recommending rollout. | P0 |
| JTBD-04.3 | PER-04 | When reviewing assistant answers, I want proof the assistant never fabricates a claim, so I can rule out the sanctioned-AI-citation risk before recommending adoption. | P0 |
| JTBD-04.4 | PER-04 | When assessing rollout cost, I want to see whether staff reconcile fewer spreadsheets and logs, so I can judge the adoption burden is low enough to recommend. | P1 |

---

## PER-01: Judge Elena Marsh (with Chambers Staff) — Jobs

### JTBD-01.1: Instant Cited Answer Under Time Pressure

**Job Statement:**
When a live question arises mid-proceeding — "has this exhibit been ruled on," "is this the same exhibit counsel referenced yesterday" — I want an immediate, cited answer, so I can rule or respond without pausing proceedings or delegating a manual lookup to staff.

**Current Alternatives:**
- Pauses proceedings or quietly delegates the lookup to chambers staff or the deputy while the courtroom waits
- Relies on staff reporting from memory or a sticky note, with no way to confirm completeness or currency

**Hiring Criteria:**
- Answers natural-language questions about exhibit status, objections, rulings, or custody in seconds
- Every answer carries a citation to a specific ledger record, never an unsupported claim
- Explicitly declines when no record supports an answer, rather than guessing

**Success Measure:** Judge receives a cited, accurate answer to a live question within seconds, with zero staff delegation required, in 100% of live-question instances during the demo scenario.

**Related Features:** F7, F1
**Priority:** P0

---

### JTBD-01.2: Ambient Awareness Without Configuration

**Job Statement:**
When proceedings are underway, I want to glance at a passive, always-current view of trial activity and outstanding discrepancies, so I can stay aware of courtroom status without configuring dashboards or drilling into menus.

**Current Alternatives:**
- Relies entirely on staff or the deputy to verbally flag anything noteworthy
- Has no passive view at all today — awareness is reactive, triggered only when someone raises an issue

**Hiring Criteria:**
- Presents a single glanceable view of recent status changes, pending objections, and recent rulings with zero setup
- Surfaces outstanding discrepancies visually, without requiring a manual filter or search
- Updates live during proceedings without manual refresh

**Success Measure:** Judge can identify current trial status and any outstanding discrepancy within 10 seconds of glancing at the screen, with no configuration step required.

**Related Features:** F8
**Priority:** P1

---

### JTBD-01.3: Confidence Before Accepting the Jury Package

**Job Statement:**
When a finalized jury package is presented for acceptance, I want confidence that every objection/ruling conflict and custody gap was caught automatically, so I can accept it without independently re-verifying the work of courtroom staff.

**Current Alternatives:**
- Trusts the deputy/clerk's manual cross-referencing with no independent verification mechanism
- Risk of an exhibit with an unresolved objection entering the jury package unnoticed until it becomes a problem

**Hiring Criteria:**
- Jury package generation is hard-gated by discrepancy detection — a flagged exhibit cannot silently reach the final list
- Discrepancy warnings are visible on the same screen as the jury package, not buried elsewhere
- Zero discrepant exhibits appear in a package the judge is asked to accept

**Success Measure:** Zero instances of a judge ruling on, or accepting a jury package containing, stale, incomplete, or conflicting exhibit information across all tested scenarios.

**Related Features:** F6
**Priority:** P0

---

### JTBD-01.4: Instant Exhibit History Reconstruction

**Job Statement:**
When a prior ruling is challenged or revisited, I want the full history of the relevant exhibit instantly, so I can reconstruct context without assembling fragments from multiple people and documents after the fact.

**Current Alternatives:**
- Asks staff to manually piece together the exhibit's history from logs, notes, and recollection
- Reconstructing history today takes minutes to hours depending on how fragmented the original records were

**Hiring Criteria:**
- Full chronological timeline of status, objection, ruling, and custody events is available for any exhibit on demand
- History is reconstructed directly from the event ledger, not assembled manually by staff
- Accessible both via direct screen view and via a natural-language question to the assistant

**Success Measure:** Judge retrieves a complete exhibit history (all status, objection, ruling, and custody events) within seconds, with zero manual document assembly, in 100% of history-reconstruction requests.

**Related Features:** F10, F2
**Priority:** P0

---

### JTBD-01.5: Record a Ruling Without Leaving the Screen

**Job Statement:**
When an objection surfaces on the Command Center's attention feed or on an exhibit's Objection card, I want to record my ruling (sustained, overruled, or reserved) right there, so I can resolve it the moment I see it instead of routing the decision through a deputy or clerk because no UI exists for it.

**Current Alternatives:**
- Rules verbally and relies on the deputy/clerk to key the ruling into the system on the judge's behalf, since `recordRuling` has existed only as a backend service with no UI entry point anywhere in this product
- Has no way to verify the ruling was actually recorded correctly without asking the deputy/clerk to confirm it after the fact

**Hiring Criteria:**
- "Record ruling" control is reachable directly from the Command Center attention feed (HIGH/PENDING tiers) and from the Exhibit Detail Objection card, scoped to a single named objection — never an ambiguous exhibit-level action
- Disposition selector offers exactly Sustained/Overruled/Reserved, matching the existing judicial disposition model with no new values to learn
- Action is gated to the Judge role server-side — an unauthorized role never sees a control that would silently fail
- A Reserved disposition visibly leaves the objection open and re-ranked in the feed; a Sustained/Overruled disposition visibly closes it out, with no separate confirmation step needed from staff

**Success Measure:** Judge records a ruling directly from either entry point in a single explicit-confirm action, with zero deputy/clerk intermediary, and the ruling appears resolved on every open screen within one polling interval, in 100% of ruling attempts during the demo scenario.

**Related Features:** F24, F8, F10
**Priority:** P0

---

### JTBD-01.6: See What Needs Attention First, Ranked by Severity

**Job Statement:**
When I open the Command Center during a live trial, I want a single ranked feed of exactly what needs judicial or courtroom attention right now, so I can triage the case by actual severity instead of mentally cross-referencing separate objection and discrepancy panels to infer priority myself.

**Current Alternatives:**
- Scans the Recent Activity panel, the unresolved-objections list, and the discrepancy indicator separately and mentally combines them to decide what matters most right now
- Has no case-wide severity ordering today — a critical sealed-exhibit leak and a routine pending ruling look equally prominent until someone reads every panel

**Hiring Criteria:**
- A single feed surfaces every item needing attention — sealed/ex-parte jury-package blockers, admitted-with-open-objection cases, pending rulings, and admitted-no-custodian cases — ranked Critical > High > Pending > Medium, never interleaved out of tier order
- Within a tier, newest-first ordering requires no manual sort
- Every entry is traceable to the specific exhibit/objection driving it — no vague or unattributed "something needs attention" entry
- Feed updates on the existing live-sync interval with no manual refresh

**Success Measure:** Judge identifies the single most severe open item in the case within 10 seconds of opening the Command Center, with zero manual cross-referencing across separate panels, in 100% of attention-feed reviews during the demo scenario.

**Related Features:** F8
**Priority:** P0

---

### JTBD-01.7: Request Finalization From a Clerk Without an Out-of-Band Ask

**Job Statement:**
When I'm reviewing a jury package I'm not authorized to finalize myself, I want to request finalization from a clerk or deputy directly from the Jury Package Workspace, so I can move the package forward without stepping outside the system to ask verbally or by email.

**Current Alternatives:**
- Verbally asks a deputy or clerk to finalize, or sends an out-of-band message, with no record that the request was ever made or when
- Sees only a disabled "Finalize" control with no indication of what to do next or who to ask

**Hiring Criteria:**
- "Request finalization from Clerk" control replaces the disabled Finalize control for any role outside the finalize-authorized set (Judge, Chambers Staff, Attorney), rather than presenting a dead end
- The request is recorded with a timestamp and requesting user and is visible to finalize-authorized roles as a banner directly above their Finalize control — not on a separate notifications page
- Requesting finalization never bypasses the discrepancy gate or grants finalize authority — a package with open Blockers remains unfinalizable regardless of how many requests have been made
- A new request is resolved automatically the moment the package is actually finalized, with no separate manual dismissal step

**Success Measure:** Judge submits a finalization request in a single action from the Jury Package Workspace, and the assigned clerk/deputy sees the request as a visible banner on their own next screen load, with zero out-of-band communication, in 100% of request attempts during the demo scenario.

**Related Features:** F11
**Priority:** P1

---

## PER-02: Courtroom Deputy Dana Reyes (with Clerk of Court) — Jobs

### JTBD-02.1: One Trustworthy Real-Time Exhibit Record

**Job Statement:**
When logging status changes, objections/rulings, and custody transfers as they happen, I want a single real-time record that reflects every event accurately, so I never have to answer a question from memory or a sticky note.

**Current Alternatives:**
- Maintains exhibit status across spreadsheets, paper exhibit logs, and handwritten sticky notes
- No single system either the deputy, clerk, or anyone else can trust simultaneously as current

**Hiring Criteria:**
- Every status, objection/ruling, and custody event is recorded as an immutable, timestamped ledger entry
- Current status is always derived from the latest ledger event — never a manually-maintained field that can drift out of sync
- All screens and the assistant read the identical record, eliminating any chance of conflicting answers

**Success Measure:** 100% of status, objection, and custody queries are answered directly from the live record with zero reliance on memory, notes, or cross-referencing multiple sources.

**Related Features:** F0, F1, F3
**Priority:** P0

---

### JTBD-02.2: Instant Custody Answer

**Job Statement:**
When the bench or counsel asks who currently holds a given exhibit, I want an instant, confident answer, so I can respond without checking a paper log or guessing.

**Current Alternatives:**
- Checks a paper custody log or mentally recalls the last known handoff
- No structured, timestamped way to confirm a custody chain confidently if challenged

**Hiring Criteria:**
- Current custodian for any exhibit is retrievable in a single lookup or query
- Full chain-of-custody history (who, when, from/to) is available as discrete, timestamped events
- Custody answers are consistent whether asked via a screen or via the assistant

**Success Measure:** Deputy/clerk answers "who currently has custody of Exhibit X" in under 5 seconds, with zero paper-log lookups, in 100% of custody queries.

**Related Features:** F3
**Priority:** P0

---

### JTBD-02.3: Provably Clean Jury Package Assembly

**Job Statement:**
When assembling the jury package at the close of evidence, I want proof that no discrepant exhibit (unresolved objection, incomplete custody) slipped through, so I can finalize the package without manual cross-referencing against three different sources.

**Current Alternatives:**
- Manually cross-references exhibit status, objection history, and custody records against separate spreadsheets and logs
- No guarantee today that a discrepancy wasn't missed in the manual review

**Hiring Criteria:**
- Jury-eligible exhibit list is computed automatically from the current-state projection (admitted, no unresolved objection, complete custody)
- Discrepancy check runs and must be resolved or acknowledged before finalization — detection gates generation
- Discrepancy warnings surface directly on the jury package screen, not on a separate report

**Success Measure:** Zero manual cross-referencing steps required to confirm a jury package is free of discrepancies; 100% of seeded discrepancy cases are caught before finalization, not after.

**Related Features:** F5, F6, F11
**Priority:** P0

---

### JTBD-02.4: Fast Exhibit Location During Live Testimony

**Job Statement:**
When testimony is moving quickly and the bench or counsel needs an answer now, I want to locate any exhibit in seconds using structured search, so I can respond without scanning a full list or flipping through logs.

**Current Alternatives:**
- Scans a paper exhibit log or scrolls a spreadsheet looking for the right entry
- Relies on memory of exhibit numbers and descriptions, which breaks down as the exhibit count grows

**Hiring Criteria:**
- Search/filter by exhibit ID, description/keyword, status, witness, or date, with combinable filters
- Results surface fast enough to use live, mid-testimony, without noticeable lag
- Same search capability is available as an assistant tool, not only as a manual screen interaction

**Success Measure:** Deputy/clerk locates any requested exhibit in under 10 seconds during live testimony, in 100% of search attempts during the demo scenario.

**Related Features:** F4, F9
**Priority:** P1

---

### JTBD-02.5: Manage Multiple Active Cases Without Losing Context

**Job Statement:**
When handling exhibit logging and jury-package work across more than one active trial in the same session, I want to switch between cases from a single workspace, so I can move from one case to another without restarting the application or losing my place in either case.

**Current Alternatives:**
- Works against a hardcoded single demo case, with no way to represent or demonstrate a second active trial without a redeploy or data reset
- Relies on separate browser sessions, tabs, or manual environment resets to approximate working a second case, with no guarantee that data stays correctly scoped to the right one

**Hiring Criteria:**
- A case selector lists every active case available to me and lets me switch the active case context for every screen and the assistant in one action
- Switching cases updates every open screen and the assistant's working context consistently, with zero stale single-case data bleeding through
- All queries, writes, and assistant answers are strictly scoped to the currently selected case — no cross-case data ever appears

**Success Measure:** Deputy/clerk switches between two active cases and confirms zero cross-case data leakage (exhibits, custody, discrepancies) across every screen and the assistant, in 100% of switch attempts.

**Related Features:** F22
**Priority:** P1

---

### JTBD-02.6: Defensible Record of Exactly What the Jury Received

**Job Statement:**
When a jury package is finalized — and potentially re-finalized later after a late correction — I want a permanent, versioned, exportable record of exactly what was included at each finalization, so I can produce defensible proof of what the jury actually received if it's ever challenged after the fact.

**Current Alternatives:**
- Relies on a browser print dialog (`window.print()`) with no retained record of what the printed output actually contained or when it was produced
- Has no way to distinguish what the jury received at an initial finalization versus any later finalization after a correction, since nothing preserves prior versions

**Hiring Criteria:**
- Finalizing a jury package generates an actual PDF document suitable for formal handoff and archival, not a browser print approximation
- Every finalization produces a new, immutable version instead of overwriting the prior one, with full version history retrievable per case
- The exported PDF reflects the exact same discrepancy-gated, classification-excluded exhibit set the live workspace view shows at that moment — zero divergence between what's displayed and what's exported

**Success Measure:** Deputy/clerk retrieves the exact exhibit set and classification/status state of any prior jury-package finalization from version history, with zero discrepancy against the PDF originally exported, in 100% of version-retrieval attempts.

**Related Features:** F23
**Priority:** P1

---

### JTBD-02.7: Transfer or Assign Custody Without Leaving the Screen

**Job Statement:**
When an exhibit needs a custodian assigned for the first time or transferred to a new holder, I want to do it directly from the Exhibit Detail screen (or the Command Center attention feed), so I can complete the custody action the moment I identify the need instead of relying on an API client or a backend-only workflow that doesn't exist for courtroom staff.

**Current Alternatives:**
- Has no UI path at all for `recordCustodyTransfer` today — the action exists only as a backend service, so a custody change effectively cannot happen without engineering involvement or a workaround
- Tracks intended custody changes on paper or verbally until someone with API access can apply them

**Hiring Criteria:**
- A first-time assignment (no custodian of record) and a subsequent transfer (existing custodian, propose/accept flow) are both reachable from the Exhibit Detail header, using the correct underlying action for each case automatically
- A pending transfer is visibly distinguished from a confirmed one, with "Cancel pending transfer" and (for the named receiver only) "Confirm receipt" both available inline
- Action is gated to Deputy/Clerk/Admin roles (propose/assign/cancel) and identity-gated to the named receiver (confirm) — no control renders for an unauthorized user that would silently fail
- Every submission requires an explicit confirm step — no custody change is ever triggered by a single click with no confirmation

**Success Measure:** Deputy/clerk completes a custody assignment or transfer in a single screen, with zero reliance on an API client or backend workaround, and the change is reflected on every open screen within one polling interval, in 100% of custody-action attempts during the demo scenario.

**Related Features:** F24, F10, F8
**Priority:** P0

---

### JTBD-02.8: See Who Holds What Without Per-Exhibit Lookup

**Job Statement:**
When I need a case-wide picture of who's holding which exhibits, I want a single custody-by-custodian view on the Command Center, so I can see the whole custody picture at a glance instead of opening each exhibit's detail page one at a time.

**Current Alternatives:**
- Opens each exhibit's detail page individually, or relies on memory, to answer "what does each custodian currently have"
- Has no single screen today that groups exhibits by custodian — custody is only answerable one exhibit at a time via JTBD-02.2's per-exhibit lookup

**Hiring Criteria:**
- A single Command Center panel groups all exhibits by current custodian, requiring zero navigation into individual Exhibit Detail pages
- Exhibits with a pending (unconfirmed) transfer are shown under a distinct "pending transfer to {name}" grouping rather than silently folded into the current custodian's bucket
- Panel updates on the existing live-sync interval so a custody change made anywhere (including this screen's own inline actions) appears without manual refresh
- Panel is read-only except for the inline custody actions it shares with JTBD-02.7 — no separate interaction model to learn

**Success Measure:** Deputy/clerk identifies every custodian's current exhibit holdings case-wide within 15 seconds of opening the Command Center, with zero per-exhibit page visits, in 100% of custody-overview checks during the demo scenario.

**Related Features:** F8
**Priority:** P1

---

### JTBD-02.9: Act Immediately on a Flagged Attention-Feed Item

**Job Statement:**
When a flagged item appears on the Command Center's "Needs your attention" feed — a sealed exhibit wrongly included in the jury package, an exhibit needing a custodian — I want to act on it inline, right from the feed entry, so I can resolve it the moment I see it instead of navigating away to find the right screen and losing my place in the feed.

**Current Alternatives:**
- Reads the flagged item, then navigates to the Jury Package Workspace or Exhibit Detail separately to actually take action, losing the feed's context and needing to re-locate the same item afterward
- Has no inline path today for the tiers a deputy/clerk is authorized to act on — resolution always meant leaving the Command Center first (the objection-ruling tiers remain the judge's separate action, see JTBD-01.5)

**Hiring Criteria:**
- A Medium-tier (admitted, no custodian) entry carries an inline "Transfer custody"/"Assign custodian" action resolvable without leaving the feed
- A Critical-tier (sealed/ex-parte in jury package) entry links directly to the existing remove-from-package remediation already role-gated for clerk/admin, rather than requiring a fresh search for the offending exhibit
- Once an action is taken, the originating feed entry clears or re-ranks on the next poll tick with no manual refresh needed to confirm it worked
- Every inline action requires its existing explicit confirm step — nothing on the feed auto-submits on a single click

**Success Measure:** Deputy/clerk resolves a flagged Medium or Critical attention-feed item without navigating away from the Command Center, with the entry clearing within one polling interval of the action, in 100% of inline-resolution attempts during the demo scenario.

**Related Features:** F8, F24, F13
**Priority:** P0

---

## PER-03: Attorney Marcus Webb — Jobs

### JTBD-03.1: Confirm Status Before Acting in Argument

**Job Statement:**
When I'm about to reference an exhibit in argument or cross-examination, I want its current status confirmed instantly, so I can act on it with confidence mid-argument instead of risking a stale or incorrect assumption.

**Current Alternatives:**
- Flags down courtroom staff for a status check, which can cost the moment he needs to act in
- Relies on his own handwritten notes, which may be out of date by the time he needs them

**Hiring Criteria:**
- Status answers are available on demand without requiring courtroom staff as an intermediary
- Answers are returned fast enough to use live, mid-argument
- Every answer is cited to a specific record, not a best guess

**Success Measure:** Attorney obtains a cited, accurate status answer about any exhibit within seconds during live proceedings, without relying on courtroom staff, in 100% of status checks.

**Related Features:** F1, F7
**Priority:** P0

---

### JTBD-03.2: Know Objection Resolution Status

**Job Statement:**
When deciding whether to press a point or move on, I want to know whether an objection is still unresolved, so I can act with confidence instead of relying on fragmented personal notes across a multi-day trial.

**Current Alternatives:**
- Tracks objection and ruling history in his own handwritten notes across multiple trial days
- Notes become fragmented and error-prone as the exhibit count and trial length grow

**Hiring Criteria:**
- Unresolved objections are queryable across the whole case, not just per-exhibit
- Objection/ruling history for any exhibit is retrievable instantly, including which party objected and on what grounds
- Answer is consistent regardless of which day of trial the objection was originally raised

**Success Measure:** Attorney confirms objection resolution status for any exhibit in under 10 seconds, replacing reliance on personal notes, in 100% of objection-status queries.

**Related Features:** F2
**Priority:** P0

---

### JTBD-03.3: Verify Custody Chain to Challenge Admissibility

**Job Statement:**
When I want to challenge an exhibit's admissibility, I want the full chain-of-custody history on demand, so I can identify gaps with confidence instead of formally requesting it as evidence first.

**Current Alternatives:**
- Has no visibility into custody chain unless he formally requests it as evidence
- Cannot confidently challenge a custody gap in the moment without that formal request process

**Hiring Criteria:**
- Full chain-of-custody history (every transfer, timestamped) is retrievable for any exhibit without a formal evidentiary request
- Custody gaps are visually distinguishable from a complete chain
- History is available via both a direct screen view and a natural-language assistant query

**Success Measure:** Attorney retrieves a complete custody chain for any exhibit in under 10 seconds, enabling in-the-moment admissibility challenges, in 100% of custody-verification attempts.

**Related Features:** F3, F10
**Priority:** P1

---

### JTBD-03.4: Verify Jury Package Integrity

**Job Statement:**
When the jury package is finalized, I want to verify its exact contents against which exhibits were actually admitted and ruled upon, so I can be confident nothing improperly admitted reached the jury.

**Current Alternatives:**
- Relies on his own notes and recall to spot-check the final jury package against what he believes was admitted
- Risk that a flawed or improperly-admitted exhibit reaches the jury package unnoticed until after the fact

**Hiring Criteria:**
- Jury package contents are cross-checked against current admission and objection-resolution status automatically
- Discrepancy warnings, if any, are visible on the jury package view itself
- Attorney can query the assistant to confirm specific exhibits' jury-eligibility status directly

**Success Measure:** Zero surprises in jury package contents relative to the exhibits actually admitted and ruled upon, across all finalized packages reviewed.

**Related Features:** F5, F6, F11
**Priority:** P0

---

## PER-04: Administrator Priya Nair — Jobs

### JTBD-04.1: Validate Auditable, Immutable Record-Keeping

**Job Statement:**
When evaluating the system for adoption, I want proof that every exhibit event — status, objection, ruling, custody — produces an immutable, auditable record, so I can clear it for compliance review and appeals before recommending rollout.

**Current Alternatives:**
- Has no current way to audit how courtroom staff reconstruct an exhibit's history after the fact
- The historical record today lives in people's memory and informal notes, not a system that can be externally reviewed

**Hiring Criteria:**
- Every status, objection/ruling, and custody change is recorded as an append-only, timestamped ledger event — never overwritten or deleted
- Full historical reconstruction is possible for any exhibit at any point in the trial
- Ledger structure is reviewable independent of any single staff member's recollection

**Success Measure:** Administrator confirms 100% of reviewed exhibit events are traceable to an immutable ledger record, with full historical reconstruction possible for every tested exhibit.

**Related Features:** F0
**Priority:** P0

---

### JTBD-04.2: Confirm Automatic Discrepancy Detection

**Job Statement:**
When spot-checking system accuracy against seeded edge cases, I want direct evidence that discrepancies are caught automatically, so I can validate the reduction in institutional risk before recommending adoption.

**Current Alternatives:**
- Cannot verify from outside whether a given courtroom's records are currently accurate, since no single source of truth exists today
- Has no mechanism today to confirm discrepancies would have been caught before reaching a jury

**Hiring Criteria:**
- System automatically flags admitted-but-no-custodian and unresolved-objection-in-jury-package cases without manual intervention
- Discrepancy flags are visible and verifiable against known seed-data edge cases during an evaluation walkthrough
- Detection runs as a gate before jury package finalization, not as a post-hoc report

**Success Measure:** Administrator confirms discrepancy detection catches 100% of seeded edge cases without manual intervention, during a single spot-check evaluation session.

**Related Features:** F6
**Priority:** P0

---

### JTBD-04.3: Validate the Assistant Never Fabricates

**Job Statement:**
When reviewing assistant answers during evaluation, I want proof that the assistant never fabricates a claim and clearly declines when it lacks supporting data, so I can rule out the sanctioned-AI-citation risk before recommending adoption.

**Current Alternatives:**
- Relies on vendor claims or general AI reputation, with no direct evidence specific to this system
- Is aware of real-world legal-sector precedent of sanctions over fabricated AI citations and has no way today to rule this risk out for a new tool

**Hiring Criteria:**
- Every assistant answer reviewed resolves to a specific, citable ledger record
- Assistant explicitly declines to answer when no record supports a claim, rather than generating a plausible guess
- Assistant and UI screens never diverge on the same factual question, confirmed via spot-check

**Success Measure:** Administrator confirms 100% of the assistant's answers during review are cited and traceable to a ledger record, with zero ungrounded claims observed.

**Related Features:** F7
**Priority:** P0

---

### JTBD-04.4: Assess Adoption and Reconciliation Burden

**Job Statement:**
When assessing rollout cost across courtrooms, I want to see whether staff spend meaningfully less time reconciling spreadsheets, paper logs, and notes, so I can judge whether the adoption burden is low enough to recommend the system.

**Current Alternatives:**
- Has no current way to quantify time courtroom staff spend reconciling fragmented records across tools
- Assumes, without evidence, that any new system will require retraining and workflow disruption

**Hiring Criteria:**
- Search and browsing of the full exhibit set replaces the need to reconcile separate spreadsheets or logs
- Screens are understandable to non-technical staff without a dedicated training session
- System is demonstrably positioned as an assistant augmenting existing workflows, not a replacement case management system

**Success Measure:** Administrator concludes, after a single walkthrough, that the system credibly reduces staff reconciliation effort and is adoptable without formal retraining.

**Related Features:** F4, F9
**Priority:** P1

---

## Outcome-to-Feature Traceability

| JTBD ID | Feature | Expected Outcome |
|---------|---------|-----------------|
| JTBD-01.1 | F7, F1 | Judge gets a cited live answer in seconds with zero staff delegation |
| JTBD-01.2 | F8 | Judge maintains ambient trial awareness with zero configuration |
| JTBD-01.3 | F6 | Judge accepts jury packages with zero undetected discrepancies |
| JTBD-01.4 | F10, F2 | Judge reconstructs full exhibit history instantly, with zero manual assembly |
| JTBD-02.1 | F0, F1, F3 | Deputy/clerk maintains one trustworthy record with zero reliance on memory or notes |
| JTBD-02.2 | F3 | Deputy/clerk answers custody questions instantly with zero paper-log lookups |
| JTBD-02.3 | F5, F6, F11 | Deputy/clerk assembles a provably clean jury package with zero manual cross-referencing |
| JTBD-02.4 | F4, F9 | Deputy/clerk locates any exhibit in under 10 seconds during live testimony |
| JTBD-02.5 | F22 | Deputy/clerk switches between active cases with zero cross-case data leakage |
| JTBD-02.6 | F23 | Deputy/clerk retrieves a defensible, versioned PDF record of exactly what each jury package finalization contained |
| JTBD-01.5 | F24, F8, F10 | Judge records a ruling directly from the attention feed or Objection card with zero deputy/clerk intermediary |
| JTBD-01.6 | F8 | Judge identifies the single most severe open item in the case within 10 seconds via the severity-ranked attention feed |
| JTBD-01.7 | F11 | Judge requests finalization from a clerk/deputy directly from the Jury Package Workspace with zero out-of-band communication |
| JTBD-02.7 | F24, F10, F8 | Deputy/clerk completes a custody assignment or transfer in a single screen with zero API-client workaround |
| JTBD-02.8 | F8 | Deputy/clerk sees every custodian's current holdings case-wide within 15 seconds with zero per-exhibit page visits |
| JTBD-02.9 | F8, F24, F13 | Deputy/clerk resolves a flagged Medium/Critical attention-feed item inline with zero navigation away from Command Center |
| JTBD-03.1 | F1, F7 | Attorney confirms exhibit status in seconds without relying on courtroom staff |
| JTBD-03.2 | F2 | Attorney confirms objection resolution status in under 10 seconds |
| JTBD-03.3 | F3, F10 | Attorney verifies custody chain in under 10 seconds without a formal evidentiary request |
| JTBD-03.4 | F5, F6, F11 | Attorney confirms zero surprises in finalized jury package contents |
| JTBD-04.1 | F0 | Administrator confirms 100% of events are traceable to an immutable ledger record |
| JTBD-04.2 | F6 | Administrator confirms 100% of seeded discrepancies are caught automatically |
| JTBD-04.3 | F7 | Administrator confirms zero ungrounded assistant claims during review |
| JTBD-04.4 | F4, F9 | Administrator concludes adoption burden is low enough to recommend rollout |

---

## NaC Preview

| JTBD ID | Outcome | Candidate NaC |
|---------|---------|--------------|
| JTBD-01.1 | Cited live answer in seconds, zero staff delegation | Given a live natural-language question during proceedings, the assistant returns a cited answer within seconds, 100% of the time for the five named example questions |
| JTBD-01.2 | Ambient trial awareness, zero configuration | Given the Trial Command Center is open with no setup performed, recent status changes, pending objections, and discrepancies are visible without drilling into any menu |
| JTBD-01.3 | Jury package acceptance with zero undetected discrepancies | Given a jury package is presented for judicial acceptance, zero discrepant exhibits (unresolved objection or incomplete custody) are present in the finalized list |
| JTBD-01.4 | Instant full exhibit history reconstruction | Given a request to review an exhibit's history, every status, objection, ruling, and custody event appears in a single chronological timeline with zero manual assembly |
| JTBD-02.1 | One trustworthy real-time record | Given any status, objection/ruling, or custody event is logged, it appears identically across every screen and the assistant with zero discrepancy between sources |
| JTBD-02.2 | Instant custody answer | Given a request for "who currently has custody of Exhibit X," the current custodian is returned in under 5 seconds with zero paper-log lookup |
| JTBD-02.3 | Provably clean jury package assembly | Given a jury package finalization attempt, the system blocks or flags finalization until 100% of discrepancy checks are resolved or acknowledged |
| JTBD-02.4 | Fast exhibit location during live testimony | Given a search by ID, keyword, status, witness, or date (or combination), matching exhibits are returned in under 10 seconds |
| JTBD-02.5 | Switch between multiple active cases with zero cross-case leakage | Given two or more active cases exist, selecting a case from the case selector updates every screen and the assistant to that case's data exclusively, with zero data from the other case visible anywhere |
| JTBD-02.6 | Defensible, versioned proof of exact jury-package contents | Given a jury package is finalized (or re-finalized after a correction), a new immutable PDF version is generated and retrievable from version history, exactly matching the discrepancy-gated, classification-excluded exhibit set shown on the live workspace at that moment |
| JTBD-01.5 | Ruling recorded directly from the UI, zero deputy/clerk intermediary | Given a judge opens "Record ruling" from the attention feed or Objection card and selects a disposition, the objection thread updates (closed for Sustained/Overruled, still open for Reserved) and is reflected on every open screen within one polling interval |
| JTBD-01.6 | Most severe open item identified within 10 seconds | Given the Command Center attention feed is open, every Critical/High/Pending/Medium item across the case is visible in strict tier order, newest-first within each tier, with zero items from a lower tier appearing before a higher one |
| JTBD-01.7 | Finalization requested with zero out-of-band communication | Given a non-finalize-authorized role clicks "Request finalization from Clerk," a timestamped request appears as a banner on the next screen load for every finalize-authorized role viewing the same package |
| JTBD-02.7 | Custody assigned/transferred in a single screen, zero API workaround | Given a deputy/clerk opens the custody action from Exhibit Detail or the attention feed and confirms, the correct action (assign, propose, confirm, or cancel) is invoked automatically based on current custody state, with no manual endpoint selection |
| JTBD-02.8 | Every custodian's holdings visible case-wide within 15 seconds | Given the Command Center is open, exhibits are grouped by current custodian with pending transfers shown in a distinct grouping, requiring zero navigation into individual Exhibit Detail pages |
| JTBD-02.9 | Flagged item resolved inline, zero navigation away | Given a Medium or Critical attention-feed entry is acted on inline, the entry clears or re-ranks on the next poll tick with no manual page reload required to confirm the action succeeded |
| JTBD-03.1 | Confirmed exhibit status before acting in argument | Given an attorney asks for an exhibit's current status, a cited answer is returned within seconds without requiring courtroom staff involvement |
| JTBD-03.2 | Known objection resolution status | Given a query for unresolved objections (case-wide or per-exhibit), the full current objection/ruling status is returned in under 10 seconds |
| JTBD-03.3 | Verified custody chain for admissibility challenge | Given a request for an exhibit's chain-of-custody, the full timestamped transfer history is returned in under 10 seconds with any gaps visually distinguishable |
| JTBD-03.4 | Verified jury package integrity | Given a finalized jury package, every included exhibit reflects admitted status with no unresolved objection, verifiable by the attorney with zero surprises |
| JTBD-04.1 | Immutable, auditable record confirmed | Given an administrator reviews any exhibit's event history, 100% of events are traceable to an append-only ledger record that cannot be overwritten or deleted |
| JTBD-04.2 | Automatic discrepancy detection confirmed | Given seeded edge cases (unresolved-objection-in-jury-package, admitted-no-custodian), 100% are flagged automatically without manual intervention |
| JTBD-04.3 | Zero ungrounded assistant claims confirmed | Given a review of assistant answers across a demo session, 100% resolve to a specific ledger citation or an explicit "I don't have that information" decline |
| JTBD-04.4 | Low adoption burden confirmed | Given a single walkthrough of all five screens, a non-technical reviewer can correctly describe system behavior without a formal training session |

---

*Document generated by Pivota Spec Framework*
*Last updated: 2026-10-09 (added JTBD-01.5–01.7, JTBD-02.7–02.9 for Phase 8)*
