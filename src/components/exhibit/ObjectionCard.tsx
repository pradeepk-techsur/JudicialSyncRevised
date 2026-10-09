'use client';

import { useState } from 'react';
import { Button, Tile } from '@carbon/react';
import type { ObjectionCurrentState, Role } from '@prisma/client';
import { useRoleStore } from '@/stores/roleStore';
import { RecordRulingForm } from '@/components/actions/RecordRulingForm';
import styles from './ObjectionCard.module.scss';

// Only a JUDGE may record a ruling (recordRuling's server-side gate, Phase 1).
// We duplicate the tiny RULING_ROLES array locally — the established
// per-component pattern (JuryPackageDraft's FINALIZE_ROLES, RecordRulingForm's
// own RULING_ROLES) — rather than a shared roles module. This is deliberately
// belt-and-suspenders (T-08-22): RecordRulingForm already null-renders for a
// non-JUDGE role, but gating the TRIGGER button here as well means an
// unauthorized role never even sees the "Record ruling" affordance — absent,
// not disabled, all the way down (Y0-patterns §Role-Gated Control Visibility).
const RULING_ROLES: Role[] = ['JUDGE'];

// `raisedAt` arrives as an ISO string once the history payload has round-tripped
// through NextResponse.json, but is a Date in-process — accept both.
function elapsed(since: Date): string {
  const mins = Math.round((Date.now() - since.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  return `${hours}h ago`;
}

export function ObjectionCard({ objections }: { objections: ObjectionCurrentState[] }) {
  const role = useRoleStore((s) => s.role);
  const canRule = RULING_ROLES.includes(role);
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <Tile className={styles.card} data-testid="exhibit-objection-card" aria-label="Objection">
      <h2 className={styles.heading}>Objection</h2>
      {objections.length === 0 ? (
        <p className={styles.empty} data-testid="objection-card-empty">
          No open objections
        </p>
      ) : (
        objections.map((obj) => (
          <div
            key={obj.objectionId}
            className={styles.thread}
            data-testid="objection-thread"
            data-objection-id={obj.objectionId}
          >
            <p className={styles.grounds}>
              {obj.objectingParty}: {obj.grounds}
            </p>
            <p className={styles.caption}>
              Raised {elapsed(new Date(obj.raisedAt))}. Only the judge can rule.
            </p>
            {canRule &&
              (openId !== obj.objectionId ? (
                <Button
                  kind="primary"
                  size="sm"
                  type="button"
                  data-testid="objection-record-ruling-trigger"
                  onClick={() => setOpenId(obj.objectionId)}
                >
                  Record ruling
                </Button>
              ) : (
                <RecordRulingForm
                  objectionId={obj.objectionId}
                  onDone={() => setOpenId(null)}
                />
              ))}
          </div>
        ))
      )}
    </Tile>
  );
}
