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
- [ ] *(Phase 9)* A single `StatusBadge` component (`components/StatusBadge.tsx`) owns the status→Carbon-Tag-type/icon mapping for all six admission-lifecycle statuses; the Command Center legend, Case Workspace status pills and filters, any status-distribution chart segment, and the Exhibit Detail header/timeline all import and render through this one component/map — no screen defines its own color/icon logic or a parallel lookup table
- [ ] *(Phase 9)* The four `AttentionFeedTier` severities (`CRITICAL`/`HIGH`/`PENDING`/`MEDIUM`, F8) use a separate, independently defined color-token mapping and must never share a color/hue family with this six-status mapping — status and attention-tier are deliberately distinct scales that are never visually conflated
- [ ] *(Phase 9)* Service-reported tier/status ordering is authoritative; no screen re-sorts status or attention-tier entries independently of the order the service returns

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
- [ ] *(Phase 9)* The `ASSISTANT_UNAVAILABLE` (503) message is accompanied by an explicit Retry action, not just the preserved input, so the user has a direct way to resubmit without hunting for how to try again

**Priority:** P1 | **Feature Ref:** F7

---

### US-7.6: See Context-Aware Example Prompts When Opening the Assistant From an Exhibit
**As a** Judge Elena Marsh, **I want to** see the assistant's suggested-question chips reference the specific exhibit I came from, **so that** I can try a relevant example and get a real, grounded answer instead of a generic case-wide prompt.

**Acceptance Criteria:**
- [ ] When the assistant panel is opened with a `contextExhibitId` (e.g., via F10's "Ask Pivota about {exhibitLabel}" header action), the chip set of suggested questions references that specific exhibit's label and known state (e.g., "Why is P-7 flagged?" when the exhibit has an open discrepancy, "What happened to P-7?" generically) instead of the standard case-wide example set
- [ ] This chip selection happens entirely client-side against already-loaded exhibit data (the same `getExhibits` result F15's example-prompt fix relies on) — no new endpoint, tool, or query is introduced
- [ ] `contextExhibitId` is never sent to or persisted by `POST /api/assistant/chat` — it governs only which example chips render, not the chat request itself
- [ ] If the supplied `contextExhibitId` corresponds to a sealed/ex-parte exhibit the requesting role is unauthorized to view, the panel falls back to the standard case-wide example set rather than generating a chip that references (and so reveals the existence of) a masked exhibit — no error is surfaced for this fallback

**Priority:** P1 | **Feature Ref:** F7

---

### US-7.7: Use an Assistant Chat Panel That Fills the Viewport Instead of Floating
**As a** Judge Elena Marsh, **I want to** have the assistant's chat surface fill the available viewport height with the input fixed at the bottom, **so that** the conversation area doesn't float awkwardly in an otherwise-empty page.

**Acceptance Criteria:**
- [ ] The chat surface fills the available viewport height, with the message input fixed at the bottom
- [ ] The conversation area does not float in an otherwise-empty page regardless of how few messages exist in the current conversation

**Priority:** P2 | **Feature Ref:** F7

---

### US-7.8: Trust No Client-Facing API-Key Control Exists Outside Non-Production
**As a** Administrator Priya Nair, **I want to** confirm the assistant exposes no client-facing API-key configuration control in a production-like environment, **so that** the product's server-side-only key architecture is never undermined or misrepresented by a stray judge-facing setting.

**Acceptance Criteria:**
- [ ] Any client-facing API-key configuration control is either removed entirely, or — if retained for non-production use — is hidden outside non-production environments
- [ ] No supplied key is ever stored client-side under any circumstance
- [ ] The Anthropic key itself remains server-side only, per the existing security architecture

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

### US-8.3: See Custody at a Glance
**As a** Courtroom Deputy Dana Reyes, **I want to** see a "Custody at a glance" panel on the Trial Command Center grouping every exhibit by its current custodian, **so that** I can see who holds what without visiting each Exhibit Detail page individually.

**Acceptance Criteria:**
- [ ] The panel groups exhibits by `currentCustodianUserId` via `getCustodyByCustodian(caseId)`, showing the custodian's name with the exhibit labels and statuses held beneath each grouping
- [ ] Exhibits with a pending, unconfirmed custody transfer (F19) appear in a visually distinct "pending transfer to {name}" grouping — never silently folded into the current custodian's bucket
- [ ] Sealed/chambers-ex-parte exhibits are excluded from the panel for roles outside the visibility set, identically to every other screen's role-based filtering
- [ ] Each custodian grouping exposes an entry point into F24's "Transfer custody" action for F20-authorized roles only — no control renders for a role that may not propose a transfer
- [ ] The panel polls on the standard 3–5s live-sync interval so a custody confirmation recorded elsewhere regroups the exhibit without a manual refresh

**Priority:** P0 | **Feature Ref:** F8

---

### US-8.4: See a Prioritized "Needs Your Attention" Feed
**As a** Judge Elena Marsh, **I want to** see a single feed on the Command Center ranking every outstanding objection, custody gap, and sealed-in-package item by severity, **so that** I always address the most urgent issue first instead of scanning multiple separate panels.

**Acceptance Criteria:**
- [ ] Entries are grouped into four tiers — `CRITICAL` (sealed/ex-parte exhibit improperly `INCLUDED` in a jury package), `HIGH` (admitted exhibit with an open unresolved-objection discrepancy), `PENDING` (unresolved objection on a not-yet-admitted exhibit), `MEDIUM` (admitted exhibit with no custodian) — and every `CRITICAL` entry renders before any `HIGH` entry, every `HIGH` before any `PENDING`, and so on, with no interleaving across tiers
- [ ] Within a single tier, entries are sorted newest-first by the timestamp of the event that produced the condition (`detectedAt` for discrepancy-sourced tiers, `raisedAt` for the `PENDING` tier)
- [ ] An unresolved objection on an `ADMITTED` exhibit is counted only in the `HIGH` tier, never simultaneously in `PENDING`
- [ ] Each `HIGH`/`PENDING` entry's inline action is "Record ruling" and each `MEDIUM` entry's inline action is "Transfer custody"/"Assign custodian," and the control renders only if the viewing user's role is F20-authorized for that specific action — an unauthorized role (e.g. `ATTORNEY`) sees the entry's context but no actionable control
- [ ] The `CRITICAL` tier's action is a link-through to the Jury Package Workspace's existing "Remove from Package" remediation (F13), not a new inline control
- [ ] A successful inline action clears or re-ranks its originating feed entry on the next poll tick, with no screen-local optimistic state that could diverge from the ledger
- [ ] *(Phase 9)* Each of the four severity tiers renders with a visually distinct Carbon Tag type and icon drawn from a centralized `AttentionFeedTier` color-token mapping (Carbon support-error/support-warning/support-info tokens), independently verified for AA contrast (4.5:1) via automated axe checks
- [ ] *(Phase 9)* The severity-tier color/icon mapping never shares a color or hue family with the six-status `StatusBadge` mapping (F1) — status and attention-tier are deliberately distinct, non-conflated scales

**Priority:** P0 | **Feature Ref:** F8, F24

---

### US-8.5: See the Full Ranked Attention List Without Scrolling the First Viewport
**As a** Judge Elena Marsh, **I want to** see the Command Center's KPI counts and ranked attention list in a compact first viewport, **so that** I can glance at everything most urgent without scrolling during a live proceeding.

**Acceptance Criteria:**
- [ ] The compact KPI stat-tile row renders each tile at no more than 80px in height, replacing the prior full-width stat-card layout
- [ ] Each KPI stat tile is a clickable `ClickableTile` linking through to its corresponding filtered Case Workspace (F9) view
- [ ] The "Needs your attention" feed renders as a dense Carbon DataTable with exhibit, issue, severity, age, and action columns, with exactly one primary action per row, replacing the prior full-width attention cards
- [ ] At a 1440x900 viewport, at least 6 ranked attention items are visible without scrolling
- [ ] The service's tier ordering (F8 §Process) is preserved exactly as returned — the DataTable never re-sorts independently
- [ ] `HIGH` and `PENDING` tier rows additionally display the associated objection's grounds inline (sourced from `getAttentionFeed`'s `objectionGrounds` field) so a reviewer does not need an extra click to see why an item is flagged; `objectionGrounds` is never shown for `CRITICAL`/`MEDIUM` rows, which have no associated `objectionId`

**Priority:** P0 | **Feature Ref:** F8

---

### US-8.6: Trust the Live Data Indicator Reflects Actual Freshness
**As a** Judge Elena Marsh, **I want to** see a clearly labeled indicator showing whether the Command Center's data is current or stale, **so that** I know whether to trust what's on screen or hit refresh.

**Acceptance Criteria:**
- [ ] A labeled `LiveIndicator` component renders in the page header, driven by the existing TanStack Query polling state (`dataUpdatedAt`/`isError`) for Command Center queries
- [ ] The indicator shows "Live" with a green dot when the underlying data is less than 60 seconds old
- [ ] Once data goes stale (60 seconds old or more) or a query errors, the indicator shows "Connection lost" in amber with a Refresh action that triggers a refetch
- [ ] This replaces the prior bare dot and raw "updated Ns ago" text — no unlabeled timestamp or dot renders anywhere in the header

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

### US-9.3: Triage Exhibits With Quick-Filter Chips and Jury Package Eligibility
**As a** Courtroom Deputy Dana Reyes, **I want to** use one-click quick-filter chips (All / Needs attention / In my custody / Awaiting ruling) and see a Jury Package eligibility column per exhibit row, **so that** I can triage the full exhibit set without constructing a manual search query.

**Acceptance Criteria:**
- [ ] Four quick-filter chips are available — All, Needs attention, In my custody, Awaiting ruling — and selecting one narrows the visible row set without requiring the search bar
- [ ] "Needs attention" matches exhibits with at least one `OPEN` discrepancy flag or at least one `UNRESOLVED` objection thread; "In my custody" matches exhibits where `CustodyCurrentState.currentCustodianUserId` equals the signed-in user; "Awaiting ruling" matches exhibits with at least one `UNRESOLVED` objection thread
- [ ] *(Phase 9)* Each row renders a Jury Package eligibility value of exactly one of four states — `Included`, `Blocked`, `Not eligible`, or `Not yet evaluated` — in precedence order: `Included` only when a `JuryPackageExhibit` row exists with `status = 'INCLUDED'` and `discrepancyStatus = 'CLEAN'`; `Blocked` when `INCLUDED` and `FLAGGED`; `Not eligible` only for a structural, permanent exclusion (a `JuryPackageExhibit` row with `status = 'EXCLUDED'`, or `classification != 'TRIAL'`); `Not yet evaluated` for every other case (no `JuryPackageExhibit` row exists at all for this exhibit)
- [ ] *(Phase 9)* For any exhibit whose `currentStatus` is not `ADMITTED`, the row renders no eligibility tag at all — the value is still computed and returned server-side, but the UI suppresses rendering it for not-yet-admitted exhibits since it would be noise, not signal
- [ ] *(Phase 9)* An `ADMITTED` exhibit that has never been run through jury-package candidate computation (no `JuryPackage` ever computed for the case, or computed before this exhibit was admitted) renders a visible `Not yet evaluated` tag — this replaces the prior behavior where every such exhibit incorrectly read `Not eligible` regardless of its actual admission state
- [ ] *(Phase 9)* `Not eligible` is never returned for an exhibit solely because it hasn't yet been run through package computation — that case is always `Not yet evaluated`; `Not eligible` is reserved exclusively for a structural exclusion no future package computation will reverse
- [ ] The eligibility badge is never computed independently of what the Jury Package Workspace (F11) shows for the same exhibit, or of the Exhibit Detail checklist (F10) for the same exhibit — all three surfaces compute the identical four-value precedence from the identical underlying query; applying a quick-filter chip never changes this computation
- [ ] Rows continue to poll on the standard 3–5s interval so a filter's membership and eligibility badges update without manual refresh

**Priority:** P0 | **Feature Ref:** F9

---

### US-9.4: Use Clearly Labeled, Appropriately-Scoped Filters and a Readable Exhibit Table
**As a** Courtroom Deputy Dana Reyes, **I want to** see every Case Workspace filter clearly labeled and the exhibit table laid out so nothing is truncated or visually noisy, **so that** I can trust the controls I'm using and read the full exhibit description without guessing what got cut off.

**Acceptance Criteria:**
- [ ] The Description column takes the remaining table width and wraps rather than truncating with an ellipsis
- [ ] Zebra striping is removed from the table; the existing attention/discrepancy tint is retained as the only row-level visual emphasis
- [ ] The Add-exhibit entry point is shown only to `DEPUTY`/`CLERK`/`ADMIN` per the existing role check, hidden or tooltipped for other roles
- [ ] Every filter (Search, Status, Witness, From, To) carries a visible Carbon label; From/To are distinguishably labeled as date-range bounds
- [ ] `getExhibits` (unfiltered) and `searchExhibits` (≥1 filter set) are each called only when appropriate, avoiding an `EMPTY_SEARCH_CRITERIA` error; a "Showing X of Y" result-count readout with a Clear-filters action replaces the prior ambiguous helper sentence
- [ ] The Witness filter is a searchable select built from the distinct `associatedWitness` values already present in the loaded exhibit list, not a free-text field; AND semantics across combined filters are preserved

**Priority:** P1 | **Feature Ref:** F9

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

### US-10.3: See Actionable Right-Rail Cards and Header Actions
**As a** user viewing Exhibit Detail, **I want to** see an Objection card, a Chain of Custody card, and a Jury Package eligibility checklist in a right rail, plus header-level "Transfer custody" and "Ask Pivota about {exhibitLabel}" actions, **so that** I can both understand and act on this exhibit's current state from one screen.

**Acceptance Criteria:**
- [ ] The Objection card renders every `ObjectionCurrentState` row for the exhibit with `status = 'UNRESOLVED'` (zero, one, or several), each showing objecting party, grounds, and elapsed time since `raisedAt`; if none exist, the card renders an explicit "No open objections" state rather than an empty card
- [ ] Each unresolved-objection row carries its own "Record ruling" inline action passing that row's specific `objectionId`, and the action renders only for a `JUDGE`-role viewer
- [ ] The Chain of Custody card renders the current custodian (or "No custodian of record"), a distinct "Pending transfer to {name} since {time}" banner when a transfer is pending, and the full ordered custody history including `PROPOSED`/`CONFIRMED`/`CANCELLED` events
- [ ] The Jury Package eligibility checklist card shows four per-condition checks (admitted, objections resolved, custodian on record, classification = `TRIAL`) as met/outstanding, plus the same overall `Included`/`Not eligible`/`Blocked` badge the Case Workspace computes for this exhibit
- [ ] The header's "Transfer custody" action renders only for a `DEPUTY`/`CLERK`/`ADMIN` role, or additionally for the named pending-transfer receiver when a transfer is pending (identity-gated "Confirm receipt") — it never renders for a role with no permission for any custody action on this exhibit
- [ ] The header's "Ask Pivota about {exhibitLabel}" action opens the assistant panel pre-scoped to this exhibit's label
- [ ] All three right-rail cards derive their state from the same `getExhibitHistory` payload the timeline renders from — no card issues an independent query that could diverge from the timeline's facts
- [ ] A sealed/ex-parte exhibit viewed by an unauthorized role returns 404 before any right-rail card or header action renders, identical to the screen's existing not-found behavior

**Priority:** P0 | **Feature Ref:** F10, F24

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

### US-11.3: Request Finalization From a Role That Can Finalize
**As a** Judge Elena Marsh, **I want to** request finalization of the current jury package draft from a Clerk/Deputy/Admin when my role cannot finalize directly, **so that** a clean package can move forward without my needing finalize authority I'm not meant to have.

**Acceptance Criteria:**
- [ ] A `JUDGE`/`CHAMBERS_STAFF`/`ATTORNEY` role viewing a `DRAFT` package sees "Request finalization from Clerk" in place of a Finalize control
- [ ] Clicking it calls `POST /api/jury-package/:id/request-finalization` with the requester's `actorUserId`, setting `finalizationRequestedAt`/`finalizationRequestedBy` on the package — overwriting any prior unresolved request, never stacking
- [ ] This action never finalizes the package, never bypasses F5's discrepancy gate, and confers no finalize authority to the requester
- [ ] A finalize-authorized role (`DEPUTY`/`CLERK`/`ADMIN`) viewing the same `DRAFT` package while a request is outstanding sees a visible banner ("Finalization requested by {requesterName} at {time}") directly above the Finalize control
- [ ] A `DEPUTY`/`CLERK`/`ADMIN` attempting to call the request-finalization endpoint themselves is rejected with 403 `ROLE_NOT_PERMITTED` ("This role can finalize directly and does not need to request it")
- [ ] A successful finalization clears the outstanding `finalizationRequestedAt`/`finalizationRequestedBy` — the request is resolved by the finalization it led to
- [ ] Requesting finalization on an already-`FINALIZED` package is rejected with 409 `JURY_PACKAGE_ALREADY_FINALIZED`

**Priority:** P0 | **Feature Ref:** F11

---

### US-11.4: Get Actionable Guidance and a Readiness-Preview Path From an Empty Jury Package Workspace
**As a** Judge Elena Marsh, **I want to** see clear guidance and a path to a readiness preview when no jury package has been started yet, **so that** I'm never stuck on a dead-end screen simply because my role cannot start a package.

**Acceptance Criteria:**
- [ ] The empty state (before any package is started) spans the full content width and names which roles (`DEPUTY`/`CLERK`/`ADMIN`) can start a package
- [ ] A "Start package" action is shown only to those roles; it calls `POST /api/cases/:id/jury-package` only on explicit click, never as a side effect of viewing the page
- [ ] `GET /api/cases/:id/jury-package` no longer auto-creates a `DRAFT` package as a side effect of being viewed; when no `JuryPackage` row exists yet, it returns `{ juryPackage: null, exhibits: [] }`
- [ ] A `JUDGE` or other non-starting role never sees a disabled "Start package" control — they see the empty state's explanation and the readiness-preview link (F25) instead, never a dead-end control
- [ ] The empty state — and the normal Draft/Finalized views — link to the new read-only Jury Package Readiness Preview (F25) for every role, including `JUDGE`, before any package exists

**Priority:** P1 | **Feature Ref:** F11, F25

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
- [ ] *(Phase 9)* The "today"/"yesterday" activity-feed group label is reconciled to a single definition of a day boundary, matching the server's `since` = start-of-current-trial-day semantics — the heading and the underlying data window never disagree

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

### US-15.6: Scroll the Recent Activity Feed Naturally, With Near-Duplicate Events Grouped
**As a** Chambers Staff member, **I want to** scroll the Recent Activity feed as part of the normal page instead of a cramped inner scrollbox, and see repeated status changes on the same exhibit grouped, **so that** I can read the feed without fighting a nested scroll area or wading through near-duplicate rows.

**Acceptance Criteria:**
- [ ] Recent Activity no longer scrolls inside a fixed-height nested box; the page scrolls normally
- [ ] The feed shows the latest 10 entries with a "View all" link to a full activity page, via the existing `getRecentActivity` capability — no backend change
- [ ] Consecutive `STATUS_CHANGE` events on the same exhibit within a 60-second window collapse into one expandable summary row
- [ ] This grouping is a pure presentation grouping computed in a UI helper, with no status logic duplicated from the service layer
- [ ] All activity timestamps render through one shared formatter that includes seconds, eliminating any one-timestamp-format-for-everything inconsistency

**Priority:** P1 | **Feature Ref:** F15

---

### US-15.7: Always Know Which Nav Item Is Active and Trust the Jury Package Badge
**As a** Courtroom Deputy Dana Reyes, **I want to** see unambiguous active-navigation styling and a Jury Package badge count I can trust, **so that** I always know where I am and never act on a number that doesn't match what I'd see on the destination page.

**Acceptance Criteria:**
- [ ] The active navigation item is visually unambiguous, using route-driven styling plus an icon from `@carbon/icons-react`
- [ ] The Jury Package nav badge is shown only when its count demonstrably matches something the destination page displays
- [ ] If the badge's count cannot be demonstrated to match the destination page, it is removed or tooltipped rather than shown unexplained

**Priority:** P2 | **Feature Ref:** F15

---

### US-15.8: Reach the Pivota Assistant From Exactly One Entry Point
**As a** Judge Elena Marsh, **I want to** have exactly one Pivota Assistant entry point in the product, **so that** I'm never confused about which chat surface is the real one or whether two conversations might diverge.

**Acceptance Criteria:**
- [ ] Exactly one Pivota Assistant entry point exists in the navigation/header
- [ ] The exhibit page's "Ask Pivota about {exhibitLabel}" action opens that same assistant, pre-selecting the exhibit via URL state, rather than a second, parallel assistant surface
- [ ] No screen offers a second, divergent chat surface or assistant launcher

**Priority:** P1 | **Feature Ref:** F15

---

## Epic 16: Exhibit Classification Taxonomy (F16)

### US-16.1: Classify an Exhibit at Intake
**As a** Courtroom Deputy Dana Reyes, **I want to** assign a mandatory TRIAL/CHAMBERS_EX_PARTE/SEALED classification when I create an exhibit, **so that** every exhibit's sensitivity is captured accurately from the moment it enters the record, not inferred or corrected later.

**Acceptance Criteria:**
- [ ] `classification` is required on `POST /api/exhibits`; a missing value is rejected with 422 `CLASSIFICATION_REQUIRED`
- [ ] `classification` must be one of `TRIAL`, `CHAMBERS_EX_PARTE`, `SEALED`; any other value is rejected with 422 `INVALID_CLASSIFICATION`
- [ ] `Exhibit.isSealed` is computed server-side as `(classification !== 'TRIAL')` within the same transaction; a client-supplied `isSealed` value in the request body is ignored
- [ ] No endpoint accepts a `classification` update after creation — classification is immutable for the life of the exhibit, enforced by omission (no such route exists)

**Priority:** P0 | **Feature Ref:** F16

---

### US-16.2: Trust Chambers-Ex-Parte and Sealed Exhibits Are Hard-Excluded From Jury Candidacy
**As a** Clerk of Court, **I want to** have chambers-ex-parte and sealed exhibits be structurally impossible to include in a jury package, **so that** I never have to remember to manually filter them out myself.

**Acceptance Criteria:**
- [ ] `computeJuryCandidates` filters `classification = 'TRIAL'` in the same query as the `ADMITTED`-status filter — `CHAMBERS_EX_PARTE` and `SEALED` are excluded identically, not via a later filtering pass
- [ ] A `CHAMBERS_EX_PARTE` exhibit is never passed into `evaluateDiscrepancies` for jury-package purposes and can never be assigned `CLEAN` or `FLAGGED`
- [ ] Seed data includes at least one `CHAMBERS_EX_PARTE` exhibit and one `SEALED` exhibit, each admitted, and both are confirmed independently absent from `computeJuryCandidates`'s result set
- [ ] Role-based visibility continues to read the now-classification-derived `isSealed` value unchanged — no separate visibility-table change was required or made

**Priority:** P0 | **Feature Ref:** F16

---

## Epic 17: Objection-to-Admission State-Machine Hardening (F17)

### US-17.1: Trust the Admission Gate Already Blocks Admission Over an Unruled Objection
**As a** Administrator Priya Nair, **I want to** have a dedicated regression test confirming F12's existing Admission Gate rejects `OBJECTED → ADMITTED` whenever any objection thread has had no ruling recorded, **so that** I can trust this guarantee holds permanently rather than being an untested emergent property of two unrelated features.

**Acceptance Criteria:**
- [ ] Regression test: objection raised, no ruling yet recorded, attempt `toStatus = ADMITTED` is rejected with the existing 422 `ADMISSION_BLOCKED` / `UNRESOLVED_OBJECTION` response, unchanged from F12
- [ ] No new runtime validation mechanism, error code, or API surface is introduced by this feature — F12's existing gate is the sole enforcement point
- [ ] Test confirms that once a `SUSTAINED` or `OVERRULED` ruling is recorded against every open thread, a subsequent `ADMITTED` attempt succeeds via F12's existing, unchanged success path
- [ ] The test suite is positioned to catch any future code change that bypasses `recordEvent` and mutates `ObjectionCurrentState` directly

**Priority:** P0 | **Feature Ref:** F17

---

### US-17.2: Confirm Direct OFFERED → ADMITTED Remains Legal When No Objection Was Ever Raised
**As a** Courtroom Deputy Dana Reyes, **I want to** have an exhibit that was never objected to move directly from `OFFERED` to `ADMITTED`, **so that** I am not forced through a meaningless `OBJECTED` detour for exhibits no attorney ever challenged.

**Acceptance Criteria:**
- [ ] Regression test: exhibit with zero `ObjectionCurrentState` rows attempts `OFFERED → ADMITTED` directly and succeeds, unaffected by F12's gate
- [ ] F12's `UNRESOLVED_OBJECTION` blocking reason does not apply when no objection thread exists for the exhibit at all — the gate's query returns zero rows, not an error
- [ ] This transition's behavior, inputs, and outputs are identical to F12's pre-existing specification — no new validation rule governs it

**Priority:** P1 | **Feature Ref:** F17

---

## Epic 18: Custodian Required at Intake (F18)

### US-18.1: Establish a Custodian Atomically When an Exhibit Is First Marked Into Evidence
**As a** Courtroom Deputy Dana Reyes, **I want to** have the system require and record a custodian in the same transaction as an exhibit's first `MARKED` status transition, **so that** no exhibit can ever exist having entered the evidence lifecycle with no custody chain started.

**Acceptance Criteria:**
- [ ] The first-ever `STATUS_CHANGE` event for an exhibit (`toStatus = MARKED`, zero prior events) requires `custodianUserId` in the same request
- [ ] The `STATUS_CHANGE` event and a `CUSTODY_TRANSFER_CONFIRMED` event (`fromCustodianUserId: null`) are appended within a single database transaction — both succeed or both fail, with no intermediate state
- [ ] `custodianUserId` must reference an existing, active `User` — invalid values rejected with 422 `INVALID_CUSTODIAN` (reused from F03)
- [ ] All transitions after the first (`MARKED → OFFERED`, etc.) do not require or accept `custodianUserId` — this gate applies only to the exhibit's first-ever `STATUS_CHANGE` event

**Priority:** P0 | **Feature Ref:** F18

---

### US-18.2: Be Blocked From Marking an Exhibit Into Evidence Without a Custodian
**As a** Administrator Priya Nair, **I want to** have the first `MARKED` transition rejected outright when no custodian is supplied, **so that** this requirement is enforced structurally rather than relying on a deputy remembering a separate manual step.

**Acceptance Criteria:**
- [ ] A first-ever `toStatus = MARKED` request with no `custodianUserId` is rejected with 422 `CUSTODIAN_REQUIRED_AT_INTAKE` before any write occurs
- [ ] F12's existing admission-time custodian check continues to run independently and unchanged at the later `ADMITTED` transition — this feature does not replace or weaken it
- [ ] The seed loader is subject to the identical gate — a seed assertion fails fast if any seeded exhibit's `MARKED` transition was recorded without a custodian
- [ ] All other existing status-transition error scenarios (invalid transition, finalized status, stale-state conflict) are returned unchanged from their F1/F12-defined behavior

**Priority:** P0 | **Feature Ref:** F18

---

## Epic 19: Custody Handoff Confirmation (F19)

### US-19.1: Propose a Custody Transfer
**As a** Courtroom Deputy Dana Reyes, **I want to** propose handing an exhibit to a named receiving custodian without immediately changing who the system considers the current custodian, **so that** custody only changes once the receiver has actually acknowledged taking it.

**Acceptance Criteria:**
- [ ] Propose requires `fromCustodianUserId` to exactly match `CustodyCurrentState.currentCustodianUserId` — mismatches rejected with 409 `CUSTODY_CHAIN_BROKEN` (F03, unchanged)
- [ ] Propose is rejected with 409 `CUSTODY_TRANSFER_ALREADY_PENDING` if a transfer is already pending for the exhibit
- [ ] `toCustodianUserId` must reference a valid active user and differ from `fromCustodianUserId`, reusing F03's `INVALID_CUSTODIAN` / `NO_OP_TRANSFER` checks
- [ ] A successful propose appends an immutable `CUSTODY_TRANSFER_PROPOSED` event and populates `CustodyCurrentState`'s `pendingTransferToUserId`/`pendingTransferEventId`/`pendingTransferProposedAt` fields — `currentCustodianUserId` is not modified

**Priority:** P0 | **Feature Ref:** F19

---

### US-19.2: Confirm Receipt of a Proposed Custody Transfer
**As a** Clerk of Court, **I want to** have only the specific person named as the intended receiver able to confirm a pending custody transfer, **so that** custody can never be recorded as transferred to someone who never actually acknowledged receiving it.

**Acceptance Criteria:**
- [ ] Confirm is rejected with 403 `CUSTODY_CONFIRM_WRONG_USER` unless `actorUserId` exactly equals the pending transfer's `toCustodianUserId` — an identity match, not merely a role check; no other user, including the original proposer, may confirm
- [ ] Confirm is rejected with 404 `CUSTODY_CONFIRMATION_NOT_PENDING` if no transfer is currently pending for the exhibit, or if the supplied `proposedEventId` does not match the pending proposal
- [ ] A successful confirm appends a `CUSTODY_TRANSFER_CONFIRMED` event, sets `currentCustodianUserId` to the receiver, updates `since`/`lastEventId`, and clears all three pending fields to null
- [ ] `getCustodian(exhibitId)` and `getCustodyHistory(exhibitId)` reflect the confirmed transfer identically across Custody Tracking, Exhibit Detail, and the assistant's `getCustodian` tool

**Priority:** P0 | **Feature Ref:** F19

---

### US-19.3: Cancel a Pending Custody Transfer
**As a** Courtroom Deputy Dana Reyes, **I want to** cancel a custody transfer I proposed if it's no longer going to happen, **so that** the exhibit isn't left in a permanently "pending" state with no way to clear it.

**Acceptance Criteria:**
- [ ] Cancel is only available while a transfer is currently pending for the exhibit — rejected with 404 `CUSTODY_CONFIRMATION_NOT_PENDING` otherwise
- [ ] Cancel may be performed by the original proposer or any user holding an F20-authorized propose role
- [ ] A successful cancel appends an immutable `CUSTODY_TRANSFER_CANCELLED` event and clears the three pending fields to null; `currentCustodianUserId` is unaffected since it was never changed by the proposal
- [ ] The cancelled proposal remains visible in `getCustodyHistory`'s ordered timeline rather than disappearing — a superseded proposal is never erased from the record

**Priority:** P1 | **Feature Ref:** F19

---

### US-19.4: Trust the Exhibit's First-Ever Custody Assignment Bypasses the Two-Phase Flow
**As a** Administrator Priya Nair, **I want to** have the exhibit's very first custody link (established at intake) recorded as a single, immediately-effective event rather than requiring a propose/confirm round-trip, **so that** the two-phase model only applies where there is an actual predecessor custodian to formalize a handoff from.

**Acceptance Criteria:**
- [ ] At the `(none) → MARKED` transition, the service layer appends a `CUSTODY_TRANSFER_CONFIRMED` event directly (`fromCustodianUserId: null`) with no preceding `CUSTODY_TRANSFER_PROPOSED` event, and no pending-transfer fields are ever populated for this specific event
- [ ] The legacy unilateral custody endpoint is retained only for this first-transfer (`fromCustodianUserId: null`) case; calling it with a non-null `fromCustodianUserId` (any transfer after the first) is rejected with 409 `CUSTODY_TRANSFER_REQUIRES_CONFIRMATION`, directing the caller to propose/confirm instead
- [ ] Every custody transfer after the first-ever assignment is subject to the full two-phase propose/confirm/cancel flow with no exception
- [ ] This bootstrap behavior is exercised identically whether triggered by the live UI or the seed loader — no seed-only bypass exists

**Priority:** P0 | **Feature Ref:** F19, F18

---

## Epic 20: Server-Side Role Enforcement Matrix (F20)

### US-20.1: Be Blocked From Creating an Exhibit Outside My Role's Permission
**As a** Administrator Priya Nair, **I want to** have exhibit creation rejected server-side for any role other than DEPUTY, CLERK, or ADMIN, **so that** only operationally authorized roles can introduce new exhibits into the record, regardless of what the client UI renders.

**Acceptance Criteria:**
- [ ] `POST /api/exhibits` resolves the acting user's role from the `User.role` database column via `actorUserId` — never from a client-supplied role claim
- [ ] A request from a `JUDGE`, `CHAMBERS_STAFF`, or `ATTORNEY` role is rejected with 403 `ROLE_NOT_PERMITTED` ("Only a courtroom deputy, clerk, or admin may create an exhibit") before any field-level validation runs
- [ ] A request from `DEPUTY`, `CLERK`, or `ADMIN` proceeds exactly as F0 already specifies — this gate adds only a precondition, no downstream behavior changes
- [ ] The gate is enforced inside the shared service function, not duplicated per route, consistent with F12's established enforcement pattern

**Priority:** P0 | **Feature Ref:** F20

---

### US-20.2: Be Blocked From Recording a Status Transition Outside My Role's Permission
**As a** Administrator Priya Nair, **I want to** have every status-transition endpoint (mark/offer/withdraw and admit/exclude alike) reject any role other than DEPUTY, CLERK, or ADMIN, **so that** only operational roles can move an exhibit through its lifecycle.

**Acceptance Criteria:**
- [ ] A mark/offer/withdraw transition from a `JUDGE`, `CHAMBERS_STAFF`, or `ATTORNEY` role is rejected with 403 `ROLE_NOT_PERMITTED` ("Only a courtroom deputy, clerk, or admin may record this status transition")
- [ ] An admit/exclude transition is rejected identically for the same disallowed roles, reusing the same `ROLE_NOT_PERMITTED` message
- [ ] `assertRole` is evaluated before F1/F12/F18's existing field-level, state-machine, and admission-gate validations — a disallowed-role request never reaches those checks
- [ ] A request from `DEPUTY`, `CLERK`, or `ADMIN` is unaffected and proceeds through F1/F12/F18's existing logic unchanged

**Priority:** P0 | **Feature Ref:** F20

---

### US-20.3: Be Blocked From Raising an Objection Outside My Role's Permission
**As a** Attorney Marcus Webb, **I want to** have objection-raising restricted server-side to ATTORNEY, DEPUTY, CLERK, and ADMIN roles, **so that** I can trust that only parties and court staff with a legitimate reason to object can create an objection thread.

**Acceptance Criteria:**
- [ ] A raise-objection request from a `JUDGE` or `CHAMBERS_STAFF` role is rejected with 403 `ROLE_NOT_PERMITTED` ("Only an attorney, courtroom deputy, clerk, or admin may raise an objection")
- [ ] A request from `ATTORNEY`, `DEPUTY`, `CLERK`, or `ADMIN` proceeds through F02's existing validation (grounds required, exhibit must be `OFFERED`/`OBJECTED`) unchanged
- [ ] The role check runs before F02's field-level validation — a malformed request from a disallowed role returns `ROLE_NOT_PERMITTED`, not a validation error, leaking no information about request validity
- [ ] Ruling disposition (`SUSTAINED`/`OVERRULED`/`RESERVED`) remains strictly JUDGE-only, unchanged from F02 — this feature does not alter that existing gate

**Priority:** P0 | **Feature Ref:** F20

---

### US-20.4: Be Blocked From Proposing a Custody Transfer Outside My Role's Permission
**As a** Administrator Priya Nair, **I want to** have custody-transfer proposals restricted server-side to DEPUTY, CLERK, and ADMIN roles, **so that** only operational roles can initiate a handoff.

**Acceptance Criteria:**
- [ ] A propose request from a `JUDGE`, `CHAMBERS_STAFF`, or `ATTORNEY` role is rejected with 403 `ROLE_NOT_PERMITTED` ("Only a courtroom deputy, clerk, or admin may propose a custody transfer")
- [ ] A request from `DEPUTY`, `CLERK`, or `ADMIN` proceeds through F19's existing propose validation (current-custodian match, no-pending-transfer check) unchanged
- [ ] The cancel action (proposer, or any user holding an F20-authorized propose role) is unaffected by this story and continues per F19 §Validation

**Priority:** P0 | **Feature Ref:** F20

---

### US-20.5: Be Blocked From Confirming a Custody Transfer Outside My Role's Permission
**As a** Administrator Priya Nair, **I want to** have custody-transfer confirmation restricted server-side to DEPUTY, CLERK, and ADMIN roles in addition to F19's exact-identity check, **so that** both "is this role generally allowed" and "is this specifically the named receiver" are independently enforced.

**Acceptance Criteria:**
- [ ] A confirm request from a `JUDGE`, `CHAMBERS_STAFF`, or `ATTORNEY` role is rejected with 403 `ROLE_NOT_PERMITTED` ("Only a courtroom deputy, clerk, or admin may confirm custody receipt"), evaluated before F19's identity check
- [ ] A `DEPUTY` who is role-permitted but is not the pending transfer's named receiver is still rejected, but with F19's 403 `CUSTODY_CONFIRM_WRONG_USER` rather than `ROLE_NOT_PERMITTED` — the two checks are independent and both must pass
- [ ] An `ADMIN` confirming on behalf of someone else is likewise rejected with `CUSTODY_CONFIRM_WRONG_USER` if they are not the named receiver — no role, including `ADMIN`, overrides the identity match
- [ ] Only a `DEPUTY`, `CLERK`, or `ADMIN` who is also the exact named receiver can successfully confirm

**Priority:** P0 | **Feature Ref:** F20, F19

---

### US-20.6: Trust Every Role Check Resolves From the Database, Never From a Client Claim
**As a** Administrator Priya Nair, **I want to** have every one of the matrix's role checks resolve the acting user's role via a server-side `User.role` lookup rather than trusting any client-supplied role value, **so that** no request can claim a higher-privileged role than the seeded user actually holds.

**Acceptance Criteria:**
- [ ] `assertRole(actorUserId, allowedRoles, actionLabel)` always performs a database lookup of `actorUserId`'s `User.role` column — a role value present in a request body or header is never read or trusted
- [ ] Every one of the 10 matrix actions (create exhibit, mark/offer/withdraw, admit/exclude, raise objection, record ruling, propose custody, confirm custody, acknowledge discrepancy, initiate/finalize jury package, exclude jury package exhibit) calls this single shared helper rather than a re-implemented per-feature check
- [ ] `ADMIN` is permitted for every action in the matrix except ruling disposition, which remains strictly JUDGE-only with no override, including for `ADMIN`
- [ ] The assistant's tool wrappers remain read-only and unaffected by this matrix in this version, since none of the 8 tools perform a write

**Priority:** P1 | **Feature Ref:** F20

---

### US-20.7: Use the Role Switcher Safely as a Clearly Labeled Demo-Only Control
**As a** Administrator Priya Nair, **I want to** have the demo-only role switcher visibly labeled and immediately reflected everywhere the UI shows permitted actions, **so that** no reviewer mistakes it for production authentication and no one acts under a role the UI silently failed to update for.

**Acceptance Criteria:**
- [ ] The role switcher is visibly labeled as a demo/test control and rendered only behind a non-production environment flag — it is not, and must not appear to be, a production authentication mechanism
- [ ] After switching roles, a persistent banner names the active role and offers a switch-back action, so the acting role is never ambiguous during a session
- [ ] The acting role is included in every TanStack Query cache key, so switching roles invalidates and refetches affected data automatically
- [ ] Permission-matrix-gated controls (Add exhibit, Record ruling, Transfer custody) update their visible availability immediately on switch, without a page reload
- [ ] This is a client-side usability/legibility layer only — `assertRole` and the server-side permission matrix remain the sole authority on whether an action actually succeeds

**Priority:** P1 | **Feature Ref:** F20

---

## Epic 21: Pending-Ruling Queue (F21)

### US-21.1: View All Unresolved Objections Sorted by Longest Wait
**As a** Judge Elena Marsh, **I want to** see a dedicated queue listing every currently-unresolved objection case-wide, sorted with the longest-waiting objection first, **so that** I can address the oldest outstanding objections before newer ones, without hunting exhibit-by-exhibit.

**Acceptance Criteria:**
- [ ] The queue screen is reachable only via a `JUDGE`-role navigation entry point, per F20's permission matrix
- [ ] Rows are sorted by elapsed wait time (`now() − raisedAt`) descending — the objection that has been unresolved longest appears first
- [ ] Each row displays exhibit label, objecting party, grounds, and a live-updating elapsed-time value, recomputed on every live-sync poll tick
- [ ] The queue reuses F02's existing `getUnresolvedObjections(caseId)` response, additively widened with `exhibitLabel` via a read-time join — no new endpoint or schema change

**Priority:** P1 | **Feature Ref:** F21

---

### US-21.2: Act on a Queue Entry Without Losing Context
**As a** Judge Elena Marsh, **I want to** click directly from a pending-ruling queue entry into recording my ruling or into that exhibit's full history, **so that** I can resolve an objection in the same flow I spotted it in.

**Acceptance Criteria:**
- [ ] Each row links into the existing ruling-recording action (`POST /api/objections/:id/ruling`, F02) for that specific objection thread
- [ ] Each row also links into the Exhibit Detail View (F10) for the concerned exhibit, for full context before ruling
- [ ] Once a ruling is recorded against a thread (from this screen or any other), the thread disappears from the queue on its next poll tick with no special-case removal logic
- [ ] A row whose underlying exhibit is not visible to the requesting role (e.g., a sealed/chambers-ex-parte exhibit's objection) is omitted entirely from the queue, never rendered with a blank or placeholder label

**Priority:** P1 | **Feature Ref:** F21

---

## Epic 22: Multi-Case Support (F22)

### US-22.1: List All Cases Available to Me
**As a** Clerk of Court, **I want to** see a list of every case in the system, **so that** I can find and open the specific case I need to work in rather than being locked into a single hardcoded trial.

**Acceptance Criteria:**
- [ ] `GET /api/cases` returns every `Case` row (`{ id, caseNumber, title, court, createdAt }`) with no role restriction — case existence itself is not sensitive
- [ ] On first load with no previously-selected case, the client defaults to the first case by `createdAt` ascending (the original seeded demo case), preserving today's zero-interaction behavior
- [ ] Seed data includes a second, independent `Case` with its own exhibits and history, so switching between two populated cases is demonstrable
- [ ] The case list is independent of exhibit-level sealed/classification visibility (F16), which remains governed entirely by role, not by case selection

**Priority:** P1 | **Feature Ref:** F22

---

### US-22.2: Switch My Active Case via a Selector
**As a** Courtroom Deputy Dana Reyes, **I want to** use a case selector in the app header, alongside the role switcher, to change which case I'm actively working in, **so that** I can move between cases without reloading the application or losing my place.

**Acceptance Criteria:**
- [ ] Selecting a different case in the Case Selector updates client-side active-case state (modeled on the existing role-switcher store) and is immediately reflected in the header
- [ ] Every open screen (Command Center, Case Workspace, Exhibit Detail, Jury Package Workspace) and the assistant refetch against the newly-selected `caseId` using the same refetch mechanism already used on a role switch
- [ ] `GET /api/cases/:id` (replacing the prior no-argument `GET /api/case`) returns the identical case+roster shape as before, now explicitly parameterized
- [ ] A request for a nonexistent `caseId` is rejected with the existing 404 `CASE_NOT_FOUND`

**Priority:** P1 | **Feature Ref:** F22

---

### US-22.3: Trust No Screen or Query Ever Leaks Data Across Cases
**As a** Administrator Priya Nair, **I want to** have every read and write scoped to exactly the currently-selected case, with zero exceptions, **so that** switching cases can never cause one case's data to bleed into another's view, even transiently.

**Acceptance Criteria:**
- [ ] Every amended service function (exhibit list/search, activity feed, discrepancies, jury package, assistant tool calls) filters explicitly on the caller-supplied `caseId` — a query scoped to `caseId = A` never returns rows belonging to `caseId = B`
- [ ] No screen continues displaying data scoped to a previously-selected case after a switch — every open screen's next refetch reflects the newly-selected case with no stale carryover frame
- [ ] The assistant's tool wrappers receive `caseId` as part of the same per-turn context as `userId`/`role` — an assistant conversation started under one case never answers using another case's records
- [ ] Role-based visibility rules (sealed/classification exclusion) continue to apply exactly as before, now additionally scoped by the selected case — a user's role permissions do not change per case, only the exhibit set they're evaluated against

**Priority:** P0 | **Feature Ref:** F22

---

## Epic 23: Versioned Jury Packages + PDF Export (F23)

### US-23.1: Have Every Finalization Create a Permanent, Numbered Version
**As a** Clerk of Court, **I want to** have each jury package finalization produce an immutable, sequentially-numbered version, **so that** I have a permanent record of exactly what the jury received at that specific point in the trial, even if a new package is prepared later.

**Acceptance Criteria:**
- [ ] Finalization computes `version` as the case's highest prior `FINALIZED` version + 1 (or 1 if none exists), assigned atomically in the same transaction as `status = 'FINALIZED'`/`finalizedAt`/`finalizedBy`
- [ ] `(caseId, version)` is unique at the database level — two packages for the same case can never share a version number
- [ ] A new `DRAFT` package may be created after a prior version was finalized, per F05's existing rule — the new draft has `version = null` until it, too, is finalized
- [ ] Once a version is assigned, it is never reassigned or recomputed — it is part of the immutable finalized snapshot, exactly like `finalizedAt`/`finalizedBy`

**Priority:** P0 | **Feature Ref:** F23

---

### US-23.2: Export a Finalized Jury Package as a Real PDF
**As a** Courtroom Deputy Dana Reyes, **I want to** export a finalized jury package as an actual downloadable PDF file, **so that** I can hand off a document that behaves reliably across printers and devices instead of relying on a browser's print dialog.

**Acceptance Criteria:**
- [ ] `GET /api/jury-package/:id/export` generates a PDF server-side (via `@react-pdf/renderer`) and streams it back as `application/pdf` — a real downloadable file, not a `window.print()` dialog
- [ ] Export is rejected with 422 `JURY_PACKAGE_EXPORT_NOT_FINALIZED` when attempted against a `DRAFT` package — only a `FINALIZED` package can be exported
- [ ] The exported PDF includes case identification, finalization timestamp, finalizing user, and one entry per `INCLUDED` exhibit (label, description, classification, status at finalization) — F13-excluded rows are never rendered into the export
- [ ] Export of a nonexistent package id is rejected with 404 `JURY_PACKAGE_VERSION_NOT_FOUND`; a render-time failure is rejected with 500 `PDF_GENERATION_FAILED`

**Priority:** P0 | **Feature Ref:** F23

---

### US-23.3: Locate and Export Any Prior Finalized Version
**As a** Clerk of Court, **I want to** see the full version history for a case's jury packages and export any prior finalized version independently, **so that** I can retrieve exactly what a specific version of the jury package contained, not only the most recent one.

**Acceptance Criteria:**
- [ ] `GET /api/cases/:id/jury-package/versions` lists every `JuryPackage` for the case (every `FINALIZED` version plus the current `DRAFT` if one exists), each annotated with `isMostRecent` (`true` only for the highest-`version` `FINALIZED` row)
- [ ] The Jury Package Workspace surfaces the most-recent version prominently and the full version history as a secondary view, so a user can locate and act on any prior version
- [ ] Re-exporting the same version at a later date always produces an identical PDF — the export is deterministic per version, reflecting the exhibit set and classification/status snapshot at that finalization time, never the exhibits' current live state
- [ ] Each historical `FINALIZED` version remains independently exportable via `GET /api/jury-package/:id/export` using that version's own id — exporting an older version never requires or depends on the most-recent version still existing in `DRAFT` form

**Priority:** P1 | **Feature Ref:** F23

---

## Epic 24: Write-Action UI Coverage (F24)

### US-24.1: Record a Ruling From the UI With No Non-Judge Bypass
**As a** Judge Elena Marsh, **I want to** record a ruling (SUSTAINED/OVERRULED/RESERVED) on an unresolved objection directly from the Command Center attention feed or the Exhibit Detail Objection card, **so that** I can resolve objections without an API client or backend-only workflow.

**Acceptance Criteria:**
- [ ] "Record ruling" is reachable from a `HIGH`/`PENDING` attention-feed entry (F08) and from the Objection card on Exhibit Detail (F10), both passing the specific `objectionId` of one `UNRESOLVED` thread as context — never a bare `exhibitId` with ambiguous thread selection
- [ ] The disposition selector offers exactly `SUSTAINED`, `OVERRULED`, `RESERVED` — no new disposition value is introduced
- [ ] Submission requires an explicit confirm step distinct from opening the form; no selection alone auto-submits
- [ ] On submit, the client calls the existing `POST /api/objections/:id/ruling` endpoint unchanged, applying F02's existing unresolved-thread validation and F20's judge-only role gate
- [ ] A non-judge role (`CHAMBERS_STAFF`, `DEPUTY`, `CLERK`, `ATTORNEY`, `ADMIN`) sees no "Record ruling" control anywhere in the UI — absent, not disabled — and a direct API call attempting the action as a non-judge is independently rejected with 403 `ROLE_NOT_PERMITTED`, confirming there is no UI path that could bypass the server-side gate
- [ ] On success, a `SUSTAINED`/`OVERRULED` disposition clears the entry from the attention feed on the next poll tick; a `RESERVED` disposition leaves the thread unresolved and the entry remains, re-ranked by its unchanged `raisedAt`
- [ ] On failure (e.g., stale-state 409 `OBJECTION_ALREADY_RESOLVED`), the form surfaces the specific rejection reason inline and remains open for correction, never a silent failure

**Priority:** P0 | **Feature Ref:** F24

---

### US-24.2: Assign or Transfer Custody From the UI With Inline Rejection Surfacing
**As a** Courtroom Deputy Dana Reyes, **I want to** assign a first-time custodian or transfer custody of an exhibit directly from the Exhibit Detail header (or the Command Center custody panel), **so that** I no longer need an API client to exercise this operational action, and I see exactly why a bad attempt failed.

**Acceptance Criteria:**
- [ ] If the exhibit has no custodian of record, the UI calls the legacy single-step endpoint (`fromCustodianUserId: null`) and the assignment takes effect immediately with no propose/confirm step
- [ ] If a custodian already exists and no transfer is pending, the UI calls the propose endpoint with `fromCustodianUserId` read-only and pre-filled to the current custodian, and a `toCustodianUserId` picker that excludes the current custodian
- [ ] If a transfer is already pending, the UI renders the pending state (receiver, proposed-at) with "Cancel pending transfer" (available to the proposer or any F20-authorized propose role) and, visible only to the exact named receiver, "Confirm receipt" — no new proposal is offered while one is outstanding
- [ ] Every one of the three calls requires an explicit confirm step before submission; none auto-submits on selection
- [ ] A custody-chain mismatch (stale UI state: `fromCustodianUserId` no longer matches the exhibit's actual current custodian) is rejected with 409 `CUSTODY_CHAIN_BROKEN` and surfaced as a specific inline error on the form — never a silent failure, generic toast, or unexplained no-op
- [ ] A role outside `DEPUTY`/`CLERK`/`ADMIN` sees no assign/propose/cancel control at all; only the exact `pendingTransferToUserId` match sees "Confirm receipt," independent of role
- [ ] On success, the Exhibit Detail custody display and any Command Center custody-by-custodian grouping refresh on the next poll tick to reflect the new state

**Priority:** P0 | **Feature Ref:** F24

---

### US-24.3: Preserve Every Pre-Phase-8 Test Contract Through the Dark-Theme Reskin
**As a** Administrator Priya Nair, **I want to** have every `data-testid` and `aria-label` contract the Phases 1–7 Playwright suite already asserts against (e.g. `jury-exhibit-row`, `exhibit-row`, `acknowledge-inline`) still resolve correctly after the dark-dashboard visual reskin, **so that** the redesign is provably a styling change and not a silent functional or automation regression.

**Acceptance Criteria:**
- [ ] Every `data-testid` and `aria-label` selector referenced by the pre-Phase-8 Playwright suite resolves to the same element role and content after the reskin — no selector is renamed, removed, or re-scoped as a side effect of the visual migration
- [ ] This is treated as a non-negotiable, explicit acceptance criterion of the redesign itself, not an implementation detail left to incidental test-passing — a failing selector blocks the phase regardless of how the new screen otherwise looks
- [ ] The full pre-existing Playwright regression suite (spanning Command Center, Case Workspace, Exhibit Detail, Jury Package Workspace) passes unmodified against the reskinned UI, with zero test-file edits required solely to chase a renamed selector
- [ ] New Phase 8 surfaces (attention feed, custody-at-a-glance, quick-filter chips, right-rail cards, Blockers/Clean cards) introduce their own new `data-testid`/`aria-label` contracts additively, without repurposing or colliding with any existing identifier
- [ ] Carbon's accessibility-conformant component behavior (keyboard navigation, focus order, ARIA roles) is retained underneath the new dark-dashboard token layer — the reskin changes visual tokens, not the underlying component semantics

**Priority:** P0 | **Feature Ref:** F8, F9, F10, F11

---

### US-24.4: See Exactly One Properly-Sized Record-Ruling and Acknowledge Entry Point
**As a** user viewing Exhibit Detail's discrepancy banner, **I want to** see properly sized, unambiguous action buttons instead of small text links, **so that** I can confidently invoke the single correct control for recording a ruling or acknowledging the discrepancy, with no second, divergent control hiding elsewhere on the page.

**Acceptance Criteria:**
- [ ] Exactly one "Record ruling" entry point exists per discrepancy/objection: the Exhibit Detail discrepancy banner's primary button, invoking the same judge-only, objection-scoped `RecordRulingAction`, carrying the specific `objectionId` as context
- [ ] Any previously duplicated "Record ruling" control elsewhere on the Exhibit Detail page (e.g., a second button independently rendered by the right-rail Objection card) is removed or re-pointed to invoke the identical `RecordRulingAction` component/handler — there is no second, parallel implementation of the ruling form, dialog, or submit call
- [ ] The right-rail Objection card shows objection details only (objecting party, grounds, elapsed time) — it is not a second action surface
- [ ] The discrepancy banner's "Record ruling" and "Acknowledge" actions are rendered as full Carbon Buttons (not small text links) sharing the same primary-button styling used elsewhere in the product
- [ ] "Acknowledge" opens a dialog requiring a non-empty justification before submission, using the existing `POST /api/discrepancies/:id/acknowledge` endpoint unchanged (422 `JUSTIFICATION_REQUIRED` if empty) — no new field, no new validation rule, no new endpoint
- [ ] The result of a successful acknowledgment (actor, role, timestamp, justification) appears in the exhibit's history exactly as F14 already specifies — no new acknowledgment semantics are introduced by this consolidation

**Priority:** P0 | **Feature Ref:** F24, F10

---

## Epic 25: Jury Package Readiness Preview (Read-Only) (F25)

### US-25.1: View Which Admitted Exhibits Are Ready for the Jury Package, Without Starting One
**As a** Judge Elena Marsh, **I want to** see which admitted exhibits are ready for the jury package and which are blocked — and why — even though my role cannot start or finalize a package, **so that** I'm never excluded from readiness visibility just because I lack starting authority.

**Acceptance Criteria:**
- [ ] The preview lists every exhibit with `currentStatus = 'ADMITTED'` visible to the requesting role under standard role-based visibility
- [ ] For each exhibit, the preview reports `ready: boolean` and a `blockers[]` array with codes `UNRESOLVED_OBJECTION`, `NO_CUSTODIAN`, and/or `SEALED_EXPARTE`, each with a detail message; an exhibit may carry more than one blocker simultaneously, and all applicable blockers are returned, not just the first found
- [ ] A summary (`totalAdmitted`, `readyCount`, `blockedCount`) is returned alongside the list
- [ ] No role-gating error applies to this read-only route — every role (`JUDGE`, `CHAMBERS_STAFF`, `ATTORNEY`, `DEPUTY`, `CLERK`, `ADMIN`) receives an identical `200` response shape for the same case, modulo standard role-based visibility masking
- [ ] A sealed/ex-parte exhibit the requesting role is not authorized to see at all is omitted from the list entirely (not shown as a `SEALED_EXPARTE`-blocked row) — existence is never revealed to an unauthorized role; a role that is authorized to see classified material (e.g., `ADMIN`) sees it listed with the `SEALED_EXPARTE` blocker
- [ ] The screen polls this endpoint on the standard live-sync interval while visible, so a ruling, custody transfer, or reclassification recorded elsewhere updates the ready/blocked breakdown without manual refresh

**Priority:** P2 | **Feature Ref:** F25

---

### US-25.2: Trust the Readiness Preview Never Creates or Mutates a Jury Package
**As a** Administrator Priya Nair, **I want to** confirm that viewing the jury package readiness preview can never create or modify a `JuryPackage` record, **so that** readiness visibility can be opened freely by any role without risk of an accidental side effect.

**Acceptance Criteria:**
- [ ] Viewing the preview performs no write under any circumstance — no `JuryPackage` or `JuryPackageExhibit` row is created, updated, or referenced for computation purposes; calling the endpoint any number of times produces zero new rows in either table
- [ ] The preview is computed directly from `Exhibit`/`ExhibitCurrentState`/`ObjectionCurrentState`/`CustodyCurrentState` — never from any existing package's membership — so it remains accurate even when no package has ever been started
- [ ] Eligibility/blocker logic calls the identical service-layer predicates F5 (`computeJuryCandidates`), F6 (discrepancy rules), and F13 (classification exclusion) already use — no reimplementation of any eligibility rule in the route handler, service function, or client component
- [ ] The preview is exposed via a new, dedicated API route (`GET /api/cases/:id/jury-package/preview`), separate from the existing draft-start and finalize endpoints

**Priority:** P2 | **Feature Ref:** F25

---

## Epic 26: Design System Consistency (Cross-Cutting NFR)

### US-26.1: Trust Typography, Font Loading, and Contrast Are Consistent Across Every Screen
**As a** Administrator Priya Nair, **I want to** confirm all text renders through one disciplined set of design tokens with fonts loading reliably and accessible contrast holding everywhere, **so that** I can trust the product's visual presentation is professional and consistent enough to put in front of a court customer.

**Acceptance Criteria:**
- [ ] All text renders through Carbon type-style tokens — heading-04 for the page title, code-01 for monospace exhibit labels, body-compact-01 for table/feed timestamps, and 12px reserved for tags/labels/helper text only (label-01/helper-text-01) — with no raw font-size/weight/line-height values in component styles, enforced by a lint check
- [ ] IBM Plex Sans and Plex Mono are verified loaded (via `document.fonts`) on every main screen, loaded exactly once, with no silent fallback to a system font
- [ ] Tables, counts, and timestamps use tabular figures (`font-variant-numeric: tabular-nums`)
- [ ] Section-title capitalization follows one rule (sentence case) everywhere
- [ ] Font loading (`document.fonts`) and Carbon type-token conformance are verified via automated checks (axe + token lint), including WCAG AA color-contrast rules, on all 4 main pages (Command Center, Case Workspace, Exhibit Detail, Jury Package Workspace) with zero violations before the ticket is considered complete

**Priority:** P1 | **Feature Ref:** Cross-Cutting NFR

---

### US-26.2: See Consistent Surface Layering and Spacing Across Every Screen
**As a** Administrator Priya Nair, **I want to** confirm every screen follows one layering and spacing convention instead of ad hoc card nesting and padding, **so that** the product reads as one coherent system rather than a collection of inconsistently styled screens.

**Acceptance Criteria:**
- [ ] Layering follows Carbon's Layer model (page/layer-01/layer-02) with no unnecessary nested white-card-in-panel wrapping
- [ ] Spacing uses Carbon's spacing-token scale ($spacing-01..13) exclusively — no ad hoc pixel spacing values
- [ ] Every primary action uses one Button size/kind convention app-wide rather than ad hoc widths and padding

**Priority:** P2 | **Feature Ref:** Cross-Cutting NFR

---

### US-26.3: Trust No Parallel Styling System or Client-Side-Computed Derived Value Was Introduced
**As a** Administrator Priya Nair, **I want to** confirm the Phase 9 visual cleanup reused existing Carbon components/tokens and kept every derived value server-side, **so that** the redesign doesn't quietly introduce a second styling system or a client-computed value that could drift from what the service layer actually returns.

**Acceptance Criteria:**
- [ ] All Phase 9 UI work reuses existing Carbon components and tokens — no second component library and no CSS-in-JS is introduced
- [ ] No new npm dependency is introduced without explicit approval (Next.js's built-in `next/font` is not considered a new dependency for this purpose)
- [ ] Any UI ticket that needs a new field (e.g., jury-package eligibility's "not yet evaluated" state, or the readiness preview) computes it in `services/*.ts` and returns it from the relevant API response — never computed client-side in a component — with `03-api.md` and the FRD updated whenever a ticket adds or changes a field

**Priority:** P2 | **Feature Ref:** Cross-Cutting NFR

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
| Epic 7: Pivota Assistant (F7) | 8 | 4 | 3 | 1 |
| Epic 8: Trial Command Center Screen (F8) | 6 | 3 | 3 | 0 |
| Epic 9: Case Workspace Screen (F9) | 4 | 3 | 1 | 0 |
| Epic 10: Exhibit Detail View Screen (F10) | 3 | 2 | 1 | 0 |
| Epic 11: Jury Package Workspace Screen (F11) | 4 | 3 | 1 | 0 |
| Epic 12: Admission Integrity Gating (F12) | 3 | 3 | 0 | 0 |
| Epic 13: Jury Package Ex Parte / Sealed Exclusion (F13) | 3 | 3 | 0 | 0 |
| Epic 14: Discrepancy Acknowledgment Transparency (F14) | 3 | 0 | 3 | 0 |
| Epic 15: Courtroom Usability Fixes (F15) | 8 | 1 | 4 | 3 |
| Epic 16: Exhibit Classification Taxonomy (F16) | 2 | 2 | 0 | 0 |
| Epic 17: Objection-to-Admission State-Machine Hardening (F17) | 2 | 1 | 1 | 0 |
| Epic 18: Custodian Required at Intake (F18) | 2 | 2 | 0 | 0 |
| Epic 19: Custody Handoff Confirmation (F19) | 4 | 3 | 1 | 0 |
| Epic 20: Server-Side Role Enforcement Matrix (F20) | 7 | 5 | 2 | 0 |
| Epic 21: Pending-Ruling Queue (F21) | 2 | 0 | 2 | 0 |
| Epic 22: Multi-Case Support (F22) | 3 | 1 | 2 | 0 |
| Epic 23: Versioned Jury Packages + PDF Export (F23) | 3 | 2 | 1 | 0 |
| Epic 24: Write-Action UI Coverage (F24) | 4 | 4 | 0 | 0 |
| Epic 25: Jury Package Readiness Preview (F25) | 2 | 0 | 0 | 2 |
| Epic 26: Design System Consistency (Cross-Cutting NFR) | 3 | 0 | 1 | 2 |
| **Total** | **94** | **56** | **30** | **8** |

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
*Last updated: 2026-10-09 (added Epics 16–23 for Phase 7.1: exhibit classification, state-machine hardening, custody handoff confirmation, server-side RBAC, pending-ruling queue, multi-case support, jury-package versioning/PDF export; added Phase 8 — new Epic 24 (Write-Action UI Coverage: record ruling, assign/transfer custody, dark-theme regression guard) and amended Epics 8–11 (custody-at-a-glance, "Needs your attention" feed, quick-filter chips + jury-package eligibility column, Exhibit Detail right rail + header actions, jury-package finalization request flow))*
