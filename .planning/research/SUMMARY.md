# Project Research Summary

**Project:** JudicialSync-Demo
**Domain:** Courtroom exhibit tracking + natural-language operational-awareness assistant
**Researched:** 2026-10-06
**Confidence:** MEDIUM-HIGH

## Executive Summary

JudicialSync-Demo is a structured-data "copilot" application, not a document-search chatbot and not a trial-presentation tool. The closest real-world analogs — DEMS (digital evidence management, chain-of-custody) and trial presentation software (TrialPad/ExhibitView) — each solve half the problem but neither offers conversational, cross-domain operational awareness over exhibit status + custody + rulings simultaneously. That gap is the product's actual value proposition, and the research is unanimous on how experts build this shape of system: one typed service layer over a relational, **event-sourced** data model, with both the dashboards and the LLM assistant calling the exact same functions (tool-calling, not RAG/embeddings — the data is small, structured, and exact-citation-critical, so vector search would introduce approximation where none is wanted).

The recommended approach is Next.js 16 + TypeScript + Prisma/Postgres (Neon) + Vercel AI SDK — the current, well-documented 2026 toolkit for "chat over app data via tool-calling." The one domain-specific decision that outweighs any stack choice: status, objections/rulings, and custody must each be modeled as an **append-only event ledger**, not a mutable "current state" field. Every differentiator (discrepancy detection, jury package validation, "what happened to Exhibit 14") depends on this, and retrofitting it after a flat-field implementation ships is the costliest mistake across all four research tracks.

The dominant risk is not technical complexity — architecture confidence is HIGH, these are well-trodden patterns — it's **trust-destroying failure in front of a legal audience**: an assistant generating fluent but ungrounded answers (analogous to 2,100+ real court sanctions over fabricated AI citations), or a jury package quietly including a discrepant exhibit. Both are prevented the same way: route every assistant claim and generated list through the same query layer the UI renders from, with no parallel "trust me" path.

## Key Findings

### Recommended Stack

Next.js 16 + TypeScript gives one codebase for all 4 screens plus API routes. Prisma + Postgres (Neon) models the relational exhibit→objection→ruling→custody graph with type-safe queries the assistant's tools call directly. Vercel AI SDK (`ai` + `@ai-sdk/react` + `@ai-sdk/anthropic`) is the current standard for `useChat` + `streamText` + typed `tool()` — purpose-built for this copilot shape. **Explicitly avoid:** vector DBs/embeddings (data is structured, not a corpus), full OAuth (out of scope — use seeded users + role switcher), and LangChain-style frameworks (unnecessary abstraction for a fixed, small tool set).

**Core technologies:**
- Next.js 16 + TypeScript — full-stack framework, fast dev loop for 4-screen demo
- Prisma + Neon Postgres — type-safe ORM over relational exhibit/custody/ruling data
- Vercel AI SDK (`ai`, `@ai-sdk/react`, `@ai-sdk/anthropic`) — tool-calling + streaming chat, the 2026 standard for this pattern
- zod — validates tool-call args and API payloads before they hit Prisma
- shadcn/ui + Tailwind, @tanstack/react-query, zustand — UI/state layer, standard choices at this scale

### Expected Features

PROJECT.md's requirement list already covers table stakes; research adds the competitive framing: nobody in either neighboring category (DEMS or trial-presentation software) offers conversational, cross-domain operational awareness — that's the product's real differentiator.

**Must have (table stakes):**
- Exhibit identity record + admission-lifecycle status (marked→offered→objected→admitted/excluded/withdrawn)
- Objection/ruling log tied to exhibit, timestamped
- Custody tracking (current + historical)
- Search/filter by ID, status, witness, date

**Should have (competitive differentiators):**
- Conversational NL assistant with cited answers — no competitor in either lineage offers this
- Automated discrepancy detection (admitted-but-no-custodian, unresolved-objection-in-jury-package) — the "operational awareness" thesis made concrete
- Live Trial Command Center (ambient, not configured) + role-agnostic single source of truth across judge/deputy/clerk/attorney

**Defer (v2+):**
- Proactive (unprompted) alerts — validate reactive Q&A first
- Real CMS/evidence-locker integrations, voice input, mobile apps — explicitly out of scope per PROJECT.md
- Exhibit presentation/annotation display and deposition video sync — scope trap; these belong to TrialPad/ExhibitView-class tools, not this assistant

### Architecture Approach

Single service layer, one set of typed query/command functions (`getExhibits`, `getCustodian`, `getUnresolvedObjections`, `recordEvent`, etc.) that both UI screens and the assistant's tool wrappers call — no parallel retrieval path. This is what makes citations trustworthy: the assistant cannot say something the dashboard doesn't also show. Underneath, data splits into an append-only **event ledger** (every status/objection/ruling/custody change, immutable, timestamped) and a **current-state projection** derived from it for fast reads.

**Major components:**
1. **Data layer** — event ledger (ground truth, append-only) + current-state table (derived projection for fast reads)
2. **Service layer** — one typed function per query/command shape; sole entry point for both UI and assistant
3. **Assistant layer** — thin 1:1 tool wrappers around service functions + system prompt enforcing cite-or-say-"I don't know"
4. **UI layer** — 4 screens (Command Center, Case Workspace, Exhibit Detail, Jury Package), rendering only, no business logic

### Critical Pitfalls

1. **Status/custody as mutable fields instead of an event log** — breaks every history question and is the costliest retrofit identified (HIGH recovery cost once screens depend on it). Fix at the data-model foundation phase, before any status UI.
2. **Assistant generates answers instead of retrieving-and-citing** — analogous to real court sanctions over fabricated AI citations (2,100+ documented cases). Every factual claim must resolve to a record ID; "I don't have that information" must be valid.
3. **Jury package generation without discrepancy checking** — ships the exact failure mode the demo exists to prevent. Discrepancy detection must gate generation, not follow it.
4. **Seed data too clean** — if seed data has no unresolved objections or custody gaps, discrepancy detection can never be demonstrated.
5. **No role scoping on assistant queries** — assistant could surface sealed/sidebar info to the wrong role; scope retrieval identically to UI role filters.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Data Foundation (Event-Sourced Model)
**Rationale:** Every other feature — UI, assistant, discrepancy detection — reads through this model. Getting event-sourcing right here is the single highest-leverage decision in the project; retrofitting it later is the costliest pitfall identified.
**Delivers:** Prisma schema (exhibits, event ledger, current-state projections), deterministic seed data with deliberate edge cases (unresolved objection, custody gap, jury-package discrepancy), service layer skeleton.
**Addresses:** Exhibit Workspace, Status tracking, Objection/ruling log, Custody tracking (all FEATURES.md table stakes)
**Avoids:** Mutable-status-field pitfall, custody-current-pointer-only pitfall, seed-data-too-clean pitfall

### Phase 2: Core Screens (Dashboards)
**Rationale:** Dashboards validate the service layer and data model visually before the assistant is layered on top — UI and assistant must share one layer, so building UI first surfaces service-layer gaps early.
**Delivers:** Case Workspace, Exhibit Detail View (with full chronological timeline), search/filter.
**Uses:** Next.js 16 App Router, Prisma, shadcn/ui, @tanstack/react-query
**Implements:** Service layer, current-state projection pattern

### Phase 3: Jury Package + Discrepancy Detection
**Rationale:** This is the other named demo scenario and depends on all three data domains (status + rulings + custody) existing — correctly a late-phase feature despite being a core differentiator.
**Delivers:** Jury Package Workspace screen, discrepancy detection logic gating package generation.
**Addresses:** Jury-ready exhibit list generation, Discrepancy identification (FEATURES.md differentiators)
**Avoids:** Jury-package-without-discrepancy-check pitfall

### Phase 4: NL Assistant (Pivota Assistant)
**Rationale:** Requires the full data model and service layer to already exist — there's nothing to cite until status/custody/objection records are real. This is the core value prop ("if this fails, nothing else matters") but is sequenced last because it's a thin layer over everything prior.
**Delivers:** Tool-calling assistant (AI SDK `tool()` + `streamText`), citation-enforcing system prompt, chat UI panel.
**Uses:** Vercel AI SDK, Anthropic provider, zod-validated tool schemas
**Implements:** Tool-calling-over-typed-queries pattern (not RAG)
**Avoids:** Ungrounded-answer pitfall, role-scoping gap

### Phase 5: Trial Command Center + Live Sync Polish
**Rationale:** Ambient, whole-trial-glance view is the least foundational screen — it aggregates state that only becomes meaningful once status/objection data and the assistant both exist, and live-update polish (polling cadence) is best tuned last against a working system.
**Delivers:** Command Center screen, polling-based live updates across screens.
**Addresses:** Trial Command Center (FEATURES.md differentiator)

### Phase Ordering Rationale

- Data/event-sourcing foundation must precede everything — it's the dependency root for UI, discrepancy detection, and the assistant alike (confirmed independently by FEATURES.md's dependency graph and PITFALLS.md's recovery-cost analysis).
- Discrepancy detection and jury package are correctly sequenced after basic screens because they cross-check all three data domains (status, rulings, custody) at once.
- The assistant is deliberately last among functional phases despite being the headline feature, because it is architected as a thin query layer over the service layer — building it earlier would mean building against a moving/incomplete data model.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4 (NL Assistant):** Citation-enforcement UX and tool-set design (which exact tools, how many) aren't fully specified yet — AI SDK patterns are well-documented but the specific tool schema for this domain needs design work during planning.
- **Phase 3 (Discrepancy Detection):** The exact rule set for "what counts as a discrepancy" beyond the two named examples (admitted-no-custodian, unresolved-objection-in-jury-package) needs definition during planning, not deferred to implementation.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Data Foundation):** Event-sourcing for audit-trail domains is a well-established pattern (MEDIUM-confidence general consensus, but architecturally unambiguous here).
- **Phase 2 (Core Screens):** Standard Next.js/Prisma/shadcn dashboard patterns, HIGH confidence, no novel decisions required.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions verified against npm registry + official Next.js/AI SDK docs, Oct 2026 |
| Features | MEDIUM | No direct competitor for the conversational-assistant category; benchmarked against adjacent vendor sites (TrialPad, ExhibitView) |
| Architecture | HIGH | Verified against Anthropic's agent architecture guidance and AI SDK tool-calling docs; no exotic domain-specific pattern needed |
| Pitfalls | MEDIUM-HIGH | Chain-of-custody doctrine and AI-hallucination-in-court patterns are well-documented (HIGH); demo-specific UX pitfalls are inferred from domain structure (MEDIUM) |

**Overall confidence:** HIGH

### Gaps to Address

- No direct competitor exists for "conversational assistant over courtroom exhibit status" — feature prioritization leans on adjacent-category inference (DEMS + presentation software); validate the differentiator list against stakeholder expectations early in planning.
- Live multi-screen sync mechanism (polling vs. SSE/WebSocket) is explicitly flagged as a phase-specific decision in ARCHITECTURE.md, not resolved here — revisit if the demo script requires sub-second visible sync between two screens side-by-side.
- Exact discrepancy-detection rule set beyond the two named PROJECT.md examples needs definition during Phase 3 planning.

## Sources

### Primary (HIGH confidence)
- nextjs.org/blog — Next.js 16.4.0 current stable, React 19.3 bundled (Oct 2026)
- ai-sdk.dev/docs — AI SDK Core/UI tool-calling + streaming architecture
- npm registry (registry.npmjs.org) — verified dist-tags for next, ai, @ai-sdk/*, prisma, zod, shadcn, tailwindcss, zustand, @tanstack/react-query
- Anthropic, "Building Effective Agents" — augmented-LLM/tool-use pattern
- Wikipedia, "Chain of custody" — unbroken, documented, timestamped custodian transfer requirement
- Damien Charlotin, AI Hallucination Cases Database (damiencharlotin.com/hallucinations) — 2,149+ tracked court filings with fabricated/misquoted AI citations, updated Oct 2026

### Secondary (MEDIUM confidence)
- litsoftware.com (TrialPad/LIT Suite), exhibitview.net — trial presentation feature sets, vendor sites cross-checked against product structure
- Event sourcing for audit-trail domains — general architecture consensus, no domain-specific source

### Tertiary (LOW confidence)
- None flagged — all findings traced to at least MEDIUM-confidence sources or PROJECT.md itself

---
*Research completed: 2026-10-06*
*Ready for roadmap: yes*
