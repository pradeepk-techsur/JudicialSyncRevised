'use client';

import { useState } from 'react';
import {
  Tile,
  Button,
  SkeletonText,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
} from '@carbon/react';
import { useRouter } from 'next/navigation';
import type { Role } from '@prisma/client';
import { useRoleStore } from '@/stores/roleStore';
import { useAttentionFeed } from '@/hooks/useAttentionFeed';
import { SeverityPill, type SeverityTone } from '@/components/shared/SeverityPill';
import { ExhibitTag } from '@/components/shared/ExhibitTag';
import { RecordRulingForm } from '@/components/actions/RecordRulingForm';
import { TransferCustodyForm } from '@/components/actions/TransferCustodyForm';
import type { AttentionFeedEntry } from '@/services/attentionFeed';
import styles from './AttentionFeedPanel.module.scss';

// F8 Command Center — "Needs your attention" feed (UX Screen-00 §Process steps
// 4-6). Phase 9 (09-01, T-01): the feed is rebuilt from stacked Cards into a
// dense Carbon DataTable (Exhibit / Issue / Severity / Age / Action) so the
// ranked attention list is visible without scrolling at 1440x900 — the stacked-
// card layout pushed it below the fold.
//
// This is the SINGLE deliberate, traceable reversal of Phase 5's "strictly
// passive/read-only monitoring" criterion (CONTEXT + FRD "Design decision
// supersedes a prior constraint") — and ONLY for these two inline actions
// (Record ruling / Assign custodian). Every other panel stays read-only.
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

// Elapsed-time helper for the Age column. Duplicated from ObjectionCard.tsx's
// `elapsed()` — the codebase's established per-component pattern (ObjectionCard /
// RecordRulingForm duplicate their own small constants/helpers rather than
// sharing a module). `detectedAt` arrives as an ISO string over the wire.
function elapsed(since: Date): string {
  const mins = Math.round((Date.now() - since.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  return `${hours}h ago`;
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

      {/* Dense DataTable (NOT paginated — the whole point is "visible without
          scrolling"). Rows render in the EXACT server order (getAttentionFeed
          already concatenates tiers CRITICAL→HIGH→PENDING→MEDIUM, newest-first
          within each). This component performs ZERO sort/re-order of its own —
          rendering entries.map(...) verbatim is itself the correctness
          guarantee. */}
      {entries.length > 0 && !isLoading && !isError && (
        <Table size="sm" className={styles.table} aria-label="Needs your attention">
          <TableHead>
            <TableRow>
              <TableHeader>Exhibit</TableHeader>
              <TableHeader>Issue</TableHeader>
              <TableHeader>Severity</TableHeader>
              <TableHeader>Age</TableHeader>
              <TableHeader>Action</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {entries.map((entry) => {
              const word = tierWord(entry.tier);
              return (
                <TableRow
                  key={entry.id}
                  data-testid="attention-feed-entry"
                  data-tier={entry.tier}
                  data-exhibit-id={entry.exhibitId}
                  aria-label={`${word} priority: ${entry.exhibitLabel}, ${entry.summary}`}
                >
                  <TableCell>
                    <ExhibitTag label={entry.exhibitLabel} />
                  </TableCell>

                  {/* Issue — the summary, plus the objection grounds inline
                      directly beneath it when present (Phase 9 "objection text
                      shows inline on the row, no extra click"). No modal, no
                      expand. */}
                  <TableCell>
                    <span className={styles.summary}>{entry.summary}</span>
                    {entry.objectionGrounds && (
                      <span className={styles.grounds}>&ldquo;{entry.objectionGrounds}&rdquo;</span>
                    )}
                  </TableCell>

                  <TableCell>
                    <SeverityPill
                      tone={TIER_TONE[entry.tier]}
                      label={word}
                      ariaLabel={`Severity: ${word}`}
                    />
                  </TableCell>

                  <TableCell>
                    <span className={styles.age}>{elapsed(new Date(entry.detectedAt))}</span>
                  </TableCell>

                  <TableCell>
                    {/* CRITICAL (sealed/ex-parte) — link-through to F13's
                        existing Remove-from-Package remediation on the Jury
                        Package Workspace, never an inline action. */}
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

                    {/* HIGH / PENDING — inline Record ruling (JUDGE-only,
                        absent-not-disabled). Clicking expands the shared form
                        directly within the Action cell; never a modal, never
                        navigation away. */}
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
                        (ADMITTED_NO_CUSTODIAN) by definition means no custodian
                        exists yet, so currentCustodianUserId is always null here —
                        the first-time-assignment path. */}
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
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Tile>
  );
}
