## Accessibility Notes

Accessibility is directly tied to this product's core claim — a judge ruling live from the bench cannot afford a status badge or citation that's ambiguous to perceive quickly, and PRD §6 explicitly prioritizes "clarity and trustworthiness of answers" for a non-technical audience over visual sophistication.

### Color Contrast

- Status badges (`MARKED`/`OFFERED`/`OBJECTED`/`ADMITTED`/`EXCLUDED`/`WITHDRAWN`) never rely on color alone — each pairs a distinct color with a filled/outlined dot shape AND the status word as text, so the distinction holds for colorblind users and in grayscale print/export (relevant to the Jury Package Workspace's export feature).
- Discrepancy amber and the "finalized/clean" green meet WCAG AA contrast ratios (4.5:1 minimum for text) against their panel backgrounds.
- The decline-response styling in the Assistant is distinguished from a grounded answer by the *presence/absence of a citation pill*, not by color alone — ensuring the distinction is legible to screen-reader users and colorblind users alike.

### Keyboard Navigation

- All inline row actions (Record Status, Propose Custody Transfer, Confirm Receipt, Cancel Transfer, Raise Objection, Acknowledge) are reachable and operable via keyboard alone (Tab to focus, Enter/Space to activate, Escape to collapse the inline action without committing).
- The Pending-Ruling Queue's ruling buttons and "View exhibit history →" link are each independently Tab-reachable per row, in a consistent left-to-right tab order matching the visual row layout.
- The header Case Selector is a standard keyboard-operable dropdown (Enter/Space to open, arrow keys to move between cases, Enter to select, Escape to close without changing selection).
- The Pivota Assistant input is keyboard-first by design: Enter submits, Shift+Enter inserts a newline for longer questions, and the example-question chips are Tab-reachable and Enter-activatable.
- The "Finalize Jury Package" disabled state is exposed via the native `disabled` attribute (not just a CSS class), so assistive technology correctly announces it as unavailable rather than silently skipping it or announcing it as clickable.
- Citation pills are real `<a>`/button elements in the DOM tab order, never a styled `<span>` requiring a mouse click.

### Screen Reader Considerations

- Live-updating panels (Command Center's Recent Activity, Case Workspace's polling rows) use a polite `aria-live` region for new items — announced without interrupting whatever the user is currently focused on, avoiding the "jarring interruption" risk that would undermine the "ambient, not alarming" design intent.
- The Assistant's streaming response uses an `aria-live="polite"` region on the response container so screen-reader users hear the answer as it completes, not token-by-token (which would be unintelligible).
- Discrepancy banners include a visually-hidden (`sr-only`) prefix such as "Warning: " before the rule explanation, so the semantic meaning of the amber color is conveyed audibly even though the visible text itself ("Admitted, no custodian of record") doesn't restate the word "discrepancy."
- The sealed-exhibit "not found" page uses identical markup/ARIA structure to a genuine 404, so assistive technology cannot be used to infer a difference that sighted UI also doesn't reveal (preserving US-10.2's non-disclosure guarantee across modalities).
- The pending-custody-transfer banner (F19) uses a `role="status"` region (informational, not an error) distinct from the `role="alert"` used by discrepancy banners, so screen-reader users do not perceive an in-progress handoff as a problem requiring urgent attention.
- The Pending-Ruling Queue's elapsed-wait-time values update their text content on each live-sync tick inside a polite `aria-live` region scoped to the row, not the whole list, so a screen-reader user isn't re-announced the entire queue every 3–5 seconds — only the row(s) whose wait time or presence actually changed.

### ARIA Labels Needed

- `aria-label` on each status badge stating the full status in words (e.g., `aria-label="Current status: Admitted"`) rather than relying on the dot glyph alone.
- `aria-describedby` linking each citation pill to its full record reference (record type, ID, timestamp) so screen readers announce complete citation context, not just a truncated visible label like "Ex.14·2:41 PM".
- `role="status"` on the Assistant's decline-response bubble, distinct from `role="alert"` reserved for true error states (e.g., "assistant temporarily unavailable") — ensuring screen-reader users perceive the same calm/non-error framing that sighted users get from the neutral visual styling.
- `aria-disabled` plus a programmatically associated caption (`aria-describedby`) on the Finalize button explaining *why* it's disabled, so the reason is announced, not just the disabled state itself.
- Landmark roles (`nav` for the sidebar, `main` for screen content, `complementary` for the Assistant slide-over panel) so keyboard and screen-reader users can jump directly between the app shell's regions.
- `aria-label` on the header Case Selector stating the full current case identifier (e.g., `aria-label="Active case: 2026-CR-0142, click to switch cases"`), not just the visible truncated text.
- The sidebar's "Pending Rulings" entry, when rendered (judge role only), carries no special ARIA distinction from any other sidebar item — its role-gated absence for other roles is itself the accessibility-relevant behavior (a screen reader for a non-judge role simply never encounters it in the nav list, consistent with the "absent, not disabled" principle applied visually).
