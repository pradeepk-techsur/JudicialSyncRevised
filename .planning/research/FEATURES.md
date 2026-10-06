# Feature Research

**Domain:** Courtroom exhibit tracking / trial operational-awareness assistant
**Researched:** 2026-10-06
**Confidence:** MEDIUM

Competitor landscape has two distinct lineages that both touch "exhibit management" but solve different problems: (1) **trial presentation software** (TrialPad/LIT Suite, ExhibitView, Sanction, OnCue) — iPad/laptop tools lawyers use to *display* exhibits to judge/jury with annotation, redaction, and video sync; (2) **digital evidence management systems (DEMS)** used by law enforcement/prosecutors (Axon Evidence-class tools) — chain-of-custody and status tracking for physical/digital evidence. JudicialSync-Demo sits between these but is neither: it's a read-layer operational-awareness assistant over exhibit *status and custody state*, not a presentation tool or an evidence vault. Confidence is MEDIUM because the conversational-assistant-for-courtroom-status category has no direct public competitor to benchmark against (sources are adjacent-category products, not a close analog).

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Exhibit identity record (ID, description, source, offering party) | Every trial tool — presentation or DEMS — treats this as the root entity | LOW | Already in PROJECT.md scope |
| Admission-lifecycle status (marked→offered→objected→admitted/excluded/withdrawn) | Mirrors actual courtroom procedure; any tracking tool must model real exhibit states | MEDIUM | State machine, not free text |
| Objection/ruling log tied to exhibit, with timestamp | DEMS and docket systems both log dispositions against evidence | MEDIUM | Sustained/overruled/reserved |
| Chain-of-custody / current custodian | Core DEMS table-stakes feature (Axon Evidence-class) | MEDIUM | Who has it now + history |
| Search/filter by ID, status, witness, date | Table stakes in both TrialPad and ExhibitView | LOW | Users abandon tool without fast lookup |
| Jury-eligible exhibit list export | TrialPad's "ExhibitsPad" ships identical exhibit sets to jurors — same underlying need, different mechanism | MEDIUM | Must exclude anything not admitted |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Conversational NL assistant with cited answers | No competitor in either lineage offers ask-a-question access; TrialPad/ExhibitView require manual navigation | HIGH | Central to "assistant not CMS" positioning |
| Automated discrepancy detection (admitted-but-no-custodian, objection unresolved yet in jury package) | DEMS tools track custody and docket tools track rulings, but neither cross-checks the two against each other | MEDIUM | This is the "operational awareness" thesis made concrete |
| Live Trial Command Center view (ambient status, not a dashboard you configure) | Presentation tools are single-exhibit-focused during live use; nothing gives a deputy/judge a whole-trial glance | MEDIUM | Reinforces assistant, not data-entry system |
| Role-agnostic single source of truth (judge, deputy, clerk, attorney see consistent state) | DEMS tools are law-enforcement-facing; presentation tools are attorney-facing; nobody serves the bench + clerk + deputy simultaneously | MEDIUM | Matches PROJECT.md's multi-role audience |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Exhibit presentation/annotation display (TrialPad-style zoom, highlight, redact-live) | "Shouldn't we also show exhibits on screen?" | Pulls scope into attorney-presentation tooling, a crowded market Pivota isn't positioned to win; dilutes "assistant" framing into "yet another trial-display app" | Keep Pivota as the status/awareness layer; presentation stays with existing courtroom AV/TrialPad-class tools |
| Deposition video sync/clip bookmarking | ExhibitView/TrialPad treat this as flagship | Orthogonal to operational awareness; large, separate engineering surface (media sync) with no bearing on exhibit status truth | Out of scope per PROJECT.md; link out if ever needed |
| Full docketing/filing/scheduling (case management core) | "While we're tracking exhibits, why not the whole case?" | This is explicitly the positioning trap — becomes "new system to learn" instead of assistant augmenting existing CMS | Explicitly out of scope in PROJECT.md; integrate with existing CMS later, don't replace it |

## Feature Dependencies

```
Exhibit Workspace (identity record)
    └──requires──> nothing (root entity)

Status Tracking (admission lifecycle)
    └──requires──> Exhibit Workspace

Objection/Ruling Log
    └──requires──> Exhibit Workspace
    └──enhances──> Status Tracking (ruling drives status transition)

Custody Tracking
    └──requires──> Exhibit Workspace

Discrepancy Detection
    └──requires──> Status Tracking + Objection/Ruling Log + Custody Tracking
                       (needs all three to cross-check)

Jury Package Generation
    └──requires──> Status Tracking (must filter to "admitted")
    └──requires──> Discrepancy Detection (flag what shouldn't be included)

NL Assistant (Pivota Assistant)
    └──requires──> Exhibit Workspace + Status + Custody + Objections
                       (query layer over all of the above — build data model first)

Trial Command Center
    └──requires──> Status + Objection/Ruling Log (needs live state to summarize)
```

### Dependency Notes

- **Discrepancy Detection requires all three data domains:** it's a cross-check (e.g., admitted exhibit with no custodian), so it can't be built until status, rulings, and custody all exist — this is a late-phase feature even though it's a key differentiator.
- **NL Assistant requires the full data model, not a separate pipeline:** it answers by querying existing status/custody/objection records with citations — building it before the underlying records exist means there's nothing to cite.
- **Jury Package conflicts with incomplete Discrepancy Detection:** generating a jury list without discrepancy checks risks shipping the exact failure mode (wrong exhibits included) the demo is meant to prevent.

## MVP Definition

### Launch With (v1)

- [ ] Exhibit Workspace (identity, status) — root entity, nothing else works without it
- [ ] Status tracking (full admission lifecycle) — the spine of every other feature
- [ ] Objection/ruling log — required for discrepancy detection and assistant answers
- [ ] Custody tracking — required for discrepancy detection and a named demo question ("who has custody of Exhibit 7")
- [ ] NL Assistant with citations — this is the core value prop per PROJECT.md; "if this fails, nothing else matters"
- [ ] Jury package + discrepancy detection — the other named demo scenario (judge asks "is Exhibit 14 in the jury package")

### Add After Validation (v1.x)

- [ ] Proactive alerts (assistant flags discrepancies unprompted, not just on query) — trigger: validated that reactive Q&A works first
- [ ] Multi-case / cross-trial history in assistant answers — trigger: single-trial demo validated

### Future Consideration (v2+)

- [ ] Real CMS/evidence-locker integrations — defer: explicitly out of scope, demo uses seed data
- [ ] Voice input in courtroom — defer: adds hardware/UX risk with no validation yet that text assistant works
- [ ] Mobile-native apps — defer: explicitly out of scope per PROJECT.md

## Sources

- litsoftware.com (TrialPad/LIT Suite) — trial presentation feature set, MEDIUM confidence (vendor site, cross-checked against product structure)
- exhibitview.net — trial presentation + PDF/Bates/OCR feature set, MEDIUM confidence (vendor site)
- Domain knowledge: standard courtroom exhibit procedure (marked/offered/admitted/excluded) and DEMS chain-of-custody conventions — MEDIUM confidence (no single authoritative source fetched; consistent across legal-procedure references)
- PROJECT.md — source of truth for in-scope/out-of-scope boundary

---
*Feature research for: Courtroom exhibit tracking / trial operational-awareness assistant*
*Researched: 2026-10-06*
