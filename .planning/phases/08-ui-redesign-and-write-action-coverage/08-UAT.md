---
status: complete
phase: 08-ui-redesign-and-write-action-coverage
source: 08-01-SUMMARY.md, 08-02-SUMMARY.md, 08-03-SUMMARY.md, 08-04-SUMMARY.md, 08-05-SUMMARY.md, 08-06-SUMMARY.md, 08-07-SUMMARY.md, 08-08-SUMMARY.md, 08-09-SUMMARY.md, 08-10-SUMMARY.md, 08-11-SUMMARY.md, 08-12-SUMMARY.md, 08-13-SUMMARY.md, 08-14-SUMMARY.md, 08-15-SUMMARY.md, 08-16-SUMMARY.md
started: 2026-10-10T00:23:09.000Z
updated: 2026-10-10T00:48:23.171Z
---

## Current Test

[testing complete]

## Tests

### 2. Command Center — Stat Cards & Status Distribution (re-verify after gap closure)
expected: Command Center shows 4 stat cards (Open objections, Custody gaps, Jury package blockers, Admitted X of Y) with no overlap between the left sidebar and the header's role-switcher dropdown. Below the stat cards, the status breakdown is shown ONLY as a simple dot+label+count legend for the 6 exhibit statuses (matching the real counts) — the loud multi-colored segmented bar is gone.
result: pass
reported: "it passes. Make the left rail collapsible. The role text and drop down should align right after the left rail at the top."

## Summary

total: 1
passed: 1
issues: 0
pending: 0
skipped: 0

## Self-Check

boot: 307 (cold docker compose build+boot raced the initial probe — boot_busy wait resolved to 307→200 after ~45s)
data: all preconditions present — fresh seed loaded on container boot (case 2026-CR-0142, 11 exhibits incl. P-6/P-7 legacy-admit fixtures, 6 users)
routes_probed: 3 ok / 0 failed (/, /command-center, /preview/3000/ proxy)
cookie: n/a — no session/cookie infrastructure in this app (role switching via X-User-Role header + client store)
browser_urls: none
repairs: []
e2e: skipped (insufficient free memory: 286 MB available)
per_test:
  - test: 2
    verdict: pass
    note: "🤖 Source-verified the committed fix for both halves of the gap: (1) Sidebar.module.scss now sets `inset-block-start: 3rem` / `block-size: calc(100% - 3rem)` on `.cds--side-nav`, matching AppShell's `padding-top: 3rem` header-height constant — the SideNav can no longer paint over the Header's band regardless of DOM nesting. (2) Fetched the live-rendered /command-center HTML as JUDGE: response contains the `status-distribution-legend` marker but ZERO occurrences of `status-distribution-bar` or any `status-segment-*` testid — the segmented bar markup is gone from the actual served page, not just the source. GET .../activity confirms statusCounts {MARKED:1,OFFERED:1,OBJECTED:2,ADMITTED:5,EXCLUDED:1,WITHDRAWN:1} still available for the legend to render. The committed Playwright regression (app-shell.spec.ts bounding-box/hit-test, command-center.spec.ts bar-absence) could not be re-executed this session (286 MB free, below the 1024 MB floor for a headless Chromium) — per 08-16-SUMMARY both suites were proven 8/8 and 24/24 green at commit time. Visual confirmation that the layout reads cleanly (spacing, no residual visual crowding) is left to the human."
    confidence: proven

## Gaps

[none yet]
