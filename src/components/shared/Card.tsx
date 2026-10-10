import type { ReactNode } from 'react';
import styles from './Card.module.scss';

// The shared card-chrome wrapper: a rounded-corner white card on the light content
// area (the Phase 8 dark-dashboard foundation, per 00-overview.md §Visual
// Foundation). A card in a blocked/critical state gets the IDENTICAL red
// left-border treatment, applied the same way regardless of consumer — an
// attention-feed entry, a Jury Package blocker card, or any future card-shaped
// surface — so "critical" never drifts into a bespoke per-screen treatment.
//
// Extra props (and `className`) are forwarded so callers can attach data-testids,
// aria attributes, or click handlers without this wrapper having to know about
// them.

export function Card({
  critical,
  children,
  className,
  ...rest
}: {
  critical?: boolean;
  children: ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`${styles.card} ${critical ? styles.critical : ''} ${className ?? ''}`}
      data-testid="dashboard-card"
      data-critical={critical ? 'true' : 'false'}
      {...rest}
    >
      {children}
    </div>
  );
}
