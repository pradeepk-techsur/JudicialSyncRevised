# JudicialSync-Demo

## What This Is

JudicialSync-Demo is a demonstration of Pivota acting as the operational memory of the courtroom — a single system that gives judges, chambers staff, courtroom deputies, clerks, and attorneys immediate, trustworthy awareness of exhibit status, rulings, custody, and next actions during a trial. It replaces the spreadsheets, paper logs, emails, and individual notes courtroom staff currently juggle to track evidence.

## Core Value

During live proceedings, any authorized courtroom user can ask a natural-language question about an exhibit — its status, custody, ruling history, or jury eligibility — and get an immediate, accurate, well-supported answer. If this fails, nothing else about the demo matters.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Exhibit workspace that maintains a complete record of every exhibit associated with a case (identity, description, source, current status)
- [ ] Exhibit status display — at-a-glance view of each exhibit's state (marked, offered, objected, admitted, excluded, withdrawn, etc.)
- [ ] Objection and ruling tracking — log objections raised, link them to specific exhibits, and record judicial rulings (sustained/overruled/reserved) with timestamps
- [ ] Custody tracking — record current custodian/location of physical or digital exhibits and the chain-of-custody history
- [ ] Exhibit search — fast lookup of exhibits by ID, description, status, witness, or date
- [ ] Jury-ready exhibit list generation — produce the authoritative list of admitted exhibits eligible for the jury package, with discrepancy detection against what should/shouldn't be included
- [ ] Discrepancy identification — flag mismatches (e.g., an exhibit marked admitted but missing custody info, or included in jury package despite an unresolved objection)
- [ ] Natural-language assistant (Pivota Assistant) — answer courtroom questions such as "what exhibits were admitted yesterday," "what objections remain unresolved," "is Exhibit 14 in the jury package," "who currently has custody of Exhibit 7," and provide supporting context/citations for each answer
- [ ] Trial Command Center screen — high-level live view of trial/exhibit activity for a judge or deputy during proceedings
- [ ] Case Workspace screen — case-level view of all exhibits, parties, and status
- [ ] Exhibit Detail View screen — full history for a single exhibit (status changes, rulings, objections, custody chain)
- [ ] Jury Package Workspace screen — curated, exportable view of jury-eligible exhibits
- [ ] Seed/demo data representing a realistic multi-exhibit trial (exhibits, objections, rulings, custodians, timestamps) so the demo scenario can be run end-to-end without manual data entry

### Out of Scope

- Full case management system functionality (filings, docketing, scheduling) — this demo is positioned as an assistant augmenting existing court systems, not replacing them
- Real integrations with actual court case management systems or evidence lockers — demo uses seeded/representative data
- Multi-tenant / multi-court production deployment concerns — this is a single-case demo environment
- User authentication/authorization hardening beyond basic role distinction for the demo — production-grade security is out of scope for a demo
- Mobile-native apps — demo targets web/desktop screens only

## Context

This is a sales/demo project intended to show court customers (judges, chambers staff, deputies, clerks, court administrators) that Pivota reduces the manual searching courtroom staff do today across spreadsheets, paper logs, emails, and notes to answer exhibit questions. The explicit positioning goal is that customers should see Pivota as an **assistant** for the people in the courtroom — not as "yet another case management system." The core demo scenario centers on a courtroom deputy managing a trial with numerous exhibits, where a judge asks live questions (admitted exhibits, unresolved objections, jury package inclusion) that Pivota must answer immediately with supporting context.

Primary users: Judge, Chambers Staff, Courtroom Deputy, Clerk of Court, Attorneys, Court Administrators.

Key interactions the demo must support: show admitted exhibits; explain what happened to an exhibit; identify unresolved objections; build a jury package; determine current custodian; locate evidence; explain ruling history.

Demo screens: Trial Command Center, Case Workspace, Exhibit Detail View, Jury Package Workspace, and Pivota Assistant.

## Constraints

- **Audience**: Demo must be understandable and compelling to non-technical court staff and judges in a live or recorded walkthrough — clarity and trustworthiness of answers matter more than technical sophistication.
- **Scenario-driven**: The build must support the specific core demo scenario (deputy managing a trial, judge asking live questions) end-to-end with realistic seed data, not just isolated features.
- **Positioning**: Every screen and interaction should reinforce "assistant to courtroom staff" rather than "new system to learn" — favor conversational/assistive UX over heavy data-entry forms.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build as a demo (not production case management system) | Goal is to show court customers the operational-awareness value of Pivota, not replace existing systems | — Pending |
| Center the demo around a single trial with numerous exhibits | Matches the core demo scenario described by stakeholders (judge asking live questions) | — Pending |
| Include a natural-language Pivota Assistant as a first-class feature | Differentiates from traditional case management software; central to the "assistant" positioning | — Pending |

---
*Last updated: 2026-10-06 after initialization*
