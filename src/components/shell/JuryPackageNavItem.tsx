'use client';

import Link from 'next/link';
import { useDiscrepancyCount } from '@/hooks/useDiscrepancyCount';

// The live Jury Package nav link with an ambient open-discrepancy count pill
// (CONTEXT "Ambient count"). This is the inbound link that wires /jury-package
// into the app shell — the page is reachable from the sidebar on every screen.
// It is a small client component (the rest of the Sidebar stays server-rendered)
// so it can read the live useDiscrepancyCount query (4s polling). The count is
// role-scoped: a sealed exhibit's flags aren't returned for an unauthorized role,
// so the badge reflects what that role can see (acceptable and correct).
export function JuryPackageNavItem() {
  const { openCount } = useDiscrepancyCount();

  return (
    <Link
      href="/jury-package"
      data-testid="nav-jury-package"
      className="flex items-center justify-between rounded px-2 py-1.5 text-sm font-medium hover:bg-gray-100"
    >
      <span>Jury Package</span>
      {openCount > 0 && (
        <span
          data-testid="jury-count-badge"
          className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 py-0.5 text-xs font-semibold text-white"
          aria-label={`${openCount} open discrepancies`}
        >
          {openCount}
        </span>
      )}
    </Link>
  );
}
