// The SINGLE source of plain-language copy for discrepancy rule codes.
//
// Every consumer that renders a rule to a human (03-02's jury-package view,
// 03-03's DiscrepancyBadge, 03-04's banners) imports ruleLabel from here — there
// is exactly one copy of this map, so the wording can never drift between
// screens. Unknown codes fall back to the raw code (defensive: a new rule added
// without copy still renders something meaningful rather than crashing).

const RULE_LABELS: Record<string, string> = {
  ADMITTED_NO_CUSTODIAN: 'No custodian on record',
  UNRESOLVED_OBJECTION_JURY_ELIGIBLE: 'Unresolved objection',
};

export function ruleLabel(ruleCode: string): string {
  return RULE_LABELS[ruleCode] ?? ruleCode;
}
