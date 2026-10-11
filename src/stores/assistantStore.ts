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
  /** The exhibit the panel was opened IN THE CONTEXT OF, or `null` for a generic
   *  (header "Ask Pivota") open. Set only by `openPanelForExhibit` — e.g. the
   *  Exhibit Detail header's "Ask Pivota about {label}" button (T-11 / T-08).
   *  Scoping is a PER-OPENING concept: it biases which example prompts the empty
   *  state pre-fills toward the exhibit the user came from, and is cleared the
   *  moment the panel closes or a new conversation starts so it never silently
   *  persists into an unrelated later conversation. It never changes what the
   *  assistant can SEE — the server's role-scoped tool-call visibility is the sole
   *  authority (T-09-17); this only pre-fills a text string the user could type. */
  scopedExhibitId: string | null;
  openPanel: () => void;
  /** Open the panel scoped to a specific exhibit (context-aware entry point). Both
   *  satisfies T-08's "Ask Pivota about P-7 opens assistant pre-selected" and
   *  powers T-11's context-aware example prompts in ONE place. */
  openPanelForExhibit: (exhibitId: string) => void;
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
  scopedExhibitId: null,
  openPanel: () => set({ isPanelOpen: true }),
  // One set(): open AND scope together so the empty-state chips can read the
  // scope on the very first render after the panel appears.
  openPanelForExhibit: (exhibitId) =>
    set({ isPanelOpen: true, scopedExhibitId: exhibitId }),
  // Closing the panel ends the per-opening scope — a later generic open must not
  // inherit a stale exhibit context.
  closePanel: () => set({ isPanelOpen: false, scopedExhibitId: null }),
  // togglePanel stays the generic (unscoped) toggle. When it CLOSES the panel it
  // also clears any lingering scope (same reasoning as closePanel); when it OPENS
  // it opens unscoped (the header's generic "Ask Pivota" has no exhibit context).
  togglePanel: () =>
    set((s) =>
      s.isPanelOpen
        ? { isPanelOpen: false, scopedExhibitId: null }
        : { isPanelOpen: true },
    ),
  setActiveConversationId: (id) => set({ activeConversationId: id }),
  // Starting a fresh conversation also drops the scope: the new thread is not
  // tied to whatever exhibit the previous opening was about.
  newConversation: () => set({ activeConversationId: null, scopedExhibitId: null }),
}));
