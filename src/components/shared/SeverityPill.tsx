import {
  WarningAltFilled,
  WarningFilled,
  Time,
  Information,
} from '@carbon/icons-react';
import type { ComponentType } from 'react';
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
// same information to assistive technology. The leading per-tone icon is purely
// decorative reinforcement (`aria-hidden`), never the sole signal either. The
// caller passes either a tier word ("Critical" for the attention feed) or a
// condition phrase ("Unresolved objection" / "No custodian on record" / "Critical
// · ex parte material" / "Ruling pending" / "Open objection" / "Ex parte ·
// restricted" for condition pills). `ariaLabel` defaults to the tier-word form; a
// caller rendering a condition pill should pass an explicit one (e.g. "Flag: No
// custodian on record").
//
// T-02 (external UI/UX review) fix: the four tones now use four DIFFERENT Carbon
// color families (red/orange/blue/yellow — see SeverityPill.module.scss) instead
// of four near-identical yellows, and each carries its own icon. This is a
// styling-only change — the public API (SeverityTone, SeverityPill props/exports)
// is unchanged, so every existing consumer compiles untouched.
//
// Icon choices (closest semantically-named icons in @carbon/icons-react v11):
//   critical → WarningAltFilled  high → WarningFilled  pending → Time
//   medium   → Information
// All four names verified present as exports in the installed version.

export type SeverityTone = 'critical' | 'high' | 'pending' | 'medium';

// @carbon/icons-react components accept size/className and render an <svg>.
type CarbonIcon = ComponentType<{
  size?: number;
  className?: string;
  'aria-hidden'?: boolean;
}>;

const TONE_CONFIG: Record<
  SeverityTone,
  { toneClass: string; tierWord: string; Icon: CarbonIcon }
> = {
  critical: {
    toneClass: styles.toneCritical,
    tierWord: 'Critical',
    Icon: WarningAltFilled,
  },
  high: { toneClass: styles.toneHigh, tierWord: 'High', Icon: WarningFilled },
  pending: { toneClass: styles.tonePending, tierWord: 'Pending', Icon: Time },
  medium: {
    toneClass: styles.toneMedium,
    tierWord: 'Medium',
    Icon: Information,
  },
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
  const { Icon } = cfg;
  return (
    <span
      className={`${styles.pill} ${cfg.toneClass}`}
      data-testid="severity-pill"
      data-tone={tone}
      aria-label={ariaLabel ?? `Severity: ${cfg.tierWord}`}
    >
      <Icon className={styles.icon} aria-hidden={true} />
      {label}
    </span>
  );
}
