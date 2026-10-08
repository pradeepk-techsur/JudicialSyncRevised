'use client';

import { AssistantThread } from '@/components/assistant/AssistantThread';
import styles from './page.module.scss';

// =============================================================================
// /assistant — the full-page assistant surface.
//
// Inherits AppShell from the root layout (like /case and /exhibit), so the
// Header (Ask ✦), Sidebar, and the global AssistantPanel are all present here
// too. It renders the SAME AssistantThread over the SAME useAssistantChat hook /
// assistantStore as the slide-over panel — so the conversation is CONTINUOUS
// across both surfaces (CONTEXT.md: one shared thread).
//
// CARBON MIGRATION (Phase 6): only the outer container wrapper moved from
// Tailwind utilities to a Carbon-token CSS Module. The SAME shared thread over
// the SAME hook/store is rendered — unchanged.
// =============================================================================

export default function AssistantPage() {
  return (
    <div className={styles.container}>
      <AssistantThread variant="page" />
    </div>
  );
}
