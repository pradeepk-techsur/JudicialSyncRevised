'use client';

import { useState } from 'react';

const MAX_JUSTIFICATION = 500;

// Inline acknowledge expansion (CONTEXT: acknowledge is inline, NOT a modal).
// A textarea + Confirm/Cancel with a live N/500 counter, a hard 500-char cap, and
// a Confirm that is disabled while the justification is empty/whitespace. There is
// NO optimistic client state: on Confirm it calls the provided async onConfirm
// (the acknowledge mutation); the PARENT invalidates/refetches so the row restyles
// to muted "Ack'd" from LIVE server state and the finalize gate re-enables. The
// server's 422 JUSTIFICATION_REQUIRED is the backstop, shown inline if returned.
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
    <div className="mt-2 rounded border border-amber-200 bg-amber-50/50 p-2" data-testid="acknowledge-inline">
      <label className="block text-xs font-medium text-amber-900">
        Justification (required)
        <textarea
          data-testid="acknowledge-textarea"
          className="mt-1 w-full rounded border border-amber-300 bg-white p-1.5 text-sm text-gray-900"
          rows={2}
          maxLength={MAX_JUSTIFICATION}
          value={value}
          disabled={pending}
          onChange={(e) => setValue(e.target.value.slice(0, MAX_JUSTIFICATION))}
          placeholder="Why is this discrepancy acceptable for the jury package?"
        />
      </label>
      <div className="mt-1 flex items-center justify-between">
        <span
          data-testid="acknowledge-counter"
          className="text-xs text-amber-700"
          aria-live="polite"
        >
          {value.length}/{MAX_JUSTIFICATION}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
            onClick={onCancel}
            disabled={pending}
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="acknowledge-confirm"
            className="rounded bg-amber-600 px-2 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => canConfirm && onConfirm(trimmed)}
            disabled={!canConfirm}
          >
            {pending ? 'Acknowledging…' : 'Confirm'}
          </button>
        </div>
      </div>
      {error && (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
