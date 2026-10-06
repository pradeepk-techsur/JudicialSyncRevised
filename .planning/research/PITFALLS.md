# Pitfalls Research

**Domain:** Courtroom exhibit tracking + conversational legal assistant (demo)
**Researched:** 2026-10-06
**Confidence:** MEDIUM-HIGH (chain-of-custody doctrine and AI-hallucination-in-court patterns are well-documented; demo-specific UX pitfalls are inferred from domain structure)

## Critical Pitfalls

### Pitfall: Status as a mutable field instead of an append-only event log

**What goes wrong:** Exhibit status (marked/offered/objected/admitted/excluded/withdrawn) is modeled as a single overwritable field. The system can show *current* state but cannot answer "what happened to Exhibit 14" or reconstruct the sequence that led to admission — exactly the question the demo's signature use case requires.

**Why it happens:** A single status column is the fastest thing to build and looks correct in a demo walkthrough that only checks current state, not history.

**How to avoid:** Model every status change, objection, and ruling as a timestamped event linked to the exhibit. Derive "current status" as a projection over the event log, never store it as ground truth.

**Warning signs:** Exhibit Detail View has no chronological timeline; "explain what happened" queries can't be answered without re-deriving from scattered tables.

**Phase to address:** Data-model/foundation phase, before any status-display UI is built.

---

### Pitfall: Custody modeled as "current custodian" only, no chain

**What goes wrong:** The system stores who has an exhibit *now* but not the transfer history. Legally, chain of custody is defined by unbroken, signed, timestamped transfers between named custodians (Wikipedia/Fed. R. Evid. 901) — a single current-pointer field cannot answer "who has had custody since admission" and silently tolerates gaps that would make real evidence inadmissible.

**Why it happens:** Current-custodian is the natural first implementation and satisfies the "who has custody of Exhibit 7" query in isolation.

**How to avoid:** Store custody as an ordered sequence of transfer records (from, to, timestamp, reason), each immutable once written. Current custodian is the last record, never the schema.

**Warning signs:** No way to list prior custodians; seed data has no custody transfers, only a final holder.

**Phase to address:** Same foundation phase as status modeling — both are instances of the same event-sourcing requirement.

---

### Pitfall: Assistant answers are generated, not retrieved-and-cited

**What goes wrong:** The assistant produces fluent, plausible-sounding answers without grounding each claim in a specific exhibit/event record. In front of a judge, any unverifiable or fabricated detail (wrong timestamp, invented ruling, exhibit that doesn't exist) destroys credibility instantly — this is the exact failure pattern documented across 2,100+ real court filings where AI-generated fabricated or misquoted citations triggered sanctions (damiencharlotin.com AI Hallucination Cases Database, updated through Oct 2026).

**Why it happens:** Free-form LLM generation over a prompt-stuffed context is faster to build than a retrieval layer that forces every factual claim to resolve to a record ID.

**How to avoid:** Require retrieval-then-cite: the assistant may only state facts it can point to a specific event/exhibit record for, and every answer surfaces that record (clickable or inline) as its citation. If no matching record exists, the assistant must say so rather than infer.

**Warning signs:** Assistant answers that can't be traced to a visible source record; different phrasing of the same question returns inconsistent facts; no "I don't have that information" path exists.

**Phase to address:** Assistant/query phase — must be built on top of the event-sourced data model above, not before it.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Flat status enum instead of event log | Faster initial CRUD UI | Can't answer history/jury-discrepancy questions | Never — core to the demo's value prop |
| Prompt-stuff all seed data into LLM context, no retrieval layer | Faster assistant MVP | Hallucination risk, no citations, breaks under judge scrutiny | Only for earliest internal spike, not demo-facing build |
| Hardcode jury package as "all admitted exhibits" | Quick first version of the screen | Misses discrepancy detection (the actual differentiator) | Never for the demo scenario itself |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|-------------------|
| LLM API for assistant | High temperature / no caching → same question gets different answers live | Low/zero temperature, deterministic retrieval, cache identical queries during a session |
| Seed data loader | Seed data is "clean" (no unresolved objections, no custody gaps) | Seed data must deliberately include edge cases the demo needs to showcase discrepancy detection |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Recomputing jury-package discrepancies on every view, scanning all events | Fine at demo scale (dozens–hundreds of exhibits) | Index by exhibit, precompute on write | Irrelevant for a single-case demo; don't over-engineer |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Assistant queries the full data store without role scoping | Attorney-view assistant could surface sealed/sidebar exhibit info to the wrong role | Scope assistant retrieval by the same role filter as the UI, even in a demo |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|------------------|
| Assistant hedges with lawyer-like caveats ("it appears that...") | Undermines the "immediate, trustworthy" positioning | Confident, concise answer + visible citation; hedge only when data is genuinely missing |
| Screens expose raw status enums/IDs | Reinforces "new system to learn" instead of "assistant" | Surface natural-language status and plain descriptions, keep IDs secondary |

## "Looks Done But Isn't" Checklist

- [ ] **Exhibit status display:** Shows current state but often has no transition history — verify "explain what happened to Exhibit X" is answerable end-to-end.
- [ ] **Objection/ruling tracking:** Often stores one ruling per exhibit instead of per-objection — verify multiple objections on one exhibit each resolve independently.
- [ ] **Custody tracking:** Often shows only current holder — verify full custodian chain with timestamps is queryable.
- [ ] **Jury package generation:** Often lists admitted exhibits without checking for discrepancies — verify it actively flags exhibits that shouldn't be included.
- [ ] **Assistant answers:** Often fluent but uncited — verify every factual claim links back to a specific record.
- [ ] **Seed data:** Often too clean — verify it contains at least one unresolved objection, one custody gap, and one jury-package discrepancy to demo.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|-----------------|
| Flat status field shipped | MEDIUM | Backfill an event log from current state + manually reconstruct plausible history for seed data; migrate UI to read from events |
| Assistant ungrounded | MEDIUM-HIGH | Insert retrieval layer between data and LLM; retrofit citations; re-test consistency |
| Custody as current-pointer only | HIGH if many screens depend on it | Introduce transfer-history table; re-seed custody chains; audit all "who has custody" call sites |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|--------------|
| Flat status / no history | Data-model foundation phase | Exhibit Detail View renders a full chronological timeline from seed data |
| Custody current-pointer only | Data-model foundation phase | "Who has had custody since admission" query returns full chain |
| Ungrounded assistant answers | Assistant/query phase | Every assistant answer includes a visible, correct citation; spot-check against known seed facts |

## Sources

- Wikipedia, "Chain of custody" (HIGH — codifies legal requirement for unbroken, documented, timestamped custodian transfers; basis for custody-chain pitfall)
- Damien Charlotin, AI Hallucination Cases Database, damiencharlotin.com/hallucinations (HIGH — 2,149+ tracked court filings with fabricated/misquoted AI citations and sanctions, last updated Oct 2026; basis for assistant-grounding pitfall)
- Domain inference from project requirements (MEDIUM — jury-package discrepancy detection, event-sourcing need, demo-data realism pitfalls derived from PROJECT.md requirements, not independently sourced)

---
*Pitfalls research for: courtroom exhibit tracking + conversational assistant demo*
*Researched: 2026-10-06*
