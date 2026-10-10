# Phase 9: UI tickets and typography standard - Context

**Gathered:** 2026-10-10 (chat lifecycle request — 16-ticket external UI/UX review document, T-01 through T-16, plus a typography/font-loading audit)
**Status:** Ready for planning

<domain>
## Phase Boundary

Sixteen discrete UI/UX hardening tickets against the shipped, live codebase (Phases 1-8 complete), plus a font-loading/typography correction pass. Source document explicitly instructs **one ticket, one pull request** — plans should preserve that granularity (map tickets to plans 1:1 where practical; only merge tickets into one plan when they touch the exact same file(s) and splitting would be artificial).

Tickets, by priority tier (full ticket text with Direction/Acceptance already in ROADMAP.md's Phase 9 section and project_specs/FRD updates — this file adds what those don't carry):

- **P1 (fix before next demo):** T-01 Command Center first-viewport rebuild (F08), T-02 severity color scale (F08/F01), T-03 unified status palette (F01), T-04 Recent Activity rework (F08/F15), T-05 discrepancy action buttons (F24)
- **P2 (next sprint):** T-06 Case Workspace columns (F09), T-07 filter labels (F09), T-08 nav/assistant entry point (F15), T-09 role switcher safeguards (F20 — see Decisions below), T-10 Jury Package empty-state + readiness preview (F11/F25), T-11 Assistant rework (F07)
- **P3 (polish):** T-12 contrast/text-size (cross-cutting), T-13 surface/layer flattening (cross-cutting), T-14 spacing/button standardization (cross-cutting), T-15 live indicator (F08), T-16 font loading + typography (cross-cutting)

**Out of scope (explicitly, per the source document and prior locked decisions):** data-model changes, API-contract changes beyond the specific additive fields named in FRD (objectionGrounds, NOT_YET_EVALUATED, F25's new read-only route), role-permission changes, new UI libraries, CSS-in-JS, any npm dependency beyond `next/font` (built into Next.js already, not a new dependency). Phase 7.1 (exhibit classification, full state-machine hardening, custody handoff confirmation, pending-ruling queue, multi-case support, versioned jury packages/PDF export) remains explicitly deferred and unplanned — per the user's prior explicit instruction ("I say you ignore phase 7.1 and proceed with Phase 8") — and nothing in Phase 9 should require or assume any Phase 7.1 deliverable exists.
</domain>

<decisions>
## Implementation Decisions

### 1. T-09's "assertRole" does not exist yet — plan against the REAL current role checks, not F20's aspirational text (CRITICAL — read before planning T-09)

The ticket source text says "Server-side role checks (assertRole and the Permission Matrix) are authoritative." The FRD (`F20-server-side-role-enforcement-matrix.md`) and TechArch (`04-security.md` §5.2.2a) both describe a **full, centralized `assertRole` helper + Permission Matrix covering every write action** as "current, canonical... as of Phase 7.1." **This is aspirational, not shipped.** Verified directly against source during this planning pass:

- `grep -rn "assertRole" src/` → **zero matches anywhere in the codebase.** No such helper exists.
- `.planning/ROADMAP.md`'s Phase 7.1 entry status is **"Not planned," 0 plans** — F20 (and F16-F23 generally) have never been built.
- What **actually exists today**, verified per-file:
  - `src/services/objections.ts` — `recordRuling` has a JUDGE-only check (inline, DB-resolved `actor.role`), but **raising an objection has no role check at all**.
  - `src/services/custody.ts` — `recordCustodyTransfer` has a `CUSTODY_WRITE_ROLES` (DEPUTY/CLERK/ADMIN) check, added ad hoc in Phase 8 (`08-02-PLAN.md`), **not** via any shared helper.
  - `src/services/discrepancies.ts` — acknowledge has an `ACK_ALLOWED_ROLES` check, ad hoc.
  - `src/services/juryPackage.ts` — initiate/finalize has a `JURY_WRITE_ROLES` check, ad hoc.
  - `src/services/status.ts` — **zero role-related code** (`grep -c "role" status.ts` → 0). Every status transition (mark/offer/admit/exclude/withdraw) is open to any `actorUserId`.
  - `src/services/exhibits.ts#createExhibit` — **no role check at all.**
  - Each existing gate is its own inline pattern (resolve `actor.role` via a direct Prisma lookup, throw `RoleNotPermittedError`/`RoleNotPermittedError` subclass) — there is no shared `assertRole(actorUserId, allowedRoles, actionLabel)` function anywhere to import or extend.

**Locked decision for T-09 planning:** Build T-09's UI-side safeguards (demo/test labeling or env-flag gating of the RoleSwitcher component, the persistent "Active role: X — switch back" banner, and the `requestingUserRole`-in-every-query-key fix) against **whatever role-enforcement exists today** (the four ad hoc gates listed above). **Do not** introduce a new centralized `assertRole` helper or extend role gating to any currently-ungated write path (status transitions, objection-raising, exhibit creation) as part of Phase 9 — that is Phase 7.1's deferred scope, and doing it here would violate the ticket's own "no data-model/API/role-permission changes unless the ticket explicitly says so" ground rule. T-09's acceptance criteria ("switching refreshes visible actions immediately," "persistent banner") are fully satisfiable against the current ad hoc gates with zero new server-side authorization code. The TechArch's §5.1a/§5.2.2a-referencing language should be read as "the eventual target state," not as describing code that exists — plans must cite the actual file/function list above, not the FRD's Phase-7.1-tense prose, when implementing or testing T-09.

### 2. T-12/T-13's "confirm which theme is current" — answered: it's light, with only the Sidebar manually dark-styled

The ticket source explicitly flags this as an open question ("the TechArch describes a Phase 8 dark-dashboard theme (Carbon g90 or g100), but the develop site I reviewed renders light. Confirm which build is current before starting T-12 and T-13."). Verified directly:

- `src/app/globals.scss` applies **no** `g90`/`g100` theme class or Carbon theming-API override at the application-shell level — `grep -rn "g10\|g90\|g100\|data-carbon-theme"` across `layout.tsx`, `providers.tsx`, and all shell components returns **zero matches** for any actual theme-switch mechanism.
- `src/components/shell/Sidebar.module.scss` has manually-authored dark-navy colors with comments like "the dark-dashboard convention for the selected nav item" — **this is a one-off component-level override**, not a theme applied at the shell/root level.
- Every other surface (Header's content area, Command Center cards, Case Workspace table, Exhibit Detail, Jury Package) renders on Carbon's **default White (light) theme** — confirmed by the absence of any theme-provider wrapper or root theme class.

**Locked decision:** TechArch §6.1a's "Phase 8 dark-dashboard theme... applied at the application shell level" describes a **plan, not a shipped state** — like the F20 matrix, this is pre-existing spec/reality drift, not something this phase needs to resolve by building a full dark theme (none of T-01 through T-16 ask for one). **T-12 and T-13 apply their token/spacing/layering fixes against the actual current light theme** (Carbon White theme + the one manually-dark Sidebar), not against an assumed global dark theme. Do not attempt to retroactively apply `g90`/`g100` globally as part of T-12/T-13 — that is out of scope for this phase (no ticket requests a theme change; T-02/T-03's color-token work is about *status/severity* colors, not the *base* theme).

### 3. Font-loading root cause — already confirmed, reinforces TechArch's `next/font` decision

`src/app/globals.scss` already contains an explicit, deliberate comment: *"Disable Carbon's @font-face emission: it references IBM Plex via the legacy webpack-era `~@ibm/plex/...` path, which Turbopack (Next 16's bundler) cannot resolve and `@ibm/plex` is not installed. The app does not use IBM Plex (it keeps the existing system font stack)."* This independently confirms T-16's finding (Plex never loads) and confirms the TechArch's chosen fix (`next/font` self-hosting, §6.1b) is correct — re-enabling Carbon's own Sass font-face partial would reintroduce the exact Turbopack-incompatible path this comment describes avoiding. T-16's plan should reference this existing comment/decision directly rather than re-diagnosing from scratch.

### 4. New eligibility value name is locked: `NOT_YET_EVALUATED`

Per the already-updated FRD (`F09-case-workspace-screen.md`), the fourth jury-package-eligibility value is named `NOT_YET_EVALUATED` (not `NOT_EVALUATED` as the ticket's own prose informally suggested). Use `NOT_YET_EVALUATED` consistently in code, types, and the three surfaces that must agree (`getExhibits`, `searchExhibits`, `getExhibitHistory`'s checklist).

### 5. F25's new route is locked: `GET /api/cases/:id/jury-package/preview`

Per FRD/TechArch, this is a dedicated, deliberately role-gate-free (no `ROLE_NOT_PERMITTED` possible) read route backed by a new `getJuryPackageReadinessPreview(caseId, requestingUserRole)` function in `services/juryPackage.ts`, reusing — never reimplementing — F5/F6/F13's existing eligibility predicates. It must create zero rows in any table under any circumstance.

### 6. One ticket = one plan, where practical

Preserve the source document's "one ticket at a time, one PR per ticket" instruction as the default plan granularity. Acceptable exceptions: tickets that are trivially small and touch the exact same single file with no independent verification value (e.g., if two tickets both only touch `StatusBadge.tsx` with no other file overlap) may share a plan if splitting would be artificial — but default to 1:1.

### 7a. F24's FRD "propose/confirm/cancel custody" steps are also aspirational (Phase 7.1/F19) — the shipped custody UI is single-call only

`F24-write-action-ui-coverage.md` §Process — Transfer/Assign Custody steps 4-5 describe a propose/confirm/cancel multi-step custody-handoff flow (F19) as if already live. Per Phase 8's own locked `08-CONTEXT.md` decision and `08-09`'s shipped implementation, **only the single legacy `POST /api/exhibits/:id/events/custody` endpoint and a single-call `TransferCustodyForm` exist today** — no propose/confirm/cancel endpoints or UI exist anywhere in the codebase (F19 is Phase 7.1 scope, unplanned). **No Phase 9 ticket asks to build propose/confirm/cancel** — T-01's Command Center tile and any other Phase 9 reference to "Transfer custody" should link to/reuse the existing single-call `TransferCustodyForm`/`useTransferCustody` (08-09) exactly as shipped, not the FRD's aspirational multi-step description.

### 7. Acceptance criteria must be copied verbatim, not paraphrased looser

Every ticket's acceptance criteria contain hard numeric/behavioral thresholds (80px tile height, 4.5:1 contrast, <60s staleness window, >=6 visible rows at 1440x900, 60-second activity-grouping window, 14px minimum body text). Plans' `<verify>` sections must test against these exact thresholds, not a softened paraphrase.
</decisions>

<deferred>
## Deferred / Out of Scope

- Full `assertRole`/Permission Matrix (F20 proper), exhibit classification taxonomy (F16), custodian-required-at-intake (F18), custody handoff confirmation (F19), pending-ruling queue (F21), multi-case support (F22), versioned jury packages + PDF export (F23) — all remain Phase 7.1, unplanned, untouched by Phase 9.
- A true global dark theme (`g90`/`g100` applied at the shell level) — no Phase 9 ticket requests this; T-12/T-13 work within the current light theme.
- Whether Acknowledge should be hidden for HIGH-severity items with a ruling still pending (T-05) — the ticket itself says to raise this as a product decision in the PR, not resolve it. Plans should implement Acknowledge as currently available (not hidden) and surface the open question in the plan's own notes/PR description, per the ticket's explicit instruction.
- Whether to remove or production-gate the Assistant's API-key link (T-11) depends on investigating what it currently does — the ticket says "find out what the link does" before deciding gate-vs-remove. Plan should investigate first (task 1), then decide within that same plan based on findings, rather than presupposing the answer.
</deferred>
