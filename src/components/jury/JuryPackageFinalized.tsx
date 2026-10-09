'use client';

import {
  Button,
  InlineNotification,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import type { Role } from '@prisma/client';
import { StatusBadge } from '@/components/StatusBadge';
import { ExhibitTag } from '@/components/shared/ExhibitTag';
import { useRoleStore } from '@/stores/roleStore';
import type { JuryPackageDto, JuryPackageExhibitView } from '@/hooks/useJuryPackage';
import styles from './JuryPackageFinalized.module.scss';

const INITIATE_ROLES: Role[] = ['DEPUTY', 'CLERK', 'ADMIN'];

// Read-only FINALIZED view (CONTEXT export/print + finalize success). The screen
// computes nothing — it renders the server-provided (already role-filtered)
// exhibit list, so sealed exhibits never appear for an unauthorized viewer, and
// window.print() prints exactly that DOM (T-03-14). finalizedBy is resolved to a
// name via the already-hydrated useRoleStore roster, avoiding an API change.
//
// Phase 6 swaps only the rendering layer: the green success banner becomes a
// Carbon `InlineNotification kind="success"`, the exhibit list becomes Carbon
// Table primitives, and the action buttons become Carbon `Button`s. CRITICAL and
// preserved verbatim: the `jury-print-root` and `no-print` GLOBAL print class
// names (06-01's preserved print CSS, T-06-16), window.print() handler, and all
// data-testids. The former Tailwind `hidden print:block` header is reimplemented
// as a CSS Module `.printOnly` @media print rule.
export function JuryPackageFinalized({
  juryPackage,
  exhibits,
  onStartNewDraft,
  startDraftPending,
}: {
  juryPackage: JuryPackageDto;
  exhibits: JuryPackageExhibitView[];
  onStartNewDraft: () => void;
  startDraftPending?: boolean;
}) {
  const role = useRoleStore((s) => s.role);
  const users = useRoleStore((s) => s.users);
  const caseNumber = useRoleStore((s) => s.caseNumber);
  const canStartNew = INITIATE_ROLES.includes(role);

  const finalizedByName =
    users.find((u) => u.id === juryPackage.finalizedBy)?.name ?? juryPackage.finalizedBy ?? 'Unknown';
  const finalizedAt = juryPackage.finalizedAt
    ? new Date(juryPackage.finalizedAt).toLocaleString()
    : '—';

  return (
    <div data-testid="jury-package-finalized" className="jury-print-root">
      {/* Print-only handoff header — hidden on screen, shown when printing. */}
      <div className={styles.printOnly}>
        <p className={styles.printCaseLine}>Case {caseNumber ?? ''}</p>
        <h1 className={styles.printTitle}>Jury Package — FINALIZED</h1>
      </div>

      <InlineNotification
        kind="success"
        lowContrast
        hideCloseButton
        data-testid="jury-finalized-banner"
        title="FINALIZED ✓ Zero discrepancies"
        subtitle={`Finalized by ${finalizedByName} on ${finalizedAt}.`}
      />

      <div className={styles.table}>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Label</TableHeader>
              <TableHeader>Status</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {exhibits.map((row) => (
              <TableRow key={row.exhibitId} data-exhibit-label={row.exhibitLabel}>
                <TableCell className={styles.label}>
                  <ExhibitTag label={row.exhibitLabel} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={row.currentStatus} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className={`no-print ${styles.actions}`}>
        <Button
          kind="primary"
          type="button"
          data-testid="jury-export-print"
          onClick={() => window.print()}
        >
          Export / Print
        </Button>
        {canStartNew && (
          <Button
            kind="secondary"
            type="button"
            data-testid="jury-start-new-draft"
            onClick={onStartNewDraft}
            disabled={startDraftPending}
          >
            {startDraftPending ? 'Starting…' : 'Start New Draft'}
          </Button>
        )}
      </div>
    </div>
  );
}
