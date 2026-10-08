'use client';

import { usePathname } from 'next/navigation';
import { useAssistantStore } from '@/stores/assistantStore';
import { AssistantThread } from './AssistantThread';
import styles from './AssistantPanel.module.scss';

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
//
// CARBON MIGRATION (Phase 6): this is Phase 4 ARCHITECTURE, not presentation —
// the backdrop + translate-on/off aside, the /assistant suppression, and the
// always-mounted-but-hidden-when-closed behaviour are UNCHANGED. It is
// deliberately NOT a Carbon Modal/ComposedModal (those trap focus and block
// background interaction, which would break "a citation click routes the screen
// underneath while the panel stays open"). Only the backdrop + slide-over
// container styling moved from Tailwind utilities to a Carbon-token CSS Module.
// =============================================================================

export function AssistantPanel() {
  const isPanelOpen = useAssistantStore((s) => s.isPanelOpen);
  const closePanel = useAssistantStore((s) => s.closePanel);
  const pathname = usePathname();

  // On the full-page /assistant surface the page ALREADY renders an
  // AssistantThread over useAssistantChat(). Mounting the panel's own thread
  // there would create a SECOND, independent useChat instance for the same
  // conversation — the two share only activeConversationId in the store, not the
  // live message list, so a turn streamed in one would not appear in the other
  // until a remount/replay (W1: contradicts CONTEXT's one continuous shared
  // thread). Suppress the panel's duplicate thread on /assistant; the full page
  // is the single live surface there. Elsewhere the panel is the only surface, so
  // it renders normally.
  const suppressPanelThread = pathname === '/assistant';

  return (
    <>
      {/* Click-catching backdrop (does NOT cover the page when closed). Clicking
          it closes the panel — an explicit close gesture. */}
      {isPanelOpen && !suppressPanelThread && (
        <div
          data-testid="assistant-backdrop"
          onClick={closePanel}
          className={styles.backdrop}
          aria-hidden="true"
        />
      )}

      {/* The slide-over itself. Always mounted (so the thread/hook state
          survives close→reopen); translated off-screen when closed. On
          /assistant the full page owns the single live thread, so the panel's
          duplicate thread is suppressed (W1) — the panel container is not
          rendered there at all. */}
      {!suppressPanelThread && (
        <aside
          data-testid="assistant-panel"
          data-open={isPanelOpen ? 'true' : 'false'}
          aria-hidden={isPanelOpen ? undefined : true}
          className={`${styles.panel} ${isPanelOpen ? styles.panelOpen : styles.panelClosed}`}
        >
          <AssistantThread variant="panel" onClose={closePanel} />
        </aside>
      )}
    </>
  );
}
