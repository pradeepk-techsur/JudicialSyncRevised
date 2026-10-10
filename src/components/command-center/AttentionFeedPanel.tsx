'use client';

import { useState } from 'react';
import { Tile, Button, SkeletonText } from '@carbon/react';
import { useRouter } from 'next/navigation';
import type { Role } from '@prisma/client';
import { useRoleStore } from '@/stores/roleStore';
import { useAttentionFeed } from '@/hooks/useAttentionFeed';
import { SeverityPill, type SeverityTone } from '@/components/shared/SeverityPill';
import { ExhibitTag } from '@/components/shared/ExhibitTag';
import { Card } from '@/components/shared/Card';
import { RecordRulingForm } from '@/components/actions/RecordRulingForm';
import { TransferCustodyForm } from '@/components/actions/TransferCustodyForm';
import type { AttentionFeedEntry } from '@/services/attentionFeed';
import styles from './AttentionFeedPanel.module.scss';

// F8 Command Center — "Needs your attention" feed (UX Screen-00 §Process steps
// 4-6). This is the SINGLE deliberate, traceable reversal of Phase 5's "strictly
// passive/read-only monitoring" criterion (CONTEXT + FRD "Design decision
// supersedes a prior constraint") — and ONLY for these two inline actions
// (Record ruling / Assign custodian). Every other panel on this screen remains
// exactly as read-only as before.
//
// Role gating is ABSENT-not-disabled (Y0-patterns §Role-Gated Control
// Visibility / F20): an action button renders only for its F20-authorized role.
// These local arrays are a redundant SECOND UI-layer guard — the 08-09 shared
// forms re-check the same gate internally and the server gates are authoritative
// regardless (T-08-26).
const RULING_ROLES: Role[] = ['JUDGE'];
const CUSTODY_ROLES: Role[] = ['DEPUTY', 'CLERK', 'ADMIN'];

// Tier → SeverityPill tone (the shared 4-tone color map). The pill's own label
// text + aria-label are always visible, so color is never the sole signal.
const TIER_TONE: Record<AttentionFeedEntry['tier'], SeverityTone> = {
  CRITICAL: 'critical',
  HIGH: 'high',
  PENDING: 'pending',
  MEDIUM: 'medium',
};

// Title-case a tier word ("CRITICAL" → "Critical") for the pill label + aria copy.
function tierWord(tier: AttentionFeedEntry['tier']): string {
  return tier.charAt(0) + tier.slice(1).toLowerCase();
}

export function AttentionFeedPanel() {
  const role = useRoleStore((s) => s.role);
  const router = useRouter();
  const { data, isLoading, isError } = useAttentionFeed();
  const [openEntryId, setOpenEntryId] = useState<string | null>(null);
  const entries = data ?? [];

  return (
    <Tile data-testid="attention-feed" aria-label="Needs your attention">
      <h2 className={styles.heading}>Needs your attention</h2>
      <p className={styles.caption}>Ranked by risk to the jury</p>

      {isLoading && (
        <div aria-hidden="true">
          <SkeletonText paragraph lineCount={3} width="100%" />
        </div>
      )}

      {isError && (
        <p role="alert" className={styles.error}>
          Unable to load the attention feed — please retry.
        </p>
      )}

      {entries.length === 0 && !isLoading && !isError && (
        <p className={styles.empty}>Nothing needs attention right now.</p>
      )}

      {/* entries render in the EXACT server order (getAttentionFeed already
          concatenates tiers CRITICAL→HIGH→PENDING→MEDIUM, newest-first within
          each). This component performs ZERO sort/re-order of its own —
          rendering entries.map(...) verbatim is itself the correctness
          guarantee. */}
      {entries.map((entry) => {
        const word = tierWord(entry.tier);
        return (
          <Card
            key={entry.id}
            critical={entry.tier === 'CRITICAL'}
            data-testid="attention-feed-entry"
            data-tier={entry.tier}
            data-exhibit-id={entry.exhibitId}
            aria-label={`${word} priority: ${entry.exhibitLabel}, ${entry.summary}`}
            className={styles.entry}
          >
            <div className={styles.entryHeader}>
              <SeverityPill
                tone={TIER_TONE[entry.tier]}
                label={word}
                ariaLabel={`Severity: ${word}`}
              />
              <ExhibitTag label={entry.exhibitLabel} />
            </div>
            <p className={styles.summary}>{entry.summary}</p>
            <p className={styles.detectedAt}>{new Date(entry.detectedAt).toLocaleString()}</p>

            {/* CRITICAL (sealed/ex-parte) — link-through to F13's existing
                Remove-from-Package remediation on the Jury Package Workspace,
                never an inline action. */}
            {entry.availableAction === 'REMOVE_FROM_PACKAGE' && (
              <Button
                kind="danger"
                size="sm"
                data-testid="attention-feed-action-review-remove"
                data-exhibit-id={entry.exhibitId}
                onClick={() => router.push('/jury-package')}
              >
                Review and remove →
              </Button>
            )}

            {/* HIGH / PENDING — inline Record ruling (JUDGE-only, absent-not-
                disabled). Clicking expands the shared form directly within the
                entry; never a modal, never navigation away. */}
            {entry.availableAction === 'RECORD_RULING' &&
              RULING_ROLES.includes(role) &&
              (openEntryId === entry.id ? (
                <RecordRulingForm
                  objectionId={entry.objectionId!}
                  onDone={() => setOpenEntryId(null)}
                />
              ) : (
                <Button
                  kind="primary"
                  size="sm"
                  data-testid="attention-feed-action-record-ruling"
                  data-exhibit-id={entry.exhibitId}
                  onClick={() => setOpenEntryId(entry.id)}
                >
                  Record ruling
                </Button>
              ))}

            {/* MEDIUM — inline Assign custodian (DEPUTY/CLERK/ADMIN-only,
                absent-not-disabled). The MEDIUM tier's trigger condition
                (ADMITTED_NO_CUSTODIAN) by definition means no custodian exists
                yet, so currentCustodianUserId is always null here — the
                first-time-assignment path. */}
            {entry.availableAction === 'TRANSFER_CUSTODY' &&
              CUSTODY_ROLES.includes(role) &&
              (openEntryId === entry.id ? (
                <TransferCustodyForm
                  exhibitId={entry.exhibitId}
                  currentCustodianUserId={null}
                  onDone={() => setOpenEntryId(null)}
                />
              ) : (
                <Button
                  kind="secondary"
                  size="sm"
                  data-testid="attention-feed-action-assign-custodian"
                  data-exhibit-id={entry.exhibitId}
                  onClick={() => setOpenEntryId(entry.id)}
                >
                  Assign custodian
                </Button>
              ))}
          </Card>
        );
      })}
    </Tile>
  );
}
