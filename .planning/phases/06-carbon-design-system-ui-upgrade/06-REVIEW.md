---
phase: 6
status: issues_found
blockers: 0
warnings: 3
files_reviewed: 32
files_reviewed_list:
  - src/app/assistant/page.tsx
  - src/app/case/page.tsx
  - src/app/command-center/page.tsx
  - src/app/exhibit/[id]/page.tsx
  - src/app/globals.scss
  - src/app/layout.tsx
  - src/components/StatusBadge.tsx
  - src/components/assistant/AssistantPanel.tsx
  - src/components/assistant/AssistantThread.tsx
  - src/components/assistant/CitationPill.tsx
  - src/components/assistant/ExampleChips.tsx
  - src/components/assistant/MessageBubble.tsx
  - src/components/case/DiscrepancyBadge.tsx
  - src/components/case/ExhibitTable.tsx
  - src/components/case/SearchFilterBar.tsx
  - src/components/command-center/DiscrepanciesPanel.tsx
  - src/components/command-center/FreshnessIndicator.tsx
  - src/components/command-center/ObjectionsPanel.tsx
  - src/components/command-center/RecentActivityPanel.tsx
  - src/components/exhibit/DiscrepancyBanner.tsx
  - src/components/exhibit/ExhibitHeader.tsx
  - src/components/exhibit/ExhibitNotFound.tsx
  - src/components/exhibit/Timeline.tsx
  - src/components/jury/AcknowledgeInline.tsx
  - src/components/jury/JuryPackageDraft.tsx
  - src/components/jury/JuryPackageEmpty.tsx
  - src/components/jury/JuryPackageFinalized.tsx
  - src/components/shell/AppShell.tsx
  - src/components/shell/Header.tsx
  - src/components/shell/JuryPackageNavItem.tsx
  - src/components/shell/Sidebar.tsx
  - src/lib/utils.ts
reviewed_at: 2026-10-08T00:00:00Z
iteration: 1
---

# Phase 6 Code Review

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
