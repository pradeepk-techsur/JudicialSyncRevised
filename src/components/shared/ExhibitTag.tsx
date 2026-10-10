import styles from './ExhibitTag.module.scss';

// The SINGLE shared representation of an exhibit label (`P-3`, `S-1`, etc.),
// replacing every ad hoc `{row.exhibitLabel}` text node across the four Phase 8
// screens (Command Center attention feed / custody panel / activity feed,
// Exhibit Detail header/breadcrumb, Jury Package cards, Case Workspace table,
// and the Assistant's inline prose chips). Directly extends the Status Badge
// Visual Convention's "one shared component" rationale to exhibit labels per the
// 08-CONTEXT standardization decision — so an exhibit label can never render as
// five independent per-screen implementations and visually drift.
//
// This is a PURELY presentational chip: a small, bold, monospace-ish token with
// a subtle background tint. It carries NO color variation by status — exhibit
// status is StatusBadge's job, never this component's.

export function ExhibitTag({ label }: { label: string }) {
  return (
    <span className={styles.tag} data-testid="exhibit-tag">
      {label}
    </span>
  );
}
