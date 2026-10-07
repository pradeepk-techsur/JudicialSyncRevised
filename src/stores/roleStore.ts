import { create } from 'zustand';
import type { Role } from '@prisma/client';

export interface ActiveCaseUser {
  id: string;
  name: string;
  role: Role;
}

interface RoleState {
  caseId: string | null;
  caseNumber: string | null;
  users: ActiveCaseUser[];
  activeUserId: string | null;
  role: Role;
  hydrate: (data: { case: { id: string; caseNumber: string }; users: ActiveCaseUser[] }) => void;
  setActiveUser: (userId: string) => void;
}

export const useRoleStore = create<RoleState>((set, get) => ({
  caseId: null,
  caseNumber: null,
  users: [],
  activeUserId: null,
  // Default to JUDGE (full sealed-exhibit visibility) until hydrated — the
  // mockup's own screens default to a judge/full-visibility persona; this
  // avoids a flash of an artificially-restricted view before the first
  // GET /api/case resolves.
  role: 'JUDGE',
  hydrate: (data) => {
    const judge = data.users.find((u) => u.role === 'JUDGE');
    set({
      caseId: data.case.id,
      caseNumber: data.case.caseNumber,
      users: data.users,
      activeUserId: judge?.id ?? data.users[0]?.id ?? null,
      role: judge?.role ?? data.users[0]?.role ?? 'JUDGE',
    });
  },
  setActiveUser: (userId) => {
    const user = get().users.find((u) => u.id === userId);
    if (user) {
      const prevRole = get().role;
      set({ activeUserId: userId, role: user.role });
      if (user.role !== prevRole) {
        // Role change crosses a visibility boundary (sealed-exhibit scope) —
        // start a FRESH assistant conversation so answers computed under
        // different sealed-visibility scopes never mix in one audit thread, and
        // the model never reuses a prior-role answer from history (CONTEXT.md;
        // F7 criterion 4 hygiene; threat T-04-12). The REQUIREMENT is simply:
        // role change ⇒ activeConversationId becomes null. A lazy dynamic import
        // avoids a static import cycle between the two session stores
        // (assistantStore has no reason to import roleStore, and apiClient +
        // useAssistantChat already import roleStore — a top-level import the
        // other way would risk a cycle). Fire-and-forget: the reset is a UI
        // concern, not awaited.
        void import('@/stores/assistantStore').then((m) =>
          m.useAssistantStore.getState().newConversation(),
        );
      }
    }
  },
}));
