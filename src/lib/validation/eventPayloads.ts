import { z } from 'zod';

// Discriminated payload schemas for every EventType, copied exactly from the
// FRD Y0-schema.md §Payload shapes. recordEvent() (src/services/events.ts)
// validates an incoming payload against the schema keyed by its eventType
// before any row is written — a malformed ledger row is structurally impossible.

export const offeringPartyEnum = z.enum(['PLAINTIFF', 'PROSECUTION', 'DEFENSE']);
export const exhibitStatusEnum = z.enum([
  'MARKED',
  'OFFERED',
  'OBJECTED',
  'ADMITTED',
  'EXCLUDED',
  'WITHDRAWN',
]);

export const statusChangePayload = z.object({
  fromStatus: exhibitStatusEnum.nullable(),
  toStatus: exhibitStatusEnum,
  notes: z.string().optional(),
});

export const objectionRaisedPayload = z.object({
  objectionId: z.string().uuid(),
  objectingParty: offeringPartyEnum,
  grounds: z.string().min(1),
});

export const rulingRecordedPayload = z.object({
  objectionId: z.string().uuid(),
  disposition: z.enum(['SUSTAINED', 'OVERRULED', 'RESERVED']),
});

export const custodyTransferPayload = z.object({
  fromCustodianUserId: z.string().uuid().nullable(),
  toCustodianUserId: z.string().uuid(),
  reason: z.string().max(300).optional(),
});

export const discrepancyAcknowledgedPayload = z.object({
  discrepancyFlagId: z.string().uuid(),
  ruleCode: z.string(),
  justification: z.string().min(1).max(500),
});

// F13 (Phase 7): a sealed/ex-parte exhibit being explicitly excluded from a jury
// package. The excluding user records an auditable, enumerated reason plus an
// optional free-text note. Emitted by the exclude workflow (plan 07-07) via
// recordEvent(), which validates against this schema BEFORE any row is written —
// without this entry every excludeJuryPackageExhibit() call would throw
// ValidationError unconditionally.
export const juryPackageExhibitExcludedPayload = z.object({
  juryPackageId: z.string().uuid(),
  exhibitId: z.string().uuid(),
  reason: z.enum(['SEALED_EXPARTE', 'MANUAL_REMOVAL']),
  note: z.string().max(500).optional(),
});

// DISCREPANCY_ACKNOWLEDGED's schema is included for completeness per
// Y0-schema.md's full payload table even though no Phase 1 caller emits it yet
// — Phase 3 will.
export const eventPayloadSchemas = {
  STATUS_CHANGE: statusChangePayload,
  OBJECTION_RAISED: objectionRaisedPayload,
  RULING_RECORDED: rulingRecordedPayload,
  CUSTODY_TRANSFER: custodyTransferPayload,
  DISCREPANCY_ACKNOWLEDGED: discrepancyAcknowledgedPayload,
  JURY_PACKAGE_EXHIBIT_EXCLUDED: juryPackageExhibitExcludedPayload,
} as const;
