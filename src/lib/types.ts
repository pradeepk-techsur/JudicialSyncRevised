import type { ExhibitStatus, OfferingParty } from '@prisma/client';

// Composite row shape returned by GET /api/cases/:id/exhibits and
// GET /api/cases/:id/exhibits/search — avoids a second round-trip per row.
// discrepancyFlags carries the exhibit's active (OPEN+ACKNOWLEDGED) discrepancy
// flags as compact DiscrepancyFlagSummary projections (Phase 3 / F6 populates
// this via the batch-load in exhibits.ts — the Case Workspace ⚑ column renders
// it directly, with zero client-side derivation).
export interface ExhibitListRow {
  exhibitId: string;
  exhibitLabel: string;
  description: string;
  offeringParty: OfferingParty;
  associatedWitness: string | null;
  currentStatus: ExhibitStatus | null;
  currentCustodianName: string | null;
  discrepancyFlags: DiscrepancyFlagSummary[];
}

// Compact, render-ready projection of a DiscrepancyFlag for the Jury Package
// view (03-02) and the exhibit-list row / DiscrepancyBadge (03-03). Produced in
// wave 1 so no later-wave plan has to define the type its predecessor consumes.
// Only OPEN/ACKNOWLEDGED flags are surfaced in the UI (RESOLVED are history);
// `label` is the plain-language copy from ruleLabel() in discrepancyLabels.ts.
export interface DiscrepancyFlagSummary {
  ruleCode: string;
  status: 'OPEN' | 'ACKNOWLEDGED';
  label: string;
}
