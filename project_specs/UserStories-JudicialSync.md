# User Stories
## JudicialSync

| Field | Value |
|-------|-------|
| **Product Name** | JudicialSync |
| **Date** | 2026-10-06 |
| **Related PRD** | PRD-JudicialSync.md |
| **Related FRD** | FRD-JudicialSync.md |

---

## Story Format

Each story follows: **As a [persona], I want to [action], so that [outcome].**

Acceptance criteria are listed beneath each story. Stories are grouped by epic (matching PRD features F0–F15) and prioritised. Personas (Judge Elena Marsh, Chambers Staff, Courtroom Deputy Dana Reyes, Clerk of Court, Attorney Marcus Webb, Administrator Priya Nair) are drawn directly from `PERSONAS-JudicialSync.md`.

---

## Epic 0: Exhibit Workspace (Data Model) (F0)

### US-0.1: Create Exhibit Identity Record
**As a** Courtroom Deputy Dana Reyes, **I want to** create a new exhibit identity record with its label, description, source, and offering party, **so that** every exhibit entering the trial has a trustworthy, unique identity before any status or custody history begins.

**Acceptance Criteria:**
- [ ] `exhibitLabel` is unique within the case; a duplicate submission is rejected with 409 `EXHIBIT_LABEL_CONFLICT`
- [ ] `offeringParty` must be one of `PLAINTIFF`, `PROSECUTION`, `DEFENSE`; invalid values are rejected with 422 `VALIDATION_ERROR`
- [ ] `description` is required, non-empty, max 1000 characters
- [ ] `isSealed` can be set at creation to control role-based visibility
- [ ] No status, custody, or ruling fields can be set directly at creation — only identity fields are accepted

**Priority:** P0 | **Feature Ref:** F0

---

### US-0.2: Rely on Deterministic Seeded Demo Data
**As a** Administrator Priya Nair, **I want to** the demo environment load a realistic multi-exhibit trial with deliberately planted edge cases every time, **so that** I can evaluate discrepancy detection and system behavior without manual setup or risk of a too-clean dataset.

**Acceptance Criteria:**
- [ ] Seed loader creates one `Case`, one seeded `User` per role, and a realistic multi-exhibit set using only the same `recordEvent()` function the live UI uses
- [ ] Seed data includes at least one exhibit with an unresolved objection, one admitted exhibit with no custody record, and one exhibit eligible for the jury package despite an unresolved objection
- [ ] The seed transaction fails fast (aborts entirely) via a post-seed assertion if any required edge case is missing, rather than silently loading incomplete data
- [ ] The full demo scenario runs start-to-finish with zero manual data entry

**Priority:** P0 | **Feature Ref:** F0

---

### US-0.3: Trust the Append-Only Event Ledger as Ground Truth
**As a** Administrator Priya Nair, **I want to** every status, objection, ruling, and custody change recorded as an immutable, timestamped ledger event, **so that** I can confirm the system supports full audit and historical reconstruction for compliance review.

**Acceptance Criteria:**
- [ ] `ExhibitEvent` rows are never updated or deleted after creation
- [ ] Each event is stamped with a per-exhibit monotonically increasing `sequence_no` at write time
- [ ] Current-state projections (status, objection, custody) can be fully rebuilt by replaying ledger events in `sequence_no` order, producing an identical result
- [ ] No UI or assistant code path writes directly to a current-state table — `recordEvent()` is the sole write path

**Priority:** P0 | **Feature Ref:** F0

---

## Epic 1: Exhibit Status Display (F1)

### US-1.1: Record a Status Transition
**As a** Courtroom Deputy Dana Reyes, **I want to** record an exhibit's status transition (e.g., marked to offered to admitted) as it happens during proceedings, **so that** the exhibit's lifecycle state is always current and visible to everyone.

**Acceptance Criteria:**
- [ ] Valid forward transitions follow the defined admission-lifecycle state machine (MARKED → OFFERED → OBJECTED → ADMITTED/EXCLUDED/WITHDRAWN)
- [ ] An exhibit with zero prior status events only accepts `MARKED` as its first transition
- [ ] `OBJECTED` is only accepted while at least one `UNRESOLVED` objection exists for the exhibit
- [ ] Terminal statuses (`ADMITTED`, `EXCLUDED`, `WITHDRAWN`) reject any further status change with 409 `STATUS_FINALIZED`
- [ ] Concurrent stale-state writes are rejected with 409 `STATUS_CONFLICT` rather than silently overwritten

**Priority:** P0 | **Feature Ref:** F1

---

### US-1.2: See Consistent Status at a Glance
**As a** Judge Elena Marsh, **I want to** see an exhibit's current status displayed identically across every screen I view, **so that** I never act on stale or conflicting information during a live proceeding.

**Acceptance Criteria:**
- [ ] Current status badge uses a consistent visual convention across Command Center, Case Workspace, Exhibit Detail, and Jury Package screens
- [ ] Status shown always reflects the latest `STATUS_CHANGE` event in the ledger — no cached or divergent state across screens
- [ ] Status changes recorded by another user appear on an open screen within the live-sync polling interval (3–5s) without manual refresh

**Priority:** P0 | **Feature Ref:** F1

---

## Epic 2: Objection and Ruling Tracking (F2)

### US-2.1: Log an Objection Against an Exhibit
**As a** Attorney Marcus Webb, **I want to** have my objection to a specific exhibit recorded with its grounds and timestamp, **so that** there is an authoritative, timestamped record of my objection for the court to rule on.

**Acceptance Criteria:**
- [ ] An objection can only be raised against an exhibit currently `OFFERED` or already `OBJECTED` — rejected with 422 `INVALID_OBJECTION_TARGET` otherwise
- [ ] `grounds` is required and non-empty (e.g., "hearsay", "lack of foundation")
- [ ] A unique `objectionId` is generated and an `UNRESOLVED` `ObjectionCurrentState` thread is created
- [ ] A single exhibit can have multiple independent, concurrently open objection threads

**Priority:** P0 | **Feature Ref:** F2

---

### US-2.2: Record a Judicial Ruling on an Objection
**As a** Judge Elena Marsh, **I want to** record my ruling (sustained, overruled, or reserved) against a specific objection thread, **so that** the resolution is permanently and accurately tied to that objection.

**Acceptance Criteria:**
- [ ] A ruling's `objectionId` must reference an existing, currently `UNRESOLVED` thread — rejected with 404/409 otherwise
- [ ] Any ruling disposition — `SUSTAINED`, `OVERRULED`, or `RESERVED` — can only be recorded by a user with role `JUDGE` — rejected with 403 `ROLE_NOT_PERMITTED` otherwise (reserving a ruling is a judicial act, not a clerical log entry)
- [ ] `SUSTAINED`/`OVERRULED` closes the thread (excluded from unresolved-objections queries); `RESERVED` keeps it `UNRESOLVED`
- [ ] The ruling event and its disposition are permanently retrievable in the exhibit's history timeline

**Priority:** P0 | **Feature Ref:** F2

---

### US-2.3: Query All Unresolved Objections Case-Wide
**As a** Courtroom Deputy Dana Reyes, **I want to** pull a list of every currently unresolved objection across the whole case, **so that** I can confirm nothing is overlooked before a jury package is assembled.

**Acceptance Criteria:**
- [ ] `getUnresolvedObjections` returns identical results whether called from Case Workspace, Command Center, or the assistant
- [ ] Results include exhibit, objecting party, grounds, and raised timestamp for each open thread
- [ ] `RESERVED` rulings still count as unresolved in this list

**Priority:** P1 | **Feature Ref:** F2

---

## Epic 3: Custody Tracking (F3)

### US-3.1: Record a Custody Transfer
**As a** Courtroom Deputy Dana Reyes, **I want to** log every custody transfer of a physical or digital exhibit as it happens, **so that** there is an unbroken, auditable chain-of-custody record I can stand behind if challenged.

**Acceptance Criteria:**
- [ ] `fromCustodianUserId` must exactly match the exhibit's current recorded custodian (or both null for the first-ever transfer) — mismatches rejected with 409 `CUSTODY_CHAIN_BROKEN`
- [ ] `toCustodianUserId` must reference an existing active user — rejected with 422 `INVALID_CUSTODIAN` otherwise
- [ ] `fromCustodianUserId` and `toCustodianUserId` must differ — no-op transfers rejected with 422 `NO_OP_TRANSFER`
- [ ] Each transfer is recorded as a discrete, immutable ledger event, never overwriting a "current holder" field

**Priority:** P0 | **Feature Ref:** F3

---

### US-3.2: Instantly Look Up Current Custodian
**As a** Attorney Marcus Webb, **I want to** instantly see who currently has custody of a specific exhibit, **so that** I can challenge or confirm an exhibit's chain of custody in the moment, without waiting on a paper log.

**Acceptance Criteria:**
- [ ] `getCustodian(exhibitId)` returns the current custodian name derived from `CustodyCurrentState`, not a manual log
- [ ] The same lookup result is returned identically whether viewed on Case Workspace, Exhibit Detail, or asked via the assistant
- [ ] An exhibit with no recorded custody event returns a clear "no custodian of record" result rather than a blank or error

**Priority:** P0 | **Feature Ref:** F3

---

### US-3.3: Review Full Chain-of-Custody History
**As a** Judge Elena Marsh, **I want to** review the complete, timestamped chain-of-custody history for an exhibit, **so that** I can evaluate a custody challenge with full confidence in the record's completeness.

**Acceptance Criteria:**
- [ ] `getCustodyHistory(exhibitId)` returns every `CUSTODY_TRANSFER` event in chronological order with from/to custodian, timestamp, and reason
- [ ] History is complete — no filtering or truncation of custody events
- [ ] The same history is shown on Exhibit Detail View and returned by the assistant's "what happened to this exhibit" answer

**Priority:** P1 | **Feature Ref:** F3

---

## Epic 4: Exhibit Search (F4)

### US-4.1: Search Exhibits by Combinable Criteria
**As a** Courtroom Deputy Dana Reyes, **I want to** search and filter exhibits by ID, keyword, status, witness, or date in combination, **so that** I can locate the exact exhibit a judge or attorney is asking about during fast-moving testimony.

**Acceptance Criteria:**
- [ ] Filters combine with AND semantics in a single query (e.g., admitted exhibits from witness Smith)
- [ ] At least one search criterion must be supplied — an empty search request returns 422 `EMPTY_SEARCH_CRITERIA`
- [ ] `dateFrom` must be ≤ `dateTo` when both are supplied, otherwise rejected with 422 `INVALID_DATE_RANGE`
- [ ] Results exclude sealed exhibits for roles outside the visibility set, with no indication a hidden match exists

**Priority:** P1 | **Feature Ref:** F4

---

### US-4.2: Ask the Assistant to Find Exhibits by Criteria
**As a** Judge Elena Marsh, **I want to** ask the assistant a natural-language question like "admitted exhibits from witness Smith," **so that** I get the same filtered result I'd get from the Case Workspace search bar, without navigating there myself.

**Acceptance Criteria:**
- [ ] The assistant resolves the natural-language question into equivalent structured search criteria and calls the same `searchExhibits` service function as the UI
- [ ] Returned exhibits match exactly what the Case Workspace search bar would show for the same criteria and role
- [ ] Results are ordered consistently (`exhibitLabel` ascending) matching UI behavior

**Priority:** P1 | **Feature Ref:** F4, F7

---

## Epic 5: Jury-Ready Exhibit List Generation (F5)

### US-5.1: Compute the Jury-Eligible Exhibit Candidate Set
**As a** Clerk of Court, **I want to** have the system automatically compute which admitted exhibits are eligible for the jury package, **so that** I don't have to manually cross-reference exhibit status against three different sources.

**Acceptance Criteria:**
- [ ] Only exhibits with `currentStatus = ADMITTED` are ever considered — no `MARKED`, `OFFERED`, `OBJECTED`, `EXCLUDED`, or `WITHDRAWN` exhibit is included under any path
- [ ] Discrepancy detection runs automatically against every candidate exhibit before the draft package is created — not as an optional or skippable step
- [ ] Each candidate is annotated as `CLEAN` or `FLAGGED` based on its live discrepancy status

**Priority:** P0 | **Feature Ref:** F5

---

### US-5.2: Finalize a Discrepancy-Free Jury Package
**As a** Courtroom Deputy Dana Reyes, **I want to** finalize the jury package only once every included exhibit is free of open discrepancies, **so that** I can hand it off with confidence nothing improperly admitted slipped through.

**Acceptance Criteria:**
- [ ] Finalization re-runs discrepancy evaluation fresh at the moment of finalization, not from a cached draft-time annotation
- [ ] Finalization is rejected with 409 `JURY_PACKAGE_DISCREPANCIES_OPEN` if any included exhibit has an `OPEN` discrepancy, returning the specific blocking exhibits
- [ ] Only `DEPUTY`, `CLERK`, or `ADMIN` roles may finalize — other roles rejected with 403 `ROLE_NOT_PERMITTED`
- [ ] Once `FINALIZED`, the package and its exhibit list become immutable — no further additions or removals

**Priority:** P0 | **Feature Ref:** F5

---

## Epic 6: Discrepancy Identification (F6)

### US-6.1: Automatically Flag Admitted Exhibits Missing Custody
**As a** Judge Elena Marsh, **I want to** have the system automatically flag any admitted exhibit with no recorded custodian, **so that** this risk is caught before it becomes a problem rather than discovered after the fact.

**Acceptance Criteria:**
- [ ] Rule `ADMITTED_NO_CUSTODIAN` fires whenever an exhibit's status is `ADMITTED` and no custody record exists for it
- [ ] The flag is created automatically by the rule engine after every relevant ledger write — never manually created by a user
- [ ] The flag is visibly surfaced on Case Workspace and Jury Package Workspace screens, and is answerable via the assistant

**Priority:** P0 | **Feature Ref:** F6

---

### US-6.2: Automatically Flag Unresolved Objections Reaching Jury Eligibility
**As a** Judge Elena Marsh, **I want to** have the system flag any exhibit that is jury-eligible despite an unresolved objection, **so that** nothing improperly reaches the jury package unnoticed.

**Acceptance Criteria:**
- [ ] Rule `UNRESOLVED_OBJECTION_JURY_ELIGIBLE` fires whenever an exhibit's status is `ADMITTED` and at least one objection thread remains `UNRESOLVED`
- [ ] The flag updates to `RESOLVED` automatically once the underlying condition no longer holds (e.g., the objection is ruled upon)
- [ ] The flag blocks jury package finalization per F5 until addressed

**Priority:** P0 | **Feature Ref:** F6

---

### US-6.3: Acknowledge a Discrepancy with Justification
**As a** Clerk of Court, **I want to** explicitly acknowledge an open discrepancy with a documented justification when it's a recognized, acceptable condition, **so that** I can proceed with an auditable record of the risk acceptance rather than a silent override.

**Acceptance Criteria:**
- [ ] Acknowledgment requires a non-empty justification, max 500 characters — rejected with 422 `JUSTIFICATION_REQUIRED` if empty
- [ ] Only `DEPUTY`, `CLERK`, `JUDGE`, or `ADMIN` roles may acknowledge — rejected with 403 `ROLE_NOT_PERMITTED` otherwise
- [ ] Acknowledgment is recorded as an immutable `DISCREPANCY_ACKNOWLEDGED` ledger event, not a silent status flip
- [ ] An `ACKNOWLEDGED` flag remains visibly surfaced on every screen as a recorded risk acceptance — it is never hidden
- [ ] Acknowledging an already-resolved or already-acknowledged flag is idempotent, returning existing state with 200

**Priority:** P0 | **Feature Ref:** F6

---

## Epic 7: Pivota Assistant (Natural-Language Q&A) (F7)

### US-7.1: Ask the Assistant a Live Courtroom Question
**As a** Judge Elena Marsh, **I want to** ask the Pivota Assistant any natural-language question about exhibit status, custody, objections, or jury eligibility during live proceedings, **so that** I get an immediate answer without pausing the courtroom or delegating a manual lookup.

**Acceptance Criteria:**
- [ ] The assistant answers the five named example questions (admitted yesterday, unresolved objections, jury package membership, current custodian, exhibit history) correctly against seed data
- [ ] Responses stream to the chat panel via the Vercel AI SDK `useChat` interface
- [ ] Malformed tool-call arguments are rejected before reaching the service layer, surfaced back to the model as a tool-level error rather than silently passed through
- [ ] The same question asked twice in a session returns a fresh, re-queried answer rather than stale reused history for status/custody questions

**Priority:** P0 | **Feature Ref:** F7

---

### US-7.2: Trust Every Assistant Answer is Cited
**As a** Administrator Priya Nair, **I want to** have every factual claim the assistant makes carry a visible citation to a specific ledger record, **so that** I can confirm the system never fabricates a plausible-sounding but unsupported answer.

**Acceptance Criteria:**
- [ ] Every factual sentence in an assistant response has at least one inline citation (record type, ID, timestamp) visibly rendered, not hidden metadata
- [ ] Zero instances exist of a factual claim with no associated citation during testing — treated as a release blocker, not a warning
- [ ] Citations and conversation history are persisted (`AssistantConversation`, `AssistantMessage`, `AssistantCitation`) for later audit review

**Priority:** P0 | **Feature Ref:** F7

---

### US-7.3: Receive an Explicit Decline When No Record Supports an Answer
**As a** Attorney Marcus Webb, **I want to** have the assistant explicitly tell me it doesn't have the information when no record supports my question, **so that** I never mistake silence or a guess for a reliable answer.

**Acceptance Criteria:**
- [ ] If no tool call returns a relevant record, the assistant responds with an explicit "I don't have that information" statement rather than inferring or guessing
- [ ] The decline response is treated as valid, expected behavior in testing, not a failure mode
- [ ] The assistant never hedges with vague caveats when it does have a grounded answer

**Priority:** P0 | **Feature Ref:** F7

---

### US-7.4: Keep Assistant Answers Role-Scoped
**As a** Administrator Priya Nair, **I want to** have the assistant apply the same role-based visibility rules as the UI, **so that** no user can use the assistant to see sealed or sidebar information outside their authorized role.

**Acceptance Criteria:**
- [ ] A sealed exhibit is excluded from assistant tool results identically to how it's excluded from UI queries for an unauthorized role
- [ ] When the only matching record is sealed and the user's role lacks visibility, the assistant declines without revealing that a matching record exists
- [ ] Role-based filtering is applied inside the service layer the tool wrapper calls — there is no "assistant admin override" path

**Priority:** P0 | **Feature Ref:** F7

---

### US-7.5: See a Clear Fallback When the Assistant Is Temporarily Unavailable
**As a** Judge Elena Marsh, **I want to** see a clear, non-alarming message if the Pivota Assistant is temporarily unavailable, **so that** I know to retry or fall back to a screen lookup instead of assuming the system has failed silently or mistaking the outage for a grounded answer.

**Acceptance Criteria:**
- [ ] If the LLM provider is unreachable or times out, the chat UI displays an explicit "The assistant is temporarily unavailable — please try again" message (503 `ASSISTANT_UNAVAILABLE`)
- [ ] This outage message is visually and textually distinct from a Decline Response ("I don't have that information") — a judge or clerk must never confuse a system outage with a grounded absence-of-record answer
- [ ] The user's typed question is preserved in the chat input and can be resubmitted without retyping
- [ ] All other screens (Trial Command Center, Case Workspace, Exhibit Detail, Jury Package Workspace) remain fully usable for manual lookup during an assistant outage, since they read the same service layer independent of the assistant route

**Priority:** P1 | **Feature Ref:** F7

---

## Epic 8: Trial Command Center Screen (F8)

### US-8.1: Glance at Ambient Trial Activity
**As a** Judge Elena Marsh, **I want to** glance at a passive, live-updating view of recent trial activity, unresolved objections, and discrepancies, **so that** I stay aware of what's happening without configuring or drilling into anything.

**Acceptance Criteria:**
- [ ] Screen displays three panels: Recent Activity, Unresolved Objections, and Discrepancies, each with counts and lists
- [ ] Recent Activity reflects ledger events within the current trial day by default, ordered newest-first
- [ ] Screen polls underlying endpoints every 3–5 seconds so changes recorded elsewhere appear without manual refresh
- [ ] Screen contains no data-entry controls — it is read-only, link-through only to detail screens

**Priority:** P1 | **Feature Ref:** F8

---

### US-8.2: Drill Through from Command Center to Detail Screens
**As a** Chambers Staff member, **I want to** click through from a Command Center item to its full exhibit or discrepancy detail, **so that** I can quickly research the full context behind an ambient alert.

**Acceptance Criteria:**
- [ ] Each Recent Activity, Unresolved Objection, and Discrepancy item links through to the relevant F9/F10/F11 screen
- [ ] Navigating through preserves the context of the item clicked (e.g., lands on the correct exhibit's detail view)

**Priority:** P1 | **Feature Ref:** F8

---

## Epic 9: Case Workspace Screen (F9)

### US-9.1: Browse the Full Case Exhibit List
**As a** Courtroom Deputy Dana Reyes, **I want to** view the complete list of exhibits in the case with status, party, witness, and discrepancy indicators, **so that** I have one trustworthy surface for browsing the full exhibit set instead of a spreadsheet.

**Acceptance Criteria:**
- [ ] The list includes every visible exhibit (role-based visibility applied) with exhibit label, description, offering party, witness, status badge, current custodian, and discrepancy indicator
- [ ] Sealed exhibits are simply absent from the list for unauthorized roles — never shown as redacted rows
- [ ] The list polls for updates on the standard live-sync interval so changes from other users appear without manual refresh

**Priority:** P0 | **Feature Ref:** F9

---

### US-9.2: Drill Into an Exhibit's Full Detail
**As a** Attorney Marcus Webb, **I want to** click any exhibit row in the Case Workspace to open its full detail view, **so that** I can research exhibit history when I need more than the at-a-glance summary.

**Acceptance Criteria:**
- [ ] Clicking any exhibit row navigates to that exhibit's Exhibit Detail View (F10)
- [ ] Discrepancy indicator icons are visible per row without requiring drill-in

**Priority:** P0 | **Feature Ref:** F9

---

## Epic 10: Exhibit Detail View Screen (F10)

### US-10.1: Review the Full Chronological History of an Exhibit
**As a** Judge Elena Marsh, **I want to** see every status change, objection, ruling, and custody transfer for a single exhibit as one chronological timeline, **so that** I can answer "what happened to this exhibit" without assembling fragments from multiple people and documents.

**Acceptance Criteria:**
- [ ] The timeline renders one entry per ledger event in sequence order, with no filtering or truncation — complete history, not "recent N events"
- [ ] Each entry is translated into a plain-language summary (e.g., "Status changed from Offered to Admitted") rather than raw enum/JSON values
- [ ] Each entry displays the actor, timestamp, and is independently citable, matching the assistant's `getExhibitHistory` answer exactly
- [ ] Current status, current custodian, and any active discrepancy flags are shown prominently above the timeline

**Priority:** P0 | **Feature Ref:** F10

---

### US-10.2: Have Sealed Exhibits Behave as Non-Existent for Unauthorized Roles
**As a** Administrator Priya Nair, **I want to** have a sealed exhibit's detail view return a plain "not found" to an unauthorized role rather than a permission-denied message, **so that** the system never reveals that sensitive material exists to someone who shouldn't know.

**Acceptance Criteria:**
- [ ] A sealed exhibit viewed by an unauthorized role returns 404 `EXHIBIT_NOT_FOUND`, identical in message to a truly nonexistent exhibit
- [ ] No distinguishing error code or message reveals the existence of the sealed record

**Priority:** P1 | **Feature Ref:** F10

---

## Epic 11: Jury Package Workspace Screen (F11)

### US-11.1: Review the Jury Package and Its Discrepancy Warnings
**As a** Clerk of Court, **I want to** see the current jury package's exhibit list with discrepancy warnings clearly marked, **so that** I know exactly what must be resolved before I can hand the package off.

**Acceptance Criteria:**
- [ ] Screen displays package status (`DRAFT`/`FINALIZED`) prominently with the exhibit list below
- [ ] Each row shows exhibit label, status badge, and a discrepancy warning badge when `discrepancyStatus` is `FLAGGED`
- [ ] Screen polls for live updates while in `DRAFT` state, reflecting fixes or acknowledgments made elsewhere

**Priority:** P0 | **Feature Ref:** F11

---

### US-11.2: Be Prevented From Finalizing a Discrepant Package
**As a** Courtroom Deputy Dana Reyes, **I want to** have the "Finalize Jury Package" control disabled while any included exhibit has an open discrepancy, **so that** I physically cannot ship a discrepant package by mistake, not just get an error message after trying.

**Acceptance Criteria:**
- [ ] The Finalize control is disabled (not just error-returning) whenever any included exhibit's discrepancy status is `FLAGGED` and `OPEN`
- [ ] Finalization re-validates server-side even if somehow triggered with stale client state, rejecting with 409 if any open discrepancy remains
- [ ] Once finalized, the screen switches to a read-only, export-ready presentation with no acknowledge/resolve/remove controls

**Priority:** P0 | **Feature Ref:** F11

---

## Epic 12: Admission Integrity Gating (F12)

### US-12.1: Be Blocked From Admitting an Exhibit With an Unresolved Objection or No Custodian
**As a** Courtroom Deputy Dana Reyes, **I want to** have the system reject my attempt to transition an exhibit to `ADMITTED` status when it still has an unresolved objection or no custodian on record, **so that** an invalid admission can never be recorded in the first place, rather than slipping through and only being flagged afterward.

**Acceptance Criteria:**
- [ ] A `toStatus = ADMITTED` request is rejected with 422 `ADMISSION_BLOCKED` when ≥1 `ObjectionCurrentState` row for the exhibit has `status = 'UNRESOLVED'` at check time
- [ ] A `toStatus = ADMITTED` request is rejected with 422 `ADMISSION_BLOCKED` when no `CustodyCurrentState` row exists for the exhibit, or its `currentCustodianUserId` is null, at check time
- [ ] On rejection, no `ExhibitEvent` row is appended and `ExhibitCurrentState` is left completely unchanged — the exhibit's status remains exactly what it was prior to the attempt
- [ ] Both checks run atomically in the same transaction as the existing `fromStatus`-match check, so a concurrent objection or custody write cannot slip through between validation and ledger append
- [ ] `EXCLUDED` and `WITHDRAWN` transitions are unaffected by this gate and may still be recorded with an open objection or custody gap present
- [ ] An exhibit that remains `OBJECTED` (not attempting `ADMITTED`) is unaffected by this gate and continues to be covered only by F6's discrepancy rules

**Priority:** P0 | **Feature Ref:** F12

---

### US-12.2: See Every Blocking Reason at Once, Not Just the First One Found
**As a** Courtroom Deputy Dana Reyes, **I want to** see all applicable reasons an admission attempt was blocked in a single response, **so that** I can resolve every outstanding issue in one pass instead of discovering them one at a time through repeated failed attempts.

**Acceptance Criteria:**
- [ ] When both an unresolved objection and a missing custodian apply simultaneously, the rejection response's `reasons[]` array contains both `UNRESOLVED_OBJECTION` and `NO_CUSTODIAN` entries, not just one
- [ ] Each entry in `reasons[]` carries its own `code` (`UNRESOLVED_OBJECTION` or `NO_CUSTODIAN`) and a human-readable `message`
- [ ] The top-level error message states the count of blocking conditions present (e.g., "Cannot admit: 2 blocking condition(s) present")
- [ ] All other existing status-transition error scenarios (invalid transition, finalized status, stale-state conflict, exhibit not found) are returned unchanged from their F1-defined behavior

**Priority:** P0 | **Feature Ref:** F12

---

### US-12.3: Trust the Admission Gate Applies to Every Caller With No Override
**As a** Administrator Priya Nair, **I want to** confirm the admission gate is enforced inside the shared status-transition service itself rather than in a single screen or route, **so that** no UI action, direct API call, seed-loader path, or future automation can ever bypass it.

**Acceptance Criteria:**
- [ ] The Admission Gate is enforced inside the same shared service function backing F1's `recordEvent({ eventType: 'STATUS_CHANGE' })` path — not duplicated or re-implemented per screen or route
- [ ] There is no "force admit" parameter, admin-role override, or alternate code path that bypasses either check in this version
- [ ] Seed-data loading is subject to the identical gate as any live UI or API caller — no seed-only bypass exists
- [ ] Attempting to admit via direct API call (bypassing the UI entirely) with an unresolved objection or missing custodian is rejected identically to a UI-driven attempt

**Priority:** P0 | **Feature Ref:** F12

---

## Epic 13: Jury Package Ex Parte / Sealed Exclusion (F13)

### US-13.1: Trust a Sealed Exhibit Can Never Appear Eligible in a Jury Package
**As a** Clerk of Court, **I want to** have sealed/ex-parte-flagged exhibits excluded from jury package candidate computation at the query level, **so that** sealed material can never be mistaken for a clean, jury-eligible exhibit — the single most damaging failure mode in this domain.

**Acceptance Criteria:**
- [ ] `computeJuryCandidates(caseId)` queries `ExhibitCurrentState WHERE currentStatus = 'ADMITTED' AND exhibit.isSealed = false` — the sealed filter is applied in the same query as the admitted-status filter, not as a later filtering pass
- [ ] A sealed exhibit is never passed into F6's `evaluateDiscrepancies` for jury-package purposes, so it can never be assigned `CLEAN` or `FLAGGED` — it is simply absent from the candidate set
- [ ] A seeded sealed exhibit marked `ADMITTED` (chambers sidebar note regression case) never appears in `computeJuryCandidates`'s result set, is never rendered as `CLEAN` on the Jury Package Workspace, and is never returned by the assistant's `getJuryPackageStatus` tool as eligible/included
- [ ] Re-running `computeJuryCandidates` for the same case never re-adds a previously `EXCLUDED` sealed exhibit as a new `INCLUDED` row

**Priority:** P0 | **Feature Ref:** F13

---

### US-13.2: Remove a Sealed Exhibit From a Package With an Auditable Record
**As a** Courtroom Deputy Dana Reyes, **I want to** explicitly remove a sealed exhibit from a jury package if one is somehow present, **so that** I have a deliberate, auditable remediation action rather than a silent fix with no trace.

**Acceptance Criteria:**
- [ ] Only `DEPUTY`, `CLERK`, or `ADMIN` roles may trigger the "Remove from Package" action — other roles rejected with 403 `ROLE_NOT_PERMITTED`
- [ ] The action is only available for a `JuryPackageExhibit` row currently `status = 'INCLUDED'` belonging to a `DRAFT` package — attempting it on a `FINALIZED` package is rejected with 409 `JURY_PACKAGE_ALREADY_FINALIZED`
- [ ] Exclusion appends an immutable `JURY_PACKAGE_EXHIBIT_EXCLUDED` ledger event (`reason: 'SEALED_EXPARTE'`) and sets the row's `status` to `EXCLUDED`, `excludedAt`, and `excludedBy` — the row is retained, never deleted
- [ ] An `EXCLUDED` row never appears in the active/included exhibit list, never counts toward finalization eligibility, and is never returned by `getJuryPackageStatus` as included
- [ ] Attempting exclusion on a row that is not currently `INCLUDED` (or does not exist) is rejected with 404 `JURY_PACKAGE_EXHIBIT_NOT_FOUND`

**Priority:** P0 | **Feature Ref:** F13

---

### US-13.3: See a Sealed Row Rendered as a Distinct Warning, Never as Clean
**As a** Clerk of Court, **I want to** see any sealed exhibit's row on the Jury Package Workspace rendered with a distinct, high-visibility warning state, **so that** I never mistake it for a normal discrepancy-free or merely-flagged row.

**Acceptance Criteria:**
- [ ] A `JuryPackageExhibit` row for a sealed exhibit is rendered with explicit labeling (e.g., "Sealed material — must be removed") instead of either `CLEAN` or `FLAGGED`
- [ ] This exclusion takes precedence over and is evaluated independently of F6's `discrepancyStatus` — a sealed exhibit's row never shows `CLEAN` regardless of its underlying discrepancy flag state
- [ ] `JUDGE`, `CHAMBERS_STAFF`, and `ATTORNEY` roles can view the warning state but cannot perform the removal action

**Priority:** P0 | **Feature Ref:** F13

---

## Epic 14: Discrepancy Acknowledgment Transparency (F14)

### US-14.1: See Who Is Permitted to Acknowledge a Discrepancy Before Acting
**As a** any courtroom user viewing an open discrepancy, **I want to** see whether my role is permitted to acknowledge it, with no acknowledge control shown at all if it isn't, **so that** I never waste time on an affordance the system will not honor.

**Acceptance Criteria:**
- [ ] On every screen rendering an `OPEN` `DiscrepancyFlag` (Case Workspace, Jury Package Workspace, Exhibit Detail), the requesting role is checked against F6's role set (`DEPUTY`, `CLERK`, `JUDGE`, `ADMIN`)
- [ ] If the requesting role is not in that set, no "Acknowledge" control is rendered for that flag — absent, not disabled or greyed-out
- [ ] If the requesting role is in that set, the "Acknowledge" control is rendered and accompanied by inline, always-visible copy (not tooltip-only, not hover-only) stating the action will be permanently recorded under the user's name and role
- [ ] The pre-action disclosure copy is visible before the action is confirmed, not only after

**Priority:** P1 | **Feature Ref:** F14

---

### US-14.2: Understand the Justification Field Becomes Part of the Permanent Record
**As a** Clerk of Court, **I want to** see the justification input clearly labeled as part of the permanent record when I acknowledge a discrepancy, **so that** I treat it as an official statement rather than a throwaway comment.

**Acceptance Criteria:**
- [ ] The justification input is labeled to make clear it becomes part of the permanent record (e.g., "Justification (recorded permanently)") rather than appearing as an optional/throwaway comment field
- [ ] No change is made to the field's existing validation rules — still required, non-empty, max 500 characters, rejected with 422 `JUSTIFICATION_REQUIRED` if empty
- [ ] Acknowledging an already-`RESOLVED` or already-`ACKNOWLEDGED` flag remains idempotent, returning existing state with 200

**Priority:** P1 | **Feature Ref:** F14

---

### US-14.3: View the Full Acknowledgment Audit Record on Any Screen
**As a** Judge Elena Marsh, **I want to** see the complete acknowledgment record — actor, role, timestamp, and justification — for any already-acknowledged discrepancy on whichever screen I'm viewing, **so that** the permanent audit trail is genuinely visible, not just technically recorded.

**Acceptance Criteria:**
- [ ] Once a flag's status is `ACKNOWLEDGED`, every screen that renders that flag (Case Workspace, Exhibit Detail, Jury Package Workspace) displays the acknowledging user's name, role, timestamp, and justification text in full — never summarized away, truncated without expansion, or hidden behind a secondary click
- [ ] The justification text is sourced via a read-time join from `DiscrepancyFlag.acknowledgedEventId` to the referenced ledger event's payload and included in `GET /api/cases/:id/discrepancies` and `GET /api/exhibits/:id/discrepancies` responses for `ACKNOWLEDGED` flags
- [ ] The assistant's `getDiscrepancies` answer includes the same justification text for an `ACKNOWLEDGED` flag that the UI shows — no screen or assistant answer may show a partial version omitting actor, timestamp, or justification while another shows the full set
- [ ] No new error codes are introduced — underlying actions continue to use F6's existing `JUSTIFICATION_REQUIRED`, `DISCREPANCY_NOT_FOUND`, and `ROLE_NOT_PERMITTED` codes unchanged

**Priority:** P1 | **Feature Ref:** F14

---

## Epic 15: Courtroom Usability Fixes (F15)

### US-15.1: Click Any Case Workspace Row to Open Its Exhibit Detail
**As a** Attorney Marcus Webb, **I want to** click anywhere on an exhibit row in the Case Workspace to open its full detail view, **so that** I don't have to hunt for a specific nested link or icon during fast-moving testimony.

**Acceptance Criteria:**
- [ ] The entire row rendered by the Case Workspace exhibit table — the full row container, not only a nested link, icon, or label span — is clickable and navigates to `/exhibit/:id`
- [ ] The clickable hit area covers the complete row and includes a visible hover affordance
- [ ] The row supports keyboard/focus activation — Enter or Space navigates when the row has focus
- [ ] A row with zero discrepancy flags and a row with one or more flags are both fully, identically clickable across their entire row area

**Priority:** P0 | **Feature Ref:** F15

---

### US-15.2: See Assistant Example Prompts That Reference Real Exhibit Labels
**As a** Judge Elena Marsh, **I want to** see the Pivota Assistant's example/suggested-question prompts reference exhibit labels that actually exist in this case (e.g., "P-1," "S-2"), **so that** I can try an example and get a real, grounded answer instead of a decline about a nonexistent placeholder exhibit.

**Acceptance Criteria:**
- [ ] Example/suggested-question chips reference the case's actual exhibit-label scheme as produced by seed data (offering-party-prefixed labels, e.g., `P-1`, `D-4`, `S-2`), not a mismatched placeholder numeric scheme (e.g., "Exhibit 14")
- [ ] Example prompts are sourced from (or validated at render time against) the active case's actual seeded `exhibitLabel` values via the existing `getExhibits` service function — not hardcoded independently of seed data
- [ ] An automated test compares rendered chip text against seeded labels and fails if any example prompt references an `exhibitLabel` that does not exist among the current case's seeded exhibits
- [ ] If the assistant is temporarily unavailable, example prompts still render from the last-known exhibit list (503 `ASSISTANT_UNAVAILABLE` unchanged per F7)

**Priority:** P1 | **Feature Ref:** F15

---

### US-15.3: See No Unexplained Elements in the App Header
**As a** Administrator Priya Nair, **I want to** have every element in the shared app header either clearly labeled or removed, **so that** no courtroom user is left guessing what an unexplained number or icon means during a live proceeding.

**Acceptance Criteria:**
- [ ] The numeric element previously rendered near the role selector with no label is evaluated for user-facing purpose
- [ ] If it serves a real function (e.g., a discrepancy or notification count), it is given a visible label or an accessible tooltip/`aria-label` explaining what the number represents
- [ ] If it serves no current user-facing function, it is removed entirely from the header rendering
- [ ] "Present and unexplained" is not an acceptable end state for any header element, verified across Command Center, Case Workspace, Exhibit Detail, and Jury Package Workspace

**Priority:** P2 | **Feature Ref:** F15

---

### US-15.4: See a Full Date and Time on Every Activity Feed Entry
**As a** Chambers Staff member, **I want to** see both the date and the time on every activity feed entry, **so that** I can tell events on different days apart instead of seeing an ambiguous time-only stamp.

**Acceptance Criteria:**
- [ ] Every activity-feed entry — Command Center's `recentActivity` rows and Exhibit Detail's timeline rows — renders both the date and the time of `recordedAt` (e.g., "Oct 8, 2026, 2:14:03 PM")
- [ ] No activity-feed row renders a time-only timestamp under any circumstance
- [ ] Two events recorded on different days, or events spanning a day boundary, are visually distinguishable to a reader scanning the feed

**Priority:** P2 | **Feature Ref:** F15

---

### US-15.5: See the Exhibit Name on Every Activity Feed Row
**As a** Chambers Staff member, **I want to** see which exhibit every activity feed row concerns, including raw state-transition rows, **so that** I never read an unattributed event and have to guess or drill in to find out what it was about.

**Acceptance Criteria:**
- [ ] Every activity-feed row — including rows describing a raw `STATUS_CHANGE` event — displays the exhibit's label as part of the row's rendered summary (e.g., "P-1: MARKED → OFFERED" rather than a summary with no exhibit identified)
- [ ] This uses the `exhibitLabel` field already present in the `GET /api/cases/:id/activity` response — no API contract or schema change is required, only row-rendering/summary-formatting logic
- [ ] No activity-feed row anywhere renders a summary string without that event's associated `exhibitLabel`, for any `eventType` value

**Priority:** P1 | **Feature Ref:** F15

---

## Summary Table

| Epic | Story Count | P0 | P1 | P2 |
|------|-------------|----|----|-----|
| Epic 0: Exhibit Workspace (F0) | 3 | 3 | 0 | 0 |
| Epic 1: Exhibit Status Display (F1) | 2 | 2 | 0 | 0 |
| Epic 2: Objection and Ruling Tracking (F2) | 3 | 2 | 1 | 0 |
| Epic 3: Custody Tracking (F3) | 3 | 2 | 1 | 0 |
| Epic 4: Exhibit Search (F4) | 2 | 0 | 2 | 0 |
| Epic 5: Jury-Ready Exhibit List Generation (F5) | 2 | 2 | 0 | 0 |
| Epic 6: Discrepancy Identification (F6) | 3 | 3 | 0 | 0 |
| Epic 7: Pivota Assistant (F7) | 5 | 4 | 1 | 0 |
| Epic 8: Trial Command Center Screen (F8) | 2 | 0 | 2 | 0 |
| Epic 9: Case Workspace Screen (F9) | 2 | 2 | 0 | 0 |
| Epic 10: Exhibit Detail View Screen (F10) | 2 | 1 | 1 | 0 |
| Epic 11: Jury Package Workspace Screen (F11) | 2 | 2 | 0 | 0 |
| Epic 12: Admission Integrity Gating (F12) | 3 | 3 | 0 | 0 |
| Epic 13: Jury Package Ex Parte / Sealed Exclusion (F13) | 3 | 3 | 0 | 0 |
| Epic 14: Discrepancy Acknowledgment Transparency (F14) | 3 | 0 | 3 | 0 |
| Epic 15: Courtroom Usability Fixes (F15) | 5 | 1 | 2 | 2 |
| **Total** | **45** | **30** | **13** | **2** |

---

## Priority Definitions

| Priority | Definition |
|----------|------------|
| **P0** | Critical - Must have for MVP |
| **P1** | High - Important for first release |
| **P2** | Medium - Nice to have |
| **P3** | Low - Future consideration |

---

*Document generated by Pivota Spec Framework*
*Last updated: 2026-10-08 (added Epics 12–15 for Phase 7: admission integrity + UI usability fixes)*
