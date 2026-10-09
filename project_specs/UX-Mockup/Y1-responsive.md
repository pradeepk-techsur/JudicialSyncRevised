## Responsive Considerations

Per PROJECT.md §Out of Scope, JudicialSync targets **web/desktop screens only** — no mobile-native app is in scope. However, a judge's bench tablet (JRN-01.2: "Opens the Trial Command Center on the bench tablet during a two-minute recess") is an explicitly named real-world touchpoint, so tablet-width responsiveness is a first-class concern even though mobile phone layouts are not.

### Desktop (>1024px) — Primary Design Target

- Full sidebar (labeled icons + text) always visible, pinned left.
- Case Workspace and Jury Package Workspace render full multi-column tables with all fields visible without horizontal scroll.
- The Pivota Assistant slide-over panel occupies roughly 30% of viewport width, docked right, with the underlying screen dimmed but still visible for context.
- Exhibit Detail View renders the header block and timeline in a single generous-width column (timelines are inherently vertical; no benefit to a two-column layout here); the pending-custody banner (F19) spans the same column width as the status/custodian line it temporarily replaces, never introducing a second column.
- The Pending-Ruling Queue (F21, judge-only) renders as a single generous-width column of rows, each row's three ruling-action buttons laid out horizontally inline — no drill-in required to act, consistent with it being a triage screen, not a browse screen.
- The header's Case Selector (F22) opens as a simple dropdown anchored to its header slot — it does not reflow or widen the header bar at any desktop width.

### Tablet (768px–1024px) — Judge's Bench Device, High Priority

- Sidebar collapses to icon-only (labels on tap/hover) to preserve content width — this is the primary device for JRN-01.2's "glance during recess" moment, so Command Center legibility at this width is tested explicitly.
- Case Workspace and Jury Package Workspace tables drop lower-priority columns first (description, source) while keeping status badge, custodian, and discrepancy indicator — the three fields a judge glancing mid-recess needs most (US-9.1 information hierarchy).
- The Pivota Assistant slide-over expands to ~60% of viewport width at this breakpoint (text legibility matters more than preserving background-screen visibility on a smaller canvas) — reinforces that on the bench, asking a question is the primary action, not a secondary overlay.
- Touch targets (row actions, citation pills, Finalize button) sized to a minimum 44×44px tap area, since a judge on a tablet may be using touch rather than a trackpad.
- The Pending-Ruling Queue's three ruling-action buttons (Sustained/Overruled/Reserved) retain the same 44×44px minimum tap target at this breakpoint, since this screen exists specifically for the judge's bench-tablet use case (JRN-01.2 "Check the Pending-Ruling Queue") and is never expected to be used at desktop-only precision.

### Mobile (<768px) — Out of Scope, Graceful Degradation Only

- No phone-optimized layout is designed or required per PROJECT.md scope.
- If accessed on a narrow viewport, the app shell collapses the sidebar into a hamburger menu and all tables fall back to a stacked card-per-exhibit layout (status badge, label, and discrepancy icon only, full detail via tap-through) — this is a baseline degradation to avoid a broken layout, not a tested or demo-relevant experience.
- The Pivota Assistant becomes full-screen (not a slide-over) at this width, since a 30–60% panel would be unusably narrow — but this is a fallback behavior, not a design target for the demo walkthrough.
