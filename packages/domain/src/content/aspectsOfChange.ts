/**
 * The 10 Aspects of Change Impact, transcribed verbatim from the
 * "DI1" (labels) and "DI help" (definitions and examples) sheets.
 */

export const ASPECT_KEYS = [
  'processes',
  'systems',
  'tools',
  'job_roles',
  'critical_behaviors',
  'mindset',
  'reporting_structure',
  'performance_reviews',
  'compensation',
  'location',
] as const;
export type AspectKey = (typeof ASPECT_KEYS)[number];

export interface AspectDefinition {
  key: AspectKey;
  label: string;
  definition: string;
}

export const ASPECTS_OF_CHANGE: readonly AspectDefinition[] = [
  {
    key: 'processes',
    label: 'Processes',
    definition:
      'The actions or steps taken to achieve a defined end or outcome. Example: steps in the client engagement process and actions taken to capture data in a cloud-based CRM system.',
  },
  {
    key: 'systems',
    label: 'Systems',
    definition:
      'A combination of people and automated applications organized to meet a set of objectives. Example: the introduction of a new cloud-based CRM solution to manage and analyze client interactions and data throughout the customer lifecycle.',
  },
  {
    key: 'tools',
    label: 'Tools',
    definition:
      'An item or implement used for a specific purpose; can be a physical object such as q mechanical tool or a technical object such as a web authoring tool or software program. Example: a conversion tool to move data from one CRM solution to another one mapping data as needed.',
  },
  {
    key: 'job_roles',
    label: 'Job Roles',
    definition:
      'A description of what a person does including competencies essential to performing well in that job capacity. Example: the client services role responsible for engaging directly with clients.',
  },
  {
    key: 'critical_behaviors',
    label: 'Critical Behaviors',
    definition:
      'Vital or essential response of an individual or group to an action, environment, person or stimulus. Example: the actions of a client services associate based on client needs expressed including engagement with other team members to collaborate on solutions.',
  },
  {
    key: 'mindset',
    label: 'Mindset/Attitudes/Beliefs',
    definition:
      'A mental inclination, disposition or frame of mind reflected in behaviors. Example: the transition from a transactional mode of financial services engagement to one built on relationships with the mindset of improving client retention and advocacy.',
  },
  {
    key: 'reporting_structure',
    label: 'Reporting Structure',
    definition:
      'The authority relationships in a company or organization; who reports to whom. Example: the move from regional sales teams to a global client services team with a different executive leader.',
  },
  {
    key: 'performance_reviews',
    label: 'Performance Reviews',
    definition:
      'The process and indicators of how performance is measured and assessed relative to objectives. Example: the introduction of specific client retention and advocacy objectives for client services associates.',
  },
  {
    key: 'compensation',
    label: 'Compensation',
    definition:
      'The amount of the monetary and non-monetary pay provided in return for work performed. Example: the commission structure and bonus plan for client services associates.',
  },
  {
    key: 'location',
    label: 'Location',
    definition:
      'A physical geographical place that provides facilities for a stated purpose. Example: the consolidation of all client services associates to one floor of the building instead of three separate locations by region.',
  },
];

export const ASPECT_LABELS: Record<AspectKey, string> = Object.fromEntries(
  ASPECTS_OF_CHANGE.map((a) => [a.key, a.label]),
) as Record<AspectKey, string>;

/** Scoring guide shown on each group's Define Impact page (DI1!C12, verbatim). */
export const IMPACT_SCORING_GUIDE =
  'Use the scoring guide to help you score the impact: 0 = No Impact, 1 = Extremely Low Impact, 2 = Low, 3 = Moderate, 4 = High impact, 5 = Extremely High Impact.  ' +
  'An initiative may or may not impact all these aspects but by systematically working through the list you will be able to define both what is and what is not changing as well as surface important aspects of the change you need to consider. ' +
  'Note: Any aspect that is not impacted by the change (rated 0) will be removed from your degree of impact calculation. ' +
  "Impacted individuals don't think about the job aspects that aren't affected, only those that are. " +
  'Removing them from the impact score more accurately reflects what the impacted individuals would perceive the impact to be.';
