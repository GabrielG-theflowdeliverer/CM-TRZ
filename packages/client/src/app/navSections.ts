/** Sidebar structure, shared with the read-only share layout (which drops Settings). */
export const NAV_SECTIONS: Array<{ title: string; items: Array<{ to: string; label: string }> }> = [
  {
    title: 'Project',
    items: [
      { to: 'dashboard', label: 'Project Dashboard' },
      { to: 'settings', label: 'Settings' },
    ],
  },
  {
    title: 'Assess',
    items: [{ to: 'assessments', label: 'Assessments' }],
  },
  {
    title: 'Phase 1 — Prepare Approach',
    items: [
      { to: 'define-success', label: 'Define Success (4 P’s)' },
      { to: 'why-cm', label: 'Why Change Management' },
      { to: 'impact', label: 'Define Impact' },
      { to: 'roles', label: 'Roles' },
      { to: 'resources', label: 'Resources & Governance' },
      { to: 'resistance', label: 'Resistance' },
      { to: 'roadmap', label: 'Roadmap' },
    ],
  },
  {
    title: 'Phase 2 — Manage Change',
    items: [
      { to: 'activities', label: 'Blueprints & Plans' },
      { to: 'blueprints', label: 'ADKAR Blueprints' },
      { to: 'plans', label: 'CM Plans' },
      { to: 'tracking', label: 'Tracking Calendar' },
    ],
  },
  {
    title: 'Phase 3 — Sustain Outcomes',
    items: [
      { to: 'outcomes', label: 'Outcomes' },
      { to: 'reinforcement', label: 'Reinforcement' },
      { to: 'cm-performance', label: 'CM Performance' },
      { to: 'adapt-actions', label: 'Adapt Actions' },
      { to: 'transfer-ownership', label: 'Transfer of Ownership' },
    ],
  },
  {
    title: 'Reference',
    items: [{ to: 'reference', label: 'Methodology Reference' }],
  },
];
