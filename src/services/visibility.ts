import type { Role } from '@prisma/client';
import type { NextRequest } from 'next/server';

// Role-Based Visibility (FRD 00-header.md; TechArch 04-security.md §5.2.1).
// Sealed-exhibit exclusion is applied as a WHERE predicate inside every
// service-layer read function that returns exhibit rows — never as a
// post-query filter in a route or UI component. This module is the single
// place that table lives, so it can never drift between getExhibit,
// getExhibits, searchExhibits, and getExhibitHistory.

export const SEALED_VISIBLE_ROLES: ReadonlySet<Role> = new Set<Role>([
  'JUDGE',
  'CHAMBERS_STAFF',
  'ADMIN',
]);

const ALL_ROLES: ReadonlySet<string> = new Set([
  'JUDGE',
  'CHAMBERS_STAFF',
  'DEPUTY',
  'CLERK',
  'ATTORNEY',
  'ADMIN',
]);

export function canViewSealed(role: Role): boolean {
  return SEALED_VISIBLE_ROLES.has(role);
}

// There is no session/auth layer (PROJECT.md scope) — the demo's role switcher
// sends its active role as a plain `X-User-Role` request header (TechArch
// §4.12 RequestContext). A missing or invalid header fails CLOSED to the
// least-privileged role (ATTORNEY: no sealed visibility) rather than throwing
// or defaulting to full visibility — there is nothing to authenticate against,
// so "unrecognized" must never be treated as "trusted."
export function parseRequestingRole(request: NextRequest): Role {
  const header = request.headers.get('x-user-role');
  if (header && ALL_ROLES.has(header)) {
    return header as Role;
  }
  return 'ATTORNEY';
}
