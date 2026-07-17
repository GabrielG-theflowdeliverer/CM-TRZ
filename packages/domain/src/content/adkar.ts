/**
 * ADKAR model constants and the tactics/activities examples library,
 * transcribed verbatim from the "BP-T" sheet.
 */

export const ADKAR_ELEMENTS = ['awareness', 'desire', 'knowledge', 'ability', 'reinforcement'] as const;
export type AdkarElement = (typeof ADKAR_ELEMENTS)[number];

export const ADKAR_LABELS: Record<AdkarElement, string> = {
  awareness: 'Awareness',
  desire: 'Desire',
  knowledge: 'Knowledge',
  ability: 'Ability',
  reinforcement: 'Reinforcement',
};

export const ADKAR_SHORT: Record<AdkarElement, string> = {
  awareness: 'A',
  desire: 'D',
  knowledge: 'K',
  ability: 'A',
  reinforcement: 'R',
};

export const ADKAR_TACTICS: Record<AdkarElement, readonly string[]> = {
  awareness: [
    'Provide repetitive face-to-face communication of the business reasons for the change and the risks of not changing',
    'Use a variety of communication channels, such as team meetings, emails, bulletin board postings, posters, etc.',
    'Provide employees with ready access to business information, such as external drivers of change',
    'Share customer feedback and develop effective responses',
    'Surface and address rumors',
  ],
  desire: [
    'Help employees identify the personal benefits of the change (WIIFM)',
    'Acknowledge the losses and opportunities associated with the change',
    'Address negative history with change – discuss why previous mistakes occurred and how current and future changes can be implemented differently to ensure success',
    'Engage employees in the change process at the earliest possible stages of the change',
    'Align incentive and performance management systems to support the change',
  ],
  knowledge: [
    'Ensure employees have access to and time to attend training',
    'Use job aids to assist employees in the learning process',
    'Provide open and ready access to information to support learning',
    'Identify employees that others can go to for assistance',
    'Share problems and lessons learned as a team',
  ],
  ability: [
    'Provide one-on-one coaching',
    'Help employees apply what they have learned to real work situations',
    'Ensure that employees have the time and opportunities to develop new skills',
    'Provide solutions when the "real work" does not match what they learned in training',
    'Be a role model for how to act in the new environment',
    'Identify when "more time" is not the answer and external intervention is required',
  ],
  reinforcement: [
    'Celebrate successes',
    'Recognize employees for successfully implementing change',
    'Gather feedback from employees',
    'Identify root causes for low adoption and implement corrective action',
    'Build accountability mechanisms into day-to-day business operations',
  ],
};

/** item_key format used by the assessment engine for ADKAR runs: adkar.<element> */
export function adkarItemKey(element: AdkarElement): string {
  return `adkar.${element}`;
}

export const ADKAR_ITEM_KEYS: readonly string[] = ADKAR_ELEMENTS.map(adkarItemKey);
