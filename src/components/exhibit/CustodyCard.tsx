'use client';

import { Tile } from '@carbon/react';
import { useRoleStore } from '@/stores/roleStore';
import type { ExhibitHistoryResponse } from '@/services/history';
import styles from './CustodyCard.module.scss';

// Exhibit Detail right-rail Chain-of-Custody card. Exactly TWO states (a
// custodian name, or "No custodian of record") — never a pending/in-between
// third state, because F19's propose/confirm/cancel is Phase 7.1 scope and is
// skipped (08-CONTEXT locked decision; `custodyCard.pendingTransfer` is
// hard-typed null in 08-08's response and is deliberately not rendered here).
//
// `custodyCard.current` is a raw CustodyCurrentState row (08-08) carrying only
// `currentCustodianUserId` — no joined name — and each `history[].toCustodian`
// is likewise a raw user id. We resolve both to display names CLIENT-SIDE from
// the already-fully-hydrated roleStore roster (T-08-23 accept: the full roster
// is already client-visible via GET /api/case, so this adds no new disclosure)
// rather than widening the backend response.
export function CustodyCard({
  custodyCard,
}: {
  custodyCard: ExhibitHistoryResponse['custodyCard'];
}) {
  const users = useRoleStore((s) => s.users);
  const nameOf = (userId: string | null | undefined): string | null =>
    userId ? users.find((u) => u.id === userId)?.name ?? null : null;

  const { current, history } = custodyCard;
  const currentName = current ? nameOf(current.currentCustodianUserId) : null;

  return (
    <Tile className={styles.card} data-testid="exhibit-custody-card" aria-label="Chain of custody">
      <h2 className={styles.heading}>Chain of Custody</h2>
      <p className={styles.current} data-testid="custody-current">
        {current ? currentName ?? 'Current custodian' : 'No custodian of record'}
      </p>
      {history.length > 0 && (
        <>
          <ol className={styles.chain} data-testid="custody-chain">
            {history.map((h, i) => {
              const isCurrent = i === history.length - 1;
              return (
                <li
                  key={h.eventId}
                  className={isCurrent ? styles.currentLink : undefined}
                  data-testid="custody-chain-entry"
                >
                  {nameOf(h.toCustodian) ?? 'Unknown custodian'}
                  {isCurrent && <span className={styles.currentLabel}> (current)</span>}
                </li>
              );
            })}
          </ol>
          <p className={styles.noGaps} data-testid="custody-no-gaps">
            ✓ No gaps in the chain
          </p>
        </>
      )}
    </Tile>
  );
}
