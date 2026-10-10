import type { ReactNode } from 'react';
import styles from './ActionButtonRow.module.scss';

// The one primary/secondary button-pairing convention: a solid primary action on
// the left, an optional outline secondary action to its right, with the same
// sizing/spacing on every card type (attention-feed entries, Jury Package blocker
// cards, Exhibit Detail headers). This is a LAYOUT-ONLY wrapper — callers pass
// already-built Carbon `<Button kind="primary">` / `<Button kind="secondary">`
// (or `kind="danger"` for a red "Remove from package" primary) as children; the
// wrapper only guarantees consistent flex layout/spacing, never dictates button
// content or kind.

export function ActionButtonRow({
  primary,
  secondary,
}: {
  primary: ReactNode;
  secondary?: ReactNode;
}) {
  return (
    <div className={styles.row} data-testid="action-button-row">
      {primary}
      {secondary}
    </div>
  );
}
