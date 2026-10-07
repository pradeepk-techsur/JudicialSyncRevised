---
status: complete
phase: 03-jury-package-discrepancy-detection
source: 03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md, 03-04-SUMMARY.md
started: 2026-10-07T14:58:16Z
updated: 2026-10-07T15:50:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Discrepancy Badge Appears on Case Workspace
expected: On the Case Workspace exhibit list, the ⚑ column shows a plain-language amber badge for any admitted exhibit that has no recorded custodian, or that is admitted with a still-unresolved objection.
result: pass

### 2. Exhibit Detail Discrepancy Banner + Acknowledge
expected: Opening a flagged exhibit's Exhibit Detail page shows an amber banner naming the open discrepancy. An authorized role (deputy/clerk/judge/admin) can type a justification and click Confirm; the banner updates to show it acknowledged.
result: pass
reported: "Discrepancies ⚠ No custodian on record (Ack'd)"

### 3. Jury Package Workspace — Empty State
expected: Before anyone has started a jury package, opening /jury-package shows an explicit "no package started yet" message — not a blank page, and merely viewing it does not silently create anything.
result: pass

### 4. Initiate Jury Package Draft
expected: As deputy/clerk/admin, clicking to start a jury package shows a draft table listing the admitted exhibits, each annotated with its current (live) discrepancy status.
result: pass

### 5. Finalize Button Hard-Disabled While Open Discrepancy Exists
expected: While any exhibit in the draft still has an open (unacknowledged) discrepancy, the Finalize button is disabled and an explanatory caption says why.
result: pass

### 6. Acknowledge Discrepancy Inline on Jury Draft
expected: From the jury draft table, typing a justification and confirming acknowledges that exhibit's open discrepancy; its row updates to show acknowledged, and once every flagged exhibit is cleared the Finalize button becomes enabled.
result: pass

### 7. Finalize Jury Package
expected: With no open discrepancies remaining, clicking Finalize completes the package: the screen switches to a read-only finalized view with a clear visual stamp and who/when it was finalized.
result: pass

### 8. Export/Print Finalized Package
expected: From the finalized view, using the export/print action produces a clean, chrome-free printable version of the package (no sidebar/header, a handoff header with the case number).
result: pass

### 9. Sidebar Jury Package Navigation + Live Count Badge
expected: The sidebar's Jury Package link is a live, clickable nav item (not a "soon" placeholder) and shows a count badge reflecting the number of currently-open discrepancies, updating as discrepancies are acknowledged.
result: pass

## Summary

total: 9
passed: 9
issues: 0
pending: 0
skipped: 0

## Self-Check

boot: 307
data: all preconditions present
routes_probed: 6 ok / 0 failed
cookie: n/a
browser_urls: none
repairs:
  - kind: data
    what: "re-ran the project's own committed seed script (npm run seed, same command the Docker CMD boot path runs) to restore the demo case to a clean pre-draft state after this self-check's own API probing (initiate -> acknowledge x2 -> finalize) had finalized a jury package while verifying the end-to-end flow"
    resolution: "reconciled by replay — booting via the committed CMD path reproduces this state from a fresh clone; no committed-code change involved"
per_test:
  - test: 1
    verdict: pass
    note: "🤖 Auto-check: GET /api/cases/:id/exhibits confirms P-2 carries discrepancyFlags=[{ADMITTED_NO_CUSTODIAN, OPEN, 'No custodian on record'}] and P-3 carries [{UNRESOLVED_OBJECTION_JURY_ELIGIBLE, OPEN, 'Unresolved objection'}] — the exact data the ⚑ badge column renders."
    confidence: proven
  - test: 2
    verdict: pass
    note: "🤖 Auto-check: GET /api/exhibits/:id/discrepancies for P-2 returns the same OPEN ADMITTED_NO_CUSTODIAN flag; POST /api/discrepancies/:id/acknowledge with a justification returned 200 and flipped status OPEN→ACKNOWLEDGED with a DISCREPANCY_ACKNOWLEDGED ledger event. The visual banner itself is UI judgement — human confirms rendering."
    confidence: proven
  - test: 3
    verdict: pass
    note: "🤖 Auto-check: after reseed, GET /api/cases/:id/jury-package returns {juryPackage:null, exhibits:[]} — confirmed no draft exists and the endpoint itself never creates one as a side effect (called repeatedly, result unchanged)."
    confidence: proven
  - test: 4
    verdict: pass
    note: "🤖 Auto-check: POST /api/cases/:id/jury-package as CLERK returned 201 DRAFT with 4 member exhibits, P-2 and P-3 each carrying their live OPEN flag — exactly what the draft table should render."
    confidence: proven
  - test: 5
    verdict: pass
    note: "🤖 Auto-check: POST finalize while flags were still OPEN returned 409 JURY_PACKAGE_DISCREPANCIES_OPEN naming both blocking exhibits (P-2, P-3) with their rule codes — the exact data the hard-disabled gate + caption must reflect. (This probe was run on a throwaway draft during self-check, then reseed restored the clean pre-draft state for the human's own click-through.)"
    confidence: proven
  - test: 6
    verdict: pass
    note: "🤖 Auto-check: POST acknowledge on both flags (with justification) returned 200 and flipped each to ACKNOWLEDGED; a subsequent finalize attempt then succeeded — confirming the gate re-enables once every flagged exhibit clears."
    confidence: proven
  - test: 7
    verdict: pass
    note: "🤖 Auto-check: POST finalize after both acknowledgements returned 200 with juryPackage.status=FINALIZED, finalizedAt and finalizedBy populated. The visual green-stamp rendering is UI judgement — human confirms."
    confidence: proven
  - test: 8
    verdict: skipped (needs human)
    note: "🤖 Auto-check: print/export is a browser-only interaction (window.print + @media print CSS) with no HTTP-observable outcome; confirmed the CSS rule exists in globals.css and .no-print is applied to Header/Sidebar/actions in source, but the rendered printable output is a visual judgement call."
  - test: 9
    verdict: pass
    note: "🤖 Auto-check: Sidebar.tsx renders JuryPackageNavItem as a real next/link (href=/jury-package, not a disabled placeholder like Command Center/Assistant); useDiscrepancyCount drives the badge from the same case-wide discrepancies query confirmed live in test 1. Visual badge styling/count display is left for human confirmation."
    confidence: proven

## Gaps

[none yet]
