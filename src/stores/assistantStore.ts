import { create } from 'zustand';

// The Pivota Assistant's client session state (F7). Mirrors useRoleStore: a
// plain zustand store with NO persistence middleware — it is a browser-session
// store, exactly like the role store. CONTEXT.md locks "one continuous
// conversation per browser session": the active conversationId lives here and
// survives navigation within the session, and a full reload starts clean (the
// thread is replayed from the server via GET when the hook remounts with a
// still-set id — but a hard reload clears this store, which is the intended
// "new session" boundary).
//
// Why a store and not component state: the slide-over panel AND the full-page
// /assistant view must read/write the SAME active conversation — switching
// surfaces keeps one thread continuous (CONTEXT.md). Centralizing panel + active
// conversation here keeps 04-05's two UI surfaces purely presentational.

interface AssistantState {
  /** Whether the global "Ask ✦" slide-over panel is open. Panel visibility is
   *  client session state so it persists as the user navigates between screens
   *  (CONTEXT.md: the panel stays open over the screen underneath). */
  isPanelOpen: boolean;
  /** The active conversation. `null` until the FIRST message creates one
   *  server-side (conversation-on-first-message — no empty orphan conversations,
   *  CONTEXT.md). When null, the empty-state example chips are shown. */
  activeConversationId: string | null;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  /** Capture the server-returned conversationId after the first message so every
   *  subsequent send reuses the same thread (read from X-Conversation-Id / the
   *  data-citations part per 04-03's wire contract). */
  setActiveConversationId: (id: string) => void;
  /** Start a fresh conversation. Both the explicit "New conversation" header
   *  control AND the role-switch reset call this: it clears the active
   *  conversation so the next message creates a brand-new one and the empty-state
   *  chips return. Prior conversations remain persisted server-side — this never
   *  deletes anything, it only detaches the client from the current thread. */
  newConversation: () => void;
}

export const useAssistantStore = create<AssistantState>((set) => ({
  isPanelOpen: false,
  activeConversationId: null,
  openPanel: () => set({ isPanelOpen: true }),
  closePanel: () => set({ isPanelOpen: false }),
  togglePanel: () => set((s) => ({ isPanelOpen: !s.isPanelOpen })),
  setActiveConversationId: (id) => set({ activeConversationId: id }),
  newConversation: () => set({ activeConversationId: null }),
}));
