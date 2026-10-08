---
phase: 06-carbon-design-system-ui-upgrade
verified: 2026-10-08T02:49:57Z
status: passed
score: 9/9 must-haves verified
gaps: []
---

# Phase 6: Carbon Design System UI Upgrade Verification Report

**Phase Goal:** Every screen across all 5 shipped phases (Command Center, Case Workspace, Exhibit Detail, Jury Package, Pivota Assistant) renders on IBM Carbon Design System components and tokens instead of Tailwind/shadcn, with ZERO change to underlying functionality, data behavior, API routes, or the existing 36-test Playwright suite's asserted behaviors.
**Verified:** 2026-10-08T02:49:57Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

This is a **styling-only migration**. The goal decomposes into three pillars: (1) every screen renders on Carbon with the Tailwind/shadcn pipeline fully removed; (2) functionality/data/API behavior preserved; (3) behavioral contracts (testids, deep-links, finalize gate, sealed filtering, assistant states) forwarded unchanged. All three are satisfied, corroborated by green phase gates.

### Observable Truths

| #   | Truth                                                                                      | Status     | Evidence                                                                                                                                                                 |
| --- | ----------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | All 5 screens render on Carbon components/tokens                                           | ✓ VERIFIED | case/exhibit/jury-package import `@carbon/react` directly; command-center & assistant pages delegate to Carbon-based child components; 21 `@carbon/react` imports in src/; 12 co-located `.module.scss` token modules |
| 2   | Tailwind/shadcn pipeline removed from package.json                                         | ✓ VERIFIED | grep for `tailwind\|shadcn\|lucide\|class-variance\|clsx\|tailwind-merge\|@base-ui` in package.json → NONE; `@carbon/react/styles/icons-react` + `sass` present (commit 8f50854) |
| 3   | Pipeline files removed from tree (globals.css, components.json, postcss, ui/*, cn)         | ✓ VERIFIED | `globals.css`, `components.json`, `postcss.config.mjs`, `src/components/ui/`, `src/lib/utils.ts` all GONE (deletions in ff105e1/8f50854); `globals.scss` present |
| 4   | Zero remaining Tailwind/shadcn references in rendered UI                                   | ✓ VERIFIED | grep for Tailwind utility classNames across `src/**/*.tsx` → NONE (W4 last-2 fixed in d49d716); grep for `@/components/ui`/`lib/utils`/`lucide-react` imports → NONE |
| 5   | Print CSS (F11 jury export) preserved, print-only                                         | ✓ VERIFIED | `globals.scss` lines 14-34: `@media print` block with `.no-print`/`.jury-print-root` rules, verbatim from old globals.css |
| 6   | Functionality preserved — 36 Playwright + 195 vitest pass; API/services/prisma untouched  | ✓ VERIFIED | GATE wave 5: Playwright 36/36 green; vitest 195 pass (3 skipped) across all 5 waves; `git diff a198106^..HEAD` touches ZERO api/services/prisma/seed/lib-assistant-logic files |
| 7   | Contract preservation — data-testid/aria-label forward through Carbon primitives           | ✓ VERIFIED | StatusBadge `aria-label="Current status: …"` on Carbon Tag; DiscrepancyBadge `data-testid`/`data-discrepancy-status`/`data-discrepancy-count`; ExhibitTable `exhibit-row` testid + onClick; CitationPill `data-event-id`/`data-record-type` |
| 8   | US-11.2 jury finalize gate is native disabled (not aria-only); #event-{id} deep-links kept | ✓ VERIFIED | JuryPackageDraft.tsx:248 `disabled={hasOpen \|\| finalizePending}` on Carbon Button (→ native `<button>`), no `aria-disabled`; Timeline.tsx:29 `id={\`event-${entry.eventId}\`}`; exhibit page getElementById + scrollIntoView `?event=` logic intact |
| 9   | Sealed filtering untouched; assistant 3 outcome states structurally distinct               | ✓ VERIFIED | Sealed filtering stays server/hook-side (ObjectionsPanel/DiscrepanciesPanel read role-scoped hooks, no screen-local derivation); MessageBubble `data-outcome` grounded\|decline; unavailable = distinct Carbon `InlineNotification kind="warning"` role="alert" + Try-again |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact                                | Expected                                         | Status     | Details                                                           |
| --------------------------------------- | ------------------------------------------------ | ---------- | ---------------------------------------------------------------- |
| `src/app/globals.scss`                  | Carbon theme import + preserved print CSS        | ✓ VERIFIED | `@use '@carbon/react'` + `@media print` block present            |
| `package.json`                          | Carbon deps added, Tailwind/shadcn removed       | ✓ VERIFIED | 3 @carbon packages + sass; zero tailwind/shadcn/lucide/cva deps  |
| `next.config.ts`                        | Carbon Sass config                               | ✓ VERIFIED | In phase diff; build compiles (gate)                             |
| 5 screen pages + Carbon child components| Render on Carbon                                 | ✓ VERIFIED | All migrated to `@carbon/react` + `.module.scss` tokens          |
| Deleted: `ui/*`, `lib/utils.ts`, `globals.css`, `components.json`, `postcss.config.mjs` | Removed | ✓ VERIFIED | Confirmed absent from tree (git deletions)                       |

### Key Link Verification

| From                | To                     | Via                                  | Status  | Details                                      |
| ------------------- | ---------------------- | ------------------------------------ | ------- | -------------------------------------------- |
| `layout.tsx`        | `globals.scss`         | `import './globals.scss'`            | ✓ WIRED | Carbon entry point wired into root layout    |
| CitationPill        | exhibit `?event=`      | `data-event-id` + href               | ✓ WIRED | Deep-link → Timeline `#event-{id}` anchor    |
| JuryPackageDraft    | finalize gate          | native `disabled`                    | ✓ WIRED | Carbon Button → native `<button disabled>`   |
| Command-center/assistant pages | Carbon child components | component imports           | ✓ WIRED | Pages delegate rendering to Carbon children  |

### Requirements Coverage

| Requirement | Status      | Blocking Issue                                                              |
| ----------- | ----------- | -------------------------------------------------------------------------- |
| Y4 (Design System Migration, cross-cutting) | ✓ SATISFIED | Tracked in RTM.md (no F-number); styling-only migration complete |

### Anti-Patterns Found

None blocking. The only prior styling-fidelity defects (W1–W4 dead Tailwind classes) were all resolved — W1/W2/W3 in commits 348a410/95694a7/53a38b7 and W4 in d49d716 (replaced with Carbon InlineLoading/InlineNotification). Current grep for Tailwind utilities in `src/` returns zero.

### Human Verification Required

None required for pass. (Optional visual-polish spot-check: the migrated screens were not pixel-diffed; Carbon token fidelity vs. the prior Tailwind look is a visual judgment. This does NOT affect goal achievement — the goal is "renders on Carbon with zero functional change," which is proven. Visual QA is advisory only.)

### Gaps Summary

No gaps. The migration is complete and clean:
- **Rendering:** All 5 screens on Carbon; Tailwind/shadcn pipeline (deps, globals.css, components.json, postcss, ui/*, cn) fully removed; zero residual Tailwind references in src/ (W4 closed).
- **Functionality:** Entire phase diff is config + presentational `.tsx`/`.module.scss` + deletions — zero API/service/prisma/seed/assistant-logic files touched. Gates confirm vitest 195 and Playwright 36/36 green across all 5 waves, boot smoke pass.
- **Contracts:** testid/aria-label forwarding, `#event-{id}` deep-links, native-disabled finalize gate, server-side sealed filtering, and the three structurally-distinct assistant outcome states all verified at source.

Gate evidence (gate_status: passed, boot_smoke: pass, review_blockers_open: 0, shadowed_sources: 0, tests_disabled: none) is green and cited rather than re-litigated.

---

_Verified: 2026-10-08T02:49:57Z_
_Verifier: Claude (pivota_spec-verifier)_
