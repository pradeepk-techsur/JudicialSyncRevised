## F17: Objection-to-Admission State-Machine Hardening

**Description:** Formally closes the theoretical bypass path Phase 7's F12 does not explicitly rule out: an `OBJECTED → ADMITTED` transition occurring without a ruling ever having been recorded on every currently-unresolved thread. Having re-read F12's specification in full (`F12-admission-integrity-gating.md`), **this feature adds no new runtime validation mechanism.** F12's existing Admission Gate — which rejects `toStatus = ADMITTED` whenever any `ObjectionCurrentState` row for the exhibit has `status = 'UNRESOLVED'` (F12 §Process step 3a) — already fully and unconditionally prevents this transition, because `ObjectionCurrentState.status` can leave `UNRESOLVED` only via a `RULING_RECORDED` ledger event (F02 §Process steps 5–6; see `00-header.md` §Current-State Projection: projections are derived exclusively from the ledger, with no independent update path). There is therefore no code path — UI, API, seed loader, or any future automation — by which an objection thread's status could change without a ruling event, and consequently no code path by which `OBJECTED → ADMITTED` could succeed without one.

**What this feature actually adds:** (1) an explicit, named statement of this guarantee as a formal invariant of the system (this document), so the guarantee is traceable and not merely an emergent property of two unrelated features; (2) dedicated regression test coverage exercising the bypass scenario directly — attempting to force an exhibit into `ADMITTED` immediately after an objection is raised but before any ruling is recorded, and confirming F12's existing gate rejects it with the existing `ADMISSION_BLOCKED` / `UNRESOLVED_OBJECTION` response, unchanged; and (3) an explicit confirmation, also now regression-tested, that `OFFERED → ADMITTED` (skipping `OBJECTED` entirely, when no objection was ever raised against the exhibit) remains a legal, unaffected transition — because F12's gate only fires when an `UNRESOLVED` row exists, and an exhibit with zero objection threads has none.

**Terminology:**
- No new terms. This feature reuses F12's **Admission Gate** and **Blocking Reason** terminology unchanged (see `F12-admission-integrity-gating.md` §Terminology).

**Sub-features:**
- None (no new capability). This entry exists to satisfy the PRD's F17 requirement with an honest "already covered" determination rather than inventing redundant mechanism.
- Regression test: objection raised → ruling not yet recorded → attempt `ADMITTED` → rejected (exercises F12's existing gate, not new code)
- Regression test: exhibit never objected to → `OFFERED → ADMITTED` directly → succeeds (confirms no regression in the legal direct-admission path)

**Process:**
1. A caller attempts `toStatus = ADMITTED` on an exhibit currently in `OBJECTED` status with at least one `UNRESOLVED` objection thread.
2. F12's existing Admission Gate (F12 §Process step 3a) runs unchanged: it queries `ObjectionCurrentState WHERE exhibitId = :id AND status = 'UNRESOLVED'`.
3. Because the objection thread has had no `RULING_RECORDED` event, its `ObjectionCurrentState.status` is still `UNRESOLVED` (it can be in no other state — see F02 §Process step 2, which sets `status: 'UNRESOLVED'` at raise-time, and steps 5–7, the only code path that ever changes it).
4. The gate's query returns the unresolved row; the `UNRESOLVED_OBJECTION` blocking reason applies; the request is rejected with `422 ADMISSION_BLOCKED`, identically to F12 §Process step 4 — no `ExhibitEvent` is appended, no projection is updated.
5. A ruling is subsequently recorded (`RULING_RECORDED`, F02 §Process step 4) with disposition `SUSTAINED` or `OVERRULED`. `ObjectionCurrentState.status` updates to that disposition (F02 §Process step 6) — the thread is now resolved.
6. A subsequent `toStatus = ADMITTED` attempt now finds zero `UNRESOLVED` rows for the exhibit; F12's gate passes (assuming the `NO_CUSTODIAN` condition also does not apply); the transition succeeds via F12's existing unchanged success path.
7. Separately: an exhibit that was never objected to (zero `ObjectionCurrentState` rows exist for it at all) attempts `OFFERED → ADMITTED` directly. F12's gate query returns zero rows (there is nothing to return — no thread exists); the `UNRESOLVED_OBJECTION` blocking reason does not apply; the transition proceeds exactly as it does today, unaffected by this feature.

**Inputs:** Identical to F12 §Inputs — no new inputs.

**Outputs:** Identical to F12 §Outputs — no new outputs.

**Validation:**
- No new validation rules. F12 §Validation already states the complete, sufficient condition: "`toStatus = ADMITTED` is accepted only if zero `ObjectionCurrentState` rows for the exhibit have `status = 'UNRESOLVED'` at check time" — this is unconditionally equivalent to "every objection thread has a recorded ruling," because `UNRESOLVED` is the only status a thread can hold before a ruling is recorded, and no non-ledger write path to `ObjectionCurrentState` exists anywhere in the service layer.
- This feature's only "validation" contribution is the regression test suite described above, confirming the invariant holds and will continue to hold (i.e., any future code change that introduced a direct current-state mutation bypassing `recordEvent` would be caught by this suite, not silently permitted).

**Error States:**
| Scenario | HTTP Status | Error Code | Message |
|---|---|---|---|
| (No new error states — F12's existing `ADMISSION_BLOCKED` / `UNRESOLVED_OBJECTION` response, exercised by new regression tests, is unchanged) | — | — | See `F12-admission-integrity-gating.md` §Error States |

**API Surface (this feature):** none — no endpoint is added, amended, or behaviorally changed. See `Y1-api.md` §Status (F1/F12 entry, unchanged).

**Schema Surface (this feature):** none — introduces no new tables, fields, or enum values. See `Y0-schema.md` (unchanged by this feature).
