import Link from 'next/link';
import { JuryPackageNavItem } from './JuryPackageNavItem';

// Per UX-Mockup 00-overview.md's 4-item nav model. Command Center (Phase 5) is
// now the FIRST, live nav item and the default landing (/ redirects here); Case
// Workspace (Phase 2), Jury Package (Phase 3) and Assistant (Phase 4) follow as
// live routes. Every item is a real route — there is no remaining placeholder.
// This Phase 5 edit is ADDITIVE: it activates Command Center first/live and
// leaves the Jury Package and Assistant activations (03-04 / 04-05) untouched.
export function Sidebar() {
  return (
    <nav aria-label="Main navigation" className="no-print w-48 shrink-0 border-r p-3">
      <ul className="space-y-1">
        <li>
          <Link href="/command-center" className="block rounded px-2 py-1.5 text-sm font-medium hover:bg-gray-100">
            Command Center
          </Link>
        </li>
        <li>
          <Link href="/case" className="block rounded px-2 py-1.5 text-sm font-medium hover:bg-gray-100">
            Case Workspace
          </Link>
        </li>
        <li>
          <JuryPackageNavItem />
        </li>
        <li>
          <Link href="/assistant" className="block rounded px-2 py-1.5 text-sm font-medium hover:bg-gray-100">
            Assistant
          </Link>
        </li>
      </ul>
    </nav>
  );
}
