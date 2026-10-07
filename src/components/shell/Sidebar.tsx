import Link from 'next/link';
import { JuryPackageNavItem } from './JuryPackageNavItem';

// Per UX-Mockup 00-overview.md's 4-item nav model. Case Workspace (Phase 2) and
// Jury Package (Phase 3) are live routes; Command Center and Assistant remain
// visibly-disabled placeholders (Phases 4-5). Rendering the remaining two as
// disabled placeholders — rather than omitting them or linking to a route that
// 404s — keeps the full eventual nav model visible (matching the mockup) while
// satisfying the "never link to a route that doesn't exist" rule.
const COMING_SOON = [{ label: 'Command Center' }, { label: 'Assistant' }];

export function Sidebar() {
  return (
    <nav aria-label="Main navigation" className="no-print w-48 shrink-0 border-r p-3">
      <ul className="space-y-1">
        <li>
          <Link href="/case" className="block rounded px-2 py-1.5 text-sm font-medium hover:bg-gray-100">
            Case Workspace
          </Link>
        </li>
        <li>
          <JuryPackageNavItem />
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
