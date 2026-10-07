'use client';

import { AssistantThread } from '@/components/assistant/AssistantThread';

// =============================================================================
// /assistant — the full-page assistant surface.
//
// Inherits AppShell from the root layout (like /case and /exhibit), so the
// Header (Ask ✦), Sidebar, and the global AssistantPanel are all present here
// too. It renders the SAME AssistantThread over the SAME useAssistantChat hook /
// assistantStore as the slide-over panel — so the conversation is CONTINUOUS
// across both surfaces (CONTEXT.md: one shared thread).
// =============================================================================

export default function AssistantPage() {
  return (
    <div className="mx-auto h-[calc(100vh-8rem)] max-w-3xl rounded-lg border">
      <AssistantThread variant="page" />
    </div>
  );
}
