---
status: complete
phase: 02-core-screens
source: 02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md, 02-04-SUMMARY.md, 02-05-SUMMARY.md, 02-06-SUMMARY.md, 02-07-SUMMARY.md
started: 2026-10-07T10:03:00Z
updated: 2026-10-07T10:24:15.329Z
---

## Current Test

[testing complete]

## Tests

### 1. Browse Full Exhibit List on Case Workspace
expected: Opening the Case Workspace (/case) shows a table of every exhibit in the case, each row showing its current status (as a badge), offering party, and associated witness.
result: pass

### 2. Search/Filter the Exhibit List
expected: Using the search/filter bar on the Case Workspace (keyword, status, witness, date) narrows the list to only matching exhibits. Combining multiple criteria (e.g. status + witness) applies them together (AND) — exhibits not matching every active criterion are excluded.
result: pass

### 3. Drill Into an Exhibit's Full History
expected: Clicking a row on the Case Workspace navigates to that exhibit's Detail View (/exhibit/:id), which shows a header (status/custodian/party/witness) above a full chronological timeline of every status change, objection, ruling, and custody transfer for that exhibit.
result: pass

### 4. Status/Custody Consistency Between Screens
expected: An exhibit's status and custodian shown on the Case Workspace list match exactly what the Exhibit Detail View shows for the same exhibit — no discrepancy between the two screens.
result: pass

### 5. Sealed Exhibit Hidden From Unauthorized Roles
expected: Switching the role switcher to a non-privileged role (e.g. Attorney) hides the sealed exhibit (S-1) from the Case Workspace list, and navigating directly to its Detail View shows the same "not found" page as a genuinely nonexistent exhibit — not a distinguishable "forbidden" message.
result: pass

### 6. Role Switcher Changes Visible Data
expected: The app shell's role switcher (header) lists all 6 personas/roles. Switching roles immediately updates what data is visible (e.g. a privileged role like Judge can see the sealed exhibit; a non-privileged role cannot) without needing a page refresh.
result: pass

### 7. Missing Exhibit Shows Not-Found Page
expected: Navigating to a nonexistent exhibit ID's Detail View shows a clear "not found" page, not a crash or blank screen.
result: pass

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]

## Self-Check

boot: 307
data: all preconditions present
routes_probed: 9 ok / 0 failed
cookie: n/a
browser_urls: 0 gaps / 1 advisories
repairs: none
per_test:
  - test: 1
    verdict: pass
    note: "🤖 Auto-check: GET /api/cases/{id}/exhibits (JUDGE) returns 200 with 9 rows, each carrying currentStatus/offeringParty/associatedWitness (e.g. D-1: ADMITTED, DEFENSE, HR Manager Gail Stroud). Server-side data confirmed correct; page itself is a client-rendered SPA shell so the human's visual confirmation is still the real test."
    confidence: proven
  - test: 2
    verdict: pass
    note: "🤖 Auto-check: /exhibits/search with status=ADMITTED&witness=Ortiz correctly AND-combines to exactly P-2+P-4 (both ADMITTED, witness Lena Ortiz), excluding D-1/P-3/S-1 despite being ADMITTED. Empty-criteria correctly 422s EMPTY_SEARCH_CRITERIA."
    confidence: proven
  - test: 3
    verdict: pass
    note: "🤖 Auto-check: GET /api/exhibits/{D-1 id}/history returns a 7-event chronological timeline (STATUS_CHANGE x4, OBJECTION_RAISED, RULING_RECORDED, CUSTODY_TRANSFER) — full ledger reconstruction confirmed server-side."
    confidence: proven
  - test: 4
    verdict: pass
    note: "🤖 Auto-check: D-1's list row (status=ADMITTED, custodian=Deputy Dana Reyes) matches exactly the final STATUS_CHANGE/CUSTODY_TRANSFER events in its own history ledger — no drift between list and detail data sources."
    confidence: proven
  - test: 5
    verdict: pass
    note: "🤖 Auto-check: sealed exhibit S-1 present in JUDGE's list (9 rows) and absent from ATTORNEY's list (8 rows). Direct detail fetch: JUDGE→200, ATTORNEY→404 EXHIBIT_NOT_FOUND, byte-identical to a genuinely nonexistent exhibit's 404 body (anti-enumeration proven via diff)."
    confidence: proven
  - test: 6
    verdict: pass
    note: "🤖 Auto-check: GET /api/case returns exactly 6 roles (JUDGE, CHAMBERS_STAFF, DEPUTY, CLERK, ATTORNEY, ADMIN); role-header-driven visibility difference independently confirmed in test 5 (9 vs 8 exhibits)."
    confidence: proven
  - test: 7
    verdict: pass
    note: "🤖 Auto-check: GET /api/exhibits/{random-uuid} returns 404 EXHIBIT_NOT_FOUND server-side (not a 500/crash); /exhibit/{random-uuid} page returns 200 with a client-rendered shell containing '404' text, consistent with the documented client-side ExhibitNotFound render path."
    confidence: proven
