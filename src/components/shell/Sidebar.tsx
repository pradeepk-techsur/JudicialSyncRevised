import Link from 'next/link';

// Per UX-Mockup 00-overview.md's 4-item nav model: only Case Workspace is a
// live route this phase (Command Center/Jury Package/Assistant ship in
// Phases 3-5). Rendering the other three as visibly-disabled placeholders —
// rather than omitting them or linking to a route that 404s — keeps the
// full eventual nav model visible (matching the mockup) while satisfying
// the "never link to a route that doesn't exist" rule.
const COMING_SOON = [
  { label: 'Command Center' },
  { label: 'Jury Package' },
  { label: 'Assistant' },
];

export function Sidebar() {
  return (
    <nav aria-label="Main navigation" className="w-48 shrink-0 border-r p-3">
      <ul className="space-y-1">
        <li>
          <Link href="/case" className="block rounded px-2 py-1.5 text-sm font-medium hover:bg-gray-100">
            Case Workspace
          </Link>
        </li>
        {COMING_SOON.map((item) => (
          <li key={item.label}>
            <span
              className="block cursor-not-allowed rounded px-2 py-1.5 text-sm text-gray-400"
              aria-disabled="true"
              title={`${item.label} — coming soon`}
            >
              {item.label} <span className="text-xs">(soon)</span>
            </span>
          </li>
        ))}
      </ul>
    </nav>
  );
}
