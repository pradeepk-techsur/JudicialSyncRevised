'use client';

import { useState } from 'react';
import { TextArea, Button } from '@carbon/react';
import styles from './AcknowledgeInline.module.scss';

const MAX_JUSTIFICATION = 500;

// Inline acknowledge expansion (CONTEXT: acknowledge is inline, NOT a modal).
// A textarea + Confirm/Cancel with a live N/500 counter, a hard 500-char cap, and
// a Confirm that is disabled while the justification is empty/whitespace. There is
// NO optimistic client state: on Confirm it calls the provided async onConfirm
// (the acknowledge mutation); the PARENT invalidates/refetches so the row restyles
// to muted "Ack'd" from LIVE server state and the finalize gate re-enables. The
// server's 422 JUSTIFICATION_REQUIRED is the backstop, shown inline if returned.
//
// Phase 6 swaps only the rendering layer: the hand-rolled <textarea>/<button>
// markup becomes Carbon `TextArea` + `Button`. All four data-testids, the live
// counter (aria-live="polite"), the 500-char maxLength cap, the trim-then-empty
// canConfirm gate (T-06-04), and the compact inline (non-modal) shape are
// preserved byte-for-byte — exercised transitively by jury-package.spec.ts and
// exhibit-detail.spec.ts via the Wave 3 screens that mount this component.
export function AcknowledgeInline({
  onConfirm,
  onCancel,
  pending,
  error,
}: {
  onConfirm: (justification: string) => void | Promise<void>;
  onCancel: () => void;
  pending?: boolean;
  error?: string | null;
}) {
  const [value, setValue] = useState('');
  const trimmed = value.trim();
  const canConfirm = trimmed.length > 0 && !pending;

  return (
    <div className={styles.container} data-testid="acknowledge-inline">
      {/* F14: always-visible permanence disclosure, shown BEFORE the action is
          confirmed — never a hover/tooltip. One copy, shared by both the Exhibit
          Detail banner and the Jury Package Workspace (both mount this component). */}
      <p className={styles.disclosure} data-testid="acknowledge-disclosure">
        Acknowledging will be recorded as a permanent action under your name and role.
      </p>
      {/* Carbon TextArea forwards rest props (data-testid, maxLength, value,
          disabled) onto its inner <textarea>, so the testid lands on the element
          the Wave 3 specs target. */}
      <TextArea
        id="acknowledge-justification"
        labelText="Justification (recorded permanently)"
        data-testid="acknowledge-textarea"
        rows={2}
        maxLength={MAX_JUSTIFICATION}
        value={value}
        disabled={pending}
        onChange={(e) => setValue(e.target.value.slice(0, MAX_JUSTIFICATION))}
        placeholder="Why is this discrepancy acceptable for the jury package?"
      />
      <div className={styles.controlRow}>
        <span
          data-testid="acknowledge-counter"
          className={styles.counter}
          aria-live="polite"
        >
          {value.length}/{MAX_JUSTIFICATION}
        </span>
        <div className={styles.buttons}>
          <Button
            kind="ghost"
            size="sm"
            type="button"
            onClick={onCancel}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            kind="primary"
            size="sm"
            type="button"
            data-testid="acknowledge-confirm"
            onClick={() => canConfirm && onConfirm(trimmed)}
            disabled={!canConfirm}
          >
            {pending ? 'Acknowledging…' : 'Confirm'}
          </Button>
        </div>
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
