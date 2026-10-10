'use client';

import { useRoleStore } from '@/stores/roleStore';
import styles from './ActiveRoleBanner.module.scss';

// T-09: a persistent, dismiss-free safety strip naming the currently-active demo
// persona, with a "Switch back" affordance restoring the previous one. Mounted
// ONCE at the shell level (same "mount once, not per-page" pattern as the
// AssistantPanel) so it persists across route navigation.
//
// It renders ONLY after at least one real role switch has happened
// (`previousUserId !== null`). Before any switch there is nothing to switch back
// to and no ambiguity to warn about, so the default/first-load experience stays
// uncluttered. Per 09-CONTEXT decision #1 this is a UX/safety affordance only —
// it reads existing demo-session client state and triggers no new server
// authorization code.
export function ActiveRoleBanner() {
  const activeUserId = useRoleStore((s) => s.activeUserId);
  const previousUserId = useRoleStore((s) => s.previousUserId);
  const users = useRoleStore((s) => s.users);
  const setActiveUser = useRoleStore((s) => s.setActiveUser);

  // Nothing to switch back to yet — stay hidden on first load / before any switch.
  if (!previousUserId) return null;

  const activeUser = users.find((u) => u.id === activeUserId);
  const previousUser = users.find((u) => u.id === previousUserId);

  // If the roster hasn't resolved the active user for some reason, there's
  // nothing meaningful to announce.
  if (!activeUser) return null;

  return (
    <div className={styles.banner} role="status" data-testid="active-role-banner">
      <span className={styles.label}>
        Active role: <strong>{activeUser.name}</strong> ({activeUser.role})
      </span>
      {previousUser && (
        <button
          type="button"
          className={styles.switchBack}
          data-testid="active-role-switch-back"
          onClick={() => setActiveUser(previousUser.id)}
        >
          Switch back to {previousUser.name} ({previousUser.role})
        </button>
      )}
    </div>
  );
}
