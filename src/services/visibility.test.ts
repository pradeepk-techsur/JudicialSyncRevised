import { describe, expect, it } from 'vitest';
import type { Role } from '@prisma/client';
import { NextRequest } from 'next/server';
import { canViewSealed, parseRequestingRole } from '@/services/visibility';

// Pure unit tests for the single shared role-visibility module. No DB access —
// these are the foundational predicates every exhibit read inherits, so they are
// exercised in isolation (TechArch 04-security.md §5.2.1).

const ALL_ROLES: Role[] = ['JUDGE', 'CHAMBERS_STAFF', 'DEPUTY', 'CLERK', 'ATTORNEY', 'ADMIN'];
const SEALED_VISIBLE: Role[] = ['JUDGE', 'CHAMBERS_STAFF', 'ADMIN'];
const SEALED_BLOCKED: Role[] = ['DEPUTY', 'CLERK', 'ATTORNEY'];

function requestWithRole(role?: string): NextRequest {
  const headers = new Headers();
  if (role !== undefined) {
    headers.set('X-User-Role', role);
  }
  return new NextRequest('http://localhost/api/exhibits/abc', { headers });
}

describe('canViewSealed', () => {
  it('returns true for exactly JUDGE, CHAMBERS_STAFF, and ADMIN', () => {
    for (const role of SEALED_VISIBLE) {
      expect(canViewSealed(role), `${role} should view sealed`).toBe(true);
    }
  });

  it('returns false for DEPUTY, CLERK, and ATTORNEY', () => {
    for (const role of SEALED_BLOCKED) {
      expect(canViewSealed(role), `${role} should NOT view sealed`).toBe(false);
    }
  });
});

describe('parseRequestingRole', () => {
  it('returns the header value for each of the six valid roles', () => {
    for (const role of ALL_ROLES) {
      expect(parseRequestingRole(requestWithRole(role))).toBe(role);
    }
  });

  it('fails closed to ATTORNEY when the header is missing', () => {
    expect(parseRequestingRole(requestWithRole(undefined))).toBe('ATTORNEY');
  });

  it('fails closed to ATTORNEY for an empty-string header', () => {
    expect(parseRequestingRole(requestWithRole(''))).toBe('ATTORNEY');
  });

  it('fails closed to ATTORNEY for an unrecognized role string', () => {
    expect(parseRequestingRole(requestWithRole('SUPERADMIN'))).toBe('ATTORNEY');
  });
});
