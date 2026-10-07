'use client';

// =============================================================================
// ExampleChips — the empty-state zero-typing path (CONTEXT.md).
//
// Renders the FIVE named demo questions as tappable chips. Tapping a chip calls
// `onPick(text)`, which the thread wires to the hook's `sendExample` (pre-fill +
// AUTO-SUBMIT). Chips are ONLY rendered in the empty state — once the
// conversation has messages they disappear (the thread stops rendering this).
//
// These exact five questions are the demo's scripted keystone (F7 / the roadmap's
// five named questions that must resolve grounded-or-decline). Keep them verbatim.
// =============================================================================

const EXAMPLE_QUESTIONS = [
  'What exhibits were admitted yesterday?',
  'What objections remain unresolved?',
  'Is Exhibit 14 in the jury package?',
  'Who currently has custody of Exhibit 7?',
  'What happened to Exhibit 14?',
] as const;

export function ExampleChips({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex flex-col gap-2" data-testid="example-chips">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
        Try asking
      </p>
      <div className="flex flex-wrap gap-2">
        {EXAMPLE_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            data-testid="example-chip"
            onClick={() => onPick(q)}
            className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-left text-sm text-gray-700 hover:border-gray-400 hover:bg-gray-50"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
