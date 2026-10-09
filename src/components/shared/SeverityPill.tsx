import styles from './SeverityPill.module.scss';

// The ONE component for BOTH the attention-feed severity tier badges AND the
// condition/flag pills (Case Workspace Flags column, Jury Package condition
// pills), per Y0-patterns.md §Severity Tier Badge + §Readable Flag Pill ("one
// pill component, color + text convention shared"). A fixed color-per-tone
// mapping is applied identically everywhere a tier/condition renders — never
// introduced ad hoc per screen — which is exactly what guarantees `critical`
// always reads as more urgent than `medium` at a glance, consistently.
//
// Color is NEVER the sole signal (Y2-accessibility.md "never color alone"): the
// caller-supplied `label` text is ALWAYS visible, and an `aria-label` carries the
// same information to assistive technology. The caller passes either a tier word
// ("Critical" for the attention feed) or a condition phrase ("Unresolved
// objection" / "No custodian on record" / "Critical · ex parte material" /
// "Ruling pending" / "Open objection" / "Ex parte · restricted" for condition
// pills). `ariaLabel` defaults to the tier-word form; a caller rendering a
// condition pill should pass an explicit one (e.g. "Flag: No custodian on
// record").

export type SeverityTone = 'critical' | 'high' | 'pending' | 'medium';

const TONE_CONFIG: Record<SeverityTone, { toneClass: string; tierWord: string }> =
  {
    critical: { toneClass: styles.toneCritical, tierWord: 'Critical' },
    high: { toneClass: styles.toneHigh, tierWord: 'High' },
    pending: { toneClass: styles.tonePending, tierWord: 'Pending' },
    medium: { toneClass: styles.toneMedium, tierWord: 'Medium' },
  };

export function SeverityPill({
  tone,
  label,
  ariaLabel,
}: {
  tone: SeverityTone;
  label: string;
  ariaLabel?: string;
}) {
  const cfg = TONE_CONFIG[tone];
  return (
    <span
      className={`${styles.pill} ${cfg.toneClass}`}
      data-testid="severity-pill"
      data-tone={tone}
      aria-label={ariaLabel ?? `Severity: ${cfg.tierWord}`}
    >
      {label}
    </span>
  );
}
