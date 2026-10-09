# Functional Requirements Document: JudicialSync

**Project Acronym:** JudicialSync
**Document Type:** FRD (Functional Requirements Document)
**Version:** 1.2
**Status:** Draft
**Generated:** 2026-10-06
**Last Updated:** 2026-10-09 (added F16–F23 for Phase 7.1, inserted after Phase 7)
**Source PRD:** `PRD-JudicialSync.md`

---

## Scope

This FRD translates JudicialSync's 24 PRD features (F0–F23) into implementation-ready specifications: data model, process flows, inputs/outputs, validation rules, error states, API surface, and schema surface. It is grounded in one non-negotiable architectural constraint established by project research (`SUMMARY.md`, `ARCHITECTURE.md`, `PITFALLS.md`): **status, objections/rulings, and custody are modeled exclusively as an append-only event ledger**, never as mutable "current state" fields. Every UI screen and every Pivota Assistant answer reads through one shared service layer over this ledger and its derived current-state projections — there is no parallel retrieval path, which is what makes assistant citations trustworthy.

F12–F15 (added for Phase 7: "Fix admission integrity and UI usability issues") extend this foundation with a hard pre-write admission gate (F12), a structural sealed/ex-parte exclusion from jury packages (F13), a UI-visibility-only requirement over F6's existing acknowledgment audit trail (F14), and a cluster of client-rendering usability fixes with no backend contract changes (F15). None of F12–F15 alters the behavior specified for F0–F11 in this document; they add new validation points, one new ledger event type, and new fields strictly additive to the schema described in `Y0-schema.md`.

F16–F23 (added for Phase 7.1, an urgent INSERTED phase between Phase 7 and the next planned milestone phase: "Exhibit classification, state-machine hardening, custody handoff, server-side RBAC, and jury-package versioning/export") harden the admission/custody state machine and formally reverse two recorded v1 scope exclusions. F16 replaces the `isSealed` boolean's governing role with a formal three-value `ExhibitClassification` taxonomy. F17 is a documentation/test-only hardening of F12's existing admission gate — it introduces no new runtime mechanism. F18 moves the custodian requirement to intake (the `MARKED` transition). F19 converts unilateral custody transfer into a two-phase propose/confirm ledger model. F20 extends server-side role enforcement (already applied to rulings, jury finalization, and discrepancy acknowledgment) to every write action in the system via a single permission matrix, formally superseding the PRD's prior "production-grade auth hardening out of scope" note for *authorization* (authentication remains out of scope). F21 adds a judge-facing pending-ruling queue, reusing F2's existing service function with one additive read-time join. F22 reverses the single-case v1 scope assumption, adding a case selector with no schema change (case-scoping foreign keys already existed). F23 adds immutable version numbering and real PDF export to jury packages, introducing the project's first new runtime dependency since the original tech-stack lock-in. None of F16–F23 alters the behavior specified for F0–F15 in this document; all changes are additive to the schema, API surface, and error catalog described in `Y0`–`Y3`.

This document is written for developers implementing JudicialSync and assumes familiarity with the PRD's feature priorities and the project's demo-first context (seeded data, no production auth, single-case scope as of Phase 7 — multi-case as of Phase 7.1's F22).

---

## How to Read This Document

- **Feature chunks (`F00`–`F23`)** map 1:1 to PRD features F0–F23. Each chunk is self-contained (description, process, inputs/outputs, validation, errors) but defers full DDL to `Y0-schema.md` and full endpoint contracts to `Y1-api.md`. F12–F15 (Phase 7) and F16–F23 (Phase 7.1) additionally cross-reference the earlier chunks whose behavior they extend or gate, rather than restating or altering that behavior in place.
- **Cross-feature chunks (`Y0`–`Y3`)** consolidate schema, API, error catalog, and integrations so there is one canonical definition of each, referenced (not duplicated) by every feature chunk.
- **IDs:** Feature IDs (`F0`–`F23`) match the PRD exactly. Database entity names use `PascalCase` (Prisma model convention). API paths use `kebab-case`. Event types use `SCREAMING_SNAKE_CASE`.
- **Cross-references** appear as `see F03 §Process step 2` or `see Y0-schema.md §Event Ledger`.
- **"Derived"** means a value is computed/projected from the event ledger at write-time or read-time and must never be treated as independently editable ground truth.

---

## Cross-Cutting Terminology

These terms recur across multiple feature chunks and are defined once here to avoid drift.

- **Event Ledger (`ExhibitEvent`):** The single append-only table recording every status change, objection, ruling, and custody transfer for every exhibit. Rows are immutable once written — never updated, never deleted. This is the system's ground truth (see `Y0-schema.md` §Event Ledger).
- **Current-State Projection:** A denormalized, derived table (`ExhibitCurrentState`, `ObjectionCurrentState`, `CustodyCurrentState`, `DiscrepancyFlag`) recomputed from the event ledger on every relevant write. Projections exist purely for fast reads; if a projection table were dropped and rebuilt by replaying the ledger in order, the result must be identical. UI screens and assistant tools read projections for "current" questions and the ledger directly for "history" questions.
- **Service Layer:** The single set of typed TypeScript functions (e.g., `getExhibits`, `getCustodian`, `getUnresolvedObjections`, `recordEvent`, `computeJuryPackage`) that is the *sole* entry point for both UI screens (via API routes) and the Pivota Assistant (via tool wrappers). No screen and no assistant tool queries Prisma directly — all access funnels through this layer so that a UI screen and an assistant answer can never diverge.
- **Objection Thread:** The logical lifecycle of a single objection, beginning with an `OBJECTION_RAISED` event and optionally closed by a `RULING_RECORDED` event referencing the same `objection_id`. A single exhibit may have multiple independent, concurrently-open objection threads.
- **Discrepancy:** A system-detected mismatch between what the current-state projection shows and what it logically should show (e.g., admitted exhibit with no custodian of record). Discrepancies are computed by rule, not manually flagged, and persist as `DiscrepancyFlag` rows until resolved or explicitly acknowledged (acknowledgment itself is a ledger event — see F6).
- **Citation:** A reference embedded in every Pivota Assistant factual claim, pointing to a specific `ExhibitEvent.id` (or current-state projection row id) and its timestamp. An answer with no citation is only valid when it is an explicit "I don't have that information" response.
- **Role:** One of `JUDGE`, `CHAMBERS_STAFF`, `DEPUTY`, `CLERK`, `ATTORNEY`, `ADMIN` — see §Role-Based Visibility below. Assigned per seeded `User` row; the demo uses a role switcher (no production auth) per PROJECT.md scope.
- **Sealed Exhibit:** An exhibit flagged `is_sealed = true` at creation (e.g., sidebar/in-camera material). Sealed exhibits are excluded from both UI queries and assistant tool results for roles outside the visibility set defined below, with no indication to the excluded role that a sealed record even exists (not just redacted content). **As of Phase 7.1 (F16):** `isSealed` is retained as a field but is now a write-once mirror derived from the new `ExhibitClassification` taxonomy at exhibit-creation time (`isSealed = classification !== 'TRIAL'`) — it is never independently set after this phase. The role-visibility gate below continues to read `isSealed` and is therefore unaffected in its outputs; see `F16-exhibit-classification-taxonomy.md` for the full rationale.
- **Tool-Calling (Assistant):** The Pivota Assistant answers exclusively via LLM tool-calls that are thin 1:1 wrappers around service-layer functions (see F7, `Y1-api.md` §Assistant). No retrieval-augmented generation, no embeddings, no vector search — the data is small, structured, and exact-citation-critical.
- **Exhibit Classification (`ExhibitClassification`):** The three-value intake-time taxonomy (`TRIAL`, `CHAMBERS_EX_PARTE`, `SEALED`) introduced by Phase 7.1's F16, superseding the `isSealed` boolean as the authoritative sensitivity classification. Immutable after intake in this version — no reclassification flow is specified. See `F16-exhibit-classification-taxonomy.md`.
- **Custody Proposal / Confirmation:** The two-phase custody handoff model introduced by Phase 7.1's F19 — a `CUSTODY_TRANSFER_PROPOSED` event naming an intended receiver, followed by that same receiver's own `CUSTODY_TRANSFER_CONFIRMED` event. `CustodyCurrentState.currentCustodianUserId` changes only on confirmation, never on proposal. See `F19-custody-handoff-confirmation.md`.
- **Permission Matrix:** The single, explicit table (Phase 7.1's F20) governing which `Role` may perform which write action system-wide, enforced server-side by resolving the acting user's role from the `User.role` DB column via `actorUserId` — never a client-supplied role claim. See `F20-server-side-role-enforcement-matrix.md`.

### Role-Based Visibility

| Role | Sees Sealed Exhibits? | Notes |
|---|---|---|
| `JUDGE` | Yes | Full visibility, including chambers-only annotations |
| `CHAMBERS_STAFF` | Yes | Mirrors judge visibility |
| `ADMIN` | Yes | Compliance/audit review requires full visibility |
| `DEPUTY` | No | Operational role; sealed material is chambers-restricted |
| `CLERK` | No | Maintains official record but not sealed/in-camera content |
| `ATTORNEY` | No | Unless individually granted access via a future ACL (out of scope for demo — default deny) |

This table is the single source of truth for role scoping and is applied identically by every API route and every assistant tool (see F7 §Validation, `Y2-errors.md` §Authorization).

---

## Master Table of Contents

| Chunk | Contents |
|---|---|
| `00-header.md` | This file — scope, conventions, shared terminology |
| `F00-exhibit-workspace-data-model.md` | Exhibit identity + event ledger foundation |
| `F01-exhibit-status-display.md` | Admission-lifecycle status projection + display |
| `F02-objection-ruling-tracking.md` | Objection logging + ruling recording |
| `F03-custody-tracking.md` | Chain-of-custody transfer ledger + current custodian |
| `F04-exhibit-search.md` | Multi-criteria exhibit search/filter |
| `F05-jury-ready-exhibit-list-generation.md` | Jury-eligible exhibit computation, gated |
| `F06-discrepancy-identification.md` | Automated cross-domain discrepancy rules |
| `F07-pivota-assistant.md` | Tool-calling NL assistant with citations |
| `F08-trial-command-center-screen.md` | Ambient live trial-activity view |
| `F09-case-workspace-screen.md` | Case-level exhibit browsing screen |
| `F10-exhibit-detail-view-screen.md` | Single-exhibit chronological timeline screen |
| `F11-jury-package-workspace-screen.md` | Curated jury package handoff screen |
| `F12-admission-integrity-gating.md` | Pre-write admission gate (unresolved objection / no custodian) |
| `F13-jury-package-ex-parte-sealed-exclusion.md` | Hard structural exclusion of sealed/ex-parte exhibits from jury packages |
| `F14-discrepancy-acknowledgment-transparency.md` | UI visibility of acknowledgment role gating + audit trail (no new data) |
| `F15-courtroom-usability-fixes.md` | Case Workspace/assistant/header/activity-feed client-rendering fixes |
| `F16-exhibit-classification-taxonomy.md` | Intake-time TRIAL/CHAMBERS_EX_PARTE/SEALED taxonomy, supersedes `isSealed` boolean |
| `F17-objection-admission-state-machine-hardening.md` | F12 hardening/clarification — no new runtime mechanism |
| `F18-custodian-required-at-intake.md` | Custodian required atomically at the MARKED transition |
| `F19-custody-handoff-confirmation.md` | Two-phase custody propose/confirm ledger model |
| `F20-server-side-role-enforcement-matrix.md` | Full server-side permission matrix for every write action |
| `F21-pending-ruling-queue.md` | Judge-facing oldest-first unresolved-objection queue |
| `F22-multi-case-support-case-selector.md` | Case list/selector, enforced case-scoped isolation |
| `F23-versioned-jury-packages-pdf-export.md` | Immutable version numbering + real PDF export for jury packages |
| `Y0-schema.md` | Full database DDL (Prisma schema) |
| `Y1-api.md` | Consolidated REST API endpoint catalog |
| `Y2-errors.md` | Cross-feature error catalog |
| `Y3-integrations.md` | External integration points |

---
