# Phase 8: UI Redesign and Write-Action Coverage - Context

**Gathered:** 2026-10-09 (chat UI review — 5 reference screenshots + 10-item findings list, discussed and scoped in `/pivota_spec-plan-phase 8`)
**Status:** Ready for planning

<domain>
## Phase Boundary

Dark-dashboard visual redesign of **Command Center (F8)**, **Case Workspace (F9)**, **Exhibit Detail (F10)**, and **Jury Package Workspace (F11)**, plus the first-ever UI for two write actions that have existed as backend-only services since Phase 1 (**F24**: `recordRuling`, `recordCustodyTransfer`).

**User-supplied reference screenshots** (5, attached in chat 2026-10-09) are the literal pixel/layout contract for this phase — see `<specifics>` below for the exact structure of each. Where the existing `UX-Mockup/` docs' ASCII wireframes diverge from the screenshots (e.g. the written docs' header includes a Case Selector + unlabeled discrepancy-count badge; the screenshots' header does not), **the screenshots win** — they are the user's explicit, current design authority for this phase, superseding the older wireframe text.

**User-supplied 10-item findings list**, scoped by explicit decision to exactly: **items 2, 3, 4 + the full F08/F09/F10/F11/F24 build.** The other 6 items (1, 5, 6, 7, 8, 9, 10) were verified against `STATE.md` and the screenshots themselves to already be shipped by Phase 7 (`07-04` through `07-07`) — see the full item-by-item disposition table below. They are **not** back in scope; do not re-touch the files that fixed them unless a plan's own work legitimately requires it.

### Item disposition (locked)

| # | Item | Disposition |
|---|---|---|
| 1 | Ex parte material in jury package (S-1) | **Already shipped** (`07-07`, F13) — the "Remove from package" remediation exists. Out of scope. Phase 8 reuses it as-is for the attention feed's `CRITICAL` tier link-through (F08 §Process step 4). |
| 2 | Admission with open objection (P-3-shaped scenario) | **In scope.** New seeded fixture (not P-3 itself — see Decisions) demonstrates the legacy/pre-gate `HIGH` attention-feed tier + F24 "Record ruling" remediation. |
| 3 | Admission without custody (P-2-shaped scenario) | **In scope.** New seeded fixture (not P-2 itself) demonstrates the legacy/pre-gate `MEDIUM` attention-feed tier + F24 "Assign custodian" remediation. |
| 4 | P-1 (Objected, no custodian) has no path to fix | **In scope, no seed change needed.** P-1's current seeded state (OBJECTED, zero custody events) already matches the finding. Resolved entirely by F10's Chain of Custody card ("No custodian of record" + an assign action, rendered **regardless of exhibit status** — F10 §Process step 5) and F24's header-level custody action. No new attention-feed tier is added for this case; the universal Exhibit Detail custody card is the fix. |
| 5 | Acknowledge semantics/audit not visible | **Already shipped** (`07-06`, F14). Out of scope. |
| 6 | Case Workspace rows not clickable | **Already shipped** (`07-04`, F15). Out of scope. |
| 7 | Assistant prompts reference "Exhibit 14"/"Exhibit 7" | **Already shipped** (`07-04`). Out of scope. |
| 8 | Unlabeled "42" header badge | **Already shipped** (`07-05`, F15 — labeled, omitted-at-zero). Out of scope. The reference screenshots' header doesn't even show this badge — see header note below. |
| 9 | Activity feed time-only, ambiguous day boundaries | **Already shipped** (`07-05`). Out of scope. Phase 8 layers filter pills + date-group headers on top of the already-fixed formatting (F08 §Process, additive). |
| 10 | Raw state transitions with no exhibit label | **Already shipped** (`07-05`). Out of scope. |

### Phase 7.1 — explicitly skipped

Phase 8's own `ROADMAP.md` entry says "Depends on: Phase 7.1 ... this phase should not plan ahead of it." **User has explicitly overridden this**: Phase 7.1 (F16–F23: exhibit classification, two-phase custody handoff, server-side RBAC matrix, multi-case support, pending-ruling queue, jury-package versioning/PDF export) stays an unplanned, unbuilt stub. Phase 8 is planned and built against the **current, Phase-7-complete codebase only.** See Decisions below for the concrete simplifications this forces on F24's custody-transfer flow and F20's role-enforcement surface.

**Do not build any of:** `ExhibitClassification` enum/column, `CUSTODY_TRANSFER_PROPOSED/CONFIRMED/CANCELLED` event types or `pendingTransfer*` columns, a generic `assertRole` helper or system-wide permission matrix, `GET /api/cases` / Case Selector UI, the Pending-Ruling Queue screen, `JuryPackage.version` / PDF export. If a plan finds it is about to touch any of these, stop and flag it — it has drifted into 7.1's scope.

**Explicitly absent by design, still:** every ambient Command Center panel except the attention feed's two inline actions remains strictly read-only (Phase 5's locked criterion, deliberately superseded only for "Record ruling" / "Transfer custody" — F8 §Design decision supersedes a prior constraint).

</domain>

<decisions>
## Implementation Decisions

### Seed data — new fixtures, P-1/P-2/P-3 untouched (locked, confirmed with user)
The screenshots show P-2 and P-3 as `✓ Admitted` with an open issue (no custodian / unresolved objection) — the exact "legacy, pre-admission-gate" scenario F08's attention feed is designed to surface. But Phase 7's `07-02` plan deliberately rewrote seed data so **P-2 stops at `OFFERED`** and **P-3 stops at `OBJECTED`**, specifically because the live admission gate (F12) makes "admitted with an open issue" impossible to produce honestly through the service layer, and seed data must never represent a state the live system could not itself produce (`T-01-17`). `forceAdmitBypassingGate` exists for exactly this shape of fixture but is grep-enforced, security-audited (`T-07-05`) to live **only in `*.test.ts` files** — never in `seed.ts`.

**Resolution:** add **two new** seeded exhibits (suggested labels `P-6`, `P-7` — continuing the existing numbering; planner/executor may rename) via a **new, narrowly-scoped, seed-only legacy-admit helper**, clearly distinguished from the test-only `forceAdmitBypassingGate`:
- A seed-local function (e.g. `legacyAdmitForDemo` in `src/data/seed.ts`, or a sibling seed-only module) that performs the exact same ledger write + projection upsert + advisory-lock pattern `recordStatusChange` uses for an `ADMITTED` transition, but skips the F12 gate's two precondition reads.
- **Must be grep-auditable as confined to `seed.ts`** — never imported by any route, service consumed by a route, or component. This is a narrative device ("this exhibit predates the admission-gate rollout"), not a live capability — it must not be reachable by any request path, mirroring `T-07-05`'s confinement proof but for the seed file instead of tests.
- **`P-6` — mirrors the P-2 finding:** `MARKED → OFFERED → ADMITTED` (legacy-admit), zero custody transfers ever. Fires `ADMITTED_NO_CUSTODIAN` (F6, existing rule, unchanged) → attention feed `MEDIUM` tier → F24 "Assign custodian" (first-time path) remediates it → disappears from the Blockers list and feed on the next poll once assigned.
- **`P-7` — mirrors the P-3 finding:** `MARKED → OFFERED → OBJECTED` (objection raised, deliberately no ruling, so `UNRESOLVED`) → establish a full custody chain (e.g. Deputy → Clerk, so the custody condition is already clean) → `ADMITTED` (legacy-admit, despite the unresolved objection). Fires `UNRESOLVED_OBJECTION_JURY_ELIGIBLE` (F6, existing rule, unchanged) → attention feed `HIGH` tier → F24 "Record ruling" remediates it.
- `assertSeedIntegrity` (F0a) gains two new required-edge-case assertions for `P-6`/`P-7` (mirroring the existing per-edge-case assertions), each explicitly commented as depending on the seed-only legacy-admit helper, not the live gate.
- This file-confinement claim is exactly the kind of thing the phase's security/gap-closure pass must re-verify independently (grep `legacyAdmitForDemo` or whatever it's named, confirm zero hits outside `seed.ts`) — flag it for the Nyquist/security auditor explicitly in the plan's `<verify>` block.
- **P-1, P-2, P-3 and every test currently asserting their blocked-at-OFFERED/OBJECTED state are untouched.**

### F24 "Transfer custody" — single-phase only, no propose/confirm/cancel (locked — forced by skipping 7.1)
F24's FRD §Process describes a two-phase propose/confirm/cancel flow for any transfer after the first, which is F19 (Phase 7.1) machinery that does not exist. Since Phase 7.1 is skipped:
- **"Transfer custody" / "Assign custodian" is always a single, immediate, unilateral write** via the existing legacy endpoint, `POST /api/exhibits/:id/events/custody` — used identically for first-time assignment (`fromCustodianUserId: null`) **and** for transferring an exhibit that already has a custodian (`fromCustodianUserId: <current>`, validated against `CustodyCurrentState.currentCustodianUserId` exactly as F03 already specifies — reuses the existing `CUSTODY_CHAIN_BROKEN`/`NO_OP_TRANSFER` validation, unchanged).
- **No pending-transfer state, no "Confirm Receipt" surface, no Cancel control.** None of the reference screenshots show a pending-transfer banner — this is consistent with the simplification, not a visual gap to fill.
- Exhibit Detail's Chain of Custody card therefore has exactly two states, not three: a plain custodian name (or "No custodian of record"), with a single "Transfer custody" action — never a pending/in-between state.

### F24 "Transfer custody" / "Assign custodian" — new server-side role gate (locked)
`custody.ts`'s `recordCustodyTransfer` currently has **zero role enforcement** (verified by grep — unlike `objections.ts`'s `recordRuling`, which has enforced `JUDGE`-only since Phase 1). F24 requires the control to be absent-not-disabled per role (`Y0-patterns.md` §Role-Gated Control Visibility), which requires a **real server-side gate**, not just client-side hiding:
- Add a role check to `recordCustodyTransfer` reusing the **existing general-purpose** `RoleNotPermittedError` from `src/lib/errors.ts` (not `objections.ts`'s private ruling-specific subclass) — role resolved from the actual `User.role` DB column, never a client claim, exactly matching the established pattern.
- Allowed roles: `DEPUTY`, `CLERK`, `ADMIN` (matches F20's matrix row 6 for propose, applied here directly to the single-phase endpoint since there is no separate propose/confirm split).
- **This is Phase 8's only new server-side role gate.** Do not build F20's generic `assertRole` helper or extend role-gating to any other write action (create exhibit, status transitions, raise objection) — those stay exactly as they are today (ungated, matching pre-7.1 reality) unless a specific F08/09/10/11/24 requirement needs otherwise.
- "Record ruling" needs **no new backend work** — `recordRuling`'s `JUDGE`-only gate has existed since Phase 1 (`01-04`); F24 is purely a new client surface over it.
- Client-side: follow the exact pattern already established in `JuryPackageDraft.tsx` (`FINALIZE_ROLES`/`ACK_ROLES` arrays + `useRoleStore` + `.includes(role)`) — add `RULING_ROLES = ['JUDGE']` and `CUSTODY_ROLES = ['DEPUTY', 'CLERK', 'ADMIN']` wherever the new controls render.

### F11 schema change — proceed as specced
`JuryPackage.finalizationRequestedAt` / `finalizationRequestedBy` (both nullable) is a real migration, already fully specced (`Y0-schema.md`, `F11-jury-package-workspace-screen.md` §Process steps 7–8). No change from the FRD — build as written. This is the **only** schema migration in Phase 8.

### Header layout — match the screenshots exactly, not the older UX-Mockup wireframe
The reference screenshots' header is: app logo/name (sidebar), screen title + subtitle (case name / day / date) in the content area, then right-aligned: a live-status dot + "updated Xs ago" text, a labeled "Role" dropdown, and a solid navy "Ask Pivota" button. **There is no Case Selector and no discrepancy-count badge in the header** — both match skipping Phase 7.1 (F22) and are consistent with the stat-card row / attention feed already surfacing discrepancy signal more prominently. Do not add either element back in.

### Visual/component standardization (user requirement: "perfect alignment and standardization")
Every exhibit label (`P-3`, `S-1`, etc.) renders as the **same small bold monospace-ish chip component** everywhere it appears — Command Center attention feed, custody panel, activity feed, Exhibit Detail header/breadcrumb, Jury Package cards, Case Workspace table. One shared component, not five independent implementations (directly extends the existing Status Badge Visual Convention pattern's "one shared component" rationale to exhibit labels).
Likewise standardize as shared components, each used identically across all four screens:
- **Severity/condition pill** (tier badges in the attention feed; "Unresolved objection" / "No custodian on record" / "Critical · ex parte material" pills in Jury Package cards and Case Workspace's Flags column) — one pill component, color + text convention shared.
- **Two-color progress bar** ("clean vs. blocked" — Jury Package summary widget on Command Center, Jury Package Workspace's own header bar, both render the identical `{clean} of {total}` ratio from the identical source data).
- **Primary/secondary button pairing** — every blocker/attention card follows the same visual hierarchy: one solid primary action (navy, or red when the action is itself the critical remediation e.g. "Remove from package") + one outline secondary action ("Acknowledge" / "View exhibit"), left-to-right, same sizing, same spacing, on every card type.
- **Card chrome** — rounded-corner, white cards on the light content area (dark-dashboard foundation, unchanged since the Phase 8 visual-foundation note in `00-overview.md`); a card in a "blocked/critical" state gets a red left-border/outline treatment, applied identically whether it's an attention-feed entry, a Jury Package blocker card, or a Case Workspace tinted row.

### Claude's Discretion
- Exact naming of the new seed-only legacy-admit helper and the final labels chosen for the two new fixtures (default: `P-6`/`P-7`).
- Whether the attention feed's `HIGH`/`PENDING`/`MEDIUM` inline action forms render as an inline expansion (per `Y0-patterns.md` §Attention Feed Inline Action) with a CSS transition, exact spacing/breakpoints.
- Exact shared-component file locations/names for the new chip/pill/progress-bar components (e.g. `src/components/shared/ExhibitTag.tsx`).
- Whether Recent Activity's filter pills narrow client-side via a derived `useMemo` or a small local reducer — FRD only requires it be client-side/no new query.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Feature requirements (FRD)
- `project_specs/FRD/F08-trial-command-center-screen.md` — stat cards, status-distribution bar, "Custody at a Glance" (`getCustodyByCustodian`, new), "Needs your attention" feed (`getAttentionFeed`, new, exact tier rules), Jury Package summary widget, Recent Activity filter pills/date grouping. Full process/output/error-state contract.
- `project_specs/FRD/F09-case-workspace-screen.md` — `juryPackageEligibility` column precedence rule (Included/Blocked/Not eligible), amends `getExhibits`/`searchExhibits`.
- `project_specs/FRD/F10-exhibit-detail-view-screen.md` — right-rail Objection/Chain-of-Custody/Jury-Package-checklist cards, header actions, amended `getExhibitHistory` output shape.
- `project_specs/FRD/F11-jury-package-workspace-screen.md` — Blockers/Clean card restructure, progress indicator, "Request finalization from Clerk" (new endpoint + schema fields).
- `project_specs/FRD/F24-write-action-ui-coverage.md` — the two write actions' full process/validation/error-state contract. **Read with this CONTEXT's simplifications applied**: no propose/confirm/cancel (single-phase custody only), no F20 generalized role matrix (only the one new custody-transfer gate above).
- `project_specs/FRD/F06-discrepancy-identification.md` — `ADMITTED_NO_CUSTODIAN` / `UNRESOLVED_OBJECTION_JURY_ELIGIBLE` rule definitions the two new seed fixtures must genuinely fire (unchanged engine, new qualifying data).
- `project_specs/FRD/F02-objection-ruling-tracking.md`, `F03-custody-tracking.md` — the existing `recordRuling`/`recordCustodyTransfer` service contracts F24 wires a UI onto, unchanged.
- `project_specs/FRD/Y0-schema.md` §Jury Package — exact `finalizationRequestedAt`/`finalizationRequestedBy` migration shape.
- `project_specs/FRD/Y1-api.md` §Command Center, §Jury Package, §Write-Action UI Coverage — exact amended/new endpoint contracts.
- **Do not read F16–F23 as build targets** (7.1, skipped) — only as background for why certain F24/F08 controls must be simplified per this CONTEXT's decisions.

### UX / interaction contracts
- **The 5 user-supplied reference screenshots (2026-10-09)** — the literal layout/copy/button-hierarchy contract. See `<specifics>` below for a full written breakdown of each, since the images themselves aren't file-system artifacts.
- `project_specs/UX-Mockup/Screen-00-trial-command-center.md` — stat card sourcing table, attention-feed tier→action table, `data-testid`/`aria-label` contracts (flagged `⚠ New` throughout — these are real requirements, not suggestions).
- `project_specs/UX-Mockup/Screen-02-exhibit-detail.md`, `Screen-03-jury-package.md`, `Screen-01-case-workspace.md` — per-screen wireframes; defer to the screenshots over these where they conflict (header layout, specifically).
- `project_specs/UX-Mockup/Y0-patterns.md` §Severity Tier Badge, §Attention Feed Inline Action, §Role-Gated Control Visibility, §Readable Flag Pill — the shared-component patterns this phase must implement, generalized across all four screens per this CONTEXT's standardization decision.
- `project_specs/UX-Mockup/00-overview.md` §Visual Foundation — dark-navy sidebar / light content area / rounded-card chrome; confirmed consistent with the screenshots.

### Technical architecture
- `project_specs/TechArch/02-data-model.md`, `03-api.md` — service/route conventions this phase's two new services (`getCustodyByCustodian`, `getAttentionFeed`) and one new route (`request-finalization`) must follow.
- `project_specs/TechArch/04-security.md` — read alongside this CONTEXT's role-gate decision; the generalized matrix it may describe is 7.1 scope, not this phase's.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets
- `src/services/custody.ts` → `recordCustodyTransfer`, `getCustodian`, `getCustodyHistory` — existing F03 service; gains the one new role gate above, otherwise unchanged. **Zero role enforcement today** (grep-confirmed) — this is the gap F24 closes.
- `src/services/objections.ts` → `recordRuling` — **already** `JUDGE`-gated since Phase 1 (`01-04`); F24 wires a UI onto this unchanged.
- `src/lib/errors.ts` → `RoleNotPermittedError` (general-purpose, line ~75) — reuse this for the new custody gate, not `objections.ts`'s private ruling-specific subclass.
- `src/services/discrepancies.ts` → `getDiscrepancies`, `evaluateDiscrepancies`, the `ADMITTED_NO_CUSTODIAN`/`UNRESOLVED_OBJECTION_JURY_ELIGIBLE` rules (Phase 3, unchanged) — the two new seed fixtures must fire these for real, through the existing engine.
- `src/components/jury/JuryPackageDraft.tsx` → `FINALIZE_ROLES`/`ACK_ROLES` + `useRoleStore().role` + `.includes()` — the exact client-side role-gating pattern to replicate for `RULING_ROLES`/`CUSTODY_ROLES`.
- `src/components/StatusBadge.tsx` — exact model for the new exhibit-label chip and severity-pill shared components (one component, `aria-label` contract, reused everywhere).
- `src/hooks/useRecentActivity.ts`, `useUnresolvedObjections.ts`, `useDiscrepancies.ts`, `useJuryPackage.ts` — established react-query hook pattern (4s `refetchInterval`, role+caseId in query key) the two new hooks (`useAttentionFeed`, `useCustodyByCustodian`) must follow identically.
- `src/app/api/cases/[id]/activity/route.ts` — amend in place for the additive `statusCounts` field; model for the two new route files (`custody-by-custodian`, `attention-feed`).
- `src/data/seed.ts` — existing `makeExhibit`/`recordStatusChange`/`recordObjection`/`recordCustodyTransfer` helpers (lines ~176–425) and `assertSeedIntegrity` — extend with `P-6`/`P-7` and the new seed-only legacy-admit helper; **do not touch** the P-1/P-2/P-3/P-4/P-5/D-1/D-2/D-3/S-1 blocks already there.
- `prisma/schema.prisma` → `JuryPackage` model — add the two nullable columns; follow the existing migration process (`prisma migrate dev`) used by Phase 7.1's prior schema changes (01-01 decision log: snake_case `@map`/`@@map` convention).

### Established patterns
- **Service layer is the sole data path** (every phase so far) — the two new services compose existing projections (`CustodyCurrentState`, `DiscrepancyFlag`, `ObjectionCurrentState`, `JuryPackageExhibit`), zero new tables, zero new indexes needed at demo scale (`Y1-api.md` §Performance Notes, confirmed).
- **Role resolved server-side from `User.role`, never trusted from client** — exactly the pattern `recordRuling` already uses; replicate verbatim for the new custody gate.
- **`forceAdmitBypassingGate` is test-only, grep-audited confined to `*.test.ts`** (`T-07-05`) — the new seed-only legacy-admit helper is a **distinct, separately-justified** mechanism; do not reuse or alias the test helper, and do not weaken its test-only confinement.
- **Seed loader writes exclusively through service functions** (`T-01-17`) — the one exception this phase introduces (the new legacy-admit helper, used only for `P-6`/`P-7`'s final `ADMITTED` step) must be as narrowly scoped and as clearly justified/commented as `forceAdmitBypassingGate` was, and must be called out explicitly to the phase's security auditor.
- **Absent-not-disabled role gating, client-side** (`JuryPackageDraft.tsx`, Phase 3) — replicate for the two new write-action controls; the server-side gate (existing for ruling, new for custody) remains authoritative regardless of what renders.
- **Polling live-sync, 4s interval, role+caseId in query key** (every live screen since Phase 5) — the two new hooks follow this unchanged.

### Integration points
- **New services:** `src/services/` — `getCustodyByCustodian(caseId)`, `getAttentionFeed(caseId)`.
- **New routes:** `GET /api/cases/[id]/custody-by-custodian`, `GET /api/cases/[id]/attention-feed`, `POST /api/jury-package/[id]/request-finalization`.
- **Amended routes:** `GET /api/cases/[id]/activity` (+`statusCounts`), `GET /api/cases/[id]/exhibits` + search (+`juryPackageEligibility`), `GET /api/exhibits/[id]/history` (+`objections[]`/`custodyCard`/`juryPackageChecklist`), `GET /api/cases/[id]/jury-package` (+`finalizationRequestedAt`/`By`), `POST /api/jury-package/[id]/finalize` (clears the request fields), `POST /api/exhibits/[id]/events/custody` (+ role gate).
- **New components:** shared `ExhibitTag`/severity-pill/progress-bar components (standardization decision above); attention-feed entry + inline action forms; custody-at-a-glance panel; jury-summary widget; activity filter-pill row; three Exhibit Detail right-rail cards; Jury Package Blockers/Clean card layout; request-finalization control.
- **Schema migration:** `JuryPackage.finalizationRequestedAt DateTime?`, `finalizationRequestedBy String?`.
- **Seed:** two new fixtures (`P-6`/`P-7`) + one new seed-only legacy-admit helper + two new `assertSeedIntegrity` checks.
- **Testing focus:** attention-feed tier assignment + newest-first-within-tier ordering + `CRITICAL`-never-interleaved rule; role-gated absence (not disablement) of every new control per role; the custody-transfer server-side gate (403 for a non-`DEPUTY`/`CLERK`/`ADMIN` actor, enforced even if the client were tampered with); `P-6`/`P-7` genuinely firing their discrepancy rules through the live engine; the legacy-admit helper's confinement to `seed.ts` (grep check in the verification step); jury eligibility column precedence on Case Workspace; request-finalization role rejection (403 for an already-finalize-authorized role).

</code_context>

<specifics>
## Specific Ideas — exact screenshot contract

### Screenshot 1 — Trial Command Center
- Header: title "Trial Command Center", subtitle "State v. [CASE NAME] · Day 1 · Thursday, Oct 8, 2026"; right-aligned: green-dot "Live · updated 4s ago", "Role" label + dropdown, solid navy "Ask Pivota" button. No case selector, no discrepancy badge.
- 4 stat cards in a row: "Open objections" (2), "Custody gaps" (1), "Jury package blockers" (3, red-outlined card — the one card that gets the critical/attention treatment), "Admitted" (5 of 9, with a small sub-caption "1 excluded · 1 withdrawn").
- "Where the N exhibits stand" panel: title + "Open Case Workspace" link top-right; one horizontal segmented bar (proportional, colored per status); a legend row directly beneath with icon+label+count per status (✓Admitted/○Marked/…Offered/!Objected/✗Excluded/−Withdrawn).
- Two-column row: **left (wider)** "Needs your attention" — header + "Ranked by risk to the jury" caption; list of entries, each: severity pill (Critical/High/Pending/Medium, color per `Y0-patterns.md` §Severity Tier Badge) + bold title line + one-line plain-language detail + a right-aligned action button (solid red "Review and remove →" for Critical; solid navy "Record ruling" for High/Pending; outline navy "Assign custodian" for Medium).
- **right (narrower)**, two stacked cards: "Jury package" (status pill "Not ready to finalize", two-color progress bar, "{clean} of {total} exhibits are clean. {N} blockers remain.", solid navy "Open jury package" full-width button) and "Custody at a glance" (list of custodian name → exhibit labels; a red "No custodian" row at the bottom listing affected labels).
- Full-width bottom panel: "Recent activity" + "{N} events today" caption; filter pill row (All/Status/Custody/Objections/Rulings, All active by default); date-group header ("TODAY · OCT 8, 2026"); rows = time + exhibit-label chip + plain-language description (+ inline status pill where relevant, e.g. "✓ Admitted") + right-aligned actor name; "View all N events" link at the bottom.

### Screenshot 2 — Exhibit Detail (P-3 example)
- Breadcrumb "‹ Case Workspace" above the content.
- Header card: exhibit label chip + title + status pill, inline; subtitle line "Party · Witness {name} · Custodian {name}"; right-aligned outline buttons "Transfer custody" and "Ask Pivota about {label}".
- Alert banner directly beneath (red outline, light-red background) — only rendered when the exhibit has an active blocking condition: bold title ("Admitted while an objection is unresolved") + explanation line; right-aligned solid-red "Record ruling" + outline-red "Acknowledge" buttons.
- Two-column body: **left (wider)** "History" timeline — filter pill row (All/Status/Custody/Objections) + chronological entries, each a colored dot + bold event title + description + actor/timestamp line.
- **right (narrower)**, three stacked cards: "Objection" (status pill, defense/grounds text, "Raised {time}. Only the judge can rule." caption, full-width solid-navy "Record ruling" button) — renders "No open objections" when none exist, not an empty card; "Chain of custody" (ordered custodian list with a connecting line, "current" label on the active one, "No gaps in the chain" green confirmation line); "Jury package" (status pill — Blocked/Included/Not eligible — + 4-item checklist, each ✓ or ✗, + "Open jury package" link).

### Screenshot 3 — Pivota Assistant
- Header: "Pivota Assistant" title + "New conversation"/"Settings" outline buttons, right-aligned.
- Persistent info banner beneath the header: "Read-only. Answers use only what a Judge can see. The assistant never changes exhibits, rulings or custody." — confirms the assistant's non-write framing stays visible, not just a one-time disclaimer.
- Thread: user bubbles solid-navy, right-aligned; assistant replies in a light card, left-aligned, with exhibit-label chips inline in the prose text (same shared chip component as every other screen) and a "Sources:" line beneath each reply linking to the specific records it cited.
- "SUGGESTED FROM THE LIVE CASE" row of outline chip buttons, each referencing real seeded labels (confirms item 7 is fixed, nothing new to build here).
- Bottom: labeled "Ask about an exhibit" text input + solid-navy "Send" button.

### Screenshot 4 — Jury Package Workspace
- Header: "Jury Package · Draft v1" + "Built from the {N} admitted exhibits · updated 4s ago" subtitle.
- Status banner: "Not ready to finalize: {N} blockers" (red) + explanation + inline two-color progress bar + "{clean} of {total} exhibits clean" caption, right-aligned within the same banner.
- "Blockers ({N})" section: one card per flagged exhibit — label chip + title + condition pill ("Critical · ex parte material" / "Unresolved objection" / "No custodian on record") + one-line detail + right-aligned primary/secondary button pair (e.g. "Remove from package"+"View exhibit"; "Record ruling"+"Acknowledge"; "Assign custodian"+"Acknowledge"). Clicking "Acknowledge" expands an inline panel within the same card: labeled required textarea, a caption confirming identity/timestamp/permanence ("Recorded as {name}, {time}, and shown on the finalized record"), and "Confirm acknowledgement"/"Cancel" buttons.
- "Clean ({N})" section: simpler rows, not full cards — label + title + right-aligned "✓ Admitted · custodian {name}".
- Bottom "Finalize package" card: explanatory caption naming exactly why it's unavailable and to whom it's restricted ("Only a deputy, clerk or administrator can finalize; you are signed in as {role}"); two buttons — outline "Request finalization from Clerk" (enabled for a non-authorized role) and solid "Finalize package" (hard-disabled, native `disabled`, while any blocker remains — `Y0-patterns.md` §Hard-Disabled Gate Controls).

### Screenshot 5 — Case Workspace
- Header: "Case Workspace" + "{N} exhibits · {case name}" subtitle; solid-navy "Add exhibit" button, right-aligned.
- Quick-filter chip row beneath the header: "All N" (active) / "Needs attention N" / "In my custody N" / "Awaiting ruling N" — client-side narrowing, same spirit as the Recent Activity filter pills.
- Filter bar: Search input, Status dropdown, Witness dropdown, From/To date inputs — unchanged from the existing F4 search bar.
- Table columns: Label, Description, Party, Status, Custodian, Flags, Jury Package (with a trailing chevron affordance confirming row-clickability, item 6).
- Rows needing attention are visually tinted (pale background); "Flags" column renders one or more readable pills per row (per `Y0-patterns.md` §Readable Flag Pill — "Ruling pending", "No custodian", "Open objection", "Ex parte · restricted"); "Jury Package" column renders colored plain-language text (green "Included" / gray "Not eligible" / red "Blocked"); an unassigned custodian renders as red "Unassigned" text, not a blank cell.
- Footer caption: "Tinted rows need attention. Select any row to open the exhibit."

</specifics>

<deferred>
## Deferred Ideas

- Everything in F16–F23 (Phase 7.1) — exhibit classification taxonomy, two-phase custody propose/confirm/cancel, the generalized `assertRole` permission matrix, multi-case support + Case Selector, Pending-Ruling Queue screen, jury-package versioning + real PDF export. Deferred indefinitely pending a future decision to actually plan Phase 7.1 (currently an empty roadmap stub).
- A fully pixel-accurate reproduction of the written `UX-Mockup/` ASCII wireframes' header design (Case Selector, discrepancy badge) — explicitly superseded by the screenshots for this phase.
- Any reclassification of P-1/P-2/P-3's existing seeded narrative — stays exactly as Phase 7 left it.
- Reconciling item 4's scenario into a dedicated new attention-feed tier — resolved instead by the universal Exhibit Detail custody card, no new tier needed.

</deferred>

---

*Phase: 08-ui-redesign-and-write-action-coverage*
*Context gathered: 2026-10-09*
