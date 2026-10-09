## F14: Discrepancy Acknowledgment Transparency

**Description:** Makes the existing semantics of acknowledging a discrepancy visible to the user at the point of action. This is strictly a UI visibility requirement — the underlying acknowledgment data model and audit trail already exist in full per F6 (role-gated acknowledgment, required justification, immutable `DISCREPANCY_ACKNOWLEDGED` ledger event). This feature adds **no new data capability**; it requires every screen to surface, legibly and without a hover-only interaction, who may acknowledge a discrepancy and that doing so is recorded as a permanent, auditable event tied to an actor, role, timestamp, and justification.

**Terminology:**
- **Acknowledgment Affordance:** The UI control (button/action) that triggers F6's `acknowledgeDiscrepancy` flow — the element this feature specifies the required labeling and disclosure for.
- **Permanent-Record Framing:** The requirement that any copy accompanying the acknowledgment action makes clear, before the action is taken, that it will be recorded permanently under the acknowledging user's identity.

**Sub-features:**
- Role-eligibility disclosure before the action is taken (which roles may acknowledge)
- Non-eligible roles see no acknowledge control at all — absent, not a disabled/misleading one
- Inline, always-visible audit-trail disclosure at the point of acknowledgment (what will be recorded, under whose name, and when)
- Visible acknowledgment history on already-`ACKNOWLEDGED` flags (actor, role, timestamp, justification) on every screen that renders that flag

**Process:**
1. Wherever a `DiscrepancyFlag` with `status = 'OPEN'` is rendered — Case Workspace (F9) inline indicator, Jury Package Workspace (F11) flagged row, Exhibit Detail (F10) discrepancy banner — the client checks `requestingUserRole` against F6's existing role set (`DEPUTY`, `CLERK`, `JUDGE`, `ADMIN`; see F06 §Validation).
2. If the requesting role is **not** in that set, no "Acknowledge" control is rendered for that flag at all — not a disabled or greyed-out control, an absent one. This mirrors the existing pattern already used for the Jury Package Workspace's finalize control (F11 §Process step 4): the system does not show an affordance it will not honor.
3. If the requesting role **is** in that set, the rendered "Acknowledge" control is accompanied by inline, always-visible copy (not tooltip-only, not hover-only) stating that acknowledging will permanently record the action under the acknowledging user's name and role, with a timestamp — e.g., "Acknowledging will be recorded as a permanent action under your name." This copy must be visible before the action is confirmed, not only after.
4. When the acknowledgment action is opened (confirmation step or inline form), the required justification input — F6's existing, unchanged, required, max-500-character field (F06 §Inputs — Acknowledgment) — is labeled to make clear it becomes part of the permanent record (e.g., "Justification (recorded permanently)") rather than appearing as an optional or throwaway comment field. No change is made to the field's validation rules.
5. Once a flag's status is `ACKNOWLEDGED` (per F06 §Process step 6), every screen that renders that flag displays the full acknowledgment record: the acknowledging user's name, their role, the timestamp, and the justification text — never summarized away, truncated without expansion, or hidden behind a secondary click. This data is sourced from the existing `DiscrepancyFlag.acknowledgedBy` / `acknowledgedAt` fields plus the justification already captured in the `DISCREPANCY_ACKNOWLEDGED` ledger event's payload (F06 §Schema Surface), joined via `acknowledgedEventId`.
6. The assistant's `getDiscrepancies` tool (F7) already has access to this same underlying data; this feature requires the service-layer read used by the UI (and, where relevant, the assistant's response composition) to include the justification text in its response for `ACKNOWLEDGED` flags — an additive field on an existing read, not a new tool or a changed tool contract.

**Inputs:** None new — this feature consumes the existing `requestingUserRole` (session, unchanged) and the existing `DiscrepancyFlag` fields already defined in F06 §Outputs.

**Outputs:** No new data is created. The following existing-data field is additively surfaced on reads that did not previously expose it:
- `justification` (string): the free-text justification originally captured at acknowledgment time, sourced via a read-time join from `DiscrepancyFlag.acknowledgedEventId` to the referenced `ExhibitEvent.payload.justification` (already stored per F06 §Schema Surface) — included in the `GET /api/cases/:id/discrepancies` and `GET /api/exhibits/:id/discrepancies` response shapes for any flag with `status = 'ACKNOWLEDGED'`.

**Validation:**
- An "Acknowledge" control must never be rendered for a role outside `DEPUTY`/`CLERK`/`JUDGE`/`ADMIN` — absence, not disablement, is the required behavior, identical in spirit to F11's existing finalize-control pattern
- The pre-action disclosure copy and the permanent-record framing on the justification field must both be visible without any hover or tooltip-only interaction — readable at a glance, consistent with the PRD's non-technical-usability NFR for a non-technical judge/court-staff audience
- Rendering an already-`ACKNOWLEDGED` flag's actor, role, timestamp, and justification must use identical data on every screen it appears on (F9, F10, F11) and in the assistant's answers — no screen may show a partial version that omits actor, timestamp, or justification while another shows the full set
- No change is made to who may acknowledge, what justification is required, or how an acknowledgment is recorded — F6's existing validation rules (F06 §Validation) govern the action itself unchanged; this feature governs only what is made visible around it

**Error States:**
No new error codes are introduced by this feature. All underlying actions continue to use F6's existing, unchanged error codes: `JUSTIFICATION_REQUIRED` (422), `DISCREPANCY_NOT_FOUND` (404), `ROLE_NOT_PERMITTED` (403) — see F06 §Error States and `Y2-errors.md` §Discrepancy Errors. This feature is a rendering/visibility requirement layered on top of F6's unchanged service behavior and introduces no new failure modes.

**API Surface (this feature):** no new endpoints. Consumes F6's existing `GET /api/cases/:id/discrepancies`, `GET /api/exhibits/:id/discrepancies`, and `POST /api/discrepancies/:id/acknowledge` unchanged in behavior — see `Y1-api.md` §Discrepancies (amended to note the additive `justification` field on `ACKNOWLEDGED` flags in the two `GET` responses).

**Schema Surface (this feature):** no new tables or columns. The justification text already exists as ledger ground truth in the `DISCREPANCY_ACKNOWLEDGED` event's payload (`Y0-schema.md` §Event Ledger, §Discrepancy Detection) — this feature requires only a read-time join at the service layer, not a schema change.
