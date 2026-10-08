import Link from 'next/link';
import styles from './ExhibitNotFound.module.scss';

// Rendered for BOTH a genuinely-missing exhibit and a sealed exhibit viewed by
// an unauthorized role — the two must be byte-identical (anti-enumeration,
// US-10.2 / T-06-13). `role="status"` (NOT `role="alert"`) keeps the tone calm
// and informational, matching a real 404 rather than signalling an error.
// Phase 6 swaps only the styling layer from Tailwind utilities to Carbon type
// tokens; the exact heading text, paragraph copy, and back-link text/href are
// preserved.
export function ExhibitNotFound() {
  return (
    <div role="status">
      <h1 className={styles.heading}>Exhibit not found</h1>
      <p className={styles.body}>No exhibit found with the given ID.</p>
      <Link href="/case" className={styles.link}>
        ← Back to Case Workspace
      </Link>
    </div>
  );
}
