/**
 * Stable 32-bit signed integer hash of the exhibitId, used as the key for a
 * Postgres transaction-scoped advisory lock (pg_advisory_xact_lock). This
 * serializes concurrent writers for the SAME exhibit without depending on a
 * current-state row existing yet — unlike SELECT ... FOR UPDATE, which cannot
 * lock a row that does not exist on an exhibit's first event.
 *
 * Shared by every read-check-write service path that must be serialized
 * per-exhibit (status transitions, custody transfers) so they all contend on
 * the exact same lock key for a given exhibit.
 */
export function advisoryLockKey(exhibitId: string): number {
  let hash = 0;
  for (let i = 0; i < exhibitId.length; i++) {
    hash = (hash << 5) - hash + exhibitId.charCodeAt(i);
    hash |= 0; // force 32-bit signed
  }
  return hash;
}
