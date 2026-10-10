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
  // Added Phase 8 (F09 §Process step 3): Included (INCLUDED+CLEAN) > Blocked
  // (INCLUDED+FLAGGED) > Not eligible (no JuryPackageExhibit row at all, OR a
  // row with status EXCLUDED). Computed from the case's single
  // most-recently-computed JuryPackage — never independently re-derived. The
  // single source of this precedence is loadJuryEligibilityByExhibit in
  // exhibits.ts (08-08's single-exhibit checklist calls it too, so the two
  // screens can never drift).
  juryPackageEligibility: 'INCLUDED' | 'NOT_ELIGIBLE' | 'BLOCKED';
  // Added Phase 8 (readable Flags column): true iff >=1 ObjectionCurrentState
  // row for this exhibit has status UNRESOLVED, REGARDLESS of currentStatus —
  // this is NOT the same condition as any DiscrepancyFlag rule (an unresolved
  // objection on a still-OFFERED exhibit never fires a discrepancy flag).
  hasUnresolvedObjection: boolean;
  // Added Phase 8 (readable Flags column "Ex parte · restricted"): mirrors
  // Exhibit.isSealed. Only ever true for a role that can already see this row
  // at all (sealed exhibits are absent, not redacted, for other roles) — so
  // this flag is never itself a leak.
  isSealed: boolean;
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
