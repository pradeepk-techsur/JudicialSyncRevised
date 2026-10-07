import type { Case, Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { DEMO_CASE_NUMBER } from '@/lib/constants';

export interface ActiveCaseUser {
  id: string;
  name: string;
  role: Role;
}

export interface ActiveCaseWithUsers {
  case: Case;
  users: ActiveCaseUser[];
}

// Single-case demo scope (PROJECT.md): there is exactly one case, keyed by
// the fixed DEMO_CASE_NUMBER. This is the app shell's bootstrap call —
// resolves the caseId the client needs for every subsequent
// /api/cases/:id/... call, plus the seeded persona roster the role switcher
// renders. Read-only; no visibility filtering applies here (user identity
// rows themselves are not sealed-exhibit-gated content).
export async function getActiveCaseWithUsers(): Promise<ActiveCaseWithUsers | null> {
  const kase = await prisma.case.findUnique({ where: { caseNumber: DEMO_CASE_NUMBER } });
  if (!kase) {
    return null;
  }
  const users = await prisma.user.findMany({
    where: { caseId: kase.id, isActive: true },
    select: { id: true, name: true, role: true },
    orderBy: { role: 'asc' },
  });
  return { case: kase, users };
}
