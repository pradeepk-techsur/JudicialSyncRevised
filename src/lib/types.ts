import type { ExhibitStatus, OfferingParty } from '@prisma/client';

// Composite row shape returned by GET /api/cases/:id/exhibits and
// GET /api/cases/:id/exhibits/search — avoids a second round-trip per row.
// discrepancyFlags is always [] until Phase 3's DiscrepancyFlag table exists
// (TechArch 02-data-model.md) — this is an honest placeholder, never fabricated.
export interface ExhibitListRow {
  exhibitId: string;
  exhibitLabel: string;
  description: string;
  offeringParty: OfferingParty;
  associatedWitness: string | null;
  currentStatus: ExhibitStatus | null;
  currentCustodianName: string | null;
  discrepancyFlags: [];
}
