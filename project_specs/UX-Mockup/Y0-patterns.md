## Interaction Patterns

**Design System (as of Phase 6, re-themed Phase 8):** All patterns below are implemented using IBM Carbon Design System (carbondesignsystem.com) components. The component layer and every interaction guarantee described in each pattern is unchanged since Phase 6. **Phase 8 amendment:** the visual *theme* layered on top of Carbon changes from the original Carbon-light theme to a reviewed dark-dashboard theme (dark-navy sidebar, light content area, rounded-corner card panels) — see `00-overview.md` §Visual Foundation. This is a token/styling migration only, exactly like the Phase 6 Carbon migration before it: no pattern's behavior, role-gating, or `data-testid`/`aria-label` contract changes as a result (US-24.3).

### Pattern: Inline Row Actions (not modal forms)

**When to use:** Any time a user needs to log a status change, objection, ruling, or custody transfer from the Case Workspace or Exhibit Detail View.
**Behavior:** A compact, inline expansion directly within the row/header — never a full-screen modal dialog or a separate "add record" page. Only valid next actions are offered as options (e.g., only valid forward status transitions appear in the dropdown); invalid options are never shown as disabled list items requiring explanation, they are simply absent.
**Examples:** "Record Status," "Propose Custody Transfer," "Raise Objection" actions on Case Workspace rows and the Exhibit Detail header (US-1.1, US-2.1, US-3.1).
**Rationale:** Reinforces "assistant augmenting an existing workflow," not "new case management system to learn" (PROJECT.md positioning constraint). A deputy who already knows the paper-log motions should find this faster, not slower, than what it replaces.
**Phase 7.1 amendment (F20):** every one of these inline actions is now additionally gated by server-side role per the Permission Matrix — see §Pattern: Role-Gated Control Visibility below for the rendering rule, and §Pattern: Two-Phase Custody Handoff for "Transfer Custody"'s renamed, split propose/confirm/cancel behavior.

---

### Pattern: Status Badge Visual Convention

**When to use:** Anywhere an exhibit's current lifecycle status is displayed — Command Center, Case Workspace, Exhibit Detail, Jury Package, and the Assistant's text answers.
**Behavior:** A single consistent dot-plus-label convention (`●ADMITTED`, `●OFFERED`, etc.) with a fixed color mapping per status value, used identically across all five screens (implemented as a Carbon `Tag` using Carbon's status-color tokens as of Phase 6). The Assistant renders the same status word in its prose (never a paraphrase like "fully accepted" for `ADMITTED`).
**Examples:** Every screen wireframe in this document.
**Rationale:** US-1.2 requires that status "never" appears to differ across screens — a shared component (not five independent implementations) is the only way to structurally guarantee this.

---

### Pattern: Citation Pill

**When to use:** Any factual claim made by the Pivota Assistant.
**Behavior:** A small, bordered, monospace-text pill immediately following the sentence it supports, formatted `[RecordLabel · EventType · Timestamp]`. Clicking navigates to the source record's screen with the specific event highlighted. Never rendered as a footnote, tooltip-only, or hidden metadata — it is always visibly inline (implemented as a clickable Carbon `Tag` as of Phase 6; `Tooltip` is not used, since the citation must remain visible without a hover).
**Examples:** Pivota Assistant screen (every grounded answer).
**Rationale:** US-7.2 treats a missing citation as a release blocker, not a style preference — the pattern must be impossible to omit accidentally, so it is a required part of the answer-rendering component, not an optional enhancement.

---

### Pattern: Discrepancy Flag Treatment

**When to use:** Any screen displaying an exhibit with an `OPEN` or `ACKNOWLEDGED` discrepancy flag.
**Behavior:** Amber/warning-colored badge with the specific rule's plain-language explanation always visible alongside the icon (never an icon alone requiring a hover to understand). `ACKNOWLEDGED` flags use a visually related but distinguishable muted-amber treatment — related enough to signal "still a known risk," distinct enough to signal "already reviewed by a human."
**Examples:** Case Workspace row icon, Exhibit Detail header banner, Jury Package row badge.
**Rationale:** US-6.3 requires acknowledged flags to remain visibly surfaced forever — this pattern prevents any future screen from accidentally treating "acknowledged" as equivalent to "hidden."

---

### Pattern: Hard-Disabled Gate Controls

**When to use:** Any action whose server-side rejection would be confusing or too late to discover only after clicking (specifically: jury package finalization).
**Behavior:** The control itself is rendered in a disabled visual state (greyed, non-interactive, `disabled` attribute set) with an adjacent caption explaining exactly what must change for it to become actionable — never a normal-looking button that returns an error toast on click (implemented as a Carbon `Button` with its native `disabled` prop as of Phase 6, not a styled-but-clickable element).
**Examples:** "Finalize Jury Package" button while open discrepancies remain (US-11.2).
**Rationale:** The PRD explicitly distinguishes "physically cannot ship a discrepant package by mistake" from "gets an error message after trying" — these are different UX guarantees, and only the disabled-control pattern satisfies the stronger one.

---

### Pattern: Decline-as-Valid-Response Styling

**When to use:** Any Pivota Assistant response where no tool call returned a supporting record.
**Behavior:** Rendered with the same neutral conversational styling as a grounded answer — no red color, no warning icon, no "Error" label. The only visible difference is the absence of a citation pill.
**Examples:** Pivota Assistant screen, decline-response state.
**Rationale:** US-7.3 explicitly treats this as "valid, expected behavior in testing, not a failure mode" — styling it as an error would train users to distrust declines, which is the opposite of the intended effect (a decline should be exactly as trustworthy-feeling as an answer).

---

### Pattern: Polling-Based Live Sync Indicator

**When to use:** Command Center, Case Workspace, and Jury Package Workspace (in `DRAFT` state) — all three poll underlying data every 3–5 seconds.
**Behavior:** Updates apply in place with a brief (~400ms) highlight fade on the changed cell/row — never a full list re-sort or jarring re-render, and never an intrusive "new data available, click to refresh" banner. A small, unobtrusive "updated Xs ago" indicator in a corner provides freshness confidence without demanding attention.
**Examples:** All three polling screens.
**Rationale:** PRD §6 NFR requires changes to "propagate across open screens without manual refresh" while feeling "immediate" — an indicator that's too quiet undermines confidence, one that's too loud undermines the "ambient" positioning of F8 specifically.

---

### Pattern: Sealed-Exhibit Invisibility

**When to use:** Any query, list, search result, or assistant answer touching an exhibit marked `isSealed = true`, viewed by a role outside the visibility set.
**Behavior:** The sealed exhibit is simply absent — not shown as a redacted row, not referenced in a count, not hinted at via a "1 hidden result" message. An unauthorized direct navigation to its detail URL returns an identical "not found" experience to a genuinely nonexistent ID.
**Examples:** Case Workspace list (US-9.1), Exhibit Detail View (US-10.2), Assistant decline (US-7.4), search results (US-4.1).
**Rationale:** The FRD is explicit that revealing *existence* of sealed material to an unauthorized role is itself the harm to prevent — a redacted placeholder row would violate this even though no content leaks.

---

### Pattern: Fully Clickable List Row

**When to use:** Any list row that drills into a detail screen — Case Workspace's exhibit table and Command Center's Recent Activity/Unresolved Objections/Discrepancies rows.
**Behavior:** The entire row container is the click target and carries a visible hover affordance (background highlight + `cursor: pointer`), not just a nested link, icon, or label span. The row is keyboard-focusable and Enter/Space activates it identically to a click. Nested inline action controls (e.g., "Record Status," "Acknowledge") call `stopPropagation()` so operating them never triggers row navigation, while every other point on the row does.
**Examples:** Case Workspace exhibit row (fixes a regression against this same guarantee — US-15.1); Command Center's Recent Activity/Unresolved Objections/Discrepancies rows (already correct, used here as the reference implementation).
**Rationale:** US-15.1 requires a row with zero discrepancy flags and a row with one or more flags to be "both fully, identically clickable across their entire row area" — a shared pattern definition is what keeps Case Workspace from silently drifting out of sync with the Command Center behavior it is meant to match.

---

### Pattern: Multi-Reason Blocking Error (Admission Gate)

**When to use:** Any inline "Record Status" action attempting to transition an exhibit to `ADMITTED` — available on both the Case Workspace row and the Exhibit Detail header.
**Behavior:** If the attempt is rejected (`422 ADMISSION_BLOCKED`), the inline action renders a specific inline error naming every applicable blocking reason at once — never a generic "failed to update status" message and never only the first reason found. Each reason renders as its own line (e.g., "Unresolved objection on this exhibit," "No custodian of record"), preceded by a count ("Cannot admit: 2 blocking condition(s) present"). No `ExhibitEvent` is recorded and the exhibit's displayed status does not change — the inline action simply re-collapses to its prior, unmodified state once the error is dismissed.
**Examples:** Case Workspace's inline "Record Status" action; Exhibit Detail View's header "Record Status" action (US-12.1, US-12.2).
**Rationale:** F12 moves this check to a hard pre-write gate specifically so a deputy never discovers a blocking condition one at a time through repeated failed attempts — the UI's job is to surface every reason the first time, matching the service layer's `reasons[]` array 1:1.

---

### Pattern: Critical Blocker Row (Sealed / Ex Parte)

**When to use:** Any Jury Package Workspace row whose underlying exhibit is `isSealed = true`.
**Behavior:** Rendered in a distinct, higher-severity treatment than the Discrepancy Flag Treatment pattern above — explicit label ("Critical · ex parte material — must be removed"), a stronger/non-amber critical color, and never the `✓ Clean` or `⚠ Flagged` wording used by ordinary discrepancies. This evaluation runs independently of, and takes precedence over, the row's underlying `discrepancyStatus` — a sealed exhibit's row is structurally incapable of ever reading `Clean`, regardless of what F6's discrepancy engine separately reports for it. Only `DEPUTY`, `CLERK`, or `ADMIN` roles see the row's "Remove from Package" action; `JUDGE`, `CHAMBERS_STAFF`, and `ATTORNEY` see the identical critical-severity row with no action control.
**Examples:** Jury Package Workspace sealed/ex-parte blocker row (US-13.1, US-13.2, US-13.3).
**Rationale:** F13 names sealed material reaching a jury package as "the single most damaging failure mode in this domain" — a row that could ever be mistaken for an ordinary flagged-but-tolerable discrepancy would undermine the entire guarantee, so this pattern is deliberately visually incompatible with the Discrepancy Flag Treatment pattern.

---

### Pattern: Permanent-Record Disclosure (Role-Gated Action)

**When to use:** Any control that triggers an auditable, identity-attributed ledger event the user is about to commit to — currently the discrepancy "Acknowledge" action (F6/F14) and the jury package "Remove from Package" action (F13).
**Behavior:** Two guarantees, both required: (1) if the requesting role is not in the action's permitted set, the control is simply absent — never rendered disabled or greyed-out; (2) if the role is permitted, the control is shown alongside inline, always-visible (not tooltip/hover-only) copy stating the action will be permanently recorded under the acting user's name and role before the action is confirmed — e.g., "Acknowledging will be recorded as a permanent action under your name." Any accompanying free-text input (e.g., acknowledgment justification) is labeled to make clear it becomes part of the permanent record, not an optional comment. Once the action is taken, every screen rendering that record displays the full audit trail (actor, role, timestamp, justification) — never summarized away or hidden behind a secondary click.
**Examples:** Discrepancy "Acknowledge" button on Case Workspace, Exhibit Detail, and Jury Package Workspace (US-14.1, US-14.2, US-14.3); Jury Package "Remove from Package" button (US-13.2).
**Rationale:** F14 is explicit that the underlying audit data already exists in full — the gap is purely that a user could take an irreversible, identity-attributed action without being shown, before committing, that it is irreversible and identity-attributed. This pattern closes that gap identically everywhere the action appears, rather than per-screen.

---

### Pattern: Role-Gated Control Visibility (F20, Phase 7.1)

**When to use:** Any control that triggers a write action now covered by F20's system-wide Permission Matrix — creating an exhibit, a mark/offer/withdraw or admit/exclude status transition, raising an objection, proposing a custody transfer, or confirming a custody transfer — in addition to the acknowledge/remove actions already covered by the Permanent-Record Disclosure pattern above.
**Behavior:** The exact same absence rule first established for discrepancy acknowledgment (F14) and sealed-exhibit removal (F13), now generalized and applied system-wide: if the currently active role is not in the action's permitted set (per F20's matrix), the control is not rendered at all — never disabled, greyed-out, or present-with-a-tooltip-explaining-why. If the role is permitted, the control renders and behaves exactly as already specified by the feature that defines it (F0/F1/F2/F19). **This pattern does not, by itself, add the pre-action disclosure copy** required by Permanent-Record Disclosure — that additional requirement remains specific to acknowledge/remove, which F14/F13 single out for carrying an explicit "this will be permanently recorded under your name" warning; routine write actions (creating an exhibit, transitioning status, raising an objection, proposing a transfer) are simply absent-or-present, with no extra disclosure text, since every write in this system is already ledger-recorded as a matter of course and F14/F13's disclosure requirement was never generalized to every action by the FRD.
**Special case — identity, not just role (confirm custody):** confirming a custody transfer (F19/F20 row 7) requires passing *both* this pattern's role check (`DEPUTY`/`CLERK`/`ADMIN`) *and* an independent exact-identity check (the active user must be the pending transfer's named receiver) — a role-permitted user who is not the named receiver still does not see the "Confirm" control, exactly as if they lacked the role entirely. See §Pattern: Two-Phase Custody Handoff below.
**Examples:** Case Workspace's "+ New Exhibit" toolbar action (absent outside `DEPUTY`/`CLERK`/`ADMIN`); "Record Status" and "Propose Custody Transfer" on Case Workspace rows and the Exhibit Detail header (absent outside `DEPUTY`/`CLERK`/`ADMIN`); "Raise Objection" (absent outside `ATTORNEY`/`DEPUTY`/`CLERK`/`ADMIN`); "Confirm Receipt" on a pending custody transfer (absent for anyone but the exact named receiver).
**Rationale:** F20 formally extends server-side authorization to every write action in the system; a UI that still rendered an enabled-looking control for an action the server will reject would reintroduce exactly the "client-side affordance the server silently rejects anyway" risk F20 exists to close (JOURNEYS §Cross-Journey Patterns, "Unilateral assertion standing in for acknowledged fact"). A single named pattern — rather than one-off per-screen judgment calls — is what keeps all six screens consistent as new F20-gated actions are added.

---

### Pattern: Two-Phase Custody Handoff (Propose / Confirm / Cancel) (F19, Phase 7.1)

**When to use:** Any screen displaying an exhibit's custody section — Exhibit Detail View's header (primary surface for this pattern) and Case Workspace's custodian column (summary indicator only, full actions live on Exhibit Detail).
**Behavior:** Custody transfer renders in three distinct states, never collapsed into one: (1) **Settled** — a plain custodian name, with a "Propose Custody Transfer" control available per the Role-Gated Control Visibility pattern (`DEPUTY`/`CLERK`/`ADMIN`); (2) **Pending** — an always-visible informational banner (not amber/warning-colored — this is an in-progress state, not a problem — e.g., a neutral blue/grey treatment distinct from the Discrepancy Flag Treatment pattern) reading "Pending transfer to {receiver} — awaiting their confirmation," alongside a "Cancel Transfer" control visible to the original proposer or any `DEPUTY`/`CLERK`/`ADMIN` role, and a "Confirm Receipt" control visible **only** when the active user is the exact named receiver — a role-permitted user who is not that specific person sees the banner and the Cancel control but never Confirm; (3) **Settled (post-confirm)** — reverts to state (1) with the new custodian's name, the pending banner removed, and the transfer now appearing as a `CUSTODY_TRANSFER_CONFIRMED` entry in the timeline. No control ever lets a second transfer be proposed while one is already pending (the "Propose" control itself is absent/unavailable during the Pending state, matching `CUSTODY_TRANSFER_ALREADY_PENDING`).
**Identity vs. role:** because the demo seeds exactly one `User` per `Role` (F0), the active role switcher selection doubles as identity for this pattern's purposes — "Confirm Receipt" is rendered precisely when the currently switched role/user matches the pending transfer's named receiver, which in this demo is equivalent to checking identity directly. This is called out explicitly because it is a demo-specific simplification of F19's general exact-identity requirement, not a weakening of it: in a system with multiple users per role, the check would need to compare `actorUserId`, not role, but the two coincide here.
**Examples:** Exhibit Detail View custody section (primary); Case Workspace custodian column shows a compact "→ pending: {receiver}" indicator with a link through to Exhibit Detail for the actual Confirm/Cancel actions, rather than duplicating the full pattern inline in a table cell.
**Rationale:** F19 exists specifically to close the gap where a custody record could assert a handoff the receiving party never acknowledged — collapsing propose/pending/confirm into a single "Transfer Custody" button (the pre-Phase-7.1 design) would silently reintroduce that exact gap in the UI even though the backend now requires two phases. Separating "who can end this pending state" (Cancel — role-gated) from "who can complete it" (Confirm — identity-gated) is the single most load-bearing distinction in this pattern and must never be blurred.

---

### Pattern: Activity Feed Row Format (Full Timestamp + Label)

**When to use:** Command Center's Recent Activity feed (F8) — any row rendering an `ExhibitEvent` as a one-line summary.
**Behavior:** Every row renders both the date and the time of `recordedAt` (e.g., "Oct 8, 2026, 2:41 PM") — never a time-only stamp — and always includes the event's exhibit label as part of the rendered summary, including rows describing a raw `STATUS_CHANGE` transition (e.g., "Exhibit 3 — MARKED → OFFERED, Oct 8, 2026, 1:58 PM" rather than a summary with no exhibit identified).
**Examples:** Command Center Recent Activity panel, every `eventType` value (US-15.4, US-15.5).
**Rationale:** A judge scanning the feed across a day boundary or a multi-day recess cannot tell two events on different days apart from a time-only stamp, and an unattributed raw-transition row forces a drill-in just to learn which exhibit it concerned — both defeat the "glance, don't drill in" promise of US-8.1.

---

### Pattern: Labeled Header Indicator

**When to use:** Any numeric or iconographic element rendered in the shared app header (near the role selector), present identically on all five screens.
**Behavior:** An element is never shown "present and unexplained." Every header indicator either (a) carries a visible label or an accessible `aria-label`/tooltip explaining what it represents, or (b) is not rendered at all when it has no current user-facing function. The resolved discrepancy-count indicator (see `00-overview.md` §App Shell) is the current example: a small `[⚠ N]` badge showing the case-wide count of `OPEN` discrepancy flags, labeled via `aria-label="N open discrepancies"`, omitted entirely when the count is zero.
**Examples:** App header discrepancy-count badge, replacing a previously unlabeled numeric element (US-15.3).
**Rationale:** "Present and unexplained" is explicitly called out as unacceptable for any header element, verified across Command Center, Case Workspace, Exhibit Detail, and Jury Package Workspace — a single shared header component (not per-screen reimplementation) is what guarantees the fix can't regress on only some screens.

---

### Pattern: Case Selector (Header Scope Switch) (F22, Phase 7.1)

**When to use:** The app header's case-identifier slot, present identically on all six screens.
**Behavior:** The case identifier (`[Case: 2026-CR-0142]`) becomes an interactive dropdown (`[Case: 2026-CR-0142 ▾]`) in the exact same header slot — no change to header width or the ordering of the other header elements (Case → Discrepancy count → Role → Ask). Opening it lists every case in the system with no role restriction (case existence is not sensitive — only exhibit-level classification/sealed visibility is, and that is unaffected by case selection). Selecting a different case triggers an immediate refetch on every currently-open screen and the assistant's working context, using the same refetch mechanism already wired to role switches — no screen is allowed to continue silently displaying data scoped to the previously-selected case, even for a single frame. On first load with no prior selection, defaults to the first case by `createdAt` ascending, so the original single-case demo script requires zero interaction with this control.
**Examples:** App header case selector (US-22.1, US-22.2, US-22.3).
**Rationale:** JOURNEYS' administrator persona (JRN-04.1 "Switch Cases and Confirm Isolation") treats any observed stale-data carryover during a case switch as a disqualifying finding for the entire product, not a minor bug — the refetch-everything-immediately behavior is therefore a hard requirement of this pattern, not an optimization.

---

### Pattern: Severity Tier Badge (F08, Phase 8)

**When to use:** Any entry in the Command Center's "Needs your attention" feed, and anywhere else a severity tier (`CRITICAL`/`HIGH`/`PENDING`/`MEDIUM`) is rendered.
**Behavior:** A fixed color mapping, applied identically everywhere a tier renders, never introduced ad hoc per-screen: `CRITICAL` = dark red, `HIGH` = amber, `PENDING` = amber-light (a lighter/desaturated amber, deliberately distinct from `HIGH`'s amber at a glance), `MEDIUM` = yellow. As with the Status Badge Visual Convention pattern, color is never the sole signal — the tier word itself ("Critical," "High," "Pending," "Medium") always renders as visible text alongside the badge, and an `aria-label` (e.g., `aria-label="Severity: Critical"`) carries the same information to assistive technology. Tiers are never interleaved in a ranked list: every `CRITICAL` entry renders before any `HIGH` entry, every `HIGH` before any `PENDING`, and so on — this pattern governs the badge's *appearance*, not the list's sort order (see F08 §Process step 5 for the sort rule itself).
**Examples:** Command Center "Needs your attention" feed entries (US-8.4).
**Rationale:** A judge scanning the feed under time pressure needs the highest-severity item to be visually unmistakable without reading every row's text first — a single shared badge component (not a per-tier bespoke treatment) is what guarantees `CRITICAL` always reads as more urgent than `MEDIUM` at a glance, consistently, everywhere it appears.

---

### Pattern: Attention Feed Inline Action (F24, Phase 8)

**When to use:** The "Record ruling" and "Transfer custody"/"Assign custodian" controls on a Command Center attention-feed entry — the two write actions that supersede Phase 5's strictly-read-only Command Center constraint (see `00-overview.md` Design Principle 4 and `Screen-00-trial-command-center.md`'s "Design decision supersedes a prior constraint" note).
**Behavior:** Clicking the action button expands an inline form directly within the feed entry — never a modal, never a navigation away from the Command Center — following the same "inline, not modal" spirit as the Inline Row Actions pattern. The form always requires an explicit, distinct confirm step before the underlying write request is sent; no selection (e.g., picking a disposition or a custodian) auto-submits by itself. The button itself renders only for an F20-authorized role for that specific action (`JUDGE` for "Record ruling"; `DEPUTY`/`CLERK`/`ADMIN` for "Assign custodian"/"Transfer custody") — absent, not disabled, for any other role, per the Role-Gated Control Visibility pattern. On success, the entry does not optimistically disappear or update — it waits for the next live-sync poll tick to confirm the new ledger state, then either fades out (ruling resolved) or re-ranks (reserved ruling; custody re-evaluated under a new condition). On failure, the specific rejection reason (e.g., `409 OBJECTION_ALREADY_RESOLVED`, `409 CUSTODY_CHAIN_BROKEN`) renders inline within the still-open form, matching the Multi-Reason Blocking Error pattern's "name the specific reason" spirit, and the entry remains in the feed unchanged.
**Examples:** Command Center "Needs your attention" feed — "Record ruling" (`HIGH`/`PENDING` tiers), "Assign custodian" (`MEDIUM` tier) (US-24.1, US-24.2).
**Rationale:** The PRD's own risk register (§8) names "Command Center's new inline write actions triggered accidentally from what was designed as a passive glance screen" as a medium-impact risk; the explicit-confirm-required rule and the no-optimistic-update rule are this pattern's two direct mitigations, and both must hold even though this is the one part of the Command Center no longer strictly read-only.

---

### Pattern: Readable Flag Pill (Design Principle 7, Phase 8)

**When to use:** Any indicator that previously relied on an icon alone to convey an exhibit's flagged/blocked condition — currently Case Workspace's "Flags" column (renamed from a bare discrepancy icon) and the Jury Package eligibility badge.
**Behavior:** Every such indicator pairs a short, specific, readable text label with its color treatment — "Ruling pending," "No custodian," "Open objection," "Ex parte · restricted," "Included," "Not eligible," "Blocked" — rather than an icon or color swatch requiring a hover/click to interpret. Multiple simultaneous conditions on the same row render as multiple stacked pills, never collapsed into one generic warning glyph. This does not change any underlying discrepancy/eligibility computation — it is a rendering-layer requirement layered on top of the existing Discrepancy Flag Treatment pattern, not a replacement for it (the amber/color semantics of that pattern are unchanged; this pattern adds the mandatory label).
**Examples:** Case Workspace Flags column (amended Phase 8), Case Workspace and Exhibit Detail Jury Package eligibility badges (added Phase 8).
**Rationale:** Design Principle 5 ("plain language over raw data") already governs ledger-event rendering; Phase 8's UX review found the same principle was not yet applied to flag/status iconography — a judge or deputy glancing at a row with an unfamiliar icon has to stop and hover, which is exactly the "glance, don't drill in" friction the rest of this document works to eliminate.
