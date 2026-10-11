'use client';

import type { ComponentType } from 'react';
import Link from 'next/link';
import { SideNavLink, Tag } from '@carbon/react';
import { useJuryPackage } from '@/hooks/useJuryPackage';

// The live Jury Package nav link with an ambient jury-package-blocker count pill
// (CONTEXT "Ambient count"). This is the inbound link that wires /jury-package
// into the app shell — the page is reachable from the sidebar on every screen.
// It is a small client component (the rest of the Sidebar stays server-rendered)
// so it can read the live useJuryPackage query (4s polling). The count is
// role-scoped: a sealed exhibit's row isn't returned for an unauthorized role,
// so the badge reflects what that role can see (acceptable and correct).
//
// 09-08 (T-08): the badge now counts JURY-PACKAGE BLOCKERS, not the case-wide
// open-discrepancy count it used to. The old source (useDiscrepancyCount.openCount)
// counted OPEN discrepancy flags across EVERY exhibit — including OFFERED/OBJECTED
// exhibits that are never jury-package candidates and therefore never appear on
// the Jury Package page's own Blockers section. That produced the "badge shows 2
// while the page shows nothing" defect from the UI/UX review. The badge now uses
// the SAME formula the Jury Package page's Blockers heading and the Command Center
// "Jury package blockers" stat card use — `exhibits.filter(FLAGGED || isSealed)`
// — so all three numbers agree by construction (this small duplication across
// 2-3 call sites is the codebase's established pattern).
//
// Carbon: the link is a Carbon SideNavLink rendered through Next.js's <Link>
// (`as={Link}`); the count is a Carbon red Tag. The two testids
// (nav-jury-package, jury-count-badge) are preserved verbatim, the badge is still
// only rendered when the count > 0, and the Sidebar's `isActive`/`renderIcon`
// (route-active wash + leading icon) are forwarded onto this component's own link.
interface JuryPackageNavItemProps {
  renderIcon?: ComponentType;
  isActive?: boolean;
}

export function JuryPackageNavItem({ renderIcon, isActive }: JuryPackageNavItemProps) {
  const { data } = useJuryPackage();

  // IDENTICAL to command-center/page.tsx's juryBlockers and the Jury Package
  // page's own Blockers count: every FLAGGED jury-package row PLUS any sealed
  // (CRITICAL / ex-parte) row. The view already excludes EXCLUDED rows, so a
  // FLAGGED-or-sealed INCLUDED row is a genuine blocker.
  const blockerCount =
    data?.exhibits.filter((e) => e.discrepancyStatus === 'FLAGGED' || e.isSealed).length ?? 0;

  return (
    <SideNavLink
      as={Link}
      href="/jury-package"
      data-testid="nav-jury-package"
      renderIcon={renderIcon}
      isActive={isActive}
    >
      Jury Package
      {blockerCount > 0 && (
        // SideNavLink wraps children in <SideNavLinkText> (a <span>), and a
        // non-interactive Carbon Tag defaults to a block <div>, which is invalid
        // nested inside a <span>. Render the pill as an inline <span> via `as`.
        <Tag
          as="span"
          type="red"
          size="sm"
          data-testid="jury-count-badge"
          aria-label={`${blockerCount} jury package blockers`}
        >
          {blockerCount}
        </Tag>
      )}
    </SideNavLink>
  );
}
