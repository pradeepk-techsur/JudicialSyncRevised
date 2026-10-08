## Interaction Patterns

**Design System (as of Phase 6):** All patterns below are implemented using IBM Carbon Design System (carbondesignsystem.com) components and design tokens, replacing the prior Tailwind/shadcn visual foundation. The interaction guarantees described in each pattern are unchanged from that prior implementation — only the underlying component/styling layer changed, not the behavior.

### Pattern: Inline Row Actions (not modal forms)

**When to use:** Any time a user needs to log a status change, objection, ruling, or custody transfer from the Case Workspace or Exhibit Detail View.
**Behavior:** A compact, inline expansion directly within the row/header — never a full-screen modal dialog or a separate "add record" page. Only valid next actions are offered as options (e.g., only valid forward status transitions appear in the dropdown); invalid options are never shown as disabled list items requiring explanation, they are simply absent.
**Examples:** "Record Status," "Transfer Custody," "Raise Objection" actions on Case Workspace rows and the Exhibit Detail header (US-1.1, US-2.1, US-3.1).
**Rationale:** Reinforces "assistant augmenting an existing workflow," not "new case management system to learn" (PROJECT.md positioning constraint). A deputy who already knows the paper-log motions should find this faster, not slower, than what it replaces.

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
