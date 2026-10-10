---
status: complete
phase: 09-ui-tickets-and-typography-standard
source: 09-18-SUMMARY.md, 09-19-SUMMARY.md, 09-20-SUMMARY.md
started: 2026-10-10T22:50:46Z
updated: 2026-10-10T23:01:09Z
---

## Current Test

[testing complete]

## Tests

### 6. Jury-package eligibility 4-value column (T-06) — row styling fix
expected: On the Case Workspace exhibit table, every row renders cleanly: the Description column takes up the remaining table width (not cramped), the trailing chevron column stays a fixed narrow width, and the Flags column's pills (e.g. "Ex parte · restricted") never visually overflow into the adjacent Jury Package column — no broken/overlapping cells.
result: issue
reported: "The description should be in line with all the other columns. all columns should show up in one row."
severity: major

### 9. Demo role switcher safeguards (T-09) — banner visibility fix
expected: After switching the demo role, the "Active role: X — switch back" banner text is fully visible and readable — not hidden/clipped under the left sidebar.
result: pass

### 16. Spacing & button-size consistency (T-14) — header alignment fix
expected: The "Demo role:" label text is no longer visibly shown next to the role switcher, and the role-switcher dropdown's left edge lines up with the left edge of the page title (e.g. "Trial Command Center").
result: pass

## Summary

total: 3
passed: 2
issues: 1
pending: 0
skipped: 0

## Self-Check

boot: 307 (booted during self-check wait window; docker compose up --build was in progress at session start — migrate+seed completed within ~15s of the first probe)
data: all preconditions present — seeded case 2026-CR-0142 live via GET /api/case; exhibit list confirms P-6 (ADMITTED_NO_CUSTODIAN, OPEN) and P-7 (UNRESOLVED_OBJECTION_JURY_ELIGIBLE, OPEN) flags live via GET /api/cases/:id/exhibits — the exact rows test 6's reported overflow concerned. No additional seeding needed; all 3 re-tested flows are pure CSS/layout fixes over data that was already live last round.
routes_probed: 3 ok / 0 failed (/, /command-center, preview-proxy /preview/3000/ — all reachable; app and db containers healthy)
cookie: n/a (no cookie-based auth in this app; role switching is client-side zustand state, not session cookies)
browser_urls: 0 gaps / 0 advisories (root page scan found only w3.org, no internal-host leak)
repairs: # none — self-check made zero changes to the running instance or committed code
per_test:
  - test: 6
    verdict: advisory
    note: "🤖 Auto-check: 09-19's fix (commits a525724/7d48914) is present at HEAD — ExhibitTable.module.scss now compounds `.table :global(.cds--data-table) th:last-of-type.colChevron` to win the specificity fight against Carbon's own last-of-type auto-width rule, and `.colFlags` is widened 10rem→13rem. The exact flagged data (P-6/P-7 with real OPEN flags) is confirmed live via the API. A committed Playwright regression test (zero cell-overlap bounding-box assertion) already passed 19/20 in 09-19's own verification. This run could not re-render the page visually — the sandbox had only 1MB free memory headroom, far below the 1024MB floor for a headless browser — so the CSS fix's effect cannot be independently re-confirmed pixel-for-pixel here; code presence + prior green regression test + live data are the available evidence."
    confidence: hypothesis
  - test: 9
    verdict: advisory
    note: "🤖 Auto-check: 09-20's fix (commit f99f866) is present at HEAD — ActiveRoleBanner.module.scss's `.banner` now has `padding-inline-start: 16rem` matching the sidebar rail width. A committed Playwright regression test (banner-not-obscured-by-sidebar bounding-box + center-point hit-test) already passed 14/14 in 09-20's own verification. Visual re-confirmation needs a browser render, skipped here per the memory floor (see test 6)."
    confidence: hypothesis
  - test: 16
    verdict: pass
    note: "🤖 Auto-check: 09-20's fix (commits 3100c07/f99f866) is present at HEAD and DIRECTLY confirmed live in this session's own HTML probe — GET /command-center's rendered DOM shows `<label for=\"role-switcher\" class=\"cds--label cds--visually-hidden\">Demo role:</label>` (the label is present for accessibility but visually hidden, confirming the 'no visible Demo role: text' half) and the switcher's wrapping div carries the new `roleSwitcherWrap` class (absolutely positioned at 17.5rem, matching the page title's own left edge per the component's own in-code measurement comment). The alignment math itself (pixel-equal to the title) needs a browser render to confirm visually, but the label-hiding mechanism is directly observed, not inferred."
    confidence: proven

## Gaps

- truth: "On the Case Workspace exhibit table, every column in a row renders in a single horizontal line (Description, Status, Flags, Jury Package, etc. all aligned on one row) with no column wrapping onto its own line"
  status: failed
  reason: "User reported: The description should be in line with all the other columns. all columns should show up in one row."
  severity: major
  test: 6
  source: user
  confidence: hypothesis
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
