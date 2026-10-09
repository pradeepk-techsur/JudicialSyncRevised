'use client';

import { InlineLoading, InlineNotification } from '@carbon/react';
import { useJuryPackage } from '@/hooks/useJuryPackage';
import { useDiscrepancyCount } from '@/hooks/useDiscrepancyCount';
import { JuryPackageEmpty } from '@/components/jury/JuryPackageEmpty';
import { JuryPackageDraft } from '@/components/jury/JuryPackageDraft';
import { JuryPackageFinalized } from '@/components/jury/JuryPackageFinalized';

// The /jury-package route (F11) — a pure presentation + action-trigger layer over
// the 03-02 endpoints. It READS on mount (the GET never creates a draft — ROADMAP
// criterion 5) and renders one of three states from live server truth:
//   - juryPackage === null        → JuryPackageEmpty (no package started yet)
//   - juryPackage.status DRAFT     → JuryPackageDraft (gate + acknowledge)
//   - juryPackage.status FINALIZED → JuryPackageFinalized (read-only export)
export default function JuryPackagePage() {
  const { data, isLoading, isError, dataUpdatedAt, initiate, finalize, exclude, acknowledge } =
    useJuryPackage();
  // Case-wide flags: the Draft view resolves the concrete DiscrepancyFlag.id for
  // an (exhibitId, ruleCode) pair from here (the jury rows carry no flag id).
  const { flags: caseFlags } = useDiscrepancyCount();

  if (isLoading) {
    return <InlineLoading description="Loading jury package…" />;
  }
  if (isError || !data) {
    return (
      <InlineNotification
        kind="error"
        lowContrast
        hideCloseButton
        title="Unable to load the jury package — please retry."
      />
    );
  }

  const pkg = data.juryPackage;

  if (pkg === null) {
    return (
      <JuryPackageEmpty
        onInitiate={() => initiate.mutate()}
        pending={initiate.isPending}
        error={initiate.error}
      />
    );
  }

  if (pkg.status === 'FINALIZED') {
    return (
      <JuryPackageFinalized
        juryPackage={pkg}
        exhibits={data.exhibits}
        onStartNewDraft={() => initiate.mutate()}
        startDraftPending={initiate.isPending}
      />
    );
  }

  // DRAFT
  return (
    <JuryPackageDraft
      juryPackage={pkg}
      exhibits={data.exhibits}
      caseFlags={caseFlags}
      dataUpdatedAt={dataUpdatedAt}
      onFinalize={(id) => finalize.mutate(id)}
      onExclude={(exhibitId) =>
        exclude.mutate({ juryPackageId: pkg.id, exhibitId, reason: 'SEALED_EXPARTE' })
      }
      onAcknowledge={(flagId, justification) =>
        acknowledge.mutateAsync({ flagId, justification })
      }
      finalizePending={finalize.isPending}
      finalizeError={finalize.error}
      acknowledgePending={acknowledge.isPending}
    />
  );
}
