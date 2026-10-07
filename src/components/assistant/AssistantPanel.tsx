'use client';

import { useAssistantStore } from '@/stores/assistantStore';
import { AssistantThread } from './AssistantThread';

// =============================================================================
// AssistantPanel — the GLOBAL slide-over ("Ask ✦" on every screen).
//
// Mounted ONCE at the app-shell level (AppShell) so it:
//   - opens OVER the current screen without unmounting the page underneath
//     (the main content keeps its state — CONTEXT.md), and
//   - persists across route navigation (the shell never unmounts).
//
// The thread state lives in the zustand store + useAssistantChat hook, so
// closing/reopening the panel preserves the conversation + scroll. A citation
// click inside the panel routes the screen UNDERNEATH to /exhibit/:id while the
// panel STAYS OPEN — only the explicit close button (or the Ask ✦ toggle) closes
// it. We never close on a pill click.
//
// When closed we keep the container mounted but translated off-screen / hidden,
// so the AssistantThread (and therefore the hook's message state) stays alive.
// =============================================================================

export function AssistantPanel() {
  const isPanelOpen = useAssistantStore((s) => s.isPanelOpen);
  const closePanel = useAssistantStore((s) => s.closePanel);

  return (
    <>
      {/* Click-catching backdrop (does NOT cover the page when closed). Clicking
          it closes the panel — an explicit close gesture. */}
      {isPanelOpen && (
        <div
          data-testid="assistant-backdrop"
          onClick={closePanel}
          className="fixed inset-0 z-40 bg-black/20"
          aria-hidden="true"
        />
      )}

      {/* The slide-over itself. Always mounted (so the thread/hook state
          survives close→reopen); translated off-screen when closed. */}
      <aside
        data-testid="assistant-panel"
        data-open={isPanelOpen ? 'true' : 'false'}
        aria-hidden={isPanelOpen ? undefined : true}
        className={`fixed right-0 top-0 z-50 flex h-screen w-full max-w-md flex-col border-l bg-white shadow-xl transition-transform duration-200 ${
          isPanelOpen ? 'translate-x-0' : 'pointer-events-none translate-x-full'
        }`}
      >
        <AssistantThread variant="panel" onClose={closePanel} />
      </aside>
    </>
  );
}
