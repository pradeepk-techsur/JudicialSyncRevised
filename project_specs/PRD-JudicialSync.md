# Product Requirements Document: JudicialSync

**Project Acronym:** JudicialSync
**Document Type:** PRD (Product Requirements Document)
**Status:** Draft
**Last Updated:** 2026-10-09

---

## 1. Executive Summary

JudicialSync is a demonstration of Pivota acting as the operational memory of the courtroom — a single system that gives judges, chambers staff, courtroom deputies, clerks, and attorneys immediate, trustworthy awareness of exhibit status, rulings, custody, and next actions during a live trial. It replaces the spreadsheets, paper logs, emails, and personal notes courtroom staff currently rely on to answer exhibit questions, and it does so through a conversational assistant that can answer any authorized user's natural-language question with an accurate, cited answer in real time.

This is a sales/demo project, not a production case management system. Its purpose is to prove to court customers — judges, chambers staff, deputies, clerks, and court administrators — that Pivota behaves as an **assistant to the people in the courtroom**, not "yet another system to learn."

---

## 2. Problem Statement

Courtroom staff currently track exhibit status, objections, rulings, and custody across a patchwork of spreadsheets, paper exhibit logs, email threads, and individual handwritten notes. This fragmented record-keeping creates real operational risk during live proceedings, when a judge or attorney needs an instant, authoritative answer and there is no time to reconcile five different sources of truth.

Specific pain points this demo targets:

- **No single source of truth.** A courtroom deputy may know an exhibit's status from memory or a sticky note, but there is no shared, queryable record that chambers staff, the clerk, and attorneys can all trust simultaneously.
- **Slow, manual lookups under time pressure.** When a judge asks "what exhibits were admitted yesterday?" or "is Exhibit 14 in the jury package?", the answer today requires someone to manually flip through logs or cross-reference notes — unacceptable during live proceedings.
- **Silent discrepancies.** An exhibit can be marked "admitted" while its custody record is incomplete, or can end up in a jury package despite an unresolved objection — and nobody notices until it becomes a problem, sometimes after the fact.
- **No chain-of-custody confidence.** Physical and digital exhibits change hands throughout a trial; without a structured, timestamped chain-of-custody record, courts cannot confidently answer "who has this right now" or "where has this been."
- **Fragmented history.** Reconstructing "what happened to Exhibit 14" — every status change, objection, and ruling — currently means assembling fragments from multiple people and documents.

---

## 3. Product Vision

**Vision Statement:** JudicialSync shows that Pivota can be the operational memory of a courtroom — instantly answering any authorized question about exhibit status, custody, or rulings with a trustworthy, cited answer, so that no judge, deputy, or attorney is ever left waiting on a manual search during live proceedings.

**Strategic Goals:**

- Prove the core value proposition end-to-end: a natural-language question about an exhibit gets an immediate, accurate, well-supported answer. If this fails, nothing else about the demo matters.
- Position Pivota as an **assistant augmenting existing courtroom workflows**, never as a replacement case management system — every screen and interaction should reinforce this framing.
- Demonstrate operational awareness that no adjacent product category offers today: neither digital evidence management (DEMS) tools nor trial-presentation software (e.g., TrialPad, ExhibitView) provide conversational, cross-domain awareness spanning exhibit status, objections/rulings, and custody simultaneously.
- Make discrepancies impossible to miss — flag mismatches (e.g., admitted-but-no-custodian, unresolved-objection-in-jury-package) automatically rather than relying on manual review.
- Run a complete, realistic, end-to-end demo scenario (a courtroom deputy managing a trial while a judge asks live questions) using seeded data, with zero reliance on manual data entry during the walkthrough.

---

## 4. Technical Architecture

| Layer | Technology | Purpose |
|---|---|---|
| Frontend/Full-stack framework | Next.js 16 + TypeScript | Single codebase for all 5 screens plus API routes |
| Database | Postgres (Neon) | Relational store for exhibits, events, custody, rulings |
| ORM | Prisma | Type-safe queries over the exhibit/objection/ruling/custody graph |
| AI/Assistant | Vercel AI SDK (`ai`, `@ai-sdk/react`, `@ai-sdk/anthropic`) | Tool-calling + streaming chat for the Pivota Assistant |
| Validation | zod | Validates tool-call arguments and API payloads before they reach Prisma |
| UI components | IBM Carbon Design System (`@carbon/react`) | Consistent, accessible component layer across screens |
| Client state/data | @tanstack/react-query, zustand | Server-state caching and lightweight client state |
| Data model pattern | Append-only event ledger + current-state projection | Ground-truth history (status/objection/ruling/custody changes) with fast-read derived views |
| Service layer | Single typed service module (`getExhibits`, `getCustodian`, `getUnresolvedObjections`, `recordEvent`, etc.) | Sole entry point for both UI screens and assistant tool wrappers — no parallel retrieval path |

**Explicitly avoided:** vector databases/embeddings (data is structured and small, not a document corpus requiring semantic search), full OAuth/production auth hardening (out of scope for a demo — seeded users + role switcher instead), and LangChain-style agent frameworks (unnecessary abstraction for a fixed, small tool set).

**Architectural principle:** Every UI screen and every assistant answer reads through the same service layer and the same event-sourced data model. This is what makes assistant citations trustworthy — the assistant cannot state anything the dashboards don't also show.

---

## 5. Feature Requirements

### F0: Exhibit Workspace (Data Model)
**Description:** The foundational data model maintaining a complete record of every exhibit associated with a case — identity, description, source, and all state derived from an append-only event ledger rather than mutable fields.

**Capabilities:**
- Unique exhibit identity (ID, description, source, associated witness/party)
- Append-only event ledger recording every status change, objection, ruling, and custody transfer with timestamps
- Current-state projection derived from the ledger for fast reads by UI and assistant alike
- Seed data representing a realistic multi-exhibit trial, including deliberately planted edge cases (an unresolved objection, a custody gap, a jury-package discrepancy) so the demo can showcase discrepancy detection without manual setup

**Priority:** P0 (Critical — MVP requirement; every other feature depends on this foundation)

---

### F1: Exhibit Status Display
**Description:** At-a-glance view of each exhibit's current lifecycle state, derived from the event ledger, so any authorized user can instantly see where an exhibit stands.

**Capabilities:**
- Status values covering the full admission lifecycle: marked, offered, objected, admitted, excluded, withdrawn
- Visual status indicators consistent across all screens (Command Center, Case Workspace, Exhibit Detail, Jury Package)
- Status always reflects the latest event in the ledger — no stale or conflicting state across screens

**Priority:** P0 (Critical — core to "immediate awareness" value proposition)

---

### F2: Objection and Ruling Tracking
**Description:** Logs objections raised during proceedings, links each to its specific exhibit, and records judicial rulings with timestamps, so the full objection/ruling history for any exhibit is always retrievable.

**Capabilities:**
- Log an objection against a specific exhibit, including objecting party and grounds
- Record a ruling (sustained, overruled, reserved) tied to the objection, with timestamp
- Support querying "what objections remain unresolved" across the whole case
- Feed directly into discrepancy detection (e.g., unresolved objection blocking jury-package inclusion)

**Priority:** P0 (Critical — required for core demo scenario questions)

---

### F3: Custody Tracking
**Description:** Records the current custodian/location of each physical or digital exhibit and maintains the full chain-of-custody history as an auditable, timestamped sequence of transfers.

**Capabilities:**
- Record custody transfers (who, when, from/to) as discrete ledger events, not a single mutable "current holder" field
- Instant lookup of "who currently has custody of Exhibit X"
- Full chain-of-custody history retrievable for any exhibit
- Feed into discrepancy detection (e.g., admitted exhibit with no recorded custodian)

**Priority:** P0 (Critical — required for core demo scenario questions)

---

### F4: Exhibit Search
**Description:** Fast lookup of exhibits using multiple criteria so any user can locate relevant evidence without scanning a full list.

**Capabilities:**
- Search/filter by exhibit ID, description/keyword, status, associated witness, or date
- Combinable filters (e.g., "admitted exhibits from witness Smith")
- Results surface in both the Case Workspace screen and as an assistant tool

**Priority:** P1 (High — materially improves usability of the core scenario, but Q&A/status features can demo without it)

---

### F5: Jury-Ready Exhibit List Generation
**Description:** Produces the authoritative, exportable list of admitted exhibits eligible for the jury package, gated by discrepancy detection so no flagged exhibit is silently included.

**Capabilities:**
- Compute jury-eligible exhibit set from current-state projection (admitted status, no unresolved objection, complete custody record)
- Discrepancy check runs and must be resolved/acknowledged **before** a jury package is finalized — detection gates generation, it does not follow it
- Exportable/curated view suitable for handoff (Jury Package Workspace screen)

**Priority:** P0 (Critical — named core demo scenario: "build a jury package")

---

### F6: Discrepancy Identification
**Description:** Automatically flags mismatches between what a case record shows and what it should logically show, surfacing operational risks before they become problems.

**Capabilities:**
- Detect admitted exhibit with missing or incomplete custody information
- Detect exhibit included in (or eligible for) the jury package despite an unresolved objection
- Rule set is extensible beyond these two named cases as additional discrepancy patterns are identified during implementation planning
- Discrepancies surface visibly on relevant screens (Case Workspace, Jury Package Workspace) and are answerable via the assistant

**Priority:** P0 (Critical — core differentiator; this is the "operational awareness" thesis made concrete)

---

### F7: Pivota Assistant (Natural-Language Q&A)
**Description:** A conversational assistant that answers natural-language courtroom questions about exhibit status, custody, rulings, and jury eligibility, with supporting citations for every factual claim. This is the single feature the entire demo's success depends on.

**Capabilities:**
- Answer questions such as: "What exhibits were admitted yesterday?", "What objections remain unresolved?", "Is Exhibit 14 in the jury package?", "Who currently has custody of Exhibit 7?", "What happened to Exhibit 14?"
- Every factual claim resolves to a specific record/event in the ledger and is presented with supporting context/citation — never an ungrounded or fabricated answer
- Explicit "I don't have that information" fallback is a valid and expected response when no record supports an answer
- Implemented via tool-calling (not retrieval-augmented generation/embeddings) — the assistant's tools are thin 1:1 wrappers around the same service-layer functions the UI screens call, guaranteeing the assistant can never state something a dashboard doesn't also show
- Streaming chat interface (via Vercel AI SDK `useChat`/`streamText`)
- Role-scoped retrieval: assistant answers respect the same role-based visibility rules as the UI (e.g., sealed/sidebar information is not surfaced to an unauthorized role)

**Priority:** P0 (Critical — explicitly the core value proposition: "If this fails, nothing else about the demo matters.")

---

### F8: Trial Command Center Screen
**Description:** A high-level, ambient live view of trial/exhibit activity designed for a judge or deputy to glance at during proceedings without needing to configure or drill into anything.

**Capabilities:**
- Live-updating summary of exhibit activity across the current trial (recent status changes, pending objections, recent rulings)
- At-a-glance indicators of outstanding discrepancies
- Designed for passive monitoring during active proceedings, not data entry

**Priority:** P1 (High — reinforces the "ambient awareness" positioning but is sequenced after core data/assistant features)

---

### F9: Case Workspace Screen
**Description:** The case-level view listing all exhibits, parties, and statuses in one place — the primary screen for browsing and searching the full exhibit set.

**Capabilities:**
- Full exhibit list for the case with current status, party, and witness association
- Integrated search/filter (F4)
- Surfaces discrepancy flags (F6) inline per exhibit
- Entry point to drill into an individual Exhibit Detail View (F10)

**Priority:** P0 (Critical — primary browsing surface for the demo scenario)

---

### F10: Exhibit Detail View Screen
**Description:** The full history for a single exhibit — every status change, objection, ruling, and custody transfer — presented as a chronological timeline reconstructed directly from the event ledger.

**Capabilities:**
- Chronological timeline of all events for the exhibit (status changes, objections raised, rulings recorded, custody transfers)
- Answers "what happened to this exhibit" without assembling fragments from multiple sources
- Current status, current custodian, and any active discrepancy flags shown prominently

**Priority:** P0 (Critical — directly supports the named demo scenario "explain what happened to an exhibit")

---

### F11: Jury Package Workspace Screen
**Description:** A curated, exportable workspace presenting the jury-eligible exhibit list (F5) alongside any discrepancy warnings, serving as the authoritative handoff view for jury package preparation.

**Capabilities:**
- Displays the computed jury-ready exhibit list
- Surfaces discrepancy warnings prominently and blocks/flags finalization until addressed
- Export/curated presentation suitable for handoff to the next step in the trial process

**Priority:** P0 (Critical — named core demo scenario: "build a jury package")

---

### F12: Admission Integrity Gating
**Description:** State-machine enforcement preventing an exhibit from being marked Admitted while it still has an unresolved objection or no custodian of record, closing the gap where these discrepancies were previously detected only after the fact.

**Capabilities:**
- Admission transition is rejected (not silently flagged) when the exhibit has an open/unresolved objection thread
- Admission transition is rejected when the exhibit has no custodian recorded on the chain-of-custody ledger
- Applies uniformly regardless of entry point (UI action, API call, or any future automation) — the gate lives in the shared service layer, not a single screen
- Rejection surfaces a clear, actionable reason (e.g., "cannot admit: objection unresolved" / "cannot admit: no custodian on record") rather than a generic error
- Contested (Objected) exhibits that are correctly excluded from the jury package are also checked for custody completeness, so a custody gap on a still-open exhibit is visible before it ever reaches the admission decision

**Priority:** P0 (Critical — closes a state-model gap that previously allowed invalid admissions to occur silently)

---

### F13: Jury Package Ex Parte / Sealed Exclusion
**Description:** Hard structural exclusion of ex parte, sealed, or chambers-only material from the jury-eligible exhibit set, so no sidebar or in-camera submission can appear as eligible/clean in a draft jury package regardless of its admission status.

**Capabilities:**
- Jury-eligibility computation treats sealed/ex-parte classification as an absolute exclusion, independent of and prior to the admitted/objection/custody discrepancy checks in F6
- An Admitted exhibit flagged as ex parte or chambers-only never appears as eligible, draft-included, or "clean" on the Jury Package Workspace
- Exclusion is enforced at the same shared service layer the Jury Package Workspace and the assistant both read, so there is no path (UI, export, or assistant answer) that can surface sealed material as jury-eligible
- Regression coverage specifically exercises the originating case (a sealed chambers sidebar note marked Admitted) to prevent recurrence

**Priority:** P0 (Critical — highest-severity finding; sealed/ex-parte material reaching jurors is the single most damaging failure mode this product must prevent)

---

### F14: Discrepancy Acknowledgment Transparency
**Description:** Makes the semantics of acknowledging a discrepancy visible to the user at the point of action — who is permitted to acknowledge, and that doing so is recorded as an auditable event rather than a silent dismissal.

**Capabilities:**
- Acknowledge action visibly indicates (via inline copy, tooltip, or confirmation state) that the acknowledgment will be recorded as a permanent, auditable event tied to the acknowledging user and role
- Role restrictions on who may acknowledge (per the Phase 3 model: deputy/clerk/judge/admin) are reflected in the UI — an unauthorized role does not see an acknowledge control that will silently fail or is misleadingly enabled
- Acknowledgment required-justification field is clearly labeled as part of the permanent record, not a throwaway comment
- No change to the underlying acknowledgment data model or audit trail from F6/F11 — this feature is strictly about making existing semantics legible, not altering them

**Priority:** P1 (High — trust/comprehension issue for a demo audience of judges and court staff, not a data-integrity defect)

---

### F15: Courtroom Usability Fixes
**Description:** A cluster of interface clarity and consistency fixes identified during review of the shipped milestone — making the Case Workspace, Pivota Assistant, header, and activity feed behave the way a courtroom user would expect without additional explanation.

**Capabilities:**
- Case Workspace exhibit table rows are directly clickable through to the Exhibit Detail View, matching the existing activity-feed link behavior rather than requiring it as the only entry point
- Assistant example/suggested-question prompts reference the case's actual exhibit labeling scheme (e.g., P-1, P-3, S-1) instead of a mismatched placeholder scheme (e.g., "Exhibit 14," "Exhibit 7")
- The unlabeled numeric element displayed near the role selector in the header is either clearly labeled with its purpose or removed if it serves no user-facing function
- Activity feed entries display both date and time (not time only), so that same-second seeded events and day-boundary crossings remain unambiguous to a reader
- Activity feed entries display the exhibit's label alongside each state-transition description (e.g., "P-1: MARKED → OFFERED" rather than "from (none) to MARKED"), so a reader can identify which exhibit changed without opening it

**Priority:** P1 (High — usability/clarity defects that undermine the "assistant, not system to learn" positioning but do not affect data integrity)

---

### F16: Exhibit Classification Taxonomy
**Description:** A formal, intake-time classification scheme — Trial / Chambers-Ex-Parte / Sealed — that replaces the current single `isSealed` boolean as the system's model of exhibit sensitivity. Classification is captured when an exhibit is first marked, not inferred or back-filled later, and becomes the authoritative input to every downstream visibility and eligibility rule (role-scoped assistant/UI visibility, and the jury-package exclusion Phase 7's F13 implemented against the boolean).

**Capabilities:**
- Three-value classification (`TRIAL`, `CHAMBERS_EX_PARTE`, `SEALED`) required at intake/marking time — no exhibit can exist in an unclassified state
- Migration path from the existing `isSealed` boolean to the new taxonomy preserves the exclusion behavior F13 already enforces (sealed → excluded), re-expressed as `SEALED` and `CHAMBERS_EX_PARTE` both triggering the same hard jury-package exclusion
- Classification is immutable after intake except via an explicit, audited reclassification event (not a silent field edit) — reclassification itself is logged to the ledger
- Role-scoped visibility (assistant and UI) is re-evaluated against the three-value classification, not the retired boolean, so chambers-ex-parte material is treated with the same rigor as sealed material everywhere the boolean previously governed

**Priority:** P0 (Critical — product-owner-flagged gap: a boolean cannot distinguish chambers-ex-parte from sealed material, and F13's exclusion logic must be driven by the real taxonomy, not a proxy)

---

### F17: Objection-to-Admission State-Machine Hardening
**Description:** Closes a state-machine gap that Phase 7's F12 does not fully close: F12 blocks admission while any objection is *currently* unresolved, but does not guarantee that the OBJECTED status was ever legitimately cleared. This feature makes a recorded judge ruling the only legal transition out of OBJECTED — there is no path, direct or incidental, by which an exhibit can reach ADMITTED from OBJECTED without an intervening ruling event in the ledger.

**Capabilities:**
- The state machine itself (not just a point-in-time admission check) refuses any OBJECTED → ADMITTED transition that is not immediately preceded by a RULING event tied to that objection thread
- Eliminates the edge case where an objection is bypassed or its unresolved flag is cleared by means other than a recorded ruling (e.g., a direct status overwrite), which F12's "check current unresolved count" gate alone cannot detect
- Applies at the shared service layer, so no UI, API, or future automation path can construct a valid OBJECTED → ADMITTED transition without a ruling
- Regression coverage specifically exercises a skipped/bypassed-ruling attempt to confirm the transition is rejected, not merely flagged after the fact

**Priority:** P0 (Critical — hardens F12's intent against a bypass path F12 alone does not close)

---

### F18: Custodian Required at Intake (MARKED)
**Description:** Moves the custodian requirement earlier in the exhibit lifecycle. Phase 7's F12 requires a custodian only at the ADMITTED transition; this feature requires every exhibit to have a custodian of record the moment it is marked into evidence, closing the window during which an exhibit exists in the system with no chain-of-custody starting point.

**Capabilities:**
- The MARKED transition (exhibit intake) is rejected if no custodian is supplied, using the same reject-with-reason pattern F12 established for ADMITTED
- Chain-of-custody history (F3) therefore always has a defined starting link for every exhibit, with no gap between intake and first custody record
- Enforced at the shared service layer so no entry point (UI, API, seed loader, future automation) can create a custodian-less exhibit at any lifecycle stage
- Existing F12 admission-time custodian check is retained unchanged — this feature adds an earlier gate, it does not replace the later one

**Priority:** P0 (Critical — closes a custody-gap window F12 leaves open between intake and admission)

---

### F19: Custody Handoff Confirmation
**Description:** Converts the current unilateral `recordCustodyTransfer` action into a two-phase propose/accept flow, so a custody record reflects that the receiving party actually took possession rather than merely that someone asserted a transfer occurred.

**Capabilities:**
- A custody transfer is initiated as a PROPOSED event naming the sending and intended receiving custodian — it does not change current custody by itself
- The named receiving custodian must explicitly acknowledge/accept the transfer before custody of record changes; acceptance is itself a discrete, timestamped ledger event
- A proposed-but-not-yet-accepted transfer is visibly distinguished from a confirmed transfer on Custody Tracking (F3) and the Exhibit Detail View (F10) — "who currently has custody" always reflects the last *accepted* transfer, never a pending proposal
- A proposed transfer can be rejected or left pending by the intended receiver, and the system clearly surfaces transfers awaiting acceptance so they are not silently lost
- Existing wrong-holder-rejection validation from F3/Phase 1 is preserved: only the current custodian of record can propose a transfer

**Priority:** P0 (Critical — product-owner-flagged gap: a unilateral custody record cannot support a credible chain-of-custody claim)

---

### F20: Server-Side Role Enforcement Matrix (Full RBAC)
**Description:** Extends server-side role checking — already applied to rulings, jury-package finalization, and discrepancy acknowledgment — to every write action in the system, under a single, explicit permission matrix: Judges record rulings; Deputies/Clerks handle marking, custody, and jury-package operations; Attorneys raise objections and view. Every write validates the ACTING user's actual server-side role against this matrix; no write path relies on client-side role-switcher state alone.

**Note — scope reversal:** This feature explicitly reverses a v1 scope exclusion. Both the PRD's Technical Architecture section and `TechArch/00-overview.md` / `TechArch/05-tech-stack.md` / `TechArch/04-security.md` §5.5 previously recorded "full OAuth/production-grade auth hardening" as out of scope for this demo, relying on a client-side role switcher with partial server-side checks (rulings, finalize, acknowledge only). The product owner has now requested full server-side enforcement across all write actions. This is recorded here, in the PRD, so the reversal is traceable rather than silently superseding the prior architectural decision; TechArch and FRD must be updated in this phase's planning to reflect the new permission matrix in place of the prior "seeded users + role switcher, partial checks" model.

**Capabilities:**
- A single, explicit permission matrix governs every write endpoint: status transitions (mark/offer/admit/exclude/withdraw), objection raising, custody propose/accept (F19), and jury-package operations, in addition to the rulings/finalize/acknowledge checks that already exist
- Every write handler resolves the ACTING user's role from server-side session/identity state (not a client-supplied value) and rejects any action outside that role's permitted set, with a clear "role not permitted for this action" reason
- Judges: record rulings (and any judge-reserved actions). Deputies/Clerks: marking, custody operations, jury-package build/finalize. Attorneys: raise objections, read/view only — no write access outside objections
- Permission matrix is enforced at the shared service layer, so UI, API, and assistant tool-call paths cannot diverge in what they allow
- Does not introduce full production authentication (OAuth/OIDC/session hardening remains explicitly out of scope) — this feature hardens *authorization* (what a known, seeded role may do), not *authentication* (proving who the user is)

**Priority:** P0 (Critical — product-owner-flagged gap, and a direct reversal of a recorded v1 exclusion; partial server-side role checks were assessed as insufficient after the live demo review)

---

### F21: Pending-Ruling Queue
**Description:** A new judge-facing view listing every currently open objection across the case, ordered by elapsed wait time, so a judge can immediately see which objections have been waiting longest for a ruling rather than discovering them exhibit-by-exhibit.

**Capabilities:**
- Lists all open (unresolved) objection threads case-wide, each showing the associated exhibit, objecting party, grounds, and elapsed time since the objection was raised
- Default sort is elapsed wait time descending (longest-waiting first), so the queue itself prioritizes judicial attention without manual sorting
- Entries link directly into the ruling-recording action for that objection (and into the Exhibit Detail View, F10, for full context)
- Reads through the same service layer as F2 (Objection and Ruling Tracking) and F6 (Discrepancy Identification) — no parallel query path that could diverge from what Exhibit Detail or Case Workspace shows for the same objection
- Role-restricted to Judges per the F20 permission matrix (Deputies/Clerks/Attorneys do not get a ruling-recording entry point from this queue)

**Priority:** P1 (High — directly supports judicial workflow and complements F17's state-machine hardening, but the case can still function without a dedicated queue view in the short term)

---

### F22: Multi-Case Support with Case Selector
**Description:** Replaces the current hardcoded single-demo-case assumption with the ability to list active cases and switch between them, so the product can be demonstrated against more than one case without a redeploy or data reset.

**Note — scope reversal:** This feature explicitly reverses a v1 scope exclusion. `TechArch/04-security.md` §5.5 previously recorded "Multi-tenant data isolation (single-case scope — `case_id` exists in the schema for future partitioning but no tenant-isolation enforcement is implemented)" as out of scope, and the Technical Architecture / NFR sections of this PRD assumed single-case scale throughout (see NFRs and the F4/F9 descriptions). The product owner has now requested multi-case support as a follow-on to the live demo. This is recorded here so the reversal is traceable; TechArch, FRD, and the NFR section's "single case" scale assumptions must be revisited in this phase's planning rather than left silently inconsistent with the new capability.

**Capabilities:**
- A case selector lists all active cases available to the current user and allows switching the active case context for every screen (Command Center, Case Workspace, Exhibit Detail, Jury Package Workspace) and the assistant
- `case_id` scoping — already present in the schema per the prior TechArch note but not enforced — becomes an enforced isolation boundary: all queries, writes, and assistant tool calls are scoped to the currently selected case, with no cross-case data leakage
- Switching cases updates all open screens and the assistant's working context consistently, with no stale single-case assumptions remaining in any service-layer query
- Seed data is extended to include at least a second case so multi-case switching is demonstrable, not just structurally possible

**Priority:** P1 (High — a genuine scope expansion the product owner requested; important for broader sales demos but not a correctness/integrity defect in the existing single-case scenario)

---

### F23: Versioned Jury Packages with PDF Export
**Description:** Replaces the current `window.print()`-based export on the Jury Package Workspace (F11) with real, generated PDF export, and adds version history so every finalization produces a permanent, retrievable record of exactly what the jury received at that point in time.

**Capabilities:**
- Finalizing a jury package generates an actual PDF document (not a browser print dialog), suitable for formal handoff and archival
- Each finalization is recorded as a new, immutable version — re-finalizing after changes (e.g., a late exclusion per F13) produces a new version rather than overwriting the prior one
- Full version history is retrievable per case: which exhibits were included, in what classification/status state, at each finalization timestamp
- The currently-active/most-recent version is clearly distinguished from historical versions on the Jury Package Workspace
- Generated PDFs reflect the same discrepancy-gated, classification-excluded exhibit set (F6, F13, F16) that the live workspace view shows — no divergence between what is displayed and what is exported

**Priority:** P1 (High — strengthens the "permanent, authoritative record" value proposition and directly supports the named jury-package demo scenario, but the existing print-based export remains functional in the interim)

---

## 6. Non-Functional Requirements

- **Trustworthiness over fluency:** Every assistant answer must be traceable to a specific ledger record; the system must never generate a plausible-sounding but unsupported claim (analogous to real-world sanctions over fabricated AI legal citations).
- **Single source of truth:** UI screens and the assistant must read through the identical service layer — no parallel data path that could produce diverging answers between a screen and the assistant.
- **Auditability:** All status, objection/ruling, and custody changes are recorded as immutable, timestamped events — never overwritten or deleted, supporting full historical reconstruction at any point.
- **Role-appropriate visibility:** Assistant and UI must apply the same role-based scoping, so no user — including via the assistant — sees information outside their authorized role (e.g., sealed or sidebar matters).
- **Responsiveness for live use:** Screens and assistant responses must feel immediate during live proceedings; status/data changes should propagate across open screens without manual refresh (polling-based live sync is acceptable for this demo).
- **Demo reliability:** The seeded demo scenario must run start-to-finish without manual data entry or environment fragility, since it will be presented live or recorded for court customers.
- **Non-technical usability:** All screens and assistant interactions must be understandable to non-technical judges and court staff — clarity and trustworthiness of answers matter more than technical sophistication or feature density.
- **Realistic seed data complexity:** Seed data must include deliberate edge cases (unresolved objections, custody gaps, jury-package discrepancies) — overly clean seed data would make discrepancy detection undemonstrable.
- **Design-system foundation:** All screens are built on IBM Carbon Design System as the single component/visual-language foundation, providing accessibility-conformant components and a consistent enterprise visual language across every screen.

---

## 7. Success Metrics

- **Core scenario completion:** The courtroom-deputy-manages-a-trial / judge-asks-live-questions scenario runs end-to-end, live or recorded, without manual data entry or breakage, in a single walkthrough session.
- **Assistant answer accuracy:** 100% of the assistant's answers to the five named example questions ("what exhibits were admitted yesterday," "what objections remain unresolved," "is Exhibit 14 in the jury package," "who currently has custody of Exhibit 7," "what happened to Exhibit 14") are correct and cited against seed data.
- **Zero ungrounded answers:** 0 instances of the assistant producing a factual claim that cannot be traced to a ledger record during demo review/testing.
- **Discrepancy detection recall:** 100% of the deliberately seeded discrepancy edge cases (unresolved-objection-in-jury-package, admitted-no-custodian) are correctly flagged by the system without manual intervention.
- **Jury package integrity:** 0 discrepant exhibits appear in a finalized jury package during testing — discrepancy gating works on every generation attempt.
- **Cross-screen consistency:** 100% agreement between what any UI screen displays and what the assistant states for the same exhibit, in spot-check testing across all 5 screens.
- **Stakeholder comprehension:** Non-technical reviewers (simulating judges/court staff) can, after a single walkthrough, correctly describe what the product does and why it differs from "another case management system."

---

## 8. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Assistant generates a fluent but ungrounded or fabricated answer | Critical — directly undermines the core value proposition and echoes real-world AI-hallucination court sanctions | Enforce tool-calling architecture where every assistant claim resolves to a service-layer query result; system prompt requires cite-or-decline; no free-generation fallback for factual claims |
| Jury package includes a discrepant exhibit (e.g., unresolved objection) | Critical — the exact failure mode the demo exists to prevent | Discrepancy detection runs as a hard gate before jury package generation/finalization, not as a post-hoc check |
| Status/custody modeled as mutable "current state" fields instead of an event log | High — breaks all history questions and is the costliest retrofit if discovered late | Lock in append-only event ledger as the foundational data model in Phase 1, before any status UI is built |
| Seed data is too clean to demonstrate discrepancy detection | High — a headline differentiator becomes unverifiable in the demo | Deliberately author seed data with at least one unresolved objection, one custody gap, and one jury-package discrepancy |
| Assistant surfaces information outside a user's authorized role (e.g., sealed/sidebar matters) | Medium-High — trust and positioning risk with legal audience | Apply identical role-based scoping to assistant tool calls as to UI queries; no separate, unscoped retrieval path |
| Demo positioning drifts toward "new system to learn" instead of "assistant augmenting existing workflow" | Medium — undermines the explicit sales positioning goal | Favor conversational/assistive UX over heavy data-entry forms on every screen; review each screen against the "assistant, not system" framing |
| Live multi-screen sync (e.g., Command Center vs. Exhibit Detail) feels laggy or inconsistent during a live walkthrough | Medium — undercuts "immediate awareness" claim | Use polling-based live sync tuned against realistic demo pacing; revisit SSE/WebSocket only if polling proves visibly insufficient |

---

## 9. Feature Index

| ID | Feature | Category | Priority |
|---|---|---|---|
| F0 | Exhibit Workspace (Data Model) | Data Foundation | P0 |
| F1 | Exhibit Status Display | Status Tracking | P0 |
| F2 | Objection and Ruling Tracking | Status Tracking | P0 |
| F3 | Custody Tracking | Status Tracking | P0 |
| F4 | Exhibit Search | Usability | P1 |
| F5 | Jury-Ready Exhibit List Generation | Differentiator | P0 |
| F6 | Discrepancy Identification | Differentiator | P0 |
| F7 | Pivota Assistant (Natural-Language Q&A) | Differentiator / Core Value | P0 |
| F8 | Trial Command Center Screen | UI Screen | P1 |
| F9 | Case Workspace Screen | UI Screen | P0 |
| F10 | Exhibit Detail View Screen | UI Screen | P0 |
| F11 | Jury Package Workspace Screen | UI Screen | P0 |
| F12 | Admission Integrity Gating | Status Tracking | P0 |
| F13 | Jury Package Ex Parte / Sealed Exclusion | Differentiator | P0 |
| F14 | Discrepancy Acknowledgment Transparency | Differentiator | P1 |
| F15 | Courtroom Usability Fixes | Usability | P1 |
| F16 | Exhibit Classification Taxonomy | Status Tracking | P0 |
| F17 | Objection-to-Admission State-Machine Hardening | Status Tracking | P0 |
| F18 | Custodian Required at Intake (MARKED) | Status Tracking | P0 |
| F19 | Custody Handoff Confirmation | Status Tracking | P0 |
| F20 | Server-Side Role Enforcement Matrix (Full RBAC) | Security / Scope Reversal | P0 |
| F21 | Pending-Ruling Queue | UI Screen | P1 |
| F22 | Multi-Case Support with Case Selector | Scope Reversal | P1 |
| F23 | Versioned Jury Packages with PDF Export | Differentiator | P1 |

**Priority Summary:**
- **P0 (Critical — MVP):** F0, F1, F2, F3, F5, F6, F7, F9, F10, F11, F12, F13, F16, F17, F18, F19, F20 — 17 features
- **P1 (High):** F4, F8, F14, F15, F21, F22, F23 — 7 features
- **P2 / P3:** None at this stage — all defined features are considered necessary for a credible end-to-end demo

---

*This PRD serves as the foundational document for FRD (Functional Requirements Document), TechArch (Technical Architecture Document), and UserStories generation for JudicialSync.*
