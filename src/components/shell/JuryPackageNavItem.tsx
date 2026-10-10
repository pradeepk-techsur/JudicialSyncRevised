'use client';

import type { ComponentType } from 'react';
import Link from 'next/link';
import { SideNavLink, Tag } from '@carbon/react';
import { useDiscrepancyCount } from '@/hooks/useDiscrepancyCount';

// The live Jury Package nav link with an ambient open-discrepancy count pill
// (CONTEXT "Ambient count"). This is the inbound link that wires /jury-package
// into the app shell — the page is reachable from the sidebar on every screen.
// It is a small client component (the rest of the Sidebar stays server-rendered)
// so it can read the live useDiscrepancyCount query (4s polling). The count is
// role-scoped: a sealed exhibit's flags aren't returned for an unauthorized role,
// so the badge reflects what that role can see (acceptable and correct).
//
// Carbon migration: the link is now a Carbon SideNavLink rendered through
// Next.js's <Link> (`as={Link}`) so it sits in the SideNav rail with the same
// client-side routing; the amber circle becomes a Carbon red Tag. The two
// testids (nav-jury-package, jury-count-badge) and the pill's aria-label are
// preserved verbatim, and the badge is still only rendered when openCount > 0.
//
// 09-08 (T-08): the Sidebar owns the route logic, so it passes `isActive` and the
// per-entry `renderIcon` down here (this component renders its own SideNavLink,
// so it must forward both Carbon props itself to get the active wash + leading
// icon the sibling plain SideNavLinks get).
interface JuryPackageNavItemProps {
  renderIcon?: ComponentType;
  isActive?: boolean;
}

export function JuryPackageNavItem({ renderIcon, isActive }: JuryPackageNavItemProps) {
  const { openCount } = useDiscrepancyCount();

  return (
    <SideNavLink
      as={Link}
      href="/jury-package"
      data-testid="nav-jury-package"
      renderIcon={renderIcon}
      isActive={isActive}
    >
      Jury Package
      {openCount > 0 && (
        // SideNavLink wraps children in <SideNavLinkText> (a <span>), and a
        // non-interactive Carbon Tag defaults to a block <div>, which is invalid
        // nested inside a <span>. Render the pill as an inline <span> via `as`.
        <Tag
          as="span"
          type="red"
          size="sm"
          data-testid="jury-count-badge"
          aria-label={`${openCount} open discrepancies`}
        >
          {openCount}
        </Tag>
      )}
    </SideNavLink>
  );
}
