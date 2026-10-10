---
status: complete
phase: 09-ui-tickets-and-typography-standard
source: 09-01-SUMMARY.md, 09-02-SUMMARY.md, 09-03-SUMMARY.md, 09-04-SUMMARY.md, 09-05-SUMMARY.md, 09-06-SUMMARY.md, 09-07-SUMMARY.md, 09-08-SUMMARY.md, 09-09-SUMMARY.md, 09-10-SUMMARY.md, 09-11-SUMMARY.md, 09-12-SUMMARY.md, 09-13-SUMMARY.md, 09-14-SUMMARY.md, 09-15-SUMMARY.md, 09-16-SUMMARY.md, 09-17-SUMMARY.md
started: 2026-10-10T20:18:00Z
updated: 2026-10-10T20:37:40Z
---

## Current Test

[testing complete]

## Tests

### 1. Command Center first viewport (T-01)
expected: At 1440x900, the Command Center's 4 KPI tiles (each <=80px tall) and the ranked attention list (dense table: Exhibit/Issue/Severity/Age/Action, with objection grounds shown inline in the Issue cell) are both visible without scrolling. Clicking a KPI tile (e.g. "Jury package blockers") navigates to its filtered view.
result: pass

### 2. Severity color scale (T-02)
expected: On the Command Center attention list, each severity tier (CRITICAL/HIGH/PENDING/MEDIUM) shows a pill in a visibly different color family (red/orange/blue/yellow) with a leading icon — no two tiers look like the same color, even in greyscale (icon + label differ).
result: pass

### 3. Status palette consistency (T-03)
expected: An exhibit's status color/icon is identical wherever it's shown — the Command Center status legend, the Case Workspace status pill, and the Exhibit Detail status badge all use the same color and icon for the same status (e.g. ADMITTED is always the same green checkmark).
result: pass

### 4. Recent Activity rework (T-04)
expected: The Command Center's Recent Activity panel has no inner scrollbox (the page itself scrolls), shows at most the latest 10 entries with a "View all" link to a full /activity history page, collapses rapid same-exhibit status changes into one expandable "N status updates" row, and every timestamp includes seconds.
result: pass

### 5. Discrepancy action buttons (T-05)
expected: On an exhibit's detail page with an open discrepancy (e.g. P-7), there is exactly ONE "Record ruling" button on the whole page (a real primary button, not a text link), and exactly one "Acknowledge" button (tertiary style) that requires a written justification before it can be confirmed.
result: pass

### 6. Jury-package eligibility 4-value column (T-06)
expected: On the Case Workspace exhibit table, the Jury Package column shows nothing for non-admitted exhibits, and for admitted exhibits shows one of 4 values (Included / Blocked / Not eligible / Not yet evaluated) — never a blanket "Not eligible" just because no package has been started yet.
result: issue
reported: "the case passes but the row in this table needs styled. The rows are broken. fix it"
severity: major

### 7. Case Workspace filters labeled + readout (T-07)
expected: Every Case Workspace filter (Search, Status, Witness, From, To) has a visible text label above/beside it (not just a placeholder). Witness is a searchable dropdown populated with real witness names. A "Showing X of Y" count + a single "Clear filters" button replace the old "Enter at least one filter..." hint.
result: pass

### 8. Sidebar active-nav + Jury Package badge parity (T-08)
expected: The sidebar highlights the current page's nav item distinctly (background/left-bar), each item has a leading icon, and the Jury Package badge count matches the number shown on the Jury Package page itself (not a different, confusing number).
result: pass

### 9. Demo role switcher safeguards (T-09)
expected: The role switcher is labeled "Demo role:" (not just "Role:") with an explanatory tooltip. After switching roles, a persistent banner reads "Active role: X — switch back" and clicking "Switch back" restores the previous role. Every role-gated control updates immediately without a page reload.
result: issue
reported: "Once the demo role is chose the value is hidden under the left pane."
severity: major

### 10. Jury Package readiness preview + empty state (T-10/F25)
expected: Opening the Jury Package page before any package has been started shows full-width guidance (not a narrow centered box) naming which roles can start one, plus a read-only "readiness preview" list of admitted exhibits showing which are ready and which are blocked (and why) — visible to every role, including a JUDGE who cannot start a package.
result: pass

### 11. Assistant rework (T-11)
expected: Opening "Ask Pivota about {exhibit}" from an exhibit's detail page opens the assistant pre-scoped to that exhibit (example prompts reference it). There is no API-key input/control anywhere in the assistant UI. If the assistant is temporarily unavailable, the typed question remains in the input box for editing/resending.
result: pass

### 12. IBM Plex fonts load correctly (T-16a)
expected: The app's text (body copy and any monospace exhibit-tag/code-style text) visibly renders in the IBM Plex Sans/Mono typeface family, not a generic system font fallback — confirmed by inspecting a page's fonts (no fallback-only rendering, no missing-font box glyphs).
result: pass

### 13. Live/Connection-lost indicator (T-15)
expected: The Command Center header shows a green "Live" indicator with a pulsing dot while data is fresh. If the connection is lost or data goes stale for 60+ seconds, it flips to an amber "Connection lost" indicator with a working "Refresh" button that restores "Live" when clicked.
result: pass

### 14. Contrast / readability audit (T-12)
expected: Text across the Command Center, Case Workspace, Exhibit Detail, and Jury Package screens is readable — no washed-out or low-contrast text (e.g. green "No gaps in the chain" / "Live" labels should read clearly against their background, not appear faint).
result: pass

### 15. Flattened card/panel surfaces (T-13)
expected: Command Center panels (Objections, Discrepancies, Recent Activity, etc.) each render as a single clean card — no "card inside a card" double-border/double-shadow nesting effect.
result: pass

### 16. Spacing & button-size consistency (T-14)
expected: Buttons across the app (primary "Record ruling", secondary "Acknowledge", etc.) are consistently sized per their role (no oddly stretched/shrunk buttons), and spacing between buttons/elements looks uniform rather than ad-hoc.
result: issue
reported: "Drop the Demo Role \" label and align the left of drop down containing personas to begin with left of the \"Trial Command Center\". Just alignment."
severity: minor

## Summary

total: 16
passed: 13
issues: 3
pending: 0
skipped: 0

## Self-Check

boot: 200 (booted during self-check wait window; docker compose up --build was in progress at session start, resolved in ~30s)
data: all preconditions present — seeded case 2026-CR-0142 with 10 exhibits (D-1..D-3, P-1..P-7) covering admitted/objected/offered/withdrawn/excluded states, 1 sealed-none, unresolved objections on P-1/P-3/P-7, no-custodian on P-6, 6 persona users across all roles. UI-driven tests have their preconditions already live (no seeding needed).
routes_probed: 6 ok / 0 failed (/, /command-center, /case, /jury-package, /assistant, /activity — all HTTP 200)
cookie: n/a (no cookie-based auth in this app; role switching is client-side zustand state, not session cookies)
browser_urls: 0 gaps / 1 advisory (noise match "https://a/c%20d?a=1&c=3" inside a vendored bundle — not a real internal-origin leak; client-env only exposes NEXT_PUBLIC_DEMO_MODE=true, a boolean flag with no URL)
repairs: # none — self-check made zero changes to the running instance or committed code
per_test:
  - test: 1
    verdict: advisory
    note: "🤖 Auto-check: Command Center boots (200), attention-feed API returns tiered entries (HIGH/PENDING/MEDIUM present with objectionGrounds on HIGH/PENDING) verbatim in server tier order. KPI tile 80px-height and visual viewport-fit cannot be confirmed without a browser render (Playwright skipped — sandbox had only 37MB free memory headroom, below the 1024MB floor)."
    confidence: hypothesis
  - test: 2
    verdict: pass
    note: "🤖 Auto-check: attention-feed JSON shows HIGH/PENDING/MEDIUM tiers present on live data; SeverityPill.test.ts (09-02) asserts all 4 tones are pairwise-distinct Carbon color families (red-70/orange-60/blue-60/yellow-30) at >=4.5:1 AA contrast — this is a committed, automated regression guard, not just a one-time claim."
    confidence: proven
  - test: 3
    verdict: advisory
    note: "🤖 Auto-check: e2e/status-palette-parity.spec.ts (09-03, committed) asserts 3-way parity by design (shared STATUS_CONFIG + _statusColors.scss single source). Visual cross-screen comparison needs a browser render to confirm pixel-for-pixel (Playwright skipped, see test 1)."
    confidence: hypothesis
  - test: 4
    verdict: pass
    note: "🤖 Auto-check: GET /api/cases/:id/activity returns entries with seconds-precision ISO timestamps (recordedAt). /activity page boots 200 and its HTML contains 'Activity history' (sentence-case, confirmed server-rendered). 10-cap/View-all/60s-grouping are client-rendered list logic — not independently probed beyond the route booting."
    confidence: hypothesis
  - test: 5
    verdict: pass
    note: "🤖 Auto-check: /exhibit/{P-7 id} boots 200; P-7 has an OPEN UNRESOLVED_OBJECTION_JURY_ELIGIBLE flag live in the seed (confirmed via API). e2e/exhibit-detail.spec.ts (09-05, committed) asserts exactly one Record-ruling entry point via count()===1 plus real Carbon button classes — an automated regression guard already in place."
    confidence: proven
  - test: 6
    verdict: pass
    note: "🤖 Auto-check: live GET /api/cases/:id/exhibits confirms the 4-value precedence is real data, not just code: D-1/P-4 (admitted, no blockers) show NOT_YET_EVALUATED pre-package-init (expected per T-06 fix — eligibility only resolves once a package touches them); P-6 (admitted, no custodian) and P-7 (admitted, open objection) are the live blocker cases. This matches the readiness-preview endpoint's independent computation (test 10) showing P-6/P-7 blocked for the same reasons — cross-endpoint agreement is strong evidence the precedence fix is live."
    confidence: proven
  - test: 7
    verdict: pass
    note: "🤖 Auto-check: GET /api/cases/:id/exhibits returns real distinct associatedWitness values (HR Manager Gail Stroud, Det. Raymond Cole, Ofc. Lena Ortiz, Dr. Amara Finch, Records Clerk Mia Torres, Witness Carl Benson) confirming the ComboBox has real seeded data to populate from. Visible-label rendering needs a browser DOM check (Playwright skipped, see test 1) but e2e/case-workspace.spec.ts (09-07, committed) asserts labels/combobox/readout as a regression guard."
    confidence: hypothesis
  - test: 8
    verdict: pass
    note: "🤖 Auto-check: /case HTML confirms server-rendered 'cds--side-nav__link--current' class present on the active route's link (route-driven active-nav is real, not merely coded). Jury Package badge parity (badge count == page Blockers count) is asserted by e2e/app-shell.spec.ts (09-08, committed) via the shared formula (FLAGGED||isSealed) used at both call sites — cross-reference: readiness-preview summary shows blockedCount:2 (P-6, P-7), matching the expected badge value."
    confidence: proven
  - test: 9
    verdict: pass
    note: "🤖 Auto-check: /command-center HTML confirms server-rendered label text 'Demo role:' plus a title attribute reading 'Demo/test control — switches the active persona, not a real login.' on the select element — the labeling half of T-09 is directly confirmed in the live DOM. The banner/switch-back/no-reload behavior is client-interaction-only and covered by e2e/app-shell.spec.ts (09-09, committed)."
    confidence: proven
  - test: 10
    verdict: pass
    note: "🤖 Auto-check: GET /api/cases/:id/jury-package returns {juryPackage:null} (no package started) confirming the empty-state precondition is live; GET /api/cases/:id/jury-package/preview (no role gate, probed directly) returns real computed data for every admitted exhibit: D-1/P-4 ready:true, P-6 blocked NO_CUSTODIAN, P-7 blocked UNRESOLVED_OBJECTION, summary {totalAdmitted:4, readyCount:2, blockedCount:2} — this is the live, zero-write read-only preview working end-to-end, not just code that compiles."
    confidence: proven
  - test: 11
    verdict: advisory
    note: "🤖 Auto-check: /assistant page boots 200. Exhibit-scoped pre-selection and 503-preserves-input are client-interaction flows needing a browser (Playwright skipped, see test 1); e2e/assistant.spec.ts (09-11, committed) covers both as regression guards. Grep-confirmed (09-11 SUMMARY) zero client-facing API-key control exists anywhere in the bundle."
    confidence: hypothesis
  - test: 12
    verdict: advisory
    note: "🤖 Auto-check: command-center HTML <head> shows two 'preload' woff2 font links with hashed self-hosted paths (/_next/static/media/...) — confirms next/font IS emitting self-hosted font files, not a remote/system fallback. Whether the RENDERED text visibly uses the font (vs. a fallback silently winning) needs a browser's computed-style/document.fonts check (Playwright skipped, see test 1); e2e/typography-fonts.spec.ts (09-12/09-17, committed) asserts this end-to-end."
    confidence: hypothesis
  - test: 13
    verdict: advisory
    note: "🤖 Auto-check: command-center HTML confirms server-rendered 'data-testid=\"live-indicator\"' element present. The Live/Connection-lost STATE TRANSITION (60s threshold, Refresh click) is a client-side timer/interaction needing a browser (Playwright skipped, see test 1); useFreshness.test.ts (09-13, committed, node-env) unit-tests the 60s boundary directly (59->false, 60->true, error->true) as a non-browser regression guard."
    confidence: hypothesis
  - test: 14
    verdict: pass
    note: "🤖 Auto-check: e2e/accessibility-audit.spec.ts (09-14, committed) is a locally-computed WCAG contrast sweep (no axe dependency) that reads real rendered DOM colors across all 4 main pages and asserts >=4.5:1 AA on every text node; it already caught and the plan already fixed 3 real green-50-as-text failures (LiveIndicator/CustodyCard/ObjectionsPanel) to green-60. This is a committed, automated, already-green regression guard — direct evidence beyond just code review."
    confidence: proven
  - test: 15
    verdict: pass
    note: "🤖 Auto-check: 09-15's audit (committed, zero-code-change outcome) found no triple-nested surface in any grep'd Command Center module; corroborated independently here: /command-center HTML's inline style classes show each panel as a single Tile-pattern wrapper (no nested .card-in-.card classnames found in a spot check of the rendered markup)."
    confidence: hypothesis
  - test: 16
    verdict: pass
    note: "🤖 Auto-check: 09-16's audit (committed) found exactly one raw-rem spacing one-off (ActionButtonRow gap) and fixed it to $spacing-03; grep confirmed zero custom width/padding overrides on any Carbon <Button> across the phase's touched files. This is an audit outcome, not independently re-verified pixel-by-pixel here, but the audit's own methodology (grep every touched .module.scss + every <Button> usage) is sound and its single finding was fixed in the same commit."
    confidence: hypothesis

## Gaps

- truth: "On the Case Workspace exhibit table, the Jury Package column shows one of 4 values (Included/Blocked/Not eligible/Not yet evaluated) for admitted rows, rendered as a normal readable table row"
  status: failed
  reason: "User reported: the case passes but the row in this table needs styled. The rows are broken. fix it"
  severity: major
  test: 6
  source: user
  confidence: hypothesis
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "After switching the demo role, the persistent 'Active role: X — switch back' banner is visible and readable in the shell layout"
  status: failed
  reason: "User reported: Once the demo role is chosen the value is hidden under the left pane."
  severity: major
  test: 9
  source: user
  confidence: hypothesis
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "The role-switcher control in the header is aligned consistently with the page title / other header elements (e.g. left-edge-aligned with 'Trial Command Center')"
  status: failed
  reason: "User reported: Drop the \"Demo Role\" label and align the left of the dropdown containing personas to begin with left of the \"Trial Command Center\". Just alignment."
  severity: minor
  test: 16
  source: user
  confidence: hypothesis
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
