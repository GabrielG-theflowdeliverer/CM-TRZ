/**
 * Risk Assessment content, transcribed verbatim from the "DA-Rk" sheet.
 * Two sections x fourteen factors, each scored 1 (min anchor) to 5 (max anchor).
 */

export const RISK_SECTION_KEYS = ['cc', 'oa'] as const;
export type RiskSectionKey = (typeof RISK_SECTION_KEYS)[number];

export const RISK_SECTION_LABELS: Record<RiskSectionKey, string> = {
  cc: 'Change Characteristics',
  oa: 'Organizational Attributes',
};

export interface RiskFactor {
  factor: string;
  min: string; // anchor for score 1
  max: string; // anchor for score 5
}

export const RISK_FACTORS: Record<RiskSectionKey, readonly RiskFactor[]> = {
  cc: [
    { factor: 'Scope of change', min: 'Workgroup', max: 'Enterprise' },
    { factor: 'Number of people impacted', min: 'Less than 10', max: 'Over 1000' },
    { factor: 'Entry point for change management', min: 'Early, at initiation', max: 'Late, at implementation' },
    {
      factor: 'Variation in groups that are impacted',
      min: 'All groups are impacted the same way',
      max: 'All groups experience the change differently',
    },
    { factor: 'Clarity of future state', min: 'Known and clear', max: 'Unknown and emergent' },
    { factor: 'Type of change', min: 'Single aspect, simple change', max: 'Many aspects, complex change' },
    { factor: 'Degree of change impact on individual', min: 'No change', max: '100% impact' },
    { factor: 'Amount of change overall', min: 'Incremental', max: 'Radical' },
    { factor: 'Impact on compensation', min: 'No impact to pay and benefits', max: 'Large impact on pay and benefits' },
    { factor: 'Degree of organizational restructuring', min: 'No restructuring', max: 'Complete restructuring' },
    { factor: 'Reduction in staffing levels', min: 'No reduction', max: 'Significant reduction' },
    { factor: 'Degree of confidentiality required', min: 'Open and transparent', max: 'Closed and confidential' },
    {
      factor: 'Timeframe for change',
      min: 'Sufficient time to prepare, equip and support people',
      max: 'Insufficient time to prepare, equip and support people',
    },
    { factor: 'Degree of external stakeholder impact', min: 'Minimal external impact', max: 'Significant external impact' },
  ],
  oa: [
    {
      factor: 'Perceived need for change among impacted people',
      min: 'People are dissatisfied with current state',
      max: 'People are satisfied with current state',
    },
    { factor: 'Management of past changes', min: 'Well-managed, successful changes', max: 'Poorly managed, failed changes' },
    { factor: 'Change saturation', min: 'Very few changes, under capacity', max: 'Everything is changing, over capacity' },
    {
      factor: 'Shared vision and strategic direction for the organization',
      min: 'Widely shared, unified vision',
      max: 'Many different directions and shifting priorities',
    },
    {
      factor: 'Resources and funding availability to implement change',
      min: 'Adequate resources and funds',
      max: 'Inadequate resources and funds',
    },
    {
      factor: "Organization's culture and responsiveness to change",
      min: 'Open and receptive to change',
      max: 'Closed and resistant to change',
    },
    {
      factor: 'Organizational reinforcement of change',
      min: 'People are rewarded for taking risks and embracing change',
      max: 'People are rewarded for consistency and predictability',
    },
    {
      factor: 'Leadership mindset',
      min: 'Success declared when benefits are realized',
      max: 'Success declared at go live',
    },
    { factor: 'Leadership style and power distribution', min: 'Centralized', max: 'Distributed' },
    {
      factor: 'Executive/senior manager change competency',
      min: 'Highly effective at sponsoring change',
      max: 'Lack skills and knowledge',
    },
    {
      factor: 'People manager change competency',
      min: 'Highly effective at managing change',
      max: 'Lack skills and knowledge',
    },
    {
      factor: 'Impacted employee change competency',
      min: 'Highly effective at thriving in change',
      max: 'Lack skills and knowledge',
    },
    { factor: 'Change management maturity', min: 'Well-established organizational competency', max: 'Ad hoc or absent' },
    { factor: 'Project management maturity', min: 'Well-established organizational competency', max: 'Ad hoc or absent' },
  ],
};

export const RISK_INTERPRETATION_NOTES = [
  'A score of 14 to 42 is considered low risk.',
  'A score of 42 to 70 is medium-to-high risk.',
  'High risk changes require more time, effort and resources than medium or low risk changes.',
] as const;

/** item_key format used by the assessment engine: risk.<section>.<n> (n = 1..14) */
export function riskItemKey(section: RiskSectionKey, factorIndex: number): string {
  return `risk.${section}.${factorIndex + 1}`;
}

export const RISK_ITEM_KEYS: readonly string[] = RISK_SECTION_KEYS.flatMap((section) =>
  RISK_FACTORS[section].map((_, i) => riskItemKey(section, i)),
);
