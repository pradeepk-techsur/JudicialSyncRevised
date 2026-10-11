'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SideNav, SideNavItems, SideNavLink } from '@carbon/react';
import { Dashboard, Folder, DocumentExport, Chat } from '@carbon/icons-react';
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
  // 09-08 (T-08): route-driven active state. The current route's nav item gets
  // Carbon's own `isActive` treatment (adds `.cds--side-nav__link--current` ->
  // the dark-navy active wash from Sidebar.module.scss + Carbon's left bar), so
  // the active screen is marked by more than default link styling. usePathname
  // is the same App Router hook AssistantPanel.tsx already uses. Exact-match per
  // route, EXCEPT Case Workspace, which also owns the /exhibit/[id] detail pages
  // (the sidebar is the only entry point into an exhibit), so those mark Case
  // Workspace active via a startsWith check. usePathname can briefly be null
  // during hydration — coalesce to '' so no item is wrongly marked active then.
  const pathname = usePathname() ?? '';

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
          <SideNavLink
            as={Link}
            href="/command-center"
            renderIcon={Dashboard}
            isActive={pathname === '/command-center'}
          >
            Command Center
          </SideNavLink>
          <SideNavLink
            as={Link}
            href="/case"
            renderIcon={Folder}
            isActive={pathname === '/case' || pathname.startsWith('/exhibit')}
          >
            Case Workspace
          </SideNavLink>
          <JuryPackageNavItem
            renderIcon={DocumentExport}
            isActive={pathname === '/jury-package'}
          />
          <SideNavLink
            as={Link}
            href="/assistant"
            renderIcon={Chat}
            isActive={pathname === '/assistant'}
          >
            Assistant
          </SideNavLink>
        </SideNavItems>
      </SideNav>
    </div>
  );
}
