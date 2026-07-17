/**
 * Sponsor and Manager Competency Assessments, transcribed verbatim from
 * the "SpComp" and "MgrComp" sheets. Each has 20 items scored 1-5 for a
 * total out of 100.
 */

export interface CompetencySection {
  key: string;
  title: string;
  items: readonly string[];
}

export const SPONSOR_COMPETENCY_SCALE = { min: '1=least', max: '5=most' } as const;

export const SPONSOR_COMPETENCY_SECTIONS: readonly CompetencySection[] = [
  {
    key: 'participation',
    title: 'Participated actively and visibly throughout the project:',
    items: [
      'Attended project and status meetings regularly',
      'Was present to kickoff special events and training sessions.',
      'Held the team accountable for results (defined objectives, conducted ongoing reviews.)',
      'Was involved in critical decision making (at critical milestones, at steering committee meetings, in one-on-one sessions).',
      'Ensured that the project had the right team members, budget, and resources for success.',
      'Was accessible to the project team; ensured that other managers were accessible as well.',
    ],
  },
  {
    key: 'coalition',
    title: 'Built a coalition of sponsorship with peers and managers:',
    items: [
      'Sponsored the change with direct reports (created awareness of the need for change, built support, and followed up).',
      'Established clear expectations with mid-level managers.',
      'Dealt with problem managers (managed resistance).',
      'Created a sponsorship cascade with managers; ensured that they were building support with their direct reports.',
      'Listened to and addressed management concerns.',
      'Held direct, face-to-face meetings with front-line supervisors to explain "what, why, and how."',
      'Provided management/leadership team with frequent updates and status information.',
      'Sponsored the change upward.',
    ],
  },
  {
    key: 'communication',
    title: 'Communicated to employees and managers:',
    items: [
      'Was visible to employees; effectively communicated why the change was happening, the risks of not changing, and the vision for the organization.',
      'Linked key performance indicators and financial objectives to the change.',
      'Enabled communications to be two-way (allowed for feedback and question/answer sessions).',
      'Spoke face-to-face at townhall meetings, road shows, and key presentations.',
      'Communicated frequently throughout the project and with multiple media (not just during kickoff of the project).',
      'Interacted effectively with managers; helped them create and communicate a consistent message to employees.',
    ],
  },
];

export const SPONSOR_INTERPRETATION =
  'Score interpretation: 80-100 = Excellent; 70-79 = Good; 69 and below = Fair to Poor)';

export const MANAGER_COMPETENCY_SCALE = { min: '1=not achieved', max: '5=completely achieved' } as const;

export const MANAGER_COMPETENCY_SECTIONS: readonly CompetencySection[] = [
  {
    key: 'adapting',
    title: 'Adapting to change',
    items: [
      "I sought out information to better understand 'why' the change was occurring.",
      'I asked questions to determine how the change would impact me and my group.',
      'I provided feedback, including any objections, in a clear, non-confrontational manner to my manager and the project team.',
      'If I was resistant to the change, I identified the root cause of my resistance and worked with my manager to find solutions to my objections.',
      'Before introducing the change to my employees, I had made a personal choice to support and participate in the change.',
    ],
  },
  {
    key: 'introducing',
    title: 'Introducing change to your employees',
    items: [
      'I shared with employees the nature of the change in context with the broader vision and direction of the organization.',
      'I explained "why" the change was happening including the risk of not changing.',
      'I formally encouraged dialogue with my employees by asking them to provide feedback and to raise their questions and concerns about the change.',
      'I corrected misinformation that may have been circulating about the change.',
      'I visibly demonstrated my personal support and enthusiasm for the change (my employees saw me as an advocate or sponsor for the change).',
    ],
  },
  {
    key: 'managing',
    title: 'Managing employees through the transition',
    items: [
      'I conducted one-on-one sessions with employees to identify how they would be impacted by the change, to link the change to their job role and to listen to their concerns.',
      'I identified any areas of resistance to the change and effectively managed this resistance.',
      'I assessed the gap between current job knowledge and skills, and the job knowledge and skills needed to support the change, to create professional development plans for each employee.',
      'I provided ongoing information about the change and ensured that employees had the time necessary to attend training.',
      'I mentored employees during the implementation of the change and provided a safe environment for employees to practice, to make mistakes and to adapt to the change.',
    ],
  },
  {
    key: 'reinforcing',
    title: 'Reinforcing and celebrating success',
    items: [
      'I publicly recognized and celebrated achievements and successes achieved by my group.',
      'I recognized individuals for their contribution and support.',
      "I put in place measurement and performance management programs aligned with the change so that my employees' progress was measurable and observable.",
      'I held employees accountable for compliance with the change and their performance in achieving the objectives of the change.',
      'I provided data to the project team on how well employees were embracing the change including specific performance data and areas of resistance.',
    ],
  },
];

export function competencyItemKey(kind: 'sponsor' | 'manager', sectionKey: string, itemIndex: number): string {
  return `${kind}_competency.${sectionKey}.${itemIndex + 1}`;
}

export const SPONSOR_COMPETENCY_ITEM_KEYS: readonly string[] = SPONSOR_COMPETENCY_SECTIONS.flatMap((s) =>
  s.items.map((_, i) => competencyItemKey('sponsor', s.key, i)),
);

export const MANAGER_COMPETENCY_ITEM_KEYS: readonly string[] = MANAGER_COMPETENCY_SECTIONS.flatMap((s) =>
  s.items.map((_, i) => competencyItemKey('manager', s.key, i)),
);
