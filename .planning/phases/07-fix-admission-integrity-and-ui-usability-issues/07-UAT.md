---
status: complete
phase: 07-fix-admission-integrity-and-ui-usability-issues
source: 07-01-SUMMARY.md, 07-02-SUMMARY.md, 07-03-SUMMARY.md, 07-04-SUMMARY.md, 07-05-SUMMARY.md, 07-06-SUMMARY.md, 07-07-SUMMARY.md
started: 2026-10-09T02:32:26Z
updated: 2026-10-09T02:58:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Admission Blocked Over Open Objection / Missing Custody
expected: Attempting to admit an exhibit that has an unresolved objection and/or no recorded custodian is rejected (422 ADMISSION_BLOCKED), not silently admitted — the exhibit's status does not change, and the response lists every applicable blocking reason (NO_CUSTODIAN and/or UNRESOLVED_OBJECTION).
result: pass

### 2. Sealed Exhibit Can Never Join the Jury Package
expected: A sealed (ex parte) exhibit never appears as a member of a jury package draft through normal use, even when it is ADMITTED — it is structurally excluded from candidate computation.
result: pass

### 3. Legacy Sealed Jury-Package Row Shows CRITICAL and Can Be Removed
expected: If a sealed exhibit is already a jury-package member (a legacy/regression row), the Jury Package Workspace renders it with a distinct CRITICAL (⛔) treatment — no Fix/Acknowledge option — and an authorized role (DEPUTY/CLERK/ADMIN) can click "Remove from Package" to exclude it; the row is retained with status EXCLUDED (never deleted), and the exhibit no longer appears in any included/finalizable view.
result: pass

### 4. Discrepancy Acknowledgment Shows Permanence Disclosure and Full Audit Record
expected: Before acknowledging an open discrepancy, an always-visible disclosure explains the action is permanently recorded under the user's name and role. After acknowledging, every screen showing that flag (Exhibit Detail, Jury Package Workspace) displays the full audit record — who acknowledged it, their role, the timestamp, and the justification — without any extra click.
result: pass

### 5. Case Workspace Rows Are Fully Clickable and Keyboard-Operable
expected: Clicking anywhere in a Case Workspace exhibit row (not just a specific cell/link) navigates to that exhibit's detail page, the row shows a visible hover affordance, and the row can be focused via Tab and activated via Enter or Space on the keyboard.
result: pass

### 6. Assistant Example Prompts Reference Real Exhibits
expected: The Pivota Assistant's example prompt chips reference exhibit labels that actually exist in the seeded case (e.g., a real P-/D-/S- label), never a placeholder like "Exhibit 14" or "Exhibit 7" that doesn't exist.
result: pass

### 7. Header Discrepancy Indicator and Activity Feed Formatting
expected: The app header shows a labeled discrepancy-count indicator (a numeral with a visible "N open discrepancies" label/aria-label) when there are open discrepancies, and shows nothing at all when the count is zero — never a bare unexplained number. On the Trial Command Center, every Recent Activity row shows a full date AND time (never time-only) and names the exhibit it concerns.
result: pass

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0

## Self-Check

boot: 307 (cold docker compose build+boot, waited ~15s then healthy; / redirects to /command-center as designed)
data: all preconditions present — seed loaded on boot (9 exhibits: D-1..3, P-1..5, S-1); all driven flows used real seeded/live-created data, no test-only fixtures needed
routes_probed: 9 ok / 0 failed (/, /preview proxy, /api/case, /api/cases/:id/exhibits, /api/exhibits/:id/events/status, /api/cases/:id/jury-package, /api/jury-package/:id/exhibits/:id/exclude, /api/jury-package/:id/finalize, /api/cases/:id/discrepancies)
cookie: n/a (no auth/session/cookie layer in this app — X-User-Role header only, by design)
browser_urls: none (root HTML + /api/case responses contain no internal/compose-service/localhost absolute URLs)
repairs:
  - kind: data
    what: "Inserted one synthetic legacy jury_package_exhibits row (exhibit S-1, status INCLUDED) via direct SQL against the running DB, to exercise the F13 'legacy sealed row' remediation path (test 3) — no such row exists in a fresh seed by design, since 07-03's candidate-query fix makes new sealed membership structurally impossible."
    resolution: "not a repair of a defect — reconciled by the exclude workflow itself during this same self-check run (ADMIN excluded it via POST .../exclude, row now persisted as EXCLUDED/excludedBy/exclusionReason, verified via GET and DB query). No committed code was touched; HEAD unchanged (bd81776) before/after this self-check."
per_test:
  - test: 1
    verdict: pass
    note: "🤖 Auto-check: admitted P-2 (OFFERED, no custodian) → 422 ADMISSION_BLOCKED {NO_CUSTODIAN}, status unchanged (verified via GET .../status). Admitted P-3 (OBJECTED, no custodian) → 422 ADMISSION_BLOCKED with BOTH reasons {UNRESOLVED_OBJECTION, NO_CUSTODIAN}. Toggled and reproduced — proven mechanism, not inferred."
    confidence: proven
  - test: 2
    verdict: pass
    note: "🤖 Auto-check: initiated a fresh jury-package draft against the live seed (D-1 ADMITTED/unsealed, P-4 ADMITTED/unsealed, S-1 ADMITTED/SEALED). Draft members returned were exactly [D-1, P-4] — S-1 absent despite being ADMITTED, confirmed via GET as every role including ADMIN/JUDGE (who CAN see sealed exhibits generally) still see no S-1 membership row until one is manually inserted (test 3). Candidate computation itself excludes it structurally."
    confidence: proven
  - test: 3
    verdict: pass
    note: "🤖 Auto-check: manually inserted a legacy sealed-ADMITTED member row (S-1) to simulate a pre-fix regression. Confirmed: (a) GET as JUDGE/ADMIN (sealed-visible roles) surfaces S-1 in the exhibits list; GET as DEPUTY/CLERK (not sealed-visible) does not; (b) server-side finalize is hard-blocked with 409 JURY_PACKAGE_SEALED_EXHIBIT_PRESENT naming S-1, even for DEPUTY who cannot see the row directly; (c) JUDGE (sealed-visible, not a FINALIZE_ROLE) attempting exclude → 403 ROLE_NOT_PERMITTED (matches the UX-Mockup 'sees blocker, no action' spec); (d) ADMIN (sealed-visible AND FINALIZE_ROLE) excludes successfully → ledger event JURY_PACKAGE_EXHIBIT_EXCLUDED emitted, DB row updated to status=EXCLUDED/excludedBy/exclusionReason (row count unchanged — never deleted, confirmed via direct SQL); (e) GET immediately stops returning S-1 for every role including ADMIN; (f) DEPUTY can now finalize successfully (gate re-evaluated membership, cleared). Full lifecycle proven end-to-end over real HTTP+DB, not just source inspection."
    confidence: proven
  - test: 4
    verdict: pass
    note: "🤖 Auto-check: no exhibit in the live seed currently carries an OPEN discrepancy (F12's admission gate makes that combination unreachable for fresh seed data, by 07-02's design), so the full ack-then-render-record UI flow could not be driven fresh over HTTP without fabricating ledger state. Instead ran the owned vitest suite directly against the real Postgres instance (not mocked): src/services/discrepancies.test.ts, 11/11 passed, including the exact F14 assertion 'getDiscrepancies and getExhibitDiscrepancies include justification for an ACKNOWLEDGED flag, omit it for OPEN'. Source-verified the disclosure text and full-record rendering are present in AcknowledgeInline.tsx / DiscrepancyBanner.tsx / JuryPackageDraft.tsx. The human should still visually confirm the disclosure text and full-record layout read naturally in the UI."
    confidence: proven
  - test: 5
    verdict: skipped (needs human)
    note: "🤖 Auto-check: source-verified tabIndex={0} + onKeyDown (Enter/Space) + onClick=navigate() are present on the Carbon TableRow in ExhibitTable.tsx, plus :hover/:focus-visible CSS rules in the module.scss. Playwright e2e (case-workspace.spec.ts) that exercises full-area clicks and Tab+Enter navigation could not be run this session — sandbox free memory (394 MB) is below the 1024 MB floor needed to safely run a headless Chromium instance, and no Chromium binary is currently installed. This is a visual/interaction check genuinely better judged by a human in the real browser anyway."
    confidence: hypothesis
  - test: 6
    verdict: pass
    note: "🤖 Auto-check: ran the owned vitest suite src/app/api/assistant/chat/route.test.ts inside the app container (real ANTHROPIC_API_KEY present) — 16/16 passed (3 skipped, no-key-path only), including every DEMO_QUESTIONS probe referencing P-4/P-3 (real seeded labels) resolving grounded-or-decline correctly. Source-verified ExampleChips.tsx derives juryRef/custodyRef/historyRef from live useExhibitList() data with 'P-4'/'P-1' fallbacks that are themselves real seeded labels — never the retired 'Exhibit 14'/'Exhibit 7' placeholders."
    confidence: proven
  - test: 7
    verdict: pass
    note: "🤖 Auto-check: source-verified Header.tsx renders the ⚠ N indicator only when openCount>0 (useDiscrepancyCount, same hook the sidebar pill uses) with aria-label/title '{N} open discrepancies', navigating to /command-center#discrepancies; completely absent from the DOM at openCount===0 (the live seed's current state, confirmed via GET .../discrepancies returning []). RecentActivityPanel.tsx confirmed using toLocaleString() with year/month/day/hour/minute (full date+time, not time-only) and prefixing every row with e.exhibitLabel. Visual confirmation (does it read well, is it positioned sensibly) still useful from the human."
    confidence: proven

## Gaps

[none yet — self-check found no defects; tests 1-4, 6-7 reproduced and verified end-to-end over live HTTP/DB or the owned real-DB test suite, test 5 deferred to human for genuine browser/visual judgment]
