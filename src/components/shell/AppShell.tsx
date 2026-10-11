import type { ReactNode } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { ActiveRoleBanner } from './ActiveRoleBanner';
import { AssistantPanel } from '@/components/assistant/AssistantPanel';
import styles from './AppShell.module.scss';

// The app shell composes the now-Carbon Header + Sidebar with a role="main"
// content region. The overall "fixed header, fixed sidebar, independently
// scrolling main" frame is a product requirement (Y1-responsive.md), carried by
// AppShell.module.scss rather than Carbon's Content grid, which doesn't map onto
// this exact shape.
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <Header />
      {/* T-09: persistent active-role safety strip, mounted ONCE here at the
          shell level (same pattern as the AssistantPanel) so it persists across
          route navigation. Self-hides until a real role switch has happened. */}
      <ActiveRoleBanner />
      <div className={styles.body}>
        <Sidebar />
        <main className={styles.main} role="main">
          {children}
        </main>
      </div>
      {/* The global "Ask ✦" slide-over, mounted ONCE here at the shell level so
          it opens OVER any screen and persists (thread + scroll) across route
          navigation without unmounting the page underneath (Phase 4 decision,
          CONTEXT.md). Do NOT move this into Header/Sidebar or any page. */}
      <AssistantPanel />
    </div>
  );
}
