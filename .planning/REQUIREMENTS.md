# Requirements: JudicialSync-Demo

**Defined:** 2026-10-06
**Core Value:** During live proceedings, any authorized courtroom user can ask a natural-language question about an exhibit and get an immediate, accurate, well-supported answer.

## v1 Requirements

All 12 features from the PRD are in v1 scope — this is a demo meant to prove the complete operational-awareness story end-to-end, and the differentiating features (discrepancy detection, the assistant) structurally depend on the full data model being present first.

### Data Foundation

- [ ] **F0**: Exhibit Workspace — the system maintains an append-only event ledger (not mutable fields) recording every exhibit's identity (label, description, source, offering party) and all state changes for a case, with current-state views derived by replaying the ledger
- [ ] **F0a**: Seed/demo data loads deterministically through the same event-recording path the live UI uses, and includes at least one unresolved objection, one custody gap, and one jury-package discrepancy so the differentiating features are demonstrable without manual setup

### Status Tracking

- [ ] **F1**: Exhibit Status Display — every exhibit shows its current admission-lifecycle status (marked/offered/objected/admitted/excluded/withdrawn), consistently across every screen, always reflecting the latest ledger event with no cached or divergent state
- [ ] **F2**: Objection and Ruling Tracking — users can log an objection against an exhibit, record a judicial ruling (sustained/overruled/reserved) tied to that objection, and retrieve the full objection/ruling history for any exhibit or query all case-wide unresolved objections
- [ ] **F3**: Custody Tracking — users can record custody transfers as discrete immutable events, instantly look up an exhibit's current custodian, and review the complete chronological chain-of-custody history for any exhibit

### Usability

- [ ] **F4**: Exhibit Search — users can locate exhibits by ID, description, status, witness, or date without scanning the full case list

### Differentiators

- [ ] **F5**: Jury-Ready Exhibit List Generation — the system produces the authoritative, exportable list of admitted exhibits eligible for the jury package, with generation/finalization hard-gated on discrepancy checks (never a post-hoc check)
- [ ] **F6**: Discrepancy Identification — the system automatically flags mismatches across status, objection, and custody data (e.g., an admitted exhibit with no recorded custodian, or an exhibit in the jury package despite an unresolved objection) before they become operational problems
- [ ] **F7**: Pivota Assistant — a conversational assistant answers natural-language courtroom questions (e.g., "what exhibits were admitted yesterday," "what objections remain unresolved," "is Exhibit 14 in the jury package," "who has custody of Exhibit 7") with a supporting citation (record ID + timestamp) for every factual claim, using the same role-based visibility rules as the UI, and explicitly declines rather than guesses when it cannot cite an answer

### UI Screens

- [ ] **F8**: Trial Command Center Screen — an ambient, high-level live view of trial/exhibit activity for a judge or deputy to glance at during proceedings without configuration
- [ ] **F9**: Case Workspace Screen — the case-level view listing all exhibits, parties, and statuses; the primary browse/search screen
- [ ] **F10**: Exhibit Detail View Screen — a single exhibit's full chronological history (status changes, objections, rulings, custody transfers) reconstructed directly from the event ledger
- [ ] **F11**: Jury Package Workspace Screen — the curated, exportable jury-eligible exhibit list alongside any discrepancy warnings, serving as the authoritative handoff view for jury package preparation

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Assistant Enhancements

- **ASST-V2-01**: Proactive alerts — assistant surfaces discrepancies unprompted rather than only on query
- **ASST-V2-02**: Multi-case / cross-trial history in assistant answers

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Full case management system functionality (filings, docketing, scheduling) | Positioned as an assistant augmenting existing court systems, not a CMS replacement |
| Real integrations with court case management systems or evidence lockers | Demo uses seeded/representative data; real integrations are a production concern |
| Multi-tenant / multi-court production deployment | Single-case demo environment only |
| Exhibit presentation/annotation display (TrialPad-style zoom, highlight, redact-live) | Pulls scope into attorney-presentation tooling, a crowded market Pivota isn't positioned to win; dilutes "assistant" framing |
| Deposition video sync/clip bookmarking | Orthogonal to operational awareness; large separate engineering surface with no bearing on exhibit status truth |
| Production-grade auth/authorization hardening | Basic role distinction is sufficient for the demo; hardening is out of scope |
| Mobile-native apps | Demo targets web/desktop screens only |
| Voice input in courtroom | Adds hardware/UX risk with no validation yet that the text assistant works |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| F0 | TBD | Pending |
| F0a | TBD | Pending |
| F1 | TBD | Pending |
| F2 | TBD | Pending |
| F3 | TBD | Pending |
| F4 | TBD | Pending |
| F5 | TBD | Pending |
| F6 | TBD | Pending |
| F7 | TBD | Pending |
| F8 | TBD | Pending |
| F9 | TBD | Pending |
| F10 | TBD | Pending |
| F11 | TBD | Pending |

**Coverage:**
- v1 requirements: 13 total
- Mapped to phases: 0 (pending roadmap creation)
- Unmapped: 13 ⚠️ (will be resolved by roadmap)

---
*Requirements defined: 2026-10-06*
*Last updated: 2026-10-06 after initial definition*
