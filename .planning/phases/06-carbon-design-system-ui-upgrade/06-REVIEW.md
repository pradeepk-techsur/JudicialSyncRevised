---
phase: 6
status: issues_found
blockers: 0
warnings: 1
files_reviewed: 12
files_reviewed_list:
  - src/components/jury/AcknowledgeInline.tsx
  - src/components/jury/AcknowledgeInline.module.scss
  - src/components/case/SearchFilterBar.tsx
  - src/components/case/SearchFilterBar.module.scss
  - src/components/case/ExhibitTable.tsx
  - src/components/case/ExhibitTable.module.scss
  - src/app/case/page.tsx
  - src/app/case/page.module.scss
  - src/components/case/DiscrepancyBadge.tsx
  - src/components/case/DiscrepancyBadge.module.scss
  - src/components/shell/JuryPackageNavItem.tsx
  - src/app/jury-package/page.tsx
reviewed_at: 2026-10-08T00:00:00Z
iteration: 2
---

# Phase 6 Code Review — Iteration 2

## Iteration 2 verdict (re-review of W1/W2/W3 + N1)

Scope: iteration-1 `files_reviewed_list` restricted to the fixer-touched files
(AcknowledgeInline.tsx + .module.scss, SearchFilterBar.tsx + .module.scss,
ExhibitTable.tsx + .module.scss, app/case/page.tsx + .module.scss,
DiscrepancyBadge.tsx + .module.scss, JuryPackageNavItem.tsx, jury-package/page.tsx).
Verified fixer commits 348a410 (W1), 95694a7 (W2), 53a38b7 (W3).

- **W1 — FIXED (verified at source).** All four W1 files now carry only CSS-Module
  class references; the 18 dead Tailwind utilities are gone. New co-located modules
  (`AcknowledgeInline.module.scss`, `SearchFilterBar.module.scss`,
  `ExhibitTable.module.scss`, `app/case/page.module.scss`) rebuild the amber
  bordered container + two flex rows, the flex filter/chip rows + field widths, the
  clickable-row affordance, and the muted captions using Carbon theme/spacing/type/
  color tokens. A repo-wide grep for Tailwind utility `className`s across `src/**/*.tsx`
  now returns exactly two matches — both N1 (see W1-followup) — and `tsc --noEmit`
  passes (exit 0). No regression.
- **W2 — FIXED (verified at source).** The multi-flag branch no longer passes
  `title` to the Carbon `Tag`; the tooltip now lives on a plain inline-block
  `<span title={sentence} className={styles.multiWrapper}>` wrapping the Tag
  (DiscrepancyBadge.tsx:77-93, `.multiWrapper` in the module). Every data-* /
  aria-label the e2e spec asserts (`data-testid`, `data-discrepancy-status`,
  `data-discrepancy-count`, `aria-label`) still renders on the Tag. No regression.
  (Note: `SearchFilterBar` passes `title` to `DismissibleTag`, not `Tag` — that is a
  real, non-reserved prop on `DismissibleTag` (verified `DismissibleTag.d.ts:65`),
  so it is NOT a reintroduction of the W2 defect.)
- **W3 — FIXED (verified at source).** The count pill is now `<Tag as="span" …>`
  (JuryPackageNavItem.tsx:30-38), so a `<span>` renders inside SideNavLinkText's
  `<span>` instead of a block `<div>`. `data-testid="jury-count-badge"` and the
  aria-label are unchanged. No regression.
- **N1 — STILL PRESENT → folded into W1 as a follow-up WARNING below.** The two dead
  Tailwind classes in `src/app/jury-package/page.tsx:23,27` remain (grep-confirmed as
  the only two remaining Tailwind `className`s in `src/`). Same cosmetic class as W1.

### Observation (out of phase-6 diff scope — NOT a finding): persistent e2e DB state
Running the full Playwright suite in this workspace currently shows **3 failures**
(`case-workspace-discrepancies` P-2, P-3; `jury-package` full-flow). Root cause is
**persistent backend database state**, not the phase-6 diff:
- P-2/P-3 assert `data-discrepancy-status="OPEN"` but the server now returns
  `ACKNOWLEDGED` (the failure log shows the Tag faithfully rendering the server's
  `ACKNOWLEDGED` status with all data-* attributes intact). The jury full-flow test
  then times out on `jury-acknowledge-trigger` because there is nothing left to
  acknowledge — the gate is already clear.
- These fail even running the discrepancy spec **in isolation with `--workers=1`**,
  so it is not inter-spec worker bleed; it is accumulated DB mutation.
- `playwright.config` has **no `globalSetup` and no DB reset/seed** in its
  `webServer` command (`npm run dev` only); the Prisma DB persists across runs and
  `npm run seed` must be run manually. A prior run of the jury flow wrote the
  acknowledgements that now poison re-runs.
- The three fixer commits touch **only** `.module.scss` + presentational `.tsx`
  (`git diff --name-only 348a410^ 53a38b7` = components/pages + modules, zero
  hook/api/route/seed/prisma files), and every asserted selector still resolves.
  So this is **not a regression from the fixes and not a defect in the styling diff**
  — it is a test-harness state-reset gap pre-dating this phase. Recommend reseeding
  (`npm run seed`) before the gate re-runs; flagged here for the orchestrator, not
  classified as a phase-6 BLOCKER/WARNING.

---

# Phase 6 Code Review (iteration 1, retained below)

Phase 6 migrates the UI from Tailwind/shadcn to IBM Carbon Design System. Non-goal:
any change to functionality, data behavior, API routes, or Playwright-asserted
behaviors — rendering/styling only.

The critical behavioral contracts called out for this phase all survive review:

- **US-11.2 hard-disabled finalize gate** — PASS. `JuryPackageDraft` finalize is a
  Carbon `<Button disabled={hasOpen || finalizePending}>` with no `href`/`as`;
  `@carbon/react` ButtonBase renders a native `<button>` and spreads the native
  `disabled` attribute (verified in `ButtonBase.js:54,77-86`). Remains a true
  native disable, not aria-only. `jury-package.spec.ts` `toBeDisabled()` matches.
- **`#event-{id}` deep-link anchors** — PASS. `Timeline.tsx` preserves
  `id={`event-${entry.eventId}`}`, `data-highlighted`, and
  `aria-label="Exhibit history timeline"` byte-for-byte; `exhibit/[id]/page.tsx`
  keeps the `?event=` read → `getElementById` → scroll+highlight (400ms) logic and
  the top-of-timeline fallback for absent/masked ids.
- **Sealed-exhibit filtering** — PASS (untouched). Filtering remains server/hook
  side (`ObjectionsPanel`/`DiscrepanciesPanel`/nav count read role-scoped hooks);
  no client-side re-derivation was introduced.
- **Assistant three outcome states** — PASS. grounded/decline render via
  `MessageBubble` (`data-outcome` grounded|decline, decline = same bubble minus
  pills, no error styling); unavailable is a structurally distinct Carbon
  `InlineNotification kind="warning"` (`assistant-unavailable`, role="alert",
  retry re-submits preserved question). Matches `assistant.spec.ts` lines 261-333.
- **data-testid / aria-label contracts** — PASS. Spot-checked Carbon prop
  forwarding at source: `Tag` spreads `...other` (data-*/aria-label) onto its
  root; `TableRow` spreads `...cleanProps` (onClick/data-* → `<tr>`); `TextArea`,
  `TextInput`, `Select`, `Button` forward testids to their native elements.
  `getByLabel('Current status: …')` resolves against `StatusBadge`'s forwarded
  `aria-label`.

No BLOCKERs. Three WARNINGs below are styling-fidelity defects (they defeat the
phase's rendering GOAL) but do not touch functionality, data, or any
Playwright-asserted selector, consistent with the green phase gate.

## BLOCKERs

None.

## WARNINGs

> **Iteration-2 status:** W1, W2, W3 all **FIXED** (verified at source — see the
> Iteration 2 verdict above). The one open WARNING carried into iteration 2 is **W4**
> (formerly N1), the last two dead Tailwind classes in `jury-package/page.tsx`.

### W4 (was N1): Two dead Tailwind classes remain in `src/app/jury-package/page.tsx` (same cosmetic class as W1, outside W1's original file list)
- **File:** src/app/jury-package/page.tsx:23,27
- **Category:** bug (styling regression — advisory)
- **Status:** OPEN (not addressed by commits 348a410/95694a7/53a38b7).
- **Evidence:** The loading state `<p className="text-sm text-gray-500">Loading jury
  package…</p>` (line 23) and the error state `<p className="text-sm text-red-600">…</p>`
  (line 27) are live Tailwind utilities that compile to no CSS after the wave 06-09
  Tailwind-pipeline removal — identical in kind to W1. A repo-wide grep confirms these
  are now the ONLY two remaining Tailwind `className`s in `src/`, so fixing them makes
  the 06-09 "zero Tailwind references across src/" claim finally hold. Impact is purely
  cosmetic: the two transient status lines lose their small-muted / red-error styling
  and render as default body text. No functionality, data, or Playwright-asserted
  selector is involved (both are plain `<p>` text with no testid), so this is advisory,
  not blocking — a WARNING, consistent with the styling-only migration framing.
- **Fix direction:** Add a co-located `jury-package/page.module.scss` with a muted
  caption class (`$text-secondary`, `body-compact-01`) and an error class
  (`$text-error`) mirroring the W1 modules, and replace the two Tailwind strings — same
  pattern already applied to `app/case/page.tsx`.

### W1: Dead Tailwind utility classes left on Carbon-migrated elements after the Tailwind pipeline was removed
- **File:** src/components/jury/AcknowledgeInline.tsx:38,53,56,61,84; src/components/case/SearchFilterBar.tsx:31,32,42,74,96,101,102; src/components/case/ExhibitTable.tsx:20,45,50; src/app/case/page.tsx:26,37
- **Category:** bug (styling regression)
- **Evidence:** Wave 09 (`8f50854`) removed Tailwind entirely — deleted
  `globals.css` (`@import "tailwindcss"`), `postcss.config.mjs`, and the
  `tailwindcss`/`@tailwindcss/postcss` deps; `globals.scss` now imports only
  `@carbon/react`. After that removal, the Tailwind utility classes still present
  on these phase-migrated elements compile to **no CSS** and have zero effect.
  Concrete visual losses: `AcknowledgeInline`'s inline box loses its entire
  treatment — `mt-2 rounded border border-amber-200 bg-amber-50/50 p-2` (the amber
  bordered/tinted container), `mt-1 flex items-center justify-between` (the
  counter↔buttons row), `flex gap-2` (Cancel/Confirm spacing), and the
  `text-xs text-amber-700` / `text-xs text-red-600` caption colors all become
  inert, collapsing the control to unstyled stacked block elements.
  `SearchFilterBar` loses its `flex flex-wrap items-center gap-2` filter row and
  chip-row layout plus `max-w-*` field widths; `ExhibitTable`/`case/page.tsx` lose
  their muted empty-state text, row `cursor-pointer`, and heading sizing. This also
  directly contradicts 06-09-SUMMARY.md's claim "Zero Tailwind/shadcn references
  anywhere in src/" (verified false: 18 live `className` utility references across
  the phase-touched files above — a grep for `(?:flex|mb-|gap-|text-xs|bg-|max-w|rounded|font-medium|items-center)` matches each). Tests remain green because
  they assert on data-testid/aria-label, not computed styles — so this is degraded
  rendering, not broken behavior.
- **Fix direction:** Replace the remaining Tailwind utility classes on these four
  files with the same CSS-Module-token pattern used by the already-clean Carbon
  components (e.g. `JuryPackageDraft.module.scss`, `RecentActivityPanel.module.scss`)
  — most importantly restoring `AcknowledgeInline`'s amber bordered container and
  the two flex rows, and `SearchFilterBar`'s flex filter/chip rows. Then re-verify
  the 06-09 "zero Tailwind references" claim actually holds across `src/`.
- **Resolution:** fixed (commit for W1). Added co-located CSS Modules
  (`AcknowledgeInline.module.scss`, `SearchFilterBar.module.scss`,
  `ExhibitTable.module.scss`, `src/app/case/page.module.scss`) using Carbon
  theme/spacing/type/color tokens, and replaced all 18 Tailwind utility classes
  across the four named files with those module classes — restoring the amber
  bordered container + two flex rows (AcknowledgeInline) and the flex filter/chip
  rows + field widths (SearchFilterBar). tsc + build green; vitest 195 and
  Playwright 36 remain green. Note: the "zero Tailwind references across src/"
  re-verification surfaced TWO MORE dead Tailwind classes NOT in this finding's
  file list — `src/app/jury-package/page.tsx:23,27`
  (`text-sm text-gray-500` / `text-sm text-red-600`). These were left untouched
  (out of W1's enumerated scope) and are recorded below for re-review.

### W2: Multi-flag DiscrepancyBadge drops its `title` hover tooltip (reserved Carbon Tag prop)
- **File:** src/components/case/DiscrepancyBadge.tsx:81
- **Category:** bug (minor accessibility/UX)
- **Evidence:** The multi-flag branch passes `title={sentence}` intending the HTML
  tooltip "label1, label2 (Ack'd), …". But `title` is a *reserved* prop on Carbon
  `Tag` (defaults to `"Clear filter"`, destructured out at `Tag.js:49` and only
  applied as the dismiss-button aria-label when `filter` is set). Since `filter` is
  not set here, `title` is swallowed and never reaches the rendered `<div>`, so the
  hover tooltip is lost. The information itself is NOT lost — the full sentence is
  still exposed via `aria-label={`${n} discrepancies: ${sentence}`}` and the
  visible `.detailSentence` span — and no test asserts the `title` attribute
  (`case-workspace-discrepancies.spec.ts` only checks `data-discrepancy-status` +
  badge count). Hence degraded, not broken.
- **Fix direction:** Move the tooltip onto a plain wrapping element (e.g. a
  `<span title={sentence}>` around the Tag, or the Tag's child span) rather than
  passing `title` to the Tag, so the mouse-hover affordance returns without
  colliding with Carbon's reserved prop.
- **Resolution:** fixed (commit for W2). Verified the claim at source
  (`Tag.js`: `title` is destructured out of props and only re-applied as the
  dismiss-button aria-label when `filter` is set, so it never reaches the
  non-filter `<div>`). Wrapped the multi-flag Tag in an inline-block
  `<span title={sentence}>` (new `.multiWrapper` style) and removed `title` from
  the Tag. All `data-*`/`aria-label` attributes the e2e spec asserts stay on the
  Tag; `data-testid="discrepancy-badge"` + `data-discrepancy-status` resolve
  unchanged through the transparent wrapper. tsc + build + both suites green.

### W3: Jury-count badge renders a `<div>` inside a `<span>` (invalid nesting)
- **File:** src/components/shell/JuryPackageNavItem.tsx:27-34
- **Category:** bug (minor / HTML validity)
- **Evidence:** `SideNavLink` wraps ALL children in `<SideNavLinkText>`, which
  renders a `<span class="cds--side-nav__link-text">` (verified `SideNavLink.js:45`).
  The ambient-count `Tag` renders a `<div>` (non-interactive Tag → `"div"`,
  `Tag.js:114`), producing a `<div>` nested inside a `<span>` — invalid HTML.
  Browsers tolerate it and the `jury-count-badge` testid + `aria-label` remain
  reachable (no e2e test asserts this badge), so it is non-breaking, but it can
  cause hydration-mismatch warnings and unpredictable inline layout of the pill.
- **Fix direction:** Render the count pill as an inline element (e.g. Tag `as="span"`
  or a styled `<span>`), or place it outside `SideNavLinkText` via a renderIcon/
  adjacent node, so a block `<div>` is not nested in the link-text `<span>`.
- **Resolution:** fixed (commit for W3). Verified Carbon Tag honors
  `ComponentTag = BaseComponent ?? (...)` (`Tag.js`), so `as="span"` renders a
  `<span>` instead of the default `<div>`. Set `as="span"` on the count Tag so
  the pill is a valid inline element inside SideNavLinkText's `<span>`;
  `data-testid="jury-count-badge"` and `aria-label` unchanged (no e2e asserts
  this badge). tsc + build + both suites green.

## Newly-discovered defects (for re-review — NOT fixed in this pass)

### N1: Two more dead Tailwind classes in `src/app/jury-package/page.tsx` (same class as W1, outside W1's file list)
- **File:** src/app/jury-package/page.tsx:23,27
- **Category:** bug (styling regression)
- **Evidence:** The loading state `<p className="text-sm text-gray-500">Loading
  jury package…</p>` and the error state `<p className="text-sm text-red-600">…`
  are live Tailwind utility classes that compile to nothing after the wave 06-09
  pipeline removal — identical in kind to W1, but this file was not among W1's
  four enumerated files. Left untouched this pass to keep the W1 diff scoped to
  the named files. The broader 06-09 "zero Tailwind references across src/" claim
  therefore still does not fully hold until these two are migrated to a
  Carbon-token CSS Module. Recommend folding into a W1 follow-up.

## Cross-file seams checked
- StatusBadge `aria-label="Current status: {Label}"` ↔ exhibit-detail.spec.ts `getByLabel` (Tag forwards aria-label) — OK
- CitationPill `data-record-type`/`data-event-id` + `?event=` href ↔ assistant.spec.ts deep-link + Timeline `#event-{id}` — OK
- MessageBubble `data-outcome` ↔ AssistantThread per-message outcome derivation (citations.length) ↔ assistant.spec.ts — OK
- AssistantThread `assistant-unavailable` InlineNotification title ↔ `toContainText('temporarily unavailable')` — OK
- AssistantPanel `data-open`/`assistant-panel` ↔ assistant.spec.ts panel-stays-open — OK
- Header Carbon `Select`→native `<select>` onChange(e.target.value) ↔ roleStore.setActiveUser + app-shell.spec.ts option assertions — OK
- ExhibitTable Carbon `TableRow onClick`→`<tr>` router.push ↔ case-workspace.spec.ts row click nav — OK
- SearchFilterBar Carbon `Dropdown onChange({selectedItem})` ↔ `ExhibitFilters.status` shape — OK
- JuryPackageDraft finalize `disabled` (native) ↔ jury-package.spec.ts `toBeDisabled/toBeEnabled` — OK
- AcknowledgeInline `canConfirm` gate (trim>0) + `acknowledge-*` testids ↔ jury-package.spec.ts empty-disabled Confirm — OK
- JuryPackageFinalized `jury-print-root`/`no-print`/`window.print()` ↔ 06-01 print CSS + export test — OK
- Sidebar/JuryPackageNavItem `SideNavLink as={Link}` ↔ Carbon UIShell Link `as` passthrough → Next client routing (assistant.spec.ts link nav) — OK
- Deleted ui/* primitives, `@/lib/utils` (`cn`), lucide-react, cva ↔ no remaining imports in src/ (grep clean) — OK
