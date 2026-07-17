/**
 * PCT Assessment content, transcribed verbatim from the "PCT" sheet.
 * Four aspects x ten factors, each ranked on a 1-3 scale:
 * 1 = inadequate, 2 = adequate, 3 = exceptional.
 */

export const PCT_ASPECT_KEYS = ['success', 'leadership', 'project_management', 'change_management'] as const;
export type PctAspectKey = (typeof PCT_ASPECT_KEYS)[number];

export const PCT_ASPECT_LABELS: Record<PctAspectKey, string> = {
  success: 'Success',
  leadership: 'Leadership/Sponsorship',
  project_management: 'Project Management',
  change_management: 'Change Management',
};

export const PCT_INTRO =
  'The Prosci Change Triangle (PCT) Model is a simple but powerful framework for understanding the four critical aspects of any successful change effort. ' +
  'Success: clarity on the aim or purpose of the initiative. ' +
  'Leadership/sponsorship: provides strategy, direction and guidance. ' +
  'Project management: addresses the technical side of change by designing, developing and delivering the solution. ' +
  'Change management: addresses the people side of change by enabling people to engage, adopt and use the solution to achieve results and outcomes. ' +
  'The PCT Assessment can be used to position your project for success by assessing project health across the four critical aspects at a point in time. ' +
  'Rank each factor on a 1-3 scale: 1 = inadequate, 2 = adequate, 3 = exceptional';

export const PCT_FACTORS: Record<PctAspectKey, readonly string[]> = {
  success: [
    'Inputs into the change management process are defined (may include a business case, charter, scope, or plan).',
    'Organizational benefits are fully defined (what the organization gains).',
    'Project objectives are fully defined (what the project achieves).',
    'Adoption and usage objectives are fully defined.',
    'Units of measure for benefits and objectives are established.',
    'Benefits and objectives are prioritized.',
    'Benefit and objective ownership is designated.',
    'People dependency of benefits and objectives is evaluated.',
    'The definition of success is clear and ready to be communicated.',
    'The sponsorship coalition is aligned to a common definition of success.',
  ],
  leadership: [
    'The change has a primary sponsor with the necessary authority over the people, processes and systems to authorize and fund the change.',
    'The primary sponsor can clearly explain the nature of the change, the reason for the change, and the benefits for the organization.',
    'The organization has a clearly defined vision and strategy.',
    'The change is aligned with the strategy and vision for the organization.',
    'Priorities are set and communicated regarding the change and other competing priorities.',
    'The primary sponsor is resolving issues and making decisions related to the project schedule, scope and resources.',
    'The primary sponsor is actively and visibly participating throughout the lifecycle of the change.',
    'The primary sponsor is encouraging senior leaders to participate in and support the change by building a sponsor coalition.',
    'The primary sponsor is building awareness of the need for the change directly with employees.',
    'The primary sponsor is visibly reinforcing the change by celebrating successes and addressing resistance.',
  ],
  project_management: [
    'The nature of the change is clearly defined including who is impacted and how.',
    'The project has specific objectives.',
    'The project has a clearly defined scope.',
    'The project has a project manager assigned to manage the project lifecycle.',
    'Project milestones are identified and a project schedule is complete.',
    'A work breakdown structure with deliverables is complete.',
    'Resources for the project are identified and acquired.',
    'Periodic meetings are scheduled with the project team and key stakeholders to track progress and resolve issues.',
    'The project manager understands the value of change management in ensuring the change will be adopted and used.',
    'The Change Management Plan is integrated with the Project Management Plan.',
  ],
  change_management: [
    'The change is applying a structured change management approach to deliver the benefits to the organization.',
    'An assessment of the change and its impact on individuals and the organization is complete.',
    'An assessment of the change risk is complete.',
    'The change has specific adoption and usage objectives.',
    'An assessment of the strength of the sponsor coalition is complete.',
    'A customized and scaled change management strategy with the necessary sponsorship commitment is complete.',
    'The resources required to execute the change strategy and plans are identified, acquired and prepared.',
    'Change management plans that will mitigate resistance and achieve adoption and usage are complete and are being implemented.',
    'The effectiveness of change management is being monitored and adaptive actions are being taken if required to achieve adoption and usage.',
    'The organization is prepared to own and sustain the change.',
  ],
};

/** Score interpretation table shown under the PCT results. */
export const PCT_INTERPRETATION = [
  { range: '25-30', meaning: 'Strength - should be leveraged and maintained' },
  { range: '20-24', meaning: 'Alert/possible risk - needs further investigation' },
  { range: '10-19', meaning: 'High risk/threat - needs immediate action' },
] as const;

/** item_key format used by the assessment engine: pct.<aspect>.<n> (n = 1..10) */
export function pctItemKey(aspect: PctAspectKey, factorIndex: number): string {
  return `pct.${aspect}.${factorIndex + 1}`;
}

export const PCT_ITEM_KEYS: readonly string[] = PCT_ASPECT_KEYS.flatMap((aspect) =>
  PCT_FACTORS[aspect].map((_, i) => pctItemKey(aspect, i)),
);
