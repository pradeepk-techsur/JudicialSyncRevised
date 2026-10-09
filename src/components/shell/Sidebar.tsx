'use client';

import Link from 'next/link';
import { SideNav, SideNavItems, SideNavLink } from '@carbon/react';
import { JuryPackageNavItem } from './JuryPackageNavItem';
import styles from './Sidebar.module.scss';

// Per UX-Mockup 00-overview.md's 4-item nav model, now rendered via Carbon's
// UI Shell left-panel components (SideNav / SideNavItems / SideNavLink) instead
// of a hand-rolled <nav>/<ul>. Command Center (Phase 5) stays the FIRST, live
// nav item and the default landing (/ redirects here); Case Workspace (Phase 2),
// Jury Package (Phase 3) and Assistant (Phase 4) follow as live routes.
//
// Carbon's SideNavLink renders through its internal polymorphic Link, so
// `as={Link}` makes each nav item a Next.js <Link> carrying the Carbon
// `cds--side-nav__link` class — client-side routing (and the zustand role-store
// state that rides across routes) is preserved, no full-page reload.
//
// `isFixedNav expanded` keeps the rail always open (no collapse/inert state) so
// every link stays in the accessibility tree. The whole sidebar is wrapped in a
// `no-print` container so 06-01's print CSS hides it during Jury Package export.
export function Sidebar() {
  return (
    // `styles.darkNav` scopes the dark-navy theme to this sidebar's Carbon
    // SideNav (its `:global(.cds--side-nav)` rules match the descendant Carbon
    // node), making the rail the single most visually distinct shell region
    // without touching Carbon's global White theme elsewhere.
    <div className={`no-print ${styles.darkNav}`}>
      <SideNav
        aria-label="Main navigation"
        isFixedNav
        expanded
        isChildOfHeader={false}
      >
        <SideNavItems>
          <SideNavLink as={Link} href="/command-center">
            Command Center
          </SideNavLink>
          <SideNavLink as={Link} href="/case">
            Case Workspace
          </SideNavLink>
          <JuryPackageNavItem />
          <SideNavLink as={Link} href="/assistant">
            Assistant
          </SideNavLink>
        </SideNavItems>
      </SideNav>
    </div>
  );
}
